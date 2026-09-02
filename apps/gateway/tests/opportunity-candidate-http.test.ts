import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationError, type WorkspacePrincipal } from '@markorbit/contracts';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { csrfToken } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '36363636-3636-4363-8363-363636363636';
const otherWorkspaceId = '37373737-3737-4373-8373-373737373737';
const candidateId = 'opportunity-candidate_366';
const listPath = '/api/lite/opportunity-candidates';
const detailPath = '/api/lite/opportunity-candidates/:opportunityCandidateId';
const qualificationPath = `${detailPath}/qualification`;
const liteCandidateUrl = `http://lite.test/v1/opportunity-candidates/${candidateId}`;
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_integration_366',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_integration_366',
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
  internalServiceSecret: 'integration-366-internal-key-0123456789',
  csrfSecret: 'integration-366-csrf-key-01234567890123',
  allowedOrigins: ['https://test.markorbit.local']
};

function route(path: string) {
  const value = createGatewayProductLoopRoutes(options).find(
    (candidate) => candidate.method === 'GET' && candidate.path === path
  );
  if (!value) throw new Error(`GET ${path} route missing`);
  return value;
}

function mutationRoute(path = qualificationPath) {
  const matches = createGatewayProductLoopRoutes(options).filter(
    (candidate) => candidate.method === 'POST' && candidate.path === path
  );
  if (!matches[0]) throw new Error(`POST ${path} route missing`);
  return { matches, route: matches[0] };
}

function request(
  path: string,
  headers: Record<string, string>,
  query: Record<string, string> = {},
  params: Record<string, string> = {}
) {
  return { method: 'GET' as const, path, params, query, headers, body: undefined };
}

function postRequest(
  path: string,
  body: unknown,
  headers: Record<string, string>,
  params: Record<string, string> = {}
) {
  return { method: 'POST' as const, path, params, query: {}, headers, body };
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
    cookie: 'mo_session=token-366',
    'x-markorbit-workspace-id': targetWorkspaceId
  };
}

function mutationHeaders(
  extras: Record<string, string> = {},
  targetWorkspaceId = workspaceId
): Record<string, string> {
  return {
    ...sessionHeaders(targetWorkspaceId),
    origin: 'https://test.markorbit.local',
    'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
    'idempotency-key': 'qualification-366',
    ...extras
  };
}

function qualificationBody() {
  return {
    candidateVersion: 3,
    expectedCandidateFingerprintSha256: 'a'.repeat(64),
    outcome: 'QUALIFIED_FOR_MARKREG',
    rationale: 'Human reviewed the candidate and explicitly qualified it.'
  };
}

