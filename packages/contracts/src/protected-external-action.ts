import type {
  CampaignAudienceSnapshotIdV1,
  CampaignBrandProjectionIdV1,
  CampaignContentProjectionIdV1,
  CampaignReviewDecisionIdV1,
  EmailCampaignIdV1
} from './email-campaign.js';
import type { WorkspaceEmailSenderProfileId } from './email-sender-profile.js';
import {
  parseChannelNotificationSendIntentV1,
  parseChannelNotificationTriggerEvidenceV1,
  type ChannelNotificationSendIntentV1,
  type ChannelNotificationTriggerEvidenceV1
} from './channel-notification.js';
import {
  parseChannelNotificationAutomationGovernanceEvidenceV1,
  type ChannelNotificationAutomationGovernanceEvidenceV1
} from './channel-notification-automation.js';
import type { TradingListingAssetId } from './trading-asset-classification.js';
import type { TradingListingDraftId } from './trading-listing.js';
import type { TradingMarketplaceTargetBindingId } from './trading-marketplace-target-binding.js';

export const protectedExternalActionKindsV1 = [
  'TRADING_LISTING_PUBLISH',
  'EMAIL_CAMPAIGN_SEND',
  'NOTIFICATION_SEND'
] as const;
export type ProtectedExternalActionKindV1 = (typeof protectedExternalActionKindsV1)[number];

export type TradingListingReviewId = `trading-listing-review_${string}`;
export type ProtectedExternalActionAuthorizationId = `protected-action-authorization_${string}`;
export type ProtectedExternalActionReleaseId = `protected-action-release_${string}`;

export interface ProtectedActionExactVersionReferenceV1<Id extends string = string> {
  id: Id;
  version: number;
}

export interface TradingListingPublicationIntentV1 {
  schemaVersion: 1;
  actionKind: 'TRADING_LISTING_PUBLISH';
  workspaceId: string;
  listingDraft: Readonly<ProtectedActionExactVersionReferenceV1<TradingListingDraftId>>;
  listingReview: Readonly<ProtectedActionExactVersionReferenceV1<TradingListingReviewId>>;
  listingAssets: readonly Readonly<ProtectedActionExactVersionReferenceV1<TradingListingAssetId>>[];
  marketplaceTargetBinding: Readonly<
    ProtectedActionExactVersionReferenceV1<TradingMarketplaceTargetBindingId>
  >;
  effectFingerprintSha256: string;
}

export interface ProtectedActionExactFingerprintReferenceV1<
  Id extends string = string
> extends ProtectedActionExactVersionReferenceV1<Id> {
  fingerprintSha256: string;
}

export interface EmailCampaignSendIntentV1 {
  schemaVersion: 1;
  actionKind: 'EMAIL_CAMPAIGN_SEND';
  workspaceId: string;
  campaign: Readonly<ProtectedActionExactFingerprintReferenceV1<EmailCampaignIdV1>>;
  campaignReview: Readonly<ProtectedActionExactVersionReferenceV1<CampaignReviewDecisionIdV1>>;
  senderProfile: Readonly<
    ProtectedActionExactFingerprintReferenceV1<WorkspaceEmailSenderProfileId>
  >;
  audience: Readonly<ProtectedActionExactFingerprintReferenceV1<CampaignAudienceSnapshotIdV1>>;
  content: Readonly<ProtectedActionExactFingerprintReferenceV1<CampaignContentProjectionIdV1>>;
  brand: Readonly<ProtectedActionExactFingerprintReferenceV1<CampaignBrandProjectionIdV1>>;
  recipientCount: number;
  deliveryPlanFingerprintSha256: string;
  effectFingerprintSha256: string;
}

export const emailCampaignSendCurrentnessStatesV1 = [
  'CURRENT',
  'STALE',
  'REVOKED',
  'SUPPRESSED',
  'UNKNOWN',
  'UNAVAILABLE'
] as const;
export type EmailCampaignSendCurrentnessStateV1 =
  (typeof emailCampaignSendCurrentnessStatesV1)[number];

