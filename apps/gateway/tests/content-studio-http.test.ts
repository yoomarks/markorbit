import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationError, type WorkspacePrincipal } from '@markorbit/contracts';
import { csrfToken } from '../src/auth.js';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '38383838-3838-4383-8383-383838383838';
const otherWorkspaceId = '39393939-3939-4393-8393-393939393939';
const contentOpportunityId = 'content-opportunity_373';
const listPath = '/api/lite/content-studio/works';
const detailPath = `${listPath}/:contentOpportunityId`;
const liteWorkUrl = `http://lite.test/v1/content-studio/works/${contentOpportunityId}`;
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_integration_373',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_integration_373',
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
  internalServiceSecret: 'integration-373-internal-key-0123456789',
  csrfSecret: 'integration-373-csrf-key-01234567890123',
  allowedOrigins: ['https://test.markorbit.local']
};

function route(path: string) {
  const value = createGatewayProductLoopRoutes(options).find(
    (candidate) => candidate.method === 'GET' && candidate.path === path
  );
  if (!value) throw new Error(`GET ${path} route missing`);
  return value;
}

function request(
  path: string,
  headers: Record<string, string>,
  query: Record<string, string> = {},
  params: Record<string, string> = {}
) {
  return { method: 'GET' as const, path, params, query, headers, body: undefined };
}

function jsonResponse(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

function sessionHeaders(targetWorkspaceId = workspaceId): Record<string, string> {
  return {
    cookie: 'mo_session=token-373',
    'x-markorbit-workspace-id': targetWorkspaceId
  };
}

function withoutHeader(headers: Record<string, string>, name: string): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([key]) => key !== name));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Content Studio authenticated read boundary', () => {
  it('forwards list pagination, Principal, Workspace, correlation, and request IDs', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/content-studio/works?limit=25&after=next%2Fpage');
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(
        'integration-373-internal-key-0123456789'
      );
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['x-correlation-id']).toBe('correlation-373');
      expect(headers['x-request-id']).toBe('request-373');
      const encodedPrincipal = headers['x-markorbit-principal'];
      const envelope = JSON.parse(Buffer.from(encodedPrincipal!, 'base64url').toString('utf8')) as {
        principal: WorkspacePrincipal;
      };
      expect(envelope.principal).toMatchObject({
        userId: principal.userId,
        workspaceId,
        membershipId: principal.membershipId
      });
      return jsonResponse(200, {
        schemaVersion: 1,
        workspaceId,
        items: [{ contentOpportunity: { id: contentOpportunityId, version: 1 } }],
        nextAfter: 'next/page',
        partial: true,
        warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
      });
    });
    vi.stubGlobal('fetch', downstream);
    const headers = {
      ...sessionHeaders(),
      'x-correlation-id': 'correlation-373',
      'x-request-id': 'request-373'
    };
    const result = await route(listPath).handle(
      request(listPath, headers, { limit: '25', after: 'next/page' })
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      workspaceId,
      nextAfter: 'next/page',
      partial: true,
      warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
    });
    expect(resolveWorkspace).toHaveBeenCalledWith('token-373', workspaceId, 'correlation-373');
  });

  it('forwards Content Studio detail as a pure authenticated read', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(liteWorkUrl);
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      return jsonResponse(200, {
        schemaVersion: 1,
        workspaceId,
        opportunity: { contentOpportunityId },
        drafts: [],
        reviewedDrafts: [],
        reviews: [],
        publishPackages: [],
        feedback: [],
        partial: true,
        warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
      });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(detailPath).handle(
      request(
        `/api/lite/content-studio/works/${contentOpportunityId}`,
        sessionHeaders(),
        {},
        { contentOpportunityId }
      )
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      workspaceId,
      opportunity: { contentOpportunityId },
      partial: true
    });
  });

  it('requires a Core session before Content Studio downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route(listPath).handle(request(listPath, { 'x-markorbit-workspace-id': workspaceId }))
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    expect(resolveWorkspace).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires exact Workspace context before Content Studio downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route(listPath).handle(request(listPath, { cookie: 'mo_session=token-373' }))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });
    expect(resolveWorkspace).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires workspace:read before Content Studio downstream access', async () => {
    resolveWorkspace.mockResolvedValueOnce({ ...principal, permissions: [] });
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(route(listPath).handle(request(listPath, sessionHeaders()))).rejects.toMatchObject(
      {
        status: 403,
        code: 'PERMISSION_DENIED'
      }
    );
    expect(downstream).not.toHaveBeenCalled();
  });

  it('preserves owner-service 400, 403, 404, and 503 status/body semantics', async () => {
    for (const status of [400, 403, 404, 503]) {
      const body = { code: `LITE_${status}`, marker: `status-${status}` };
      vi.stubGlobal(
        'fetch',
        vi.fn(() => jsonResponse(status, body))
      );
      const result = await route(detailPath).handle(
        request(
          `/api/lite/content-studio/works/${contentOpportunityId}`,
          sessionHeaders(),
          {},
          { contentOpportunityId }
        )
      );
      expect(result.status).toBe(status);
      expect(result.body).toEqual(body);
    }
  });

  it('preserves owner-service 404 isolation for work in another Workspace', async () => {
    resolveWorkspace.mockResolvedValueOnce({ ...principal, workspaceId: otherWorkspaceId });
    const downstream = vi.fn((_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-workspace-id']).toBe(otherWorkspaceId);
      return jsonResponse(404, { code: 'CONTENT_WORK_NOT_FOUND' });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(detailPath).handle(
      request(
        `/api/lite/content-studio/works/${contentOpportunityId}`,
        sessionHeaders(otherWorkspaceId),
        {},
        { contentOpportunityId }
      )
    );

    expect(resolveWorkspace).toHaveBeenCalledWith('token-373', otherWorkspaceId, undefined);
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ code: 'CONTENT_WORK_NOT_FOUND' });
  });

  it('turns Lite transport failure into 503 without fabricating an empty result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Lite offline')))
    );
    await expect(route(listPath).handle(request(listPath, sessionHeaders()))).rejects.toMatchObject(
      {
        status: 503,
        code: 'DOWNSTREAM_UNAVAILABLE'
      }
    );
  });

  it('registers only the two requested Content Studio read routes', () => {
    const studioRoutes = createGatewayProductLoopRoutes(options)
      .filter((candidate) => candidate.method === 'GET' && candidate.path.startsWith(listPath))
      .map((candidate) => `${candidate.method} ${candidate.path}`);
    expect(studioRoutes).toEqual([`GET ${listPath}`, `GET ${detailPath}`]);
  });
});

