import { createHash } from 'node:crypto';

export type TrustedPublicEligibilityIdV1 = `trusted-public-eligibility_${string}`;
export type TrustedPublicProjectionIdV1 = `trusted-public-projection_${string}`;

export const trustedPublicExposureStates = [
  'PRIVATE_NETWORK_ONLY',
  'TRUSTED_PUBLIC_ELIGIBLE',
  'PUBLICLY_EXPOSED'
] as const;
export type TrustedPublicExposureStateV1 = (typeof trustedPublicExposureStates)[number];

export const trustedPublicAudienceKinds = ['PUBLIC_WEB', 'PUBLIC_DIRECTORY'] as const;
export type TrustedPublicAudienceKindV1 = (typeof trustedPublicAudienceKinds)[number];

export const trustedPublicFieldClasses = [
  'PROVIDER_DISPLAY_NAME',
  'PUBLIC_PROVIDER_SLUG',
  'GEOGRAPHIC_COVERAGE',
  'JURISDICTION_COVERAGE',
  'SERVICE_CATEGORY',
  'LANGUAGE_DESCRIPTOR',
  'PUBLIC_PROFILE_DESCRIPTION',
  'DIRECT_EXECUTOR_STATEMENT',
  'TRUST_SOURCE_CLASS',
  'TRUST_FRESHNESS_CLASS',
  'TRUST_LIMITATION_CODES',
  'TRUST_CONTRADICTION_STATE'
] as const;
export type TrustedPublicFieldClassV1 = (typeof trustedPublicFieldClasses)[number];

export const trustedPublicServeDenialReasons = [
  'PRIVATE_NETWORK_ONLY',
  'ELIGIBILITY_NOT_CURRENT',
  'ELIGIBILITY_REVOKED',
  'ELIGIBILITY_SUPERSEDED',
  'ELIGIBILITY_EXPIRED',
  'PURPOSE_NOT_AUTHORIZED',
  'AUDIENCE_NOT_AUTHORIZED',
  'FIELD_NOT_AUTHORIZED',
  'PARTICIPATION_NOT_CURRENT',
  'VISIBILITY_NOT_CURRENT',
  'SOURCE_NOT_CURRENT',
  'TRUST_AUTHORITY_NOT_CURRENT',
  'DIRECT_EXECUTOR_NOT_ESTABLISHED',
  'AUTHORITY_UNAVAILABLE',
  'MALFORMED_OR_AMBIGUOUS_AUTHORITY'
] as const;
export type TrustedPublicServeDenialReasonV1 = (typeof trustedPublicServeDenialReasons)[number];

const trustedPublicDeniedStates = ['PRIVATE_NETWORK_ONLY', 'TRUSTED_PUBLIC_ELIGIBLE'] as const;

export interface TrustedPublicAuthorityConsequencesV1 {
  providerSelected: false;
  providerAllocated: false;
  providerAccepted: false;
  providerEngaged: false;
  providerContactAuthorized: false;
  professionalAppointmentCreated: false;
  controlledHandoffAuthorized: false;
  protectedActionReleased: false;
  filingAuthorized: false;
  filingSubmitted: false;
  paymentAuthorized: false;
  officialTruthCreated: false;
  matterCompleted: false;
  artifactRetrievalAuthorized: false;
}

export const noTrustedPublicAuthorityConsequences = Object.freeze({
  providerSelected: false,
  providerAllocated: false,
  providerAccepted: false,
  providerEngaged: false,
  providerContactAuthorized: false,
  professionalAppointmentCreated: false,
  controlledHandoffAuthorized: false,
  protectedActionReleased: false,
  filingAuthorized: false,
  filingSubmitted: false,
  paymentAuthorized: false,
  officialTruthCreated: false,
  matterCompleted: false,
  artifactRetrievalAuthorized: false
}) satisfies Readonly<TrustedPublicAuthorityConsequencesV1>;

export interface TrustedPublicSourceAuthorityReferenceV1 {
  sourceOwner: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: number | string;
  sourceFingerprintSha256: string;
  currentAuthorityRevalidationRequiredBeforeServe: true;
}

