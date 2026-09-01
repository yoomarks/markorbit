import type { MarkOrbitId } from './index.js';
import type {
  DirectExecutorDiscoveryDisclosureState,
  DiscoveryCurrentSourceVersionV1,
  DiscoveryVisibilityAuthorizationReferenceV1,
  ProviderDiscoveryCandidateId,
  ProviderDiscoveryRequestId
} from './provider-discovery.js';
import type { ProviderId, ProviderSupplyCapabilityId } from './provider-execution.js';

/**
 * Human Provider Selection V1 records one explicit authenticated human choice.
 * It is not Discovery, Allocation, Provider Acceptance, appointment, engagement,
 * protected-action release, Filing, Payment, Official Truth or completion.
 */
export type ProviderSelectionId = `provider-selection_${string}`;

export const providerSelectionStatuses = ['CURRENT', 'SUPERSEDED', 'REVOKED'] as const;
export type ProviderSelectionStatus = (typeof providerSelectionStatuses)[number];

export interface ProviderSelectionScopeReferenceV1 {
  owner: 'CORE' | 'LITE' | 'MARKREG' | 'OPERATIONS' | 'OTHER_CANONICAL_CONSUMER';
  reference: string;
  version: number | string;
  fingerprintSha256: string;
}

export interface ProviderSelectionDiscoveryRequestLineageV1 {
  providerDiscoveryRequestId: ProviderDiscoveryRequestId;
  requesterWorkspaceId: string;
  requestFingerprintSha256: string;
  needReference: string;
  needVersion: number | string;
  needFingerprintSha256: string;
  purpose: string;
  contextReference: string;
}

/**
 * Selection references the exact Discovery result/candidate rather than serializing the candidate
 * or its authorized Provider projection into the Selection record.
 */
export interface ProviderSelectionSourceLineageV1 {
  discoveryRequest: Readonly<ProviderSelectionDiscoveryRequestLineageV1>;
  discoveryResult: Readonly<{
    resultFingerprintSha256: string;
    evaluatedAt: string;
  }>;
  discoveryCandidate: Readonly<{
    providerDiscoveryCandidateId: ProviderDiscoveryCandidateId;
    candidateFingerprintSha256: string;
    generatedAt: string;
    evaluationPolicyVersion: string;
  }>;
  provider: Readonly<{
    providerId: ProviderId;
    providerWorkspaceId: string;
  }>;
  providerSupplyCapability: Readonly<{
    id: ProviderSupplyCapabilityId;
    version: number;
    fingerprintSha256: string;
  }>;
  visibilityAuthorizationAtReview: Readonly<DiscoveryVisibilityAuthorizationReferenceV1>;
  historicalSourceVersions: ReadonlyArray<DiscoveryCurrentSourceVersionV1>;
  directExecutorDisclosureAtReview: Readonly<{
    state: DirectExecutorDiscoveryDisclosureState;
    evidenceReferences: readonly string[];
  }>;
  currentAuthorityRevalidationRequiredBeforeSelectionCommit: true;
  currentAuthorityRevalidationRequiredBeforeDownstreamUse: true;
}

/**
 * This authority object is produced from the trusted Core Workspace Principal boundary. Payload
 * actor/workspace labels are never authority and must be rejected when they disagree with it.
 */
export interface ProviderSelectionTrustedHumanAuthorityV1 {
  source: 'CORE_WORKSPACE_PRINCIPAL';
  requesterWorkspaceId: string;
  selectingActorId: string;
  principalReference: string;
  workspaceMembershipReference: string;
  selectionAuthorityReference: string;
  selectionAuthorityVersion: number | string;
  authenticatedAt: string;
  affirmativeHumanActionEvidenceReference: string;
  payloadIdentityAuthoritative: false;
}

export const providerSelectionReasonCodes = [
  'FIT_FOR_REVIEWED_NEED',
  'JURISDICTION_AND_SERVICE_MATCH',
  'EVIDENCE_AND_LIMITATIONS_REVIEWED',
  'OTHER_BOUNDED_REASON'
] as const;
export type ProviderSelectionReasonCode = (typeof providerSelectionReasonCodes)[number];

