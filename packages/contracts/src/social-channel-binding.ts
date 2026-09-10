import type { ImplementationProfileId } from './capability-runtime.js';

export type SocialChannelBindingId = `social-channel-binding_${string}`;

export const socialChannelBindingStatuses = ['ACTIVE', 'STALE', 'REVOKED'] as const;
export type SocialChannelBindingStatus = (typeof socialChannelBindingStatuses)[number];

export const socialChannelBindingSourceKinds = ['PLATFORM_AUTH', 'PLATFORM_API'] as const;
export type SocialChannelBindingSourceKind = (typeof socialChannelBindingSourceKinds)[number];

export const socialChannelVerificationStatuses = ['VERIFIED', 'UNKNOWN', 'UNAVAILABLE'] as const;
export type SocialChannelVerificationStatus = (typeof socialChannelVerificationStatuses)[number];

export interface SocialChannelVerificationObservationV1 {
  status: SocialChannelVerificationStatus;
  observedAt: string;
}

export interface SocialChannelExternalIdentityV1 {
  platformId: string;
  externalAccountId: string;
  externalChannelId?: string;
  displayLabel: string;
  handle?: string;
}

export interface SocialChannelCapabilityRefV1 {
  capabilityId: string;
  capabilityVersion: string;
}

export interface SocialChannelImplementationRefV1 {
  implementationProfileId: ImplementationProfileId;
  version: number;
}

export interface SocialChannelConnectionProvenanceV1 {
  sourceKind: SocialChannelBindingSourceKind;
  capabilityRef: Readonly<SocialChannelCapabilityRefV1>;
  implementationRef: Readonly<SocialChannelImplementationRefV1>;
  evidenceRefs: readonly string[];
}

export const noSocialChannelBindingAuthorityConsequencesV1 = Object.freeze({
  credentialStoredInBusinessContract: false,
  credentialAuthorityGranted: false,
  providerSelectionAuthorityGranted: false,
  protectedActionAuthorized: false,
  executionStarted: false,
  externalPublicationCreated: false,
  externalMessageSent: false
});
export type SocialChannelBindingAuthorityConsequencesV1 =
  typeof noSocialChannelBindingAuthorityConsequencesV1;

/**
 * Social-owned durable fact that one Workspace is bound to one external social account/channel.
 *
 * The binding records safe identity and adapter provenance only. Credential material remains behind
 * the selected platform adapter / secret boundary and is structurally excluded from this contract.
 * This record does not authorize publication, messaging, provider selection, or execution.
 */
export interface SocialChannelBindingV1 {
  schemaVersion: 1;
  socialChannelBindingId: SocialChannelBindingId;
  version: number;
  workspaceId: string;
  identity: Readonly<SocialChannelExternalIdentityV1>;
  status: SocialChannelBindingStatus;
  connection: Readonly<SocialChannelConnectionProvenanceV1>;
  boundAt: string;
  lastVerifiedAt: string;
  staleAt?: string;
  revokedAt?: string;
  updatedAt: string;
  authority: Readonly<SocialChannelBindingAuthorityConsequencesV1>;
}

export type SocialChannelBindingEligibilityReasonV1 =
  | 'ELIGIBLE'
  | 'WORKSPACE_MISMATCH'
  | 'BINDING_STALE'
  | 'BINDING_REVOKED'
  | 'VERIFICATION_UNKNOWN'
  | 'VERIFICATION_UNAVAILABLE';

export interface SocialChannelBindingEligibilityV1 {
  eligible: boolean;
  reason: SocialChannelBindingEligibilityReasonV1;
  binding: Readonly<{ socialChannelBindingId: SocialChannelBindingId; version: number }>;
  assessedAt: string;
  verificationStatus: SocialChannelVerificationStatus;
  createsExecutionAuthority: false;
}

export class SocialChannelBindingContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'SocialChannelBindingContractError';
  }
}

type JsonRecord = Record<string, unknown>;

const forbiddenCredentialKeys = new Set([
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
  'localstorage'
]);

function normalizedKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
}

