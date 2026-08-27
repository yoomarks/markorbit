import { createHash, randomUUID } from 'node:crypto';
import {
  parseManagedCommunicationMessageV1,
  type ManagedCommunicationAttachmentRefV1,
  type ManagedCommunicationMessageV1,
  type ManagedCommunicationParticipantV1
} from '@markorbit/contracts/managed-communication';
import type { QueryClient } from '@markorbit/persistence';
import {
  ManagedCommunicationFoundationError,
  managedCommunicationNormalizedIdsV1,
  type ManagedCommunicationAccountBindingV1,
  type ManagedCommunicationFoundationStoreV1
} from './managed-communication-foundation.js';

export type ManagedCommunicationSendStateV1 =
  'CLAIMED' | 'DISPATCHING' | 'SENT' | 'RECONCILIATION_REQUIRED';

export interface ManagedCommunicationSendRequestV1 {
  schemaVersion: 1;
  accountRef: string;
  channel: 'EMAIL';
  participants: readonly Readonly<ManagedCommunicationParticipantV1>[];
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  attachments: readonly Readonly<ManagedCommunicationAttachmentRefV1>[];
  replyToThreadRef?: string;
}

export interface ManagedCommunicationProviderSendResultV1 {
  providerMessageId: string;
  providerThreadId?: string;
  providerReceiptRef: string;
  acceptedAt: string;
}

export interface ManagedCommunicationSendAuthorityV1 {
  externalMessageSent: true;
  customerTruthMutated: false;
  matterTruthMutated: false;
  legalTruthCreated: false;
  knowledgeApproved: false;
  professionalDecisionCreated: false;
}

export interface ManagedCommunicationSendReceiptV1 {
  schemaVersion: 1;
  sendId: string;
  workspaceId: string;
  accountRef: string;
  idempotencyKeySha256: string;
  requestFingerprintSha256: string;
  state: 'SENT';
  messageId: string;
  threadRef: string;
  provider: string;
  providerMessageId: string;
  providerThreadId?: string;
  providerReceiptRef: string;
  acceptedAt: string;
  authority: Readonly<ManagedCommunicationSendAuthorityV1>;
}

export interface ManagedCommunicationReconciliationReceiptV1 {
  schemaVersion: 1;
  sendId: string;
  workspaceId: string;
  accountRef: string;
  state: 'RECONCILIATION_REQUIRED';
  reason: string;
  updatedAt: string;
}

export type ManagedCommunicationSendClaimResultV1 =
  | { kind: 'ACQUIRED'; sendId: string }
  | { kind: 'REPLAY'; receipt: Readonly<ManagedCommunicationSendReceiptV1> }
  | { kind: 'IN_PROGRESS'; sendId: string }
  | {
      kind: 'RECONCILIATION_REQUIRED';
      receipt: Readonly<ManagedCommunicationReconciliationReceiptV1>;
    }
  | { kind: 'CONFLICT' };

export interface ManagedCommunicationSendClaimCommandV1 {
  workspaceId: string;
  accountRef: string;
  idempotencyKeySha256: string;
  requestFingerprintSha256: string;
  sendId: string;
  ownerToken: string;
  now: string;
  leaseExpiresAt: string;
}

export interface ManagedCommunicationSendIdentityV1 {
  workspaceId: string;
  accountRef: string;
  sendId: string;
  idempotencyKeySha256: string;
  requestFingerprintSha256: string;
  ownerToken: string;
  now: string;
}

export interface ManagedCommunicationSendCompletionV1 extends ManagedCommunicationSendIdentityV1 {
  receipt: Readonly<ManagedCommunicationSendReceiptV1>;
}

export interface ManagedCommunicationSendReconciliationV1 extends ManagedCommunicationSendIdentityV1 {
  reason: string;
}

export interface ManagedCommunicationSendClaimStoreV1 {
  claim(
    command: Readonly<ManagedCommunicationSendClaimCommandV1>
  ): Promise<ManagedCommunicationSendClaimResultV1>;
  markDispatching(command: Readonly<ManagedCommunicationSendIdentityV1>): Promise<void>;
  complete(command: Readonly<ManagedCommunicationSendCompletionV1>): Promise<void>;
  markReconciliationRequired(
    command: Readonly<ManagedCommunicationSendReconciliationV1>
  ): Promise<void>;
}

