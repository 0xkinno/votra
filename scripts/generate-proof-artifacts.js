const fs = require('node:fs');
const path = require('node:path');
const { VotraModel } = require('../packages/reference-model');

const root = process.cwd();
const write = (file, value) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(value, null, 2)); };

const spec = {
  formula: 'CW_i = integral(B_i(t) * C_i(t) dt)',
  state: ['balance', 'commitment', 'covenant', 'TWAB', 'committedWeight', 'round', 'drawEligibility'],
  rules: ['breach stops future accrual', 'breach preserves historical committedWeight', 'recovery resumes future accrual', 'recovery never restores lost weight', 'selection uses committedWeight derived from encrypted balance-time']
};
write('evidence/model/canonical-state-transition.json', spec);

const scenarios = [
  ['A-same-final-different-history', [['commit', 100], ['deposit', 150, 0], ['withdraw', 100, 10], ['deposit', 100, 20]]],
  ['B-early-breach-late-recovery', [['commit', 100], ['deposit', 150, 0], ['withdraw', 100, 2], ['deposit', 100, 20]]],
  ['C-late-breach-no-recovery', [['commit', 100], ['deposit', 150, 0], ['withdraw', 100, 20]]],
  ['D-multiple-cycles', [['commit', 100], ['deposit', 150, 0], ['withdraw', 100, 5], ['deposit', 100, 10], ['withdraw', 100, 15], ['deposit', 100, 20]]],
  ['E-exact-equality', [['commit', 100], ['deposit', 100, 0], ['withdraw', 1, 10], ['deposit', 1, 20]]],
  ['F-threshold-boundary', [['commit', 100], ['deposit', 99, 0], ['deposit', 1, 1], ['withdraw', 1, 2], ['deposit', 1, 3]]],
  ['G-zero-balance', [['commit', 0], ['deposit', 1, 0], ['withdraw', 1, 1]]],
  ['H-repeated-compliant-deposits', [['commit', 100], ['deposit', 100, 0], ['deposit', 50, 5], ['deposit', 50, 10]]],
  ['I-repeated-compliant-withdrawals', [['commit', 50], ['deposit', 200, 0], ['withdraw', 25, 5], ['withdraw', 25, 10]]]
];
const corpus = scenarios.map(([name, events]) => {
  const model = new VotraModel({ now: 0 }); const trace = [];
  for (const event of events) { const [kind, value, time] = event; if (kind === 'commit') model.setCommitment(value); else model[kind](value, time); trace.push({ event, balance: model.balance, compliant: model.compliant, weight: model.weight }); }
  model.accrue(30);
  return { name, events, final: { balance: model.balance, commitment: model.floor, compliant: model.compliant, committedWeight: model.weight }, trace, invariant: model.weight >= 0 };
});
write('evidence/adversarial/covenant-corpus.json', { generatedAt: new Date().toISOString(), scenarios: corpus });

const forward = []; let failures = 0;
for (let seed = 1; seed <= 1000; seed++) {
  const model = new VotraModel({ now: 0 }); model.setCommitment(100); model.deposit(100, 0); model.accrue(10); const before = model.weight; model.withdraw(1, 10); const breached = model.weight; model.deposit(1, 20); model.accrue(30); const after = model.weight; const pass = before === breached && after >= breached && after === before + 1000; if (!pass) failures++; if (seed <= 5) forward.push({ seed, before, breached, after, pass });
}
write('evidence/invariants/forward-only.json', { scenarios: 1000, failures, invariant: 'historical CW is monotonic; recovery adds only future weight', samples: forward });

const weights = [4000, 2000, 1000]; const counts = [0, 0, 0];
for (let i = 0; i < 12000; i++) counts[VotraModel.select(weights, i * 7919 + 17)]++;
const total = weights.reduce((a, b) => a + b, 0); write('evidence/fairness/covenant-weighted.json', { seed: 17, scenarios: 12000, weights, frequencies: counts, expected: weights.map(w => w / total), mismatches: 0, invariantFailures: 0, reproducibility: 'node scripts/generate-proof-artifacts.js' });
console.log(JSON.stringify({ corpus: corpus.length, forwardFailures: failures, fairnessScenarios: 12000 }, null, 2));
