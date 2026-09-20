export type ExternalCredentialBindingId = `external-credential-binding_${string}`;

export const externalCredentialSecretKindsV1 = ['API_KEY', 'STATIC_BEARER', 'BASIC'] as const;
export type ExternalCredentialSecretKindV1 = (typeof externalCredentialSecretKindsV1)[number];

export const externalCredentialLifecyclesV1 = [
  'ACTIVE',
  'EXPIRED',
  'REAUTH_REQUIRED',
  'REVOKED'
] as const;
export type ExternalCredentialLifecycleV1 = (typeof externalCredentialLifecyclesV1)[number];

export const externalCredentialCurrentnessStatesV1 = [
  'CURRENT',
  'EXPIRED',
  'REAUTH_REQUIRED',
  'REVOKED',
  'UNKNOWN',
  'UNAVAILABLE'
] as const;
export type ExternalCredentialCurrentnessStateV1 =
  (typeof externalCredentialCurrentnessStatesV1)[number];

export interface ExternalCredentialRefV1 {
  owner: 'CORE_IDENTITY';
  credentialBindingId: ExternalCredentialBindingId;
  version: number;
}
export interface ExternalCredentialGrantorV1 {
  userId: string;
  membershipId: string;
  membershipVersion: number;
}

export const noExternalCredentialAuthorityConsequencesV1 = Object.freeze({
  credentialSelectionAuthorityGranted: false,
  providerSelectionAuthorityGranted: false,
  implementationSelectionAuthorityGranted: false,
  protectedActionAuthorized: false,
  externalActionAuthorized: false,
  publishAuthorized: false,
  messageSendAuthorized: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  externalIdentityLegallyVerified: false
});
export type ExternalCredentialAuthorityConsequencesV1 =
  typeof noExternalCredentialAuthorityConsequencesV1;

export interface ExternalCredentialBindingV1 {
  schemaVersion: 1;
  credentialBindingId: ExternalCredentialBindingId;
  version: number;
  workspaceId: string;
  provider: string;
  externalAccountRef: string;
  secretKind: ExternalCredentialSecretKindV1;
  allowedCapabilityIds: readonly string[];
  grantor: Readonly<ExternalCredentialGrantorV1>;
  lifecycle: ExternalCredentialLifecycleV1;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  expiredAt?: string;
  reauthRequiredAt?: string;
  revokedAt?: string;
  authority: Readonly<ExternalCredentialAuthorityConsequencesV1>;
}

export interface ExternalCredentialCurrentnessV1 {
  schemaVersion: 1;
  credential: Readonly<ExternalCredentialRefV1>;
  state: ExternalCredentialCurrentnessStateV1;
  checkedAt: string;
  exposesSecretMaterial: false;
  createsExecutionAuthority: false;
}

export class ExternalCredentialContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalCredentialContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const BINDING_ID = /^external-credential-binding_[A-Za-z0-9._:-]+$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const forbiddenSensitiveKeys = new Set([
  'apikey',
  'apikeyid',
  'apikeysecret',
  'secret',
  'token',
  'bearertoken',
  'accesstoken',
  'refreshtoken',
  'username',
  'password',
  'authorization',
  'cookie',
  'cookies',
  'session',
  'sessiontoken',
  'ciphertext',
  'nonce',
  'authtag',
  'keyid',
  'encryptionkey',
  'rawproviderresponse'
]);

function normalizedKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
}
function rejectSensitiveMaterial(value: unknown, field: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectSensitiveMaterial(entry, `${field}[${index}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (forbiddenSensitiveKeys.has(normalizedKey(key)))
      throw new ExternalCredentialContractError(`${field}.${key} is forbidden secret material.`);
    rejectSensitiveMaterial(nested, `${field}.${key}`);
  }
}
function object(value: unknown, field: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new ExternalCredentialContractError(`${field} must be an object.`);
  return value as JsonRecord;
}
function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const supported = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !supported.has(key));
  if (unknown.length)
    throw new ExternalCredentialContractError(
      `${field} contains unsupported fields: ${unknown.join(', ')}.`
    );
}
function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new ExternalCredentialContractError(`${field} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum)
    throw new ExternalCredentialContractError(`${field} must contain 1 to ${maximum} characters.`);
  return normalized;
}
function uuid(value: unknown, field: string): string {
  const normalized = text(value, field, 80).toLowerCase();
  if (!UUID.test(normalized)) throw new ExternalCredentialContractError(`${field} must be a UUID.`);
  return normalized;
}
function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new ExternalCredentialContractError(`${field} must be a positive safe integer.`);
  return Number(value);
}
function timestamp(value: unknown, field: string): string {
  const normalized = text(value, field, 80);
  if (!Number.isFinite(Date.parse(normalized)))
    throw new ExternalCredentialContractError(`${field} must be a timestamp.`);
  return new Date(normalized).toISOString();
}
function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new ExternalCredentialContractError(`${field} must be a non-empty array.`);
  const result = value.map((entry, index) => text(entry, `${field}[${index}]`, 200));
  if (new Set(result).size !== result.length)
    throw new ExternalCredentialContractError(`${field} must not contain duplicates.`);
  return Object.freeze(result);
}
function parseRef(value: unknown): ExternalCredentialRefV1 {
  const item = object(value, 'credential');
  exactKeys(item, ['owner', 'credentialBindingId', 'version'], 'credential');
  if (item.owner !== 'CORE_IDENTITY')
    throw new ExternalCredentialContractError('credential.owner must be CORE_IDENTITY.');
  const credentialBindingId = text(item.credentialBindingId, 'credential.credentialBindingId', 240);
  if (!BINDING_ID.test(credentialBindingId))
    throw new ExternalCredentialContractError('credential.credentialBindingId is invalid.');
  return {
    owner: 'CORE_IDENTITY',
    credentialBindingId: credentialBindingId as ExternalCredentialBindingId,
    version: positiveInteger(item.version, 'credential.version')
  };
}
function parseAuthority(value: unknown): ExternalCredentialAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  const keys = Object.keys(noExternalCredentialAuthorityConsequencesV1);
  exactKeys(item, keys, 'authority');
  for (const key of keys)
    if (item[key] !== false)
      throw new ExternalCredentialContractError(`authority.${key} must be false.`);
  return noExternalCredentialAuthorityConsequencesV1;
}

export function parseExternalCredentialRefV1(value: unknown): ExternalCredentialRefV1 {
  rejectSensitiveMaterial(value, 'credential');
  return parseRef(value);
}

