import type { MarkOrbitId } from './index.js';
import type {
  ProviderId,
  ProviderSupplyCapabilityId
} from './provider-execution.js';
import type {
  NetworkParticipationId,
  NetworkVisibilityAudienceV1,
  NetworkVisibilityDataClass,
  NetworkVisibilityField,
  NetworkVisibilityPurpose
} from './network-participation.js';

/**
 * Provider Discovery V1 is candidate-only network evidence. It never creates Selection,
 * Allocation, Acceptance, appointment, external-contact, Filing, Payment or Official Truth.
 */
export type ProviderDiscoveryRequestId = `provider-discovery-request_${string}`;
export type ProviderDiscoveryCandidateId =
  `provider-discovery-candidate_${string}`;

export interface ProviderDiscoveryNeedReferenceV1 {
  reference: string;
  version: number | string;
  fingerprintSha256: string;
  jurisdiction: string;
  serviceType: string;
}

/** Immutable consumer request snapshot reference evaluated by the MGSN owner runtime. */
export interface ProviderDiscoveryRequestReferenceV1 {
  schemaVersion: 1;
  providerDiscoveryRequestId: ProviderDiscoveryRequestId;
  requesterWorkspaceId: string;
  need: Readonly<ProviderDiscoveryNeedReferenceV1>;
  purpose: NetworkVisibilityPurpose;
  audience: Readonly<NetworkVisibilityAudienceV1>;
  contextReference: string;
  requestedDataClasses: readonly NetworkVisibilityDataClass[];
  requestedFields: readonly NetworkVisibilityField[];
  requestedAt: string;
  requestFingerprintSha256: string;
  correlationId: MarkOrbitId;
}

export type AuthorizedProviderProjectionFieldV1 =
  | Readonly<{
      dataClass: 'ORGANIZATION_IDENTITY';
      field: 'displayName';
      value: string;
    }>
  | Readonly<{
      dataClass: 'PROVIDER_REFERENCE';
      field: 'providerId';
      value: ProviderId;
    }>
  | Readonly<{
      dataClass: 'PROVIDER_REFERENCE';
      field: 'displayName';
      value: string;
    }>
  | Readonly<{
      dataClass: 'SUPPLY_PROFILE';
      field: 'serviceTypes';
      value: readonly string[];
    }>
  | Readonly<{
      dataClass: 'SERVICE_JURISDICTIONS';
      field: 'jurisdictions';
      value: readonly string[];
    }>
  | Readonly<{
      dataClass: 'PROVIDER_EVIDENCE_REFERENCE';
      field: 'evidenceReferences';
      value: readonly string[];
    }>;

/**
 * A projection is an explicit list of authorized fields, never a serialized Provider Registry or
 * Supply Capability record. V1 intentionally has no capacity/availability/customer/commercial field.
 */
export interface AuthorizedProviderProjectionV1 {
  schemaVersion: 1;
  fields: ReadonlyArray<AuthorizedProviderProjectionFieldV1>;
}

export const discoverySourceAuthorityStates = [
  'CURRENT',
  'STALE',
  'AMBIGUOUS',
  'UNAVAILABLE'
] as const;
export type DiscoverySourceAuthorityState =
  (typeof discoverySourceAuthorityStates)[number];

export interface DiscoverySourceVersionV1 {
  owner: 'CORE' | 'MGSN' | 'CAPABILITY_ENGINE' | 'OTHER_CANONICAL_OWNER';
  sourceType: string;
  sourceId: string;
  version: number | string;
  fingerprintSha256?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  checkedAt: string;
  authorityState: DiscoverySourceAuthorityState;
}

export type DiscoveryCurrentSourceVersionV1 = Readonly<
  Omit<DiscoverySourceVersionV1, 'authorityState'> & {
    authorityState: 'CURRENT';
  }
>;

export const discoveryEvidenceKinds = [
  'PARTICIPATION_VISIBILITY',
  'PROVIDER_OPERATIONAL',
  'SUPPLY_SUITABILITY',
  'DIRECT_EXECUTOR_DISCLOSURE',
  'OTHER_AUTHORIZED_REFERENCE'
] as const;
export type DiscoveryEvidenceKind = (typeof discoveryEvidenceKinds)[number];

/** Evidence reference visibility never grants underlying artifact retrieval. */
export interface DiscoveryEvidenceReferenceV1 {
  evidenceReference: string;
  kind: DiscoveryEvidenceKind;
  source: Readonly<DiscoverySourceVersionV1>;
  authorityClass:
    | 'MGSN_OPERATIONAL'
    | 'PROVIDER_CLAIM'
    | 'CANONICAL_OWNER_REFERENCE';
  artifactAccessAuthorized: false;
}

