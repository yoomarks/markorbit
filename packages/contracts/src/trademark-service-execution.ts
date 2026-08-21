import type { Money } from './index.js';
import type { ProductLoopExactReference } from './product-loop.js';
import type {
  TrademarkServiceExecutionReadinessId,
  TrademarkServiceWorkPackageId
} from './trademark-service-workbench.js';

export type TrademarkServiceExecutionAuthorizationId =
  `trademark-service-execution-authorization_${string}`;
export type TrademarkServiceExecutionPlanId = `trademark-service-execution-plan_${string}`;
export type TrademarkServiceProtectedActionReleaseId =
  `trademark-service-protected-action-release_${string}`;
export type TrademarkServiceProviderHandoffId = `trademark-service-provider-handoff_${string}`;
export type TrademarkServiceLifecycleHandoffId = `trademark-service-lifecycle-handoff_${string}`;
export type TrademarkServiceExecutionEvidenceId = `trademark-service-execution-evidence_${string}`;

export const trademarkServiceProtectedActionKinds = [
  'PROVIDER_INSTRUCTION',
  'AUTHORITY_FILING',
  'PAYMENT',
  'EXTERNAL_COMMUNICATION',
  'PUBLICATION'
] as const;
export type TrademarkServiceProtectedActionKind =
  (typeof trademarkServiceProtectedActionKinds)[number];

export const trademarkServiceExecutionStepOwners = [
  'EXECUTION',
  'MGSN',
  'MARKREG',
  'PAYMENT',
  'EXTERNAL_AUTHORITY'
] as const;
export type TrademarkServiceExecutionStepOwner =
  (typeof trademarkServiceExecutionStepOwners)[number];

export interface TrademarkServiceExecutionAuthorization {
  schemaVersion: 1;
  executionAuthorizationId: TrademarkServiceExecutionAuthorizationId;
  workspaceId: string;
  workPackage: Readonly<ProductLoopExactReference<TrademarkServiceWorkPackageId>>;
  executionReadinessId: TrademarkServiceExecutionReadinessId;
  authorizedByUserId: string;
  authorizationCapacity: string;
  authorizedAt: string;
  expiresAt?: string;
  allowedActions: readonly TrademarkServiceProtectedActionKind[];
  commercialCeiling?: Readonly<Money>;
  providerRestriction?: string;
  conditions: readonly string[];
  explicitUserAuthorization: true;
  acknowledgementAuthorizationIsNotSubmission: true;
  acknowledgementOfficialAcceptanceNotGuaranteed: true;
  externalActionPerformed: false;
  officialTruthCreated: false;
}

export interface TrademarkServiceExecutionPlanStep {
  stepId: string;
  sequence: number;
  action: TrademarkServiceProtectedActionKind;
  owner: TrademarkServiceExecutionStepOwner;
  description: string;
  providerReference?: string;
  requiresProtectedActionGate: true;
  status: 'PLANNED';
}

export interface TrademarkServiceExecutionPlan {
  schemaVersion: 1;
  executionPlanId: TrademarkServiceExecutionPlanId;
  workspaceId: string;
  workPackage: Readonly<ProductLoopExactReference<TrademarkServiceWorkPackageId>>;
  authorizationId: TrademarkServiceExecutionAuthorizationId;
  steps: ReadonlyArray<Readonly<TrademarkServiceExecutionPlanStep>>;
  createdAt: string;
  state: 'READY_FOR_PROTECTED_ACTION_REVIEW';
  externalActionPerformed: false;
  officialTruthCreated: false;
  matterLifecycleMutated: false;
  providerEngaged: false;
}

export interface TrademarkServiceProtectedActionRelease {
  schemaVersion: 1;
  protectedActionReleaseId: TrademarkServiceProtectedActionReleaseId;
  workspaceId: string;
  executionPlanId: TrademarkServiceExecutionPlanId;
  executionAuthorizationId: TrademarkServiceExecutionAuthorizationId;
  workPackage: Readonly<ProductLoopExactReference<TrademarkServiceWorkPackageId>>;
  stepId: string;
  action: TrademarkServiceProtectedActionKind;
  idempotencyKey: string;
  requestFingerprintSha256: string;
  evidenceReferences: readonly string[];
  releasedByUserId: string;
  releasedAt: string;
  releaseState: 'RELEASED_TO_OWNER_DOMAIN';
  externalSuccessConfirmed: false;
  officialAcceptanceConfirmed: false;
}

