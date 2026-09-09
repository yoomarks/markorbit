import { describe, expect, it } from 'vitest';
import {
  assertTradingAssetClassificationV1,
  assertTradingListingAssetCommercialIntentV1,
  assertRequestTradingStudioVisualRetryCommandV1,
  assertTradingStudioVisualAssetV1,
  assertTradingStudioVisualQualityReviewV1,
  noTradingAssetClassificationAuthorityConsequencesV1,
  noTradingStudioVisualQualityAuthorityConsequencesV1,
  type RequestTradingStudioVisualRetryCommandV1,
  type TradingListingAssetV1,
  type TradingSourceAssetV1,
  type TradingStudioVisualAssetV1,
  type TradingStudioVisualQualityReviewV1
} from '../src/trading-asset-classification.js';
import { noTradingAiAuthorityConsequencesV1 } from '../src/trading-ai-provenance.js';
import type { TradingAiProfileV1 } from '../src/trading-ai-profile.js';
import type { TradingCommercialDirectionVersionV1 } from '../src/trading-commercial-direction.js';
import type { TradingDirectionSelectionV1 } from '../src/trading-direction-selection.js';

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

const commercialListingAsset = (): TradingListingAssetV1 => ({
  ...listingAsset(),
  commercialDirection: {
    id: 'trading-ai-derived_commercial-direction_contract-1',
    version: 2
  },
  aiProfile: { id: 'trading-ai-derived_ai-profile_contract-1', version: 3 },
  targetAudienceRefs: ['trading-commercial-persona_end-consumer-1'],
  buyingPointRefs: ['trading-buying-point_fast-launch-1'],
  scenarioRefs: ['trading-commercial-scenario_dtc-launch-1'],
  creativeRole: 'HERO'
});

const direction = {
  commercialDirectionId: 'trading-ai-derived_commercial-direction_contract-1',
  version: 2,
  aiProfile: { id: 'trading-ai-derived_ai-profile_contract-1', version: 3 },
  targetConsumerRefs: ['trading-commercial-persona_end-consumer-1'],
  operatorPersonaRefs: ['trading-commercial-persona_operator-1'],
  trademarkBuyerPersonaRefs: ['trading-commercial-persona_buyer-1'],
  buyingPointRefs: ['trading-buying-point_fast-launch-1'],
  scenarioRefs: ['trading-commercial-scenario_dtc-launch-1']
} as unknown as TradingCommercialDirectionVersionV1;

const profile = {
  aiProfileId: 'trading-ai-derived_ai-profile_contract-1',
  version: 3,
  trademarkAsset: { id: 'trademark-asset_contract-1', version: 3 }
} as unknown as TradingAiProfileV1;

const selection = {
  directionSelectionId: 'trading-direction-selection_contract-1',
  workspaceId: 'workspace-contract-1',
  version: 1,
  status: 'CURRENT',
  selectedDirection: {
    id: 'trading-ai-derived_commercial-direction_contract-1',
    version: 2
  }
} as unknown as TradingDirectionSelectionV1;

