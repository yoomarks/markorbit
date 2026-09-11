import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { createCommunicationLinkRoutes } from '../src/communication-link-http.js';
import {
  CommunicationLinkRuntimeError,
  materializeCommunicationLinkV1
} from '../src/communication-link.js';

const secret = 'communication-link-http-secret-0123456789';
const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_link_http',
  sessionId: 'session_link_http',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_link_http',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage']
};
const source = {
  owner: 'MANAGED_COMMUNICATION' as const,
  scope: 'THREAD' as const,
  accountRef: 'communication-account_http',
  messageId: 'message_http',
  threadRef: 'thread_http',
  provider: 'MICROSOFT_GRAPH',
  providerMessageId: 'provider-http',
  observedAt: '2026-09-11T04:00:00.000Z'
};
const target = {
  targetKind: 'TRADEMARK_ASSET' as const,
  owner: 'LITE' as const,
  workspaceId,
  trademarkAssetId: 'trademark-asset_http' as const,
  version: 2
};
const item = materializeCommunicationLinkV1(
  {
    workspaceId,
    actorPrincipalId: principal.userId,
    idempotencyKey: 'create-http',
    source,
    target,
    decisionStatus: 'CONFIRMED',
    decisionBasis: 'MANUAL',
    reason: 'Confirmed by owner',
    evidenceReferences: []
  },
  '2026-09-11T04:05:00.000Z',
  'communication-link_http'
);

type Method = JsonRequest['method'];
function setup() {
  const service = {
    create: vi.fn().mockResolvedValue(item),
    archive: vi.fn().mockResolvedValue({
      ...item,
      version: 2,
      lifecycle: 'ARCHIVED',
      archivedAt: '2026-09-11T04:10:00.000Z',
      updatedAt: '2026-09-11T04:10:00.000Z'
    }),
    getExact: vi.fn().mockResolvedValue(item),
    getLatest: vi.fn().mockResolvedValue(item),
    listLatest: vi.fn().mockResolvedValue([item])
  };
  const routes = createCommunicationLinkRoutes({ internalServiceSecret: secret, service });
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
    body: input.body,
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      ...input.headers
    }
  };
}
const createBody = {
  source,
  target,
  decisionStatus: 'CONFIRMED',
  decisionBasis: 'MANUAL',
  reason: 'Confirmed by owner',
  evidenceReferences: []
} as const;

