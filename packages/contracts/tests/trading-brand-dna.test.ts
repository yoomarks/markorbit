import { describe, expect, it } from 'vitest';
import { noTradingAiAuthorityConsequencesV1 } from '../src/trading-ai-provenance.js';
import {
  assertTradingBrandBibleV1,
  assertTradingBrandDnaV1,
  assertTradingShowcaseV1,
  noTradingShowcaseAuthorityConsequencesV1,
  type TradingBrandBibleV1,
  type TradingBrandDnaV1,
  type TradingShowcaseV1
} from '../src/trading-brand-dna.js';
import { noTradingStudioVisualQualityAuthorityConsequencesV1 } from '../src/trading-asset-classification.js';
import type {
  TradingStudioVisualAssetV1,
  TradingStudioVisualQualityReviewV1
} from '../src/trading-asset-classification.js';
import type { TradingCommercialDirectionVersionV1 } from '../src/trading-commercial-direction.js';
import type { TradingDirectionSelectionV1 } from '../src/trading-direction-selection.js';

const brandDna = (): TradingBrandDnaV1 => ({
  schemaVersion: 1,
  brandDnaId: 'trading-ai-derived_brand-dna_mark-1',
  workspaceId: 'workspace-1',
  version: 1,
  studioRun: { id: 'standard-studio-run_mark-1', version: 1 },
  trademarkAsset: { id: 'trademark-asset_mark-1', version: 4 },
  aiProfile: { id: 'trading-ai-derived_ai-profile_mark-1', version: 2 },
  personality: ['optimistic', 'precise'],
  targetAudience: ['design-conscious small businesses'],
  positioning: ['accessible premium'],
  industry: ['consumer technology'],
  visualDirection: ['clear geometric systems'],
  brandPromise: 'Make sophisticated tools feel approachable.',
  emotionalTone: ['confident', 'welcoming'],
  colorTendencies: ['high-contrast blue with warm accents'],
  typographyTendencies: ['humanist sans serif'],
  visualLanguage: ['minimal geometry', 'generous whitespace'],
  channelStrategy: ['product-led web', 'social explainers'],
  ipPotential: {
    summary: 'A distinct guide character could support education.',
    rationale: 'The approachable teaching role recurs across the source material.'
  },
  benchmarkCapabilities: ['clear product explanation', 'coherent cross-channel systems'],
  constraints: ['preserve the registered mark spelling', 'label creative alterations as concepts'],
  provenance: {
    schemaVersion: 1,
    derivedObject: { id: 'trading-ai-derived_brand-dna_mark-1', version: 1 },
    truthClass: 'AI_INFERENCE',
    trademarkAsset: { id: 'trademark-asset_mark-1', version: 4 },
    sourceReferences: [
      {
        ownerReference: 'lite-trading',
        sourceId: 'trading-ai-derived_ai-profile_mark-1',
        sourceVersion: 2
      },
      {
        ownerReference: 'lite-trading',
        sourceId: 'standard-studio-run_mark-1',
        sourceVersion: 1
      }
    ],
    implementation: {
      implementationProfileId: 'implementation-profile_brand-dna',
      implementationProfileVersion: 1,
      implementationKey: 'orbit-studio/brand-dna',
      provider: 'provider-a',
      model: 'model-1',
      promptPolicyId: 'prompt-policy_brand-dna',
      promptPolicyVersion: '1.0.0',
      outputSchemaId: 'trading-brand-dna-v1',
      inputSha256: 'b'.repeat(64),
      startedAt: '2026-09-07T12:01:00.000Z',
      completedAt: '2026-09-07T12:01:02.000Z'
    },
    createdAt: '2026-09-07T12:01:03.000Z',
    currentness: { state: 'CURRENT', evaluatedAt: '2026-09-07T12:01:03.000Z' },
    authorityConsequences: noTradingAiAuthorityConsequencesV1
  },
  createdAt: '2026-09-07T12:01:03.000Z'
});

