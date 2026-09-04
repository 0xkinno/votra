const hre = require('hardhat');
const fs = require('node:fs');

async function main() {
  const { ethers, fhevm } = hre;
  const manifestPath = process.env.VOTRA_EXACT_MANIFEST || 'evidence/deployments/votra-exact-canonical.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const [deployer] = await ethers.getSigners();
  const keys = [process.env.VOTRA_PRIVATE_KEY, process.env.VOTRA_PARTICIPANT_B_PRIVATE_KEY, process.env.VOTRA_PARTICIPANT_C_PRIVATE_KEY];
  if (keys.some((key) => !key)) throw new Error('Missing participant private-key variables');
  const participants = keys.map((key) => new ethers.Wallet(key, ethers.provider));
  const pool = await ethers.getContractAt('VotraCommitmentPool', manifest.pool.address);
  const draw = await ethers.getContractAt('VotraExactDraw', manifest.draw.address);
  const asset = await ethers.getContractAt('VotraConfidentialAsset', manifest.asset.address);
  const reserve = await ethers.getContractAt('VotraPrizeReserve', manifest.reserve.address);
  await fhevm.initializeCLIApi();
  const retry = async (fn, attempts = Number(process.env.VOTRA_RELAYER_RETRIES || 8)) => { let last; for (let i = 1; i <= attempts; i++) { try { return await fn(); } catch (error) { last = error; if (i < attempts) await new Promise((resolve) => setTimeout(resolve, Math.min(30000, 5000 * i))); } } throw last; };
  const historyMode = process.env.VOTRA_HISTORY_CAMPAIGN === '1';
  const evidence = { network: 'sepolia', campaignType: historyMode ? 'history-sensitive-fresh-deployment' : 'canonical', deployment: manifest, participants: participants.map((p, i) => ({ id: String.fromCharCode(65 + i), address: p.address, privateState: 'not included in public artifact' })), referenceModel: historyMode ? { A: ['compliant','breach','recovery'], B: ['breach','recovery','compliant'], C: ['compliant','compliant','compliant'], finalBalances: [150,150,150], assertion: 'equal final balances do not imply equal CW' } : undefined, steps: [], decryptions: [], startedAt: new Date().toISOString() };
  const send = async (label, txPromise, contract, functionName) => { const tx = await txPromise; const receipt = await tx.wait(); evidence.steps.push({ label, contract, function: functionName, hash: tx.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), timestamp: (await ethers.provider.getBlock(receipt.blockNumber)).timestamp }); return receipt; };
  const enc = async (address, value) => fhevm.createEncryptedInput(manifest.pool.address, address).add64(value).encrypt();
  const floor = 100;
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const bal = await ethers.provider.getBalance(p.address);
    if (bal < ethers.parseEther('0.001')) throw new Error(`Participant ${String.fromCharCode(65 + i)} needs Sepolia ETH; address=${p.address}`);
    const f = await retry(() => enc(p.address, floor));
    try { await send(`participant ${String.fromCharCode(65 + i)} encrypted commitment`, pool.connect(p).setCommitment(f.handles[0], f.inputProof), manifest.pool.address, 'setCommitment'); }
    catch (error) { if (!String(error.message).includes('commitment frozen')) throw error; evidence.steps.push({ label: `participant ${String.fromCharCode(65 + i)} encrypted commitment`, skipped: true, reason: 'already committed on resumable deployment' }); }
  }
  const deposits = [150, 50, 150];
  for (let i = 0; i < participants.length; i++) { const p = participants[i]; const d = await retry(() => enc(p.address, deposits[i])); await send(`participant ${String.fromCharCode(65 + i)} encrypted deposit`, pool.connect(p).deposit(d.handles[0], d.inputProof), manifest.pool.address, 'deposit'); }
  await new Promise((resolve) => setTimeout(resolve, 15000));
  const aBreach = await retry(() => enc(participants[0].address, 60)); await send('participant A breach withdrawal', pool.connect(participants[0]).withdraw(aBreach.handles[0], aBreach.inputProof), manifest.pool.address, 'withdraw');
  await new Promise((resolve) => setTimeout(resolve, 15000));
  const aRecovery = await retry(() => enc(participants[0].address, 60)); await send('participant A recovery deposit', pool.connect(participants[0]).deposit(aRecovery.handles[0], aRecovery.inputProof), manifest.pool.address, 'deposit');
  const bRecoveryAmount = historyMode ? 100 : 60;
  const bRecovery = await retry(() => enc(participants[1].address, bRecoveryAmount)); await send('participant B recovery deposit', pool.connect(participants[1]).deposit(bRecovery.handles[0], bRecovery.inputProof), manifest.pool.address, 'deposit');
  await send('mint confidential prize reserve funding', asset.connect(deployer).mintDemo(1000), manifest.asset.address, 'mintDemo');
  const reserveAmount = await asset.confidentialBalanceOf(deployer.address);
  await send('fund confidential prize reserve', asset.connect(deployer)['confidentialTransferAndCall(address,bytes32,bytes)'](manifest.reserve.address, reserveAmount, ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [1])), manifest.asset.address, 'confidentialTransferAndCall');
  for (let i = 0; i < participants.length; i++) await send(`participant ${String.fromCharCode(65 + i)} enters draw`, draw.connect(participants[i]).enter(), manifest.draw.address, 'enter');
  await send('open encrypted multi-participant draw', draw.open(), manifest.draw.address, 'open');
  for (let i = 0; i < participants.length; i++) {
    const tx = await draw.connect(participants[i]).winnerBit(i); const receipt = await tx.wait(); evidence.steps.push({ label: `participant ${String.fromCharCode(65 + i)} encrypted winner computation`, contract: manifest.draw.address, function: 'winnerBit', hash: tx.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), timestamp: (await ethers.provider.getBlock(receipt.blockNumber)).timestamp });
    const handle = await draw.winnerBit.staticCall(i);
    try { evidence.decryptions.push({ participant: String.fromCharCode(65 + i), authorized: true, winner: await fhevm.userDecryptEbool(handle, manifest.draw.address, participants[i]) }); } catch (error) { evidence.decryptions.push({ participant: String.fromCharCode(65 + i), authorized: false, error: error.message }); }
    await send(`participant ${String.fromCharCode(65 + i)} confidential settlement`, draw.settleParticipant(i), manifest.draw.address, 'settleParticipant');
    await send(`participant ${String.fromCharCode(65 + i)} confidential claim`, reserve.connect(participants[i]).claim(1), manifest.reserve.address, 'claim');
  }
  evidence.finishedAt = new Date().toISOString(); fs.mkdirSync('evidence/live', { recursive: true }); fs.writeFileSync(historyMode ? 'evidence/history-sensitivity/live-campaign.json' : 'evidence/live/multi-participant-campaign.json', JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence, null, 2));
}
main().catch((error) => { fs.mkdirSync('evidence/live', { recursive: true }); fs.writeFileSync('evidence/live/multi-participant-campaign-failure.json', JSON.stringify({ failedAt: new Date().toISOString(), message: error.message, stack: error.stack }, null, 2)); console.error(error.stack || error); process.exitCode = 1; });
