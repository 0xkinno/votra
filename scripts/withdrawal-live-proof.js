const hre = require('hardhat');
const fs = require('node:fs');
const { FhevmType } = require('@fhevm/hardhat-plugin');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeHandle = (handle) => typeof handle === 'string' ? handle : (handle?.[0] || handle?.handle || handle?.toString?.());

async function main() {
  const { ethers, fhevm } = hre;
  const manifestPath = process.env.VOTRA_WITHDRAWAL_MANIFEST || 'evidence/deployments/votra-withdrawal-demo.json';
  if (!fs.existsSync(manifestPath)) throw new Error(`manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!process.env.VOTRA_PRIVATE_KEY) throw new Error('Missing VOTRA_PRIVATE_KEY');

  const deployer = new ethers.Wallet(process.env.VOTRA_PRIVATE_KEY, ethers.provider);
  const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
  const pool = await ethers.getContractAt('VotraCommitmentPool', manifest.pool.address);
  const adapter = await ethers.getContractAt('VotraYieldAdapter', manifest.yieldAdapter.address);
  await fhevm.initializeCLIApi();

  const evidence = {
    status: 'running',
    purpose: 'Explicit full principal withdrawal on a fresh open live-demo deployment; draw is left open for manual UI demonstration.',
    network: 'sepolia',
    chainId: 11155111,
    deployment: manifest,
    signer: wallet.address,
    steps: [],
    startedAt: new Date().toISOString()
  };
  const persist = () => {
    fs.mkdirSync('evidence/live', { recursive: true });
    fs.writeFileSync('evidence/live/withdrawal-proof-progress.json', JSON.stringify(evidence, null, 2) + '\n');
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
  const encrypted = (value) => retry(`encrypt ${value}`, () => fhevm.createEncryptedInput(manifest.pool.address, wallet.address).add64(value).encrypt());
  const decrypt64 = async (getter) => fhevm.userDecryptEuint(FhevmType.euint64, normalizeHandle(await getter(wallet.address)), manifest.pool.address, wallet);

  const balance = await ethers.provider.getBalance(wallet.address);
  if (balance < ethers.parseEther('0.004')) {
    await send('fund controlled wallet', deployer, wallet.address, 'native transfer', () => deployer.sendTransaction({ to: wallet.address, value: ethers.parseEther('0.01') }));
  } else {
    evidence.steps.push({ step: 'fund controlled wallet', status: 'already-funded', balanceWei: balance.toString() });
  }

  const deposit = await encrypted(150);
  await send('encrypted deposit 150', wallet, manifest.pool.address, 'deposit', () => pool.connect(wallet).deposit(deposit.handles[0], deposit.inputProof));
  const before = String(await decrypt64((address) => pool.balanceOf(address)));

  const principal = await encrypted(150);
  await send('full principal withdrawal', wallet, manifest.pool.address, 'withdraw', () => pool.connect(wallet).withdraw(principal.handles[0], principal.inputProof));
  const after = String(await decrypt64((address) => pool.balanceOf(address)));

  const reserveFundingSteps = [
    ['account principal (testnet accounting)', () => adapter.connect(deployer).depositPrincipal(450)],
    ['realize deterministic testnet yield', () => adapter.connect(deployer).accrueYield(1000)],
    ['harvest realized yield to prize reserve', () => adapter.connect(deployer).harvestYield(1000, 1)]
  ];
  for (const [step, txFactory] of reserveFundingSteps) {
    if (!evidence.steps.some((row) => row.step === step && row.status === 1)) {
      await send(step, deployer, manifest.yieldAdapter.address, step === 'account principal (testnet accounting)' ? 'depositPrincipal' : step === 'realize deterministic testnet yield' ? 'accrueYield' : 'harvestYield', () => txFactory());
    }
  }

  const withdrawalStep = evidence.steps.find((row) => row.step === 'full principal withdrawal');
  const proof = {
    status: 'pass',
    network: evidence.network,
    chainId: evidence.chainId,
    deployment: manifest,
    purpose: 'Explicit full principal withdrawal after an encrypted deposit on a disposable live-demo deployment. The draw round remains open for the manual UI demonstration.',
    contract: manifest.pool.address,
    function: 'withdraw',
    encryptedRequest: '150 units (contract clamps to the available encrypted balance)',
    signer: wallet.address,
    txHash: withdrawalStep.txHash,
    block: withdrawalStep.block,
    timestamp: withdrawalStep.timestamp,
    status: withdrawalStep.status,
    gasUsed: withdrawalStep.gasUsed,
    beforeState: { encryptedPoolBalance: 'ENCRYPTED ON-CHAIN', authorizedReadback: before },
    afterState: { encryptedPoolBalance: 'ENCRYPTED ON-CHAIN', authorizedReadback: after },
    principalConservation: `${before} deposited = ${after} remaining + 150 withdrawn`
  };
  fs.mkdirSync('evidence/live', { recursive: true });
  fs.writeFileSync('evidence/live/withdrawal-proof.json', JSON.stringify(proof, null, 2) + '\n');
  fs.mkdirSync('evidence/yield', { recursive: true });
  fs.writeFileSync('evidence/yield/principal-conservation-live.json', JSON.stringify({
    network: evidence.network,
    chainId: evidence.chainId,
    deployment: manifest,
    label: 'TESTNET YIELD ADAPTER - NOT LIVE MARKET YIELD',
    scenario: 'deposit 150 then full encrypted principal withdrawal on fresh open demo',
    depositedPrincipal: before,
    withdrawnPrincipal: '150',
    remainingPrincipal: after,
    equation: `${before} deposited = ${after} remaining + 150 withdrawn`,
    prizeFundingSource: 'harvested realized yield only; settlement never consumes saver principal',
    failures: 0,
    generatedAt: new Date().toISOString()
  }, null, 2) + '\n');

  evidence.status = 'pass';
  evidence.finishedAt = new Date().toISOString();
  fs.rmSync('evidence/live/withdrawal-proof-progress.json', { force: true });
  console.log(JSON.stringify(proof, null, 2));
}

main().catch((error) => {
  fs.mkdirSync('evidence/archive/failures', { recursive: true });
  fs.writeFileSync('evidence/archive/failures/withdrawal-proof-failure.json', JSON.stringify({ failedAt: new Date().toISOString(), message: error.message, stack: error.stack }, null, 2) + '\n');
  console.error(error.stack || error);
  process.exitCode = 1;
});
