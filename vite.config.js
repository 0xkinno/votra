import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      __REOWN_PROJECT_ID__: JSON.stringify(env.VOTRA_REOWN_PROJECT_ID || ''),
      __VOTRA_POOL__: JSON.stringify(env.VOTRA_CONTRACT_ADDRESS || '0xf6222981e6E727bb85e54B08E37B606598130165'),
      __VOTRA_DRAW__: JSON.stringify(env.VOTRA_DRAW_ADDRESS || '0xBCED5BCF27Cb2a7a0DBb3291eCA8D06FeEd0a896'),
      __VOTRA_ASSET__: JSON.stringify(env.VOTRA_ASSET_ADDRESS || '0x8015B4a39cCbD4757A107A5F229ef14F24bB7b0B'),
      __VOTRA_RESERVE__: JSON.stringify(env.VOTRA_RESERVE_ADDRESS || '0xa09C12Afd98F1284621299DaBFd6B1105dd7E3FD')
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
