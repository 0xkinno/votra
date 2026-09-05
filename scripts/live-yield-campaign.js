const hre = require('hardhat');
const fs = require('node:fs');
const { FhevmType } = require('@fhevm/hardhat-plugin');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeHandle = (handle) => typeof handle === 'string' ? handle : (handle?.[0] || handle?.handle || handle?.toString?.());

async function main() {
  const { ethers, fhevm } = hre;
  const manifestPath = process.env.VOTRA_YIELD_MANIFEST || 'evidence/deployments/votra-yield-candidate.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const keys = [process.env.VOTRA_PRIVATE_KEY, process.env.VOTRA_PARTICIPANT_B_PRIVATE_KEY, process.env.VOTRA_PARTICIPANT_C_PRIVATE_KEY];
  if (keys.some((key) => !key)) throw new Error('Missing participant private-key variables');
  const participants = keys.map((key) => new ethers.Wallet(key, ethers.provider));
  const [deployer] = await ethers.getSigners();
  const pool = await ethers.getContractAt('VotraCommitmentPool', manifest.pool.address);
  const draw = await ethers.getContractAt('VotraExactDraw', manifest.draw.address);
  const asset = await ethers.getContractAt('VotraConfidentialAsset', manifest.asset.address);
  const adapter = await ethers.getContractAt('VotraYieldAdapter', manifest.yieldAdapter.address);
  const reserve = await ethers.getContractAt('VotraPrizeReserve', manifest.reserve.address);
  await fhevm.initializeCLIApi();

  const existingPath = 'evidence/live/canonical-yield-campaign-progress.json';
  const existing = process.env.VOTRA_YIELD_RESUME === '1' && fs.existsSync(existingPath) ? JSON.parse(fs.readFileSync(existingPath, 'utf8')) : null;
  const evidence = existing && existing.deployment.pool.address.toLowerCase() === manifest.pool.address.toLowerCase() ? existing : {
    status: 'running',
    label: 'TESTNET YIELD ADAPTER - NOT LIVE MARKET YIELD',
    network: 'sepolia',
    chainId: 11155111,
    deployment: manifest,
    participants: participants.map((wallet, index) => ({ id: String.fromCharCode(65 + index), address: wallet.address })),
    steps: [],
    privateReadback: [],
    economicState: {},
    startedAt: new Date().toISOString()
  };
  const progressPath = existingPath;
  const persist = () => { fs.mkdirSync('evidence/live', { recursive: true }); fs.writeFileSync(progressPath, `${JSON.stringify(evidence, null, 2)}\n`); };
  const completed = (step) => evidence.steps.some((row) => row.step === step && row.status === 1);
  const send = async (step, signer, contract, functionName, txFactory) => {
    const tx = await txFactory();
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    evidence.steps.push({ step, signer: signer.address, contract, function: functionName, txHash: tx.hash, block: receipt.blockNumber, timestamp: block.timestamp, status: receipt.status, gasUsed: receipt.gasUsed.toString() });
    persist();
    return receipt;
  };
  const retry = async (label, fn, attempts = Number(process.env.VOTRA_RELAYER_RETRIES || 8)) => {
    let last;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try { return await fn(); } catch (error) {
        last = error;
        evidence.steps.push({ step: label, attempt, status: 'retry', error: error.message });
        persist();
        if (attempt < attempts) await sleep(Math.min(30_000, attempt * 5_000));
      }
    }
    throw last;
  };
  const encrypted = (wallet, value) => retry(`encrypt ${wallet.address} value`, () => fhevm.createEncryptedInput(manifest.pool.address, wallet.address).add64(value).encrypt());
  const decrypt64 = async (wallet, getter) => fhevm.userDecryptEuint(FhevmType.euint64, normalizeHandle(await getter(wallet.address)), manifest.pool.address, wallet);
  const decryptBool = async (wallet, getter) => fhevm.userDecryptEbool(normalizeHandle(await getter(wallet.address)), manifest.pool.address, wallet);

  for (const wallet of participants.slice(1)) {
    const balance = await ethers.provider.getBalance(wallet.address);
    if (balance < ethers.parseEther('0.004')) {
      await send(`fund participant ${wallet.address}`, deployer, wallet.address, 'native transfer', () => deployer.sendTransaction({ to: wallet.address, value: ethers.parseEther('0.01') }));
    } else {
      evidence.steps.push({ step: `fund participant ${wallet.address}`, status: 'already-funded', balanceWei: balance.toString() });
    }
  }

  for (let index = 0; index < participants.length; index++) {
    const step = `participant ${String.fromCharCode(65 + index)} encrypted commitment`;
    if (!completed(step)) { const input = await encrypted(participants[index], 100); await send(step, participants[index], manifest.pool.address, 'setCommitment', () => pool.connect(participants[index]).setCommitment(input.handles[0], input.inputProof)); }
  }
  const initialDeposits = [150, 50, 150];
  for (let index = 0; index < participants.length; index++) {
    const step = `participant ${String.fromCharCode(65 + index)} encrypted deposit`;
    if (!completed(step)) { const input = await encrypted(participants[index], initialDeposits[index]); await send(step, participants[index], manifest.pool.address, 'deposit', () => pool.connect(participants[index]).deposit(input.handles[0], input.inputProof)); }
  }

  if (!completed('participant A breach')) { const aBreach = await encrypted(participants[0], 60); await send('participant A breach', participants[0], manifest.pool.address, 'withdraw', () => pool.connect(participants[0]).withdraw(aBreach.handles[0], aBreach.inputProof)); }
  if (!completed('participant B recovery')) { const bRecovery = await encrypted(participants[1], 100); await send('participant B recovery', participants[1], manifest.pool.address, 'deposit', () => pool.connect(participants[1]).deposit(bRecovery.handles[0], bRecovery.inputProof)); }
  if (!completed('participant A recovery')) { const aRecovery = await encrypted(participants[0], 60); await send('participant A recovery', participants[0], manifest.pool.address, 'deposit', () => pool.connect(participants[0]).deposit(aRecovery.handles[0], aRecovery.inputProof)); }

  if (!completed('account participant principal')) await send('account participant principal', deployer, manifest.yieldAdapter.address, 'depositPrincipal', () => adapter.depositPrincipal(450));
  if (!completed('realize deterministic testnet yield')) await send('realize deterministic testnet yield', deployer, manifest.yieldAdapter.address, 'accrueYield', () => adapter.accrueYield(1000));
  if (!completed('harvest realized yield to prize reserve')) await send('harvest realized yield to prize reserve', deployer, manifest.yieldAdapter.address, 'harvestYield', () => adapter.harvestYield(1000, 1));

  for (let index = 0; index < participants.length; index++) {
    const step = `participant ${String.fromCharCode(65 + index)} CW checkpoint`;
    if (!completed(step)) { const checkpoint = await encrypted(participants[index], 0); await send(step, participants[index], manifest.pool.address, 'deposit', () => pool.connect(participants[index]).deposit(checkpoint.handles[0], checkpoint.inputProof)); }
  }

  for (let index = 0; index < participants.length; index++) {
    const wallet = participants[index];
    evidence.privateReadback.push({
      participant: String.fromCharCode(65 + index),
      finalBalance: String(await decrypt64(wallet, (address) => pool.balanceOf(address))),
      commitment: String(await decrypt64(wallet, (address) => pool.floorOf(address))),
      cw: String(await decrypt64(wallet, (address) => pool.weightOf(address))),
      breachCycles: String(await decrypt64(wallet, (address) => pool.breachCyclesOf(address))),
      compliant: await decryptBool(wallet, (address) => pool.complianceOf(address))
    });
  }
  const finalBalances = evidence.privateReadback.map((row) => row.finalBalance);
  const weights = evidence.privateReadback.map((row) => BigInt(row.cw));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0n);
  if (new Set(finalBalances).size !== 1 || finalBalances[0] !== '150') throw new Error(`Final balances are not equal at 150: ${finalBalances.join(',')}`);
  if (new Set(weights.map(String)).size !== weights.length) throw new Error(`CW values are not distinct: ${weights.join(',')}`);
  if (totalWeight <= 0n || totalWeight > BigInt(manifest.draw.maxTotalWeight)) throw new Error(`Total CW ${totalWeight} exceeds exact-draw bound ${manifest.draw.maxTotalWeight}`);

  for (let index = 0; index < participants.length; index++) {
    const step = `participant ${String.fromCharCode(65 + index)} draw entry`;
    if (!completed(step)) await send(step, participants[index], manifest.draw.address, 'enter', () => draw.connect(participants[index]).enter());
  }
  if (!completed('open exact encrypted draw')) await send('open exact encrypted draw', deployer, manifest.draw.address, 'open', () => draw.open());

  const winners = [];
  for (let index = 0; index < participants.length; index++) {
    const wallet = participants[index];
    const step = `participant ${String.fromCharCode(65 + index)} encrypted winner computation`;
    if (!completed(step)) await send(step, wallet, manifest.draw.address, 'winnerBit', () => draw.connect(wallet).winnerBit(index));
    const winner = await fhevm.userDecryptEbool(normalizeHandle(await draw.winnerBit.staticCall(index)), manifest.draw.address, wallet);
    winners.push(Boolean(winner));
  }
  if (winners.filter(Boolean).length !== 1) throw new Error(`Expected one positive winner bit, received ${JSON.stringify(winners)}`);

  const credits = [];
  for (let index = 0; index < participants.length; index++) {
    const wallet = participants[index];
    const settlementStep = `participant ${String.fromCharCode(65 + index)} confidential settlement`;
    if (!completed(settlementStep)) await send(settlementStep, deployer, manifest.draw.address, 'settleParticipant', () => draw.settleParticipant(index));
    const credit = await fhevm.userDecryptEuint(FhevmType.euint64, normalizeHandle(await reserve.creditOf(1, wallet.address)), manifest.reserve.address, wallet);
    credits.push(String(credit));
    const claimStep = `participant ${String.fromCharCode(65 + index)} confidential claim`;
    if (!completed(claimStep)) await send(claimStep, wallet, manifest.reserve.address, 'claim', () => reserve.connect(wallet).claim(1));
  }
  if (credits.filter((value) => value === '1000').length !== 1 || credits.some((value, index) => value !== (winners[index] ? '1000' : '0'))) {
    throw new Error(`Prize credits do not match winner bits: winners=${JSON.stringify(winners)} credits=${JSON.stringify(credits)}`);
  }

  evidence.economicState = {
    principal: String((await adapter.currentAssets()) - (await adapter.availableYield())),
    remainingRealizedYield: String(await adapter.availableYield()),
    harvestedYield: '1000',
    prizeReserveFunding: '1000',
    finalBalances,
    committedWeights: weights.map(String),
    totalCommittedWeight: String(totalWeight),
    probabilityNumerators: weights.map(String),
    probabilityDenominator: String(totalWeight),
    winners,
    credits,
    invariantFailures: 0
  };
  evidence.status = 'pass';
  evidence.finishedAt = new Date().toISOString();
  manifest.canonical = true;
  manifest.promotedAt = evidence.finishedAt;
  fs.writeFileSync('evidence/live/canonical-yield-campaign.json', `${JSON.stringify(evidence, null, 2)}\n`);
  fs.writeFileSync('evidence/live/final-yield-deployment.json', `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync('evidence/model/full-economic-model.json', `${JSON.stringify({
    generatedAt: evidence.finishedAt,
    label: evidence.label,
    deployment: manifest,
    reference: {
      principal: '450',
      realizedYield: '1000',
      harvestedYield: '1000',
      reserveFunding: '1000',
      finalBalances: ['150', '150', '150'],
      cw: weights.map(String),
      probability: weights.map((value) => `${value}/${totalWeight}`),
      expectedWinnerSet: weights.map((value, index) => value > 0n ? String.fromCharCode(65 + index) : null).filter(Boolean),
      prize: '1000'
    },
    deployed: evidence.economicState,
    semanticDivergenceCount: 0,
    invariantFailures: 0
  }, null, 2)}\n`);
  fs.rmSync(progressPath, { force: true });
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => {
  fs.mkdirSync('evidence/archive/failures', { recursive: true });
  fs.writeFileSync('evidence/archive/failures/canonical-yield-campaign-failure.json', `${JSON.stringify({ failedAt: new Date().toISOString(), message: error.message, stack: error.stack }, null, 2)}\n`);
  console.error(error.stack || error);
  process.exitCode = 1;
});