const studioVisualAsset = (): TradingStudioVisualAssetV1 => ({
  schemaVersion: 1,
  classification: 'STUDIO_VISUAL_ASSET',
  studioVisualAssetId: 'trading-ai-derived_visual-asset_contract-1',
  version: 1,
  workspaceId: 'workspace-contract-1',
  trademarkAsset: { id: 'trademark-asset_contract-1', version: 3 },
  owner: { ownerReference: 'lite-trading-studio', ownerVersion: 1 },
  mediaReference: 'studio-media_private-concept-1',
  directionSelection: { id: 'trading-direction-selection_contract-1', version: 1 },
  commercialDirection: {
    id: 'trading-ai-derived_commercial-direction_contract-1',
    version: 2
  },
  aiProfile: { id: 'trading-ai-derived_ai-profile_contract-1', version: 3 },
  sourceAssets: [{ id: 'source-asset_contract-1', version: 1 }],
  generationRecipeReference: 'generation-recipe_hero-v1',
  provenance: {
    schemaVersion: 1,
    derivedObject: { id: 'trading-ai-derived_visual-asset_contract-1', version: 1 },
    truthClass: 'AI_CONCEPT',
    trademarkAsset: { id: 'trademark-asset_contract-1', version: 3 },
    sourceReferences: [
      {
        ownerReference: 'lite-trading-selection',
        sourceId: 'trading-direction-selection_contract-1',
        sourceVersion: 1
      },
      {
        ownerReference: 'lite-trading-direction',
        sourceId: 'trading-ai-derived_commercial-direction_contract-1',
        sourceVersion: 2
      },
      {
        ownerReference: 'lite-trading-profile',
        sourceId: 'trading-ai-derived_ai-profile_contract-1',
        sourceVersion: 3
      },
      {
        ownerReference: 'lite-trading-assets',
        sourceId: 'source-asset_contract-1',
        sourceVersion: 1
      }
    ],
    implementation: {
      implementationProfileId: 'implementation-profile_visual-generation',
      implementationProfileVersion: 1,
      implementationKey: 'visual-generation/default',
      provider: 'provider-a',
      model: 'image-model-1',
      promptPolicyId: 'prompt-policy_studio-build',
      promptPolicyVersion: '1.0.0',
      outputSchemaId: 'trading-studio-visual-asset-v1',
      inputSha256: 'a'.repeat(64),
      providerRequestId: 'provider-request-visual-1',
      startedAt: '2026-09-07T12:00:00.000Z',
      completedAt: '2026-09-07T12:00:04.000Z'
    },
    createdAt: '2026-09-07T12:05:00.000Z',
    currentness: { state: 'CURRENT', evaluatedAt: '2026-09-07T12:05:00.000Z' },
    authorityConsequences: noTradingAiAuthorityConsequencesV1
  },
  targetAudienceRefs: ['trading-commercial-persona_end-consumer-1'],
  buyingPointRefs: ['trading-buying-point_fast-launch-1'],
  scenarioRefs: ['trading-commercial-scenario_dtc-launch-1'],
  creativeRole: 'HERO',
  visibility: 'PRIVATE',
  publicationEligibility: 'NOT_ELIGIBLE',
  aiConceptLabel: true,
  createdAt: '2026-09-07T12:05:00.000Z',
  authorityConsequences: noTradingAssetClassificationAuthorityConsequencesV1
});

const failedQualityReview = (): TradingStudioVisualQualityReviewV1 => ({
  schemaVersion: 1,
  visualQualityReviewId: 'trading-studio-visual-quality-review_contract-1',
  workspaceId: 'workspace-contract-1',
  version: 1,
  studioVisualAsset: { id: 'trading-ai-derived_visual-asset_contract-1', version: 1 },
  status: 'FAIL',
  findings: [{ code: 'MARK_SPELLING_DRIFT', message: 'Generated mark spelling changed.' }],
  retryDisposition: 'RETRY_ALLOWED',
  reviewedAt: '2026-09-07T12:06:00.000Z',
  authorityConsequences: noTradingStudioVisualQualityAuthorityConsequencesV1
});

