import { describe, expect, it } from 'vitest';
import type { BrainEvidenceResolutionCandidate } from '@markorbit/contracts/brain-evidence';
import { evaluateBrainConfidence } from '../src/brain-confidence-engine.js';

const sha = 'd'.repeat(64);

function summary(
  id: string,
  authorityClass: 'CURRENT_OFFICIAL_PRIMARY' | 'SECONDARY_PROFESSIONAL',
  fingerprint = 'e'.repeat(64),
  observedAt: string | null = '2026-08-20T00:00:00.000Z'
) {
  return {
    evidenceRef: {
      sourceOwner: 'KNOWLEDGE' as const,
      sourceObjectId: id,
      sourceVersion: 'v1',
      sourceFingerprintSha256: sha,
      ...(observedAt ? { observedAt } : {})
    },
    authorityClass,
    valueKind: 'EXACT' as const,
    valueFingerprintSha256: fingerprint
  };
}

function candidate(
  overrides: Partial<BrainEvidenceResolutionCandidate> = {}
): BrainEvidenceResolutionCandidate {
  return {
    schemaVersion: 1,
    domain: 'TRADEMARK',
    jurisdiction: 'US',
    concept: 'test.concept',
    asOf: '2026-08-27T00:00:00.000Z',
    status: 'SUPPORTED',
    selectedAuthorityClass: 'CURRENT_OFFICIAL_PRIMARY',
    selectedValueKind: 'EXACT',
    selectedValue: { answer: 1 },
    supportingAssertions: [summary('official-a', 'CURRENT_OFFICIAL_PRIMARY')],
    conflictingAssertions: [],
    excludedAssertionCount: 0,
    explanation: 'test candidate',
    ...overrides
  };
}

function noEvidenceCandidate(): BrainEvidenceResolutionCandidate {
  return {
    schemaVersion: 1,
    domain: 'TRADEMARK',
    jurisdiction: 'US',
    concept: 'test.concept',
    asOf: '2026-08-27T00:00:00.000Z',
    status: 'NO_EVIDENCE',
    supportingAssertions: [],
    conflictingAssertions: [],
    excludedAssertionCount: 0,
    explanation: 'no evidence'
  };
}

function conflictedCandidate(): BrainEvidenceResolutionCandidate {
  return {
    schemaVersion: 1,
    domain: 'TRADEMARK',
    jurisdiction: 'US',
    concept: 'test.concept',
    asOf: '2026-08-27T00:00:00.000Z',
    status: 'CONFLICTED',
    selectedAuthorityClass: 'CURRENT_OFFICIAL_PRIMARY',
    supportingAssertions: [summary('official-a', 'CURRENT_OFFICIAL_PRIMARY')],
    conflictingAssertions: [summary('official-b', 'CURRENT_OFFICIAL_PRIMARY', 'f'.repeat(64))],
    excludedAssertionCount: 0,
    explanation: 'highest authority conflict'
  };
}

const qualityEvidence = {
  coverage: 0.9,
  validation: 0.8,
  methodQuality: 1,
  coverageReason: 'Required dimensions are covered.',
  validationReason: 'Independent fixture validation passed.',
  methodQualityReason: 'Direct deterministic exact-value resolution.'
};

function evaluate(input: BrainEvidenceResolutionCandidate) {
  return evaluateBrainConfidence({
    candidate: input,
    qualityEvidence,
    evaluatedAt: '2026-08-27T00:00:00.000Z'
  });
}

describe('Brain confidence engine', () => {
  it('is deterministic and gives a single source only single-source agreement credit', () => {
    const first = evaluate(candidate());
    const second = evaluate(candidate());
    expect(first).toEqual(second);
    expect(first.status).toBe('SCORED');
    expect(first.confidence?.factors.agreement).toBe(0.55);
    expect(first.resolutionFingerprint).toHaveLength(64);
  });

  it('increases agreement for independent same-value sources', () => {
    const single = evaluate(candidate());
    const consensus = evaluate(
      candidate({
        status: 'CONSENSUS',
        supportingAssertions: [
          summary('official-a', 'CURRENT_OFFICIAL_PRIMARY'),
          summary('official-b', 'CURRENT_OFFICIAL_PRIMARY')
        ]
      })
    );
    expect(consensus.confidence!.factors.agreement).toBeGreaterThan(
      single.confidence!.factors.agreement
    );
    expect(consensus.confidence!.score).toBeGreaterThan(single.confidence!.score);
  });

  it('reduces agreement when lower-authority counter-evidence is preserved', () => {
    const clean = evaluate(candidate());
    const countered = evaluate(
      candidate({
        conflictingAssertions: [summary('secondary-a', 'SECONDARY_PROFESSIONAL', 'f'.repeat(64))]
      })
    );
    expect(countered.confidence!.factors.agreement).toBeLessThan(
      clean.confidence!.factors.agreement
    );
  });

  it('reduces freshness for stale or missing observation timestamps', () => {
    const fresh = evaluate(candidate());
    const stale = evaluate(
      candidate({
        supportingAssertions: [
          summary(
            'official-a',
            'CURRENT_OFFICIAL_PRIMARY',
            'e'.repeat(64),
            '2020-01-01T00:00:00.000Z'
          )
        ]
      })
    );
    const missing = evaluate(
      candidate({
        supportingAssertions: [
          summary('official-a', 'CURRENT_OFFICIAL_PRIMARY', 'e'.repeat(64), null)
        ]
      })
    );
    expect(stale.confidence!.factors.freshness).toBeLessThan(fresh.confidence!.factors.freshness);
    expect(missing.confidence!.factors.freshness).toBeLessThan(fresh.confidence!.factors.freshness);
  });

  it('fails closed for no evidence and highest-authority conflict', () => {
    const noEvidence = evaluate(noEvidenceCandidate());
    const conflicted = evaluate(conflictedCandidate());
    expect(noEvidence.status).toBe('UNSCORABLE_NO_EVIDENCE');
    expect(noEvidence.confidence).toBeUndefined();
    expect(conflicted.status).toBe('UNSCORABLE_CONFLICTED');
    expect(conflicted.confidence).toBeUndefined();
  });
});
