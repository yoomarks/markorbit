import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest, JsonRoute } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { csrfToken } from '../src/auth.js';
import { createGatewaySeedWorkspaceRoutes } from '../src/seed-workspace-http.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const origin = 'https://lite.example.com';
const csrfSecret = 'seed-browser-csrf-secret-0123456789';
const internalSecret = 'seed-browser-internal-secret-0123456789';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_seed_claimant',
  sessionId: 'session_seed_claimant',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_seed_claimant',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'workspace:manage']
};

function auth(
  resolveWorkspace = vi.fn(() => Promise.resolve(principal))
): CoreAuthenticationClient {
  return {
    issue: vi.fn() as never,
    resolve: vi.fn() as never,
    revoke: vi.fn() as never,
    resolveWorkspace
  };
}

function request(path: string, body: unknown, headers: Record<string, string> = {}): JsonRequest {
  return {
    method: 'POST',
    path,
    params: {},
    query: {},
    body,
    headers: {
      origin,
      ...headers
    }
  };
}

function route(routes: readonly JsonRoute[], path: string) {
  const found = routes.find((candidate) => candidate.path === path);
  if (!found) throw new Error(`Missing ${path}`);
  return found;
}

describe('Gateway Seed Workspace browser boundary', () => {
  it('allows a trusted-origin token bearer to read only the sanitized invitation preview', async () => {
    const preview = {
      schemaVersion: 1,
      seedWorkspacePackageId: 'seed-workspace-package_agency-001',
      target: { kind: 'AGENCY', displayName: 'Example IP Agency' },
      counts: { representedApplicants: 23, relatedTrademarks: 87 },
      preparedAt: '2026-09-21T00:00:00.000Z',
      expiresAt: '2026-10-21T00:00:00.000Z'
    };
    const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(JSON.stringify(preview), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    const routes = createGatewaySeedWorkspaceRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient: auth(),
      internalServiceSecret: internalSecret,
      csrfSecret,
      allowedOrigins: [origin],
      fetchImpl
    });

    const response = await route(routes, '/api/lite/seed-workspace-invitations/preview').handle(
      request('/api/lite/seed-workspace-invitations/preview', {
        packageId: preview.seedWorkspacePackageId,
        invitationClaimToken: 'opaque-claim-token'
      })
    );

    expect(response).toEqual({ status: 200, body: preview });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://lite.test/v1/seed-workspace-invitations/preview');
    const forwarded = new Headers(init?.headers);
    expect(forwarded.get('x-markorbit-internal-authorization')).toBe(internalSecret);
    expect(forwarded.has('x-markorbit-principal')).toBe(false);
    expect(forwarded.has('x-markorbit-workspace-id')).toBe(false);
    expect(init?.body).toBe(
      JSON.stringify({
        packageId: preview.seedWorkspacePackageId,
        invitationClaimToken: 'opaque-claim-token'
      })
    );
  });

  it('requires authenticated Workspace authority, CSRF and idempotency before claim', async () => {
    const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(JSON.stringify({ claimed: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    const resolveWorkspace = vi.fn(() => Promise.resolve(principal));
    const authenticationClient = auth(resolveWorkspace);
    const routes = createGatewaySeedWorkspaceRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient,
      internalServiceSecret: internalSecret,
      csrfSecret,
      allowedOrigins: [origin],
      fetchImpl
    });
    const body = {
      packageId: 'seed-workspace-package_agency-001',
      invitationClaimToken: 'opaque-claim-token'
    };
    const claim = route(routes, '/api/lite/seed-workspace-claims');

    await expect(
      claim.handle(request('/api/lite/seed-workspace-claims', body))
    ).rejects.toMatchObject({
      status: 400
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    const response = await claim.handle(
      request('/api/lite/seed-workspace-claims', body, {
        cookie: 'mo_session=opaque-session',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(principal.sessionId, csrfSecret),
        'idempotency-key': 'seed-claim-browser-001'
      })
    );

    expect(response).toEqual({ status: 200, body: { claimed: true } });
    expect(resolveWorkspace).toHaveBeenCalledWith('opaque-session', workspaceId, undefined);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://lite.test/v1/seed-workspace-claims');
    const forwarded = new Headers(init?.headers);
    expect(forwarded.get('x-markorbit-workspace-id')).toBe(workspaceId);
    expect(forwarded.get('x-markorbit-principal')).toBeTruthy();
    expect(forwarded.get('idempotency-key')).toBe('seed-claim-browser-001');
    if (typeof init?.body !== 'string') throw new Error('Expected JSON request body.');
    const forwardedBody: unknown = JSON.parse(init.body) as unknown;
    expect(forwardedBody).toEqual(body);
    expect(forwardedBody).not.toHaveProperty('workspaceId');
    expect(forwardedBody).not.toHaveProperty('actorPrincipalId');
  });

  it('records first value only after authenticated Workspace authority and exact Work Item id', async () => {
    const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(JSON.stringify({ journey: { stage: 'FIRST_VALUE_RECORDED' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    const routes = createGatewaySeedWorkspaceRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient: auth(),
      internalServiceSecret: internalSecret,
      csrfSecret,
      allowedOrigins: [origin],
      fetchImpl
    });
    const firstValue = route(routes, '/api/lite/seed-workspace-packages/:packageId/first-value');
    const response = await firstValue.handle({
      ...request(
        '/api/lite/seed-workspace-packages/seed-workspace-package_agency-001/first-value',
        { workItemId: 'lite-work-item_first-value' },
        {
          cookie: 'mo_session=opaque-session',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': csrfToken(principal.sessionId, csrfSecret),
          'idempotency-key': 'seed-first-value-browser-001'
        }
      ),
      params: { packageId: 'seed-workspace-package_agency-001' }
    });

    expect(response).toEqual({
      status: 200,
      body: { journey: { stage: 'FIRST_VALUE_RECORDED' } }
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'http://lite.test/v1/seed-workspace-packages/seed-workspace-package_agency-001/first-value'
    );
    expect(new Headers(init?.headers).get('idempotency-key')).toBe('seed-first-value-browser-001');
    expect(init?.body).toBe(JSON.stringify({ workItemId: 'lite-work-item_first-value' }));
  });

  it('fails closed for untrusted preview origins and claim actor spoof fields', async () => {
    const fetchImpl = vi.fn();
    const routes = createGatewaySeedWorkspaceRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient: auth(),
      internalServiceSecret: internalSecret,
      csrfSecret,
      allowedOrigins: [origin],
      fetchImpl
    });

    await expect(
      route(routes, '/api/lite/seed-workspace-invitations/preview').handle(
        request(
          '/api/lite/seed-workspace-invitations/preview',
          {
            packageId: 'seed-workspace-package_agency-001',
            invitationClaimToken: 'opaque-claim-token'
          },
          { origin: 'https://evil.example.com' }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'UNTRUSTED_ORIGIN' });

    await expect(
      route(routes, '/api/lite/seed-workspace-claims').handle(
        request(
          '/api/lite/seed-workspace-claims',
          {
            packageId: 'seed-workspace-package_agency-001',
            invitationClaimToken: 'opaque-claim-token',
            workspaceId
          },
          {
            cookie: 'mo_session=opaque-session',
            'x-markorbit-workspace-id': workspaceId,
            'x-markorbit-csrf-token': csrfToken(principal.sessionId, csrfSecret),
            'idempotency-key': 'seed-claim-browser-002'
          }
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
