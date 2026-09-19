import type {
  CampaignAudienceSnapshotIdV1,
  EmailCampaignIdV1
} from './email-campaign.js';

export const noEmailCampaignDeliveryAnalyticsAuthorityConsequencesV1 = Object.freeze({
  businessSuccessCreated: false,
  customerTruthCreated: false,
  opportunityTruthCreated: false,
  matterTruthCreated: false,
  legalConsentVerifiedByMarkOrbit: false,
  externalSendAuthorized: false,
  causalReturnOnInvestmentClaimed: false
});
export type EmailCampaignDeliveryAnalyticsAuthorityConsequencesV1 =
  typeof noEmailCampaignDeliveryAnalyticsAuthorityConsequencesV1;

export interface EmailCampaignDeliveryAnalyticsV1 {
  schemaVersion: 1;
  workspaceId: string;
  campaign: Readonly<{
    campaignId: EmailCampaignIdV1;
    version: number;
  }>;
  audience: Readonly<{
    audienceSnapshotId: CampaignAudienceSnapshotIdV1;
    version: number;
  }>;
  requested: number;
  attempted: number;
  accepted: number;
  delivered: number;
  deferred: number;
  hardBounced: number;
  softBounced: number;
  complained: number;
  unsubscribed: number;
  failed: number;
  unknown: number;
  evidenceThrough: string;
  evaluatedAt: string;
  authority: Readonly<EmailCampaignDeliveryAnalyticsAuthorityConsequencesV1>;
}

export class EmailCampaignDeliveryAnalyticsContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'EmailCampaignDeliveryAnalyticsContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CAMPAIGN_ID = /^email-campaign_[A-Za-z0-9_-]+$/u;
const AUDIENCE_ID = /^campaign-audience_[A-Za-z0-9_-]+$/u;

function object(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new EmailCampaignDeliveryAnalyticsContractError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const expected = [...allowed].sort();
  const actual = Object.keys(value).sort();
  if (actual.join(',') !== expected.join(','))
    throw new EmailCampaignDeliveryAnalyticsContractError(
      `${field} must contain exactly the V1 fields.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new EmailCampaignDeliveryAnalyticsContractError(`${field} is invalid.`);
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new EmailCampaignDeliveryAnalyticsContractError(
      `${field} must be a positive safe integer.`
    );
  return value as number;
}

function counter(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new EmailCampaignDeliveryAnalyticsContractError(
      `${field} must be a non-negative safe integer.`
    );
  return value as number;
}

function timestamp(value: unknown, field: string): string {
  const normalized = text(value, field, 80);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized)
    throw new EmailCampaignDeliveryAnalyticsContractError(
      `${field} must be a canonical ISO timestamp.`
    );
  return normalized;
}

function authority(value: unknown): EmailCampaignDeliveryAnalyticsAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  const expected = noEmailCampaignDeliveryAnalyticsAuthorityConsequencesV1;
  exactKeys(item, Object.keys(expected), 'authority');
  for (const key of Object.keys(expected) as Array<
    keyof EmailCampaignDeliveryAnalyticsAuthorityConsequencesV1
  >) {
    if (item[key] !== false)
      throw new EmailCampaignDeliveryAnalyticsContractError(
        `authority.${key} must remain false.`
      );
  }
  return expected;
}

export function parseEmailCampaignDeliveryAnalyticsV1(
  value: unknown
): EmailCampaignDeliveryAnalyticsV1 {
  const item = object(value, 'emailCampaignDeliveryAnalytics');
  exactKeys(
    item,
    [
      'schemaVersion',
      'workspaceId',
      'campaign',
      'audience',
      'requested',
      'attempted',
      'accepted',
      'delivered',
      'deferred',
      'hardBounced',
      'softBounced',
      'complained',
      'unsubscribed',
      'failed',
      'unknown',
      'evidenceThrough',
      'evaluatedAt',
      'authority'
    ],
    'emailCampaignDeliveryAnalytics'
  );
  if (item.schemaVersion !== 1)
    throw new EmailCampaignDeliveryAnalyticsContractError('schemaVersion must be 1.');

  const workspaceId = text(item.workspaceId, 'workspaceId', 80).toLowerCase();
  if (!UUID.test(workspaceId))
    throw new EmailCampaignDeliveryAnalyticsContractError('workspaceId must be a UUID.');

  const campaign = object(item.campaign, 'campaign');
  exactKeys(campaign, ['campaignId', 'version'], 'campaign');
  const campaignId = text(campaign.campaignId, 'campaign.campaignId', 240);
  if (!CAMPAIGN_ID.test(campaignId))
    throw new EmailCampaignDeliveryAnalyticsContractError('campaign.campaignId is invalid.');

  const audience = object(item.audience, 'audience');
  exactKeys(audience, ['audienceSnapshotId', 'version'], 'audience');
  const audienceSnapshotId = text(audience.audienceSnapshotId, 'audience.audienceSnapshotId', 240);
  if (!AUDIENCE_ID.test(audienceSnapshotId))
    throw new EmailCampaignDeliveryAnalyticsContractError(
      'audience.audienceSnapshotId is invalid.'
    );

  const evidenceThrough = timestamp(item.evidenceThrough, 'evidenceThrough');
  const evaluatedAt = timestamp(item.evaluatedAt, 'evaluatedAt');
  if (Date.parse(evidenceThrough) > Date.parse(evaluatedAt))
    throw new EmailCampaignDeliveryAnalyticsContractError(
      'evidenceThrough cannot be after evaluatedAt.'
    );

  return {
    schemaVersion: 1,
    workspaceId,
    campaign: {
      campaignId: campaignId as EmailCampaignIdV1,
      version: positiveInteger(campaign.version, 'campaign.version')
    },
    audience: {
      audienceSnapshotId: audienceSnapshotId as CampaignAudienceSnapshotIdV1,
      version: positiveInteger(audience.version, 'audience.version')
    },
    requested: counter(item.requested, 'requested'),
    attempted: counter(item.attempted, 'attempted'),
    accepted: counter(item.accepted, 'accepted'),
    delivered: counter(item.delivered, 'delivered'),
    deferred: counter(item.deferred, 'deferred'),
    hardBounced: counter(item.hardBounced, 'hardBounced'),
    softBounced: counter(item.softBounced, 'softBounced'),
    complained: counter(item.complained, 'complained'),
    unsubscribed: counter(item.unsubscribed, 'unsubscribed'),
    failed: counter(item.failed, 'failed'),
    unknown: counter(item.unknown, 'unknown'),
    evidenceThrough,
    evaluatedAt,
    authority: authority(item.authority)
  };
}
