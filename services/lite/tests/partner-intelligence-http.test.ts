import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createPartnerIntelligenceRoutes } from '../src/partner-intelligence-http.js';

const secret = 'partner-intelligence-http-secret-0123456789';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session-1',
  userId: 'user-1',
  workspaceId,
  membershipId: 'membership-1',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage'],
  sessionExpiresAt: '2026-09-17T00:00:00.000Z'
};
const headers = {
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
  'x-markorbit-workspace-id': workspaceId,
  'idempotency-key': 'partner-http-1'
};
const service = {
  admit: vi.fn(() => Promise.resolve({ partnerCandidateId: 'partner-candidate_1' } as never)),
  qualify: vi.fn(() =>
    Promise.resolve({ partnerQualificationDecisionId: 'partner-qualification_1' } as never)
  ),
  sendOutreach: vi.fn(() => Promise.resolve({ responseState: 'NOT_OBSERVED' } as never)),
  recordOutcome: vi.fn(() =>
    Promise.resolve({ businessAttributionLinkId: 'business-attribution_1' } as never)
  )
};
const store = {
  findCandidate: vi.fn(() =>
    Promise.resolve({ partnerCandidateId: 'partner-candidate_1' } as never)
  ),
  findQualification: vi.fn(() =>
    Promise.resolve({ partnerQualificationDecisionId: 'partner-qualification_1' } as never)
  )
};
const route = (method: string, path: string) => {
  const found = createPartnerIntelligenceRoutes({
    internalServiceSecret: secret,
    service,
    store
  }).find((item) => item.method === method && item.path === path);
  if (!found) throw new Error(`route ${method} ${path} missing`);
  return found;
};

describe('Partner Intelligence HTTP boundary', () => {
  it('derives admission actor and Workspace only from the trusted Principal', async () => {
    const body = {
      knowledgeReadyPackageId: 'ready-package_1',
      publicEvidenceRefs: [{ owner: 'PUBLIC_SOURCE' }],
      brief: { displayName: 'Example IP Law' }
    };
    const result = await route('POST', '/v1/partner-intelligence/candidates').handle({
      method: 'POST',
      path: '/v1/partner-intelligence/candidates',
      params: {},
      query: {},
      headers,
      body
    });
    expect(result.status).toBe(201);
    expect(service.admit).toHaveBeenCalledWith(
      expect.objectContaining({ principal, idempotencyKey: 'partner-http-1' })
    );
    await expect(
      route('POST', '/v1/partner-intelligence/candidates').handle({
        method: 'POST',
        path: '/v1/partner-intelligence/candidates',
        params: {},
        query: {},
        headers,
        body: { ...body, admittedByPrincipalId: 'spoofed' }
      })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
  });

  it('routes exact candidate qualification, outreach and outcome commands', async () => {
    const candidate = { version: 1, fingerprintSha256: 'a'.repeat(64) };
    const qualificationDecision = {
      id: 'partner-qualification_1',
      version: 1,
      fingerprintSha256: 'b'.repeat(64)
    };
    const base = {
      method: 'POST' as const,
      path: '/v1/partner-intelligence/candidates/partner-candidate_1',
      params: { partnerCandidateId: 'partner-candidate_1' },
      query: {},
      headers
    };
    expect(
      (
        await route(
          'POST',
          '/v1/partner-intelligence/candidates/:partnerCandidateId/qualification'
        ).handle({
          ...base,
          body: { candidate, outcome: 'QUALIFIED', rationale: 'Human reviewed.' }
        })
      ).status
    ).toBe(201);
    expect(
      (
        await route(
          'POST',
          '/v1/partner-intelligence/candidates/:partnerCandidateId/outreach'
        ).handle({
          ...base,
          body: {
            candidate,
            qualificationDecision,
            endpointFingerprintSha256: 'c'.repeat(64),
            policyRef: { policyId: 'policy-1', version: 1 },
            reviewedSendFingerprintSha256: 'd'.repeat(64),
            confirmation: { confirmed: true, acknowledgedEffect: 'SEND_EXTERNAL_PARTNER_EMAIL' },
            message: { schemaVersion: 1 }
          }
        })
      ).status
    ).toBe(200);
    expect(
      (
        await route(
          'POST',
          '/v1/partner-intelligence/candidates/:partnerCandidateId/outcome'
        ).handle({
          ...base,
          body: {
            candidate,
            qualificationDecision,
            directoryEntry: { id: 'workspace-directory-entry_1', version: 1 },
            communicationLink: { id: 'communication-link_1', version: 1 },
            downstreamRef: { owner: 'MARKREG' },
            confirmation: {
              confirmed: true,
              acknowledgedEffect: 'LINK_PARTNER_COOPERATION_OUTCOME'
            }
          }
        })
      ).status
    ).toBe(201);
  });
});
