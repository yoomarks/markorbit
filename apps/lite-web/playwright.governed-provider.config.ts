import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/governed-provider.pw.ts',
  outputDir: './test-results/governed-provider',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4315',
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
    command: 'pnpm dev --host 127.0.0.1 --port 4315 --strictPort',
    url: 'http://127.0.0.1:4315',
    reuseExistingServer: false,
    env: { VITE_MARKORBIT_FIXTURE_ENTRY: '1' }
  }
});