const retryCommand = (): RequestTradingStudioVisualRetryCommandV1 => ({
  schemaVersion: 1,
  studioVisualAssetId: 'trading-ai-derived_visual-asset_contract-1',
  expectedAssetVersion: 1,
  visualQualityReviewId: 'trading-studio-visual-quality-review_contract-1',
  expectedReviewVersion: 1,
  attemptNumber: 1,
  reason: 'Retry only the failed hero while preserving the selected direction.',
  idempotencyKey: 'visual-retry-contract-1',
  correlationId: 'correlation_visual-retry-1'
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

  it('preserves commercial intent against exact DirectionVersion and AI Profile owners', () => {
    const asset = commercialListingAsset();
    expect(() => assertTradingAssetClassificationV1(asset)).not.toThrow();
    expect(() =>
      assertTradingListingAssetCommercialIntentV1(asset, direction, profile)
    ).not.toThrow();

    expect(() =>
      assertTradingListingAssetCommercialIntentV1(
        { ...asset, buyingPointRefs: ['trading-buying-point_unknown'] },
        direction,
        profile
      )
    ).toThrow(/buyingPointRefs.*exact DirectionVersion/u);
    expect(() =>
      assertTradingListingAssetCommercialIntentV1(
        { ...asset, commercialDirection: { ...asset.commercialDirection!, version: 1 } },
        direction,
        profile
      )
    ).toThrow(/exact DirectionVersion/u);
  });

  it('does not add commercial-intent fields to private Source Assets', () => {
    expect(sourceAsset()).not.toHaveProperty('commercialDirection');
    expect(sourceAsset()).not.toHaveProperty('targetAudienceRefs');
    expect(sourceAsset()).not.toHaveProperty('creativeRole');
  });

  it('represents a private AI Concept from the exact current human selection', () => {
    const asset = studioVisualAsset();
    expect(() => assertTradingAssetClassificationV1(asset)).not.toThrow();
    expect(() =>
      assertTradingStudioVisualAssetV1(asset, selection, direction, profile)
    ).not.toThrow();
  });

  it('rejects an unselected DirectionVersion and incomplete generation lineage', () => {
    const asset = studioVisualAsset();
    expect(() =>
      assertTradingStudioVisualAssetV1(
        { ...asset, commercialDirection: { ...asset.commercialDirection, version: 1 } },
        selection,
        direction,
        profile
      )
    ).toThrow(/exact current human-selected DirectionVersion/u);
    expect(() =>
      assertTradingStudioVisualAssetV1(
        {
          ...asset,
          provenance: {
            ...asset.provenance,
            sourceReferences: asset.provenance.sourceReferences.filter(
              (source) => source.sourceId !== 'source-asset_contract-1'
            )
          }
        },
        selection,
        direction,
        profile
      )
    ).toThrow(/every exact generation input/u);
  });

  it('keeps Studio Visual Assets private, publication-ineligible and explicitly AI Concept', () => {
    expect(() =>
      assertTradingAssetClassificationV1({
        ...studioVisualAsset(),
        visibility: 'LISTING_PUBLIC'
      } as unknown as TradingStudioVisualAssetV1)
    ).toThrow(/private and publication-ineligible/u);
    expect(() =>
      assertTradingAssetClassificationV1({
        ...studioVisualAsset(),
        aiConceptLabel: false
      } as unknown as TradingStudioVisualAssetV1)
    ).toThrow(/AI concept label/u);
  });

  it('validates optional commercial intent against the exact DirectionVersion', () => {
    expect(() =>
      assertTradingStudioVisualAssetV1(
        {
          ...studioVisualAsset(),
          scenarioRefs: ['trading-commercial-scenario_unknown']
        },
        selection,
        direction,
        profile
      )
    ).toThrow(/scenarioRefs.*exact DirectionVersion/u);
  });

  it('records clean and failed QA against one exact Studio Visual Asset', () => {
    const asset = studioVisualAsset();
    expect(() =>
      assertTradingStudioVisualQualityReviewV1(failedQualityReview(), asset)
    ).not.toThrow();
    expect(() =>
      assertTradingStudioVisualQualityReviewV1(
        {
          ...failedQualityReview(),
          status: 'PASS',
          findings: [],
          retryDisposition: 'RETRY_FORBIDDEN'
        },
        asset
      )
    ).not.toThrow();
    expect(() =>
      assertTradingStudioVisualQualityReviewV1(
        {
          ...failedQualityReview(),
          studioVisualAsset: { ...failedQualityReview().studioVisualAsset, version: 2 }
        },
        asset
      )
    ).toThrow(/exact Studio Visual Asset/u);
  });

  it('requires findings for warnings or failure and keeps PASS clean', () => {
    expect(() =>
      assertTradingStudioVisualQualityReviewV1(
        { ...failedQualityReview(), findings: [] },
        studioVisualAsset()
      )
    ).toThrow(/require findings/u);
    expect(() =>
      assertTradingStudioVisualQualityReviewV1(
        {
          ...failedQualityReview(),
          status: 'PASS',
          retryDisposition: 'RETRY_FORBIDDEN'
        },
        studioVisualAsset()
      )
    ).toThrow(/PASS quality review cannot contain findings/u);
  });

  it('allows a bounded retry only for FAIL plus RETRY_ALLOWED', () => {
    const asset = studioVisualAsset();
    const review = failedQualityReview();
    expect(() =>
      assertRequestTradingStudioVisualRetryCommandV1(retryCommand(), review, asset)
    ).not.toThrow();
    expect(() =>
      assertRequestTradingStudioVisualRetryCommandV1(
        { ...retryCommand(), expectedAssetVersion: 2 },
        review,
        asset
      )
    ).toThrow(/exact failed asset/u);
    expect(() =>
      assertRequestTradingStudioVisualRetryCommandV1(
        retryCommand(),
        { ...review, retryDisposition: 'RETRY_FORBIDDEN' },
        asset
      )
    ).toThrow(/failed quality review.*RETRY_ALLOWED/u);
  });

  it('does not let visual QA absorb Managed AI delivery reconciliation', () => {
    expect(() =>
      assertTradingStudioVisualQualityReviewV1(
        { ...failedQualityReview(), retryDisposition: 'RECONCILIATION_REQUIRED' },
        studioVisualAsset()
      )
    ).toThrow(/reconciliation belongs to Managed AI execution/u);
    expect(noTradingStudioVisualQualityAuthorityConsequencesV1).toEqual({
      humanApprovalCreated: false,
      showcaseApproved: false,
      listingPublicationCreated: false,
      trademarkTruthMutated: false
    });
  });
});
