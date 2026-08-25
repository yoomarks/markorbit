export const MANAGED_COMMUNICATION_CAPABILITY_ID = 'managed-communication' as const;
export const MANAGED_COMMUNICATION_CONTRACT_VERSION = '1.0.0' as const;

export const managedCommunicationChannels = ['EMAIL'] as const;
export type ManagedCommunicationChannel = (typeof managedCommunicationChannels)[number];

export const managedCommunicationDirections = ['INBOUND', 'OUTBOUND'] as const;
export type ManagedCommunicationDirection = (typeof managedCommunicationDirections)[number];

export const managedCommunicationParticipantRoles = [
  'SENDER',
  'TO',
  'CC',
  'BCC',
  'REPLY_TO'
] as const;
export type ManagedCommunicationParticipantRole =
  (typeof managedCommunicationParticipantRoles)[number];

export interface ManagedCommunicationAccountRefV1 {
  accountRef: string;
  channel: ManagedCommunicationChannel;
}

export interface ManagedCommunicationParticipantV1 {
  role: ManagedCommunicationParticipantRole;
  address: string;
  displayName?: string;
}

export interface ManagedCommunicationAttachmentRefV1 {
  attachmentRef: string;
  fileName?: string;
  mediaType?: string;
  sizeBytes?: number;
  sha256?: string;
}

export interface ManagedCommunicationProviderObservationV1 {
  provider: string;
  providerMessageId: string;
  providerThreadId?: string;
  observedAt: string;
}

export interface ManagedCommunicationMessageV1 {
  schemaVersion: 1;
  messageId: string;
  accountRef: string;
  threadRef: string;
  channel: ManagedCommunicationChannel;
  direction: ManagedCommunicationDirection;
  participants: readonly Readonly<ManagedCommunicationParticipantV1>[];
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  attachments: readonly Readonly<ManagedCommunicationAttachmentRefV1>[];
  occurredAt: string;
  providerObservation: Readonly<ManagedCommunicationProviderObservationV1>;
}

export interface ManagedCommunicationReadRequestV1 {
  schemaVersion: 1;
  accountRef: string;
  channel: ManagedCommunicationChannel;
  checkpointRef?: string;
  maxMessages: number;
}

export interface ManagedCommunicationAuthorityConsequencesV1 {
  externalMessageSent: false;
  customerTruthMutated: false;
  matterTruthMutated: false;
  legalTruthCreated: false;
  knowledgeApproved: false;
  professionalDecisionCreated: false;
}

export const managedCommunicationNoAuthorityConsequences = Object.freeze({
  externalMessageSent: false,
  customerTruthMutated: false,
  matterTruthMutated: false,
  legalTruthCreated: false,
  knowledgeApproved: false,
  professionalDecisionCreated: false
}) satisfies Readonly<ManagedCommunicationAuthorityConsequencesV1>;

export interface ManagedCommunicationReadOutcomeV1 {
  schemaVersion: 1;
  capabilityId: typeof MANAGED_COMMUNICATION_CAPABILITY_ID;
  capabilityVersion: typeof MANAGED_COMMUNICATION_CONTRACT_VERSION;
  accountRef: string;
  channel: ManagedCommunicationChannel;
  messages: readonly Readonly<ManagedCommunicationMessageV1>[];
  nextCheckpointRef?: string;
  hasMore: boolean;
  authority: Readonly<ManagedCommunicationAuthorityConsequencesV1>;
}

export class ManagedCommunicationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManagedCommunicationContractError';
  }
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ManagedCommunicationContractError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const allow = new Set(allowed);
  const unsupported = Object.keys(record).filter((key) => !allow.has(key));
  if (unsupported.length > 0) {
    throw new ManagedCommunicationContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
  }
}

function nonEmptyString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== 'string') {
    throw new ManagedCommunicationContractError(`${field} must be a string.`);
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new ManagedCommunicationContractError(
      `${field} must contain 1 to ${maxLength} characters.`
    );
  }
  return cleaned;
}

