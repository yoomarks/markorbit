import { defineConfig } from '@playwright/test';

// Fixture-backed browser evidence for the bounded sell-side state matrix. Runtime persistence is
// covered separately through the authenticated Gateway client and component tests.
export default defineConfig({
  testDir: './tests',
  testMatch: '**/trademark-commerce.pw.ts',
  outputDir: './test-results/trademark-commerce',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:7354',
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
    command: 'pnpm exec storybook dev -c ../../packages/ui/.storybook --port 7354 --ci',
    url: 'http://127.0.0.1:7354',
    reuseExistingServer: false
  }
});
