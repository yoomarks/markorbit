import type { EmailCampaignIdV1 } from './email-campaign.js';
import type { EmailDeliveryAttemptId } from './email-delivery.js';
import type { WorkspaceEmailSenderProfileId } from './email-sender-profile.js';

export type EmailCampaignReplyHandoffId = `email-campaign-reply-handoff_${string}`;

export const emailCampaignReplyCorrelationMethodsV1 = [
  'RFC_IN_REPLY_TO',
  'RFC_REFERENCES'
] as const;
export type EmailCampaignReplyCorrelationMethodV1 =
  (typeof emailCampaignReplyCorrelationMethodsV1)[number];

export const noEmailCampaignReplyHandoffAuthorityConsequencesV1 = Object.freeze({
  businessSuccessCreated: false,
  customerTruthCreated: false,
  opportunityTruthCreated: false,
  matterTruthCreated: false,
  legalConsentVerifiedByMarkOrbit: false,
  externalSendAuthorized: false,
  communicationLinkCreated: false,
  causalReturnOnInvestmentClaimed: false
});
export type EmailCampaignReplyHandoffAuthorityConsequencesV1 =
  typeof noEmailCampaignReplyHandoffAuthorityConsequencesV1;

export interface EmailCampaignReplyHandoffV1 {
  schemaVersion: 1;
  replyHandoffId: EmailCampaignReplyHandoffId;
  workspaceId: string;
  campaign: Readonly<{
    campaignId: EmailCampaignIdV1;
    version: number;
  }>;
  deliveryAttempt: Readonly<{
    deliveryAttemptId: EmailDeliveryAttemptId;
    version: 1;
  }>;
  senderProfile: Readonly<{
    senderProfileId: WorkspaceEmailSenderProfileId;
    version: number;
  }>;
  managedCommunication: Readonly<{
    accountRef: string;
    messageId: string;
    threadRef: string;
    provider: string;
    providerMessageId: string;
    observedAt: string;
  }>;
  inboundEvidence: Readonly<{
    evidenceRef: string;
    sha256: string;
  }>;
  outboundProviderSubmissionRef: string;
  correlationMethod: EmailCampaignReplyCorrelationMethodV1;
  evidenceFingerprintSha256: string;
  status: 'CORRELATED';
  createdAt: string;
  authority: Readonly<EmailCampaignReplyHandoffAuthorityConsequencesV1>;
}

export class EmailCampaignReplyHandoffContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'EmailCampaignReplyHandoffContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const HANDOFF_ID = /^email-campaign-reply-handoff_[A-Za-z0-9_-]+$/u;
const CAMPAIGN_ID = /^email-campaign_[A-Za-z0-9_-]+$/u;
const ATTEMPT_ID = /^email-delivery-attempt_[A-Za-z0-9_-]+$/u;
const PROFILE_ID = /^email-sender-profile_[A-Za-z0-9_-]+$/u;
const forbiddenKeys = new Set([
  'email',
  'emailaddress',
  'recipient',
  'recipientemail',
  'fromaddress',
  'toaddress',
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

function rejectForbidden(value: unknown, field = 'emailCampaignReplyHandoff'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectForbidden(entry, `${field}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (forbiddenKeys.has(normalizedKey(key)))
      throw new EmailCampaignReplyHandoffContractError(`${field}.${key} is forbidden material.`);
    rejectForbidden(nested, `${field}.${key}`);
  }
}

function object(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new EmailCampaignReplyHandoffContractError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const expected = [...allowed].sort();
  const actual = Object.keys(value).sort();
  if (actual.join(',') !== expected.join(','))
    throw new EmailCampaignReplyHandoffContractError(
      `${field} must contain exactly the V1 fields.`
    );
}

function text(value: unknown, field: string, maximum = 1000): string {
  if (typeof value !== 'string')
    throw new EmailCampaignReplyHandoffContractError(`${field} must be a string.`);
  const result = value.trim();
  if (!result || result.length > maximum)
    throw new EmailCampaignReplyHandoffContractError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  return result;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new EmailCampaignReplyHandoffContractError(`${field} must be a positive safe integer.`);
  return value as number;
}

function sha(value: unknown, field: string): string {
  const result = text(value, field, 64);
  if (!SHA256.test(result))
    throw new EmailCampaignReplyHandoffContractError(`${field} must be lowercase SHA-256 hex.`);
  return result;
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 80);
  const parsed = new Date(result);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== result)
    throw new EmailCampaignReplyHandoffContractError(`${field} must be a canonical ISO timestamp.`);
  return result;
}

function prefixed<T extends string>(value: unknown, field: string, pattern: RegExp): T {
  const result = text(value, field, 300);
  if (!pattern.test(result))
    throw new EmailCampaignReplyHandoffContractError(`${field} is invalid.`);
  return result as T;
}

function authority(value: unknown): EmailCampaignReplyHandoffAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  const expected = noEmailCampaignReplyHandoffAuthorityConsequencesV1;
  exactKeys(item, Object.keys(expected), 'authority');
  for (const key of Object.keys(expected) as Array<
    keyof EmailCampaignReplyHandoffAuthorityConsequencesV1
  >) {
    if (item[key] !== false)
      throw new EmailCampaignReplyHandoffContractError(`authority.${key} must remain false.`);
  }
  return expected;
}

export function parseEmailCampaignReplyHandoffV1(value: unknown): EmailCampaignReplyHandoffV1 {
  rejectForbidden(value);
  const item = object(value, 'emailCampaignReplyHandoff');
  exactKeys(
    item,
    [
      'schemaVersion',
      'replyHandoffId',
      'workspaceId',
      'campaign',
      'deliveryAttempt',
      'senderProfile',
      'managedCommunication',
      'inboundEvidence',
      'outboundProviderSubmissionRef',
      'correlationMethod',
      'evidenceFingerprintSha256',
      'status',
      'createdAt',
      'authority'
    ],
    'emailCampaignReplyHandoff'
  );
  if (item.schemaVersion !== 1)
    throw new EmailCampaignReplyHandoffContractError('schemaVersion must be 1.');
  if (item.status !== 'CORRELATED')
    throw new EmailCampaignReplyHandoffContractError('status must be CORRELATED.');

  const workspaceId = text(item.workspaceId, 'workspaceId', 80).toLowerCase();
  if (!UUID.test(workspaceId))
    throw new EmailCampaignReplyHandoffContractError('workspaceId must be a UUID.');

  const campaign = object(item.campaign, 'campaign');
  exactKeys(campaign, ['campaignId', 'version'], 'campaign');

  const deliveryAttempt = object(item.deliveryAttempt, 'deliveryAttempt');
  exactKeys(deliveryAttempt, ['deliveryAttemptId', 'version'], 'deliveryAttempt');
  if (deliveryAttempt.version !== 1)
    throw new EmailCampaignReplyHandoffContractError('deliveryAttempt.version must be 1.');

  const senderProfile = object(item.senderProfile, 'senderProfile');
  exactKeys(senderProfile, ['senderProfileId', 'version'], 'senderProfile');

  const managedCommunication = object(item.managedCommunication, 'managedCommunication');
  exactKeys(
    managedCommunication,
    ['accountRef', 'messageId', 'threadRef', 'provider', 'providerMessageId', 'observedAt'],
    'managedCommunication'
  );

  const inboundEvidence = object(item.inboundEvidence, 'inboundEvidence');
  exactKeys(inboundEvidence, ['evidenceRef', 'sha256'], 'inboundEvidence');

  if (
    typeof item.correlationMethod !== 'string' ||
    !emailCampaignReplyCorrelationMethodsV1.includes(
      item.correlationMethod as EmailCampaignReplyCorrelationMethodV1
    )
  )
    throw new EmailCampaignReplyHandoffContractError('correlationMethod is invalid.');

  return {
    schemaVersion: 1,
    replyHandoffId: prefixed<EmailCampaignReplyHandoffId>(
      item.replyHandoffId,
      'replyHandoffId',
      HANDOFF_ID
    ),
    workspaceId,
    campaign: {
      campaignId: prefixed<EmailCampaignIdV1>(
        campaign.campaignId,
        'campaign.campaignId',
        CAMPAIGN_ID
      ),
      version: positiveInteger(campaign.version, 'campaign.version')
    },
    deliveryAttempt: {
      deliveryAttemptId: prefixed<EmailDeliveryAttemptId>(
        deliveryAttempt.deliveryAttemptId,
        'deliveryAttempt.deliveryAttemptId',
        ATTEMPT_ID
      ),
      version: 1
    },
    senderProfile: {
      senderProfileId: prefixed<WorkspaceEmailSenderProfileId>(
        senderProfile.senderProfileId,
        'senderProfile.senderProfileId',
        PROFILE_ID
      ),
      version: positiveInteger(senderProfile.version, 'senderProfile.version')
    },
    managedCommunication: {
      accountRef: text(managedCommunication.accountRef, 'managedCommunication.accountRef', 500),
      messageId: text(managedCommunication.messageId, 'managedCommunication.messageId', 500),
      threadRef: text(managedCommunication.threadRef, 'managedCommunication.threadRef', 500),
      provider: text(managedCommunication.provider, 'managedCommunication.provider', 120),
      providerMessageId: text(
        managedCommunication.providerMessageId,
        'managedCommunication.providerMessageId',
        500
      ),
      observedAt: timestamp(managedCommunication.observedAt, 'managedCommunication.observedAt')
    },
    inboundEvidence: {
      evidenceRef: text(inboundEvidence.evidenceRef, 'inboundEvidence.evidenceRef', 500),
      sha256: sha(inboundEvidence.sha256, 'inboundEvidence.sha256')
    },
    outboundProviderSubmissionRef: text(
      item.outboundProviderSubmissionRef,
      'outboundProviderSubmissionRef',
      500
    ),
    correlationMethod: item.correlationMethod as EmailCampaignReplyCorrelationMethodV1,
    evidenceFingerprintSha256: sha(item.evidenceFingerprintSha256, 'evidenceFingerprintSha256'),
    status: 'CORRELATED',
    createdAt: timestamp(item.createdAt, 'createdAt'),
    authority: authority(item.authority)
  };
}
