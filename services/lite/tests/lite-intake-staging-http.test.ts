import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  noLiteIntakeStagingAuthorityConsequencesV1,
  type LiteIntakeStagingV1
} from '@markorbit/contracts/lite-intake-staging';
import type { JsonRequest } from '@markorbit/service-kit';
import { createLiteIntakeStagingRoutes } from '../src/lite-intake-staging-http.js';
import { LiteIntakeStagingRuntimeError } from '../src/lite-intake-staging.js';

const secret = 'lite-intake-http-secret-0123456789012345';
const workspaceId = '77777777-7777-4777-8777-777777777777';
const otherWorkspaceId = '88888888-8888-4888-8888-888888888888';
const stagingId = 'lite-intake-staging_http';
const caseCandidateId = 'lite-intake-case_http';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_intake_http',
  sessionId: 'session_intake_http',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_intake_http',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage', 'matter:create']
};
const item: LiteIntakeStagingV1 = {
  schemaVersion: 1,
  stagingId,
  workspaceId,
  version: 2,
  lifecycle: 'ACTIVE',
  sources: [],
  aiExtractions: [],
  caseCandidates: [],
  authorityConsequences: noLiteIntakeStagingAuthorityConsequencesV1,
  createdAt: '2026-09-11T10:00:00.000Z',
  updatedAt: '2026-09-11T10:01:00.000Z',
  archivedAt: null
};

type Method = JsonRequest['method'];

function setup() {
  const service = {
    create: vi.fn().mockResolvedValue(item),
    reviseCase: vi.fn().mockResolvedValue(item),
    reviewCase: vi.fn().mockResolvedValue(item),
    commitCase: vi.fn().mockResolvedValue({ status: 'COMMITTED', staging: item }),
    getExact: vi.fn().mockResolvedValue(item),
    getLatest: vi.fn().mockResolvedValue(item),
    listLatest: vi.fn().mockResolvedValue([item])
  };
  const routes = createLiteIntakeStagingRoutes({ internalServiceSecret: secret, service });
  const route = (method: Method, path: string) => {
    const found = routes.find(
      (candidate) => candidate.method === method && candidate.path === path
    );
    if (!found) throw new Error(`Missing ${method} ${path}`);
    return found;
  };
  return { service, routes, route };
}

