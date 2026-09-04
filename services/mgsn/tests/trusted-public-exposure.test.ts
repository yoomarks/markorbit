import { describe, expect, it } from 'vitest';
import {
  noTrustedPublicAuthorityConsequences,
  trustedPublicEligibilityFingerprintV1,
  trustedPublicEligibilityIdV1,
  trustedPublicProjectionFingerprintV1,
  trustedPublicProjectionIdV1,
  type TrustedPublicEligibilityAuthorizationV1,
  type TrustedPublicProjectionFieldV1,
  type TrustedPublicProjectionV1
} from '@markorbit/contracts/trusted-public-exposure';
import {
  TrustedPublicExposureService,
  type TrustedPublicCurrentAuthorityRequirements,
  type TrustedPublicCurrentAuthoritySnapshot
} from '../src/trusted-public-exposure.js';

const now = '2026-09-03T02:50:00.000Z';
const hash = (char: string) => char.repeat(64);

function authority(
  overrides: Partial<TrustedPublicCurrentAuthoritySnapshot> = {}
): TrustedPublicCurrentAuthoritySnapshot {
  return {
    authorityAvailable: true,
    providerIdentityCurrent: true,
    organizationIdentityCurrent: true,
    participationCurrent: true,
    visibilityCurrent: true,
    purposeAuthorized: true,
    audienceAuthorized: true,
    sourceAuthoritiesCurrent: true,
    sourceVersionsMatch: true,
    sourceOwnerAuthorizationCurrent: true,
    trustAuthorityCurrent: true,
    directExecutorEstablished: true,
    authorityReferences: ['authority:visibility:current', 'authority:provider:current'],
    ...overrides
  };
}

type EligibilityOverrides = Partial<
  Omit<TrustedPublicEligibilityAuthorizationV1, 'eligibilityId' | 'eligibilityFingerprintSha256'>
>;

function eligibility(
  overrides: EligibilityOverrides = {}
): TrustedPublicEligibilityAuthorizationV1 {
  const body: Omit<TrustedPublicEligibilityAuthorizationV1, 'eligibilityFingerprintSha256'> = {
    schemaVersion: 1,
    eligibilityId: 'trusted-public-eligibility_pending',
    version: 1,
    subjectProviderId: 'provider_684',
    subjectOrganizationReference: 'org_684',
    authorizingPrincipalReference: 'principal_684',
    authorizationOwnerReference: 'org-authority_684',
    purpose: 'PUBLIC_PROVIDER_DISCOVERY',
    audience: 'PUBLIC_WEB',
    allowedFields: [
      'PROVIDER_DISPLAY_NAME',
      'SERVICE_CATEGORY',
      'DIRECT_EXECUTOR_STATEMENT',
      'TRUST_LIMITATION_CODES'
    ],
    effectiveFrom: '2026-09-03T00:00:00.000Z',
    expiresAt: '2026-09-04T00:00:00.000Z',
    participationAuthorityReference: 'network-participation:684',
    visibilityAuthorityReference: 'network-visibility:684',
    sourceAuthorities: [
      {
        sourceOwner: 'MGSN',
        sourceType: 'PROVIDER_PUBLIC_PROFILE',
        sourceId: 'provider-public-profile_684',
        sourceVersion: 2,
        sourceFingerprintSha256: hash('a'),
        currentAuthorityRevalidationRequiredBeforeServe: true
      }
    ],
    currentAuthorityRevalidationRequiredBeforeServe: true,
    historicalAuthorizationDoesNotEstablishCurrentEligibility: true,
    publicExposureGrantedByEligibilityAlone: false,
    authorityConsequences: noTrustedPublicAuthorityConsequences,
    ...overrides
  };
  const fingerprint = trustedPublicEligibilityFingerprintV1(body);
  return {
    ...body,
    eligibilityId: trustedPublicEligibilityIdV1(fingerprint),
    eligibilityFingerprintSha256: fingerprint
  };
}

type ProjectionOverrides = Partial<
  Omit<TrustedPublicProjectionV1, 'projectionId' | 'projectionFingerprintSha256'>
>;

function projection(
  source: TrustedPublicEligibilityAuthorizationV1,
  overrides: ProjectionOverrides = {}
): TrustedPublicProjectionV1 {
  const body: Omit<TrustedPublicProjectionV1, 'projectionFingerprintSha256'> = {
    schemaVersion: 1,
    projectionId: 'trusted-public-projection_pending',
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
        fieldClass: 'PROVIDER_DISPLAY_NAME',
        value: 'Provider 684',
        sourceAuthority: source.sourceAuthorities[0]!
      }
    ],
    currentAuthorityRevalidationRequiredBeforeServe: true,
    rawEvidenceEmbedded: false,
    artifactRetrievalAuthorized: false,
    clientIdentityEmbedded: false,
    relationshipGraphEmbedded: false,
    commercialDataEmbedded: false,
    internalWorkspaceIdentityEmbedded: false,
    authorityConsequences: noTrustedPublicAuthorityConsequences,
    ...overrides
  };
  const fingerprint = trustedPublicProjectionFingerprintV1(body);
  return {
    ...body,
    projectionId: trustedPublicProjectionIdV1(fingerprint),
    projectionFingerprintSha256: fingerprint
  };
}