describe('Communication Link HTTP owner boundary', () => {
  it('exposes only bounded owner routes', () => {
    expect(setup().routes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /v1/communication-links',
      'GET /v1/communication-links',
      'GET /v1/communication-links/:communicationLinkId',
      'GET /v1/communication-links/:communicationLinkId/versions/:version',
      'POST /v1/communication-links/:communicationLinkId/archive'
    ]);
  });
  it('creates only from trusted Principal and server-owned actor', async () => {
    const { route, service } = setup();
    expect(
      await route('POST', '/v1/communication-links').handle(
        request({
          method: 'POST',
          path: '/v1/communication-links',
          headers: { 'idempotency-key': 'create-http' },
          body: createBody
        })
      )
    ).toEqual({ status: 201, body: item });
    expect(service.create).toHaveBeenCalledWith(
      {
        workspaceId,
        actorPrincipalId: principal.userId,
        idempotencyKey: 'create-http',
        ...createBody
      },
      principal
    );
  });
  it.each([
    { workspaceId: otherWorkspaceId },
    { actorPrincipalId: 'spoof' },
    { decidedByPrincipalId: 'spoof' },
    { authority: 'AI' },
    { lifecycle: 'ARCHIVED' },
    { version: 9 },
    { decisionFingerprintSha256: 'a'.repeat(64) },
    { authorityConsequences: { filingAuthorized: true } }
  ])('rejects server-owned field %j', async (extra) => {
    const { route, service } = setup();
    await expect(
      route('POST', '/v1/communication-links').handle(
        request({
          method: 'POST',
          path: '/v1/communication-links',
          headers: { 'idempotency-key': 'spoof' },
          body: { ...createBody, ...extra }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'OWNER_FIELD_SPOOF_REJECTED' });
    expect(service.create).not.toHaveBeenCalled();
  });
  it('requires matter:manage for mutations and workspace:read for reads', async () => {
    const readOnly = {
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    } satisfies WorkspacePrincipal;
    const { route, service } = setup();
    await expect(
      route('POST', '/v1/communication-links').handle(
        request({
          method: 'POST',
          path: '/v1/communication-links',
          headers: {
            'idempotency-key': 'denied',
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly)
          },
          body: createBody
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(
      await route('GET', '/v1/communication-links').handle(
        request({
          method: 'GET',
          path: '/v1/communication-links',
          headers: { 'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly) }
        })
      )
    ).toEqual({ status: 200, body: [item] });
    expect(service.create).not.toHaveBeenCalled();
  });
  it('lists, reads exact/latest and archives within trusted Workspace', async () => {
    const { route, service } = setup();
    await route('GET', '/v1/communication-links').handle(
      request({
        method: 'GET',
        path: '/v1/communication-links',
        query: {
          lifecycle: 'ACTIVE',
          targetKind: 'TRADEMARK_ASSET',
          sourceScope: 'THREAD',
          accountRef: source.accountRef,
          threadRef: source.threadRef,
          limit: '25'
        }
      })
    );
    expect(service.listLatest).toHaveBeenCalledWith(workspaceId, {
      lifecycle: 'ACTIVE',
      targetKind: 'TRADEMARK_ASSET',
      sourceScope: 'THREAD',
      accountRef: source.accountRef,
      threadRef: source.threadRef,
      limit: 25
    });
    await route('GET', '/v1/communication-links/:communicationLinkId').handle(
      request({
        method: 'GET',
        path: '/x',
        params: { communicationLinkId: item.communicationLinkId }
      })
    );
    expect(service.getLatest).toHaveBeenCalledWith(workspaceId, item.communicationLinkId);
    await route('GET', '/v1/communication-links/:communicationLinkId/versions/:version').handle(
      request({
        method: 'GET',
        path: '/x',
        params: { communicationLinkId: item.communicationLinkId, version: '1' }
      })
    );
    expect(service.getExact).toHaveBeenCalledWith(workspaceId, item.communicationLinkId, 1);
    await route('POST', '/v1/communication-links/:communicationLinkId/archive').handle(
      request({
        method: 'POST',
        path: '/x',
        params: { communicationLinkId: item.communicationLinkId },
        headers: { 'idempotency-key': 'archive-http' },
        body: { expectedVersion: 1 }
      })
    );
    expect(service.archive).toHaveBeenCalledWith({
      workspaceId,
      communicationLinkId: item.communicationLinkId,
      expectedVersion: 1,
      idempotencyKey: 'archive-http'
    });
  });
  it.each([
    ['SOURCE_NOT_FOUND', 404, false],
    ['SOURCE_UNAVAILABLE', 503, true],
    ['TARGET_VERSION_STALE', 409, false],
    ['TARGET_OWNER_UNAVAILABLE', 503, true],
    ['ACTIVE_SUBJECT_CONFLICT', 409, false],
    ['INTEGRITY_FAILURE', 500, false]
  ] as const)('preserves owner error %s', async (code, status, retryable) => {
    const { route, service } = setup();
    service.archive.mockRejectedValueOnce(
      new CommunicationLinkRuntimeError(code, `owner ${code}`, status, retryable)
    );
    await expect(
      route('POST', '/v1/communication-links/:communicationLinkId/archive').handle(
        request({
          method: 'POST',
          path: '/x',
          params: { communicationLinkId: item.communicationLinkId },
          headers: { 'idempotency-key': code },
          body: { expectedVersion: 1 }
        })
      )
    ).rejects.toMatchObject({ status, code, retryable });
  });
  it('rejects Workspace spoof and malformed idempotency before owner call', async () => {
    const { route, service } = setup();
    await expect(
      route('POST', '/v1/communication-links').handle(
        request({
          method: 'POST',
          path: '/v1/communication-links',
          headers: { 'x-markorbit-workspace-id': otherWorkspaceId, 'idempotency-key': 'x' },
          body: createBody
        })
      )
    ).rejects.toMatchObject({ status: 404, code: 'WORKSPACE_MISMATCH' });
    await expect(
      route('POST', '/v1/communication-links').handle(
        request({
          method: 'POST',
          path: '/v1/communication-links',
          headers: { 'idempotency-key': '' },
          body: createBody
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' });
    expect(service.create).not.toHaveBeenCalled();
  });
});
