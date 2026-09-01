import type {
  ControlledHandoffValidationDenialReason,
  ControlledHandoffVersionReferenceV1
} from './controlled-privacy-handoff.js';
import type {
  AllocationId,
  AllocationStatus,
  ExactVersionReference,
  ProviderAcceptanceDecision,
  ProviderAcceptanceId,
  ProviderId,
  ProviderReturnId,
  ProviderReturnStatus,
  ServicePackageId
} from './provider-execution.js';

/**
 * Provider Work Read Model V1 is a Provider-owned, read-only projection over existing M4 truth.
 * It does not create a second work lifecycle and it never turns queue visibility into action authority.
 */
export const providerWorkSourceKinds = [
  'ALLOCATION',
  'SERVICE_PACKAGE',
  'PROVIDER_ACCEPTANCE',
  'PROVIDER_RETURN',
  'INCOMING_DATA_AUTHORITY'
] as const;
export type ProviderWorkSourceKind = (typeof providerWorkSourceKinds)[number];

export const providerWorkSourceStates = ['CURRENT', 'KNOWN_ABSENT', 'UNAVAILABLE'] as const;
export type ProviderWorkSourceState = (typeof providerWorkSourceStates)[number];

export interface ProviderWorkSourceCheckV1 {
  sourceKind: ProviderWorkSourceKind;
  owner: 'MGSN';
  state: ProviderWorkSourceState;
  sourceReference?: string;
  sourceVersion?: number | string;
  sourceFingerprintSha256?: string;
  checkedAt: string;
  queryScopeFingerprintSha256: string;
}

/**
 * The summary keeps only the exact Allocation identity/status needed to address the work item.
 * Internal Allocation rationale, allocator identity and Supply Capability contents are excluded.
 */
export interface ProviderWorkAllocationReferenceV1 {
  allocationId: AllocationId;
  version: number;
  status: AllocationStatus;
  updatedAt: string;
}

/** Service Package is referenced by exact version/fingerprint; its source snapshot is not copied. */
export interface ProviderWorkServicePackageReferenceV1 {
  servicePackage: Readonly<ExactVersionReference<ServicePackageId>>;
  servicePackageFingerprintSha256: string;
}

/**
 * Provider-facing origin is deliberately organization/professional reference only. It does not expose
 * the Originating Workplace's end-client relationship, pricing, margin, CRM or unrelated matters.
 */
export interface ProviderWorkOriginReferenceV1 {
  originatingWorkspaceId: string;
  professionalReference: string;
  exposureClass: 'ORIGINATING_PROFESSIONAL_REFERENCE_ONLY';
}

export type ProviderWorkResponseStateV1 =
  | Readonly<{
      kind: 'KNOWN_RESPONSE';
      response: Readonly<ExactVersionReference<ProviderAcceptanceId>>;
      decision: ProviderAcceptanceDecision;
      respondedAt: string;
      responseFingerprintSha256: string;
    }>
  | Readonly<{
      kind: 'KNOWN_ABSENT';
      checkedAt: string;
      absenceScopeFingerprintSha256: string;
      allocationActiveDoesNotImplyPendingResponse: true;
    }>
  | Readonly<{
      kind: 'SOURCE_UNAVAILABLE';
      checkedAt: string;
      reason: 'PERSISTENCE_UNAVAILABLE' | 'DEPENDENCY_UNAVAILABLE';
      responseMustNotBeInferred: true;
    }>;

export type ProviderWorkReturnStateV1 =
  | Readonly<{
      kind: 'KNOWN_RETURN';
      providerReturn: Readonly<ExactVersionReference<ProviderReturnId>>;
      status: ProviderReturnStatus;
      submittedAt: string;
      returnFingerprintSha256: string;
      providerReturnRemainsClaimEvidenceNotOfficialTruth: true;
    }>
  | Readonly<{
      kind: 'KNOWN_ABSENT';
      checkedAt: string;
      absenceScopeFingerprintSha256: string;
    }>
  | Readonly<{
      kind: 'SOURCE_UNAVAILABLE';
      checkedAt: string;
      reason: 'PERSISTENCE_UNAVAILABLE' | 'DEPENDENCY_UNAVAILABLE';
      returnMustNotBeInferred: true;
    }>;

/**
 * Incoming-data authority is a reference to current Controlled Handoff truth, never copied customer data.
 * Missing/revoked/expired authority removes incoming-field visibility without rewriting M4 history.
 */
