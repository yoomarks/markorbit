import type { MarkOrbitId } from './index.js';
import type {
  EffectivePeriod,
  ProviderId,
  ProviderSupplyCapabilityId
} from './provider-execution.js';
import type {
  NetworkVisibilityAuthorityState,
  NetworkVisibilityDataClass,
  NetworkVisibilityPurpose
} from './network-participation.js';

/**
 * Provider Discovery V1 is advisory MGSN network evidence only.
 * Candidate != Selection != Allocation != Acceptance != appointment.
 */
export type ProviderDiscoveryRequestId = `provider-discovery-request_${string}`;
export type ProviderDiscoveryCandidateId = `provider-discovery-candidate_${string}`;
export type DiscoveryEvidenceReferenceId = `discovery-evidence_${string}`;

export interface ProviderDiscoveryNeedReferenceV1 {
  id: string;
  version: number | string;
  fingerprintSha256: string;
}

/**
 * Immutable, bounded request reference assembled from owner sources. The requester Workspace is
 * trusted Core identity context; the contract intentionally contains no end-client/contact,
 * originating pricing/margin, unrelated Matter, Trademark or communication fields.
 */
export interface ProviderDiscoveryRequestReferenceV1 {
  schemaVersion: 1;
  providerDiscoveryRequestId: ProviderDiscoveryRequestId;
  requesterWorkspaceId: string;
  needReference: Readonly<ProviderDiscoveryNeedReferenceV1>;
  purpose: NetworkVisibilityPurpose;
  audienceReference: string;
  contextReference: string;
  requestedDataClasses: readonly NetworkVisibilityDataClass[];
  requestedAt: string;
  requestFingerprintSha256: string;
  correlationId: MarkOrbitId;
}

export const discoverySourceKinds = [
  'PROVIDER_REGISTRY',
  'PROVIDER_SUPPLY_CAPABILITY',
  'NETWORK_PARTICIPATION',
  'VISIBILITY_POLICY',
  'CAPABILITY_REFERENCE',
  'DISCOVERY_EVALUATION_POLICY',
  'EVIDENCE_REFERENCE',
  'DIRECT_EXECUTOR_DISCLOSURE'
] as const;
export type DiscoverySourceKind = (typeof discoverySourceKinds)[number];

export const discoverySourceAuthorities = [
  'MGSN_OPERATIONAL',
  'MGSN_AUTHORIZATION',
  'CAPABILITY_OWNER',
  'CANONICAL_OWNER_VERIFIED',
  'PROVIDER_CLAIM'
] as const;
export type DiscoverySourceAuthority = (typeof discoverySourceAuthorities)[number];

/** Exact owner/source lineage. A null fingerprint is explicit when that source has version only. */
export interface DiscoverySourceVersionV1 {
  schemaVersion: 1;
  sourceKind: DiscoverySourceKind;
  sourceAuthority: DiscoverySourceAuthority;
  sourceReference: string;
  version: number | string;
  fingerprintSha256: string | null;
  currentness: NetworkVisibilityAuthorityState;
  observedAt: string;
  effectivePeriod?: Readonly<EffectivePeriod>;
}

export const discoveryEvidenceKinds = [
  'EXPOSURE_AUTHORIZATION',
  'OPERATIONAL_SUITABILITY',
  'SOURCE_PROVENANCE',
  'DIRECT_EXECUTOR_DISCLOSURE'
] as const;
export type DiscoveryEvidenceKind = (typeof discoveryEvidenceKinds)[number];

/**
 * Evidence-reference visibility never authorizes dereferencing the underlying artifact. Private
 * evidence retrieval remains a separate authorization boundary.
 */
export interface DiscoveryEvidenceReferenceV1 {
  schemaVersion: 1;
  discoveryEvidenceReferenceId: DiscoveryEvidenceReferenceId;
  kind: DiscoveryEvidenceKind;
  reference: string;
  source: Readonly<DiscoverySourceVersionV1>;
  explanationSafeLabel: string;
  referenceVisibilityAuthorized: true;
  artifactDereferenceAuthorized: false;
}

export const authorizedProviderProjectionFieldNames = [
  'providerId',
  'displayName',
  'serviceTypes',
  'jurisdictions',
  'evidenceReferences'
] as const;
export type AuthorizedProviderProjectionFieldName =
  (typeof authorizedProviderProjectionFieldNames)[number];

