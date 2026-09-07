import { describe, expect, it } from 'vitest';
import {
  assertTradingAiProvenanceV1,
  noTradingAiAuthorityConsequencesV1,
  type TradingAiProvenanceV1
} from '../src/trading-ai-provenance.js';

const provenance = (): TradingAiProvenanceV1 => ({
  schemaVersion: 1,
  derivedObject: { id: 'trading-ai-derived_profile-1', version: 2 },
  truthClass: 'AI_INFERENCE',
  trademarkAsset: { id: 'trademark-asset_mark-1', version: 4 },
  sourceReferences: [
    { ownerReference: 'trademark-asset', sourceId: 'trademark-asset_mark-1', sourceVersion: 4 },
    { ownerReference: 'lite-trading', sourceId: 'source-asset_logo-1', sourceVersion: 1 }
  ],
  implementation: {
    implementationProfileId: 'implementation-profile_visual-analysis',
    implementationProfileVersion: 3,
    implementationKey: 'visual-analysis/default',
    provider: 'provider-a',
    model: 'vision-model-1',
    promptPolicyId: 'prompt-policy_brand-profile',
    promptPolicyVersion: '2.0.0',
    outputSchemaId: 'trading-ai-profile-v1',
    inputSha256: 'a'.repeat(64),
    providerRequestId: 'provider-request-1',
    startedAt: '2026-09-07T12:00:00.000Z',
    completedAt: '2026-09-07T12:00:02.000Z'
  },
  createdAt: '2026-09-07T12:00:03.000Z',
  currentness: { state: 'CURRENT', evaluatedAt: '2026-09-07T12:00:03.000Z' },
  authorityConsequences: noTradingAiAuthorityConsequencesV1
});

describe('Lite Trading AI provenance V1 contract', () => {
  it('binds a versioned AI-derived object to exact inputs and Managed AI provenance', () => {
    expect(() => assertTradingAiProvenanceV1(provenance())).not.toThrow();
    expect(provenance().implementation.model).toBe('vision-model-1');
    expect(provenance().sourceReferences).toHaveLength(2);
  });

  it('requires exact source versions and a valid Managed AI implementation record', () => {
    expect(() => assertTradingAiProvenanceV1({ ...provenance(), sourceReferences: [] })).toThrow(
      /exact source lineage/u
    );
    expect(() =>
      assertTradingAiProvenanceV1({
        ...provenance(),
        implementation: { ...provenance().implementation, inputSha256: 'not-a-hash' }
      })
    ).toThrow(/valid Managed AI provenance/u);
  });

  it('keeps inference and concept outputs outside Trademark Truth and approval state', () => {
    expect(() =>
      assertTradingAiProvenanceV1({ ...provenance(), truthClass: 'AI_CONCEPT' })
    ).not.toThrow();
    expect(noTradingAiAuthorityConsequencesV1).toEqual({
      trademarkTruthMutated: false,
      officialTruthCreated: false,
      humanApprovalCreated: false,
      listingPublicationCreated: false,
      ownershipOrAuthorityVerified: false
    });
    expect(() =>
      assertTradingAiProvenanceV1({
        ...provenance(),
        authorityConsequences: {
          ...noTradingAiAuthorityConsequencesV1,
          trademarkTruthMutated: true
        } as unknown as TradingAiProvenanceV1['authorityConsequences']
      })
    ).toThrow(/trademarkTruthMutated/u);
  });

  it('carries explicit currentness without treating UNKNOWN as current', () => {
    expect(() =>
      assertTradingAiProvenanceV1({
        ...provenance(),
        currentness: { state: 'UNKNOWN', evaluatedAt: '2026-09-07T12:10:00.000Z' }
      })
    ).not.toThrow();
    expect(() =>
      assertTradingAiProvenanceV1({
        ...provenance(),
        currentness: { state: 'CURRENT', evaluatedAt: 'not-a-timestamp' }
      })
    ).toThrow(/currentness.evaluatedAt/u);
  });
});