export type CurrentDiscoveryEvidenceReferenceV1 = Readonly<
  Omit<DiscoveryEvidenceReferenceV1, 'source'> & {
    source: DiscoveryCurrentSourceVersionV1;
  }
>;

export const directExecutorDiscoveryDisclosureStates = [
  'UNKNOWN',
  'UNPROVEN',
  'INDEPENDENT_EVIDENCE_REFERENCED'
] as const;
export type DirectExecutorDiscoveryDisclosureState =
  (typeof directExecutorDiscoveryDisclosureStates)[number];

/**
 * #375 owns the canonical responsibility proof contract. Discovery V1 may reference independent
 * evidence, but this state alone never establishes compliant direct execution.
 */
export interface DirectExecutorDiscoveryDisclosureV1 {
  state: DirectExecutorDiscoveryDisclosureState;
  evidenceReferences: readonly string[];
  requiresIndependentCurrentVerification: true;
}

export const discoveryLimitationCodes = [
  'CURRENT_VISIBILITY_REVALIDATION_REQUIRED',
  'DIRECT_EXECUTOR_NOT_ESTABLISHED',
  'EVIDENCE_ARTIFACT_RETRIEVAL_NOT_AUTHORIZED',
  'NO_BOUNDED_AVAILABILITY_SIGNAL',
  'SOURCE_FRESHNESS_LIMITED',
  'OTHER_MATERIAL_LIMITATION'
] as const;
export type DiscoveryLimitationCode = (typeof discoveryLimitationCodes)[number];

export interface DiscoveryLimitationV1 {
  code: DiscoveryLimitationCode;
  explanation: string;
}

export interface DiscoveryExplanationV1 {
  summary: string;
  matchedConstraints: readonly string[];
  evidenceReferences: readonly string[];
  limitations: ReadonlyArray<Readonly<DiscoveryLimitationV1>>;
}

/**
 * Exact historical versions that authorized the projection when the candidate was generated.
 * These versions are provenance only and must not be reused as current exposure permission.
 */
export interface DiscoveryVisibilityAuthorizationReferenceV1 {
  networkParticipationId: NetworkParticipationId;
  participationVersion: number;
  visibilityPolicyVersion: number;
  evaluatedAt: string;
  currentAuthorityRevalidationRequiredBeforeServe: true;
}

export interface ProviderDiscoveryAuthorityConsequencesV1 {
  providerSelected: false;
  providerAllocated: false;
  providerAccepted: false;
  providerEngaged: false;
  professionalAppointmentCreated: false;
  externalContactAuthorized: false;
  protectedActionAuthorized: false;
  filingAuthorized: false;
  paymentAuthorized: false;
  officialTruthCreated: false;
}

export const noProviderDiscoveryAuthorityConsequences = Object.freeze({
  providerSelected: false,
  providerAllocated: false,
  providerAccepted: false,
  providerEngaged: false,
  professionalAppointmentCreated: false,
  externalContactAuthorized: false,
  protectedActionAuthorized: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  officialTruthCreated: false
}) satisfies Readonly<ProviderDiscoveryAuthorityConsequencesV1>;

export interface ProviderDiscoveryCandidateV1 {
  schemaVersion: 1;
  providerDiscoveryCandidateId: ProviderDiscoveryCandidateId;
  request: Readonly<ProviderDiscoveryRequestReferenceV1>;
  providerId: ProviderId;
  providerWorkspaceId: string;
  providerSupplyCapability: Readonly<{
    id: ProviderSupplyCapabilityId;
    version: number;
    fingerprintSha256: string;
  }>;
  authorizedProjection: Readonly<AuthorizedProviderProjectionV1>;
  visibilityAuthorization: Readonly<
    DiscoveryVisibilityAuthorizationReferenceV1
  >;
  visibilityEvidence: ReadonlyArray<CurrentDiscoveryEvidenceReferenceV1>;
  suitabilityEvidence: ReadonlyArray<CurrentDiscoveryEvidenceReferenceV1>;
  directExecutorDisclosure: Readonly<DirectExecutorDiscoveryDisclosureV1>;
  sourceVersions: ReadonlyArray<DiscoveryCurrentSourceVersionV1>;
  evaluationPolicyVersion: string;
  explanation: Readonly<DiscoveryExplanationV1>;
  candidateFingerprintSha256: string;
  generatedAt: string;
  authorityConsequences: Readonly<ProviderDiscoveryAuthorityConsequencesV1>;
}

export const providerDiscoveryResultStatuses = [
  'CANDIDATES',
  'NO_AUTHORIZED_CANDIDATES',
  'AUTHORITY_UNAVAILABLE'
] as const;
export type ProviderDiscoveryResultStatus =
  (typeof providerDiscoveryResultStatuses)[number];