export interface TrustedPublicEligibilityAuthorizationV1 {
  schemaVersion: 1;
  eligibilityId: TrustedPublicEligibilityIdV1;
  version: number;
  subjectProviderId: string;
  subjectOrganizationReference: string;
  authorizingPrincipalReference: string;
  authorizationOwnerReference: string;
  purpose: string;
  audience: TrustedPublicAudienceKindV1;
  allowedFields: readonly TrustedPublicFieldClassV1[];
  effectiveFrom: string;
  expiresAt?: string;
  revokedAt?: string;
  supersededByEligibilityId?: TrustedPublicEligibilityIdV1;
  participationAuthorityReference?: string;
  visibilityAuthorityReference?: string;
  sourceAuthorities: ReadonlyArray<Readonly<TrustedPublicSourceAuthorityReferenceV1>>;
  currentAuthorityRevalidationRequiredBeforeServe: true;
  historicalAuthorizationDoesNotEstablishCurrentEligibility: true;
  publicExposureGrantedByEligibilityAlone: false;
  authorityConsequences: Readonly<TrustedPublicAuthorityConsequencesV1>;
  eligibilityFingerprintSha256: string;
}

export interface TrustedPublicProjectionFieldV1 {
  fieldClass: TrustedPublicFieldClassV1;
  value: string | readonly string[];
  sourceAuthority: Readonly<TrustedPublicSourceAuthorityReferenceV1>;
  trustEvidenceReference?: Readonly<{
    trustEvidenceItemId: string;
    trustEvidenceItemVersion: number;
    trustEvidenceItemFingerprintSha256: string;
    publicAudienceAuthorizationReference: string;
    artifactRetrievalAuthorized: false;
  }>;
}

export interface TrustedPublicProjectionV1 {
  schemaVersion: 1;
  projectionId: TrustedPublicProjectionIdV1;
  version: number;
  eligibility: Readonly<{
    eligibilityId: TrustedPublicEligibilityIdV1;
    version: number;
    eligibilityFingerprintSha256: string;
  }>;
  subjectProviderId: string;
  purpose: string;
  audience: TrustedPublicAudienceKindV1;
  fields: ReadonlyArray<Readonly<TrustedPublicProjectionFieldV1>>;
  currentAuthorityRevalidationRequiredBeforeServe: true;
  rawEvidenceEmbedded: false;
  artifactRetrievalAuthorized: false;
  clientIdentityEmbedded: false;
  relationshipGraphEmbedded: false;
  commercialDataEmbedded: false;
  internalWorkspaceIdentityEmbedded: false;
  authorityConsequences: Readonly<TrustedPublicAuthorityConsequencesV1>;
  projectionFingerprintSha256: string;
}

export type TrustedPublicServeDecisionV1 =
  | Readonly<{
      schemaVersion: 1;
      state: 'PUBLICLY_EXPOSED';
      decision: 'AUTHORIZED';
      projectionId: TrustedPublicProjectionIdV1;
      projectionFingerprintSha256: string;
      eligibilityId: TrustedPublicEligibilityIdV1;
      eligibilityFingerprintSha256: string;
      checkedAt: string;
      authorityReferences: readonly string[];
      currentAuthorityRevalidationPerformed: true;
      authorityConsequences: Readonly<TrustedPublicAuthorityConsequencesV1>;
    }>
  | Readonly<{
      schemaVersion: 1;
      state: 'PRIVATE_NETWORK_ONLY' | 'TRUSTED_PUBLIC_ELIGIBLE';
      decision: 'DENY';
      reason: TrustedPublicServeDenialReasonV1;
      projectionId?: TrustedPublicProjectionIdV1;
      eligibilityId?: TrustedPublicEligibilityIdV1;
      checkedAt: string;
      currentAuthorityRevalidationPerformed: true;
      authorityConsequences: Readonly<TrustedPublicAuthorityConsequencesV1>;
    }>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function sha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function isHexSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function hasNoAuthorityConsequences(value: unknown): value is TrustedPublicAuthorityConsequencesV1 {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Object.keys(noTrustedPublicAuthorityConsequences).every((key) => record[key] === false);
}

