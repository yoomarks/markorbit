import { defineConfig } from '@playwright/test';

const port = 4178;
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /site-v1-preview\.spec\.ts/,
  outputDir: 'test-results/site-v1-preview',
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'site-v1-desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'site-v1-mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: `pnpm --filter @markorbit/site-v1-preview dev --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env['CI']
  }
});