interface ProviderDiscoveryResultBaseV1 {
  schemaVersion: 1;
  request: Readonly<ProviderDiscoveryRequestReferenceV1>;
  evaluatedAt: string;
  resultFingerprintSha256: string;
  authorityConsequences: Readonly<ProviderDiscoveryAuthorityConsequencesV1>;
}

export type ProviderDiscoveryResultV1 = Readonly<
  ProviderDiscoveryResultBaseV1 &
    (
      | {
          status: 'CANDIDATES';
          candidates: readonly [
            Readonly<ProviderDiscoveryCandidateV1>,
            ...Readonly<ProviderDiscoveryCandidateV1>[]
          ];
        }
      | {
          status: 'NO_AUTHORIZED_CANDIDATES';
          candidates: readonly [];
          publicMessage: string;
        }
      | {
          status: 'AUTHORITY_UNAVAILABLE';
          candidates: readonly [];
          authorityState: Exclude<DiscoverySourceAuthorityState, 'CURRENT'>;
          publicMessage: string;
        }
    )
>;

const discoveryFixtureAt = '2026-09-01T04:45:00.000Z';
const discoveryFixtureWorkspaceId = '018f0000-0000-7000-8000-000000000381';
const discoveryFixtureProviderId =
  'provider_fixture-381' as const satisfies ProviderId;
const discoveryFixtureSupplyId =
  'provider-supply-capability_fixture-381' as const satisfies ProviderSupplyCapabilityId;

const providerDiscoveryRequestFixtureV1 = Object.freeze({
  schemaVersion: 1,
  providerDiscoveryRequestId: 'provider-discovery-request_fixture-381',
  requesterWorkspaceId: discoveryFixtureWorkspaceId,
  need: {
    reference: 'need:fixture-381',
    version: 3,
    fingerprintSha256: '1'.repeat(64),
    jurisdiction: 'US',
    serviceType: 'TRADEMARK_APPLICATION'
  },
  purpose: 'PROVIDER_DISCOVERY',
  audience: { kind: 'BOUNDED_NETWORK' as const },
  contextReference: 'context:fixture-381-network-discovery',
  requestedDataClasses: [
    'PROVIDER_REFERENCE',
    'SUPPLY_PROFILE',
    'SERVICE_JURISDICTIONS',
    'PROVIDER_EVIDENCE_REFERENCE'
  ] as const,
  requestedFields: [
    'providerId',
    'displayName',
    'serviceTypes',
    'jurisdictions',
    'evidenceReferences'
  ] as const,
  requestedAt: discoveryFixtureAt,
  requestFingerprintSha256: '2'.repeat(64),
  correlationId: 'correlation_fixture-381'
}) satisfies Readonly<ProviderDiscoveryRequestReferenceV1>;

