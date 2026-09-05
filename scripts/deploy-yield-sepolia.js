const hre = require('hardhat');
const fs = require('node:fs');

async function deployed(contract) {
  const receipt = await contract.deploymentTransaction().wait();
  const address = await contract.getAddress();
  const code = await hre.ethers.provider.getCode(address);
  return {
    address,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    bytecodeHash: hre.ethers.keccak256(code),
    codeBytes: (code.length - 2) / 2,
    sourceVerification: 'pending'
  };
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error('VOTRA_PRIVATE_KEY is missing');
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  if (balance === 0n) throw new Error('deployer has no Sepolia ETH for gas');
  const maxTotalWeight = BigInt(process.env.VOTRA_EXACT_MAX_WEIGHT || '1048576');

  const pool = await (await hre.ethers.getContractFactory('VotraCommitmentPool')).deploy(1);
  const poolEvidence = await deployed(pool);
  const draw = await (await hre.ethers.getContractFactory('VotraExactDraw')).deploy(
    poolEvidence.address,
    maxTotalWeight,
    32
  );
  const drawEvidence = await deployed(draw);
  const asset = await (await hre.ethers.getContractFactory('VotraConfidentialAsset')).deploy();
  const assetEvidence = await deployed(asset);
  const reserve = await (await hre.ethers.getContractFactory('VotraPrizeReserve')).deploy(
    assetEvidence.address,
    drawEvidence.address
  );
  const reserveEvidence = await deployed(reserve);
  const adapter = await (await hre.ethers.getContractFactory('VotraYieldAdapter')).deploy(
    assetEvidence.address,
    reserveEvidence.address
  );
  const adapterEvidence = await deployed(adapter);

  const poolWire = await pool.setAuthorizedDraw(drawEvidence.address);
  const poolWireReceipt = await poolWire.wait();
  const reserveWire = await draw.setReserve(reserveEvidence.address);
  const reserveWireReceipt = await reserveWire.wait();

  const manifest = {
    canonical: false,
    promotionRule: 'Promote only after canonical-yield-campaign.json passes the yield release gate.',
    label: 'TESTNET YIELD ADAPTER - NOT LIVE MARKET YIELD',
    drawAlgorithm: 'VotraExactDraw',
    network: 'sepolia',
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    pool: poolEvidence,
    draw: { ...drawEvidence, maxTotalWeight: maxTotalWeight.toString(), attempts: 32 },
    asset: assetEvidence,
    yieldAdapter: adapterEvidence,
    reserve: reserveEvidence,
    wiring: {
      authorizedDraw: { transactionHash: poolWireReceipt.hash, blockNumber: poolWireReceipt.blockNumber },
      reserve: { transactionHash: reserveWireReceipt.hash, blockNumber: reserveWireReceipt.blockNumber }
    }
  };
  fs.mkdirSync('evidence/deployments', { recursive: true });
  const output = process.env.VOTRA_YIELD_DEPLOYMENT_OUTPUT || 'evidence/deployments/votra-yield-candidate.json';
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
