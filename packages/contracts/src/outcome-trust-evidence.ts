import { createHash } from 'node:crypto';
import type { MarkOrbitId } from './index.js';
import type { NetworkParticipationId } from './network-participation.js';
import type { ProviderId, ProviderReturnId, ProviderReturnStatus } from './provider-execution.js';
import type {
  ProviderDirectExecutorAssessmentState,
  ProviderResponsibilityProfileReferenceV1
} from './provider-responsibility.js';

/**
 * Outcome & Trust Evidence V1 is contextual, attributable advisory evidence.
 * It never creates a universal Provider score, routing authority, artifact access,
 * professional authority, Payment/Filing authority or Official Truth.
 */
export type OutcomeObservationIdV1 = `outcome-observation_${string}`;
export type TrustEvidenceItemIdV1 = `trust-evidence-item_${string}`;
export type TrustEvidenceVisibilityProjectionIdV1 = `trust-evidence-projection_${string}`;
export type TrustExplanationIdV1 = `trust-explanation_${string}`;

export const trustEvidenceSourceAuthorityStates = [
  'CURRENT',
  'STALE',
  'AMBIGUOUS',
  'UNAVAILABLE'
] as const;
export type TrustEvidenceSourceAuthorityStateV1 =
  (typeof trustEvidenceSourceAuthorityStates)[number];

export const trustEvidenceLifecycleStates = [
  'CURRENT',
  'CORRECTED',
  'SUPERSEDED',
  'REVOKED',
  'DISPUTED'
] as const;
export type TrustEvidenceLifecycleStateV1 = (typeof trustEvidenceLifecycleStates)[number];

export const trustEvidenceFreshnessStates = [
  'CURRENT_FOR_CONTEXT',
  'STALE',
  'UNKNOWN',
  'SOURCE_UNAVAILABLE'
] as const;
export type TrustEvidenceFreshnessStateV1 = (typeof trustEvidenceFreshnessStates)[number];

export const trustEvidenceOwnerFactKinds = [
  'MGSN_REGISTRY_PROVENANCE',
  'MGSN_SUPPLY_CAPABILITY',
  'MGSN_ALLOCATION',
  'MGSN_PROVIDER_ACCEPTANCE',
  'MGSN_EVIDENCE_HANDOFF',
  'EXECUTION_EVIDENCE_REVIEW',
  'PAYMENT_LIFECYCLE'
] as const;
export type TrustEvidenceOwnerFactKindV1 = (typeof trustEvidenceOwnerFactKinds)[number];

export const trustEvidenceOwnerFactOwners = ['MGSN', 'EXECUTION', 'PAYMENT'] as const;
export type TrustEvidenceOwnerFactOwnerV1 = (typeof trustEvidenceOwnerFactOwners)[number];

export const providerClaimKinds = [
  'WORK_STATUS_CLAIM',
  'STRUCTURED_ASSERTION',
  'EVIDENCE_REFERENCE'
] as const;
export type ProviderClaimKindV1 = (typeof providerClaimKinds)[number];

export const outcomeObservationOwners = [
  'ORIGINATING_WORKSPACE',
  'EXECUTION',
  'OTHER_CANONICAL_OBSERVER'
] as const;
export type OutcomeObservationOwnerV1 = (typeof outcomeObservationOwners)[number];

export const trustEvidenceLineageRelations = [
  'CORRECTS',
  'SUPERSEDES',
  'REVOKES',
  'DISPUTES'
] as const;
export type TrustEvidenceLineageRelationV1 = (typeof trustEvidenceLineageRelations)[number];

export const trustEvidenceLimitationCodes = [
  'CLAIM_NOT_VERIFIED_OUTCOME',
  'INTERNAL_REVIEW_ONLY',
  'PAYMENT_IS_COMMERCIAL_FACT_ONLY',
  'SOURCE_FRESHNESS_LIMITED',
  'SOURCE_AUTHORITY_UNKNOWN',
  'CONTEXT_LIMITED',
  'CONTRADICTORY_EVIDENCE',
  'DISPUTED_EVIDENCE',
  'DIRECT_EXECUTOR_NOT_ESTABLISHED',
  'ARTIFACT_RETRIEVAL_NOT_AUTHORIZED',
  'CURRENT_VISIBILITY_REVALIDATION_REQUIRED',
  'INSUFFICIENT_EVIDENCE',
  'OTHER_MATERIAL_LIMITATION'
] as const;
export type TrustEvidenceLimitationCodeV1 = (typeof trustEvidenceLimitationCodes)[number];

export interface TrustEvidenceAuthorityConsequencesV1 {
  providerSelected: false;
  providerAllocated: false;
  providerAccepted: false;
  providerEngaged: false;
  professionalAppointmentCreated: false;
  externalContactAuthorized: false;
  protectedActionReleased: false;
  filingAuthorized: false;
  filingSubmitted: false;
  paymentAuthorizedByTrustEvidence: false;
  officialTruthCreated: false;
  matterCompleted: false;
  userCapabilityVerifiedAutomatically: false;
}

export const noTrustEvidenceAuthorityConsequences = Object.freeze({
  providerSelected: false,
  providerAllocated: false,
  providerAccepted: false,
  providerEngaged: false,
  professionalAppointmentCreated: false,
  externalContactAuthorized: false,
  protectedActionReleased: false,
  filingAuthorized: false,
  filingSubmitted: false,
  paymentAuthorizedByTrustEvidence: false,
  officialTruthCreated: false,
  matterCompleted: false,
  userCapabilityVerifiedAutomatically: false
}) satisfies Readonly<TrustEvidenceAuthorityConsequencesV1>;

export type OutcomeEvidenceSourceOwnerV1 =
  | 'CORE'
  | 'MGSN'
  | 'EXECUTION'
  | 'PAYMENT'
  | 'CAPABILITY_ENGINE'
  | 'MARKREG'
  | 'OTHER_CANONICAL_OWNER';

/** Evidence reference visibility is provenance only; it never grants artifact retrieval. */
export interface OutcomeEvidenceReferenceV1 {
  evidenceReference: string;
  sourceOwner: OutcomeEvidenceSourceOwnerV1;
  sourceType: string;
  sourceId: string;
  sourceVersion: number | string;
  sourceFingerprintSha256: string;
  recordedAt: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  authorityState: TrustEvidenceSourceAuthorityStateV1;
  checkedAt: string;
  artifactAccessAuthorized: false;
  currentArtifactAuthorizationRequired: true;
}

/** Future authorized observation reference. It is not a free-form public review or duplicate owner truth. */
export interface OutcomeObservationReferenceV1 {
  schemaVersion: 1;
  outcomeObservationId: OutcomeObservationIdV1;
  observationOwner: OutcomeObservationOwnerV1;
  observerReference: string;
  observerAuthorityReference: string;
  providerId: ProviderId;
  contextFingerprintSha256: string;
  observationType: string;
  version: number;
  observationFingerprintSha256: string;
  lifecycleState: TrustEvidenceLifecycleStateV1;
  observedAt: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  evidenceReferences: ReadonlyArray<Readonly<OutcomeEvidenceReferenceV1>>;
  publicReviewCreated: false;
  officialTruthCreated: false;
}

export interface TrustEvidenceCanonicalOwnerFactSourceV1 {
  kind: 'CANONICAL_OWNER_FACT';
  owner: TrustEvidenceOwnerFactOwnerV1;
  factKind: TrustEvidenceOwnerFactKindV1;
  sourceId: string;
  sourceVersion: number | string;
  sourceFingerprintSha256: string;
  recordedAt: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  performanceTruthEstablished: false;
  officialTruthEstablished: false;
}

export interface TrustEvidenceProviderClaimSourceV1 {
  kind: 'PROVIDER_CLAIM';
  owner: 'MGSN';
  providerReturnId: ProviderReturnId;
  providerReturnVersion: number;
  providerReturnFingerprintSha256: string;
  providerReturnStatus: ProviderReturnStatus;
  claimKind: ProviderClaimKindV1;
  claimReference: string;
  submittedAt: string;
  verifiedOutcomeEstablished: false;
  officialTruthEstablished: false;
}

export interface TrustEvidenceOutcomeObservationSourceV1 {
  kind: 'AUTHORIZED_OUTCOME_OBSERVATION';
  observation: Readonly<OutcomeObservationReferenceV1>;
  universalPerformanceTruthEstablished: false;
  officialTruthEstablished: false;
}

export type TrustEvidenceSourceReferenceV1 = Readonly<
  | TrustEvidenceCanonicalOwnerFactSourceV1
  | TrustEvidenceProviderClaimSourceV1
  | TrustEvidenceOutcomeObservationSourceV1
>;

export interface TrustEvidenceSourceAuthorityV1 {
  sourceClass: TrustEvidenceSourceReferenceV1['kind'];
  authorityState: TrustEvidenceSourceAuthorityStateV1;
  checkedAt: string;
  currentSourceRevalidationRequiredBeforeUse: true;
  historicalSourceDoesNotEstablishCurrentSuitability: true;
  universalPerformanceInferenceAuthorized: false;
}

