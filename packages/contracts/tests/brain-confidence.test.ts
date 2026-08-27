import { describe, expect, it } from 'vitest';
import {
  parseBrainConfidencePolicy,
  parseBrainConfidenceQualityEvidence
} from '../src/brain-confidence.js';

function policy(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    policyId: 'brain-confidence-policy_test-v1',
    version: 1,
    weights: {
      authority: 0.25,
      freshness: 0.15,
      agreement: 0.2,
      coverage: 0.15,
      validation: 0.15,
      methodQuality: 0.1
    },
    bandThresholds: { low: 0.35, medium: 0.55, high: 0.75, veryHigh: 0.9 },
    freshnessHalfLifeDays: 365,
    missingTimestampFreshness: 0.35,
    singleSourceAgreement: 0.55,
    counterEvidencePenalty: 0.18,
    ...overrides
  };
}

describe('Brain confidence contracts', () => {
  it('accepts a deterministic versioned policy', () => {
    const parsed = parseBrainConfidencePolicy(policy());
    expect(parsed.policyId).toBe('brain-confidence-policy_test-v1');
    expect(parsed.weights.authority).toBe(0.25);
  });

  it('rejects weights that do not sum to one and non-monotonic bands', () => {
    expect(() =>
      parseBrainConfidencePolicy({
        ...policy(),
        weights: {
          authority: 0.5,
          freshness: 0.15,
          agreement: 0.2,
          coverage: 0.15,
          validation: 0.15,
          methodQuality: 0.1
        }
      })
    ).toThrow('must sum to 1');
    expect(() =>
      parseBrainConfidencePolicy({
        ...policy(),
        bandThresholds: { low: 0.35, medium: 0.8, high: 0.75, veryHigh: 0.9 }
      })
    ).toThrow('strictly increasing');
  });

  it('rejects provider or model self-confidence fields from trusted quality evidence', () => {
    expect(() =>
      parseBrainConfidenceQualityEvidence({
        coverage: 1,
        validation: 1,
        methodQuality: 1,
        coverageReason: 'All expected dimensions covered.',
        validationReason: 'Independent evaluation passed.',
        methodQualityReason: 'Direct deterministic resolution.',
        providerModel: 'model-x',
        modelSelfConfidence: 0.99
      })
    ).toThrow('unsupported fields');
  });
});
