const fs = require('node:fs');

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const history = read('evidence/live/model-chain-crosscheck.json');
const balances = Object.values(history.finalBalances);
const weights = Object.values(history.derivedCW);
check(new Set(balances).size === 1, 'history participants must have equal final balances');
check(new Set(weights).size === weights.length, 'history participants must have distinct CW values');
check(history.semanticDivergenceCount === 0, 'model-chain history comparison must have zero divergence');

const attacks = read('evidence/adversarial/executable-receipts.json');
check(attacks.summary.receiptBacked >= 8, 'at least eight deployed attacks must be receipt-backed');
check(attacks.summary.failed === 0, 'deployed attack campaign must have zero failed expectations');
check(attacks.rows.every((row) => row.receiptBacked && row.result === 'pass' && /^0x[0-9a-f]{64}$/i.test(row.tx)), 'every deployed attack must have a distinct mined status-0 receipt');
check(new Set(attacks.rows.map((row) => row.tx)).size === attacks.rows.length, 'deployed attack transaction hashes must be unique');

const fairness = read('evidence/fairness/exact-selection-50k.json');
check(fairness.scenarioCount >= 50000, 'exact-selection campaign must cover at least 50,000 scenarios');
check(fairness.mismatchCount === 0 && fairness.illegalWinnerCount === 0, 'exact-selection campaign must have zero mismatches and illegal winners');

const forward = read('evidence/invariants/forward-only-randomized.json');
check(forward.scenarios >= 10000 && forward.failures === 0, 'forward-only campaign must pass at least 10,000 histories');

const live = read('evidence/live/canonical-campaign.json');
check(live.decryptions.filter((row) => row.winner === true).length === 1, 'canonical campaign must have exactly one positive decrypted winner bit');
check(live.steps.some((step) => step.function === 'settleParticipant'), 'canonical campaign must include settlement');
check(live.steps.some((step) => step.function === 'claim'), 'canonical campaign must include claim');

const verification = read('evidence/live/canonical-verification.json');
check(verification.status === 'verified' && Object.keys(verification.contracts).length === 4, 'all four canonical contracts must be source verified');

const result = {
  generatedAt: new Date().toISOString(),
  status: failures.length === 0 ? 'pass' : 'fail',
  checks: 12,
  failures
};
fs.mkdirSync('evidence/release', { recursive: true });
fs.writeFileSync('evidence/release/final-gate.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