export type TrustEvidenceExecutorAttributionV1 =
  | Readonly<{
      state: 'ESTABLISHED';
      assessmentState:
        | 'DIRECT_FINAL_EXECUTOR_ESTABLISHED'
        | 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED';
      assessmentReference: string;
      assessmentFingerprintSha256: string;
      profile: Readonly<ProviderResponsibilityProfileReferenceV1>;
      finalExecutionProviderId: ProviderId;
      checkedAt: string;
      currentAuthorityRevalidationRequiredBeforeUse: true;
    }>
  | Readonly<{
      state: 'NOT_ESTABLISHED';
      assessmentState: Exclude<
        ProviderDirectExecutorAssessmentState,
        'DIRECT_FINAL_EXECUTOR_ESTABLISHED' | 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED'
      >;
      assessmentReference?: string;
      assessmentFingerprintSha256?: string;
      profile?: Readonly<ProviderResponsibilityProfileReferenceV1>;
      finalExecutionProviderId: null;
      checkedAt: string;
      currentAuthorityRevalidationRequiredBeforeUse: true;
    }>;

/** Context is intentionally service/work scoped and contains no client or relationship identity. */
export interface TrustEvidenceContextV1 {
  providerId: ProviderId;
  contextReference: string;
  contextFingerprintSha256: string;
  jurisdiction: string;
  serviceType: string;
  taskType: string;
  collaborationScope: string;
  executorAttribution: Readonly<TrustEvidenceExecutorAttributionV1>;
  clientIdentityEmbedded: false;
  relationshipIdentityEmbedded: false;
  commercialDataEmbedded: false;
}

export interface TrustEvidenceFreshnessV1 {
  state: TrustEvidenceFreshnessStateV1;
  policyVersion: string;
  checkedAt: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  currentSuitabilityEstablished: false;
}

export interface TrustEvidenceLimitationV1 {
  code: TrustEvidenceLimitationCodeV1;
  explanation: string;
}

export interface TrustEvidenceItemReferenceV1 {
  trustEvidenceItemId: TrustEvidenceItemIdV1;
  version: number;
  trustEvidenceItemFingerprintSha256: string;
}

export interface TrustEvidenceLineageReferenceV1 extends TrustEvidenceItemReferenceV1 {
  relation: TrustEvidenceLineageRelationV1;
}

export interface TrustEvidenceContradictionReferenceV1 extends TrustEvidenceItemReferenceV1 {
  contradictionReference: string;
}

export interface TrustEvidenceItemV1 {
  schemaVersion: 1;
  trustEvidenceItemId: TrustEvidenceItemIdV1;
  version: number;
  providerId: ProviderId;
  lifecycleState: TrustEvidenceLifecycleStateV1;
  context: Readonly<TrustEvidenceContextV1>;
  source: TrustEvidenceSourceReferenceV1;
  sourceAuthority: Readonly<TrustEvidenceSourceAuthorityV1>;
  evidenceReferences: ReadonlyArray<Readonly<OutcomeEvidenceReferenceV1>>;
  freshness: Readonly<TrustEvidenceFreshnessV1>;
  lineage: ReadonlyArray<Readonly<TrustEvidenceLineageReferenceV1>>;
  contradictions: ReadonlyArray<Readonly<TrustEvidenceContradictionReferenceV1>>;
  limitations: ReadonlyArray<Readonly<TrustEvidenceLimitationV1>>;
  trustEvidenceItemFingerprintSha256: string;
  createdAt: string;
  currentExposureAuthorizationRequired: true;
  authorityConsequences: Readonly<TrustEvidenceAuthorityConsequencesV1>;
}

export const trustEvidenceProjectionFields = [
  'CONTEXT',
  'SOURCE_CLASS',
  'SOURCE_AUTHORITY_STATE',
  'FRESHNESS',
  'LIMITATIONS',
  'EVIDENCE_REFERENCE_COUNT',
  'CONTRADICTION_STATE',
  'EXECUTOR_ATTRIBUTION_STATE'
] as const;
export type TrustEvidenceProjectionFieldV1 = (typeof trustEvidenceProjectionFields)[number];

export const trustEvidenceProjectionPurposes = [
  'PROVIDER_DISCOVERY_TRUST_EXPLANATION',
  'PROVIDER_WORKSPACE_EVIDENCE',
  'WORKPLACE_EVIDENCE_REVIEW'
] as const;
export type TrustEvidenceProjectionPurposeV1 = (typeof trustEvidenceProjectionPurposes)[number];

export type TrustEvidenceProjectionAudienceV1 =
  | Readonly<{ kind: 'BOUNDED_NETWORK' }>
  | Readonly<{ kind: 'TRUSTED_RELATIONSHIP'; relationshipAuthorityReference: string }>
  | Readonly<{ kind: 'OWNER_WORKSPACE'; ownerAuthorityReference: string }>;

export type TrustEvidenceVisibilityAuthorizationReferenceV1 =
  | Readonly<{
      kind: 'NETWORK_VISIBILITY';
      networkParticipationId: NetworkParticipationId;
      participationVersion: number;
      visibilityPolicyVersion: number;
      visibilityAuthorizationReference: string;
      networkPurpose: 'PROVIDER_DISCOVERY';
      trustProjectionAuthorizationReference: string;
      evaluatedAt: string;
      currentAuthorityRevalidationRequiredBeforeServe: true;
    }>
  | Readonly<{
      kind: 'OWNER_OR_RELATIONSHIP_AUTHORITY';
      authorityReference: string;
      authorityVersion: number | string;
      authorityFingerprintSha256: string;
      evaluatedAt: string;
      currentAuthorityRevalidationRequiredBeforeServe: true;
    }>;

export interface TrustEvidenceVisibilityProjectionV1 {
  schemaVersion: 1;
  trustEvidenceVisibilityProjectionId: TrustEvidenceVisibilityProjectionIdV1;
  providerId: ProviderId;
  purpose: TrustEvidenceProjectionPurposeV1;
  audience: TrustEvidenceProjectionAudienceV1;
  contextFingerprintSha256: string;
  evidenceItems: ReadonlyArray<Readonly<TrustEvidenceItemReferenceV1>>;
  projectedFields: readonly TrustEvidenceProjectionFieldV1[];
  historicalAuthorization: TrustEvidenceVisibilityAuthorizationReferenceV1;
  artifactAccessAuthorized: false;
  rawEvidenceDisclosureAuthorized: false;
  relationshipGraphDisclosureAuthorized: false;
  clientDataDisclosureAuthorized: false;
  commercialDataDisclosureAuthorized: false;
  currentAuthorityRevalidationRequiredBeforeServe: true;
  projectionFingerprintSha256: string;
  createdAt: string;
  authorityConsequences: Readonly<TrustEvidenceAuthorityConsequencesV1>;
}

export const trustEvidenceExposureDenialReasons = [
  'PARTICIPATION_NOT_ACTIVE',
  'VISIBILITY_NOT_AUTHORIZED',
  'RELATIONSHIP_AUTHORITY_NOT_CURRENT',
  'SOURCE_NOT_CURRENT',
  'EVIDENCE_SUPERSEDED',
  'EVIDENCE_REVOKED',
  'EVIDENCE_DISPUTED',
  'CONTEXT_MISMATCH',
  'EXECUTOR_ATTRIBUTION_NOT_ESTABLISHED',
  'ARTIFACT_AUTHORITY_NOT_ESTABLISHED',
  'AUTHORITY_UNAVAILABLE'
] as const;
export type TrustEvidenceExposureDenialReasonV1 =
  (typeof trustEvidenceExposureDenialReasons)[number];

export type TrustEvidenceCurrentExposureValidationV1 =
  | Readonly<{
      schemaVersion: 1;
      decision: 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION';
      providerId: ProviderId;
      purpose: TrustEvidenceProjectionPurposeV1;
      contextFingerprintSha256: string;
      projection: Readonly<{
        trustEvidenceVisibilityProjectionId: TrustEvidenceVisibilityProjectionIdV1;
        projectionFingerprintSha256: string;
      }>;
      validatedEvidenceItems: ReadonlyArray<Readonly<TrustEvidenceItemReferenceV1>>;
      authorityReferences: readonly string[];
      checkedAt: string;
      artifactAccessAuthorized: false;
      authorityConsequences: Readonly<TrustEvidenceAuthorityConsequencesV1>;
    }>
  | Readonly<{
      schemaVersion: 1;
      decision: 'DENY';
      providerId: ProviderId;
      purpose: TrustEvidenceProjectionPurposeV1;
      contextFingerprintSha256: string;
      projection: Readonly<{
        trustEvidenceVisibilityProjectionId: TrustEvidenceVisibilityProjectionIdV1;
        projectionFingerprintSha256: string;
      }>;
      reason: TrustEvidenceExposureDenialReasonV1;
      checkedAt: string;
      artifactAccessAuthorized: false;
      authorityConsequences: Readonly<TrustEvidenceAuthorityConsequencesV1>;
    }>;

export const trustExplanationResults = [
  'EVIDENCE_AVAILABLE',
  'INSUFFICIENT_EVIDENCE',
  'CONTRADICTORY_EVIDENCE',
  'STALE_OR_UNAVAILABLE',
  'DISPUTED_EVIDENCE'
] as const;
export type TrustExplanationResultV1 = (typeof trustExplanationResults)[number];

export interface TrustExplanationContradictionV1 {
  left: Readonly<TrustEvidenceItemReferenceV1>;
  right: Readonly<TrustEvidenceItemReferenceV1>;
  explanation: string;
}

