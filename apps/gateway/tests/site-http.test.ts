import type { CoreAuthenticationClient } from '../src/auth.js';
import { csrfToken } from '../src/auth.js';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createGatewaySiteRoutesV1 } from '../src/site-http.js';

const principal = {
  kind: 'WORKSPACE' as const,
  sessionId: 'session-site',
  userId: 'user-site',
  workspaceId: 'workspace-site',
  membershipId: 'membership-site',
  role: 'WORKSPACE_ADMIN' as const,
  permissions: ['workspace:read' as const, 'workspace:manage' as const],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
const csrfSecret = 'csrf-site-secret';
const origin = 'https://app.example.com';

function client(): CoreAuthenticationClient {
  return {
    issue: vi.fn() as never,
    resolve: vi.fn() as never,
    revoke: vi.fn() as never,
    resolveWorkspace: vi.fn(() => Promise.resolve(principal))
  };
}

function request(
  method: string,
  path: string,
  body: unknown = undefined,
  headers: Record<string, string> = {},
  params: Record<string, string> = {}
): JsonRequest {
  return {
    method,
    path,
    body,
    params,
    query: {},
    headers: {
      host: 'tenant.example.com:443',
      cookie: 'mo_session=browser-token',
      'x-markorbit-workspace-id': principal.workspaceId,
      origin,
      'x-markorbit-csrf-token': csrfToken(principal.sessionId, csrfSecret),
      'idempotency-key': 'gateway-site-command',
      ...headers
    }
  };
}

describe('Gateway Site boundary', () => {
  it('resolves from the connection host and exposes only the public projection', async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body.');
      const value = JSON.parse(init.body) as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Expected a JSON object request body.');
      const record = value as Record<string, unknown>;
      expect(record.hostname).toBe('tenant.example.com:443');
      expect(typeof record.observedAt).toBe('string');
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            publicSite: { schemaVersion: 1, siteId: 'site_public', brand: { displayName: 'A' } },
            requestContext: { workspaceId: 'private-workspace', fingerprintSha256: 'secret' }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    const route = createGatewaySiteRoutesV1({
      internalServiceSecret: 'internal-site-secret',
      fetchImpl
    })[0]!;
    const result = await route.handle(
      request('GET', '/api/site', undefined, { 'x-forwarded-host': 'attacker.example.com' })
    );
    expect(result).toEqual({
      status: 200,
      body: { schemaVersion: 1, siteId: 'site_public', brand: { displayName: 'A' } }
    });
    expect(result.body).not.toHaveProperty('requestContext');
    expect(result.body).not.toHaveProperty('workspaceId');
  });

  it('rejects browser Workspace spoofing before Site owner access', async () => {
    const fetchImpl = vi.fn();
    const route = createGatewaySiteRoutesV1({
      authenticationClient: client(),
      internalServiceSecret: 'internal-site-secret',
      fetchImpl,
      csrfSecret,
      allowedOrigins: [origin]
    })[2]!;
    await expect(
      route.handle(request('POST', '/api/sites', { workspaceId: 'attacker' }))
    ).rejects.toMatchObject({ status: 400, code: 'SITE_AUTHORITY_SPOOF_REJECTED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires current workspace:manage and CSRF before mutation forwarding', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ siteId: 'site_created' }), {
          status: 201,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    const routes = createGatewaySiteRoutesV1({
      authenticationClient: client(),
      internalServiceSecret: 'internal-site-secret',
      fetchImpl,
      csrfSecret,
      allowedOrigins: [origin]
    });
    await expect(
      routes[2]!.handle(
        request(
          'POST',
          '/api/sites',
          { kind: 'WORKSPACE_BRANDED' },
          { 'x-markorbit-csrf-token': 'wrong' }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
