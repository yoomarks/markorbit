import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: !process.env.MGSN_TEST_DATABASE_URL
  }
});