export interface ProviderSelectionHumanAcknowledgementV1 {
  affirmativeHumanAction: true;
  acknowledgementCode: 'HUMAN_PROVIDER_SELECTION_V1';
  acknowledgementTextVersion: string;
  reviewedCandidateId: ProviderDiscoveryCandidateId;
  reviewedCandidateFingerprintSha256: string;
  reviewedScopeFingerprintSha256: string;
  reviewedAt: string;
  reasonCode: ProviderSelectionReasonCode;
  rationale?: string;
  containsCustomerDocuments: false;
  containsRawEvidenceArtifacts: false;
  containsEndClientRelationshipInformation: false;
  containsApplicantOwnerOfficialData: false;
  containsCommercialMarginOrProfit: false;
}

export interface ProviderSelectionAuthorityConsequencesV1 {
  humanProviderSelectionRecorded: true;
  providerAllocated: false;
  providerAccepted: false;
  providerEngaged: false;
  professionalAppointmentCreated: false;
  externalContactAuthorized: false;
  protectedActionReleased: false;
  servicePackageCreated: false;
  filingAuthorized: false;
  filingSubmitted: false;
  paymentAuthorized: false;
  paymentCreated: false;
  officialTruthCreated: false;
  matterCompleted: false;
}

export const noDownstreamProviderSelectionAuthorityConsequences = Object.freeze({
  humanProviderSelectionRecorded: true,
  providerAllocated: false,
  providerAccepted: false,
  providerEngaged: false,
  professionalAppointmentCreated: false,
  externalContactAuthorized: false,
  protectedActionReleased: false,
  servicePackageCreated: false,
  filingAuthorized: false,
  filingSubmitted: false,
  paymentAuthorized: false,
  paymentCreated: false,
  officialTruthCreated: false,
  matterCompleted: false
}) satisfies Readonly<ProviderSelectionAuthorityConsequencesV1>;

interface ProviderSelectionBaseV1 {
  schemaVersion: 1;
  providerSelectionId: ProviderSelectionId;
  requesterWorkspaceId: string;
  scope: Readonly<ProviderSelectionScopeReferenceV1>;
  scopeVersion: number;
  sourceLineage: Readonly<ProviderSelectionSourceLineageV1>;
  trustedHumanAuthority: Readonly<ProviderSelectionTrustedHumanAuthorityV1>;
  acknowledgement: Readonly<ProviderSelectionHumanAcknowledgementV1>;
  selectedAt: string;
  version: number;
  correlationId: MarkOrbitId;
  authorityConsequences: Readonly<ProviderSelectionAuthorityConsequencesV1>;
}

export interface ProviderSelectionVersionReferenceV1 {
  providerSelectionId: ProviderSelectionId;
  version: number;
  scopeVersion: number;
}

export type ProviderSelectionV1 = Readonly<
  ProviderSelectionBaseV1 &
    (
      | {
          status: 'CURRENT';
          supersededBy: null;
          revokedAt: null;
        }
      | {
          status: 'SUPERSEDED';
          supersededBy: Readonly<ProviderSelectionVersionReferenceV1>;
          revokedAt: null;
        }
      | {
          status: 'REVOKED';
          supersededBy: null;
          revokedAt: string;
          revocationReasonCode: 'HUMAN_WITHDRAWAL' | 'SCOPE_CANCELLED' | 'OTHER_BOUNDED_REASON';
        }
    )
>;

export type ProviderSelectionExpectedCurrentV1 =
  | Readonly<{
      kind: 'ABSENT';
      expectedScopeVersion: number;
    }>
  | Readonly<{
      kind: 'EXACT';
      providerSelectionId: ProviderSelectionId;
      version: number;
      expectedScopeVersion: number;
    }>;

/**
 * Creation and replacement share one command. EXACT means the named CURRENT Selection must be
 * atomically superseded if the new exact candidate passes current revalidation. ABSENT means first
 * creation and must not infer a choice from an Allocation, recommendation or prior work.
 */
export interface CreateOrReplaceProviderSelectionCommandV1 {
  schemaVersion: 1;
  requesterWorkspaceId: string;
  scope: Readonly<ProviderSelectionScopeReferenceV1>;
  sourceLineage: Readonly<ProviderSelectionSourceLineageV1>;
  trustedHumanAuthority: Readonly<ProviderSelectionTrustedHumanAuthorityV1>;
  acknowledgement: Readonly<ProviderSelectionHumanAcknowledgementV1>;
  expectedCurrent: ProviderSelectionExpectedCurrentV1;
  idempotencyKey: string;
  commandFingerprintSha256: string;
  correlationId: MarkOrbitId;
}

