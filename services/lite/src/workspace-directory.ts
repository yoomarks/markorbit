import { createHash, randomUUID } from 'node:crypto';
import {
  noWorkspaceDirectoryAuthorityConsequencesV1,
  parseWorkspaceDirectoryEntryV1,
  workspaceDirectoryEntryKinds,
  workspaceDirectoryEntryStatuses,
  type WorkspaceDirectoryContactPointV1,
  type WorkspaceDirectoryCustomerRelationshipReferenceV1,
  type WorkspaceDirectoryEntryId,
  type WorkspaceDirectoryEntryKind,
  type WorkspaceDirectoryEntryStatus,
  type WorkspaceDirectoryEntryV1,
  type WorkspaceDirectoryExternalIdentityReferenceV1,
  type WorkspaceDirectoryLocalProvenanceV1,
  type WorkspaceDirectoryOperationalRole,
  type WorkspaceDirectoryProviderReferenceV1
} from '@markorbit/contracts/workspace-directory';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIRECTORY_ENTRY_ID = /^workspace-directory-entry_[A-Za-z0-9_-]+$/u;

type Row = Record<string, unknown>;
type CommandType = 'CREATE' | 'UPDATE' | 'ARCHIVE';

export type WorkspaceDirectoryRuntimeErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class WorkspaceDirectoryRuntimeError extends Error {
  constructor(
    readonly code: WorkspaceDirectoryRuntimeErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceDirectoryRuntimeError';
  }
}

export interface CreateWorkspaceDirectoryEntryCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  entryKind: WorkspaceDirectoryEntryKind;
  displayName: string;
  aliases?: readonly string[];
  roles?: readonly WorkspaceDirectoryOperationalRole[];
  contactPoints?: ReadonlyArray<Readonly<WorkspaceDirectoryContactPointV1>>;
  customerRelationship?: Readonly<WorkspaceDirectoryCustomerRelationshipReferenceV1>;
  provider?: Readonly<WorkspaceDirectoryProviderReferenceV1>;
  externalIdentityReferences?: ReadonlyArray<
    Readonly<WorkspaceDirectoryExternalIdentityReferenceV1>
  >;
  provenance?: Readonly<WorkspaceDirectoryLocalProvenanceV1>;
}

export interface UpdateWorkspaceDirectoryEntryCommand {
  workspaceId: string;
  actorPrincipalId: string;
  workspaceDirectoryEntryId: WorkspaceDirectoryEntryId;
  expectedVersion: number;
  idempotencyKey: string;
  entryKind?: WorkspaceDirectoryEntryKind;
  displayName?: string;
  aliases?: readonly string[];
  roles?: readonly WorkspaceDirectoryOperationalRole[];
  contactPoints?: ReadonlyArray<Readonly<WorkspaceDirectoryContactPointV1>>;
  customerRelationship?: Readonly<WorkspaceDirectoryCustomerRelationshipReferenceV1> | null;
  provider?: Readonly<WorkspaceDirectoryProviderReferenceV1> | null;
  externalIdentityReferences?: ReadonlyArray<
    Readonly<WorkspaceDirectoryExternalIdentityReferenceV1>
  >;
  provenance?: Readonly<WorkspaceDirectoryLocalProvenanceV1>;
}

export interface ArchiveWorkspaceDirectoryEntryCommand {
  workspaceId: string;
  workspaceDirectoryEntryId: WorkspaceDirectoryEntryId;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface ListWorkspaceDirectoryEntriesOptions {
  status?: WorkspaceDirectoryEntryStatus;
  entryKind?: WorkspaceDirectoryEntryKind;
  query?: string;
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
    throw new WorkspaceDirectoryRuntimeError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new WorkspaceDirectoryRuntimeError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  return cleaned;
}

function cleanDirectoryEntryId(value: WorkspaceDirectoryEntryId): WorkspaceDirectoryEntryId {
  const cleaned = value.trim();
  if (!DIRECTORY_ENTRY_ID.test(cleaned))
    throw new WorkspaceDirectoryRuntimeError(
      'INVALID_INPUT',
      'workspaceDirectoryEntryId is invalid.',
      422
    );
  return cleaned as WorkspaceDirectoryEntryId;
}

function cleanVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new WorkspaceDirectoryRuntimeError(
      'INVALID_INPUT',
      'expectedVersion must be a positive safe integer.',
      422
    );
  return value;
}