/** Shared acceptance fixtures for candidate-only authority and privacy-safe fail-closed results. */
export const providerDiscoveryContractFixtureV1 = Object.freeze({
  candidateResult: {
    schemaVersion: 1,
    request: providerDiscoveryRequestFixtureV1,
    evaluatedAt: discoveryFixtureAt,
    resultFingerprintSha256: '3'.repeat(64),
    authorityConsequences: noProviderDiscoveryAuthorityConsequences,
    status: 'CANDIDATES',
    candidates: [
      {
        schemaVersion: 1,
        providerDiscoveryCandidateId: 'provider-discovery-candidate_fixture-381',
        request: providerDiscoveryRequestFixtureV1,
        providerId: discoveryFixtureProviderId,
        providerWorkspaceId: '018f0000-0000-7000-8000-000000003810',
        providerSupplyCapability: {
          id: discoveryFixtureSupplyId,
          version: 7,
          fingerprintSha256: '4'.repeat(64)
        },
        authorizedProjection: {
          schemaVersion: 1,
          fields: [
            {
              dataClass: 'PROVIDER_REFERENCE',
              field: 'providerId',
              value: discoveryFixtureProviderId
            },
            {
              dataClass: 'PROVIDER_REFERENCE',
              field: 'displayName',
              value: 'Fixture Provider'
            },
            {
              dataClass: 'SUPPLY_PROFILE',
              field: 'serviceTypes',
              value: ['TRADEMARK_APPLICATION']
            },
            {
              dataClass: 'SERVICE_JURISDICTIONS',
              field: 'jurisdictions',
              value: ['US']
            },
            {
              dataClass: 'PROVIDER_EVIDENCE_REFERENCE',
              field: 'evidenceReferences',
              value: ['provider-evidence:fixture-381-selected']
            }
          ]
        },
        visibilityAuthorization: {
          networkParticipationId: 'network-participation_fixture-381',
          participationVersion: 4,
          visibilityPolicyVersion: 6,
          evaluatedAt: discoveryFixtureAt,
          currentAuthorityRevalidationRequiredBeforeServe: true
        },
        visibilityEvidence: [
          {
            evidenceReference: 'visibility-evidence:fixture-381',
            kind: 'PARTICIPATION_VISIBILITY',
            source: {
              owner: 'MGSN',
              sourceType: 'NETWORK_VISIBILITY_POLICY',
              sourceId: 'network-participation_fixture-381',
              version: 6,
              fingerprintSha256: '5'.repeat(64),
              checkedAt: discoveryFixtureAt,
              authorityState: 'CURRENT'
            },
            authorityClass: 'MGSN_OPERATIONAL',
            artifactAccessAuthorized: false
          }
        ],
        suitabilityEvidence: [
          {
            evidenceReference: 'suitability-evidence:fixture-381',
            kind: 'SUPPLY_SUITABILITY',
            source: {
              owner: 'MGSN',
              sourceType: 'PROVIDER_SUPPLY_CAPABILITY',
              sourceId: discoveryFixtureSupplyId,
              version: 7,
              fingerprintSha256: '4'.repeat(64),
              effectiveFrom: '2026-01-01T00:00:00.000Z',
              checkedAt: discoveryFixtureAt,
              authorityState: 'CURRENT'
            },
            authorityClass: 'MGSN_OPERATIONAL',
            artifactAccessAuthorized: false
          }
        ],
        directExecutorDisclosure: {
          state: 'UNPROVEN',
          evidenceReferences: [],
          requiresIndependentCurrentVerification: true
        },
        sourceVersions: [
          {
            owner: 'MGSN',
            sourceType: 'PROVIDER',
            sourceId: discoveryFixtureProviderId,
            version: 2,
            fingerprintSha256: '6'.repeat(64),
            checkedAt: discoveryFixtureAt,
            authorityState: 'CURRENT'
          },
          {
            owner: 'MGSN',
            sourceType: 'PROVIDER_SUPPLY_CAPABILITY',
            sourceId: discoveryFixtureSupplyId,
            version: 7,
            fingerprintSha256: '4'.repeat(64),
            checkedAt: discoveryFixtureAt,
            authorityState: 'CURRENT'
          }
        ],
        evaluationPolicyVersion: 'mgsn-provider-discovery-v1',
        explanation: {
          summary:
            'Current visibility and supply evidence permit this Provider to be shown as a candidate for the reviewed Need.',
          matchedConstraints: [
            'jurisdiction:US',
            'serviceType:TRADEMARK_APPLICATION'
          ],
          evidenceReferences: [
            'visibility-evidence:fixture-381',
            'suitability-evidence:fixture-381'
          ],
          limitations: [
            {
              code: 'CURRENT_VISIBILITY_REVALIDATION_REQUIRED',
              explanation: 'Historical candidate replay does not authorize current exposure.'
            },
            {
              code: 'DIRECT_EXECUTOR_NOT_ESTABLISHED',
              explanation: 'Direct-executor proof remains an independent governed dependency.'
            },
            {
              code: 'EVIDENCE_ARTIFACT_RETRIEVAL_NOT_AUTHORIZED',
              explanation: 'Evidence references do not grant access to underlying artifacts.'
            },
            {
              code: 'NO_BOUNDED_AVAILABILITY_SIGNAL',
              explanation: 'Raw capacity and availability are private and no derived signal is exposed.'
            }
          ]
        },
        candidateFingerprintSha256: '7'.repeat(64),
        generatedAt: discoveryFixtureAt,
        authorityConsequences: noProviderDiscoveryAuthorityConsequences
      }
    ]
  },
  failClosedResult: {
    schemaVersion: 1,
    request: providerDiscoveryRequestFixtureV1,
    evaluatedAt: discoveryFixtureAt,
    resultFingerprintSha256: '8'.repeat(64),
    authorityConsequences: noProviderDiscoveryAuthorityConsequences,
    status: 'NO_AUTHORIZED_CANDIDATES',
    candidates: [],
    publicMessage:
      'No Provider candidates are currently available for this request.'
  },
  authorityUnavailableResult: {
    schemaVersion: 1,
    request: providerDiscoveryRequestFixtureV1,
    evaluatedAt: discoveryFixtureAt,
    resultFingerprintSha256: '9'.repeat(64),
    authorityConsequences: noProviderDiscoveryAuthorityConsequences,
    status: 'AUTHORITY_UNAVAILABLE',
    candidates: [],
    authorityState: 'STALE',
    publicMessage:
      'Provider discovery is unavailable until current authority can be verified.'
  }
} as const satisfies Readonly<{
  candidateResult: ProviderDiscoveryResultV1;
  failClosedResult: ProviderDiscoveryResultV1;
  authorityUnavailableResult: ProviderDiscoveryResultV1;
}>);