export type AuthorizedProviderProjectionFieldV1 =
  | Readonly<{
      dataClass: 'PROVIDER_REFERENCE';
      field: 'providerId';
      value: ProviderId;
      authorizationEvidenceReferences: readonly DiscoveryEvidenceReferenceId[];
    }>
  | Readonly<{
      dataClass: 'PROVIDER_REFERENCE' | 'ORGANIZATION_IDENTITY';
      field: 'displayName';
      value: string;
      authorizationEvidenceReferences: readonly DiscoveryEvidenceReferenceId[];
    }>
  | Readonly<{
      dataClass: 'SUPPLY_PROFILE';
      field: 'serviceTypes';
      value: readonly string[];
      authorizationEvidenceReferences: readonly DiscoveryEvidenceReferenceId[];
    }>
  | Readonly<{
      dataClass: 'SERVICE_JURISDICTIONS';
      field: 'jurisdictions';
      value: readonly string[];
      authorizationEvidenceReferences: readonly DiscoveryEvidenceReferenceId[];
    }>
  | Readonly<{
      dataClass: 'PROVIDER_EVIDENCE_REFERENCE';
      field: 'evidenceReferences';
      value: readonly string[];
      authorizationEvidenceReferences: readonly DiscoveryEvidenceReferenceId[];
    }>;

/**
 * A projection is an explicit field allowlist, never a Provider Registry or Supply Capability
 * serialization. Raw capacity/availability and private evidence artifacts have no V1 field.
 */
export interface AuthorizedProviderProjectionV1 {
  schemaVersion: 1;
  fields: readonly AuthorizedProviderProjectionFieldV1[];
}

export const discoveryLimitationCodes = [
  'CURRENT_AUTHORITY_REVALIDATION_REQUIRED',
  'DEFERRED_VERIFICATION',
  'EVIDENCE_ARTIFACT_NOT_AUTHORIZED',
  'DIRECT_EXECUTOR_NOT_ESTABLISHED',
  'BOUNDED_PROJECTION_ONLY'
] as const;
export type DiscoveryLimitationCode = (typeof discoveryLimitationCodes)[number];

export interface DiscoveryLimitationV1 {
  code: DiscoveryLimitationCode;
  explanation: string;
}

/** Privacy-safe explanation. Internal hidden-provider exclusion reasons do not belong here. */
export interface DiscoveryExplanationV1 {
  schemaVersion: 1;
  summary: string;
  matchedNeedReference: Readonly<ProviderDiscoveryNeedReferenceV1>;
  matchedJurisdiction: string;
  matchedServiceType: string;
  passedOperationalChecks: readonly string[];
  exposureEvidenceReferences: readonly DiscoveryEvidenceReferenceId[];
  suitabilityEvidenceReferences: readonly DiscoveryEvidenceReferenceId[];
  sourceVersions: readonly DiscoverySourceVersionV1[];
  freshnessStatement: string;
}

/**
 * #375 owns the future canonical responsibility proof. Until that contract lands, this contract
 * can only represent absence or a bounded disclosure reference and never assumes proof.
 */
export const directExecutorDisclosureStates = [
  'NOT_ESTABLISHED',
  'DISCLOSURE_REFERENCE_PRESENT'
] as const;
export type DirectExecutorDisclosureState = (typeof directExecutorDisclosureStates)[number];

export type ProviderDiscoveryDirectExecutorDisclosureV1 = Readonly<
  | {
      state: 'NOT_ESTABLISHED';
      disclosureReference: null;
      proofEstablished: false;
      currentProofRequiredWhenFlowRequiresDirectExecution: true;
    }
  | {
      state: 'DISCLOSURE_REFERENCE_PRESENT';
      disclosureReference: string;
      proofEstablished: false;
      currentProofRequiredWhenFlowRequiresDirectExecution: true;
    }
>;

export interface ProviderDiscoveryAuthorityConsequencesV1 {
  selected: false;
  allocated: false;
  accepted: false;
  engaged: false;
  appointed: false;
  servicePackageSelected: false;
  externalContactAuthorized: false;
  protectedActionAuthorized: false;
  filingAuthorized: false;
  paymentAuthorized: false;
  officialTruthCreated: false;
  userCapabilityVerified: false;
}

export const noProviderDiscoveryAuthorityConsequences = Object.freeze({
  selected: false,
  allocated: false,
  accepted: false,
  engaged: false,
  appointed: false,
  servicePackageSelected: false,
  externalContactAuthorized: false,
  protectedActionAuthorized: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  officialTruthCreated: false,
  userCapabilityVerified: false
}) satisfies Readonly<ProviderDiscoveryAuthorityConsequencesV1>;

