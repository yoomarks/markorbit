import type { MarkOrbitId } from './index.js';
import type {
  DirectExecutorDiscoveryDisclosureState,
  DiscoveryCurrentSourceVersionV1
} from './provider-discovery.js';
import type { ProviderId } from './provider-execution.js';
import type {
  ProviderSelectionId,
  ProviderSelectionScopeReferenceV1,
  ProviderSelectionVersionReferenceV1
} from './provider-selection.js';

/**
 * Controlled Privacy Handoff V1 records a human-authorized, purpose-bound and data-minimized
 * disclosure envelope after a current Provider Selection. It is not Provider contact, engagement,
 * Allocation, Acceptance, appointment, protected-action release, Filing, Payment or Official Truth.
 */
export type ControlledHandoffId = `controlled-handoff_${string}`;

export const controlledHandoffStatuses = ['AUTHORIZED', 'REVOKED'] as const;
export type ControlledHandoffStatus = (typeof controlledHandoffStatuses)[number];

export const controlledHandoffPurposeCodes = [
  'PROFESSIONAL_SERVICE_PREPARATION',
  'PROFESSIONAL_EVIDENCE_REVIEW',
  'JURISDICTIONAL_INSTRUCTION_REVIEW',
  'OTHER_CANONICAL_BOUNDED_PURPOSE'
] as const;
export type ControlledHandoffPurposeCode = (typeof controlledHandoffPurposeCodes)[number];

export interface ControlledHandoffPurposeV1 {
  code: ControlledHandoffPurposeCode;
  contextReference: string;
  instructionReference: string;
  purposeFingerprintSha256: string;
  unrestrictedPurposeAllowed: false;
}

export const controlledHandoffAuthorizedDataClasses = [
  'ORIGINATING_WORKSPACE_REFERENCE',
  'PROVIDER_REFERENCE',
  'NEED_WORK_PACKAGE_REFERENCE',
  'APPLICANT_OWNER_OFFICIAL_DATA',
  'TRADEMARK_MATTER_MINIMUM_WORKING_DATA',
  'PROVIDER_EVIDENCE_REFERENCES',
  'PROFESSIONAL_INSTRUCTION_FIELDS'
] as const;
export type ControlledHandoffAuthorizedDataClass =
  (typeof controlledHandoffAuthorizedDataClasses)[number];

export const controlledHandoffForbiddenGenericDataClasses = [
  'END_CLIENT_RELATIONSHIP_INFORMATION',
  'ORIGINATING_WORKSPACE_PRICING_MARGIN_PROFIT',
  'PRIVATE_CRM_CONTEXT',
  'UNRELATED_COMMUNICATIONS',
  'UNRELATED_ASSETS_OR_MATTERS'
] as const;
export type ControlledHandoffForbiddenGenericDataClass =
  (typeof controlledHandoffForbiddenGenericDataClasses)[number];

export type ControlledHandoffSourceOwner =
  'CORE' | 'LITE' | 'MARKREG' | 'MGSN' | 'EXECUTION' | 'KNOWLEDGE' | 'OTHER_CANONICAL_OWNER';

/**
 * Each item is an exact authorization descriptor. It contains no field value and cannot expand by
 * wildcard, object prefix, related record or owner-side default.
 */
export interface ControlledHandoffAuthorizedProjectionItemV1 {
  dataClass: ControlledHandoffAuthorizedDataClass;
  fieldPath: string;
  sourceOwner: ControlledHandoffSourceOwner;
  sourceReference: string;
  sourceVersion: number | string;
  sourceFingerprintSha256: string;
  necessityReference: string;
  requested: true;
  authorizedBySourceOwner: true;
  minimumNecessary: true;
  fieldValueEmbeddedInEnvelope: false;
  evidenceArtifactRetrievalAuthority: 'NOT_APPLICABLE' | 'SEPARATE_AUTHORITY_REQUIRED';
}

