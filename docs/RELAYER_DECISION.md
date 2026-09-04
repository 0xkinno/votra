# Relayer Decision

## Current stack

- `@zama-fhe/relayer-sdk` `0.4.1` (required by `@fhevm/hardhat-plugin@0.4.2`)
- `@fhevm/hardhat-plugin` `0.4.2`
- Sepolia chain ID `11155111`
- Official endpoint: `https://relayer.testnet.zama.org`
- Hardhat path: `fhevm.initializeCLIApi()`, `createEncryptedInput`, `userDecryptEbool`

## Why

The official Hardhat plugin validates and supplies the Sepolia endpoint and contract configuration. The SDK is used for ciphertext generation and KMS-backed user decryption; ethers submits the resulting contract transactions.

## Compatibility

SDK 0.4.1 is the plugin-compatible supported surface and successfully initialized and generated encrypted inputs in live Sepolia runs. The explicit `userDecryptEbool` API is required for encrypted boolean handles. A temporary 0.4.4 experiment was reverted because the plugin rejects that version.

## Migration risk

Replacing the Hardhat integration with a separate browser/backend SDK would duplicate ACL configuration and risk mismatched gateway/verifier addresses. It is not justified while the supported plugin path works.

## Final choice

Remain on the official Hardhat plugin plus `@zama-fhe/relayer-sdk@0.4.1`. Retry transient `INPUT_PROOF` transport failures with a fresh participant; never reuse an immutable commitment slot.
