import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '29292929-2929-4292-8292-292929292929';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_m9_wp06_gateway',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_m9_wp06_gateway',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
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
  internalServiceSecret: 'm9-wp06-gateway-internal-key-0123456789',
  csrfSecret: 'm9-wp06-gateway-csrf-key-01234567890123',
  allowedOrigins: ['https://test.markorbit.local']
};

function route(method: string, path: string) {
  const found = createGatewayProductLoopRoutes(options).find(
    (candidate) => candidate.method === method && candidate.path === path
  );
  if (!found) throw new Error(`route ${method} ${path} missing`);
  return found;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Daily Workspace boundary', () => {
  it('forwards Daily Orbit reads with the authenticated Workspace Principal', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/daily-orbit');
      expect(init.method).toBe('GET');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      const encoded = headers['x-markorbit-principal'];
      expect(encoded).toBeTruthy();
      const envelope = JSON.parse(Buffer.from(encoded!, 'base64url').toString('utf8')) as {
        principal: WorkspacePrincipal;
      };
      expect(envelope.principal).toMatchObject({
        userId: principal.userId,
        workspaceId: principal.workspaceId
      });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            workspaceId,
            subjectUserId: principal.userId,
            items: [],
            contentPicks: [],
            partial: false,
            warnings: [],
            executionAuthorized: false,
            legalTruthVerified: false
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('GET', '/api/lite/daily-orbit').handle({
      method: 'GET',
      path: '/api/lite/daily-orbit',
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
  });

  it('forwards exact Content Kit reads without mutation authority', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/content-kits/content-pick_1');
      expect(init.method).toBe('GET');
      return Promise.resolve(
        new Response(JSON.stringify({ contentKitId: 'content-kit_1', workspaceId }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('GET', '/api/lite/content-kits/:contentPickId').handle({
      method: 'GET',
      path: '/api/lite/content-kits/content-pick_1',
      params: { contentPickId: 'content-pick_1' },
      query: {},
      headers: {
        cookie: 'mo_session=token',
        'x-markorbit-workspace-id': workspaceId
      },
      body: undefined
    });

    expect(result.status).toBe(200);
  });

  it('requires governed mutation headers before Visual Brief creation', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/content-kits/content-pick_1/visual-briefs');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers['idempotency-key']).toBe('visual-brief-ui-1');
      return Promise.resolve(
        new Response(
          JSON.stringify({
            brief: {
              visualBriefId: 'visual-brief_1',
              workspaceId,
              version: 1,
              reuseFirstRequired: true,
              paidExecutionAuthorized: false
            }
          }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route(
      'POST',
      '/api/lite/content-kits/:contentPickId/visual-briefs'
    ).handle({
      method: 'POST',
      path: '/api/lite/content-kits/content-pick_1/visual-briefs',
      params: { contentPickId: 'content-pick_1' },
      query: {},
      headers: {
        cookie: 'mo_session=token',
        origin: 'https://test.markorbit.local',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
        'idempotency-key': 'visual-brief-ui-1'
      },
      body: {
        workspaceId,
        expectedContentKitId: 'content-kit_1',
        expectedContentKitVersion: 1,
        requestedIpPackage: 'MOKI',
        outputKind: 'XIAOHONGSHU_COVER',
        sceneIntent: 'MOKI explains the update.'
      }
    });

    expect(result.status).toBe(201);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('rejects Visual mutations without CSRF before forwarding', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      route('POST', '/api/lite/content-kits/:contentPickId/visual-briefs').handle({
        method: 'POST',
        path: '/api/lite/content-kits/content-pick_1/visual-briefs',
        params: { contentPickId: 'content-pick_1' },
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId,
          'idempotency-key': 'visual-brief-ui-2'
        },
        body: {
          workspaceId,
          expectedContentKitId: 'content-kit_1',
          expectedContentKitVersion: 1,
          requestedIpPackage: 'MOKI',
          outputKind: 'XIAOHONGSHU_COVER',
          sceneIntent: 'MOKI explains the update.'
        }
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(downstream).not.toHaveBeenCalled();
  });
});
