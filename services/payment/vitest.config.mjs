import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: process.env.PAYMENT_POSTGRES_REQUIRED !== '1'
  }
});