export const emailCampaignSendCurrentnessReasonsV1 = [
  'EXACT_DELIVERY_PLAN_CURRENT',
  'CAMPAIGN_STALE',
  'REVIEW_STALE',
  'REVIEW_CAMPAIGN_BINDING_DRIFT',
  'SENDER_PROFILE_STALE',
  'SENDER_PROFILE_REVOKED',
  'SENDER_PROFILE_UNAVAILABLE',
  'ENDPOINT_DRIFT',
  'ENDPOINT_UNAVAILABLE',
  'OUTBOUND_POLICY_STALE',
  'OUTBOUND_POLICY_SUPPRESSED',
  'ENTITLEMENT_REVOKED',
  'OWNER_DATA_UNKNOWN',
  'OWNER_UNAVAILABLE',
  'FINGERPRINT_MISMATCH',
  'WORKSPACE_MISMATCH'
] as const;
export type EmailCampaignSendCurrentnessReasonV1 =
  (typeof emailCampaignSendCurrentnessReasonsV1)[number];

export interface EmailCampaignSendCurrentnessV1 {
  schemaVersion: 1;
  workspaceId: string;
  actionKind: 'EMAIL_CAMPAIGN_SEND';
  effectFingerprintSha256: string;
  deliveryPlanFingerprintSha256: string;
  state: EmailCampaignSendCurrentnessStateV1;
  reason: EmailCampaignSendCurrentnessReasonV1;
}
export const notificationSendCurrentnessStatesV1 = [
  'CURRENT',
  'STALE',
  'REVOKED',
  'SUPPRESSED',
  'UNKNOWN',
  'UNAVAILABLE'
] as const;
export type NotificationSendCurrentnessStateV1 =
  (typeof notificationSendCurrentnessStatesV1)[number];

export const notificationSendCurrentnessReasonsV1 = [
  'EXACT_NOTIFICATION_PLAN_CURRENT',
  'RULE_STALE',
  'ACTIVATION_EVIDENCE_STALE',
  'TRIGGER_STALE',
  'TRIGGER_UNAVAILABLE',
  'ENDPOINT_DRIFT',
  'ENDPOINT_UNAVAILABLE',
  'OUTBOUND_POLICY_SUPPRESSED',
  'SENDER_PROFILE_STALE',
  'SENDER_PROFILE_REVOKED',
  'ENTITLEMENT_REVOKED',
  'FINGERPRINT_MISMATCH',
  'WORKSPACE_MISMATCH',
  'OWNER_DATA_UNKNOWN',
  'OWNER_UNAVAILABLE'
] as const;
export type NotificationSendCurrentnessReasonV1 =
  (typeof notificationSendCurrentnessReasonsV1)[number];

export interface NotificationSendCurrentnessV1 {
  schemaVersion: 1;
  workspaceId: string;
  actionKind: 'NOTIFICATION_SEND';
  effectFingerprintSha256: string;
  deliveryPlanFingerprintSha256: string;
  state: NotificationSendCurrentnessStateV1;
  reason: NotificationSendCurrentnessReasonV1;
}

export const tradingListingPublicationCurrentnessStatesV1 = [
  'CURRENT',
  'STALE',
  'REVOKED',
  'UNKNOWN',
  'UNAVAILABLE'
] as const;
export type TradingListingPublicationCurrentnessStateV1 =
  (typeof tradingListingPublicationCurrentnessStatesV1)[number];

export const tradingListingPublicationCurrentnessReasonsV1 = [
  'EXACT_INTENT_CURRENT',
  'DRAFT_STALE',
  'REVIEW_STALE',
  'REVIEW_DRAFT_BINDING_DRIFT',
  'LISTING_ASSET_DRIFT',
  'TARGET_BINDING_STALE',
  'TARGET_BINDING_REVOKED',
  'OWNER_DATA_UNKNOWN',
  'OWNER_UNAVAILABLE',
  'FINGERPRINT_MISMATCH',
  'WORKSPACE_MISMATCH'
] as const;
export type TradingListingPublicationCurrentnessReasonV1 =
  (typeof tradingListingPublicationCurrentnessReasonsV1)[number];

export interface TradingListingPublicationCurrentnessV1 {
  schemaVersion: 1;
  workspaceId: string;
  actionKind: 'TRADING_LISTING_PUBLISH';
  effectFingerprintSha256: string;
  state: TradingListingPublicationCurrentnessStateV1;
  reason: TradingListingPublicationCurrentnessReasonV1;
}