function assertIso(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid ${field}`);
  }
}

function assertSourceAuthority(
  value: unknown
): asserts value is TrustedPublicSourceAuthorityReferenceV1 {
  if (!value || typeof value !== 'object') throw new Error('Invalid source authority');
  const source = value as TrustedPublicSourceAuthorityReferenceV1;
  if (
    !source.sourceOwner ||
    !source.sourceType ||
    !source.sourceId ||
    (typeof source.sourceVersion !== 'number' && typeof source.sourceVersion !== 'string') ||
    !isHexSha256(source.sourceFingerprintSha256) ||
    source.currentAuthorityRevalidationRequiredBeforeServe !== true
  ) {
    throw new Error('Invalid source authority');
  }
}

export function trustedPublicEligibilityFingerprintV1(
  value: Omit<TrustedPublicEligibilityAuthorizationV1, 'eligibilityFingerprintSha256'>
): string {
  return sha256(value);
}

export function trustedPublicEligibilityIdV1(fingerprint: string): TrustedPublicEligibilityIdV1 {
  if (!isHexSha256(fingerprint)) throw new Error('Invalid eligibility fingerprint');
  return `trusted-public-eligibility_${fingerprint.slice(0, 32)}`;
}

export function trustedPublicProjectionFingerprintV1(
  value: Omit<TrustedPublicProjectionV1, 'projectionFingerprintSha256'>
): string {
  return sha256(value);
}

export function trustedPublicProjectionIdV1(fingerprint: string): TrustedPublicProjectionIdV1 {
  if (!isHexSha256(fingerprint)) throw new Error('Invalid projection fingerprint');
  return `trusted-public-projection_${fingerprint.slice(0, 32)}`;
}

export function parseTrustedPublicEligibilityAuthorizationV1(
  value: unknown
): TrustedPublicEligibilityAuthorizationV1 {
  if (!value || typeof value !== 'object') throw new Error('Invalid Trusted Public eligibility');
  const item = value as TrustedPublicEligibilityAuthorizationV1;
  if (item.schemaVersion !== 1 || item.version < 1) throw new Error('Invalid eligibility version');
  if (!item.subjectProviderId || !item.subjectOrganizationReference)
    throw new Error('Invalid subject');
  if (!item.authorizingPrincipalReference || !item.authorizationOwnerReference)
    throw new Error('Invalid authority');
  if (!item.purpose || !trustedPublicAudienceKinds.includes(item.audience))
    throw new Error('Invalid purpose/audience');
  if (!Array.isArray(item.allowedFields) || item.allowedFields.length === 0)
    throw new Error('Empty public allowlist');
  if (new Set(item.allowedFields).size !== item.allowedFields.length)
    throw new Error('Duplicate public field');
  if (item.allowedFields.some((field) => !trustedPublicFieldClasses.includes(field)))
    throw new Error('Invalid public field');
  if (!Array.isArray(item.sourceAuthorities) || item.sourceAuthorities.length === 0)
    throw new Error('Missing source authority');
  item.sourceAuthorities.forEach(assertSourceAuthority);
  assertIso(item.effectiveFrom, 'effectiveFrom');
  if (item.expiresAt) assertIso(item.expiresAt, 'expiresAt');
  if (item.revokedAt) assertIso(item.revokedAt, 'revokedAt');
  if (
    item.currentAuthorityRevalidationRequiredBeforeServe !== true ||
    item.historicalAuthorizationDoesNotEstablishCurrentEligibility !== true ||
    item.publicExposureGrantedByEligibilityAlone !== false ||
    !hasNoAuthorityConsequences(item.authorityConsequences)
  ) {
    throw new Error('Invalid eligibility authority locks');
  }
  const { eligibilityFingerprintSha256, eligibilityId, ...body } = item;
  const expected = trustedPublicEligibilityFingerprintV1({
    ...body,
    eligibilityId: 'trusted-public-eligibility_pending'
  });
  if (
    eligibilityFingerprintSha256 !== expected ||
    eligibilityId !== trustedPublicEligibilityIdV1(expected)
  ) {
    throw new Error('Eligibility fingerprint mismatch');
  }
  return Object.freeze(item);
}

export function parseTrustedPublicProjectionV1(value: unknown): TrustedPublicProjectionV1 {
  if (!value || typeof value !== 'object') throw new Error('Invalid Trusted Public projection');
  const item = value as TrustedPublicProjectionV1;
  if (item.schemaVersion !== 1 || item.version < 1 || !item.subjectProviderId || !item.purpose) {
    throw new Error('Invalid projection identity');
  }
  if (
    !trustedPublicAudienceKinds.includes(item.audience) ||
    !Array.isArray(item.fields) ||
    item.fields.length === 0
  ) {
    throw new Error('Invalid projection audience/fields');
  }
  if (item.fields.some((field) => !trustedPublicFieldClasses.includes(field.fieldClass))) {
    throw new Error('Invalid projection field');
  }
  for (const field of item.fields) {
    assertSourceAuthority(field.sourceAuthority);
    if (field.trustEvidenceReference) {
      if (
        !field.trustEvidenceReference.trustEvidenceItemId ||
        field.trustEvidenceReference.trustEvidenceItemVersion < 1 ||
        !isHexSha256(field.trustEvidenceReference.trustEvidenceItemFingerprintSha256) ||
        !field.trustEvidenceReference.publicAudienceAuthorizationReference ||
        field.trustEvidenceReference.artifactRetrievalAuthorized !== false
      ) {
        throw new Error('Invalid Trust Evidence public reference');
      }
    }
  }
  if (
    item.currentAuthorityRevalidationRequiredBeforeServe !== true ||
    item.rawEvidenceEmbedded !== false ||
    item.artifactRetrievalAuthorized !== false ||
    item.clientIdentityEmbedded !== false ||
    item.relationshipGraphEmbedded !== false ||
    item.commercialDataEmbedded !== false ||
    item.internalWorkspaceIdentityEmbedded !== false ||
    !hasNoAuthorityConsequences(item.authorityConsequences)
  ) {
    throw new Error('Invalid projection privacy/authority locks');
  }
  const { projectionFingerprintSha256, projectionId, ...body } = item;
  const expected = trustedPublicProjectionFingerprintV1({
    ...body,
    projectionId: 'trusted-public-projection_pending'
  });
  if (
    projectionFingerprintSha256 !== expected ||
    projectionId !== trustedPublicProjectionIdV1(expected)
  ) {
    throw new Error('Projection fingerprint mismatch');
  }
  return Object.freeze(item);
}

/** Eligibility is authorization metadata; only a current serve decision can establish PUBLICLY_EXPOSED. */
export function parseTrustedPublicServeDecisionV1(value: unknown): TrustedPublicServeDecisionV1 {
  if (!value || typeof value !== 'object') throw new Error('Invalid Trusted Public serve decision');
  const item = value as TrustedPublicServeDecisionV1;
  if (
    item.schemaVersion !== 1 ||
    item.currentAuthorityRevalidationPerformed !== true ||
    !hasNoAuthorityConsequences(item.authorityConsequences)
  ) {
    throw new Error('Invalid serve authority locks');
  }
  assertIso(item.checkedAt, 'checkedAt');
  if (item.decision === 'AUTHORIZED') {
    if (
      (value as { state?: unknown }).state !== 'PUBLICLY_EXPOSED' ||
      !item.projectionId ||
      !item.eligibilityId ||
      !isHexSha256(item.projectionFingerprintSha256) ||
      !isHexSha256(item.eligibilityFingerprintSha256)
    ) {
      throw new Error('Invalid authorized public serve');
    }
  } else if (item.decision === 'DENY') {
    if (
      !trustedPublicDeniedStates.includes(item.state) ||
      !trustedPublicServeDenialReasons.includes(item.reason)
    ) {
      throw new Error('Invalid denied public serve');
    }
  } else {
    throw new Error('Invalid serve decision');
  }
  return Object.freeze(item);
}