function qualificationRequest(
  body: unknown = qualificationBody(),
  headers: Record<string, string> = mutationHeaders()
) {
  return postRequest(
    `/api/lite/opportunity-candidates/${candidateId}/qualification`,
    body,
    headers,
    { opportunityCandidateId: candidateId }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Opportunity Candidate authenticated read boundary', () => {
  it('forwards list pagination, Principal, Workspace, correlation, and request IDs', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/opportunity-candidates?limit=25&cursor=next%2Fpage');
      expect(init.method).toBe('GET');
      return jsonResponse(200, {
        schemaVersion: 1,
        workspaceId,
        items: [{ opportunityCandidateId: candidateId }],
        nextCursor: 'next/page'
      });
    });
    vi.stubGlobal('fetch', downstream);
    const headers = {
      ...sessionHeaders(),
      'x-correlation-id': 'correlation-366',
      'x-request-id': 'request-366'
    };
    const result = await route(listPath).handle(
      request(listPath, headers, { limit: '25', cursor: 'next/page' })
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ workspaceId, nextCursor: 'next/page' });
    expect(resolveWorkspace).toHaveBeenCalledWith('token-366', workspaceId, 'correlation-366');
    const init = downstream.mock.calls[0]?.[1] as RequestInit;
    const forwarded = init.headers as Record<string, string>;
    expect(forwarded['x-markorbit-internal-authorization']).toBe(
      'integration-366-internal-key-0123456789'
    );
    expect(forwarded['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(forwarded['x-correlation-id']).toBe('correlation-366');
    expect(forwarded['x-request-id']).toBe('request-366');
    const envelope = JSON.parse(
      Buffer.from(forwarded['x-markorbit-principal']!, 'base64url').toString('utf8')
    ) as { principal: WorkspacePrincipal };
    expect(envelope.principal).toMatchObject({
      userId: principal.userId,
      workspaceId,
      membershipId: principal.membershipId
    });
  });

  it('forwards Candidate detail as a pure authenticated read', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(liteCandidateUrl);
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      return jsonResponse(200, {
        schemaVersion: 1,
        workspaceId,
        opportunityCandidateId: candidateId
      });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(detailPath).handle(
      request(
        `/api/lite/opportunity-candidates/${candidateId}`,
        sessionHeaders(),
        {},
        { opportunityCandidateId: candidateId }
      )
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ workspaceId, opportunityCandidateId: candidateId });
  });

  it('forwards Candidate Qualification as a pure authenticated read', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(`${liteCandidateUrl}/qualification`);
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      return jsonResponse(200, {
        schemaVersion: 1,
        workspaceId,
        opportunityCandidateId: candidateId,
        qualification: { status: 'QUALIFIED' }
      });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(qualificationPath).handle(
      request(
        `/api/lite/opportunity-candidates/${candidateId}/qualification`,
        sessionHeaders(),
        {},
        { opportunityCandidateId: candidateId }
      )
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      workspaceId,
      opportunityCandidateId: candidateId,
      qualification: { status: 'QUALIFIED' }
    });
  });

  it('requires a Core session before Candidate downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route(listPath).handle(request(listPath, { 'x-markorbit-workspace-id': workspaceId }))
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    expect(resolveWorkspace).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires exact Workspace context before Candidate downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route(listPath).handle(request(listPath, { cookie: 'mo_session=token-366' }))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });
    expect(resolveWorkspace).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires workspace:read before Candidate downstream access', async () => {
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
          `/api/lite/opportunity-candidates/${candidateId}`,
          sessionHeaders(),
          {},
          { opportunityCandidateId: candidateId }
        )
      );
      expect(result.status).toBe(status);
      expect(result.body).toEqual(body);
    }
  });

  it('preserves owner-service 404 isolation for a Candidate in another Workspace', async () => {
    resolveWorkspace.mockResolvedValueOnce({ ...principal, workspaceId: otherWorkspaceId });
    const downstream = vi.fn((_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-workspace-id']).toBe(otherWorkspaceId);
      return jsonResponse(404, { code: 'OPPORTUNITY_CANDIDATE_NOT_FOUND' });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(detailPath).handle(
      request(
        `/api/lite/opportunity-candidates/${candidateId}`,
        sessionHeaders(otherWorkspaceId),
        {},
        { opportunityCandidateId: candidateId }
      )
    );

    expect(resolveWorkspace).toHaveBeenCalledWith('token-366', otherWorkspaceId, undefined);
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ code: 'OPPORTUNITY_CANDIDATE_NOT_FOUND' });
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
});

