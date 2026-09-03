import {
  noTrustedPublicAuthorityConsequences,
  parseTrustedPublicEligibilityAuthorizationV1,
  parseTrustedPublicProjectionV1,
  parseTrustedPublicServeDecisionV1,
  type TrustedPublicEligibilityAuthorizationV1,
  type TrustedPublicProjectionV1,
  type TrustedPublicServeDecisionV1,
  type TrustedPublicServeDenialReasonV1,
  type TrustedPublicSourceAuthorityReferenceV1
} from '@markorbit/contracts/trusted-public-exposure';

export interface TrustedPublicCurrentAuthorityRequirements {
  participationRequired: boolean;
  visibilityRequired: boolean;
  trustAuthorityRequired: boolean;
  directExecutorRequired: boolean;
}

export interface TrustedPublicCurrentAuthoritySnapshot {
  authorityAvailable: boolean;
  providerIdentityCurrent: boolean;
  organizationIdentityCurrent: boolean;
  participationCurrent: boolean;
  visibilityCurrent: boolean;
  purposeAuthorized: boolean;
  audienceAuthorized: boolean;
  sourceAuthoritiesCurrent: boolean;
  sourceVersionsMatch: boolean;
  sourceOwnerAuthorizationCurrent: boolean;
  trustAuthorityCurrent: boolean;
  directExecutorEstablished: boolean;
  authorityReferences: readonly string[];
}

export interface TrustedPublicCurrentAuthoritySource {
  evaluateCurrentAuthority(input: {
    eligibility: Readonly<TrustedPublicEligibilityAuthorizationV1>;
    projection: Readonly<TrustedPublicProjectionV1>;
    requirements: Readonly<TrustedPublicCurrentAuthorityRequirements>;
  }): Promise<Readonly<TrustedPublicCurrentAuthoritySnapshot>>;
}

export interface TrustedPublicServeRequest {
  eligibility?: unknown;
  projection?: unknown;
}

function sourceAuthorityKey(source: Readonly<TrustedPublicSourceAuthorityReferenceV1>): string {
  return JSON.stringify([
    source.sourceOwner,
    source.sourceType,
    source.sourceId,
    typeof source.sourceVersion,
    source.sourceVersion,
    source.sourceFingerprintSha256
  ]);
}

function sameSourceAuthority(
  left: Readonly<TrustedPublicSourceAuthorityReferenceV1>,
  right: Readonly<TrustedPublicSourceAuthorityReferenceV1>
): boolean {
  return (
    left.sourceOwner === right.sourceOwner &&
    left.sourceType === right.sourceType &&
    left.sourceId === right.sourceId &&
    left.sourceVersion === right.sourceVersion &&
    left.sourceFingerprintSha256 === right.sourceFingerprintSha256
  );
}

function validProjectionValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

function isAuthoritySnapshot(value: unknown): value is TrustedPublicCurrentAuthoritySnapshot {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TrustedPublicCurrentAuthoritySnapshot>;
  return (
    typeof item.authorityAvailable === 'boolean' &&
    typeof item.providerIdentityCurrent === 'boolean' &&
    typeof item.organizationIdentityCurrent === 'boolean' &&
    typeof item.participationCurrent === 'boolean' &&
    typeof item.visibilityCurrent === 'boolean' &&
    typeof item.purposeAuthorized === 'boolean' &&
    typeof item.audienceAuthorized === 'boolean' &&
    typeof item.sourceAuthoritiesCurrent === 'boolean' &&
    typeof item.sourceVersionsMatch === 'boolean' &&
    typeof item.sourceOwnerAuthorizationCurrent === 'boolean' &&
    typeof item.trustAuthorityCurrent === 'boolean' &&
    typeof item.directExecutorEstablished === 'boolean' &&
    Array.isArray(item.authorityReferences) &&
    item.authorityReferences.every(
      (reference) => typeof reference === 'string' && reference.trim().length > 0
    )
  );
}

function currentRequirements(
  eligibility: Readonly<TrustedPublicEligibilityAuthorizationV1>,
  projection: Readonly<TrustedPublicProjectionV1>
): TrustedPublicCurrentAuthorityRequirements {
  return {
    participationRequired: Boolean(eligibility.participationAuthorityReference),
    visibilityRequired: Boolean(eligibility.visibilityAuthorityReference),
    trustAuthorityRequired: projection.fields.some(
      (field) => field.fieldClass.startsWith('TRUST_') || field.trustEvidenceReference !== undefined
    ),
    directExecutorRequired: projection.fields.some(
      (field) => field.fieldClass === 'DIRECT_EXECUTOR_STATEMENT'
    )
  };
}

function deterministicAuthorityReferences(references: readonly string[]): string[] {
  return [...new Set(references.map((reference) => reference.trim()))].sort((left, right) =>
    left.localeCompare(right)
  );
}

/**
 * Owner-local serve-time policy. Historical eligibility/projection metadata is never itself
 * current public-serving authority; every positive decision requires fresh authority evaluation.
 */
