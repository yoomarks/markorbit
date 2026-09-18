import { createHash } from 'node:crypto';
import {
  evaluateWorkspaceEmailSenderCurrentnessV1,
  parseWorkspaceEmailSenderProfileV1,
  workspaceEmailSenderProfileStatusesV1,
  type WorkspaceEmailSenderCurrentnessV1,
  type WorkspaceEmailSenderProfileId,
  type WorkspaceEmailSenderProfileStatusV1,
  type WorkspaceEmailSenderProfileV1
} from '@markorbit/contracts/email-sender-profile';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

type Row = Record<string, unknown>;
type CommandType = 'CREATE' | 'UPDATE' | 'VERIFY' | 'SUSPEND' | 'REVOKE';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PROFILE_ID = /^email-sender-profile_[A-Za-z0-9_-]+$/u;

export type EmailSenderProfilePersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class EmailSenderProfilePersistenceError extends Error {
  constructor(
    readonly code: EmailSenderProfilePersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'EmailSenderProfilePersistenceError';
  }
}

export interface CreateEmailSenderProfileCommand {
  value: Readonly<WorkspaceEmailSenderProfileV1>;
  idempotencyKey: string;
}

export interface UpdateEmailSenderProfileCommand {
  value: Readonly<WorkspaceEmailSenderProfileV1>;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface ListEmailSenderProfilesOptions {
  statuses?: readonly WorkspaceEmailSenderProfileStatusV1[];
  limit?: number;
}

const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function workspace(value: string): string {
  const result = value.trim().toLowerCase();
  if (!UUID.test(result))
    throw new EmailSenderProfilePersistenceError(
      'INVALID_INPUT',
      'workspaceId must be a UUID.',
      422
    );
  return result;
}

function profileId(value: string): WorkspaceEmailSenderProfileId {
  const result = value.trim();
  if (!PROFILE_ID.test(result))
    throw new EmailSenderProfilePersistenceError(
      'INVALID_INPUT',
      'senderProfileId is invalid.',
      422
    );
  return result as WorkspaceEmailSenderProfileId;
}

function nonNegativeVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new EmailSenderProfilePersistenceError(
      'INVALID_INPUT',
      'expectedVersion must be a non-negative safe integer.',
      422
    );
  return value;
}

function key(value: string): string {
  const result = value.trim();
  if (!result || result.length > 500)
    throw new EmailSenderProfilePersistenceError(
      'INVALID_INPUT',
      'idempotencyKey must contain 1 to 500 characters.',
      422
    );
  return result;
}

