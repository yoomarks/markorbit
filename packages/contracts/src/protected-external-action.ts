import type { TradingListingAssetId } from './trading-asset-classification.js';
import type { TradingListingDraftId } from './trading-listing.js';
import type { TradingMarketplaceTargetBindingId } from './trading-marketplace-target-binding.js';

export const protectedExternalActionKindsV1 = ['TRADING_LISTING_PUBLISH'] as const;
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
  kind: 'TRADING_LISTING_PUBLISH';
  mutationRoute: '/api/execution/protected-external-actions/trading-listing-publish/authorizations';
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

export interface ProtectedExternalActionAuthorizationV1 {
  schemaVersion: 1;
  authorizationId: ProtectedExternalActionAuthorizationId;
  version: 1;
  workspaceId: string;
  actionKind: 'TRADING_LISTING_PUBLISH';
  intent: Readonly<TradingListingPublicationIntentV1>;
  effectFingerprintSha256: string;
  humanReceipt: Readonly<CoreHumanActionReceiptBindingV1>;
  authorizationStatus: ProtectedExternalActionAuthorizationStatusV1;
  authorizedByUserId: string;
  authorizedAt: string;
  expiresAt: string;
  lastValidatedAt: string;
  idempotencyKey: string;
}

export interface ProtectedExternalActionReleaseV1 {
  schemaVersion: 1;
  releaseId: ProtectedExternalActionReleaseId;
  version: 1;
  workspaceId: string;
  actionKind: 'TRADING_LISTING_PUBLISH';
  authorization: Readonly<
    ProtectedActionExactVersionReferenceV1<ProtectedExternalActionAuthorizationId>
  >;
  effectFingerprintSha256: string;
  status: 'RELEASED_FOR_EXECUTION';
  releasedByUserId: string;
  releasedAt: string;
  idempotencyKey: string;
}

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
