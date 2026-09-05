# Relayer Decision

## Current stack

- `@zama-fhe/relayer-sdk` `0.4.4` (npm `latest` as of 2026-09-05)
- Browser runtime: self-hosted UMD + TFHE/KMS WASM + worker assets copied from the installed package into `public/`
- `@fhevm/hardhat-plugin` `0.4.2` remains the Hardhat-side integration; its peer range conflicts with 0.4.4, so the repo pins `legacy-peer-deps=true` in `.npmrc` for clean installs on Vercel and locally
- Sepolia chain ID `11155111`
- Official SDK-bundled Sepolia endpoint: `https://relayer.testnet.zama.org` (from `SepoliaConfig`)
- The browser MUST call `initSDK()` before `createInstance()`, and MUST pass an EIP-1193 provider (never the literal string `sepolia`) as `network`

## Why

The bug report showed two independent failures: `Cannot read properties of undefined (reading '__wbindgen_malloc')` from `createInstance()` before WASM initialization, and `Impossible to fetch public key: wrong relayer url` from a hand-formed config that passed `network: 'sepolia'`. Both are fixed by the documented SDK flow: await `initSDK()`, then call `createInstance({ ...SepoliaConfig, network: window.ethereum })`. The relayer URL, ACL, KMS, verifier and gateway addresses all come from the package-bundled `SepoliaConfig`, never from hand-rolled values.

## Compatibility

Vite cannot safely package the SDK ESM `lib/web.js` because it emits WASM and worker chunks through `import.meta.url`. The official UMD distribution solves this; its wasm/worker URLs resolve from the site root, so the copy script places `relayer-sdk-js.js`, `tfhe_bg.wasm`, `kms_lib_bg.wasm` and `workerHelpers.js` under `public/` and `index.html` loads the UMD before the app module.

## Migration risk

Keeping the Hardhat plugin and browser SDK on the same major protocol line is low risk. The npm peer mismatch is surfaced as a warning only. If a future `@fhevm/hardhat-plugin` release pins a newer SDK, re-align the root dependency.

## Final choice

Use `@zama-fhe/relayer-sdk@0.4.4` with its bundled `SepoliaConfig`, initialize WASM with `initSDK()` before every instance creation, pass the connected EIP-1193 provider as `network`, and serve the UMD runtime from the Vercel origin. Never hand-roll relayer or contract addresses.
