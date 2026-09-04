const hre = require('hardhat');
const fs = require('node:fs');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error('VOTRA_PRIVATE_KEY is missing');
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`deployer=${deployer.address} balance=${balance}`);
  if (balance === 0n) throw new Error('deployer has no Sepolia ETH for gas');
  const Pool = await hre.ethers.getContractFactory('VotraCommitmentPool');
  const pool = await Pool.deploy(1); const poolReceipt = await pool.deploymentTransaction().wait();
  const Draw = await hre.ethers.getContractFactory('VotraDraw');
  const draw = await Draw.deploy(await pool.getAddress(), 1_000_000, 1); const drawReceipt = await draw.deploymentTransaction().wait();
  const wire = await pool.setAuthorizedDraw(await draw.getAddress()); const wireReceipt = await wire.wait();
  const Asset = await hre.ethers.getContractFactory('VotraConfidentialAsset'); const asset=await Asset.deploy(); const assetReceipt=await asset.deploymentTransaction().wait();
  const Reserve = await hre.ethers.getContractFactory('VotraPrizeReserve'); const reserve=await Reserve.deploy(await asset.getAddress(),await draw.getAddress()); const reserveReceipt=await reserve.deploymentTransaction().wait();
  const reserveWire=await draw.setReserve(await reserve.getAddress()); const reserveWireReceipt=await reserveWire.wait();
  const address = await pool.getAddress(); const drawAddress = await draw.getAddress();
  const evidence = { network: 'sepolia', chainId: 11155111, pool: { address, transactionHash: poolReceipt.hash, blockNumber: poolReceipt.blockNumber }, draw: { address: drawAddress, transactionHash: drawReceipt.hash, blockNumber: drawReceipt.blockNumber }, asset:{address:await asset.getAddress(),transactionHash:assetReceipt.hash,blockNumber:assetReceipt.blockNumber},reserve:{address:await reserve.getAddress(),transactionHash:reserveReceipt.hash,blockNumber:reserveReceipt.blockNumber}, wiringTransactionHash: wireReceipt.hash,reserveWiringTransactionHash:reserveWireReceipt.hash, deployer: deployer.address, timestamp: new Date().toISOString() };
  fs.mkdirSync('evidence/deployments', { recursive: true });
  fs.writeFileSync('evidence/deployments/votra-commitment-pool.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
