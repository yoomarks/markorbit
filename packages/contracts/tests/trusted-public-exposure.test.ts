import { describe, expect, it } from 'vitest';
import {
  noTrustedPublicAuthorityConsequences,
  parseTrustedPublicEligibilityAuthorizationV1,
  parseTrustedPublicProjectionV1,
  parseTrustedPublicServeDecisionV1,
  trustedPublicEligibilityFingerprintV1,
  trustedPublicEligibilityIdV1,
  trustedPublicProjectionFingerprintV1,
  trustedPublicProjectionIdV1,
  type TrustedPublicEligibilityAuthorizationV1,
  type TrustedPublicProjectionV1
} from '../src/trusted-public-exposure.js';

const hash = (char: string) => char.repeat(64);

function eligibility(): TrustedPublicEligibilityAuthorizationV1 {
  const body = {
    schemaVersion: 1 as const,
    eligibilityId: 'trusted-public-eligibility_pending' as const,
    version: 1,
    subjectProviderId: 'provider_123',
    subjectOrganizationReference: 'org_123',
    authorizingPrincipalReference: 'principal_123',
    authorizationOwnerReference: 'org-authority_123',
    purpose: 'PUBLIC_PROVIDER_DISCOVERY',
    audience: 'PUBLIC_WEB' as const,
    allowedFields: ['PROVIDER_DISPLAY_NAME', 'SERVICE_CATEGORY'] as const,
    effectiveFrom: '2026-09-03T00:00:00.000Z',
    sourceAuthorities: [
      {
        sourceOwner: 'MGSN',
        sourceType: 'SUPPLY_CAPABILITY',
        sourceId: 'supply_123',
        sourceVersion: 4,
        sourceFingerprintSha256: hash('a'),
        currentAuthorityRevalidationRequiredBeforeServe: true as const
      }
    ],
    currentAuthorityRevalidationRequiredBeforeServe: true as const,
    historicalAuthorizationDoesNotEstablishCurrentEligibility: true as const,
    publicExposureGrantedByEligibilityAlone: false as const,
    authorityConsequences: noTrustedPublicAuthorityConsequences
  };
  const fingerprint = trustedPublicEligibilityFingerprintV1(body);
  return {
    ...body,
    eligibilityId: trustedPublicEligibilityIdV1(fingerprint),
    eligibilityFingerprintSha256: fingerprint
  };
}

function projection(source = eligibility()): TrustedPublicProjectionV1 {
  const body = {
    schemaVersion: 1 as const,
    projectionId: 'trusted-public-projection_pending' as const,
    version: 1,
    eligibility: {
      eligibilityId: source.eligibilityId,
      version: source.version,
      eligibilityFingerprintSha256: source.eligibilityFingerprintSha256
    },
    subjectProviderId: source.subjectProviderId,
    purpose: source.purpose,
    audience: source.audience,
    fields: [
      {
        fieldClass: 'PROVIDER_DISPLAY_NAME' as const,
        value: 'Example Provider',
        sourceAuthority: source.sourceAuthorities[0]!
      }
    ],
    currentAuthorityRevalidationRequiredBeforeServe: true as const,
    rawEvidenceEmbedded: false as const,
    artifactRetrievalAuthorized: false as const,
    clientIdentityEmbedded: false as const,
    relationshipGraphEmbedded: false as const,
    commercialDataEmbedded: false as const,
    internalWorkspaceIdentityEmbedded: false as const,
    authorityConsequences: noTrustedPublicAuthorityConsequences
  };
  const fingerprint = trustedPublicProjectionFingerprintV1(body);
  return {
    ...body,
    projectionId: trustedPublicProjectionIdV1(fingerprint),
    projectionFingerprintSha256: fingerprint
  };
}

describe('Trusted Public Exposure V1', () => {
  it('parses deterministic bounded eligibility and keeps eligibility separate from exposure', () => {
    const value = eligibility();
    expect(parseTrustedPublicEligibilityAuthorizationV1(value)).toEqual(value);
    expect(value.publicExposureGrantedByEligibilityAlone).toBe(false);
    expect(value.currentAuthorityRevalidationRequiredBeforeServe).toBe(true);
    expect(trustedPublicEligibilityFingerprintV1({
      ...value,
      eligibilityFingerprintSha256: undefined as never
    } as never)).not.toBe('');
  });

  it('parses a privacy-safe projection without artifact, relationship or commercial authority', () => {
    const value = projection();
    expect(parseTrustedPublicProjectionV1(value)).toEqual(value);
    expect(value.artifactRetrievalAuthorized).toBe(false);
    expect(value.relationshipGraphEmbedded).toBe(false);
    expect(value.commercialDataEmbedded).toBe(false);
  });

  it('rejects a projection that attempts to grant a downstream authority consequence', () => {
    const value = projection();
    expect(() =>
      parseTrustedPublicProjectionV1({
        ...value,
        authorityConsequences: {
          ...value.authorityConsequences,
          providerSelected: true
        }
      })
    ).toThrow('Invalid projection privacy/authority locks');
  });

  it('rejects eligibility fingerprint drift and duplicate allowlist fields', () => {
    const value = eligibility();
    expect(() =>
      parseTrustedPublicEligibilityAuthorizationV1({
        ...value,
        purpose: 'DIFFERENT_PURPOSE'
      })
    ).toThrow('Eligibility fingerprint mismatch');
    expect(() =>
      parseTrustedPublicEligibilityAuthorizationV1({
        ...value,
        allowedFields: ['PROVIDER_DISPLAY_NAME', 'PROVIDER_DISPLAY_NAME']
      })
    ).toThrow('Duplicate public field');
  });

  it('allows PUBLICLY_EXPOSED only for an explicit authorized serve decision after revalidation', () => {
    const e = eligibility();
    const p = projection(e);
    const decision = {
      schemaVersion: 1 as const,
      state: 'PUBLICLY_EXPOSED' as const,
      decision: 'AUTHORIZED' as const,
      projectionId: p.projectionId,
      projectionFingerprintSha256: p.projectionFingerprintSha256,
      eligibilityId: e.eligibilityId,
      eligibilityFingerprintSha256: e.eligibilityFingerprintSha256,
      checkedAt: '2026-09-03T00:05:00.000Z',
      authorityReferences: ['org-authority_123', 'supply_123'],
      currentAuthorityRevalidationPerformed: true as const,
      authorityConsequences: noTrustedPublicAuthorityConsequences
    };
    expect(parseTrustedPublicServeDecisionV1(decision)).toEqual(decision);
  });

  it('fails closed for denied or malformed public serve state', () => {
    const denied = {
      schemaVersion: 1 as const,
      state: 'TRUSTED_PUBLIC_ELIGIBLE' as const,
      decision: 'DENY' as const,
      reason: 'SOURCE_NOT_CURRENT' as const,
      checkedAt: '2026-09-03T00:05:00.000Z',
      currentAuthorityRevalidationPerformed: true as const,
      authorityConsequences: noTrustedPublicAuthorityConsequences
    };
    expect(parseTrustedPublicServeDecisionV1(denied)).toEqual(denied);
    expect(() => parseTrustedPublicServeDecisionV1({ ...denied, state: 'PUBLICLY_EXPOSED' })).toThrow(
      'Invalid denied public serve'
    );
  });
});
