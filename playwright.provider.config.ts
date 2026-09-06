import { defineConfig } from '@playwright/test';
import { applicationUrl, applications } from './tests/e2e/applications.js';

const inCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /provider\.spec\.ts/,
  outputDir: 'test-results/provider',
  fullyParallel: true,
  forbidOnly: inCI,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: inCI
    ? [['line'], ['html', { outputFolder: 'playwright-report/provider', open: 'never' }]]
    : 'list',
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'provider-desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'provider-mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: `pnpm --filter ${applications.provider.package} dev`,
    url: applicationUrl('provider'),
    reuseExistingServer: !inCI
  }
});
