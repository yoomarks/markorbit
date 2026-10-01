import { defineConfig } from '@playwright/test';

const inCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /customer-portal-v1-preview\.spec\.ts/,
  outputDir: 'test-results/customer-portal-v1-preview',
  fullyParallel: false,
  forbidOnly: inCI,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: inCI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4182',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'customer-portal-desktop', use: { viewport: { width: 1440, height: 960 } } },
    {
      name: 'customer-portal-mini-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: 'pnpm --filter @markorbit/markreg-web dev --host 127.0.0.1 --port 4182',
    url: 'http://127.0.0.1:4182/customer-portal-preview.html',
    reuseExistingServer: !inCI
  }
});