export interface TrademarkServiceProviderHandoffRequest {
  schemaVersion: 1;
  providerHandoffId: TrademarkServiceProviderHandoffId;
  workspaceId: string;
  protectedActionReleaseId: TrademarkServiceProtectedActionReleaseId;
  providerReference: string;
  instructionReferences: readonly string[];
  evidenceReferences: readonly string[];
  createdAt: string;
  targetOwner: 'MGSN';
  providerEngagementCreatedByExecution: false;
  providerAcceptanceCreatedByExecution: false;
}

export interface TrademarkServiceLifecycleHandoffRequest {
  schemaVersion: 1;
  lifecycleHandoffId: TrademarkServiceLifecycleHandoffId;
  workspaceId: string;
  matterReference: string;
  evidenceId: TrademarkServiceExecutionEvidenceId;
  requestedProjection:
    | 'INSTRUCTED'
    | 'FILED_CLAIM_RECORDED'
    | 'RECEIPT_RECORDED'
    | 'ACTION_REQUIRED'
    | 'COMPLETED_CANDIDATE';
  ownerValidationReferences: readonly string[];
  createdAt: string;
  targetOwner: 'MARKREG';
  matterLifecycleMutatedByExecution: false;
  officialTruthCreatedByExecution: false;
}

export interface TrademarkServiceExecutionEvidence {
  schemaVersion: 1;
  executionEvidenceId: TrademarkServiceExecutionEvidenceId;
  workspaceId: string;
  protectedActionReleaseId: TrademarkServiceProtectedActionReleaseId;
  attemptState: 'ATTEMPTED' | 'OWNER_ACCEPTED' | 'OWNER_REJECTED' | 'FAILED';
  artifactReferences: readonly string[];
  receiptReferences: readonly string[];
  providerReturnReferences: readonly string[];
  ownerValidationReferences: readonly string[];
  recordedAt: string;
  attemptedDoesNotImplySubmitted: true;
  providerReturnDoesNotImplyOfficialTruth: true;
  officialAcceptanceVerifiedByExecution: false;
}

export interface TrademarkServiceRecoveryState {
  state: 'NO_RECOVERY_REQUIRED' | 'RETRY_ALLOWED' | 'MANUAL_REVIEW_REQUIRED' | 'TERMINAL_FAILURE';
  reasonCode: string;
  retryable: boolean;
  nextAction: string;
  duplicateProtectedActionPrevented: true;
  automaticExternalRetryPerformed: false;
}

export interface TrademarkServiceExecutionWorkbenchSnapshot {
  schemaVersion: 1;
  workspaceId: string;
  authorization: Readonly<TrademarkServiceExecutionAuthorization>;
  plan: Readonly<TrademarkServiceExecutionPlan>;
  release?: Readonly<TrademarkServiceProtectedActionRelease>;
  providerHandoff?: Readonly<TrademarkServiceProviderHandoffRequest>;
  lifecycleHandoff?: Readonly<TrademarkServiceLifecycleHandoffRequest>;
  evidence?: Readonly<TrademarkServiceExecutionEvidence>;
  recovery: Readonly<TrademarkServiceRecoveryState>;
  nextHumanAction: string;
  authorityAuditPassed: boolean;
  officialTruthCreated: false;
  crossServiceSqlUsed: false;
}

export const trademarkServiceExecutionAuthority = {
  mayCreateExplicitAuthorizationRecord: true,
  mayCreateExecutionPlan: true,
  mayReleaseProtectedActionToOwnerDomain: true,
  mayRequestProviderOwnerHandoff: true,
  mayRequestMarkRegLifecycleHandoff: true,
  mayRecordExecutionEvidence: true,
  mayClassifyRecovery: true,
  mayCreateProviderAcceptance: false,
  mayCreateOfficialTruth: false,
  mayMutateMarkRegLifecycleDirectly: false,
  mayCreatePaymentTruth: false,
  mayRetryExternalActionAutomatically: false,
  mayUseCrossServiceSql: false
} as const;
