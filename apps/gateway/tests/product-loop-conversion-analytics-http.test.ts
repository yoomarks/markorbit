import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '31313131-3131-4313-8313-313131313131';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_m7_wp02_analytics',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_m7_wp02_analytics',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read']
};
const resolveWorkspace = vi.fn(() => Promise.resolve(principal));
const auth: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('issue is not expected')),
  resolve: () => Promise.reject(new Error('resolve is not expected')),
  resolveWorkspace,
  revoke: () => Promise.resolve()
};
const options = {
  liteUrl: 'http://lite.test',
  authenticationClient: auth,
  internalServiceSecret: 'm7-wp02-internal-secret-012345678901',
  csrfSecret: 'm7-wp02-csrf-secret-01234567890123',
  allowedOrigins: ['https://test.markorbit.local']
};

function analyticsRoute() {
  const value = createGatewayProductLoopRoutes(options).find(
    (candidate) =>
      candidate.method === 'GET' && candidate.path === '/api/lite/analytics/product-loop-conversions'
  );
  if (!value) throw new Error('conversion analytics route missing');
  return value;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway bounded Product conversion analytics read', () => {
  it('requires authenticated Workspace read authority and forwards no mutation authority', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/analytics/product-loop-conversions');
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['idempotency-key']).toBeUndefined();
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            workspaceId,
            owner: 'LITE',
            scope: 'WORKSPACE_ALL_TIME',
            observationalOnly: true,
            mutatesBusinessState: false,
            userReportedExternalUseVerified: false
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', downstream);

    const result = await analyticsRoute().handle({
      method: 'GET',
      path: '/api/lite/analytics/product-loop-conversions',
      params: {},
      query: {},
      headers: {
        cookie: 'mo_session=token',
        'x-markorbit-workspace-id': workspaceId
      },
      body: undefined
    });

    expect(result.status).toBe(200);
    expect(resolveWorkspace).toHaveBeenCalledWith('token', workspaceId, undefined);
    expect(downstream).toHaveBeenCalledTimes(1);
  });
});
