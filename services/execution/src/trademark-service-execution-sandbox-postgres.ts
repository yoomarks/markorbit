import { createHash } from 'node:crypto';
import type {
  TrademarkServiceExecutionEnvironmentPolicy,
  TrademarkServiceProtectedActionEnvironmentBinding,
  TrademarkServiceProtectedActionReplayContext
} from '@markorbit/contracts/trademark-service-execution-sandbox';
import type { TrademarkServiceProtectedActionRelease } from '@markorbit/contracts/trademark-service-execution';
import type { QueryClient } from '@markorbit/persistence';
import type { TrademarkServiceExecutionTransactionHost } from './trademark-service-execution-postgres.js';
import { TrademarkServiceExecutionError } from './trademark-service-execution.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type Row = Record<string, unknown>;

const replayIdentity = (
  binding: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>
): TrademarkServiceProtectedActionReplayContext => ({
  environmentPolicyId: binding.environmentPolicyId,
  environment: binding.environment,
  mode: binding.mode,
  connectorClass: binding.connectorClass,
  endpointClass: binding.endpointClass,
  credentialClass: binding.credentialClass
});

const sandboxFingerprint = (
  release: Readonly<TrademarkServiceProtectedActionRelease>,
  binding: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>
) =>
  hash({
    workspaceId: release.workspaceId,
    authorizationId: release.executionAuthorizationId,
    planId: release.executionPlanId,
    stepId: release.stepId,
    action: release.action,
    evidenceReferences: release.evidenceReferences,
    workPackage: release.workPackage,
    replayIdentity: replayIdentity(binding)
  });

export class PostgresTrademarkServiceSandboxPolicyRepository {
  constructor(
    private readonly database: TrademarkServiceExecutionTransactionHost,
    private readonly query: QueryClient
  ) {}

  async saveEnvironmentPolicy(policy: Readonly<TrademarkServiceExecutionEnvironmentPolicy>) {
    return this.database.transact(async (client) => {
      const session = await client.query(
        `SELECT environment_policy_record,
                environment_policy_record = $3::jsonb AS same_record
           FROM execution_trademark_service_sessions
          WHERE workspace_id=$1 AND execution_authorization_id=$2
          FOR UPDATE`,
        [policy.workspaceId, policy.executionAuthorizationId, JSON.stringify(policy)]
      );
      if (!session.rowCount)
        throw new TrademarkServiceExecutionError(
          'READINESS_REQUIRED',
          'Execution authorization must be durable before environment policy can be recorded.',
          404
        );
      const row = session.rows[0] as Row;
      if (row.environment_policy_record) {
        if (row.same_record !== true)
          throw new TrademarkServiceExecutionError(
            'IDEMPOTENCY_CONFLICT',
            'Execution environment policy is immutable after creation.'
          );
        return policy;
      }

      await client.query(
        `UPDATE execution_trademark_service_sessions
            SET environment_policy_id=$3,
                execution_environment=$4,
                execution_mode=$5,
                sandbox_connector_class=$6,
                sandbox_endpoint_class=$7,
                sandbox_credential_class=$8,
                environment_policy_record=$9::jsonb,
                updated_at=clock_timestamp()
          WHERE workspace_id=$1 AND execution_authorization_id=$2`,
        [
          policy.workspaceId,
          policy.executionAuthorizationId,
          policy.environmentPolicyId,
          policy.environment,
          policy.mode,
          policy.connectorClass,
          policy.endpointClass,
          policy.credentialClass,
          JSON.stringify(policy)
        ]
      );
      return policy;
    });
  }

