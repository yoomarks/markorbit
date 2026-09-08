import type { ProductLoopExactReference } from './product-loop.js';
import type {
  TradingAiProfileId,
  TradingBuyingPointId,
  TradingCommercialAssumptionId,
  TradingCommercialPersonaId,
  TradingCommercialScenarioId,
  TradingSellingPointId
} from './trading-ai-profile.js';
import type { TradingListingAssetId } from './trading-asset-classification.js';
import type { TradingCommercialDirectionId } from './trading-commercial-direction.js';
import type { TrademarkAssetCommerceProfileId } from './trademark-asset-commerce.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TradingListingDraftId = `trading-listing-draft_${string}`;
export type TradingListingId = `trading-listing_${string}`;

export const tradingListingMethods = ['FIXED_PRICE', 'MAKE_OFFER', 'INQUIRY'] as const;
export type TradingListingMethod = (typeof tradingListingMethods)[number];
export const tradingListingReviewStates = ['CURRENT', 'STALE', 'CONFLICT'] as const;
export type TradingListingReviewState = (typeof tradingListingReviewStates)[number];

export interface TradingListingOpportunityStoryV1 {
  bestForBuyerPersonaRefs: readonly TradingCommercialPersonaId[];
  whyThisMarkSellingPointRefs: readonly TradingSellingPointId[];
  buyingPointRefs: readonly TradingBuyingPointId[];
  businessOpportunitySummary: string;
  endConsumerRefs: readonly TradingCommercialPersonaId[];
  operatorPersonaRefs: readonly TradingCommercialPersonaId[];
  scenarioRefs: readonly TradingCommercialScenarioId[];
  assumptionRefs: readonly TradingCommercialAssumptionId[];
}

export interface TradingListingDraftV1 {
  schemaVersion: 1;
  listingDraftId: TradingListingDraftId;
  workspaceId: string;
  version: number;
  trademarkAsset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  commerceProfile: Readonly<ProductLoopExactReference<TrademarkAssetCommerceProfileId>>;
  commercialDirection: Readonly<ProductLoopExactReference<TradingCommercialDirectionId>>;
  aiProfile: Readonly<ProductLoopExactReference<TradingAiProfileId>>;
  listingAssets: readonly ProductLoopExactReference<TradingListingAssetId>[];
  opportunityStory: Readonly<TradingListingOpportunityStoryV1>;
  listingMethod: TradingListingMethod;
  sellerRelationshipVerified: false;
  status: 'DRAFT';
  createdAt: string;
}

export interface TradingListingPublishReviewV1 {
  reviewedTrademarkAsset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  reviewedCommercialDirection: Readonly<ProductLoopExactReference<TradingCommercialDirectionId>>;
  reviewState: TradingListingReviewState;
  reviewedAt: string;
  humanApprovalReference?: string;
}

export interface TradingPublishedListingV1 {
  schemaVersion: 1;
  listingId: TradingListingId;
  version: number;
  draft: Readonly<ProductLoopExactReference<TradingListingDraftId>>;
  publishedDraftSnapshot: Readonly<TradingListingDraftV1>;
  publishReview: Readonly<TradingListingPublishReviewV1>;
  status: 'PUBLISHED';
  publishedAt: string;
}

export class TradingListingValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingListingValidationError';
  }
}

function required(value: string, field: string): void {
  if (!value.trim()) throw new TradingListingValidationError(`${field} is required.`);
}

function exact(reference: Readonly<ProductLoopExactReference>, field: string): void {
  required(reference.id, `${field}.id`);
  if (
    (typeof reference.version === 'number' &&
      (!Number.isSafeInteger(reference.version) || reference.version < 1)) ||
    (typeof reference.version === 'string' && !reference.version.trim())
  )
    throw new TradingListingValidationError(`${field}.version must identify an exact version.`);
}

function distinct(values: readonly string[], field: string, requiredValues = true): void {
  if (
    (requiredValues && values.length === 0) ||
    values.some((value) => !value.trim()) ||
    new Set(values).size !== values.length
  )
    throw new TradingListingValidationError(`${field} must contain distinct non-empty references.`);
}

