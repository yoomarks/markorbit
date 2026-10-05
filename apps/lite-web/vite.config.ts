import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const gatewayUrl =
  process.env.VITE_LITE_GATEWAY_URL ?? process.env.VITE_GATEWAY_URL ?? 'http://127.0.0.1:4000';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(fileURLToPath(new URL('.', import.meta.url)), 'index.html'),
        'oa-workbench-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'oa-workbench-preview.html'
        ),
        'trading-studio-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'trading-studio-preview.html'
        ),
        'agency-workspace-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'agency-workspace-preview.html'
        ),
        'contextual-workbench-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'contextual-workbench-preview.html'
        ),
        'customers-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'customers-preview.html'
        ),
        'content-studio-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'content-studio-preview.html'
        ),
        'today-workspace-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'today-workspace-preview.html'
        ),
        'opportunity-center-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'opportunity-center-preview.html'
        ),
        'matter-workspace-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'matter-workspace-preview.html'
        ),
        'documents-instructions-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'documents-instructions-preview.html'
        ),
        'preparation-lock-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'preparation-lock-preview.html'
        ),
        'filing-authorization-preview': resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'filing-authorization-preview.html'
        )
      }
    }
  },
  resolve: {
    alias: [
      {
        find: /^@markorbit\/ui$/,
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url))
      },
      {
        find: /^@markorbit\/contracts$/,
        replacement: fileURLToPath(
          new URL('../../packages/contracts/src/index.ts', import.meta.url)
        )
      },
      {
        find: /^@markorbit\/contracts\/(.+)$/,
        replacement: fileURLToPath(new URL('../../packages/contracts/src/$1.ts', import.meta.url))
      }
    ]
  },
  server: {
    proxy: {
      '/api': gatewayUrl
    }
  }
});
