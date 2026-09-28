import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4208', trace: 'retain-on-failure' },
  webServer: { command: 'node server.mjs', port: 4208, reuseExistingServer: true },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-390', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } }
  ]
});
