const { expect } = require('chai');
const { ethers, fhevm } = require('hardhat');
const { FhevmType } = require('@fhevm/hardhat-plugin');

async function encrypted(contract, signer, value) { return fhevm.createEncryptedInput(await contract.getAddress(), signer.address).add64(value).encrypt(); }
async function decrypt(contract, handle, signer) { return fhevm.userDecryptEuint(FhevmType.euint64, handle, await contract.getAddress(), signer); }

describe('VotraCommitmentPool encrypted core', function () {
  it('keeps floor, balance, compliance and weight private while enforcing forward-only recovery', async function () {
    if (!fhevm.isMock) this.skip();
    const [alice, bob] = await ethers.getSigners();
    const pool = await (await ethers.getContractFactory('VotraCommitmentPool')).deploy(1);
    const floor = await encrypted(pool, alice, 100);
    await (await pool.connect(alice).setCommitment(floor.handles[0], floor.inputProof)).wait();
    const deposit = await encrypted(pool, alice, 120);
    await (await pool.connect(alice).deposit(deposit.handles[0], deposit.inputProof)).wait();
    const start = await ethers.provider.getBlock('latest');
    await ethers.provider.send('evm_setNextBlockTimestamp', [start.timestamp + 10]);
    const heartbeat = await encrypted(pool, alice, 1);
    await (await pool.connect(alice).deposit(heartbeat.handles[0], heartbeat.inputProof)).wait();
    const withdrawInput = await encrypted(pool, alice, 30);
    await (await pool.connect(alice).withdraw(withdrawInput.handles[0], withdrawInput.inputProof)).wait();
    const weightAfterBreach = await decrypt(pool, await pool.weightOf(alice.address), alice);
    expect(weightAfterBreach).to.be.greaterThan(0n);
    await ethers.provider.send('evm_setNextBlockTimestamp', [start.timestamp + 20]);
    const recoverInput = await encrypted(pool, alice, 30);
    await (await pool.connect(alice).deposit(recoverInput.handles[0], recoverInput.inputProof)).wait();
    const cycles = await decrypt(pool, await pool.breachCyclesOf(alice.address), alice);
    expect(cycles).to.equal(1n);
    const weightHandle = await pool.weightOf(alice.address);
    let refused = false;
    try { await decrypt(pool, weightHandle, bob); } catch (_) { refused = true; }
    expect(refused).to.equal(true);
    await expect(pool.connect(bob).setCommitment(floor.handles[0], floor.inputProof)).to.be.reverted;
  });

  it('measures HCU for encrypted mutation paths', async function () {
    if (!fhevm.isMock) this.skip();
    const [alice] = await ethers.getSigners();
    const pool = await (await ethers.getContractFactory('VotraCommitmentPool')).deploy(1);
    const input = await encrypted(pool, alice, 100);
    const tx = await pool.connect(alice).setCommitment(input.handles[0], input.inputProof);
    const receipt = await tx.wait();
    const hcu = fhevm.computeTransactionHCU(receipt);
    console.log(`VOTRA setCommitment HCU global=${hcu.globalHCU} depth=${hcu.maxHCUDepth}`);
    require('node:fs').mkdirSync('evidence/performance', { recursive: true });
    require('node:fs').writeFileSync('evidence/performance/votra-set-commitment-hcu.json', JSON.stringify({ operation: 'setCommitment', globalHCU: hcu.globalHCU, maxHCUDepth: hcu.maxHCUDepth, network: 'fhevm-mock' }, null, 2));
    expect(hcu.globalHCU).to.be.greaterThan(0);
  });
});
