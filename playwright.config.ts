import { defineConfig } from '@playwright/test';

const inCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: inCI,
  retries: inCI ? 2 : 0,
  ...(inCI ? { workers: 2 } : {}),
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: inCI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop-chromium', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile-chromium',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: [
    {
      command: 'pnpm --filter @markorbit/lite-web dev --host 127.0.0.1 --port 4171',
      url: 'http://127.0.0.1:4171',
      reuseExistingServer: !inCI
    },
    {
      command: 'pnpm --filter @markorbit/markreg-web dev --host 127.0.0.1 --port 4172',
      url: 'http://127.0.0.1:4172',
      reuseExistingServer: !inCI
    },
    {
      command: 'pnpm --filter @markorbit/operations-console dev --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !inCI
    }
  ]
});
