import { createHash, randomUUID } from 'node:crypto';
import {
  managedCommunicationNoAuthorityConsequences,
  parseManagedCommunicationMessageV1,
  type ManagedCommunicationAuthorityConsequencesV1,
  type ManagedCommunicationChannel,
  type ManagedCommunicationMessageV1
} from '@markorbit/contracts/managed-communication';
import type { QueryClient } from '@markorbit/persistence';

const SHA256 = /^[a-f0-9]{64}$/u;

export type ManagedCommunicationFoundationErrorCode =
  | 'PERSISTENCE_UNAVAILABLE'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_CONFLICT'
  | 'WORKSPACE_MISMATCH'
  | 'INVALID_OBSERVATION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PROVIDER_OBSERVATION_CONFLICT'
  | 'MESSAGE_NOT_FOUND'
  | 'CHECKPOINT_CONFLICT'
  | 'INVALID_PERSISTED_STATE';

export class ManagedCommunicationFoundationError extends Error {
  constructor(
    readonly code: ManagedCommunicationFoundationErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ManagedCommunicationFoundationError';
  }
}

export interface ManagedCommunicationAccountBindingV1 {
  schemaVersion: 1;
  workspaceId: string;
  accountRef: string;
  channel: ManagedCommunicationChannel;
  provider: string;
  providerAccountRef: string;
  createdAt: string;
}

export interface ManagedCommunicationRegisterAccountV1 {
  workspaceId: string;
  accountRef: string;
  channel: ManagedCommunicationChannel;
  provider: string;
  providerAccountRef: string;
  now: string;
}

export interface ManagedCommunicationObservationCommandV1 {
  workspaceId: string;
  accountRef: string;
  idempotencyKey: string;
  message: Readonly<ManagedCommunicationMessageV1>;
  now: string;
}

export interface ManagedCommunicationObservationOutcomeV1 {
  schemaVersion: 1;
  disposition: 'ADMITTED' | 'REPLAYED';
  message: Readonly<ManagedCommunicationMessageV1>;
  authority: Readonly<ManagedCommunicationAuthorityConsequencesV1>;
}

export interface ManagedCommunicationCheckpointV1 {
  schemaVersion: 1;
  workspaceId: string;
  accountRef: string;
  checkpointRef: string;
  providerCursor: string;
  observedAt: string;
  createdAt: string;
}

export interface ManagedCommunicationSaveCheckpointV1 {
  workspaceId: string;
  accountRef: string;
  checkpointRef: string;
  providerCursor: string;
  observedAt: string;
  now: string;
}

export interface ManagedCommunicationFoundationStoreV1 {
  registerAccount(
    command: Readonly<ManagedCommunicationRegisterAccountV1>
  ): Promise<Readonly<ManagedCommunicationAccountBindingV1>>;
  resolveAccount(
    workspaceId: string,
    accountRef: string
  ): Promise<Readonly<ManagedCommunicationAccountBindingV1>>;
  admitObservation(
    command: Readonly<ManagedCommunicationObservationCommandV1>
  ): Promise<Readonly<ManagedCommunicationObservationOutcomeV1>>;
  resolveMessage(
    workspaceId: string,
    accountRef: string,
    messageId: string
  ): Promise<Readonly<ManagedCommunicationMessageV1>>;
  saveCheckpoint(
    command: Readonly<ManagedCommunicationSaveCheckpointV1>
  ): Promise<Readonly<ManagedCommunicationCheckpointV1>>;
  latestCheckpoint(
    workspaceId: string,
    accountRef: string
  ): Promise<Readonly<ManagedCommunicationCheckpointV1> | undefined>;
}

interface StoredMessage {
  workspaceId: string;
  accountRef: string;
  provider: string;
  providerMessageId: string;
  idempotencyKeySha256: string;
  observationFingerprintSha256: string;
  message: ManagedCommunicationMessageV1;
}

function clean(value: string, field: string, maxLength = 1000): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength)
    throw new ManagedCommunicationFoundationError(
      'INVALID_OBSERVATION',
      `${field} must contain 1 to ${maxLength} characters.`
    );
  return normalized;
}

