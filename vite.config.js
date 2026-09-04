import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: { __REOWN_PROJECT_ID__: JSON.stringify(env.VOTRA_REOWN_PROJECT_ID || '') },
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
          for (const directory of ['proof', 'evidence', 'docs']) {
            fs.cpSync(directory, path.join('dist', directory), { recursive: true });
          }
        }
      }
    ],
    server: { port: 4173, host: '127.0.0.1' },
    resolve: { alias: { '@': path.resolve(process.cwd()) } }
  };
});