function service(
  snapshot: TrustedPublicCurrentAuthoritySnapshot = authority(),
  observe?: (requirements: Readonly<TrustedPublicCurrentAuthorityRequirements>) => void
) {
  return new TrustedPublicExposureService(
    {
      evaluateCurrentAuthority: ({ requirements }) => {
        observe?.(requirements);
        return Promise.resolve(snapshot);
      }
    },
    () => now
  );
}

describe('Trusted Public Exposure owner-local serve runtime', () => {
  it('authorizes only after exact binding and current authority revalidation', async () => {
    const e = eligibility();
    const p = projection(e);
    let requirements: TrustedPublicCurrentAuthorityRequirements | undefined;
    const decision = await service(authority(), (value) => {
      requirements = value;
    }).evaluateCurrentServe({ eligibility: e, projection: p });

    expect(decision.decision).toBe('AUTHORIZED');
    expect(decision.state).toBe('PUBLICLY_EXPOSED');
    expect(decision.authorityConsequences).toEqual(noTrustedPublicAuthorityConsequences);
    expect(decision.authorityConsequences.artifactRetrievalAuthorized).toBe(false);
    expect(requirements).toEqual({
      participationRequired: true,
      visibilityRequired: true,
      trustAuthorityRequired: false,
      directExecutorRequired: false
    });
    if (decision.decision === 'AUTHORIZED') {
      expect(decision.authorityReferences).toEqual([
        'authority:provider:current',
        'authority:visibility:current'
      ]);
    }
  });

  it('keeps missing eligibility private without consulting a current authority source', async () => {
    let called = false;
    const runtime = new TrustedPublicExposureService(
      {
        evaluateCurrentAuthority: () => {
          called = true;
          return Promise.resolve(authority());
        }
      },
      () => now
    );
    const decision = await runtime.evaluateCurrentServe({});
    expect(decision).toMatchObject({
      state: 'PRIVATE_NETWORK_ONLY',
      decision: 'DENY',
      reason: 'PRIVATE_NETWORK_ONLY'
    });
    expect(called).toBe(false);
  });

  it('fails closed for malformed eligibility or projection instead of surfacing partial data', async () => {
    const e = eligibility();
    const malformedEligibility = { ...e, purpose: 'tampered-without-fingerprint-refresh' };
    expect(
      await service().evaluateCurrentServe({
        eligibility: malformedEligibility,
        projection: projection(e)
      })
    ).toMatchObject({
      state: 'PRIVATE_NETWORK_ONLY',
      decision: 'DENY',
      reason: 'MALFORMED_OR_AMBIGUOUS_AUTHORITY'
    });

    const malformedProjection = projection(e, {
      fields: [
        {
          fieldClass: 'PROVIDER_DISPLAY_NAME',
          value: '',
          sourceAuthority: e.sourceAuthorities[0]!
        }
      ]
    });
    expect(
      await service().evaluateCurrentServe({ eligibility: e, projection: malformedProjection })
    ).toMatchObject({ decision: 'DENY', reason: 'MALFORMED_OR_AMBIGUOUS_AUTHORITY' });
  });

  it('requires the projection to bind the exact current eligibility identity, version and fingerprint', async () => {
    const current = eligibility();
    const old = eligibility({ version: 2 });
    const p = projection(old);
    expect(
      await service().evaluateCurrentServe({ eligibility: current, projection: p })
    ).toMatchObject({
      state: 'PRIVATE_NETWORK_ONLY',
      decision: 'DENY',
      reason: 'ELIGIBILITY_NOT_CURRENT'
    });
  });

  it('enforces the exact field allowlist and source-authority binding', async () => {
    const e = eligibility({ allowedFields: ['PROVIDER_DISPLAY_NAME'] });
    const unauthorizedField = projection(e, {
      fields: [
        {
          fieldClass: 'SERVICE_CATEGORY',
          value: 'Trademark Filing',
          sourceAuthority: e.sourceAuthorities[0]!
        }
      ]
    });
    expect(
      await service().evaluateCurrentServe({ eligibility: e, projection: unauthorizedField })
    ).toMatchObject({ decision: 'DENY', reason: 'FIELD_NOT_AUTHORIZED' });

    const differentSource: TrustedPublicProjectionFieldV1 = {
      fieldClass: 'PROVIDER_DISPLAY_NAME',
      value: 'Provider 684',
      sourceAuthority: {
        ...e.sourceAuthorities[0]!,
        sourceVersion: 3,
        sourceFingerprintSha256: hash('b')
      }
    };
    const sourceMismatch = projection(e, { fields: [differentSource] });
    expect(
      await service().evaluateCurrentServe({ eligibility: e, projection: sourceMismatch })
    ).toMatchObject({ decision: 'DENY', reason: 'SOURCE_NOT_CURRENT' });
  });

  it('fails closed for revoked, superseded, expired, or not-yet-effective eligibility', async () => {
    const revoked = eligibility({ revokedAt: '2026-09-03T02:00:00.000Z' });
    expect(
      await service().evaluateCurrentServe({
        eligibility: revoked,
        projection: projection(revoked)
      })
    ).toMatchObject({ state: 'PRIVATE_NETWORK_ONLY', reason: 'ELIGIBILITY_REVOKED' });

    const superseded = eligibility({
      supersededByEligibilityId: 'trusted-public-eligibility_replacement'
    });
    expect(
      await service().evaluateCurrentServe({
        eligibility: superseded,
        projection: projection(superseded)
      })
    ).toMatchObject({ state: 'PRIVATE_NETWORK_ONLY', reason: 'ELIGIBILITY_SUPERSEDED' });

    const expired = eligibility({ expiresAt: '2026-09-03T02:45:00.000Z' });
    expect(
      await service().evaluateCurrentServe({
        eligibility: expired,
        projection: projection(expired)
      })
    ).toMatchObject({ state: 'PRIVATE_NETWORK_ONLY', reason: 'ELIGIBILITY_EXPIRED' });

    const future = eligibility({ effectiveFrom: '2026-09-03T03:00:00.000Z' });
    expect(
      await service().evaluateCurrentServe({ eligibility: future, projection: projection(future) })
    ).toMatchObject({ state: 'PRIVATE_NETWORK_ONLY', reason: 'ELIGIBILITY_NOT_CURRENT' });
  });

  it('maps unavailable and stale current authorities to bounded fail-closed reasons', async () => {
    const e = eligibility();
    const p = projection(e);
    expect(
      await service(authority({ authorityAvailable: false })).evaluateCurrentServe({
        eligibility: e,
        projection: p
      })
    ).toMatchObject({ decision: 'DENY', reason: 'AUTHORITY_UNAVAILABLE' });
    expect(
      await service(authority({ participationCurrent: false })).evaluateCurrentServe({
        eligibility: e,
        projection: p
      })
    ).toMatchObject({ decision: 'DENY', reason: 'PARTICIPATION_NOT_CURRENT' });
    expect(
      await service(authority({ visibilityCurrent: false })).evaluateCurrentServe({
        eligibility: e,
        projection: p
      })
    ).toMatchObject({ decision: 'DENY', reason: 'VISIBILITY_NOT_CURRENT' });
    expect(
      await service(authority({ sourceVersionsMatch: false })).evaluateCurrentServe({
        eligibility: e,
        projection: p
      })
    ).toMatchObject({ decision: 'DENY', reason: 'SOURCE_NOT_CURRENT' });
  });

  it('requires fresh Trust and Direct-to-Executor authority only when those public fields are projected', async () => {
    const e = eligibility();
    const trustProjection = projection(e, {
      fields: [
        {
          fieldClass: 'TRUST_LIMITATION_CODES',
          value: ['INSUFFICIENT_EVIDENCE'],
          sourceAuthority: e.sourceAuthorities[0]!
        }
      ]
    });
    expect(
      await service(authority({ trustAuthorityCurrent: false })).evaluateCurrentServe({
        eligibility: e,
        projection: trustProjection
      })
    ).toMatchObject({ decision: 'DENY', reason: 'TRUST_AUTHORITY_NOT_CURRENT' });

    const executorProjection = projection(e, {
      fields: [
        {
          fieldClass: 'DIRECT_EXECUTOR_STATEMENT',
          value: 'Handled directly by the identified executor.',
          sourceAuthority: e.sourceAuthorities[0]!
        }
      ]
    });
    expect(
      await service(authority({ directExecutorEstablished: false })).evaluateCurrentServe({
        eligibility: e,
        projection: executorProjection
      })
    ).toMatchObject({ decision: 'DENY', reason: 'DIRECT_EXECUTOR_NOT_ESTABLISHED' });
  });

  it('treats current-authority source exceptions and malformed positive snapshots as denial', async () => {
    const e = eligibility();
    const p = projection(e);
    const throwing = new TrustedPublicExposureService(
      { evaluateCurrentAuthority: () => Promise.reject(new Error('authority source unavailable')) },
      () => now
    );
    expect(await throwing.evaluateCurrentServe({ eligibility: e, projection: p })).toMatchObject({
      decision: 'DENY',
      reason: 'AUTHORITY_UNAVAILABLE'
    });

    expect(
      await service(authority({ authorityReferences: [] })).evaluateCurrentServe({
        eligibility: e,
        projection: p
      })
    ).toMatchObject({ decision: 'DENY', reason: 'MALFORMED_OR_AMBIGUOUS_AUTHORITY' });
  });
});
