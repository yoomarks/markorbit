import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { createAgencyLineageRoutes } from '../src/agency-lineage-http.js';

const secret = 'agency-lineage-http-secret-0123456789';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session-1',
  userId: 'user-1',
  workspaceId,
  membershipId: 'membership-1',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};

function request(headers: Record<string, string> = {}): JsonRequest {
  return {
    method: 'GET',
    path: '/v1/agency/trademark-assets/trademark-asset_1/lineage',
    params: { trademarkAssetId: 'trademark-asset_1' },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      ...headers
    },
    body: undefined
  };
}

describe('Agency lineage HTTP projection', () => {
  it('binds the read to the trusted Workspace principal', async () => {
    const projection = { schemaVersion: 1, workspaceId };
    const project = vi.fn(() => Promise.resolve(projection as never));
    const [route] = createAgencyLineageRoutes({
      internalServiceSecret: secret,
      service: { project }
    });

    const response = await route!.handle(request());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ lineage: projection });
    expect(project).toHaveBeenCalledWith(workspaceId, 'trademark-asset_1');
  });

  it('fails closed on a cross-Workspace header', async () => {
    const project = vi.fn();
    const [route] = createAgencyLineageRoutes({
      internalServiceSecret: secret,
      service: { project }
    });

    await expect(
      route!.handle(request({ 'x-markorbit-workspace-id': '22222222-2222-4222-8222-222222222222' }))
    ).rejects.toMatchObject({ status: 404, code: 'WORKSPACE_MISMATCH' });
    expect(project).not.toHaveBeenCalled();
  });

  it('requires workspace:read without exposing owner records', async () => {
    const project = vi.fn();
    const forbidden = { ...principal, permissions: [] };
    const [route] = createAgencyLineageRoutes({
      internalServiceSecret: secret,
      service: { project }
    });

    await expect(
      route!.handle(
        request({ 'x-markorbit-principal': encodeInternalWorkspacePrincipal(forbidden) })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(project).not.toHaveBeenCalled();
  });
});
