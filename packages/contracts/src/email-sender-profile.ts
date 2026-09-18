export type WorkspaceEmailSenderProfileId = `email-sender-profile_${string}`;

export const workspaceEmailSenderProfileStatusesV1 = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED'
] as const;
export type WorkspaceEmailSenderProfileStatusV1 =
  (typeof workspaceEmailSenderProfileStatusesV1)[number];

export const workspaceEmailSenderVerificationStatusesV1 = [
  'PENDING',
  'VERIFIED',
  'FAILED',
  'UNKNOWN',
  'UNAVAILABLE'
] as const;
export type WorkspaceEmailSenderVerificationStatusV1 =
  (typeof workspaceEmailSenderVerificationStatusesV1)[number];

export const workspaceEmailReplyToModesV1 = [
  'SAME_AS_FROM',
  'EXPLICIT_ADDRESS',
  'MANAGED_COMMUNICATION'
] as const;
export type WorkspaceEmailReplyToModeV1 = (typeof workspaceEmailReplyToModesV1)[number];

export interface WorkspaceEmailSenderVerificationV1 {
  status: WorkspaceEmailSenderVerificationStatusV1;
  evidenceRefs: readonly string[];
  observedAt: string;
}

export interface WorkspaceEmailReplyToV1 {
  mode: WorkspaceEmailReplyToModeV1;
  address?: string;
  accountRef?: string;
}

export const noWorkspaceEmailSenderProfileAuthorityConsequencesV1 = Object.freeze({
  credentialAuthorityGranted: false,
  providerSelectionAuthorityGranted: false,
  externalSendAuthorized: false,
  protectedActionAuthorized: false,
  customerTruthCreated: false,
  matterTruthCreated: false,
  legalIdentityVerified: false,
  canonicalWorkspaceBrandCreated: false
});
export type WorkspaceEmailSenderProfileAuthorityConsequencesV1 =
  typeof noWorkspaceEmailSenderProfileAuthorityConsequencesV1;

export interface WorkspaceEmailSenderProfileV1 {
  schemaVersion: 1;
  senderProfileId: WorkspaceEmailSenderProfileId;
  workspaceId: string;
  version: number;
  status: WorkspaceEmailSenderProfileStatusV1;
  fromDomain: string;
  fromAddress: string;
  displayName: string;
  replyTo: Readonly<WorkspaceEmailReplyToV1>;
  verification: Readonly<WorkspaceEmailSenderVerificationV1>;
  providerRoutingPartitionRef: string;
  ratePolicyRef: string;
  reputationIsolationKey: string;
  createdAt: string;
  updatedAt: string;
  authority: Readonly<WorkspaceEmailSenderProfileAuthorityConsequencesV1>;
}

export const workspaceEmailSenderCurrentnessStatesV1 = [
  'CURRENT_ELIGIBLE',
  'PENDING_VERIFICATION',
  'SUSPENDED',
  'REVOKED',
  'STALE',
  'UNKNOWN',
  'UNAVAILABLE'
] as const;
export type WorkspaceEmailSenderCurrentnessStateV1 =
  (typeof workspaceEmailSenderCurrentnessStatesV1)[number];

export interface WorkspaceEmailSenderCurrentnessV1 {
  schemaVersion: 1;
  workspaceId: string;
  senderProfileId: WorkspaceEmailSenderProfileId;
  version: number;
  state: WorkspaceEmailSenderCurrentnessStateV1;
  evaluatedAt: string;
  verificationObservedAt: string;
  createsSendAuthority: false;
}

export class WorkspaceEmailSenderProfileContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceEmailSenderProfileContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PROFILE_ID = /^email-sender-profile_[A-Za-z0-9_-]+$/u;
const DOMAIN = /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const forbiddenSensitiveKeys = new Set([
  'password',
  'secret',
  'apisecret',
  'apikey',
  'clientsecret',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'bearer',
  'credential',
  'credentials',
  'token',
  'smtpsecret',
  'smtppassword',
  'privatekey',
  'rawproviderresponse'
]);

function normalizedKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
}

