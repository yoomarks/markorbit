import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { createProtectionMonitoringRoutes } from '../src/protection-monitoring-http.js';

const secret = 'protection-monitoring-http-secret-0123456789';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session-1',
  userId: 'user-1',
  workspaceId,
  membershipId: 'membership-1',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};

function harness() {
  const admit = vi.fn(() =>
    Promise.resolve({
      protectionMonitoringCandidateId: 'protection-monitoring-candidate_1'
    } as never)
  );
  const decide = vi.fn(() =>
    Promise.resolve({ protectionMonitoringDecisionId: 'protection-monitoring-decision_1' } as never)
  );
  const prepareActionCandidate = vi.fn(() =>
    Promise.resolve({ actionCandidate: { id: 'opportunity-candidate_1', version: 1 } } as never)
  );
  const routes = createProtectionMonitoringRoutes({
    internalServiceSecret: secret,
    service: { admit, decide, prepareActionCandidate }
  });
  const call = (path: string, body: Record<string, unknown>) => {
    const route = routes.find((entry) => entry.path === path);
    if (!route) throw new Error(`Missing ${path}`);
    return route.handle({
      method: 'POST',
      path,
      query: {},
      params: { candidateId: 'protection-monitoring-candidate_1' },
      headers: {
        'x-markorbit-internal-authorization': secret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
        'x-markorbit-workspace-id': workspaceId,
        'idempotency-key': 'protection-http'
      },
      body
    });
  };
  return { admit, decide, prepareActionCandidate, call };
}

describe('Protection Monitoring HTTP boundary', () => {
  it('derives Workspace and reviewer authority from the trusted Principal', async () => {
    const h = harness();
    const response = await h.call('/v1/protection-monitoring/candidates', {
      asset: { id: 'trademark-asset_1', version: 1 },
      watchTarget: { id: 'workspace-watch-target_1', version: 1 },
      applicant: { applicant_candidate_id: 'applicant_1' },
      trademark: { trademark_candidate_id: 'trademark_1' }
    });
    expect(response.status).toBe(201);
    expect(h.admit).toHaveBeenCalledWith(
      expect.objectContaining({ principal, idempotencyKey: 'protection-http' })
    );
  });

  it('rejects actor spoofing before service orchestration', async () => {
    const h = harness();
    await expect(
      h.call('/v1/protection-monitoring/candidates', {
        workspaceId,
        asset: {},
        watchTarget: {},
        applicant: {},
        trademark: {}
      })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    expect(h.admit).not.toHaveBeenCalled();
  });
});
