import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { createDiscoveredTrademarkAdmissionRoutes } from '../src/discovered-trademark-admission-http.js';

const secret = 'agency-admission-internal-secret-0123456789';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session-agency-admission',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId: '22222222-2222-4222-8222-222222222222',
  membershipId: 'membership-agency-admission',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
};

function request(body: Record<string, unknown>) {
  return {
    method: 'POST' as const,
    path: '/v1/trademark-assets/admit-discovered',
    params: {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': principal.workspaceId,
      'idempotency-key': 'agency-admission-1'
    },
    body
  };
}

describe('Discovered Trademark admission HTTP boundary', () => {
  it('derives actor, Workspace and idempotency from trusted transport', async () => {
    const admit = vi.fn(() => Promise.resolve({ trademarkAssetId: 'trademark-asset_1' }));
    const route = createDiscoveredTrademarkAdmissionRoutes({
      internalServiceSecret: secret,
      service: { admit: admit as never }
    })[0]!;
    const response = await route.handle(
      request({
        directory: { workspaceDirectoryEntryId: 'workspace-directory-entry_1', version: 1 },
        applicant: { applicant_candidate_id: 'applicant_1' },
        trademark: { trademark_candidate_id: 'trademark_1' },
        decision: 'MANAGED'
      })
    );

    expect(response.status).toBe(201);
    expect(admit).toHaveBeenCalledWith(
      expect.objectContaining({
        principal,
        idempotencyKey: 'agency-admission-1',
        decision: 'MANAGED'
      })
    );
  });

  it('rejects caller-supplied authority fields before orchestration', async () => {
    const route = createDiscoveredTrademarkAdmissionRoutes({
      internalServiceSecret: secret,
      service: { admit: vi.fn() as never }
    })[0]!;
    await expect(
      route.handle(
        request({
          workspaceId: 'forged',
          directory: {},
          applicant: {},
          trademark: {},
          decision: 'MANAGED'
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });
});
