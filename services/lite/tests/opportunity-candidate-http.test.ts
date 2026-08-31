import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import { PostgresLiteCandidateQualificationStore } from '../src/candidate-qualification.js';
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
