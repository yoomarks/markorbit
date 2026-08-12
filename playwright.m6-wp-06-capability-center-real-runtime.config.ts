import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/m6-wp-06-capability-center-real-runtime.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'm6-wp06-capability-desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'm6-wp06-capability-mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: 'pnpm exec tsx scripts/m6-wp-06-capability-center-real-runtime.ts',
    url: 'http://127.0.0.1:4485',
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
