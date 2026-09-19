import type { ImplementationProfileId } from './capability-runtime.js';
import type {
  EmailCampaignIdV1
} from './email-campaign.js';
import type {
  WorkspaceEmailSenderProfileId
} from './email-sender-profile.js';
import type {
  ProtectedExternalActionReleaseId
} from './protected-external-action.js';

export type EmailDeliveryAttemptId = `email-delivery-attempt_${string}`;
export type EmailDeliveryObservationId = `email-delivery-observation_${string}`;

export const emailDeliveryAttemptStatusesV1 = [
  'PLANNED',
  'SUBMITTING',
  'ACCEPTED',
  'UNKNOWN',
  'FAILED',
  'RECONCILING',
  'RECONCILED'
] as const;
export type EmailDeliveryAttemptStatusV1 =
  (typeof emailDeliveryAttemptStatusesV1)[number];

export const emailDeliveryObservationKindsV1 = [
  'SUBMITTED',
  'ACCEPTED',
  'DELIVERED',
  'DEFERRED',
  'HARD_BOUNCED',
  'SOFT_BOUNCED',
  'COMPLAINED',
  'UNSUBSCRIBED',
  'FAILED',
  'UNKNOWN'
] as const;
export type EmailDeliveryObservationKindV1 =
  (typeof emailDeliveryObservationKindsV1)[number];

export const emailDeliveryEvidenceKindsV1 = [
  'ADAPTER_TRANSPORT',
  'PROVIDER_EVENT',
  'PROVIDER_RECONCILIATION'
] as const;
export type EmailDeliveryEvidenceKindV1 =
  (typeof emailDeliveryEvidenceKindsV1)[number];

export const noEmailDeliveryAuthorityConsequencesV1 = Object.freeze({
  externalSendAuthorized: false,
  providerSelectionAuthorityGranted: false,
  credentialAuthorityGranted: false,
  deliveredBusinessTruthCreated: false,
  customerTruthCreated: false,
  matterTruthCreated: false,
  legalConsentVerifiedByMarkOrbit: false
});
export type EmailDeliveryAuthorityConsequencesV1 =
  typeof noEmailDeliveryAuthorityConsequencesV1;

export interface EmailDeliveryAttemptV1 {
  schemaVersion: 1;
  deliveryAttemptId: EmailDeliveryAttemptId;
  version: 1;
  workspaceId: string;
  executionRelease: Readonly<{
    releaseId: ProtectedExternalActionReleaseId;
    version: 1;
    effectFingerprintSha256: string;
  }>;
  campaign: Readonly<{
    campaignId: EmailCampaignIdV1;
    version: number;
  }>;
  senderProfile: Readonly<{
    senderProfileId: WorkspaceEmailSenderProfileId;
    version: number;
    fingerprintSha256: string;
  }>;
  implementation: Readonly<{
    implementationProfileId: ImplementationProfileId;
    version: number;
  }>;
  shardIndex: number;
  recipientCount: number;
  recipientManifestFingerprintSha256: string;
  deliveryPlanFingerprintSha256: string;
  correlationId: string;
  attemptNumber: number;
  status: EmailDeliveryAttemptStatusV1;
  providerSubmissionRef?: string;
  createdAt: string;
  updatedAt: string;
  authority: Readonly<EmailDeliveryAuthorityConsequencesV1>;
}

export interface EmailDeliveryObservationV1 {
  schemaVersion: 1;
  observationId: EmailDeliveryObservationId;
  version: 1;
  workspaceId: string;
  deliveryAttempt: Readonly<{
    deliveryAttemptId: EmailDeliveryAttemptId;
    version: 1;
  }>;
  eventIdentity: string;
  event: EmailDeliveryObservationKindV1;
  evidenceKind: EmailDeliveryEvidenceKindV1;
  providerMessageRef?: string;
  endpointFingerprintSha256?: string;
  authenticatedEvidence: true;
  reasonCode: string;
  evidenceRefs: readonly string[];
  eventAt: string;
  observedAt: string;
  authority: Readonly<EmailDeliveryAuthorityConsequencesV1>;
}

export class EmailDeliveryContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;

const forbiddenKeys = new Set([
  'rawemail',
  'recipientemail',
  'emailaddress',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'secret',
  'credential',
  'credentials',
  'password',
  'body',
  'html',
  'htmlcontent',
  'textcontent',
  'rawproviderresponse',
  'providerpayload'
]);

function normalizedKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
}

