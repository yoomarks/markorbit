import {
  channelFeatureDefinitionV1,
  channelFeatureKeysV1,
  type ChannelFeatureKeyV1
} from './channel-platform.js';
import type { ImplementationProfileId } from './capability-runtime.js';
import {
  parseExternalOAuthCredentialRefV1,
  type ExternalOAuthCredentialRefV1
} from './oauth-credential.js';

export type WorkspaceChannelIdentityBindingId = `workspace-channel-identity-binding_${string}`;

export const workspaceChannelIdentityBindingStatusesV1 = ['ACTIVE', 'STALE', 'REVOKED'] as const;
export type WorkspaceChannelIdentityBindingStatusV1 =
  (typeof workspaceChannelIdentityBindingStatusesV1)[number];

export const workspaceChannelIdentityConnectionSourceKindsV1 = [
  'PROVIDER_AUTH',
  'PROVIDER_API'
] as const;
export type WorkspaceChannelIdentityConnectionSourceKindV1 =
  (typeof workspaceChannelIdentityConnectionSourceKindsV1)[number];
export const workspaceChannelIdentityVerificationStatusesV1 = [
  'VERIFIED',
  'UNKNOWN',
  'UNAVAILABLE'
] as const;
export type WorkspaceChannelIdentityVerificationStatusV1 =
  (typeof workspaceChannelIdentityVerificationStatusesV1)[number];

export const workspaceChannelIdentityCurrentnessStatesV1 = [
  'CURRENT',
  'STALE',
  'REVOKED',
  'UNKNOWN',
  'UNAVAILABLE',
  'REAUTH_REQUIRED',
  'NOT_ENTITLED'
] as const;
export type WorkspaceChannelIdentityCurrentnessStateV1 =
  (typeof workspaceChannelIdentityCurrentnessStatesV1)[number];

export const workspaceChannelIdentityCurrentnessReasonsV1 = [
  'EXACT_BINDING_CURRENT',
  'WORKSPACE_MISMATCH',
  'FEATURE_MISMATCH',
  'BINDING_STALE',
  'BINDING_REVOKED',
  'IDENTITY_VERIFICATION_UNKNOWN',
  'IDENTITY_VERIFICATION_UNAVAILABLE',
  'CREDENTIAL_REAUTH_REQUIRED',
  'CREDENTIAL_EXPIRED',
  'CREDENTIAL_REVOKED',
  'CREDENTIAL_UNKNOWN',
  'CREDENTIAL_UNAVAILABLE',
  'ENTITLEMENT_NOT_ENABLED',
  'IMPLEMENTATION_STALE',
  'IMPLEMENTATION_UNAVAILABLE',
  'OWNER_DATA_UNKNOWN'
] as const;
export type WorkspaceChannelIdentityCurrentnessReasonV1 =
  (typeof workspaceChannelIdentityCurrentnessReasonsV1)[number];

export interface WorkspaceChannelExternalIdentityV1 {
  externalAccountRef: string;
  externalChannelRef?: string;
  displayLabel: string;
}

export interface WorkspaceChannelCapabilityRefV1 {
  capabilityId: string;
  capabilityVersion: string;
}

export interface WorkspaceChannelImplementationRefV1 {
  implementationProfileId: ImplementationProfileId;
  version: number;
}

export interface WorkspaceChannelIdentityConnectionV1 {
  sourceKind: WorkspaceChannelIdentityConnectionSourceKindV1;
  capabilityRef: Readonly<WorkspaceChannelCapabilityRefV1>;
  implementationRef: Readonly<WorkspaceChannelImplementationRefV1>;
  oauthCredentialRef?: Readonly<ExternalOAuthCredentialRefV1>;
  evidenceRefs: readonly string[];
}
export const noWorkspaceChannelIdentityAuthorityConsequencesV1 = Object.freeze({
  credentialStoredInBusinessContract: false,
  credentialAuthorityGranted: false,
  providerSelectionAuthorityGranted: false,
  implementationSelectionAuthorityGranted: false,
  contactBasisEstablished: false,
  protectedActionAuthorized: false,
  executionStarted: false,
  externalMessageSent: false,
  externalPublicationCreated: false,
  businessTruthCreated: false
});
export type WorkspaceChannelIdentityAuthorityConsequencesV1 =
  typeof noWorkspaceChannelIdentityAuthorityConsequencesV1;