function nowIso(value: string, field = 'now'): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new WorkspaceDirectoryRuntimeError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  return parsed.toISOString();
}

function cleanEntryKind(value: WorkspaceDirectoryEntryKind): WorkspaceDirectoryEntryKind {
  if (!workspaceDirectoryEntryKinds.includes(value))
    throw new WorkspaceDirectoryRuntimeError('INVALID_INPUT', 'entryKind is invalid.', 422);
  return value;
}

function cleanStatus(value: WorkspaceDirectoryEntryStatus): WorkspaceDirectoryEntryStatus {
  if (!workspaceDirectoryEntryStatuses.includes(value))
    throw new WorkspaceDirectoryRuntimeError('INVALID_INPUT', 'status is invalid.', 422);
  return value;
}

export function normalizeWorkspaceDirectoryLocalName(value: string): string {
  return cleanText(value, 'name', 300).normalize('NFKC').replace(/\s+/gu, ' ').toLowerCase();
}

function normalizedNames(
  item: Pick<WorkspaceDirectoryEntryV1, 'displayName' | 'aliases'>
): readonly string[] {
  return [
    ...new Set([
      normalizeWorkspaceDirectoryLocalName(item.displayName),
      ...item.aliases.map(normalizeWorkspaceDirectoryLocalName)
    ])
  ];
}

function defaultProvenance(
  actorPrincipalId: string,
  at: string
): WorkspaceDirectoryLocalProvenanceV1 {
  return {
    sourceKind: 'WORKSPACE_USER',
    sourceReference: `workspace-principal:${cleanText(actorPrincipalId, 'actorPrincipalId', 240)}`,
    capturedAt: at
  };
}

