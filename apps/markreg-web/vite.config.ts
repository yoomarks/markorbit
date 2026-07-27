import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@markorbit/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url))
    }
  },
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'] }
});