/** Revocation withdraws the human choice and does not require positive candidate revalidation. */
export interface RevokeProviderSelectionCommandV1 {
  schemaVersion: 1;
  requesterWorkspaceId: string;
  scope: Readonly<ProviderSelectionScopeReferenceV1>;
  target: Readonly<ProviderSelectionVersionReferenceV1>;
  trustedHumanAuthority: Readonly<ProviderSelectionTrustedHumanAuthorityV1>;
  reasonCode: 'HUMAN_WITHDRAWAL' | 'SCOPE_CANCELLED' | 'OTHER_BOUNDED_REASON';
  rationale?: string;
  idempotencyKey: string;
  commandFingerprintSha256: string;
  correlationId: MarkOrbitId;
}

export const providerSelectionMutationKinds = ['CREATED', 'REPLACED', 'REVOKED'] as const;
export type ProviderSelectionMutationKind = (typeof providerSelectionMutationKinds)[number];

/**
 * Replay returns the historical committed mutation result. replayed=true never means the Selection
 * is currently usable and cannot restore a SUPERSEDED or REVOKED Selection to CURRENT.
 */
export interface ProviderSelectionMutationResultV1 {
  schemaVersion: 1;
  mutation: ProviderSelectionMutationKind;
  selection: ProviderSelectionV1;
  previousSelection?: Readonly<ProviderSelectionVersionReferenceV1>;
  replayed: boolean;
  replayDoesNotEstablishCurrentUsability: true;
  correlationId: MarkOrbitId;
}

export const providerSelectionValidationPurposes = [
  'SELECTION_COMMIT',
  'CONTROLLED_HANDOFF_REVIEW',
  'ALLOCATION_PREREQUISITE_REVIEW'
] as const;
export type ProviderSelectionValidationPurpose =
  (typeof providerSelectionValidationPurposes)[number];

export const providerSelectionValidationDenialReasons = [
  'SELECTION_SUPERSEDED',
  'SELECTION_REVOKED',
  'STALE_CANDIDATE',
  'REQUESTER_AUTHORITY_NOT_CURRENT',
  'ACTOR_AUTHORITY_NOT_CURRENT',
  'PARTICIPATION_NOT_ACTIVE',
  'VISIBILITY_NO_LONGER_AUTHORIZED',
  'TRUSTED_RELATIONSHIP_NOT_CURRENT',
  'PROVIDER_NOT_OPERATIONAL',
  'SUPPLY_NOT_CURRENT',
  'DIRECT_EXECUTOR_NOT_ESTABLISHED',
  'SOURCE_VERSION_MISMATCH',
  'AUTHORITY_UNAVAILABLE'
] as const;
export type ProviderSelectionValidationDenialReason =
  (typeof providerSelectionValidationDenialReasons)[number];

interface ProviderSelectionCurrentValidationBaseV1 {
  schemaVersion: 1;
  selection: Readonly<ProviderSelectionVersionReferenceV1>;
  requesterWorkspaceId: string;
  scope: Readonly<ProviderSelectionScopeReferenceV1>;
  purpose: ProviderSelectionValidationPurpose;
  evaluatedAt: string;
  validationPolicyVersion: string;
  checkedAuthorityReferences: readonly string[];
  authorityConsequences: Readonly<ProviderSelectionAuthorityConsequencesV1>;
  validationDoesNotAuthorizeDownstreamAction: true;
}

/** Lifecycle state and current usability are intentionally separate. */
export type ProviderSelectionCurrentValidationV1 = Readonly<
  ProviderSelectionCurrentValidationBaseV1 &
    (
      | {
          decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW';
          currentlyUsable: true;
          publicReason: string;
        }
      | {
          decision: 'DENY';
          currentlyUsable: false;
          denialReason: ProviderSelectionValidationDenialReason;
          publicReason: string;
        }
    )
>;

const selectionFixtureAt = '2026-09-01T05:12:00.000Z';
const selectionFixtureWorkspaceId = '018f0000-0000-7000-8000-000000000381';
const selectionFixtureProviderId = 'provider_fixture-381' as const satisfies ProviderId;
const selectionFixtureSupplyId =
  'provider-supply-capability_fixture-381' as const satisfies ProviderSupplyCapabilityId;
const selectionFixtureScope = Object.freeze({
  owner: 'LITE' as const,
  reference: 'need:fixture-381',
  version: 3,
  fingerprintSha256: '1'.repeat(64)
}) satisfies Readonly<ProviderSelectionScopeReferenceV1>;

