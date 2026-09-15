import type { CoreAuthenticationClient } from '../src/auth.js';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createGatewayWorkspaceCommercialRoutesV1 } from '../src/workspace-commercial-http.js';

const principal = {
  kind: 'WORKSPACE' as const,
  sessionId: 'session-commercial',
  userId: 'user-commercial',
  workspaceId: 'workspace-commercial',
  membershipId: 'membership-commercial',
  role: 'READ_ONLY' as const,
  permissions: ['workspace:read' as const],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
function request(path: string, query: Record<string, string> = {}): JsonRequest {
  return {
    method: 'GET',
    path,
    params: path.includes(':entitlementKey') ? { entitlementKey: 'lite.access' } : {},
    query,
    body: undefined,
    headers: {
      cookie: 'mo_session=browser-session',
      'x-markorbit-workspace-id': principal.workspaceId,
      'x-correlation-id': 'correlation-commercial'
    }
  };
}
function client(value = principal): CoreAuthenticationClient {
  return {
    issue: vi.fn() as never,
    resolve: vi.fn() as never,
    revoke: vi.fn() as never,
    resolveWorkspace: vi.fn(() => Promise.resolve(value))
  };
}

describe('Gateway Workspace commercial reads', () => {
  it('forwards current Principal references instead of caller-supplied identity', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ schemaVersion: 1, key: 'lite.access' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    const route = createGatewayWorkspaceCommercialRoutesV1({
      coreUrl: 'http://core.test',
      authenticationClient: client(),
      internalServiceSecret: 'internal-secret',
      fetchImpl
    })[1]!;
    await expect(
      route.handle(
        request('/api/workspace-commercial/entitlements/:entitlementKey', {
          subjectScope: 'USER',
          asOf: '2026-09-15T00:00:00.000Z'
        })
      )
    ).resolves.toEqual({ status: 200, body: { schemaVersion: 1, key: 'lite.access' } });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://core.test/internal/workspaces/workspace-commercial/commercial/entitlements/resolve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          userId: principal.userId,
          membershipId: principal.membershipId,
          subjectScope: 'USER',
          entitlementKey: 'lite.access',
          asOf: '2026-09-15T00:00:00.000Z'
        })
      })
    );
  });

  it('fails before owner access when workspace:read is absent', async () => {
    const fetchImpl = vi.fn();
    const route = createGatewayWorkspaceCommercialRoutesV1({
      authenticationClient: client({ ...principal, permissions: [] }),
      internalServiceSecret: 'internal-secret',
      fetchImpl
    })[0]!;
    await expect(
      route.handle(request('/api/workspace-commercial/installations'))
    ).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires explicit deterministic entitlement subject and as-of time', async () => {
    const fetchImpl = vi.fn();
    const route = createGatewayWorkspaceCommercialRoutesV1({
      authenticationClient: client(),
      internalServiceSecret: 'internal-secret',
      fetchImpl
    })[1]!;
    await expect(
      route.handle(
        request('/api/workspace-commercial/entitlements/:entitlementKey', {
          subjectScope: 'USER'
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
