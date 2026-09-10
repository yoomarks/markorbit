import { createHash, randomUUID } from 'node:crypto';
import {
  isLiteWorkItemStatusTransitionAllowedV1,
  liteWorkItemPriorities,
  liteWorkItemStatuses,
  noLiteWorkItemAuthorityConsequencesV1,
  parseLiteWorkItemV1,
  type LiteWorkItemCertifiedDeadlineReferenceV1,
  type LiteWorkItemId,
  type LiteWorkItemInternalTimingV1,
  type LiteWorkItemObservedDateCandidateV1,
  type LiteWorkItemPriority,
  type LiteWorkItemRelatedReferenceV1,
  type LiteWorkItemStatus,
  type LiteWorkItemSystemPreparedSourceV1,
  type LiteWorkItemTaskType,
  type LiteWorkItemV1
} from '@markorbit/contracts/lite-work-item';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORK_ITEM_ID = /^lite-work-item_[A-Za-z0-9_-]+$/u;

type Row = Record<string, unknown>;
type CommandType =
  'CREATE_MANUAL' | 'CREATE_SYSTEM_PREPARED' | 'UPDATE_INTERNAL_FIELDS' | 'TRANSITION_STATUS';

export type LiteWorkItemRuntimeErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class LiteWorkItemRuntimeError extends Error {
  constructor(
    readonly code: LiteWorkItemRuntimeErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'LiteWorkItemRuntimeError';
  }
}

export interface LiteWorkItemCreateFields {
  taskType: LiteWorkItemTaskType;
  title: string;
  note?: string;
  priority?: LiteWorkItemPriority;
  assigneePrincipalId?: string;
  relatedReferences?: readonly Readonly<LiteWorkItemRelatedReferenceV1>[];
  certifiedDeadlineReferences?: readonly Readonly<LiteWorkItemCertifiedDeadlineReferenceV1>[];
  observedDateCandidates?: readonly Readonly<LiteWorkItemObservedDateCandidateV1>[];
  internalTiming?: Readonly<LiteWorkItemInternalTimingV1>;
}

export interface CreateManualLiteWorkItemCommand extends LiteWorkItemCreateFields {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
}

export interface CreateSystemPreparedLiteWorkItemCommand extends LiteWorkItemCreateFields {
  workspaceId: string;
  source: Readonly<LiteWorkItemSystemPreparedSourceV1>;
}

export interface UpdateLiteWorkItemInternalFieldsCommand {
  workspaceId: string;
  liteWorkItemId: LiteWorkItemId;
  expectedVersion: number;
  idempotencyKey: string;
  title?: string;
  note?: string | null;
  priority?: LiteWorkItemPriority;
  assigneePrincipalId?: string | null;
  internalTiming?: Readonly<LiteWorkItemInternalTimingV1>;
}

export interface TransitionLiteWorkItemStatusCommand {
  workspaceId: string;
  liteWorkItemId: LiteWorkItemId;
  expectedVersion: number;
  toStatus: LiteWorkItemStatus;
  idempotencyKey: string;
}

export interface ListLiteWorkItemsOptions {
  statuses?: readonly LiteWorkItemStatus[];
  assigneePrincipalId?: string | null;
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
    throw new LiteWorkItemRuntimeError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new LiteWorkItemRuntimeError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  return cleaned;
}

function cleanId(value: LiteWorkItemId): LiteWorkItemId {
  const cleaned = value.trim();
  if (!WORK_ITEM_ID.test(cleaned))
    throw new LiteWorkItemRuntimeError('INVALID_INPUT', 'liteWorkItemId is invalid.', 422);
  return cleaned as LiteWorkItemId;
}

function cleanVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new LiteWorkItemRuntimeError('INVALID_INPUT', 'expectedVersion must be positive.', 422);
  return value;
}

function nowIso(value: string, field = 'now'): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new LiteWorkItemRuntimeError('INVALID_INPUT', `${field} must be an ISO timestamp.`, 422);
  return parsed.toISOString();
}

function defaultTiming(): LiteWorkItemInternalTimingV1 {
  return { timeClass: 'LITE_INTERNAL_OPERATIONAL', certifiedLegalDeadline: false };
}

