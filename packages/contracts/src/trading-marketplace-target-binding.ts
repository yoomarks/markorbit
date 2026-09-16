export type TradingMarketplaceTargetBindingId = `trading-marketplace-target-binding_${string}`;

export const tradingMarketplaceTargetBindingLifecyclesV1 = ['ACTIVE', 'STALE', 'REVOKED'] as const;
export type TradingMarketplaceTargetBindingLifecycleV1 =
  (typeof tradingMarketplaceTargetBindingLifecyclesV1)[number];

export const tradingMarketplaceTargetBindingSourceKindsV1 = [
  'MARKETPLACE_AUTH',
  'MARKETPLACE_API',
  'WORKSPACE_VERIFIED'
] as const;
export type TradingMarketplaceTargetBindingSourceKindV1 =
  (typeof tradingMarketplaceTargetBindingSourceKindsV1)[number];

export interface TradingMarketplaceTargetIdentityV1 {
  marketplaceId: string;
  externalAccountId: string;
  externalStoreId?: string;
  externalChannelId?: string;
  displayLabel: string;
  handle?: string;
}

export interface TradingMarketplaceTargetConnectionV1 {
  sourceKind: TradingMarketplaceTargetBindingSourceKindV1;
  evidenceRefs: readonly string[];
}

export const noTradingMarketplaceTargetBindingAuthorityConsequencesV1 = Object.freeze({
  credentialAuthorityGranted: false,
  protectedActionAuthorized: false,
  executionStarted: false,
  externalPublicationCreated: false,
  trademarkTruthMutated: false,
  ownershipEstablished: false,
  valuationEstablished: false,
  demandEstablished: false
});
export type TradingMarketplaceTargetBindingAuthorityConsequencesV1 =
  typeof noTradingMarketplaceTargetBindingAuthorityConsequencesV1;

export interface TradingMarketplaceTargetBindingV1 {
  schemaVersion: 1;
  tradingMarketplaceTargetBindingId: TradingMarketplaceTargetBindingId;
  version: number;
  workspaceId: string;
  identity: Readonly<TradingMarketplaceTargetIdentityV1>;
  lifecycle: TradingMarketplaceTargetBindingLifecycleV1;
  connection: Readonly<TradingMarketplaceTargetConnectionV1>;
  createdAt: string;
  lastVerifiedAt: string;
  updatedAt: string;
  staleAt?: string;
  revokedAt?: string;
  authority: Readonly<TradingMarketplaceTargetBindingAuthorityConsequencesV1>;
}

export class TradingMarketplaceTargetBindingContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingMarketplaceTargetBindingContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const forbiddenSecretKeys = new Set([
  'password',
  'secret',
  'apisecret',
  'clientsecret',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'sessionid',
  'session',
  'cookie',
  'cookies',
  'credential',
  'credentials',
  'authorization',
  'bearer',
  'browserstorage',
  'localstorage',
  'rawproviderresponse',
  'endpoint',
  'providerendpoint'
]);

