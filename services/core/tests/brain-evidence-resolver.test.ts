import { describe, expect, it } from 'vitest';
import { resolveBrainEvidence } from '../src/brain-evidence-resolver.js';

const sha = (letter: string) => letter.repeat(64);

function assertion(
  authorityClass:
    | 'CURRENT_OFFICIAL_PRIMARY'
    | 'CURRENT_OFFICIAL_STATISTICAL'
    | 'INTERNAL_VERIFIED_DATA'
    | 'VERIFIED_PROFESSIONAL_SOURCE'
    | 'SECONDARY_PROFESSIONAL'
    | 'GENERAL_PUBLIC_SOURCE',
  value: unknown,
  overrides: Record<string, unknown> = {}
) {
  return {
    schemaVersion: 1,
    evidenceRef: {
      sourceOwner: authorityClass.startsWith('CURRENT_OFFICIAL') ? 'KNOWLEDGE' : 'DATA_ENGINE',
      sourceObjectId: `source_${authorityClass.toLowerCase()}`,
      sourceVersion: '2026-08',
      sourceFingerprintSha256: sha(authorityClass === 'CURRENT_OFFICIAL_PRIMARY' ? 'a' : 'b')
    },
    authorityClass,
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'trademark.application.official_fee',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    valueKind: 'EXACT',
    value,
    assertedAt: '2026-08-20T00:00:00.000Z',
    ...overrides
  };
}

const query = {
  domain: 'TRADEMARK',
  jurisdiction: 'us',
  concept: 'trademark.application.official_fee',
  asOf: '2026-08-27T00:00:00.000Z'
};

describe('resolveBrainEvidence', () => {
  it('returns NO_EVIDENCE when all assertions are outside the governed scope', () => {
    const result = resolveBrainEvidence(
      [
        assertion(
          'CURRENT_OFFICIAL_PRIMARY',
          { amountMinor: 35000 },
          {
            scope: {
              domain: 'TRADEMARK',
              jurisdiction: 'EU',
              concept: 'trademark.application.official_fee',
              effectiveFrom: '2026-01-01T00:00:00.000Z'
            }
          }
        ),
        assertion(
          'CURRENT_OFFICIAL_PRIMARY',
          { amountMinor: 30000 },
          {
            scope: {
              domain: 'TRADEMARK',
              jurisdiction: 'US',
              concept: 'trademark.application.official_fee',
              effectiveFrom: '2025-01-01T00:00:00.000Z',
              effectiveTo: '2026-01-01T00:00:00.000Z'
            }
          }
        )
      ],
      query
    );
    expect(result.status).toBe('NO_EVIDENCE');
    expect(result.excludedAssertionCount).toBe(2);
  });

  it('returns SUPPORTED for one applicable highest-authority assertion', () => {
    const result = resolveBrainEvidence(
      [assertion('CURRENT_OFFICIAL_PRIMARY', { amountMinor: 35000, currency: 'USD' })],
      query
    );
    expect(result.status).toBe('SUPPORTED');
    expect(result.selectedAuthorityClass).toBe('CURRENT_OFFICIAL_PRIMARY');
    expect(result.selectedValue).toEqual({ amountMinor: 35000, currency: 'USD' });
    expect(result.supportingAssertions).toHaveLength(1);
  });

  it('canonicalizes object-key order and reports multi-source consensus', () => {
    const result = resolveBrainEvidence(
      [
        assertion('CURRENT_OFFICIAL_PRIMARY', {
          amountMinor: 35000,
          currency: 'USD',
          unit: 'CLASS'
        }),
        assertion('VERIFIED_PROFESSIONAL_SOURCE', {
          unit: 'CLASS',
          currency: 'USD',
          amountMinor: 35000
        })
      ],
      query
    );
    expect(result.status).toBe('CONSENSUS');
    expect(result.supportingAssertions).toHaveLength(2);
    expect(result.supportingAssertions[0]?.valueFingerprintSha256).toBe(
      result.supportingAssertions[1]?.valueFingerprintSha256
    );
  });

  it('keeps lower-authority disagreement as conflict without overriding official evidence', () => {
    const result = resolveBrainEvidence(
      [
        assertion('CURRENT_OFFICIAL_PRIMARY', { amountMinor: 35000, currency: 'USD' }),
        assertion('SECONDARY_PROFESSIONAL', { amountMinor: 25000, currency: 'USD' })
      ],
      query
    );
    expect(result.status).toBe('SUPPORTED');
    expect(result.selectedValue).toEqual({ amountMinor: 35000, currency: 'USD' });
    expect(result.supportingAssertions).toHaveLength(1);
    expect(result.conflictingAssertions).toHaveLength(1);
  });

  it('fails closed when equal highest-authority evidence materially conflicts', () => {
    const first = assertion('CURRENT_OFFICIAL_PRIMARY', { amountMinor: 35000, currency: 'USD' });
    const second = {
      ...assertion('CURRENT_OFFICIAL_PRIMARY', { amountMinor: 40000, currency: 'USD' }),
      evidenceRef: {
        ...assertion('CURRENT_OFFICIAL_PRIMARY', {}).evidenceRef,
        sourceObjectId: 'source_second_official',
        sourceFingerprintSha256: sha('d')
      }
    };
    const result = resolveBrainEvidence([first, second], query);
    expect(result.status).toBe('CONFLICTED');
    expect(result.selectedValue).toBeUndefined();
    expect(result.conflictingAssertions).toHaveLength(1);
  });

  it('does not average incompatible exact values', () => {
    const result = resolveBrainEvidence(
      [
        assertion('CURRENT_OFFICIAL_PRIMARY', 350),
        {
          ...assertion('CURRENT_OFFICIAL_PRIMARY', 450),
          evidenceRef: {
            ...assertion('CURRENT_OFFICIAL_PRIMARY', 450).evidenceRef,
            sourceObjectId: 'source_official_conflict',
            sourceFingerprintSha256: sha('e')
          }
        }
      ],
      query
    );
    expect(result.status).toBe('CONFLICTED');
    expect(result.selectedValue).toBeUndefined();
  });
});
