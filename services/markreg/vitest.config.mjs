import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: process.env.MARKREG_POSTGRES_TEST_REQUIRED !== '1',
  },
});
