import { describe, expect, it } from 'vitest';
import {
  noOutboundContactBasisAuthorityConsequencesV1,
  parseOutboundContactBasisAssertionV1,
  parseOutboundContactSuppressionV1
} from '../src/outbound-contact-policy.js';

const basis = {
  schemaVersion: 1 as const,
  assertionId: 'outbound-contact-basis_a',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  version: 1,
  targetRef: { owner: 'LITE', kind: 'PROSPECT', id: 'candidate_1', version: 2 },
  channel: 'EMAIL' as const,
  endpointFingerprintSha256: 'a'.repeat(64),
  purpose: 'PROSPECT_OUTREACH' as const,
  policyRef: { policyId: 'workspace-outreach-policy', version: 3 },
  basisState: 'ASSERTED_ALLOWED' as const,
  evidenceRefs: ['evidence:review:1'],
  assertedByPrincipalId: 'user_1',
  assertedAt: '2026-09-16T00:00:00.000Z',
  status: 'ACTIVE' as const,
  supersedesVersion: null,
  authorityConsequences: noOutboundContactBasisAuthorityConsequencesV1
};

describe('Outbound Contact Policy V1', () => {
  it('accepts a bounded basis assertion while preserving false authority locks', () => {
    expect(parseOutboundContactBasisAssertionV1(basis)).toEqual(basis);
  });
  it('rejects raw recipient data and malformed endpoint fingerprints', () => {
    expect(() =>
      parseOutboundContactBasisAssertionV1({ ...basis, email: 'person@example.com' })
    ).toThrow(/bounded V1/);
    expect(() =>
      parseOutboundContactBasisAssertionV1({
        ...basis,
        endpointFingerprintSha256: 'person@example.com'
      })
    ).toThrow(/SHA-256/);
    expect(() =>
      parseOutboundContactBasisAssertionV1({ ...basis, evidenceRefs: ['person@example.com'] })
    ).toThrow(/raw contact data/);
    expect(() =>
      parseOutboundContactBasisAssertionV1({
        ...basis,
        targetRef: { ...basis.targetRef, id: 'person@example.com' }
      })
    ).toThrow(/raw contact data/);
  });
  it('accepts only the frozen suppression taxonomy and false authority locks', () => {
    const suppression = {
      schemaVersion: 1 as const,
      suppressionId: 'outbound-contact-suppression_a',
      workspaceId: basis.workspaceId,
      version: 1,
      channel: 'EMAIL' as const,
      endpointFingerprintSha256: 'b'.repeat(64),
      scope: 'ALL_OUTBOUND' as const,
      status: 'ACTIVE' as const,
      reasonCode: 'RECIPIENT_OPT_OUT' as const,
      sourceClass: 'MANAGED_COMMUNICATION' as const,
      evidenceRefs: ['managed-message:1'],
      effectiveAt: '2026-09-16T00:00:00.000Z',
      recordedAt: '2026-09-16T00:00:00.000Z',
      recordedByPrincipalId: 'user_1',
      supersedesVersion: null,
      legalConsentVerifiedByMarkOrbit: false as const,
      externalSendAuthorized: false as const
    };
    expect(parseOutboundContactSuppressionV1(suppression)).toEqual(suppression);
    expect(() =>
      parseOutboundContactSuppressionV1({ ...suppression, reasonCode: 'SCRAPED_PUBLIC_EMAIL' })
    ).toThrow(/reasonCode/);
  });
  it('admits only the frozen SMS notification channel combinations', () => {
    expect(
      parseOutboundContactBasisAssertionV1({
        ...basis,
        channel: 'SMS',
        purpose: 'WORKSPACE_NOTIFICATION'
      })
    ).toMatchObject({
      channel: 'SMS',
      purpose: 'WORKSPACE_NOTIFICATION',
      authorityConsequences: {
        legalConsentVerifiedByMarkOrbit: false,
        externalSendAuthorized: false
      }
    });
    expect(() =>
      parseOutboundContactBasisAssertionV1({
        ...basis,
        channel: 'SMS',
        purpose: 'PROSPECT_OUTREACH'
      })
    ).toThrow(/channel and purpose/u);
    expect(() =>
      parseOutboundContactBasisAssertionV1({
        ...basis,
        channel: 'EMAIL',
        purpose: 'WORKSPACE_NOTIFICATION'
      })
    ).toThrow(/channel and purpose/u);
  });

  it('keeps suppression scope bounded by channel', () => {
    const suppression = {
      schemaVersion: 1,
      suppressionId: 'outbound-contact-suppression_sms',
      workspaceId: basis.workspaceId,
      version: 1,
      channel: 'SMS',
      endpointFingerprintSha256: 'b'.repeat(64),
      scope: 'WORKSPACE_NOTIFICATION',
      status: 'ACTIVE',
      reasonCode: 'RECIPIENT_OPT_OUT',
      sourceClass: 'WORKSPACE_USER',
      evidenceRefs: ['review:sms-opt-out'],
      effectiveAt: basis.assertedAt,
      recordedAt: basis.assertedAt,
      recordedByPrincipalId: 'user_1',
      supersedesVersion: null,
      legalConsentVerifiedByMarkOrbit: false,
      externalSendAuthorized: false
    };
    expect(parseOutboundContactSuppressionV1(suppression)).toEqual(suppression);
    expect(() =>
      parseOutboundContactSuppressionV1({ ...suppression, scope: 'PARTNER_OUTREACH' })
    ).toThrow(/channel and suppression scope/u);
  });

});
