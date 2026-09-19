import { createHash } from 'node:crypto';
import {
  parseEmailDeliveryAttemptV1,
  parseEmailDeliveryObservationV1,
  type EmailDeliveryAttemptId,
  type EmailDeliveryAttemptStatusV1,
  type EmailDeliveryAttemptV1,
  type EmailDeliveryObservationV1
} from '@markorbit/contracts/email-delivery';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

type Row = Record<string, unknown>;
type CommandType = 'CREATE_ATTEMPT' | 'UPDATE_ATTEMPT' | 'RECORD_OBSERVATION';

export type EmailDeliveryPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'STATE_CONFLICT'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class EmailDeliveryPersistenceError extends Error {
  constructor(
    readonly code: EmailDeliveryPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'EmailDeliveryPersistenceError';
  }
}

export interface CreateEmailDeliveryAttemptCommand {
  value: Readonly<EmailDeliveryAttemptV1>;
  idempotencyKey: string;
}

export interface UpdateEmailDeliveryAttemptCommand {
  value: Readonly<EmailDeliveryAttemptV1>;
  expectedStatus: EmailDeliveryAttemptStatusV1;
  idempotencyKey: string;
}

export interface RecordEmailDeliveryObservationCommand {
  value: Readonly<EmailDeliveryObservationV1>;
  idempotencyKey: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function workspace(value: string): string {
  const result = value.trim().toLowerCase();
  if (!UUID.test(result))
    throw new EmailDeliveryPersistenceError('INVALID_INPUT', 'workspaceId must be a UUID.', 422);
  return result;
}

function key(value: string): string {
  const result = value.trim();
  if (!result || result.length > 500)
    throw new EmailDeliveryPersistenceError(
      'INVALID_INPUT',
      'idempotencyKey must contain 1 to 500 characters.',
      422
    );
  return result;
}

function providerRef(value: string): string {
  const result = value.trim();
  if (!result || result.length > 500)
    throw new EmailDeliveryPersistenceError(
      'INVALID_INPUT',
      'providerSubmissionRef must contain 1 to 500 characters.',
      422
    );
  return result;
}

function persistedAttempt(value: unknown): EmailDeliveryAttemptV1 {
  try {
    return parseEmailDeliveryAttemptV1(value);
  } catch (error) {
    throw new EmailDeliveryPersistenceError(
      'INTEGRITY_FAILURE',
      'Persisted email delivery attempt failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function persistedObservation(value: unknown): EmailDeliveryObservationV1 {
  try {
    return parseEmailDeliveryObservationV1(value);
  } catch (error) {
    throw new EmailDeliveryPersistenceError(
      'INTEGRITY_FAILURE',
      'Persisted email delivery observation failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function sameTimestamp(rowValue: unknown, documentValue: string): boolean {
  if (rowValue instanceof Date) return rowValue.getTime() === Date.parse(documentValue);
  if (typeof rowValue !== 'string') return false;
  return Date.parse(rowValue) === Date.parse(documentValue);
}

function attemptFromRow(row: Row): EmailDeliveryAttemptV1 {
  const value = persistedAttempt(row.document_json);
  if (
    value.workspaceId !== String(row.workspace_id) ||
    value.deliveryAttemptId !== String(row.delivery_attempt_id) ||
    value.executionRelease.releaseId !== String(row.execution_release_id) ||
    value.campaign.campaignId !== String(row.campaign_id) ||
    value.campaign.version !== Number(row.campaign_version) ||
    value.senderProfile.senderProfileId !== String(row.sender_profile_id) ||
    value.senderProfile.version !== Number(row.sender_profile_version) ||
    value.shardIndex !== Number(row.shard_index) ||
    value.attemptNumber !== Number(row.attempt_number) ||
    value.status !== String(row.status) ||
    value.recipientCount !== Number(row.recipient_count) ||
    value.recipientManifestFingerprintSha256 !==
      String(row.recipient_manifest_fingerprint_sha256) ||
    value.deliveryPlanFingerprintSha256 !== String(row.delivery_plan_fingerprint_sha256) ||
    value.correlationId !== String(row.correlation_id) ||
    (value.providerSubmissionRef ?? null) !== (row.provider_submission_ref ?? null) ||
    !sameTimestamp(row.created_at, value.createdAt) ||
    !sameTimestamp(row.updated_at, value.updatedAt)
  )
    throw new EmailDeliveryPersistenceError(
      'INTEGRITY_FAILURE',
      'Email delivery attempt row/document mismatch.',
      500
    );
  return value;
}

function observationFromRow(row: Row): EmailDeliveryObservationV1 {
  const value = persistedObservation(row.document_json);
  if (
    value.workspaceId !== String(row.workspace_id) ||
    value.observationId !== String(row.observation_id) ||
    value.deliveryAttempt.deliveryAttemptId !== String(row.delivery_attempt_id) ||
    value.eventIdentity !== String(row.event_identity) ||
    value.event !== String(row.event) ||
    value.evidenceKind !== String(row.evidence_kind) ||
    (value.providerMessageRef ?? null) !== (row.provider_message_ref ?? null) ||
    (value.endpointFingerprintSha256 ?? null) !== (row.endpoint_fingerprint_sha256 ?? null) ||
    value.authenticatedEvidence !== Boolean(row.authenticated_evidence) ||
    value.reasonCode !== String(row.reason_code) ||
    !sameTimestamp(row.event_at, value.eventAt) ||
    !sameTimestamp(row.observed_at, value.observedAt)
  )
    throw new EmailDeliveryPersistenceError(
      'INTEGRITY_FAILURE',
      'Email delivery observation row/document mismatch.',
      500
    );
  return value;
}

function immutableAttemptIdentity(value: Readonly<EmailDeliveryAttemptV1>) {
  return {
    deliveryAttemptId: value.deliveryAttemptId,
    workspaceId: value.workspaceId,
    executionRelease: value.executionRelease,
    campaign: value.campaign,
    senderProfile: value.senderProfile,
    implementation: value.implementation,
    shardIndex: value.shardIndex,
    recipientCount: value.recipientCount,
    recipientManifestFingerprintSha256: value.recipientManifestFingerprintSha256,
    deliveryPlanFingerprintSha256: value.deliveryPlanFingerprintSha256,
    correlationId: value.correlationId,
    attemptNumber: value.attemptNumber,
    createdAt: value.createdAt,
    authority: value.authority
  };
}

export class PostgresEmailDeliveryStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async createAttempt(
    command: Readonly<CreateEmailDeliveryAttemptCommand>
  ): Promise<EmailDeliveryAttemptV1> {
    let value: EmailDeliveryAttemptV1;
    try {
      value = parseEmailDeliveryAttemptV1(command.value);
    } catch (error) {
      throw new EmailDeliveryPersistenceError(
        'INVALID_INPUT',
        'Email delivery attempt contract validation failed.',
        422,
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    if (value.status !== 'PLANNED')
      throw new EmailDeliveryPersistenceError(
        'INVALID_INPUT',
        'New delivery attempt must start as PLANNED.',
        422
      );
    return this.command(
      'CREATE_ATTEMPT',
      value.workspaceId,
      command.idempotencyKey,
      value,
      persistedAttempt,
      async (client) => {
        await this.lock(client, `${value.workspaceId}:email-delivery:${value.deliveryAttemptId}`);
        const existing = await client.query<Row>(
          `SELECT * FROM lite_email_delivery_attempts
          WHERE workspace_id=$1 AND delivery_attempt_id=$2`,
          [value.workspaceId, value.deliveryAttemptId]
        );
        if (existing.rows[0]) return attemptFromRow(existing.rows[0]);
        await client.query(
          `INSERT INTO lite_email_delivery_attempts(
           workspace_id,delivery_attempt_id,execution_release_id,campaign_id,campaign_version,
           sender_profile_id,sender_profile_version,shard_index,attempt_number,status,
           recipient_count,recipient_manifest_fingerprint_sha256,delivery_plan_fingerprint_sha256,
           correlation_id,provider_submission_ref,document_json,created_at,updated_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18)`,
          [
            value.workspaceId,
            value.deliveryAttemptId,
            value.executionRelease.releaseId,
            value.campaign.campaignId,
            value.campaign.version,
            value.senderProfile.senderProfileId,
            value.senderProfile.version,
            value.shardIndex,
            value.attemptNumber,
            value.status,
            value.recipientCount,
            value.recipientManifestFingerprintSha256,
            value.deliveryPlanFingerprintSha256,
            value.correlationId,
            value.providerSubmissionRef ?? null,
            JSON.stringify(value),
            value.createdAt,
            value.updatedAt
          ]
        );
        return structuredClone(value);
      }
    );
  }

  async updateAttempt(
    command: Readonly<UpdateEmailDeliveryAttemptCommand>
  ): Promise<EmailDeliveryAttemptV1> {
    let value: EmailDeliveryAttemptV1;
    try {
      value = parseEmailDeliveryAttemptV1(command.value);
    } catch (error) {
      throw new EmailDeliveryPersistenceError(
        'INVALID_INPUT',
        'Email delivery attempt contract validation failed.',
        422,
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    return this.command(
      'UPDATE_ATTEMPT',
      value.workspaceId,
      command.idempotencyKey,
      {
        value,
        expectedStatus: command.expectedStatus
      },
      persistedAttempt,
      async (client) => {
        await this.lock(client, `${value.workspaceId}:email-delivery:${value.deliveryAttemptId}`);
        const currentResult = await client.query<Row>(
          `SELECT * FROM lite_email_delivery_attempts
          WHERE workspace_id=$1 AND delivery_attempt_id=$2`,
          [value.workspaceId, value.deliveryAttemptId]
        );
        if (!currentResult.rows[0])
          throw new EmailDeliveryPersistenceError(
            'NOT_FOUND',
            'Email delivery attempt not found.',
            404
          );
        const current = attemptFromRow(currentResult.rows[0]);
        if (current.status !== command.expectedStatus)
          throw new EmailDeliveryPersistenceError(
            'STATE_CONFLICT',
            `Expected attempt status ${command.expectedStatus}, found ${current.status}.`
          );
        if (hash(immutableAttemptIdentity(current)) !== hash(immutableAttemptIdentity(value)))
          throw new EmailDeliveryPersistenceError(
            'STATE_CONFLICT',
            'Email delivery attempt immutable identity cannot change.'
          );
        if (Date.parse(value.updatedAt) < Date.parse(current.updatedAt))
          throw new EmailDeliveryPersistenceError(
            'STATE_CONFLICT',
            'Email delivery attempt updatedAt cannot move backwards.'
          );
        await client.query(
          `UPDATE lite_email_delivery_attempts
            SET status=$3,provider_submission_ref=$4,document_json=$5::jsonb,updated_at=$6
          WHERE workspace_id=$1 AND delivery_attempt_id=$2`,
          [
            value.workspaceId,
            value.deliveryAttemptId,
            value.status,
            value.providerSubmissionRef ?? null,
            JSON.stringify(value),
            value.updatedAt
          ]
        );
        return structuredClone(value);
      }
    );
  }

  async recordObservation(
    command: Readonly<RecordEmailDeliveryObservationCommand>
  ): Promise<EmailDeliveryObservationV1> {
    let value: EmailDeliveryObservationV1;
    try {
      value = parseEmailDeliveryObservationV1(command.value);
    } catch (error) {
      throw new EmailDeliveryPersistenceError(
        'INVALID_INPUT',
        'Email delivery observation contract validation failed.',
        422,
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    return this.command(
      'RECORD_OBSERVATION',
      value.workspaceId,
      command.idempotencyKey,
      value,
      persistedObservation,
      async (client) => {
        await this.lock(client, `${value.workspaceId}:email-delivery-event:${value.eventIdentity}`);
        const attempt = await client.query<Row>(
          `SELECT delivery_attempt_id FROM lite_email_delivery_attempts
            WHERE workspace_id=$1 AND delivery_attempt_id=$2`,
          [value.workspaceId, value.deliveryAttempt.deliveryAttemptId]
        );
        if (!attempt.rows[0])
          throw new EmailDeliveryPersistenceError(
            'NOT_FOUND',
            'Observation delivery attempt not found.',
            404
          );
        const duplicate = await client.query<Row>(
          `SELECT * FROM lite_email_delivery_observations
            WHERE workspace_id=$1 AND event_identity=$2`,
          [value.workspaceId, value.eventIdentity]
        );
        if (duplicate.rows[0]) return observationFromRow(duplicate.rows[0]);
        await client.query(
          `INSERT INTO lite_email_delivery_observations(
             workspace_id,observation_id,delivery_attempt_id,event_identity,event,evidence_kind,
             provider_message_ref,endpoint_fingerprint_sha256,authenticated_evidence,reason_code,
             event_at,observed_at,document_json
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11,$12::jsonb)`,
          [
            value.workspaceId,
            value.observationId,
            value.deliveryAttempt.deliveryAttemptId,
            value.eventIdentity,
            value.event,
            value.evidenceKind,
            value.providerMessageRef ?? null,
            value.endpointFingerprintSha256 ?? null,
            value.reasonCode,
            value.eventAt,
            value.observedAt,
            JSON.stringify(value)
          ]
        );
        return structuredClone(value);
      }
    );
  }

  async getAttempt(
    workspaceId: string,
    deliveryAttemptId: EmailDeliveryAttemptId
  ): Promise<EmailDeliveryAttemptV1> {
    try {
      const result = await this.query.query<Row>(
        `SELECT * FROM lite_email_delivery_attempts
          WHERE workspace_id=$1 AND delivery_attempt_id=$2`,
        [workspace(workspaceId), deliveryAttemptId]
      );
      if (!result.rows[0])
        throw new EmailDeliveryPersistenceError(
          'NOT_FOUND',
          'Email delivery attempt not found.',
          404
        );
      return attemptFromRow(result.rows[0]);
    } catch (error) {
      if (error instanceof EmailDeliveryPersistenceError) throw error;
      throw this.persistenceError(error);
    }
  }

  async findAttemptByProviderSubmissionRef(
    workspaceId: string,
    providerSubmissionRef: string
  ): Promise<EmailDeliveryAttemptV1 | undefined> {
    try {
      const result = await this.query.query<Row>(
        `SELECT * FROM lite_email_delivery_attempts
          WHERE workspace_id=$1 AND provider_submission_ref=$2
          ORDER BY delivery_attempt_id ASC
          LIMIT 2`,
        [workspace(workspaceId), providerRef(providerSubmissionRef)]
      );
      if (result.rows.length > 1)
        throw new EmailDeliveryPersistenceError(
          'INTEGRITY_FAILURE',
          'Provider submission reference maps to multiple delivery attempts.',
          500
        );
      return result.rows[0] ? attemptFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof EmailDeliveryPersistenceError) throw error;
      throw this.persistenceError(error);
    }
  }

  async listObservations(
    workspaceId: string,
    deliveryAttemptId: EmailDeliveryAttemptId
  ): Promise<readonly EmailDeliveryObservationV1[]> {
    try {
      const result = await this.query.query<Row>(
        `SELECT * FROM lite_email_delivery_observations
          WHERE workspace_id=$1 AND delivery_attempt_id=$2
          ORDER BY event_at ASC,observed_at ASC,observation_id ASC`,
        [workspace(workspaceId), deliveryAttemptId]
      );
      return result.rows.map(observationFromRow);
    } catch (error) {
      if (error instanceof EmailDeliveryPersistenceError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async command<T>(
    commandType: CommandType,
    workspaceId: string,
    idempotencyKey: string,
    request: unknown,
    parseReplay: (value: unknown) => T,
    execute: (client: QueryClient) => Promise<T>
  ): Promise<T> {
    const w = workspace(workspaceId);
    const commandKey = key(idempotencyKey);
    const fingerprint = hash({ commandType, request });
    try {
      return await this.database.transact(async (client) => {
        await this.lock(client, `${w}:email-delivery-command:${commandKey}`);
        const replay = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_email_delivery_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [w, commandKey]
        );
        const prior = replay.rows[0];
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== fingerprint
          )
            throw new EmailDeliveryPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was used with a different email delivery command.'
            );
          const parsed = parseReplay(prior.result_json);
          await this.verifyReplayIntegrity(client, commandType, parsed);
          return structuredClone(parsed);
        }
        const result = await execute(client);
        await client.query(
          `INSERT INTO lite_email_delivery_commands(
             workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
           ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
          [w, commandKey, commandType, fingerprint, JSON.stringify(result), this.timestamp()]
        );
        return result;
      });
    } catch (error) {
      if (error instanceof EmailDeliveryPersistenceError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async verifyReplayIntegrity(
    client: QueryClient,
    commandType: CommandType,
    parsed: unknown
  ): Promise<void> {
    if (commandType === 'CREATE_ATTEMPT' || commandType === 'UPDATE_ATTEMPT') {
      const replay = persistedAttempt(parsed);
      const durable = await client.query<Row>(
        `SELECT * FROM lite_email_delivery_attempts
          WHERE workspace_id=$1 AND delivery_attempt_id=$2`,
        [replay.workspaceId, replay.deliveryAttemptId]
      );
      if (!durable.rows[0] || hash(attemptFromRow(durable.rows[0])) !== hash(replay))
        throw new EmailDeliveryPersistenceError(
          'INTEGRITY_FAILURE',
          'Email delivery command replay does not match durable attempt truth.',
          500
        );
      return;
    }

    const replay = persistedObservation(parsed);
    const durable = await client.query<Row>(
      `SELECT * FROM lite_email_delivery_observations
        WHERE workspace_id=$1 AND observation_id=$2`,
      [replay.workspaceId, replay.observationId]
    );
    if (!durable.rows[0] || hash(observationFromRow(durable.rows[0])) !== hash(replay))
      throw new EmailDeliveryPersistenceError(
        'INTEGRITY_FAILURE',
        'Email delivery command replay does not match durable observation truth.',
        500
      );
  }

  private async lock(client: QueryClient, value: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [value]);
  }

  private timestamp(): string {
    const value = this.now();
    if (!Number.isFinite(Date.parse(value)))
      throw new EmailDeliveryPersistenceError('INVALID_INPUT', 'Runtime clock is invalid.', 500);
    return new Date(value).toISOString();
  }

  private persistenceError(cause: unknown): EmailDeliveryPersistenceError {
    return new EmailDeliveryPersistenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Email delivery persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
