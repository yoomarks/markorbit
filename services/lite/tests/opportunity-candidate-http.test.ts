import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import {
  LiteCandidateQualificationError,
  PostgresLiteCandidateQualificationStore
} from '../src/candidate-qualification.js';
import { createLiteProductLoopRoutes, type LiteProductLoopRouteOptions } from '../src/http.js';

const secret = 'lite-candidate-read-http-secret-0123456789';
const workspaceId = '99999999-9999-4999-8999-999999999999';
const candidateId = 'opportunity-candidate_read-test';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_candidate_read',
  sessionId: 'session_candidate_read',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_candidate_read',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};
const paths = [
  '/v1/opportunity-candidates',
  '/v1/opportunity-candidates/:opportunityCandidateId',
  '/v1/opportunity-candidates/:opportunityCandidateId/qualification'
] as const;
const qualificationPath = '/v1/opportunity-candidates/:opportunityCandidateId/qualification';
const candidateFingerprint = 'a'.repeat(64);

function harness() {
  const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const transact = vi.fn().mockRejectedValue(new Error('Reads must not transact writes.'));
  const resolve = vi.fn().mockRejectedValue(new Error('Reads must not resolve customer context.'));
  const isAccessible = vi.fn().mockRejectedValue(new Error('No customer relationship authority.'));
  const candidateStore = new PostgresLiteCandidateQualificationStore(
    { transact },
    { query: query as QueryClient['query'] },
    { resolve },
    { isAccessible }
  );
  // Only Candidate routes are invoked; other route dependencies intentionally remain absent.
  const routes = createLiteProductLoopRoutes({
    internalServiceSecret: secret,
    candidateStore
  } as LiteProductLoopRouteOptions);
  return {
    query,
    transact,
    resolve,
    isAccessible,
    read(
      path: string,
      headers: Record<string, string> = {},
      queryParams: Record<string, string> = {}
    ) {
      const route = routes.find((entry) => entry.method === 'GET' && entry.path === path);
      if (!route) throw new Error(`Missing Candidate read route: ${path}`);
      return route.handle({
        method: 'GET',
        path,
        body: undefined,
        params: { opportunityCandidateId: candidateId },
        query: queryParams,
        headers: {
          'x-markorbit-internal-authorization': secret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': workspaceId,
          ...headers
        }
      });
    }
  };
}