function timestamp(value: string, field: string): string {
  const normalized = clean(value, field, 80);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized)
    throw new ManagedCommunicationFoundationError(
      'INVALID_OBSERVATION',
      `${field} must be a canonical ISO timestamp.`
    );
  return normalized;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
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

function cloneMessage(message: Readonly<ManagedCommunicationMessageV1>): ManagedCommunicationMessageV1 {
  return parseManagedCommunicationMessageV1(JSON.parse(JSON.stringify(message)) as unknown);
}

function accountFingerprint(binding: Omit<ManagedCommunicationAccountBindingV1, 'schemaVersion' | 'createdAt'>) {
  return fingerprint(binding);
}

function normalizedMessageId(
  workspaceId: string,
  accountRef: string,
  provider: string,
  providerMessageId: string
): string {
  return `commmsg_${sha256(`${workspaceId}\n${accountRef}\n${provider}\n${providerMessageId}`).slice(0, 32)}`;
}

function normalizedThreadRef(
  workspaceId: string,
  accountRef: string,
  provider: string,
  providerThreadId: string | undefined,
  providerMessageId: string
): string {
  const identity = providerThreadId ?? providerMessageId;
  return `commthread_${sha256(`${workspaceId}\n${accountRef}\n${provider}\n${identity}`).slice(0, 32)}`;
}

export function managedCommunicationNormalizedIdsV1(input: {
  workspaceId: string;
  accountRef: string;
  provider: string;
  providerMessageId: string;
  providerThreadId?: string;
}) {
  const workspaceId = clean(input.workspaceId, 'workspaceId', 500);
  const accountRef = clean(input.accountRef, 'accountRef', 500);
  const provider = clean(input.provider, 'provider', 120);
  const providerMessageId = clean(input.providerMessageId, 'providerMessageId', 500);
  const providerThreadId = input.providerThreadId
    ? clean(input.providerThreadId, 'providerThreadId', 500)
    : undefined;
  return Object.freeze({
    messageId: normalizedMessageId(workspaceId, accountRef, provider, providerMessageId),
    threadRef: normalizedThreadRef(
      workspaceId,
      accountRef,
      provider,
      providerThreadId,
      providerMessageId
    )
  });
}

function validatedBinding(
  command: Readonly<ManagedCommunicationRegisterAccountV1>
): ManagedCommunicationAccountBindingV1 {
  if (command.channel !== 'EMAIL')
    throw new ManagedCommunicationFoundationError(
      'ACCOUNT_CONFLICT',
      'Managed Communication foundation currently supports EMAIL only.'
    );
  return {
    schemaVersion: 1,
    workspaceId: clean(command.workspaceId, 'workspaceId', 500),
    accountRef: clean(command.accountRef, 'accountRef', 500),
    channel: command.channel,
    provider: clean(command.provider, 'provider', 120),
    providerAccountRef: clean(command.providerAccountRef, 'providerAccountRef', 500),
    createdAt: timestamp(command.now, 'now')
  };
}

