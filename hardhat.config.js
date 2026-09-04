require('@fhevm/hardhat-plugin');
require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');
require('@nomicfoundation/hardhat-verify');
require('dotenv').config({ path: '.env.local' });
const accounts = process.env.VOTRA_PRIVATE_KEY ? [process.env.VOTRA_PRIVATE_KEY] : [];
module.exports = {
  solidity: { version: '0.8.27', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' } },
  paths: { sources: './contracts', tests: './test', artifacts: './artifacts', cache: './cache_hardhat' },
  networks: { hardhat: { chainId: 31337 }, sepolia: { url: process.env.VOTRA_RPC_URL || '', chainId: 11155111, accounts, timeout: 120000 } }
  ,etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || '' },
  // Sourcify currently returns an HTML error response for this environment; Etherscan V2 is the
  // authoritative verification path used by the release manifest.
  sourcify: { enabled: false }
};
