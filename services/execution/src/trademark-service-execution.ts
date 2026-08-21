import { createHash } from 'node:crypto';
import type { TrademarkServiceExecutionReadiness } from '@markorbit/contracts/trademark-service-workbench';
import type {
  TrademarkServiceExecutionAuthorization,
  TrademarkServiceExecutionEvidence,
  TrademarkServiceExecutionPlan,
  TrademarkServiceExecutionPlanStep,
  TrademarkServiceExecutionWorkbenchSnapshot,
  TrademarkServiceLifecycleHandoffRequest,
  TrademarkServiceProtectedActionKind,
  TrademarkServiceProtectedActionRelease,
  TrademarkServiceProviderHandoffRequest,
  TrademarkServiceRecoveryState
} from '@markorbit/contracts/trademark-service-execution';

export class TrademarkServiceExecutionError extends Error {
  constructor(
    readonly code:
      | 'WORKSPACE_MISMATCH'
      | 'READINESS_REQUIRED'
      | 'USER_AUTHORIZATION_REQUIRED'
      | 'AUTHORIZATION_EXPIRED'
      | 'ACTION_NOT_AUTHORIZED'
      | 'PLAN_STEP_NOT_FOUND'
      | 'OWNER_MISMATCH'
      | 'PROVIDER_RESTRICTION_MISMATCH'
      | 'EVIDENCE_REQUIRED'
      | 'IDEMPOTENCY_KEY_REQUIRED'
      | 'IDEMPOTENCY_CONFLICT'
      | 'MATTER_REFERENCE_REQUIRED'
      | 'OWNER_VALIDATION_REQUIRED'
      | 'AUTHORITY_BOUNDARY_VIOLATION',
    message: string,
    readonly status = 409
  ) {
    super(message);
    this.name = 'TrademarkServiceExecutionError';
  }
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clean = (value: string, field: string) => {
  const result = value.trim();
  if (!result) {
    throw new TrademarkServiceExecutionError(
      field === 'idempotencyKey' ? 'IDEMPOTENCY_KEY_REQUIRED' : 'USER_AUTHORIZATION_REQUIRED',
      `${field} is required.`
    );
  }
  return result;
};
const refs = (values: readonly string[], field: string) => {
  const result = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
  if (!result.length) {
    throw new TrademarkServiceExecutionError(
      field === 'ownerValidationReferences' ? 'OWNER_VALIDATION_REQUIRED' : 'EVIDENCE_REQUIRED',
      `${field} must contain at least one explicit reference.`
    );
  }
  return result;
};
const sameWorkspace = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const iso = (value: string, field: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new TrademarkServiceExecutionError(
      'USER_AUTHORIZATION_REQUIRED',
      `${field} must be a valid timestamp.`
    );
  }
  return date.toISOString();
};

export interface AuthorizeTrademarkServiceExecutionCommand {
  workspaceId: string;
  readiness: Readonly<TrademarkServiceExecutionReadiness>;
  workPackageVersion: number;
  authorizedByUserId: string;
  authorizationCapacity: string;
  authorizedAt: string;
  expiresAt?: string;
  allowedActions: readonly TrademarkServiceProtectedActionKind[];
  commercialCeiling?: TrademarkServiceExecutionAuthorization['commercialCeiling'];
  providerRestriction?: string;
  conditions?: readonly string[];
  explicitUserAuthorization: true;
  acknowledgementAuthorizationIsNotSubmission: true;
  acknowledgementOfficialAcceptanceNotGuaranteed: true;
}