/**
 * Deterministic historical candidate snapshot. It records versions used for the evaluation but is
 * never current exposure permission; serving/dereferencing it requires current authority recheck.
 */
export interface ProviderDiscoveryCandidateV1 {
  schemaVersion: 1;
  providerDiscoveryCandidateId: ProviderDiscoveryCandidateId;
  request: Readonly<ProviderDiscoveryRequestReferenceV1>;
  providerId: ProviderId;
  providerWorkspaceId: string;
  providerSupplyCapabilityId: ProviderSupplyCapabilityId;
  providerSource: Readonly<DiscoverySourceVersionV1>;
  supplySource: Readonly<DiscoverySourceVersionV1>;
  participationSource: Readonly<DiscoverySourceVersionV1>;
  visibilityPolicySource: Readonly<DiscoverySourceVersionV1>;
  discoveryPolicySource: Readonly<DiscoverySourceVersionV1>;
  projection: Readonly<AuthorizedProviderProjectionV1>;
  exposureEvidence: readonly Readonly<DiscoveryEvidenceReferenceV1>[];
  suitabilityEvidence: readonly Readonly<DiscoveryEvidenceReferenceV1>[];
  explanation: Readonly<DiscoveryExplanationV1>;
  limitations: readonly Readonly<DiscoveryLimitationV1>[];
  directExecutorDisclosure: Readonly<ProviderDiscoveryDirectExecutorDisclosureV1>;
  deterministicFingerprintSha256: string;
  generatedAt: string;
  currentAuthorityRevalidationRequired: true;
  historicalResultAuthorizesExposure: false;
  authorityConsequences: Readonly<ProviderDiscoveryAuthorityConsequencesV1>;
}

export const providerDiscoveryEmptyReasons = [
  'NO_AUTHORIZED_CANDIDATES',
  'CURRENT_AUTHORITY_UNAVAILABLE'
] as const;
export type ProviderDiscoveryEmptyReason = (typeof providerDiscoveryEmptyReasons)[number];

export type ProviderDiscoveryResultV1 = Readonly<
  | {
      schemaVersion: 1;
      outcome: 'CANDIDATES';
      request: Readonly<ProviderDiscoveryRequestReferenceV1>;
      candidates: readonly [
        Readonly<ProviderDiscoveryCandidateV1>,
        ...Readonly<ProviderDiscoveryCandidateV1>[]
      ];
      ordering: 'ADMINISTRATIVELY_NEUTRAL';
      generatedAt: string;
      resultFingerprintSha256: string;
      authorityConsequences: Readonly<ProviderDiscoveryAuthorityConsequencesV1>;
    }
  | {
      schemaVersion: 1;
      outcome: 'EMPTY_FAIL_CLOSED';
      request: Readonly<ProviderDiscoveryRequestReferenceV1>;
      candidates: readonly [];
      publicReason: ProviderDiscoveryEmptyReason;
      generatedAt: string;
      resultFingerprintSha256: string;
      authorityConsequences: Readonly<ProviderDiscoveryAuthorityConsequencesV1>;
    }
>;

const fixtureAt = '2026-09-01T00:00:00.000Z';
const fixtureWorkspaceId = '018f0000-0000-7000-8000-000000000381';
const fixtureProviderId = 'provider_fixture-381' as const satisfies ProviderId;
const fixtureSupplyId =
  'provider-supply-capability_fixture-381' as const satisfies ProviderSupplyCapabilityId;
const exposureEvidenceId = 'discovery-evidence_fixture-381-exposure' as const;
const suitabilityEvidenceId = 'discovery-evidence_fixture-381-suitability' as const;

const fixtureNeed = Object.freeze({
  id: 'need:fixture-381',
  version: 4,
  fingerprintSha256: '1'.repeat(64)
}) satisfies Readonly<ProviderDiscoveryNeedReferenceV1>;

const fixtureRequest = Object.freeze({
  schemaVersion: 1,
  providerDiscoveryRequestId: 'provider-discovery-request_fixture-381',
  requesterWorkspaceId: fixtureWorkspaceId,
  needReference: fixtureNeed,
  purpose: 'PROVIDER_DISCOVERY',
  audienceReference: 'audience:bounded-network',
  contextReference: 'context:fixture-381',
  requestedDataClasses: ['PROVIDER_REFERENCE', 'SUPPLY_PROFILE', 'SERVICE_JURISDICTIONS'],
  requestedAt: fixtureAt,
  requestFingerprintSha256: '2'.repeat(64),
  correlationId: 'correlation_fixture-381'
}) satisfies Readonly<ProviderDiscoveryRequestReferenceV1>;