export type ProviderWorkIncomingDataAuthorityV1 =
  | Readonly<{
      state: 'CURRENTLY_USABLE';
      handoff: Readonly<ControlledHandoffVersionReferenceV1>;
      validationReference: string;
      validationFingerprintSha256: string;
      validationPolicyVersion: string;
      checkedAt: string;
      currentExactProjectionMayBeResolvedSeparately: true;
      embeddedPrivateFieldValues: false;
    }>
  | Readonly<{
      state: 'DENIED';
      handoff?: Readonly<ControlledHandoffVersionReferenceV1>;
      denialReason: ControlledHandoffValidationDenialReason;
      checkedAt: string;
      incomingFieldsVisible: false;
      embeddedPrivateFieldValues: false;
    }>
  | Readonly<{
      state: 'KNOWN_ABSENT';
      checkedAt: string;
      authorityScopeFingerprintSha256: string;
      incomingFieldsVisible: false;
      embeddedPrivateFieldValues: false;
    }>
  | Readonly<{
      state: 'UNKNOWN';
      checkedAt: string;
      reason: 'AUTHORITY_STATE_NOT_ESTABLISHED';
      incomingFieldsVisible: false;
      embeddedPrivateFieldValues: false;
    }>
  | Readonly<{
      state: 'SOURCE_UNAVAILABLE';
      checkedAt: string;
      reason: 'PERSISTENCE_UNAVAILABLE' | 'DEPENDENCY_UNAVAILABLE';
      incomingFieldsVisible: false;
      embeddedPrivateFieldValues: false;
    }>;

export interface ProviderWorkPrivacyExclusionsV1 {
  allocationRationaleIncluded: false;
  allocatorIdentityIncluded: false;
  supplyCapabilityContentsIncluded: false;
  servicePackageSourceSnapshotIncluded: false;
  providerAcceptanceAcknowledgementIncluded: false;
  providerReturnArtifactsIncluded: false;
  providerReturnAssertionsIncluded: false;
  endClientRelationshipInformationIncluded: false;
  endClientContactIncluded: false;
  originatingPricingMarginProfitIncluded: false;
  privateCrmContextIncluded: false;
  unrelatedCommunicationsIncluded: false;
  unrelatedAssetsOrMattersIncluded: false;
  rawPrivateEvidenceIncluded: false;
}

export const providerWorkPrivacyExclusionsV1 = Object.freeze({
  allocationRationaleIncluded: false,
  allocatorIdentityIncluded: false,
  supplyCapabilityContentsIncluded: false,
  servicePackageSourceSnapshotIncluded: false,
  providerAcceptanceAcknowledgementIncluded: false,
  providerReturnArtifactsIncluded: false,
  providerReturnAssertionsIncluded: false,
  endClientRelationshipInformationIncluded: false,
  endClientContactIncluded: false,
  originatingPricingMarginProfitIncluded: false,
  privateCrmContextIncluded: false,
  unrelatedCommunicationsIncluded: false,
  unrelatedAssetsOrMattersIncluded: false,
  rawPrivateEvidenceIncluded: false
}) satisfies Readonly<ProviderWorkPrivacyExclusionsV1>;

/** These are consequences created by the read model itself, not reflections of already-owned M4 facts. */
export interface ProviderWorkReadModelAuthorityConsequencesV1 {
  createsProviderSelection: false;
  createsProviderAllocation: false;
  createsProviderAcceptance: false;
  createsProviderEngagement: false;
  createsProfessionalAppointment: false;
  authorizesExternalContact: false;
  authorizesProtectedActionRelease: false;
  authorizesFiling: false;
  submitsFiling: false;
  authorizesPayment: false;
  createsPayment: false;
  createsOfficialTruth: false;
  completesMatter: false;
}

export const noProviderWorkReadModelAuthorityConsequences = Object.freeze({
  createsProviderSelection: false,
  createsProviderAllocation: false,
  createsProviderAcceptance: false,
  createsProviderEngagement: false,
  createsProfessionalAppointment: false,
  authorizesExternalContact: false,
  authorizesProtectedActionRelease: false,
  authorizesFiling: false,
  submitsFiling: false,
  authorizesPayment: false,
  createsPayment: false,
  createsOfficialTruth: false,
  completesMatter: false
}) satisfies Readonly<ProviderWorkReadModelAuthorityConsequencesV1>;

