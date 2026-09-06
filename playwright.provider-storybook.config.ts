import { defineConfig } from '@playwright/test';

const inCI = Boolean(process.env['CI']);
const storybookUrl = 'http://127.0.0.1:6015';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /provider-storybook\.spec\.ts/,
  outputDir: 'test-results/provider-storybook',
  fullyParallel: true,
  forbidOnly: inCI,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: inCI
    ? [['line'], ['html', { outputFolder: 'playwright-report/provider-storybook', open: 'never' }]]
    : 'list',
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'provider-storybook-desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'provider-storybook-mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: 'pnpm --filter @markorbit/ui exec storybook dev -c .storybook-provider -p 6015 --ci',
    url: storybookUrl,
    reuseExistingServer: !inCI
  }
});
