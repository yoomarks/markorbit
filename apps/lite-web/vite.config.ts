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
        )
      }
    }
  },
  resolve: {
    alias: [
      {
        find: /^@markorbit\/ui$/,
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url))
      }
    ]
  },
  server: {
    proxy: {
      '/api': gatewayUrl
    }
  }
});
