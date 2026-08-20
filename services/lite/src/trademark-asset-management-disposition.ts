import { createHash, randomUUID } from 'node:crypto';
import {
  trademarkAssetManagementDispositionKinds,
  type TrademarkAssetManagementDisposition,
  type TrademarkAssetManagementDispositionId,
  type TrademarkAssetManagementDispositionKind,
  type TrademarkAssetManagementRecommendationId,
  type TrademarkAssetManagementSignalId
} from '@markorbit/contracts/trademark-asset-management';
import type {
  TrademarkAssetId,
  TrademarkAssetRelation
} from '@markorbit/contracts/trademark-asset-workspace';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

export type TrademarkAssetManagementRecoveryJobId = `trademark-asset-management-recovery_${string}`;
export type TrademarkAssetManagementRecoveryKind =
  'REFRESH_PORTFOLIO_PROJECTION' | 'REBUILD_MANAGEMENT_SIGNAL';
export type TrademarkAssetManagementRecoveryStatus =
  'PENDING' | 'LEASED' | 'SUCCEEDED' | 'DEAD_LETTER';

export interface RecordTrademarkAssetManagementDispositionCommand {
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  managementSignalId: TrademarkAssetManagementSignalId;
  recommendationId?: TrademarkAssetManagementRecommendationId;
  kind: TrademarkAssetManagementDispositionKind;
  subjectUserId: string;
  note?: string;
  workflowReference?: Readonly<TrademarkAssetRelation>;
  idempotencyKey: string;
}

export interface TrademarkAssetManagementRecoveryJob {
  schemaVersion: 1;
  recoveryJobId: TrademarkAssetManagementRecoveryJobId;
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  dispositionId: TrademarkAssetManagementDispositionId;
  recoveryKind: TrademarkAssetManagementRecoveryKind;
  status: TrademarkAssetManagementRecoveryStatus;
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  leaseUntil?: string;
  lastFailure?: string;
  protectedActionAuthorized: false;
  filingAuthorized: false;
  externalContactAuthorized: false;
  paymentAuthorized: false;
  publicationAuthorized: false;
}

export interface TrademarkAssetManagementRecoveryAttemptDecision {
  status: 'PENDING' | 'DEAD_LETTER';
  attemptCount: number;
  availableAt: string;
}

export type TrademarkAssetManagementDispositionErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'LEASE_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class TrademarkAssetManagementDispositionError extends Error {
  constructor(
    readonly code: TrademarkAssetManagementDispositionErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TrademarkAssetManagementDispositionError';
  }
}

const clone = <T>(value: T): T => structuredClone(value);
const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function cleanText(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      `${field} must be a non-empty string of at most ${max} characters.`,
      400
    );
  }
  return value.trim();
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned)) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      400
    );
  }
  return cleaned;
}

function cleanAssetId(value: TrademarkAssetId): TrademarkAssetId {
  const cleaned = cleanText(value, 'trademarkAssetId', 300);
  if (!cleaned.startsWith('trademark-asset_')) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      'trademarkAssetId must use the trademark-asset_ prefix.',
      400
    );
  }
  return cleaned as TrademarkAssetId;
}

function timestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      400
    );
  }
  return parsed.toISOString();
}

function nextDispositionId(): TrademarkAssetManagementDispositionId {
  return `trademark-asset-management-disposition_${randomUUID().replaceAll('-', '')}`;
}

function nextRecoveryJobId(): TrademarkAssetManagementRecoveryJobId {
  return `trademark-asset-management-recovery_${randomUUID().replaceAll('-', '')}`;
}

export function nextTrademarkAssetManagementRecoveryAttempt(
  nowValue: string,
  priorAttemptCount: number,
  maxAttempts: number
): TrademarkAssetManagementRecoveryAttemptDecision {
  const now = new Date(timestamp(nowValue, 'now'));
  if (!Number.isInteger(priorAttemptCount) || priorAttemptCount < 0) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      'priorAttemptCount must be a non-negative integer.',
      400
    );
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      'maxAttempts must be between 1 and 20.',
      400
    );
  }
  const attemptCount = priorAttemptCount + 1;
  if (attemptCount >= maxAttempts) {
    return { status: 'DEAD_LETTER', attemptCount, availableAt: now.toISOString() };
  }
  const delaySeconds = Math.min(3600, 15 * 2 ** Math.max(0, attemptCount - 1));
  return {
    status: 'PENDING',
    attemptCount,
    availableAt: new Date(now.valueOf() + delaySeconds * 1000).toISOString()
  };
}

