import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  noLiteWorkItemAuthorityConsequencesV1,
  type LiteWorkItemV1
} from '@markorbit/contracts/lite-work-item';
import type { JsonRequest } from '@markorbit/service-kit';
import { createLiteWorkItemRoutes } from '../src/lite-work-item-http.js';
import { LiteWorkItemRuntimeError } from '../src/lite-work-item.js';

const secret = 'lite-work-item-http-secret-0123456789';
const workspaceId = '12121212-1212-4121-8121-121212121212';
const otherWorkspaceId = '34343434-3434-4343-8343-343434343434';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_work_item_http',
  sessionId: 'session_work_item_http',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_work_item_http',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage']
};
const item: LiteWorkItemV1 = {
  schemaVersion: 1,
  liteWorkItemId: 'lite-work-item_http',
  workspaceId,
  version: 1,
  taskType: 'GENERAL_FOLLOW_UP',
  title: 'Follow up with provider',
  priority: 'NOTICE',
  status: 'OPEN',
  source: {
    sourceClass: 'MANUAL',
    recordedByPrincipalId: principal.userId,
    recordedAt: '2026-09-10T12:00:00.000Z'
  },
  relatedReferences: [],
  certifiedDeadlineReferences: [],
  observedDateCandidates: [],
  internalTiming: {
    timeClass: 'LITE_INTERNAL_OPERATIONAL',
    internalDueAt: '2026-09-11T12:00:00.000Z',
    certifiedLegalDeadline: false
  },
  waitingSinceAt: null,
  completedAt: null,
  cancelledAt: null,
  archivedAt: null,
  archivedFrom: null,
  authorityConsequences: noLiteWorkItemAuthorityConsequencesV1,
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z'
};

type Method = JsonRequest['method'];

function setup() {
  const store = {
    createManual: vi.fn().mockResolvedValue(item),
    get: vi.fn().mockResolvedValue(item),
    list: vi.fn().mockResolvedValue([item]),
    updateInternalFields: vi.fn().mockResolvedValue({ ...item, version: 2 }),
    transitionStatus: vi
      .fn()
      .mockResolvedValue({ ...item, version: 2, status: 'WAITING_FOR_PROVIDER' })
  };
  const routes = createLiteWorkItemRoutes({ internalServiceSecret: secret, store });
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
  taskType: 'GENERAL_FOLLOW_UP',
  title: 'Follow up with provider',
  priority: 'NOTICE',
  assigneePrincipalId: 'user_assignee',
  internalTiming: {
    timeClass: 'LITE_INTERNAL_OPERATIONAL',
    internalDueAt: '2026-09-11T12:00:00.000Z',
    certifiedLegalDeadline: false
  }
} as const;