function parseRuntimeEntry(value: unknown, workspaceId: string): WorkspaceDirectoryEntryV1 {
  try {
    return parseWorkspaceDirectoryEntryV1(value, workspaceId);
  } catch (error) {
    throw new WorkspaceDirectoryRuntimeError(
      'INVALID_INPUT',
      'Workspace Directory entry contract validation failed.',
      422,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function parsePersistedEntry(value: unknown, workspaceId: string): WorkspaceDirectoryEntryV1 {
  try {
    return parseWorkspaceDirectoryEntryV1(value, workspaceId);
  } catch (error) {
    throw new WorkspaceDirectoryRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Workspace Directory entry failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

export function materializeWorkspaceDirectoryEntryV1(
  command: Readonly<CreateWorkspaceDirectoryEntryCommand>,
  at: string,
  id: WorkspaceDirectoryEntryId
): WorkspaceDirectoryEntryV1 {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  const createdAt = nowIso(at);
  return parseRuntimeEntry(
    {
      schemaVersion: 1,
      workspaceDirectoryEntryId: cleanDirectoryEntryId(id),
      workspaceId,
      version: 1,
      entryKind: cleanEntryKind(command.entryKind),
      displayName: cleanText(command.displayName, 'displayName', 300),
      aliases: clone(command.aliases ?? []),
      status: 'ACTIVE',
      roles: clone(command.roles ?? []),
      contactPoints: clone(command.contactPoints ?? []),
      ...(command.customerRelationship === undefined
        ? {}
        : { customerRelationship: clone(command.customerRelationship) }),
      ...(command.provider === undefined ? {} : { provider: clone(command.provider) }),
      externalIdentityReferences: clone(command.externalIdentityReferences ?? []),
      provenance: clone(
        command.provenance ?? defaultProvenance(command.actorPrincipalId, createdAt)
      ),
      authorityConsequences: noWorkspaceDirectoryAuthorityConsequencesV1,
      createdAt,
      updatedAt: createdAt,
      archivedAt: null
    },
    workspaceId
  );
}

function hasUpdate(command: Readonly<UpdateWorkspaceDirectoryEntryCommand>): boolean {
  return [
    command.entryKind,
    command.displayName,
    command.aliases,
    command.roles,
    command.contactPoints,
    command.customerRelationship,
    command.provider,
    command.externalIdentityReferences,
    command.provenance
  ].some((value) => value !== undefined);
}

export function materializeUpdatedWorkspaceDirectoryEntryV1(
  current: Readonly<WorkspaceDirectoryEntryV1>,
  command: Readonly<UpdateWorkspaceDirectoryEntryCommand>,
  at: string
): WorkspaceDirectoryEntryV1 {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  if (
    current.workspaceId !== workspaceId ||
    current.workspaceDirectoryEntryId !== cleanDirectoryEntryId(command.workspaceDirectoryEntryId)
  )
    throw new WorkspaceDirectoryRuntimeError(
      'NOT_FOUND',
      'Workspace Directory entry was not found.',
      404
    );
  if (current.version !== cleanVersion(command.expectedVersion))
    throw new WorkspaceDirectoryRuntimeError(
      'VERSION_CONFLICT',
      `Expected Directory entry version ${command.expectedVersion}, found ${current.version}.`
    );
  if (current.status !== 'ACTIVE')
    throw new WorkspaceDirectoryRuntimeError(
      'INVALID_TRANSITION',
      'Archived Workspace Directory entries cannot be updated.'
    );
  if (!hasUpdate(command))
    throw new WorkspaceDirectoryRuntimeError(
      'INVALID_INPUT',
      'Update must change at least one mutable Directory field.',
      422
    );

  const updatedAt = nowIso(at);
  if (Date.parse(updatedAt) < Date.parse(current.updatedAt))
    throw new WorkspaceDirectoryRuntimeError(
      'INVALID_INPUT',
      'Runtime clock cannot move backwards.',
      422
    );

  const customerRelationship =
    command.customerRelationship === undefined
      ? current.customerRelationship
      : command.customerRelationship === null
        ? undefined
        : command.customerRelationship;
  const provider =
    command.provider === undefined
      ? current.provider
      : command.provider === null
        ? undefined
        : command.provider;

  return parseRuntimeEntry(
    {
      schemaVersion: 1,
      workspaceDirectoryEntryId: current.workspaceDirectoryEntryId,
      workspaceId,
      version: current.version + 1,
      entryKind:
        command.entryKind === undefined ? current.entryKind : cleanEntryKind(command.entryKind),
      displayName:
        command.displayName === undefined
          ? current.displayName
          : cleanText(command.displayName, 'displayName', 300),
      aliases: clone(command.aliases ?? current.aliases),
      status: 'ACTIVE',
      roles: clone(command.roles ?? current.roles),
      contactPoints: clone(command.contactPoints ?? current.contactPoints),
      ...(customerRelationship === undefined
        ? {}
        : { customerRelationship: clone(customerRelationship) }),
      ...(provider === undefined ? {} : { provider: clone(provider) }),
      externalIdentityReferences: clone(
        command.externalIdentityReferences ?? current.externalIdentityReferences
      ),
      provenance: clone(command.provenance ?? current.provenance),
      authorityConsequences: noWorkspaceDirectoryAuthorityConsequencesV1,
      createdAt: current.createdAt,
      updatedAt,
      archivedAt: null
    },
    workspaceId
  );
}

export function materializeArchivedWorkspaceDirectoryEntryV1(
  current: Readonly<WorkspaceDirectoryEntryV1>,
  command: Readonly<ArchiveWorkspaceDirectoryEntryCommand>,
  at: string
): WorkspaceDirectoryEntryV1 {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  if (
    current.workspaceId !== workspaceId ||
    current.workspaceDirectoryEntryId !== cleanDirectoryEntryId(command.workspaceDirectoryEntryId)
  )
    throw new WorkspaceDirectoryRuntimeError(
      'NOT_FOUND',
      'Workspace Directory entry was not found.',
      404
    );
  if (current.version !== cleanVersion(command.expectedVersion))
    throw new WorkspaceDirectoryRuntimeError(
      'VERSION_CONFLICT',
      `Expected Directory entry version ${command.expectedVersion}, found ${current.version}.`
    );
  if (current.status !== 'ACTIVE')
    throw new WorkspaceDirectoryRuntimeError(
      'INVALID_TRANSITION',
      'Workspace Directory entry is already archived.'
    );
  const updatedAt = nowIso(at);
  if (Date.parse(updatedAt) < Date.parse(current.updatedAt))
    throw new WorkspaceDirectoryRuntimeError(
      'INVALID_INPUT',
      'Runtime clock cannot move backwards.',
      422
    );
  return parseRuntimeEntry(
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

function timestampEqual(left: unknown, right: string | null): boolean {
  if (right === null) return left === null || left === undefined;
  if (left === null || left === undefined) return false;
  const leftTime =
    left instanceof Date ? left.getTime() : typeof left === 'string' ? Date.parse(left) : NaN;
  return Number.isFinite(leftTime) && leftTime === Date.parse(right);
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string'))
    throw new WorkspaceDirectoryRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted normalized Directory names are invalid.',
      500
    );
  return value as string[];
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function versionItemFromRow(row: Row): WorkspaceDirectoryEntryV1 {
  const workspaceId = String(row.workspace_id);
  const item = parsePersistedEntry(row.document_json, workspaceId);
  const names = normalizedNames(item);
  const mismatch =
    item.workspaceDirectoryEntryId !== String(row.workspace_directory_entry_id) ||
    item.version !== Number(row.version) ||
    item.status !== String(row.status) ||
    item.entryKind !== String(row.entry_kind) ||
    normalizeWorkspaceDirectoryLocalName(item.displayName) !==
      String(row.normalized_display_name) ||
    !sameStrings(names, stringArray(row.normalized_names)) ||
    !timestampEqual(row.created_at, item.createdAt) ||
    !timestampEqual(row.updated_at, item.updatedAt) ||
    !timestampEqual(row.archived_at, item.archivedAt);
  if (mismatch)
    throw new WorkspaceDirectoryRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Workspace Directory columns do not match document_json.',
      500
    );
  return item;
}

function latestItemFromRow(row: Row): WorkspaceDirectoryEntryV1 {
  const item = versionItemFromRow(row);
  const names = normalizedNames(item);
  const mismatch =
    item.version !== Number(row.head_latest_version) ||
    item.status !== String(row.head_status) ||
    item.entryKind !== String(row.head_entry_kind) ||
    normalizeWorkspaceDirectoryLocalName(item.displayName) !==
      String(row.head_normalized_display_name) ||
    !sameStrings(names, stringArray(row.head_normalized_names)) ||
    !timestampEqual(row.head_updated_at, item.updatedAt);
  if (mismatch)
    throw new WorkspaceDirectoryRuntimeError(
      'INTEGRITY_FAILURE',
      'Workspace Directory head does not match its latest durable version.',
      500
    );
  return item;
}

export class PostgresWorkspaceDirectoryStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => WorkspaceDirectoryEntryId = () =>
      `workspace-directory-entry_${randomUUID().replaceAll('-', '')}`
  ) {}

  async create(
    command: Readonly<CreateWorkspaceDirectoryEntryCommand>
  ): Promise<WorkspaceDirectoryEntryV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const requestFingerprint = fingerprint({
      commandType: 'CREATE',
      workspaceId,
      actorPrincipalId: cleanText(command.actorPrincipalId, 'actorPrincipalId', 240),
      entryKind: command.entryKind,
      displayName: command.displayName,
      aliases: command.aliases ?? [],
      roles: command.roles ?? [],
      contactPoints: command.contactPoints ?? [],
      customerRelationship: command.customerRelationship ?? null,
      provider: command.provider ?? null,
      externalIdentityReferences: command.externalIdentityReferences ?? [],
      provenance: command.provenance ?? null
    });

    return this.command(
      workspaceId,
      idempotencyKey,
      'CREATE',
      requestFingerprint,
      async (client) => {
        const created = materializeWorkspaceDirectoryEntryV1(command, this.now(), this.id());
        const names = normalizedNames(created);
        await this.insertVersion(client, created, names);
        await client.query(
          `INSERT INTO lite_workspace_directory_heads(
             workspace_id,workspace_directory_entry_id,latest_version,status,entry_kind,
             normalized_display_name,normalized_names,updated_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            created.workspaceId,
            created.workspaceDirectoryEntryId,
            created.version,
            created.status,
            created.entryKind,
            names[0],
            names,
            created.updatedAt
          ]
        );
        return created;
      }
    );
  }

  async update(
    command: Readonly<UpdateWorkspaceDirectoryEntryCommand>
  ): Promise<WorkspaceDirectoryEntryV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const id = cleanDirectoryEntryId(command.workspaceDirectoryEntryId);
    const expectedVersion = cleanVersion(command.expectedVersion);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const requestFingerprint = fingerprint({
      commandType: 'UPDATE',
      workspaceId,
      workspaceDirectoryEntryId: id,
      expectedVersion,
      actorPrincipalId: cleanText(command.actorPrincipalId, 'actorPrincipalId', 240),
      entryKind: command.entryKind,
      displayName: command.displayName,
      aliases: command.aliases,
      roles: command.roles,
      contactPoints: command.contactPoints,
      customerRelationship: command.customerRelationship,
      provider: command.provider,
      externalIdentityReferences: command.externalIdentityReferences,
      provenance: command.provenance
    });

    return this.command(
      workspaceId,
      idempotencyKey,
      'UPDATE',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:directory-entry:${id}`);
        const current = await this.requireLatest(client, workspaceId, id);
        const next = materializeUpdatedWorkspaceDirectoryEntryV1(current, command, this.now());
        const names = normalizedNames(next);
        await this.insertVersion(client, next, names);
        const updated = await client.query(
          `UPDATE lite_workspace_directory_heads
              SET latest_version=$3,status=$4,entry_kind=$5,normalized_display_name=$6,
                  normalized_names=$7,updated_at=$8
            WHERE workspace_id=$1 AND workspace_directory_entry_id=$2 AND latest_version=$9`,
          [
            workspaceId,
            id,
            next.version,
            next.status,
            next.entryKind,
            names[0],
            names,
            next.updatedAt,
            expectedVersion
          ]
        );
        if (updated.rowCount !== 1)
          throw new WorkspaceDirectoryRuntimeError(
            'VERSION_CONFLICT',
            'Workspace Directory entry changed before update could be persisted.'
          );
        return next;
      }
    );
  }

  async archive(
    command: Readonly<ArchiveWorkspaceDirectoryEntryCommand>
  ): Promise<WorkspaceDirectoryEntryV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const id = cleanDirectoryEntryId(command.workspaceDirectoryEntryId);
    const expectedVersion = cleanVersion(command.expectedVersion);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const requestFingerprint = fingerprint({
      commandType: 'ARCHIVE',
      workspaceId,
      workspaceDirectoryEntryId: id,
      expectedVersion
    });

    return this.command(
      workspaceId,
      idempotencyKey,
      'ARCHIVE',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:directory-entry:${id}`);
        const current = await this.requireLatest(client, workspaceId, id);
        const next = materializeArchivedWorkspaceDirectoryEntryV1(current, command, this.now());
        const names = normalizedNames(next);
        await this.insertVersion(client, next, names);
        const updated = await client.query(
          `UPDATE lite_workspace_directory_heads
              SET latest_version=$3,status=$4,entry_kind=$5,normalized_display_name=$6,
                  normalized_names=$7,updated_at=$8
            WHERE workspace_id=$1 AND workspace_directory_entry_id=$2 AND latest_version=$9`,
          [
            workspaceId,
            id,
            next.version,
            next.status,
            next.entryKind,
            names[0],
            names,
            next.updatedAt,
            expectedVersion
          ]
        );
        if (updated.rowCount !== 1)
          throw new WorkspaceDirectoryRuntimeError(
            'VERSION_CONFLICT',
            'Workspace Directory entry changed before archive could be persisted.'
          );
        return next;
      }
    );
  }

  async getExact(
    workspaceIdValue: string,
    workspaceDirectoryEntryIdValue: WorkspaceDirectoryEntryId,
    versionValue: number
  ): Promise<WorkspaceDirectoryEntryV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const id = cleanDirectoryEntryId(workspaceDirectoryEntryIdValue);
    const version = cleanVersion(versionValue);
    try {
      const result = await this.query.query<Row>(
        `SELECT * FROM lite_workspace_directory_versions
          WHERE workspace_id=$1 AND workspace_directory_entry_id=$2 AND version=$3`,
        [workspaceId, id, version]
      );
      return result.rows[0] ? versionItemFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof WorkspaceDirectoryRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async getLatest(
    workspaceIdValue: string,
    workspaceDirectoryEntryIdValue: WorkspaceDirectoryEntryId
  ): Promise<WorkspaceDirectoryEntryV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const id = cleanDirectoryEntryId(workspaceDirectoryEntryIdValue);
    try {
      const result = await this.query.query<Row>(
        this.latestSelect('WHERE h.workspace_id=$1 AND h.workspace_directory_entry_id=$2'),
        [workspaceId, id]
      );
      return result.rows[0] ? latestItemFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof WorkspaceDirectoryRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async listLatest(
    workspaceIdValue: string,
    options: Readonly<ListWorkspaceDirectoryEntriesOptions> = {}
  ): Promise<readonly WorkspaceDirectoryEntryV1[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const limit = options.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new WorkspaceDirectoryRuntimeError(
        'INVALID_INPUT',
        'limit must be between 1 and 100.',
        422
      );
    const status = options.status === undefined ? null : cleanStatus(options.status);
    const entryKind = options.entryKind === undefined ? null : cleanEntryKind(options.entryKind);
    const search =
      options.query === undefined ? null : normalizeWorkspaceDirectoryLocalName(options.query);

    try {
      const result = await this.query.query<Row>(
        `${this.latestSelect('')}
          WHERE h.workspace_id=$1
            AND ($2::text IS NULL OR h.status=$2)
            AND ($3::text IS NULL OR h.entry_kind=$3)
            AND (
              $4::text IS NULL
              OR $4 = ANY(h.normalized_names)
              OR EXISTS (
                SELECT 1
                  FROM unnest(h.normalized_names) AS n(name)
                 WHERE left(n.name, char_length($4))=$4
              )
            )
          ORDER BY
            CASE WHEN $4::text IS NOT NULL AND $4 = ANY(h.normalized_names) THEN 0 ELSE 1 END,
            h.normalized_display_name ASC,
            h.workspace_directory_entry_id ASC
          LIMIT $5`,
        [workspaceId, status, entryKind, search, limit]
      );
      return result.rows.map(latestItemFromRow);
    } catch (error) {
      if (error instanceof WorkspaceDirectoryRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  private latestSelect(where: string): string {
    return `SELECT v.*,
                   h.latest_version AS head_latest_version,
                   h.status AS head_status,
                   h.entry_kind AS head_entry_kind,
                   h.normalized_display_name AS head_normalized_display_name,
                   h.normalized_names AS head_normalized_names,
                   h.updated_at AS head_updated_at
              FROM lite_workspace_directory_heads h
              JOIN lite_workspace_directory_versions v
                ON v.workspace_id=h.workspace_id
               AND v.workspace_directory_entry_id=h.workspace_directory_entry_id
               AND v.version=h.latest_version
             ${where}`;
  }

  private async command(
    workspaceId: string,
    idempotencyKey: string,
    commandType: CommandType,
    requestFingerprint: string,
    write: (client: QueryClient) => Promise<WorkspaceDirectoryEntryV1>
  ): Promise<WorkspaceDirectoryEntryV1> {
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(client, `${workspaceId}:directory-idempotency:${idempotencyKey}`);
        const replay = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_workspace_directory_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0];
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new WorkspaceDirectoryRuntimeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Workspace Directory command.'
            );
          return parsePersistedEntry(prior.result_json, workspaceId);
        }

        const result = await write(client);
        await client.query(
          `INSERT INTO lite_workspace_directory_commands(
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
      if (error instanceof WorkspaceDirectoryRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async resourceLock(client: QueryClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }

  private async requireLatest(
    client: QueryClient,
    workspaceId: string,
    id: WorkspaceDirectoryEntryId
  ): Promise<WorkspaceDirectoryEntryV1> {
    const result = await client.query<Row>(
      this.latestSelect('WHERE h.workspace_id=$1 AND h.workspace_directory_entry_id=$2'),
      [workspaceId, id]
    );
    if (!result.rows[0])
      throw new WorkspaceDirectoryRuntimeError(
        'NOT_FOUND',
        'Workspace Directory entry was not found.',
        404
      );
    return latestItemFromRow(result.rows[0]);
  }

  private async insertVersion(
    client: QueryClient,
    item: Readonly<WorkspaceDirectoryEntryV1>,
    names: readonly string[]
  ): Promise<void> {
    const parsed = parseRuntimeEntry(item, item.workspaceId);
    await client.query(
      `INSERT INTO lite_workspace_directory_versions(
         workspace_id,workspace_directory_entry_id,version,status,entry_kind,
         normalized_display_name,normalized_names,document_json,created_at,updated_at,archived_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)`,
      [
        parsed.workspaceId,
        parsed.workspaceDirectoryEntryId,
        parsed.version,
        parsed.status,
        parsed.entryKind,
        names[0],
        names,
        JSON.stringify(parsed),
        parsed.createdAt,
        parsed.updatedAt,
        parsed.archivedAt
      ]
    );
  }

  private persistenceError(cause: unknown): WorkspaceDirectoryRuntimeError {
    return new WorkspaceDirectoryRuntimeError(
      'PERSISTENCE_UNAVAILABLE',
      'Workspace Directory persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
