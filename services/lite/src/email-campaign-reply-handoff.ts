import { createHash } from 'node:crypto';
import {
  noEmailCampaignReplyHandoffAuthorityConsequencesV1,
  parseEmailCampaignReplyHandoffV1,
  type EmailCampaignReplyCorrelationMethodV1,
  type EmailCampaignReplyHandoffV1
} from '@markorbit/contracts/email-campaign-reply-handoff';
import {
  parseManagedCommunicationMessageV1,
  type ManagedCommunicationMessageV1
} from '@markorbit/contracts/managed-communication';
import type { EmailDeliveryAttemptV1 } from '@markorbit/contracts/email-delivery';
import type { WorkspaceEmailSenderProfileV1 } from '@markorbit/contracts/email-sender-profile';
import type { EmailCampaignV1 } from '@markorbit/contracts/email-campaign';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

type Row = Record<string, unknown>;

export type EmailCampaignReplyHandoffPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class EmailCampaignReplyHandoffPersistenceError extends Error {
  constructor(
    readonly code: EmailCampaignReplyHandoffPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'EmailCampaignReplyHandoffPersistenceError';
  }
}

export type EmailCampaignReplyCorrelationErrorCode =
  | 'INVALID_INBOUND_EVIDENCE'
  | 'CORRELATION_NOT_FOUND'
  | 'CORRELATION_AMBIGUOUS'
  | 'LINEAGE_MISMATCH'
  | 'REPLY_ACCOUNT_MISMATCH'
  | 'INVALID_CLOCK';

export class EmailCampaignReplyCorrelationError extends Error {
  constructor(
    readonly code: EmailCampaignReplyCorrelationErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'EmailCampaignReplyCorrelationError';
  }
}

export interface EmailCampaignReplyInboundEvidenceV1 {
  evidenceRef: string;
  sha256: string;
  provider: string;
  providerMessageId: string;
  observedAt: string;
  headers: readonly Readonly<{ name: string; value: string }>[];
}

export interface EmailCampaignReplyReferenceCandidateV1 {
  providerSubmissionRef: string;
  correlationMethod: EmailCampaignReplyCorrelationMethodV1;
}

export interface EmailCampaignReplyReferenceCorrelatorV1 {
  candidates(
    headers: readonly Readonly<{ name: string; value: string }>[]
  ): readonly Readonly<EmailCampaignReplyReferenceCandidateV1>[];
}

export interface EmailCampaignReplyDeliveryReaderV1 {
  findAttemptByProviderSubmissionRef(
    workspaceId: string,
    providerSubmissionRef: string
  ): Promise<EmailDeliveryAttemptV1 | undefined>;
}

export interface EmailCampaignReplyCampaignReaderV1 {
  getCampaignVersion(
    workspaceId: string,
    campaignId: EmailCampaignV1['campaignId'],
    version: number
  ): Promise<EmailCampaignV1>;
}

export interface EmailCampaignReplySenderProfileReaderV1 {
  getExactSenderProfile(
    workspaceId: string,
    senderProfileId: EmailDeliveryAttemptV1['senderProfile']['senderProfileId'],
    version: number
  ): Promise<WorkspaceEmailSenderProfileV1>;
}

export interface RecordEmailCampaignReplyHandoffCommandV1 {
  value: Readonly<EmailCampaignReplyHandoffV1>;
  idempotencyKey: string;
}