export function authorizeTrademarkServiceExecution(
  command: Readonly<AuthorizeTrademarkServiceExecutionCommand>
): TrademarkServiceExecutionAuthorization {
  if (!sameWorkspace(command.workspaceId, command.readiness.workspaceId)) {
    throw new TrademarkServiceExecutionError(
      'WORKSPACE_MISMATCH',
      'Execution Readiness does not belong to this Workspace.',
      404
    );
  }
  if (command.readiness.readinessState !== 'READY_FOR_EXECUTION_PREPARATION') {
    throw new TrademarkServiceExecutionError(
      'READINESS_REQUIRED',
      'Execution Readiness has not reached the required preparation state.'
    );
  }
  if (command.readiness.workPackage.version !== command.workPackageVersion) {
    throw new TrademarkServiceExecutionError(
      'READINESS_REQUIRED',
      'Execution Readiness does not match the requested Work Package version.'
    );
  }
  if (
    command.readiness.executionAuthorized ||
    command.readiness.filingAuthorized ||
    command.readiness.externalContactAuthorized ||
    command.readiness.paymentAuthorized ||
    command.readiness.publicationAuthorized ||
    command.readiness.providerEngagementAuthorized
  ) {
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'M12 Execution Readiness must not already contain protected-action authority.'
    );
  }
  if (!command.explicitUserAuthorization) {
    throw new TrademarkServiceExecutionError(
      'USER_AUTHORIZATION_REQUIRED',
      'Explicit user authorization is required.'
    );
  }
  const allowedActions = [...new Set(command.allowedActions)].sort();
  if (!allowedActions.length) {
    throw new TrademarkServiceExecutionError(
      'USER_AUTHORIZATION_REQUIRED',
      'At least one protected action must be explicitly authorized.'
    );
  }
  const authorizedAt = iso(command.authorizedAt, 'authorizedAt');
  const expiresAt = command.expiresAt ? iso(command.expiresAt, 'expiresAt') : undefined;
  if (expiresAt && new Date(expiresAt) <= new Date(authorizedAt)) {
    throw new TrademarkServiceExecutionError(
      'USER_AUTHORIZATION_REQUIRED',
      'expiresAt must be later than authorizedAt.'
    );
  }
  const authorizedByUserId = clean(command.authorizedByUserId, 'authorizedByUserId');
  const authorizationCapacity = clean(command.authorizationCapacity, 'authorizationCapacity');
  const providerRestriction = command.providerRestriction?.trim() || undefined;
  const conditions = [
    ...new Set((command.conditions ?? []).map((value) => value.trim()).filter(Boolean))
  ].sort();
  const stable = hash({
    workspaceId: command.workspaceId,
    readinessId: command.readiness.executionReadinessId,
    workPackage: command.readiness.workPackage,
    authorizedByUserId,
    authorizationCapacity,
    authorizedAt,
    expiresAt,
    allowedActions,
    commercialCeiling: command.commercialCeiling ?? null,
    providerRestriction: providerRestriction ?? null,
    conditions
  }).slice(0, 32);
  return {
    schemaVersion: 1,
    executionAuthorizationId: `trademark-service-execution-authorization_${stable}`,
    workspaceId: command.workspaceId,
    workPackage: {
      id: command.readiness.workPackage.id,
      version: command.workPackageVersion
    },
    executionReadinessId: command.readiness.executionReadinessId,
    authorizedByUserId,
    authorizationCapacity,
    authorizedAt,
    ...(expiresAt ? { expiresAt } : {}),
    allowedActions,
    ...(command.commercialCeiling ? { commercialCeiling: command.commercialCeiling } : {}),
    ...(providerRestriction ? { providerRestriction } : {}),
    conditions,
    explicitUserAuthorization: true,
    acknowledgementAuthorizationIsNotSubmission: true,
    acknowledgementOfficialAcceptanceNotGuaranteed: true,
    externalActionPerformed: false,
    officialTruthCreated: false
  };
}

export interface CreateTrademarkServiceExecutionPlanCommand {
  workspaceId: string;
  authorization: Readonly<TrademarkServiceExecutionAuthorization>;
  createdAt: string;
  steps: ReadonlyArray<{
    action: TrademarkServiceProtectedActionKind;
    owner: TrademarkServiceExecutionPlanStep['owner'];
    description: string;
    providerReference?: string;
  }>;
}