export function assertTradingListingDraftV1(draft: Readonly<TradingListingDraftV1>): void {
  if (draft.schemaVersion !== 1)
    throw new TradingListingValidationError('schemaVersion must be 1.');
  if (!draft.listingDraftId.startsWith('trading-listing-draft_'))
    throw new TradingListingValidationError('listingDraftId is invalid.');
  required(draft.workspaceId, 'workspaceId');
  if (!Number.isSafeInteger(draft.version) || draft.version < 1)
    throw new TradingListingValidationError('version must be a positive integer.');
  exact(draft.trademarkAsset, 'trademarkAsset');
  exact(draft.commerceProfile, 'commerceProfile');
  exact(draft.commercialDirection, 'commercialDirection');
  exact(draft.aiProfile, 'aiProfile');
  draft.listingAssets.forEach((item, index) => exact(item, `listingAssets[${index}]`));
  if (!draft.listingAssets.length)
    throw new TradingListingValidationError(
      'Listing Draft requires approved public Listing Assets.'
    );
  distinct(draft.opportunityStory.bestForBuyerPersonaRefs, 'bestForBuyerPersonaRefs');
  distinct(draft.opportunityStory.whyThisMarkSellingPointRefs, 'whyThisMarkSellingPointRefs');
  distinct(draft.opportunityStory.buyingPointRefs, 'buyingPointRefs');
  distinct(draft.opportunityStory.endConsumerRefs, 'endConsumerRefs');
  distinct(draft.opportunityStory.operatorPersonaRefs, 'operatorPersonaRefs');
  distinct(draft.opportunityStory.scenarioRefs, 'scenarioRefs');
  distinct(draft.opportunityStory.assumptionRefs, 'assumptionRefs', false);
  required(draft.opportunityStory.businessOpportunitySummary, 'businessOpportunitySummary');
  if (!tradingListingMethods.includes(draft.listingMethod))
    throw new TradingListingValidationError('listingMethod is invalid.');
  if (draft.sellerRelationshipVerified !== false)
    throw new TradingListingValidationError('Seller declaration cannot claim verified ownership.');
  if (draft.status !== 'DRAFT')
    throw new TradingListingValidationError('A Listing Draft must remain private DRAFT state.');
}

export function assertTradingPublishedListingV1(
  listing: Readonly<TradingPublishedListingV1>
): void {
  assertTradingListingDraftV1(listing.publishedDraftSnapshot);
  if (listing.schemaVersion !== 1 || !listing.listingId.startsWith('trading-listing_'))
    throw new TradingListingValidationError('Published Listing identity is invalid.');
  exact(listing.draft, 'draft');
  if (
    listing.draft.id !== listing.publishedDraftSnapshot.listingDraftId ||
    listing.draft.version !== listing.publishedDraftSnapshot.version
  )
    throw new TradingListingValidationError(
      'Published Listing must freeze the exact reviewed draft.'
    );
  if (
    listing.publishReview.reviewState !== 'CURRENT' ||
    !listing.publishReview.humanApprovalReference?.trim()
  )
    throw new TradingListingValidationError(
      'Publication requires CURRENT review and explicit human approval.'
    );
  if (
    listing.publishReview.reviewedTrademarkAsset.id !==
      listing.publishedDraftSnapshot.trademarkAsset.id ||
    listing.publishReview.reviewedTrademarkAsset.version !==
      listing.publishedDraftSnapshot.trademarkAsset.version ||
    listing.publishReview.reviewedCommercialDirection.id !==
      listing.publishedDraftSnapshot.commercialDirection.id ||
    listing.publishReview.reviewedCommercialDirection.version !==
      listing.publishedDraftSnapshot.commercialDirection.version
  )
    throw new TradingListingValidationError(
      'Publish review must bind the exact truth and direction versions.'
    );
  if (listing.status !== 'PUBLISHED')
    throw new TradingListingValidationError('Published Listing status is invalid.');
}
