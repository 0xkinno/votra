const hre = require('hardhat');
const fs = require('node:fs');

async function main() {
  const { ethers } = hre;
  const manifestPath = process.env.VOTRA_LIVE_MANIFEST || 'evidence/deployments/votra-live-ui-deployment.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pool = await ethers.getContractAt('VotraCommitmentPool', manifest.pool.address);
  const draw = await ethers.getContractAt('VotraExactDraw', manifest.draw.address);
  const reserve = await ethers.getContractAt('VotraPrizeReserve', manifest.reserve.address);
  const adapter = await ethers.getContractAt('VotraYieldAdapter', manifest.yieldAdapter.address);
  const count = Number(await draw.participantCount());
  const rows = [];
  for (let i = 0; i < count; i++) {
    const address = await draw.participants(i);
    rows.push({ index: i, address, settled: await draw.settled(i), entered: await draw.entered(address) });
  }
  const read = {
    manifest: manifestPath,
    pool: manifest.pool.address,
    draw: manifest.draw.address,
    opened: await draw.opened(),
    exhausted: await draw.exhausted(),
    participantCount: count,
    participants: rows,
    reserve: manifest.reserve.address,
    adapterPrincipal: (await adapter.currentAssets()).toString(),
    adapterAvailableYield: (await adapter.availableYield()).toString()
  };
  fs.mkdirSync('evidence/live', { recursive: true });
  fs.writeFileSync('evidence/live/withdrawal-state-read.json', JSON.stringify(read, null, 2) + '\n');
  console.log(JSON.stringify(read, null, 2));
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