export interface CoreHumanActionReceiptBindingV1 {
  schemaVersion: 1;
  receiptId: string;
  receiptVersion: 1;
  workspaceId: string;
  userId: string;
  membershipId: string;
  principalReference: string;
  kind: ProtectedExternalActionKindV1;
  mutationRoute:
    | '/api/execution/protected-external-actions/trading-listing-publish/authorizations'
    | '/api/execution/protected-external-actions/email-campaign-send/authorizations';
  reviewedActionDigest: string;
  idempotencyKey: string;
  authenticatedAt: string;
  authorityReference: string;
  authorityVersion: 1;
  affirmativeHumanActionEvidenceReference: string;
  source: 'CORE';
  actorKind: 'HUMAN_USER';
  workspaceVersion: number;
  userVersion: number;
  membershipVersion: number;
  createdAt: string;
}

export const protectedExternalActionAuthorizationStatusesV1 = [
  'AUTHORIZED',
  'REVOKED',
  'EXPIRED'
] as const;
export type ProtectedExternalActionAuthorizationStatusV1 =
  (typeof protectedExternalActionAuthorizationStatusesV1)[number];

export interface ProtectedExternalActionAuthorizationBaseV1 {
  schemaVersion: 1;
  authorizationId: ProtectedExternalActionAuthorizationId;
  version: 1;
  workspaceId: string;
  effectFingerprintSha256: string;
  humanReceipt: Readonly<CoreHumanActionReceiptBindingV1>;
  authorizationStatus: ProtectedExternalActionAuthorizationStatusV1;
  authorizedByUserId: string;
  authorizedAt: string;
  expiresAt: string;
  lastValidatedAt: string;
  idempotencyKey: string;
}

export interface NotificationSendAuthorizationV1 {
  schemaVersion: 1;
  authorizationId: ProtectedExternalActionAuthorizationId;
  version: 1;
  workspaceId: string;
  actionKind: 'NOTIFICATION_SEND';
  effectFingerprintSha256: string;
  intent: Readonly<ChannelNotificationSendIntentV1>;
  triggerEvidence: Readonly<ChannelNotificationTriggerEvidenceV1>;
  activationEvidence: Readonly<ChannelNotificationAutomationGovernanceEvidenceV1>;
  authorizationStatus: ProtectedExternalActionAuthorizationStatusV1;
  authorizedBy: 'EXECUTION_AUTOMATION';
  authorizedAt: string;
  expiresAt: string;
  lastValidatedAt: string;
  idempotencyKey: string;
}

export type ProtectedExternalActionAuthorizationV1 =
  | (ProtectedExternalActionAuthorizationBaseV1 & {
      actionKind: 'TRADING_LISTING_PUBLISH';
      intent: Readonly<TradingListingPublicationIntentV1>;
    })
  | (ProtectedExternalActionAuthorizationBaseV1 & {
      actionKind: 'EMAIL_CAMPAIGN_SEND';
      intent: Readonly<EmailCampaignSendIntentV1>;
    })
  | NotificationSendAuthorizationV1;

export interface ProtectedExternalActionReleaseBaseV1 {
  schemaVersion: 1;
  releaseId: ProtectedExternalActionReleaseId;
  version: 1;
  workspaceId: string;
  authorization: Readonly<
    ProtectedActionExactVersionReferenceV1<ProtectedExternalActionAuthorizationId>
  >;
  effectFingerprintSha256: string;
  status: 'RELEASED_FOR_EXECUTION';
  releasedByUserId: string;
  releasedAt: string;
  idempotencyKey: string;
}

export interface NotificationSendReleaseV1 {
  schemaVersion: 1;
  releaseId: ProtectedExternalActionReleaseId;
  version: 1;
  workspaceId: string;
  authorization: Readonly<
    ProtectedActionExactVersionReferenceV1<ProtectedExternalActionAuthorizationId>
  >;
  actionKind: 'NOTIFICATION_SEND';
  effectFingerprintSha256: string;
  status: 'RELEASED_FOR_EXECUTION';
  releasedBy: 'EXECUTION_AUTOMATION';
  releasedAt: string;
  idempotencyKey: string;
}