function rejectForbidden(value: unknown, field = 'emailDelivery'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectForbidden(entry, `${field}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (forbiddenKeys.has(normalizedKey(key)))
      throw new EmailDeliveryContractError(`${field}.${key} is forbidden material.`);
    rejectForbidden(nested, `${field}.${key}`);
  }
}

function object(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new EmailDeliveryContractError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  const extras = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (extras.length)
    throw new EmailDeliveryContractError(
      `${field} contains unsupported fields: ${extras.join(', ')}.`
    );
}

function text(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string')
    throw new EmailDeliveryContractError(`${field} must be a string.`);
  const result = value.trim();
  if (!result || result.length > max)
    throw new EmailDeliveryContractError(`${field} must contain 1 to ${max} characters.`);
  return result;
}

function integer(value: unknown, field: string, min = 1): number {
  if (!Number.isSafeInteger(value) || (value as number) < min)
    throw new EmailDeliveryContractError(`${field} must be an integer >= ${min}.`);
  return value as number;
}

function sha(value: unknown, field: string): string {
  const result = text(value, field, 64);
  if (!SHA256.test(result))
    throw new EmailDeliveryContractError(`${field} must be lowercase SHA-256 hex.`);
  return result;
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 80);
  const parsed = new Date(result);
  if (Number.isNaN(parsed.getTime()))
    throw new EmailDeliveryContractError(`${field} must be a timestamp.`);
  return parsed.toISOString();
}

function prefixed<T extends string>(value: unknown, field: string, prefix: string): T {
  const result = text(value, field, 300);
  if (!result.startsWith(prefix))
    throw new EmailDeliveryContractError(`${field} is invalid.`);
  return result as T;
}

function parseAuthority(value: unknown): EmailDeliveryAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  const keys = Object.keys(noEmailDeliveryAuthorityConsequencesV1);
  exactKeys(item, keys, 'authority');
  for (const key of keys) {
    if (item[key] !== false)
      throw new EmailDeliveryContractError(`authority.${key} must be false.`);
  }
  return noEmailDeliveryAuthorityConsequencesV1;
}

export function parseEmailDeliveryAttemptV1(value: unknown): EmailDeliveryAttemptV1 {
  rejectForbidden(value);
  const item = object(value, 'emailDeliveryAttempt');
  exactKeys(
    item,
    [
      'schemaVersion',
      'deliveryAttemptId',
      'version',
      'workspaceId',
      'executionRelease',
      'campaign',
      'senderProfile',
      'implementation',
      'shardIndex',
      'recipientCount',
      'recipientManifestFingerprintSha256',
      'deliveryPlanFingerprintSha256',
      'correlationId',
      'attemptNumber',
      'status',
      'providerSubmissionRef',
      'createdAt',
      'updatedAt',
      'authority'
    ],
    'emailDeliveryAttempt'
  );
  if (item.schemaVersion !== 1 || item.version !== 1)
    throw new EmailDeliveryContractError('schemaVersion/version must be 1.');
  const execution = object(item.executionRelease, 'executionRelease');
  exactKeys(execution, ['releaseId', 'version', 'effectFingerprintSha256'], 'executionRelease');
  if (execution.version !== 1)
    throw new EmailDeliveryContractError('executionRelease.version must be 1.');
  const campaign = object(item.campaign, 'campaign');
  exactKeys(campaign, ['campaignId', 'version'], 'campaign');
  const sender = object(item.senderProfile, 'senderProfile');
  exactKeys(sender, ['senderProfileId', 'version', 'fingerprintSha256'], 'senderProfile');
  const implementation = object(item.implementation, 'implementation');
  exactKeys(
    implementation,
    ['implementationProfileId', 'version'],
    'implementation'
  );
  if (!emailDeliveryAttemptStatusesV1.includes(item.status as EmailDeliveryAttemptStatusV1))
    throw new EmailDeliveryContractError('status is invalid.');
  const createdAt = timestamp(item.createdAt, 'createdAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');
  if (Date.parse(updatedAt) < Date.parse(createdAt))
    throw new EmailDeliveryContractError('updatedAt cannot precede createdAt.');
  const providerSubmissionRef =
    item.providerSubmissionRef === undefined
      ? undefined
      : text(item.providerSubmissionRef, 'providerSubmissionRef', 500);
  return {
    schemaVersion: 1,
    deliveryAttemptId: prefixed<EmailDeliveryAttemptId>(
      item.deliveryAttemptId,
      'deliveryAttemptId',
      'email-delivery-attempt_'
    ),
    version: 1,
    workspaceId: (() => {
      const workspaceId = text(item.workspaceId, 'workspaceId', 80).toLowerCase();
      if (!UUID.test(workspaceId))
        throw new EmailDeliveryContractError('workspaceId must be a UUID.');
      return workspaceId;
    })(),
    executionRelease: {
      releaseId: prefixed<ProtectedExternalActionReleaseId>(
        execution.releaseId,
        'executionRelease.releaseId',
        'protected-action-release_'
      ),
      version: 1,
      effectFingerprintSha256: sha(
        execution.effectFingerprintSha256,
        'executionRelease.effectFingerprintSha256'
      )
    },
    campaign: {
      campaignId: prefixed<EmailCampaignIdV1>(
        campaign.campaignId,
        'campaign.campaignId',
        'email-campaign_'
      ),
      version: integer(campaign.version, 'campaign.version')
    },
    senderProfile: {
      senderProfileId: prefixed<WorkspaceEmailSenderProfileId>(
        sender.senderProfileId,
        'senderProfile.senderProfileId',
        'email-sender-profile_'
      ),
      version: integer(sender.version, 'senderProfile.version'),
      fingerprintSha256: sha(sender.fingerprintSha256, 'senderProfile.fingerprintSha256')
    },
    implementation: {
      implementationProfileId: prefixed<ImplementationProfileId>(
        implementation.implementationProfileId,
        'implementation.implementationProfileId',
        'implementation-profile_'
      ),
      version: integer(implementation.version, 'implementation.version')
    },
    shardIndex: integer(item.shardIndex, 'shardIndex', 0),
    recipientCount: integer(item.recipientCount, 'recipientCount'),
    recipientManifestFingerprintSha256: sha(
      item.recipientManifestFingerprintSha256,
      'recipientManifestFingerprintSha256'
    ),
    deliveryPlanFingerprintSha256: sha(
      item.deliveryPlanFingerprintSha256,
      'deliveryPlanFingerprintSha256'
    ),
    correlationId: text(item.correlationId, 'correlationId', 300),
    attemptNumber: integer(item.attemptNumber, 'attemptNumber'),
    status: item.status as EmailDeliveryAttemptStatusV1,
    ...(providerSubmissionRef ? { providerSubmissionRef } : {}),
    createdAt,
    updatedAt,
    authority: parseAuthority(item.authority)
  };
}

export function parseEmailDeliveryObservationV1(
  value: unknown
): EmailDeliveryObservationV1 {
  rejectForbidden(value);
  const item = object(value, 'emailDeliveryObservation');
  exactKeys(
    item,
    [
      'schemaVersion',
      'observationId',
      'version',
      'workspaceId',
      'deliveryAttempt',
      'eventIdentity',
      'event',
      'evidenceKind',
      'providerMessageRef',
      'endpointFingerprintSha256',
      'authenticatedEvidence',
      'reasonCode',
      'evidenceRefs',
      'eventAt',
      'observedAt',
      'authority'
    ],
    'emailDeliveryObservation'
  );
  if (item.schemaVersion !== 1 || item.version !== 1)
    throw new EmailDeliveryContractError('schemaVersion/version must be 1.');
  if (item.authenticatedEvidence !== true)
    throw new EmailDeliveryContractError('authenticatedEvidence must be true.');
  if (!emailDeliveryObservationKindsV1.includes(item.event as EmailDeliveryObservationKindV1))
    throw new EmailDeliveryContractError('event is invalid.');
  if (!emailDeliveryEvidenceKindsV1.includes(item.evidenceKind as EmailDeliveryEvidenceKindV1))
    throw new EmailDeliveryContractError('evidenceKind is invalid.');
  const attempt = object(item.deliveryAttempt, 'deliveryAttempt');
  exactKeys(attempt, ['deliveryAttemptId', 'version'], 'deliveryAttempt');
  if (attempt.version !== 1)
    throw new EmailDeliveryContractError('deliveryAttempt.version must be 1.');
  const evidenceRefs = Array.isArray(item.evidenceRefs)
    ? item.evidenceRefs.map((entry, index) => text(entry, `evidenceRefs[${index}]`, 500))
    : (() => {
        throw new EmailDeliveryContractError('evidenceRefs must be an array.');
      })();
  if (new Set(evidenceRefs).size !== evidenceRefs.length)
    throw new EmailDeliveryContractError('evidenceRefs must not contain duplicates.');
  const providerMessageRef =
    item.providerMessageRef === undefined
      ? undefined
      : text(item.providerMessageRef, 'providerMessageRef', 500);
  const endpointFingerprintSha256 =
    item.endpointFingerprintSha256 === undefined
      ? undefined
      : sha(item.endpointFingerprintSha256, 'endpointFingerprintSha256');
  const workspaceId = text(item.workspaceId, 'workspaceId', 80).toLowerCase();
  if (!UUID.test(workspaceId))
    throw new EmailDeliveryContractError('workspaceId must be a UUID.');
  return {
    schemaVersion: 1,
    observationId: prefixed<EmailDeliveryObservationId>(
      item.observationId,
      'observationId',
      'email-delivery-observation_'
    ),
    version: 1,
    workspaceId,
    deliveryAttempt: {
      deliveryAttemptId: prefixed<EmailDeliveryAttemptId>(
        attempt.deliveryAttemptId,
        'deliveryAttempt.deliveryAttemptId',
        'email-delivery-attempt_'
      ),
      version: 1
    },
    eventIdentity: text(item.eventIdentity, 'eventIdentity', 500),
    event: item.event as EmailDeliveryObservationKindV1,
    evidenceKind: item.evidenceKind as EmailDeliveryEvidenceKindV1,
    ...(providerMessageRef ? { providerMessageRef } : {}),
    ...(endpointFingerprintSha256 ? { endpointFingerprintSha256 } : {}),
    authenticatedEvidence: true,
    reasonCode: text(item.reasonCode, 'reasonCode', 200),
    evidenceRefs,
    eventAt: timestamp(item.eventAt, 'eventAt'),
    observedAt: timestamp(item.observedAt, 'observedAt'),
    authority: parseAuthority(item.authority)
  };
}
