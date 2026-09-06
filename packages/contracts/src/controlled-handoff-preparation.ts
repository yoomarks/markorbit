import type { MarkOrbitId } from './index.js';
import type {
  AuthorizedDataProjectionV1,
  ControlledHandoffAuthorizedDataClass,
  ControlledHandoffForbiddenGenericDataClass,
  ControlledHandoffPurposeCode,
  ControlledHandoffPurposeV1,
  ControlledHandoffSourceLineageV1,
  ControlledHandoffSourceOwner
} from './controlled-privacy-handoff.js';
import type { ProviderId } from './provider-execution.js';
import type {
  ProviderSelectionScopeReferenceV1,
  ProviderSelectionVersionReferenceV1
} from './provider-selection.js';

/**
 * Preparation is a read/compute boundary only. It prepares exact material for human review and does
 * not itself authorize a Controlled Handoff or any downstream action.
 */
export interface ControlledHandoffPreparationRequestedFieldV1 {
  dataClass: ControlledHandoffAuthorizedDataClass;
  fieldPath: string;
  sourceOwner: ControlledHandoffSourceOwner;
  sourceReference: string;
  necessityReference: string;
}

export interface ControlledHandoffPreparationRequestV1 {
  schemaVersion: 1;
  selection: Readonly<ProviderSelectionVersionReferenceV1>;
  selectionScope: Readonly<ProviderSelectionScopeReferenceV1>;
  purpose: Readonly<{
    code: ControlledHandoffPurposeCode;
    contextReference: string;
    instructionReference: string;
  }>;
  requestedFields: ReadonlyArray<Readonly<ControlledHandoffPreparationRequestedFieldV1>>;
  checkedAt: string;
  correlationId: MarkOrbitId;
}

export interface ControlledHandoffPreparationAuthorityConsequencesV1 {
  controlledPrivacyHandoffAuthorized: false;
  disclosureAuthorized: false;
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

export const noControlledHandoffPreparationAuthorityConsequences = Object.freeze({
  controlledPrivacyHandoffAuthorized: false,
  disclosureAuthorized: false,
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
}) satisfies Readonly<ControlledHandoffPreparationAuthorityConsequencesV1>;

export const controlledHandoffPreparationStatuses = [
  'READY_FOR_HUMAN_REVIEW',
  'DENIED',
  'SOURCE_UNAVAILABLE'
] as const;
export type ControlledHandoffPreparationStatus =
  (typeof controlledHandoffPreparationStatuses)[number];

export const controlledHandoffPreparationDenialReasons = [
  'SELECTION_NOT_CURRENT',
  'SELECTION_SCOPE_MISMATCH',
  'DIRECT_EXECUTOR_NOT_ESTABLISHED',
  'REQUESTED_FIELD_NOT_AUTHORIZED',
  'MINIMUM_NECESSARY_NOT_ESTABLISHED',
  'PARTICIPATION_NOT_ACTIVE',
  'VISIBILITY_NO_LONGER_AUTHORIZED',
  'HIDDEN_INTERMEDIARY_DETECTED',
  'OTHER_CURRENT_AUTHORITY_DENIED'
] as const;
export type ControlledHandoffPreparationDenialReason =
  (typeof controlledHandoffPreparationDenialReasons)[number];

export interface ControlledHandoffPreparationIncludedFieldV1 {
  dataClass: ControlledHandoffAuthorizedDataClass;
  fieldPath: string;
  sourceOwner: ControlledHandoffSourceOwner;
  sourceReference: string;
  necessityReference: string;
}

export interface ControlledHandoffPreparationReviewTupleV1 {
  originatingWorkspaceId: string;
  recipientProviderId: ProviderId;
  recipientProviderWorkspaceId: string;
  selection: Readonly<ProviderSelectionVersionReferenceV1>;
  purposeFingerprintSha256: string;
  projectionFingerprintSha256: string;
  sourceSetFingerprintSha256: string;
  previewFingerprintSha256: string;
}

interface ControlledHandoffPreparationResultBaseV1 {
  schemaVersion: 1;
  selection: Readonly<ProviderSelectionVersionReferenceV1>;
  evaluatedAt: string;
  checkedAuthorityReferences: readonly string[];
  publicLimitations: readonly string[];
  correlationId: MarkOrbitId;
  previewIsNotAuthorization: true;
  resultIsNotBearerCapability: true;
  authorityConsequences: Readonly<ControlledHandoffPreparationAuthorityConsequencesV1>;
}

export type ControlledHandoffPreparationResultV1 = Readonly<
  ControlledHandoffPreparationResultBaseV1 &
    (
      | {
          status: 'READY_FOR_HUMAN_REVIEW';
          recipient: Readonly<{
            providerId: ProviderId;
            providerWorkspaceId: string;
            role: 'FINAL_EXECUTION_PROVIDER';
          }>;
          purpose: Readonly<ControlledHandoffPurposeV1>;
          authorizedProjection: Readonly<AuthorizedDataProjectionV1>;
          sourceLineage: Readonly<ControlledHandoffSourceLineageV1>;
          reviewTuple: Readonly<ControlledHandoffPreparationReviewTupleV1>;
          includedFields: ReadonlyArray<Readonly<ControlledHandoffPreparationIncludedFieldV1>>;
          excludedGenericDataClasses: readonly ControlledHandoffForbiddenGenericDataClass[];
          readyForExplicitHumanAcknowledgement: true;
        }
      | {
          status: 'DENIED';
          denialReason: ControlledHandoffPreparationDenialReason;
          publicReason: string;
          readyForExplicitHumanAcknowledgement: false;
        }
      | {
          status: 'SOURCE_UNAVAILABLE';
          publicReason: string;
          retryable: true;
          readyForExplicitHumanAcknowledgement: false;
        }
    )
>;
