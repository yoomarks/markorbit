import { createHash } from 'node:crypto';
import type {
  TrademarkServiceExecutionAuthorization,
  TrademarkServiceExecutionEvidence,
  TrademarkServiceExecutionPlan,
  TrademarkServiceLifecycleHandoffRequest,
  TrademarkServiceProtectedActionRelease,
  TrademarkServiceProviderHandoffRequest,
  TrademarkServiceRecoveryState
} from '@markorbit/contracts/trademark-service-execution';
import type { QueryClient } from '@markorbit/persistence';
import { TrademarkServiceExecutionError } from './trademark-service-execution.js';

type Row = Record<string, unknown>;
const recoveryId = (authorizationId: string, recovery: TrademarkServiceRecoveryState) =>
  `recovery_${createHash('sha256')
    .update(JSON.stringify({ authorizationId, recovery }))
    .digest('hex')
    .slice(0, 32)}`;

export interface TrademarkServiceExecutionSessionSnapshot {
  authorization: TrademarkServiceExecutionAuthorization;
  plan?: TrademarkServiceExecutionPlan;
  recovery?: TrademarkServiceRecoveryState;
  releases: TrademarkServiceProtectedActionRelease[];
  providerHandoffs: TrademarkServiceProviderHandoffRequest[];
  lifecycleHandoffs: TrademarkServiceLifecycleHandoffRequest[];
  evidence: TrademarkServiceExecutionEvidence[];
}

export interface TrademarkServiceExecutionTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

export class PostgresTrademarkServiceExecutionRepository {
  constructor(
    private readonly database: TrademarkServiceExecutionTransactionHost,
    private readonly query: QueryClient
  ) {}

  async createAuthorization(authorization: TrademarkServiceExecutionAuthorization) {
    try {
      return await this.database.transact(async (client) => {
        const existing = await client.query(
          `SELECT authorization_record = $3::jsonb AS same_record
             FROM execution_trademark_service_sessions
            WHERE workspace_id=$1 AND execution_authorization_id=$2
            FOR UPDATE`,
          [
            authorization.workspaceId,
            authorization.executionAuthorizationId,
            JSON.stringify(authorization)
          ]
        );
        if (existing.rowCount) {
          if ((existing.rows[0] as Row).same_record !== true) {
            throw this.idempotencyConflict(
              'Execution authorization ID was already used for different authorization content.'
            );
          }
          return authorization;
        }
        await client.query(
          `INSERT INTO execution_trademark_service_sessions
            (workspace_id,execution_authorization_id,work_package_id,work_package_version,
             execution_readiness_id,authorization_record,created_by_user_id,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$8)`,
          [
            authorization.workspaceId,
            authorization.executionAuthorizationId,
            authorization.workPackage.id,
            authorization.workPackage.version,
            authorization.executionReadinessId,
            JSON.stringify(authorization),
            authorization.authorizedByUserId,
            authorization.authorizedAt
          ]
        );
        return authorization;
      });
    } catch (cause) {
      if (cause instanceof TrademarkServiceExecutionError) throw cause;
      throw this.unavailable(cause);
    }
  }

  async savePlan(workspaceId: string, plan: TrademarkServiceExecutionPlan) {
    this.ensureWorkspace(workspaceId, plan.workspaceId);
    return this.database.transact(async (client) => {
      const existing = await client.query(
        `SELECT plan_record, plan_record = $3::jsonb AS same_record
           FROM execution_trademark_service_sessions
          WHERE workspace_id=$1 AND execution_authorization_id=$2
          FOR UPDATE`,
        [workspaceId, plan.authorizationId, JSON.stringify(plan)]
      );
      if (!existing.rowCount) throw this.notFound();
      const row = existing.rows[0] as Row;
      if (row.plan_record) {
        if (row.same_record !== true) {
          throw this.idempotencyConflict(
            'Execution plan is immutable after creation; conflicting replacement was rejected.'
          );
        }
        return plan;
      }
      await client.query(
        `UPDATE execution_trademark_service_sessions
            SET plan_record=$3::jsonb,updated_at=clock_timestamp()
          WHERE workspace_id=$1 AND execution_authorization_id=$2`,
        [workspaceId, plan.authorizationId, JSON.stringify(plan)]
      );
      return plan;
    });
  }

