import type {
  TrademarkServiceExecutionAuthorizationId,
  TrademarkServiceProtectedActionReleaseId,
  TrademarkServiceRecoveryState
} from './trademark-service-execution.js';
import type {
  TrademarkServiceExecutionEnvironmentPolicyId,
  TrademarkServiceProtectedActionReplayContext
} from './trademark-service-execution-sandbox.js';

export type TrademarkServiceExecutionCorrelationId =
  `trademark-service-execution-correlation_${string}`;
export type TrademarkServiceRecoveryDrillId = `trademark-service-recovery-drill_${string}`;

export const trademarkServiceRecoveryDrillOutcomes = [
  'SUCCESS',
  'TRANSIENT_FAILURE',
  'AMBIGUOUS_EXTERNAL_OUTCOME',
  'PERMANENT_FAILURE'
] as const;
export type TrademarkServiceRecoveryDrillOutcome =
  (typeof trademarkServiceRecoveryDrillOutcomes)[number];

export type TrademarkServiceDeadLetterState = 'NOT_REQUIRED' | 'HELD_FOR_HUMAN_REVIEW' | 'TERMINAL';
export type TrademarkServiceReplayRule =
  | 'NO_REPLAY_REQUIRED'
  | 'HUMAN_APPROVAL_SAME_IDENTITY_ONLY'
  | 'VERIFY_EXTERNAL_OUTCOME_BEFORE_REPLAY'
  | 'REPLAY_FORBIDDEN';

export interface TrademarkServiceRecoveryDrillRecord {
  schemaVersion: 1;
  recordType: 'SANDBOX_RECOVERY_DRILL';
  recoveryDrillId: TrademarkServiceRecoveryDrillId;
  workspaceId: string;
  executionAuthorizationId: TrademarkServiceExecutionAuthorizationId;
  protectedActionReleaseId: TrademarkServiceProtectedActionReleaseId;
  environmentPolicyId: TrademarkServiceExecutionEnvironmentPolicyId;
  replayContext: Readonly<TrademarkServiceProtectedActionReplayContext>;
  correlationId: TrademarkServiceExecutionCorrelationId;
  idempotencyKey: string;
  requestFingerprintSha256: string;
  outcome: TrademarkServiceRecoveryDrillOutcome;
  recovery: Readonly<TrademarkServiceRecoveryState>;
  deadLetterState: TrademarkServiceDeadLetterState;
  replayRule: TrademarkServiceReplayRule;
  auditSequence: number;
  previousRecoveryDrillId?: TrademarkServiceRecoveryDrillId;
  previousAuditFingerprintSha256?: string;
  auditFingerprintSha256: string;
  reasonCode: string;
  recordedAt: string;
  humanApprovalRequiredForRetry: boolean;
  sameEnvironmentReplayRequired: true;
  sameModeReplayRequired: true;
  duplicateProtectedActionPrevented: true;
  automaticExternalRetryPerformed: false;
  liveExternalActionAuthorized: false;
  officialTruthCreated: false;
}

export const trademarkServiceExecutionObservabilityAuthority = Object.freeze({
  mayRecordSandboxCorrelation: true,
  mayRecordDurableRecoveryAudit: true,
  mayClassifyBoundedManualReplay: true,
  mayDeadLetterForHumanReview: true,
  mayAutomaticallyRetryExternalConsequence: false,
  mayReplayAcrossEnvironment: false,
  mayReplayAcrossMode: false,
  mayPerformLiveExternalAction: false,
  mayCreateOfficialTruth: false
});