describe('Lite Work Item HTTP owner boundary', () => {
  it('registers exactly the five owner routes and no SYSTEM_PREPARED create route', () => {
    const { routes } = setup();
    expect(routes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /v1/work-items',
      'GET /v1/work-items',
      'GET /v1/work-items/:liteWorkItemId',
      'PATCH /v1/work-items/:liteWorkItemId',
      'POST /v1/work-items/:liteWorkItemId/status'
    ]);
    expect(routes.some(({ path }) => path.toLowerCase().includes('system'))).toBe(false);
  });

  it('creates MANUAL work from trusted Principal identity and header idempotency only', async () => {
    const { route, store } = setup();
    const result = await route('POST', '/v1/work-items').handle(
      request({
        method: 'POST',
        path: '/v1/work-items',
        headers: { 'idempotency-key': 'create-work-1' },
        body: createBody
      })
    );
    expect(result).toEqual({ status: 201, body: item });
    expect(store.createManual).toHaveBeenCalledOnce();
    expect(store.createManual).toHaveBeenCalledWith({
      workspaceId,
      actorPrincipalId: principal.userId,
      idempotencyKey: 'create-work-1',
      ...createBody
    });
  });

  it.each([
    [{ workspaceId: otherWorkspaceId }, 'ACTOR_SPOOF_REJECTED'],
    [{ actorPrincipalId: 'spoofed' }, 'ACTOR_SPOOF_REJECTED'],
    [{ source: { sourceClass: 'SYSTEM_PREPARED' } }, 'ACTOR_SPOOF_REJECTED'],
    [{ status: 'COMPLETED' }, 'ACTOR_SPOOF_REJECTED'],
    [{ authorityConsequences: { filingSubmitted: true } }, 'ACTOR_SPOOF_REJECTED'],
    [{ filingAuthorized: true }, 'INVALID_REQUEST']
  ] as const)('rejects create spoof/protected fields %j', async (extra, code) => {
    const { route, store } = setup();
    await expect(
      route('POST', '/v1/work-items').handle(
        request({
          method: 'POST',
          path: '/v1/work-items',
          headers: { 'idempotency-key': 'create-work-spoof' },
          body: { ...createBody, ...extra }
        })
      )
    ).rejects.toMatchObject({ status: 400, code });
    expect(store.createManual).not.toHaveBeenCalled();
  });

  it.each([
    ['x-markorbit-internal-authorization', 'wrong', 401, 'UNTRUSTED_INTERNAL_CALLER'],
    ['x-markorbit-principal', 'invalid', 401, 'INVALID_INTERNAL_PRINCIPAL'],
    ['x-markorbit-workspace-id', otherWorkspaceId, 404, 'WORKSPACE_MISMATCH'],
    ['idempotency-key', '', 400, 'IDEMPOTENCY_KEY_REQUIRED']
  ] as const)(
    'rejects invalid create %s before persistence',
    async (header, value, status, code) => {
      const { route, store } = setup();
      await expect(
        route('POST', '/v1/work-items').handle(
          request({
            method: 'POST',
            path: '/v1/work-items',
            headers: { 'idempotency-key': 'create-work-auth', [header]: value },
            body: createBody
          })
        )
      ).rejects.toMatchObject({ status, code });
      expect(store.createManual).not.toHaveBeenCalled();
    }
  );

  it('requires matter:manage for owner mutations', async () => {
    const { route, store } = setup();
    const readOnly = {
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    } satisfies WorkspacePrincipal;
    await expect(
      route('POST', '/v1/work-items').handle(
        request({
          method: 'POST',
          path: '/v1/work-items',
          headers: {
            'idempotency-key': 'create-work-denied',
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly)
          },
          body: createBody
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(store.createManual).not.toHaveBeenCalled();
  });

  it('lists through workspace:read with bounded status, assignee and limit filters', async () => {
    const { route, store } = setup();
    const readOnly = {
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    } satisfies WorkspacePrincipal;
    const result = await route('GET', '/v1/work-items').handle(
      request({
        method: 'GET',
        path: '/v1/work-items',
        query: {
          statuses: 'OPEN,WAITING_FOR_PROVIDER',
          assigneePrincipalId: 'user_assignee',
          limit: '25'
        },
        headers: { 'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly) }
      })
    );
    expect(result).toEqual({ status: 200, body: [item] });
    expect(store.list).toHaveBeenCalledWith(workspaceId, {
      statuses: ['OPEN', 'WAITING_FOR_PROVIDER'],
      assigneePrincipalId: 'user_assignee',
      limit: 25
    });
  });

  it('supports an explicit unassigned list filter without overloading a Principal id', async () => {
    const { route, store } = setup();
    await route('GET', '/v1/work-items').handle(
      request({
        method: 'GET',
        path: '/v1/work-items',
        query: { unassigned: 'true' }
      })
    );
    expect(store.list).toHaveBeenCalledWith(workspaceId, { assigneePrincipalId: null });
  });

  it.each([
    { statuses: '' },
    { limit: '0' },
    { limit: '101x' },
    { unassigned: 'false' },
    { unassigned: 'true', assigneePrincipalId: 'user_assignee' },
    { workspaceId: otherWorkspaceId }
  ])('rejects malformed or caller-scoped list query %j', async (query) => {
    const { route, store } = setup();
    await expect(
      route('GET', '/v1/work-items').handle(
        request({
          method: 'GET',
          path: '/v1/work-items',
          query
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(store.list).not.toHaveBeenCalled();
  });

  it('reads one item in the trusted Workspace and hides missing/foreign existence as 404', async () => {
    const { route, store } = setup();
    const detail = route('GET', '/v1/work-items/:liteWorkItemId');
    expect(
      await detail.handle(
        request({
          method: 'GET',
          path: `/v1/work-items/${item.liteWorkItemId}`,
          params: { liteWorkItemId: item.liteWorkItemId }
        })
      )
    ).toEqual({ status: 200, body: item });
    expect(store.get).toHaveBeenCalledWith(workspaceId, item.liteWorkItemId);
    store.get.mockResolvedValueOnce(undefined);
    await expect(
      detail.handle(
        request({
          method: 'GET',
          path: '/v1/work-items/lite-work-item_missing',
          params: { liteWorkItemId: 'lite-work-item_missing' }
        })
      )
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('patches only internal editable fields with exact expectedVersion and idempotency', async () => {
    const { route, store } = setup();
    const body = {
      expectedVersion: 1,
      title: 'Updated follow-up',
      note: null,
      assigneePrincipalId: null,
      priority: 'IMPORTANT'
    };
    await route('PATCH', '/v1/work-items/:liteWorkItemId').handle(
      request({
        method: 'PATCH',
        path: `/v1/work-items/${item.liteWorkItemId}`,
        params: { liteWorkItemId: item.liteWorkItemId },
        headers: { 'idempotency-key': 'patch-work-1' },
        body
      })
    );
    expect(store.updateInternalFields).toHaveBeenCalledWith({
      workspaceId,
      liteWorkItemId: item.liteWorkItemId,
      expectedVersion: 1,
      idempotencyKey: 'patch-work-1',
      title: 'Updated follow-up',
      note: null,
      assigneePrincipalId: null,
      priority: 'IMPORTANT'
    });
  });

  it('transitions status only through the existing owner command', async () => {
    const { route, store } = setup();
    await route('POST', '/v1/work-items/:liteWorkItemId/status').handle(
      request({
        method: 'POST',
        path: `/v1/work-items/${item.liteWorkItemId}/status`,
        params: { liteWorkItemId: item.liteWorkItemId },
        headers: { 'idempotency-key': 'status-work-1' },
        body: { expectedVersion: 1, toStatus: 'WAITING_FOR_PROVIDER' }
      })
    );
    expect(store.transitionStatus).toHaveBeenCalledWith({
      workspaceId,
      liteWorkItemId: item.liteWorkItemId,
      expectedVersion: 1,
      toStatus: 'WAITING_FOR_PROVIDER',
      idempotencyKey: 'status-work-1'
    });
  });

  it.each([
    ['INVALID_INPUT', 422, false],
    ['NOT_FOUND', 404, false],
    ['IDEMPOTENCY_CONFLICT', 409, false],
    ['VERSION_CONFLICT', 409, false],
    ['INVALID_TRANSITION', 409, false],
    ['INTEGRITY_FAILURE', 500, false],
    ['PERSISTENCE_UNAVAILABLE', 503, true]
  ] as const)(
    'preserves owner error %s without fabricating success',
    async (code, status, retryable) => {
      const { route, store } = setup();
      store.transitionStatus.mockRejectedValueOnce(
        new LiteWorkItemRuntimeError(code, `owner ${code}`, status, retryable)
      );
      await expect(
        route('POST', '/v1/work-items/:liteWorkItemId/status').handle(
          request({
            method: 'POST',
            path: `/v1/work-items/${item.liteWorkItemId}/status`,
            params: { liteWorkItemId: item.liteWorkItemId },
            headers: { 'idempotency-key': `status-${code}` },
            body: { expectedVersion: 1, toStatus: 'COMPLETED' }
          })
        )
      ).rejects.toMatchObject({ status, code, message: `owner ${code}`, retryable });
    }
  );

  it('never turns Work completion into an external consequence at the HTTP boundary', async () => {
    const { route, store } = setup();
    store.transitionStatus.mockResolvedValueOnce({
      ...item,
      version: 2,
      status: 'COMPLETED',
      completedAt: '2026-09-10T13:00:00.000Z'
    });
    const result = await route('POST', '/v1/work-items/:liteWorkItemId/status').handle(
      request({
        method: 'POST',
        path: `/v1/work-items/${item.liteWorkItemId}/status`,
        params: { liteWorkItemId: item.liteWorkItemId },
        headers: { 'idempotency-key': 'complete-work-1' },
        body: { expectedVersion: 1, toStatus: 'COMPLETED' }
      })
    );
    expect(result.body).toMatchObject({
      status: 'COMPLETED',
      authorityConsequences: {
        workCompletionRepresentsExternalSuccess: false,
        filingSubmitted: false,
        externalMessageSent: false
      }
    });
  });
});
