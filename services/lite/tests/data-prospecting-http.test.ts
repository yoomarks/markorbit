import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { createDataProspectingRoutes } from '../src/data-prospecting-http.js';

const secret = 'data-prospecting-http-secret-0123456789';
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
    Promise.resolve({ opportunityCandidateId: 'opportunity-candidate_g1' } as never)
  );
  const sendOutreach = vi.fn(() =>
    Promise.resolve({ schemaVersion: 1, sendReceipt: { state: 'SENT' } } as never)
  );
  const routes = createDataProspectingRoutes({
    internalServiceSecret: secret,
    service: { admit, sendOutreach }
  });
  const call = (
    path: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
  ) => {
    const route = routes.find((entry) => entry.method === 'POST' && entry.path === path);
    if (!route) throw new Error(`Missing ${path}`);
    return route.handle({
      method: 'POST',
      path,
      query: {},
      params: { opportunityCandidateId: 'opportunity-candidate_g1' },
      headers: {
        'x-markorbit-internal-authorization': secret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
        'x-markorbit-workspace-id': workspaceId,
        'idempotency-key': 'g1-http',
        ...headers
      },
      body
    });
  };
  return { admit, sendOutreach, call };
}

describe('Data Prospecting HTTP boundary', () => {
  it('derives admission authority from the trusted Principal', async () => {
    const h = harness();
    const body = {
      applicant: { applicant_candidate_id: 'applicant-1' },
      trademark: { trademark_candidate_id: 'trademark-1' },
      signal: 'UNREGISTERED_TRADEMARK_APPLICATION',
      decision: 'OPEN_FOR_HUMAN_QUALIFICATION'
    };
    const response = await h.call('/v1/data-prospecting/candidates', body);
    expect(response.status).toBe(201);
    expect(h.admit).toHaveBeenCalledWith(
      expect.objectContaining({ principal, idempotencyKey: 'g1-http' })
    );
  });

  it('rejects actor spoofing and untrusted callers before orchestration', async () => {
    const h = harness();
    await expect(
      h.call('/v1/data-prospecting/candidates', {
        applicant: {},
        trademark: {},
        signal: 'UNREGISTERED_TRADEMARK_APPLICATION',
        decision: 'OPEN_FOR_HUMAN_QUALIFICATION',
        confirmedByPrincipalId: 'attacker'
      })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    await expect(
      h.call(
        '/v1/data-prospecting/candidates',
        {
          applicant: {},
          trademark: {},
          signal: 'UNREGISTERED_TRADEMARK_APPLICATION',
          decision: 'OPEN_FOR_HUMAN_QUALIFICATION'
        },
        { 'x-markorbit-internal-authorization': '' }
      )
    ).rejects.toMatchObject({ status: 401 });
    expect(h.admit).not.toHaveBeenCalled();
  });
});