function validatedObservation(
  binding: Readonly<ManagedCommunicationAccountBindingV1>,
  command: Readonly<ManagedCommunicationObservationCommandV1>
): {
  workspaceId: string;
  accountRef: string;
  idempotencyKeySha256: string;
  message: ManagedCommunicationMessageV1;
  observationFingerprintSha256: string;
  now: string;
} {
  const workspaceId = clean(command.workspaceId, 'workspaceId', 500);
  const accountRef = clean(command.accountRef, 'accountRef', 500);
  if (binding.workspaceId !== workspaceId || binding.accountRef !== accountRef)
    throw new ManagedCommunicationFoundationError(
      'WORKSPACE_MISMATCH',
      'Communication account binding does not belong to the requested workspace/account scope.'
    );
  const idempotencyKeySha256 = sha256(clean(command.idempotencyKey, 'idempotencyKey', 300));
  const message = cloneMessage(command.message);
  if (message.accountRef !== accountRef || message.channel !== binding.channel)
    throw new ManagedCommunicationFoundationError(
      'INVALID_OBSERVATION',
      'Normalized communication message account/channel does not match the durable binding.'
    );
  if (message.providerObservation.provider !== binding.provider)
    throw new ManagedCommunicationFoundationError(
      'INVALID_OBSERVATION',
      'Provider observation does not match the durable account binding.'
    );
  const ids = managedCommunicationNormalizedIdsV1({
    workspaceId,
    accountRef,
    provider: message.providerObservation.provider,
    providerMessageId: message.providerObservation.providerMessageId,
    ...(message.providerObservation.providerThreadId === undefined
      ? {}
      : { providerThreadId: message.providerObservation.providerThreadId })
  });
  if (message.messageId !== ids.messageId || message.threadRef !== ids.threadRef)
    throw new ManagedCommunicationFoundationError(
      'INVALID_OBSERVATION',
      'Normalized message/thread identities must be derived from workspace/account/provider provenance.'
    );
  const attachmentRefs = new Set<string>();
  for (const attachment of message.attachments) {
    if (!attachment.sha256 || !SHA256.test(attachment.sha256))
      throw new ManagedCommunicationFoundationError(
        'INVALID_OBSERVATION',
        'Every persisted communication attachment must carry a lowercase SHA-256 checksum.'
      );
    if (attachmentRefs.has(attachment.attachmentRef))
      throw new ManagedCommunicationFoundationError(
        'INVALID_OBSERVATION',
        'Communication attachment references must be unique within a message.'
      );
    attachmentRefs.add(attachment.attachmentRef);
  }
  return {
    workspaceId,
    accountRef,
    idempotencyKeySha256,
    observationFingerprintSha256: fingerprint(message),
    message,
    now: timestamp(command.now, 'now')
  };
}

function outcome(
  disposition: 'ADMITTED' | 'REPLAYED',
  message: Readonly<ManagedCommunicationMessageV1>
): Readonly<ManagedCommunicationObservationOutcomeV1> {
  return Object.freeze({
    schemaVersion: 1 as const,
    disposition,
    message: Object.freeze(cloneMessage(message)),
    authority: managedCommunicationNoAuthorityConsequences
  });
}

function checkpoint(
  command: Readonly<ManagedCommunicationSaveCheckpointV1>
): ManagedCommunicationCheckpointV1 {
  return {
    schemaVersion: 1,
    workspaceId: clean(command.workspaceId, 'workspaceId', 500),
    accountRef: clean(command.accountRef, 'accountRef', 500),
    checkpointRef: clean(command.checkpointRef, 'checkpointRef', 1000),
    providerCursor: clean(command.providerCursor, 'providerCursor', 20_000),
    observedAt: timestamp(command.observedAt, 'observedAt'),
    createdAt: timestamp(command.now, 'now')
  };
}

function cloneCheckpoint(value: Readonly<ManagedCommunicationCheckpointV1>) {
  return Object.freeze({ ...value });
}