describe('Opportunity Candidate authenticated read boundary', () => {
  it('returns an empty page without consulting authorities or writing', async () => {
    const h = harness();
    expect(await h.read(paths[0])).toMatchObject({
      status: 200,
      body: { items: [], nextCursor: null }
    });
    expect(h.transact).not.toHaveBeenCalled();
    expect(h.resolve).not.toHaveBeenCalled();
    expect(h.isAccessible).not.toHaveBeenCalled();
  });

  it('ignores query Workspace spoofing and scopes SQL to the authenticated Principal', async () => {
    const h = harness();
    await h.read(paths[0], {}, { workspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    const parameters = h.query.mock.calls[0]?.[1] as unknown[];
    expect(parameters[0]).toBe(workspaceId);
  });

  it.each(paths)('fails closed before querying %s', async (path) => {
    for (const [headers, status, code] of [
      [{ 'x-markorbit-internal-authorization': '' }, 401, 'UNTRUSTED_INTERNAL_CALLER'],
      [{ 'x-markorbit-principal': '' }, 401, 'INVALID_INTERNAL_PRINCIPAL'],
      [{ 'x-markorbit-principal': 'invalid' }, 401, 'INVALID_INTERNAL_PRINCIPAL'],
      [{ 'x-markorbit-workspace-id': '' }, 404, 'WORKSPACE_MISMATCH'],
      [
        { 'x-markorbit-workspace-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        404,
        'WORKSPACE_MISMATCH'
      ],
      [
        {
          'x-markorbit-principal': encodeInternalWorkspacePrincipal({
            ...principal,
            permissions: []
          })
        },
        403,
        'PERMISSION_DENIED'
      ]
    ] as const) {
      const h = harness();
      await expect(h.read(path, headers)).rejects.toMatchObject({ status, code });
      expect(h.query).not.toHaveBeenCalled();
    }
  });

  it.each(paths)(
    'reports persistence failure for %s without manufacturing absence',
    async (path) => {
      const h = harness();
      h.query.mockRejectedValue(new Error('private database details'));
      await expect(h.read(path)).rejects.toMatchObject({
        status: 503,
        code: 'PERSISTENCE_UNAVAILABLE',
        retryable: true
      });
    }
  );

  it('does not treat a failed decision query as an undecided Candidate', async () => {
    const h = harness();
    const candidate = {
      opportunityCandidateId: candidateId,
      workspaceId,
      version: 1
    };
    h.query
      .mockResolvedValueOnce({ rows: [{ document_json: candidate }] })
      .mockRejectedValueOnce(new Error('decision read failed'));
    await expect(h.read(paths[2])).rejects.toMatchObject({
      status: 503,
      code: 'PERSISTENCE_UNAVAILABLE'
    });
  });

  it.each(['0', '101', '-1', '1.5', 'NaN', '', 'Infinity'])(
    'rejects invalid limit %s',
    async (limit) => {
      const h = harness();
      await expect(h.read(paths[0], {}, { limit })).rejects.toMatchObject({
        status: 422,
        code: 'INVALID_INPUT'
      });
      expect(h.query).not.toHaveBeenCalled();
    }
  );

  it.each(['', ' ', 'x'.repeat(301)])(
    'rejects an invalid cursor before querying',
    async (cursor) => {
      const h = harness();
      await expect(h.read(paths[0], {}, { cursor })).rejects.toMatchObject({
        status: 422,
        code: 'INVALID_INPUT'
      });
      expect(h.query).not.toHaveBeenCalled();
    }
  );
});

function qualificationHarness() {
  type CandidateStore = Pick<
    PostgresLiteCandidateQualificationStore,
    | 'listLatestCandidates'
    | 'findLatestCandidate'
    | 'findQualificationDecision'
    | 'recordQualification'
  >;
  const disposition = {
    decision: {
      outcome: 'QUALIFIED_FOR_MARKREG',
      decidedByPrincipalId: principal.userId,
      rationale: 'Human qualification',
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
  } as unknown as Awaited<ReturnType<CandidateStore['recordQualification']>>;
  const candidateStore = {
    listLatestCandidates: vi.fn<CandidateStore['listLatestCandidates']>(),
    findLatestCandidate: vi.fn<CandidateStore['findLatestCandidate']>(),
    findQualificationDecision: vi.fn<CandidateStore['findQualificationDecision']>(),
    recordQualification: vi
      .fn<CandidateStore['recordQualification']>()
      .mockResolvedValue(disposition)
  } satisfies CandidateStore;
  const routes = createLiteProductLoopRoutes({
    internalServiceSecret: secret,
    candidateStore
  } as unknown as LiteProductLoopRouteOptions);
  const matches = routes.filter(
    (entry) => entry.method === 'POST' && entry.path === qualificationPath
  );
  const route = matches[0];
  if (!route) throw new Error('Missing Opportunity Qualification route.');
  const request = (
    body: unknown = {
      candidateVersion: 3,
      expectedCandidateFingerprintSha256: candidateFingerprint,
      outcome: 'QUALIFIED_FOR_MARKREG',
      rationale: 'Human qualification'
    },
    headers: Record<string, string> = {}
  ) => ({
    method: 'POST' as const,
    path: qualificationPath,
    body,
    params: { opportunityCandidateId: candidateId },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal({
        ...principal,
        role: 'WORKSPACE_ADMIN',
        permissions: ['workspace:read', 'matter:manage']
      }),
      'x-markorbit-workspace-id': workspaceId,
      'idempotency-key': 'qualify-candidate-http',
      ...headers
    }
  });
  return { candidateStore, disposition, matches, request, route };
}

describe('#571 explicit human Opportunity Qualification HTTP boundary', () => {
  it('registers the owner POST route exactly once and returns the owner disposition unchanged', async () => {
    const h = qualificationHarness();
    expect(h.matches).toHaveLength(1);

    const response = await h.route.handle(h.request());

    expect(response).toEqual({ status: 201, body: h.disposition });
    expect(h.candidateStore.recordQualification).toHaveBeenCalledWith({
      workspaceId,
      candidate: { id: candidateId, version: 3 },
      expectedCandidateFingerprintSha256: candidateFingerprint,
      outcome: 'QUALIFIED_FOR_MARKREG',
      rationale: 'Human qualification',
      decidedByPrincipalId: principal.userId,
      idempotencyKey: 'qualify-candidate-http'
    });
    expect(response.body).toMatchObject({
      decision: { formalOpportunityCreated: false, customerContacted: false },
      currentCandidate: {
        status: 'DISPOSITIONED',
        formalOpportunityCreated: false,
        customerContacted: false
      }
    });
  });

  it.each(['QUALIFIED_FOR_MARKREG', 'REJECTED', 'DEFERRED'] as const)(
    'accepts and forwards owner-supported outcome %s',
    async (outcome) => {
      const h = qualificationHarness();
      await h.route.handle(
        h.request({
          candidateVersion: 3,
          expectedCandidateFingerprintSha256: candidateFingerprint,
          outcome,
          rationale: `Human decision: ${outcome}`
        })
      );
      expect(h.candidateStore.recordQualification).toHaveBeenCalledWith(
        expect.objectContaining({ outcome, rationale: `Human decision: ${outcome}` })
      );
    }
  );

  it('requires trusted internal authorization, a trusted Principal, matching Workspace, permission, and idempotency', async () => {
    for (const [headers, status, code] of [
      [{ 'x-markorbit-internal-authorization': '' }, 401, 'UNTRUSTED_INTERNAL_CALLER'],
      [{ 'x-markorbit-principal': '' }, 401, 'INVALID_INTERNAL_PRINCIPAL'],
      [{ 'x-markorbit-principal': 'invalid' }, 401, 'INVALID_INTERNAL_PRINCIPAL'],
      [{ 'x-markorbit-workspace-id': '' }, 404, 'WORKSPACE_MISMATCH'],
      [
        { 'x-markorbit-workspace-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        404,
        'WORKSPACE_MISMATCH'
      ],
      [
        {
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal)
        },
        403,
        'PERMISSION_DENIED'
      ],
      [{ 'idempotency-key': '' }, 400, 'IDEMPOTENCY_KEY_REQUIRED']
    ] as const) {
      const h = qualificationHarness();
      await expect(h.route.handle(h.request(undefined, headers))).rejects.toMatchObject({
        status,
        code
      });
      expect(h.candidateStore.recordQualification).not.toHaveBeenCalled();
    }
  });

  it.each([
    'workspaceId',
    'decidedByPrincipalId',
    'actorId',
    'userId',
    'principalId',
    'membershipId'
  ])('rejects caller-supplied authority field %s before owner mutation', async (field) => {
    const h = qualificationHarness();
    await expect(
      h.route.handle(
        h.request({
          candidateVersion: 3,
          expectedCandidateFingerprintSha256: candidateFingerprint,
          outcome: 'REJECTED',
          rationale: 'Human rejection',
          [field]: 'spoofed-authority'
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    expect(h.candidateStore.recordQualification).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'INVALID_REQUEST'],
    [{ candidateVersion: 3, extra: true }, 'INVALID_REQUEST'],
    [
      {
        candidateVersion: 3,
        expectedCandidateFingerprintSha256: candidateFingerprint,
        outcome: 42,
        rationale: 'Human decision'
      },
      'INVALID_REQUEST'
    ]
  ] as const)('rejects malformed or unsupported body %#', async (body, code) => {
    const h = qualificationHarness();
    await expect(h.route.handle(h.request(body))).rejects.toMatchObject({ status: 400, code });
    expect(h.candidateStore.recordQualification).not.toHaveBeenCalled();
  });

  it('rejects an unsupported outcome with the owner 422 response', async () => {
    const h = qualificationHarness();
    h.candidateStore.recordQualification.mockRejectedValueOnce(
      new LiteCandidateQualificationError('INVALID_INPUT', 'Qualification outcome is invalid.', 422)
    );
    await expect(
      h.route.handle(
        h.request({
          candidateVersion: 3,
          expectedCandidateFingerprintSha256: candidateFingerprint,
          outcome: 'AUTOMATICALLY_QUALIFIED',
          rationale: 'Not a supported human outcome'
        })
      )
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_INPUT' });
  });

  it.each([
    ['NOT_FOUND', 404],
    ['VERSION_CONFLICT', 409],
    ['SOURCE_FINGERPRINT_MISMATCH', 409],
    ['INVALID_TRANSITION', 409],
    ['INVALID_INPUT', 422],
    ['PERSISTENCE_UNAVAILABLE', 503]
  ] as const)('preserves owner error %s as HTTP %i', async (code, status) => {
    const h = qualificationHarness();
    h.candidateStore.recordQualification.mockRejectedValueOnce(
      new LiteCandidateQualificationError(code, 'owner failure', status, { evidence: 'exact' })
    );
    await expect(h.route.handle(h.request())).rejects.toMatchObject({
      code,
      status,
      details: { evidence: 'exact' }
    });
  });

  it('returns exact owner truth for an idempotent replay', async () => {
    const h = qualificationHarness();
    const first = await h.route.handle(h.request());
    const replay = await h.route.handle(h.request());
    expect(first).toEqual(replay);
    expect(first.body).toBe(h.disposition);
    expect(h.candidateStore.recordQualification).toHaveBeenCalledTimes(2);
  });
});
