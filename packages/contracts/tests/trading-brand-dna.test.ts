import { describe, expect, it } from 'vitest';
import { noTradingAiAuthorityConsequencesV1 } from '../src/trading-ai-provenance.js';
import { assertTradingBrandDnaV1, type TradingBrandDnaV1 } from '../src/trading-brand-dna.js';

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
