import { createHash } from 'node:crypto';
import {
  assertTradingListingPublicationIntentV1,
  canonicalTradingListingPublicationIntentPayloadV1,
  type TradingListingPublicationCurrentnessReasonV1,
  type TradingListingPublicationCurrentnessStateV1,
  type TradingListingPublicationCurrentnessV1,
  type TradingListingPublicationIntentV1
} from '@markorbit/contracts';
import type { TradingListingAssetId } from '@markorbit/contracts/trading-asset-classification';
import type { TradingListingDraftId } from '@markorbit/contracts/trading-listing';
import type { TradingMarketplaceTargetBindingId } from '@markorbit/contracts/trading-marketplace-target-binding';
import type {
  PostgresTradingListingStore,
  TradingListingReviewId,
  TradingListingReviewRecordV1
} from './trading-listing.js';
import type {
  PostgresTradingListingAssetStore,
  TradingListingAssetCurrentnessV1
} from './trading-listing-asset.js';
import type {
  PostgresTradingMarketplaceTargetBindingStore,
  TradingMarketplaceTargetCurrentnessV1
} from './trading-marketplace-target-binding.js';

export interface TradingListingPublicationOwnerReader {
  getDraftVersion(
    workspaceId: string,
    id: TradingListingDraftId,
    version: number
  ): Promise<{
    workspaceId: string;
    version: number;
    listingAssets: readonly { id: TradingListingAssetId; version: string | number }[];
  }>;
  getLatestDraft(workspaceId: string, id: TradingListingDraftId): Promise<{ version: number }>;
  getReviewVersion(
    workspaceId: string,
    id: TradingListingReviewId,
    version: number
  ): Promise<TradingListingReviewRecordV1>;
  getLatestReview(workspaceId: string, id: TradingListingReviewId): Promise<{ version: number }>;
}

export interface TradingListingAssetCurrentnessReader {
  resolveCurrentness(
    workspaceId: string,
    id: TradingListingAssetId,
    version: number
  ): Promise<TradingListingAssetCurrentnessV1>;
}

export interface TradingMarketplaceTargetCurrentnessReader {
  resolveCurrentness(
    workspaceId: string,
    id: TradingMarketplaceTargetBindingId,
    version: number
  ): Promise<TradingMarketplaceTargetCurrentnessV1>;
}

const fingerprint = (intent: Readonly<TradingListingPublicationIntentV1>) =>
  createHash('sha256')
    .update(JSON.stringify(canonicalTradingListingPublicationIntentPayloadV1(intent)))
    .digest('hex');

const referencesEqual = (
  left: readonly { id: string; version: number }[],
  right: readonly { id: string; version: number }[]
) =>
  JSON.stringify([...left].sort((a, b) => a.id.localeCompare(b.id))) ===
  JSON.stringify([...right].sort((a, b) => a.id.localeCompare(b.id)));

export class TradingListingPublicationCurrentnessResolver {
  constructor(
    private readonly listings: TradingListingPublicationOwnerReader,
    private readonly assets: TradingListingAssetCurrentnessReader,
    private readonly targets: TradingMarketplaceTargetCurrentnessReader
  ) {}

  async resolve(
    workspaceId: string,
    intent: Readonly<TradingListingPublicationIntentV1>
  ): Promise<TradingListingPublicationCurrentnessV1> {
    const result = (
      state: TradingListingPublicationCurrentnessStateV1,
      reason: TradingListingPublicationCurrentnessReasonV1
    ): TradingListingPublicationCurrentnessV1 => ({
      schemaVersion: 1,
      workspaceId: workspaceId.toLowerCase(),
      actionKind: 'TRADING_LISTING_PUBLISH',
      effectFingerprintSha256: intent.effectFingerprintSha256,
      state,
      reason
    });

    try {
      assertTradingListingPublicationIntentV1(intent);
      if (intent.workspaceId.toLowerCase() !== workspaceId.toLowerCase())
        return result('UNKNOWN', 'WORKSPACE_MISMATCH');
      if (fingerprint(intent) !== intent.effectFingerprintSha256)
        return result('UNKNOWN', 'FINGERPRINT_MISMATCH');

      const [draft, latestDraft, review, latestReview] = await Promise.all([
        this.listings.getDraftVersion(
          workspaceId,
          intent.listingDraft.id,
          intent.listingDraft.version
        ),
        this.listings.getLatestDraft(workspaceId, intent.listingDraft.id),
        this.listings.getReviewVersion(
          workspaceId,
          intent.listingReview.id,
          intent.listingReview.version
        ),
        this.listings.getLatestReview(workspaceId, intent.listingReview.id)
      ]);
      if (draft.workspaceId.toLowerCase() !== workspaceId.toLowerCase())
        return result('UNKNOWN', 'WORKSPACE_MISMATCH');
      if (draft.version !== latestDraft.version) return result('STALE', 'DRAFT_STALE');
      if (review.version !== latestReview.version || review.review.reviewState !== 'CURRENT')
        return result('STALE', 'REVIEW_STALE');
      if (
        review.workspaceId.toLowerCase() !== workspaceId.toLowerCase() ||
        review.reviewedDraft.id !== intent.listingDraft.id ||
        review.reviewedDraft.version !== intent.listingDraft.version
      )
        return result('STALE', 'REVIEW_DRAFT_BINDING_DRIFT');

      const draftAssets = draft.listingAssets.flatMap((item) =>
        typeof item.version === 'number' && Number.isSafeInteger(item.version) && item.version > 0
          ? [{ id: item.id, version: item.version }]
          : []
      );
      if (
        draftAssets.length !== draft.listingAssets.length ||
        !referencesEqual(draftAssets, intent.listingAssets)
      )
        return result('STALE', 'LISTING_ASSET_DRIFT');

      const [assetStates, target] = await Promise.all([
        Promise.all(
          intent.listingAssets.map((asset) =>
            this.assets.resolveCurrentness(workspaceId, asset.id, asset.version)
          )
        ),
        this.targets.resolveCurrentness(
          workspaceId,
          intent.marketplaceTargetBinding.id,
          intent.marketplaceTargetBinding.version
        )
      ]);
      if (
        assetStates.some((value) => value.state === 'UNAVAILABLE') ||
        target.state === 'UNAVAILABLE'
      )
        return result('UNAVAILABLE', 'OWNER_UNAVAILABLE');
      if (
        assetStates.some((value) => value.state === 'UNKNOWN' || value.state === 'NOT_FOUND') ||
        target.state === 'UNKNOWN'
      )
        return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
      if (assetStates.some((value) => value.state === 'STALE'))
        return result('STALE', 'LISTING_ASSET_DRIFT');
      if (target.state === 'REVOKED') return result('REVOKED', 'TARGET_BINDING_REVOKED');
      if (target.state === 'STALE') return result('STALE', 'TARGET_BINDING_STALE');
      return result('CURRENT', 'EXACT_INTENT_CURRENT');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'PERSISTENCE_UNAVAILABLE') return result('UNAVAILABLE', 'OWNER_UNAVAILABLE');
      return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
    }
  }
}

export function createPostgresTradingListingPublicationCurrentnessResolver(
  listings: PostgresTradingListingStore,
  assets: PostgresTradingListingAssetStore,
  targets: PostgresTradingMarketplaceTargetBindingStore
) {
  return new TradingListingPublicationCurrentnessResolver(listings, assets, targets);
}
