import type { CoreAuthenticationClient } from '../src/auth.js';
import { csrfToken } from '../src/auth.js';
import type { JsonRequest, JsonRoute } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createGatewayOutboundContactPolicyRoutes } from '../src/outbound-contact-policy-http.js';
const p = {
  kind: 'WORKSPACE' as const,
  sessionId: 'session_1',
  userId: 'user_1',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  membershipId: 'membership_1',
  role: 'WORKSPACE_ADMIN' as const,
  permissions: ['workspace:read' as const, 'workspace:manage' as const],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
const csrf = 'csrf-outbound-contact-secret-32-bytes';
const origin = 'https://app.example.com';
function auth(): CoreAuthenticationClient {
  return {
    issue: vi.fn() as never,
    resolve: vi.fn() as never,
    revoke: vi.fn() as never,
    resolveWorkspace: vi.fn(() => Promise.resolve(p))
  };
}
function req(
  path: string,
  body: unknown,
  params: Record<string, string> = {},
  headers: Record<string, string> = {}
): JsonRequest {
  return {
    method: 'POST',
    path,
    params,
    query: {},
    body,
    headers: {
      cookie: 'mo_session=token',
      'x-markorbit-workspace-id': p.workspaceId,
      origin,
      'x-markorbit-csrf-token': csrfToken(p.sessionId, csrf),
      'idempotency-key': 'idem-1',
      ...headers
    }
  };
}
function route(rs: readonly JsonRoute[], path: string) {
  const r = rs.find((x) => x.path === path);
  if (!r) throw new Error(`missing ${path}`);
  return r;
}
describe('Gateway outbound contact policy boundary', () => {
  it('forwards durable mutations with trusted Principal and idempotency', async () => {
    const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    const rs = createGatewayOutboundContactPolicyRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient: auth(),
      internalServiceSecret: 'internal-secret-32-bytes-minimum!!',
      csrfSecret: csrf,
      allowedOrigins: [origin],
      fetchImpl
    });
    const body = {
      targetRef: { owner: 'LITE', kind: 'PROSPECT', id: 'candidate_1', version: 1 },
      endpointFingerprintSha256: 'a'.repeat(64),
      purpose: 'PROSPECT_OUTREACH',
      policyRef: { policyId: 'policy_1', version: 1 },
      basisState: 'ASSERTED_ALLOWED',
      evidenceRefs: []
    };
    await route(rs, '/api/lite/outbound-contact-policy/basis-assertions').handle(req('', body));
    const [url, init] = fetchImpl.mock.calls[0]!;
    const forwardedUrl =
      typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    expect(forwardedUrl).toBe('http://lite.test/v1/outbound-contact-policy/basis-assertions');
    const h = new Headers(init?.headers);
    expect(h.get('idempotency-key')).toBe('idem-1');
    expect(h.get('x-markorbit-principal')).toBeTruthy();
    if (typeof init?.body !== 'string') throw new Error('Expected JSON string request body.');
    expect(JSON.parse(init.body)).toEqual(body);
  });
  it('rejects spoofing and missing idempotency before downstream mutation', async () => {
    const fetchImpl = vi.fn();
    const rs = createGatewayOutboundContactPolicyRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient: auth(),
      internalServiceSecret: 'internal-secret-32-bytes-minimum!!',
      csrfSecret: csrf,
      allowedOrigins: [origin],
      fetchImpl
    });
    const r = route(rs, '/api/lite/outbound-contact-policy/basis-assertions');
    await expect(r.handle(req('', { workspaceId: p.workspaceId }))).rejects.toMatchObject({
      status: 400,
      code: 'ACTOR_SPOOF_REJECTED'
    });
    await expect(r.handle(req('', {}, {}, { 'idempotency-key': '' }))).rejects.toMatchObject({
      status: 400
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('treats readiness as authenticated advisory evaluation rather than durable authorization', async () => {
    const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(JSON.stringify({ outcome: 'UNKNOWN', protectedActionAuthorized: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    const rs = createGatewayOutboundContactPolicyRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient: auth(),
      internalServiceSecret: 'internal-secret-32-bytes-minimum!!',
      csrfSecret: csrf,
      allowedOrigins: [origin],
      fetchImpl
    });
    await route(rs, '/api/lite/outbound-contact-policy/readiness/evaluate').handle(
      req(
        '',
        {
          targetRef: { owner: 'LITE', kind: 'PROSPECT', id: 'candidate_1', version: 1 },
          endpointFingerprintSha256: 'a'.repeat(64),
          purpose: 'PROSPECT_OUTREACH',
          policyRef: { policyId: 'policy_1', version: 1 },
          reviewedSendFingerprintSha256: 'b'.repeat(64)
        },
        {},
        { 'idempotency-key': '' }
      )
    );
    const h = new Headers(fetchImpl.mock.calls[0]![1]?.headers);
    expect(h.has('idempotency-key')).toBe(false);
  });
});
