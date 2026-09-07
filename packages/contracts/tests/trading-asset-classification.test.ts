import { describe, expect, it } from 'vitest';
import {
  assertTradingAssetClassificationV1,
  noTradingAssetClassificationAuthorityConsequencesV1,
  type TradingListingAssetV1,
  type TradingSourceAssetV1
} from '../src/trading-asset-classification.js';

const sourceAsset = (): TradingSourceAssetV1 => ({
  schemaVersion: 1,
  classification: 'SOURCE_ASSET',
  sourceAssetId: 'source-asset_contract-1',
  version: 1,
  workspaceId: 'workspace-contract-1',
  trademarkAsset: { id: 'trademark-asset_contract-1', version: 3 },
  mediaReference: 'source-media_private-original-1',
  owner: { ownerReference: 'workspace-contract-1', ownerVersion: 4 },
  origin: 'USER_PROVIDED',
  visibility: 'PRIVATE',
  createdAt: '2026-09-07T12:00:00.000Z',
  authorityConsequences: noTradingAssetClassificationAuthorityConsequencesV1
});

const listingAsset = (): TradingListingAssetV1 => ({
  schemaVersion: 1,
  classification: 'LISTING_ASSET',
  listingAssetId: 'listing-asset_contract-1',
  version: 1,
  trademarkAsset: { id: 'trademark-asset_contract-1', version: 3 },
  mediaReference: 'listing-media_public-concept-1',
  owner: { ownerReference: 'lite-trading', ownerVersion: 'asset-contract-v1' },
  contentClass: 'AI_CONCEPT',
  provenanceReferences: ['source-asset_contract-1@1', 'generation-run_contract-1@2'],
  publicationApprovalReference: 'asset-publication-approval_contract-1',
  visibility: 'LISTING_PUBLIC',
  aiConceptLabel: true,
  createdAt: '2026-09-07T12:05:00.000Z',
  authorityConsequences: noTradingAssetClassificationAuthorityConsequencesV1
});

describe('Lite Trading asset classification V1 contract', () => {
  it('keeps private Source Assets and approved Listing Assets as distinct identities', () => {
    expect(() => assertTradingAssetClassificationV1(sourceAsset())).not.toThrow();
    expect(() => assertTradingAssetClassificationV1(listingAsset())).not.toThrow();
    expect(sourceAsset().sourceAssetId).not.toBe(listingAsset().listingAssetId);
  });

  it('never accepts a public Source Asset or its private media as a Listing Asset', () => {
    expect(() =>
      assertTradingAssetClassificationV1({
        ...sourceAsset(),
        visibility: 'LISTING_PUBLIC'
      } as unknown as TradingSourceAssetV1)
    ).toThrow(/Source Assets must remain PRIVATE/u);
    expect(() =>
      assertTradingAssetClassificationV1({
        ...listingAsset(),
        mediaReference: sourceAsset().mediaReference
      } as unknown as TradingListingAssetV1)
    ).toThrow(/distinct public Listing Media reference/u);
  });

  it('requires separate public identity, provenance and explicit publication approval', () => {
    expect(() =>
      assertTradingAssetClassificationV1({
        ...listingAsset(),
        listingAssetId: 'source-asset_contract-1'
      } as unknown as TradingListingAssetV1)
    ).toThrow(/Listing Asset id/u);
    expect(() =>
      assertTradingAssetClassificationV1({ ...listingAsset(), provenanceReferences: [] })
    ).toThrow(/provenanceReferences/u);
    expect(() =>
      assertTradingAssetClassificationV1({ ...listingAsset(), publicationApprovalReference: '' })
    ).toThrow(/publicationApprovalReference/u);
  });

  it('preserves the AI concept label on public concept assets', () => {
    expect(() =>
      assertTradingAssetClassificationV1({ ...listingAsset(), aiConceptLabel: false })
    ).toThrow(/AI concept label/u);
    expect(() =>
      assertTradingAssetClassificationV1({
        ...listingAsset(),
        contentClass: 'EXISTING_ASSET',
        aiConceptLabel: false
      })
    ).not.toThrow();
  });

  it('cannot claim publication, legal-truth mutation or verified ownership', () => {
    expect(() =>
      assertTradingAssetClassificationV1({
        ...listingAsset(),
        authorityConsequences: {
          ...noTradingAssetClassificationAuthorityConsequencesV1,
          listingPublished: true
        } as unknown as TradingListingAssetV1['authorityConsequences']
      })
    ).toThrow(/listingPublished/u);
    expect(noTradingAssetClassificationAuthorityConsequencesV1).toEqual({
      sourceAssetPublished: false,
      listingPublished: false,
      marketplacePublicationCreated: false,
      trademarkTruthMutated: false,
      ownershipOrAuthorityVerified: false
    });
  });
});
