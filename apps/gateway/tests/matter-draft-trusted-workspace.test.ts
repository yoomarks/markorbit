import { afterEach, describe, expect, it, vi } from 'vitest';
import { type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayMarkRegEarlyFunnelRoutes } from '../src/markreg-early-funnel-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000000771';
const otherWorkspaceId = '018f0000-0000-7000-8000-000000000772';
const sessionId = '018f0000-0000-7000-8000-000000000773';
const csrfSecret = 'integration-771-csrf-secret-0123456789';
const internalServiceSecret = 'integration-771-internal-secret-012345';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '018f0000-0000-7000-8000-000000000774',
  sessionId,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: '018f0000-0000-7000-8000-000000000775',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:read', 'matter:create', 'matter:manage']
};

function authenticationClient(): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('issue is not expected')),
    resolve: () => Promise.reject(new Error('resolve is not expected')),
    resolveWorkspace: () => Promise.resolve(principal),
    revoke: () => Promise.resolve()
  };
}

function governedRoute() {
  const route = createGatewayMarkRegEarlyFunnelRoutes({
    markRegUrl: 'http://markreg.test',
    authenticationClient: authenticationClient(),
    internalServiceSecret,
    csrfSecret,
    allowedOrigins: ['https://app.example']
  }).find((candidate) => candidate.path === '/api/markreg/matter-drafts');
  if (!route) throw new Error('Governed Matter Draft route missing.');
  return route;
}

function request(body: Record<string, unknown>): JsonRequest {
  return {
    method: 'POST',
    path: '/api/markreg/matter-drafts',
    body,
    params: {},
    query: {},
    headers: {
      cookie: 'mo_session=token-771',
      origin: 'https://app.example',
      'x-markorbit-workspace-id': workspaceId,
      'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret),
      'x-correlation-id': 'correlation_771',
      'x-request-id': 'request_771'
    }
  };
}

function response(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway trusted Workspace Matter Draft creation', () => {
  it('injects authenticated Workspace authority into the downstream durable command', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://markreg.test/v1/matter-drafts');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['x-correlation-id']).toBe('correlation_771');
      expect(headers['x-request-id']).toBe('request_771');
      const command = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(command).toEqual({
        workspaceId,
        confirmationId: 'confirmation_771',
        confirmationVersion: 3
      });
      const envelope = JSON.parse(
        Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as { principal: WorkspacePrincipal };
      expect(envelope.principal).toMatchObject({ workspaceId });
      expect(command.workspaceId).toBe(envelope.principal.workspaceId);
      return response(200, {
        matterDraft: { matterDraftId: 'matter-draft_771', workspaceId, version: 1 }
      });
    });
    vi.stubGlobal('fetch', downstream);

    const result = await governedRoute().handle(
      request({ confirmationId: 'confirmation_771', confirmationVersion: 3 })
    );

    expect(result.status).toBe(200);
    expect(result.headers).toEqual({ 'x-correlation-id': 'correlation_771' });
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('accepts a matching legacy browser Workspace only as a consistency assertion', async () => {
    const downstream = vi.fn((_url: string, init: RequestInit) => {
      const command = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(command.workspaceId).toBe(workspaceId);
      return response(200, { matterDraft: { matterDraftId: 'matter-draft_771' } });
    });
    vi.stubGlobal('fetch', downstream);

    const result = await governedRoute().handle(
      request({
        workspaceId,
        confirmationId: 'confirmation_771',
        confirmationVersion: 3
      })
    );

    expect(result.status).toBe(200);
  });

  it('rejects conflicting browser Workspace authority before downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      governedRoute().handle(
        request({
          workspaceId: otherWorkspaceId,
          confirmationId: 'confirmation_771',
          confirmationVersion: 3
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires the exact Customer Confirmation identity and version', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      governedRoute().handle(request({ confirmationId: 'confirmation_771' }))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(downstream).not.toHaveBeenCalled();
  });
});