export interface TrustExplanationV1 {
  schemaVersion: 1;
  trustExplanationId: TrustExplanationIdV1;
  providerId: ProviderId;
  contextFingerprintSha256: string;
  result: TrustExplanationResultV1;
  evidenceItems: ReadonlyArray<Readonly<TrustEvidenceItemReferenceV1>>;
  contradictions: ReadonlyArray<Readonly<TrustExplanationContradictionV1>>;
  limitations: ReadonlyArray<Readonly<TrustEvidenceLimitationV1>>;
  summary: string;
  visibilityProjection: Readonly<{
    trustEvidenceVisibilityProjectionId: TrustEvidenceVisibilityProjectionIdV1;
    projectionFingerprintSha256: string;
  }>;
  currentExposureValidationRequiredBeforeServe: true;
  universalScoreCreated: false;
  rankCreated: false;
  winnerCreated: false;
  trustExplanationFingerprintSha256: string;
  createdAt: string;
  authorityConsequences: Readonly<TrustEvidenceAuthorityConsequencesV1>;
}

export class OutcomeTrustEvidenceContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutcomeTrustEvidenceContractError';
  }
}

type RecordValue = Record<string, unknown>;
type TrustEvidenceItemFingerprintInputV1 = Omit<
  TrustEvidenceItemV1,
  'trustEvidenceItemId' | 'trustEvidenceItemFingerprintSha256' | 'createdAt'
>;
type TrustEvidenceProjectionFingerprintInputV1 = Omit<
  TrustEvidenceVisibilityProjectionV1,
  'trustEvidenceVisibilityProjectionId' | 'projectionFingerprintSha256' | 'createdAt'
>;
type TrustExplanationFingerprintInputV1 = Omit<
  TrustExplanationV1,
  'trustExplanationId' | 'trustExplanationFingerprintSha256' | 'createdAt'
>;

const SHA256 = /^[0-9a-f]{64}$/u;
const POSITIVE_EXECUTOR_STATES = new Set<string>([
  'DIRECT_FINAL_EXECUTOR_ESTABLISHED',
  'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED'
]);
const SOURCE_AUTHORITY_STATES = new Set<string>(trustEvidenceSourceAuthorityStates);
const LIFECYCLE_STATES = new Set<string>(trustEvidenceLifecycleStates);
const FRESHNESS_STATES = new Set<string>(trustEvidenceFreshnessStates);
const OWNER_FACT_KINDS = new Set<string>(trustEvidenceOwnerFactKinds);
const OWNER_FACT_OWNERS = new Set<string>(trustEvidenceOwnerFactOwners);
const CLAIM_KINDS = new Set<string>(providerClaimKinds);
const OBSERVATION_OWNERS = new Set<string>(outcomeObservationOwners);
const LINEAGE_RELATIONS = new Set<string>(trustEvidenceLineageRelations);
const LIMITATION_CODES = new Set<string>(trustEvidenceLimitationCodes);
const PROJECTION_FIELDS = new Set<string>(trustEvidenceProjectionFields);
const PROJECTION_PURPOSES = new Set<string>(trustEvidenceProjectionPurposes);
const EXPOSURE_DENIAL_REASONS = new Set<string>(trustEvidenceExposureDenialReasons);
const EXPLANATION_RESULTS = new Set<string>(trustExplanationResults);

function invalid(message: string): never {
  throw new OutcomeTrustEvidenceContractError(message);
}

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid(`${field} must be an object.`);
  return value as RecordValue;
}

function exactKeys(value: RecordValue, allowed: readonly string[], field: string): void {
  const accepted = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !accepted.has(key));
  if (unknown.length) invalid(`${field} contains unsupported fields: ${unknown.join(', ')}.`);
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') return invalid(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    return invalid(`${field} must contain between 1 and ${maximum} characters.`);
  return cleaned;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    return invalid(`${field} must be a positive integer.`);
  return Number(value);
}

function version(value: unknown, field: string): number | string {
  if (typeof value === 'number') return positiveInteger(value, field);
  return text(value, field, 200);
}

function sha256(value: unknown, field: string): string {
  const cleaned = text(value, field, 64).toLowerCase();
  if (!SHA256.test(cleaned)) return invalid(`${field} must be a lowercase SHA-256 digest.`);
  return cleaned;
}

function instant(value: unknown, field: string): string {
  const cleaned = text(value, field, 64);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== cleaned)
    return invalid(`${field} must be a canonical ISO-8601 instant.`);
  return cleaned;
}

function optionalInstant(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : instant(value, field);
}

function prefixed<T extends string>(value: unknown, prefix: string, field: string): T {
  const cleaned = text(value, field);
  if (!cleaned.startsWith(prefix) || cleaned === prefix)
    return invalid(`${field} must start with ${prefix}.`);
  return cleaned as T;
}

function falseOnly(value: unknown, field: string): false {
  if (value !== false) return invalid(`${field} must be false.`);
  return false;
}