  async saveProtectedActionRelease(
    release: Readonly<TrademarkServiceProtectedActionRelease>,
    binding: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>
  ) {
    if (release.protectedActionReleaseId !== binding.protectedActionReleaseId)
      throw new TrademarkServiceExecutionError(
        'AUTHORITY_BOUNDARY_VIOLATION',
        'Protected action release and environment binding IDs do not match.'
      );
    if (release.requestFingerprintSha256 !== sandboxFingerprint(release, binding))
      throw new TrademarkServiceExecutionError(
        'AUTHORITY_BOUNDARY_VIOLATION',
        'Protected action fingerprint does not include the required environment replay identity.'
      );

    return this.database.transact(async (client) => {
      const session = await client.query(
        `SELECT work_package_id,work_package_version,environment_policy_id,execution_environment,
                execution_mode,sandbox_connector_class,sandbox_endpoint_class,sandbox_credential_class
           FROM execution_trademark_service_sessions
          WHERE workspace_id=$1 AND execution_authorization_id=$2
          FOR UPDATE`,
        [release.workspaceId, release.executionAuthorizationId]
      );
      if (!session.rowCount)
        throw new TrademarkServiceExecutionError(
          'READINESS_REQUIRED',
          'Execution authorization was not found for sandbox protected action.',
          404
        );
      const owner = session.rows[0] as Row;
      if (
        String(owner.work_package_id) !== release.workPackage.id ||
        Number(owner.work_package_version) !== release.workPackage.version
      )
        throw new TrademarkServiceExecutionError(
          'READINESS_REQUIRED',
          'Protected action release does not match the frozen Work Package version.'
        );
      if (
        String(owner.environment_policy_id) !== binding.environmentPolicyId ||
        String(owner.execution_environment) !== binding.environment ||
        String(owner.execution_mode) !== binding.mode ||
        String(owner.sandbox_connector_class) !== binding.connectorClass ||
        String(owner.sandbox_endpoint_class) !== binding.endpointClass ||
        String(owner.sandbox_credential_class) !== binding.credentialClass
      )
        throw new TrademarkServiceExecutionError(
          'AUTHORITY_BOUNDARY_VIOLATION',
          'Protected action binding does not match the durable execution environment policy.'
        );

      const existing = await client.query(
        `SELECT request_fingerprint_sha256,release_record,
                environment_binding_record = $3::jsonb AS same_binding
           FROM execution_trademark_service_protected_action_replays
          WHERE workspace_id=$1 AND idempotency_key=$2
          FOR UPDATE`,
        [release.workspaceId, release.idempotencyKey, JSON.stringify(binding)]
      );
      if (existing.rowCount) {
        const row = existing.rows[0] as Row;
        if (
          String(row.request_fingerprint_sha256) !== release.requestFingerprintSha256 ||
          row.same_binding !== true
        )
          throw new TrademarkServiceExecutionError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used in a different environment, mode, or protected action.'
          );
        return {
          release: row.release_record as TrademarkServiceProtectedActionRelease,
          binding
        };
      }

      await client.query(
        `INSERT INTO execution_trademark_service_protected_action_replays
          (workspace_id,idempotency_key,request_fingerprint_sha256,execution_authorization_id,
           protected_action_release_id,release_record,created_at,environment_policy_id,
           execution_environment,execution_mode,sandbox_connector_class,sandbox_endpoint_class,
           sandbox_credential_class,environment_binding_record)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
        [
          release.workspaceId,
          release.idempotencyKey,
          release.requestFingerprintSha256,
          release.executionAuthorizationId,
          release.protectedActionReleaseId,
          JSON.stringify(release),
          release.releasedAt,
          binding.environmentPolicyId,
          binding.environment,
          binding.mode,
          binding.connectorClass,
          binding.endpointClass,
          binding.credentialClass,
          JSON.stringify(binding)
        ]
      );
      return { release, binding };
    });
  }

  async getEnvironmentPolicy(
    workspaceId: string,
    authorizationId: string
  ): Promise<TrademarkServiceExecutionEnvironmentPolicy | undefined> {
    const result = await this.query.query(
      `SELECT environment_policy_record
         FROM execution_trademark_service_sessions
        WHERE workspace_id=$1 AND execution_authorization_id=$2`,
      [workspaceId, authorizationId]
    );
    const record = (result.rows[0] as Row | undefined)?.environment_policy_record;
    return record ? (record as TrademarkServiceExecutionEnvironmentPolicy) : undefined;
  }

  async getEnvironmentBindings(
    workspaceId: string,
    authorizationId: string
  ): Promise<TrademarkServiceProtectedActionEnvironmentBinding[]> {
    const result = await this.query.query(
      `SELECT environment_binding_record
         FROM execution_trademark_service_protected_action_replays
        WHERE workspace_id=$1 AND execution_authorization_id=$2
          AND environment_binding_record IS NOT NULL
        ORDER BY created_at,protected_action_release_id`,
      [workspaceId, authorizationId]
    );
    return result.rows.map(
      (row) =>
        (row as Row).environment_binding_record as TrademarkServiceProtectedActionEnvironmentBinding
    );
  }
}