export class InMemoryManagedCommunicationFoundationV1
  implements ManagedCommunicationFoundationStoreV1
{
  private readonly accounts = new Map<string, ManagedCommunicationAccountBindingV1>();
  private readonly messagesByProvider = new Map<string, StoredMessage>();
  private readonly messagesByIdempotency = new Map<string, StoredMessage>();
  private readonly messagesById = new Map<string, StoredMessage>();
  private readonly checkpoints = new Map<string, ManagedCommunicationCheckpointV1>();

  private accountKey(workspaceId: string, accountRef: string) {
    return `${workspaceId}\u0000${accountRef}`;
  }

  registerAccount(
    command: Readonly<ManagedCommunicationRegisterAccountV1>
  ): Promise<Readonly<ManagedCommunicationAccountBindingV1>> {
    try {
      const binding = validatedBinding(command);
      const key = this.accountKey(binding.workspaceId, binding.accountRef);
      const existing = this.accounts.get(key);
      if (existing) {
        if (
          accountFingerprint(existing) !== accountFingerprint(binding) ||
          existing.createdAt !== binding.createdAt
        )
          throw new ManagedCommunicationFoundationError(
            'ACCOUNT_CONFLICT',
            'Communication account reference is already bound to different durable metadata.'
          );
        return Promise.resolve(Object.freeze({ ...existing }));
      }
      for (const candidate of this.accounts.values()) {
        if (
          candidate.workspaceId === binding.workspaceId &&
          candidate.provider === binding.provider &&
          candidate.providerAccountRef === binding.providerAccountRef &&
          candidate.accountRef !== binding.accountRef
        )
          throw new ManagedCommunicationFoundationError(
            'ACCOUNT_CONFLICT',
            'Provider account reference is already bound to another account in this workspace.'
          );
      }
      this.accounts.set(key, { ...binding });
      return Promise.resolve(Object.freeze({ ...binding }));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  resolveAccount(
    workspaceId: string,
    accountRef: string
  ): Promise<Readonly<ManagedCommunicationAccountBindingV1>> {
    const found = this.accounts.get(this.accountKey(workspaceId, accountRef));
    if (!found)
      return Promise.reject(
        new ManagedCommunicationFoundationError(
          'ACCOUNT_NOT_FOUND',
          'Communication account binding was not found in this workspace.'
        )
      );
    return Promise.resolve(Object.freeze({ ...found }));
  }

  admitObservation(
    command: Readonly<ManagedCommunicationObservationCommandV1>
  ): Promise<Readonly<ManagedCommunicationObservationOutcomeV1>> {
    return this.resolveAccount(command.workspaceId, command.accountRef).then((binding) => {
      const validated = validatedObservation(binding, command);
      const providerKey = `${validated.workspaceId}\u0000${validated.accountRef}\u0000${validated.message.providerObservation.provider}\u0000${validated.message.providerObservation.providerMessageId}`;
      const idempotencyKey = `${validated.workspaceId}\u0000${validated.accountRef}\u0000${validated.idempotencyKeySha256}`;
      const existingByIdempotency = this.messagesByIdempotency.get(idempotencyKey);
      if (existingByIdempotency) {
        if (
          existingByIdempotency.observationFingerprintSha256 !==
          validated.observationFingerprintSha256
        )
          throw new ManagedCommunicationFoundationError(
            'IDEMPOTENCY_CONFLICT',
            'Communication idempotency key is already bound to a different observation.'
          );
        return outcome('REPLAYED', existingByIdempotency.message);
      }
      const existingByProvider = this.messagesByProvider.get(providerKey);
      if (existingByProvider) {
        if (
          existingByProvider.observationFingerprintSha256 !== validated.observationFingerprintSha256
        )
          throw new ManagedCommunicationFoundationError(
            'PROVIDER_OBSERVATION_CONFLICT',
            'Provider message identity is already bound to a different normalized observation.'
          );
        this.messagesByIdempotency.set(idempotencyKey, existingByProvider);
        return outcome('REPLAYED', existingByProvider.message);
      }
      const stored: StoredMessage = {
        workspaceId: validated.workspaceId,
        accountRef: validated.accountRef,
        provider: validated.message.providerObservation.provider,
        providerMessageId: validated.message.providerObservation.providerMessageId,
        idempotencyKeySha256: validated.idempotencyKeySha256,
        observationFingerprintSha256: validated.observationFingerprintSha256,
        message: cloneMessage(validated.message)
      };
      this.messagesByProvider.set(providerKey, stored);
      this.messagesByIdempotency.set(idempotencyKey, stored);
      this.messagesById.set(
        `${validated.workspaceId}\u0000${validated.accountRef}\u0000${validated.message.messageId}`,
        stored
      );
      return outcome('ADMITTED', stored.message);
    });
  }

  resolveMessage(
    workspaceId: string,
    accountRef: string,
    messageId: string
  ): Promise<Readonly<ManagedCommunicationMessageV1>> {
    const found = this.messagesById.get(`${workspaceId}\u0000${accountRef}\u0000${messageId}`);
    if (!found)
      return Promise.reject(
        new ManagedCommunicationFoundationError(
          'MESSAGE_NOT_FOUND',
          'Communication message was not found in this workspace/account scope.'
        )
      );
    if (fingerprint(found.message) !== found.observationFingerprintSha256)
      return Promise.reject(
        new ManagedCommunicationFoundationError(
          'INVALID_PERSISTED_STATE',
          'Persisted communication message failed integrity verification.'
        )
      );
    return Promise.resolve(Object.freeze(cloneMessage(found.message)));
  }

  saveCheckpoint(
    command: Readonly<ManagedCommunicationSaveCheckpointV1>
  ): Promise<Readonly<ManagedCommunicationCheckpointV1>> {
    return this.resolveAccount(command.workspaceId, command.accountRef).then(() => {
      const value = checkpoint(command);
      const key = `${value.workspaceId}\u0000${value.accountRef}\u0000${value.checkpointRef}`;
      const existing = this.checkpoints.get(key);
      if (existing) {
        if (
          existing.providerCursor !== value.providerCursor ||
          existing.observedAt !== value.observedAt
        )
          throw new ManagedCommunicationFoundationError(
            'CHECKPOINT_CONFLICT',
            'Communication checkpoint reference is already bound to different provider cursor state.'
          );
        return cloneCheckpoint(existing);
      }
      this.checkpoints.set(key, { ...value });
      return cloneCheckpoint(value);
    });
  }

  latestCheckpoint(
    workspaceId: string,
    accountRef: string
  ): Promise<Readonly<ManagedCommunicationCheckpointV1> | undefined> {
    return this.resolveAccount(workspaceId, accountRef).then(() => {
      const candidates = [...this.checkpoints.values()]
        .filter((item) => item.workspaceId === workspaceId && item.accountRef === accountRef)
        .sort((left, right) => {
          const observed = right.observedAt.localeCompare(left.observedAt);
          return observed === 0 ? right.createdAt.localeCompare(left.createdAt) : observed;
        });
      return candidates[0] ? cloneCheckpoint(candidates[0]) : undefined;
    });
  }
}

type AccountRow = {
  workspace_id: unknown;
  account_ref: unknown;
  channel: unknown;
  provider: unknown;
  provider_account_ref: unknown;
  binding_fingerprint_sha256: unknown;
  created_at: unknown;
};

type MessageRow = {
  workspace_id: unknown;
  account_ref: unknown;
  provider: unknown;
  provider_message_id: unknown;
  idempotency_key_sha256: unknown;
  observation_fingerprint_sha256: unknown;
  message_json: unknown;
};

type CheckpointRow = {
  workspace_id: unknown;
  account_ref: unknown;
  checkpoint_ref: unknown;
  provider_cursor: unknown;
  cursor_sha256: unknown;
  observed_at: unknown;
  created_at: unknown;
};

function isoFromDatabase(value: unknown, field: string): string {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime()))
    throw new ManagedCommunicationFoundationError(
      'INVALID_PERSISTED_STATE',
      `Persisted ${field} is invalid.`
    );
  return date.toISOString();
}

