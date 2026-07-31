import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /lite-matter-real-runtime\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: process.env.CI ? 'line' : 'list',
  use: { browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'lite-matter-desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'lite-matter-mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: 'pnpm exec tsx scripts/lite-matter-real-runtime.ts',
    url: 'http://127.0.0.1:4471',
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