export interface AuthorizedDataProjectionV1 {
  schemaVersion: 1;
  items: ReadonlyArray<ControlledHandoffAuthorizedProjectionItemV1>;
  projectionFingerprintSha256: string;
  sourceSetFingerprintSha256: string;
  wildcardAllowed: false;
  wholeRecordAllowed: false;
  implicitFieldExpansionAllowed: false;
  fieldValuesEmbeddedInEnvelope: false;
  requestedAuthorizedMinimumNecessaryIntersectionRequired: true;
  forbiddenGenericDataClasses: readonly ControlledHandoffForbiddenGenericDataClass[];
}

export interface ControlledHandoffSelectionLineageV1 {
  selection: Readonly<ProviderSelectionVersionReferenceV1>;
  selectionScope: Readonly<ProviderSelectionScopeReferenceV1>;
  selectionFingerprintSha256: string;
  selectedProvider: Readonly<{
    providerId: ProviderId;
    providerWorkspaceId: string;
  }>;
  currentSelectionValidation: Readonly<{
    purpose: 'CONTROLLED_HANDOFF_REVIEW';
    decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW';
    currentlyUsable: true;
    evaluatedAt: string;
    validationPolicyVersion: string;
    checkedAuthorityReferences: readonly string[];
  }>;
}

export interface ControlledHandoffDirectExecutorAuthorityV1 {
  disclosureState: Extract<
    DirectExecutorDiscoveryDisclosureState,
    'INDEPENDENT_EVIDENCE_REFERENCED'
  >;
  directExecutorEstablished: true;
  finalExecutionProviderId: ProviderId;
  finalExecutionProviderWorkspaceId: string;
  authorityReference: string;
  authorityVersion: number | string;
  evidenceReferences: readonly string[];
  checkedAt: string;
  hiddenIntermediaryAllowed: false;
  onwardRecipientAuthorization: 'NONE';
  legallyRequiredDistinctSigner?: Readonly<{
    signerReference: string;
    legalBasisReference: string;
    transparentlyDisclosed: true;
    receivesHandoffDataByDefault: false;
  }>;
}

export interface ControlledHandoffSourceLineageV1 {
  selectionLineage: Readonly<ControlledHandoffSelectionLineageV1>;
  currentSourceVersions: ReadonlyArray<DiscoveryCurrentSourceVersionV1>;
  directExecutorAuthority: Readonly<ControlledHandoffDirectExecutorAuthorityV1>;
  currentAuthorityRevalidationRequiredBeforeAuthorize: true;
  currentAuthorityRevalidationRequiredBeforeConsumption: true;
  evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval: true;
}

/** Trusted authority comes from the Core Workspace Principal boundary, never payload labels. */
export interface ControlledHandoffTrustedHumanAuthorityV1 {
  source: 'CORE_WORKSPACE_PRINCIPAL';
  originatingWorkspaceId: string;
  authorizingActorId: string;
  principalReference: string;
  workspaceMembershipReference: string;
  handoffAuthorityReference: string;
  handoffAuthorityVersion: number | string;
  authenticatedAt: string;
  affirmativeHumanActionEvidenceReference: string;
  payloadIdentityAuthoritative: false;
}

export interface ControlledHandoffPrivacyPreviewAcknowledgementV1 {
  affirmativeHumanAction: true;
  acknowledgementCode: 'CONTROLLED_PRIVACY_HANDOFF_V1';
  acknowledgementTextVersion: string;
  originatingWorkspaceId: string;
  recipientProviderId: ProviderId;
  recipientProviderWorkspaceId: string;
  selection: Readonly<ProviderSelectionVersionReferenceV1>;
  purposeFingerprintSha256: string;
  projectionFingerprintSha256: string;
  sourceSetFingerprintSha256: string;
  previewFingerprintSha256: string;
  reviewedAt: string;
}

export interface HandoffAuthorityConsequencesV1 {
  controlledPrivacyHandoffAuthorized: true;
  providerEngaged: false;
  providerAllocated: false;
  providerAccepted: false;
  professionalAppointmentCreated: false;
  externalContactAuthorized: false;
  protectedActionReleased: false;
  filingAuthorized: false;
  filingSubmitted: false;
  paymentAuthorized: false;
  paymentCreated: false;
  officialTruthCreated: false;
  matterCompleted: false;
}