function defaultCreateFields(fields: Readonly<LiteWorkItemCreateFields>) {
  return {
    taskType: fields.taskType,
    title: fields.title,
    ...(fields.note === undefined ? {} : { note: fields.note }),
    priority: fields.priority ?? 'NOTICE',
    ...(fields.assigneePrincipalId === undefined
      ? {}
      : { assigneePrincipalId: fields.assigneePrincipalId }),
    relatedReferences: fields.relatedReferences ?? [],
    certifiedDeadlineReferences: fields.certifiedDeadlineReferences ?? [],
    observedDateCandidates: fields.observedDateCandidates ?? [],
    internalTiming: fields.internalTiming ?? defaultTiming()
  };
}

function parseRuntimeItem(value: unknown, workspaceId: string): LiteWorkItemV1 {
  try {
    return parseLiteWorkItemV1(value, workspaceId);
  } catch (error) {
    throw new LiteWorkItemRuntimeError(
      'INVALID_INPUT',
      'Lite Work Item contract validation failed.',
      422,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function parsePersistedItem(value: unknown, workspaceId: string): LiteWorkItemV1 {
  try {
    return parseLiteWorkItemV1(value, workspaceId);
  } catch (error) {
    throw new LiteWorkItemRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Lite Work Item failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function manualRequestDescriptor(command: Readonly<CreateManualLiteWorkItemCommand>) {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  const actorPrincipalId = cleanText(command.actorPrincipalId, 'actorPrincipalId', 240);
  const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
  return {
    workspaceId,
    actorPrincipalId,
    idempotencyKey,
    fields: defaultCreateFields(command)
  };
}

export function materializeManualLiteWorkItemV1(
  command: Readonly<CreateManualLiteWorkItemCommand>,
  at: string,
  id: LiteWorkItemId
): LiteWorkItemV1 {
  const descriptor = manualRequestDescriptor(command);
  const createdAt = nowIso(at);
  return parseRuntimeItem(
    {
      schemaVersion: 1,
      liteWorkItemId: cleanId(id),
      workspaceId: descriptor.workspaceId,
      version: 1,
      ...descriptor.fields,
      status: 'OPEN',
      source: {
        sourceClass: 'MANUAL',
        recordedByPrincipalId: descriptor.actorPrincipalId,
        recordedAt: createdAt
      },
      waitingSinceAt: null,
      completedAt: null,
      cancelledAt: null,
      archivedAt: null,
      archivedFrom: null,
      authorityConsequences: noLiteWorkItemAuthorityConsequencesV1,
      createdAt,
      updatedAt: createdAt
    },
    descriptor.workspaceId
  );
}

export function materializeSystemPreparedLiteWorkItemV1(
  command: Readonly<CreateSystemPreparedLiteWorkItemCommand>,
  at: string
): LiteWorkItemV1 {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  const createdAt = nowIso(at);
  const provisional = parseRuntimeItem(
    {
      schemaVersion: 1,
      liteWorkItemId: 'lite-work-item_system-preview',
      workspaceId,
      version: 1,
      ...defaultCreateFields(command),
      status: 'OPEN',
      source: command.source,
      waitingSinceAt: null,
      completedAt: null,
      cancelledAt: null,
      archivedAt: null,
      archivedFrom: null,
      authorityConsequences: noLiteWorkItemAuthorityConsequencesV1,
      createdAt,
      updatedAt: createdAt
    },
    workspaceId
  );
  const deterministic = fingerprint({
    workspaceId,
    source: provisional.source
  }).slice(0, 40);
  return parseRuntimeItem(
    { ...provisional, liteWorkItemId: `lite-work-item_${deterministic}` },
    workspaceId
  );
}

function assertPatchCommand(command: Readonly<UpdateLiteWorkItemInternalFieldsCommand>): void {
  const fields = [
    command.title !== undefined,
    command.note !== undefined,
    command.priority !== undefined,
    command.assigneePrincipalId !== undefined,
    command.internalTiming !== undefined
  ];
  if (!fields.some(Boolean))
    throw new LiteWorkItemRuntimeError(
      'INVALID_INPUT',
      'At least one editable field is required.',
      422
    );
  if (command.title !== undefined) cleanText(command.title, 'title', 500);
  if (command.note !== undefined && command.note !== null) cleanText(command.note, 'note', 4000);
  if (command.priority !== undefined && !liteWorkItemPriorities.includes(command.priority))
    throw new LiteWorkItemRuntimeError('INVALID_INPUT', 'priority is invalid.', 422);
  if (command.assigneePrincipalId !== undefined && command.assigneePrincipalId !== null)
    cleanText(command.assigneePrincipalId, 'assigneePrincipalId', 240);
}

export function applyLiteWorkItemInternalFieldsV1(
  current: Readonly<LiteWorkItemV1>,
  command: Readonly<UpdateLiteWorkItemInternalFieldsCommand>,
  at: string
): LiteWorkItemV1 {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  if (
    current.workspaceId !== workspaceId ||
    current.liteWorkItemId !== cleanId(command.liteWorkItemId)
  )
    throw new LiteWorkItemRuntimeError('NOT_FOUND', 'Lite Work Item was not found.', 404);
  if (current.version !== cleanVersion(command.expectedVersion))
    throw new LiteWorkItemRuntimeError(
      'VERSION_CONFLICT',
      `Expected Lite Work Item version ${command.expectedVersion}, found ${current.version}.`
    );
  assertPatchCommand(command);
  const updatedAt = nowIso(at);
  if (Date.parse(updatedAt) < Date.parse(current.updatedAt))
    throw new LiteWorkItemRuntimeError(
      'INVALID_INPUT',
      'Runtime clock cannot move backwards.',
      422
    );
  return parseRuntimeItem(
    {
      ...clone(current),
      version: current.version + 1,
      ...(command.title === undefined ? {} : { title: command.title }),
      ...(command.note === undefined
        ? {}
        : command.note === null
          ? { note: undefined }
          : { note: command.note }),
      ...(command.priority === undefined ? {} : { priority: command.priority }),
      ...(command.assigneePrincipalId === undefined
        ? {}
        : command.assigneePrincipalId === null
          ? { assigneePrincipalId: undefined }
          : { assigneePrincipalId: command.assigneePrincipalId }),
      ...(command.internalTiming === undefined ? {} : { internalTiming: command.internalTiming }),
      updatedAt
    },
    workspaceId
  );
}

export function applyLiteWorkItemStatusTransitionV1(
  current: Readonly<LiteWorkItemV1>,
  command: Readonly<TransitionLiteWorkItemStatusCommand>,
  at: string
): LiteWorkItemV1 {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  if (
    current.workspaceId !== workspaceId ||
    current.liteWorkItemId !== cleanId(command.liteWorkItemId)
  )
    throw new LiteWorkItemRuntimeError('NOT_FOUND', 'Lite Work Item was not found.', 404);
  if (current.version !== cleanVersion(command.expectedVersion))
    throw new LiteWorkItemRuntimeError(
      'VERSION_CONFLICT',
      `Expected Lite Work Item version ${command.expectedVersion}, found ${current.version}.`
    );
  if (!liteWorkItemStatuses.includes(command.toStatus))
    throw new LiteWorkItemRuntimeError('INVALID_INPUT', 'toStatus is invalid.', 422);
  if (!isLiteWorkItemStatusTransitionAllowedV1(current.status, command.toStatus))
    throw new LiteWorkItemRuntimeError(
      'INVALID_TRANSITION',
      `Lite Work Item cannot transition from ${current.status} to ${command.toStatus}.`
    );
  const updatedAt = nowIso(at);
  if (Date.parse(updatedAt) < Date.parse(current.updatedAt))
    throw new LiteWorkItemRuntimeError(
      'INVALID_INPUT',
      'Runtime clock cannot move backwards.',
      422
    );

  let waitingSinceAt: string | null = null;
  let completedAt = current.completedAt;
  let cancelledAt = current.cancelledAt;
  let archivedAt = current.archivedAt;
  let archivedFrom = current.archivedFrom;

  if (command.toStatus === 'WAITING_FOR_CLIENT' || command.toStatus === 'WAITING_FOR_PROVIDER') {
    waitingSinceAt = updatedAt;
  } else if (command.toStatus === 'COMPLETED') {
    completedAt = updatedAt;
    cancelledAt = null;
    archivedAt = null;
    archivedFrom = null;
  } else if (command.toStatus === 'CANCELLED') {
    completedAt = null;
    cancelledAt = updatedAt;
    archivedAt = null;
    archivedFrom = null;
  } else if (command.toStatus === 'ARCHIVED') {
    archivedAt = updatedAt;
    archivedFrom = current.status as 'COMPLETED' | 'CANCELLED';
  } else {
    completedAt = null;
    cancelledAt = null;
    archivedAt = null;
    archivedFrom = null;
  }

  return parseRuntimeItem(
    {
      ...clone(current),
      version: current.version + 1,
      status: command.toStatus,
      waitingSinceAt,
      completedAt,
      cancelledAt,
      archivedAt,
      archivedFrom,
      updatedAt
    },
    workspaceId
  );
}

function timestampEqual(left: unknown, right: string | undefined): boolean {
  if (right === undefined) return left === null || left === undefined;
  if (left === null || left === undefined) return false;
  const leftTime =
    left instanceof Date ? left.getTime() : typeof left === 'string' ? Date.parse(left) : NaN;
  return Number.isFinite(leftTime) && leftTime === Date.parse(right);
}

function nullableTextEqual(left: unknown, right: string | undefined): boolean {
  return (
    (left === null || left === undefined ? undefined : typeof left === 'string' ? left : null) ===
    right
  );
}

function itemFromRow(row: Row): LiteWorkItemV1 {
  const workspaceId = String(row.workspace_id);
  const item = parsePersistedItem(row.document_json, workspaceId);
  const mismatch =
    item.liteWorkItemId !== String(row.lite_work_item_id) ||
    item.version !== Number(row.version) ||
    item.taskType !== String(row.task_type) ||
    item.status !== String(row.status) ||
    item.priority !== String(row.priority) ||
    item.source.sourceClass !== String(row.source_class) ||
    !nullableTextEqual(row.assignee_principal_id, item.assigneePrincipalId) ||
    !timestampEqual(row.internal_due_at, item.internalTiming.internalDueAt) ||
    !timestampEqual(row.remind_at, item.internalTiming.remindAt) ||
    !timestampEqual(row.follow_up_at, item.internalTiming.followUpAt) ||
    !timestampEqual(row.created_at, item.createdAt) ||
    !timestampEqual(row.updated_at, item.updatedAt);
  if (mismatch)
    throw new LiteWorkItemRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Lite Work Item columns do not match document_json.',
      500
    );
  return item;
}

export class PostgresLiteWorkItemStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly manualId: () => LiteWorkItemId = () =>
      `lite-work-item_${randomUUID().replaceAll('-', '')}`
  ) {}

  async createManual(command: Readonly<CreateManualLiteWorkItemCommand>): Promise<LiteWorkItemV1> {
    const descriptor = manualRequestDescriptor(command);
    const created = materializeManualLiteWorkItemV1(command, this.now(), this.manualId());
    const requestFingerprint = fingerprint({
      commandType: 'CREATE_MANUAL',
      workspaceId: descriptor.workspaceId,
      actorPrincipalId: descriptor.actorPrincipalId,
      fields: {
        taskType: created.taskType,
        title: created.title,
        note: created.note,
        priority: created.priority,
        assigneePrincipalId: created.assigneePrincipalId,
        relatedReferences: created.relatedReferences,
        certifiedDeadlineReferences: created.certifiedDeadlineReferences,
        observedDateCandidates: created.observedDateCandidates,
        internalTiming: created.internalTiming
      }
    });
    return this.command(
      descriptor.workspaceId,
      descriptor.idempotencyKey,
      'CREATE_MANUAL',
      requestFingerprint,
      async (client) => {
        await this.insertItem(client, created);
        return created;
      }
    );
  }

  async createSystemPrepared(
    command: Readonly<CreateSystemPreparedLiteWorkItemCommand>
  ): Promise<LiteWorkItemV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const prepared = materializeSystemPreparedLiteWorkItemV1(command, this.now());
    if (prepared.source.sourceClass !== 'SYSTEM_PREPARED')
      throw new LiteWorkItemRuntimeError('INVALID_INPUT', 'System source is required.', 422);
    const idempotencyKey = cleanText(prepared.source.idempotencyKey, 'source.idempotencyKey', 500);
    const requestFingerprint = fingerprint({
      commandType: 'CREATE_SYSTEM_PREPARED',
      workspaceId,
      source: prepared.source,
      fields: {
        taskType: prepared.taskType,
        title: prepared.title,
        note: prepared.note,
        priority: prepared.priority,
        assigneePrincipalId: prepared.assigneePrincipalId,
        relatedReferences: prepared.relatedReferences,
        certifiedDeadlineReferences: prepared.certifiedDeadlineReferences,
        observedDateCandidates: prepared.observedDateCandidates,
        internalTiming: prepared.internalTiming
      }
    });
    return this.command(
      workspaceId,
      idempotencyKey,
      'CREATE_SYSTEM_PREPARED',
      requestFingerprint,
      async (client) => {
        const existing = await this.findById(client, workspaceId, prepared.liteWorkItemId);
        if (existing)
          throw new LiteWorkItemRuntimeError(
            'INTEGRITY_FAILURE',
            'Deterministic system Work Item exists without its durable command receipt.',
            500
          );
        await this.insertItem(client, prepared);
        return prepared;
      }
    );
  }

  async get(
    workspaceIdValue: string,
    liteWorkItemIdValue: LiteWorkItemId
  ): Promise<LiteWorkItemV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const id = cleanId(liteWorkItemIdValue);
    try {
      const result = await this.query.query<Row>(
        'SELECT * FROM lite_work_items WHERE workspace_id=$1 AND lite_work_item_id=$2',
        [workspaceId, id]
      );
      return result.rows[0] ? itemFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof LiteWorkItemRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async list(
    workspaceIdValue: string,
    options: Readonly<ListLiteWorkItemsOptions> = {}
  ): Promise<readonly LiteWorkItemV1[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const limit = options.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new LiteWorkItemRuntimeError('INVALID_INPUT', 'limit must be between 1 and 100.', 422);
    const statuses = options.statuses ? [...new Set(options.statuses)] : undefined;
    if (statuses?.some((status) => !liteWorkItemStatuses.includes(status)))
      throw new LiteWorkItemRuntimeError(
        'INVALID_INPUT',
        'statuses contains an invalid status.',
        422
      );
    const hasAssigneeFilter = options.assigneePrincipalId !== undefined;
    const assignee =
      options.assigneePrincipalId === undefined || options.assigneePrincipalId === null
        ? null
        : cleanText(options.assigneePrincipalId, 'assigneePrincipalId', 240);
    try {
      const result = await this.query.query<Row>(
        `SELECT * FROM lite_work_items
         WHERE workspace_id=$1
           AND ($2::text[] IS NULL OR status = ANY($2::text[]))
           AND ($3::boolean = false OR assignee_principal_id IS NOT DISTINCT FROM $4::text)
         ORDER BY COALESCE(LEAST(internal_due_at, follow_up_at, remind_at), 'infinity'::timestamptz) ASC,
                  created_at ASC,
                  lite_work_item_id ASC
         LIMIT $5`,
        [workspaceId, statuses ?? null, hasAssigneeFilter, assignee, limit]
      );
      return result.rows.map(itemFromRow);
    } catch (error) {
      if (error instanceof LiteWorkItemRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async updateInternalFields(
    command: Readonly<UpdateLiteWorkItemInternalFieldsCommand>
  ): Promise<LiteWorkItemV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const id = cleanId(command.liteWorkItemId);
    const expectedVersion = cleanVersion(command.expectedVersion);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    assertPatchCommand(command);
    const requestFingerprint = fingerprint({
      commandType: 'UPDATE_INTERNAL_FIELDS',
      workspaceId,
      id,
      expectedVersion,
      title: command.title,
      note: command.note,
      priority: command.priority,
      assigneePrincipalId: command.assigneePrincipalId,
      internalTiming: command.internalTiming
    });
    return this.command(
      workspaceId,
      idempotencyKey,
      'UPDATE_INTERNAL_FIELDS',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:work-item:${id}`);
        const current = await this.requireCurrent(client, workspaceId, id);
        const next = applyLiteWorkItemInternalFieldsV1(current, command, this.now());
        await this.replaceItem(client, current.version, next);
        return next;
      }
    );
  }

  async transitionStatus(
    command: Readonly<TransitionLiteWorkItemStatusCommand>
  ): Promise<LiteWorkItemV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const id = cleanId(command.liteWorkItemId);
    const expectedVersion = cleanVersion(command.expectedVersion);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const requestFingerprint = fingerprint({
      commandType: 'TRANSITION_STATUS',
      workspaceId,
      id,
      expectedVersion,
      toStatus: command.toStatus
    });
    return this.command(
      workspaceId,
      idempotencyKey,
      'TRANSITION_STATUS',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:work-item:${id}`);
        const current = await this.requireCurrent(client, workspaceId, id);
        const next = applyLiteWorkItemStatusTransitionV1(current, command, this.now());
        await this.replaceItem(client, current.version, next);
        return next;
      }
    );
  }

  private async command(
    workspaceId: string,
    idempotencyKey: string,
    commandType: CommandType,
    requestFingerprint: string,
    write: (client: QueryClient) => Promise<LiteWorkItemV1>
  ): Promise<LiteWorkItemV1> {
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(client, `${workspaceId}:work-item-idempotency:${idempotencyKey}`);
        const replay = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_work_item_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0];
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new LiteWorkItemRuntimeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Lite Work Item command.'
            );
          return parsePersistedItem(prior.result_json, workspaceId);
        }
        const result = await write(client);
        await client.query(
          `INSERT INTO lite_work_item_commands(
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
      if (error instanceof LiteWorkItemRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async resourceLock(client: QueryClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }

  private async findById(
    client: QueryClient,
    workspaceId: string,
    id: LiteWorkItemId
  ): Promise<LiteWorkItemV1 | undefined> {
    const result = await client.query<Row>(
      'SELECT * FROM lite_work_items WHERE workspace_id=$1 AND lite_work_item_id=$2',
      [workspaceId, id]
    );
    return result.rows[0] ? itemFromRow(result.rows[0]) : undefined;
  }

  private async requireCurrent(
    client: QueryClient,
    workspaceId: string,
    id: LiteWorkItemId
  ): Promise<LiteWorkItemV1> {
    const item = await this.findById(client, workspaceId, id);
    if (!item)
      throw new LiteWorkItemRuntimeError('NOT_FOUND', 'Lite Work Item was not found.', 404);
    return item;
  }

  private async insertItem(client: QueryClient, item: Readonly<LiteWorkItemV1>): Promise<void> {
    const parsed = parseRuntimeItem(item, item.workspaceId);
    await client.query(
      `INSERT INTO lite_work_items(
         workspace_id,lite_work_item_id,version,task_type,status,priority,assignee_principal_id,
         source_class,internal_due_at,remind_at,follow_up_at,document_json,created_at,updated_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)`,
      [
        parsed.workspaceId,
        parsed.liteWorkItemId,
        parsed.version,
        parsed.taskType,
        parsed.status,
        parsed.priority,
        parsed.assigneePrincipalId ?? null,
        parsed.source.sourceClass,
        parsed.internalTiming.internalDueAt ?? null,
        parsed.internalTiming.remindAt ?? null,
        parsed.internalTiming.followUpAt ?? null,
        JSON.stringify(parsed),
        parsed.createdAt,
        parsed.updatedAt
      ]
    );
  }

  private async replaceItem(
    client: QueryClient,
    expectedVersion: number,
    item: Readonly<LiteWorkItemV1>
  ): Promise<void> {
    const parsed = parseRuntimeItem(item, item.workspaceId);
    const result = await client.query(
      `UPDATE lite_work_items SET
         version=$3,task_type=$4,status=$5,priority=$6,assignee_principal_id=$7,
         source_class=$8,internal_due_at=$9,remind_at=$10,follow_up_at=$11,
         document_json=$12::jsonb,updated_at=$13
       WHERE workspace_id=$1 AND lite_work_item_id=$2 AND version=$14`,
      [
        parsed.workspaceId,
        parsed.liteWorkItemId,
        parsed.version,
        parsed.taskType,
        parsed.status,
        parsed.priority,
        parsed.assigneePrincipalId ?? null,
        parsed.source.sourceClass,
        parsed.internalTiming.internalDueAt ?? null,
        parsed.internalTiming.remindAt ?? null,
        parsed.internalTiming.followUpAt ?? null,
        JSON.stringify(parsed),
        parsed.updatedAt,
        expectedVersion
      ]
    );
    if (result.rowCount !== 1)
      throw new LiteWorkItemRuntimeError(
        'VERSION_CONFLICT',
        'Lite Work Item changed before the update could be persisted.'
      );
  }

  private persistenceError(cause: unknown): LiteWorkItemRuntimeError {
    return new LiteWorkItemRuntimeError(
      'PERSISTENCE_UNAVAILABLE',
      'Lite Work Item persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