function rejectCredentialMaterial(value: unknown, field = 'socialChannelBinding'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectCredentialMaterial(entry, `${field}[${index}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (forbiddenCredentialKeys.has(normalizedKey(key)))
      throw new SocialChannelBindingContractError(
        `${field}.${key} is forbidden credential/session material.`
      );
    rejectCredentialMaterial(nested, `${field}.${key}`);
  }
}

function object(value: unknown, field: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new SocialChannelBindingContractError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unsupported.length)
    throw new SocialChannelBindingContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 300): string {
  if (typeof value !== 'string')
    throw new SocialChannelBindingContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new SocialChannelBindingContractError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  return cleaned;
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 80);
  if (!Number.isFinite(Date.parse(result)))
    throw new SocialChannelBindingContractError(`${field} must be a timestamp.`);
  return result;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new SocialChannelBindingContractError(`${field} must be a positive safe integer.`);
  return value as number;
}

function optionalText(value: unknown, field: string, maximum = 300): string | undefined {
  return value === undefined ? undefined : text(value, field, maximum);
}

function strings(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new SocialChannelBindingContractError(`${field} must be a non-empty array.`);
  const result = value.map((entry, index) => text(entry, `${field}[${index}]`, 500));
  if (new Set(result).size !== result.length)
    throw new SocialChannelBindingContractError(`${field} must not contain duplicates.`);
  return result;
}

function parseIdentity(value: unknown): SocialChannelExternalIdentityV1 {
  const item = object(value, 'identity');
  exactKeys(
    item,
    ['platformId', 'externalAccountId', 'externalChannelId', 'displayLabel', 'handle'],
    'identity'
  );
  const externalChannelId = optionalText(item.externalChannelId, 'identity.externalChannelId');
  const handle = optionalText(item.handle, 'identity.handle', 200);
  return {
    platformId: text(item.platformId, 'identity.platformId', 80),
    externalAccountId: text(item.externalAccountId, 'identity.externalAccountId'),
    ...(externalChannelId ? { externalChannelId } : {}),
    displayLabel: text(item.displayLabel, 'identity.displayLabel', 200),
    ...(handle ? { handle } : {})
  };
}

function parseCapabilityRef(value: unknown): SocialChannelCapabilityRefV1 {
  const item = object(value, 'connection.capabilityRef');
  exactKeys(item, ['capabilityId', 'capabilityVersion'], 'connection.capabilityRef');
  return {
    capabilityId: text(item.capabilityId, 'connection.capabilityRef.capabilityId', 160),
    capabilityVersion: text(
      item.capabilityVersion,
      'connection.capabilityRef.capabilityVersion',
      80
    )
  };
}

function parseImplementationRef(value: unknown): SocialChannelImplementationRefV1 {
  const item = object(value, 'connection.implementationRef');
  exactKeys(item, ['implementationProfileId', 'version'], 'connection.implementationRef');
  const implementationProfileId = text(
    item.implementationProfileId,
    'connection.implementationRef.implementationProfileId',
    240
  );
  if (!implementationProfileId.startsWith('implementation-profile_'))
    throw new SocialChannelBindingContractError(
      'connection.implementationRef.implementationProfileId is invalid.'
    );
  return {
    implementationProfileId: implementationProfileId as ImplementationProfileId,
    version: positiveInteger(item.version, 'connection.implementationRef.version')
  };
}

function parseConnection(value: unknown): SocialChannelConnectionProvenanceV1 {
  const item = object(value, 'connection');
  exactKeys(
    item,
    ['sourceKind', 'capabilityRef', 'implementationRef', 'evidenceRefs'],
    'connection'
  );
  if (!socialChannelBindingSourceKinds.includes(item.sourceKind as SocialChannelBindingSourceKind))
    throw new SocialChannelBindingContractError('connection.sourceKind is invalid.');
  return {
    sourceKind: item.sourceKind as SocialChannelBindingSourceKind,
    capabilityRef: parseCapabilityRef(item.capabilityRef),
    implementationRef: parseImplementationRef(item.implementationRef),
    evidenceRefs: strings(item.evidenceRefs, 'connection.evidenceRefs')
  };
}

function parseAuthority(value: unknown): SocialChannelBindingAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  exactKeys(item, Object.keys(noSocialChannelBindingAuthorityConsequencesV1), 'authority');
  for (const key of Object.keys(noSocialChannelBindingAuthorityConsequencesV1) as Array<
    keyof SocialChannelBindingAuthorityConsequencesV1
  >) {
    if (item[key] !== false)
      throw new SocialChannelBindingContractError(`authority.${key} must be false.`);
  }
  return noSocialChannelBindingAuthorityConsequencesV1;
}

function assertTimestampOrder(
  earlier: string,
  later: string,
  earlierField: string,
  laterField: string
): void {
  if (Date.parse(earlier) > Date.parse(later))
    throw new SocialChannelBindingContractError(`${earlierField} cannot be after ${laterField}.`);
}

export function parseSocialChannelBindingV1(value: unknown): SocialChannelBindingV1 {
  rejectCredentialMaterial(value);
  const item = object(value, 'socialChannelBinding');
  exactKeys(
    item,
    [
      'schemaVersion',
      'socialChannelBindingId',
      'version',
      'workspaceId',
      'identity',
      'status',
      'connection',
      'boundAt',
      'lastVerifiedAt',
      'staleAt',
      'revokedAt',
      'updatedAt',
      'authority'
    ],
    'socialChannelBinding'
  );
  if (item.schemaVersion !== 1)
    throw new SocialChannelBindingContractError('schemaVersion must be 1.');

  const bindingId = text(item.socialChannelBindingId, 'socialChannelBindingId', 240);
  if (!bindingId.startsWith('social-channel-binding_'))
    throw new SocialChannelBindingContractError('socialChannelBindingId is invalid.');
  if (!socialChannelBindingStatuses.includes(item.status as SocialChannelBindingStatus))
    throw new SocialChannelBindingContractError('status is invalid.');

  const status = item.status as SocialChannelBindingStatus;
  const boundAt = timestamp(item.boundAt, 'boundAt');
  const lastVerifiedAt = timestamp(item.lastVerifiedAt, 'lastVerifiedAt');
  const staleAt = item.staleAt === undefined ? undefined : timestamp(item.staleAt, 'staleAt');
  const revokedAt =
    item.revokedAt === undefined ? undefined : timestamp(item.revokedAt, 'revokedAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');

  assertTimestampOrder(boundAt, lastVerifiedAt, 'boundAt', 'lastVerifiedAt');
  assertTimestampOrder(lastVerifiedAt, updatedAt, 'lastVerifiedAt', 'updatedAt');

  if (status === 'ACTIVE' && (staleAt || revokedAt))
    throw new SocialChannelBindingContractError(
      'ACTIVE binding cannot carry staleAt or revokedAt.'
    );
  if (status === 'STALE') {
    if (!staleAt) throw new SocialChannelBindingContractError('STALE binding requires staleAt.');
    if (revokedAt)
      throw new SocialChannelBindingContractError('STALE binding cannot carry revokedAt.');
    assertTimestampOrder(lastVerifiedAt, staleAt, 'lastVerifiedAt', 'staleAt');
    assertTimestampOrder(staleAt, updatedAt, 'staleAt', 'updatedAt');
  }
  if (status === 'REVOKED') {
    if (!revokedAt)
      throw new SocialChannelBindingContractError('REVOKED binding requires revokedAt.');
    assertTimestampOrder(lastVerifiedAt, revokedAt, 'lastVerifiedAt', 'revokedAt');
    assertTimestampOrder(revokedAt, updatedAt, 'revokedAt', 'updatedAt');
    if (staleAt) {
      assertTimestampOrder(lastVerifiedAt, staleAt, 'lastVerifiedAt', 'staleAt');
      assertTimestampOrder(staleAt, revokedAt, 'staleAt', 'revokedAt');
    }
  }

  return {
    schemaVersion: 1,
    socialChannelBindingId: bindingId as SocialChannelBindingId,
    version: positiveInteger(item.version, 'version'),
    workspaceId: text(item.workspaceId, 'workspaceId', 240),
    identity: parseIdentity(item.identity),
    status,
    connection: parseConnection(item.connection),
    boundAt,
    lastVerifiedAt,
    ...(staleAt ? { staleAt } : {}),
    ...(revokedAt ? { revokedAt } : {}),
    updatedAt,
    authority: parseAuthority(item.authority)
  };
}

export function assessSocialChannelBindingEligibilityV1(
  binding: Readonly<SocialChannelBindingV1>,
  request: Readonly<{
    workspaceId: string;
    assessedAt: string;
    verification: Readonly<SocialChannelVerificationObservationV1>;
  }>
): SocialChannelBindingEligibilityV1 {
  const assessedAt = timestamp(request.assessedAt, 'assessedAt');
  const workspaceId = text(request.workspaceId, 'workspaceId', 240);
  if (!socialChannelVerificationStatuses.includes(request.verification.status))
    throw new SocialChannelBindingContractError('verification.status is invalid.');
  const verificationObservedAt = timestamp(
    request.verification.observedAt,
    'verification.observedAt'
  );
  assertTimestampOrder(
    binding.lastVerifiedAt,
    verificationObservedAt,
    'lastVerifiedAt',
    'verification.observedAt'
  );
  assertTimestampOrder(verificationObservedAt, assessedAt, 'verification.observedAt', 'assessedAt');

  let reason: SocialChannelBindingEligibilityReasonV1 = 'ELIGIBLE';
  if (binding.workspaceId !== workspaceId) reason = 'WORKSPACE_MISMATCH';
  else if (binding.status === 'STALE') reason = 'BINDING_STALE';
  else if (binding.status === 'REVOKED') reason = 'BINDING_REVOKED';
  else if (request.verification.status === 'UNKNOWN') reason = 'VERIFICATION_UNKNOWN';
  else if (request.verification.status === 'UNAVAILABLE') reason = 'VERIFICATION_UNAVAILABLE';
  return {
    eligible: reason === 'ELIGIBLE',
    reason,
    binding: {
      socialChannelBindingId: binding.socialChannelBindingId,
      version: binding.version
    },
    assessedAt,
    verificationStatus: request.verification.status,
    createsExecutionAuthority: false
  };
}
