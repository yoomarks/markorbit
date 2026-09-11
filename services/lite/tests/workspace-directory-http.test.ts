import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  noWorkspaceDirectoryAuthorityConsequencesV1,
  type WorkspaceDirectoryEntryV1
} from '@markorbit/contracts/workspace-directory';
import type { JsonRequest } from '@markorbit/service-kit';
import { createWorkspaceDirectoryRoutes } from '../src/workspace-directory-http.js';
import { WorkspaceDirectoryRuntimeError } from '../src/workspace-directory.js';

const secret = 'workspace-directory-http-secret-0123456789';
const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_directory_owner',
  sessionId: 'session_directory_owner',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_directory_owner',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage']
};
const item: WorkspaceDirectoryEntryV1 = {
  schemaVersion: 1,
  workspaceDirectoryEntryId: 'workspace-directory-entry_http',
  workspaceId,
  version: 1,
  entryKind: 'ORGANIZATION',
  displayName: 'Example Holdings Limited',
  aliases: ['Example Holdings'],
  status: 'ACTIVE',
  roles: ['CLIENT_CONTACT'],
  contactPoints: [],
  externalIdentityReferences: [],
  provenance: {
    sourceKind: 'WORKSPACE_USER',
    sourceReference: 'workspace-principal:user_directory_owner',
    capturedAt: '2026-09-11T08:20:00.000Z'
  },
  authorityConsequences: noWorkspaceDirectoryAuthorityConsequencesV1,
  createdAt: '2026-09-11T08:20:00.000Z',
  updatedAt: '2026-09-11T08:20:00.000Z',
  archivedAt: null
};
type Method = JsonRequest['method'];

