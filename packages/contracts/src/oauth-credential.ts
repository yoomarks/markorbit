export type ExternalOAuthCredentialBindingId = `oauth-credential-binding_${string}`;

export const externalOAuthCredentialLifecyclesV1 = [
  'ACTIVE',
  'EXPIRED',
  'REAUTH_REQUIRED',
  'REVOKED'
] as const;
export type ExternalOAuthCredentialLifecycleV1 =
  (typeof externalOAuthCredentialLifecyclesV1)[number];

export const externalOAuthRefreshCapabilitiesV1 = [
  'AVAILABLE',
  'NOT_AVAILABLE',
  'UNKNOWN'
] as const;
export type ExternalOAuthRefreshCapabilityV1 = (typeof externalOAuthRefreshCapabilitiesV1)[number];

export const externalOAuthVerificationStatusesV1 = ['VERIFIED', 'UNKNOWN', 'UNAVAILABLE'] as const;
export type ExternalOAuthVerificationStatusV1 =
  (typeof externalOAuthVerificationStatusesV1)[number];
export interface ExternalOAuthCredentialRefV1 {
  owner: 'CORE_IDENTITY';
  credentialBindingId: ExternalOAuthCredentialBindingId;
  version: number;
}

export interface ExternalOAuthClientProfileRefV1 {
  id: string;
  version: string;
}

export interface ExternalOAuthCredentialGrantorV1 {
  userId: string;
  membershipId: string;
  membershipVersion: number;
}

export const noExternalOAuthCredentialAuthorityConsequencesV1 = Object.freeze({
  protectedActionAuthorized: false,
  externalActionAuthorized: false,
  publishAuthorized: false,
  messageSendAuthorized: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  externalIdentityLegallyVerified: false
});
export type ExternalOAuthCredentialAuthorityConsequencesV1 =
  typeof noExternalOAuthCredentialAuthorityConsequencesV1;
export interface ExternalOAuthCredentialBindingV1 {
  schemaVersion: 1;
  credentialBindingId: ExternalOAuthCredentialBindingId;
  version: number;
  workspaceId: string;
  provider: string;
  oauthClientProfileRef: Readonly<ExternalOAuthClientProfileRefV1>;
  externalAccountRef: string;
  grantedScopes: readonly string[];
  grantor: Readonly<ExternalOAuthCredentialGrantorV1>;
  lifecycle: ExternalOAuthCredentialLifecycleV1;
  refreshCapability: ExternalOAuthRefreshCapabilityV1;
  accessExpiresAt?: string;
  grantedAt: string;
  updatedAt: string;
  revokedAt?: string;
  reauthRequiredAt?: string;
  authority: Readonly<ExternalOAuthCredentialAuthorityConsequencesV1>;
}

export interface ExternalOAuthCredentialVerificationV1 {
  schemaVersion: 1;
  credential: Readonly<ExternalOAuthCredentialRefV1>;
  status: ExternalOAuthVerificationStatusV1;
  observedAt: string;
  reasonCode: string;
}

export class ExternalOAuthCredentialContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalOAuthCredentialContractError';
  }
}
type JsonRecord = Record<string, unknown>;

const forbiddenSensitiveKeys = new Set([
  'authorizationcode',
  'accesstoken',
  'refreshtoken',
  'clientsecret',
  'password',
  'cookie',
  'cookies',
  'session',
  'sessiontoken',
  'encryptionkey',
  'ciphertext',
  'nonce',
  'authtag',
  'rawproviderresponse',
  'pkceverifier'
]);

function normalizedKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
}

