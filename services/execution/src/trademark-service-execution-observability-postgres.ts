import { createHash } from 'node:crypto';
import type {
  TrademarkServiceExecutionCorrelationId,
  TrademarkServiceRecoveryDrillOutcome,
  TrademarkServiceRecoveryDrillRecord
} from '@markorbit/contracts/trademark-service-execution-observability';
import type { TrademarkServiceProtectedActionRelease } from '@markorbit/contracts/trademark-service-execution';
import type {
  TrademarkServiceProtectedActionEnvironmentBinding,
  TrademarkServiceProtectedActionReplayContext
} from '@markorbit/contracts/trademark-service-execution-sandbox';
import type { QueryClient } from '@markorbit/persistence';
import type { TrademarkServiceExecutionTransactionHost } from './trademark-service-execution-postgres.js';
import { TrademarkServiceExecutionError } from './trademark-service-execution.js';
import {
  classifyTrademarkServiceRecoveryDrill,
  createTrademarkServiceExecutionCorrelationId
} from './trademark-service-execution-observability.js';

type Row = Record<string, unknown>;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sha256Pattern = /^[0-9a-f]{64}$/;

const replayContext = (
  binding: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>
): TrademarkServiceProtectedActionReplayContext => ({
  environmentPolicyId: binding.environmentPolicyId,
  environment: binding.environment,
  mode: binding.mode,
  connectorClass: binding.connectorClass,
  endpointClass: binding.endpointClass,
  credentialClass: binding.credentialClass
});

const sameBinding = (
  left: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>,
  right: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>
) =>
  left.protectedActionReleaseId === right.protectedActionReleaseId &&
  left.environmentPolicyId === right.environmentPolicyId &&
  left.environment === right.environment &&
  left.mode === right.mode &&
  left.connectorClass === right.connectorClass &&
  left.endpointClass === right.endpointClass &&
  left.credentialClass === right.credentialClass;

export interface RecordTrademarkServiceRecoveryDrillCommand {
  workspaceId: string;
  executionAuthorizationId: string;
  release: Readonly<TrademarkServiceProtectedActionRelease>;
  binding: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>;
  correlationId: TrademarkServiceExecutionCorrelationId;
  idempotencyKey: string;
  outcome: TrademarkServiceRecoveryDrillOutcome;
  reasonCode: string;
  recordedAt: string;
}

export class PostgresTrademarkServiceRecoveryDrillRepository {
  constructor(
    private readonly database: TrademarkServiceExecutionTransactionHost,
    private readonly query: QueryClient
  ) {}