const selection = {
  directionSelectionId: 'trading-direction-selection_mark-1',
  workspaceId: 'workspace-1',
  version: 1,
  status: 'CURRENT',
  selectedDirection: { id: 'trading-ai-derived_commercial-direction_mark-1', version: 2 }
} as unknown as TradingDirectionSelectionV1;

const direction = {
  commercialDirectionId: 'trading-ai-derived_commercial-direction_mark-1',
  version: 2,
  aiProfile: { id: 'trading-ai-derived_ai-profile_mark-1', version: 2 }
} as unknown as TradingCommercialDirectionVersionV1;

const heroAsset = {
  studioVisualAssetId: 'trading-ai-derived_visual-asset_hero-1',
  workspaceId: 'workspace-1',
  version: 1,
  classification: 'STUDIO_VISUAL_ASSET',
  commercialDirection: { id: 'trading-ai-derived_commercial-direction_mark-1', version: 2 },
  creativeRole: 'HERO',
  visibility: 'PRIVATE',
  publicationEligibility: 'NOT_ELIGIBLE',
  aiConceptLabel: true
} as unknown as TradingStudioVisualAssetV1;

const heroReview = (): TradingStudioVisualQualityReviewV1 => ({
  schemaVersion: 1,
  visualQualityReviewId: 'trading-studio-visual-quality-review_hero-1',
  workspaceId: 'workspace-1',
  version: 1,
  studioVisualAsset: { id: 'trading-ai-derived_visual-asset_hero-1', version: 1 },
  status: 'PASS',
  findings: [],
  retryDisposition: 'RETRY_FORBIDDEN',
  reviewedAt: '2026-09-07T12:05:00.000Z',
  authorityConsequences: noTradingStudioVisualQualityAuthorityConsequencesV1
});

const brandBible = (): TradingBrandBibleV1 => ({
  schemaVersion: 1,
  brandBibleId: 'trading-ai-derived_brand-bible_mark-1',
  workspaceId: 'workspace-1',
  version: 1,
  trademarkAsset: { id: 'trademark-asset_mark-1', version: 4 },
  aiProfile: { id: 'trading-ai-derived_ai-profile_mark-1', version: 2 },
  brandDna: { id: 'trading-ai-derived_brand-dna_mark-1', version: 1 },
  directionSelection: { id: 'trading-direction-selection_mark-1', version: 1 },
  commercialDirection: { id: 'trading-ai-derived_commercial-direction_mark-1', version: 2 },
  visualInputs: [
    {
      studioVisualAsset: { id: 'trading-ai-derived_visual-asset_hero-1', version: 1 },
      qualityReview: { id: 'trading-studio-visual-quality-review_hero-1', version: 1 },
      creativeRole: 'HERO'
    }
  ],
  markUsageRules: ['Preserve the registered mark spelling.'],
  visualSystem: ['Use clear geometric systems.'],
  colorSystem: ['Use high-contrast blue with warm accents.'],
  typographySystem: ['Use the selected humanist sans serif hierarchy.'],
  imageryGuidance: ['Keep product scenes warm and uncluttered.'],
  prohibitedRepresentations: ['Do not present imagined packaging as an existing product.'],
  provenance: {
    ...brandDna().provenance,
    derivedObject: { id: 'trading-ai-derived_brand-bible_mark-1', version: 1 },
    truthClass: 'AI_CONCEPT',
    sourceReferences: [
      {
        ownerReference: 'lite-trading-brand-dna',
        sourceId: 'trading-ai-derived_brand-dna_mark-1',
        sourceVersion: 1
      },
      {
        ownerReference: 'lite-trading-selection',
        sourceId: 'trading-direction-selection_mark-1',
        sourceVersion: 1
      },
      {
        ownerReference: 'lite-trading-direction',
        sourceId: 'trading-ai-derived_commercial-direction_mark-1',
        sourceVersion: 2
      },
      {
        ownerReference: 'lite-trading-assets',
        sourceId: 'trading-ai-derived_visual-asset_hero-1',
        sourceVersion: 1
      },
      {
        ownerReference: 'lite-trading-assets',
        sourceId: 'trading-studio-visual-quality-review_hero-1',
        sourceVersion: 1
      }
    ],
    createdAt: '2026-09-07T12:06:00.000Z',
    currentness: { state: 'CURRENT', evaluatedAt: '2026-09-07T12:06:00.000Z' }
  },
  visibility: 'PRIVATE',
  publicationEligibility: 'NOT_ELIGIBLE',
  aiConceptLabel: true,
  createdAt: '2026-09-07T12:06:00.000Z'
});

