import { describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { DailyOrbitSnapshot } from '../src/daily-orbit.js';
import { createDailyWorkspaceRoutes } from '../src/daily-workspace-http.js';
import { DailyWorkspaceSnapshotService } from '../src/daily-workspace-snapshot.js';
import type { LiteTodaySnapshot } from '@markorbit/contracts/product-loop';

const secret = 'lite-daily-workspace-http-secret-0123456789';
const workspaceId = '73737373-7373-4737-8737-737373737373';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_daily_workspace_http',
  sessionId: 'session_daily_workspace_http',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_daily_workspace_http',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};

const orbit: DailyOrbitSnapshot = {
  schemaVersion: 1,
  workspaceId,
  subjectUserId: principal.userId,
  generatedAt: '2026-08-24T00:00:00.000Z',
  preferenceSource: 'NONE',
  items: [],
  contentPicks: [],
  partial: false,
  warnings: [],
  executionAuthorized: false,
  legalTruthVerified: false
};
const today: LiteTodaySnapshot = {
  schemaVersion: 1,
  workspaceId,
  generatedAt: '2026-08-24T00:00:00.000Z',
  items: [],
  partial: false,
  warnings: []
};

function service() {
  return new DailyWorkspaceSnapshotService(
    { snapshot: () => Promise.resolve(orbit) },
    { listToday: () => Promise.resolve(today) },
    () => '2026-08-24T00:00:00.000Z'
  );
}

function request(overrides: Record<string, string> = {}) {
  return {
    body: undefined,
    method: 'GET' as const,
    path: '/v1/daily-workspace',
    params: {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      ...overrides
    }
  };
}

function route() {
  const found = createDailyWorkspaceRoutes({
    internalServiceSecret: secret,
    service: service()
  })[0];
  if (!found) throw new Error('Daily Workspace route missing.');
  return found;
}

describe('Lite Daily Workspace HTTP boundary', () => {
  it('derives Workspace and user identity from the trusted principal', async () => {
    const result = await route().handle(request());
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      workspaceId,
      subjectUserId: principal.userId,
      executionAuthorized: false,
      externalPublishExecuted: false,
      officialTruthCreated: false
    });
  });

  it('rejects a mismatched Workspace header before composition', async () => {
    await expect(
      route().handle(
        request({ 'x-markorbit-workspace-id': '74747474-7474-4747-8747-747474747474' })
      )
    ).rejects.toMatchObject({ status: 404, code: 'WORKSPACE_MISMATCH' });
  });

  it('fails closed without workspace:read', async () => {
    const denied = { ...principal, permissions: [] } satisfies WorkspacePrincipal;
    await expect(
      route().handle(request({ 'x-markorbit-principal': encodeInternalWorkspacePrincipal(denied) }))
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });
});
