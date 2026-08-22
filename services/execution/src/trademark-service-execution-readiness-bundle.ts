import { createHash } from 'node:crypto';
import type { TrademarkServiceOperatorReadinessBundle } from '@markorbit/contracts/trademark-service-execution-readiness-bundle';
import type { TrademarkServiceIsolationDecision } from '@markorbit/contracts/trademark-service-execution-isolation';
import type {
  TrademarkServiceExecutionAuthorization,
  TrademarkServiceExecutionPlan,
  TrademarkServiceProtectedActionRelease,
  TrademarkServiceRecoveryState
} from '@markorbit/contracts/trademark-service-execution';
import type {
  TrademarkServiceExecutionEnvironmentPolicy,
  TrademarkServiceProtectedActionEnvironmentBinding
} from '@markorbit/contracts/trademark-service-execution-sandbox';
import type { TrademarkServiceSimulationEvidence } from '@markorbit/contracts/trademark-service-execution-simulation';
import { TrademarkServiceExecutionError } from './trademark-service-execution.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sameWorkspace = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const cleanActions = (values: readonly string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
const cleanRefs = (values: readonly string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();

export interface CreateTrademarkServiceOperatorReadinessBundleCommand {
  workspaceId: string;
  authorization: Readonly<TrademarkServiceExecutionAuthorization>;
  plan: Readonly<TrademarkServiceExecutionPlan>;
  environmentPolicy: Readonly<TrademarkServiceExecutionEnvironmentPolicy>;
  release: Readonly<TrademarkServiceProtectedActionRelease>;
  environmentBinding: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>;
  isolationDecision?: Readonly<TrademarkServiceIsolationDecision>;
  simulationEvidence?: Readonly<TrademarkServiceSimulationEvidence>;
  recovery: Readonly<TrademarkServiceRecoveryState>;
  unresolvedHumanActions?: readonly string[];
  createdAt: string;
}

export function createTrademarkServiceOperatorReadinessBundle(
  command: Readonly<CreateTrademarkServiceOperatorReadinessBundleCommand>
): TrademarkServiceOperatorReadinessBundle {
  const workspaceIds = [
    command.authorization.workspaceId,
    command.plan.workspaceId,
    command.environmentPolicy.workspaceId,
    command.release.workspaceId,
    command.isolationDecision?.workspaceId,
    command.simulationEvidence?.workspaceId
  ].filter((value): value is string => Boolean(value));
  if (!workspaceIds.every((value) => sameWorkspace(value, command.workspaceId))) {
    throw new TrademarkServiceExecutionError(
      'WORKSPACE_MISMATCH',
      'Operator readiness inputs crossed Workspace boundaries.',
      404
    );
  }

  if (
    command.plan.authorizationId !== command.authorization.executionAuthorizationId ||
    command.environmentPolicy.executionAuthorizationId !==
      command.authorization.executionAuthorizationId ||
    command.release.executionAuthorizationId !== command.authorization.executionAuthorizationId ||
    command.release.executionPlanId !== command.plan.executionPlanId
  ) {
    throw new TrademarkServiceExecutionError(
      'OWNER_MISMATCH',
      'Operator readiness inputs do not share the same authorization and execution plan lineage.'
    );
  }

  if (
    command.environmentBinding.protectedActionReleaseId !==
      command.release.protectedActionReleaseId ||
    command.environmentBinding.environmentPolicyId !== command.environmentPolicy.environmentPolicyId ||
    command.environmentBinding.environment !== command.environmentPolicy.environment ||
    command.environmentBinding.mode !== command.environmentPolicy.mode ||
    command.environmentBinding.connectorClass !== command.environmentPolicy.connectorClass ||
    command.environmentBinding.endpointClass !== command.environmentPolicy.endpointClass ||
    command.environmentBinding.credentialClass !== command.environmentPolicy.credentialClass
  ) {
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'Operator readiness environment binding does not match the durable sandbox policy.'
    );
  }

  const isolation = command.isolationDecision;
  if (
    isolation &&
    (isolation.protectedActionReleaseId !== command.release.protectedActionReleaseId ||
      isolation.environmentPolicyId !== command.environmentPolicy.environmentPolicyId ||
      isolation.environment !== command.environmentPolicy.environment ||
      isolation.mode !== command.environmentPolicy.mode ||
      isolation.connectorClass !== command.environmentPolicy.connectorClass ||
      isolation.endpointClass !== command.environmentPolicy.endpointClass ||
      isolation.credentialClass !== command.environmentPolicy.credentialClass ||
      isolation.productionCredentialUsed !== false ||
      isolation.unrestrictedEgressUsed !== false ||
      isolation.liveExternalActionAuthorized !== false)
  ) {
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'Operator readiness isolation evidence failed the sandbox authority audit.'
    );
  }

  const simulation = command.simulationEvidence;
  if (
    simulation &&
    (simulation.protectedActionReleaseId !== command.release.protectedActionReleaseId ||
      simulation.providerClaim !== false ||
      simulation.providerAcceptanceCreated !== false ||
      simulation.officialFilingSuccessCreated !== false ||
      simulation.paymentTruthCreated !== false ||
      simulation.markRegLifecycleTruthCreated !== false ||
      simulation.officialTruthCreated !== false ||
      simulation.liveExternalActionPerformed !== false ||
      simulation.automaticRetryAuthorized !== false)
  ) {
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'Operator readiness simulation evidence crossed a truth or live-action boundary.'
    );
  }

  if (
    command.environmentPolicy.productionEnvironmentAuthorized !== false ||
    command.environmentPolicy.productionCredentialsAllowed !== false ||
    command.environmentPolicy.unrestrictedEgressAllowed !== false ||
    command.environmentPolicy.liveExternalActionAuthorized !== false ||
    command.environmentPolicy.officialTruthCreated !== false ||
    command.recovery.automaticExternalRetryPerformed !== false
  ) {
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'Operator readiness bundle cannot contain production, Official Truth, or automatic external retry authority.'
    );
  }

  const explicitActions = cleanActions(command.unresolvedHumanActions ?? []);
  const recoveryAction =
    command.recovery.state === 'NO_RECOVERY_REQUIRED' ? [] : [command.recovery.nextAction];
  const simulationAction = simulation?.requiresHumanReview
    ? ['Review deterministic simulation evidence before any further protected action.']
    : [];
  const unresolvedHumanActions = cleanActions([
    ...explicitActions,
    ...recoveryAction,
    ...simulationAction
  ]);
  const evidenceReferences = cleanRefs([
    ...command.release.evidenceReferences,
    ...(simulation?.evidenceReferences ?? []),
    ...(isolation ? [isolation.isolationDecisionId] : []),
    ...(simulation ? [simulation.simulationResponseId] : [])
  ]);
  if (!evidenceReferences.length) {
    throw new TrademarkServiceExecutionError(
      'EVIDENCE_REQUIRED',
      'Operator readiness bundle requires explicit evidence references.'
    );
  }

  const createdAt = new Date(command.createdAt);
  if (Number.isNaN(createdAt.valueOf())) {
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'Operator readiness bundle requires a valid createdAt timestamp.'
    );
  }
  const stable = hash({
    workspaceId: command.workspaceId,
    authorizationId: command.authorization.executionAuthorizationId,
    planId: command.plan.executionPlanId,
    environmentPolicyId: command.environmentPolicy.environmentPolicyId,
    protectedActionReleaseId: command.release.protectedActionReleaseId,
    isolationDecisionId: isolation?.isolationDecisionId,
    simulationResponseId: simulation?.simulationResponseId,
    recovery: command.recovery,
    unresolvedHumanActions,
    evidenceReferences
  }).slice(0, 32);

  return {
    schemaVersion: 1,
    operatorReadinessBundleId: `trademark-service-operator-readiness-bundle_${stable}`,
    workspaceId: command.workspaceId,
    authorization: command.authorization,
    plan: command.plan,
    environmentPolicy: command.environmentPolicy,
    release: command.release,
    environmentBinding: command.environmentBinding,
    ...(isolation ? { isolationDecision: isolation } : {}),
    ...(simulation ? { simulationEvidence: simulation } : {}),
    connectorMode: command.environmentPolicy.mode,
    endpointClass: command.environmentPolicy.endpointClass,
    evidenceReferences,
    recovery: command.recovery,
    unresolvedHumanActions,
    reviewState: unresolvedHumanActions.length
      ? 'HUMAN_ACTION_REQUIRED'
      : 'READY_FOR_OPERATOR_REVIEW',
    authorityAuditPassed: true,
    environmentBindingVerified: true,
    evidenceSeparatedFromOfficialTruth: true,
    productionEnvironmentAuthorized: false,
    productionCredentialsAuthorized: false,
    liveExternalActionAuthorized: false,
    deploymentApproved: false,
    productionEnablementAuthorized: false,
    officialTruthCreated: false,
    createdAt: createdAt.toISOString()
  };
}