export const noDownstreamHandoffAuthorityConsequences = Object.freeze({
  controlledPrivacyHandoffAuthorized: true,
  providerEngaged: false,
  providerAllocated: false,
  providerAccepted: false,
  professionalAppointmentCreated: false,
  externalContactAuthorized: false,
  protectedActionReleased: false,
  filingAuthorized: false,
  filingSubmitted: false,
  paymentAuthorized: false,
  paymentCreated: false,
  officialTruthCreated: false,
  matterCompleted: false
}) satisfies Readonly<HandoffAuthorityConsequencesV1>;

export interface ControlledHandoffVersionReferenceV1 {
  controlledHandoffId: ControlledHandoffId;
  version: number;
}

interface ControlledHandoffEnvelopeBaseV1 {
  schemaVersion: 1;
  controlledHandoffId: ControlledHandoffId;
  originatingWorkspaceId: string;
  recipient: Readonly<{
    providerId: ProviderId;
    providerWorkspaceId: string;
    role: 'FINAL_EXECUTION_PROVIDER';
  }>;
  purpose: Readonly<ControlledHandoffPurposeV1>;
  authorizedProjection: Readonly<AuthorizedDataProjectionV1>;
  sourceLineage: Readonly<ControlledHandoffSourceLineageV1>;
  trustedHumanAuthority: Readonly<ControlledHandoffTrustedHumanAuthorityV1>;
  privacyPreviewAcknowledgement: Readonly<ControlledHandoffPrivacyPreviewAcknowledgementV1>;
  authorizedAt: string;
  validFrom: string;
  validUntil: string;
  version: number;
  envelopeFingerprintSha256: string;
  correlationId: MarkOrbitId;
  authorityConsequences: Readonly<HandoffAuthorityConsequencesV1>;
}

export type ControlledHandoffEnvelopeV1 = Readonly<
  ControlledHandoffEnvelopeBaseV1 &
    (
      | {
          status: 'AUTHORIZED';
          revokedAt: null;
        }
      | {
          status: 'REVOKED';
          revokedAt: string;
          revocationReasonCode:
            'HUMAN_WITHDRAWAL' | 'PURPOSE_CANCELLED' | 'SCOPE_CANCELLED' | 'OTHER_BOUNDED_REASON';
        }
    )
>;

export type ControlledHandoffExpectedCurrentV1 =
  | Readonly<{
      kind: 'ABSENT';
    }>
  | Readonly<{
      kind: 'EXACT';
      controlledHandoffId: ControlledHandoffId;
      version: number;
    }>;

export interface AuthorizeOrReplaceControlledHandoffCommandV1 {
  schemaVersion: 1;
  originatingWorkspaceId: string;
  recipient: ControlledHandoffEnvelopeBaseV1['recipient'];
  purpose: Readonly<ControlledHandoffPurposeV1>;
  authorizedProjection: Readonly<AuthorizedDataProjectionV1>;
  sourceLineage: Readonly<ControlledHandoffSourceLineageV1>;
  trustedHumanAuthority: Readonly<ControlledHandoffTrustedHumanAuthorityV1>;
  privacyPreviewAcknowledgement: Readonly<ControlledHandoffPrivacyPreviewAcknowledgementV1>;
  validFrom: string;
  validUntil: string;
  expectedCurrent: ControlledHandoffExpectedCurrentV1;
  idempotencyKey: string;
  commandFingerprintSha256: string;
  correlationId: MarkOrbitId;
}

