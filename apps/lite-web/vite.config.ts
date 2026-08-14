import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const gatewayUrl =
  process.env.VITE_LITE_GATEWAY_URL ?? process.env.VITE_GATEWAY_URL ?? 'http://127.0.0.1:4000';

export default defineConfig({
  plugins: [react()],
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
