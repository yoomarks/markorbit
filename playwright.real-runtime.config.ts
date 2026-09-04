import { createHmac } from 'node:crypto';
import { defineConfig } from '@playwright/test';
import { milestoneAuth, milestonePorts } from './scripts/milestone-runtime.mjs';

const inCI = Boolean(process.env['CI']);
const internalServiceSecret =
  process.env['MO_INTERNAL_SERVICE_SECRET'] ?? 'milestone-real-runtime-internal-secret-32-bytes';
const csrfSecret =
  process.env['MO_CSRF_SECRET'] ?? 'milestone-real-runtime-csrf-secret-32-bytes';
const authenticatedUse = {
  extraHTTPHeaders: {
    'x-markorbit-workspace-id': milestoneAuth.workspaceId,
    'x-markorbit-csrf-token': createHmac('sha256', csrfSecret)
      .update(milestoneAuth.sessionId)
      .digest('base64url')
  },
  storageState: {
    cookies: [
      {
        name: 'mo_session',
        value: milestoneAuth.sessionValue,
        domain: '127.0.0.1',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const
      }
    ],
    origins: []
  }
};

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /milestone-001-real-runtime\.spec\.ts/,
  outputDir: 'test-results/real-runtime',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: inCI,
  // The full governed chain now includes twelve authoritative repository snapshots around six
  // direct-navigation/reload checkpoints. Keep retries disabled and budget the complete path.
  timeout: 60_000,
  reporter: inCI
    ? [['line'], ['html', { outputFolder: 'playwright-report/real-runtime', open: 'never' }]]
    : 'list',
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...authenticatedUse
  },
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
    stderr: 'pipe',
    env: {
      MO_INTERNAL_SERVICE_SECRET: internalServiceSecret,
      MO_CSRF_SECRET: csrfSecret
    }
  }
});