function persisted(value: unknown): WorkspaceEmailSenderProfileV1 {
  try {
    return parseWorkspaceEmailSenderProfileV1(value);
  } catch (error) {
    throw new EmailSenderProfilePersistenceError(
      'INTEGRITY_FAILURE',
      'Persisted sender profile failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function sameTimestamp(rowValue: unknown, documentValue: string): boolean {
  if (rowValue instanceof Date) return rowValue.getTime() === Date.parse(documentValue);
  if (typeof rowValue !== 'string') return false;
  const parsed = Date.parse(rowValue);
  return Number.isFinite(parsed) && parsed === Date.parse(documentValue);
}

function parseRow(row: Row): WorkspaceEmailSenderProfileV1 {
  const value = persisted(row.document_json);
  if (
    value.workspaceId !== String(row.workspace_id) ||
    value.senderProfileId !== String(row.sender_profile_id) ||
    value.version !== Number(row.version) ||
    value.status !== String(row.status) ||
    value.fromDomain !== String(row.from_domain) ||
    value.fromAddress !== String(row.from_address) ||
    value.verification.status !== String(row.verification_status) ||
    !sameTimestamp(row.verification_observed_at, value.verification.observedAt) ||
    value.reputationIsolationKey !== String(row.reputation_isolation_key) ||
    !sameTimestamp(row.updated_at, value.updatedAt)
  )
    throw new EmailSenderProfilePersistenceError(
      'INTEGRITY_FAILURE',
      'Sender profile row/document mismatch.',
      500
    );
  return value;
}

export class PostgresEmailSenderProfileStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  createSenderProfile(
    command: Readonly<CreateEmailSenderProfileCommand>
  ): Promise<WorkspaceEmailSenderProfileV1> {
    if (command.value.version !== 1)
      throw new EmailSenderProfilePersistenceError(
        'VERSION_CONFLICT',
        'New sender profile must start at version 1.'
      );
    return this.save('CREATE', command.value, 0, command.idempotencyKey);
  }

  updateSenderProfile(
    command: Readonly<UpdateEmailSenderProfileCommand>
  ): Promise<WorkspaceEmailSenderProfileV1> {
    return this.save('UPDATE', command.value, command.expectedVersion, command.idempotencyKey);
  }

  recordVerificationObservation(
    command: Readonly<UpdateEmailSenderProfileCommand>
  ): Promise<WorkspaceEmailSenderProfileV1> {
    return this.save('VERIFY', command.value, command.expectedVersion, command.idempotencyKey);
  }

  suspendSenderProfile(
    command: Readonly<UpdateEmailSenderProfileCommand>
  ): Promise<WorkspaceEmailSenderProfileV1> {
    if (command.value.status !== 'SUSPENDED')
      throw new EmailSenderProfilePersistenceError(
        'INVALID_INPUT',
        'Suspension command requires SUSPENDED status.',
        422
      );
    return this.save('SUSPEND', command.value, command.expectedVersion, command.idempotencyKey);
  }

  revokeSenderProfile(
    command: Readonly<UpdateEmailSenderProfileCommand>
  ): Promise<WorkspaceEmailSenderProfileV1> {
    if (command.value.status !== 'REVOKED')
      throw new EmailSenderProfilePersistenceError(
        'INVALID_INPUT',
        'Revocation command requires REVOKED status.',
        422
      );
    return this.save('REVOKE', command.value, command.expectedVersion, command.idempotencyKey);
  }

  async getExactSenderProfile(
    workspaceId: string,
    senderProfileId: WorkspaceEmailSenderProfileId,
    version: number
  ): Promise<WorkspaceEmailSenderProfileV1> {
    if (!Number.isSafeInteger(version) || version < 1)
      throw new EmailSenderProfilePersistenceError(
        'INVALID_INPUT',
        'version must be positive.',
        422
      );
    return this.queryOne(
      `SELECT * FROM lite_email_sender_profile_versions
        WHERE workspace_id=$1 AND sender_profile_id=$2 AND version=$3`,
      [workspace(workspaceId), profileId(senderProfileId), version]
    );
  }

  async getLatestSenderProfile(
    workspaceId: string,
    senderProfileId: WorkspaceEmailSenderProfileId
  ): Promise<WorkspaceEmailSenderProfileV1> {
    return this.queryOne(
      `SELECT * FROM lite_email_sender_profile_versions
        WHERE workspace_id=$1 AND sender_profile_id=$2
        ORDER BY version DESC LIMIT 1`,
      [workspace(workspaceId), profileId(senderProfileId)]
    );
  }

  async listSenderProfiles(
    workspaceId: string,
    options: Readonly<ListEmailSenderProfilesOptions> = {}
  ): Promise<readonly WorkspaceEmailSenderProfileV1[]> {
    const w = workspace(workspaceId);
    const limit = options.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new EmailSenderProfilePersistenceError(
        'INVALID_INPUT',
        'limit must be between 1 and 100.',
        422
      );
    const statuses = options.statuses ? [...new Set(options.statuses)] : null;
    if (statuses?.some((status) => !workspaceEmailSenderProfileStatusesV1.includes(status)))
      throw new EmailSenderProfilePersistenceError(
        'INVALID_INPUT',
        'statuses contains an invalid sender profile status.',
        422
      );
    try {
      const result = await this.query.query<Row>(
        `SELECT * FROM (
           SELECT DISTINCT ON (sender_profile_id) *
             FROM lite_email_sender_profile_versions
            WHERE workspace_id=$1
            ORDER BY sender_profile_id,version DESC
         ) heads
         WHERE ($2::text[] IS NULL OR status = ANY($2::text[]))
         ORDER BY updated_at DESC,sender_profile_id ASC
         LIMIT $3`,
        [w, statuses, limit]
      );
      return result.rows.map(parseRow);
    } catch (error) {
      if (error instanceof EmailSenderProfilePersistenceError) throw error;
      throw this.persistenceError(error);
    }
  }

  async evaluateSenderProfileCurrentness(
    workspaceId: string,
    senderProfileId: WorkspaceEmailSenderProfileId,
    verificationMaximumAgeMs: number
  ): Promise<WorkspaceEmailSenderCurrentnessV1> {
    const value = await this.getLatestSenderProfile(workspaceId, senderProfileId);
    return evaluateWorkspaceEmailSenderCurrentnessV1(
      value,
      this.timestamp(),
      verificationMaximumAgeMs
    );
  }

  private async save(
    type: CommandType,
    raw: Readonly<WorkspaceEmailSenderProfileV1>,
    expectedVersion: number,
    idempotencyKey: string
  ): Promise<WorkspaceEmailSenderProfileV1> {
    let value: WorkspaceEmailSenderProfileV1;
    try {
      value = parseWorkspaceEmailSenderProfileV1(raw);
    } catch (error) {
      throw new EmailSenderProfilePersistenceError(
        'INVALID_INPUT',
        'Sender profile contract validation failed.',
        422,
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    const w = workspace(value.workspaceId);
    const id = profileId(value.senderProfileId);
    const expected = nonNegativeVersion(expectedVersion);
    const commandKey = key(idempotencyKey);
    if (value.version !== expected + 1)
      throw new EmailSenderProfilePersistenceError(
        'VERSION_CONFLICT',
        `Version ${value.version} must immediately follow expectedVersion ${expected}.`
      );
    const requestFingerprint = hash({ type, value, expectedVersion: expected });

    try {
      return await this.database.transact(async (client) => {
        await this.lock(client, `${w}:email-sender-profile:idempotency:${commandKey}`);
        const replay = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_email_sender_profile_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [w, commandKey]
        );
        const prior = replay.rows[0];
        if (prior) {
          if (
            String(prior.command_type) !== type ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new EmailSenderProfilePersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was used with a different sender-profile command.'
            );
          return persisted(prior.result_json);
        }

        await this.lock(client, `${w}:email-sender-profile:${id}`);
        const actual = await this.latestVersion(client, w, id);
        if (actual !== expected)
          throw new EmailSenderProfilePersistenceError(
            'VERSION_CONFLICT',
            `Expected sender profile version ${expected}, found ${actual}.`
          );

        await client.query(
          `INSERT INTO lite_email_sender_profile_versions(
             workspace_id,sender_profile_id,version,status,from_domain,from_address,
             verification_status,verification_observed_at,reputation_isolation_key,
             document_json,updated_at,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)`,
          [
            w,
            id,
            value.version,
            value.status,
            value.fromDomain,
            value.fromAddress,
            value.verification.status,
            value.verification.observedAt,
            value.reputationIsolationKey,
            JSON.stringify(value),
            value.updatedAt,
            this.timestamp()
          ]
        );
        await client.query(
          `INSERT INTO lite_email_sender_profile_commands(
             workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
           ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
          [w, commandKey, type, requestFingerprint, JSON.stringify(value), this.timestamp()]
        );
        return clone(value);
      });
    } catch (error) {
      if (error instanceof EmailSenderProfilePersistenceError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async latestVersion(
    client: QueryClient,
    workspaceId: string,
    senderProfileId: WorkspaceEmailSenderProfileId
  ): Promise<number> {
    const result = await client.query<Row>(
      `SELECT version FROM lite_email_sender_profile_versions
        WHERE workspace_id=$1 AND sender_profile_id=$2
        ORDER BY version DESC LIMIT 1`,
      [workspaceId, senderProfileId]
    );
    return result.rows[0] ? Number(result.rows[0].version) : 0;
  }

  private async queryOne(
    sql: string,
    params: readonly unknown[]
  ): Promise<WorkspaceEmailSenderProfileV1> {
    try {
      const result = await this.query.query<Row>(sql, [...params]);
      const row = result.rows[0];
      if (!row)
        throw new EmailSenderProfilePersistenceError(
          'NOT_FOUND',
          'Email sender profile was not found.',
          404
        );
      return parseRow(row);
    } catch (error) {
      if (error instanceof EmailSenderProfilePersistenceError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async lock(client: QueryClient, value: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [value]);
  }

  private timestamp(): string {
    const value = this.now();
    if (!Number.isFinite(Date.parse(value)))
      throw new EmailSenderProfilePersistenceError(
        'INVALID_INPUT',
        'Runtime clock is invalid.',
        500
      );
    return new Date(value).toISOString();
  }

  private persistenceError(cause: unknown): EmailSenderProfilePersistenceError {
    return new EmailSenderProfilePersistenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Email sender profile persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
