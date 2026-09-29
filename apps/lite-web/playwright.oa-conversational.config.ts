import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/oa-conversational.pw.ts',
  outputDir: './test-results/oa-conversational',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4316', browserName: 'chromium', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 960 } } },
    {
      name: 'mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command:
      'pnpm --filter @markorbit/contracts build && pnpm --filter @markorbit/ui build && pnpm exec storybook dev -c ../../packages/ui/.storybook --host 127.0.0.1 --port 4316 --no-open',
    url: 'http://127.0.0.1:4316',
    reuseExistingServer: false,
    timeout: 120_000
  }
});
