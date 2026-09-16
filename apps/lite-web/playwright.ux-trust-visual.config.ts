import { defineConfig } from '@playwright/test';

// Storybook-only responsive and visual evidence for the bounded UX trust/state lane.
export default defineConfig({
  testDir: './tests',
  testMatch: '**/ux-trust-visual.pw.ts',
  outputDir: './test-results/ux-trust-visual',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4316',
    browserName: 'chromium',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop-working', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile-review-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command:
      'pnpm --filter @markorbit/contracts build && pnpm --filter @markorbit/ui build && pnpm exec storybook dev -c ../../packages/ui/.storybook --host 127.0.0.1 --port 4316 --no-open',
    url: 'http://127.0.0.1:4316',
    reuseExistingServer: false,
    timeout: 120_000
  }
});
