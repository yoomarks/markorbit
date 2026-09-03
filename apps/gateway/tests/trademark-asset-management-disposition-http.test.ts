import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '27272727-2727-4272-8272-272727272727';
const otherWorkspaceId = '28282828-2828-4282-8282-282828282828';
const assetId = 'trademark-asset_management-1';
const routePath = '/api/lite/trademark-assets/:trademarkAssetId/management-dispositions';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_management_disposition_gateway',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_management_disposition_gateway',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
};

const resolveWorkspace = vi.fn(() => Promise.resolve(principal));
const auth: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('issue is not expected in this test')),
  resolve: () => Promise.reject(new Error('resolve is not expected in this test')),
  resolveWorkspace,
  revoke: () => Promise.resolve()
};

const options = {
  liteUrl: 'http://lite.test',
  authenticationClient: auth,
  internalServiceSecret: 'management-disposition-internal-key-0123456789',
  csrfSecret: 'management-disposition-csrf-key-01234567890123',
  allowedOrigins: ['https://test.markorbit.local']
};

function route(method: 'GET' | 'POST') {
  const matches = createGatewayProductLoopRoutes(options).filter(
    (candidate) => candidate.method === method && candidate.path === routePath
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    cookie: 'mo_session=token',
    'x-markorbit-workspace-id': workspaceId,
    ...extra
  };
}

function request(
  method: 'GET' | 'POST',
  input: {
    headers?: Record<string, string>;
    body?: unknown;
    query?: Record<string, string>;
  } = {}
) {
  return {
    method,
    path: `/api/lite/trademark-assets/${assetId}/management-dispositions`,
    params: { trademarkAssetId: assetId },
    query: input.query ?? {},
    headers: input.headers ?? headers(),
    body: input.body
  } as const;
}

function mutationHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return headers({
    origin: 'https://test.markorbit.local',
    'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
    'idempotency-key': 'management-disposition-1',
    ...extra
  });
}