export type ProtectedExternalActionReleaseV1 =
  | (ProtectedExternalActionReleaseBaseV1 & {
      actionKind: 'TRADING_LISTING_PUBLISH';
    })
  | (ProtectedExternalActionReleaseBaseV1 & {
      actionKind: 'EMAIL_CAMPAIGN_SEND';
    })
  | NotificationSendReleaseV1;

export class ProtectedExternalActionContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ProtectedExternalActionContractError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;

function exact<Id extends string>(
  value: Readonly<ProtectedActionExactVersionReferenceV1<Id>>,
  field: string
) {
  if (!value?.id?.trim() || !Number.isSafeInteger(value.version) || value.version < 1)
    throw new ProtectedExternalActionContractError(
      `${field} must identify one exact positive version.`
    );
  return { id: value.id, version: value.version } as const;
}

export function canonicalTradingListingPublicationIntentPayloadV1(
  intent: Readonly<TradingListingPublicationIntentV1>
) {
  if (
    intent.schemaVersion !== 1 ||
    intent.actionKind !== 'TRADING_LISTING_PUBLISH' ||
    !UUID.test(intent.workspaceId)
  )
    throw new ProtectedExternalActionContractError(
      'Trading publication intent identity or Workspace is invalid.'
    );
  const listingDraft = exact(intent.listingDraft, 'listingDraft');
  const listingReview = exact(intent.listingReview, 'listingReview');
  const marketplaceTargetBinding = exact(
    intent.marketplaceTargetBinding,
    'marketplaceTargetBinding'
  );
  if (!intent.listingAssets.length)
    throw new ProtectedExternalActionContractError(
      'Trading publication intent requires Listing Assets.'
    );
  const listingAssets = intent.listingAssets
    .map((item, index) => exact(item, `listingAssets[${index}]`))
    .sort((left, right) =>
      left.id === right.id ? left.version - right.version : left.id.localeCompare(right.id)
    );
  if (new Set(listingAssets.map((item) => item.id)).size !== listingAssets.length)
    throw new ProtectedExternalActionContractError(
      'Trading publication intent Listing Asset ids must be distinct.'
    );
  return {
    schemaVersion: 1 as const,
    actionKind: 'TRADING_LISTING_PUBLISH' as const,
    workspaceId: intent.workspaceId.toLowerCase(),
    listingDraft,
    listingReview,
    listingAssets,
    marketplaceTargetBinding
  };
}

export function assertTradingListingPublicationIntentV1(
  intent: Readonly<TradingListingPublicationIntentV1>
): void {
  canonicalTradingListingPublicationIntentPayloadV1(intent);
  if (!SHA256.test(intent.effectFingerprintSha256))
    throw new ProtectedExternalActionContractError(
      'effectFingerprintSha256 must be a lowercase SHA-256 digest.'
    );
}

function exactFingerprint<Id extends string>(
  value: Readonly<ProtectedActionExactFingerprintReferenceV1<Id>>,
  field: string
) {
  const exactValue = exact(value, field);
  if (!SHA256.test(value.fingerprintSha256))
    throw new ProtectedExternalActionContractError(
      `${field}.fingerprintSha256 must be a lowercase SHA-256 digest.`
    );
  return { ...exactValue, fingerprintSha256: value.fingerprintSha256 } as const;
}

function assertEmailCampaignSendNoEscapeHatches(value: unknown, field = 'intent'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertEmailCampaignSendNoEscapeHatches(entry, `${field}[${index}]`)
    );
    return;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && value.includes('@'))
      throw new ProtectedExternalActionContractError(
        `${field} cannot contain raw email addresses.`
      );
    return;
  }
  const forbidden = new Set([
    'rawemail',
    'emailaddress',
    'recipientemail',
    'provider',
    'providercredential',
    'credential',
    'credentials',
    'apikey',
    'accesstoken',
    'refreshtoken',
    'password',
    'secret'
  ]);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
    if (forbidden.has(normalized))
      throw new ProtectedExternalActionContractError(
        `${field}.${key} is not allowed in provider-neutral Email Campaign intent.`
      );
    assertEmailCampaignSendNoEscapeHatches(nested, `${field}.${key}`);
  }
}

function exactObjectKeys(value: object, allowed: readonly string[], field: string): void {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length)
    throw new ProtectedExternalActionContractError(
      `${field} contains unsupported fields: ${extras.join(', ')}.`
    );
}

