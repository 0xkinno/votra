const fs = require('node:fs');

let state = 0x9e3779b9;
function rand() { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; }
function select(weights, r) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return { winner: null, total, accepted: false };
  const target = r % total;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) { cumulative += weights[i]; if (target < cumulative) return { winner: i, total, accepted: true }; }
  throw new Error('selection overflow');
}
const cases = [];
let mismatches = 0; let illegal = 0; let zeroTotal = 0;
for (let n = 1; n <= 10; n++) {
  for (let k = 0; k < 5000; k++) {
    const weights = Array.from({ length: n }, () => rand() % 100000);
    const { winner, total, accepted } = select(weights, rand());
    if (!accepted) zeroTotal++;
    if (winner !== null && (winner < 0 || winner >= n || weights[winner] === 0)) illegal++;
    cases.push({ n, weights, total, winner, accepted });
  }
}
const edge = [[0], [1], [1, 1], [0, 7, 0], [1, 1048575], [1048575, 1], [0, 0]];
for (const weights of edge) { const x = select(weights, 1048575); cases.push({ n: weights.length, weights, total: x.total, winner: x.winner, accepted: x.accepted, edge: true }); }
const artifact = { algorithm: 'independent cumulative interval reference for VotraExactDraw', seed: '0x9e3779b9', scenarioCount: cases.length, randomizedScenarios: 50000, mismatchCount: mismatches, illegalWinnerCount: illegal, zeroTotalCases: zeroTotal, rejectionRule: 'sample uniform power-of-two domain; accept iff candidate < total; otherwise retry', cases };
fs.mkdirSync('evidence/fairness', { recursive: true }); fs.writeFileSync('evidence/fairness/exact-selection-50k.json', JSON.stringify(artifact, null, 2));
console.log(JSON.stringify({ scenarioCount: artifact.scenarioCount, mismatchCount: mismatches, illegalWinnerCount: illegal, zeroTotalCases: zeroTotal }, null, 2));
