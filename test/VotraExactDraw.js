const { expect } = require('chai');
const hre = require('hardhat');

describe('VotraExactDraw', function () {
  it('configures bounded encrypted rejection sampling and preserves private winner state', async function () {
    const [owner, alice] = await hre.ethers.getSigners();
    const Pool = await hre.ethers.getContractFactory('VotraCommitmentPool');
    const pool = await Pool.deploy(1); await pool.waitForDeployment();
    const Draw = await hre.ethers.getContractFactory('VotraExactDraw');
    const draw = await Draw.deploy(await pool.getAddress(), 1_048_576, 8); await draw.waitForDeployment();
    expect(await draw.maxTotalWeight()).to.equal(1_048_576n);
    expect(await draw.attempts()).to.equal(8n);
    await draw.connect(alice).enter();
    expect(await draw.participantCount()).to.equal(1n);
    expect(await draw.opened()).to.equal(false);
  });
});
