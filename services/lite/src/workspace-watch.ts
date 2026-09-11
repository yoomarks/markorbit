import { createHash, randomUUID } from 'node:crypto';
import {
  isWorkspaceWatchTargetStatusTransitionAllowedV1,
  noWorkspaceWatchAuthorityConsequencesV1,
  parseWorkspaceWatchTargetV1,
  workspaceWatchPurposes,
  workspaceWatchTargetKinds,
  workspaceWatchTargetStatuses,
  type WorkspaceWatchExternalTargetReferenceV1,
  type WorkspaceWatchPurpose,
  type WorkspaceWatchTargetId,
  type WorkspaceWatchTargetKind,
  type WorkspaceWatchTargetStatus,
  type WorkspaceWatchTargetV1
} from '@markorbit/contracts/workspace-watch';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WATCH_TARGET_ID = /^workspace-watch-target_[A-Za-z0-9_-]+$/u;

type Row = Record<string, unknown>;
type CommandType = 'CREATE' | 'ARCHIVE';

export type WorkspaceWatchRuntimeErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'ACTIVE_INTENT_CONFLICT'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class WorkspaceWatchRuntimeError extends Error {
  constructor(
    readonly code: WorkspaceWatchRuntimeErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceWatchRuntimeError';
  }
}

export interface CreateWorkspaceWatchTargetCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  target: Readonly<WorkspaceWatchExternalTargetReferenceV1>;
  purpose: WorkspaceWatchPurpose;
  reason?: string;
}

export interface ArchiveWorkspaceWatchTargetCommand {
  workspaceId: string;
  workspaceWatchTargetId: WorkspaceWatchTargetId;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface ListWorkspaceWatchTargetsOptions {
  status?: WorkspaceWatchTargetStatus;
  targetKind?: WorkspaceWatchTargetKind;
  purpose?: WorkspaceWatchPurpose;
  limit?: number;
}

const clone = <T>(value: T): T => structuredClone(value);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new WorkspaceWatchRuntimeError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new WorkspaceWatchRuntimeError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  return cleaned;
}

function cleanWatchTargetId(value: WorkspaceWatchTargetId): WorkspaceWatchTargetId {
  const cleaned = value.trim();
  if (!WATCH_TARGET_ID.test(cleaned))
    throw new WorkspaceWatchRuntimeError(
      'INVALID_INPUT',
      'workspaceWatchTargetId is invalid.',
      422
    );
  return cleaned as WorkspaceWatchTargetId;
}

function cleanVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new WorkspaceWatchRuntimeError(
      'INVALID_INPUT',
      'expectedVersion must be a positive safe integer.',
      422
    );
  return value;
}

function nowIso(value: string, field = 'now'): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new WorkspaceWatchRuntimeError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  return parsed.toISOString();
}

function cleanPurpose(value: WorkspaceWatchPurpose): WorkspaceWatchPurpose {
  if (!workspaceWatchPurposes.includes(value))
    throw new WorkspaceWatchRuntimeError('INVALID_INPUT', 'purpose is invalid.', 422);
  return value;
}

function cleanStatus(value: WorkspaceWatchTargetStatus): WorkspaceWatchTargetStatus {
  if (!workspaceWatchTargetStatuses.includes(value))
    throw new WorkspaceWatchRuntimeError('INVALID_INPUT', 'status is invalid.', 422);
  return value;
}

function cleanTargetKind(value: WorkspaceWatchTargetKind): WorkspaceWatchTargetKind {
  if (!workspaceWatchTargetKinds.includes(value))
    throw new WorkspaceWatchRuntimeError('INVALID_INPUT', 'targetKind is invalid.', 422);
  return value;
}

