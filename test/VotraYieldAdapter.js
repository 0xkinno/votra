const { expect } = require('chai');
const { ethers, fhevm } = require('hardhat');
const { FhevmType } = require('@fhevm/hardhat-plugin');

describe('VotraYieldAdapter accounting boundary', function () {
  it('keeps principal separate from deterministic realized yield', async function () {
    const [owner, other] = await ethers.getSigners();
    const Asset = await ethers.getContractFactory('VotraConfidentialAsset');
    const asset = await Asset.deploy();
    const Reserve = await ethers.getContractFactory('VotraPrizeReserve');
    const reserve = await Reserve.deploy(await asset.getAddress(), owner.address);
    const Adapter = await ethers.getContractFactory('VotraYieldAdapter');
    const adapter = await Adapter.deploy(await asset.getAddress(), await reserve.getAddress());
    await adapter.depositPrincipal(1000);
    await adapter.accrueYield(125);
    expect(await adapter.currentAssets()).to.equal(1125n);
    expect(await adapter.availableYield()).to.equal(125n);
    await adapter.harvestYield(25, 1);
    expect(await adapter.availableYield()).to.equal(100n);
    expect(await adapter.currentAssets()).to.equal(1100n);
    expect(await adapter.reserve()).to.equal(await reserve.getAddress());
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, await reserve.prizeOf(1))).to.equal(25n);
    await expect(adapter.connect(other).withdrawPrincipal(1)).to.be.revertedWith('VOTRA: owner only');
    await expect(adapter.connect(other).harvestYield(1, 1)).to.be.revertedWith('VOTRA: owner only');
    await expect(adapter.withdrawPrincipal(1001)).to.be.revertedWith('VOTRA: principal underflow');
    await expect(adapter.harvestYield(101, 1)).to.be.revertedWith('VOTRA: yield underflow');
    await adapter.withdrawPrincipal(1000);
    expect(await adapter.currentAssets()).to.equal(100n);
    expect(adapter.interface.hasFunction('withdrawReserve')).to.equal(false);
    expect(reserve.interface.hasFunction('withdrawPrincipal')).to.equal(false);
  });
});
