const SEND_ID = /^commsend_([a-f0-9]{32})$/u;
const PUBLIC_REF = /^MO-([0-9A-HJKMNP-TV-Z]{26})$/u;
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const managedCommunicationPublicMailReferenceAuthorityV1 = Object.freeze({
  externalMessageSent: false,
  customerTruthMutated: false,
  matterTruthMutated: false,
  legalTruthCreated: false,
  knowledgeApproved: false,
  professionalDecisionCreated: false
});

export type ManagedCommunicationPublicMailReferenceAuthorityV1 =
  typeof managedCommunicationPublicMailReferenceAuthorityV1;

export interface ManagedCommunicationPublicMailReferenceResolutionV1 {
  schemaVersion: 1;
  workspaceId: string;
  publicMailRef: string;
  sendId: string;
  accountRef: string;
  messageId: string;
  threadRef: string;
  provider: string;
  providerMessageId: string;
  providerThreadId?: string;
  acceptedAt: string;
  authority: Readonly<ManagedCommunicationPublicMailReferenceAuthorityV1>;
}

export class ManagedCommunicationPublicMailReferenceContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ManagedCommunicationPublicMailReferenceContractError';
  }
}

function clean(value: unknown, field: string, maximum = 1000): string {
  if (typeof value !== 'string') {
    throw new ManagedCommunicationPublicMailReferenceContractError(`${field} must be a string.`);
  }
  const result = value.trim();
  if (!result || result.length > maximum) {
    throw new ManagedCommunicationPublicMailReferenceContractError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  }
  return result;
}

function encode128(hex: string): string {
  let value = BigInt(`0x${hex}`);
  let encoded = '';
  for (let index = 0; index < 26; index += 1) {
    encoded = ALPHABET[Number(value & 31n)]! + encoded;
    value >>= 5n;
  }
  return encoded;
}

function decode128(encoded: string): string {
  let value = 0n;
  for (const character of encoded) {
    const digit = ALPHABET.indexOf(character);
    if (digit < 0) {
      throw new ManagedCommunicationPublicMailReferenceContractError(
        'publicMailRef contains an unsupported Crockford Base32 character.'
      );
    }
    value = (value << 5n) | BigInt(digit);
  }
  if (value >= 1n << 128n) {
    throw new ManagedCommunicationPublicMailReferenceContractError(
      'publicMailRef exceeds the 128-bit send identity range.'
    );
  }
  return value.toString(16).padStart(32, '0');
}

export function managedCommunicationPublicMailRefFromSendIdV1(sendId: string): string {
  const normalized = clean(sendId, 'sendId', 80);
  const match = SEND_ID.exec(normalized);
  if (!match) {
    throw new ManagedCommunicationPublicMailReferenceContractError(
      'sendId must be a canonical Managed Communication send identity.'
    );
  }
  return `MO-${encode128(match[1]!)}`;
}

export function managedCommunicationSendIdFromPublicMailRefV1(publicMailRef: string): string {
  const normalized = clean(publicMailRef, 'publicMailRef', 40).toUpperCase();
  const match = PUBLIC_REF.exec(normalized);
  if (!match) {
    throw new ManagedCommunicationPublicMailReferenceContractError(
      'publicMailRef must use the canonical MO Crockford Base32 format.'
    );
  }
  const sendId = `commsend_${decode128(match[1]!)}`;
  if (managedCommunicationPublicMailRefFromSendIdV1(sendId) !== normalized) {
    throw new ManagedCommunicationPublicMailReferenceContractError(
      'publicMailRef is not a canonical Managed Communication public reference.'
    );
  }
  return sendId;
}