function request(input: {
  method: Method;
  path: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}): JsonRequest {
  return {
    method: input.method,
    path: input.path,
    params: input.params ?? {},
    query: input.query ?? {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      ...input.headers
    },
    body: input.body
  };
}
describe('Lite Intake Staging HTTP owner boundary', () => {
  it('registers only bounded owner mutation/read routes', () => {
    const { routes } = setup();
    expect(routes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /internal/v1/lite-intake-staging',
      'POST /internal/v1/lite-intake-staging/:stagingId/cases/:caseCandidateId/revise',
      'POST /internal/v1/lite-intake-staging/:stagingId/cases/:caseCandidateId/review',
      'POST /internal/v1/lite-intake-staging/:stagingId/cases/:caseCandidateId/commit',
      'GET /internal/v1/lite-intake-staging',
      'GET /internal/v1/lite-intake-staging/:stagingId',
      'GET /internal/v1/lite-intake-staging/:stagingId/versions/:version'
    ]);
    expect(routes.some(({ path }) => /filed|payment|provider|official-truth/i.test(path))).toBe(
      false
    );
  });

  it('derives Workspace and reviewer authority only from the trusted principal', async () => {
    const { route, service } = setup();
    await route('POST', '/internal/v1/lite-intake-staging').handle(
      request({
        method: 'POST',
        path: '/internal/v1/lite-intake-staging',
        headers: { 'idempotency-key': 'create-http' },
        body: { sources: [] }
      })
    );
    expect(service.create).toHaveBeenCalledWith({
      workspaceId,
      actorPrincipalId: principal.userId,
      idempotencyKey: 'create-http',
      sources: []
    });
    await expect(
      route('POST', '/internal/v1/lite-intake-staging').handle(
        request({
          method: 'POST',
          path: '/internal/v1/lite-intake-staging',
          headers: { 'idempotency-key': 'spoof-http' },
          body: { sources: [], workspaceId: otherWorkspaceId }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });

    await expect(
      route(
        'POST',
        '/internal/v1/lite-intake-staging/:stagingId/cases/:caseCandidateId/review'
      ).handle(
        request({
          method: 'POST',
          path: '/review',
          params: { stagingId, caseCandidateId },
          headers: { 'idempotency-key': 'review-spoof' },
          body: {
            expectedVersion: 1,
            fieldCandidates: [],
            material: {},
            actorPrincipalId: 'spoofed-user'
          }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });
  it('maps COMMIT_UNCERTAIN to 202 and requires matter:create authority', async () => {
    const { route, service } = setup();
    service.commitCase.mockResolvedValueOnce({ status: 'COMMIT_UNCERTAIN', staging: item });
    const commitRoute = route(
      'POST',
      '/internal/v1/lite-intake-staging/:stagingId/cases/:caseCandidateId/commit'
    );
    const response = await commitRoute.handle(
      request({
        method: 'POST',
        path: '/commit',
        params: { stagingId, caseCandidateId },
        headers: { 'idempotency-key': 'commit-http' },
        body: { expectedVersion: 2, expectedReviewedFingerprintSha256: 'a'.repeat(64) }
      })
    );
    expect(response).toEqual({
      status: 202,
      body: { status: 'COMMIT_UNCERTAIN', staging: item }
    });
    expect(service.commitCase).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        stagingId,
        caseCandidateId,
        expectedVersion: 2,
        idempotencyKey: 'commit-http',
        principal
      })
    );
    const readOnly = {
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    } satisfies WorkspacePrincipal;
    await expect(
      commitRoute.handle(
        request({
          method: 'POST',
          path: '/commit',
          params: { stagingId, caseCandidateId },
          headers: {
            'idempotency-key': 'commit-denied',
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly)
          },
          body: { expectedVersion: 2, expectedReviewedFingerprintSha256: 'a'.repeat(64) }
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });

  it('keeps reads Workspace-scoped, bounded and fail-closed on missing records', async () => {
    const { route, service } = setup();
    const list = await route('GET', '/internal/v1/lite-intake-staging').handle(
      request({
        method: 'GET',
        path: '/internal/v1/lite-intake-staging',
        query: { lifecycle: 'ACTIVE', limit: '25' }
      })
    );
    expect(list).toEqual({ status: 200, body: [item] });
    expect(service.listLatest).toHaveBeenCalledWith(workspaceId, {
      lifecycle: 'ACTIVE',
      limit: 25
    });
    service.getLatest.mockResolvedValueOnce(undefined);
    await expect(
      route('GET', '/internal/v1/lite-intake-staging/:stagingId').handle(
        request({
          method: 'GET',
          path: `/internal/v1/lite-intake-staging/${stagingId}`,
          params: { stagingId }
        })
      )
    ).rejects.toMatchObject({ status: 404, code: 'LITE_INTAKE_STAGING_NOT_FOUND' });

    await expect(
      route('GET', '/internal/v1/lite-intake-staging').handle(
        request({ method: 'GET', path: '/internal/v1/lite-intake-staging', query: { limit: '0' } })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });

  it('fails closed for untrusted and cross-Workspace callers', async () => {
    const { route } = setup();
    const list = route('GET', '/internal/v1/lite-intake-staging');
    await expect(
      list.handle(
        request({
          method: 'GET',
          path: '/internal/v1/lite-intake-staging',
          headers: { 'x-markorbit-internal-authorization': 'wrong' }
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'UNTRUSTED_INTERNAL_CALLER' });
    await expect(
      list.handle(
        request({
          method: 'GET',
          path: '/internal/v1/lite-intake-staging',
          headers: { 'x-markorbit-workspace-id': otherWorkspaceId }
        })
      )
    ).rejects.toMatchObject({ status: 404, code: 'WORKSPACE_MISMATCH' });
  });

  it.each([
    ['INVALID_INPUT', 422, false],
    ['IDEMPOTENCY_CONFLICT', 409, false],
    ['VERSION_CONFLICT', 409, false],
    ['REVIEW_FINGERPRINT_CONFLICT', 409, false],
    ['OWNER_RESPONSE_MISMATCH', 409, false],
    ['PERSISTENCE_UNAVAILABLE', 503, true]
  ] as const)('preserves runtime error %s', async (code, status, retryable) => {
    const { route, service } = setup();
    service.getLatest.mockRejectedValueOnce(
      new LiteIntakeStagingRuntimeError(code, `owner ${code}`, status, retryable)
    );
    await expect(
      route('GET', '/internal/v1/lite-intake-staging/:stagingId').handle(
        request({ method: 'GET', path: '/latest', params: { stagingId } })
      )
    ).rejects.toMatchObject({ status, code, retryable });
  });
});
