import { createHash, randomUUID } from 'node:crypto';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  communicationLinkDecisionFingerprintSha256V1,
  isCommunicationLinkThreadInheritanceEligibleV1,
  noCommunicationLinkAuthorityConsequencesV1,
  parseCommunicationLinkV1,
  type CommunicationLinkDecisionBasis,
  type CommunicationLinkDecisionStatus,
  type CommunicationLinkId,
  type CommunicationLinkLifecycle,
  type CommunicationLinkSourceReferenceV1,
  type CommunicationLinkTargetKind,
  type CommunicationLinkTargetReferenceV1,
  type CommunicationLinkV1
} from '@markorbit/contracts/communication-link';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';
import type {
  CommunicationLinkThreadAssociationEvidence,
  CommunicationLinkThreadAssociationLookup
} from './communication-link-resolver.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const LINK_ID = /^communication-link_[A-Za-z0-9_-]+$/u;
type Row = Record<string, unknown>;
type CommandType = 'CREATE' | 'ARCHIVE';

export type CommunicationLinkRuntimeErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'ACTIVE_SUBJECT_CONFLICT'
  | 'INTEGRITY_FAILURE'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_MISMATCH'
  | 'SOURCE_UNAVAILABLE'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_VERSION_STALE'
  | 'TARGET_OWNER_UNAVAILABLE'
  | 'TARGET_UNAVAILABLE'
  | 'PERSISTENCE_UNAVAILABLE';

export class CommunicationLinkRuntimeError extends Error {
  constructor(
    readonly code: CommunicationLinkRuntimeErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'CommunicationLinkRuntimeError';
  }
}

export interface CreateCommunicationLinkCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  source: Readonly<CommunicationLinkSourceReferenceV1>;
  target: Readonly<CommunicationLinkTargetReferenceV1>;
  decisionStatus: CommunicationLinkDecisionStatus;
  decisionBasis: CommunicationLinkDecisionBasis;
  reason?: string | null;
  evidenceReferences?: readonly string[];
}

export interface ArchiveCommunicationLinkCommand {
  workspaceId: string;
  communicationLinkId: CommunicationLinkId;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface ListCommunicationLinksOptions {
  lifecycle?: CommunicationLinkLifecycle;
  targetKind?: CommunicationLinkTargetKind;
  sourceScope?: 'MESSAGE' | 'THREAD';
  accountRef?: string;
  threadRef?: string;
  limit?: number;
}

export interface CommunicationLinkOwnerValidator {
  validateCreate(
    input: Readonly<{
      workspaceId: string;
      source: Readonly<CommunicationLinkSourceReferenceV1>;
      target: Readonly<CommunicationLinkTargetReferenceV1>;
      principal: Readonly<WorkspacePrincipal>;
    }>
  ): Promise<void>;
}

const clone = <T>(value: T): T => structuredClone(value);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
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
    throw new CommunicationLinkRuntimeError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new CommunicationLinkRuntimeError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  return cleaned;
}

function cleanLinkId(value: CommunicationLinkId): CommunicationLinkId {
  const cleaned = value.trim();
  if (!LINK_ID.test(cleaned))
    throw new CommunicationLinkRuntimeError(
      'INVALID_INPUT',
      'communicationLinkId is invalid.',
      422
    );
  return cleaned as CommunicationLinkId;
}

function cleanVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new CommunicationLinkRuntimeError(
      'INVALID_INPUT',
      'expectedVersion must be a positive safe integer.',
      422
    );
  return value;
}

function iso(value: string, field = 'timestamp'): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new CommunicationLinkRuntimeError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  return parsed.toISOString();
}

function parseRuntime(value: unknown, workspaceId: string): CommunicationLinkV1 {
  try {
    return parseCommunicationLinkV1(value, workspaceId);
  } catch (error) {
    throw new CommunicationLinkRuntimeError(
      'INVALID_INPUT',
      'Communication Link contract validation failed.',
      422,
      false,
      {
        cause: error instanceof Error ? error : undefined
      }
    );
  }
}

