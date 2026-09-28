import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'workspace-console-preview.spec.ts',
  outputDir: '../../.artifacts/workspace-console-preview/test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4199',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1050 } }
    },
    {
      name: 'mobile-390',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true
      }
    }
  ],
  webServer: {
    command: 'node server.mjs',
    cwd: '.',
    env: { WORKSPACE_PREVIEW_PORT: '4199' },
    url: 'http://127.0.0.1:4199/',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