function mutationBody(kind = 'DISMISSED'): Record<string, unknown> {
  return {
    expectedTrademarkAssetVersion: 7,
    managementSignal: { id: 'trademark-asset-management-signal_1', version: 3 },
    recommendation: { id: 'trademark-asset-management-recommendation_1', version: 2 },
    kind,
    note: 'Private portfolio management choice.'
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Trademark Asset management disposition boundary', () => {
  it('registers the exact GET and POST routes once', () => {
    route('GET');
    route('POST');
  });

  it('uses authenticated read transport for GET, forwards only path identity and trusted headers, and preserves owner projection', async () => {
    const ownerProjection = {
      schemaVersion: 1,
      workspaceId,
      asset: { id: assetId, version: 7 },
      items: [
        {
          signal: { id: 'signal_1', version: 1 },
          disposition: { kind: 'DISMISSED', dispositionId: 'disposition_1' }
        },
        {
          signal: { id: 'signal_2', version: 2 },
          disposition: { kind: 'CONTINUED', dispositionId: 'disposition_2' }
        },
        { signal: { id: 'signal_3', version: 1 }, disposition: null },
        {
          signal: { id: 'signal_4', version: 4 },
          disposition: {
            kind: 'RESOLVED_BY_WORKFLOW_REFERENCE',
            dispositionId: 'disposition_owner_governed_1',
            workflowReference: { kind: 'FORMAL_MATTER', id: 'matter_1', version: 1 }
          }
        }
      ]
    };
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(`http://lite.test/v1/trademark-assets/${assetId}/management-dispositions`);
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      const forwarded = init.headers as Record<string, string>;
      expect(forwarded['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(forwarded['x-markorbit-internal-authorization']).toBe(options.internalServiceSecret);
      expect(forwarded['x-markorbit-principal']).toBeTruthy();
      expect(forwarded).not.toHaveProperty('idempotency-key');
      return Promise.resolve(
        new Response(JSON.stringify(ownerProjection), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('GET').handle(
      request('GET', {
        headers: headers({ 'idempotency-key': 'must-not-forward' }),
        query: { workspaceId: otherWorkspaceId, authority: 'attacker' }
      })
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual(ownerProjection);
    expect(resolveWorkspace).toHaveBeenCalledWith('token', workspaceId, undefined);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthenticated GET before Lite and needs no Origin, CSRF, or Idempotency-Key', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      route('GET').handle(
        request('GET', {
          headers: { 'x-markorbit-workspace-id': workspaceId }
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it.each(['WATCHED', 'DEFERRED', 'DISMISSED', 'CONTINUED']) (
    'forwards browser disposition %s through durable mutation protocol without adding authority',
    async (kind) => {
      const body = mutationBody(kind);
      const downstream = vi.fn((url: string, init: RequestInit) => {
        expect(url).toBe(`http://lite.test/v1/trademark-assets/${assetId}/management-dispositions`);
        expect(init.method).toBe('POST');
        const forwardedHeaders = init.headers as Record<string, string>;
        expect(forwardedHeaders['idempotency-key']).toBe('management-disposition-1');
        expect(forwardedHeaders['x-markorbit-workspace-id']).toBe(workspaceId);
        expect(JSON.parse(init.body as string)).toEqual(body);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              workspaceId,
              asset: { id: assetId, version: 7 },
              disposition: { kind },
              protectedActionAuthorized: false,
              filingAuthorized: false,
              paymentAuthorized: false,
              publicationAuthorized: false
            }),
            { status: 201, headers: { 'content-type': 'application/json' } }
          )
        );
      });
      vi.stubGlobal('fetch', downstream);

      const result = await route('POST').handle(
        request('POST', { headers: mutationHeaders(), body })
      );

      expect(result.status).toBe(201);
      expect(downstream).toHaveBeenCalledTimes(1);
    }
  );

  it('requires trusted Origin, CSRF and Idempotency-Key for POST before Lite', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      route('POST').handle(
        request('POST', {
          headers: headers({
            origin: 'https://test.markorbit.local',
            'idempotency-key': 'management-disposition-1'
          }),
          body: mutationBody()
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });

    await expect(
      route('POST').handle(
        request('POST', {
          headers: headers({
            origin: 'https://test.markorbit.local',
            'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret)
          }),
          body: mutationBody()
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });

    expect(downstream).not.toHaveBeenCalled();
  });

  it('forbids workflow-resolved disposition creation and injected identity, source, or authority fields before Lite', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      route('POST').handle(
        request('POST', {
          headers: mutationHeaders(),
          body: mutationBody('RESOLVED_BY_WORKFLOW_REFERENCE')
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });

    for (const extra of [
      { workflowReference: { kind: 'FORMAL_MATTER', id: 'matter_1', version: 1 } },
      { source: { official: true } },
      { officialTruth: { id: 'truth_1' } },
      { provider: { id: 'provider_1' } },
      { workspaceId },
      { subjectUserId: 'attacker' }
    ]) {
      await expect(
        route('POST').handle(
          request('POST', {
            headers: mutationHeaders(),
            body: { ...mutationBody(), ...extra }
          })
        )
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects cross-Workspace mutation context and permission failure before Lite', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      route('POST').handle(
        request('POST', {
          headers: mutationHeaders(),
          body: { ...mutationBody(), workspaceId: otherWorkspaceId }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });

    const readOnlyPrincipal: WorkspacePrincipal = {
      ...principal,
      permissions: ['workspace:read']
    };
    const readOnlyAuth: CoreAuthenticationClient = {
      ...auth,
      resolveWorkspace: () => Promise.resolve(readOnlyPrincipal)
    };
    const post = createGatewayProductLoopRoutes({ ...options, authenticationClient: readOnlyAuth }).find(
      (candidate) => candidate.method === 'POST' && candidate.path === routePath
    )!;
    await expect(
      post.handle(request('POST', { headers: mutationHeaders(), body: mutationBody() }))
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });

    expect(downstream).not.toHaveBeenCalled();
  });

  it('maps Lite transport failure to retryable 503 and keeps durability/idempotency owner-side', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('lite unavailable'))));

    await expect(
      route('POST').handle(
        request('POST', { headers: mutationHeaders(), body: mutationBody('WATCHED') })
      )
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE', retryable: true });
  });
});