  async record(
    command: Readonly<RecordTrademarkServiceRecoveryDrillCommand>
  ): Promise<TrademarkServiceRecoveryDrillRecord> {
    const idempotencyKey = command.idempotencyKey.trim();
    if (!idempotencyKey)
      throw new TrademarkServiceExecutionError(
        'IDEMPOTENCY_CONFLICT',
        'Recovery drill idempotency key is required.'
      );
    if (
      command.release.workspaceId.toLowerCase() !== command.workspaceId.toLowerCase() ||
      command.release.executionAuthorizationId !== command.executionAuthorizationId
    )
      throw new TrademarkServiceExecutionError(
        'WORKSPACE_MISMATCH',
        'Recovery drill release does not belong to the requested Execution session.',
        404
      );
    const expectedCorrelationId = createTrademarkServiceExecutionCorrelationId(
      command.release,
      command.binding
    );
    if (command.correlationId !== expectedCorrelationId)
      throw new TrademarkServiceExecutionError(
        'AUTHORITY_BOUNDARY_VIOLATION',
        'Recovery drill correlation ID does not match the durable protected-action identity.'
      );
    const recordedAt = new Date(command.recordedAt);
    if (Number.isNaN(recordedAt.valueOf()))
      throw new TrademarkServiceExecutionError(
        'AUTHORITY_BOUNDARY_VIOLATION',
        'Recovery drill requires a valid recordedAt timestamp.'
      );
    const reasonCode = command.reasonCode.trim();
    if (!reasonCode)
      throw new TrademarkServiceExecutionError(
        'AUTHORITY_BOUNDARY_VIOLATION',
        'Recovery drill reasonCode is required.'
      );
    const requestFingerprintSha256 = hash({
      workspaceId: command.workspaceId.toLowerCase(),
      executionAuthorizationId: command.executionAuthorizationId,
      protectedActionReleaseId: command.release.protectedActionReleaseId,
      requestFingerprintSha256: command.release.requestFingerprintSha256,
      replayContext: replayContext(command.binding),
      correlationId: command.correlationId,
      idempotencyKey,
      outcome: command.outcome,
      reasonCode
    });

    return this.database.transact(async (client) => {
      const session = await client.query(
        `SELECT environment_policy_id,execution_environment,execution_mode,sandbox_connector_class,
                sandbox_endpoint_class,sandbox_credential_class
           FROM execution_trademark_service_sessions
          WHERE workspace_id=$1 AND execution_authorization_id=$2
          FOR UPDATE`,
        [command.workspaceId, command.executionAuthorizationId]
      );
      if (!session.rowCount)
        throw new TrademarkServiceExecutionError(
          'OWNER_MISMATCH',
          'Recovery drill requires a durable Execution session.',
          404
        );
      const owner = session.rows[0] as Row;
      if (
        String(owner.environment_policy_id) !== command.binding.environmentPolicyId ||
        String(owner.execution_environment) !== command.binding.environment ||
        String(owner.execution_mode) !== command.binding.mode ||
        String(owner.sandbox_connector_class) !== command.binding.connectorClass ||
        String(owner.sandbox_endpoint_class) !== command.binding.endpointClass ||
        String(owner.sandbox_credential_class) !== command.binding.credentialClass
      )
        throw new TrademarkServiceExecutionError(
          'AUTHORITY_BOUNDARY_VIOLATION',
          'Recovery drill replay identity does not match the durable environment policy.'
        );

      const protectedAction = await client.query(
        `SELECT environment_binding_record
           FROM execution_trademark_service_protected_action_replays
          WHERE workspace_id=$1 AND execution_authorization_id=$2 AND protected_action_release_id=$3
          FOR UPDATE`,
        [
          command.workspaceId,
          command.executionAuthorizationId,
          command.release.protectedActionReleaseId
        ]
      );
      const durableBinding = (protectedAction.rows[0] as Row | undefined)?.environment_binding_record as
        | TrademarkServiceProtectedActionEnvironmentBinding
        | undefined;
      if (!durableBinding || !sameBinding(durableBinding, command.binding))
        throw new TrademarkServiceExecutionError(
          'AUTHORITY_BOUNDARY_VIOLATION',
          'Recovery drill requires the exact durable protected-action environment binding.'
        );

      const existing = await client.query(
        `SELECT artifact_record
           FROM execution_trademark_service_artifacts
          WHERE workspace_id=$1 AND artifact_kind='RECOVERY'
            AND artifact_record->>'recordType'='SANDBOX_RECOVERY_DRILL'
            AND artifact_record->>'idempotencyKey'=$2
          FOR UPDATE`,
        [command.workspaceId, idempotencyKey]
      );
      if (existing.rowCount) {
        const record = (existing.rows[0] as Row).artifact_record as TrademarkServiceRecoveryDrillRecord;
        if (record.requestFingerprintSha256 !== requestFingerprintSha256)
          throw new TrademarkServiceExecutionError(
            'IDEMPOTENCY_CONFLICT',
            'Recovery drill idempotency key was already used for a different observation.'
          );
        return record;
      }

      const prior = await client.query(
        `SELECT artifact_record
           FROM execution_trademark_service_artifacts
          WHERE workspace_id=$1 AND execution_authorization_id=$2 AND artifact_kind='RECOVERY'
            AND artifact_record->>'recordType'='SANDBOX_RECOVERY_DRILL'
            AND artifact_record->>'correlationId'=$3
          ORDER BY ((artifact_record->>'auditSequence')::integer) DESC
          LIMIT 1`,
        [command.workspaceId, command.executionAuthorizationId, command.correlationId]
      );
      const previous = (prior.rows[0] as Row | undefined)?.artifact_record as
        | TrademarkServiceRecoveryDrillRecord
        | undefined;
      if (previous && !sha256Pattern.test(previous.auditFingerprintSha256))
        throw new TrademarkServiceExecutionError(
          'AUTHORITY_BOUNDARY_VIOLATION',
          'Recovery audit chain contains an invalid prior fingerprint.'
        );
      const auditSequence = (previous?.auditSequence ?? 0) + 1;
      const classification = classifyTrademarkServiceRecoveryDrill(
        command.outcome,
        reasonCode
      );
      const recoveryDrillId = `trademark-service-recovery-drill_${hash({
        correlationId: command.correlationId,
        idempotencyKey,
        requestFingerprintSha256
      }).slice(0, 32)}` as const;
      const auditFingerprintSha256 = hash({
        recoveryDrillId,
        auditSequence,
        previousRecoveryDrillId: previous?.recoveryDrillId,
        previousAuditFingerprintSha256: previous?.auditFingerprintSha256,
        requestFingerprintSha256,
        recovery: classification.recovery,
        deadLetterState: classification.deadLetterState,
        replayRule: classification.replayRule
      });
      const record: TrademarkServiceRecoveryDrillRecord = {
        schemaVersion: 1,
        recordType: 'SANDBOX_RECOVERY_DRILL',
        recoveryDrillId,
        workspaceId: command.workspaceId,
        executionAuthorizationId: command.release.executionAuthorizationId,
        protectedActionReleaseId: command.release.protectedActionReleaseId,
        environmentPolicyId: command.binding.environmentPolicyId,
        replayContext: replayContext(command.binding),
        correlationId: command.correlationId,
        idempotencyKey,
        requestFingerprintSha256,
        outcome: command.outcome,
        recovery: classification.recovery,
        deadLetterState: classification.deadLetterState,
        replayRule: classification.replayRule,
        auditSequence,
        ...(previous ? { previousRecoveryDrillId: previous.recoveryDrillId } : {}),
        ...(previous
          ? { previousAuditFingerprintSha256: previous.auditFingerprintSha256 }
          : {}),
        auditFingerprintSha256,
        reasonCode,
        recordedAt: recordedAt.toISOString(),
        humanApprovalRequiredForRetry: classification.humanApprovalRequiredForRetry,
        sameEnvironmentReplayRequired: true,
        sameModeReplayRequired: true,
        duplicateProtectedActionPrevented: true,
        automaticExternalRetryPerformed: false,
        liveExternalActionAuthorized: false,
        officialTruthCreated: false
      };

      await client.query(
        `INSERT INTO execution_trademark_service_artifacts
          (workspace_id,artifact_id,execution_authorization_id,artifact_kind,artifact_record,
           official_truth_created,created_at)
         VALUES ($1,$2,$3,'RECOVERY',$4::jsonb,false,$5)`,
        [
          command.workspaceId,
          record.recoveryDrillId,
          command.executionAuthorizationId,
          JSON.stringify(record),
          record.recordedAt
        ]
      );
      await client.query(
        `UPDATE execution_trademark_service_sessions
            SET recovery_record=$3::jsonb,updated_at=clock_timestamp()
          WHERE workspace_id=$1 AND execution_authorization_id=$2`,
        [command.workspaceId, command.executionAuthorizationId, JSON.stringify(record.recovery)]
      );
      return record;
    });
  }