function trueOnly(value: unknown, field: string): true {
  if (value !== true) return invalid(`${field} must be true.`);
  return true;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
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

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function parseAuthority(value: unknown): Readonly<TrustEvidenceAuthorityConsequencesV1> {
  const authority = record(value, 'authorityConsequences');
  exactKeys(authority, Object.keys(noTrustEvidenceAuthorityConsequences), 'authorityConsequences');
  if (!same(authority, noTrustEvidenceAuthorityConsequences))
    invalid('authorityConsequences must preserve the frozen no-downstream-authority boundary.');
  return noTrustEvidenceAuthorityConsequences;
}

export function parseOutcomeEvidenceReferenceV1(value: unknown): OutcomeEvidenceReferenceV1 {
  const reference = record(value, 'outcomeEvidenceReference');
  exactKeys(
    reference,
    [
      'evidenceReference',
      'sourceOwner',
      'sourceType',
      'sourceId',
      'sourceVersion',
      'sourceFingerprintSha256',
      'recordedAt',
      'effectiveFrom',
      'effectiveUntil',
      'authorityState',
      'checkedAt',
      'artifactAccessAuthorized',
      'currentArtifactAuthorizationRequired'
    ],
    'outcomeEvidenceReference'
  );
  const allowedOwners: readonly OutcomeEvidenceSourceOwnerV1[] = [
    'CORE',
    'MGSN',
    'EXECUTION',
    'PAYMENT',
    'CAPABILITY_ENGINE',
    'MARKREG',
    'OTHER_CANONICAL_OWNER'
  ];
  if (typeof reference.sourceOwner !== 'string' || !allowedOwners.includes(reference.sourceOwner as OutcomeEvidenceSourceOwnerV1))
    invalid('outcomeEvidenceReference.sourceOwner is invalid.');
  if (typeof reference.authorityState !== 'string' || !SOURCE_AUTHORITY_STATES.has(reference.authorityState))
    invalid('outcomeEvidenceReference.authorityState is invalid.');
  const effectiveFrom = optionalInstant(reference.effectiveFrom, 'outcomeEvidenceReference.effectiveFrom');
  const effectiveUntil = optionalInstant(reference.effectiveUntil, 'outcomeEvidenceReference.effectiveUntil');
  if (effectiveFrom && effectiveUntil && effectiveUntil <= effectiveFrom)
    invalid('outcomeEvidenceReference effective period is inverted.');
  return {
    evidenceReference: text(reference.evidenceReference, 'outcomeEvidenceReference.evidenceReference', 800),
    sourceOwner: reference.sourceOwner as OutcomeEvidenceSourceOwnerV1,
    sourceType: text(reference.sourceType, 'outcomeEvidenceReference.sourceType', 200),
    sourceId: text(reference.sourceId, 'outcomeEvidenceReference.sourceId', 500),
    sourceVersion: version(reference.sourceVersion, 'outcomeEvidenceReference.sourceVersion'),
    sourceFingerprintSha256: sha256(reference.sourceFingerprintSha256, 'outcomeEvidenceReference.sourceFingerprintSha256'),
    recordedAt: instant(reference.recordedAt, 'outcomeEvidenceReference.recordedAt'),
    ...(effectiveFrom ? { effectiveFrom } : {}),
    ...(effectiveUntil ? { effectiveUntil } : {}),
    authorityState: reference.authorityState as TrustEvidenceSourceAuthorityStateV1,
    checkedAt: instant(reference.checkedAt, 'outcomeEvidenceReference.checkedAt'),
    artifactAccessAuthorized: falseOnly(reference.artifactAccessAuthorized, 'outcomeEvidenceReference.artifactAccessAuthorized'),
    currentArtifactAuthorizationRequired: trueOnly(reference.currentArtifactAuthorizationRequired, 'outcomeEvidenceReference.currentArtifactAuthorizationRequired')
  };
}

function parseEvidenceReferences(value: unknown, field: string): OutcomeEvidenceReferenceV1[] {
  if (!Array.isArray(value)) return invalid(`${field} must be an array.`);
  return value.map((item) => parseOutcomeEvidenceReferenceV1(item));
}

export function parseOutcomeObservationReferenceV1(value: unknown): OutcomeObservationReferenceV1 {
  const observation = record(value, 'outcomeObservation');
  exactKeys(
    observation,
    [
      'schemaVersion',
      'outcomeObservationId',
      'observationOwner',
      'observerReference',
      'observerAuthorityReference',
      'providerId',
      'contextFingerprintSha256',
      'observationType',
      'version',
      'observationFingerprintSha256',
      'lifecycleState',
      'observedAt',
      'effectiveFrom',
      'effectiveUntil',
      'evidenceReferences',
      'publicReviewCreated',
      'officialTruthCreated'
    ],
    'outcomeObservation'
  );
  if (observation.schemaVersion !== 1) invalid('outcomeObservation.schemaVersion must be 1.');
  if (typeof observation.observationOwner !== 'string' || !OBSERVATION_OWNERS.has(observation.observationOwner))
    invalid('outcomeObservation.observationOwner is invalid.');
  if (typeof observation.lifecycleState !== 'string' || !LIFECYCLE_STATES.has(observation.lifecycleState))
    invalid('outcomeObservation.lifecycleState is invalid.');
  const effectiveFrom = optionalInstant(observation.effectiveFrom, 'outcomeObservation.effectiveFrom');
  const effectiveUntil = optionalInstant(observation.effectiveUntil, 'outcomeObservation.effectiveUntil');
  if (effectiveFrom && effectiveUntil && effectiveUntil <= effectiveFrom)
    invalid('outcomeObservation effective period is inverted.');
  return {
    schemaVersion: 1,
    outcomeObservationId: prefixed<OutcomeObservationIdV1>(observation.outcomeObservationId, 'outcome-observation_', 'outcomeObservation.outcomeObservationId'),
    observationOwner: observation.observationOwner as OutcomeObservationOwnerV1,
    observerReference: text(observation.observerReference, 'outcomeObservation.observerReference', 500),
    observerAuthorityReference: text(observation.observerAuthorityReference, 'outcomeObservation.observerAuthorityReference', 500),
    providerId: prefixed<ProviderId>(observation.providerId, 'provider_', 'outcomeObservation.providerId'),
    contextFingerprintSha256: sha256(observation.contextFingerprintSha256, 'outcomeObservation.contextFingerprintSha256'),
    observationType: text(observation.observationType, 'outcomeObservation.observationType', 200),
    version: positiveInteger(observation.version, 'outcomeObservation.version'),
    observationFingerprintSha256: sha256(observation.observationFingerprintSha256, 'outcomeObservation.observationFingerprintSha256'),
    lifecycleState: observation.lifecycleState as TrustEvidenceLifecycleStateV1,
    observedAt: instant(observation.observedAt, 'outcomeObservation.observedAt'),
    ...(effectiveFrom ? { effectiveFrom } : {}),
    ...(effectiveUntil ? { effectiveUntil } : {}),
    evidenceReferences: parseEvidenceReferences(observation.evidenceReferences, 'outcomeObservation.evidenceReferences'),
    publicReviewCreated: falseOnly(observation.publicReviewCreated, 'outcomeObservation.publicReviewCreated'),
    officialTruthCreated: falseOnly(observation.officialTruthCreated, 'outcomeObservation.officialTruthCreated')
  };
}

function parseSource(value: unknown): TrustEvidenceSourceReferenceV1 {
  const source = record(value, 'trustEvidenceSource');
  if (source.kind === 'CANONICAL_OWNER_FACT') {
    exactKeys(
      source,
      [
        'kind',
        'owner',
        'factKind',
        'sourceId',
        'sourceVersion',
        'sourceFingerprintSha256',
        'recordedAt',
        'effectiveFrom',
        'effectiveUntil',
        'performanceTruthEstablished',
        'officialTruthEstablished'
      ],
      'trustEvidenceSource'
    );
    if (typeof source.owner !== 'string' || !OWNER_FACT_OWNERS.has(source.owner))
      invalid('trustEvidenceSource.owner is invalid for a canonical owner fact.');
    if (typeof source.factKind !== 'string' || !OWNER_FACT_KINDS.has(source.factKind))
      invalid('trustEvidenceSource.factKind is not an admitted V1 owner fact kind.');
    const ownerByKind: Readonly<Record<TrustEvidenceOwnerFactKindV1, TrustEvidenceOwnerFactOwnerV1>> = {
      MGSN_REGISTRY_PROVENANCE: 'MGSN',
      MGSN_SUPPLY_CAPABILITY: 'MGSN',
      MGSN_ALLOCATION: 'MGSN',
      MGSN_PROVIDER_ACCEPTANCE: 'MGSN',
      MGSN_EVIDENCE_HANDOFF: 'MGSN',
      EXECUTION_EVIDENCE_REVIEW: 'EXECUTION',
      PAYMENT_LIFECYCLE: 'PAYMENT'
    };
    if (source.owner !== ownerByKind[source.factKind as TrustEvidenceOwnerFactKindV1])
      invalid('trustEvidenceSource.owner does not own the selected factKind.');
    const effectiveFrom = optionalInstant(source.effectiveFrom, 'trustEvidenceSource.effectiveFrom');
    const effectiveUntil = optionalInstant(source.effectiveUntil, 'trustEvidenceSource.effectiveUntil');
    if (effectiveFrom && effectiveUntil && effectiveUntil <= effectiveFrom)
      invalid('trustEvidenceSource effective period is inverted.');
    return {
      kind: 'CANONICAL_OWNER_FACT',
      owner: source.owner as TrustEvidenceOwnerFactOwnerV1,
      factKind: source.factKind as TrustEvidenceOwnerFactKindV1,
      sourceId: text(source.sourceId, 'trustEvidenceSource.sourceId', 500),
      sourceVersion: version(source.sourceVersion, 'trustEvidenceSource.sourceVersion'),
      sourceFingerprintSha256: sha256(source.sourceFingerprintSha256, 'trustEvidenceSource.sourceFingerprintSha256'),
      recordedAt: instant(source.recordedAt, 'trustEvidenceSource.recordedAt'),
      ...(effectiveFrom ? { effectiveFrom } : {}),
      ...(effectiveUntil ? { effectiveUntil } : {}),
      performanceTruthEstablished: falseOnly(source.performanceTruthEstablished, 'trustEvidenceSource.performanceTruthEstablished'),
      officialTruthEstablished: falseOnly(source.officialTruthEstablished, 'trustEvidenceSource.officialTruthEstablished')
    };
  }
  if (source.kind === 'PROVIDER_CLAIM') {
    exactKeys(
      source,
      [
        'kind',
        'owner',
        'providerReturnId',
        'providerReturnVersion',
        'providerReturnFingerprintSha256',
        'providerReturnStatus',
        'claimKind',
        'claimReference',
        'submittedAt',
        'verifiedOutcomeEstablished',
        'officialTruthEstablished'
      ],
      'trustEvidenceSource'
    );
    if (source.owner !== 'MGSN') invalid('Provider Claim source owner must be MGSN provenance.');
    if (source.providerReturnStatus !== 'CURRENT' && source.providerReturnStatus !== 'SUPERSEDED')
      invalid('trustEvidenceSource.providerReturnStatus is invalid.');
    if (typeof source.claimKind !== 'string' || !CLAIM_KINDS.has(source.claimKind))
      invalid('trustEvidenceSource.claimKind is invalid.');
    return {
      kind: 'PROVIDER_CLAIM',
      owner: 'MGSN',
      providerReturnId: prefixed<ProviderReturnId>(source.providerReturnId, 'provider-return_', 'trustEvidenceSource.providerReturnId'),
      providerReturnVersion: positiveInteger(source.providerReturnVersion, 'trustEvidenceSource.providerReturnVersion'),
      providerReturnFingerprintSha256: sha256(source.providerReturnFingerprintSha256, 'trustEvidenceSource.providerReturnFingerprintSha256'),
      providerReturnStatus: source.providerReturnStatus as ProviderReturnStatus,
      claimKind: source.claimKind as ProviderClaimKindV1,
      claimReference: text(source.claimReference, 'trustEvidenceSource.claimReference', 500),
      submittedAt: instant(source.submittedAt, 'trustEvidenceSource.submittedAt'),
      verifiedOutcomeEstablished: falseOnly(source.verifiedOutcomeEstablished, 'trustEvidenceSource.verifiedOutcomeEstablished'),
      officialTruthEstablished: falseOnly(source.officialTruthEstablished, 'trustEvidenceSource.officialTruthEstablished')
    };
  }
  if (source.kind !== 'AUTHORIZED_OUTCOME_OBSERVATION')
    return invalid('trustEvidenceSource.kind is invalid.');
  exactKeys(source, ['kind', 'observation', 'universalPerformanceTruthEstablished', 'officialTruthEstablished'], 'trustEvidenceSource');
  return {
    kind: 'AUTHORIZED_OUTCOME_OBSERVATION',
    observation: parseOutcomeObservationReferenceV1(source.observation),
    universalPerformanceTruthEstablished: falseOnly(source.universalPerformanceTruthEstablished, 'trustEvidenceSource.universalPerformanceTruthEstablished'),
    officialTruthEstablished: falseOnly(source.officialTruthEstablished, 'trustEvidenceSource.officialTruthEstablished')
  };
}

function parseSourceAuthority(value: unknown, sourceKind: TrustEvidenceSourceReferenceV1['kind']): TrustEvidenceSourceAuthorityV1 {
  const authority = record(value, 'trustEvidenceSourceAuthority');
  exactKeys(
    authority,
    [
      'sourceClass',
      'authorityState',
      'checkedAt',
      'currentSourceRevalidationRequiredBeforeUse',
      'historicalSourceDoesNotEstablishCurrentSuitability',
      'universalPerformanceInferenceAuthorized'
    ],
    'trustEvidenceSourceAuthority'
  );
  if (authority.sourceClass !== sourceKind)
    invalid('trustEvidenceSourceAuthority.sourceClass must match source.kind.');
  if (typeof authority.authorityState !== 'string' || !SOURCE_AUTHORITY_STATES.has(authority.authorityState))
    invalid('trustEvidenceSourceAuthority.authorityState is invalid.');
  return {
    sourceClass: sourceKind,
    authorityState: authority.authorityState as TrustEvidenceSourceAuthorityStateV1,
    checkedAt: instant(authority.checkedAt, 'trustEvidenceSourceAuthority.checkedAt'),
    currentSourceRevalidationRequiredBeforeUse: trueOnly(authority.currentSourceRevalidationRequiredBeforeUse, 'trustEvidenceSourceAuthority.currentSourceRevalidationRequiredBeforeUse'),
    historicalSourceDoesNotEstablishCurrentSuitability: trueOnly(authority.historicalSourceDoesNotEstablishCurrentSuitability, 'trustEvidenceSourceAuthority.historicalSourceDoesNotEstablishCurrentSuitability'),
    universalPerformanceInferenceAuthorized: falseOnly(authority.universalPerformanceInferenceAuthorized, 'trustEvidenceSourceAuthority.universalPerformanceInferenceAuthorized')
  };
}

function parseProfileReference(value: unknown): ProviderResponsibilityProfileReferenceV1 {
  const profile = record(value, 'executorAttribution.profile');
  exactKeys(profile, ['providerResponsibilityProfileId', 'version', 'profileFingerprintSha256'], 'executorAttribution.profile');
  return {
    providerResponsibilityProfileId: prefixed(profile.providerResponsibilityProfileId, 'provider-responsibility_', 'executorAttribution.profile.providerResponsibilityProfileId'),
    version: positiveInteger(profile.version, 'executorAttribution.profile.version'),
    profileFingerprintSha256: sha256(profile.profileFingerprintSha256, 'executorAttribution.profile.profileFingerprintSha256')
  };
}

function parseExecutorAttribution(value: unknown): TrustEvidenceExecutorAttributionV1 {
  const executor = record(value, 'executorAttribution');
  if (executor.state === 'ESTABLISHED') {
    exactKeys(
      executor,
      [
        'state',
        'assessmentState',
        'assessmentReference',
        'assessmentFingerprintSha256',
        'profile',
        'finalExecutionProviderId',
        'checkedAt',
        'currentAuthorityRevalidationRequiredBeforeUse'
      ],
      'executorAttribution'
    );
    if (typeof executor.assessmentState !== 'string' || !POSITIVE_EXECUTOR_STATES.has(executor.assessmentState))
      invalid('Established executorAttribution requires a positive #375 assessment state.');
    return {
      state: 'ESTABLISHED',
      assessmentState: executor.assessmentState as 'DIRECT_FINAL_EXECUTOR_ESTABLISHED' | 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED',
      assessmentReference: text(executor.assessmentReference, 'executorAttribution.assessmentReference', 500),
      assessmentFingerprintSha256: sha256(executor.assessmentFingerprintSha256, 'executorAttribution.assessmentFingerprintSha256'),
      profile: parseProfileReference(executor.profile),
      finalExecutionProviderId: prefixed<ProviderId>(executor.finalExecutionProviderId, 'provider_', 'executorAttribution.finalExecutionProviderId'),
      checkedAt: instant(executor.checkedAt, 'executorAttribution.checkedAt'),
      currentAuthorityRevalidationRequiredBeforeUse: trueOnly(executor.currentAuthorityRevalidationRequiredBeforeUse, 'executorAttribution.currentAuthorityRevalidationRequiredBeforeUse')
    };
  }
  if (executor.state !== 'NOT_ESTABLISHED') invalid('executorAttribution.state is invalid.');
  exactKeys(
    executor,
    [
      'state',
      'assessmentState',
      'assessmentReference',
      'assessmentFingerprintSha256',
      'profile',
      'finalExecutionProviderId',
      'checkedAt',
      'currentAuthorityRevalidationRequiredBeforeUse'
    ],
    'executorAttribution'
  );
  if (typeof executor.assessmentState !== 'string' || POSITIVE_EXECUTOR_STATES.has(executor.assessmentState))
    invalid('NOT_ESTABLISHED executorAttribution cannot carry a positive #375 assessment state.');
  const allowedNonPositive: readonly ProviderDirectExecutorAssessmentState[] = [
    'UNKNOWN_OR_UNPROVEN',
    'PROVIDER_NOT_FINAL_EXECUTOR',
    'REBROKERING_OR_SUBAGENT_DISCLOSED',
    'NO_REBROKERING_COMMITMENT_NOT_CURRENT',
    'RESPONSIBILITY_DISPUTED',
    'PROFILE_SUSPENDED',
    'PROFILE_REVOKED',
    'AUTHORITY_NOT_CURRENT',
    'AUTHORITY_UNAVAILABLE'
  ];
  if (!allowedNonPositive.includes(executor.assessmentState as ProviderDirectExecutorAssessmentState))
    invalid('executorAttribution.assessmentState is invalid.');
  if (executor.finalExecutionProviderId !== null)
    invalid('NOT_ESTABLISHED executorAttribution.finalExecutionProviderId must be null.');
  const assessmentReference = executor.assessmentReference === undefined ? undefined : text(executor.assessmentReference, 'executorAttribution.assessmentReference', 500);
  const assessmentFingerprintSha256 = executor.assessmentFingerprintSha256 === undefined ? undefined : sha256(executor.assessmentFingerprintSha256, 'executorAttribution.assessmentFingerprintSha256');
  if ((assessmentReference === undefined) !== (assessmentFingerprintSha256 === undefined))
    invalid('executorAttribution assessment reference and fingerprint must appear together.');
  return {
    state: 'NOT_ESTABLISHED',
    assessmentState: executor.assessmentState as Exclude<ProviderDirectExecutorAssessmentState, 'DIRECT_FINAL_EXECUTOR_ESTABLISHED' | 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED'>,
    ...(assessmentReference ? { assessmentReference, assessmentFingerprintSha256 } : {}),
    ...(executor.profile === undefined ? {} : { profile: parseProfileReference(executor.profile) }),
    finalExecutionProviderId: null,
    checkedAt: instant(executor.checkedAt, 'executorAttribution.checkedAt'),
    currentAuthorityRevalidationRequiredBeforeUse: trueOnly(executor.currentAuthorityRevalidationRequiredBeforeUse, 'executorAttribution.currentAuthorityRevalidationRequiredBeforeUse')
  };
}

function parseContext(value: unknown): TrustEvidenceContextV1 {
  const context = record(value, 'trustEvidenceContext');
  exactKeys(
    context,
    [
      'providerId',
      'contextReference',
      'contextFingerprintSha256',
      'jurisdiction',
      'serviceType',
      'taskType',
      'collaborationScope',
      'executorAttribution',
      'clientIdentityEmbedded',
      'relationshipIdentityEmbedded',
      'commercialDataEmbedded'
    ],
    'trustEvidenceContext'
  );
  return {
    providerId: prefixed<ProviderId>(context.providerId, 'provider_', 'trustEvidenceContext.providerId'),
    contextReference: text(context.contextReference, 'trustEvidenceContext.contextReference', 500),
    contextFingerprintSha256: sha256(context.contextFingerprintSha256, 'trustEvidenceContext.contextFingerprintSha256'),
    jurisdiction: text(context.jurisdiction, 'trustEvidenceContext.jurisdiction', 120),
    serviceType: text(context.serviceType, 'trustEvidenceContext.serviceType', 200),
    taskType: text(context.taskType, 'trustEvidenceContext.taskType', 200),
    collaborationScope: text(context.collaborationScope, 'trustEvidenceContext.collaborationScope', 500),
    executorAttribution: parseExecutorAttribution(context.executorAttribution),
    clientIdentityEmbedded: falseOnly(context.clientIdentityEmbedded, 'trustEvidenceContext.clientIdentityEmbedded'),
    relationshipIdentityEmbedded: falseOnly(context.relationshipIdentityEmbedded, 'trustEvidenceContext.relationshipIdentityEmbedded'),
    commercialDataEmbedded: falseOnly(context.commercialDataEmbedded, 'trustEvidenceContext.commercialDataEmbedded')
  };
}

function parseFreshness(value: unknown, authorityState: TrustEvidenceSourceAuthorityStateV1): TrustEvidenceFreshnessV1 {
  const freshness = record(value, 'trustEvidenceFreshness');
  exactKeys(freshness, ['state', 'policyVersion', 'checkedAt', 'effectiveFrom', 'effectiveUntil', 'currentSuitabilityEstablished'], 'trustEvidenceFreshness');
  if (typeof freshness.state !== 'string' || !FRESHNESS_STATES.has(freshness.state))
    invalid('trustEvidenceFreshness.state is invalid.');
  if (freshness.state === 'CURRENT_FOR_CONTEXT' && authorityState !== 'CURRENT')
    invalid('CURRENT_FOR_CONTEXT requires CURRENT source authority.');
  if (freshness.state === 'SOURCE_UNAVAILABLE' && authorityState !== 'UNAVAILABLE')
    invalid('SOURCE_UNAVAILABLE freshness requires UNAVAILABLE source authority.');
  const effectiveFrom = optionalInstant(freshness.effectiveFrom, 'trustEvidenceFreshness.effectiveFrom');
  const effectiveUntil = optionalInstant(freshness.effectiveUntil, 'trustEvidenceFreshness.effectiveUntil');
  if (effectiveFrom && effectiveUntil && effectiveUntil <= effectiveFrom)
    invalid('trustEvidenceFreshness effective period is inverted.');
  return {
    state: freshness.state as TrustEvidenceFreshnessStateV1,
    policyVersion: text(freshness.policyVersion, 'trustEvidenceFreshness.policyVersion', 200),
    checkedAt: instant(freshness.checkedAt, 'trustEvidenceFreshness.checkedAt'),
    ...(effectiveFrom ? { effectiveFrom } : {}),
    ...(effectiveUntil ? { effectiveUntil } : {}),
    currentSuitabilityEstablished: falseOnly(freshness.currentSuitabilityEstablished, 'trustEvidenceFreshness.currentSuitabilityEstablished')
  };
}

function parseLimitation(value: unknown): TrustEvidenceLimitationV1 {
  const limitation = record(value, 'trustEvidenceLimitation');
  exactKeys(limitation, ['code', 'explanation'], 'trustEvidenceLimitation');
  if (typeof limitation.code !== 'string' || !LIMITATION_CODES.has(limitation.code))
    invalid('trustEvidenceLimitation.code is invalid.');
  return {
    code: limitation.code as TrustEvidenceLimitationCodeV1,
    explanation: text(limitation.explanation, 'trustEvidenceLimitation.explanation', 1000)
  };
}

function parseItemReference(value: unknown, field = 'trustEvidenceItemReference'): TrustEvidenceItemReferenceV1 {
  const reference = record(value, field);
  exactKeys(reference, ['trustEvidenceItemId', 'version', 'trustEvidenceItemFingerprintSha256'], field);
  return {
    trustEvidenceItemId: prefixed<TrustEvidenceItemIdV1>(reference.trustEvidenceItemId, 'trust-evidence-item_', `${field}.trustEvidenceItemId`),
    version: positiveInteger(reference.version, `${field}.version`),
    trustEvidenceItemFingerprintSha256: sha256(reference.trustEvidenceItemFingerprintSha256, `${field}.trustEvidenceItemFingerprintSha256`)
  };
}

function parseLineage(value: unknown): TrustEvidenceLineageReferenceV1 {
  const lineage = record(value, 'trustEvidenceLineage');
  exactKeys(lineage, ['trustEvidenceItemId', 'version', 'trustEvidenceItemFingerprintSha256', 'relation'], 'trustEvidenceLineage');
  if (typeof lineage.relation !== 'string' || !LINEAGE_RELATIONS.has(lineage.relation))
    invalid('trustEvidenceLineage.relation is invalid.');
  return {
    ...parseItemReference({
      trustEvidenceItemId: lineage.trustEvidenceItemId,
      version: lineage.version,
      trustEvidenceItemFingerprintSha256: lineage.trustEvidenceItemFingerprintSha256
    }, 'trustEvidenceLineage.reference'),
    relation: lineage.relation as TrustEvidenceLineageRelationV1
  };
}

function parseContradictionReference(value: unknown): TrustEvidenceContradictionReferenceV1 {
  const contradiction = record(value, 'trustEvidenceContradiction');
  exactKeys(contradiction, ['trustEvidenceItemId', 'version', 'trustEvidenceItemFingerprintSha256', 'contradictionReference'], 'trustEvidenceContradiction');
  return {
    ...parseItemReference({
      trustEvidenceItemId: contradiction.trustEvidenceItemId,
      version: contradiction.version,
      trustEvidenceItemFingerprintSha256: contradiction.trustEvidenceItemFingerprintSha256
    }, 'trustEvidenceContradiction.reference'),
    contradictionReference: text(contradiction.contradictionReference, 'trustEvidenceContradiction.contradictionReference', 500)
  };
}

export function trustEvidenceItemFingerprintV1(value: TrustEvidenceItemFingerprintInputV1): string {
  return fingerprint(value);
}

export function trustEvidenceVisibilityProjectionFingerprintV1(value: TrustEvidenceProjectionFingerprintInputV1): string {
  return fingerprint(value);
}

export function trustExplanationFingerprintV1(value: TrustExplanationFingerprintInputV1): string {
  return fingerprint(value);
}

export function parseTrustEvidenceItemV1(value: unknown): TrustEvidenceItemV1 {
  const item = record(value, 'trustEvidenceItem');
  exactKeys(
    item,
    [
      'schemaVersion',
      'trustEvidenceItemId',
      'version',
      'providerId',
      'lifecycleState',
      'context',
      'source',
      'sourceAuthority',
      'evidenceReferences',
      'freshness',
      'lineage',
      'contradictions',
      'limitations',
      'trustEvidenceItemFingerprintSha256',
      'createdAt',
      'currentExposureAuthorizationRequired',
      'authorityConsequences'
    ],
    'trustEvidenceItem'
  );
  if (item.schemaVersion !== 1) invalid('trustEvidenceItem.schemaVersion must be 1.');
  if (typeof item.lifecycleState !== 'string' || !LIFECYCLE_STATES.has(item.lifecycleState))
    invalid('trustEvidenceItem.lifecycleState is invalid.');
  const providerId = prefixed<ProviderId>(item.providerId, 'provider_', 'trustEvidenceItem.providerId');
  const context = parseContext(item.context);
  if (context.providerId !== providerId) invalid('trustEvidenceItem context Provider must match item Provider.');
  const source = parseSource(item.source);
  if (source.kind === 'AUTHORIZED_OUTCOME_OBSERVATION') {
    if (source.observation.providerId !== providerId)
      invalid('Outcome Observation Provider must match Trust Evidence Provider.');
    if (source.observation.contextFingerprintSha256 !== context.contextFingerprintSha256)
      invalid('Outcome Observation context must match Trust Evidence context.');
  }
  const sourceAuthority = parseSourceAuthority(item.sourceAuthority, source.kind);
  const freshness = parseFreshness(item.freshness, sourceAuthority.authorityState);
  if (item.lifecycleState === 'SUPERSEDED' && source.kind === 'PROVIDER_CLAIM' && source.providerReturnStatus !== 'SUPERSEDED')
    invalid('SUPERSEDED Provider Claim Trust Evidence must reference a SUPERSEDED Provider Return.');
  if (!Array.isArray(item.lineage) || !Array.isArray(item.contradictions) || !Array.isArray(item.limitations))
    invalid('trustEvidenceItem lineage, contradictions and limitations must be arrays.');
  const base: TrustEvidenceItemFingerprintInputV1 = {
    schemaVersion: 1,
    version: positiveInteger(item.version, 'trustEvidenceItem.version'),
    providerId,
    lifecycleState: item.lifecycleState as TrustEvidenceLifecycleStateV1,
    context,
    source,
    sourceAuthority,
    evidenceReferences: parseEvidenceReferences(item.evidenceReferences, 'trustEvidenceItem.evidenceReferences'),
    freshness,
    lineage: item.lineage.map((entry) => parseLineage(entry)),
    contradictions: item.contradictions.map((entry) => parseContradictionReference(entry)),
    limitations: item.limitations.map((entry) => parseLimitation(entry)),
    currentExposureAuthorizationRequired: trueOnly(item.currentExposureAuthorizationRequired, 'trustEvidenceItem.currentExposureAuthorizationRequired'),
    authorityConsequences: parseAuthority(item.authorityConsequences)
  };
  const trustEvidenceItemFingerprintSha256 = sha256(item.trustEvidenceItemFingerprintSha256, 'trustEvidenceItem.trustEvidenceItemFingerprintSha256');
  if (trustEvidenceItemFingerprintSha256 !== trustEvidenceItemFingerprintV1(base))
    invalid('trustEvidenceItem fingerprint does not match its bounded contents.');
  const trustEvidenceItemId = prefixed<TrustEvidenceItemIdV1>(item.trustEvidenceItemId, 'trust-evidence-item_', 'trustEvidenceItem.trustEvidenceItemId');
  if (trustEvidenceItemId !== `trust-evidence-item_${trustEvidenceItemFingerprintSha256}`)
    invalid('trustEvidenceItemId must bind the exact Trust Evidence fingerprint.');
  return {
    ...base,
    trustEvidenceItemId,
    trustEvidenceItemFingerprintSha256,
    createdAt: instant(item.createdAt, 'trustEvidenceItem.createdAt')
  };
}

function parseAudience(value: unknown): TrustEvidenceProjectionAudienceV1 {
  const audience = record(value, 'trustEvidenceProjection.audience');
  if (audience.kind === 'BOUNDED_NETWORK') {
    exactKeys(audience, ['kind'], 'trustEvidenceProjection.audience');
    return { kind: 'BOUNDED_NETWORK' };
  }
  if (audience.kind === 'TRUSTED_RELATIONSHIP') {
    exactKeys(audience, ['kind', 'relationshipAuthorityReference'], 'trustEvidenceProjection.audience');
    return {
      kind: 'TRUSTED_RELATIONSHIP',
      relationshipAuthorityReference: text(audience.relationshipAuthorityReference, 'trustEvidenceProjection.audience.relationshipAuthorityReference', 500)
    };
  }
  if (audience.kind !== 'OWNER_WORKSPACE') invalid('trustEvidenceProjection.audience.kind is invalid.');
  exactKeys(audience, ['kind', 'ownerAuthorityReference'], 'trustEvidenceProjection.audience');
  return {
    kind: 'OWNER_WORKSPACE',
    ownerAuthorityReference: text(audience.ownerAuthorityReference, 'trustEvidenceProjection.audience.ownerAuthorityReference', 500)
  };
}

function parseHistoricalAuthorization(value: unknown): TrustEvidenceVisibilityAuthorizationReferenceV1 {
  const authorization = record(value, 'trustEvidenceProjection.historicalAuthorization');
  if (authorization.kind === 'NETWORK_VISIBILITY') {
    exactKeys(
      authorization,
      [
        'kind',
        'networkParticipationId',
        'participationVersion',
        'visibilityPolicyVersion',
        'visibilityAuthorizationReference',
        'networkPurpose',
        'trustProjectionAuthorizationReference',
        'evaluatedAt',
        'currentAuthorityRevalidationRequiredBeforeServe'
      ],
      'trustEvidenceProjection.historicalAuthorization'
    );
    if (authorization.networkPurpose !== 'PROVIDER_DISCOVERY')
      invalid('Network visibility authorization must preserve the existing PROVIDER_DISCOVERY purpose.');
    return {
      kind: 'NETWORK_VISIBILITY',
      networkParticipationId: prefixed<NetworkParticipationId>(authorization.networkParticipationId, 'network-participation_', 'trustEvidenceProjection.historicalAuthorization.networkParticipationId'),
      participationVersion: positiveInteger(authorization.participationVersion, 'trustEvidenceProjection.historicalAuthorization.participationVersion'),
      visibilityPolicyVersion: positiveInteger(authorization.visibilityPolicyVersion, 'trustEvidenceProjection.historicalAuthorization.visibilityPolicyVersion'),
      visibilityAuthorizationReference: text(authorization.visibilityAuthorizationReference, 'trustEvidenceProjection.historicalAuthorization.visibilityAuthorizationReference', 500),
      networkPurpose: 'PROVIDER_DISCOVERY',
      trustProjectionAuthorizationReference: text(authorization.trustProjectionAuthorizationReference, 'trustEvidenceProjection.historicalAuthorization.trustProjectionAuthorizationReference', 500),
      evaluatedAt: instant(authorization.evaluatedAt, 'trustEvidenceProjection.historicalAuthorization.evaluatedAt'),
      currentAuthorityRevalidationRequiredBeforeServe: trueOnly(authorization.currentAuthorityRevalidationRequiredBeforeServe, 'trustEvidenceProjection.historicalAuthorization.currentAuthorityRevalidationRequiredBeforeServe')
    };
  }
  if (authorization.kind !== 'OWNER_OR_RELATIONSHIP_AUTHORITY')
    invalid('trustEvidenceProjection.historicalAuthorization.kind is invalid.');
  exactKeys(
    authorization,
    ['kind', 'authorityReference', 'authorityVersion', 'authorityFingerprintSha256', 'evaluatedAt', 'currentAuthorityRevalidationRequiredBeforeServe'],
    'trustEvidenceProjection.historicalAuthorization'
  );
  return {
    kind: 'OWNER_OR_RELATIONSHIP_AUTHORITY',
    authorityReference: text(authorization.authorityReference, 'trustEvidenceProjection.historicalAuthorization.authorityReference', 500),
    authorityVersion: version(authorization.authorityVersion, 'trustEvidenceProjection.historicalAuthorization.authorityVersion'),
    authorityFingerprintSha256: sha256(authorization.authorityFingerprintSha256, 'trustEvidenceProjection.historicalAuthorization.authorityFingerprintSha256'),
    evaluatedAt: instant(authorization.evaluatedAt, 'trustEvidenceProjection.historicalAuthorization.evaluatedAt'),
    currentAuthorityRevalidationRequiredBeforeServe: trueOnly(authorization.currentAuthorityRevalidationRequiredBeforeServe, 'trustEvidenceProjection.historicalAuthorization.currentAuthorityRevalidationRequiredBeforeServe')
  };
}

export function parseTrustEvidenceVisibilityProjectionV1(value: unknown): TrustEvidenceVisibilityProjectionV1 {
  const projection = record(value, 'trustEvidenceProjection');
  exactKeys(
    projection,
    [
      'schemaVersion',
      'trustEvidenceVisibilityProjectionId',
      'providerId',
      'purpose',
      'audience',
      'contextFingerprintSha256',
      'evidenceItems',
      'projectedFields',
      'historicalAuthorization',
      'artifactAccessAuthorized',
      'rawEvidenceDisclosureAuthorized',
      'relationshipGraphDisclosureAuthorized',
      'clientDataDisclosureAuthorized',
      'commercialDataDisclosureAuthorized',
      'currentAuthorityRevalidationRequiredBeforeServe',
      'projectionFingerprintSha256',
      'createdAt',
      'authorityConsequences'
    ],
    'trustEvidenceProjection'
  );
  if (projection.schemaVersion !== 1) invalid('trustEvidenceProjection.schemaVersion must be 1.');
  if (typeof projection.purpose !== 'string' || !PROJECTION_PURPOSES.has(projection.purpose))
    invalid('trustEvidenceProjection.purpose is invalid.');
  if (!Array.isArray(projection.evidenceItems) || !Array.isArray(projection.projectedFields))
    invalid('trustEvidenceProjection evidenceItems and projectedFields must be arrays.');
  const projectedFields = projection.projectedFields.map((field) => {
    if (typeof field !== 'string' || !PROJECTION_FIELDS.has(field))
      return invalid('trustEvidenceProjection.projectedFields contains an unsupported field.');
    return field as TrustEvidenceProjectionFieldV1;
  });
  if (new Set(projectedFields).size !== projectedFields.length)
    invalid('trustEvidenceProjection.projectedFields must not contain duplicates.');
  const historicalAuthorization = parseHistoricalAuthorization(projection.historicalAuthorization);
  const audience = parseAudience(projection.audience);
  if (projection.purpose === 'PROVIDER_DISCOVERY_TRUST_EXPLANATION') {
    if (audience.kind !== 'BOUNDED_NETWORK' && audience.kind !== 'TRUSTED_RELATIONSHIP')
      invalid('Provider Discovery Trust explanation requires a network or trusted-relationship audience.');
    if (historicalAuthorization.kind !== 'NETWORK_VISIBILITY')
      invalid('Provider Discovery Trust explanation requires Network Visibility provenance plus separate Trust projection authorization.');
  }
  const base: TrustEvidenceProjectionFingerprintInputV1 = {
    schemaVersion: 1,
    providerId: prefixed<ProviderId>(projection.providerId, 'provider_', 'trustEvidenceProjection.providerId'),
    purpose: projection.purpose as TrustEvidenceProjectionPurposeV1,
    audience,
    contextFingerprintSha256: sha256(projection.contextFingerprintSha256, 'trustEvidenceProjection.contextFingerprintSha256'),
    evidenceItems: projection.evidenceItems.map((entry) => parseItemReference(entry)),
    projectedFields,
    historicalAuthorization,
    artifactAccessAuthorized: falseOnly(projection.artifactAccessAuthorized, 'trustEvidenceProjection.artifactAccessAuthorized'),
    rawEvidenceDisclosureAuthorized: falseOnly(projection.rawEvidenceDisclosureAuthorized, 'trustEvidenceProjection.rawEvidenceDisclosureAuthorized'),
    relationshipGraphDisclosureAuthorized: falseOnly(projection.relationshipGraphDisclosureAuthorized, 'trustEvidenceProjection.relationshipGraphDisclosureAuthorized'),
    clientDataDisclosureAuthorized: falseOnly(projection.clientDataDisclosureAuthorized, 'trustEvidenceProjection.clientDataDisclosureAuthorized'),
    commercialDataDisclosureAuthorized: falseOnly(projection.commercialDataDisclosureAuthorized, 'trustEvidenceProjection.commercialDataDisclosureAuthorized'),
    currentAuthorityRevalidationRequiredBeforeServe: trueOnly(projection.currentAuthorityRevalidationRequiredBeforeServe, 'trustEvidenceProjection.currentAuthorityRevalidationRequiredBeforeServe'),
    authorityConsequences: parseAuthority(projection.authorityConsequences)
  };
  const projectionFingerprintSha256 = sha256(projection.projectionFingerprintSha256, 'trustEvidenceProjection.projectionFingerprintSha256');
  if (projectionFingerprintSha256 !== trustEvidenceVisibilityProjectionFingerprintV1(base))
    invalid('trustEvidenceProjection fingerprint does not match its bounded contents.');
  const trustEvidenceVisibilityProjectionId = prefixed<TrustEvidenceVisibilityProjectionIdV1>(projection.trustEvidenceVisibilityProjectionId, 'trust-evidence-projection_', 'trustEvidenceProjection.trustEvidenceVisibilityProjectionId');
  if (trustEvidenceVisibilityProjectionId !== `trust-evidence-projection_${projectionFingerprintSha256}`)
    invalid('trustEvidenceVisibilityProjectionId must bind the exact projection fingerprint.');
  return {
    ...base,
    trustEvidenceVisibilityProjectionId,
    projectionFingerprintSha256,
    createdAt: instant(projection.createdAt, 'trustEvidenceProjection.createdAt')
  };
}

export function parseTrustEvidenceCurrentExposureValidationV1(value: unknown): TrustEvidenceCurrentExposureValidationV1 {
  const validation = record(value, 'trustEvidenceExposureValidation');
  const common = [
    'schemaVersion',
    'decision',
    'providerId',
    'purpose',
    'contextFingerprintSha256',
    'projection',
    'checkedAt',
    'artifactAccessAuthorized',
    'authorityConsequences'
  ];
  if (validation.schemaVersion !== 1) invalid('trustEvidenceExposureValidation.schemaVersion must be 1.');
  if (typeof validation.purpose !== 'string' || !PROJECTION_PURPOSES.has(validation.purpose))
    invalid('trustEvidenceExposureValidation.purpose is invalid.');
  const projection = record(validation.projection, 'trustEvidenceExposureValidation.projection');
  exactKeys(projection, ['trustEvidenceVisibilityProjectionId', 'projectionFingerprintSha256'], 'trustEvidenceExposureValidation.projection');
  const projectionReference = {
    trustEvidenceVisibilityProjectionId: prefixed<TrustEvidenceVisibilityProjectionIdV1>(projection.trustEvidenceVisibilityProjectionId, 'trust-evidence-projection_', 'trustEvidenceExposureValidation.projection.trustEvidenceVisibilityProjectionId'),
    projectionFingerprintSha256: sha256(projection.projectionFingerprintSha256, 'trustEvidenceExposureValidation.projection.projectionFingerprintSha256')
  };
  const base = {
    schemaVersion: 1 as const,
    providerId: prefixed<ProviderId>(validation.providerId, 'provider_', 'trustEvidenceExposureValidation.providerId'),
    purpose: validation.purpose as TrustEvidenceProjectionPurposeV1,
    contextFingerprintSha256: sha256(validation.contextFingerprintSha256, 'trustEvidenceExposureValidation.contextFingerprintSha256'),
    projection: projectionReference,
    checkedAt: instant(validation.checkedAt, 'trustEvidenceExposureValidation.checkedAt'),
    artifactAccessAuthorized: falseOnly(validation.artifactAccessAuthorized, 'trustEvidenceExposureValidation.artifactAccessAuthorized'),
    authorityConsequences: parseAuthority(validation.authorityConsequences)
  };
  if (validation.decision === 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION') {
    exactKeys(validation, [...common, 'validatedEvidenceItems', 'authorityReferences'], 'trustEvidenceExposureValidation');
    if (!Array.isArray(validation.validatedEvidenceItems) || !Array.isArray(validation.authorityReferences))
      invalid('Authorized Trust exposure validation requires evidenceItems and authorityReferences arrays.');
    if (validation.authorityReferences.length < 1)
      invalid('Authorized Trust exposure validation requires current authority references.');
    return {
      ...base,
      decision: 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION',
      validatedEvidenceItems: validation.validatedEvidenceItems.map((entry) => parseItemReference(entry)),
      authorityReferences: validation.authorityReferences.map((entry, index) => text(entry, `trustEvidenceExposureValidation.authorityReferences[${index}]`, 500))
    };
  }
  if (validation.decision !== 'DENY') invalid('trustEvidenceExposureValidation.decision is invalid.');
  exactKeys(validation, [...common, 'reason'], 'trustEvidenceExposureValidation');
  if (typeof validation.reason !== 'string' || !EXPOSURE_DENIAL_REASONS.has(validation.reason))
    invalid('trustEvidenceExposureValidation.reason is invalid.');
  return {
    ...base,
    decision: 'DENY',
    reason: validation.reason as TrustEvidenceExposureDenialReasonV1
  };
}

function parseExplanationContradiction(value: unknown): TrustExplanationContradictionV1 {
  const contradiction = record(value, 'trustExplanation.contradiction');
  exactKeys(contradiction, ['left', 'right', 'explanation'], 'trustExplanation.contradiction');
  const left = parseItemReference(contradiction.left, 'trustExplanation.contradiction.left');
  const right = parseItemReference(contradiction.right, 'trustExplanation.contradiction.right');
  if (left.trustEvidenceItemId === right.trustEvidenceItemId)
    invalid('Trust Explanation contradiction must reference two distinct evidence items.');
  return {
    left,
    right,
    explanation: text(contradiction.explanation, 'trustExplanation.contradiction.explanation', 1000)
  };
}

export function parseTrustExplanationV1(value: unknown): TrustExplanationV1 {
  const explanation = record(value, 'trustExplanation');
  exactKeys(
    explanation,
    [
      'schemaVersion',
      'trustExplanationId',
      'providerId',
      'contextFingerprintSha256',
      'result',
      'evidenceItems',
      'contradictions',
      'limitations',
      'summary',
      'visibilityProjection',
      'currentExposureValidationRequiredBeforeServe',
      'universalScoreCreated',
      'rankCreated',
      'winnerCreated',
      'trustExplanationFingerprintSha256',
      'createdAt',
      'authorityConsequences'
    ],
    'trustExplanation'
  );
  if (explanation.schemaVersion !== 1) invalid('trustExplanation.schemaVersion must be 1.');
  if (typeof explanation.result !== 'string' || !EXPLANATION_RESULTS.has(explanation.result))
    invalid('trustExplanation.result is invalid.');
  if (!Array.isArray(explanation.evidenceItems) || !Array.isArray(explanation.contradictions) || !Array.isArray(explanation.limitations))
    invalid('trustExplanation evidenceItems, contradictions and limitations must be arrays.');
  const evidenceItems = explanation.evidenceItems.map((entry) => parseItemReference(entry));
  const contradictions = explanation.contradictions.map((entry) => parseExplanationContradiction(entry));
  if (explanation.result === 'INSUFFICIENT_EVIDENCE' && evidenceItems.length !== 0)
    invalid('INSUFFICIENT_EVIDENCE explanation must not manufacture evidence item references.');
  if (explanation.result === 'CONTRADICTORY_EVIDENCE' && contradictions.length < 1)
    invalid('CONTRADICTORY_EVIDENCE explanation requires explicit contradictory source references.');
  const projection = record(explanation.visibilityProjection, 'trustExplanation.visibilityProjection');
  exactKeys(projection, ['trustEvidenceVisibilityProjectionId', 'projectionFingerprintSha256'], 'trustExplanation.visibilityProjection');
  const base: TrustExplanationFingerprintInputV1 = {
    schemaVersion: 1,
    providerId: prefixed<ProviderId>(explanation.providerId, 'provider_', 'trustExplanation.providerId'),
    contextFingerprintSha256: sha256(explanation.contextFingerprintSha256, 'trustExplanation.contextFingerprintSha256'),
    result: explanation.result as TrustExplanationResultV1,
    evidenceItems,
    contradictions,
    limitations: explanation.limitations.map((entry) => parseLimitation(entry)),
    summary: text(explanation.summary, 'trustExplanation.summary', 1500),
    visibilityProjection: {
      trustEvidenceVisibilityProjectionId: prefixed<TrustEvidenceVisibilityProjectionIdV1>(projection.trustEvidenceVisibilityProjectionId, 'trust-evidence-projection_', 'trustExplanation.visibilityProjection.trustEvidenceVisibilityProjectionId'),
      projectionFingerprintSha256: sha256(projection.projectionFingerprintSha256, 'trustExplanation.visibilityProjection.projectionFingerprintSha256')
    },
    currentExposureValidationRequiredBeforeServe: trueOnly(explanation.currentExposureValidationRequiredBeforeServe, 'trustExplanation.currentExposureValidationRequiredBeforeServe'),
    universalScoreCreated: falseOnly(explanation.universalScoreCreated, 'trustExplanation.universalScoreCreated'),
    rankCreated: falseOnly(explanation.rankCreated, 'trustExplanation.rankCreated'),
    winnerCreated: falseOnly(explanation.winnerCreated, 'trustExplanation.winnerCreated'),
    authorityConsequences: parseAuthority(explanation.authorityConsequences)
  };
  const trustExplanationFingerprintSha256 = sha256(explanation.trustExplanationFingerprintSha256, 'trustExplanation.trustExplanationFingerprintSha256');
  if (trustExplanationFingerprintSha256 !== trustExplanationFingerprintV1(base))
    invalid('trustExplanation fingerprint does not match its bounded contents.');
  const trustExplanationId = prefixed<TrustExplanationIdV1>(explanation.trustExplanationId, 'trust-explanation_', 'trustExplanation.trustExplanationId');
  if (trustExplanationId !== `trust-explanation_${trustExplanationFingerprintSha256}`)
    invalid('trustExplanationId must bind the exact explanation fingerprint.');
  return {
    ...base,
    trustExplanationId,
    trustExplanationFingerprintSha256,
    createdAt: instant(explanation.createdAt, 'trustExplanation.createdAt')
  };
}

/** Immutable fixture inputs intentionally contain no customer/relationship/commercial/raw-artifact data. */
export const outcomeTrustEvidenceFixtureAtV1 = '2026-09-01T16:45:00.000Z';
export const outcomeTrustEvidenceFixtureProviderIdV1 = 'provider_fixture-trust-439' as const satisfies ProviderId;
export const outcomeTrustEvidenceFixtureContextFingerprintV1 = '4'.repeat(64);
export const outcomeTrustEvidenceUnknownExecutorFixtureV1 = Object.freeze({
  state: 'NOT_ESTABLISHED',
  assessmentState: 'UNKNOWN_OR_UNPROVEN',
  finalExecutionProviderId: null,
  checkedAt: outcomeTrustEvidenceFixtureAtV1,
  currentAuthorityRevalidationRequiredBeforeUse: true
}) satisfies Readonly<TrustEvidenceExecutorAttributionV1>;

export const outcomeTrustEvidenceFixtureContextV1 = Object.freeze({
  providerId: outcomeTrustEvidenceFixtureProviderIdV1,
  contextReference: 'trust-context:fixture-439',
  contextFingerprintSha256: outcomeTrustEvidenceFixtureContextFingerprintV1,
  jurisdiction: 'US',
  serviceType: 'TRADEMARK_FILING_SUPPORT',
  taskType: 'EVIDENCE_PREPARATION',
  collaborationScope: 'bounded-work-package:fixture-439',
  executorAttribution: outcomeTrustEvidenceUnknownExecutorFixtureV1,
  clientIdentityEmbedded: false,
  relationshipIdentityEmbedded: false,
  commercialDataEmbedded: false
}) satisfies Readonly<TrustEvidenceContextV1>;

export const outcomeTrustEvidenceFixtureCorrelationIdV1 = 'correlation_outcome_trust_439' as const satisfies MarkOrbitId;