const selectionFixtureSourceLineage = Object.freeze({
  discoveryRequest: {
    providerDiscoveryRequestId: 'provider-discovery-request_fixture-381',
    requesterWorkspaceId: selectionFixtureWorkspaceId,
    requestFingerprintSha256: '2'.repeat(64),
    needReference: 'need:fixture-381',
    needVersion: 3,
    needFingerprintSha256: '1'.repeat(64),
    purpose: 'PROVIDER_DISCOVERY',
    contextReference: 'context:fixture-381-network-discovery'
  },
  discoveryResult: {
    resultFingerprintSha256: '3'.repeat(64),
    evaluatedAt: '2026-09-01T04:45:00.000Z'
  },
  discoveryCandidate: {
    providerDiscoveryCandidateId: 'provider-discovery-candidate_fixture-381',
    candidateFingerprintSha256: '7'.repeat(64),
    generatedAt: '2026-09-01T04:45:00.000Z',
    evaluationPolicyVersion: 'mgsn-provider-discovery-v1'
  },
  provider: {
    providerId: selectionFixtureProviderId,
    providerWorkspaceId: '018f0000-0000-7000-8000-000000003810'
  },
  providerSupplyCapability: {
    id: selectionFixtureSupplyId,
    version: 7,
    fingerprintSha256: '4'.repeat(64)
  },
  visibilityAuthorizationAtReview: {
    networkParticipationId: 'network-participation_fixture-381',
    participationVersion: 4,
    visibilityPolicyVersion: 6,
    evaluatedAt: '2026-09-01T04:45:00.000Z',
    currentAuthorityRevalidationRequiredBeforeServe: true
  },
  historicalSourceVersions: [
    {
      owner: 'MGSN',
      sourceType: 'PROVIDER',
      sourceId: selectionFixtureProviderId,
      version: 2,
      fingerprintSha256: '6'.repeat(64),
      checkedAt: '2026-09-01T04:45:00.000Z',
      authorityState: 'CURRENT'
    },
    {
      owner: 'MGSN',
      sourceType: 'PROVIDER_SUPPLY_CAPABILITY',
      sourceId: selectionFixtureSupplyId,
      version: 7,
      fingerprintSha256: '4'.repeat(64),
      checkedAt: '2026-09-01T04:45:00.000Z',
      authorityState: 'CURRENT'
    }
  ],
  directExecutorDisclosureAtReview: {
    state: 'UNPROVEN',
    evidenceReferences: []
  },
  currentAuthorityRevalidationRequiredBeforeSelectionCommit: true,
  currentAuthorityRevalidationRequiredBeforeDownstreamUse: true
}) satisfies Readonly<ProviderSelectionSourceLineageV1>;

const selectionFixtureAuthority = Object.freeze({
  source: 'CORE_WORKSPACE_PRINCIPAL',
  requesterWorkspaceId: selectionFixtureWorkspaceId,
  selectingActorId: 'user_fixture-394',
  principalReference: 'principal:fixture-394',
  workspaceMembershipReference: 'workspace-membership:fixture-394',
  selectionAuthorityReference: 'selection-authority:fixture-394',
  selectionAuthorityVersion: 2,
  authenticatedAt: selectionFixtureAt,
  affirmativeHumanActionEvidenceReference: 'human-action:fixture-394',
  payloadIdentityAuthoritative: false
}) satisfies Readonly<ProviderSelectionTrustedHumanAuthorityV1>;

const selectionFixtureAcknowledgement = Object.freeze({
  affirmativeHumanAction: true,
  acknowledgementCode: 'HUMAN_PROVIDER_SELECTION_V1',
  acknowledgementTextVersion: 'v1',
  reviewedCandidateId: 'provider-discovery-candidate_fixture-381',
  reviewedCandidateFingerprintSha256: '7'.repeat(64),
  reviewedScopeFingerprintSha256: '1'.repeat(64),
  reviewedAt: selectionFixtureAt,
  reasonCode: 'EVIDENCE_AND_LIMITATIONS_REVIEWED',
  rationale: 'Reviewed the bounded candidate evidence and limitations for this Need.',
  containsCustomerDocuments: false,
  containsRawEvidenceArtifacts: false,
  containsEndClientRelationshipInformation: false,
  containsApplicantOwnerOfficialData: false,
  containsCommercialMarginOrProfit: false
}) satisfies Readonly<ProviderSelectionHumanAcknowledgementV1>;