function bindingFromRow(row: AccountRow): ManagedCommunicationAccountBindingV1 {
  if (
    typeof row.workspace_id !== 'string' ||
    typeof row.account_ref !== 'string' ||
    row.channel !== 'EMAIL' ||
    typeof row.provider !== 'string' ||
    typeof row.provider_account_ref !== 'string' ||
    typeof row.binding_fingerprint_sha256 !== 'string' ||
    !SHA256.test(row.binding_fingerprint_sha256)
  )
    throw new ManagedCommunicationFoundationError(
      'INVALID_PERSISTED_STATE',
      'Persisted communication account binding is invalid.'
    );
  const binding: ManagedCommunicationAccountBindingV1 = {
    schemaVersion: 1,
    workspaceId: row.workspace_id,
    accountRef: row.account_ref,
    channel: row.channel,
    provider: row.provider,
    providerAccountRef: row.provider_account_ref,
    createdAt: isoFromDatabase(row.created_at, 'account created_at')
  };
  if (accountFingerprint(binding) !== row.binding_fingerprint_sha256)
    throw new ManagedCommunicationFoundationError(
      'INVALID_PERSISTED_STATE',
      'Persisted communication account binding failed integrity verification.'
    );
  return binding;
}

function storedMessageFromRow(row: MessageRow): StoredMessage {
  if (
    typeof row.workspace_id !== 'string' ||
    typeof row.account_ref !== 'string' ||
    typeof row.provider !== 'string' ||
    typeof row.provider_message_id !== 'string' ||
    typeof row.idempotency_key_sha256 !== 'string' ||
    !SHA256.test(row.idempotency_key_sha256) ||
    typeof row.observation_fingerprint_sha256 !== 'string' ||
    !SHA256.test(row.observation_fingerprint_sha256)
  )
    throw new ManagedCommunicationFoundationError(
      'INVALID_PERSISTED_STATE',
      'Persisted communication message metadata is invalid.'
    );
  let message: ManagedCommunicationMessageV1;
  try {
    message = parseManagedCommunicationMessageV1(row.message_json);
  } catch (error) {
    throw new ManagedCommunicationFoundationError(
      'INVALID_PERSISTED_STATE',
      'Persisted communication message contract is invalid.',
      { cause: error instanceof Error ? error : undefined }
    );
  }
  if (
    message.accountRef !== row.account_ref ||
    message.providerObservation.provider !== row.provider ||
    message.providerObservation.providerMessageId !== row.provider_message_id ||
    fingerprint(message) !== row.observation_fingerprint_sha256
  )
    throw new ManagedCommunicationFoundationError(
      'INVALID_PERSISTED_STATE',
      'Persisted communication message failed provenance/integrity verification.'
    );
  return {
    workspaceId: row.workspace_id,
    accountRef: row.account_ref,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    idempotencyKeySha256: row.idempotency_key_sha256,
    observationFingerprintSha256: row.observation_fingerprint_sha256,
    message
  };
}