export function createTrademarkServiceExecutionPlan(
  command: Readonly<CreateTrademarkServiceExecutionPlanCommand>
): TrademarkServiceExecutionPlan {
  if (!sameWorkspace(command.workspaceId, command.authorization.workspaceId)) {
    throw new TrademarkServiceExecutionError(
      'WORKSPACE_MISMATCH',
      'Authorization belongs to another Workspace.',
      404
    );
  }
  if (!command.steps.length) {
    throw new TrademarkServiceExecutionError(
      'ACTION_NOT_AUTHORIZED',
      'Execution Plan requires at least one step.'
    );
  }
  const createdAt = iso(command.createdAt, 'createdAt');
  const steps = command.steps.map((step, index) => {
    if (!command.authorization.allowedActions.includes(step.action)) {
      throw new TrademarkServiceExecutionError(
        'ACTION_NOT_AUTHORIZED',
        `Execution Plan step ${step.action} is outside the authorization scope.`
      );
    }
    const providerReference = step.providerReference?.trim() || undefined;
    if (
      command.authorization.providerRestriction &&
      providerReference &&
      providerReference !== command.authorization.providerRestriction
    ) {
      throw new TrademarkServiceExecutionError(
        'PROVIDER_RESTRICTION_MISMATCH',
        'Execution Plan provider does not match the authorization restriction.'
      );
    }
    return {
      stepId: `step_${String(index + 1).padStart(2, '0')}_${hash({ action: step.action, owner: step.owner, providerReference }).slice(0, 8)}`,
      sequence: index + 1,
      action: step.action,
      owner: step.owner,
      description: clean(step.description, 'step.description'),
      ...(providerReference ? { providerReference } : {}),
      requiresProtectedActionGate: true,
      status: 'PLANNED'
    } satisfies TrademarkServiceExecutionPlanStep;
  });
  const stable = hash({
    authorizationId: command.authorization.executionAuthorizationId,
    steps
  }).slice(0, 32);
  return {
    schemaVersion: 1,
    executionPlanId: `trademark-service-execution-plan_${stable}`,
    workspaceId: command.workspaceId,
    workPackage: command.authorization.workPackage,
    authorizationId: command.authorization.executionAuthorizationId,
    steps,
    createdAt,
    state: 'READY_FOR_PROTECTED_ACTION_REVIEW',
    externalActionPerformed: false,
    officialTruthCreated: false,
    matterLifecycleMutated: false,
    providerEngaged: false
  };
}

type ReplayEntry = { fingerprint: string; release: TrademarkServiceProtectedActionRelease };

export class TrademarkServiceProtectedActionGate {
  private readonly replay = new Map<string, ReplayEntry>();

  release(command: {
    workspaceId: string;
    authorization: Readonly<TrademarkServiceExecutionAuthorization>;
    plan: Readonly<TrademarkServiceExecutionPlan>;
    stepId: string;
    idempotencyKey: string;
    evidenceReferences: readonly string[];
    releasedByUserId: string;
    releasedAt: string;
    currentWorkPackageVersion: number;
  }): TrademarkServiceProtectedActionRelease {
    const idempotencyKey = clean(command.idempotencyKey, 'idempotencyKey');
    if (
      !sameWorkspace(command.workspaceId, command.authorization.workspaceId) ||
      !sameWorkspace(command.workspaceId, command.plan.workspaceId)
    ) {
      throw new TrademarkServiceExecutionError(
        'WORKSPACE_MISMATCH',
        'Protected action crossed Workspace boundaries.',
        404
      );
    }
    if (command.authorization.executionAuthorizationId !== command.plan.authorizationId) {
      throw new TrademarkServiceExecutionError(
        'OWNER_MISMATCH',
        'Execution Plan is not owned by this authorization.'
      );
    }
    if (command.currentWorkPackageVersion !== command.authorization.workPackage.version) {
      throw new TrademarkServiceExecutionError(
        'READINESS_REQUIRED',
        'Work Package changed after authorization.'
      );
    }
    const releasedAt = iso(command.releasedAt, 'releasedAt');
    if (
      command.authorization.expiresAt &&
      new Date(releasedAt) > new Date(command.authorization.expiresAt)
    ) {
      throw new TrademarkServiceExecutionError(
        'AUTHORIZATION_EXPIRED',
        'Execution authorization has expired.'
      );
    }
    const step = command.plan.steps.find((candidate) => candidate.stepId === command.stepId);
    if (!step) {
      throw new TrademarkServiceExecutionError(
        'PLAN_STEP_NOT_FOUND',
        'Execution Plan step was not found.',
        404
      );
    }
    if (!command.authorization.allowedActions.includes(step.action)) {
      throw new TrademarkServiceExecutionError(
        'ACTION_NOT_AUTHORIZED',
        'Protected action is outside authorization scope.'
      );
    }
    const evidenceReferences = refs(command.evidenceReferences, 'evidenceReferences');
    const releasedByUserId = clean(command.releasedByUserId, 'releasedByUserId');
    const requestFingerprintSha256 = hash({
      workspaceId: command.workspaceId,
      authorizationId: command.authorization.executionAuthorizationId,
      planId: command.plan.executionPlanId,
      stepId: step.stepId,
      action: step.action,
      evidenceReferences,
      workPackage: command.authorization.workPackage
    });
    const existing = this.replay.get(idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== requestFingerprintSha256) {
        throw new TrademarkServiceExecutionError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was already used for a different protected action.'
        );
      }
      return structuredClone(existing.release);
    }
    const release: TrademarkServiceProtectedActionRelease = {
      schemaVersion: 1,
      protectedActionReleaseId: `trademark-service-protected-action-release_${requestFingerprintSha256.slice(0, 32)}`,
      workspaceId: command.workspaceId,
      executionPlanId: command.plan.executionPlanId,
      executionAuthorizationId: command.authorization.executionAuthorizationId,
      workPackage: command.authorization.workPackage,
      stepId: step.stepId,
      action: step.action,
      idempotencyKey,
      requestFingerprintSha256,
      evidenceReferences,
      releasedByUserId,
      releasedAt,
      releaseState: 'RELEASED_TO_OWNER_DOMAIN',
      externalSuccessConfirmed: false,
      officialAcceptanceConfirmed: false
    };
    this.replay.set(idempotencyKey, {
      fingerprint: requestFingerprintSha256,
      release: structuredClone(release)
    });
    return release;
  }

  get replayCount() {
    return this.replay.size;
  }
}

