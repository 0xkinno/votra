import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      __REOWN_PROJECT_ID__: JSON.stringify(env.VOTRA_REOWN_PROJECT_ID || ''),
      __VOTRA_POOL__: JSON.stringify(env.VOTRA_CONTRACT_ADDRESS || '0x2E47C272baaEfb584593d61d8Aee6E81CDF1463c'),
      __VOTRA_DRAW__: JSON.stringify(env.VOTRA_DRAW_ADDRESS || '0x237FcAE817ce2F67912BA9cd26ecA85bff4f22B0'),
      __VOTRA_ASSET__: JSON.stringify(env.VOTRA_ASSET_ADDRESS || '0x8A17E769bB6Be6b4b29dEf59061cFd8ccb63161e'),
      __VOTRA_RESERVE__: JSON.stringify(env.VOTRA_RESERVE_ADDRESS || '0x916510A064c08Ff05de32C54b2be99eB674ad352'),
      __VOTRA_ADAPTER__: JSON.stringify(env.VOTRA_YIELD_ADAPTER_ADDRESS || '0xA97FAE6911FA2ecD5787aB990fDB367d39B1632D'),
      __VOTRA_LIVE_POOL__: JSON.stringify(env.VOTRA_LIVE_POOL_ADDRESS || '0x4dDb678313823206352655a844C7663E89830008'),
      __VOTRA_LIVE_DRAW__: JSON.stringify(env.VOTRA_LIVE_DRAW_ADDRESS || '0xa761a1d265dF11626D7E8DaB6701783ca454Bdfd'),
      __VOTRA_LIVE_ASSET__: JSON.stringify(env.VOTRA_LIVE_ASSET_ADDRESS || '0xE95093C079936BD7a92690AC097fce66596b3Ff6'),
      __VOTRA_LIVE_RESERVE__: JSON.stringify(env.VOTRA_LIVE_RESERVE_ADDRESS || '0x60EA61c17044Cfc11f1594a3CAC01DBd2e6Ad7DE'),
      __VOTRA_LIVE_ADAPTER__: JSON.stringify(env.VOTRA_LIVE_YIELD_ADAPTER_ADDRESS || '0x27897B1C0392C6Fe340f0b544C228e7FdA90ccce'),
      __VOTRA_RPC__: JSON.stringify(env.VOTRA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com')
    },
    plugins: [
      {
        name: 'votra-appkit-entry',
        transformIndexHtml(html) {
          return html.replace('<script src="app.js"></script>', '<script type="module" src="/app.js"></script>');
        }
      },
      {
        name: 'votra-proof-artifacts',
        closeBundle() {
          for (const directory of ['evidence', 'docs']) {
            fs.cpSync(directory, path.join('dist', directory), { recursive: true });
          }
          fs.copyFileSync('vercel.json', path.join('dist', 'vercel.json'));
        }
      }
    ],
    server: { port: 4173, host: '127.0.0.1' },
    resolve: { alias: { '@': path.resolve(process.cwd()) } }
  };
});