function rejectSensitiveMaterial(value: unknown, field = 'emailSenderProfile'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectSensitiveMaterial(entry, `${field}[${index}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (forbiddenSensitiveKeys.has(normalizedKey(key)))
      throw new WorkspaceEmailSenderProfileContractError(
        `${field}.${key} is forbidden secret material.`
      );
    rejectSensitiveMaterial(nested, `${field}.${key}`);
  }
}

function object(value: unknown, field: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new WorkspaceEmailSenderProfileContractError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unsupported.length)
    throw new WorkspaceEmailSenderProfileContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new WorkspaceEmailSenderProfileContractError(`${field} must be a string.`);
  const result = value.trim();
  if (!result || result.length > maximum)
    throw new WorkspaceEmailSenderProfileContractError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  return result;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new WorkspaceEmailSenderProfileContractError(
      `${field} must be a positive safe integer.`
    );
  return value as number;
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 80);
  const parsed = new Date(result);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== result)
    throw new WorkspaceEmailSenderProfileContractError(
      `${field} must be a canonical ISO timestamp.`
    );
  return result;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T))
    throw new WorkspaceEmailSenderProfileContractError(`${field} is invalid.`);
  return value as T;
}

function email(value: unknown, field: string): string {
  const result = text(value, field, 320).toLowerCase();
  if (!EMAIL.test(result))
    throw new WorkspaceEmailSenderProfileContractError(`${field} must be an email address.`);
  return result;
}

function domain(value: unknown, field: string): string {
  const result = text(value, field, 253).toLowerCase();
  if (!DOMAIN.test(result))
    throw new WorkspaceEmailSenderProfileContractError(`${field} must be a DNS domain.`);
  return result;
}

function parseAuthority(value: unknown): WorkspaceEmailSenderProfileAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  const keys = Object.keys(noWorkspaceEmailSenderProfileAuthorityConsequencesV1);
  exactKeys(item, keys, 'authority');
  for (const key of keys) {
    if (item[key] !== false)
      throw new WorkspaceEmailSenderProfileContractError(`authority.${key} must be false.`);
  }
  return noWorkspaceEmailSenderProfileAuthorityConsequencesV1;
}

function parseVerification(value: unknown): WorkspaceEmailSenderVerificationV1 {
  const item = object(value, 'verification');
  exactKeys(item, ['status', 'evidenceRefs', 'observedAt'], 'verification');
  if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length > 20)
    throw new WorkspaceEmailSenderProfileContractError(
      'verification.evidenceRefs must contain at most 20 items.'
    );
  const evidenceRefs = item.evidenceRefs.map((entry, index) =>
    text(entry, `verification.evidenceRefs[${index}]`, 1000)
  );
  if (new Set(evidenceRefs).size !== evidenceRefs.length)
    throw new WorkspaceEmailSenderProfileContractError(
      'verification.evidenceRefs must not contain duplicates.'
    );
  return {
    status: oneOf(
      item.status,
      workspaceEmailSenderVerificationStatusesV1,
      'verification.status'
    ),
    evidenceRefs,
    observedAt: timestamp(item.observedAt, 'verification.observedAt')
  };
}

function parseReplyTo(value: unknown): WorkspaceEmailReplyToV1 {
  const item = object(value, 'replyTo');
  exactKeys(item, ['mode', 'address', 'accountRef'], 'replyTo');
  const mode = oneOf(item.mode, workspaceEmailReplyToModesV1, 'replyTo.mode');
  if (mode === 'SAME_AS_FROM') {
    if (item.address !== undefined || item.accountRef !== undefined)
      throw new WorkspaceEmailSenderProfileContractError(
        'SAME_AS_FROM replyTo cannot carry address/accountRef.'
      );
    return { mode };
  }
  if (mode === 'EXPLICIT_ADDRESS') {
    if (item.accountRef !== undefined)
      throw new WorkspaceEmailSenderProfileContractError(
        'EXPLICIT_ADDRESS replyTo cannot carry accountRef.'
      );
    return { mode, address: email(item.address, 'replyTo.address') };
  }
  if (item.address !== undefined)
    throw new WorkspaceEmailSenderProfileContractError(
      'MANAGED_COMMUNICATION replyTo cannot carry address.'
    );
  return {
    mode,
    accountRef: text(item.accountRef, 'replyTo.accountRef', 500)
  };
}

export function parseWorkspaceEmailSenderProfileV1(
  value: unknown
): WorkspaceEmailSenderProfileV1 {
  rejectSensitiveMaterial(value);
  const item = object(value, 'emailSenderProfile');
  exactKeys(
    item,
    [
      'schemaVersion',
      'senderProfileId',
      'workspaceId',
      'version',
      'status',
      'fromDomain',
      'fromAddress',
      'displayName',
      'replyTo',
      'verification',
      'providerRoutingPartitionRef',
      'ratePolicyRef',
      'reputationIsolationKey',
      'createdAt',
      'updatedAt',
      'authority'
    ],
    'emailSenderProfile'
  );
  if (item.schemaVersion !== 1)
    throw new WorkspaceEmailSenderProfileContractError('schemaVersion must be 1.');
  const senderProfileId = text(item.senderProfileId, 'senderProfileId', 240);
  if (!PROFILE_ID.test(senderProfileId))
    throw new WorkspaceEmailSenderProfileContractError('senderProfileId is invalid.');
  const workspaceId = text(item.workspaceId, 'workspaceId', 80).toLowerCase();
  if (!UUID.test(workspaceId))
    throw new WorkspaceEmailSenderProfileContractError('workspaceId must be a UUID.');
  const fromDomain = domain(item.fromDomain, 'fromDomain');
  const fromAddress = email(item.fromAddress, 'fromAddress');
  if (fromAddress.slice(fromAddress.lastIndexOf('@') + 1) !== fromDomain)
    throw new WorkspaceEmailSenderProfileContractError(
      'fromAddress domain must equal fromDomain.'
    );
  const verification = parseVerification(item.verification);
  const status = oneOf(item.status, workspaceEmailSenderProfileStatusesV1, 'status');
  if (status === 'ACTIVE' && verification.status !== 'VERIFIED')
    throw new WorkspaceEmailSenderProfileContractError(
      'ACTIVE sender profile requires VERIFIED evidence.'
    );
  const createdAt = timestamp(item.createdAt, 'createdAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');
  if (Date.parse(updatedAt) < Date.parse(createdAt))
    throw new WorkspaceEmailSenderProfileContractError(
      'updatedAt cannot precede createdAt.'
    );
  if (Date.parse(verification.observedAt) > Date.parse(updatedAt))
    throw new WorkspaceEmailSenderProfileContractError(
      'verification.observedAt cannot be after updatedAt.'
    );
  return {
    schemaVersion: 1,
    senderProfileId: senderProfileId as WorkspaceEmailSenderProfileId,
    workspaceId,
    version: positiveInteger(item.version, 'version'),
    status,
    fromDomain,
    fromAddress,
    displayName: text(item.displayName, 'displayName', 300),
    replyTo: parseReplyTo(item.replyTo),
    verification,
    providerRoutingPartitionRef: text(
      item.providerRoutingPartitionRef,
      'providerRoutingPartitionRef',
      500
    ),
    ratePolicyRef: text(item.ratePolicyRef, 'ratePolicyRef', 500),
    reputationIsolationKey: text(item.reputationIsolationKey, 'reputationIsolationKey', 500),
    createdAt,
    updatedAt,
    authority: parseAuthority(item.authority)
  };
}

export function evaluateWorkspaceEmailSenderCurrentnessV1(
  profile: Readonly<WorkspaceEmailSenderProfileV1>,
  evaluatedAt: string,
  verificationMaximumAgeMs: number
): WorkspaceEmailSenderCurrentnessV1 {
  const parsed = parseWorkspaceEmailSenderProfileV1(profile);
  const now = timestamp(evaluatedAt, 'evaluatedAt');
  if (!Number.isSafeInteger(verificationMaximumAgeMs) || verificationMaximumAgeMs < 1)
    throw new WorkspaceEmailSenderProfileContractError(
      'verificationMaximumAgeMs must be a positive safe integer.'
    );

  let state: WorkspaceEmailSenderCurrentnessStateV1;
  if (parsed.status === 'REVOKED') state = 'REVOKED';
  else if (parsed.status === 'SUSPENDED') state = 'SUSPENDED';
  else if (parsed.verification.status === 'UNKNOWN') state = 'UNKNOWN';
  else if (parsed.verification.status === 'UNAVAILABLE') state = 'UNAVAILABLE';
  else if (parsed.status === 'PENDING_VERIFICATION') state = 'PENDING_VERIFICATION';
  else if (parsed.verification.status !== 'VERIFIED') state = 'PENDING_VERIFICATION';
  else if (
    Date.parse(now) - Date.parse(parsed.verification.observedAt) >
    verificationMaximumAgeMs
  )
    state = 'STALE';
  else state = 'CURRENT_ELIGIBLE';

  return {
    schemaVersion: 1,
    workspaceId: parsed.workspaceId,
    senderProfileId: parsed.senderProfileId,
    version: parsed.version,
    state,
    evaluatedAt: now,
    verificationObservedAt: parsed.verification.observedAt,
    createsSendAuthority: false
  };
}
