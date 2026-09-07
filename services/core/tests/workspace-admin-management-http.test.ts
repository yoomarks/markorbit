import {
  encodeInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceAdminManagementRoutesV1 } from '../src/workspace-admin-management-http.js';
import { WorkspaceAdminManagementError } from '../src/workspace-admin-management.js';

const secret = 'workspace-admin-manage-secret-32-bytes';
const workspaceId = '018f0000-0000-7000-8000-000000000973';
const userId = '018f0000-0000-7000-8000-000000000974';
const principal = (
  capability: InternalOperatorPrincipal['capabilities'][number],
  expiresAt = '2099-01-01T00:00:00.000Z'
) =>
  encodeInternalOperatorPrincipal({
    kind: 'INTERNAL_OPERATOR',
    sessionId: 'session-973',
    userId,
    capabilities: [capability],
    sessionExpiresAt: expiresAt
  });

const updatedWorkspace = {
  workspaceId,
  name: 'Renamed Workspace',
  slug: 'original-slug',
  status: 'ACTIVE' as const,
  version: 2,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-07T12:00:00.000Z'
};

function request(
  body: unknown = {
    expectedVersion: 1,
    displayName: 'Renamed Workspace',
    reason: 'Correct customer-facing display name.'
  },
  authority = principal('workspace-admin:manage'),
  internal = secret,
  headers: Record<string, string> = {}
): JsonRequest {
  return {
    method: 'PATCH',
    path: `/internal/super-admin/workspaces/${workspaceId}/display-name`,
    params: { workspaceId },
    query: {},
    body,
    headers: {
      'x-markorbit-internal-authorization': internal,
      'x-markorbit-principal': authority,
      'idempotency-key': 'rename-973-1',
      'x-correlation-id': 'corr-973-1',
      ...headers
    }
  };
}

function route() {
  const renameDisplayName = vi.fn(() => Promise.resolve(updatedWorkspace));
  return {
    renameDisplayName,
    route: createWorkspaceAdminManagementRoutesV1({
      service: { renameDisplayName },
      internalServiceSecret: secret,
      now: () => new Date('2026-09-07T12:00:00.000Z')
    })[0]!
  };
}

describe('Workspace Admin management HTTP owner boundary', () => {
  it('executes the exact display-name command with trusted actor and target', async () => {
    const { renameDisplayName, route: ownerRoute } = route();
    await expect(ownerRoute.handle(request())).resolves.toEqual({
      status: 200,
      body: updatedWorkspace
    });
    expect(renameDisplayName).toHaveBeenCalledWith(
      {
        workspaceId,
        expectedVersion: 1,
        displayName: 'Renamed Workspace',
        reason: 'Correct customer-facing display name.',
        idempotencyKey: 'rename-973-1'
      },
      { userId, sessionId: 'session-973' },
      'corr-973-1'
    );
  });

  it.each([
    'workspace-admin:read',
    'commercial-admin:operate',
    'control-plane:cognitive:read',
    'control-plane:data:read',
    'control-plane:knowledge:read'
  ] as const)('does not let unrelated %s authority substitute manage', async (capability) => {
    const { renameDisplayName, route: ownerRoute } = route();
    await expect(
      ownerRoute.handle(request(undefined, principal(capability)))
    ).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
    expect(renameDisplayName).not.toHaveBeenCalled();
  });

  it('requires internal service identity before touching the command', async () => {
    const { renameDisplayName, route: ownerRoute } = route();
    await expect(
      ownerRoute.handle(request(undefined, principal('workspace-admin:manage'), 'wrong'))
    ).rejects.toMatchObject({
      status: 401,
      code: 'INTERNAL_SERVICE_UNAUTHORIZED'
    });
    expect(renameDisplayName).not.toHaveBeenCalled();
  });

  it('rejects expired manage authority', async () => {
    const { renameDisplayName, route: ownerRoute } = route();
    await expect(
      ownerRoute.handle(
        request(undefined, principal('workspace-admin:manage', '2020-01-01T00:00:00.000Z'))
      )
    ).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
    expect(renameDisplayName).not.toHaveBeenCalled();
  });

  it.each([
    [{ expectedVersion: 1, displayName: 'Name', reason: 'Reason', slug: 'nope' }],
    [{ expectedVersion: 0, displayName: 'Name', reason: 'Reason' }],
    [{ expectedVersion: 1, displayName: 'Name' }],
    ['raw']
  ])('rejects arbitrary or malformed command body %j', async (body) => {
    const { renameDisplayName, route: ownerRoute } = route();
    await expect(ownerRoute.handle(request(body))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });
    expect(renameDisplayName).not.toHaveBeenCalled();
  });

  it('requires a bounded idempotency key', async () => {
    const { renameDisplayName, route: ownerRoute } = route();
    await expect(
      ownerRoute.handle(request(undefined, undefined, secret, { 'idempotency-key': '' }))
    ).rejects.toMatchObject({
      status: 400,
      code: 'IDEMPOTENCY_KEY_REQUIRED'
    });
    expect(renameDisplayName).not.toHaveBeenCalled();
  });

  it('preserves typed management conflicts at the HTTP boundary', async () => {
    const renameDisplayName = vi.fn(() =>
      Promise.reject(
        new WorkspaceAdminManagementError(
          'STALE_VERSION',
          'Expected Workspace version is stale.',
          409
        )
      )
    );
    const ownerRoute = createWorkspaceAdminManagementRoutesV1({
      service: { renameDisplayName },
      internalServiceSecret: secret
    })[0]!;
    await expect(ownerRoute.handle(request())).rejects.toMatchObject({
      status: 409,
      code: 'STALE_VERSION'
    });
  });
});