const normalizedKey = (value: string) => value.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
function rejectSecretMaterial(value: unknown, field = 'tradingMarketplaceTargetBinding'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectSecretMaterial(entry, `${field}[${index}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (forbiddenSecretKeys.has(normalizedKey(key)))
      throw new TradingMarketplaceTargetBindingContractError(
        `${field}.${key} is forbidden secret/provider material.`
      );
    rejectSecretMaterial(nested, `${field}.${key}`);
  }
}
function object(value: unknown, field: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TradingMarketplaceTargetBindingContractError(`${field} must be an object.`);
  return value as JsonRecord;
}
function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const unsupported = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unsupported.length)
    throw new TradingMarketplaceTargetBindingContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}
function text(value: unknown, field: string, maximum = 300): string {
  if (typeof value !== 'string')
    throw new TradingMarketplaceTargetBindingContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new TradingMarketplaceTargetBindingContractError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  return cleaned;
}
function optionalText(value: unknown, field: string, maximum = 300): string | undefined {
  return value === undefined ? undefined : text(value, field, maximum);
}
function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new TradingMarketplaceTargetBindingContractError(
      `${field} must be a positive safe integer.`
    );
  return value as number;
}
function timestamp(value: unknown, field: string): string {
  const normalized = text(value, field, 80);
  if (!Number.isFinite(Date.parse(normalized)))
    throw new TradingMarketplaceTargetBindingContractError(`${field} must be a timestamp.`);
  return new Date(normalized).toISOString();
}
function strings(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new TradingMarketplaceTargetBindingContractError(`${field} must be a non-empty array.`);
  const result = value.map((entry, index) => text(entry, `${field}[${index}]`, 500));
  if (new Set(result).size !== result.length)
    throw new TradingMarketplaceTargetBindingContractError(`${field} must not contain duplicates.`);
  return Object.freeze(result);
}
function parseIdentity(value: unknown): TradingMarketplaceTargetIdentityV1 {
  const item = object(value, 'identity');
  exactKeys(
    item,
    [
      'marketplaceId',
      'externalAccountId',
      'externalStoreId',
      'externalChannelId',
      'displayLabel',
      'handle'
    ],
    'identity'
  );
  const externalStoreId = optionalText(item.externalStoreId, 'identity.externalStoreId');
  const externalChannelId = optionalText(item.externalChannelId, 'identity.externalChannelId');
  const handle = optionalText(item.handle, 'identity.handle', 200);
  return {
    marketplaceId: text(item.marketplaceId, 'identity.marketplaceId', 80),
    externalAccountId: text(item.externalAccountId, 'identity.externalAccountId'),
    ...(externalStoreId ? { externalStoreId } : {}),
    ...(externalChannelId ? { externalChannelId } : {}),
    displayLabel: text(item.displayLabel, 'identity.displayLabel', 200),
    ...(handle ? { handle } : {})
  };
}
function parseConnection(value: unknown): TradingMarketplaceTargetConnectionV1 {
  const item = object(value, 'connection');
  exactKeys(item, ['sourceKind', 'evidenceRefs'], 'connection');
  if (
    !tradingMarketplaceTargetBindingSourceKindsV1.includes(
      item.sourceKind as TradingMarketplaceTargetBindingSourceKindV1
    )
  )
    throw new TradingMarketplaceTargetBindingContractError('connection.sourceKind is invalid.');
  return {
    sourceKind: item.sourceKind as TradingMarketplaceTargetBindingSourceKindV1,
    evidenceRefs: strings(item.evidenceRefs, 'connection.evidenceRefs')
  };
}
function parseAuthority(value: unknown): TradingMarketplaceTargetBindingAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  const keys = Object.keys(noTradingMarketplaceTargetBindingAuthorityConsequencesV1) as Array<
    keyof TradingMarketplaceTargetBindingAuthorityConsequencesV1
  >;
  exactKeys(item, keys, 'authority');
  for (const key of keys) {
    if (item[key] !== false)
      throw new TradingMarketplaceTargetBindingContractError(`authority.${key} must be false.`);
  }
  return noTradingMarketplaceTargetBindingAuthorityConsequencesV1;
}
function assertChronology(
  earlier: string,
  later: string,
  earlierField: string,
  laterField: string
): void {
  if (Date.parse(earlier) > Date.parse(later))
    throw new TradingMarketplaceTargetBindingContractError(
      `${earlierField} cannot be after ${laterField}.`
    );
}

export function parseTradingMarketplaceTargetBindingV1(
  value: unknown
): TradingMarketplaceTargetBindingV1 {
  rejectSecretMaterial(value);
  const item = object(value, 'tradingMarketplaceTargetBinding');
  exactKeys(
    item,
    [
      'schemaVersion',
      'tradingMarketplaceTargetBindingId',
      'version',
      'workspaceId',
      'identity',
      'lifecycle',
      'connection',
      'createdAt',
      'lastVerifiedAt',
      'updatedAt',
      'staleAt',
      'revokedAt',
      'authority'
    ],
    'tradingMarketplaceTargetBinding'
  );
  if (item.schemaVersion !== 1)
    throw new TradingMarketplaceTargetBindingContractError('schemaVersion must be 1.');
  const bindingId = text(
    item.tradingMarketplaceTargetBindingId,
    'tradingMarketplaceTargetBindingId',
    240
  );
  if (!bindingId.startsWith('trading-marketplace-target-binding_'))
    throw new TradingMarketplaceTargetBindingContractError(
      'tradingMarketplaceTargetBindingId is invalid.'
    );
  if (
    !tradingMarketplaceTargetBindingLifecyclesV1.includes(
      item.lifecycle as TradingMarketplaceTargetBindingLifecycleV1
    )
  )
    throw new TradingMarketplaceTargetBindingContractError('lifecycle is invalid.');
  const lifecycle = item.lifecycle as TradingMarketplaceTargetBindingLifecycleV1;
  const createdAt = timestamp(item.createdAt, 'createdAt');
  const lastVerifiedAt = timestamp(item.lastVerifiedAt, 'lastVerifiedAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');
  const staleAt = item.staleAt === undefined ? undefined : timestamp(item.staleAt, 'staleAt');
  const revokedAt =
    item.revokedAt === undefined ? undefined : timestamp(item.revokedAt, 'revokedAt');
  assertChronology(createdAt, lastVerifiedAt, 'createdAt', 'lastVerifiedAt');
  assertChronology(lastVerifiedAt, updatedAt, 'lastVerifiedAt', 'updatedAt');
  if (lifecycle === 'ACTIVE' && (staleAt || revokedAt))
    throw new TradingMarketplaceTargetBindingContractError(
      'ACTIVE binding cannot carry staleAt or revokedAt.'
    );
  if (lifecycle === 'STALE') {
    if (!staleAt)
      throw new TradingMarketplaceTargetBindingContractError('STALE binding requires staleAt.');
    if (revokedAt)
      throw new TradingMarketplaceTargetBindingContractError(
        'STALE binding cannot carry revokedAt.'
      );
    assertChronology(lastVerifiedAt, staleAt, 'lastVerifiedAt', 'staleAt');
    assertChronology(staleAt, updatedAt, 'staleAt', 'updatedAt');
  }
  if (lifecycle === 'REVOKED') {
    if (!revokedAt)
      throw new TradingMarketplaceTargetBindingContractError('REVOKED binding requires revokedAt.');
    assertChronology(lastVerifiedAt, revokedAt, 'lastVerifiedAt', 'revokedAt');
    assertChronology(revokedAt, updatedAt, 'revokedAt', 'updatedAt');
    if (staleAt) {
      assertChronology(lastVerifiedAt, staleAt, 'lastVerifiedAt', 'staleAt');
      assertChronology(staleAt, revokedAt, 'staleAt', 'revokedAt');
    }
  }
  return {
    schemaVersion: 1,
    tradingMarketplaceTargetBindingId: bindingId as TradingMarketplaceTargetBindingId,
    version: positiveInteger(item.version, 'version'),
    workspaceId: text(item.workspaceId, 'workspaceId', 80),
    identity: parseIdentity(item.identity),
    lifecycle,
    connection: parseConnection(item.connection),
    createdAt,
    lastVerifiedAt,
    updatedAt,
    ...(staleAt ? { staleAt } : {}),
    ...(revokedAt ? { revokedAt } : {}),
    authority: parseAuthority(item.authority)
  };
}