export interface EmailCampaignReplyHandoffWriterV1 {
  recordHandoff(
    command: Readonly<RecordEmailCampaignReplyHandoffCommandV1>
  ): Promise<EmailCampaignReplyHandoffV1>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[a-f0-9]{64}$/u;

function clean(value: string, field: string, max = 1000): string {
  const result = value.trim();
  if (!result || result.length > max)
    throw new EmailCampaignReplyCorrelationError(
      'INVALID_INBOUND_EVIDENCE',
      `${field} must contain 1 to ${max} characters.`
    );
  return result;
}

function workspace(value: string): string {
  const result = value.trim().toLowerCase();
  if (!UUID.test(result))
    throw new EmailCampaignReplyHandoffPersistenceError(
      'INVALID_INPUT',
      'workspaceId must be a UUID.',
      422
    );
  return result;
}

function idempotencyKey(value: string): string {
  const result = value.trim();
  if (!result || result.length > 500)
    throw new EmailCampaignReplyHandoffPersistenceError(
      'INVALID_INPUT',
      'idempotencyKey must contain 1 to 500 characters.',
      422
    );
  return result;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function persisted(value: unknown): EmailCampaignReplyHandoffV1 {
  try {
    return parseEmailCampaignReplyHandoffV1(value);
  } catch (error) {
    throw new EmailCampaignReplyHandoffPersistenceError(
      'INTEGRITY_FAILURE',
      'Persisted reply handoff failed contract validation.',
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

function fromRow(row: Row): EmailCampaignReplyHandoffV1 {
  const value = persisted(row.document_json);
  if (
    value.workspaceId !== String(row.workspace_id) ||
    value.replyHandoffId !== String(row.reply_handoff_id) ||
    value.campaign.campaignId !== String(row.campaign_id) ||
    value.campaign.version !== Number(row.campaign_version) ||
    value.deliveryAttempt.deliveryAttemptId !== String(row.delivery_attempt_id) ||
    value.senderProfile.senderProfileId !== String(row.sender_profile_id) ||
    value.senderProfile.version !== Number(row.sender_profile_version) ||
    value.managedCommunication.accountRef !== String(row.managed_account_ref) ||
    value.managedCommunication.messageId !== String(row.managed_message_id) ||
    value.managedCommunication.threadRef !== String(row.managed_thread_ref) ||
    value.managedCommunication.provider !== String(row.managed_provider) ||
    value.managedCommunication.providerMessageId !== String(row.managed_provider_message_id) ||
    value.inboundEvidence.evidenceRef !== String(row.inbound_evidence_ref) ||
    value.inboundEvidence.sha256 !== String(row.inbound_evidence_sha256) ||
    value.outboundProviderSubmissionRef !== String(row.outbound_provider_submission_ref) ||
    value.correlationMethod !== String(row.correlation_method) ||
    value.evidenceFingerprintSha256 !== String(row.evidence_fingerprint_sha256) ||
    value.status !== String(row.status) ||
    !sameTimestamp(row.created_at, value.createdAt)
  )
    throw new EmailCampaignReplyHandoffPersistenceError(
      'INTEGRITY_FAILURE',
      'Reply handoff row/document mismatch.',
      500
    );
  return value;
}

export class PostgresEmailCampaignReplyHandoffStore implements EmailCampaignReplyHandoffWriterV1 {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async recordHandoff(
    command: Readonly<RecordEmailCampaignReplyHandoffCommandV1>
  ): Promise<EmailCampaignReplyHandoffV1> {
    let value: EmailCampaignReplyHandoffV1;
    try {
      value = parseEmailCampaignReplyHandoffV1(command.value);
    } catch (error) {
      throw new EmailCampaignReplyHandoffPersistenceError(
        'INVALID_INPUT',
        'Reply handoff contract validation failed.',
        422,
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    const w = workspace(value.workspaceId);
    const key = idempotencyKey(command.idempotencyKey);
    const requestFingerprint = hash({
      commandType: 'RECORD_CORRELATED_REPLY',
      value
    });
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${w}:email-campaign-reply-handoff:${key}`
        ]);
        const replay = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_email_campaign_reply_handoff_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [w, key]
        );
        const prior = replay.rows[0];
        if (prior) {
          if (
            String(prior.command_type) !== 'RECORD_CORRELATED_REPLY' ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new EmailCampaignReplyHandoffPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was used with a different reply handoff command.'
            );
          const replayed = persisted(prior.result_json);
          const durable = await this.getHandoffWith(client, w, replayed.replyHandoffId);
          if (hash(durable) !== hash(replayed))
            throw new EmailCampaignReplyHandoffPersistenceError(
              'INTEGRITY_FAILURE',
              'Reply handoff command receipt diverges from durable truth.',
              500
            );
          return structuredClone(replayed);
        }

        await client.query(
          `INSERT INTO lite_email_campaign_reply_handoffs(
             workspace_id,reply_handoff_id,campaign_id,campaign_version,delivery_attempt_id,
             sender_profile_id,sender_profile_version,managed_account_ref,managed_message_id,
             managed_thread_ref,managed_provider,managed_provider_message_id,inbound_evidence_ref,
             inbound_evidence_sha256,outbound_provider_submission_ref,correlation_method,
             evidence_fingerprint_sha256,status,document_json,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)`,
          [
            w,
            value.replyHandoffId,
            value.campaign.campaignId,
            value.campaign.version,
            value.deliveryAttempt.deliveryAttemptId,
            value.senderProfile.senderProfileId,
            value.senderProfile.version,
            value.managedCommunication.accountRef,
            value.managedCommunication.messageId,
            value.managedCommunication.threadRef,
            value.managedCommunication.provider,
            value.managedCommunication.providerMessageId,
            value.inboundEvidence.evidenceRef,
            value.inboundEvidence.sha256,
            value.outboundProviderSubmissionRef,
            value.correlationMethod,
            value.evidenceFingerprintSha256,
            value.status,
            JSON.stringify(value),
            value.createdAt
          ]
        );
        await client.query(
          `INSERT INTO lite_email_campaign_reply_handoff_commands(
             workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
           ) VALUES($1,$2,'RECORD_CORRELATED_REPLY',$3,$4::jsonb,$5)`,
          [w, key, requestFingerprint, JSON.stringify(value), this.timestamp()]
        );
        return structuredClone(value);
      });
    } catch (error) {
      if (error instanceof EmailCampaignReplyHandoffPersistenceError) throw error;
      throw new EmailCampaignReplyHandoffPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Email Campaign reply handoff persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async getHandoff(
    workspaceId: string,
    replyHandoffId: string
  ): Promise<EmailCampaignReplyHandoffV1> {
    return this.getHandoffWith(this.query, workspace(workspaceId), replyHandoffId.trim());
  }

  private async getHandoffWith(
    query: QueryClient,
    workspaceId: string,
    replyHandoffId: string
  ): Promise<EmailCampaignReplyHandoffV1> {
    const result = await query.query<Row>(
      `SELECT * FROM lite_email_campaign_reply_handoffs
        WHERE workspace_id=$1 AND reply_handoff_id=$2`,
      [workspaceId, replyHandoffId]
    );
    const row = result.rows[0];
    if (!row)
      throw new EmailCampaignReplyHandoffPersistenceError(
        'NOT_FOUND',
        'Email Campaign reply handoff was not found.',
        404
      );
    return fromRow(row);
  }

  private timestamp(): string {
    const value = this.now();
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
      throw new EmailCampaignReplyHandoffPersistenceError(
        'INVALID_INPUT',
        'Runtime clock is invalid.',
        500
      );
    return parsed.toISOString();
  }
}

function canonicalInboundEvidence(
  input: Readonly<EmailCampaignReplyInboundEvidenceV1>
): EmailCampaignReplyInboundEvidenceV1 {
  const sha256 = clean(input.sha256, 'exactEvidence.sha256', 64);
  if (!SHA256.test(sha256))
    throw new EmailCampaignReplyCorrelationError(
      'INVALID_INBOUND_EVIDENCE',
      'exactEvidence.sha256 must be lowercase SHA-256 hex.'
    );
  const observedAt = clean(input.observedAt, 'exactEvidence.observedAt', 80);
  const parsed = new Date(observedAt);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== observedAt)
    throw new EmailCampaignReplyCorrelationError(
      'INVALID_INBOUND_EVIDENCE',
      'exactEvidence.observedAt must be a canonical ISO timestamp.'
    );
  if (!Array.isArray(input.headers))
    throw new EmailCampaignReplyCorrelationError(
      'INVALID_INBOUND_EVIDENCE',
      'exactEvidence.headers must be an array.'
    );
  return {
    evidenceRef: clean(input.evidenceRef, 'exactEvidence.evidenceRef', 500),
    sha256,
    provider: clean(input.provider, 'exactEvidence.provider', 120),
    providerMessageId: clean(input.providerMessageId, 'exactEvidence.providerMessageId', 500),
    observedAt,
    headers: input.headers.map((header, index) => ({
      name: clean(header.name, `exactEvidence.headers[${index}].name`, 200),
      value: clean(header.value, `exactEvidence.headers[${index}].value`, 20_000)
    }))
  };
}

function uniqueMatches(
  matches: readonly Readonly<{
    attempt: EmailDeliveryAttemptV1;
    candidate: EmailCampaignReplyReferenceCandidateV1;
  }>[]
): readonly Readonly<{
  attempt: EmailDeliveryAttemptV1;
  candidate: EmailCampaignReplyReferenceCandidateV1;
}>[] {
  const byAttempt = new Map<string, (typeof matches)[number]>();
  for (const match of matches) {
    if (!byAttempt.has(match.attempt.deliveryAttemptId))
      byAttempt.set(match.attempt.deliveryAttemptId, match);
  }
  return [...byAttempt.values()];
}

export class EmailCampaignReplyHandoffServiceV1 {
  constructor(
    private readonly delivery: Readonly<EmailCampaignReplyDeliveryReaderV1>,
    private readonly campaigns: Readonly<EmailCampaignReplyCampaignReaderV1>,
    private readonly senderProfiles: Readonly<EmailCampaignReplySenderProfileReaderV1>,
    private readonly correlator: Readonly<EmailCampaignReplyReferenceCorrelatorV1>,
    private readonly writer: Readonly<EmailCampaignReplyHandoffWriterV1>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async correlate(input: {
    workspaceId: string;
    idempotencyKey: string;
    message: Readonly<ManagedCommunicationMessageV1>;
    exactEvidence: Readonly<EmailCampaignReplyInboundEvidenceV1>;
  }): Promise<EmailCampaignReplyHandoffV1> {
    const workspaceId = input.workspaceId.trim().toLowerCase();
    if (!UUID.test(workspaceId))
      throw new EmailCampaignReplyCorrelationError(
        'INVALID_INBOUND_EVIDENCE',
        'workspaceId must be a UUID.'
      );
    const message = parseManagedCommunicationMessageV1(input.message);
    if (message.direction !== 'INBOUND')
      throw new EmailCampaignReplyCorrelationError(
        'INVALID_INBOUND_EVIDENCE',
        'Reply handoff only accepts Managed Communication INBOUND messages.'
      );
    const exactEvidence = canonicalInboundEvidence(input.exactEvidence);
    if (
      exactEvidence.provider !== message.providerObservation.provider ||
      exactEvidence.providerMessageId !== message.providerObservation.providerMessageId ||
      exactEvidence.observedAt !== message.providerObservation.observedAt
    )
      throw new EmailCampaignReplyCorrelationError(
        'LINEAGE_MISMATCH',
        'Exact inbound evidence does not match the Managed Communication provider observation.'
      );

    const candidates = this.correlator.candidates(exactEvidence.headers);
    if (candidates.length === 0)
      throw new EmailCampaignReplyCorrelationError(
        'CORRELATION_NOT_FOUND',
        'Inbound reply contains no supported outbound provider reference.'
      );

    const matches: Array<{
      attempt: EmailDeliveryAttemptV1;
      candidate: EmailCampaignReplyReferenceCandidateV1;
    }> = [];
    for (const candidate of candidates) {
      const attempt = await this.delivery.findAttemptByProviderSubmissionRef(
        workspaceId,
        candidate.providerSubmissionRef
      );
      if (attempt)
        matches.push({
          attempt,
          candidate
        });
    }
    const unique = uniqueMatches(matches);
    if (unique.length === 0)
      throw new EmailCampaignReplyCorrelationError(
        'CORRELATION_NOT_FOUND',
        'No exact delivery attempt matches the inbound provider reference.'
      );
    if (unique.length > 1)
      throw new EmailCampaignReplyCorrelationError(
        'CORRELATION_AMBIGUOUS',
        'Inbound reply references more than one delivery attempt.'
      );

    const { attempt, candidate } = unique[0]!;
    if (
      attempt.workspaceId !== workspaceId ||
      attempt.providerSubmissionRef !== candidate.providerSubmissionRef
    )
      throw new EmailCampaignReplyCorrelationError(
        'LINEAGE_MISMATCH',
        'Delivery attempt does not match the exact provider submission reference.'
      );

    const [campaign, senderProfile] = await Promise.all([
      this.campaigns.getCampaignVersion(
        workspaceId,
        attempt.campaign.campaignId,
        attempt.campaign.version
      ),
      this.senderProfiles.getExactSenderProfile(
        workspaceId,
        attempt.senderProfile.senderProfileId,
        attempt.senderProfile.version
      )
    ]);
    if (
      campaign.workspaceId !== workspaceId ||
      campaign.campaignId !== attempt.campaign.campaignId ||
      campaign.version !== attempt.campaign.version ||
      senderProfile.workspaceId !== workspaceId ||
      senderProfile.senderProfileId !== attempt.senderProfile.senderProfileId ||
      senderProfile.version !== attempt.senderProfile.version
    )
      throw new EmailCampaignReplyCorrelationError(
        'LINEAGE_MISMATCH',
        'Campaign or sender profile reader returned different exact lineage.'
      );
    if (
      senderProfile.replyTo.mode !== 'MANAGED_COMMUNICATION' ||
      senderProfile.replyTo.accountRef !== message.accountRef
    )
      throw new EmailCampaignReplyCorrelationError(
        'REPLY_ACCOUNT_MISMATCH',
        'Inbound message account does not match the historical Managed Communication reply target.'
      );

    const createdAtRaw = this.now();
    const createdAtDate = new Date(createdAtRaw);
    if (Number.isNaN(createdAtDate.getTime()))
      throw new EmailCampaignReplyCorrelationError(
        'INVALID_CLOCK',
        'Reply handoff runtime clock is invalid.'
      );
    const createdAt = createdAtDate.toISOString();
    if (Date.parse(createdAt) < Date.parse(exactEvidence.observedAt))
      throw new EmailCampaignReplyCorrelationError(
        'INVALID_CLOCK',
        'Reply handoff runtime clock precedes inbound evidence.'
      );

    const evidenceFingerprintSha256 = hash({
      workspaceId,
      campaign: attempt.campaign,
      deliveryAttempt: {
        deliveryAttemptId: attempt.deliveryAttemptId,
        version: attempt.version
      },
      senderProfile: {
        senderProfileId: senderProfile.senderProfileId,
        version: senderProfile.version
      },
      managedCommunication: {
        accountRef: message.accountRef,
        messageId: message.messageId,
        threadRef: message.threadRef,
        provider: message.providerObservation.provider,
        providerMessageId: message.providerObservation.providerMessageId,
        observedAt: message.providerObservation.observedAt
      },
      inboundEvidence: {
        evidenceRef: exactEvidence.evidenceRef,
        sha256: exactEvidence.sha256
      },
      outboundProviderSubmissionRef: candidate.providerSubmissionRef,
      correlationMethod: candidate.correlationMethod
    });
    const replyHandoffId = `email-campaign-reply-handoff_${createHash('sha256')
      .update(
        `${workspaceId}\n${message.accountRef}\n${message.messageId}\n${attempt.deliveryAttemptId}`
      )
      .digest('hex')
      .slice(0, 40)}`;

    const value = parseEmailCampaignReplyHandoffV1({
      schemaVersion: 1,
      replyHandoffId,
      workspaceId,
      campaign: {
        campaignId: campaign.campaignId,
        version: campaign.version
      },
      deliveryAttempt: {
        deliveryAttemptId: attempt.deliveryAttemptId,
        version: 1
      },
      senderProfile: {
        senderProfileId: senderProfile.senderProfileId,
        version: senderProfile.version
      },
      managedCommunication: {
        accountRef: message.accountRef,
        messageId: message.messageId,
        threadRef: message.threadRef,
        provider: message.providerObservation.provider,
        providerMessageId: message.providerObservation.providerMessageId,
        observedAt: message.providerObservation.observedAt
      },
      inboundEvidence: {
        evidenceRef: exactEvidence.evidenceRef,
        sha256: exactEvidence.sha256
      },
      outboundProviderSubmissionRef: candidate.providerSubmissionRef,
      correlationMethod: candidate.correlationMethod,
      evidenceFingerprintSha256,
      status: 'CORRELATED',
      createdAt,
      authority: noEmailCampaignReplyHandoffAuthorityConsequencesV1
    });

    return this.writer.recordHandoff({
      value,
      idempotencyKey: input.idempotencyKey
    });
  }
}