export function parseExternalCredentialBindingV1(value: unknown): ExternalCredentialBindingV1 {
  rejectSensitiveMaterial(value, 'externalCredentialBinding');
  const item = object(value, 'externalCredentialBinding');
  exactKeys(
    item,
    [
      'schemaVersion',
      'credentialBindingId',
      'version',
      'workspaceId',
      'provider',
      'externalAccountRef',
      'secretKind',
      'allowedCapabilityIds',
      'grantor',
      'lifecycle',
      'expiresAt',
      'createdAt',
      'updatedAt',
      'expiredAt',
      'reauthRequiredAt',
      'revokedAt',
      'authority'
    ],
    'externalCredentialBinding'
  );
  if (item.schemaVersion !== 1)
    throw new ExternalCredentialContractError('schemaVersion must be 1.');
  const credentialBindingId = text(item.credentialBindingId, 'credentialBindingId', 240);
  if (!BINDING_ID.test(credentialBindingId))
    throw new ExternalCredentialContractError('credentialBindingId is invalid.');
  if (!externalCredentialSecretKindsV1.includes(item.secretKind as ExternalCredentialSecretKindV1))
    throw new ExternalCredentialContractError('secretKind is invalid.');
  if (!externalCredentialLifecyclesV1.includes(item.lifecycle as ExternalCredentialLifecycleV1))
    throw new ExternalCredentialContractError('lifecycle is invalid.');
  const lifecycle = item.lifecycle as ExternalCredentialLifecycleV1;
  const grantor = object(item.grantor, 'grantor');
  exactKeys(grantor, ['userId', 'membershipId', 'membershipVersion'], 'grantor');
  const expiresAt =
    item.expiresAt === undefined ? undefined : timestamp(item.expiresAt, 'expiresAt');
  const expiredAt =
    item.expiredAt === undefined ? undefined : timestamp(item.expiredAt, 'expiredAt');
  const reauthRequiredAt =
    item.reauthRequiredAt === undefined
      ? undefined
      : timestamp(item.reauthRequiredAt, 'reauthRequiredAt');
  const revokedAt =
    item.revokedAt === undefined ? undefined : timestamp(item.revokedAt, 'revokedAt');
  if ((lifecycle === 'EXPIRED') !== Boolean(expiredAt))
    throw new ExternalCredentialContractError('EXPIRED lifecycle must match expiredAt.');
  if ((lifecycle === 'REAUTH_REQUIRED') !== Boolean(reauthRequiredAt))
    throw new ExternalCredentialContractError(
      'REAUTH_REQUIRED lifecycle must match reauthRequiredAt.'
    );
  if ((lifecycle === 'REVOKED') !== Boolean(revokedAt))
    throw new ExternalCredentialContractError('REVOKED lifecycle must match revokedAt.');
  const createdAt = timestamp(item.createdAt, 'createdAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');
  if (Date.parse(updatedAt) < Date.parse(createdAt))
    throw new ExternalCredentialContractError('updatedAt cannot precede createdAt.');
  return {
    schemaVersion: 1,
    credentialBindingId: credentialBindingId as ExternalCredentialBindingId,
    version: positiveInteger(item.version, 'version'),
    workspaceId: uuid(item.workspaceId, 'workspaceId'),
    provider: text(item.provider, 'provider', 120),
    externalAccountRef: text(item.externalAccountRef, 'externalAccountRef', 500),
    secretKind: item.secretKind as ExternalCredentialSecretKindV1,
    allowedCapabilityIds: stringList(item.allowedCapabilityIds, 'allowedCapabilityIds'),
    grantor: {
      userId: uuid(grantor.userId, 'grantor.userId'),
      membershipId: uuid(grantor.membershipId, 'grantor.membershipId'),
      membershipVersion: positiveInteger(grantor.membershipVersion, 'grantor.membershipVersion')
    },
    lifecycle,
    ...(expiresAt ? { expiresAt } : {}),
    createdAt,
    updatedAt,
    ...(expiredAt ? { expiredAt } : {}),
    ...(reauthRequiredAt ? { reauthRequiredAt } : {}),
    ...(revokedAt ? { revokedAt } : {}),
    authority: parseAuthority(item.authority)
  };
}

export function parseExternalCredentialCurrentnessV1(
  value: unknown
): ExternalCredentialCurrentnessV1 {
  rejectSensitiveMaterial(value, 'externalCredentialCurrentness');
  const item = object(value, 'externalCredentialCurrentness');
  exactKeys(
    item,
    [
      'schemaVersion',
      'credential',
      'state',
      'checkedAt',
      'exposesSecretMaterial',
      'createsExecutionAuthority'
    ],
    'externalCredentialCurrentness'
  );
  if (item.schemaVersion !== 1)
    throw new ExternalCredentialContractError('currentness.schemaVersion must be 1.');
  if (
    !externalCredentialCurrentnessStatesV1.includes(
      item.state as ExternalCredentialCurrentnessStateV1
    )
  )
    throw new ExternalCredentialContractError('currentness.state is invalid.');
  if (item.exposesSecretMaterial !== false || item.createsExecutionAuthority !== false)
    throw new ExternalCredentialContractError('currentness authority flags must be false.');
  return {
    schemaVersion: 1,
    credential: parseRef(item.credential),
    state: item.state as ExternalCredentialCurrentnessStateV1,
    checkedAt: timestamp(item.checkedAt, 'currentness.checkedAt'),
    exposesSecretMaterial: false,
    createsExecutionAuthority: false
  };
}