export interface ManagedCommunicationProviderSenderV1 {
  send(
    request: Readonly<ManagedCommunicationSendRequestV1>,
    context: Readonly<{
      sendId: string;
      workspaceId: string;
      account: Readonly<ManagedCommunicationAccountBindingV1>;
      correlationId: string;
    }>
  ): Promise<Readonly<ManagedCommunicationProviderSendResultV1>>;
}

export interface ManagedCommunicationThreadEvidenceReaderV1 {
  resolveThread(input: {
    workspaceId: string;
    accountRef: string;
    threadRef: string;
  }): Promise<readonly Readonly<ManagedCommunicationMessageV1>[]>;
}

export type ManagedCommunicationExchangeErrorCode =
  | 'INVALID_SEND_REQUEST'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SEND_IN_PROGRESS'
  | 'RECONCILIATION_REQUIRED'
  | 'PERSISTENCE_UNAVAILABLE'
  | 'PROVIDER_RESULT_INVALID'
  | 'WORKSPACE_MISMATCH';

export class ManagedCommunicationExchangeError extends Error {
  constructor(
    readonly code: ManagedCommunicationExchangeErrorCode,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ManagedCommunicationExchangeError';
  }
}

interface MemorySendRow {
  workspaceId: string;
  accountRef: string;
  sendId: string;
  idempotencyKeySha256: string;
  requestFingerprintSha256: string;
  state: ManagedCommunicationSendStateV1;
  ownerToken: string;
  leaseExpiresAt: string;
  receipt?: ManagedCommunicationSendReceiptV1;
  reconciliationReason?: string;
  updatedAt: string;
}

const SHA256 = /^[a-f0-9]{64}$/u;

function clean(value: string, field: string, maxLength = 1_000): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength)
    throw new ManagedCommunicationExchangeError(
      'INVALID_SEND_REQUEST',
      `${field} must contain 1 to ${maxLength} characters.`
    );
  return normalized;
}

function canonicalTimestamp(value: string, field: string): string {
  const normalized = clean(value, field, 80);
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== normalized)
    throw new ManagedCommunicationExchangeError(
      'PROVIDER_RESULT_INVALID',
      `${field} must be a canonical ISO timestamp.`
    );
  return normalized;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return sha256(JSON.stringify(canonicalize(value)));
}

function validateRequest(
  request: Readonly<ManagedCommunicationSendRequestV1>
): ManagedCommunicationSendRequestV1 {
  if (request.schemaVersion !== 1 || request.channel !== 'EMAIL')
    throw new ManagedCommunicationExchangeError(
      'INVALID_SEND_REQUEST',
      'Managed Communication outbound requests must use schemaVersion 1 and EMAIL.'
    );
  const accountRef = clean(request.accountRef, 'accountRef', 500);
  if (!Array.isArray(request.participants) || request.participants.length < 2)
    throw new ManagedCommunicationExchangeError(
      'INVALID_SEND_REQUEST',
      'Outbound communication requires sender and recipient participants.'
    );
  const participants = request.participants.map((participant) => ({
    ...participant,
    address: clean(participant.address, 'participant.address', 500)
  }));
  if (participants.filter((participant) => participant.role === 'SENDER').length !== 1)
    throw new ManagedCommunicationExchangeError(
      'INVALID_SEND_REQUEST',
      'Outbound communication requires exactly one SENDER participant.'
    );
  if (!participants.some((participant) => participant.role === 'TO'))
    throw new ManagedCommunicationExchangeError(
      'INVALID_SEND_REQUEST',
      'Outbound communication requires at least one TO participant.'
    );
  if (!Array.isArray(request.attachments))
    throw new ManagedCommunicationExchangeError(
      'INVALID_SEND_REQUEST',
      'Outbound communication attachments must be an array.'
    );
  const attachments = request.attachments.map((attachment) => {
    if (!attachment.sha256 || !SHA256.test(attachment.sha256))
      throw new ManagedCommunicationExchangeError(
        'INVALID_SEND_REQUEST',
        'Every outbound attachment reference must carry a lowercase SHA-256 checksum.'
      );
    return { ...attachment, attachmentRef: clean(attachment.attachmentRef, 'attachmentRef', 500) };
  });
  if (!request.textBody?.trim() && !request.htmlBody?.trim())
    throw new ManagedCommunicationExchangeError(
      'INVALID_SEND_REQUEST',
      'Outbound communication requires textBody or htmlBody.'
    );
  return {
    schemaVersion: 1,
    accountRef,
    channel: 'EMAIL',
    participants,
    ...(request.subject === undefined ? {} : { subject: clean(request.subject, 'subject', 1_000) }),
    ...(request.textBody === undefined
      ? {}
      : { textBody: clean(request.textBody, 'textBody', 2_000_000) }),
    ...(request.htmlBody === undefined
      ? {}
      : { htmlBody: clean(request.htmlBody, 'htmlBody', 4_000_000) }),
    attachments,
    ...(request.replyToThreadRef === undefined
      ? {}
      : { replyToThreadRef: clean(request.replyToThreadRef, 'replyToThreadRef', 500) })
  };
}