/** Revocation withdraws future disclosure authority without rewriting lawful historical transfer. */
export interface RevokeControlledHandoffCommandV1 {
  schemaVersion: 1;
  originatingWorkspaceId: string;
  target: Readonly<ControlledHandoffVersionReferenceV1>;
  trustedHumanAuthority: Readonly<ControlledHandoffTrustedHumanAuthorityV1>;
  reasonCode: 'HUMAN_WITHDRAWAL' | 'PURPOSE_CANCELLED' | 'SCOPE_CANCELLED' | 'OTHER_BOUNDED_REASON';
  rationale?: string;
  idempotencyKey: string;
  commandFingerprintSha256: string;
  correlationId: MarkOrbitId;
}

export const controlledHandoffMutationKinds = ['AUTHORIZED', 'REPLACED', 'REVOKED'] as const;
export type ControlledHandoffMutationKind = (typeof controlledHandoffMutationKinds)[number];

export interface ControlledHandoffMutationResultV1 {
  schemaVersion: 1;
  mutation: ControlledHandoffMutationKind;
  envelope: ControlledHandoffEnvelopeV1;
  previousEnvelope?: Readonly<ControlledHandoffVersionReferenceV1>;
  replayed: boolean;
  replayDoesNotEstablishCurrentUsability: true;
  correlationId: MarkOrbitId;
}

export const controlledHandoffValidationPurposes = [
  'HANDOFF_CONSUMPTION',
  'PRIVACY_PREVIEW_REFRESH',
  'EVIDENCE_REFERENCE_RETRIEVAL_REVIEW'
] as const;
export type ControlledHandoffValidationPurpose =
  (typeof controlledHandoffValidationPurposes)[number];

export const controlledHandoffValidationDenialReasons = [
  'HANDOFF_REVOKED',
  'HANDOFF_NOT_YET_VALID',
  'HANDOFF_EXPIRED',
  'SELECTION_NOT_CURRENT',
  'SELECTION_SCOPE_MISMATCH',
  'WRONG_ORIGINATING_WORKSPACE',
  'WRONG_RECIPIENT',
  'PURPOSE_MISMATCH',
  'PRIVACY_PREVIEW_MISMATCH',
  'PROJECTION_MISMATCH',
  'REQUESTED_FIELD_NOT_AUTHORIZED',
  'MINIMUM_NECESSARY_NOT_ESTABLISHED',
  'SOURCE_VERSION_MISMATCH',
  'SOURCE_ACCESS_NOT_CURRENT',
  'PARTICIPATION_NOT_ACTIVE',
  'VISIBILITY_NO_LONGER_AUTHORIZED',
  'DIRECT_EXECUTOR_NOT_ESTABLISHED',
  'HIDDEN_INTERMEDIARY_DETECTED',
  'EVIDENCE_ARTIFACT_ACCESS_NOT_AUTHORIZED',
  'AUTHORITY_UNAVAILABLE'
] as const;
export type ControlledHandoffValidationDenialReason =
  (typeof controlledHandoffValidationDenialReasons)[number];

export interface ControlledHandoffConsumptionAttemptV1 {
  originatingWorkspaceId: string;
  recipientProviderId: ProviderId;
  recipientProviderWorkspaceId: string;
  purposeFingerprintSha256: string;
  projectionFingerprintSha256: string;
  sourceSetFingerprintSha256: string;
  artifactRetrievalRequested: boolean;
  attemptedAt: string;
  correlationId: MarkOrbitId;
}

interface ControlledHandoffValidationBaseV1 {
  schemaVersion: 1;
  envelope: Readonly<ControlledHandoffVersionReferenceV1>;
  purpose: ControlledHandoffValidationPurpose;
  attempt: Readonly<ControlledHandoffConsumptionAttemptV1>;
  evaluatedAt: string;
  validationPolicyVersion: string;
  checkedAuthorityReferences: readonly string[];
  authorityConsequences: Readonly<HandoffAuthorityConsequencesV1>;
  validationIsNotBearerCapability: true;
  validationDoesNotAuthorizeDownstreamAction: true;
}

/** Recorded authorization and current consumption usability are intentionally separate. */
export type ControlledHandoffCurrentValidationV1 = Readonly<
  ControlledHandoffValidationBaseV1 &
    (
      | {
          decision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION';
          currentlyUsable: true;
          currentExactDisclosurePermitted: true;
          publicReason: string;
        }
      | {
          decision: 'DENY';
          currentlyUsable: false;
          currentExactDisclosurePermitted: false;
          denialReason: ControlledHandoffValidationDenialReason;
          publicReason: string;
        }
    )