function parsePersisted(value: unknown, workspaceId: string): CommunicationLinkV1 {
  try {
    return parseCommunicationLinkV1(value, workspaceId);
  } catch (error) {
    throw new CommunicationLinkRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Communication Link failed contract validation.',
      500,
      false,
      {
        cause: error instanceof Error ? error : undefined
      }
    );
  }
}

function targetIdentityKey(target: Readonly<CommunicationLinkTargetReferenceV1>): string {
  switch (target.targetKind) {
    case 'CUSTOMER_RELATIONSHIP':
      return `CUSTOMER_RELATIONSHIP:${target.customerRelationshipId}`;
    case 'WORKSPACE_DIRECTORY_ENTRY':
      return `WORKSPACE_DIRECTORY_ENTRY:${target.workspaceDirectoryEntryId}`;
    case 'TRADEMARK_ASSET':
      return `TRADEMARK_ASSET:${target.trademarkAssetId}`;
    case 'FORMAL_MATTER':
      return `FORMAL_MATTER:${target.formalMatterId}`;
    case 'PRODUCTION_INTAKE':
      return `PRODUCTION_INTAKE:${target.intakeId}`;
  }
}

function sourceIdentity(source: Readonly<CommunicationLinkSourceReferenceV1>): unknown {
  return source.scope === 'MESSAGE'
    ? { scope: source.scope, accountRef: source.accountRef, messageId: source.messageId }
    : { scope: source.scope, accountRef: source.accountRef, threadRef: source.threadRef };
}

function subjectFingerprint(item: Pick<CommunicationLinkV1, 'source' | 'target'>): string {
  return fingerprint({
    source: sourceIdentity(item.source),
    target: targetIdentityKey(item.target)
  });
}

function createRequestFingerprint(item: Readonly<CommunicationLinkV1>): string {
  return fingerprint({
    commandType: 'CREATE',
    workspaceId: item.workspaceId,
    actorPrincipalId: item.decision.decidedByPrincipalId,
    source: item.source,
    target: item.target,
    decisionStatus: item.decision.status,
    decisionBasis: item.decision.basis,
    reason: item.decision.reason,
    evidenceReferences: item.decision.evidenceReferences
  });
}

function timestampEqual(left: unknown, right: string | null): boolean {
  if (right === null) return left === null || left === undefined;
  if (left === null || left === undefined) return false;
  const time =
    left instanceof Date ? left.getTime() : typeof left === 'string' ? Date.parse(left) : NaN;
  return Number.isFinite(time) && time === Date.parse(right);
}

export function materializeCommunicationLinkV1(
  command: Readonly<CreateCommunicationLinkCommand>,
  at: string,
  id: CommunicationLinkId
): CommunicationLinkV1 {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  const decidedAt = iso(at, 'decidedAt');
  const reason =
    command.reason === undefined || command.reason === null
      ? null
      : cleanText(command.reason, 'reason', 1000);
  const evidenceReferences = [...(command.evidenceReferences ?? [])];
  const source = clone(command.source);
  const target = clone(command.target);
  const decisionFingerprintSha256 = communicationLinkDecisionFingerprintSha256V1({
    source,
    target,
    status: command.decisionStatus,
    basis: command.decisionBasis,
    reason,
    evidenceReferences
  });
  return parseRuntime(
    {
      schemaVersion: 1,
      communicationLinkId: cleanLinkId(id),
      workspaceId,
      version: 1,
      source,
      target,
      decision: {
        status: command.decisionStatus,
        basis: command.decisionBasis,
        authority: 'HUMAN',
        decidedByPrincipalId: cleanText(command.actorPrincipalId, 'actorPrincipalId', 240),
        decidedAt,
        reason,
        evidenceReferences,
        decisionFingerprintSha256
      },
      lifecycle: 'ACTIVE',
      archivedAt: null,
      authorityConsequences: noCommunicationLinkAuthorityConsequencesV1,
      createdAt: decidedAt,
      updatedAt: decidedAt
    },
    workspaceId
  );
}