export function extractManagedCommunicationPublicMailRefsV1(
  value: string,
  maximum = 20
): readonly string[] {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 100) {
    throw new ManagedCommunicationPublicMailReferenceContractError(
      'maximum must contain an integer from 1 to 100.'
    );
  }
  const refs: string[] = [];
  const seen = new Set<string>();
  const pattern = /(?:^|[^A-Z0-9])(MO-[0-9A-HJKMNP-TV-Z]{26})(?=$|[^A-Z0-9])/giu;
  for (const match of value.matchAll(pattern)) {
    const ref = match[1]!.toUpperCase();
    managedCommunicationSendIdFromPublicMailRefV1(ref);
    if (seen.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
    if (refs.length > maximum) {
      throw new ManagedCommunicationPublicMailReferenceContractError(
        `public mail reference material exceeds the bounded ${maximum}-reference limit.`
      );
    }
  }
  return refs;
}

function timestamp(value: unknown, field: string): string {
  const result = clean(value, field, 80);
  const parsed = new Date(result);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== result) {
    throw new ManagedCommunicationPublicMailReferenceContractError(
      `${field} must be a canonical ISO timestamp.`
    );
  }
  return result;
}

export function parseManagedCommunicationPublicMailReferenceResolutionV1(
  value: unknown
): ManagedCommunicationPublicMailReferenceResolutionV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ManagedCommunicationPublicMailReferenceContractError('resolution must be an object.');
  }
  const item = value as Record<string, unknown>;
  const allowed = new Set([
    'schemaVersion',
    'workspaceId',
    'publicMailRef',
    'sendId',
    'accountRef',
    'messageId',
    'threadRef',
    'provider',
    'providerMessageId',
    'providerThreadId',
    'acceptedAt',
    'authority'
  ]);
  if (Object.keys(item).some((key) => !allowed.has(key)) || item.schemaVersion !== 1) {
    throw new ManagedCommunicationPublicMailReferenceContractError(
      'resolution must contain only the V1 fields and schemaVersion 1.'
    );
  }
  const publicMailRef = clean(item.publicMailRef, 'publicMailRef', 40).toUpperCase();
  const sendId = clean(item.sendId, 'sendId', 80);
  if (managedCommunicationSendIdFromPublicMailRefV1(publicMailRef) !== sendId) {
    throw new ManagedCommunicationPublicMailReferenceContractError(
      'publicMailRef does not encode the supplied sendId.'
    );
  }
  const authority = item.authority;
  if (!authority || typeof authority !== 'object' || Array.isArray(authority)) {
    throw new ManagedCommunicationPublicMailReferenceContractError('authority must be an object.');
  }
  const authorityRecord = authority as Record<string, unknown>;
  const authorityKeys = Object.keys(managedCommunicationPublicMailReferenceAuthorityV1);
  if (
    Object.keys(authorityRecord).length !== authorityKeys.length ||
    Object.keys(authorityRecord).some((key) => !authorityKeys.includes(key))
  ) {
    throw new ManagedCommunicationPublicMailReferenceContractError(
      'authority must contain exactly the V1 authority fields.'
    );
  }
  for (const [key, expected] of Object.entries(
    managedCommunicationPublicMailReferenceAuthorityV1
  )) {
    if (authorityRecord[key] !== expected) {
      throw new ManagedCommunicationPublicMailReferenceContractError(
        `authority.${key} must remain false.`
      );
    }
  }
  const providerThreadId =
    item.providerThreadId === undefined
      ? undefined
      : clean(item.providerThreadId, 'providerThreadId', 500);
  return {
    schemaVersion: 1,
    workspaceId: clean(item.workspaceId, 'workspaceId', 500),
    publicMailRef,
    sendId,
    accountRef: clean(item.accountRef, 'accountRef', 500),
    messageId: clean(item.messageId, 'messageId', 500),
    threadRef: clean(item.threadRef, 'threadRef', 500),
    provider: clean(item.provider, 'provider', 120),
    providerMessageId: clean(item.providerMessageId, 'providerMessageId', 500),
    ...(providerThreadId === undefined ? {} : { providerThreadId }),
    acceptedAt: timestamp(item.acceptedAt, 'acceptedAt'),
    authority: managedCommunicationPublicMailReferenceAuthorityV1
  };
}
