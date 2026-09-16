import type { JsonRequest, JsonRoute } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayBusinessAttributionRoutes } from '../src/business-attribution-http.js';

const principal = {
  kind: 'WORKSPACE' as const,
  sessionId: 'session_1',
  userId: 'user_1',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  membershipId: 'membership_1',
  role: 'WORKSPACE_ADMIN' as const,
  permissions: ['workspace:read' as const, 'workspace:manage' as const],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
const csrf = 'business-attribution-csrf-secret-32-bytes';
const origin = 'https://app.example.com';
function auth(): CoreAuthenticationClient {
  return {
    issue: vi.fn() as never,
    resolve: vi.fn() as never,
    revoke: vi.fn() as never,
    resolveWorkspace: vi.fn(() => Promise.resolve(principal))
  };
}
function request(
  method: 'GET' | 'POST',
  body: unknown,
  params: Record<string, string> = {}
): JsonRequest {
  return {
    method,
    path: '',
    params,
    query: {},
    body,
    headers: {
      cookie: 'mo_session=token',
      'x-markorbit-workspace-id': principal.workspaceId,
      origin,
      'x-markorbit-csrf-token': csrfToken(principal.sessionId, csrf),
      'idempotency-key': 'idem-1'
    }
  };
}
function route(routes: readonly JsonRoute[], path: string): JsonRoute {
  const found = routes.find((candidate) => candidate.path === path);
  if (!found) throw new Error(`Missing route ${path}`);
  return found;
}
describe('Gateway Business Attribution boundary', () => {
  it('forwards a mutation with trusted principal and idempotency', async () => {
    const fetchImpl = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 201 })));
    const routes = createGatewayBusinessAttributionRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient: auth(),
      internalServiceSecret: 'internal-secret-32-bytes-minimum!!',
      csrfSecret: csrf,
      allowedOrigins: [origin],
      fetchImpl
    });
    const body = {
      motionKind: 'PORTFOLIO_GROWTH',
      sourceRefs: [{}],
      touchpointRefs: [],
      attributionState: 'UNKNOWN',
      evidenceBasis: 'HUMAN_CONFIRMED'
    };
    await route(routes, '/api/lite/business-attribution-links').handle(request('POST', body));
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://lite.test/v1/business-attribution-links');
    expect(new Headers(init?.headers).get('idempotency-key')).toBe('idem-1');
    expect(new Headers(init?.headers).get('x-markorbit-principal')).toBeTruthy();
  });

  it('uses authenticated Workspace read forwarding without mutation authority', async () => {
    const fetchImpl = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    const routes = createGatewayBusinessAttributionRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient: auth(),
      internalServiceSecret: 'internal-secret-32-bytes-minimum!!',
      csrfSecret: csrf,
      allowedOrigins: [origin],
      fetchImpl
    });
    await route(routes, '/api/lite/business-attribution-links/:linkId').handle(
      request('GET', undefined, { linkId: 'business-attribution_1' })
    );
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'http://lite.test/v1/business-attribution-links/business-attribution_1'
    );
    expect(new Headers(fetchImpl.mock.calls[0]![1]?.headers).has('idempotency-key')).toBe(false);
  });

  it('forwards the guarded content-led demand lineage command', async () => {
    const fetchImpl = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 201 })));
    const routes = createGatewayBusinessAttributionRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient: auth(),
      internalServiceSecret: 'internal-secret-32-bytes-minimum!!',
      csrfSecret: csrf,
      allowedOrigins: [origin],
      fetchImpl
    });
    await route(routes, '/api/lite/content-led-demand-attribution-links').handle(
      request('POST', {
        publishPackage: {
          id: 'publish-package_reviewed',
          version: 1,
          fingerprintSha256: 'a'.repeat(64)
        },
        useFeedback: { id: 'product-loop-feedback_manual', version: 1 },
        siteInboundAttribution: {
          id: 'business-attribution_site',
          version: 1,
          fingerprintSha256: 'b'.repeat(64)
        }
      })
    );
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'http://lite.test/v1/content-led-demand-attribution-links'
    );
  });

  it('forwards bounded partner referral program and eligibility commands', async () => {
    const fetchImpl = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 201 })));
    const routes = createGatewayBusinessAttributionRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient: auth(),
      internalServiceSecret: 'internal-secret-32-bytes-minimum!!',
      csrfSecret: csrf,
      allowedOrigins: [origin],
      fetchImpl
    });
    await route(routes, '/api/lite/partner-referral-programs').handle(
      request('POST', {
        referralCode: 'partner-a',
        partner: {
          id: 'workspace-directory-entry_partner-a',
          version: 1,
          fingerprintSha256: 'a'.repeat(64)
        },
        policy: { id: 'partner-referral-policy_v1', effectiveAt: '2026-09-17T02:00:00.000Z' }
      })
    );
    await route(routes, '/api/lite/partner-commission-eligibility-candidates').handle(
      request('POST', {
        program: {
          id: 'partner-referral-program_partner-a',
          version: 1,
          fingerprintSha256: 'b'.repeat(64)
        },
        siteInboundAttribution: {
          id: 'business-attribution_site-referral',
          version: 1,
          fingerprintSha256: 'c'.repeat(64)
        }
      })
    );
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'http://lite.test/v1/partner-referral-programs',
      'http://lite.test/v1/partner-commission-eligibility-candidates'
    ]);
  });
});
