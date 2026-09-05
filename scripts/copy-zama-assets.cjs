const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkgDir = path.join(root, 'node_modules', '@zama-fhe', 'relayer-sdk');
const publicDir = path.join(root, 'public');

const sources = [
  ['bundle/relayer-sdk-js.umd.cjs', 'relayer-sdk-js.js'],
  ['bundle/workerHelpers.js', 'workerHelpers.js'],
  ['bundle/tfhe_bg.wasm', 'tfhe_bg.wasm'],
  ['bundle/kms_lib_bg.wasm', 'kms_lib_bg.wasm']
];

fs.mkdirSync(publicDir, { recursive: true });
for (const [relative, name] of sources) {
  const from = path.join(pkgDir, relative);
  const to = path.join(publicDir, name);
  if (!fs.existsSync(from)) {
    throw new Error('Missing Zama runtime asset: ' + from + '. Run npm install first.');
  }
  fs.copyFileSync(from, to);
  console.log('Copied', relative, '->', path.relative(root, to), '(' + fs.statSync(to).size + ' bytes)');
}