export function materializeArchivedCommunicationLinkV1(
  current: Readonly<CommunicationLinkV1>,
  command: Readonly<ArchiveCommunicationLinkCommand>,
  at: string
): CommunicationLinkV1 {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  if (
    current.workspaceId !== workspaceId ||
    current.communicationLinkId !== cleanLinkId(command.communicationLinkId)
  )
    throw new CommunicationLinkRuntimeError('NOT_FOUND', 'Communication Link was not found.', 404);
  if (current.version !== cleanVersion(command.expectedVersion))
    throw new CommunicationLinkRuntimeError(
      'VERSION_CONFLICT',
      `Expected Communication Link version ${command.expectedVersion}, found ${current.version}.`
    );
  if (current.lifecycle !== 'ACTIVE')
    throw new CommunicationLinkRuntimeError(
      'INVALID_TRANSITION',
      'Only an ACTIVE Communication Link can be archived.'
    );
  const updatedAt = iso(at, 'archivedAt');
  if (Date.parse(updatedAt) < Date.parse(current.updatedAt))
    throw new CommunicationLinkRuntimeError(
      'INVALID_INPUT',
      'Runtime clock cannot move backwards.',
      422
    );
  return parseRuntime(
    {
      ...clone(current),
      version: current.version + 1,
      lifecycle: 'ARCHIVED',
      archivedAt: updatedAt,
      updatedAt
    },
    workspaceId
  );
}

function versionFromRow(row: Row): CommunicationLinkV1 {
  const workspaceId = String(row.workspace_id);
  const item = parsePersisted(row.document_json, workspaceId);
  const mismatch =
    item.communicationLinkId !== String(row.communication_link_id) ||
    item.version !== Number(row.version) ||
    item.source.scope !== String(row.source_scope) ||
    item.source.accountRef !== String(row.account_ref) ||
    item.source.messageId !== String(row.message_id) ||
    item.source.threadRef !== String(row.thread_ref) ||
    item.source.provider !== String(row.provider) ||
    item.source.providerMessageId !== String(row.provider_message_id) ||
    !timestampEqual(row.observed_at, item.source.observedAt) ||
    item.target.targetKind !== String(row.target_kind) ||
    targetIdentityKey(item.target) !== String(row.target_identity_key) ||
    item.target.version !== Number(row.target_version) ||
    item.lifecycle !== String(row.lifecycle) ||
    item.decision.status !== String(row.decision_status) ||
    item.decision.basis !== String(row.decision_basis) ||
    subjectFingerprint(item) !== String(row.subject_fingerprint_sha256) ||
    item.decision.decisionFingerprintSha256 !== String(row.decision_fingerprint_sha256) ||
    !timestampEqual(row.created_at, item.createdAt) ||
    !timestampEqual(row.updated_at, item.updatedAt) ||
    !timestampEqual(row.archived_at, item.archivedAt);
  if (mismatch)
    throw new CommunicationLinkRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Communication Link columns do not match document_json.',
      500
    );
  return item;
}

function latestFromRow(row: Row): CommunicationLinkV1 {
  const item = versionFromRow(row);
  const mismatch =
    item.version !== Number(row.head_latest_version) ||
    item.source.scope !== String(row.head_source_scope) ||
    item.source.accountRef !== String(row.head_account_ref) ||
    item.source.messageId !== String(row.head_message_id) ||
    item.source.threadRef !== String(row.head_thread_ref) ||
    item.target.targetKind !== String(row.head_target_kind) ||
    targetIdentityKey(item.target) !== String(row.head_target_identity_key) ||
    item.target.version !== Number(row.head_target_version) ||
    item.lifecycle !== String(row.head_lifecycle) ||
    item.decision.status !== String(row.head_decision_status) ||
    item.decision.basis !== String(row.head_decision_basis) ||
    subjectFingerprint(item) !== String(row.head_subject_fingerprint_sha256) ||
    item.decision.decisionFingerprintSha256 !== String(row.head_decision_fingerprint_sha256) ||
    !timestampEqual(row.head_updated_at, item.updatedAt);
  if (mismatch)
    throw new CommunicationLinkRuntimeError(
      'INTEGRITY_FAILURE',
      'Communication Link head does not match latest durable version.',
      500
    );
  return item;
}

