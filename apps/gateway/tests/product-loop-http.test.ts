import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '27272727-2727-4272-8272-272727272727';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_wp05_gateway',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_wp05_gateway',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
};
const auth = {
  resolveWorkspace: vi.fn(async () => principal)
};
const options = {
  liteUrl: 'http://lite.test',
  authenticationClient: auth,
  internalServiceSecret: 'wp05-gateway-internal-key-0123456789',
  csrfSecret: 'wp05-gateway-csrf-key-01234567890123',
  allowedOrigins: ['https://test.markorbit.local']
};

function route(method: string, path: string) {
  const value = createGatewayProductLoopRoutes(options).find(
    (candidate) => candidate.method === method && candidate.path === path
  );
  if (!value) throw new Error(`route ${method} ${path} missing`);
  return value;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Lite Product-loop transport boundary', () => {
  it('forwards authenticated Workspace Principal on Today reads', async () => {
    const downstream = vi.fn(async (_url: string, init: RequestInit) =>
      new Response(JSON.stringify({ schemaVersion: 1, workspaceId, items: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', downstream);
    const result = await route('GET', '/api/lite/today').handle({
      method: 'GET',
      path: '/api/lite/today',
      params: {},
      query: {},
      headers: {
        cookie: 'mo_session=token',
        'x-markorbit-workspace-id': workspaceId
      }
    });
    expect(result.status).toBe(200);
    expect(auth.resolveWorkspace).toHaveBeenCalledWith('token', workspaceId, undefined);
    const init = downstream.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(headers['x-markorbit-principal']).toContain(principal.userId);
  });

  it('rejects client actor spoof fields before any Lite mutation', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(
      route('POST', '/api/lite/prepared-actions/:preparedActionId/confirm').handle({
        method: 'POST',
        path: '/api/lite/prepared-actions/prepared-action_1/confirm',
        params: { preparedActionId: 'prepared-action_1' },
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': 'unused-for-spoof-rejection',
          'idempotency-key': 'confirm-1'
        },
        body: {
          workspaceId,
          preparedActionVersion: 1,
          confirmedByPrincipalId: 'attacker'
        }
      })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
  });

  it('rejects missing mutation idempotency and cross-Workspace body context', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(
      route('POST', '/api/lite/today/:todayRecommendationId/prepared-actions').handle({
        method: 'POST',
        path: '/api/lite/today/today-recommendation_1/prepared-actions',
        params: { todayRecommendationId: 'today-recommendation_1' },
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId
        },
        body: {
          workspaceId: '28282828-2828-4282-8282-282828282828',
          recommendationVersion: 1
        }
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });
  });
});
