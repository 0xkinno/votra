const fs = require('node:fs');

const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const local = read('evidence/yield/principal-separation.json');
check(local.scenarios >= 10000 && local.failures === 0, 'principal/yield model must pass 10,000 scenarios');

const campaign = read('evidence/live/canonical-yield-campaign.json');
check(campaign.status === 'pass', 'canonical yield campaign must pass');
check(campaign.label === 'TESTNET YIELD ADAPTER - NOT LIVE MARKET YIELD', 'testnet yield label must remain explicit');
check(campaign.economicState.invariantFailures === 0, 'live economic invariants must have zero failures');
check(new Set(campaign.economicState.finalBalances).size === 1, 'participants must finish with equal balances');
check(new Set(campaign.economicState.committedWeights).size === 3, 'participant histories must produce distinct CW');
check(campaign.economicState.winners.filter(Boolean).length === 1, 'draw must produce one positive winner');
check(campaign.economicState.credits.filter((value) => value === campaign.economicState.harvestedYield).length === 1, 'exactly one participant must receive harvested yield');
check(campaign.economicState.principal === '450', 'principal must remain 450 after harvest and settlement');
check(campaign.economicState.remainingRealizedYield === '0', 'harvested yield must leave no unharvested balance');
check(campaign.steps.some((step) => step.function === 'harvestYield' && step.status === 1), 'harvest receipt must be mined successfully');
check(campaign.steps.some((step) => step.function === 'settleParticipant' && step.status === 1), 'settlement receipt must be mined successfully');
check(campaign.steps.some((step) => step.function === 'claim' && step.status === 1), 'claim receipt must be mined successfully');

const model = read('evidence/model/full-economic-model.json');
check(model.semanticDivergenceCount === 0 && model.invariantFailures === 0, 'model/chain comparison must have zero divergence');

const result = { generatedAt: new Date().toISOString(), status: failures.length ? 'fail' : 'pass', checks: 13, failures };
fs.mkdirSync('evidence/release', { recursive: true });
fs.writeFileSync('evidence/release/yield-gate.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