export interface ProviderWorkItemSummaryV1 {
  schemaVersion: 1;
  provider: Readonly<{
    providerId: ProviderId;
    providerWorkspaceId: string;
  }>;
  allocation: Readonly<ProviderWorkAllocationReferenceV1>;
  servicePackage: Readonly<ProviderWorkServicePackageReferenceV1>;
  origin: Readonly<ProviderWorkOriginReferenceV1>;
  responseState: ProviderWorkResponseStateV1;
  returnState: ProviderWorkReturnStateV1;
  incomingDataAuthority: ProviderWorkIncomingDataAuthorityV1;
  sourceChecks: ReadonlyArray<Readonly<ProviderWorkSourceCheckV1>>;
  sourceSetFingerprintSha256: string;
  projectionFingerprintSha256: string;
  projectedAt: string;
  privacyExclusions: Readonly<ProviderWorkPrivacyExclusionsV1>;
  authorityConsequences: Readonly<ProviderWorkReadModelAuthorityConsequencesV1>;
  allocationIsExistingM4TruthNotCreatedByProjection: true;
  queuePresenceIsNotActionAuthority: true;
}

/**
 * Workspace authority is resolved outside the payload. Wrong Provider Workspace and not-found collapse to
 * the same public result so this contract cannot become a cross-Provider enumeration primitive.
 */
export type ProviderWorkItemReadResultV1 =
  | Readonly<{
      schemaVersion: 1;
      decision: 'AUTHORIZED';
      providerWorkspaceId: string;
      principalReference: string;
      workspaceAuthorityReference: string;
      checkedAt: string;
      item: Readonly<ProviderWorkItemSummaryV1>;
      existenceDisclosed: true;
      readAuthorityDoesNotAuthorizeMutation: true;
    }>
  | Readonly<{
      schemaVersion: 1;
      decision: 'NOT_FOUND_OR_NOT_AUTHORIZED';
      checkedAt: string;
      item: null;
      existenceDisclosed: false;
      publicReason: 'Provider work item was not found or is not available to this Workspace.';
      readAuthorityDoesNotAuthorizeMutation: true;
    }>
  | Readonly<{
      schemaVersion: 1;
      decision: 'SOURCE_UNAVAILABLE';
      checkedAt: string;
      item: null;
      existenceDisclosed: false;
      retryable: true;
      publicReason: 'Provider work source is temporarily unavailable.';
      readAuthorityDoesNotAuthorizeMutation: true;
    }>;

const providerWorkFixtureProviderId = 'provider_fixture-419' as const satisfies ProviderId;
const providerWorkFixtureProviderWorkspaceId = '018f0000-0000-7000-8000-000000004190';
const providerWorkFixtureOriginatingWorkspaceId = '018f0000-0000-7000-8000-000000004191';
const providerWorkFixtureAllocationId = 'allocation_fixture-419' as const satisfies AllocationId;
const providerWorkFixtureServicePackageId =
  'service-package_fixture-419' as const satisfies ServicePackageId;
const providerWorkFixtureAcceptanceId =
  'provider-acceptance_fixture-419' as const satisfies ProviderAcceptanceId;
const providerWorkFixtureReturnId =
  'provider-return_fixture-419' as const satisfies ProviderReturnId;
const providerWorkFixtureAt = '2026-09-01T10:00:00.000Z';

const providerWorkFixtureAllocation = Object.freeze<ProviderWorkAllocationReferenceV1>({
  allocationId: providerWorkFixtureAllocationId,
  version: 3,
  status: 'ACTIVE',
  updatedAt: '2026-09-01T09:50:00.000Z'
});

const providerWorkFixtureServicePackage = Object.freeze<ProviderWorkServicePackageReferenceV1>({
  servicePackage: {
    id: providerWorkFixtureServicePackageId,
    version: 4
  },
  servicePackageFingerprintSha256: '4'.repeat(64)
});

const providerWorkFixtureOrigin = Object.freeze<ProviderWorkOriginReferenceV1>({
  originatingWorkspaceId: providerWorkFixtureOriginatingWorkspaceId,
  professionalReference: 'professional-organization:fixture-419',
  exposureClass: 'ORIGINATING_PROFESSIONAL_REFERENCE_ONLY'
});