export function canonicalEmailCampaignSendIntentPayloadV1(
  intent: Readonly<EmailCampaignSendIntentV1>
) {
  assertEmailCampaignSendNoEscapeHatches(intent);
  exactObjectKeys(
    intent,
    [
      'schemaVersion',
      'actionKind',
      'workspaceId',
      'campaign',
      'campaignReview',
      'senderProfile',
      'audience',
      'content',
      'brand',
      'recipientCount',
      'deliveryPlanFingerprintSha256',
      'effectFingerprintSha256'
    ],
    'intent'
  );
  for (const [field, reference, fingerprinted] of [
    ['campaign', intent.campaign, true],
    ['campaignReview', intent.campaignReview, false],
    ['senderProfile', intent.senderProfile, true],
    ['audience', intent.audience, true],
    ['content', intent.content, true],
    ['brand', intent.brand, true]
  ] as const)
    exactObjectKeys(
      reference,
      fingerprinted ? ['id', 'version', 'fingerprintSha256'] : ['id', 'version'],
      field
    );
  if (
    intent.schemaVersion !== 1 ||
    intent.actionKind !== 'EMAIL_CAMPAIGN_SEND' ||
    !UUID.test(intent.workspaceId)
  )
    throw new ProtectedExternalActionContractError(
      'Email Campaign send intent identity or Workspace is invalid.'
    );
  if (!Number.isSafeInteger(intent.recipientCount) || intent.recipientCount < 1)
    throw new ProtectedExternalActionContractError(
      'Email Campaign send intent recipientCount must be a positive safe integer.'
    );
  if (intent.recipientCount > 10_000)
    throw new ProtectedExternalActionContractError(
      'Email Campaign send intent recipientCount exceeds the bounded maximum.'
    );
  return {
    schemaVersion: 1 as const,
    actionKind: 'EMAIL_CAMPAIGN_SEND' as const,
    workspaceId: intent.workspaceId.toLowerCase(),
    campaign: exactFingerprint(intent.campaign, 'campaign'),
    campaignReview: exact(intent.campaignReview, 'campaignReview'),
    senderProfile: exactFingerprint(intent.senderProfile, 'senderProfile'),
    audience: exactFingerprint(intent.audience, 'audience'),
    content: exactFingerprint(intent.content, 'content'),
    brand: exactFingerprint(intent.brand, 'brand'),
    recipientCount: intent.recipientCount
  };
}

export function assertEmailCampaignSendIntentV1(intent: Readonly<EmailCampaignSendIntentV1>): void {
  canonicalEmailCampaignSendIntentPayloadV1(intent);
  if (
    !SHA256.test(intent.deliveryPlanFingerprintSha256) ||
    !SHA256.test(intent.effectFingerprintSha256)
  )
    throw new ProtectedExternalActionContractError(
      'Email Campaign send fingerprints must be lowercase SHA-256 digests.'
    );
}

export function assertNotificationSendBindingV1(input: {
  intent: Readonly<ChannelNotificationSendIntentV1>;
  triggerEvidence: Readonly<ChannelNotificationTriggerEvidenceV1>;
  activationEvidence: Readonly<ChannelNotificationAutomationGovernanceEvidenceV1>;
}): void {
  const intent = parseChannelNotificationSendIntentV1(input.intent);
  const trigger = parseChannelNotificationTriggerEvidenceV1(input.triggerEvidence);
  const activation = parseChannelNotificationAutomationGovernanceEvidenceV1(
    input.activationEvidence
  );
  if (
    intent.workspaceId !== trigger.workspaceId ||
    intent.workspaceId !== activation.workspaceId ||
    intent.trigger.notificationTriggerEvidenceId !== trigger.notificationTriggerEvidenceId ||
    intent.trigger.version !== trigger.version ||
    intent.trigger.fingerprintSha256 !== trigger.triggerFingerprintSha256 ||
    intent.rule.notificationRuleId !== activation.notificationRuleId ||
    intent.rule.version !== activation.authorizedRuleVersion ||
    intent.rule.fingerprintSha256 !== activation.authorizedRuleFingerprintSha256 ||
    activation.action !== 'ACTIVATE'
  )
    throw new ProtectedExternalActionContractError(
      'Notification send binding must match one exact activated rule and trigger evidence.'
    );
}
