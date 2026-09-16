import { encodeInternalWorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest, JsonRoute } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createPartnerReferralRoutes } from '../src/partner-referral-http.js';
import type { PartnerReferralService } from '../src/partner-referral.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const secret = 'partner-referral-internal-secret-32-bytes';
const principal = {
  kind: 'WORKSPACE' as const,
  sessionId: 'session_partner_referral',
  userId: 'user_manager',
  workspaceId,
  membershipId: 'membership_partner_referral',
  role: 'WORKSPACE_ADMIN' as const,
  permissions: ['workspace:read' as const, 'workspace:manage' as const],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};

function request(
  method: 'GET' | 'POST',
  body?: unknown,
  params: Record<string, string> = {}
): JsonRequest {
  return {
    method,
    path: '',
    params,
    query: {},
    body,
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      'idempotency-key': 'idem-1'
    }
  };
}

function route(routes: readonly JsonRoute[], path: string): JsonRoute {
  const found = routes.find((candidate) => candidate.path === path);
  if (!found) throw new Error(`Missing route ${path}`);
  return found;
}

describe('Partner Referral HTTP boundary', () => {
  it('derives Workspace and actor authority while creating a referral program', async () => {
    const createProgram = vi.fn(() => Promise.resolve({ status: 'ACTIVE' } as never));
    const routes = createPartnerReferralRoutes({
      internalServiceSecret: secret,
      service: { createProgram } as unknown as PartnerReferralService
    });
    const result = await route(routes, '/v1/partner-referral-programs').handle(
      request('POST', {
        referralCode: 'partner-a',
        partner: {
          id: 'workspace-directory-entry_partner-a',
          version: 1,
          fingerprintSha256: 'a'.repeat(64)
        }
      })
    );
    expect(result.status).toBe(201);
    expect(createProgram).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        actorPrincipalId: principal.userId,
        idempotencyKey: 'idem-1',
        referralCode: 'partner-a'
      })
    );
  });

  it('rejects client-owned fields before evaluating commission eligibility', async () => {
    const evaluate = vi.fn();
    const routes = createPartnerReferralRoutes({
      internalServiceSecret: secret,
      service: { evaluate } as unknown as PartnerReferralService
    });
    await expect(
      route(routes, '/v1/partner-commission-eligibility-candidates').handle(
        request('POST', {
          workspaceId,
          program: {
            id: 'partner-referral-program_partner-a',
            version: 1,
            fingerprintSha256: 'a'.repeat(64)
          },
          siteInboundAttribution: {
            id: 'business-attribution_site-referral',
            version: 1,
            fingerprintSha256: 'b'.repeat(64)
          }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('returns only the bounded Workspace-scoped eligibility candidate', async () => {
    const findCandidate = vi.fn(() =>
      Promise.resolve({
        partnerCommissionEligibilityCandidateId: 'partner-commission-eligibility_1',
        authorityConsequences: { paymentSuccessClaimed: false, payoutCompleted: false }
      } as never)
    );
    const routes = createPartnerReferralRoutes({
      internalServiceSecret: secret,
      service: { findCandidate } as unknown as PartnerReferralService
    });
    const result = await route(
      routes,
      '/v1/partner-commission-eligibility-candidates/:candidateId'
    ).handle(request('GET', undefined, { candidateId: 'partner-commission-eligibility_1' }));
    expect(result.status).toBe(200);
    expect(findCandidate).toHaveBeenCalledWith(workspaceId, 'partner-commission-eligibility_1');
  });
});
