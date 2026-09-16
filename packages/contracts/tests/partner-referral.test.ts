import {
  noPartnerCommissionEligibilityAuthorityConsequencesV1,
  noPartnerReferralProgramAuthorityConsequencesV1,
  parsePartnerCommissionEligibilityCandidateV1,
  parsePartnerReferralProgramV1,
  partnerCommissionEligibilityFingerprintSha256V1,
  partnerReferralPolicyFingerprintSha256V1,
  partnerReferralProgramFingerprintSha256V1
} from '../src/partner-referral.js';
import { describe, expect, it } from 'vitest';

const at = '2026-09-17T02:00:00.000Z';

function program() {
  const policyBase = {
    partnerReferralPolicyId: 'partner-referral-policy_v1' as const,
    version: 1 as const,
    requiredAttributionState: 'ATTRIBUTED' as const,
    requiredEvidenceBasis: 'EXACT_LINEAGE' as const,
    qualifyingDownstreamOwner: 'MARKREG' as const,
    qualifyingDownstreamKind: 'FORMAL_MATTER' as const,
    effectiveAt: at,
    ratePolicy: {
      owner: 'CORE' as const,
      kind: 'REFERRAL_COMMISSION' as const,
      id: 'rate-policy_referral-v1',
      version: 1,
      fingerprintSha256: 'd'.repeat(64)
    }
  };
  const base = {
    schemaVersion: 1 as const,
    partnerReferralProgramId: 'partner-referral-program_partner-a' as const,
    workspaceId: '11111111-1111-4111-8111-111111111111',
    version: 1 as const,
    referralCode: 'partner-a',
    partner: {
      owner: 'LITE' as const,
      kind: 'WORKSPACE_DIRECTORY_ENTRY' as const,
      id: 'workspace-directory-entry_partner-a' as const,
      version: 3,
      fingerprintSha256: 'a'.repeat(64)
    },
    policy: {
      ...policyBase,
      policyFingerprintSha256: partnerReferralPolicyFingerprintSha256V1(policyBase)
    },
    status: 'ACTIVE' as const,
    createdByPrincipalId: 'user_manager',
    createdAt: at,
    authorityConsequences: noPartnerReferralProgramAuthorityConsequencesV1
  };
  return parsePartnerReferralProgramV1({
    ...base,
    programFingerprintSha256: partnerReferralProgramFingerprintSha256V1(base)
  });
}

describe('Partner Referral V1', () => {
  it('binds one opaque code to exact partner and replayable eligibility policy lineage', () => {
    const value = program();
    expect(value.partner.kind).toBe('WORKSPACE_DIRECTORY_ENTRY');
    expect(value.policy.qualifyingDownstreamKind).toBe('FORMAL_MATTER');
    expect(Object.values(value.authorityConsequences).every((effect) => !effect)).toBe(true);
  });

  it('records only an eligibility-for-review candidate and never settlement authority', () => {
    const source = program();
    const base = {
      schemaVersion: 1 as const,
      partnerCommissionEligibilityCandidateId: 'partner-commission-eligibility_matter-a' as const,
      workspaceId: source.workspaceId,
      version: 1 as const,
      program: {
        id: source.partnerReferralProgramId,
        version: 1 as const,
        fingerprintSha256: source.programFingerprintSha256
      },
      partner: source.partner,
      policy: {
        id: source.policy.partnerReferralPolicyId,
        version: 1 as const,
        fingerprintSha256: source.policy.policyFingerprintSha256
      },
      siteInboundAttribution: {
        id: 'business-attribution_site-referral' as const,
        version: 1 as const,
        fingerprintSha256: 'b'.repeat(64)
      },
      downstreamRef: {
        owner: 'MARKREG',
        kind: 'FORMAL_MATTER',
        id: 'formal-matter_referred',
        version: 1,
        fingerprintSha256: 'c'.repeat(64),
        observedAt: at
      },
      outcome: 'ELIGIBLE_FOR_COMMISSION_REVIEW' as const,
      evaluatedByPrincipalId: 'user_manager',
      evaluatedAt: at,
      authorityConsequences: noPartnerCommissionEligibilityAuthorityConsequencesV1
    };
    const parsed = parsePartnerCommissionEligibilityCandidateV1({
      ...base,
      eligibilityFingerprintSha256: partnerCommissionEligibilityFingerprintSha256V1(base)
    });
    expect(parsed.outcome).toBe('ELIGIBLE_FOR_COMMISSION_REVIEW');
    expect(parsed.authorityConsequences.commissionAmountCalculated).toBe(false);
    expect(parsed.authorityConsequences.paymentSuccessClaimed).toBe(false);
    expect(parsed.authorityConsequences.settlementClaimed).toBe(false);
    expect(parsed.authorityConsequences.payoutCompleted).toBe(false);
  });

  it('rejects policy fingerprint drift', () => {
    const value = program();
    expect(() =>
      parsePartnerReferralProgramV1({
        ...value,
        policy: { ...value.policy, effectiveAt: '2026-09-18T02:00:00.000Z' }
      })
    ).toThrow('policy fingerprint mismatch');
  });
});