>;

const handoffFixtureAt = '2026-09-01T09:30:00.000Z';
const handoffFixtureWorkspaceId = '018f0000-0000-7000-8000-000000000381';
const handoffFixtureProviderId = 'provider_fixture-381' as const satisfies ProviderId;
const handoffFixtureProviderWorkspaceId = '018f0000-0000-7000-8000-000000003810';
const handoffFixtureSelectionId =
  'provider-selection_fixture-394' as const satisfies ProviderSelectionId;
const handoffFixtureId = 'controlled-handoff_fixture-405' as const satisfies ControlledHandoffId;
const handoffFixtureSelectionReference = Object.freeze({
  providerSelectionId: handoffFixtureSelectionId,
  version: 1,
  scopeVersion: 1
}) satisfies Readonly<ProviderSelectionVersionReferenceV1>;
const handoffFixtureSelectionScope = Object.freeze({
  owner: 'LITE' as const,
  reference: 'need:fixture-381',
  version: 3,
  fingerprintSha256: '1'.repeat(64)
}) satisfies Readonly<ProviderSelectionScopeReferenceV1>;
const handoffFixturePurpose = Object.freeze({
  code: 'PROFESSIONAL_SERVICE_PREPARATION',
  contextReference: 'context:fixture-405-controlled-handoff',
  instructionReference: 'instruction:fixture-405',
  purposeFingerprintSha256: 'c'.repeat(64),
  unrestrictedPurposeAllowed: false
}) satisfies Readonly<ControlledHandoffPurposeV1>;
const handoffFixtureProjection = Object.freeze<AuthorizedDataProjectionV1>({
  schemaVersion: 1,
  items: [
    {
      dataClass: 'APPLICANT_OWNER_OFFICIAL_DATA',
      fieldPath: 'legalName',
      sourceOwner: 'MARKREG',
      sourceReference: 'applicant:fixture-405',
      sourceVersion: 4,
      sourceFingerprintSha256: 'd'.repeat(64),
      necessityReference: 'necessity:applicant-identity-for-professional-preparation',
      requested: true,
      authorizedBySourceOwner: true,
      minimumNecessary: true,
      fieldValueEmbeddedInEnvelope: false,
      evidenceArtifactRetrievalAuthority: 'NOT_APPLICABLE'
    },
    {
      dataClass: 'TRADEMARK_MATTER_MINIMUM_WORKING_DATA',
      fieldPath: 'trademark.markText',
      sourceOwner: 'MARKREG',
      sourceReference: 'trademark:fixture-405',
      sourceVersion: 5,
      sourceFingerprintSha256: 'e'.repeat(64),
      necessityReference: 'necessity:mark-identity-for-professional-preparation',
      requested: true,
      authorizedBySourceOwner: true,
      minimumNecessary: true,
      fieldValueEmbeddedInEnvelope: false,
      evidenceArtifactRetrievalAuthority: 'NOT_APPLICABLE'
    },
    {
      dataClass: 'PROVIDER_EVIDENCE_REFERENCES',
      fieldPath: 'evidenceReferences',
      sourceOwner: 'MGSN',
      sourceReference: 'provider-evidence-set:fixture-405',
      sourceVersion: 2,
      sourceFingerprintSha256: 'f'.repeat(64),
      necessityReference: 'necessity:provider-evidence-reference-review',
      requested: true,
      authorizedBySourceOwner: true,
      minimumNecessary: true,
      fieldValueEmbeddedInEnvelope: false,
      evidenceArtifactRetrievalAuthority: 'SEPARATE_AUTHORITY_REQUIRED'
    }
  ],
  projectionFingerprintSha256: '8'.repeat(64),
  sourceSetFingerprintSha256: '9'.repeat(64),
  wildcardAllowed: false,
  wholeRecordAllowed: false,
  implicitFieldExpansionAllowed: false,
  fieldValuesEmbeddedInEnvelope: false,
  requestedAuthorizedMinimumNecessaryIntersectionRequired: true,
  forbiddenGenericDataClasses: controlledHandoffForbiddenGenericDataClasses
});
const handoffFixtureSourceLineage = Object.freeze<ControlledHandoffSourceLineageV1>({
  selectionLineage: {
    selection: handoffFixtureSelectionReference,
    selectionScope: handoffFixtureSelectionScope,
    selectionFingerprintSha256: 'a'.repeat(64),
    selectedProvider: {
      providerId: handoffFixtureProviderId,
      providerWorkspaceId: handoffFixtureProviderWorkspaceId
    },
    currentSelectionValidation: {
      purpose: 'CONTROLLED_HANDOFF_REVIEW',
      decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
      currentlyUsable: true,
      evaluatedAt: '2026-09-01T09:28:00.000Z',
      validationPolicyVersion: 'mgsn-provider-selection-validation-v1',
      checkedAuthorityReferences: ['network-participation_fixture-381', handoffFixtureProviderId]
    }
  },
  currentSourceVersions: [
    {
      owner: 'MGSN',
      sourceType: 'PROVIDER',
      sourceId: handoffFixtureProviderId,
      version: 2,
      fingerprintSha256: '6'.repeat(64),
      checkedAt: '2026-09-01T09:28:00.000Z',
      authorityState: 'CURRENT'
    },
    {
      owner: 'OTHER_CANONICAL_OWNER',
      sourceType: 'APPLICANT',
      sourceId: 'applicant:fixture-405',
      version: 4,
      fingerprintSha256: 'd'.repeat(64),
      checkedAt: '2026-09-01T09:28:00.000Z',
      authorityState: 'CURRENT'
    }
  ],
  directExecutorAuthority: {
    disclosureState: 'INDEPENDENT_EVIDENCE_REFERENCED',
    directExecutorEstablished: true,
    finalExecutionProviderId: handoffFixtureProviderId,
    finalExecutionProviderWorkspaceId: handoffFixtureProviderWorkspaceId,
    authorityReference: 'direct-executor-authority:fixture-405',
    authorityVersion: 1,
    evidenceReferences: ['direct-executor-evidence:fixture-405'],
    checkedAt: '2026-09-01T09:28:00.000Z',
    hiddenIntermediaryAllowed: false,
    onwardRecipientAuthorization: 'NONE'
  },
  currentAuthorityRevalidationRequiredBeforeAuthorize: true,
  currentAuthorityRevalidationRequiredBeforeConsumption: true,
  evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval: true
});
const handoffFixtureAuthority = Object.freeze({
  source: 'CORE_WORKSPACE_PRINCIPAL',
  originatingWorkspaceId: handoffFixtureWorkspaceId,
  authorizingActorId: 'user_fixture-405',
  principalReference: 'principal:fixture-405',
  workspaceMembershipReference: 'workspace-membership:fixture-405',
  handoffAuthorityReference: 'handoff-authority:fixture-405',
  handoffAuthorityVersion: 1,
  authenticatedAt: handoffFixtureAt,
  affirmativeHumanActionEvidenceReference: 'human-action:fixture-405',
  payloadIdentityAuthoritative: false
}) satisfies Readonly<ControlledHandoffTrustedHumanAuthorityV1>;
const handoffFixturePrivacyPreview = Object.freeze({
  affirmativeHumanAction: true,
  acknowledgementCode: 'CONTROLLED_PRIVACY_HANDOFF_V1',
  acknowledgementTextVersion: 'v1',
  originatingWorkspaceId: handoffFixtureWorkspaceId,
  recipientProviderId: handoffFixtureProviderId,
  recipientProviderWorkspaceId: handoffFixtureProviderWorkspaceId,
  selection: handoffFixtureSelectionReference,
  purposeFingerprintSha256: handoffFixturePurpose.purposeFingerprintSha256,
  projectionFingerprintSha256: handoffFixtureProjection.projectionFingerprintSha256,
  sourceSetFingerprintSha256: handoffFixtureProjection.sourceSetFingerprintSha256,
  previewFingerprintSha256: '7'.repeat(64),
  reviewedAt: handoffFixtureAt
}) satisfies Readonly<ControlledHandoffPrivacyPreviewAcknowledgementV1>;
const handoffFixtureRecipient = Object.freeze({
  providerId: handoffFixtureProviderId,
  providerWorkspaceId: handoffFixtureProviderWorkspaceId,
  role: 'FINAL_EXECUTION_PROVIDER'
}) satisfies ControlledHandoffEnvelopeBaseV1['recipient'];
const currentHandoffFixture = Object.freeze({
  schemaVersion: 1,
  controlledHandoffId: handoffFixtureId,
  originatingWorkspaceId: handoffFixtureWorkspaceId,
  recipient: handoffFixtureRecipient,
  purpose: handoffFixturePurpose,
  authorizedProjection: handoffFixtureProjection,
  sourceLineage: handoffFixtureSourceLineage,
  trustedHumanAuthority: handoffFixtureAuthority,
  privacyPreviewAcknowledgement: handoffFixturePrivacyPreview,
  authorizedAt: handoffFixtureAt,
  validFrom: handoffFixtureAt,
  validUntil: '2026-09-02T09:30:00.000Z',
  version: 1,
  envelopeFingerprintSha256: '5'.repeat(64),
  correlationId: 'correlation_fixture-405',
  authorityConsequences: noDownstreamHandoffAuthorityConsequences,
  status: 'AUTHORIZED',
  revokedAt: null
}) satisfies Readonly<ControlledHandoffEnvelopeV1>;
const handoffFixtureAttempt = Object.freeze({
  originatingWorkspaceId: handoffFixtureWorkspaceId,
  recipientProviderId: handoffFixtureProviderId,
  recipientProviderWorkspaceId: handoffFixtureProviderWorkspaceId,
  purposeFingerprintSha256: handoffFixturePurpose.purposeFingerprintSha256,
  projectionFingerprintSha256: handoffFixtureProjection.projectionFingerprintSha256,
  sourceSetFingerprintSha256: handoffFixtureProjection.sourceSetFingerprintSha256,
  artifactRetrievalRequested: false,
  attemptedAt: '2026-09-01T09:45:00.000Z',
  correlationId: 'correlation_fixture-405-consume'
}) satisfies Readonly<ControlledHandoffConsumptionAttemptV1>;