function cloneReceipt(
  receipt: Readonly<ManagedCommunicationSendReceiptV1>
): ManagedCommunicationSendReceiptV1 {
  return structuredClone(receipt);
}

function expired(leaseExpiresAt: string, now: string): boolean {
  return Date.parse(leaseExpiresAt) <= Date.parse(now);
}

export class InMemoryManagedCommunicationSendClaimStoreV1 implements ManagedCommunicationSendClaimStoreV1 {
  private readonly rows = new Map<string, MemorySendRow>();

  claim(
    command: Readonly<ManagedCommunicationSendClaimCommandV1>
  ): Promise<ManagedCommunicationSendClaimResultV1> {
    const key = `${command.workspaceId}\u0000${command.accountRef}\u0000${command.idempotencyKeySha256}`;
    const existing = this.rows.get(key);
    if (!existing) {
      this.rows.set(key, {
        workspaceId: command.workspaceId,
        accountRef: command.accountRef,
        sendId: command.sendId,
        idempotencyKeySha256: command.idempotencyKeySha256,
        requestFingerprintSha256: command.requestFingerprintSha256,
        state: 'CLAIMED',
        ownerToken: command.ownerToken,
        leaseExpiresAt: command.leaseExpiresAt,
        updatedAt: command.now
      });
      return Promise.resolve({ kind: 'ACQUIRED', sendId: command.sendId });
    }
    if (existing.requestFingerprintSha256 !== command.requestFingerprintSha256)
      return Promise.resolve({ kind: 'CONFLICT' });
    if (existing.state === 'SENT') {
      if (!existing.receipt)
        return Promise.reject(
          new ManagedCommunicationExchangeError(
            'PERSISTENCE_UNAVAILABLE',
            'Completed communication send is missing its durable receipt.'
          )
        );
      return Promise.resolve({ kind: 'REPLAY', receipt: cloneReceipt(existing.receipt) });
    }
    if (existing.state === 'RECONCILIATION_REQUIRED')
      return Promise.resolve({
        kind: 'RECONCILIATION_REQUIRED',
        receipt: {
          schemaVersion: 1,
          sendId: existing.sendId,
          workspaceId: existing.workspaceId,
          accountRef: existing.accountRef,
          state: 'RECONCILIATION_REQUIRED',
          reason: existing.reconciliationReason ?? 'UNKNOWN_DELIVERY_STATE',
          updatedAt: existing.updatedAt
        }
      });
    if (!expired(existing.leaseExpiresAt, command.now))
      return Promise.resolve({ kind: 'IN_PROGRESS', sendId: existing.sendId });
    if (existing.state === 'DISPATCHING') {
      existing.state = 'RECONCILIATION_REQUIRED';
      existing.reconciliationReason = 'DISPATCH_LEASE_EXPIRED';
      existing.updatedAt = command.now;
      return this.claim(command);
    }
    existing.ownerToken = command.ownerToken;
    existing.leaseExpiresAt = command.leaseExpiresAt;
    existing.updatedAt = command.now;
    return Promise.resolve({ kind: 'ACQUIRED', sendId: existing.sendId });
  }