function rejectSensitiveMaterial(value: unknown, field = 'oauthCredential'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectSensitiveMaterial(entry, `${field}[${index}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (forbiddenSensitiveKeys.has(normalizedKey(key)))
      throw new ExternalOAuthCredentialContractError(
        `${field}.${key} is forbidden secret material.`
      );
    rejectSensitiveMaterial(nested, `${field}.${key}`);
  }
}
function object(value: unknown, field: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new ExternalOAuthCredentialContractError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unsupported.length)
    throw new ExternalOAuthCredentialContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 300): string {
  if (typeof value !== 'string')
    throw new ExternalOAuthCredentialContractError(`${field} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum)
    throw new ExternalOAuthCredentialContractError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  return normalized;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new ExternalOAuthCredentialContractError(`${field} must be a positive safe integer.`);
  return value as number;
}
function timestamp(value: unknown, field: string): string {
  const normalized = text(value, field, 80);
  if (!Number.isFinite(Date.parse(normalized)))
    throw new ExternalOAuthCredentialContractError(`${field} must be a timestamp.`);
  return new Date(normalized).toISOString();
}

function scopes(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value))
    throw new ExternalOAuthCredentialContractError(`${field} must be an array.`);
  const normalized = value.map((entry, index) => text(entry, `${field}[${index}]`, 200));
  if (new Set(normalized).size !== normalized.length)
    throw new ExternalOAuthCredentialContractError(`${field} must not contain duplicates.`);
  return Object.freeze(normalized);
}

function parseRef(value: unknown): ExternalOAuthCredentialRefV1 {
  const item = object(value, 'credential');
  exactKeys(item, ['owner', 'credentialBindingId', 'version'], 'credential');
  if (item.owner !== 'CORE_IDENTITY')
    throw new ExternalOAuthCredentialContractError('credential.owner must be CORE_IDENTITY.');
  const credentialBindingId = text(item.credentialBindingId, 'credential.credentialBindingId', 240);
  if (!credentialBindingId.startsWith('oauth-credential-binding_'))
    throw new ExternalOAuthCredentialContractError('credential.credentialBindingId is invalid.');
  return {
    owner: 'CORE_IDENTITY',
    credentialBindingId: credentialBindingId as ExternalOAuthCredentialBindingId,
    version: positiveInteger(item.version, 'credential.version')
  };
}
function parseAuthority(value: unknown): ExternalOAuthCredentialAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  const keys = Object.keys(noExternalOAuthCredentialAuthorityConsequencesV1);
  exactKeys(item, keys, 'authority');
  for (const key of keys) {
    if (item[key] !== false)
      throw new ExternalOAuthCredentialContractError(`authority.${key} must be false.`);
  }
  return noExternalOAuthCredentialAuthorityConsequencesV1;
}

export function parseExternalOAuthCredentialRefV1(value: unknown): ExternalOAuthCredentialRefV1 {
  rejectSensitiveMaterial(value, 'credential');
  return parseRef(value);
}

