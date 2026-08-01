import { defineConfig } from '@playwright/test';
import { applicationUrl, applications } from './tests/e2e/applications.js';

const inCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: [
    /milestone-001-real-runtime\.spec\.ts/,
    /lite-matter-real-runtime\.spec\.ts/,
    /professional-review-real-runtime\.spec\.ts/,
    /document-package-real-runtime\.spec\.ts/
  ],
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
      command: `pnpm --filter ${applications.lite.package} dev --host 127.0.0.1 --port ${applications.lite.port}`,
      url: applicationUrl('lite'),
      reuseExistingServer: !inCI
    },
    {
      command: `pnpm --filter ${applications.markreg.package} dev --host 127.0.0.1 --port ${applications.markreg.port}`,
      url: applicationUrl('markreg'),
      reuseExistingServer: !inCI
    },
    {
      command: `pnpm --filter ${applications.operations.package} dev --host 127.0.0.1 --port ${applications.operations.port}`,
      url: applicationUrl('operations'),
      reuseExistingServer: !inCI
    }
  ]
});