const providerWorkFixtureSourceChecks = Object.freeze<ReadonlyArray<ProviderWorkSourceCheckV1>>([
  {
    sourceKind: 'ALLOCATION',
    owner: 'MGSN',
    state: 'CURRENT',
    sourceReference: providerWorkFixtureAllocationId,
    sourceVersion: 3,
    sourceFingerprintSha256: '1'.repeat(64),
    checkedAt: providerWorkFixtureAt,
    queryScopeFingerprintSha256: 'a'.repeat(64)
  },
  {
    sourceKind: 'SERVICE_PACKAGE',
    owner: 'MGSN',
    state: 'CURRENT',
    sourceReference: providerWorkFixtureServicePackageId,
    sourceVersion: 4,
    sourceFingerprintSha256: '4'.repeat(64),
    checkedAt: providerWorkFixtureAt,
    queryScopeFingerprintSha256: 'b'.repeat(64)
  },
  {
    sourceKind: 'PROVIDER_ACCEPTANCE',
    owner: 'MGSN',
    state: 'KNOWN_ABSENT',
    checkedAt: providerWorkFixtureAt,
    queryScopeFingerprintSha256: 'c'.repeat(64)
  },
  {
    sourceKind: 'PROVIDER_RETURN',
    owner: 'MGSN',
    state: 'KNOWN_ABSENT',
    checkedAt: providerWorkFixtureAt,
    queryScopeFingerprintSha256: 'd'.repeat(64)
  },
  {
    sourceKind: 'INCOMING_DATA_AUTHORITY',
    owner: 'MGSN',
    state: 'KNOWN_ABSENT',
    checkedAt: providerWorkFixtureAt,
    queryScopeFingerprintSha256: 'e'.repeat(64)
  }
]);

const providerWorkFixtureKnownAbsentItem = Object.freeze<ProviderWorkItemSummaryV1>({
  schemaVersion: 1,
  provider: {
    providerId: providerWorkFixtureProviderId,
    providerWorkspaceId: providerWorkFixtureProviderWorkspaceId
  },
  allocation: providerWorkFixtureAllocation,
  servicePackage: providerWorkFixtureServicePackage,
  origin: providerWorkFixtureOrigin,
  responseState: {
    kind: 'KNOWN_ABSENT',
    checkedAt: providerWorkFixtureAt,
    absenceScopeFingerprintSha256: 'c'.repeat(64),
    allocationActiveDoesNotImplyPendingResponse: true
  },
  returnState: {
    kind: 'KNOWN_ABSENT',
    checkedAt: providerWorkFixtureAt,
    absenceScopeFingerprintSha256: 'd'.repeat(64)
  },
  incomingDataAuthority: {
    state: 'KNOWN_ABSENT',
    checkedAt: providerWorkFixtureAt,
    authorityScopeFingerprintSha256: 'e'.repeat(64),
    incomingFieldsVisible: false,
    embeddedPrivateFieldValues: false
  },
  sourceChecks: providerWorkFixtureSourceChecks,
  sourceSetFingerprintSha256: '5'.repeat(64),
  projectionFingerprintSha256: '6'.repeat(64),
  projectedAt: providerWorkFixtureAt,
  privacyExclusions: providerWorkPrivacyExclusionsV1,
  authorityConsequences: noProviderWorkReadModelAuthorityConsequences,
  allocationIsExistingM4TruthNotCreatedByProjection: true,
  queuePresenceIsNotActionAuthority: true
});

const providerWorkFixtureKnownResponseItem = Object.freeze<ProviderWorkItemSummaryV1>({
  ...providerWorkFixtureKnownAbsentItem,
  responseState: {
    kind: 'KNOWN_RESPONSE',
    response: {
      id: providerWorkFixtureAcceptanceId,
      version: 2
    },
    decision: 'ACCEPTED',
    respondedAt: '2026-09-01T10:05:00.000Z',
    responseFingerprintSha256: '7'.repeat(64)
  },
  returnState: {
    kind: 'KNOWN_RETURN',
    providerReturn: {
      id: providerWorkFixtureReturnId,
      version: 1
    },
    status: 'CURRENT',
    submittedAt: '2026-09-01T10:20:00.000Z',
    returnFingerprintSha256: '8'.repeat(64),
    providerReturnRemainsClaimEvidenceNotOfficialTruth: true
  },
  incomingDataAuthority: {
    state: 'CURRENTLY_USABLE',
    handoff: {
      controlledHandoffId: 'controlled-handoff_fixture-405',
      version: 1
    },
    validationReference: 'controlled-handoff-validation:fixture-419',
    validationFingerprintSha256: '9'.repeat(64),
    validationPolicyVersion: 'mgsn-controlled-handoff-validation-v1',
    checkedAt: '2026-09-01T10:19:00.000Z',
    currentExactProjectionMayBeResolvedSeparately: true,
    embeddedPrivateFieldValues: false
  },
  projectionFingerprintSha256: 'f'.repeat(64),
  projectedAt: '2026-09-01T10:21:00.000Z'
});