function optionalString(value: unknown, field: string, maxLength = 500): string | undefined {
  if (value === undefined) return undefined;
  return nonEmptyString(value, field, maxLength);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ManagedCommunicationContractError(`${field} is invalid.`);
  }
  return value as T;
}

function isoTimestamp(value: unknown, field: string): string {
  const cleaned = nonEmptyString(value, field, 80);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== cleaned) {
    throw new ManagedCommunicationContractError(`${field} must be a canonical ISO timestamp.`);
  }
  return cleaned;
}

function parseParticipant(value: unknown, field: string): ManagedCommunicationParticipantV1 {
  const record = asRecord(value, field);
  exactKeys(record, ['role', 'address', 'displayName'], field);
  const displayName = optionalString(record.displayName, `${field}.displayName`, 300);
  return {
    role: enumValue(record.role, managedCommunicationParticipantRoles, `${field}.role`),
    address: nonEmptyString(record.address, `${field}.address`, 500),
    ...(displayName === undefined ? {} : { displayName })
  };
}

function parseAttachment(value: unknown, field: string): ManagedCommunicationAttachmentRefV1 {
  const record = asRecord(value, field);
  exactKeys(record, ['attachmentRef', 'fileName', 'mediaType', 'sizeBytes', 'sha256'], field);
  const fileName = optionalString(record.fileName, `${field}.fileName`, 500);
  const mediaType = optionalString(record.mediaType, `${field}.mediaType`, 200);
  let sizeBytes: number | undefined;
  if (record.sizeBytes !== undefined) {
    if (!Number.isSafeInteger(record.sizeBytes) || (record.sizeBytes as number) < 0) {
      throw new ManagedCommunicationContractError(
        `${field}.sizeBytes must be a non-negative safe integer.`
      );
    }
    sizeBytes = record.sizeBytes as number;
  }
  const sha256 = optionalString(record.sha256, `${field}.sha256`, 64);
  if (sha256 !== undefined && !/^[a-f0-9]{64}$/u.test(sha256)) {
    throw new ManagedCommunicationContractError(`${field}.sha256 must be lowercase SHA-256 hex.`);
  }
  return {
    attachmentRef: nonEmptyString(record.attachmentRef, `${field}.attachmentRef`, 500),
    ...(fileName === undefined ? {} : { fileName }),
    ...(mediaType === undefined ? {} : { mediaType }),
    ...(sizeBytes === undefined ? {} : { sizeBytes }),
    ...(sha256 === undefined ? {} : { sha256 })
  };
}

function parseProviderObservation(value: unknown): ManagedCommunicationProviderObservationV1 {
  const record = asRecord(value, 'providerObservation');
  exactKeys(
    record,
    ['provider', 'providerMessageId', 'providerThreadId', 'observedAt'],
    'providerObservation'
  );
  const providerThreadId = optionalString(
    record.providerThreadId,
    'providerObservation.providerThreadId',
    500
  );
  return {
    provider: nonEmptyString(record.provider, 'providerObservation.provider', 120),
    providerMessageId: nonEmptyString(
      record.providerMessageId,
      'providerObservation.providerMessageId',
      500
    ),
    ...(providerThreadId === undefined ? {} : { providerThreadId }),
    observedAt: isoTimestamp(record.observedAt, 'providerObservation.observedAt')
  };
}

