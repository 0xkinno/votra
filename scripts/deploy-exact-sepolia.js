const hre = require('hardhat');
const fs = require('node:fs');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error('VOTRA_PRIVATE_KEY is missing');
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  if (balance === 0n) throw new Error('deployer has no Sepolia ETH for gas');
  const Pool = await hre.ethers.getContractFactory('VotraCommitmentPool');
  const pool = await Pool.deploy(1); const poolReceipt = await pool.deploymentTransaction().wait();
  const Draw = await hre.ethers.getContractFactory('VotraExactDraw');
  const draw = await Draw.deploy(await pool.getAddress(), 1_048_576, 32); const drawReceipt = await draw.deploymentTransaction().wait();
  const wire = await pool.setAuthorizedDraw(await draw.getAddress()); const wireReceipt = await wire.wait();
  const Asset = await hre.ethers.getContractFactory('VotraConfidentialAsset');
  const asset = await Asset.deploy(); const assetReceipt = await asset.deploymentTransaction().wait();
  const Reserve = await hre.ethers.getContractFactory('VotraPrizeReserve');
  const reserve = await Reserve.deploy(await asset.getAddress(), await draw.getAddress()); const reserveReceipt = await reserve.deploymentTransaction().wait();
  const reserveWire = await draw.setReserve(await reserve.getAddress()); const reserveWireReceipt = await reserveWire.wait();
  const evidence = {
    canonical: true, drawAlgorithm: 'VotraExactDraw', network: 'sepolia', chainId: 11155111,
    deployer: deployer.address, timestamp: new Date().toISOString(),
    pool: { address: await pool.getAddress(), transactionHash: poolReceipt.hash, blockNumber: poolReceipt.blockNumber },
    draw: { address: await draw.getAddress(), transactionHash: drawReceipt.hash, blockNumber: drawReceipt.blockNumber, maxTotalWeight: '1048576', attempts: 32 },
    asset: { address: await asset.getAddress(), transactionHash: assetReceipt.hash, blockNumber: assetReceipt.blockNumber },
    reserve: { address: await reserve.getAddress(), transactionHash: reserveReceipt.hash, blockNumber: reserveReceipt.blockNumber },
    wiringTransactionHash: wireReceipt.hash, reserveWiringTransactionHash: reserveWireReceipt.hash
  };
  fs.mkdirSync('evidence/deployments', { recursive: true });
  fs.writeFileSync(process.env.VOTRA_DEPLOYMENT_OUTPUT || 'evidence/deployments/votra-exact-canonical.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
