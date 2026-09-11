import { createHash, randomUUID } from 'node:crypto';
import type { MarkOrbitId, WorkspacePrincipal } from '@markorbit/contracts';
import {
  liteIntakeReviewedMaterialFingerprintSha256V1,
  noLiteIntakeStagingAuthorityConsequencesV1,
  parseLiteIntakeStagingV1,
  type LiteIntakeAiExtractionId,
  type LiteIntakeCaseCandidateId,
  type LiteIntakeCaseState,
  type LiteIntakeFieldCandidateV1,
  type LiteIntakeFieldPath,
  type LiteIntakeManagedAiExtractionRefV1,
  type LiteIntakePrimarySourceV1,
  type LiteIntakeReviewedMaterialV1,
  type LiteIntakeStagingId,
  type LiteIntakeStagingLifecycle,
  type LiteIntakeStagingV1
} from '@markorbit/contracts/lite-intake-staging';
import {
  parseProductionIntakeV1,
  type CreateProductionIntakeCommandV1,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAGING_ID = /^lite-intake-staging_[A-Za-z0-9_-]+$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

type Row = Record<string, unknown>;
type CommandType = 'CREATE' | 'REVISE_CASE' | 'REVIEW_CASE' | 'COMMIT_CASE';
type DraftCaseState = Extract<
  LiteIntakeCaseState,
  'DRAFT' | 'EXTRACTING' | 'NEEDS_REVIEW' | 'NEEDS_INFORMATION'
>;
type HumanReviewState = Extract<
  LiteIntakeFieldCandidateV1['reviewState'],
  'CONFIRMED' | 'CORRECTED' | 'REJECTED'
>;

export type LiteIntakeStagingRuntimeErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'COMMAND_IN_PROGRESS'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'REVIEW_FINGERPRINT_CONFLICT'
  | 'OWNER_RESPONSE_MISMATCH'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';
export class LiteIntakeStagingRuntimeError extends Error {
  constructor(
    readonly code: LiteIntakeStagingRuntimeErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'LiteIntakeStagingRuntimeError';
  }
}

export interface LiteIntakeDraftCaseInput {
  caseCandidateId: LiteIntakeCaseCandidateId;
  state: DraftCaseState;
  fieldCandidates: readonly Readonly<LiteIntakeFieldCandidateV1>[];
}

export interface LiteIntakeReviewedFieldInput {
  fieldCandidateId: LiteIntakeFieldCandidateV1['fieldCandidateId'];
  fieldPath: LiteIntakeFieldPath;
  proposedValue: LiteIntakeFieldCandidateV1['proposedValue'];
  originClass: LiteIntakeFieldCandidateV1['originClass'];
  sourceIds: LiteIntakeFieldCandidateV1['sourceIds'];
  aiExtractionIds: readonly LiteIntakeAiExtractionId[];
  reviewState: HumanReviewState;
}
export interface CreateLiteIntakeStagingCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  sources: readonly Readonly<LiteIntakePrimarySourceV1>[];
  aiExtractions?: readonly Readonly<LiteIntakeManagedAiExtractionRefV1>[];
  caseCandidates?: readonly Readonly<LiteIntakeDraftCaseInput>[];
}

export interface ReviseLiteIntakeCaseCommand {
  workspaceId: string;
  stagingId: LiteIntakeStagingId;
  caseCandidateId: LiteIntakeCaseCandidateId;
  expectedVersion: number;
  idempotencyKey: string;
  state: DraftCaseState;
  fieldCandidates: readonly Readonly<LiteIntakeFieldCandidateV1>[];
  sources?: readonly Readonly<LiteIntakePrimarySourceV1>[];
  aiExtractions?: readonly Readonly<LiteIntakeManagedAiExtractionRefV1>[];
}

export interface ReviewLiteIntakeCaseCommand {
  workspaceId: string;
  actorPrincipalId: string;
  stagingId: LiteIntakeStagingId;
  caseCandidateId: LiteIntakeCaseCandidateId;
  expectedVersion: number;
  idempotencyKey: string;
  fieldCandidates: readonly Readonly<LiteIntakeReviewedFieldInput>[];
  material: Readonly<LiteIntakeReviewedMaterialV1>;
}

export interface CommitLiteIntakeCaseCommand {
  workspaceId: string;
  stagingId: LiteIntakeStagingId;
  caseCandidateId: LiteIntakeCaseCandidateId;
  expectedVersion: number;
  expectedReviewedFingerprintSha256: string;
  idempotencyKey: string;
  principal: Readonly<WorkspacePrincipal>;
}

export interface LiteIntakeCommitResult {
  status: 'COMMITTED' | 'COMMIT_UNCERTAIN';
  staging: Readonly<LiteIntakeStagingV1>;
}

export interface LiteIntakeProductionIntakeClient {
  create(
    principal: Readonly<WorkspacePrincipal>,
    command: Readonly<CreateProductionIntakeCommandV1>
  ): Promise<Readonly<ProductionIntakeV1>>;
}

export class LiteIntakeProductionIntakeClientError extends Error {
  constructor(
    message: string,
    readonly uncertain: boolean,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'LiteIntakeProductionIntakeClientError';
  }
}

