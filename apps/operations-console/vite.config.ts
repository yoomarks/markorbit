import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        evidenceReviewPreview: fileURLToPath(
          new URL('./execution-evidence-review-preview.html', import.meta.url)
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
  }
});
