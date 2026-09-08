import type { ProductLoopExactReference } from './product-loop.js';
import type {
  TradingAiProfileId,
  TradingAiProfileV1,
  TradingBuyingPointId,
  TradingCommercialPersonaId,
  TradingCommercialScenarioId
} from './trading-ai-profile.js';
import type {
  TradingCommercialDirectionId,
  TradingCommercialDirectionVersionV1
} from './trading-commercial-direction.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TradingSourceAssetId = `source-asset_${string}`;
export type TradingListingAssetId = `listing-asset_${string}`;
export type TradingSourceMediaReference = `source-media_${string}`;
export type TradingListingMediaReference = `listing-media_${string}`;

export const tradingSourceAssetOrigins = ['USER_PROVIDED', 'EXISTING_REAL_BRAND_MATERIAL'] as const;
export type TradingSourceAssetOrigin = (typeof tradingSourceAssetOrigins)[number];

export const tradingListingAssetContentClasses = ['EXISTING_ASSET', 'AI_CONCEPT'] as const;
export type TradingListingAssetContentClass = (typeof tradingListingAssetContentClasses)[number];

export const tradingVisualCreativeRoles = [
  'HERO',
  'BRAND_WORLD',
  'PACKAGING',
  'PRODUCT_SCENE',
  'CHANNEL_ASSET'
] as const;
export type TradingVisualCreativeRole = (typeof tradingVisualCreativeRoles)[number];

export interface TradingAssetOwnerReferenceV1 {
  ownerReference: string;
  ownerVersion: number | string;
}

export const noTradingAssetClassificationAuthorityConsequencesV1 = Object.freeze({
  sourceAssetPublished: false,
  listingPublished: false,
  marketplacePublicationCreated: false,
  trademarkTruthMutated: false,
  ownershipOrAuthorityVerified: false
});
export type TradingAssetClassificationAuthorityConsequencesV1 =
  typeof noTradingAssetClassificationAuthorityConsequencesV1;

interface TradingAssetBaseV1 {
  schemaVersion: 1;
  version: number;
  trademarkAsset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  owner: Readonly<TradingAssetOwnerReferenceV1>;
  createdAt: string;
  authorityConsequences: TradingAssetClassificationAuthorityConsequencesV1;
}

/** Private real material used as an input. Creating this record never approves publication. */
export interface TradingSourceAssetV1 extends TradingAssetBaseV1 {
  classification: 'SOURCE_ASSET';
  sourceAssetId: TradingSourceAssetId;
  workspaceId: string;
  mediaReference: TradingSourceMediaReference;
  origin: TradingSourceAssetOrigin;
  visibility: 'PRIVATE';
}

/**
 * A distinct, explicitly approved public representation for a future Listing. It is not the
 * Source Asset record and does not itself publish a Listing.
 */
export interface TradingListingAssetV1 extends TradingAssetBaseV1 {
  classification: 'LISTING_ASSET';
  listingAssetId: TradingListingAssetId;
  mediaReference: TradingListingMediaReference;
  contentClass: TradingListingAssetContentClass;
  provenanceReferences: readonly string[];
  publicationApprovalReference: string;
  visibility: 'LISTING_PUBLIC';
  aiConceptLabel: boolean;
  commercialDirection?: Readonly<ProductLoopExactReference<TradingCommercialDirectionId>>;
  aiProfile?: Readonly<ProductLoopExactReference<TradingAiProfileId>>;
  targetAudienceRefs?: readonly TradingCommercialPersonaId[];
  buyingPointRefs?: readonly TradingBuyingPointId[];
  scenarioRefs?: readonly TradingCommercialScenarioId[];
  creativeRole?: TradingVisualCreativeRole;
}

export type TradingAssetReferenceV1 = TradingSourceAssetV1 | TradingListingAssetV1;

export class TradingAssetClassificationValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingAssetClassificationValidationError';
  }
}

function required(value: string, field: string): void {
  if (!value.trim()) throw new TradingAssetClassificationValidationError(`${field} is required.`);
}

function positiveVersion(value: number | string, field: string): void {
  if (
    (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 1)) ||
    (typeof value === 'string' && !value.trim())
  )
    throw new TradingAssetClassificationValidationError(`${field} must identify a version.`);
}

function assertNoAuthority(consequences: TradingAssetClassificationAuthorityConsequencesV1): void {
  for (const [key, value] of Object.entries(consequences)) {
    if (value !== false)
      throw new TradingAssetClassificationValidationError(
        `tradingAsset.authorityConsequences.${key} must be false.`
      );
  }
}

function sameReference(
  left: Readonly<ProductLoopExactReference>,
  right: Readonly<ProductLoopExactReference>
): boolean {
  return left.id === right.id && left.version === right.version;
}

function assertDistinctReferences(values: readonly string[] | undefined, field: string): void {
  if (values?.some((value) => !value.trim()) || (values && new Set(values).size !== values.length))
    throw new TradingAssetClassificationValidationError(
      `${field} must contain distinct non-empty references.`
    );
}