export interface WorkspaceChannelIdentityBindingV1 {
  schemaVersion: 1;
  workspaceChannelIdentityBindingId: WorkspaceChannelIdentityBindingId;
  version: number;
  workspaceId: string;
  featureKey: ChannelFeatureKeyV1;
  identity: Readonly<WorkspaceChannelExternalIdentityV1>;
  status: WorkspaceChannelIdentityBindingStatusV1;
  connection: Readonly<WorkspaceChannelIdentityConnectionV1>;
  bindingFingerprintSha256: string;
  boundAt: string;
  lastVerifiedAt: string;
  staleAt?: string;
  revokedAt?: string;
  updatedAt: string;
  authority: Readonly<WorkspaceChannelIdentityAuthorityConsequencesV1>;
}
export interface WorkspaceChannelIdentityVerificationObservationV1 {
  schemaVersion: 1;
  binding: Readonly<{
    id: WorkspaceChannelIdentityBindingId;
    version: number;
    fingerprintSha256: string;
  }>;
  status: WorkspaceChannelIdentityVerificationStatusV1;
  observedAt: string;
  evidenceRefs: readonly string[];
}

export type WorkspaceChannelIdentityEligibilityReasonV1 =
  | 'ELIGIBLE'
  | 'WORKSPACE_MISMATCH'
  | 'FEATURE_MISMATCH'
  | 'BINDING_STALE'
  | 'BINDING_REVOKED'
  | 'VERIFICATION_REFERENCE_MISMATCH'
  | 'VERIFICATION_UNKNOWN'
  | 'VERIFICATION_UNAVAILABLE';

export interface WorkspaceChannelIdentityEligibilityV1 {
  eligible: boolean;
  reason: WorkspaceChannelIdentityEligibilityReasonV1;
  binding: Readonly<{
    id: WorkspaceChannelIdentityBindingId;
    version: number;
    fingerprintSha256: string;
  }>;
  verificationStatus: WorkspaceChannelIdentityVerificationStatusV1;
  assessedAt: string;
  createsExecutionAuthority: false;
}
export interface WorkspaceChannelIdentityCurrentnessV1 {
  schemaVersion: 1;
  workspaceId: string;
  featureKey: ChannelFeatureKeyV1;
  binding: Readonly<{
    id: WorkspaceChannelIdentityBindingId;
    version: number;
    fingerprintSha256: string;
  }>;
  state: WorkspaceChannelIdentityCurrentnessStateV1;
  reason: WorkspaceChannelIdentityCurrentnessReasonV1;
  assessedAt: string;
  createsExecutionAuthority: false;
}

export class WorkspaceChannelIdentityBindingContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceChannelIdentityBindingContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const SHA256 = /^[a-f0-9]{64}$/u;
const BINDING_ID = /^workspace-channel-identity-binding_[A-Za-z0-9._:-]+$/u;
const IMPLEMENTATION_ID = /^implementation-profile_[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const forbiddenCredentialKeys = new Set([
  'password',
  'secret',
  'apisecret',
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
  'clientsecret',
  'browserstorage',
  'localstorage',
  'rawproviderresponse'
]);

function normalizedKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
}