export class TrustedPublicExposureService {
  constructor(
    private readonly currentAuthority: TrustedPublicCurrentAuthoritySource,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async evaluateCurrentServe(
    request: Readonly<TrustedPublicServeRequest>
  ): Promise<Readonly<TrustedPublicServeDecisionV1>> {
    const checkedAt = this.now();
    if (Number.isNaN(Date.parse(checkedAt))) throw new Error('Trusted Public runtime clock is invalid');

    const deny = (
      state: 'PRIVATE_NETWORK_ONLY' | 'TRUSTED_PUBLIC_ELIGIBLE',
      reason: TrustedPublicServeDenialReasonV1,
      eligibility?: Readonly<TrustedPublicEligibilityAuthorizationV1>,
      projection?: Readonly<TrustedPublicProjectionV1>
    ): Readonly<TrustedPublicServeDecisionV1> =>
      parseTrustedPublicServeDecisionV1({
        schemaVersion: 1,
        state,
        decision: 'DENY',
        reason,
        ...(projection ? { projectionId: projection.projectionId } : {}),
        ...(eligibility ? { eligibilityId: eligibility.eligibilityId } : {}),
        checkedAt,
        currentAuthorityRevalidationPerformed: true,
        authorityConsequences: noTrustedPublicAuthorityConsequences
      });

    if (request.eligibility === undefined || request.eligibility === null) {
      return deny('PRIVATE_NETWORK_ONLY', 'PRIVATE_NETWORK_ONLY');
    }

    let eligibility: Readonly<TrustedPublicEligibilityAuthorizationV1>;
    try {
      eligibility = parseTrustedPublicEligibilityAuthorizationV1(request.eligibility);
    } catch {
      return deny('PRIVATE_NETWORK_ONLY', 'MALFORMED_OR_AMBIGUOUS_AUTHORITY');
    }

    let projection: Readonly<TrustedPublicProjectionV1>;
    try {
      projection = parseTrustedPublicProjectionV1(request.projection);
    } catch {
      return deny(
        'TRUSTED_PUBLIC_ELIGIBLE',
        'MALFORMED_OR_AMBIGUOUS_AUTHORITY',
        eligibility
      );
    }

    if (
      projection.eligibility.eligibilityId !== eligibility.eligibilityId ||
      projection.eligibility.version !== eligibility.version ||
      projection.eligibility.eligibilityFingerprintSha256 !==
        eligibility.eligibilityFingerprintSha256
    ) {
      return deny('PRIVATE_NETWORK_ONLY', 'ELIGIBILITY_NOT_CURRENT', eligibility, projection);
    }
    if (
      projection.subjectProviderId !== eligibility.subjectProviderId ||
      projection.subjectProviderId.trim().length === 0 ||
      eligibility.subjectOrganizationReference.trim().length === 0
    ) {
      return deny(
        'TRUSTED_PUBLIC_ELIGIBLE',
        'MALFORMED_OR_AMBIGUOUS_AUTHORITY',
        eligibility,
        projection
      );
    }
    if (projection.purpose !== eligibility.purpose) {
      return deny('TRUSTED_PUBLIC_ELIGIBLE', 'PURPOSE_NOT_AUTHORIZED', eligibility, projection);
    }
    if (projection.audience !== eligibility.audience) {
      return deny('TRUSTED_PUBLIC_ELIGIBLE', 'AUDIENCE_NOT_AUTHORIZED', eligibility, projection);
    }

    const allowedFields = new Set(eligibility.allowedFields);
    const projectedClasses = projection.fields.map((field) => field.fieldClass);
    if (new Set(projectedClasses).size !== projectedClasses.length) {
      return deny(
        'TRUSTED_PUBLIC_ELIGIBLE',
        'MALFORMED_OR_AMBIGUOUS_AUTHORITY',
        eligibility,
        projection
      );
    }
    if (projection.fields.some((field) => !allowedFields.has(field.fieldClass))) {
      return deny('TRUSTED_PUBLIC_ELIGIBLE', 'FIELD_NOT_AUTHORIZED', eligibility, projection);
    }
    if (projection.fields.some((field) => !validProjectionValue(field.value))) {
      return deny(
        'TRUSTED_PUBLIC_ELIGIBLE',
        'MALFORMED_OR_AMBIGUOUS_AUTHORITY',
        eligibility,
        projection
      );
    }

    const eligibilitySourceKeys = eligibility.sourceAuthorities.map(sourceAuthorityKey);
    if (new Set(eligibilitySourceKeys).size !== eligibilitySourceKeys.length) {
      return deny(
        'TRUSTED_PUBLIC_ELIGIBLE',
        'MALFORMED_OR_AMBIGUOUS_AUTHORITY',
        eligibility,
        projection
      );
    }
    if (
      projection.fields.some(
        (field) =>
          !eligibility.sourceAuthorities.some((source) =>
            sameSourceAuthority(source, field.sourceAuthority)
          )
      )
    ) {
      return deny('TRUSTED_PUBLIC_ELIGIBLE', 'SOURCE_NOT_CURRENT', eligibility, projection);
    }

    const effectiveFrom = Date.parse(eligibility.effectiveFrom);
    const expiresAt = eligibility.expiresAt ? Date.parse(eligibility.expiresAt) : undefined;
    const revokedAt = eligibility.revokedAt ? Date.parse(eligibility.revokedAt) : undefined;
    const nowMillis = Date.parse(checkedAt);
    if (
      (expiresAt !== undefined && expiresAt <= effectiveFrom) ||
      (revokedAt !== undefined && revokedAt < effectiveFrom) ||
      eligibility.supersededByEligibilityId === eligibility.eligibilityId
    ) {
      return deny(
        'PRIVATE_NETWORK_ONLY',
        'MALFORMED_OR_AMBIGUOUS_AUTHORITY',
        eligibility,
        projection
      );
    }
    if (eligibility.revokedAt) {
      return deny('PRIVATE_NETWORK_ONLY', 'ELIGIBILITY_REVOKED', eligibility, projection);
    }
    if (eligibility.supersededByEligibilityId) {
      return deny('PRIVATE_NETWORK_ONLY', 'ELIGIBILITY_SUPERSEDED', eligibility, projection);
    }
    if (expiresAt !== undefined && nowMillis >= expiresAt) {
      return deny('PRIVATE_NETWORK_ONLY', 'ELIGIBILITY_EXPIRED', eligibility, projection);
    }
    if (nowMillis < effectiveFrom) {
      return deny('PRIVATE_NETWORK_ONLY', 'ELIGIBILITY_NOT_CURRENT', eligibility, projection);
    }

    const requirements = currentRequirements(eligibility, projection);
    let authority: unknown;
    try {
      authority = await this.currentAuthority.evaluateCurrentAuthority({
        eligibility,
        projection,
        requirements
      });
    } catch {
      return deny('TRUSTED_PUBLIC_ELIGIBLE', 'AUTHORITY_UNAVAILABLE', eligibility, projection);
    }
    if (!isAuthoritySnapshot(authority)) {
      return deny(
        'TRUSTED_PUBLIC_ELIGIBLE',
        'MALFORMED_OR_AMBIGUOUS_AUTHORITY',
        eligibility,
        projection
      );
    }
    if (!authority.authorityAvailable) {
      return deny('TRUSTED_PUBLIC_ELIGIBLE', 'AUTHORITY_UNAVAILABLE', eligibility, projection);
    }
    if (!authority.providerIdentityCurrent || !authority.organizationIdentityCurrent) {
      return deny('PRIVATE_NETWORK_ONLY', 'ELIGIBILITY_NOT_CURRENT', eligibility, projection);
    }
    if (!authority.purposeAuthorized) {
      return deny('TRUSTED_PUBLIC_ELIGIBLE', 'PURPOSE_NOT_AUTHORIZED', eligibility, projection);
    }
    if (!authority.audienceAuthorized) {
      return deny('TRUSTED_PUBLIC_ELIGIBLE', 'AUDIENCE_NOT_AUTHORIZED', eligibility, projection);
    }
    if (requirements.participationRequired && !authority.participationCurrent) {
      return deny('TRUSTED_PUBLIC_ELIGIBLE', 'PARTICIPATION_NOT_CURRENT', eligibility, projection);
    }
    if (requirements.visibilityRequired && !authority.visibilityCurrent) {
      return deny('TRUSTED_PUBLIC_ELIGIBLE', 'VISIBILITY_NOT_CURRENT', eligibility, projection);
    }
    if (
      !authority.sourceAuthoritiesCurrent ||
      !authority.sourceVersionsMatch ||
      !authority.sourceOwnerAuthorizationCurrent
    ) {
      return deny('TRUSTED_PUBLIC_ELIGIBLE', 'SOURCE_NOT_CURRENT', eligibility, projection);
    }
    if (requirements.trustAuthorityRequired && !authority.trustAuthorityCurrent) {
      return deny(
        'TRUSTED_PUBLIC_ELIGIBLE',
        'TRUST_AUTHORITY_NOT_CURRENT',
        eligibility,
        projection
      );
    }
    if (requirements.directExecutorRequired && !authority.directExecutorEstablished) {
      return deny(
        'TRUSTED_PUBLIC_ELIGIBLE',
        'DIRECT_EXECUTOR_NOT_ESTABLISHED',
        eligibility,
        projection
      );
    }

    const authorityReferences = deterministicAuthorityReferences(authority.authorityReferences);
    if (authorityReferences.length === 0) {
      return deny(
        'TRUSTED_PUBLIC_ELIGIBLE',
        'MALFORMED_OR_AMBIGUOUS_AUTHORITY',
        eligibility,
        projection
      );
    }

    return parseTrustedPublicServeDecisionV1({
      schemaVersion: 1,
      state: 'PUBLICLY_EXPOSED',
      decision: 'AUTHORIZED',
      projectionId: projection.projectionId,
      projectionFingerprintSha256: projection.projectionFingerprintSha256,
      eligibilityId: eligibility.eligibilityId,
      eligibilityFingerprintSha256: eligibility.eligibilityFingerprintSha256,
      checkedAt,
      authorityReferences,
      currentAuthorityRevalidationPerformed: true,
      authorityConsequences: noTrustedPublicAuthorityConsequences
    });
  }
}
