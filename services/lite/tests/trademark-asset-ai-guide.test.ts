import { describe, expect, it } from 'vitest';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import { TrademarkAssetAiGuidePreparer } from '../src/trademark-asset-ai-guide.js';

const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'matter_1',
  sourceVersion: '7',
  observedAt: '2026-08-19T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;

const view: TrademarkAssetView = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_test',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  anchorVersion: 3,
  anchor: {
    schemaVersion: 1,
    trademarkAssetId: 'trademark-asset_test',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    version: 3,
    identity: { jurisdiction: 'US', markText: 'MARK ORBIT' },
    externalIdentifiers: [],
    workspaceRelationships: [
      { kind: 'REPRESENTED', sourceAssetEditableByWorkspace: true }
    ],
    sourceReferences: [source],
    relations: [],
    workspaceTags: [],
    workspaceNotes: [],
    officialTruthVerifiedByLite: false,
    filingExecutedByLite: false,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z'
  },
  observedFacts: [
    {
      kind: 'OWNER_NAME',
      value: 'Example Owner',
      source,
      freshness: 'CURRENT',
      consequential: true,
      officialTruthVerifiedByLite: false
    }
  ],
  contextSignals: [
    {
      kind: 'RECOMMENDED_ACTION',
      value: 'Review the next lifecycle step',
      source,
      freshness: 'CURRENT',
      advisory: true,
      executionAuthorized: false
    }
  ],
  conflicts: [],
  sourceReferences: [source],
  freshness: 'CURRENT',
  composedAt: '2026-08-19T00:00:00.000Z',
  officialTruthVerifiedByLite: false,
  legalDeadlineCertified: false,
  protectedActionAuthorized: false
};

describe('TrademarkAssetAiGuidePreparer', () => {
  it('prepares evidence-grounded suggestions without creating authority', () => {
    const preparer = new TrademarkAssetAiGuidePreparer(
      () => '2026-08-19T01:00:00.000Z',
      () => '00000000-0000-4000-8000-000000000001'
    );
    const result = preparer.prepare({
      workspaceId: view.workspaceId,
      subjectUserId: 'user_1',
      view,
      requestedKinds: ['EXPLAIN_ASSET', 'IDENTIFY_MISSING_INFORMATION', 'PREPARE_OWNER_ACTION_CANDIDATE']
    });

    expect(result.suggestions).toHaveLength(3);
    expect(result.evidence).toEqual([source]);
    expect(result.suggestions.every((item) => item.officialTruthVerified === false)).toBe(true);
    expect(result.suggestions.every((item) => item.externalActionAuthorized === false)).toBe(true);
    expect(result.officialTruthCreatedByGuide).toBe(false);
    expect(result.deadlineCertifiedByGuide).toBe(false);
    expect(result.externalActionAuthorizedByGuide).toBe(false);
  });

  it('surfaces stale or conflicting evidence instead of hiding it', () => {
    const preparer = new TrademarkAssetAiGuidePreparer(
      () => '2026-08-19T01:00:00.000Z',
      () => '00000000-0000-4000-8000-000000000002'
    );
    const result = preparer.prepare({
      workspaceId: view.workspaceId,
      subjectUserId: 'user_1',
      view: {
        ...view,
        freshness: 'CONFLICTING',
        conflicts: [
          {
            kind: 'OWNER_NAME',
            values: ['Example Owner', 'Another Owner'],
            evidence: [source],
            unresolved: true
          }
        ]
      },
      requestedKinds: ['PREPARE_CHECKLIST']
    });

    expect(result.staleOrConflictingEvidencePresent).toBe(true);
    expect(result.suggestions[0]?.staleOrConflictingEvidencePresent).toBe(true);
    expect(result.suggestions[0]?.explanation).toContain('unresolved conflicting observations');
  });

  it('consumes bounded Commerce and Marketplace context without mutating source truth', () => {
    const preparer = new TrademarkAssetAiGuidePreparer(
      () => '2026-08-19T01:00:00.000Z',
      () => '00000000-0000-4000-8000-000000000003'
    );
    const marketplaceSource = {
      owner: 'MARKETPLACE',
      kind: 'MARKETPLACE_LISTING',
      sourceId: 'listing_1',
      sourceVersion: '9',
      observedAt: '2026-08-19T00:30:00.000Z',
      freshness: 'CURRENT'
    } as const;
    const result = preparer.prepare({
      workspaceId: view.workspaceId,
      subjectUserId: 'user_1',
      view,
      commerceProfile: {
        schemaVersion: 1,
        commerceProfileId: 'trademark-asset-commerce_test',
        workspaceId: view.workspaceId,
        trademarkAssetId: view.trademarkAssetId,
        trademarkAssetVersion: view.anchorVersion,
        version: 2,
        saleIntent: 'FOR_SALE',
        negotiable: true,
        saleTerritories: ['US'],
        sellerRole: 'AUTHORIZED_REPRESENTATIVE',
        headline: 'A compact commerce angle',
        sellingPoints: ['Strong category fit'],
        aiTags: [],
        mediaAssetReferences: [],
        marketplaceListingCreatedByLite: false,
        sourceTrademarkFactsMutatedByLite: false,
        createdAt: '2026-08-19T00:20:00.000Z',
        updatedAt: '2026-08-19T00:20:00.000Z'
      },
      marketplaceOverlay: {
        schemaVersion: 1,
        marketplaceOverlayId: 'trademark-asset-marketplace-overlay_test',
        workspaceId: view.workspaceId,
        trademarkAssetId: view.trademarkAssetId,
        trademarkAssetVersion: view.anchorVersion,
        version: 4,
        source: {
          sourceAssetId: 'market_asset_1',
          sourceListingId: 'listing_1',
          sourceListingVersion: '9',
          sourceReference: marketplaceSource,
          observedAt: '2026-08-19T00:30:00.000Z'
        },
        privateTags: [],
        privateNotes: [],
        favorite: true,
        headline: 'Private reseller angle',
        sellingPoints: ['Prepared for a customer shortlist'],
        aiTags: [],
        mediaAssetReferences: [],
        customerRecommendationReferences: [],
        localPriceOverrideAllowed: false,
        sourceListingMutableByWorkspace: false,
        sourceTrademarkFactsMutableByWorkspace: false,
        ownershipClaimCreatedByLite: false,
        marketplacePublicationCreatedByLite: false,
        transactionAuthorizedByLite: false,
        createdAt: '2026-08-19T00:30:00.000Z',
        updatedAt: '2026-08-19T00:30:00.000Z'
      },
      requestedKinds: ['PREPARE_CONTENT_CANDIDATE']
    });

    expect(result.contextReferences.map((item) => item.kind)).toEqual([
      'ASSET_COMPOSITION',
      'COMMERCE_PROFILE',
      'MARKETPLACE_OVERLAY'
    ]);
    expect(result.evidence).toContainEqual(marketplaceSource);
    expect(result.suggestions[0]?.explanation).toContain('A compact commerce angle');
    expect(result.suggestions[0]?.externalActionAuthorized).toBe(false);
    expect(result.officialTruthCreatedByGuide).toBe(false);
  });
});
