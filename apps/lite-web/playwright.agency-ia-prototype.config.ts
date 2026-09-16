import { defineConfig } from '@playwright/test';

// Prototype-only browser evidence against the isolated Storybook surface.
export default defineConfig({
  testDir: './tests',
  testMatch: '**/agency-ia-prototype.pw.ts',
  outputDir: './test-results/agency-ia-prototype',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4314',
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
    command:
      'pnpm --filter @markorbit/contracts build && pnpm --filter @markorbit/ui build && pnpm exec storybook dev -c ../../packages/ui/.storybook --host 127.0.0.1 --port 4314 --no-open',
    url: 'http://127.0.0.1:4314',
    reuseExistingServer: false,
    timeout: 120_000
  }
});