export const providerWorkReadModelContractFixtureV1 = Object.freeze({
  activeAllocationKnownNoResponse: providerWorkFixtureKnownAbsentItem,
  acceptedWithReturnAndCurrentHandoff: providerWorkFixtureKnownResponseItem,
  expiredIncomingAuthority: {
    ...providerWorkFixtureKnownResponseItem,
    incomingDataAuthority: {
      state: 'DENIED',
      handoff: {
        controlledHandoffId: 'controlled-handoff_fixture-405',
        version: 1
      },
      denialReason: 'HANDOFF_EXPIRED',
      checkedAt: '2026-09-03T10:00:00.000Z',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    },
    projectionFingerprintSha256: '0'.repeat(64),
    projectedAt: '2026-09-03T10:00:00.000Z'
  },
  revokedIncomingAuthority: {
    ...providerWorkFixtureKnownResponseItem,
    incomingDataAuthority: {
      state: 'DENIED',
      handoff: {
        controlledHandoffId: 'controlled-handoff_fixture-405',
        version: 1
      },
      denialReason: 'HANDOFF_REVOKED',
      checkedAt: '2026-09-01T10:30:00.000Z',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    },
    projectionFingerprintSha256: 'b'.repeat(64),
    projectedAt: '2026-09-01T10:30:00.000Z'
  },
  unknownIncomingAuthority: {
    ...providerWorkFixtureKnownAbsentItem,
    incomingDataAuthority: {
      state: 'UNKNOWN',
      checkedAt: providerWorkFixtureAt,
      reason: 'AUTHORITY_STATE_NOT_ESTABLISHED',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    },
    projectionFingerprintSha256: 'c'.repeat(64)
  },
  responseSourceUnavailable: {
    ...providerWorkFixtureKnownAbsentItem,
    responseState: {
      kind: 'SOURCE_UNAVAILABLE',
      checkedAt: providerWorkFixtureAt,
      reason: 'PERSISTENCE_UNAVAILABLE',
      responseMustNotBeInferred: true
    },
    projectionFingerprintSha256: 'd'.repeat(64)
  },
  authorizedOwnWorkspaceRead: {
    schemaVersion: 1,
    decision: 'AUTHORIZED',
    providerWorkspaceId: providerWorkFixtureProviderWorkspaceId,
    principalReference: 'principal:provider-workspace-fixture-419',
    workspaceAuthorityReference: 'workspace-membership:provider-workspace-fixture-419',
    checkedAt: providerWorkFixtureAt,
    item: providerWorkFixtureKnownAbsentItem,
    existenceDisclosed: true,
    readAuthorityDoesNotAuthorizeMutation: true
  },
  wrongWorkspaceRead: {
    schemaVersion: 1,
    decision: 'NOT_FOUND_OR_NOT_AUTHORIZED',
    checkedAt: providerWorkFixtureAt,
    item: null,
    existenceDisclosed: false,
    publicReason: 'Provider work item was not found or is not available to this Workspace.',
    readAuthorityDoesNotAuthorizeMutation: true
  },
  unavailableRead: {
    schemaVersion: 1,
    decision: 'SOURCE_UNAVAILABLE',
    checkedAt: providerWorkFixtureAt,
    item: null,
    existenceDisclosed: false,
    retryable: true,
    publicReason: 'Provider work source is temporarily unavailable.',
    readAuthorityDoesNotAuthorizeMutation: true
  }
} as const satisfies Readonly<{
  activeAllocationKnownNoResponse: ProviderWorkItemSummaryV1;
  acceptedWithReturnAndCurrentHandoff: ProviderWorkItemSummaryV1;
  expiredIncomingAuthority: ProviderWorkItemSummaryV1;
  revokedIncomingAuthority: ProviderWorkItemSummaryV1;
  unknownIncomingAuthority: ProviderWorkItemSummaryV1;
  responseSourceUnavailable: ProviderWorkItemSummaryV1;
  authorizedOwnWorkspaceRead: ProviderWorkItemReadResultV1;
  wrongWorkspaceRead: ProviderWorkItemReadResultV1;
  unavailableRead: ProviderWorkItemReadResultV1;
}>);
