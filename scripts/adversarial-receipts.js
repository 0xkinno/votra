const hre = require('hardhat');
const fs = require('node:fs');
(async () => {
  const { ethers } = hre;
  const m = JSON.parse(fs.readFileSync('evidence/deployments/votra-history.json', 'utf8'));
  const [deployer] = await ethers.getSigners();
  const pool = await ethers.getContractAt('VotraCommitmentPool', m.pool.address);
  const draw = await ethers.getContractAt('VotraExactDraw', m.draw.address);
  const reserve = await ethers.getContractAt('VotraPrizeReserve', m.reserve.address);
  const rows = [];

  function receiptRecord(name, receipt, txHash) {
    const status = Number(receipt.status);
    return {
      attack: name,
      expected: 'revert',
      actual: `mined receipt status ${status}`,
      tx: txHash || receipt.hash,
      block: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      result: status === 0 ? 'pass' : 'fail',
      receiptBacked: true
    };
  }

  async function attack(name, contract, method, args) {
    try {
      const data = contract.interface.encodeFunctionData(method, args);
      const tx = await deployer.sendTransaction({ to: await contract.getAddress(), data, gasLimit: 1000000 });
      const receipt = await tx.wait();
      rows.push(receiptRecord(name, receipt, tx.hash));
    } catch (error) {
      // ethers v6 rejects wait() for a mined status-0 transaction but retains the receipt.
      if (error.receipt) {
        rows.push(receiptRecord(name, error.receipt, error.transactionHash));
      } else {
        rows.push({
          attack: name,
          expected: 'revert',
          actual: error.shortMessage || error.message,
          result: 'transport-or-preflight-failure',
          receiptBacked: false
        });
      }
    }
  }
  await attack('repeated draw open', draw, 'open', []);
  await attack('duplicate settlement', draw, 'settleParticipant', [0]);
  await attack('draw entry after open', draw, 'enter', []);
  await attack('reserve replacement after lock', draw, 'setReserve', [m.reserve.address]);
  await attack('draw authorization replacement after lock', pool, 'setAuthorizedDraw', [m.draw.address]);
  await attack('unauthorized pool draw grant', pool, 'grantWeight', [deployer.address, deployer.address]);
  await attack('unauthorized reserve credit', reserve, 'credit', [1, deployer.address, '0x' + '00'.repeat(32)]);
  await attack('replayed claim', reserve, 'claim', [1]);
  const artifact = {
    deployment: m,
    generatedAt: new Date().toISOString(),
    network: 'sepolia',
    method: 'raw transactions with explicit gas limits; ethers status-0 exceptions normalized to their mined receipts',
    summary: {
      attempted: rows.length,
      receiptBacked: rows.filter((row) => row.receiptBacked).length,
      passed: rows.filter((row) => row.result === 'pass').length,
      failed: rows.filter((row) => row.result === 'fail').length
    },
    rows,
    separatelyProvenRows: {
      encryptedInputReplay: 'covered by encrypted-input authorization and commitment-freeze regressions',
      staleCiphertext: 'covered by FHE input-proof validation regressions',
      falseRecovery: 'covered by encrypted covenant evaluation and reference-model parity',
      retroactiveCWRestoration: 'covered by the 10,000-history forward-only campaign and live model-chain cross-check'
    },
    note: 'This artifact contains only independently submitted deployed guard attacks. Each pass is a mined Sepolia status-0 receipt.'
  };
  fs.mkdirSync('evidence/adversarial', { recursive: true }); fs.writeFileSync('evidence/adversarial/executable-receipts.json', JSON.stringify(artifact, null, 2)); console.log(JSON.stringify(artifact, null, 2));
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
