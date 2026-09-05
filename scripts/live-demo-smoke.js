const hre = require('hardhat');
const fs = require('node:fs');
const { FhevmType } = require('@fhevm/hardhat-plugin');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeHandle = (handle) => typeof handle === 'string' ? handle : (handle?.[0] || handle?.handle || handle?.toString?.());

async function main() {
  const { ethers, fhevm } = hre;
  const manifestPath = process.env.VOTRA_LIVE_SMOKE_MANIFEST || 'evidence/deployments/votra-live-demo-deployment.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const deployerKey = process.env.VOTRA_PRIVATE_KEY;
  if (!deployerKey) throw new Error('Missing VOTRA_PRIVATE_KEY');
  const deployer = new ethers.Wallet(deployerKey, ethers.provider);
  const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
  const pool = await ethers.getContractAt('VotraCommitmentPool', manifest.pool.address);
  const draw = await ethers.getContractAt('VotraExactDraw', manifest.draw.address);
  const asset = await ethers.getContractAt('VotraConfidentialAsset', manifest.asset.address);
  const adapter = await ethers.getContractAt('VotraYieldAdapter', manifest.yieldAdapter.address);
  const reserve = await ethers.getContractAt('VotraPrizeReserve', manifest.reserve.address);
  await fhevm.initializeCLIApi();

  const evidence = {
    status: 'running',
    purpose: 'Brand-new wallet full interactive flow on the identical live-demo bytecode, leaving the judge-facing UI round untouched.',
    network: 'sepolia',
    chainId: 11155111,
    deployment: manifest,
    newWallet: wallet.address,
    steps: [],
    startedAt: new Date().toISOString()
  };
  const persist = () => {
    fs.mkdirSync('evidence/live', { recursive: true });
    fs.writeFileSync('evidence/live/live-demo-smoke-progress.json', JSON.stringify(evidence, null, 2) + '\n');
  };
  const send = async (step, signer, contract, functionName, txFactory) => {
    const tx = await txFactory();
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    evidence.steps.push({ step, signer: signer.address, contract, function: functionName, txHash: tx.hash, block: receipt.blockNumber, timestamp: block.timestamp, status: receipt.status, gasUsed: receipt.gasUsed.toString() });
    persist();
    return receipt;
  };
  const retry = async (label, fn, attempts = 6) => {
    let last;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try { return await fn(); } catch (error) {
        last = error;
        evidence.steps.push({ step: label, attempt, status: 'retry', error: error.message });
        persist();
        if (attempt < attempts) await sleep(Math.min(30_000, attempt * 8_000));
      }
    }
    throw last;
  };
  const encrypted = (value) => retry('encrypt value ' + value, () => fhevm.createEncryptedInput(manifest.pool.address, wallet.address).add64(value).encrypt());
  const decrypt64 = async (getter) => fhevm.userDecryptEuint(FhevmType.euint64, normalizeHandle(await getter(wallet.address)), manifest.pool.address, wallet);

  const balance = await ethers.provider.getBalance(wallet.address);
  if (balance < ethers.parseEther('0.004')) {
    await send('fund brand-new wallet', deployer, wallet.address, 'native transfer', () => deployer.sendTransaction({ to: wallet.address, value: ethers.parseEther('0.01') }));
  } else {
    evidence.steps.push({ step: 'fund brand-new wallet', status: 'already-funded', balanceWei: balance.toString() });
  }

  const holdSeconds = Number(process.env.VOTRA_LIVE_SMOKE_HOLD_SECONDS || 90);
  const commitment = await encrypted(100);
  await send('set commitment (encrypted floor 100)', wallet, manifest.pool.address, 'setCommitment', () => pool.connect(wallet).setCommitment(commitment.handles[0], commitment.inputProof));

  const deposit = await encrypted(150);
  await send('deposit (encrypted 150)', wallet, manifest.pool.address, 'deposit', () => pool.connect(wallet).deposit(deposit.handles[0], deposit.inputProof));
  console.log('COMPLIANT ACCRUAL HOLD', holdSeconds, 'seconds');
  await sleep(holdSeconds * 1000);

  const breach = await encrypted(60);
  await send('breach (encrypted withdrawal 60)', wallet, manifest.pool.address, 'withdraw', () => pool.connect(wallet).withdraw(breach.handles[0], breach.inputProof));
  console.log('BREACH HOLD', Math.round(holdSeconds / 3), 'seconds');
  await sleep(Math.round(holdSeconds / 3) * 1000);

  const recovery = await encrypted(60);
  await send('recovery (encrypted deposit 60)', wallet, manifest.pool.address, 'deposit', () => pool.connect(wallet).deposit(recovery.handles[0], recovery.inputProof));
  console.log('COMPLIANT ACCRUAL HOLD', holdSeconds, 'seconds');
  await sleep(holdSeconds * 1000);

  const checkpoint = await encrypted(0);
  await send('CW checkpoint (encrypted 0 touch)', wallet, manifest.pool.address, 'deposit', () => pool.connect(wallet).deposit(checkpoint.handles[0], checkpoint.inputProof));

  evidence.privateReadback = {
    finalBalance: String(await decrypt64((address) => pool.balanceOf(address))),
    commitment: String(await decrypt64((address) => pool.floorOf(address))),
    cw: String(await decrypt64((address) => pool.weightOf(address))),
    breachCycles: String(await decrypt64((address) => pool.breachCyclesOf(address)))
  };
  persist();

  await send('account principal (testnet accounting)', deployer, manifest.yieldAdapter.address, 'depositPrincipal', () => adapter.connect(deployer).depositPrincipal(450));
  await send('realize deterministic testnet yield', deployer, manifest.yieldAdapter.address, 'accrueYield', () => adapter.connect(deployer).accrueYield(1000));
  await send('harvest realized yield to prize reserve', deployer, manifest.yieldAdapter.address, 'harvestYield', () => adapter.connect(deployer).harvestYield(1000, 1));

  await send('draw entry', wallet, manifest.draw.address, 'enter', () => draw.connect(wallet).enter());
  await send('open exact encrypted draw', deployer, manifest.draw.address, 'open', () => draw.connect(deployer).open());

  let winner = false;
  try {
    const winnerInput = await draw.connect(wallet).winnerBit.staticCall(0);
    winner = Boolean(await fhevm.userDecryptEbool(normalizeHandle(winnerInput), manifest.draw.address, wallet));
  } catch (error) {
    evidence.steps.push({ step: 'winner-bit decryption probe', status: 'failed', error: error.message });
  }
  await send('encrypted winner computation', wallet, manifest.draw.address, 'winnerBit', () => draw.connect(wallet).winnerBit(0));
  await send('confidential settlement', deployer, manifest.draw.address, 'settleParticipant', () => draw.connect(deployer).settleParticipant(0));

  const credit = await retry('winner credit decryption', async () => fhevm.userDecryptEuint(FhevmType.euint64, normalizeHandle(await reserve.creditOf(1, wallet.address)), manifest.reserve.address, wallet));
  await send('confidential claim', wallet, manifest.reserve.address, 'claim', () => reserve.connect(wallet).claim(1));

  evidence.economicState = {
    finalBalance: evidence.privateReadback.finalBalance,
    committedWeight: evidence.privateReadback.cw,
    breachCycles: evidence.privateReadback.breachCycles,
    winner,
    prizeCredit: String(credit),
    harvestedYield: '1000',
    prizeReserveFunding: '1000'
  };
  const failures = evidence.steps.filter((step) => step.status !== 1 && step.status !== 'retry' && step.status !== 'already-funded' && step.status !== 'failed');
  evidence.status = failures.length === 0 ? 'pass' : 'fail';
  evidence.finishedAt = new Date().toISOString();
  fs.mkdirSync('evidence/live', { recursive: true });
  fs.writeFileSync('evidence/live/live-demo-new-wallet.json', JSON.stringify(evidence, null, 2) + '\n');
  fs.rmSync('evidence/live/live-demo-smoke-progress.json', { force: true });
  console.log(JSON.stringify(evidence, null, 2));
  if (evidence.status !== 'pass') process.exitCode = 1;
}

main().catch((error) => {
  fs.mkdirSync('evidence/archive/failures', { recursive: true });
  fs.writeFileSync('evidence/archive/failures/live-demo-smoke-failure.json', JSON.stringify({ failedAt: new Date().toISOString(), message: error.message, stack: error.stack }, null, 2) + '\n');
  console.error(error.stack || error);
  process.exitCode = 1;
});
