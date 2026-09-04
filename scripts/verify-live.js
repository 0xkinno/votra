const hre = require('hardhat');
const fs = require('node:fs');
(async () => {
  const manifest = JSON.parse(fs.readFileSync(process.env.VOTRA_EXACT_MANIFEST || 'evidence/deployments/votra-exact-canonical.json', 'utf8'));
  const pool = await hre.ethers.getContractAt('VotraCommitmentPool', manifest.pool.address);
  const draw = await hre.ethers.getContractAt(manifest.drawAlgorithm === 'VotraExactDraw' ? 'VotraExactDraw' : 'VotraDraw', manifest.draw.address);
  const asset = await hre.ethers.getContractAt('VotraConfidentialAsset', manifest.asset.address);
  const reserve = await hre.ethers.getContractAt('VotraPrizeReserve', manifest.reserve.address);
  const codePool = await hre.ethers.provider.getCode(manifest.pool.address);
  const codeDraw = await hre.ethers.provider.getCode(manifest.draw.address);
  const live = { chainId: 11155111, pool: manifest.pool.address, draw: manifest.draw.address, asset: manifest.asset.address, reserve: manifest.reserve.address, poolRound: String(await pool.round()), authorizedDraw: await pool.authorizedDraw(), drawReserve: await draw.reserve(), reserveAsset: await reserve.asset(), assetName: await asset.name(), participantCount: String(await draw.participantCount()), poolCodeBytes: (codePool.length - 2) / 2, drawCodeBytes: (codeDraw.length - 2) / 2, readAt: new Date().toISOString() };
  fs.writeFileSync('evidence/deployments/live-readback.json', JSON.stringify(live, null, 2));
  console.log(JSON.stringify(live, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
