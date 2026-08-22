import { createHash } from 'node:crypto';
import type {
  TrademarkServiceExecutionCorrelationId,
  TrademarkServiceRecoveryDrillOutcome
} from '@markorbit/contracts/trademark-service-execution-observability';
import type { TrademarkServiceProtectedActionRelease } from '@markorbit/contracts/trademark-service-execution';
import type { TrademarkServiceProtectedActionEnvironmentBinding } from '@markorbit/contracts/trademark-service-execution-sandbox';
import {
  TrademarkServiceExecutionError,
  classifyTrademarkServiceRecovery
} from './trademark-service-execution.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function createTrademarkServiceExecutionCorrelationId(
  release: Readonly<TrademarkServiceProtectedActionRelease>,
  binding: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>
): TrademarkServiceExecutionCorrelationId {
  if (release.protectedActionReleaseId !== binding.protectedActionReleaseId)
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'Correlation identity requires an exact protected-action environment binding.'
    );
  return `trademark-service-execution-correlation_${hash({
    workspaceId: release.workspaceId,
    executionAuthorizationId: release.executionAuthorizationId,
    protectedActionReleaseId: release.protectedActionReleaseId,
    requestFingerprintSha256: release.requestFingerprintSha256,
    environmentPolicyId: binding.environmentPolicyId,
    environment: binding.environment,
    mode: binding.mode,
    connectorClass: binding.connectorClass,
    endpointClass: binding.endpointClass,
    credentialClass: binding.credentialClass
  }).slice(0, 32)}`;
}

export function classifyTrademarkServiceRecoveryDrill(
  outcome: TrademarkServiceRecoveryDrillOutcome,
  reasonCode: string
) {
  const recovery = classifyTrademarkServiceRecovery({ outcome, reasonCode });
  if (outcome === 'SUCCESS')
    return {
      recovery,
      deadLetterState: 'NOT_REQUIRED' as const,
      replayRule: 'NO_REPLAY_REQUIRED' as const,
      humanApprovalRequiredForRetry: false
    };
  if (outcome === 'TRANSIENT_FAILURE')
    return {
      recovery,
      deadLetterState: 'HELD_FOR_HUMAN_REVIEW' as const,
      replayRule: 'HUMAN_APPROVAL_SAME_IDENTITY_ONLY' as const,
      humanApprovalRequiredForRetry: true
    };
  if (outcome === 'AMBIGUOUS_EXTERNAL_OUTCOME')
    return {
      recovery,
      deadLetterState: 'HELD_FOR_HUMAN_REVIEW' as const,
      replayRule: 'VERIFY_EXTERNAL_OUTCOME_BEFORE_REPLAY' as const,
      humanApprovalRequiredForRetry: true
    };
  return {
    recovery,
    deadLetterState: 'TERMINAL' as const,
    replayRule: 'REPLAY_FORBIDDEN' as const,
    humanApprovalRequiredForRetry: false
  };
}