/** Shared acceptance fixtures for privacy-bounded authorization, replay and current validation. */
export const controlledHandoffContractFixtureV1 = Object.freeze({
  authorizeCommand: {
    schemaVersion: 1,
    originatingWorkspaceId: handoffFixtureWorkspaceId,
    recipient: handoffFixtureRecipient,
    purpose: handoffFixturePurpose,
    authorizedProjection: handoffFixtureProjection,
    sourceLineage: handoffFixtureSourceLineage,
    trustedHumanAuthority: handoffFixtureAuthority,
    privacyPreviewAcknowledgement: handoffFixturePrivacyPreview,
    validFrom: handoffFixtureAt,
    validUntil: '2026-09-02T09:30:00.000Z',
    expectedCurrent: {
      kind: 'ABSENT'
    },
    idempotencyKey: 'controlled-handoff:authorize:fixture-405',
    commandFingerprintSha256: '2'.repeat(64),
    correlationId: 'correlation_fixture-405'
  },
  currentEnvelope: currentHandoffFixture,
  replayResult: {
    schemaVersion: 1,
    mutation: 'AUTHORIZED',
    envelope: currentHandoffFixture,
    replayed: true,
    replayDoesNotEstablishCurrentUsability: true,
    correlationId: 'correlation_fixture-405'
  },
  validForExactConsumption: {
    schemaVersion: 1,
    envelope: {
      controlledHandoffId: handoffFixtureId,
      version: 1
    },
    purpose: 'HANDOFF_CONSUMPTION',
    attempt: handoffFixtureAttempt,
    evaluatedAt: '2026-09-01T09:45:00.000Z',
    validationPolicyVersion: 'mgsn-controlled-handoff-validation-v1',
    checkedAuthorityReferences: [
      'handoff-authority:fixture-405',
      'direct-executor-authority:fixture-405',
      'network-participation_fixture-381'
    ],
    authorityConsequences: noDownstreamHandoffAuthorityConsequences,
    validationIsNotBearerCapability: true,
    validationDoesNotAuthorizeDownstreamAction: true,
    decision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION',
    currentlyUsable: true,
    currentExactDisclosurePermitted: true,
    publicReason:
      'Current authority permits only the exact reviewed projection for this recipient and purpose.'
  },
  expiredValidation: {
    schemaVersion: 1,
    envelope: {
      controlledHandoffId: handoffFixtureId,
      version: 1
    },
    purpose: 'HANDOFF_CONSUMPTION',
    attempt: {
      ...handoffFixtureAttempt,
      attemptedAt: '2026-09-03T09:45:00.000Z'
    },
    evaluatedAt: '2026-09-03T09:45:00.000Z',
    validationPolicyVersion: 'mgsn-controlled-handoff-validation-v1',
    checkedAuthorityReferences: ['handoff-authority:fixture-405'],
    authorityConsequences: noDownstreamHandoffAuthorityConsequences,
    validationIsNotBearerCapability: true,
    validationDoesNotAuthorizeDownstreamAction: true,
    decision: 'DENY',
    currentlyUsable: false,
    currentExactDisclosurePermitted: false,
    denialReason: 'HANDOFF_EXPIRED',
    publicReason: 'The recorded handoff envelope is outside its finite validity window.'
  },
  artifactRetrievalDenied: {
    schemaVersion: 1,
    envelope: {
      controlledHandoffId: handoffFixtureId,
      version: 1
    },
    purpose: 'EVIDENCE_REFERENCE_RETRIEVAL_REVIEW',
    attempt: {
      ...handoffFixtureAttempt,
      artifactRetrievalRequested: true
    },
    evaluatedAt: '2026-09-01T09:46:00.000Z',
    validationPolicyVersion: 'mgsn-controlled-handoff-validation-v1',
    checkedAuthorityReferences: ['provider-evidence-set:fixture-405'],
    authorityConsequences: noDownstreamHandoffAuthorityConsequences,
    validationIsNotBearerCapability: true,
    validationDoesNotAuthorizeDownstreamAction: true,
    decision: 'DENY',
    currentlyUsable: false,
    currentExactDisclosurePermitted: false,
    denialReason: 'EVIDENCE_ARTIFACT_ACCESS_NOT_AUTHORIZED',
    publicReason:
      'Evidence-reference visibility does not authorize retrieval of the underlying artifact.'
  },
  revokeCommand: {
    schemaVersion: 1,
    originatingWorkspaceId: handoffFixtureWorkspaceId,
    target: {
      controlledHandoffId: handoffFixtureId,
      version: 1
    },
    trustedHumanAuthority: handoffFixtureAuthority,
    reasonCode: 'HUMAN_WITHDRAWAL',
    idempotencyKey: 'controlled-handoff:revoke:fixture-405',
    commandFingerprintSha256: '3'.repeat(64),
    correlationId: 'correlation_fixture-405-revoke'
  }
} as const satisfies Readonly<{
  authorizeCommand: AuthorizeOrReplaceControlledHandoffCommandV1;
  currentEnvelope: ControlledHandoffEnvelopeV1;
  replayResult: ControlledHandoffMutationResultV1;
  validForExactConsumption: ControlledHandoffCurrentValidationV1;
  expiredValidation: ControlledHandoffCurrentValidationV1;
  artifactRetrievalDenied: ControlledHandoffCurrentValidationV1;
  revokeCommand: RevokeControlledHandoffCommandV1;
}>);
