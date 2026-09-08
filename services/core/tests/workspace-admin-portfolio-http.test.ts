import {
  encodeInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceAdminPortfolioRoutesV1 } from '../src/workspace-admin-portfolio-http.js';

const secret = 'workspace-admin-owner-secret-32-bytes';
const principal = (
  capability: InternalOperatorPrincipal['capabilities'][number],
  expiresAt = '2099-01-01T00:00:00.000Z'
) =>
  encodeInternalOperatorPrincipal({
    kind: 'INTERNAL_OPERATOR',
    sessionId: 'session-967',
    userId: '018f0000-0000-7000-8000-000000000967',
    capabilities: [capability],
    sessionExpiresAt: expiresAt
  });

function request(
  query: Record<string, string> = {},
  authority = principal('workspace-admin:read'),
  internal = secret
): JsonRequest {
  return {
    method: 'GET',
    path: '/internal/super-admin/workspaces',
    params: {},
    query,
    body: undefined,
    headers: {
      'x-markorbit-internal-authorization': internal,
      'x-markorbit-principal': authority
    }
  };
}
function route() {
  const read = vi.fn(() =>
    Promise.resolve({
      schemaVersion: 1 as const,
      objectType: 'WORKSPACE_ADMIN_PORTFOLIO_RESULT' as const,
      owner: 'CORE' as const,
      access: 'READ_ONLY' as const,
      requiredAuthority: 'workspace-admin:read' as const,
      observedAt: '2026-09-07T10:00:00.000Z',
      page: 1,
      pageSize: 50,
      sort: 'NAME' as const,
      direction: 'ASC' as const,
      total: 0,
      summary: { total: 0, byStatus: { ACTIVE: 0, ARCHIVED: 0 } },
      items: []
    })
  );
  return {
    read,
    route: createWorkspaceAdminPortfolioRoutesV1({
      reader: { read },
      internalServiceSecret: secret
    })[0]!
  };
}

describe('Workspace admin portfolio HTTP owner boundary', () => {
  it('accepts exact workspace-admin:read and parses bounded filters', async () => {
    const { read, route: ownerRoute } = route();
    await expect(
      ownerRoute.handle(
        request({
          page: '2',
          pageSize: '25',
          status: 'ARCHIVED',
          search: 'Alpha',
          sort: 'UPDATED_AT',
          direction: 'DESC'
        })
      )
    ).resolves.toMatchObject({ status: 200 });
    expect(read).toHaveBeenCalledWith({
      page: 2,
      pageSize: 25,
      status: 'ARCHIVED',
      search: 'Alpha',
      sort: 'UPDATED_AT',
      direction: 'DESC'
    });
  });

  it('requires internal service identity before reading owner truth', async () => {
    const { read, route: ownerRoute } = route();
    await expect(
      ownerRoute.handle(request({}, principal('workspace-admin:read'), 'wrong'))
    ).rejects.toMatchObject({ status: 401 });
    expect(read).not.toHaveBeenCalled();
  });
  it.each([
    'commercial-admin:read',
    'control-plane:cognitive:read',
    'control-plane:data:read',
    'control-plane:knowledge:read'
  ] as const)('does not let unrelated %s authority substitute', async (capability) => {
    const { read, route: ownerRoute } = route();
    await expect(ownerRoute.handle(request({}, principal(capability)))).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects expired operator authority', async () => {
    const { read, route: ownerRoute } = route();
    await expect(
      ownerRoute.handle(request({}, principal('workspace-admin:read', '2020-01-01T00:00:00.000Z')))
    ).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    { pageSize: '101' },
    { status: 'SUSPENDED' },
    { search: ' Alpha' },
    { plan: 'PRO' },
    { sort: 'OWNER' },
    { direction: 'SIDEWAYS' }
  ])('fails closed on malformed query %j', async (query) => {
    const { read, route: ownerRoute } = route();
    await expect(ownerRoute.handle(request(query))).rejects.toMatchObject({ status: 400 });
    expect(read).not.toHaveBeenCalled();
  });
});