  async getCorrelationTrail(
    workspaceId: string,
    executionAuthorizationId: string,
    correlationId: TrademarkServiceExecutionCorrelationId
  ): Promise<TrademarkServiceRecoveryDrillRecord[]> {
    const result = await this.query.query(
      `SELECT artifact_record
         FROM execution_trademark_service_artifacts
        WHERE workspace_id=$1 AND execution_authorization_id=$2 AND artifact_kind='RECOVERY'
          AND artifact_record->>'recordType'='SANDBOX_RECOVERY_DRILL'
          AND artifact_record->>'correlationId'=$3
        ORDER BY ((artifact_record->>'auditSequence')::integer),artifact_id`,
      [workspaceId, executionAuthorizationId, correlationId]
    );
    return result.rows.map(
      (row) => (row as Row).artifact_record as TrademarkServiceRecoveryDrillRecord
    );
  }

  async getPendingHumanReview(
    workspaceId: string,
    executionAuthorizationId: string
  ): Promise<TrademarkServiceRecoveryDrillRecord[]> {
    const result = await this.query.query(
      `SELECT artifact_record
         FROM execution_trademark_service_artifacts
        WHERE workspace_id=$1 AND execution_authorization_id=$2 AND artifact_kind='RECOVERY'
          AND artifact_record->>'recordType'='SANDBOX_RECOVERY_DRILL'
          AND artifact_record->>'deadLetterState'='HELD_FOR_HUMAN_REVIEW'
        ORDER BY created_at,artifact_id`,
      [workspaceId, executionAuthorizationId]
    );
    return result.rows.map(
      (row) => (row as Row).artifact_record as TrademarkServiceRecoveryDrillRecord
    );
  }
}
