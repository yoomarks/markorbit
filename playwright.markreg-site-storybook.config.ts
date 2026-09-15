import { defineConfig } from '@playwright/test';

const inCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /markreg-site-storybook\.spec\.ts/,
  outputDir: 'test-results/markreg-site-storybook',
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
    { name: 'markreg-site-desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'markreg-site-mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command:
      'pnpm --filter @markorbit/markreg-web exec storybook dev -c ../../packages/ui/.storybook -p 6016 --ci',
    url: 'http://127.0.0.1:6016',
    reuseExistingServer: !inCI
  }
});
