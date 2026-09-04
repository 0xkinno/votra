const fs = require('node:fs');
const dns = require('node:dns').promises;
const net = require('node:net');
const tls = require('node:tls');
const https = require('node:https');
const hre = require('hardhat');

const host = 'relayer.testnet.zama.org';
const result = { endpoint: `https://${host}`, sdk: {}, stages: [], transactionHash: null, startedAt: new Date().toISOString() };
const stage = async (name, fn) => { const t = Date.now(); try { const value = await fn(); result.stages.push({ name, ok: true, latencyMs: Date.now() - t, detail: value }); return value; } catch (e) { result.stages.push({ name, ok: false, latencyMs: Date.now() - t, error: e.message, code: e.code }); throw e; } };
function tcp() { return new Promise((resolve, reject) => { const s = net.connect(443, host); const done = (e) => { s.destroy(); e ? reject(e) : resolve('connected'); }; s.setTimeout(15000, () => done(Object.assign(new Error('TCP timeout'), { code: 'ETIMEDOUT' }))); s.once('connect', () => done()); s.once('error', done); }); }
function tlsHandshake() { return new Promise((resolve, reject) => { const s = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: true }); const done = (e) => { s.destroy(); e ? reject(e) : resolve({ authorized: s.authorized, protocol: s.getProtocol() }); }; s.setTimeout(15000, () => done(Object.assign(new Error('TLS timeout'), { code: 'ETIMEDOUT' }))); s.once('secureConnect', () => done()); s.once('error', done); }); }
function request() { return new Promise((resolve, reject) => { const req = https.get(`https://${host}/`, { timeout: 15000 }, (res) => { res.resume(); resolve({ statusCode: res.statusCode, headers: res.headers }); }); req.once('timeout', () => req.destroy(Object.assign(new Error('HTTPS timeout'), { code: 'ETIMEDOUT' }))); req.once('error', reject); }); }
(async () => {
  await stage('dns', async () => await dns.lookup(host));
  await stage('tcp', tcp);
  await stage('tls', tlsHandshake);
  await stage('https', request);
  try {
    const { fhevm } = hre; await stage('sdk.initializeCLIApi', async () => { await fhevm.initializeCLIApi(); return 'initialized'; });
    const [signer] = await hre.ethers.getSigners();
    await stage('encrypted-input-generation', async () => { const input = await fhevm.createEncryptedInput('0x0000000000000000000000000000000000000001', signer.address).add64(1).encrypt(); return { handles: input.handles?.length ?? 0, proofBytes: input.inputProof?.length ?? 0 }; });
  } catch (_) { /* stage details already recorded */ }
  result.finishedAt = new Date().toISOString();
  fs.mkdirSync('evidence/live', { recursive: true }); fs.writeFileSync('evidence/live/relayer-diagnostic.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})().catch((e) => { result.fatal = e.message; result.finishedAt = new Date().toISOString(); fs.mkdirSync('evidence/live', { recursive: true }); fs.writeFileSync('evidence/live/relayer-diagnostic.json', JSON.stringify(result, null, 2)); console.error(e.message); process.exitCode = 1; });