function checkpointFromRow(row: CheckpointRow): ManagedCommunicationCheckpointV1 {
  if (
    typeof row.workspace_id !== 'string' ||
    typeof row.account_ref !== 'string' ||
    typeof row.checkpoint_ref !== 'string' ||
    typeof row.provider_cursor !== 'string' ||
    typeof row.cursor_sha256 !== 'string' ||
    !SHA256.test(row.cursor_sha256) ||
    sha256(row.provider_cursor) !== row.cursor_sha256
  )
    throw new ManagedCommunicationFoundationError(
      'INVALID_PERSISTED_STATE',
      'Persisted communication checkpoint failed integrity verification.'
    );
  return {
    schemaVersion: 1,
    workspaceId: row.workspace_id,
    accountRef: row.account_ref,
    checkpointRef: row.checkpoint_ref,
    providerCursor: row.provider_cursor,
    observedAt: isoFromDatabase(row.observed_at, 'checkpoint observed_at'),
    createdAt: isoFromDatabase(row.created_at, 'checkpoint created_at')
  };
}

export class PostgresManagedCommunicationFoundationV1
  implements ManagedCommunicationFoundationStoreV1
{
  constructor(private readonly query: QueryClient) {}

  async registerAccount(
    command: Readonly<ManagedCommunicationRegisterAccountV1>
  ): Promise<Readonly<ManagedCommunicationAccountBindingV1>> {
    const binding = validatedBinding(command);
    const bindingSha = accountFingerprint(binding);
    try {
      await this.query.query(
        `INSERT INTO capability_communication_accounts (
           workspace_id,account_ref,channel,provider,provider_account_ref,binding_fingerprint_sha256,created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [
          binding.workspaceId,
          binding.accountRef,
          binding.channel,
          binding.provider,
          binding.providerAccountRef,
          bindingSha,
          binding.createdAt
        ]
      );
      const found = await this.query.query<AccountRow>(
        `SELECT workspace_id,account_ref,channel,provider,provider_account_ref,binding_fingerprint_sha256,created_at
           FROM capability_communication_accounts
          WHERE workspace_id=$1 AND account_ref=$2`,
        [binding.workspaceId, binding.accountRef]
      );
      const row = found.rows[0];
      if (!row)
        throw new ManagedCommunicationFoundationError(
          'ACCOUNT_CONFLICT',
          'Communication provider account reference is already bound to another account in this workspace.'
        );
      const persisted = bindingFromRow(row);
      if (
        persisted.channel !== binding.channel ||
        persisted.provider !== binding.provider ||
        persisted.providerAccountRef !== binding.providerAccountRef
      )
        throw new ManagedCommunicationFoundationError(
          'ACCOUNT_CONFLICT',
          'Communication account reference is already bound to different durable metadata.'
        );
      return Object.freeze(persisted);
    } catch (error) {
      if (error instanceof ManagedCommunicationFoundationError) throw error;
      throw new ManagedCommunicationFoundationError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication account persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async resolveAccount(
    workspaceId: string,
    accountRef: string
  ): Promise<Readonly<ManagedCommunicationAccountBindingV1>> {
    try {
      const found = await this.query.query<AccountRow>(
        `SELECT workspace_id,account_ref,channel,provider,provider_account_ref,binding_fingerprint_sha256,created_at
           FROM capability_communication_accounts
          WHERE workspace_id=$1 AND account_ref=$2`,
        [clean(workspaceId, 'workspaceId', 500), clean(accountRef, 'accountRef', 500)]
      );
      const row = found.rows[0];
      if (!row)
        throw new ManagedCommunicationFoundationError(
          'ACCOUNT_NOT_FOUND',
          'Communication account binding was not found in this workspace.'
        );
      return Object.freeze(bindingFromRow(row));
    } catch (error) {
      if (error instanceof ManagedCommunicationFoundationError) throw error;
      throw new ManagedCommunicationFoundationError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication account resolution is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async admitObservation(
    command: Readonly<ManagedCommunicationObservationCommandV1>
  ): Promise<Readonly<ManagedCommunicationObservationOutcomeV1>> {
    const binding = await this.resolveAccount(command.workspaceId, command.accountRef);
    const validated = validatedObservation(binding, command);
    try {
      const existingIdempotency = await this.query.query<MessageRow>(
        `SELECT workspace_id,account_ref,provider,provider_message_id,idempotency_key_sha256,
                observation_fingerprint_sha256,message_json
           FROM capability_communication_messages
          WHERE workspace_id=$1 AND account_ref=$2 AND idempotency_key_sha256=$3`,
        [validated.workspaceId, validated.accountRef, validated.idempotencyKeySha256]
      );
      if (existingIdempotency.rows[0]) {
        const existing = storedMessageFromRow(existingIdempotency.rows[0]);
        if (existing.observationFingerprintSha256 !== validated.observationFingerprintSha256)
          throw new ManagedCommunicationFoundationError(
            'IDEMPOTENCY_CONFLICT',
            'Communication idempotency key is already bound to a different observation.'
          );
        return outcome('REPLAYED', existing.message);
      }
      await this.query.query(
        `INSERT INTO capability_communication_messages (
           workspace_id,account_ref,provider,provider_message_id,provider_thread_id,message_id,thread_ref,
           idempotency_key_sha256,observation_fingerprint_sha256,message_json,observed_at,created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
         ON CONFLICT DO NOTHING`,
        [
          validated.workspaceId,
          validated.accountRef,
          validated.message.providerObservation.provider,
          validated.message.providerObservation.providerMessageId,
          validated.message.providerObservation.providerThreadId ?? null,
          validated.message.messageId,
          validated.message.threadRef,
          validated.idempotencyKeySha256,
          validated.observationFingerprintSha256,
          JSON.stringify(validated.message),
          validated.message.providerObservation.observedAt,
          validated.now
        ]
      );
      const found = await this.query.query<MessageRow>(
        `SELECT workspace_id,account_ref,provider,provider_message_id,idempotency_key_sha256,
                observation_fingerprint_sha256,message_json
           FROM capability_communication_messages
          WHERE workspace_id=$1 AND account_ref=$2 AND provider=$3 AND provider_message_id=$4`,
        [
          validated.workspaceId,
          validated.accountRef,
          validated.message.providerObservation.provider,
          validated.message.providerObservation.providerMessageId
        ]
      );
      const row = found.rows[0];
      if (!row)
        throw new ManagedCommunicationFoundationError(
          'PERSISTENCE_UNAVAILABLE',
          'Communication observation was not readable after persistence.'
        );
      const persisted = storedMessageFromRow(row);
      if (persisted.observationFingerprintSha256 !== validated.observationFingerprintSha256)
        throw new ManagedCommunicationFoundationError(
          'PROVIDER_OBSERVATION_CONFLICT',
          'Provider message identity is already bound to a different normalized observation.'
        );
      const disposition =
        persisted.idempotencyKeySha256 === validated.idempotencyKeySha256 ? 'ADMITTED' : 'REPLAYED';
      return outcome(disposition, persisted.message);
    } catch (error) {
      if (error instanceof ManagedCommunicationFoundationError) throw error;
      throw new ManagedCommunicationFoundationError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication observation persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async resolveMessage(
    workspaceId: string,
    accountRef: string,
    messageId: string
  ): Promise<Readonly<ManagedCommunicationMessageV1>> {
    try {
      const found = await this.query.query<MessageRow>(
        `SELECT workspace_id,account_ref,provider,provider_message_id,idempotency_key_sha256,
                observation_fingerprint_sha256,message_json
           FROM capability_communication_messages
          WHERE workspace_id=$1 AND account_ref=$2 AND message_id=$3`,
        [
          clean(workspaceId, 'workspaceId', 500),
          clean(accountRef, 'accountRef', 500),
          clean(messageId, 'messageId', 500)
        ]
      );
      const row = found.rows[0];
      if (!row)
        throw new ManagedCommunicationFoundationError(
          'MESSAGE_NOT_FOUND',
          'Communication message was not found in this workspace/account scope.'
        );
      return Object.freeze(cloneMessage(storedMessageFromRow(row).message));
    } catch (error) {
      if (error instanceof ManagedCommunicationFoundationError) throw error;
      throw new ManagedCommunicationFoundationError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication message resolution is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async saveCheckpoint(
    command: Readonly<ManagedCommunicationSaveCheckpointV1>
  ): Promise<Readonly<ManagedCommunicationCheckpointV1>> {
    await this.resolveAccount(command.workspaceId, command.accountRef);
    const value = checkpoint(command);
    const cursorSha = sha256(value.providerCursor);
    try {
      await this.query.query(
        `INSERT INTO capability_communication_checkpoints (
           workspace_id,account_ref,checkpoint_ref,provider_cursor,cursor_sha256,observed_at,created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [
          value.workspaceId,
          value.accountRef,
          value.checkpointRef,
          value.providerCursor,
          cursorSha,
          value.observedAt,
          value.createdAt
        ]
      );
      const found = await this.query.query<CheckpointRow>(
        `SELECT workspace_id,account_ref,checkpoint_ref,provider_cursor,cursor_sha256,observed_at,created_at
           FROM capability_communication_checkpoints
          WHERE workspace_id=$1 AND account_ref=$2 AND checkpoint_ref=$3`,
        [value.workspaceId, value.accountRef, value.checkpointRef]
      );
      const row = found.rows[0];
      if (!row)
        throw new ManagedCommunicationFoundationError(
          'PERSISTENCE_UNAVAILABLE',
          'Communication checkpoint was not readable after persistence.'
        );
      const persisted = checkpointFromRow(row);
      if (
        persisted.providerCursor !== value.providerCursor ||
        persisted.observedAt !== value.observedAt
      )
        throw new ManagedCommunicationFoundationError(
          'CHECKPOINT_CONFLICT',
          'Communication checkpoint reference is already bound to different provider cursor state.'
        );
      return cloneCheckpoint(persisted);
    } catch (error) {
      if (error instanceof ManagedCommunicationFoundationError) throw error;
      throw new ManagedCommunicationFoundationError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication checkpoint persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async latestCheckpoint(
    workspaceId: string,
    accountRef: string
  ): Promise<Readonly<ManagedCommunicationCheckpointV1> | undefined> {
    await this.resolveAccount(workspaceId, accountRef);
    try {
      const found = await this.query.query<CheckpointRow>(
        `SELECT workspace_id,account_ref,checkpoint_ref,provider_cursor,cursor_sha256,observed_at,created_at
           FROM capability_communication_checkpoints
          WHERE workspace_id=$1 AND account_ref=$2
          ORDER BY observed_at DESC, created_at DESC, checkpoint_ref DESC
          LIMIT 1`,
        [clean(workspaceId, 'workspaceId', 500), clean(accountRef, 'accountRef', 500)]
      );
      return found.rows[0] ? cloneCheckpoint(checkpointFromRow(found.rows[0])) : undefined;
    } catch (error) {
      if (error instanceof ManagedCommunicationFoundationError) throw error;
      throw new ManagedCommunicationFoundationError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication checkpoint resolution is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export function newManagedCommunicationIdempotencyKeyV1(): string {
  return `communication-import-${randomUUID()}`;
}
