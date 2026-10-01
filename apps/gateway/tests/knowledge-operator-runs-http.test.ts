import { AuthenticationError, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest, JsonRoute } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { csrfToken } from '../src/auth.js';
import { createGatewayKnowledgeOperatorRunsRoutes } from '../src/knowledge-operator-runs-http.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const origin = 'https://app.example.com';
const csrfSecret = 'knowledge-browser-csrf-secret-0123456789';
const internalSecret = 'knowledge-internal-secret-0123456789';
const planId = 'plan_cnipa_hot_global_page_2';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_operator',
  sessionId: 'session_operator',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_operator',
  role: 'WORKSPACE_ADMIN',
  permissions: ['execution:read', 'execution:manage']
};

function auth(
  resolveWorkspace: CoreAuthenticationClient['resolveWorkspace'] = vi.fn(() =>
    Promise.resolve(principal)
  )
): CoreAuthenticationClient {
  return {
    issue: vi.fn() as never,
    resolve: vi.fn() as never,
    revoke: vi.fn() as never,
    resolveWorkspace
  };
}

function request(body: unknown, headers: Record<string, string> = {}): JsonRequest {
  return {
    method: 'POST',
    path: '/api/knowledge/operator-runs',
    params: {},
    query: {},
    body,
    headers: { origin, ...headers }
  };
}

function route(routes: readonly JsonRoute[]) {
  const found = routes.find((candidate) => candidate.path === '/api/knowledge/operator-runs');
  if (!found) throw new Error('Missing operator run bridge route.');
  return found;
}

function authorizedHeaders(overrides: Record<string, string> = {}) {
  return {
    cookie: 'mo_session=opaque-session',
    'x-markorbit-workspace-id': workspaceId,
    'x-markorbit-csrf-token': csrfToken(principal.sessionId, csrfSecret),
    'idempotency-key': 'operator-run-001',
    ...overrides
  };
}

function routes(
  input: {
    authenticationClient?: CoreAuthenticationClient;
    internalServiceSecret?: string;
    fetchImpl?: typeof fetch;
  } = {}
) {
  return createGatewayKnowledgeOperatorRunsRoutes({
    knowledgeUrl: 'http://knowledge.test',
    authenticationClient: input.authenticationClient ?? auth(),
    internalServiceSecret: input.internalServiceSecret ?? internalSecret,
    csrfSecret,
    allowedOrigins: [origin],
    ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {})
  });
}

describe('Gateway Knowledge operator run bridge', () => {
  it.each([
    [201, false],
    [200, true]
  ])('preserves downstream status %i and idempotency replay state', async (status, replayed) => {
    const result = { replayed, record: { run: { id: 'run_001' } } };
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify(result), {
          status,
          headers: { 'content-type': 'application/json' }
        })
      )
    );

    const response = await route(routes({ fetchImpl })).handle(
      request(
        {
          planId,
          extensions: { 'x-markorbit.cnipa-query': { mode: 'HOT_GLOBAL', page: 2 } }
        },
        authorizedHeaders({
          'x-markorbit-internal-authorization': 'browser-spoof',
          'x-markorbit-principal': 'browser-spoof'
        })
      )
    );

    expect(response).toEqual({ status, body: result });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://knowledge.test/api/operator-runs');
    const forwarded = new Headers(init?.headers);
    expect(forwarded.get('x-markorbit-internal-authorization')).toBe(internalSecret);
    expect(forwarded.get('x-markorbit-principal')).not.toBe('browser-spoof');
    expect(forwarded.get('idempotency-key')).toBe('operator-run-001');
    expect(forwarded.has('cookie')).toBe(false);
    expect(forwarded.has('x-markorbit-workspace-id')).toBe(false);
    expect(init?.body).toBe(
      JSON.stringify({
        planId,
        extensions: { 'x-markorbit.cnipa-query': { mode: 'HOT_GLOBAL', page: 2 } }
      })
    );
  });

  it('requires session, workspace context, trusted Origin, CSRF and idempotency', async () => {
    const bridge = route(routes({ fetchImpl: vi.fn() }));
    await expect(bridge.handle(request({ planId }))).rejects.toMatchObject({ status: 400 });
    await expect(
      bridge.handle(request({ planId }, { 'idempotency-key': 'operator-run-001' }))
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    await expect(
      bridge.handle(
        request({ planId }, { cookie: 'mo_session=opaque-session', 'idempotency-key': 'key' })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });
    await expect(
      bridge.handle(request({ planId }, authorizedHeaders({ origin: 'https://evil.example.com' })))
    ).rejects.toMatchObject({ status: 403, code: 'UNTRUSTED_ORIGIN' });
    await expect(
      bridge.handle(request({ planId }, authorizedHeaders({ 'x-markorbit-csrf-token': 'wrong' })))
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
  });

  it('rejects READ_ONLY authority and browser-supplied workspace fields', async () => {
    const readOnly: WorkspacePrincipal = {
      ...principal,
      role: 'READ_ONLY',
      permissions: ['execution:read']
    };
    const fetchImpl = vi.fn();
    const bridge = route(
      routes({ authenticationClient: auth(vi.fn(() => Promise.resolve(readOnly))), fetchImpl })
    );
    await expect(bridge.handle(request({ planId }, authorizedHeaders()))).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
    await expect(
      route(routes({ fetchImpl })).handle(request({ planId, workspaceId }, authorizedHeaders()))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed for workspace rejection and unavailable authorization dependencies', async () => {
    const mismatch = auth(
      vi.fn(() =>
        Promise.reject(new AuthenticationError('PERMISSION_DENIED', 'Workspace mismatch.'))
      )
    );
    await expect(
      route(routes({ authenticationClient: mismatch, fetchImpl: vi.fn() })).handle(
        request({ planId }, authorizedHeaders())
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      route(
        createGatewayKnowledgeOperatorRunsRoutes({
          knowledgeUrl: 'http://knowledge.test',
          internalServiceSecret: internalSecret,
          csrfSecret,
          allowedOrigins: [origin]
        })
      ).handle(request({ planId }, authorizedHeaders()))
    ).rejects.toMatchObject({ status: 503, code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });
    await expect(
      route(routes({ internalServiceSecret: ' ' })).handle(request({ planId }, authorizedHeaders()))
    ).rejects.toMatchObject({ status: 503, code: 'KNOWLEDGE_RUNTIME_UNAVAILABLE' });
  });

  it.each([
    [401, 'INTERNAL_SERVICE_UNAUTHORIZED'],
    [403, 'WORKSPACE_MISMATCH'],
    [503, 'CASE_PRODUCER_AUTH_NOT_CONFIGURED']
  ])('preserves Knowledge authorization status %i', async (status, code) => {
    const body = { code };
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify(body), { status }))
    );
    await expect(
      route(routes({ fetchImpl })).handle(request({ planId }, authorizedHeaders()))
    ).resolves.toEqual({ status, body });
  });

  it('maps an unavailable or invalid Knowledge response to 503 without exposing secrets', async () => {
    for (const fetchImpl of [
      vi.fn<typeof fetch>(() => Promise.reject(new Error('network failure'))),
      vi.fn<typeof fetch>(() => Promise.resolve(new Response('not-json', { status: 502 })))
    ]) {
      await expect(
        route(routes({ fetchImpl })).handle(request({ planId }, authorizedHeaders()))
      ).rejects.toMatchObject({
        status: 503,
        code: 'KNOWLEDGE_RUNTIME_UNAVAILABLE',
        message: 'Knowledge runtime is unavailable.'
      });
    }
  });
});