  markDispatching(command: Readonly<ManagedCommunicationSendIdentityV1>): Promise<void> {
    const row = this.requireOwned(command, 'CLAIMED');
    row.state = 'DISPATCHING';
    row.updatedAt = command.now;
    return Promise.resolve();
  }

  complete(command: Readonly<ManagedCommunicationSendCompletionV1>): Promise<void> {
    const row = this.requireOwned(command, 'DISPATCHING');
    row.state = 'SENT';
    row.receipt = cloneReceipt(command.receipt);
    row.updatedAt = command.now;
    delete row.reconciliationReason;
    return Promise.resolve();
  }

  markReconciliationRequired(
    command: Readonly<ManagedCommunicationSendReconciliationV1>
  ): Promise<void> {
    const key = `${command.workspaceId}\u0000${command.accountRef}\u0000${command.idempotencyKeySha256}`;
    const row = this.rows.get(key);
    if (
      !row ||
      row.sendId !== command.sendId ||
      row.requestFingerprintSha256 !== command.requestFingerprintSha256 ||
      row.ownerToken !== command.ownerToken
    )
      return Promise.reject(
        new ManagedCommunicationExchangeError(
          'PERSISTENCE_UNAVAILABLE',
          'Communication send ownership changed before reconciliation could be recorded.'
        )
      );
    if (row.state === 'SENT') return Promise.resolve();
    if (row.state !== 'DISPATCHING' && row.state !== 'RECONCILIATION_REQUIRED')
      return Promise.reject(
        new ManagedCommunicationExchangeError(
          'PERSISTENCE_UNAVAILABLE',
          'Communication send cannot require reconciliation before dispatch begins.'
        )
      );
    row.state = 'RECONCILIATION_REQUIRED';
    row.reconciliationReason = clean(command.reason, 'reason', 1_000);
    row.updatedAt = command.now;
    return Promise.resolve();
  }

  private requireOwned(
    command: Readonly<ManagedCommunicationSendIdentityV1>,
    state: ManagedCommunicationSendStateV1
  ): MemorySendRow {
    const key = `${command.workspaceId}\u0000${command.accountRef}\u0000${command.idempotencyKeySha256}`;
    const row = this.rows.get(key);
    if (
      !row ||
      row.state !== state ||
      row.sendId !== command.sendId ||
      row.requestFingerprintSha256 !== command.requestFingerprintSha256 ||
      row.ownerToken !== command.ownerToken
    )
      throw new ManagedCommunicationExchangeError(
        'PERSISTENCE_UNAVAILABLE',
        'Communication send ownership or durable state no longer permits this transition.'
      );
    return row;
  }
}

export interface ManagedCommunicationSendTransactionHostV1 {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

type SendRow = {
  send_id: unknown;
  request_fingerprint_sha256: unknown;
  state: unknown;
  owner_token: unknown;
  lease_expires_at: unknown;
  receipt_json: unknown;
  reconciliation_reason: unknown;
  updated_at: unknown;
};

function persistedState(value: unknown): ManagedCommunicationSendStateV1 {
  if (
    value === 'CLAIMED' ||
    value === 'DISPATCHING' ||
    value === 'SENT' ||
    value === 'RECONCILIATION_REQUIRED'
  )
    return value;
  throw new ManagedCommunicationExchangeError(
    'PERSISTENCE_UNAVAILABLE',
    'Persisted communication send state is invalid.'
  );
}

function persistedReceipt(value: unknown): ManagedCommunicationSendReceiptV1 {
  if (!value || typeof value !== 'object')
    throw new ManagedCommunicationExchangeError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted communication send receipt is invalid.'
    );
  const receipt = value as ManagedCommunicationSendReceiptV1;
  if (receipt.schemaVersion !== 1 || receipt.state !== 'SENT' || !receipt.sendId)
    throw new ManagedCommunicationExchangeError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted communication send receipt violates schema version 1.'
    );
  return structuredClone(receipt);
}

export class PostgresManagedCommunicationSendClaimStoreV1 implements ManagedCommunicationSendClaimStoreV1 {
  constructor(
    private readonly database: ManagedCommunicationSendTransactionHostV1,
    private readonly query: QueryClient
  ) {}