const clone = <T>(value: T): T => structuredClone(value);
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
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
    throw new LiteIntakeStagingRuntimeError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}
function cleanText(value: string, field: string, maximum = 500): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new LiteIntakeStagingRuntimeError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  return cleaned;
}

function cleanStagingId(value: LiteIntakeStagingId): LiteIntakeStagingId {
  const cleaned = value.trim();
  if (!STAGING_ID.test(cleaned))
    throw new LiteIntakeStagingRuntimeError('INVALID_INPUT', 'stagingId is invalid.', 422);
  return cleaned as LiteIntakeStagingId;
}

function cleanVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new LiteIntakeStagingRuntimeError(
      'INVALID_INPUT',
      'expectedVersion must be a positive safe integer.',
      422
    );
  return value;
}
function cleanSha(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!SHA256.test(cleaned))
    throw new LiteIntakeStagingRuntimeError('INVALID_INPUT', `${field} must be SHA-256 hex.`, 422);
  return cleaned;
}

function nowIso(value: string, field = 'now'): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new LiteIntakeStagingRuntimeError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  return parsed.toISOString();
}

function parseRuntime(value: unknown, workspaceId: string): LiteIntakeStagingV1 {
  try {
    return parseLiteIntakeStagingV1(value, workspaceId);
  } catch (error) {
    throw new LiteIntakeStagingRuntimeError(
      'INVALID_INPUT',
      'Lite Intake Staging contract validation failed.',
      422,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
function parsePersisted(value: unknown, workspaceId: string): LiteIntakeStagingV1 {
  try {
    return parseLiteIntakeStagingV1(value, workspaceId);
  } catch (error) {
    throw new LiteIntakeStagingRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Lite Intake Staging failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function cleanDraftCase(input: Readonly<LiteIntakeDraftCaseInput>) {
  const fields = input.fieldCandidates.map((field) => {
    if (!['UNREVIEWED', 'CONFLICTING', 'MISSING'].includes(field.reviewState))
      throw new LiteIntakeStagingRuntimeError(
        'INVALID_INPUT',
        'Draft candidate fields cannot manufacture a human review disposition.',
        422
      );
    if (field.reviewedByPrincipalId !== null || field.reviewedAt !== null)
      throw new LiteIntakeStagingRuntimeError(
        'INVALID_INPUT',
        'Draft candidate fields cannot carry reviewer authority.',
        422
      );
    return clone(field);
  });
  return {
    caseCandidateId: input.caseCandidateId,
    contentVersion: 1,
    state: input.state,
    fieldCandidates: fields,
    reviewedCommit: null,
    productionIntakeReceipt: null,
    archivedAt: null
  } as const;
}

function caseOf(
  staging: Readonly<LiteIntakeStagingV1>,
  caseCandidateId: LiteIntakeCaseCandidateId
) {
  const found = staging.caseCandidates.find(
    (candidate) => candidate.caseCandidateId === caseCandidateId
  );
  if (!found)
    throw new LiteIntakeStagingRuntimeError(
      'NOT_FOUND',
      'Lite Intake case candidate was not found in this Workspace.',
      404
    );
  return found;
}

function replaceCase(
  staging: Readonly<LiteIntakeStagingV1>,
  nextCase: LiteIntakeStagingV1['caseCandidates'][number],
  at: string,
  overrides: Partial<Pick<LiteIntakeStagingV1, 'sources' | 'aiExtractions'>> = {}
): LiteIntakeStagingV1 {
  const updatedAt = nowIso(at);
  if (Date.parse(updatedAt) < Date.parse(staging.updatedAt))
    throw new LiteIntakeStagingRuntimeError(
      'INVALID_INPUT',
      'Runtime clock cannot move backwards.',
      422
    );
  return parseRuntime(
    {
      ...clone(staging),
      version: staging.version + 1,
      sources: clone(overrides.sources ?? staging.sources),
      aiExtractions: clone(overrides.aiExtractions ?? staging.aiExtractions),
      caseCandidates: staging.caseCandidates.map((candidate) =>
        candidate.caseCandidateId === nextCase.caseCandidateId ? clone(nextCase) : clone(candidate)
      ),
      updatedAt
    },
    staging.workspaceId
  );
}

function timestampEqual(left: unknown, right: string | null): boolean {
  if (right === null) return left === null || left === undefined;
  if (left === null || left === undefined) return false;
  const time =
    left instanceof Date ? left.getTime() : typeof left === 'string' ? Date.parse(left) : NaN;
  return Number.isFinite(time) && time === Date.parse(right);
}
function itemFromRow(row: Row): LiteIntakeStagingV1 {
  const workspaceId = String(row.workspace_id);
  const item = parsePersisted(row.document_json, workspaceId);
  const mismatch =
    item.stagingId !== String(row.staging_id) ||
    item.version !== Number(row.version) ||
    item.lifecycle !== String(row.lifecycle) ||
    !timestampEqual(row.created_at, item.createdAt) ||
    !timestampEqual(row.updated_at, item.updatedAt) ||
    !timestampEqual(row.archived_at, item.archivedAt);
  if (mismatch)
    throw new LiteIntakeStagingRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Lite Intake Staging columns do not match document_json.',
      500
    );
  return item;
}

export class PostgresLiteIntakeStagingStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => LiteIntakeStagingId = () =>
      `lite-intake-staging_${randomUUID().replaceAll('-', '')}`
  ) {}

  async create(command: Readonly<CreateLiteIntakeStagingCommand>): Promise<LiteIntakeStagingV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint({
      actorPrincipalId: command.actorPrincipalId,
      sources: command.sources,
      aiExtractions: command.aiExtractions ?? [],
      caseCandidates: command.caseCandidates ?? []
    });
    return this.localCommand(
      workspaceId,
      idempotencyKey,
      'CREATE',
      requestFingerprint,
      async (client) => {
        const at = nowIso(this.now());
        const item = parseRuntime(
          {
            schemaVersion: 1,
            stagingId: cleanStagingId(this.id()),
            workspaceId,
            version: 1,
            lifecycle: 'ACTIVE',
            sources: clone(command.sources),
            aiExtractions: clone(command.aiExtractions ?? []),
            caseCandidates: (command.caseCandidates ?? []).map(cleanDraftCase),
            authorityConsequences: noLiteIntakeStagingAuthorityConsequencesV1,
            createdAt: at,
            updatedAt: at,
            archivedAt: null
          },
          workspaceId
        );
        await this.insertVersion(client, item);
        await client.query(
          `INSERT INTO lite_intake_staging_heads(
             workspace_id,staging_id,latest_version,lifecycle,updated_at
           ) VALUES($1,$2,$3,$4,$5)`,
          [workspaceId, item.stagingId, item.version, item.lifecycle, item.updatedAt]
        );
        return item;
      }
    );
  }

  async mutate(
    input: Readonly<{
      workspaceId: string;
      stagingId: LiteIntakeStagingId;
      expectedVersion: number;
      idempotencyKey: string;
      commandType: Exclude<CommandType, 'CREATE'>;
      requestFingerprint: string;
      materialize: (current: Readonly<LiteIntakeStagingV1>, at: string) => LiteIntakeStagingV1;
    }>
  ): Promise<LiteIntakeStagingV1> {
    const workspaceId = cleanWorkspaceId(input.workspaceId);
    const stagingId = cleanStagingId(input.stagingId);
    const expectedVersion = cleanVersion(input.expectedVersion);
    return this.localCommand(
      workspaceId,
      cleanText(input.idempotencyKey, 'idempotencyKey'),
      input.commandType,
      cleanSha(input.requestFingerprint, 'requestFingerprint'),
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:intake-staging:${stagingId}`);
        const current = await this.requireLatest(client, workspaceId, stagingId);
        if (current.version !== expectedVersion)
          throw new LiteIntakeStagingRuntimeError(
            'VERSION_CONFLICT',
            `Expected staging version ${expectedVersion}, found ${current.version}.`
          );
        const next = parseRuntime(input.materialize(current, this.now()), workspaceId);
        if (
          next.workspaceId !== workspaceId ||
          next.stagingId !== stagingId ||
          next.version !== current.version + 1
        )
          throw new LiteIntakeStagingRuntimeError(
            'INVALID_INPUT',
            'Staging mutation must preserve owner identity and advance exactly one version.',
            422
          );
        await this.insertVersion(client, next);
        const updated = await client.query(
          `UPDATE lite_intake_staging_heads
              SET latest_version=$3,lifecycle=$4,updated_at=$5
            WHERE workspace_id=$1 AND staging_id=$2 AND latest_version=$6`,
          [workspaceId, stagingId, next.version, next.lifecycle, next.updatedAt, expectedVersion]
        );
        if (updated.rowCount !== 1)
          throw new LiteIntakeStagingRuntimeError(
            'VERSION_CONFLICT',
            'Lite Intake Staging changed before mutation could be persisted.'
          );
        return next;
      }
    );
  }

  async getExact(
    workspaceIdValue: string,
    stagingIdValue: LiteIntakeStagingId,
    versionValue: number
  ): Promise<LiteIntakeStagingV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const stagingId = cleanStagingId(stagingIdValue);
    const version = cleanVersion(versionValue);
    try {
      const result = await this.query.query<Row>(
        `SELECT * FROM lite_intake_staging_versions
          WHERE workspace_id=$1 AND staging_id=$2 AND version=$3`,
        [workspaceId, stagingId, version]
      );
      return result.rows[0] ? itemFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof LiteIntakeStagingRuntimeError) throw error;
      throw this.persistence(error);
    }
  }
  async getLatest(
    workspaceIdValue: string,
    stagingIdValue: LiteIntakeStagingId
  ): Promise<LiteIntakeStagingV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const stagingId = cleanStagingId(stagingIdValue);
    try {
      const result = await this.query.query<Row>(
        `SELECT v.* FROM lite_intake_staging_heads h
           JOIN lite_intake_staging_versions v
             ON v.workspace_id=h.workspace_id
            AND v.staging_id=h.staging_id
            AND v.version=h.latest_version
          WHERE h.workspace_id=$1 AND h.staging_id=$2`,
        [workspaceId, stagingId]
      );
      return result.rows[0] ? itemFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof LiteIntakeStagingRuntimeError) throw error;
      throw this.persistence(error);
    }
  }

  async listLatest(
    workspaceIdValue: string,
    options: Readonly<{
      lifecycle?: LiteIntakeStagingLifecycle;
      limit?: number;
    }> = {}
  ): Promise<readonly LiteIntakeStagingV1[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const limit = options.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new LiteIntakeStagingRuntimeError(
        'INVALID_INPUT',
        'limit must be between 1 and 100.',
        422
      );
    if (options.lifecycle !== undefined && !['ACTIVE', 'ARCHIVED'].includes(options.lifecycle))
      throw new LiteIntakeStagingRuntimeError('INVALID_INPUT', 'lifecycle is invalid.', 422);
    try {
      const result = await this.query.query<Row>(
        `SELECT v.* FROM lite_intake_staging_heads h
           JOIN lite_intake_staging_versions v
             ON v.workspace_id=h.workspace_id
            AND v.staging_id=h.staging_id
            AND v.version=h.latest_version
          WHERE h.workspace_id=$1
            AND ($2::text IS NULL OR h.lifecycle=$2)
          ORDER BY h.updated_at DESC,h.staging_id ASC
          LIMIT $3`,
        [workspaceId, options.lifecycle ?? null, limit]
      );
      return result.rows.map(itemFromRow);
    } catch (error) {
      if (error instanceof LiteIntakeStagingRuntimeError) throw error;
      throw this.persistence(error);
    }
  }

  async getCommandResult(
    workspaceIdValue: string,
    idempotencyKeyValue: string,
    commandType: CommandType,
    requestFingerprintValue: string
  ): Promise<LiteIntakeStagingV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const idempotencyKey = cleanText(idempotencyKeyValue, 'idempotencyKey');
    const requestFingerprint = cleanSha(requestFingerprintValue, 'requestFingerprint');
    try {
      const found = await this.query.query<Row>(
        `SELECT command_type,request_fingerprint_sha256,result_json
           FROM lite_intake_staging_commands
          WHERE workspace_id=$1 AND idempotency_key=$2`,
        [workspaceId, idempotencyKey]
      );
      const prior = found.rows[0];
      if (!prior) return undefined;
      if (
        String(prior.command_type) !== commandType ||
        String(prior.request_fingerprint_sha256) !== requestFingerprint
      )
        throw new LiteIntakeStagingRuntimeError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was already used for a materially different Intake Staging command.'
        );
      if (prior.result_json === null || prior.result_json === undefined)
        throw new LiteIntakeStagingRuntimeError(
          'COMMAND_IN_PROGRESS',
          'An exact Intake Staging command is still in progress.',
          409,
          true
        );
      return parsePersisted(prior.result_json, workspaceId);
    } catch (error) {
      if (error instanceof LiteIntakeStagingRuntimeError) throw error;
      throw this.persistence(error);
    }
  }

  async recordCommandResult(
    workspaceIdValue: string,
    idempotencyKeyValue: string,
    commandType: CommandType,
    requestFingerprintValue: string,
    resultValue: Readonly<LiteIntakeStagingV1>
  ): Promise<LiteIntakeStagingV1> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const idempotencyKey = cleanText(idempotencyKeyValue, 'idempotencyKey');
    const requestFingerprint = cleanSha(requestFingerprintValue, 'requestFingerprint');
    const result = parseRuntime(resultValue, workspaceId);
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(client, `${workspaceId}:intake-idempotency:${idempotencyKey}`);
        const found = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_intake_staging_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = found.rows[0];
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new LiteIntakeStagingRuntimeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a materially different Intake Staging command.'
            );
          if (prior.result_json === null || prior.result_json === undefined)
            throw new LiteIntakeStagingRuntimeError(
              'COMMAND_IN_PROGRESS',
              'Command result is pending.',
              409,
              true
            );
          return parsePersisted(prior.result_json, workspaceId);
        }
        const at = nowIso(this.now());
        await client.query(
          `INSERT INTO lite_intake_staging_commands(
             workspace_id,idempotency_key,command_type,request_fingerprint_sha256,
             result_json,created_at,completed_at
           ) VALUES($1,$2,$3,$4,$5::jsonb,$6,$6)`,
          [workspaceId, idempotencyKey, commandType, requestFingerprint, JSON.stringify(result), at]
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof LiteIntakeStagingRuntimeError) throw error;
      throw this.persistence(error);
    }
  }

  private async localCommand(
    workspaceId: string,
    idempotencyKey: string,
    commandType: CommandType,
    requestFingerprint: string,
    write: (client: QueryClient) => Promise<LiteIntakeStagingV1>
  ): Promise<LiteIntakeStagingV1> {
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(client, `${workspaceId}:intake-idempotency:${idempotencyKey}`);
        const replay = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_intake_staging_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0];
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new LiteIntakeStagingRuntimeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a materially different Intake Staging command.'
            );
          if (prior.result_json === null || prior.result_json === undefined)
            throw new LiteIntakeStagingRuntimeError(
              'COMMAND_IN_PROGRESS',
              'Command result is pending.',
              409,
              true
            );
          return parsePersisted(prior.result_json, workspaceId);
        }

        const result = await write(client);
        const at = nowIso(this.now());
        await client.query(
          `INSERT INTO lite_intake_staging_commands(
             workspace_id,idempotency_key,command_type,request_fingerprint_sha256,
             result_json,created_at,completed_at
           ) VALUES($1,$2,$3,$4,$5::jsonb,$6,$6)`,
          [workspaceId, idempotencyKey, commandType, requestFingerprint, JSON.stringify(result), at]
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof LiteIntakeStagingRuntimeError) throw error;
      throw this.persistence(error);
    }
  }

  async reserveCommand(
    workspaceIdValue: string,
    idempotencyKeyValue: string,
    commandType: CommandType,
    requestFingerprintValue: string
  ): Promise<LiteIntakeStagingV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const idempotencyKey = cleanText(idempotencyKeyValue, 'idempotencyKey');
    const requestFingerprint = cleanSha(requestFingerprintValue, 'requestFingerprint');
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(client, `${workspaceId}:intake-idempotency:${idempotencyKey}`);
        const found = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_intake_staging_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = found.rows[0];
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new LiteIntakeStagingRuntimeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a materially different Intake Staging command.'
            );
          return prior.result_json === null || prior.result_json === undefined
            ? undefined
            : parsePersisted(prior.result_json, workspaceId);
        }
        await client.query(
          `INSERT INTO lite_intake_staging_commands(
             workspace_id,idempotency_key,command_type,request_fingerprint_sha256,
             result_json,created_at,completed_at
           ) VALUES($1,$2,$3,$4,NULL,$5,NULL)`,
          [workspaceId, idempotencyKey, commandType, requestFingerprint, nowIso(this.now())]
        );
        return undefined;
      });
    } catch (error) {
      if (error instanceof LiteIntakeStagingRuntimeError) throw error;
      throw this.persistence(error);
    }
  }
  async completeReservedCommand(
    workspaceIdValue: string,
    idempotencyKeyValue: string,
    commandType: CommandType,
    requestFingerprintValue: string,
    resultValue: Readonly<LiteIntakeStagingV1>
  ): Promise<LiteIntakeStagingV1> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const idempotencyKey = cleanText(idempotencyKeyValue, 'idempotencyKey');
    const requestFingerprint = cleanSha(requestFingerprintValue, 'requestFingerprint');
    const result = parseRuntime(resultValue, workspaceId);
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(client, `${workspaceId}:intake-idempotency:${idempotencyKey}`);
        const found = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256
             FROM lite_intake_staging_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = found.rows[0];
        if (!prior)
          throw new LiteIntakeStagingRuntimeError(
            'INTEGRITY_FAILURE',
            'Reserved Intake Staging command was not found.',
            500
          );
        if (
          String(prior.command_type) !== commandType ||
          String(prior.request_fingerprint_sha256) !== requestFingerprint
        )
          throw new LiteIntakeStagingRuntimeError(
            'IDEMPOTENCY_CONFLICT',
            'Reserved command no longer matches the exact commit request.'
          );
        await client.query(
          `UPDATE lite_intake_staging_commands
              SET result_json=$3::jsonb,completed_at=$4
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey, JSON.stringify(result), nowIso(this.now())]
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof LiteIntakeStagingRuntimeError) throw error;
      throw this.persistence(error);
    }
  }

  async transition(
    input: Readonly<{
      workspaceId: string;
      stagingId: LiteIntakeStagingId;
      expectedVersion: number;
      materialize: (current: Readonly<LiteIntakeStagingV1>, at: string) => LiteIntakeStagingV1;
    }>
  ): Promise<LiteIntakeStagingV1> {
    const workspaceId = cleanWorkspaceId(input.workspaceId);
    const stagingId = cleanStagingId(input.stagingId);
    const expectedVersion = cleanVersion(input.expectedVersion);
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(client, `${workspaceId}:intake-staging:${stagingId}`);
        const current = await this.requireLatest(client, workspaceId, stagingId);
        if (current.version !== expectedVersion)
          throw new LiteIntakeStagingRuntimeError(
            'VERSION_CONFLICT',
            `Expected staging version ${expectedVersion}, found ${current.version}.`
          );
        const next = parseRuntime(input.materialize(current, this.now()), workspaceId);
        if (
          next.workspaceId !== workspaceId ||
          next.stagingId !== stagingId ||
          next.version !== current.version + 1
        )
          throw new LiteIntakeStagingRuntimeError(
            'INVALID_INPUT',
            'Internal staging transition must preserve identity and advance one version.',
            422
          );
        await this.insertVersion(client, next);
        const updated = await client.query(
          `UPDATE lite_intake_staging_heads
              SET latest_version=$3,lifecycle=$4,updated_at=$5
            WHERE workspace_id=$1 AND staging_id=$2 AND latest_version=$6`,
          [workspaceId, stagingId, next.version, next.lifecycle, next.updatedAt, expectedVersion]
        );
        if (updated.rowCount !== 1)
          throw new LiteIntakeStagingRuntimeError(
            'VERSION_CONFLICT',
            'Lite Intake Staging changed before transition could be persisted.'
          );
        return next;
      });
    } catch (error) {
      if (error instanceof LiteIntakeStagingRuntimeError) throw error;
      throw this.persistence(error);
    }
  }
  private async requireLatest(
    client: QueryClient,
    workspaceId: string,
    stagingId: LiteIntakeStagingId
  ): Promise<LiteIntakeStagingV1> {
    const result = await client.query<Row>(
      `SELECT v.* FROM lite_intake_staging_heads h
         JOIN lite_intake_staging_versions v
           ON v.workspace_id=h.workspace_id
          AND v.staging_id=h.staging_id
          AND v.version=h.latest_version
        WHERE h.workspace_id=$1 AND h.staging_id=$2`,
      [workspaceId, stagingId]
    );
    if (!result.rows[0])
      throw new LiteIntakeStagingRuntimeError(
        'NOT_FOUND',
        'Lite Intake Staging was not found in this Workspace.',
        404
      );
    return itemFromRow(result.rows[0]);
  }

  private async insertVersion(
    client: QueryClient,
    itemValue: Readonly<LiteIntakeStagingV1>
  ): Promise<void> {
    const item = parseRuntime(itemValue, itemValue.workspaceId);
    await client.query(
      `INSERT INTO lite_intake_staging_versions(
         workspace_id,staging_id,version,lifecycle,document_json,
         created_at,updated_at,archived_at
       ) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
      [
        item.workspaceId,
        item.stagingId,
        item.version,
        item.lifecycle,
        JSON.stringify(item),
        item.createdAt,
        item.updatedAt,
        item.archivedAt
      ]
    );
  }
  private async resourceLock(client: QueryClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }

  private persistence(cause: unknown): LiteIntakeStagingRuntimeError {
    return new LiteIntakeStagingRuntimeError(
      'PERSISTENCE_UNAVAILABLE',
      'Lite Intake Staging persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}

function commitCommandFromReview(
  review: NonNullable<LiteIntakeStagingV1['caseCandidates'][number]['reviewedCommit']>
): CreateProductionIntakeCommandV1 {
  return {
    schemaVersion: 1,
    channel: review.material.channel,
    relationshipModel: review.material.relationshipModel,
    input: clone(review.material.input),
    idempotencyKey: review.markRegIdempotencyKey,
    correlationId: review.correlationId
  };
}

function sameReviewedMaterial(
  intake: Readonly<ProductionIntakeV1>,
  review: NonNullable<LiteIntakeStagingV1['caseCandidates'][number]['reviewedCommit']>
): boolean {
  return (
    intake.channel === review.material.channel &&
    intake.relationshipModel === review.material.relationshipModel &&
    fingerprint(intake.input) === fingerprint(review.material.input)
  );
}
export type LiteIntakeStagingStorePort = Pick<
  PostgresLiteIntakeStagingStore,
  | 'create'
  | 'mutate'
  | 'getExact'
  | 'getLatest'
  | 'listLatest'
  | 'reserveCommand'
  | 'completeReservedCommand'
  | 'transition'
>;

export class LiteIntakeStagingService {
  constructor(
    private readonly store: LiteIntakeStagingStorePort,
    private readonly productionIntakes: LiteIntakeProductionIntakeClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  create(command: Readonly<CreateLiteIntakeStagingCommand>): Promise<LiteIntakeStagingV1> {
    return this.store.create(command);
  }

  async reviseCase(command: Readonly<ReviseLiteIntakeCaseCommand>): Promise<LiteIntakeStagingV1> {
    const requestFingerprint = fingerprint({
      stagingId: command.stagingId,
      caseCandidateId: command.caseCandidateId,
      expectedVersion: command.expectedVersion,
      state: command.state,
      fieldCandidates: command.fieldCandidates,
      sources: command.sources,
      aiExtractions: command.aiExtractions
    });
    return this.store.mutate({
      workspaceId: command.workspaceId,
      stagingId: command.stagingId,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      commandType: 'REVISE_CASE',
      requestFingerprint,
      materialize: (current, at) => {
        if (current.lifecycle !== 'ACTIVE')
          throw new LiteIntakeStagingRuntimeError(
            'INVALID_TRANSITION',
            'Archived Intake Staging cannot be revised.'
          );
        const candidate = caseOf(current, command.caseCandidateId);
        if (!['DRAFT', 'EXTRACTING', 'NEEDS_REVIEW', 'NEEDS_INFORMATION'].includes(candidate.state))
          throw new LiteIntakeStagingRuntimeError(
            'INVALID_TRANSITION',
            'Reviewed or committing Intake cases cannot be revised in place.'
          );
        const drafted = cleanDraftCase({
          caseCandidateId: command.caseCandidateId,
          state: command.state,
          fieldCandidates: command.fieldCandidates
        });
        return replaceCase(
          current,
          { ...drafted, contentVersion: candidate.contentVersion + 1 },
          at,
          {
            ...(command.sources === undefined ? {} : { sources: command.sources }),
            ...(command.aiExtractions === undefined ? {} : { aiExtractions: command.aiExtractions })
          }
        );
      }
    });
  }

  async reviewCase(command: Readonly<ReviewLiteIntakeCaseCommand>): Promise<LiteIntakeStagingV1> {
    const reviewedFingerprintSha256 = liteIntakeReviewedMaterialFingerprintSha256V1(
      command.material
    );
    const requestFingerprint = fingerprint({
      stagingId: command.stagingId,
      caseCandidateId: command.caseCandidateId,
      expectedVersion: command.expectedVersion,
      fieldCandidates: command.fieldCandidates,
      reviewedFingerprintSha256
    });
    return this.store.mutate({
      workspaceId: command.workspaceId,
      stagingId: command.stagingId,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      commandType: 'REVIEW_CASE',
      requestFingerprint,
      materialize: (current, atValue) => {
        if (current.lifecycle !== 'ACTIVE')
          throw new LiteIntakeStagingRuntimeError(
            'INVALID_TRANSITION',
            'Archived Intake Staging cannot be reviewed.'
          );
        const candidate = caseOf(current, command.caseCandidateId);
        if (!['NEEDS_REVIEW', 'NEEDS_INFORMATION'].includes(candidate.state))
          throw new LiteIntakeStagingRuntimeError(
            'INVALID_TRANSITION',
            'Only reviewable Intake cases may be frozen for commit.'
          );
        const confirmedAt = nowIso(atValue);
        const contentVersion = candidate.contentVersion + 1;
        const fields = command.fieldCandidates.map((field) => ({
          ...clone(field),
          reviewedByPrincipalId: cleanText(command.actorPrincipalId, 'actorPrincipalId', 240),
          reviewedAt: confirmedAt
        }));
        const reviewedCommit = {
          reviewedStagingVersion: current.version + 1,
          reviewedContentVersion: contentVersion,
          material: clone(command.material),
          reviewedFingerprintSha256,
          confirmedByPrincipalId: cleanText(command.actorPrincipalId, 'actorPrincipalId', 240),
          confirmedAt,
          markRegIdempotencyKey: `lite-intake:${current.stagingId}:${candidate.caseCandidateId}:${reviewedFingerprintSha256}`,
          correlationId: `liteintake_${reviewedFingerprintSha256.slice(0, 40)}` as MarkOrbitId
        } as const;
        return replaceCase(
          current,
          {
            caseCandidateId: candidate.caseCandidateId,
            contentVersion,
            state: 'READY_TO_COMMIT',
            fieldCandidates: fields,
            reviewedCommit,
            productionIntakeReceipt: null,
            archivedAt: null
          },
          confirmedAt
        );
      }
    });
  }

  async commitCase(
    command: Readonly<CommitLiteIntakeCaseCommand>
  ): Promise<LiteIntakeCommitResult> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    if (command.principal.workspaceId.toLowerCase() !== workspaceId)
      throw new LiteIntakeStagingRuntimeError(
        'NOT_FOUND',
        'Lite Intake Staging was not found in this Workspace.',
        404
      );
    const expectedFingerprint = cleanSha(
      command.expectedReviewedFingerprintSha256,
      'expectedReviewedFingerprintSha256'
    );
    const requestFingerprint = fingerprint({
      stagingId: command.stagingId,
      caseCandidateId: command.caseCandidateId,
      expectedVersion: command.expectedVersion,
      expectedReviewedFingerprintSha256: expectedFingerprint
    });
    const prior = await this.store.reserveCommand(
      workspaceId,
      command.idempotencyKey,
      'COMMIT_CASE',
      requestFingerprint
    );
    if (prior) {
      const priorCase = caseOf(prior, command.caseCandidateId);
      if (priorCase.state === 'COMMITTED') return { status: 'COMMITTED', staging: prior };
    }

    let current = await this.store.getLatest(workspaceId, command.stagingId);
    if (!current)
      throw new LiteIntakeStagingRuntimeError(
        'NOT_FOUND',
        'Lite Intake Staging was not found in this Workspace.',
        404
      );
    let candidate = caseOf(current, command.caseCandidateId);
    const review = candidate.reviewedCommit;
    if (!review)
      throw new LiteIntakeStagingRuntimeError(
        'INVALID_TRANSITION',
        'Commit requires an exact frozen human-reviewed snapshot.'
      );
    if (review.reviewedFingerprintSha256 !== expectedFingerprint)
      throw new LiteIntakeStagingRuntimeError(
        'REVIEW_FINGERPRINT_CONFLICT',
        'Reviewed Intake fingerprint has changed since confirmation.'
      );
    if (candidate.state === 'COMMITTED') {
      const replay = await this.store.completeReservedCommand(
        workspaceId,
        command.idempotencyKey,
        'COMMIT_CASE',
        requestFingerprint,
        current
      );
      return { status: 'COMMITTED', staging: replay };
    }
    if (
      candidate.state === 'READY_TO_COMMIT' &&
      current.version !== cleanVersion(command.expectedVersion)
    )
      throw new LiteIntakeStagingRuntimeError(
        'VERSION_CONFLICT',
        `Expected staging version ${command.expectedVersion}, found ${current.version}.`
      );
    if (!['READY_TO_COMMIT', 'COMMITTING', 'COMMIT_UNCERTAIN'].includes(candidate.state))
      throw new LiteIntakeStagingRuntimeError(
        'INVALID_TRANSITION',
        'Intake case is not eligible for Production Intake commit.'
      );

    if (candidate.state !== 'COMMITTING') {
      current = await this.store.transition({
        workspaceId,
        stagingId: command.stagingId,
        expectedVersion: current.version,
        materialize: (staging, at) => {
          const active = caseOf(staging, command.caseCandidateId);
          if (!['READY_TO_COMMIT', 'COMMIT_UNCERTAIN'].includes(active.state))
            throw new LiteIntakeStagingRuntimeError(
              'INVALID_TRANSITION',
              'Commit transition requires READY_TO_COMMIT or COMMIT_UNCERTAIN.'
            );
          return replaceCase(staging, { ...clone(active), state: 'COMMITTING' }, at);
        }
      });
      candidate = caseOf(current, command.caseCandidateId);
    }

    const frozenReview = candidate.reviewedCommit;
    if (!frozenReview)
      throw new LiteIntakeStagingRuntimeError(
        'INTEGRITY_FAILURE',
        'COMMITTING case lost reviewed snapshot lineage.',
        500
      );
    let ownerAccepted = false;
    try {
      const ownerValue = await this.productionIntakes.create(
        command.principal,
        commitCommandFromReview(frozenReview)
      );
      const owner = parseProductionIntakeV1(ownerValue);
      if (
        owner.workspaceId.toLowerCase() !== workspaceId ||
        !sameReviewedMaterial(owner, frozenReview)
      )
        throw new LiteIntakeStagingRuntimeError(
          'OWNER_RESPONSE_MISMATCH',
          'MarkReg Production Intake response does not match the frozen reviewed material.'
        );
      ownerAccepted = true;

      const committed = await this.store.transition({
        workspaceId,
        stagingId: command.stagingId,
        expectedVersion: current.version,
        materialize: (staging, at) => {
          const active = caseOf(staging, command.caseCandidateId);
          if (active.state !== 'COMMITTING' || !active.reviewedCommit)
            throw new LiteIntakeStagingRuntimeError(
              'INVALID_TRANSITION',
              'Only the exact COMMITTING case may accept a Production Intake receipt.'
            );
          return replaceCase(
            staging,
            {
              ...clone(active),
              state: 'COMMITTED',
              productionIntakeReceipt: {
                intakeId: owner.intakeId,
                version: owner.version,
                fingerprintSha256: owner.fingerprintSha256,
                reviewedFingerprintSha256: active.reviewedCommit.reviewedFingerprintSha256,
                committedAt: nowIso(at)
              }
            },
            at
          );
        }
      });
      const completed = await this.store.completeReservedCommand(
        workspaceId,
        command.idempotencyKey,
        'COMMIT_CASE',
        requestFingerprint,
        committed
      );
      return { status: 'COMMITTED', staging: completed };
    } catch (error) {
      const latest = await this.store.getLatest(workspaceId, command.stagingId);
      if (latest) {
        const latestCase = caseOf(latest, command.caseCandidateId);
        if (
          latestCase.state === 'COMMITTED' &&
          latestCase.reviewedCommit?.reviewedFingerprintSha256 === expectedFingerprint
        ) {
          const completed = await this.store.completeReservedCommand(
            workspaceId,
            command.idempotencyKey,
            'COMMIT_CASE',
            requestFingerprint,
            latest
          );
          return { status: 'COMMITTED', staging: completed };
        }
      }

      const clientError =
        error instanceof LiteIntakeProductionIntakeClientError ? error : undefined;
      const ownerMismatch =
        error instanceof LiteIntakeStagingRuntimeError && error.code === 'OWNER_RESPONSE_MISMATCH';
      if (clientError && !clientError.uncertain) throw error;
      if (!ownerAccepted && !ownerMismatch && !clientError?.uncertain) throw error;

      const base = latest ?? current;
      const baseCase = caseOf(base, command.caseCandidateId);
      let uncertain = base;
      if (baseCase.state === 'COMMITTING') {
        uncertain = await this.store.transition({
          workspaceId,
          stagingId: command.stagingId,
          expectedVersion: base.version,
          materialize: (staging, at) =>
            replaceCase(
              staging,
              { ...clone(caseOf(staging, command.caseCandidateId)), state: 'COMMIT_UNCERTAIN' },
              at
            )
        });
      }
      const uncertainCase = caseOf(uncertain, command.caseCandidateId);
      if (uncertainCase.state !== 'COMMIT_UNCERTAIN') throw error;
      const recorded = await this.store.completeReservedCommand(
        workspaceId,
        command.idempotencyKey,
        'COMMIT_CASE',
        requestFingerprint,
        uncertain
      );
      if (ownerMismatch) throw error;
      return { status: 'COMMIT_UNCERTAIN', staging: recorded };
    }
  }

  getExact(
    workspaceId: string,
    stagingId: LiteIntakeStagingId,
    version: number
  ): Promise<LiteIntakeStagingV1 | undefined> {
    return this.store.getExact(workspaceId, stagingId, version);
  }

  getLatest(
    workspaceId: string,
    stagingId: LiteIntakeStagingId
  ): Promise<LiteIntakeStagingV1 | undefined> {
    return this.store.getLatest(workspaceId, stagingId);
  }

  listLatest(
    workspaceId: string,
    options: Readonly<{ lifecycle?: LiteIntakeStagingLifecycle; limit?: number }> = {}
  ): Promise<readonly LiteIntakeStagingV1[]> {
    return this.store.listLatest(workspaceId, options);
  }
}