function rejectCredentialMaterial(value: unknown, field = 'workspaceChannelIdentityBinding'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectCredentialMaterial(entry, `${field}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    const normalized = normalizedKey(key);
    if (forbiddenCredentialKeys.has(normalized) && normalized !== 'oauthcredentialref')
      throw new WorkspaceChannelIdentityBindingContractError(
        `${field}.${key} is forbidden credential/session material.`
      );
    rejectCredentialMaterial(nested, `${field}.${key}`);
  }
}

function object(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WorkspaceChannelIdentityBindingContractError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unsupported.length)
    throw new WorkspaceChannelIdentityBindingContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new WorkspaceChannelIdentityBindingContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new WorkspaceChannelIdentityBindingContractError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  return cleaned;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new WorkspaceChannelIdentityBindingContractError(
      `${field} must be a positive safe integer.`
    );
  return Number(value);
}

function timestamp(value: unknown, field: string): string {
  const cleaned = text(value, field, 80);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime()))
    throw new WorkspaceChannelIdentityBindingContractError(`${field} must be a timestamp.`);
  return parsed.toISOString();
}

function sha256(value: unknown, field: string): string {
  const cleaned = text(value, field, 64).toLowerCase();
  if (!SHA256.test(cleaned))
    throw new WorkspaceChannelIdentityBindingContractError(
      `${field} must be lowercase SHA-256 hex.`
    );
  return cleaned;
}

function strings(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100)
    throw new WorkspaceChannelIdentityBindingContractError(
      `${field} must be a bounded non-empty array.`
    );
  const result = value.map((entry, index) => text(entry, `${field}[${index}]`, 500));
  if (new Set(result).size !== result.length)
    throw new WorkspaceChannelIdentityBindingContractError(`${field} must not contain duplicates.`);
  return result;
}

function parseFeature(value: unknown): ChannelFeatureKeyV1 {
  if (typeof value !== 'string' || !(channelFeatureKeysV1 as readonly string[]).includes(value))
    throw new WorkspaceChannelIdentityBindingContractError('featureKey is invalid.');
  const featureKey = value as ChannelFeatureKeyV1;
  if (
    channelFeatureDefinitionV1(featureKey).sendingIdentityOwnership !== 'WORKSPACE_OWNED_IDENTITY'
  )
    throw new WorkspaceChannelIdentityBindingContractError(
      'featureKey must require a Workspace-owned identity.'
    );
  return featureKey;
}

function parseIdentity(value: unknown): WorkspaceChannelExternalIdentityV1 {
  const item = object(value, 'identity');
  exactKeys(item, ['externalAccountRef', 'externalChannelRef', 'displayLabel'], 'identity');
  const externalChannelRef =
    item.externalChannelRef === undefined
      ? undefined
      : text(item.externalChannelRef, 'identity.externalChannelRef', 500);
  return {
    externalAccountRef: text(item.externalAccountRef, 'identity.externalAccountRef', 500),
    ...(externalChannelRef ? { externalChannelRef } : {}),
    displayLabel: text(item.displayLabel, 'identity.displayLabel', 300)
  };
}

function parseCapabilityRef(value: unknown): WorkspaceChannelCapabilityRefV1 {
  const item = object(value, 'connection.capabilityRef');
  exactKeys(item, ['capabilityId', 'capabilityVersion'], 'connection.capabilityRef');
  return {
    capabilityId: text(item.capabilityId, 'connection.capabilityRef.capabilityId', 160),
    capabilityVersion: text(
      item.capabilityVersion,
      'connection.capabilityRef.capabilityVersion',
      120
    )
  };
}

function parseImplementationRef(value: unknown): WorkspaceChannelImplementationRefV1 {
  const item = object(value, 'connection.implementationRef');
  exactKeys(item, ['implementationProfileId', 'version'], 'connection.implementationRef');
  const implementationProfileId = text(
    item.implementationProfileId,
    'connection.implementationRef.implementationProfileId',
    300
  );
  if (!IMPLEMENTATION_ID.test(implementationProfileId))
    throw new WorkspaceChannelIdentityBindingContractError(
      'connection.implementationRef.implementationProfileId is invalid.'
    );
  return {
    implementationProfileId: implementationProfileId as ImplementationProfileId,
    version: positiveInteger(item.version, 'connection.implementationRef.version')
  };
}

function parseConnection(value: unknown): WorkspaceChannelIdentityConnectionV1 {
  const item = object(value, 'connection');
  exactKeys(
    item,
    ['sourceKind', 'capabilityRef', 'implementationRef', 'oauthCredentialRef', 'evidenceRefs'],
    'connection'
  );
  if (
    !workspaceChannelIdentityConnectionSourceKindsV1.includes(
      item.sourceKind as WorkspaceChannelIdentityConnectionSourceKindV1
    )
  )
    throw new WorkspaceChannelIdentityBindingContractError('connection.sourceKind is invalid.');
  const oauthCredentialRef =
    item.oauthCredentialRef === undefined
      ? undefined
      : parseExternalOAuthCredentialRefV1(item.oauthCredentialRef);
  return {
    sourceKind: item.sourceKind as WorkspaceChannelIdentityConnectionSourceKindV1,
    capabilityRef: parseCapabilityRef(item.capabilityRef),
    implementationRef: parseImplementationRef(item.implementationRef),
    ...(oauthCredentialRef ? { oauthCredentialRef } : {}),
    evidenceRefs: strings(item.evidenceRefs, 'connection.evidenceRefs')
  };
}

function parseAuthority(value: unknown): WorkspaceChannelIdentityAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  const keys = Object.keys(noWorkspaceChannelIdentityAuthorityConsequencesV1);
  exactKeys(item, keys, 'authority');
  for (const key of keys) {
    if (item[key] !== false)
      throw new WorkspaceChannelIdentityBindingContractError(`authority.${key} must be false.`);
  }
  return noWorkspaceChannelIdentityAuthorityConsequencesV1;
}

function assertOrder(
  earlier: string,
  later: string,
  earlierField: string,
  laterField: string
): void {
  if (Date.parse(earlier) > Date.parse(later))
    throw new WorkspaceChannelIdentityBindingContractError(
      `${earlierField} cannot be after ${laterField}.`
    );
}

export function workspaceChannelIdentityBindingCanonicalPayloadV1(
  binding: Readonly<WorkspaceChannelIdentityBindingV1>
) {
  return {
    schemaVersion: 1 as const,
    workspaceChannelIdentityBindingId: binding.workspaceChannelIdentityBindingId,
    version: binding.version,
    workspaceId: binding.workspaceId,
    featureKey: binding.featureKey,
    identity: binding.identity,
    status: binding.status,
    connection: binding.connection,
    boundAt: binding.boundAt,
    lastVerifiedAt: binding.lastVerifiedAt,
    ...(binding.staleAt ? { staleAt: binding.staleAt } : {}),
    ...(binding.revokedAt ? { revokedAt: binding.revokedAt } : {}),
    updatedAt: binding.updatedAt,
    authority: binding.authority
  };
}

export function parseWorkspaceChannelIdentityBindingV1(
  value: unknown
): WorkspaceChannelIdentityBindingV1 {
  rejectCredentialMaterial(value);
  const item = object(value, 'workspaceChannelIdentityBinding');
  exactKeys(
    item,
    [
      'schemaVersion',
      'workspaceChannelIdentityBindingId',
      'version',
      'workspaceId',
      'featureKey',
      'identity',
      'status',
      'connection',
      'bindingFingerprintSha256',
      'boundAt',
      'lastVerifiedAt',
      'staleAt',
      'revokedAt',
      'updatedAt',
      'authority'
    ],
    'workspaceChannelIdentityBinding'
  );
  if (item.schemaVersion !== 1)
    throw new WorkspaceChannelIdentityBindingContractError('schemaVersion must be 1.');
  const bindingId = text(
    item.workspaceChannelIdentityBindingId,
    'workspaceChannelIdentityBindingId',
    300
  );
  if (!BINDING_ID.test(bindingId))
    throw new WorkspaceChannelIdentityBindingContractError(
      'workspaceChannelIdentityBindingId is invalid.'
    );
  if (
    !workspaceChannelIdentityBindingStatusesV1.includes(
      item.status as WorkspaceChannelIdentityBindingStatusV1
    )
  )
    throw new WorkspaceChannelIdentityBindingContractError('status is invalid.');

  const status = item.status as WorkspaceChannelIdentityBindingStatusV1;
  const boundAt = timestamp(item.boundAt, 'boundAt');
  const lastVerifiedAt = timestamp(item.lastVerifiedAt, 'lastVerifiedAt');
  const staleAt = item.staleAt === undefined ? undefined : timestamp(item.staleAt, 'staleAt');
  const revokedAt =
    item.revokedAt === undefined ? undefined : timestamp(item.revokedAt, 'revokedAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');
  assertOrder(boundAt, lastVerifiedAt, 'boundAt', 'lastVerifiedAt');
  assertOrder(lastVerifiedAt, updatedAt, 'lastVerifiedAt', 'updatedAt');
  if (status === 'ACTIVE' && (staleAt || revokedAt))
    throw new WorkspaceChannelIdentityBindingContractError(
      'ACTIVE binding cannot carry staleAt or revokedAt.'
    );
  if (status === 'STALE') {
    if (!staleAt)
      throw new WorkspaceChannelIdentityBindingContractError('STALE binding requires staleAt.');
    if (revokedAt)
      throw new WorkspaceChannelIdentityBindingContractError(
        'STALE binding cannot carry revokedAt.'
      );
    assertOrder(lastVerifiedAt, staleAt, 'lastVerifiedAt', 'staleAt');
    assertOrder(staleAt, updatedAt, 'staleAt', 'updatedAt');
  }
  if (status === 'REVOKED') {
    if (!revokedAt)
      throw new WorkspaceChannelIdentityBindingContractError('REVOKED binding requires revokedAt.');
    assertOrder(lastVerifiedAt, revokedAt, 'lastVerifiedAt', 'revokedAt');
    assertOrder(revokedAt, updatedAt, 'revokedAt', 'updatedAt');
    if (staleAt) {
      assertOrder(lastVerifiedAt, staleAt, 'lastVerifiedAt', 'staleAt');
      assertOrder(staleAt, revokedAt, 'staleAt', 'revokedAt');
    }
  }

  return {
    schemaVersion: 1,
    workspaceChannelIdentityBindingId: bindingId as WorkspaceChannelIdentityBindingId,
    version: positiveInteger(item.version, 'version'),
    workspaceId: text(item.workspaceId, 'workspaceId', 240).toLowerCase(),
    featureKey: parseFeature(item.featureKey),
    identity: parseIdentity(item.identity),
    status,
    connection: parseConnection(item.connection),
    bindingFingerprintSha256: sha256(item.bindingFingerprintSha256, 'bindingFingerprintSha256'),
    boundAt,
    lastVerifiedAt,
    ...(staleAt ? { staleAt } : {}),
    ...(revokedAt ? { revokedAt } : {}),
    updatedAt,
    authority: parseAuthority(item.authority)
  };
}

export function parseWorkspaceChannelIdentityVerificationObservationV1(
  value: unknown
): WorkspaceChannelIdentityVerificationObservationV1 {
  rejectCredentialMaterial(value, 'workspaceChannelIdentityVerification');
  const item = object(value, 'workspaceChannelIdentityVerification');
  exactKeys(
    item,
    ['schemaVersion', 'binding', 'status', 'observedAt', 'evidenceRefs'],
    'workspaceChannelIdentityVerification'
  );
  if (item.schemaVersion !== 1)
    throw new WorkspaceChannelIdentityBindingContractError('verification.schemaVersion must be 1.');
  const binding = object(item.binding, 'verification.binding');
  exactKeys(binding, ['id', 'version', 'fingerprintSha256'], 'verification.binding');
  const id = text(binding.id, 'verification.binding.id', 300);
  if (!BINDING_ID.test(id))
    throw new WorkspaceChannelIdentityBindingContractError('verification.binding.id is invalid.');
  if (
    !workspaceChannelIdentityVerificationStatusesV1.includes(
      item.status as WorkspaceChannelIdentityVerificationStatusV1
    )
  )
    throw new WorkspaceChannelIdentityBindingContractError('verification.status is invalid.');
  return {
    schemaVersion: 1,
    binding: {
      id: id as WorkspaceChannelIdentityBindingId,
      version: positiveInteger(binding.version, 'verification.binding.version'),
      fingerprintSha256: sha256(binding.fingerprintSha256, 'verification.binding.fingerprintSha256')
    },
    status: item.status as WorkspaceChannelIdentityVerificationStatusV1,
    observedAt: timestamp(item.observedAt, 'verification.observedAt'),
    evidenceRefs: strings(item.evidenceRefs, 'verification.evidenceRefs')
  };
}

export function assessWorkspaceChannelIdentityBindingEligibilityV1(
  bindingValue: Readonly<WorkspaceChannelIdentityBindingV1>,
  request: Readonly<{
    workspaceId: string;
    featureKey: ChannelFeatureKeyV1;
    assessedAt: string;
    verification: Readonly<WorkspaceChannelIdentityVerificationObservationV1>;
  }>
): WorkspaceChannelIdentityEligibilityV1 {
  const binding = parseWorkspaceChannelIdentityBindingV1(bindingValue);
  const verification = parseWorkspaceChannelIdentityVerificationObservationV1(request.verification);
  const workspaceId = text(request.workspaceId, 'request.workspaceId', 240).toLowerCase();
  const featureKey = parseFeature(request.featureKey);
  const assessedAt = timestamp(request.assessedAt, 'request.assessedAt');
  assertOrder(binding.updatedAt, assessedAt, 'updatedAt', 'assessedAt');

  let reason: WorkspaceChannelIdentityEligibilityReasonV1 = 'ELIGIBLE';
  if (binding.workspaceId !== workspaceId) reason = 'WORKSPACE_MISMATCH';
  else if (binding.featureKey !== featureKey) reason = 'FEATURE_MISMATCH';
  else if (binding.status === 'STALE') reason = 'BINDING_STALE';
  else if (binding.status === 'REVOKED') reason = 'BINDING_REVOKED';
  else if (
    verification.binding.id !== binding.workspaceChannelIdentityBindingId ||
    verification.binding.version !== binding.version ||
    verification.binding.fingerprintSha256 !== binding.bindingFingerprintSha256
  )
    reason = 'VERIFICATION_REFERENCE_MISMATCH';
  else {
    assertOrder(
      binding.lastVerifiedAt,
      verification.observedAt,
      'lastVerifiedAt',
      'verification.observedAt'
    );
    assertOrder(verification.observedAt, assessedAt, 'verification.observedAt', 'assessedAt');
    if (verification.status === 'UNKNOWN') reason = 'VERIFICATION_UNKNOWN';
    else if (verification.status === 'UNAVAILABLE') reason = 'VERIFICATION_UNAVAILABLE';
  }

  return {
    eligible: reason === 'ELIGIBLE',
    reason,
    binding: {
      id: binding.workspaceChannelIdentityBindingId,
      version: binding.version,
      fingerprintSha256: binding.bindingFingerprintSha256
    },
    verificationStatus: verification.status,
    assessedAt,
    createsExecutionAuthority: false
  };
}

export function parseWorkspaceChannelIdentityCurrentnessV1(
  value: unknown
): WorkspaceChannelIdentityCurrentnessV1 {
  const item = object(value, 'workspaceChannelIdentityCurrentness');
  exactKeys(
    item,
    [
      'schemaVersion',
      'workspaceId',
      'featureKey',
      'binding',
      'state',
      'reason',
      'assessedAt',
      'createsExecutionAuthority'
    ],
    'workspaceChannelIdentityCurrentness'
  );
  if (item.schemaVersion !== 1)
    throw new WorkspaceChannelIdentityBindingContractError('currentness.schemaVersion must be 1.');
  const binding = object(item.binding, 'currentness.binding');
  exactKeys(binding, ['id', 'version', 'fingerprintSha256'], 'currentness.binding');
  const id = text(binding.id, 'currentness.binding.id', 300);
  if (!BINDING_ID.test(id))
    throw new WorkspaceChannelIdentityBindingContractError('currentness.binding.id is invalid.');
  if (
    !workspaceChannelIdentityCurrentnessStatesV1.includes(
      item.state as WorkspaceChannelIdentityCurrentnessStateV1
    )
  )
    throw new WorkspaceChannelIdentityBindingContractError('currentness.state is invalid.');
  if (
    !workspaceChannelIdentityCurrentnessReasonsV1.includes(
      item.reason as WorkspaceChannelIdentityCurrentnessReasonV1
    )
  )
    throw new WorkspaceChannelIdentityBindingContractError('currentness.reason is invalid.');
  if (item.createsExecutionAuthority !== false)
    throw new WorkspaceChannelIdentityBindingContractError(
      'currentness.createsExecutionAuthority must be false.'
    );
  return {
    schemaVersion: 1,
    workspaceId: text(item.workspaceId, 'currentness.workspaceId', 240).toLowerCase(),
    featureKey: parseFeature(item.featureKey),
    binding: {
      id: id as WorkspaceChannelIdentityBindingId,
      version: positiveInteger(binding.version, 'currentness.binding.version'),
      fingerprintSha256: sha256(binding.fingerprintSha256, 'currentness.binding.fingerprintSha256')
    },
    state: item.state as WorkspaceChannelIdentityCurrentnessStateV1,
    reason: item.reason as WorkspaceChannelIdentityCurrentnessReasonV1,
    assessedAt: timestamp(item.assessedAt, 'currentness.assessedAt'),
    createsExecutionAuthority: false
  };
}