const currentSelectionFixture = Object.freeze({
  schemaVersion: 1,
  providerSelectionId: 'provider-selection_fixture-394',
  requesterWorkspaceId: selectionFixtureWorkspaceId,
  scope: selectionFixtureScope,
  scopeVersion: 1,
  sourceLineage: selectionFixtureSourceLineage,
  trustedHumanAuthority: selectionFixtureAuthority,
  acknowledgement: selectionFixtureAcknowledgement,
  selectedAt: selectionFixtureAt,
  version: 1,
  correlationId: 'correlation_fixture-394',
  authorityConsequences: noDownstreamProviderSelectionAuthorityConsequences,
  status: 'CURRENT',
  supersededBy: null,
  revokedAt: null
}) satisfies Readonly<ProviderSelectionV1>;

/** Shared acceptance fixtures for explicit human choice, replay and current-usability separation. */
export const providerSelectionContractFixtureV1 = Object.freeze({
  createCommand: {
    schemaVersion: 1,
    requesterWorkspaceId: selectionFixtureWorkspaceId,
    scope: selectionFixtureScope,
    sourceLineage: selectionFixtureSourceLineage,
    trustedHumanAuthority: selectionFixtureAuthority,
    acknowledgement: selectionFixtureAcknowledgement,
    expectedCurrent: {
      kind: 'ABSENT',
      expectedScopeVersion: 0
    },
    idempotencyKey: 'provider-selection:create:fixture-394',
    commandFingerprintSha256: 'a'.repeat(64),
    correlationId: 'correlation_fixture-394'
  },
  currentSelection: currentSelectionFixture,
  replayResult: {
    schemaVersion: 1,
    mutation: 'CREATED',
    selection: currentSelectionFixture,
    replayed: true,
    replayDoesNotEstablishCurrentUsability: true,
    correlationId: 'correlation_fixture-394'
  },
  currentButNotUsable: {
    schemaVersion: 1,
    selection: {
      providerSelectionId: 'provider-selection_fixture-394',
      version: 1,
      scopeVersion: 1
    },
    requesterWorkspaceId: selectionFixtureWorkspaceId,
    scope: selectionFixtureScope,
    purpose: 'CONTROLLED_HANDOFF_REVIEW',
    evaluatedAt: '2026-09-01T05:20:00.000Z',
    validationPolicyVersion: 'mgsn-provider-selection-validation-v1',
    checkedAuthorityReferences: ['network-participation_fixture-381'],
    authorityConsequences: noDownstreamProviderSelectionAuthorityConsequences,
    validationDoesNotAuthorizeDownstreamAction: true,
    decision: 'DENY',
    currentlyUsable: false,
    denialReason: 'VISIBILITY_NO_LONGER_AUTHORIZED',
    publicReason: 'The current Provider visibility authority no longer permits this bounded use.'
  },
  validForBoundedReview: {
    schemaVersion: 1,
    selection: {
      providerSelectionId: 'provider-selection_fixture-394',
      version: 1,
      scopeVersion: 1
    },
    requesterWorkspaceId: selectionFixtureWorkspaceId,
    scope: selectionFixtureScope,
    purpose: 'CONTROLLED_HANDOFF_REVIEW',
    evaluatedAt: '2026-09-01T05:18:00.000Z',
    validationPolicyVersion: 'mgsn-provider-selection-validation-v1',
    checkedAuthorityReferences: [
      'network-participation_fixture-381',
      'provider_fixture-381',
      'provider-supply-capability_fixture-381'
    ],
    authorityConsequences: noDownstreamProviderSelectionAuthorityConsequences,
    validationDoesNotAuthorizeDownstreamAction: true,
    decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
    currentlyUsable: true,
    publicReason: 'Current authority permits this Selection to be considered by the bounded review.'
  },
  revokeCommand: {
    schemaVersion: 1,
    requesterWorkspaceId: selectionFixtureWorkspaceId,
    scope: selectionFixtureScope,
    target: {
      providerSelectionId: 'provider-selection_fixture-394',
      version: 1,
      scopeVersion: 1
    },
    trustedHumanAuthority: selectionFixtureAuthority,
    reasonCode: 'HUMAN_WITHDRAWAL',
    idempotencyKey: 'provider-selection:revoke:fixture-394',
    commandFingerprintSha256: 'b'.repeat(64),
    correlationId: 'correlation_fixture-394'
  }
} as const satisfies Readonly<{
  createCommand: CreateOrReplaceProviderSelectionCommandV1;
  currentSelection: ProviderSelectionV1;
  replayResult: ProviderSelectionMutationResultV1;
  currentButNotUsable: ProviderSelectionCurrentValidationV1;
  validForBoundedReview: ProviderSelectionCurrentValidationV1;
  revokeCommand: RevokeProviderSelectionCommandV1;
}>);