  async saveProtectedActionRelease(release: TrademarkServiceProtectedActionRelease) {
    return this.database.transact(async (client) => {
      const existing = await client.query(
        `SELECT request_fingerprint_sha256,release_record FROM execution_trademark_service_protected_action_replays
          WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE`,
        [release.workspaceId, release.idempotencyKey]
      );
      if (existing.rowCount) {
        const row = existing.rows[0] as Row;
        if (String(row.request_fingerprint_sha256) !== release.requestFingerprintSha256)
          throw this.idempotencyConflict(
            'Idempotency key was already used for a different protected action.'
          );
        return row.release_record as TrademarkServiceProtectedActionRelease;
      }
      const owner = await client.query(
        `SELECT work_package_id,work_package_version FROM execution_trademark_service_sessions
          WHERE workspace_id=$1 AND execution_authorization_id=$2 FOR UPDATE`,
        [release.workspaceId, release.executionAuthorizationId]
      );
      if (!owner.rowCount) throw this.notFound();
      const row = owner.rows[0] as Row;
      if (
        String(row.work_package_id) !== release.workPackage.id ||
        Number(row.work_package_version) !== release.workPackage.version
      )
        throw new TrademarkServiceExecutionError(
          'READINESS_REQUIRED',
          'Protected action release does not match the frozen Work Package version.'
        );
      await client.query(
        `INSERT INTO execution_trademark_service_protected_action_replays
          (workspace_id,idempotency_key,request_fingerprint_sha256,execution_authorization_id,
           protected_action_release_id,release_record,created_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [
          release.workspaceId,
          release.idempotencyKey,
          release.requestFingerprintSha256,
          release.executionAuthorizationId,
          release.protectedActionReleaseId,
          JSON.stringify(release),
          release.releasedAt
        ]
      );
      return release;
    });
  }

  async appendProviderHandoff(
    authorizationId: string,
    handoff: TrademarkServiceProviderHandoffRequest
  ) {
    return this.appendArtifact(
      handoff.workspaceId,
      authorizationId,
      handoff.providerHandoffId,
      'PROVIDER_HANDOFF',
      handoff
    );
  }

  async appendLifecycleHandoff(
    authorizationId: string,
    handoff: TrademarkServiceLifecycleHandoffRequest
  ) {
    return this.appendArtifact(
      handoff.workspaceId,
      authorizationId,
      handoff.lifecycleHandoffId,
      'LIFECYCLE_HANDOFF',
      handoff
    );
  }

  async appendEvidence(authorizationId: string, evidence: TrademarkServiceExecutionEvidence) {
    return this.appendArtifact(
      evidence.workspaceId,
      authorizationId,
      evidence.executionEvidenceId,
      'EVIDENCE',
      evidence
    );
  }

  async saveRecovery(
    workspaceId: string,
    authorizationId: string,
    recovery: TrademarkServiceRecoveryState
  ) {
    const result = await this.query.query(
      `UPDATE execution_trademark_service_sessions SET recovery_record=$3::jsonb,updated_at=clock_timestamp()
        WHERE workspace_id=$1 AND execution_authorization_id=$2`,
      [workspaceId, authorizationId, JSON.stringify(recovery)]
    );
    if (!result.rowCount) throw this.notFound();
    await this.appendArtifact(
      workspaceId,
      authorizationId,
      recoveryId(authorizationId, recovery),
      'RECOVERY',
      recovery
    );
    return recovery;
  }

  async getSnapshot(
    workspaceId: string,
    authorizationId: string
  ): Promise<TrademarkServiceExecutionSessionSnapshot | undefined> {
    const session = await this.query.query(
      `SELECT authorization_record,plan_record,recovery_record FROM execution_trademark_service_sessions
        WHERE workspace_id=$1 AND execution_authorization_id=$2`,
      [workspaceId, authorizationId]
    );
    if (!session.rowCount) return undefined;
    const row = session.rows[0] as Row;
    const replays = await this.query.query(
      `SELECT release_record FROM execution_trademark_service_protected_action_replays
        WHERE workspace_id=$1 AND execution_authorization_id=$2 ORDER BY created_at`,
      [workspaceId, authorizationId]
    );
    const artifacts = await this.query.query(
      `SELECT artifact_kind,artifact_record FROM execution_trademark_service_artifacts
        WHERE workspace_id=$1 AND execution_authorization_id=$2 ORDER BY created_at,artifact_id`,
      [workspaceId, authorizationId]
    );
    const byKind = (kind: string) =>
      artifacts.rows
        .filter((item) => String((item as Row).artifact_kind) === kind)
        .map((item) => (item as Row).artifact_record);
    return {
      authorization: row.authorization_record as TrademarkServiceExecutionAuthorization,
      ...(row.plan_record ? { plan: row.plan_record as TrademarkServiceExecutionPlan } : {}),
      ...(row.recovery_record
        ? { recovery: row.recovery_record as TrademarkServiceRecoveryState }
        : {}),
      releases: replays.rows.map(
        (item) => (item as Row).release_record as TrademarkServiceProtectedActionRelease
      ),
      providerHandoffs: byKind('PROVIDER_HANDOFF') as TrademarkServiceProviderHandoffRequest[],
      lifecycleHandoffs: byKind('LIFECYCLE_HANDOFF') as TrademarkServiceLifecycleHandoffRequest[],
      evidence: byKind('EVIDENCE') as TrademarkServiceExecutionEvidence[]
    };
  }

  private async appendArtifact(
    workspaceId: string,
    authorizationId: string,
    artifactId: string,
    kind: 'PROVIDER_HANDOFF' | 'LIFECYCLE_HANDOFF' | 'EVIDENCE' | 'RECOVERY',
    record: unknown
  ) {
    return this.database.transact(async (client) => {
      const existing = await client.query(
        `SELECT execution_authorization_id,artifact_kind,artifact_record = $3::jsonb AS same_record,
                official_truth_created
           FROM execution_trademark_service_artifacts
          WHERE workspace_id=$1 AND artifact_id=$2
          FOR UPDATE`,
        [workspaceId, artifactId, JSON.stringify(record)]
      );
      if (existing.rowCount) {
        const row = existing.rows[0] as Row;
        if (
          String(row.execution_authorization_id) !== authorizationId ||
          String(row.artifact_kind) !== kind ||
          row.same_record !== true ||
          row.official_truth_created !== false
        ) {
          throw this.idempotencyConflict(
            'Execution artifact ID was already used for different artifact content or authority.'
          );
        }
        return record;
      }
      const owner = await client.query(
        `SELECT 1 FROM execution_trademark_service_sessions
          WHERE workspace_id=$1 AND execution_authorization_id=$2 FOR UPDATE`,
        [workspaceId, authorizationId]
      );
      if (!owner.rowCount) throw this.notFound();
      await client.query(
        `INSERT INTO execution_trademark_service_artifacts
          (workspace_id,artifact_id,execution_authorization_id,artifact_kind,artifact_record,official_truth_created,created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,false,clock_timestamp())`,
        [workspaceId, artifactId, authorizationId, kind, JSON.stringify(record)]
      );
      return record;
    });
  }

  private ensureWorkspace(expected: string, actual: string) {
    if (expected.toLowerCase() !== actual.toLowerCase())
      throw new TrademarkServiceExecutionError(
        'WORKSPACE_MISMATCH',
        'Execution record belongs to another Workspace.',
        404
      );
  }

  private idempotencyConflict(message: string) {
    return new TrademarkServiceExecutionError('IDEMPOTENCY_CONFLICT', message);
  }

  private notFound() {
    return new TrademarkServiceExecutionError(
      'OWNER_MISMATCH',
      'Execution authorization was not found in this Workspace.',
      404
    );
  }

  private unavailable(cause: unknown) {
    return new TrademarkServiceExecutionError(
      'OWNER_MISMATCH',
      `Execution persistence is unavailable: ${cause instanceof Error ? cause.message : 'unknown error'}`,
      503
    );
  }
}
