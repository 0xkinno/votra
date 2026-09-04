const hre = require('hardhat');
const fs = require('node:fs');
const { FhevmType } = require('@fhevm/hardhat-plugin');
console.log(`[live-campaign] boot node=${process.version} pid=${process.pid}`);

async function main() {
  console.log('[live-campaign] entering main');
  const { ethers, fhevm } = hre;
  const manifest = JSON.parse(fs.readFileSync('evidence/deployments/votra-commitment-pool.json', 'utf8'));
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No signer configured');
  const saver = ethers.Wallet.createRandom().connect(ethers.provider);
  const funding = await deployer.sendTransaction({ to: saver.address, value: ethers.parseEther('0.015') });
  const fundingReceipt = await funding.wait();
  const pool = await ethers.getContractAt('VotraCommitmentPool', manifest.pool.address);
  const draw = await ethers.getContractAt('VotraDraw', manifest.draw.address);
  const asset = await ethers.getContractAt('VotraConfidentialAsset', manifest.asset.address);
  const reserve = await ethers.getContractAt('VotraPrizeReserve', manifest.reserve.address);
  const diagnostics = { node: process.version, sdk: require('@zama-fhe/relayer-sdk/package.json').version, network: 'sepolia', relayerBase: 'https://relayer.testnet.zama.org', stages: [] };
  const stage = async (name, fn) => { const started = Date.now(); try { const value = await fn(); diagnostics.stages.push({ name, outcome: 'ok', elapsedMs: Date.now() - started }); return value; } catch (error) { diagnostics.stages.push({ name, outcome: 'error', elapsedMs: Date.now() - started, error: error.message, code: error.code, cause: error.cause && { name: error.cause.name, message: error.cause.message, code: error.cause.code } }); throw error; } };
  const retry = async (name, fn, attempts = 4) => { let last; for (let i = 1; i <= attempts; i++) { try { return await stage(`${name} attempt ${i}`, fn); } catch (error) { last = error; if (i < attempts) await new Promise((resolve) => setTimeout(resolve, 5000 * i)); } } throw last; };
  await retry('initializeCLIApi', () => fhevm.initializeCLIApi());
  const evidence = { network: 'sepolia', participant: saver.address, funder: deployer.address, contracts: { pool: manifest.pool.address, draw: manifest.draw.address, asset: manifest.asset.address, reserve: manifest.reserve.address }, steps: [{ label: 'fund fresh participant', hash: funding.hash, blockNumber: fundingReceipt.blockNumber, gasUsed: fundingReceipt.gasUsed.toString() }], confidentiality: [], startedAt: new Date().toISOString() };
  async function send(label, txPromise) { const tx = await txPromise; const receipt = await tx.wait(); evidence.steps.push({ label, hash: tx.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString() }); return receipt; }
  const floor = await retry('encrypt commitment input', () => fhevm.createEncryptedInput(manifest.pool.address, saver.address).add64(100).encrypt());
  await send('set encrypted commitment floor', pool.connect(saver).setCommitment(floor.handles[0], floor.inputProof));
  const amount = await retry('encrypt deposit input', () => fhevm.createEncryptedInput(manifest.pool.address, saver.address).add64(150).encrypt());
  await send('deposit encrypted balance', pool.connect(saver).deposit(amount.handles[0], amount.inputProof));
  await new Promise((resolve) => setTimeout(resolve, 15000));
  await send('mint confidential prize reserve funding', asset.connect(deployer).mintDemo(1000));
  const reserveAmount = await asset.confidentialBalanceOf(deployer.address);
  await send('fund confidential prize reserve', asset.connect(deployer)['confidentialTransferAndCall(address,bytes32,bytes)'](manifest.reserve.address, reserveAmount, ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [1])));
  await send('enter draw', draw.connect(saver).enter());
  await send('open encrypted draw', draw.open());
  const winnerTx = await draw.connect(saver).winnerBit(0);
  const winnerReceipt = await winnerTx.wait();
  evidence.steps.push({ label: 'compute encrypted winner bit', hash: winnerTx.hash, blockNumber: winnerReceipt.blockNumber, gasUsed: winnerReceipt.gasUsed.toString() });
  const handle = await draw.winnerBit.staticCall(0);
  const weightHandle = await pool.weightOf(saver.address);
  try { evidence.confidentiality.push({ claim: 'authorized saver decrypts weight', outcome: String(await fhevm.userDecryptEuint(FhevmType.euint64, weightHandle, manifest.pool.address, saver)) }); } catch (e) { evidence.confidentiality.push({ claim: 'authorized saver decrypts weight', outcome: `error: ${e.message}` }); }
  try { const normalizedHandle = typeof handle === 'string' ? handle : (handle?.[0] || handle?.handle || handle?.toString?.()); const clearWinner = await fhevm.userDecryptEbool(normalizedHandle, manifest.draw.address, saver); evidence.confidentiality.push({ claim: 'authorized saver decrypts winner bit', outcome: 'allowed', value: clearWinner }); } catch (e) { evidence.confidentiality.push({ claim: 'authorized saver decrypts winner bit', outcome: `error: ${e.message}` }); }
  await send('settle participant confidential prize', draw.settleParticipant(0));
  await send('claim confidential prize', reserve.connect(saver).claim(1));
  evidence.finishedAt = new Date().toISOString(); evidence.diagnostics = diagnostics; fs.mkdirSync('evidence/live', { recursive: true }); fs.writeFileSync('evidence/live/votra-draw-campaign.json', JSON.stringify(evidence, null, 2)); fs.writeFileSync('evidence/live/canonical-campaign.json', JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence, null, 2));
}
main().catch((error) => { fs.mkdirSync('evidence/live', { recursive: true }); fs.writeFileSync('evidence/live/votra-draw-campaign-failure.json', JSON.stringify({ failedAt: new Date().toISOString(), error: { message: error.message, stack: error.stack, code: error.code, cause: error.cause && { name: error.cause.name, message: error.cause.message, code: error.cause.code } } }, null, 2)); console.error(error.stack || error); process.exitCode = 1; });
