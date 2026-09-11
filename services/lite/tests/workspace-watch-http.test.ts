import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  noWorkspaceWatchAuthorityConsequencesV1,
  type WorkspaceWatchTargetV1
} from '@markorbit/contracts/workspace-watch';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';
import type { JsonRequest } from '@markorbit/service-kit';
import { createWorkspaceWatchRoutes } from '../src/workspace-watch-http.js';
import { WorkspaceWatchRuntimeError } from '../src/workspace-watch.js';

const secret = 'workspace-watch-http-secret-0123456789';
const workspaceId = '21212121-2121-4212-8212-212121212121';
const otherWorkspaceId = '31313131-3131-4313-8313-313131313131';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_watch_owner',
  sessionId: 'session_watch_owner',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_watch_owner',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage']
};
const applicant = {
  applicant_candidate_id: 'applicant-candidate-http',
  source_reference: {
    owner: DATA_ENGINE_SOURCE_OWNER,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    jurisdiction: 'CN' as const,
    source_kind: 'APPLICANT_IDENTITY' as const,
    source_id: 'applicant-source-http',
    source_version: 'M1.9-http',
    source_fingerprint_sha256: `sha256:${'a'.repeat(64)}`,
    observed_at: '2026-09-10T09:00:00.000Z'
  }
};
const target = { targetKind: 'APPLICANT' as const, applicant };
const item: WorkspaceWatchTargetV1 = {
  schemaVersion: 1,
  workspaceWatchTargetId: 'workspace-watch-target_http',
  workspaceId,
  version: 1,
  status: 'ACTIVE',
  purpose: 'CLIENT_MONITORING',
  reason: 'Monitor selected applicant',
  target,
  userConfirmed: true,
  createdByPrincipalId: principal.userId,
  authorityConsequences: noWorkspaceWatchAuthorityConsequencesV1,
  createdAt: '2026-09-10T10:00:00.000Z',
  updatedAt: '2026-09-10T10:00:00.000Z',
  archivedAt: null
};
type Method = JsonRequest['method'];
function setup() {
  const store = {
    create: vi.fn().mockResolvedValue(item),
    archive: vi.fn().mockResolvedValue({
      ...item,
      version: 2,
      status: 'ARCHIVED',
      updatedAt: '2026-09-10T11:00:00.000Z',
      archivedAt: '2026-09-10T11:00:00.000Z'
    }),
    getExact: vi.fn().mockResolvedValue(item),
    getLatest: vi.fn().mockResolvedValue(item),
    listLatest: vi.fn().mockResolvedValue([item])
  };
  const routes = createWorkspaceWatchRoutes({ internalServiceSecret: secret, store });
  const route = (method: Method, path: string) => {
    const found = routes.find(
      (candidate) => candidate.method === method && candidate.path === path
    );
    if (!found) throw new Error(`Missing ${method} ${path}`);
    return found;
  };
  return { store, routes, route };
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
const createBody = {
  target,
  purpose: 'CLIENT_MONITORING',
  reason: 'Monitor selected applicant'
} as const;

describe('Workspace Watch HTTP owner boundary', () => {
  it('registers only bounded owner routes', () => {
    const { routes } = setup();
    expect(routes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /v1/watch-targets',
      'GET /v1/watch-targets',
      'GET /v1/watch-targets/:workspaceWatchTargetId',
      'GET /v1/watch-targets/:workspaceWatchTargetId/versions/:version',
      'POST /v1/watch-targets/:workspaceWatchTargetId/archive'
    ]);
    expect(routes.some(({ path }) => /evaluate|schedule|asset|today|admission/i.test(path))).toBe(
      false
    );
  });
  it('creates from trusted Principal and idempotency header only', async () => {
    const { route, store } = setup();
    const response = await route('POST', '/v1/watch-targets').handle(
      request({
        method: 'POST',
        path: '/v1/watch-targets',
        headers: { 'idempotency-key': 'watch-create-1' },
        body: createBody
      })
    );
    expect(response).toEqual({ status: 201, body: item });
    expect(store.create).toHaveBeenCalledWith({
      workspaceId,
      actorPrincipalId: principal.userId,
      idempotencyKey: 'watch-create-1',
      ...createBody
    });
  });
  it.each([
    { workspaceId: otherWorkspaceId },
    { actorPrincipalId: 'spoofed' },
    { createdByPrincipalId: 'spoofed' },
    { userConfirmed: false },
    { status: 'ARCHIVED' },
    { version: 99 },
    { authorityConsequences: { trademarkAssetCreated: true } }
  ])('rejects server-owned field %j', async (extra) => {
    const { route, store } = setup();
    await expect(
      route('POST', '/v1/watch-targets').handle(
        request({
          method: 'POST',
          path: '/v1/watch-targets',
          headers: { 'idempotency-key': 'watch-spoof' },
          body: { ...createBody, ...extra }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'OWNER_FIELD_SPOOF_REJECTED' });
    expect(store.create).not.toHaveBeenCalled();
  });
  it.each([
    ['x-markorbit-internal-authorization', 'wrong', 401, 'UNTRUSTED_INTERNAL_CALLER'],
    ['x-markorbit-principal', 'invalid', 401, 'INVALID_INTERNAL_PRINCIPAL'],
    ['x-markorbit-workspace-id', otherWorkspaceId, 404, 'WORKSPACE_MISMATCH'],
    ['idempotency-key', '', 400, 'IDEMPOTENCY_KEY_REQUIRED']
  ] as const)('rejects invalid header %s', async (header, value, status, code) => {
    const { route, store } = setup();
    await expect(
      route('POST', '/v1/watch-targets').handle(
        request({
          method: 'POST',
          path: '/v1/watch-targets',
          headers: { 'idempotency-key': 'watch-auth', [header]: value },
          body: createBody
        })
      )
    ).rejects.toMatchObject({ status, code });
    expect(store.create).not.toHaveBeenCalled();
  });
  it('requires matter:manage for mutations while allowing workspace:read', async () => {
    const readOnly = {
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    } satisfies WorkspacePrincipal;
    const { route, store } = setup();
    await expect(
      route('POST', '/v1/watch-targets').handle(
        request({
          method: 'POST',
          path: '/v1/watch-targets',
          headers: {
            'idempotency-key': 'watch-denied',
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly)
          },
          body: createBody
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(store.create).not.toHaveBeenCalled();
    expect(
      await route('GET', '/v1/watch-targets').handle(
        request({
          method: 'GET',
          path: '/v1/watch-targets',
          headers: { 'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly) }
        })
      )
    ).toEqual({ status: 200, body: [item] });
  });
  it('lists latest state with bounded filters', async () => {
    const { route, store } = setup();
    await route('GET', '/v1/watch-targets').handle(
      request({
        method: 'GET',
        path: '/v1/watch-targets',
        query: {
          status: 'ACTIVE',
          targetKind: 'APPLICANT',
          purpose: 'CLIENT_MONITORING',
          limit: '25'
        }
      })
    );
    expect(store.listLatest).toHaveBeenCalledWith(workspaceId, {
      status: 'ACTIVE',
      targetKind: 'APPLICANT',
      purpose: 'CLIENT_MONITORING',
      limit: 25
    });
  });
  it.each([{ limit: '0' }, { limit: 'x' }, { workspaceId: otherWorkspaceId }])(
    'rejects malformed/caller-scoped list query %j',
    async (query) => {
      const { route, store } = setup();
      await expect(
        route('GET', '/v1/watch-targets').handle(
          request({ method: 'GET', path: '/v1/watch-targets', query })
        )
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
      expect(store.listLatest).not.toHaveBeenCalled();
    }
  );
  it('reads latest and exact versions in the trusted Workspace', async () => {
    const { route, store } = setup();
    expect(
      await route('GET', '/v1/watch-targets/:workspaceWatchTargetId').handle(
        request({
          method: 'GET',
          path: '/v1/watch-targets/workspace-watch-target_http',
          params: { workspaceWatchTargetId: item.workspaceWatchTargetId }
        })
      )
    ).toEqual({ status: 200, body: item });
    expect(store.getLatest).toHaveBeenCalledWith(workspaceId, item.workspaceWatchTargetId);
    expect(
      await route('GET', '/v1/watch-targets/:workspaceWatchTargetId/versions/:version').handle(
        request({
          method: 'GET',
          path: '/v1/watch-targets/workspace-watch-target_http/versions/1',
          params: { workspaceWatchTargetId: item.workspaceWatchTargetId, version: '1' }
        })
      )
    ).toEqual({ status: 200, body: item });
    expect(store.getExact).toHaveBeenCalledWith(workspaceId, item.workspaceWatchTargetId, 1);
  });
  it('archives with exact expectedVersion and idempotency', async () => {
    const { route, store } = setup();
    const response = await route(
      'POST',
      '/v1/watch-targets/:workspaceWatchTargetId/archive'
    ).handle(
      request({
        method: 'POST',
        path: '/v1/watch-targets/workspace-watch-target_http/archive',
        params: { workspaceWatchTargetId: item.workspaceWatchTargetId },
        headers: { 'idempotency-key': 'watch-archive-1' },
        body: { expectedVersion: 1 }
      })
    );
    expect(response.status).toBe(200);
    expect(store.archive).toHaveBeenCalledWith({
      workspaceId,
      workspaceWatchTargetId: item.workspaceWatchTargetId,
      expectedVersion: 1,
      idempotencyKey: 'watch-archive-1'
    });
  });
  it.each([
    ['INVALID_INPUT', 422, false],
    ['NOT_FOUND', 404, false],
    ['IDEMPOTENCY_CONFLICT', 409, false],
    ['VERSION_CONFLICT', 409, false],
    ['INVALID_TRANSITION', 409, false],
    ['ACTIVE_INTENT_CONFLICT', 409, false],
    ['INTEGRITY_FAILURE', 500, false],
    ['PERSISTENCE_UNAVAILABLE', 503, true]
  ] as const)('preserves owner error %s', async (code, status, retryable) => {
    const { route, store } = setup();
    store.archive.mockRejectedValueOnce(
      new WorkspaceWatchRuntimeError(code, `owner ${code}`, status, retryable)
    );
    await expect(
      route('POST', '/v1/watch-targets/:workspaceWatchTargetId/archive').handle(
        request({
          method: 'POST',
          path: '/v1/watch-targets/workspace-watch-target_http/archive',
          params: { workspaceWatchTargetId: item.workspaceWatchTargetId },
          headers: { 'idempotency-key': `archive-${code}` },
          body: { expectedVersion: 1 }
        })
      )
    ).rejects.toMatchObject({ status, code, retryable });
  });
  it('never grants Asset, Official Truth or external-action authority', () => {
    expect(item.authorityConsequences).toEqual(noWorkspaceWatchAuthorityConsequencesV1);
    expect(item.authorityConsequences.trademarkAssetCreated).toBe(false);
    expect(item.authorityConsequences.managedRelationshipEstablished).toBe(false);
    expect(item.authorityConsequences.ownedRelationshipEstablished).toBe(false);
    expect(item.authorityConsequences.representedRelationshipEstablished).toBe(false);
    expect(item.authorityConsequences.officialTruthCreated).toBe(false);
    expect(item.authorityConsequences.legalConclusionCreated).toBe(false);
    expect(item.authorityConsequences.externalActionAuthorized).toBe(false);
  });
});