/** Enforces the classification boundary without creating, approving or publishing either asset. */
export function assertTradingAssetClassificationV1(asset: Readonly<TradingAssetReferenceV1>): void {
  if (asset.schemaVersion !== 1)
    throw new TradingAssetClassificationValidationError('tradingAsset.schemaVersion must be 1.');
  if (!Number.isSafeInteger(asset.version) || asset.version < 1)
    throw new TradingAssetClassificationValidationError(
      'tradingAsset.version must be a positive integer.'
    );
  if (!/^trademark-asset_[A-Za-z0-9_-]+$/u.test(asset.trademarkAsset.id))
    throw new TradingAssetClassificationValidationError(
      'tradingAsset.trademarkAsset.id must be a Trademark Asset id.'
    );
  positiveVersion(asset.trademarkAsset.version, 'tradingAsset.trademarkAsset.version');
  required(asset.owner.ownerReference, 'tradingAsset.owner.ownerReference');
  positiveVersion(asset.owner.ownerVersion, 'tradingAsset.owner.ownerVersion');
  if (Number.isNaN(Date.parse(asset.createdAt)))
    throw new TradingAssetClassificationValidationError(
      'tradingAsset.createdAt must be an ISO timestamp.'
    );
  assertNoAuthority(asset.authorityConsequences);

  if (asset.classification === 'SOURCE_ASSET') {
    if (!/^source-asset_[A-Za-z0-9_-]+$/u.test(asset.sourceAssetId))
      throw new TradingAssetClassificationValidationError('Source Asset id is invalid.');
    if (!/^source-media_[A-Za-z0-9_-]+$/u.test(asset.mediaReference))
      throw new TradingAssetClassificationValidationError(
        'Source Assets must use a private Source Media reference.'
      );
    if (asset.visibility !== 'PRIVATE')
      throw new TradingAssetClassificationValidationError('Source Assets must remain PRIVATE.');
    return;
  }

  if (!/^listing-asset_[A-Za-z0-9_-]+$/u.test(asset.listingAssetId))
    throw new TradingAssetClassificationValidationError('Listing Asset id is invalid.');
  if (!/^listing-media_[A-Za-z0-9_-]+$/u.test(asset.mediaReference))
    throw new TradingAssetClassificationValidationError(
      'Listing Assets must use a distinct public Listing Media reference.'
    );
  if (asset.visibility !== 'LISTING_PUBLIC')
    throw new TradingAssetClassificationValidationError(
      'Listing Assets must use LISTING_PUBLIC visibility.'
    );
  if (!asset.provenanceReferences.length || asset.provenanceReferences.some((item) => !item.trim()))
    throw new TradingAssetClassificationValidationError(
      'Listing Assets require provenanceReferences.'
    );
  required(asset.publicationApprovalReference, 'tradingAsset.publicationApprovalReference');
  if (asset.aiConceptLabel !== (asset.contentClass === 'AI_CONCEPT'))
    throw new TradingAssetClassificationValidationError(
      'AI Concept Listing Assets must retain an explicit AI concept label.'
    );
  assertDistinctReferences(asset.targetAudienceRefs, 'tradingAsset.targetAudienceRefs');
  assertDistinctReferences(asset.buyingPointRefs, 'tradingAsset.buyingPointRefs');
  assertDistinctReferences(asset.scenarioRefs, 'tradingAsset.scenarioRefs');
  if (asset.creativeRole !== undefined && !tradingVisualCreativeRoles.includes(asset.creativeRole))
    throw new TradingAssetClassificationValidationError('tradingAsset.creativeRole is invalid.');
}

/** Validates optional commercial-intent provenance against exact T1 owner snapshots. */
export function assertTradingListingAssetCommercialIntentV1(
  asset: Readonly<TradingListingAssetV1>,
  direction: Readonly<TradingCommercialDirectionVersionV1>,
  profile: Readonly<TradingAiProfileV1>
): void {
  if (
    !asset.commercialDirection ||
    asset.commercialDirection.id !== direction.commercialDirectionId ||
    asset.commercialDirection.version !== direction.version
  )
    throw new TradingAssetClassificationValidationError(
      'Commercial-intent Listing Assets must reference the exact DirectionVersion.'
    );
  if (
    !asset.aiProfile ||
    asset.aiProfile.id !== profile.aiProfileId ||
    asset.aiProfile.version !== profile.version ||
    !direction.aiProfile ||
    !sameReference(direction.aiProfile, asset.aiProfile) ||
    !sameReference(asset.trademarkAsset, profile.trademarkAsset)
  )
    throw new TradingAssetClassificationValidationError(
      'Commercial-intent Listing Assets must reference the exact AI Profile and Trademark Asset.'
    );
  const allowed = {
    targetAudienceRefs: new Set([
      ...(direction.targetConsumerRefs ?? []),
      ...(direction.operatorPersonaRefs ?? []),
      ...(direction.trademarkBuyerPersonaRefs ?? [])
    ]),
    buyingPointRefs: new Set(direction.buyingPointRefs ?? []),
    scenarioRefs: new Set(direction.scenarioRefs ?? [])
  };
  for (const field of Object.keys(allowed) as (keyof typeof allowed)[]) {
    const references = asset[field];
    if (references?.some((reference) => !allowed[field].has(reference as never)))
      throw new TradingAssetClassificationValidationError(
        `tradingAsset.${field} must be present on the exact DirectionVersion.`
      );
  }
  if (
    !asset.creativeRole &&
    !asset.targetAudienceRefs?.length &&
    !asset.buyingPointRefs?.length &&
    !asset.scenarioRefs?.length
  )
    throw new TradingAssetClassificationValidationError(
      'Commercial-intent Listing Assets require at least one commercial-intent semantic.'
    );
}
