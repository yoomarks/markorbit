import { defineConfig } from '@playwright/test';
import { milestonePorts } from './scripts/milestone-runtime.mjs';

const inCI = Boolean(process.env['CI']);
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /milestone-001-real-runtime\.spec\.ts/,
  outputDir: 'test-results/real-runtime',
  fullyParallel: false,
  workers: 1,
  retries: inCI ? 1 : 0,
  forbidOnly: inCI,
  timeout: 30_000,
  reporter: inCI
    ? [['line'], ['html', { outputFolder: 'playwright-report/real-runtime', open: 'never' }]]
    : 'list',
  use: { browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'real-runtime-desktop-chromium', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'real-runtime-mobile-chromium-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: 'node scripts/start-milestone-runtime.mjs',
    url: `http://127.0.0.1:${milestonePorts.gateway}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