export function parseManagedCommunicationReadRequestV1(
  value: unknown
): ManagedCommunicationReadRequestV1 {
  const record = asRecord(value, 'managedCommunicationReadRequest');
  exactKeys(
    record,
    ['schemaVersion', 'accountRef', 'channel', 'checkpointRef', 'maxMessages'],
    'managedCommunicationReadRequest'
  );
  if (record.schemaVersion !== 1) {
    throw new ManagedCommunicationContractError(
      'managedCommunicationReadRequest.schemaVersion must be 1.'
    );
  }
  if (!Number.isSafeInteger(record.maxMessages) || (record.maxMessages as number) < 1) {
    throw new ManagedCommunicationContractError(
      'managedCommunicationReadRequest.maxMessages must be a positive safe integer.'
    );
  }
  if ((record.maxMessages as number) > 500) {
    throw new ManagedCommunicationContractError(
      'managedCommunicationReadRequest.maxMessages must not exceed 500.'
    );
  }
  const checkpointRef = optionalString(
    record.checkpointRef,
    'managedCommunicationReadRequest.checkpointRef',
    1000
  );
  return {
    schemaVersion: 1,
    accountRef: nonEmptyString(record.accountRef, 'managedCommunicationReadRequest.accountRef', 500),
    channel: enumValue(
      record.channel,
      managedCommunicationChannels,
      'managedCommunicationReadRequest.channel'
    ),
    ...(checkpointRef === undefined ? {} : { checkpointRef }),
    maxMessages: record.maxMessages as number
  };
}

export function parseManagedCommunicationMessageV1(value: unknown): ManagedCommunicationMessageV1 {
  const record = asRecord(value, 'managedCommunicationMessage');
  exactKeys(
    record,
    [
      'schemaVersion',
      'messageId',
      'accountRef',
      'threadRef',
      'channel',
      'direction',
      'participants',
      'subject',
      'textBody',
      'htmlBody',
      'attachments',
      'occurredAt',
      'providerObservation'
    ],
    'managedCommunicationMessage'
  );
  if (record.schemaVersion !== 1) {
    throw new ManagedCommunicationContractError('managedCommunicationMessage.schemaVersion must be 1.');
  }
  if (!Array.isArray(record.participants) || record.participants.length === 0) {
    throw new ManagedCommunicationContractError(
      'managedCommunicationMessage.participants must be a non-empty array.'
    );
  }
  const participants = record.participants.map((item, index) =>
    parseParticipant(item, `managedCommunicationMessage.participants[${index}]`)
  );
  if (participants.filter((participant) => participant.role === 'SENDER').length !== 1) {
    throw new ManagedCommunicationContractError(
      'managedCommunicationMessage.participants must contain exactly one SENDER.'
    );
  }
  if (!Array.isArray(record.attachments)) {
    throw new ManagedCommunicationContractError(
      'managedCommunicationMessage.attachments must be an array.'
    );
  }
  const attachments = record.attachments.map((item, index) =>
    parseAttachment(item, `managedCommunicationMessage.attachments[${index}]`)
  );
  const subject = optionalString(record.subject, 'managedCommunicationMessage.subject', 1000);
  const textBody = optionalString(record.textBody, 'managedCommunicationMessage.textBody', 2_000_000);
  const htmlBody = optionalString(record.htmlBody, 'managedCommunicationMessage.htmlBody', 4_000_000);
  return {
    schemaVersion: 1,
    messageId: nonEmptyString(record.messageId, 'managedCommunicationMessage.messageId', 500),
    accountRef: nonEmptyString(record.accountRef, 'managedCommunicationMessage.accountRef', 500),
    threadRef: nonEmptyString(record.threadRef, 'managedCommunicationMessage.threadRef', 500),
    channel: enumValue(
      record.channel,
      managedCommunicationChannels,
      'managedCommunicationMessage.channel'
    ),
    direction: enumValue(
      record.direction,
      managedCommunicationDirections,
      'managedCommunicationMessage.direction'
    ),
    participants,
    ...(subject === undefined ? {} : { subject }),
    ...(textBody === undefined ? {} : { textBody }),
    ...(htmlBody === undefined ? {} : { htmlBody }),
    attachments,
    occurredAt: isoTimestamp(record.occurredAt, 'managedCommunicationMessage.occurredAt'),
    providerObservation: parseProviderObservation(record.providerObservation)
  };
}