const showcase = (): TradingShowcaseV1 => ({
  schemaVersion: 1,
  showcaseId: 'trading-showcase_mark-1',
  workspaceId: 'workspace-1',
  version: 1,
  brandBible: { id: 'trading-ai-derived_brand-bible_mark-1', version: 1 },
  template: { templateId: 'showcase-template_standard', version: '1.0.0' },
  panels: [
    {
      slotId: 'hero',
      studioVisualAsset: { id: 'trading-ai-derived_visual-asset_hero-1', version: 1 },
      qualityReview: { id: 'trading-studio-visual-quality-review_hero-1', version: 1 },
      creativeRole: 'HERO',
      selectionMethod: 'EXPLICIT_HUMAN_ACTION',
      aiConceptLabel: true
    }
  ],
  status: 'SHOWCASE_READY',
  visibility: 'PRIVATE',
  publicationEligibility: 'NOT_ELIGIBLE',
  authorityConsequences: noTradingShowcaseAuthorityConsequencesV1,
  createdAt: '2026-09-07T12:07:00.000Z'
});

describe('Lite Trading BrandDNA V1 contract', () => {
  it('represents the complete creative baseline for one exact Studio run', () => {
    expect(() => assertTradingBrandDnaV1(brandDna())).not.toThrow();
    expect(brandDna().constraints).toContain('preserve the registered mark spelling');
    expect(brandDna().benchmarkCapabilities).toHaveLength(2);
  });

  it('requires exact AIProfile and Studio run lineage', () => {
    expect(() =>
      assertTradingBrandDnaV1({
        ...brandDna(),
        aiProfile: { ...brandDna().aiProfile, version: 3 }
      })
    ).toThrow(/exact AIProfile source/u);
    expect(() =>
      assertTradingBrandDnaV1({
        ...brandDna(),
        studioRun: { ...brandDna().studioRun, version: 2 }
      })
    ).toThrow(/exact Studio run source/u);
  });

  it('fails closed when a required generation dimension or constraint is absent', () => {
    expect(() => assertTradingBrandDnaV1({ ...brandDna(), visualLanguage: [] })).toThrow(
      /visualLanguage/u
    );
    expect(() => assertTradingBrandDnaV1({ ...brandDna(), constraints: [] })).toThrow(
      /constraints/u
    );
  });

  it('remains an AI inference and never mutates Trademark Truth', () => {
    expect(() =>
      assertTradingBrandDnaV1({
        ...brandDna(),
        provenance: { ...brandDna().provenance, truthClass: 'AI_CONCEPT' }
      })
    ).toThrow(/AI_INFERENCE/u);
    expect(brandDna().provenance.authorityConsequences.trademarkTruthMutated).toBe(false);
    expect(brandDna().provenance.authorityConsequences.officialTruthCreated).toBe(false);
  });
});

