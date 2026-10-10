import { defineConfig } from '@playwright/test';

const inCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /application-materials-review-storybook\.spec\.ts/,
  outputDir: 'test-results/application-materials-review-storybook',
  fullyParallel: true,
  forbidOnly: inCI,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: inCI ? 'line' : 'list',
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'm21-desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'm21-mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command:
      'pnpm --filter @markorbit/markreg-web exec storybook dev -c ../../packages/ui/.storybook -p 6019 --ci',
    url: 'http://127.0.0.1:6019',
    reuseExistingServer: !inCI
  }
});
