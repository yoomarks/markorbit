import type { ProductLoopExactReference } from './product-loop.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TradingSourceAssetId = `source-asset_${string}`;
export type TradingListingAssetId = `listing-asset_${string}`;
export type TradingSourceMediaReference = `source-media_${string}`;
export type TradingListingMediaReference = `listing-media_${string}`;

export const tradingSourceAssetOrigins = ['USER_PROVIDED', 'EXISTING_REAL_BRAND_MATERIAL'] as const;
export type TradingSourceAssetOrigin = (typeof tradingSourceAssetOrigins)[number];

export const tradingListingAssetContentClasses = ['EXISTING_ASSET', 'AI_CONCEPT'] as const;
export type TradingListingAssetContentClass = (typeof tradingListingAssetContentClasses)[number];

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
}