export const trademarkAssetManagementDispositionRecoveryAuthority = {
  mayPersistPrivateDisposition: true,
  mayMaintainWatchState: true,
  mayRetryInternalProjectionWork: true,
  mayDeadLetterInternalProjectionWork: true,
  mayReplayDeadLetterAfterExplicitInternalRecovery: true,
  mayCreateOfficialTruth: false,
  mayCertifyLegalDeadline: false,
  mayCreateLegalConclusion: false,
  mayAuthorizeFiling: false,
  mayAuthorizeExternalContact: false,
  mayAuthorizePayment: false,
  mayAuthorizeExternalPublication: false,
  mayCreateVerifiedCapability: false,
  mayUseCrossServiceSql: false
} as const;

export class PostgresTrademarkAssetManagementDispositionStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly dispositionId: () => TrademarkAssetManagementDispositionId = nextDispositionId,
    private readonly recoveryJobId: () => TrademarkAssetManagementRecoveryJobId = nextRecoveryJobId
  ) {}

  async record(
    command: Readonly<RecordTrademarkAssetManagementDispositionCommand>
  ): Promise<TrademarkAssetManagementDisposition> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const trademarkAssetId = cleanAssetId(command.trademarkAssetId);
    const managementSignalId = cleanText(
      command.managementSignalId,
      'managementSignalId',
      300
    ) as TrademarkAssetManagementSignalId;
    const recommendationId = command.recommendationId
      ? (cleanText(
          command.recommendationId,
          'recommendationId',
          300
        ) as TrademarkAssetManagementRecommendationId)
      : undefined;
    if (!trademarkAssetManagementDispositionKinds.includes(command.kind)) {
      throw new TrademarkAssetManagementDispositionError(
        'INVALID_INPUT',
        'Unknown management disposition kind.',
        400
      );
    }
    const subjectUserId = cleanText(command.subjectUserId, 'subjectUserId', 300);
    const note = command.note ? cleanText(command.note, 'note', 4000) : undefined;
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      trademarkAssetId,
      managementSignalId,
      recommendationId: recommendationId ?? null,
      kind: command.kind,
      subjectUserId,
      note: note ?? null,
      workflowReference: command.workflowReference ?? null
    });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:trademark-asset-management-disposition:${managementSignalId}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,result_json
             FROM lite_trademark_asset_management_disposition_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256) {
            throw new TrademarkAssetManagementDispositionError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different management disposition.',
              409
            );
          }
          return clone(prior.result_json as TrademarkAssetManagementDisposition);
        }

        const asset = await client.query(
          `SELECT 1 FROM lite_trademark_assets
            WHERE workspace_id=$1 AND trademark_asset_id=$2`,
          [workspaceId, trademarkAssetId]
        );
        if (!asset.rows[0]) {
          throw new TrademarkAssetManagementDispositionError(
            'NOT_FOUND',
            'Trademark Asset was not found.',
            404
          );
        }

        const recordedAt = timestamp(this.now(), 'now');
        const disposition: TrademarkAssetManagementDisposition = {
          schemaVersion: 1,
          dispositionId: this.dispositionId(),
          workspaceId,
          version: 1,
          asset: { id: trademarkAssetId, version: 1 },
          signal: { id: managementSignalId, version: 1 },
          ...(recommendationId ? { recommendation: { id: recommendationId, version: 1 } } : {}),
          kind: command.kind,
          subjectUserId,
          ...(note ? { note } : {}),
          ...(command.workflowReference
            ? { workflowReference: clone(command.workflowReference) }
            : {}),
          recordedAt,
          officialTruthCreated: false,
          legalConclusionVerified: false,
          capabilityVerified: false
        };

        await client.query(
          `INSERT INTO lite_trademark_asset_management_dispositions(
             workspace_id,disposition_id,version,trademark_asset_id,management_signal_id,
             recommendation_id,disposition_kind,subject_user_id,document_json,recorded_at
           ) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
          [
            workspaceId,
            disposition.dispositionId,
            trademarkAssetId,
            managementSignalId,
            recommendationId ?? null,
            disposition.kind,
            subjectUserId,
            JSON.stringify(disposition),
            recordedAt
          ]
        );
        await client.query(
          `INSERT INTO lite_trademark_asset_management_disposition_commands(
             workspace_id,idempotency_key,request_fingerprint_sha256,result_json,created_at
           ) VALUES($1,$2,$3,$4::jsonb,$5)`,
          [
            workspaceId,
            idempotencyKey,
            requestFingerprintSha256,
            JSON.stringify(disposition),
            recordedAt
          ]
        );

        const recoveryKinds: TrademarkAssetManagementRecoveryKind[] = [
          'REFRESH_PORTFOLIO_PROJECTION',
          'REBUILD_MANAGEMENT_SIGNAL'
        ];
        for (const recoveryKind of recoveryKinds) {
          const recoveryJobId = this.recoveryJobId();
          const payload = {
            schemaVersion: 1,
            workspaceId,
            trademarkAssetId,
            dispositionId: disposition.dispositionId,
            managementSignalId,
            recoveryKind,
            protectedActionAuthorized: false
          };
          await client.query(
            `INSERT INTO lite_trademark_asset_management_recovery_jobs(
               workspace_id,recovery_job_id,trademark_asset_id,disposition_id,recovery_kind,
               status,attempt_count,max_attempts,available_at,payload_json,created_at,updated_at
             ) VALUES($1,$2,$3,$4,$5,'PENDING',0,5,$6,$7::jsonb,$6,$6)`,
            [
              workspaceId,
              recoveryJobId,
              trademarkAssetId,
              disposition.dispositionId,
              recoveryKind,
              recordedAt,
              JSON.stringify(payload)
            ]
          );
        }
        return clone(disposition);
      });
    } catch (error) {
      if (error instanceof TrademarkAssetManagementDispositionError) throw error;
      throw new TrademarkAssetManagementDispositionError(
        'PERSISTENCE_UNAVAILABLE',
        'Trademark Asset management disposition persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async listWatchState(
    workspaceIdValue: string,
    limit = 100
  ): Promise<TrademarkAssetManagementDisposition[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new TrademarkAssetManagementDispositionError(
        'INVALID_INPUT',
        'limit must be between 1 and 200.',
        400
      );
    }
    try {
      const result = await this.query.query(
        `SELECT document_json
           FROM (
             SELECT DISTINCT ON (management_signal_id)
                    management_signal_id,document_json,disposition_kind,recorded_at,disposition_id
               FROM lite_trademark_asset_management_dispositions
              WHERE workspace_id=$1
              ORDER BY management_signal_id,recorded_at DESC,disposition_id DESC
           ) latest
          WHERE disposition_kind IN ('WATCHED','DEFERRED')
          ORDER BY recorded_at DESC,disposition_id DESC
          LIMIT $2`,
        [workspaceId, limit]
      );
      return result.rows.map((row) =>
        clone((row as Row).document_json as TrademarkAssetManagementDisposition)
      );
    } catch (error) {
      throw new TrademarkAssetManagementDispositionError(
        'PERSISTENCE_UNAVAILABLE',
        'Trademark Asset management watch state is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async leaseRecoveryJobs(
    limit = 20,
    leaseSeconds = 60
  ): Promise<TrademarkAssetManagementRecoveryJob[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new TrademarkAssetManagementDispositionError(
        'INVALID_INPUT',
        'limit must be between 1 and 100.',
        400
      );
    }
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 10 || leaseSeconds > 900) {
      throw new TrademarkAssetManagementDispositionError(
        'INVALID_INPUT',
        'leaseSeconds must be between 10 and 900.',
        400
      );
    }
    const now = timestamp(this.now(), 'now');
    const leaseUntil = new Date(new Date(now).valueOf() + leaseSeconds * 1000).toISOString();
    try {
      return await this.database.transact(async (client) => {
        const selected = await client.query(
          `SELECT workspace_id,recovery_job_id
             FROM lite_trademark_asset_management_recovery_jobs
            WHERE status='PENDING' AND available_at <= $1
            ORDER BY available_at ASC,recovery_job_id ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $2`,
          [now, limit]
        );
        const jobs: TrademarkAssetManagementRecoveryJob[] = [];
        for (const selectedRow of selected.rows as Row[]) {
          const updated = await client.query(
            `UPDATE lite_trademark_asset_management_recovery_jobs
                SET status='LEASED',lease_until=$3,updated_at=$1
              WHERE workspace_id=$2 AND recovery_job_id=$4
              RETURNING *`,
            [now, selectedRow.workspace_id, leaseUntil, selectedRow.recovery_job_id]
          );
          const row = updated.rows[0] as Row | undefined;
          if (row) jobs.push(this.recoveryDocument(row));
        }
        return jobs;
      });
    } catch (error) {
      throw new TrademarkAssetManagementDispositionError(
        'PERSISTENCE_UNAVAILABLE',
        'Trademark Asset management recovery queue is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async completeRecoveryJob(
    workspaceIdValue: string,
    recoveryJobIdValue: TrademarkAssetManagementRecoveryJobId
  ): Promise<void> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const recoveryJobId = cleanText(recoveryJobIdValue, 'recoveryJobId', 300);
    const now = timestamp(this.now(), 'now');
    const result = await this.query.query(
      `UPDATE lite_trademark_asset_management_recovery_jobs
          SET status='SUCCEEDED',lease_until=NULL,last_failure=NULL,updated_at=$3
        WHERE workspace_id=$1 AND recovery_job_id=$2 AND status='LEASED'`,
      [workspaceId, recoveryJobId, now]
    );
    if (!result.rowCount) {
      throw new TrademarkAssetManagementDispositionError(
        'LEASE_CONFLICT',
        'Recovery job is not currently leased in this workspace.',
        409
      );
    }
  }

  async failRecoveryJob(
    workspaceIdValue: string,
    recoveryJobIdValue: TrademarkAssetManagementRecoveryJobId,
    failureValue: string
  ): Promise<TrademarkAssetManagementRecoveryJob> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const recoveryJobId = cleanText(recoveryJobIdValue, 'recoveryJobId', 300);
    const failure = cleanText(failureValue, 'failure', 4000);
    const now = timestamp(this.now(), 'now');
    return this.database.transact(async (client) => {
      const current = await client.query(
        `SELECT * FROM lite_trademark_asset_management_recovery_jobs
          WHERE workspace_id=$1 AND recovery_job_id=$2
          FOR UPDATE`,
        [workspaceId, recoveryJobId]
      );
      const row = current.rows[0] as Row | undefined;
      if (!row || row.status !== 'LEASED') {
        throw new TrademarkAssetManagementDispositionError(
          'LEASE_CONFLICT',
          'Recovery job is not currently leased in this workspace.',
          409
        );
      }
      const decision = nextTrademarkAssetManagementRecoveryAttempt(
        now,
        Number(row.attempt_count),
        Number(row.max_attempts)
      );
      const updated = await client.query(
        `UPDATE lite_trademark_asset_management_recovery_jobs
            SET status=$3,attempt_count=$4,available_at=$5,lease_until=NULL,
                last_failure=$6,updated_at=$7
          WHERE workspace_id=$1 AND recovery_job_id=$2
          RETURNING *`,
        [
          workspaceId,
          recoveryJobId,
          decision.status,
          decision.attemptCount,
          decision.availableAt,
          failure,
          now
        ]
      );
      return this.recoveryDocument(updated.rows[0] as Row);
    });
  }

  async replayDeadLetter(
    workspaceIdValue: string,
    recoveryJobIdValue: TrademarkAssetManagementRecoveryJobId
  ): Promise<TrademarkAssetManagementRecoveryJob> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const recoveryJobId = cleanText(recoveryJobIdValue, 'recoveryJobId', 300);
    const now = timestamp(this.now(), 'now');
    const updated = await this.query.query(
      `UPDATE lite_trademark_asset_management_recovery_jobs
          SET status='PENDING',attempt_count=0,available_at=$3,lease_until=NULL,
              last_failure=NULL,updated_at=$3
        WHERE workspace_id=$1 AND recovery_job_id=$2 AND status='DEAD_LETTER'
        RETURNING *`,
      [workspaceId, recoveryJobId, now]
    );
    const row = updated.rows[0] as Row | undefined;
    if (!row) {
      throw new TrademarkAssetManagementDispositionError(
        'NOT_FOUND',
        'Dead-letter recovery job was not found in this workspace.',
        404
      );
    }
    return this.recoveryDocument(row);
  }

  async listDeadLetters(
    workspaceIdValue: string,
    limit = 50
  ): Promise<TrademarkAssetManagementRecoveryJob[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new TrademarkAssetManagementDispositionError(
        'INVALID_INPUT',
        'limit must be between 1 and 200.',
        400
      );
    }
    const result = await this.query.query(
      `SELECT * FROM lite_trademark_asset_management_recovery_jobs
        WHERE workspace_id=$1 AND status='DEAD_LETTER'
        ORDER BY updated_at DESC,recovery_job_id DESC
        LIMIT $2`,
      [workspaceId, limit]
    );
    return result.rows.map((row) => this.recoveryDocument(row as Row));
  }

  private recoveryDocument(row: Row): TrademarkAssetManagementRecoveryJob {
    const leaseUntil =
      typeof row.lease_until === 'string'
        ? row.lease_until
        : row.lease_until instanceof Date
          ? row.lease_until.toISOString()
          : undefined;
    const lastFailure = typeof row.last_failure === 'string' ? row.last_failure : undefined;
    return {
      schemaVersion: 1,
      recoveryJobId: String(row.recovery_job_id) as TrademarkAssetManagementRecoveryJobId,
      workspaceId: String(row.workspace_id),
      trademarkAssetId: String(row.trademark_asset_id) as TrademarkAssetId,
      dispositionId: String(row.disposition_id) as TrademarkAssetManagementDispositionId,
      recoveryKind: String(row.recovery_kind) as TrademarkAssetManagementRecoveryKind,
      status: String(row.status) as TrademarkAssetManagementRecoveryStatus,
      attemptCount: Number(row.attempt_count),
      maxAttempts: Number(row.max_attempts),
      availableAt:
        row.available_at instanceof Date
          ? row.available_at.toISOString()
          : String(row.available_at),
      ...(leaseUntil ? { leaseUntil } : {}),
      ...(lastFailure ? { lastFailure } : {}),
      protectedActionAuthorized: false,
      filingAuthorized: false,
      externalContactAuthorized: false,
      paymentAuthorized: false,
      publicationAuthorized: false
    };
  }
}