export function createTrademarkServiceProviderHandoff(command: {
  workspaceId: string;
  release: Readonly<TrademarkServiceProtectedActionRelease>;
  plan: Readonly<TrademarkServiceExecutionPlan>;
  providerReference: string;
  instructionReferences: readonly string[];
  evidenceReferences: readonly string[];
  createdAt: string;
}): TrademarkServiceProviderHandoffRequest {
  if (!sameWorkspace(command.workspaceId, command.release.workspaceId)) {
    throw new TrademarkServiceExecutionError(
      'WORKSPACE_MISMATCH',
      'Release belongs to another Workspace.',
      404
    );
  }
  if (command.release.action !== 'PROVIDER_INSTRUCTION') {
    throw new TrademarkServiceExecutionError(
      'OWNER_MISMATCH',
      'Only a provider-instruction release may enter MGSN handoff.'
    );
  }
  const step = command.plan.steps.find((candidate) => candidate.stepId === command.release.stepId);
  if (!step || step.owner !== 'MGSN') {
    throw new TrademarkServiceExecutionError(
      'OWNER_MISMATCH',
      'Provider handoff requires an MGSN-owned plan step.'
    );
  }
  const providerReference = clean(command.providerReference, 'providerReference');
  if (step.providerReference && step.providerReference !== providerReference) {
    throw new TrademarkServiceExecutionError(
      'PROVIDER_RESTRICTION_MISMATCH',
      'Provider handoff does not match the plan.'
    );
  }
  const instructionReferences = refs(command.instructionReferences, 'evidenceReferences');
  const evidenceReferences = refs(command.evidenceReferences, 'evidenceReferences');
  const stable = hash({
    releaseId: command.release.protectedActionReleaseId,
    providerReference,
    instructionReferences
  }).slice(0, 32);
  return {
    schemaVersion: 1,
    providerHandoffId: `trademark-service-provider-handoff_${stable}`,
    workspaceId: command.workspaceId,
    protectedActionReleaseId: command.release.protectedActionReleaseId,
    providerReference,
    instructionReferences,
    evidenceReferences,
    createdAt: iso(command.createdAt, 'createdAt'),
    targetOwner: 'MGSN',
    providerEngagementCreatedByExecution: false,
    providerAcceptanceCreatedByExecution: false
  };
}