function parseRuntimeTarget(value: unknown, workspaceId: string): WorkspaceWatchTargetV1 {
  try {
    return parseWorkspaceWatchTargetV1(value, workspaceId);
  } catch (error) {
    throw new WorkspaceWatchRuntimeError(
      'INVALID_INPUT',
      'Workspace Watch Target contract validation failed.',
      422,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function parsePersistedTarget(value: unknown, workspaceId: string): WorkspaceWatchTargetV1 {
  try {
    return parseWorkspaceWatchTargetV1(value, workspaceId);
  } catch (error) {
    throw new WorkspaceWatchRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Workspace Watch Target failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

export function materializeWorkspaceWatchTargetV1(
  command: Readonly<CreateWorkspaceWatchTargetCommand>,
  at: string,
  id: WorkspaceWatchTargetId
): WorkspaceWatchTargetV1 {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  const createdAt = nowIso(at);
  return parseRuntimeTarget(
    {
      schemaVersion: 1,
      workspaceWatchTargetId: cleanWatchTargetId(id),
      workspaceId,
      version: 1,
      status: 'ACTIVE',
      purpose: cleanPurpose(command.purpose),
      ...(command.reason === undefined
        ? {}
        : { reason: cleanText(command.reason, 'reason', 1000) }),
      target: command.target,
      userConfirmed: true,
      createdByPrincipalId: cleanText(command.actorPrincipalId, 'actorPrincipalId', 240),
      authorityConsequences: noWorkspaceWatchAuthorityConsequencesV1,
      createdAt,
      updatedAt: createdAt,
      archivedAt: null
    },
    workspaceId
  );
}

export function materializeArchivedWorkspaceWatchTargetV1(
  current: Readonly<WorkspaceWatchTargetV1>,
  command: Readonly<ArchiveWorkspaceWatchTargetCommand>,
  at: string
): WorkspaceWatchTargetV1 {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  if (
    current.workspaceId !== workspaceId ||
    current.workspaceWatchTargetId !== cleanWatchTargetId(command.workspaceWatchTargetId)
  )
    throw new WorkspaceWatchRuntimeError('NOT_FOUND', 'Workspace Watch Target was not found.', 404);
  if (current.version !== cleanVersion(command.expectedVersion))
    throw new WorkspaceWatchRuntimeError(
      'VERSION_CONFLICT',
      `Expected Watch Target version ${command.expectedVersion}, found ${current.version}.`
    );
  if (!isWorkspaceWatchTargetStatusTransitionAllowedV1(current.status, 'ARCHIVED'))
    throw new WorkspaceWatchRuntimeError(
      'INVALID_TRANSITION',
      `Workspace Watch Target cannot transition from ${current.status} to ARCHIVED.`
    );
  const updatedAt = nowIso(at);
  if (Date.parse(updatedAt) < Date.parse(current.updatedAt))
    throw new WorkspaceWatchRuntimeError(
      'INVALID_INPUT',
      'Runtime clock cannot move backwards.',
      422
    );
  return parseRuntimeTarget(
    {
      ...clone(current),
      version: current.version + 1,
      status: 'ARCHIVED',
      updatedAt,
      archivedAt: updatedAt
    },
    workspaceId
  );
}

function activeIntentFingerprint(item: Pick<WorkspaceWatchTargetV1, 'target' | 'purpose'>): string {
  return fingerprint({ target: item.target, purpose: item.purpose });
}

function createIntentFingerprint(
  item: Pick<WorkspaceWatchTargetV1, 'target' | 'purpose' | 'reason'>
): string {
  return fingerprint({ target: item.target, purpose: item.purpose, reason: item.reason });
}

function timestampEqual(left: unknown, right: string | null): boolean {
  if (right === null) return left === null || left === undefined;
  if (left === null || left === undefined) return false;
  const leftTime =
    left instanceof Date ? left.getTime() : typeof left === 'string' ? Date.parse(left) : NaN;
  return Number.isFinite(leftTime) && leftTime === Date.parse(right);
}

function versionItemFromRow(row: Row): WorkspaceWatchTargetV1 {
  const workspaceId = String(row.workspace_id);
  const item = parsePersistedTarget(row.document_json, workspaceId);
  const mismatch =
    item.workspaceWatchTargetId !== String(row.workspace_watch_target_id) ||
    item.version !== Number(row.version) ||
    item.status !== String(row.status) ||
    item.purpose !== String(row.purpose) ||
    item.target.targetKind !== String(row.target_kind) ||
    activeIntentFingerprint(item) !== String(row.active_intent_fingerprint_sha256) ||
    !timestampEqual(row.created_at, item.createdAt) ||
    !timestampEqual(row.updated_at, item.updatedAt) ||
    !timestampEqual(row.archived_at, item.archivedAt);
  if (mismatch)
    throw new WorkspaceWatchRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Workspace Watch Target columns do not match document_json.',
      500
    );
  return item;
}

function latestItemFromRow(row: Row): WorkspaceWatchTargetV1 {
  const item = versionItemFromRow(row);
  const mismatch =
    item.version !== Number(row.head_latest_version) ||
    item.status !== String(row.head_status) ||
    item.purpose !== String(row.head_purpose) ||
    item.target.targetKind !== String(row.head_target_kind) ||
    activeIntentFingerprint(item) !== String(row.head_active_intent_fingerprint_sha256) ||
    !timestampEqual(row.head_updated_at, item.updatedAt);
  if (mismatch)
    throw new WorkspaceWatchRuntimeError(
      'INTEGRITY_FAILURE',
      'Workspace Watch Target head does not match its latest durable version.',
      500
    );
  return item;
}

export class PostgresWorkspaceWatchStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => WorkspaceWatchTargetId = () =>
      `workspace-watch-target_${randomUUID().replaceAll('-', '')}`
  ) {}

  async create(
    command: Readonly<CreateWorkspaceWatchTargetCommand>
  ): Promise<WorkspaceWatchTargetV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const created = materializeWorkspaceWatchTargetV1(command, this.now(), this.id());
    const activeFingerprint = activeIntentFingerprint(created);
    const requestFingerprint = fingerprint({
      commandType: 'CREATE',
      workspaceId,
      actorPrincipalId: created.createdByPrincipalId,
      target: created.target,
      purpose: created.purpose,
      reason: created.reason
    });

    return this.command(
      workspaceId,
      idempotencyKey,
      'CREATE',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:watch-active:${activeFingerprint}`);
        const existing = await this.findActiveByFingerprint(client, workspaceId, activeFingerprint);
        if (existing) {
          if (createIntentFingerprint(existing) !== createIntentFingerprint(created))
            throw new WorkspaceWatchRuntimeError(
              'ACTIVE_INTENT_CONFLICT',
              'An ACTIVE Watch already exists for this exact target and purpose with different intent details.'
            );
          return existing;
        }
        await this.insertVersion(client, created, activeFingerprint);
        await client.query(
          `INSERT INTO lite_workspace_watch_heads(
             workspace_id,workspace_watch_target_id,latest_version,status,purpose,target_kind,
             active_intent_fingerprint_sha256,updated_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            created.workspaceId,
            created.workspaceWatchTargetId,
            created.version,
            created.status,
            created.purpose,
            created.target.targetKind,
            activeFingerprint,
            created.updatedAt
          ]
        );
        return created;
      }
    );
  }

  async archive(
    command: Readonly<ArchiveWorkspaceWatchTargetCommand>
  ): Promise<WorkspaceWatchTargetV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const id = cleanWatchTargetId(command.workspaceWatchTargetId);
    const expectedVersion = cleanVersion(command.expectedVersion);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const requestFingerprint = fingerprint({
      commandType: 'ARCHIVE',
      workspaceId,
      workspaceWatchTargetId: id,
      expectedVersion
    });

    return this.command(
      workspaceId,
      idempotencyKey,
      'ARCHIVE',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:watch-target:${id}`);
        const current = await this.requireLatest(client, workspaceId, id);
        const next = materializeArchivedWorkspaceWatchTargetV1(current, command, this.now());
        const activeFingerprint = activeIntentFingerprint(next);
        await this.insertVersion(client, next, activeFingerprint);
        const updated = await client.query(
          `UPDATE lite_workspace_watch_heads
              SET latest_version=$3,status=$4,purpose=$5,target_kind=$6,
                  active_intent_fingerprint_sha256=$7,updated_at=$8
            WHERE workspace_id=$1 AND workspace_watch_target_id=$2 AND latest_version=$9`,
          [
            workspaceId,
            id,
            next.version,
            next.status,
            next.purpose,
            next.target.targetKind,
            activeFingerprint,
            next.updatedAt,
            expectedVersion
          ]
        );
        if (updated.rowCount !== 1)
          throw new WorkspaceWatchRuntimeError(
            'VERSION_CONFLICT',
            'Workspace Watch Target changed before archive could be persisted.'
          );
        return next;
      }
    );
  }

  async getExact(
    workspaceIdValue: string,
    workspaceWatchTargetIdValue: WorkspaceWatchTargetId,
    versionValue: number
  ): Promise<WorkspaceWatchTargetV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const id = cleanWatchTargetId(workspaceWatchTargetIdValue);
    const version = cleanVersion(versionValue);
    try {
      const result = await this.query.query<Row>(
        `SELECT * FROM lite_workspace_watch_versions
          WHERE workspace_id=$1 AND workspace_watch_target_id=$2 AND version=$3`,
        [workspaceId, id, version]
      );
      return result.rows[0] ? versionItemFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof WorkspaceWatchRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async getLatest(
    workspaceIdValue: string,
    workspaceWatchTargetIdValue: WorkspaceWatchTargetId
  ): Promise<WorkspaceWatchTargetV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const id = cleanWatchTargetId(workspaceWatchTargetIdValue);
    try {
      const result = await this.query.query<Row>(
        `SELECT v.*,
                h.latest_version AS head_latest_version,
                h.status AS head_status,
                h.purpose AS head_purpose,
                h.target_kind AS head_target_kind,
                h.active_intent_fingerprint_sha256 AS head_active_intent_fingerprint_sha256,
                h.updated_at AS head_updated_at
           FROM lite_workspace_watch_heads h
           JOIN lite_workspace_watch_versions v
             ON v.workspace_id=h.workspace_id
            AND v.workspace_watch_target_id=h.workspace_watch_target_id
            AND v.version=h.latest_version
          WHERE h.workspace_id=$1 AND h.workspace_watch_target_id=$2`,
        [workspaceId, id]
      );
      return result.rows[0] ? latestItemFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof WorkspaceWatchRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async listLatest(
    workspaceIdValue: string,
    options: Readonly<ListWorkspaceWatchTargetsOptions> = {}
  ): Promise<readonly WorkspaceWatchTargetV1[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const limit = options.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new WorkspaceWatchRuntimeError(
        'INVALID_INPUT',
        'limit must be between 1 and 100.',
        422
      );
    const status = options.status === undefined ? null : cleanStatus(options.status);
    const targetKind =
      options.targetKind === undefined ? null : cleanTargetKind(options.targetKind);
    const purpose = options.purpose === undefined ? null : cleanPurpose(options.purpose);

    try {
      const result = await this.query.query<Row>(
        `SELECT v.*,
                h.latest_version AS head_latest_version,
                h.status AS head_status,
                h.purpose AS head_purpose,
                h.target_kind AS head_target_kind,
                h.active_intent_fingerprint_sha256 AS head_active_intent_fingerprint_sha256,
                h.updated_at AS head_updated_at
           FROM lite_workspace_watch_heads h
           JOIN lite_workspace_watch_versions v
             ON v.workspace_id=h.workspace_id
            AND v.workspace_watch_target_id=h.workspace_watch_target_id
            AND v.version=h.latest_version
          WHERE h.workspace_id=$1
            AND ($2::text IS NULL OR h.status=$2)
            AND ($3::text IS NULL OR h.target_kind=$3)
            AND ($4::text IS NULL OR h.purpose=$4)
          ORDER BY h.updated_at DESC, h.workspace_watch_target_id ASC
          LIMIT $5`,
        [workspaceId, status, targetKind, purpose, limit]
      );
      return result.rows.map(latestItemFromRow);
    } catch (error) {
      if (error instanceof WorkspaceWatchRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async command(
    workspaceId: string,
    idempotencyKey: string,
    commandType: CommandType,
    requestFingerprint: string,
    write: (client: QueryClient) => Promise<WorkspaceWatchTargetV1>
  ): Promise<WorkspaceWatchTargetV1> {
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(client, `${workspaceId}:watch-idempotency:${idempotencyKey}`);
        const replay = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_workspace_watch_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0];
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new WorkspaceWatchRuntimeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Workspace Watch command.'
            );
          return parsePersistedTarget(prior.result_json, workspaceId);
        }

        const result = await write(client);
        await client.query(
          `INSERT INTO lite_workspace_watch_commands(
             workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
           ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
          [
            workspaceId,
            idempotencyKey,
            commandType,
            requestFingerprint,
            JSON.stringify(result),
            nowIso(this.now())
          ]
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof WorkspaceWatchRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async resourceLock(client: QueryClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }

  private async findActiveByFingerprint(
    client: QueryClient,
    workspaceId: string,
    activeFingerprint: string
  ): Promise<WorkspaceWatchTargetV1 | undefined> {
    const result = await client.query<Row>(
      `SELECT v.*,
              h.latest_version AS head_latest_version,
              h.status AS head_status,
              h.purpose AS head_purpose,
              h.target_kind AS head_target_kind,
              h.active_intent_fingerprint_sha256 AS head_active_intent_fingerprint_sha256,
              h.updated_at AS head_updated_at
         FROM lite_workspace_watch_heads h
         JOIN lite_workspace_watch_versions v
           ON v.workspace_id=h.workspace_id
          AND v.workspace_watch_target_id=h.workspace_watch_target_id
          AND v.version=h.latest_version
        WHERE h.workspace_id=$1
          AND h.status='ACTIVE'
          AND h.active_intent_fingerprint_sha256=$2`,
      [workspaceId, activeFingerprint]
    );
    return result.rows[0] ? latestItemFromRow(result.rows[0]) : undefined;
  }

  private async requireLatest(
    client: QueryClient,
    workspaceId: string,
    id: WorkspaceWatchTargetId
  ): Promise<WorkspaceWatchTargetV1> {
    const result = await client.query<Row>(
      `SELECT v.*,
              h.latest_version AS head_latest_version,
              h.status AS head_status,
              h.purpose AS head_purpose,
              h.target_kind AS head_target_kind,
              h.active_intent_fingerprint_sha256 AS head_active_intent_fingerprint_sha256,
              h.updated_at AS head_updated_at
         FROM lite_workspace_watch_heads h
         JOIN lite_workspace_watch_versions v
           ON v.workspace_id=h.workspace_id
          AND v.workspace_watch_target_id=h.workspace_watch_target_id
          AND v.version=h.latest_version
        WHERE h.workspace_id=$1 AND h.workspace_watch_target_id=$2`,
      [workspaceId, id]
    );
    if (!result.rows[0])
      throw new WorkspaceWatchRuntimeError(
        'NOT_FOUND',
        'Workspace Watch Target was not found.',
        404
      );
    return latestItemFromRow(result.rows[0]);
  }

  private async insertVersion(
    client: QueryClient,
    item: Readonly<WorkspaceWatchTargetV1>,
    activeFingerprint: string
  ): Promise<void> {
    const parsed = parseRuntimeTarget(item, item.workspaceId);
    await client.query(
      `INSERT INTO lite_workspace_watch_versions(
         workspace_id,workspace_watch_target_id,version,status,purpose,target_kind,
         active_intent_fingerprint_sha256,document_json,created_at,updated_at,archived_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)`,
      [
        parsed.workspaceId,
        parsed.workspaceWatchTargetId,
        parsed.version,
        parsed.status,
        parsed.purpose,
        parsed.target.targetKind,
        activeFingerprint,
        JSON.stringify(parsed),
        parsed.createdAt,
        parsed.updatedAt,
        parsed.archivedAt
      ]
    );
  }

  private persistenceError(cause: unknown): WorkspaceWatchRuntimeError {
    return new WorkspaceWatchRuntimeError(
      'PERSISTENCE_UNAVAILABLE',
      'Workspace Watch persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