export function parseExternalOAuthCredentialBindingV1(
  value: unknown
): ExternalOAuthCredentialBindingV1 {
  rejectSensitiveMaterial(value);
  const item = object(value, 'oauthCredentialBinding');
  exactKeys(
    item,
    [
      'schemaVersion',
      'credentialBindingId',
      'version',
      'workspaceId',
      'provider',
      'oauthClientProfileRef',
      'externalAccountRef',
      'grantedScopes',
      'grantor',
      'lifecycle',
      'refreshCapability',
      'accessExpiresAt',
      'grantedAt',
      'updatedAt',
      'revokedAt',
      'reauthRequiredAt',
      'authority'
    ],
    'oauthCredentialBinding'
  );
  if (item.schemaVersion !== 1)
    throw new ExternalOAuthCredentialContractError('schemaVersion must be 1.');
  const credentialBindingId = text(item.credentialBindingId, 'credentialBindingId', 240);
  if (!credentialBindingId.startsWith('oauth-credential-binding_'))
    throw new ExternalOAuthCredentialContractError('credentialBindingId is invalid.');
  const profile = object(item.oauthClientProfileRef, 'oauthClientProfileRef');
  exactKeys(profile, ['id', 'version'], 'oauthClientProfileRef');
  const grantor = object(item.grantor, 'grantor');
  exactKeys(grantor, ['userId', 'membershipId', 'membershipVersion'], 'grantor');
  if (
    !externalOAuthCredentialLifecyclesV1.includes(
      item.lifecycle as ExternalOAuthCredentialLifecycleV1
    )
  )
    throw new ExternalOAuthCredentialContractError('lifecycle is invalid.');
  if (
    !externalOAuthRefreshCapabilitiesV1.includes(
      item.refreshCapability as ExternalOAuthRefreshCapabilityV1
    )
  )
    throw new ExternalOAuthCredentialContractError('refreshCapability is invalid.');
  const lifecycle = item.lifecycle as ExternalOAuthCredentialLifecycleV1;
  const accessExpiresAt =
    item.accessExpiresAt === undefined
      ? undefined
      : timestamp(item.accessExpiresAt, 'accessExpiresAt');
  const revokedAt =
    item.revokedAt === undefined ? undefined : timestamp(item.revokedAt, 'revokedAt');
  const reauthRequiredAt =
    item.reauthRequiredAt === undefined
      ? undefined
      : timestamp(item.reauthRequiredAt, 'reauthRequiredAt');
  if (lifecycle === 'REVOKED' && !revokedAt)
    throw new ExternalOAuthCredentialContractError('REVOKED binding requires revokedAt.');
  if (lifecycle === 'REAUTH_REQUIRED' && !reauthRequiredAt)
    throw new ExternalOAuthCredentialContractError(
      'REAUTH_REQUIRED binding requires reauthRequiredAt.'
    );
  if (lifecycle !== 'REVOKED' && revokedAt)
    throw new ExternalOAuthCredentialContractError('revokedAt requires REVOKED lifecycle.');
  if (lifecycle !== 'REAUTH_REQUIRED' && reauthRequiredAt)
    throw new ExternalOAuthCredentialContractError(
      'reauthRequiredAt requires REAUTH_REQUIRED lifecycle.'
    );
  return {
    schemaVersion: 1,
    credentialBindingId: credentialBindingId as ExternalOAuthCredentialBindingId,
    version: positiveInteger(item.version, 'version'),
    workspaceId: text(item.workspaceId, 'workspaceId', 240),
    provider: text(item.provider, 'provider', 120),
    oauthClientProfileRef: {
      id: text(profile.id, 'oauthClientProfileRef.id', 240),
      version: text(profile.version, 'oauthClientProfileRef.version', 120)
    },
    externalAccountRef: text(item.externalAccountRef, 'externalAccountRef', 500),
    grantedScopes: scopes(item.grantedScopes, 'grantedScopes'),
    grantor: {
      userId: text(grantor.userId, 'grantor.userId', 240),
      membershipId: text(grantor.membershipId, 'grantor.membershipId', 240),
      membershipVersion: positiveInteger(grantor.membershipVersion, 'grantor.membershipVersion')
    },
    lifecycle,
    refreshCapability: item.refreshCapability as ExternalOAuthRefreshCapabilityV1,
    ...(accessExpiresAt ? { accessExpiresAt } : {}),
    grantedAt: timestamp(item.grantedAt, 'grantedAt'),
    updatedAt: timestamp(item.updatedAt, 'updatedAt'),
    ...(revokedAt ? { revokedAt } : {}),
    ...(reauthRequiredAt ? { reauthRequiredAt } : {}),
    authority: parseAuthority(item.authority)
  };
}

export function parseExternalOAuthCredentialVerificationV1(
  value: unknown
): ExternalOAuthCredentialVerificationV1 {
  rejectSensitiveMaterial(value, 'oauthCredentialVerification');
  const item = object(value, 'oauthCredentialVerification');
  exactKeys(
    item,
    ['schemaVersion', 'credential', 'status', 'observedAt', 'reasonCode'],
    'oauthCredentialVerification'
  );
  if (item.schemaVersion !== 1)
    throw new ExternalOAuthCredentialContractError('schemaVersion must be 1.');
  if (
    !externalOAuthVerificationStatusesV1.includes(item.status as ExternalOAuthVerificationStatusV1)
  )
    throw new ExternalOAuthCredentialContractError('status is invalid.');
  return {
    schemaVersion: 1,
    credential: parseRef(item.credential),
    status: item.status as ExternalOAuthVerificationStatusV1,
    observedAt: timestamp(item.observedAt, 'observedAt'),
    reasonCode: text(item.reasonCode, 'reasonCode', 200)
  };
}