function setup() {
  const store = {
    create: vi.fn().mockResolvedValue(item),
    update: vi.fn().mockResolvedValue({ ...item, version: 2, displayName: 'Example Holdings' }),
    archive: vi.fn().mockResolvedValue({
      ...item,
      version: 2,
      status: 'ARCHIVED',
      updatedAt: '2026-09-11T08:30:00.000Z',
      archivedAt: '2026-09-11T08:30:00.000Z'
    }),
    getExact: vi.fn().mockResolvedValue(item),
    getLatest: vi.fn().mockResolvedValue(item),
    listLatest: vi.fn().mockResolvedValue([item])
  };
  const routes = createWorkspaceDirectoryRoutes({ internalServiceSecret: secret, store });
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

describe('Workspace Directory HTTP owner boundary', () => {
  it('registers only bounded owner CRUD/read routes', () => {
    const { routes } = setup();
    expect(routes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /v1/workspace-directory-entries',
      'POST /v1/workspace-directory-entries/:workspaceDirectoryEntryId/update',
      'GET /v1/workspace-directory-entries',
      'GET /v1/workspace-directory-entries/:workspaceDirectoryEntryId',
      'GET /v1/workspace-directory-entries/:workspaceDirectoryEntryId/versions/:version',
      'POST /v1/workspace-directory-entries/:workspaceDirectoryEntryId/archive'
    ]);
    expect(
      routes.some(({ path }) => /verify|customer|applicant|asset|send|filing|payment/i.test(path))
    ).toBe(false);
  });

  it('creates from trusted Workspace Principal and never accepts owner-owned fields', async () => {
    const { route, store } = setup();
    const response = await route('POST', '/v1/workspace-directory-entries').handle(
      request({
        method: 'POST',
        path: '/v1/workspace-directory-entries',
        headers: { 'idempotency-key': 'directory-create-1' },
        body: {
          entryKind: 'ORGANIZATION',
          displayName: 'Example Holdings Limited',
          aliases: ['Example Holdings']
        }
      })
    );
    expect(response).toEqual({ status: 201, body: item });
    expect(store.create).toHaveBeenCalledWith({
      workspaceId,
      actorPrincipalId: principal.userId,
      idempotencyKey: 'directory-create-1',
      entryKind: 'ORGANIZATION',
      displayName: 'Example Holdings Limited',
      aliases: ['Example Holdings']
    });

    await expect(
      route('POST', '/v1/workspace-directory-entries').handle(
        request({
          method: 'POST',
          path: '/v1/workspace-directory-entries',
          headers: { 'idempotency-key': 'directory-spoof' },
          body: {
            entryKind: 'ORGANIZATION',
            displayName: 'Example',
            workspaceId: otherWorkspaceId
          }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'OWNER_FIELD_SPOOF_REJECTED' });
  });

  it('requires matter:manage for mutation and workspace:read for reads', async () => {
    const readOnly = {
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    } satisfies WorkspacePrincipal;
    const { route, store } = setup();

    await expect(
      route('POST', '/v1/workspace-directory-entries').handle(
        request({
          method: 'POST',
          path: '/v1/workspace-directory-entries',
          headers: {
            'idempotency-key': 'directory-denied',
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly)
          },
          body: { entryKind: 'PERSON', displayName: 'Jane Counsel' }
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(store.create).not.toHaveBeenCalled();

    expect(
      await route('GET', '/v1/workspace-directory-entries').handle(
        request({
          method: 'GET',
          path: '/v1/workspace-directory-entries',
          headers: { 'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly) }
        })
      )
    ).toEqual({ status: 200, body: [item] });
  });

  it('passes bounded normalized-name list/search controls to the owner', async () => {
    const { route, store } = setup();
    await route('GET', '/v1/workspace-directory-entries').handle(
      request({
        method: 'GET',
        path: '/v1/workspace-directory-entries',
        query: { status: 'ACTIVE', entryKind: 'ORGANIZATION', q: 'Example', limit: '25' }
      })
    );
    expect(store.listLatest).toHaveBeenCalledWith(workspaceId, {
      status: 'ACTIVE',
      entryKind: 'ORGANIZATION',
      query: 'Example',
      limit: 25
    });
    await expect(
      route('GET', '/v1/workspace-directory-entries').handle(
        request({
          method: 'GET',
          path: '/v1/workspace-directory-entries',
          query: { limit: '0' }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });

  it('updates, reads exact/latest and archives only exact Workspace versions', async () => {
    const { route, store } = setup();
    await route('POST', '/v1/workspace-directory-entries/:workspaceDirectoryEntryId/update').handle(
      request({
        method: 'POST',
        path: `/v1/workspace-directory-entries/${item.workspaceDirectoryEntryId}/update`,
        params: { workspaceDirectoryEntryId: item.workspaceDirectoryEntryId },
        headers: { 'idempotency-key': 'directory-update-1' },
        body: { expectedVersion: 1, displayName: 'Example Holdings' }
      })
    );
    expect(store.update).toHaveBeenCalledWith({
      workspaceId,
      actorPrincipalId: principal.userId,
      workspaceDirectoryEntryId: item.workspaceDirectoryEntryId,
      expectedVersion: 1,
      idempotencyKey: 'directory-update-1',
      displayName: 'Example Holdings'
    });

    expect(
      await route('GET', '/v1/workspace-directory-entries/:workspaceDirectoryEntryId').handle(
        request({
          method: 'GET',
          path: `/v1/workspace-directory-entries/${item.workspaceDirectoryEntryId}`,
          params: { workspaceDirectoryEntryId: item.workspaceDirectoryEntryId }
        })
      )
    ).toEqual({ status: 200, body: item });
    expect(store.getLatest).toHaveBeenCalledWith(workspaceId, item.workspaceDirectoryEntryId);

    await route(
      'GET',
      '/v1/workspace-directory-entries/:workspaceDirectoryEntryId/versions/:version'
    ).handle(
      request({
        method: 'GET',
        path: `/v1/workspace-directory-entries/${item.workspaceDirectoryEntryId}/versions/1`,
        params: { workspaceDirectoryEntryId: item.workspaceDirectoryEntryId, version: '1' }
      })
    );
    expect(store.getExact).toHaveBeenCalledWith(workspaceId, item.workspaceDirectoryEntryId, 1);

    await route(
      'POST',
      '/v1/workspace-directory-entries/:workspaceDirectoryEntryId/archive'
    ).handle(
      request({
        method: 'POST',
        path: `/v1/workspace-directory-entries/${item.workspaceDirectoryEntryId}/archive`,
        params: { workspaceDirectoryEntryId: item.workspaceDirectoryEntryId },
        headers: { 'idempotency-key': 'directory-archive-1' },
        body: { expectedVersion: 1 }
      })
    );
    expect(store.archive).toHaveBeenCalledWith({
      workspaceId,
      workspaceDirectoryEntryId: item.workspaceDirectoryEntryId,
      expectedVersion: 1,
      idempotencyKey: 'directory-archive-1'
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
  ] as const)('preserves owner error %s', async (code, status, retryable) => {
    const { route, store } = setup();
    store.archive.mockRejectedValueOnce(
      new WorkspaceDirectoryRuntimeError(code, `owner ${code}`, status, retryable)
    );
    await expect(
      route('POST', '/v1/workspace-directory-entries/:workspaceDirectoryEntryId/archive').handle(
        request({
          method: 'POST',
          path: `/v1/workspace-directory-entries/${item.workspaceDirectoryEntryId}/archive`,
          params: { workspaceDirectoryEntryId: item.workspaceDirectoryEntryId },
          headers: { 'idempotency-key': `archive-${code}` },
          body: { expectedVersion: 1 }
        })
      )
    ).rejects.toMatchObject({ status, code, retryable });
  });

  it('fails closed for untrusted or cross-Workspace callers', async () => {
    const { route } = setup();
    await expect(
      route('GET', '/v1/workspace-directory-entries').handle(
        request({
          method: 'GET',
          path: '/v1/workspace-directory-entries',
          headers: { 'x-markorbit-internal-authorization': 'wrong' }
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'UNTRUSTED_INTERNAL_CALLER' });
    await expect(
      route('GET', '/v1/workspace-directory-entries').handle(
        request({
          method: 'GET',
          path: '/v1/workspace-directory-entries',
          headers: { 'x-markorbit-workspace-id': otherWorkspaceId }
        })
      )
    ).rejects.toMatchObject({ status: 404, code: 'WORKSPACE_MISMATCH' });
  });
});