  async claim(
    command: Readonly<ManagedCommunicationSendClaimCommandV1>
  ): Promise<ManagedCommunicationSendClaimResultV1> {
    try {
      return await this.database.transact(async (client) => {
        const lockKey = `${command.workspaceId}:${command.accountRef}:${command.idempotencyKeySha256}`;
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [lockKey]);
        const found = await client.query(
          `SELECT send_id,request_fingerprint_sha256,state,owner_token,lease_expires_at,
                  receipt_json,reconciliation_reason,updated_at
             FROM capability_communication_send_claims
            WHERE workspace_id=$1 AND account_ref=$2 AND idempotency_key_sha256=$3`,
          [command.workspaceId, command.accountRef, command.idempotencyKeySha256]
        );
        const row = found.rows[0] as SendRow | undefined;
        if (!row) {
          await client.query(
            `INSERT INTO capability_communication_send_claims (
               workspace_id,account_ref,idempotency_key_sha256,request_fingerprint_sha256,
               send_id,state,owner_token,lease_expires_at,created_at,updated_at
             ) VALUES ($1,$2,$3,$4,$5,'CLAIMED',$6,$7,$8,$8)`,
            [
              command.workspaceId,
              command.accountRef,
              command.idempotencyKeySha256,
              command.requestFingerprintSha256,
              command.sendId,
              command.ownerToken,
              command.leaseExpiresAt,
              command.now
            ]
          );
          return { kind: 'ACQUIRED', sendId: command.sendId };
        }
        if (String(row.request_fingerprint_sha256) !== command.requestFingerprintSha256)
          return { kind: 'CONFLICT' };
        const state = persistedState(row.state);
        if (state === 'SENT')
          return { kind: 'REPLAY', receipt: persistedReceipt(row.receipt_json) };
        if (state === 'RECONCILIATION_REQUIRED')
          return {
            kind: 'RECONCILIATION_REQUIRED',
            receipt: {
              schemaVersion: 1,
              sendId: String(row.send_id),
              workspaceId: command.workspaceId,
              accountRef: command.accountRef,
              state: 'RECONCILIATION_REQUIRED',
              reason: String(row.reconciliation_reason ?? 'UNKNOWN_DELIVERY_STATE'),
              updatedAt: new Date(String(row.updated_at)).toISOString()
            }
          };
        if (!expired(String(row.lease_expires_at), command.now))
          return { kind: 'IN_PROGRESS', sendId: String(row.send_id) };
        if (state === 'DISPATCHING') {
          await client.query(
            `UPDATE capability_communication_send_claims
                SET state='RECONCILIATION_REQUIRED',reconciliation_reason='DISPATCH_LEASE_EXPIRED',
                    updated_at=$4
              WHERE workspace_id=$1 AND account_ref=$2 AND idempotency_key_sha256=$3`,
            [command.workspaceId, command.accountRef, command.idempotencyKeySha256, command.now]
          );
          return {
            kind: 'RECONCILIATION_REQUIRED',
            receipt: {
              schemaVersion: 1,
              sendId: String(row.send_id),
              workspaceId: command.workspaceId,
              accountRef: command.accountRef,
              state: 'RECONCILIATION_REQUIRED',
              reason: 'DISPATCH_LEASE_EXPIRED',
              updatedAt: command.now
            }
          };
        }
        await client.query(
          `UPDATE capability_communication_send_claims
              SET owner_token=$4,lease_expires_at=$5,updated_at=$6
            WHERE workspace_id=$1 AND account_ref=$2 AND idempotency_key_sha256=$3
              AND state='CLAIMED'`,
          [
            command.workspaceId,
            command.accountRef,
            command.idempotencyKeySha256,
            command.ownerToken,
            command.leaseExpiresAt,
            command.now
          ]
        );
        return { kind: 'ACQUIRED', sendId: String(row.send_id) };
      });
    } catch (error) {
      if (error instanceof ManagedCommunicationExchangeError) throw error;
      throw new ManagedCommunicationExchangeError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication send-claim persistence is unavailable.',
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async markDispatching(command: Readonly<ManagedCommunicationSendIdentityV1>): Promise<void> {
    await this.transition(
      `UPDATE capability_communication_send_claims
          SET state='DISPATCHING',dispatched_at=COALESCE(dispatched_at,$7),updated_at=$7
        WHERE workspace_id=$1 AND account_ref=$2 AND idempotency_key_sha256=$3
          AND request_fingerprint_sha256=$4 AND send_id=$5 AND owner_token=$6 AND state='CLAIMED'`,
      command
    );
  }

  async complete(command: Readonly<ManagedCommunicationSendCompletionV1>): Promise<void> {
    try {
      const result = await this.query.query(
        `UPDATE capability_communication_send_claims
            SET state='SENT',receipt_json=$7::jsonb,reconciliation_reason=NULL,
                completed_at=$8,updated_at=$8
          WHERE workspace_id=$1 AND account_ref=$2 AND idempotency_key_sha256=$3
            AND request_fingerprint_sha256=$4 AND send_id=$5 AND owner_token=$6
            AND state='DISPATCHING'`,
        [
          command.workspaceId,
          command.accountRef,
          command.idempotencyKeySha256,
          command.requestFingerprintSha256,
          command.sendId,
          command.ownerToken,
          JSON.stringify(command.receipt),
          command.now
        ]
      );
      if (result.rowCount !== 1) throw new Error('send completion state conflict');
    } catch (error) {
      throw new ManagedCommunicationExchangeError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication send receipt could not be durably committed.',
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async markReconciliationRequired(
    command: Readonly<ManagedCommunicationSendReconciliationV1>
  ): Promise<void> {
    try {
      const result = await this.query.query(
        `UPDATE capability_communication_send_claims
            SET state='RECONCILIATION_REQUIRED',reconciliation_reason=$7,updated_at=$8
          WHERE workspace_id=$1 AND account_ref=$2 AND idempotency_key_sha256=$3
            AND request_fingerprint_sha256=$4 AND send_id=$5 AND owner_token=$6
            AND state IN ('DISPATCHING','RECONCILIATION_REQUIRED')`,
        [
          command.workspaceId,
          command.accountRef,
          command.idempotencyKeySha256,
          command.requestFingerprintSha256,
          command.sendId,
          command.ownerToken,
          command.reason,
          command.now
        ]
      );
      if (result.rowCount !== 1) throw new Error('send reconciliation state conflict');
    } catch (error) {
      throw new ManagedCommunicationExchangeError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication reconciliation state could not be durably committed.',
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  private async transition(
    sql: string,
    command: Readonly<ManagedCommunicationSendIdentityV1>
  ): Promise<void> {
    try {
      const result = await this.query.query(sql, [
        command.workspaceId,
        command.accountRef,
        command.idempotencyKeySha256,
        command.requestFingerprintSha256,
        command.sendId,
        command.ownerToken,
        command.now
      ]);
      if (result.rowCount !== 1) throw new Error('send state conflict');
    } catch (error) {
      throw new ManagedCommunicationExchangeError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication send state transition is unavailable.',
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export class PostgresManagedCommunicationThreadEvidenceReaderV1 implements ManagedCommunicationThreadEvidenceReaderV1 {
  constructor(private readonly query: QueryClient) {}

  async resolveThread(input: {
    workspaceId: string;
    accountRef: string;
    threadRef: string;
  }): Promise<readonly Readonly<ManagedCommunicationMessageV1>[]> {
    try {
      const result = await this.query.query(
        `SELECT message_json
           FROM capability_communication_messages
          WHERE workspace_id=$1 AND account_ref=$2 AND thread_ref=$3
          ORDER BY observed_at ASC, created_at ASC`,
        [
          clean(input.workspaceId, 'workspaceId', 500),
          clean(input.accountRef, 'accountRef', 500),
          clean(input.threadRef, 'threadRef', 500)
        ]
      );
      return Object.freeze(
        result.rows.map((row) =>
          Object.freeze(
            parseManagedCommunicationMessageV1((row as { message_json: unknown }).message_json)
          )
        )
      );
    } catch (error) {
      if (error instanceof ManagedCommunicationExchangeError) throw error;
      throw new ManagedCommunicationExchangeError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication thread evidence could not be resolved.',
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export interface ManagedCommunicationExchangeOptionsV1 {
  foundation: ManagedCommunicationFoundationStoreV1;
  claims: ManagedCommunicationSendClaimStoreV1;
  sender: ManagedCommunicationProviderSenderV1;
  now?: () => string;
  ownerTokenFactory?: () => string;
  claimLeaseMs?: number;
}

export class ManagedCommunicationExchangeV1 {
  private readonly now: () => string;
  private readonly ownerTokenFactory: () => string;
  private readonly claimLeaseMs: number;

  constructor(private readonly options: ManagedCommunicationExchangeOptionsV1) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.ownerTokenFactory = options.ownerTokenFactory ?? randomUUID;
    this.claimLeaseMs = options.claimLeaseMs ?? 10 * 60 * 1_000;
    if (!Number.isInteger(this.claimLeaseMs) || this.claimLeaseMs < 1_000)
      throw new Error('Managed Communication claimLeaseMs must be at least 1000 milliseconds.');
  }

  async send(input: {
    workspaceId: string;
    idempotencyKey: string;
    correlationId: string;
    request: Readonly<ManagedCommunicationSendRequestV1>;
  }): Promise<Readonly<ManagedCommunicationSendReceiptV1>> {
    const workspaceId = clean(input.workspaceId, 'workspaceId', 500);
    const idempotencyKey = clean(input.idempotencyKey, 'idempotencyKey', 500);
    const correlationId = clean(input.correlationId, 'correlationId', 300);
    const request = validateRequest(input.request);
    const account = await this.options.foundation.resolveAccount(workspaceId, request.accountRef);
    if (account.workspaceId !== workspaceId || account.accountRef !== request.accountRef)
      throw new ManagedCommunicationExchangeError(
        'WORKSPACE_MISMATCH',
        'Communication account does not belong to the requested workspace.'
      );
    const idempotencyKeySha256 = sha256(idempotencyKey);
    const requestFingerprintSha256 = fingerprint({ workspaceId, correlationId, request });
    const sendId = `commsend_${sha256(`${workspaceId}\n${request.accountRef}\n${idempotencyKey}`).slice(0, 32)}`;
    const ownerToken = this.ownerTokenFactory();
    const claimedAt = this.now();
    const leaseExpiresAt = new Date(Date.parse(claimedAt) + this.claimLeaseMs).toISOString();
    const claim = await this.options.claims.claim({
      workspaceId,
      accountRef: request.accountRef,
      idempotencyKeySha256,
      requestFingerprintSha256,
      sendId,
      ownerToken,
      now: claimedAt,
      leaseExpiresAt
    });
    if (claim.kind === 'CONFLICT')
      throw new ManagedCommunicationExchangeError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key is already bound to a different communication send.'
      );
    if (claim.kind === 'REPLAY') return claim.receipt;
    if (claim.kind === 'IN_PROGRESS')
      throw new ManagedCommunicationExchangeError(
        'SEND_IN_PROGRESS',
        'The same communication send is already in progress.',
        true
      );
    if (claim.kind === 'RECONCILIATION_REQUIRED')
      throw new ManagedCommunicationExchangeError(
        'RECONCILIATION_REQUIRED',
        `Prior communication delivery is uncertain: ${claim.receipt.reason}. Automatic resend is blocked.`
      );

    const identity = {
      workspaceId,
      accountRef: request.accountRef,
      sendId: claim.sendId,
      idempotencyKeySha256,
      requestFingerprintSha256,
      ownerToken,
      now: this.now()
    } as const;
    await this.options.claims.markDispatching(identity);

    let providerResult: Readonly<ManagedCommunicationProviderSendResultV1>;
    try {
      providerResult = await this.options.sender.send(request, {
        sendId: claim.sendId,
        workspaceId,
        account,
        correlationId
      });
    } catch (error) {
      await this.reconcile(identity, 'PROVIDER_THROW_AFTER_DISPATCH_MARK');
      throw new ManagedCommunicationExchangeError(
        'RECONCILIATION_REQUIRED',
        'Provider send failed after delivery became possible; automatic resend is blocked.',
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }

    let acceptedAt: string;
    let providerMessageId: string;
    let providerThreadId: string | undefined;
    let providerReceiptRef: string;
    try {
      acceptedAt = canonicalTimestamp(providerResult.acceptedAt, 'providerResult.acceptedAt');
      providerMessageId = clean(providerResult.providerMessageId, 'providerMessageId', 500);
      providerThreadId = providerResult.providerThreadId
        ? clean(providerResult.providerThreadId, 'providerThreadId', 500)
        : undefined;
      providerReceiptRef = clean(providerResult.providerReceiptRef, 'providerReceiptRef', 2_000);
    } catch (error) {
      await this.reconcile(identity, 'INVALID_PROVIDER_RECEIPT_AFTER_DISPATCH');
      throw error;
    }

    const ids = managedCommunicationNormalizedIdsV1({
      workspaceId,
      accountRef: request.accountRef,
      provider: account.provider,
      providerMessageId,
      ...(providerThreadId === undefined ? {} : { providerThreadId })
    });
    if (request.replyToThreadRef && request.replyToThreadRef !== ids.threadRef) {
      await this.reconcile(identity, 'PROVIDER_THREAD_IDENTITY_MISMATCH');
      throw new ManagedCommunicationExchangeError(
        'RECONCILIATION_REQUIRED',
        'Provider reply thread identity does not match the requested durable conversation.'
      );
    }
    const message: ManagedCommunicationMessageV1 = {
      schemaVersion: 1,
      messageId: ids.messageId,
      accountRef: request.accountRef,
      threadRef: ids.threadRef,
      channel: request.channel,
      direction: 'OUTBOUND',
      participants: request.participants,
      ...(request.subject === undefined ? {} : { subject: request.subject }),
      ...(request.textBody === undefined ? {} : { textBody: request.textBody }),
      ...(request.htmlBody === undefined ? {} : { htmlBody: request.htmlBody }),
      attachments: request.attachments,
      occurredAt: acceptedAt,
      providerObservation: {
        provider: account.provider,
        providerMessageId,
        ...(providerThreadId === undefined ? {} : { providerThreadId }),
        observedAt: acceptedAt
      }
    };

    try {
      await this.options.foundation.admitObservation({
        workspaceId,
        accountRef: request.accountRef,
        idempotencyKey: `outbound:${claim.sendId}`,
        message,
        now: this.now()
      });
    } catch (error) {
      await this.reconcile(identity, 'OUTBOUND_EVIDENCE_PERSISTENCE_UNCERTAIN_AFTER_PROVIDER_SEND');
      throw new ManagedCommunicationExchangeError(
        'RECONCILIATION_REQUIRED',
        'Provider accepted the send but outbound evidence could not be durably committed; automatic resend is blocked.',
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }

    const receipt: ManagedCommunicationSendReceiptV1 = {
      schemaVersion: 1,
      sendId: claim.sendId,
      workspaceId,
      accountRef: request.accountRef,
      idempotencyKeySha256,
      requestFingerprintSha256,
      state: 'SENT',
      messageId: ids.messageId,
      threadRef: ids.threadRef,
      provider: account.provider,
      providerMessageId,
      ...(providerThreadId === undefined ? {} : { providerThreadId }),
      providerReceiptRef,
      acceptedAt,
      authority: {
        externalMessageSent: true,
        customerTruthMutated: false,
        matterTruthMutated: false,
        legalTruthCreated: false,
        knowledgeApproved: false,
        professionalDecisionCreated: false
      }
    };
    try {
      await this.options.claims.complete({ ...identity, now: this.now(), receipt });
    } catch (error) {
      await this.reconcile(identity, 'SEND_RECEIPT_PERSISTENCE_UNCERTAIN_AFTER_PROVIDER_SEND');
      throw new ManagedCommunicationExchangeError(
        'RECONCILIATION_REQUIRED',
        'Provider send and message evidence are durable but the send receipt could not be committed; automatic resend is blocked.',
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    return Object.freeze(cloneReceipt(receipt));
  }

  private async reconcile(
    identity: Readonly<ManagedCommunicationSendIdentityV1>,
    reason: string
  ): Promise<void> {
    try {
      await this.options.claims.markReconciliationRequired({
        ...identity,
        now: this.now(),
        reason
      });
    } catch (error) {
      if (error instanceof ManagedCommunicationFoundationError) return;
      // A failed reconciliation write must never cause another provider send.
    }
  }
}