describe('Lite Trading Brand Bible V1 contract', () => {
  const resolved = () => [{ asset: heroAsset, qualityReview: heroReview() }];

  it('binds private creative guidance to exact selected and quality-passed inputs', () => {
    expect(() =>
      assertTradingBrandBibleV1(brandBible(), selection, direction, brandDna(), resolved())
    ).not.toThrow();
  });

  it('requires a quality-passed HERO from the selected direction', () => {
    expect(() =>
      assertTradingBrandBibleV1(brandBible(), selection, direction, brandDna(), [
        {
          asset: heroAsset,
          qualityReview: {
            ...heroReview(),
            status: 'FAIL',
            findings: [{ code: 'DRIFT', message: 'Mark drifted.' }]
          }
        }
      ])
    ).toThrow(/quality-passed assets/u);
    expect(() =>
      assertTradingBrandBibleV1(
        {
          ...brandBible(),
          visualInputs: [{ ...brandBible().visualInputs[0]!, creativeRole: 'BRAND_WORLD' }]
        },
        selection,
        direction,
        brandDna(),
        resolved()
      )
    ).toThrow(/exact asset, review and creative role/u);
  });

  it('requires complete guidance including prohibited representations', () => {
    expect(() =>
      assertTradingBrandBibleV1(
        { ...brandBible(), prohibitedRepresentations: [] },
        selection,
        direction,
        brandDna(),
        resolved()
      )
    ).toThrow(/prohibitedRepresentations/u);
  });

  it('remains a private, publication-ineligible AI Concept with exact lineage', () => {
    expect(() =>
      assertTradingBrandBibleV1(
        { ...brandBible(), publicationEligibility: 'ELIGIBLE' } as unknown as TradingBrandBibleV1,
        selection,
        direction,
        brandDna(),
        resolved()
      )
    ).toThrow(/private, publication-ineligible AI Concept/u);
    expect(() =>
      assertTradingBrandBibleV1(
        {
          ...brandBible(),
          provenance: {
            ...brandBible().provenance,
            sourceReferences: brandBible().provenance.sourceReferences.slice(0, -1)
          }
        },
        selection,
        direction,
        brandDna(),
        resolved()
      )
    ).toThrow(/every exact Deep Build input/u);
  });
});

describe('Lite Trading Showcase V1 contract', () => {
  const resolved = () => [{ asset: heroAsset, qualityReview: heroReview() }];

  it('durably pins an exact Brand Bible, template and human-selected passed visual set', () => {
    expect(() => assertTradingShowcaseV1(showcase(), brandBible(), resolved())).not.toThrow();
    expect(showcase().brandBible.version).toBe(1);
    expect(showcase().template.version).toBe('1.0.0');
  });

  it('rejects visuals not admitted by the pinned Brand Bible or failed by QA', () => {
    expect(() =>
      assertTradingShowcaseV1(showcase(), { ...brandBible(), visualInputs: [] }, resolved())
    ).toThrow(/admitted by the Brand Bible/u);
    expect(() =>
      assertTradingShowcaseV1(showcase(), brandBible(), [
        {
          asset: heroAsset,
          qualityReview: {
            ...heroReview(),
            status: 'FAIL',
            findings: [{ code: 'DRIFT', message: 'Mark drifted.' }]
          }
        }
      ])
    ).toThrow(/quality-passed AI Concepts/u);
  });

  it('requires a distinct explicitly selected HERO panel', () => {
    expect(() =>
      assertTradingShowcaseV1(
        {
          ...showcase(),
          panels: [{ ...showcase().panels[0]!, creativeRole: 'BRAND_WORLD' }]
        },
        {
          ...brandBible(),
          visualInputs: [{ ...brandBible().visualInputs[0]!, creativeRole: 'BRAND_WORLD' }]
        },
        [{ asset: { ...heroAsset, creativeRole: 'BRAND_WORLD' }, qualityReview: heroReview() }]
      )
    ).toThrow(/HERO panel/u);
    expect(() =>
      assertTradingShowcaseV1(
        {
          ...showcase(),
          panels: [showcase().panels[0]!, { ...showcase().panels[0]!, slotId: 'secondary' }]
        },
        brandBible(),
        [...resolved(), ...resolved()]
      )
    ).toThrow(/must be distinct/u);
  });

  it('remains private and creates no Listing, publication or truth authority', () => {
    expect(() =>
      assertTradingShowcaseV1(
        {
          ...showcase(),
          authorityConsequences: {
            ...noTradingShowcaseAuthorityConsequencesV1,
            listingCreated: true
          }
        } as unknown as TradingShowcaseV1,
        brandBible(),
        resolved()
      )
    ).toThrow(/listingCreated must be false/u);
    expect(showcase().publicationEligibility).toBe('NOT_ELIGIBLE');
    expect(showcase().panels[0]?.aiConceptLabel).toBe(true);
  });
});