const JOIN_LATEST = `SELECT v.*,
  h.latest_version AS head_latest_version,h.source_scope AS head_source_scope,
  h.account_ref AS head_account_ref,h.message_id AS head_message_id,h.thread_ref AS head_thread_ref,
  h.target_kind AS head_target_kind,h.target_identity_key AS head_target_identity_key,h.target_version AS head_target_version,
  h.lifecycle AS head_lifecycle,
  h.decision_status AS head_decision_status,h.decision_basis AS head_decision_basis,
  h.subject_fingerprint_sha256 AS head_subject_fingerprint_sha256,
  h.decision_fingerprint_sha256 AS head_decision_fingerprint_sha256,h.updated_at AS head_updated_at
  FROM lite_communication_link_heads h
  JOIN lite_communication_link_versions v ON v.workspace_id=h.workspace_id
   AND v.communication_link_id=h.communication_link_id AND v.version=h.latest_version`;

export class PostgresCommunicationLinkStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => CommunicationLinkId = () =>
      `communication-link_${randomUUID().replaceAll('-', '')}`
  ) {}

  private normalizedCreate(
    command: Readonly<CreateCommunicationLinkCommand>,
    id: CommunicationLinkId = 'communication-link_preview'
  ): CommunicationLinkV1 {
    return materializeCommunicationLinkV1(command, this.now(), id);
  }

  async replayCreate(
    command: Readonly<CreateCommunicationLinkCommand>
  ): Promise<CommunicationLinkV1 | undefined> {
    const item = this.normalizedCreate(command);
    const key = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const result = await this.query
      .query<Row>(
        `SELECT command_type,request_fingerprint_sha256,result_json FROM lite_communication_link_commands WHERE workspace_id=$1 AND idempotency_key=$2`,
        [item.workspaceId, key]
      )
      .catch((error: unknown) => {
        throw this.persistenceError(error);
      });
    const prior = result.rows[0];
    if (!prior) return undefined;
    if (
      String(prior.command_type) !== 'CREATE' ||
      String(prior.request_fingerprint_sha256) !== createRequestFingerprint(item)
    )
      throw new CommunicationLinkRuntimeError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used for a different Communication Link command.'
      );
    return parsePersisted(prior.result_json, item.workspaceId);
  }

  async create(command: Readonly<CreateCommunicationLinkCommand>): Promise<CommunicationLinkV1> {
    const created = this.normalizedCreate(command, this.id());
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const subject = subjectFingerprint(created);
    const requestFingerprint = createRequestFingerprint(created);
    return this.command(
      created.workspaceId,
      idempotencyKey,
      'CREATE',
      requestFingerprint,
      async (client) => {
        await this.lock(client, `${created.workspaceId}:communication-link-active:${subject}`);
        const existing = await this.findActiveBySubject(client, created.workspaceId, subject);
        if (existing) {
          if (
            existing.decision.decisionFingerprintSha256 !==
            created.decision.decisionFingerprintSha256
          )
            throw new CommunicationLinkRuntimeError(
              'ACTIVE_SUBJECT_CONFLICT',
              'An ACTIVE Communication Link already exists for this source scope and target. Archive it before recording a new decision.'
            );
          return existing;
        }
        await this.insertVersion(client, created, subject);
        await client.query(
          `INSERT INTO lite_communication_link_heads(
          workspace_id,communication_link_id,latest_version,source_scope,account_ref,message_id,thread_ref,
          target_kind,target_identity_key,target_version,lifecycle,decision_status,decision_basis,
          subject_fingerprint_sha256,decision_fingerprint_sha256,updated_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            created.workspaceId,
            created.communicationLinkId,
            created.version,
            created.source.scope,
            created.source.accountRef,
            created.source.messageId,
            created.source.threadRef,
            created.target.targetKind,
            targetIdentityKey(created.target),
            created.target.version,
            created.lifecycle,
            created.decision.status,
            created.decision.basis,
            subject,
            created.decision.decisionFingerprintSha256,
            created.updatedAt
          ]
        );
        return created;
      }
    );
  }

  async archive(command: Readonly<ArchiveCommunicationLinkCommand>): Promise<CommunicationLinkV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const id = cleanLinkId(command.communicationLinkId);
    const expectedVersion = cleanVersion(command.expectedVersion);
    const key = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const requestFingerprint = fingerprint({
      commandType: 'ARCHIVE',
      workspaceId,
      communicationLinkId: id,
      expectedVersion
    });
    return this.command(workspaceId, key, 'ARCHIVE', requestFingerprint, async (client) => {
      await this.lock(client, `${workspaceId}:communication-link:${id}`);
      const current = await this.requireLatest(client, workspaceId, id);
      const next = materializeArchivedCommunicationLinkV1(current, command, this.now());
      const subject = subjectFingerprint(next);
      await this.insertVersion(client, next, subject);
      const updated = await client.query(
        `UPDATE lite_communication_link_heads SET latest_version=$3,lifecycle=$4,decision_status=$5,decision_basis=$6,
          subject_fingerprint_sha256=$7,decision_fingerprint_sha256=$8,updated_at=$9
          WHERE workspace_id=$1 AND communication_link_id=$2 AND latest_version=$10`,
        [
          workspaceId,
          id,
          next.version,
          next.lifecycle,
          next.decision.status,
          next.decision.basis,
          subject,
          next.decision.decisionFingerprintSha256,
          next.updatedAt,
          expectedVersion
        ]
      );
      if (updated.rowCount !== 1)
        throw new CommunicationLinkRuntimeError(
          'VERSION_CONFLICT',
          'Communication Link changed before archive could be persisted.'
        );
      return next;
    });
  }

  async getExact(
    workspaceIdValue: string,
    idValue: CommunicationLinkId,
    versionValue: number
  ): Promise<CommunicationLinkV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const id = cleanLinkId(idValue);
    const version = cleanVersion(versionValue);
    try {
      const result = await this.query.query<Row>(
        `SELECT * FROM lite_communication_link_versions WHERE workspace_id=$1 AND communication_link_id=$2 AND version=$3`,
        [workspaceId, id, version]
      );
      return result.rows[0] ? versionFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof CommunicationLinkRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async getLatest(
    workspaceIdValue: string,
    idValue: CommunicationLinkId
  ): Promise<CommunicationLinkV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const id = cleanLinkId(idValue);
    try {
      const result = await this.query.query<Row>(
        `${JOIN_LATEST} WHERE h.workspace_id=$1 AND h.communication_link_id=$2`,
        [workspaceId, id]
      );
      return result.rows[0] ? latestFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof CommunicationLinkRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async listLatest(
    workspaceIdValue: string,
    options: Readonly<ListCommunicationLinksOptions> = {}
  ): Promise<readonly CommunicationLinkV1[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const limit = options.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new CommunicationLinkRuntimeError(
        'INVALID_INPUT',
        'limit must be between 1 and 100.',
        422
      );
    const lifecycle = options.lifecycle ?? null;
    const targetKind = options.targetKind ?? null;
    const sourceScope = options.sourceScope ?? null;
    const accountRef = options.accountRef?.trim() || null;
    const threadRef = options.threadRef?.trim() || null;
    try {
      const result = await this.query.query<Row>(
        `${JOIN_LATEST}
        WHERE h.workspace_id=$1 AND ($2::text IS NULL OR h.lifecycle=$2)
          AND ($3::text IS NULL OR h.target_kind=$3) AND ($4::text IS NULL OR h.source_scope=$4)
          AND ($5::text IS NULL OR h.account_ref=$5) AND ($6::text IS NULL OR h.thread_ref=$6)
        ORDER BY h.updated_at DESC,h.communication_link_id ASC LIMIT $7`,
        [workspaceId, lifecycle, targetKind, sourceScope, accountRef, threadRef, limit]
      );
      return result.rows.map(latestFromRow);
    } catch (error) {
      if (error instanceof CommunicationLinkRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async lookupThreadLinks(
    workspaceIdValue: string,
    accountRefValue: string,
    threadRefValue: string
  ): Promise<readonly CommunicationLinkV1[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const accountRef = cleanText(accountRefValue, 'accountRef', 500);
    const threadRef = cleanText(threadRefValue, 'threadRef', 500);
    try {
      const result = await this.query.query<Row>(
        `${JOIN_LATEST}
        WHERE h.workspace_id=$1 AND h.source_scope='THREAD' AND h.account_ref=$2 AND h.thread_ref=$3
          AND h.lifecycle='ACTIVE' ORDER BY h.updated_at DESC,h.communication_link_id ASC LIMIT 100`,
        [workspaceId, accountRef, threadRef]
      );
      return result.rows.map(latestFromRow);
    } catch (error) {
      if (error instanceof CommunicationLinkRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async command(
    workspaceId: string,
    idempotencyKey: string,
    commandType: CommandType,
    requestFingerprint: string,
    write: (client: QueryClient) => Promise<CommunicationLinkV1>
  ): Promise<CommunicationLinkV1> {
    try {
      return await this.database.transact(async (client) => {
        await this.lock(client, `${workspaceId}:communication-link-idempotency:${idempotencyKey}`);
        const replay = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json FROM lite_communication_link_commands WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0];
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new CommunicationLinkRuntimeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Communication Link command.'
            );
          return parsePersisted(prior.result_json, workspaceId);
        }
        const result = await write(client);
        await client.query(
          `INSERT INTO lite_communication_link_commands(workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at)
           VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
          [
            workspaceId,
            idempotencyKey,
            commandType,
            requestFingerprint,
            JSON.stringify(result),
            iso(this.now())
          ]
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof CommunicationLinkRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async findActiveBySubject(
    client: QueryClient,
    workspaceId: string,
    subject: string
  ): Promise<CommunicationLinkV1 | undefined> {
    const result = await client.query<Row>(
      `${JOIN_LATEST} WHERE h.workspace_id=$1 AND h.lifecycle='ACTIVE' AND h.subject_fingerprint_sha256=$2`,
      [workspaceId, subject]
    );
    return result.rows[0] ? latestFromRow(result.rows[0]) : undefined;
  }

  private async requireLatest(
    client: QueryClient,
    workspaceId: string,
    id: CommunicationLinkId
  ): Promise<CommunicationLinkV1> {
    const result = await client.query<Row>(
      `${JOIN_LATEST} WHERE h.workspace_id=$1 AND h.communication_link_id=$2`,
      [workspaceId, id]
    );
    if (!result.rows[0])
      throw new CommunicationLinkRuntimeError(
        'NOT_FOUND',
        'Communication Link was not found.',
        404
      );
    return latestFromRow(result.rows[0]);
  }

  private async insertVersion(
    client: QueryClient,
    item: Readonly<CommunicationLinkV1>,
    subject: string
  ): Promise<void> {
    const parsed = parseRuntime(item, item.workspaceId);
    await client.query(
      `INSERT INTO lite_communication_link_versions(
        workspace_id,communication_link_id,version,source_scope,account_ref,message_id,thread_ref,provider,provider_message_id,
        observed_at,target_kind,target_identity_key,target_version,lifecycle,decision_status,decision_basis,
        subject_fingerprint_sha256,decision_fingerprint_sha256,document_json,created_at,updated_at,archived_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21,$22)`,
      [
        parsed.workspaceId,
        parsed.communicationLinkId,
        parsed.version,
        parsed.source.scope,
        parsed.source.accountRef,
        parsed.source.messageId,
        parsed.source.threadRef,
        parsed.source.provider,
        parsed.source.providerMessageId,
        parsed.source.observedAt,
        parsed.target.targetKind,
        targetIdentityKey(parsed.target),
        parsed.target.version,
        parsed.lifecycle,
        parsed.decision.status,
        parsed.decision.basis,
        subject,
        parsed.decision.decisionFingerprintSha256,
        JSON.stringify(parsed),
        parsed.createdAt,
        parsed.updatedAt,
        parsed.archivedAt
      ]
    );
  }

  private async lock(client: QueryClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }

  private persistenceError(cause: unknown): CommunicationLinkRuntimeError {
    return new CommunicationLinkRuntimeError(
      'PERSISTENCE_UNAVAILABLE',
      'Communication Link persistence is unavailable.',
      503,
      true,
      {
        cause: cause instanceof Error ? cause : undefined
      }
    );
  }
}

export class CommunicationLinkService {
  constructor(
    private readonly store: PostgresCommunicationLinkStore,
    private readonly validator: CommunicationLinkOwnerValidator
  ) {}

  async create(
    command: Readonly<CreateCommunicationLinkCommand>,
    principal: Readonly<WorkspacePrincipal>
  ): Promise<CommunicationLinkV1> {
    const replay = await this.store.replayCreate(command);
    if (replay) return replay;
    await this.validator.validateCreate({
      workspaceId: cleanWorkspaceId(command.workspaceId),
      source: command.source,
      target: command.target,
      principal
    });
    return this.store.create(command);
  }

  archive(command: Readonly<ArchiveCommunicationLinkCommand>): Promise<CommunicationLinkV1> {
    return this.store.archive(command);
  }
  getExact(
    workspaceId: string,
    id: CommunicationLinkId,
    version: number
  ): Promise<CommunicationLinkV1 | undefined> {
    return this.store.getExact(workspaceId, id, version);
  }
  getLatest(
    workspaceId: string,
    id: CommunicationLinkId
  ): Promise<CommunicationLinkV1 | undefined> {
    return this.store.getLatest(workspaceId, id);
  }
  listLatest(
    workspaceId: string,
    options?: Readonly<ListCommunicationLinksOptions>
  ): Promise<readonly CommunicationLinkV1[]> {
    return this.store.listLatest(workspaceId, options);
  }
}

export class DurableCommunicationLinkThreadAssociationLookup implements CommunicationLinkThreadAssociationLookup {
  constructor(private readonly store: Pick<PostgresCommunicationLinkStore, 'lookupThreadLinks'>) {}
  async lookup(input: {
    workspaceId: string;
    accountRef: string;
    threadRef: string;
  }): Promise<ReadonlyArray<Readonly<CommunicationLinkThreadAssociationEvidence>>> {
    const links = await this.store.lookupThreadLinks(
      input.workspaceId,
      input.accountRef,
      input.threadRef
    );
    return links
      .filter(
        (link) =>
          isCommunicationLinkThreadInheritanceEligibleV1(link) &&
          link.target.targetKind === 'TRADEMARK_ASSET'
      )
      .map((link) => {
        if (link.target.targetKind !== 'TRADEMARK_ASSET') {
          throw new CommunicationLinkRuntimeError(
            'INTEGRITY_FAILURE',
            'Thread inheritance adapter received a non-Trademark Asset target.',
            500
          );
        }
        return {
          associationReference: link.communicationLinkId,
          workspaceId: link.workspaceId,
          accountRef: link.source.accountRef,
          threadRef: link.source.threadRef,
          status: 'CONFIRMED' as const,
          confirmationAuthority: 'HUMAN' as const,
          target: { id: link.target.trademarkAssetId, version: link.target.version }
        };
      });
  }
}
