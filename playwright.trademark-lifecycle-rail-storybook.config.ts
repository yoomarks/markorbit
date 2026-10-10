import { defineConfig } from '@playwright/test';

const inCI = Boolean(process.env['CI']);
const storybookUrl = 'http://127.0.0.1:6020';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /trademark-lifecycle-rail-storybook\.spec\.ts/,
  outputDir: 'test-results/trademark-lifecycle-rail-storybook',
  fullyParallel: false,
  forbidOnly: inCI,
  retries: 0,
  timeout: 40_000,
  expect: { timeout: 8_000 },
  reporter: inCI ? 'line' : 'list',
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'lifecycle-rail-desktop-1440',
      use: { viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'lifecycle-rail-mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command:
      'pnpm --filter @markorbit/lite-web exec storybook dev -c ../../packages/ui/.storybook -p 6020 --ci',
    url: storybookUrl,
    reuseExistingServer: !inCI
  }
});
