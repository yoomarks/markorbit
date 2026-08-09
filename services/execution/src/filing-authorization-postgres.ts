import type {
  ExecutionRelease,
  ExecutionReleaseId,
  FilingAuthorization,
  FilingAuthorizationId,
  FilingExecutionTaskDraft,
  FilingExecutionTaskDraftId,
  PreparationLockId
} from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import {
  FilingGovernanceError,
  type ExecutionReleaseRepository,
  type FilingAuthorizationRepository,
  type FilingExecutionTaskDraftRepository,
  type FilingGovernanceAuditRepository,
  type FilingGovernanceDenial
} from './filing-authorization.js';

type Row = Record<string, unknown>;
type GovernanceId = FilingAuthorizationId | ExecutionReleaseId | FilingExecutionTaskDraftId;
type CommandEntry = { fingerprint: string; id: FilingAuthorizationId | ExecutionReleaseId };

export interface FilingGovernanceTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

/** Execution-owned durable adapter. Every query is scoped by the authenticated Workspace. */
export class PostgresFilingGovernanceRepository
  implements
    FilingAuthorizationRepository,
    ExecutionReleaseRepository,
    FilingExecutionTaskDraftRepository,
    FilingGovernanceAuditRepository
{
  constructor(
    private readonly database: FilingGovernanceTransactionHost,
    private readonly query: QueryClient,
    private readonly workspaceId: string,
    private readonly actorId: string,
    private readonly correlationId?: string,
    private readonly now = () => new Date().toISOString()
  ) {}

  async create(value: FilingAuthorization, key: string, fingerprint: string): Promise<void>;
  async create(value: ExecutionRelease, key: string, fingerprint: string): Promise<void>;
  async create(
    value: FilingAuthorization | ExecutionRelease,
    key: string,
    fingerprint: string
  ): Promise<void> {
    if ('executionReleaseId' in value) return this.createRelease(value, key, fingerprint);
    return this.createAuthorization(value, key, fingerprint);
  }

  async findById(id: FilingAuthorizationId): Promise<FilingAuthorization | undefined>;
  async findById(id: ExecutionReleaseId): Promise<ExecutionRelease | undefined>;
  async findById(id: FilingExecutionTaskDraftId): Promise<FilingExecutionTaskDraft | undefined>;
  async findById(
    id: GovernanceId
  ): Promise<FilingAuthorization | ExecutionRelease | FilingExecutionTaskDraft | undefined> {
    if (id.startsWith('filing-authorization_')) return this.authorization(id as FilingAuthorizationId);
    if (id.startsWith('execution-release_')) return this.releaseRecord(id as ExecutionReleaseId);
    if (id.startsWith('filing-task-draft_')) return this.task(id as FilingExecutionTaskDraftId);
    return undefined;
  }

  async findActiveByPreparationLockVersion(id: PreparationLockId, version: string) {
    try {
      const result = await this.query.query(
        "SELECT authorization,version,status FROM filing_authorizations WHERE workspace_id=$1 AND preparation_lock_id=$2 AND preparation_lock_version=$3 AND status NOT IN ('WITHDRAWN','STALE','EXPIRED') LIMIT 1",
        [this.workspaceId, id, version]
      );
      return result.rowCount ? this.mapAuthorization(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findByIdempotencyKey(key: string): Promise<CommandEntry | undefined> {
    try {
      const result = await this.query.query(
        'SELECT request_fingerprint,target_id,target_type FROM filing_governance_commands WHERE workspace_id=$1 AND idempotency_key=$2',
        [this.workspaceId, key]
      );
      if (!result.rowCount) return undefined;
      const row = result.rows[0] as Row;
      return {
        fingerprint: String(row.request_fingerprint),
        id: String(row.target_id) as FilingAuthorizationId | ExecutionReleaseId
      };
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async confirm(value: FilingAuthorization, key: string, fingerprint: string): Promise<void> {
    try {
      await this.database.transact(async (client) => {
        if (await this.replay(client, key, fingerprint, value.filingAuthorizationId)) return;
        await this.updateAuthorization(client, value, 'AUTHORIZATION_CONFIRMED', fingerprint);
        await this.insertCommand(
          client,
          key,
          fingerprint,
          'FILING_AUTHORIZATION',
          value.filingAuthorizationId,
          'AUTHORIZATION_CONFIRM',
          value.version,
          value.updatedAt
        );
      });
    } catch (cause) {
      throw this.mapWriteError(cause, 'STALE_FILING_AUTHORIZATION');
    }
  }

  withdraw(value: FilingAuthorization | ExecutionRelease): Promise<void> {
    if ('executionReleaseId' in value)
      return this.saveRelease(value, 'EXECUTION_RELEASE_WITHDRAWN');
    return this.saveAuthorization(value, 'FILING_AUTHORIZATION_WITHDRAWN');
  }

  markStale(value: FilingAuthorization | ExecutionRelease | FilingExecutionTaskDraft): Promise<void> {
    if ('filingExecutionTaskDraftId' in value) return this.saveTask(value, 'FILING_TASK_MARKED_STALE');
    if ('executionReleaseId' in value) return this.saveRelease(value, 'EXECUTION_RELEASE_MARKED_STALE');
    return this.saveAuthorization(value, 'FILING_AUTHORIZATION_MARKED_STALE');
  }

  markExpired(value: FilingAuthorization): Promise<void> {
    return this.saveAuthorization(value, 'FILING_AUTHORIZATION_EXPIRED');
  }

  async list(): Promise<ExecutionRelease[]> {
    try {
      const result = await this.query.query(
        'SELECT release_record,version,status FROM execution_releases WHERE workspace_id=$1 ORDER BY updated_at DESC, execution_release_id',
        [this.workspaceId]
      );
      return result.rows.map((row) => this.mapRelease(row as Row));
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findActiveByAuthorizationVersion(id: FilingAuthorizationId, version: number) {
    try {
      const result = await this.query.query(
        "SELECT release_record,version,status FROM execution_releases WHERE workspace_id=$1 AND filing_authorization_id=$2 AND filing_authorization_version=$3 AND status NOT IN ('WITHDRAWN','STALE','RELEASED_FOR_EXECUTION') LIMIT 1",
        [this.workspaceId, id, version]
      );
      return result.rowCount ? this.mapRelease(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  evaluateChecks(value: ExecutionRelease): Promise<void> {
    return this.saveRelease(value, 'EXECUTION_RELEASE_CHECKS_EVALUATED');
  }

  updateAssignment(value: ExecutionRelease): Promise<void> {
    return this.saveRelease(value, 'EXECUTION_RELEASE_ASSIGNMENT_UPDATED');
  }

  async recordDecision(value: ExecutionRelease, key: string, fingerprint: string): Promise<void> {
    try {
      await this.database.transact(async (client) => {
        if (await this.replay(client, key, fingerprint, value.executionReleaseId)) return;
        await this.updateRelease(client, value, 'EXECUTION_RELEASED', fingerprint);
        await this.insertCommand(
          client,
          key,
          fingerprint,
          'EXECUTION_RELEASE',
          value.executionReleaseId,
          'RELEASE_DECISION',
          value.version,
          value.updatedAt
        );
      });
    } catch (cause) {
      throw this.mapWriteError(cause, 'STALE_EXECUTION_RELEASE');
    }
  }

  /** recordDecision already persists the released state atomically with command/audit evidence. */
  release(_value: ExecutionRelease): Promise<void> {
    return Promise.resolve();
  }

  async createFromReleasedExecution(value: FilingExecutionTaskDraft): Promise<void> {
    try {
      await this.database.transact(async (client) => {
        const result = await client.query(
          `INSERT INTO filing_execution_task_drafts
             (filing_execution_task_draft_id,workspace_id,execution_release_id,filing_authorization_id,status,task_record,created_by,updated_by,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7,$8,$8)
           ON CONFLICT (workspace_id,execution_release_id) DO NOTHING`,
          [
            value.filingExecutionTaskDraftId,
            this.workspaceId,
            value.executionReleaseId,
            value.filingAuthorizationId,
            value.status,
            JSON.stringify(value),
            this.actorId,
            value.createdAt
          ]
        );
        if (result.rowCount)
          await this.audit(
            client,
            'FILING_EXECUTION_TASK_DRAFT',
            value.filingExecutionTaskDraftId,
            'FILING_TASK_PREPARED',
            1,
            value.createdAt
          );
      });
    } catch (cause) {
      throw this.mapWriteError(cause, 'WORKSPACE_MISMATCH');
    }
  }

  async findByExecutionRelease(id: ExecutionReleaseId) {
    try {
      const result = await this.query.query(
        'SELECT task_record,status FROM filing_execution_task_drafts WHERE workspace_id=$1 AND execution_release_id=$2',
        [this.workspaceId, id]
      );
      return result.rowCount ? this.mapTask(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  cancel(value: FilingExecutionTaskDraft): Promise<void> {
    return this.saveTask(value, 'FILING_TASK_CANCELLED');
  }

  async recordDenial(value: FilingGovernanceDenial): Promise<void> {
    try {
      await this.query.query(
        `INSERT INTO filing_governance_audit
           (workspace_id,target_type,target_id,action,outcome,record_version,actor_id,reason_code,correlation_id,source_fingerprint,created_at)
         VALUES ($1,$2,$3,$4,'DENIED',NULL,$5,$6,$7,$8,$9)`,
        [
          this.workspaceId,
          value.targetType,
          value.targetId ?? 'unresolved',
          value.action,
          value.actorId,
          value.reasonCode,
          value.correlationId ?? this.correlationId ?? null,
          value.sourceFingerprint ?? null,
          value.createdAt
        ]
      );
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async snapshot() {
    const [authorizations, releases, tasks] = await Promise.all([
      this.query.query(
        'SELECT authorization,version,status FROM filing_authorizations WHERE workspace_id=$1 ORDER BY filing_authorization_id',
        [this.workspaceId]
      ),
      this.query.query(
        'SELECT release_record,version,status FROM execution_releases WHERE workspace_id=$1 ORDER BY execution_release_id',
        [this.workspaceId]
      ),
      this.query.query(
        'SELECT task_record,status FROM filing_execution_task_drafts WHERE workspace_id=$1 ORDER BY filing_execution_task_draft_id',
        [this.workspaceId]
      )
    ]);
    return {
      filingAuthorizations: authorizations.rows.map((row) => this.mapAuthorization(row as Row)),
      executionReleases: releases.rows.map((row) => this.mapRelease(row as Row)),
      filingExecutionTaskDrafts: tasks.rows.map((row) => this.mapTask(row as Row))
    };
  }

  private async createAuthorization(
    value: FilingAuthorization,
    key: string,
    fingerprint: string
  ): Promise<void> {
    try {
      await this.database.transact(async (client) => {
        if (await this.replay(client, key, fingerprint)) return;
        await client.query(
          `INSERT INTO filing_authorizations
             (filing_authorization_id,workspace_id,preparation_lock_id,preparation_lock_version,status,version,authorization,created_by,updated_by,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$8,$9,$9)`,
          [
            value.filingAuthorizationId,
            this.workspaceId,
            value.preparationLockId,
            value.preparationLockVersion,
            value.status,
            value.version,
            JSON.stringify(value),
            this.actorId,
            value.createdAt
          ]
        );
        await this.insertCommand(
          client,
          key,
          fingerprint,
          'FILING_AUTHORIZATION',
          value.filingAuthorizationId,
          'AUTHORIZATION_CREATE',
          value.version,
          value.createdAt
        );
        await this.audit(
          client,
          'FILING_AUTHORIZATION',
          value.filingAuthorizationId,
          'FILING_AUTHORIZATION_CREATED',
          value.version,
          value.createdAt,
          fingerprint
        );
      });
    } catch (cause) {
      if ((cause as { code?: string }).code === '23505') {
        const replay = await this.findByIdempotencyKey(key);
        if (replay) {
          if (replay.fingerprint !== fingerprint)
            throw new FilingGovernanceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different payload.'
            );
          return;
        }
        throw new FilingGovernanceError(
          'ACTIVE_FILING_AUTHORIZATION_EXISTS',
          'An active authorization already exists.',
          409
        );
      }
      throw this.mapWriteError(cause, 'WORKSPACE_MISMATCH');
    }
  }

  private async createRelease(
    value: ExecutionRelease,
    key: string,
    fingerprint: string
  ): Promise<void> {
    try {
      await this.database.transact(async (client) => {
        if (await this.replay(client, key, fingerprint)) return;
        await client.query(
          `INSERT INTO execution_releases
             (execution_release_id,workspace_id,filing_authorization_id,filing_authorization_version,status,version,release_record,created_by,updated_by,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$8,$9,$9)`,
          [
            value.executionReleaseId,
            this.workspaceId,
            value.filingAuthorizationId,
            value.filingAuthorizationVersion,
            value.status,
            value.version,
            JSON.stringify(value),
            this.actorId,
            value.createdAt
          ]
        );
        await this.insertCommand(
          client,
          key,
          fingerprint,
          'EXECUTION_RELEASE',
          value.executionReleaseId,
          'RELEASE_CREATE',
          value.version,
          value.createdAt
        );
        await this.audit(
          client,
          'EXECUTION_RELEASE',
          value.executionReleaseId,
          'EXECUTION_RELEASE_CREATED',
          value.version,
          value.createdAt,
          fingerprint
        );
      });
    } catch (cause) {
      if ((cause as { code?: string }).code === '23505') {
        const replay = await this.findByIdempotencyKey(key);
        if (replay) {
          if (replay.fingerprint !== fingerprint)
            throw new FilingGovernanceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different payload.'
            );
          return;
        }
        throw new FilingGovernanceError(
          'ACTIVE_EXECUTION_RELEASE_EXISTS',
          'An active Execution Release already exists.',
          409
        );
      }
      throw this.mapWriteError(cause, 'WORKSPACE_MISMATCH');
    }
  }

  private async authorization(id: FilingAuthorizationId) {
    try {
      const result = await this.query.query(
        'SELECT authorization,version,status FROM filing_authorizations WHERE workspace_id=$1 AND filing_authorization_id=$2',
        [this.workspaceId, id]
      );
      return result.rowCount ? this.mapAuthorization(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  private async releaseRecord(id: ExecutionReleaseId) {
    try {
      const result = await this.query.query(
        'SELECT release_record,version,status FROM execution_releases WHERE workspace_id=$1 AND execution_release_id=$2',
        [this.workspaceId, id]
      );
      return result.rowCount ? this.mapRelease(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  private async task(id: FilingExecutionTaskDraftId) {
    try {
      const result = await this.query.query(
        'SELECT task_record,status FROM filing_execution_task_drafts WHERE workspace_id=$1 AND filing_execution_task_draft_id=$2',
        [this.workspaceId, id]
      );
      return result.rowCount ? this.mapTask(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  private async saveAuthorization(value: FilingAuthorization, action: string) {
    try {
      await this.database.transact((client) => this.updateAuthorization(client, value, action));
    } catch (cause) {
      throw this.mapWriteError(cause, 'STALE_FILING_AUTHORIZATION');
    }
  }

  private async updateAuthorization(
    client: QueryClient,
    value: FilingAuthorization,
    action: string,
    sourceFingerprint?: string
  ) {
    const expected = value.version - 1;
    const result = await client.query(
      `UPDATE filing_authorizations
       SET status=$3,version=$4,authorization=$5::jsonb,updated_by=$6,updated_at=$7
       WHERE workspace_id=$1 AND filing_authorization_id=$2 AND version=$8`,
      [
        this.workspaceId,
        value.filingAuthorizationId,
        value.status,
        value.version,
        JSON.stringify(value),
        this.actorId,
        value.updatedAt,
        expected
      ]
    );
    if (!result.rowCount)
      throw new FilingGovernanceError(
        'STALE_FILING_AUTHORIZATION',
        'Filing Authorization changed; reload the exact latest version.',
        409
      );
    await this.audit(
      client,
      'FILING_AUTHORIZATION',
      value.filingAuthorizationId,
      action,
      value.version,
      value.updatedAt,
      sourceFingerprint
    );
  }

  private async saveRelease(value: ExecutionRelease, action: string) {
    try {
      await this.database.transact((client) => this.updateRelease(client, value, action));
    } catch (cause) {
      throw this.mapWriteError(cause, 'STALE_EXECUTION_RELEASE');
    }
  }

  private async updateRelease(
    client: QueryClient,
    value: ExecutionRelease,
    action: string,
    sourceFingerprint?: string
  ) {
    const expected = value.version - 1;
    const result = await client.query(
      `UPDATE execution_releases
       SET status=$3,version=$4,release_record=$5::jsonb,updated_by=$6,updated_at=$7
       WHERE workspace_id=$1 AND execution_release_id=$2 AND version=$8`,
      [
        this.workspaceId,
        value.executionReleaseId,
        value.status,
        value.version,
        JSON.stringify(value),
        this.actorId,
        value.updatedAt,
        expected
      ]
    );
    if (!result.rowCount)
      throw new FilingGovernanceError(
        'STALE_EXECUTION_RELEASE',
        'Execution Release changed; reload the exact latest version.',
        409
      );
    await this.audit(
      client,
      'EXECUTION_RELEASE',
      value.executionReleaseId,
      action,
      value.version,
      value.updatedAt,
      sourceFingerprint
    );
  }

  private async saveTask(value: FilingExecutionTaskDraft, action: string) {
    const at = this.now();
    try {
      await this.database.transact(async (client) => {
        const result = await client.query(
          `UPDATE filing_execution_task_drafts
           SET status=$3,task_record=$4::jsonb,updated_by=$5,updated_at=$6
           WHERE workspace_id=$1 AND filing_execution_task_draft_id=$2`,
          [
            this.workspaceId,
            value.filingExecutionTaskDraftId,
            value.status,
            JSON.stringify(value),
            this.actorId,
            at
          ]
        );
        if (!result.rowCount)
          throw new FilingGovernanceError(
            'WORKSPACE_MISMATCH',
            'Workspace-scoped Filing Execution Task Draft was not found.',
            404
          );
        await this.audit(
          client,
          'FILING_EXECUTION_TASK_DRAFT',
          value.filingExecutionTaskDraftId,
          action,
          1,
          at
        );
      });
    } catch (cause) {
      throw this.mapWriteError(cause, 'WORKSPACE_MISMATCH');
    }
  }

  private async replay(
    client: QueryClient,
    key: string,
    fingerprint: string,
    expectedId?: string
  ) {
    const result = await client.query(
      'SELECT request_fingerprint,target_id FROM filing_governance_commands WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE',
      [this.workspaceId, key]
    );
    if (!result.rowCount) return false;
    const row = result.rows[0] as Row;
    if (
      String(row.request_fingerprint) !== fingerprint ||
      (expectedId && String(row.target_id) !== expectedId)
    )
      throw new FilingGovernanceError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different payload.'
      );
    return true;
  }

  private insertCommand(
    client: QueryClient,
    key: string,
    fingerprint: string,
    targetType: 'FILING_AUTHORIZATION' | 'EXECUTION_RELEASE',
    targetId: string,
    commandType:
      | 'AUTHORIZATION_CREATE'
      | 'AUTHORIZATION_CONFIRM'
      | 'RELEASE_CREATE'
      | 'RELEASE_DECISION',
    responseVersion: number,
    createdAt: string
  ) {
    return client.query(
      `INSERT INTO filing_governance_commands
         (workspace_id,idempotency_key,request_fingerprint,target_type,target_id,command_type,response_version,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        this.workspaceId,
        key,
        fingerprint,
        targetType,
        targetId,
        commandType,
        responseVersion,
        createdAt
      ]
    );
  }

  private audit(
    client: QueryClient,
    targetType: 'FILING_AUTHORIZATION' | 'EXECUTION_RELEASE' | 'FILING_EXECUTION_TASK_DRAFT',
    targetId: string,
    action: string,
    recordVersion: number,
    createdAt: string,
    sourceFingerprint?: string
  ) {
    return client.query(
      `INSERT INTO filing_governance_audit
         (workspace_id,target_type,target_id,action,outcome,record_version,actor_id,reason_code,correlation_id,source_fingerprint,created_at)
       VALUES ($1,$2,$3,$4,'SUCCESS',$5,$6,NULL,$7,$8,$9)`,
      [
        this.workspaceId,
        targetType,
        targetId,
        action,
        recordVersion,
        this.actorId,
        this.correlationId ?? null,
        sourceFingerprint ?? null,
        createdAt
      ]
    );
  }

  private mapAuthorization(row: Row): FilingAuthorization {
    return {
      ...(row.authorization as FilingAuthorization),
      version: Number(row.version),
      status: String(row.status) as FilingAuthorization['status']
    };
  }

  private mapRelease(row: Row): ExecutionRelease {
    return {
      ...(row.release_record as ExecutionRelease),
      version: Number(row.version),
      status: String(row.status) as ExecutionRelease['status']
    };
  }

  private mapTask(row: Row): FilingExecutionTaskDraft {
    return {
      ...(row.task_record as FilingExecutionTaskDraft),
      status: String(row.status) as FilingExecutionTaskDraft['status']
    };
  }

  private mapWriteError(cause: unknown, staleCode: string) {
    if (cause instanceof FilingGovernanceError) return cause;
    const code = (cause as { code?: string }).code;
    if (code === '23503')
      return new FilingGovernanceError(
        'WORKSPACE_MISMATCH',
        'Workspace-scoped filing governance source was not found.',
        404
      );
    if (code === '23505')
      return new FilingGovernanceError(
        'IDEMPOTENCY_CONFLICT',
        'A filing governance uniqueness or idempotency boundary was violated.',
        409
      );
    if (code === '40001')
      return new FilingGovernanceError(
        staleCode,
        'Concurrent filing governance update detected; reload the exact latest version.',
        409
      );
    return this.unavailable(cause);
  }

  private unavailable(cause: unknown) {
    return new FilingGovernanceError(
      'PERSISTENCE_UNAVAILABLE',
      'Execution filing governance persistence is unavailable.',
      503,
      cause instanceof Error ? { cause: cause.message } : undefined
    );
  }
}
