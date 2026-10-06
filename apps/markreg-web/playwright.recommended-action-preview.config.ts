import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/recommended-action-preview.pw.ts',
  outputDir: './test-results/recommended-action-preview',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4336',
    browserName: 'chromium',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4336 --strictPort',
    url: 'http://127.0.0.1:4336/recommended-action-preview.html',
    reuseExistingServer: false,
    timeout: 120_000
  }
});