// prettier-ignore
describe('Gateway Content Studio governed preparation mutation boundary', () => {
  const contentDraftId = 'content-draft_540';
  const mutationCases = [
    {
      name: 'create draft',
      routePath: '/api/lite/content-studio/works/:contentOpportunityId/drafts',
      browserPath: `/api/lite/content-studio/works/${contentOpportunityId}/drafts`,
      litePath: `/v1/content-studio/works/${contentOpportunityId}/drafts`,
      params: { contentOpportunityId },
      body: {
        contentOpportunityVersion: 3,
        expectedContentOpportunityFingerprintSha256: 'a'.repeat(64),
        title: 'Draft title',
        body: 'Draft body'
      }
    },
    {
      name: 'revise draft',
      routePath: '/api/lite/content-drafts/:contentDraftId/revisions',
      browserPath: `/api/lite/content-drafts/${contentDraftId}/revisions`,
      litePath: `/v1/content-drafts/${contentDraftId}/revisions`,
      params: { contentDraftId },
      body: {
        expectedVersion: 4,
        expectedContentDraftFingerprintSha256: 'b'.repeat(64),
        title: 'Revised title',
        body: 'Revised body'
      }
    },
    {
      name: 'ready for review',
      routePath: '/api/lite/content-drafts/:contentDraftId/ready-for-review',
      browserPath: `/api/lite/content-drafts/${contentDraftId}/ready-for-review`,
      litePath: `/v1/content-drafts/${contentDraftId}/ready-for-review`,
      params: { contentDraftId },
      body: {
        expectedVersion: 5,
        expectedContentDraftFingerprintSha256: 'c'.repeat(64)
      }
    },
    {
      name: 'record review',
      routePath: '/api/lite/content-drafts/:contentDraftId/reviews',
      browserPath: `/api/lite/content-drafts/${contentDraftId}/reviews`,
      litePath: `/v1/content-drafts/${contentDraftId}/reviews`,
      params: { contentDraftId },
      body: {
        contentDraftVersion: 6,
        expectedContentDraftFingerprintSha256: 'd'.repeat(64),
        outcome: 'APPROVED',
        rationale: 'Ready for governed publish-package preparation.'
      }
    },
    {
      name: 'prepare publish package',
      routePath: '/api/lite/content-drafts/:contentDraftId/publish-packages',
      browserPath: `/api/lite/content-drafts/${contentDraftId}/publish-packages`,
      litePath: `/v1/content-drafts/${contentDraftId}/publish-packages`,
      params: { contentDraftId },
      body: {
        contentDraftVersion: 6,
        expectedContentDraftFingerprintSha256: 'e'.repeat(64),
        reviewDecisionId: 'content-review-decision_540',
        reviewDecisionVersion: 1
      }
    }
  ] as const;

  const mutationRoute = (path: string) => {
    const value = createGatewayProductLoopRoutes(options).find(
      (candidate) => candidate.method === 'POST' && candidate.path === path
    );
    if (!value) throw new Error(`POST ${path} route missing`);
    return value;
  };

  const mutationHeaders = (overrides: Record<string, string> = {}) => ({
    ...sessionHeaders(),
    origin: options.allowedOrigins[0]!,
    'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
    'idempotency-key': 'content-studio-idempotency-540',
    'x-correlation-id': 'correlation-540',
    'x-request-id': 'request-540',
    ...overrides
  });

  const mutationRequest = (
    path: string,
    body: Record<string, unknown>,
    headers: Record<string, string>,
    params: Record<string, string>
  ) => ({ method: 'POST' as const, path, params, query: {}, headers, body });

  it('registers the existing two GETs plus exactly five governed Content Studio POSTs', () => {
    const studioRoutes = createGatewayProductLoopRoutes(options)
      .filter(
        (candidate) =>
          candidate.path.startsWith('/api/lite/content-studio/') ||
          candidate.path.startsWith('/api/lite/content-drafts/')
      )
      .map((candidate) => `${candidate.method} ${candidate.path}`);
    expect(studioRoutes).toEqual([
      `GET ${listPath}`,
      `GET ${detailPath}`,
      'POST /api/lite/content-studio/works/:contentOpportunityId/drafts',
      'POST /api/lite/content-drafts/:contentDraftId/revisions',
      'POST /api/lite/content-drafts/:contentDraftId/ready-for-review',
      'POST /api/lite/content-drafts/:contentDraftId/reviews',
      'POST /api/lite/content-drafts/:contentDraftId/publish-packages'
    ]);
  });

  it.each(mutationCases)(
    'forwards $name through trusted Principal, Workspace and mutation headers',
    async ({ routePath, browserPath, litePath, params, body }) => {
      const downstream = vi.fn((url: string, init: RequestInit) => {
        expect(url).toBe(`http://lite.test${litePath}`);
        expect(init.method).toBe('POST');
        if (typeof init.body !== 'string') throw new Error('Expected JSON string request body.');
        expect(JSON.parse(init.body)).toEqual(body);
        const headers = init.headers as Record<string, string>;
        expect(headers['x-markorbit-internal-authorization']).toBe(options.internalServiceSecret);
        expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
        expect(headers['idempotency-key']).toBe('content-studio-idempotency-540');
        expect(headers['x-correlation-id']).toBe('correlation-540');
        expect(headers['x-request-id']).toBe('request-540');
        const envelope = JSON.parse(
          Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
        ) as { principal: WorkspacePrincipal };
        expect(envelope.principal).toMatchObject({
          userId: principal.userId,
          workspaceId,
          membershipId: principal.membershipId
        });
        expect(envelope.principal).not.toHaveProperty('reviewerPrincipalId');
        return jsonResponse(201, { schemaVersion: 1, accepted: true });
      });
      vi.stubGlobal('fetch', downstream);
      const result = await mutationRoute(routePath).handle(
        mutationRequest(browserPath, { ...body }, mutationHeaders(), { ...params })
      );
      expect(result.status).toBe(201);
      expect(result.body).toEqual({ schemaVersion: 1, accepted: true });
      expect(downstream).toHaveBeenCalledTimes(1);
    }
  );

  it.each(mutationCases)(
    'fails $name before Lite when the session is missing',
    async ({ routePath, browserPath, params, body }) => {
      const downstream = vi.fn();
      vi.stubGlobal('fetch', downstream);
      const headers = withoutHeader(mutationHeaders(), 'cookie');
      await expect(
        mutationRoute(routePath).handle(
          mutationRequest(browserPath, { ...body }, headers, { ...params })
        )
      ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
      expect(downstream).not.toHaveBeenCalled();
    }
  );

  it('fails before Lite when Workspace context is missing or Core denies Workspace membership', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const first = mutationCases[0];
    const missingHeaders = withoutHeader(mutationHeaders(), 'x-markorbit-workspace-id');
    await expect(
      mutationRoute(first.routePath).handle(
        mutationRequest(first.browserPath, { ...first.body }, missingHeaders, { ...first.params })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });

    resolveWorkspace.mockRejectedValueOnce(
      new AuthenticationError('MEMBERSHIP_REQUIRED', 'Workspace membership is required.')
    );
    await expect(
      mutationRoute(first.routePath).handle(
        mutationRequest(
          first.browserPath,
          { ...first.body },
          mutationHeaders({ 'x-markorbit-workspace-id': otherWorkspaceId }),
          { ...first.params }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'MEMBERSHIP_REQUIRED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('fails before Lite when matter:manage is missing', async () => {
    const first = mutationCases[0];
    resolveWorkspace.mockResolvedValueOnce({ ...principal, permissions: ['workspace:read'] });
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      mutationRoute(first.routePath).handle(
        mutationRequest(first.browserPath, { ...first.body }, mutationHeaders(), { ...first.params })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('fails before Lite for untrusted Origin, invalid CSRF, and missing idempotency', async () => {
    const first = mutationCases[0];
    const failureCases = [
      {
        headers: mutationHeaders({ origin: 'https://evil.example' }),
        status: 403,
        code: 'UNTRUSTED_ORIGIN'
      },
      {
        headers: withoutHeader(mutationHeaders(), 'x-markorbit-csrf-token'),
        status: 403,
        code: 'INVALID_CSRF_TOKEN'
      },
      {
        headers: mutationHeaders({ 'x-markorbit-csrf-token': 'invalid' }),
        status: 403,
        code: 'INVALID_CSRF_TOKEN'
      },
      {
        headers: withoutHeader(mutationHeaders(), 'idempotency-key'),
        status: 400,
        code: 'INVALID_REQUEST'
      }
    ] as const;
    for (const failure of failureCases) {
      const downstream = vi.fn();
      vi.stubGlobal('fetch', downstream);
      await expect(
        mutationRoute(first.routePath).handle(
          mutationRequest(first.browserPath, { ...first.body }, failure.headers, { ...first.params })
        )
      ).rejects.toMatchObject({ status: failure.status, code: failure.code });
      expect(downstream).not.toHaveBeenCalled();
    }
  });

  it.each(['reviewerPrincipalId', 'actorId', 'userId', 'membershipId'])(
    'rejects browser actor spoof field %s before Lite',
    async (field) => {
      const review = mutationCases[3];
      const downstream = vi.fn();
      vi.stubGlobal('fetch', downstream);
      await expect(
        mutationRoute(review.routePath).handle(
          mutationRequest(
            review.browserPath,
            { ...review.body, [field]: 'spoofed-browser-authority' },
            mutationHeaders(),
            { ...review.params }
          )
        )
      ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
      expect(downstream).not.toHaveBeenCalled();
    }
  );

  it('preserves Lite mutation status/body semantics and transport failure', async () => {
    const first = mutationCases[0];
    for (const status of [400, 403, 404, 409, 422, 503]) {
      const body = { code: `LITE_MUTATION_${status}`, marker: `status-${status}` };
      vi.stubGlobal(
        'fetch',
        vi.fn(() => jsonResponse(status, body))
      );
      const result = await mutationRoute(first.routePath).handle(
        mutationRequest(first.browserPath, { ...first.body }, mutationHeaders(), { ...first.params })
      );
      expect(result.status).toBe(status);
      expect(result.body).toEqual(body);
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Lite offline')))
    );
    await expect(
      mutationRoute(first.routePath).handle(
        mutationRequest(first.browserPath, { ...first.body }, mutationHeaders(), { ...first.params })
      )
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
  });
});