export function recordTrademarkServiceExecutionEvidence(command: {
  workspaceId: string;
  release: Readonly<TrademarkServiceProtectedActionRelease>;
  attemptState: TrademarkServiceExecutionEvidence['attemptState'];
  artifactReferences?: readonly string[];
  receiptReferences?: readonly string[];
  providerReturnReferences?: readonly string[];
  ownerValidationReferences?: readonly string[];
  recordedAt: string;
}): TrademarkServiceExecutionEvidence {
  if (!sameWorkspace(command.workspaceId, command.release.workspaceId)) {
    throw new TrademarkServiceExecutionError(
      'WORKSPACE_MISMATCH',
      'Release belongs to another Workspace.',
      404
    );
  }
  const normalizeOptional = (values: readonly string[] | undefined) =>
    [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort();
  const artifactReferences = normalizeOptional(command.artifactReferences);
  const receiptReferences = normalizeOptional(command.receiptReferences);
  const providerReturnReferences = normalizeOptional(command.providerReturnReferences);
  const ownerValidationReferences = normalizeOptional(command.ownerValidationReferences);
  if (
    !artifactReferences.length &&
    !receiptReferences.length &&
    !providerReturnReferences.length &&
    !ownerValidationReferences.length
  ) {
    throw new TrademarkServiceExecutionError(
      'EVIDENCE_REQUIRED',
      'Execution evidence requires at least one reference.'
    );
  }
  const stable = hash({
    releaseId: command.release.protectedActionReleaseId,
    attemptState: command.attemptState,
    artifactReferences,
    receiptReferences,
    providerReturnReferences,
    ownerValidationReferences
  }).slice(0, 32);
  return {
    schemaVersion: 1,
    executionEvidenceId: `trademark-service-execution-evidence_${stable}`,
    workspaceId: command.workspaceId,
    protectedActionReleaseId: command.release.protectedActionReleaseId,
    attemptState: command.attemptState,
    artifactReferences,
    receiptReferences,
    providerReturnReferences,
    ownerValidationReferences,
    recordedAt: iso(command.recordedAt, 'recordedAt'),
    attemptedDoesNotImplySubmitted: true,
    providerReturnDoesNotImplyOfficialTruth: true,
    officialAcceptanceVerifiedByExecution: false
  };
}

export function createTrademarkServiceLifecycleHandoff(command: {
  workspaceId: string;
  evidence: Readonly<TrademarkServiceExecutionEvidence>;
  matterReference: string;
  requestedProjection: TrademarkServiceLifecycleHandoffRequest['requestedProjection'];
  ownerValidationReferences: readonly string[];
  createdAt: string;
}): TrademarkServiceLifecycleHandoffRequest {
  if (!sameWorkspace(command.workspaceId, command.evidence.workspaceId)) {
    throw new TrademarkServiceExecutionError(
      'WORKSPACE_MISMATCH',
      'Execution evidence belongs to another Workspace.',
      404
    );
  }
  const matterReference = command.matterReference.trim();
  if (!matterReference) {
    throw new TrademarkServiceExecutionError(
      'MATTER_REFERENCE_REQUIRED',
      'matterReference is required.'
    );
  }
  const ownerValidationReferences = refs(
    command.ownerValidationReferences,
    'ownerValidationReferences'
  );
  const stable = hash({
    evidenceId: command.evidence.executionEvidenceId,
    matterReference,
    requestedProjection: command.requestedProjection,
    ownerValidationReferences
  }).slice(0, 32);
  return {
    schemaVersion: 1,
    lifecycleHandoffId: `trademark-service-lifecycle-handoff_${stable}`,
    workspaceId: command.workspaceId,
    matterReference,
    evidenceId: command.evidence.executionEvidenceId,
    requestedProjection: command.requestedProjection,
    ownerValidationReferences,
    createdAt: iso(command.createdAt, 'createdAt'),
    targetOwner: 'MARKREG',
    matterLifecycleMutatedByExecution: false,
    officialTruthCreatedByExecution: false
  };
}

export function classifyTrademarkServiceRecovery(input: {
  outcome: 'SUCCESS' | 'TRANSIENT_FAILURE' | 'AMBIGUOUS_EXTERNAL_OUTCOME' | 'PERMANENT_FAILURE';
  reasonCode: string;
}): TrademarkServiceRecoveryState {
  const reasonCode = clean(input.reasonCode, 'reasonCode');
  if (input.outcome === 'SUCCESS') {
    return {
      state: 'NO_RECOVERY_REQUIRED',
      reasonCode,
      retryable: false,
      nextAction: 'Continue owner-domain evidence and lifecycle review.',
      duplicateProtectedActionPrevented: true,
      automaticExternalRetryPerformed: false
    };
  }
  if (input.outcome === 'TRANSIENT_FAILURE') {
    return {
      state: 'RETRY_ALLOWED',
      reasonCode,
      retryable: true,
      nextAction:
        'Human reviews evidence and explicitly retries with the same governed action identity.',
      duplicateProtectedActionPrevented: true,
      automaticExternalRetryPerformed: false
    };
  }
  if (input.outcome === 'AMBIGUOUS_EXTERNAL_OUTCOME') {
    return {
      state: 'MANUAL_REVIEW_REQUIRED',
      reasonCode,
      retryable: false,
      nextAction: 'Verify the external outcome before any new protected action is released.',
      duplicateProtectedActionPrevented: true,
      automaticExternalRetryPerformed: false
    };
  }
  return {
    state: 'TERMINAL_FAILURE',
    reasonCode,
    retryable: false,
    nextAction:
      'Return to professional review and prepare a new authorized execution path if needed.',
    duplicateProtectedActionPrevented: true,
    automaticExternalRetryPerformed: false
  };
}

export function createTrademarkServiceExecutionWorkbenchSnapshot(command: {
  workspaceId: string;
  authorization: Readonly<TrademarkServiceExecutionAuthorization>;
  plan: Readonly<TrademarkServiceExecutionPlan>;
  release?: Readonly<TrademarkServiceProtectedActionRelease>;
  providerHandoff?: Readonly<TrademarkServiceProviderHandoffRequest>;
  lifecycleHandoff?: Readonly<TrademarkServiceLifecycleHandoffRequest>;
  evidence?: Readonly<TrademarkServiceExecutionEvidence>;
  recovery: Readonly<TrademarkServiceRecoveryState>;
  nextHumanAction: string;
}): TrademarkServiceExecutionWorkbenchSnapshot {
  const same = [
    command.authorization.workspaceId,
    command.plan.workspaceId,
    command.release?.workspaceId,
    command.providerHandoff?.workspaceId,
    command.lifecycleHandoff?.workspaceId,
    command.evidence?.workspaceId
  ]
    .filter((value): value is string => Boolean(value))
    .every((value) => sameWorkspace(value, command.workspaceId));
  const authorityAuditPassed =
    same &&
    command.authorization.externalActionPerformed === false &&
    command.authorization.officialTruthCreated === false &&
    command.plan.externalActionPerformed === false &&
    command.plan.officialTruthCreated === false &&
    command.plan.matterLifecycleMutated === false &&
    command.plan.providerEngaged === false &&
    (!command.release ||
      (command.release.externalSuccessConfirmed === false &&
        command.release.officialAcceptanceConfirmed === false)) &&
    (!command.providerHandoff ||
      (command.providerHandoff.providerEngagementCreatedByExecution === false &&
        command.providerHandoff.providerAcceptanceCreatedByExecution === false)) &&
    (!command.lifecycleHandoff ||
      (command.lifecycleHandoff.matterLifecycleMutatedByExecution === false &&
        command.lifecycleHandoff.officialTruthCreatedByExecution === false)) &&
    (!command.evidence || command.evidence.officialAcceptanceVerifiedByExecution === false) &&
    command.recovery.automaticExternalRetryPerformed === false;
  if (!authorityAuditPassed) {
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'M13 execution snapshot failed the owner-domain authority audit.'
    );
  }
  return {
    schemaVersion: 1,
    workspaceId: command.workspaceId,
    authorization: command.authorization,
    plan: command.plan,
    ...(command.release ? { release: command.release } : {}),
    ...(command.providerHandoff ? { providerHandoff: command.providerHandoff } : {}),
    ...(command.lifecycleHandoff ? { lifecycleHandoff: command.lifecycleHandoff } : {}),
    ...(command.evidence ? { evidence: command.evidence } : {}),
    recovery: command.recovery,
    nextHumanAction: clean(command.nextHumanAction, 'nextHumanAction'),
    authorityAuditPassed: true,
    officialTruthCreated: false,
    crossServiceSqlUsed: false
  };
}