describe('#575 Gateway explicit human Opportunity Qualification mutation boundary', () => {
  it('registers exactly once and forwards the exact durable owner command with trusted context', async () => {
    const disposition = {
      decision: {
        outcome: 'QUALIFIED_FOR_MARKREG',
        decidedByPrincipalId: principal.userId,
        rationale: qualificationBody().rationale,
        formalOpportunityCreated: false,
        customerContacted: false
      },
      currentCandidate: {
        opportunityCandidateId: candidateId,
        version: 4,
        status: 'DISPOSITIONED',
        formalOpportunityCreated: false,
        customerContacted: false
      }
    };
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(`${liteCandidateUrl}/qualification`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(qualificationBody());
      const forwarded = init.headers as Record<string, string>;
      expect(forwarded['x-markorbit-internal-authorization']).toBe(options.internalServiceSecret);
      expect(forwarded['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(forwarded['idempotency-key']).toBe('qualification-366');
      expect(forwarded['x-correlation-id']).toBe('correlation-qualification-366');
      expect(forwarded['x-request-id']).toBe('request-qualification-366');
      expect(forwarded).not.toHaveProperty('cookie');
      const envelope = JSON.parse(
        Buffer.from(forwarded['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as { principal: WorkspacePrincipal };
      expect(envelope.principal).toMatchObject({
        userId: principal.userId,
        workspaceId,
        membershipId: principal.membershipId
      });
      return jsonResponse(201, disposition);
    });
    vi.stubGlobal('fetch', downstream);

    const h = mutationRoute();
    expect(h.matches).toHaveLength(1);
    const result = await h.route.handle(
      qualificationRequest(
        qualificationBody(),
        mutationHeaders({
          'x-correlation-id': 'correlation-qualification-366',
          'x-request-id': 'request-qualification-366'
        })
      )
    );

    expect(resolveWorkspace).toHaveBeenCalledWith(
      'token-366',
      workspaceId,
      'correlation-qualification-366'
    );
    expect(result).toEqual({ status: 201, body: disposition });
    expect(result.body).toMatchObject({
      decision: { formalOpportunityCreated: false, customerContacted: false },
      currentCandidate: { formalOpportunityCreated: false, customerContacted: false }
    });
  });

  it('requires authenticated Core membership and matter:manage before Lite access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const h = mutationRoute();

    await expect(
      h.route.handle(
        qualificationRequest(qualificationBody(), {
          ...mutationHeaders(),
          cookie: ''
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });

    resolveWorkspace.mockRejectedValueOnce(
      new AuthenticationError('MEMBERSHIP_REQUIRED', 'Workspace membership is required.')
    );
    await expect(h.route.handle(qualificationRequest())).rejects.toMatchObject({
      status: 403,
      code: 'MEMBERSHIP_REQUIRED'
    });

    resolveWorkspace.mockResolvedValueOnce({ ...principal, permissions: ['workspace:read'] });
    await expect(h.route.handle(qualificationRequest())).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });

    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires authoritative Workspace, trusted Origin, valid CSRF, and Idempotency-Key', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const h = mutationRoute();

    const missingWorkspace = mutationHeaders();
    delete missingWorkspace['x-markorbit-workspace-id'];
    await expect(
      h.route.handle(qualificationRequest(qualificationBody(), missingWorkspace))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });

    await expect(
      h.route.handle(
        qualificationRequest(
          qualificationBody(),
          mutationHeaders({ origin: 'https://attacker.example' })
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'UNTRUSTED_ORIGIN' });

    await expect(
      h.route.handle(
        qualificationRequest(
          qualificationBody(),
          mutationHeaders({ 'x-markorbit-csrf-token': 'invalid' })
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });

    const missingIdempotency = mutationHeaders();
    delete missingIdempotency['idempotency-key'];
    await expect(
      h.route.handle(qualificationRequest(qualificationBody(), missingIdempotency))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });

    expect(downstream).not.toHaveBeenCalled();
  });

  it.each([
    'workspaceId',
    'decidedByPrincipalId',
    'actorId',
    'userId',
    'principalId',
    'membershipId'
  ])('rejects browser authority spoof field %s before Lite', async (field) => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const h = mutationRoute();
    await expect(
      h.route.handle(
        qualificationRequest({
          ...qualificationBody(),
          [field]: field === 'workspaceId' ? workspaceId : 'spoofed-authority'
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it.each([400, 404, 409, 422, 503])(
    'preserves exact owner %i status/body without manufacturing fallback state',
    async (status) => {
      const body = { code: `OWNER_${status}`, details: { exact: true, status } };
      vi.stubGlobal(
        'fetch',
        vi.fn(() => jsonResponse(status, body))
      );
      const result = await mutationRoute().route.handle(qualificationRequest());
      expect(result).toEqual({ status, body });
    }
  );

  it('maps Lite transport failure to DOWNSTREAM_UNAVAILABLE 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Lite offline')))
    );
    await expect(mutationRoute().route.handle(qualificationRequest())).rejects.toMatchObject({
      status: 503,
      code: 'DOWNSTREAM_UNAVAILABLE'
    });
  });

  it('does not change the existing durable POST workspace-body convention', async () => {
    const feedbackPath = '/api/lite/publish-packages/:publishPackageId/use-feedback';
    const concretePath = '/api/lite/publish-packages/publish-package_366/use-feedback';
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/publish-packages/publish-package_366/use-feedback');
      expect(JSON.parse(init.body as string)).toEqual({
        workspaceId,
        publishPackageVersion: 1,
        expectedPublishPackageFingerprintSha256: 'b'.repeat(64),
        outcome: 'USER_REPORTED_USED'
      });
      return jsonResponse(201, { preserved: true });
    });
    vi.stubGlobal('fetch', downstream);
    const feedback = mutationRoute(feedbackPath);
    expect(feedback.matches).toHaveLength(1);
    const result = await feedback.route.handle(
      postRequest(
        concretePath,
        {
          workspaceId,
          publishPackageVersion: 1,
          expectedPublishPackageFingerprintSha256: 'b'.repeat(64),
          outcome: 'USER_REPORTED_USED'
        },
        mutationHeaders({ 'idempotency-key': 'feedback-preserved-366' }),
        { publishPackageId: 'publish-package_366' }
      )
    );
    expect(result).toEqual({ status: 201, body: { preserved: true } });
  });

  it('keeps the three Candidate GET routes unchanged and adds only the requested POST route', () => {
    const candidateRoutes = createGatewayProductLoopRoutes(options)
      .filter((candidate) => candidate.path.startsWith(listPath))
      .map((candidate) => `${candidate.method} ${candidate.path}`);
    expect(candidateRoutes).toEqual([
      `GET ${listPath}`,
      `GET ${detailPath}`,
      `GET ${qualificationPath}`,
      `POST ${qualificationPath}`
    ]);
  });
});