const fixtureSource = (
  sourceKind: DiscoverySourceKind,
  sourceAuthority: DiscoverySourceAuthority,
  sourceReference: string,
  version: number | string,
  fingerprintSha256: string | null = null,
  currentness: NetworkVisibilityAuthorityState = 'CURRENT'
): Readonly<DiscoverySourceVersionV1> =>
  Object.freeze({
    schemaVersion: 1,
    sourceKind,
    sourceAuthority,
    sourceReference,
    version,
    fingerprintSha256,
    currentness,
    observedAt: fixtureAt
  });

const exposureEvidence = Object.freeze({
  schemaVersion: 1,
  discoveryEvidenceReferenceId: exposureEvidenceId,
  kind: 'EXPOSURE_AUTHORIZATION',
  reference: 'authorization:fixture-381-visibility',
  source: fixtureSource(
    'VISIBILITY_POLICY',
    'MGSN_AUTHORIZATION',
    'visibility-policy:fixture-381',
    3
  ),
  explanationSafeLabel: 'Current bounded Provider Discovery visibility policy.',
  referenceVisibilityAuthorized: true,
  artifactDereferenceAuthorized: false
}) satisfies Readonly<DiscoveryEvidenceReferenceV1>;

const suitabilityEvidence = Object.freeze({
  schemaVersion: 1,
  discoveryEvidenceReferenceId: suitabilityEvidenceId,
  kind: 'OPERATIONAL_SUITABILITY',
  reference: 'supply-check:fixture-381',
  source: fixtureSource(
    'PROVIDER_SUPPLY_CAPABILITY',
    'MGSN_OPERATIONAL',
    fixtureSupplyId,
    7,
    '3'.repeat(64)
  ),
  explanationSafeLabel: 'Current service and jurisdiction match.',
  referenceVisibilityAuthorized: true,
  artifactDereferenceAuthorized: false
}) satisfies Readonly<DiscoveryEvidenceReferenceV1>;

