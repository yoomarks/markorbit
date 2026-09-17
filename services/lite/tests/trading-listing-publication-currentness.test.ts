import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalTradingListingPublicationIntentPayloadV1,
  type TradingListingPublicationIntentV1
} from '@markorbit/contracts';
import { TradingListingPublicationCurrentnessResolver } from '../src/trading-listing-publication-currentness.js';

const workspaceId = '018f0000-0000-7000-8000-000000001176';
const base = {
  schemaVersion: 1,
  actionKind: 'TRADING_LISTING_PUBLISH',
  workspaceId,
  listingDraft: { id: 'trading-listing-draft_1176', version: 3 },
  listingReview: { id: 'trading-listing-review_1176', version: 2 },
  listingAssets: [{ id: 'listing-asset_1176', version: 4 }],
  marketplaceTargetBinding: { id: 'trading-marketplace-target-binding_1176', version: 5 },
  effectFingerprintSha256: '0'.repeat(64)
} as TradingListingPublicationIntentV1;
const intent = {
  ...base,
  effectFingerprintSha256: createHash('sha256')
    .update(JSON.stringify(canonicalTradingListingPublicationIntentPayloadV1(base)))
    .digest('hex')
};

function resolver(
  overrides: {
    draftVersion?: number;
    reviewVersion?: number;
    reviewedDraftVersion?: number;
    reviewState?: 'CURRENT' | 'STALE' | 'CONFLICT';
    draftAssets?: readonly { id: `listing-asset_${string}`; version: number }[];
    assetState?: 'CURRENT' | 'STALE' | 'NOT_FOUND' | 'UNKNOWN' | 'UNAVAILABLE';
    targetState?: 'CURRENT' | 'STALE' | 'REVOKED' | 'UNKNOWN' | 'UNAVAILABLE';
  } = {}
) {
  return new TradingListingPublicationCurrentnessResolver(
    {
      getDraftVersion: () =>
        Promise.resolve({
          workspaceId,
          version: 3,
          listingAssets: overrides.draftAssets ?? intent.listingAssets
        }),
      getLatestDraft: () => Promise.resolve({ version: overrides.draftVersion ?? 3 }),
      getReviewVersion: () =>
        Promise.resolve({
          schemaVersion: 1,
          listingReviewId: intent.listingReview.id,
          workspaceId,
          version: 2,
          reviewedDraft: {
            id: intent.listingDraft.id,
            version: overrides.reviewedDraftVersion ?? 3
          },
          review: {
            reviewedTrademarkAsset: { id: 'asset', version: 1 },
            reviewedCommercialDirection: { id: 'direction', version: 1 },
            reviewedShowcase: { id: 'trading-showcase_1176', version: 1 },
            reviewState: overrides.reviewState ?? 'CURRENT',
            reviewedAt: '2026-09-17T00:00:00.000Z'
          }
        } as never),
      getLatestReview: () => Promise.resolve({ version: overrides.reviewVersion ?? 2 })
    },
    {
      resolveCurrentness: (_workspace, asset) =>
        Promise.resolve({
          schemaVersion: 1,
          workspaceId,
          listingAsset: { id: asset, version: 4 },
          state: overrides.assetState ?? 'CURRENT'
        })
    },
    {
      resolveCurrentness: (_workspace, target) =>
        Promise.resolve({
          schemaVersion: 1,
          workspaceId,
          targetBinding: { id: target, version: 5 },
          state: overrides.targetState ?? 'CURRENT'
        })
    }
  );
}

describe('Trading Listing publication composite currentness', () => {
  it('returns CURRENT only when every exact durable owner is current', async () => {
    await expect(resolver().resolve(workspaceId, intent)).resolves.toMatchObject({
      state: 'CURRENT',
      reason: 'EXACT_INTENT_CURRENT'
    });
  });

  it.each([
    [{ draftVersion: 4 }, 'DRAFT_STALE'],
    [{ reviewVersion: 3 }, 'REVIEW_STALE'],
    [{ reviewState: 'STALE' }, 'REVIEW_STALE'],
    [{ reviewedDraftVersion: 2 }, 'REVIEW_DRAFT_BINDING_DRIFT'],
    [{ draftAssets: [{ id: 'listing-asset_other', version: 1 }] }, 'LISTING_ASSET_DRIFT'],
    [{ assetState: 'STALE' }, 'LISTING_ASSET_DRIFT'],
    [{ targetState: 'STALE' }, 'TARGET_BINDING_STALE']
  ] as const)('fails stale for %o', async (override, reason) => {
    await expect(resolver(override).resolve(workspaceId, intent)).resolves.toMatchObject({
      state: 'STALE',
      reason
    });
  });

  it('preserves REVOKED, UNKNOWN, and UNAVAILABLE as distinct fail-closed states', async () => {
    await expect(
      resolver({ targetState: 'REVOKED' }).resolve(workspaceId, intent)
    ).resolves.toMatchObject({ state: 'REVOKED' });
    await expect(
      resolver({ assetState: 'UNKNOWN' }).resolve(workspaceId, intent)
    ).resolves.toMatchObject({ state: 'UNKNOWN' });
    await expect(
      resolver({ targetState: 'UNAVAILABLE' }).resolve(workspaceId, intent)
    ).resolves.toMatchObject({ state: 'UNAVAILABLE' });
  });

  it('fails closed on Workspace and fingerprint mismatch', async () => {
    await expect(
      resolver().resolve('018f0000-0000-7000-8000-000000001177', intent)
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'WORKSPACE_MISMATCH' });
    await expect(
      resolver().resolve(workspaceId, { ...intent, effectFingerprintSha256: 'f'.repeat(64) })
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'FINGERPRINT_MISMATCH' });
  });
});
