export const noManagedCommunicationReplyReferenceAuthorityConsequencesV1 = Object.freeze({
  externalMessageSent: false,
  customerTruthMutated: false,
  opportunityTruthCreated: false,
  matterTruthMutated: false,
  legalTruthCreated: false,
  campaignTruthCreated: false,
  professionalDecisionCreated: false
});
export type ManagedCommunicationReplyReferenceAuthorityConsequencesV1 =
  typeof noManagedCommunicationReplyReferenceAuthorityConsequencesV1;

export interface ManagedCommunicationReplyReferenceEvidenceV1 {
  schemaVersion: 1;
  workspaceId: string;
  accountRef: string;
  messageId: string;
  threadRef: string;
  provider: string;
  providerMessageId: string;
  observedAt: string;
  inReplyToMessageIds: readonly string[];
  referenceMessageIds: readonly string[];
  exactEvidence: Readonly<{
    evidenceRef: string;
    sha256: string;
  }>;
  authority: Readonly<ManagedCommunicationReplyReferenceAuthorityConsequencesV1>;
}

export class ManagedCommunicationReplyReferenceContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ManagedCommunicationReplyReferenceContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[a-f0-9]{64}$/u;
const forbiddenKeys = new Set([
  'address',
  'email',
  'participant',
  'participants',
  'subject',
  'body',
  'textbody',
  'htmlbody',
  'attachment',
  'attachments',
  'rawpayload',
  'rawemail',
  'credential',
  'credentials',
  'secret',
  'token',
  'authorization',
  'cookie'
]);

function normalizedKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
}

function rejectForbidden(value: unknown, field = 'managedCommunicationReplyReference'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectForbidden(entry, `${field}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (forbiddenKeys.has(normalizedKey(key)))
      throw new ManagedCommunicationReplyReferenceContractError(
        `${field}.${key} is forbidden material.`
      );
    rejectForbidden(nested, `${field}.${key}`);
  }
}

function object(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ManagedCommunicationReplyReferenceContractError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const expected = [...allowed].sort();
  const actual = Object.keys(value).sort();
  if (actual.join(',') !== expected.join(','))
    throw new ManagedCommunicationReplyReferenceContractError(
      `${field} must contain exactly the V1 fields.`
    );
}

function text(value: unknown, field: string, maximum = 1000): string {
  if (typeof value !== 'string')
    throw new ManagedCommunicationReplyReferenceContractError(`${field} must be a string.`);
  const result = value.trim();
  if (!result || result.length > maximum)
    throw new ManagedCommunicationReplyReferenceContractError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  return result;
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 80);
  const parsed = new Date(result);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== result)
    throw new ManagedCommunicationReplyReferenceContractError(
      `${field} must be a canonical ISO timestamp.`
    );
  return result;
}

function messageIds(
  value: unknown,
  field: string,
  maximumItems: number
): readonly string[] {
  if (!Array.isArray(value) || value.length > maximumItems)
    throw new ManagedCommunicationReplyReferenceContractError(
      `${field} must contain at most ${maximumItems} message identifiers.`
    );
  const result = value.map((entry, index) => text(entry, `${field}[${index}]`, 1000));
  if (new Set(result).size !== result.length)
    throw new ManagedCommunicationReplyReferenceContractError(`${field} must not contain duplicates.`);
  return result;
}

function authority(
  value: unknown
): ManagedCommunicationReplyReferenceAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  const expected = noManagedCommunicationReplyReferenceAuthorityConsequencesV1;
  exactKeys(item, Object.keys(expected), 'authority');
  for (const key of Object.keys(expected) as Array<
    keyof ManagedCommunicationReplyReferenceAuthorityConsequencesV1
  >) {
    if (item[key] !== false)
      throw new ManagedCommunicationReplyReferenceContractError(
        `authority.${key} must remain false.`
      );
  }
  return expected;
}

export function parseManagedCommunicationReplyReferenceEvidenceV1(
  value: unknown
): ManagedCommunicationReplyReferenceEvidenceV1 {
  rejectForbidden(value);
  const item = object(value, 'managedCommunicationReplyReference');
  exactKeys(
    item,
    [
      'schemaVersion',
      'workspaceId',
      'accountRef',
      'messageId',
      'threadRef',
      'provider',
      'providerMessageId',
      'observedAt',
      'inReplyToMessageIds',
      'referenceMessageIds',
      'exactEvidence',
      'authority'
    ],
    'managedCommunicationReplyReference'
  );
  if (item.schemaVersion !== 1)
    throw new ManagedCommunicationReplyReferenceContractError('schemaVersion must be 1.');

  const workspaceId = text(item.workspaceId, 'workspaceId', 80).toLowerCase();
  if (!UUID.test(workspaceId))
    throw new ManagedCommunicationReplyReferenceContractError('workspaceId must be a UUID.');

  const exactEvidence = object(item.exactEvidence, 'exactEvidence');
  exactKeys(exactEvidence, ['evidenceRef', 'sha256'], 'exactEvidence');
  const sha256 = text(exactEvidence.sha256, 'exactEvidence.sha256', 64);
  if (!SHA256.test(sha256))
    throw new ManagedCommunicationReplyReferenceContractError(
      'exactEvidence.sha256 must be lowercase SHA-256 hex.'
    );

  return {
    schemaVersion: 1,
    workspaceId,
    accountRef: text(item.accountRef, 'accountRef', 500),
    messageId: text(item.messageId, 'messageId', 500),
    threadRef: text(item.threadRef, 'threadRef', 500),
    provider: text(item.provider, 'provider', 120),
    providerMessageId: text(item.providerMessageId, 'providerMessageId', 500),
    observedAt: timestamp(item.observedAt, 'observedAt'),
    inReplyToMessageIds: messageIds(item.inReplyToMessageIds, 'inReplyToMessageIds', 20),
    referenceMessageIds: messageIds(item.referenceMessageIds, 'referenceMessageIds', 50),
    exactEvidence: {
      evidenceRef: text(exactEvidence.evidenceRef, 'exactEvidence.evidenceRef', 500),
      sha256
    },
    authority: authority(item.authority)
  };
}