const fixtureCandidate = Object.freeze({
  schemaVersion: 1,
  providerDiscoveryCandidateId: 'provider-discovery-candidate_fixture-381',
  request: fixtureRequest,
  providerId: fixtureProviderId,
  providerWorkspaceId: '018f0000-0000-7000-8000-000000000382',
  providerSupplyCapabilityId: fixtureSupplyId,
  providerSource: fixtureSource(
    'PROVIDER_REGISTRY',
    'MGSN_OPERATIONAL',
    fixtureProviderId,
    5,
    '4'.repeat(64)
  ),
  supplySource: fixtureSource(
    'PROVIDER_SUPPLY_CAPABILITY',
    'MGSN_OPERATIONAL',
    fixtureSupplyId,
    7,
    '3'.repeat(64)
  ),
  participationSource: fixtureSource(
    'NETWORK_PARTICIPATION',
    'MGSN_AUTHORIZATION',
    'network-participation:fixture-381',
    2
  ),
  visibilityPolicySource: fixtureSource(
    'VISIBILITY_POLICY',
    'MGSN_AUTHORIZATION',
    'visibility-policy:fixture-381',
    3
  ),
  discoveryPolicySource: fixtureSource(
    'DISCOVERY_EVALUATION_POLICY',
    'MGSN_OPERATIONAL',
    'discovery-policy:v1',
    '1'
  ),
  projection: {
    schemaVersion: 1,
    fields: [
      {
        dataClass: 'PROVIDER_REFERENCE',
        field: 'providerId',
        value: fixtureProviderId,
        authorizationEvidenceReferences: [exposureEvidenceId]
      },
      {
        dataClass: 'PROVIDER_REFERENCE',
        field: 'displayName',
        value: 'Fixture Provider',
        authorizationEvidenceReferences: [exposureEvidenceId]
      },
      {
        dataClass: 'SUPPLY_PROFILE',
        field: 'serviceTypes',
        value: ['TRADEMARK_FILING'],
        authorizationEvidenceReferences: [exposureEvidenceId]
      },
      {
        dataClass: 'SERVICE_JURISDICTIONS',
        field: 'jurisdictions',
        value: ['US'],
        authorizationEvidenceReferences: [exposureEvidenceId]
      }
    ]
  },
  exposureEvidence: [exposureEvidence],
  suitabilityEvidence: [suitabilityEvidence],
  explanation: {
    schemaVersion: 1,
    summary: 'Provider is an authorized candidate for the reviewed service and jurisdiction.',
    matchedNeedReference: fixtureNeed,
    matchedJurisdiction: 'US',
    matchedServiceType: 'TRADEMARK_FILING',
    passedOperationalChecks: ['PROVIDER_ACTIVE', 'SUPPLY_ACTIVE', 'JURISDICTION_MATCH'],
    exposureEvidenceReferences: [exposureEvidenceId],
    suitabilityEvidenceReferences: [suitabilityEvidenceId],
    sourceVersions: [
      fixtureSource('PROVIDER_REGISTRY', 'MGSN_OPERATIONAL', fixtureProviderId, 5, '4'.repeat(64)),
      fixtureSource(
        'PROVIDER_SUPPLY_CAPABILITY',
        'MGSN_OPERATIONAL',
        fixtureSupplyId,
        7,
        '3'.repeat(64)
      ),
      fixtureSource(
        'NETWORK_PARTICIPATION',
        'MGSN_AUTHORIZATION',
        'network-participation:fixture-381',
        2
      ),
      fixtureSource(
        'VISIBILITY_POLICY',
        'MGSN_AUTHORIZATION',
        'visibility-policy:fixture-381',
        3
      )
    ],
    freshnessStatement: 'Sources were current at generation time; current authority must be revalidated.'
  },
  limitations: [
    {
      code: 'CURRENT_AUTHORITY_REVALIDATION_REQUIRED',
      explanation: 'Historical determinism is not current visibility authority.'
    },
    {
      code: 'DIRECT_EXECUTOR_NOT_ESTABLISHED',
      explanation: 'Canonical direct-executor proof is not established by Provider Discovery V1.'
    },
    {
      code: 'BOUNDED_PROJECTION_ONLY',
      explanation: 'Only explicitly visibility-authorized fields are projected.'
    }
  ],
  directExecutorDisclosure: {
    state: 'NOT_ESTABLISHED',
    disclosureReference: null,
    proofEstablished: false,
    currentProofRequiredWhenFlowRequiresDirectExecution: true
  },
  deterministicFingerprintSha256: '5'.repeat(64),
  generatedAt: fixtureAt,
  currentAuthorityRevalidationRequired: true,
  historicalResultAuthorizesExposure: false,
  authorityConsequences: noProviderDiscoveryAuthorityConsequences
}) satisfies Readonly<ProviderDiscoveryCandidateV1>;

/** Shared acceptance fixtures for candidate-only, projection-only and fail-closed semantics. */
export const providerDiscoveryFixtureV1 = Object.freeze({
  authorizedCandidateResult: {
    schemaVersion: 1,
    outcome: 'CANDIDATES',
    request: fixtureRequest,
    candidates: [fixtureCandidate],
    ordering: 'ADMINISTRATIVELY_NEUTRAL',
    generatedAt: fixtureAt,
    resultFingerprintSha256: '6'.repeat(64),
    authorityConsequences: noProviderDiscoveryAuthorityConsequences
  },
  failClosedEmptyResult: {
    schemaVersion: 1,
    outcome: 'EMPTY_FAIL_CLOSED',
    request: fixtureRequest,
    candidates: [],
    publicReason: 'NO_AUTHORIZED_CANDIDATES',
    generatedAt: fixtureAt,
    resultFingerprintSha256: '7'.repeat(64),
    authorityConsequences: noProviderDiscoveryAuthorityConsequences
  },
  historicalCandidate: {
    ...fixtureCandidate,
    providerDiscoveryCandidateId: 'provider-discovery-candidate_fixture-381-historical',
    visibilityPolicySource: fixtureSource(
      'VISIBILITY_POLICY',
      'MGSN_AUTHORIZATION',
      'visibility-policy:fixture-381',
      3,
      null,
      'STALE'
    ),
    deterministicFingerprintSha256: '8'.repeat(64)
  }
} as const satisfies Readonly<{
  authorizedCandidateResult: ProviderDiscoveryResultV1;
  failClosedEmptyResult: ProviderDiscoveryResultV1;
  historicalCandidate: ProviderDiscoveryCandidateV1;
}>;
