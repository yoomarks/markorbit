import { describe, expect, it } from 'vitest';
import { BrainContractError } from '../src/brain.js';
import {
  parseBrainEvidenceAssertion,
  type BrainEvidenceAssertion
} from '../src/brain-evidence.js';

const sha = 'c'.repeat(64);

function assertion(overrides: Record<string, unknown> = {}): BrainEvidenceAssertion {
  return {
    schemaVersion: 1,
    evidenceRef: {
      sourceOwner: 'KNOWLEDGE',
      sourceObjectId: 'source_us_fee_schedule',
      sourceVersion: '2026-08',
      sourceFingerprintSha256: sha,
      observedAt: '2026-08-20T00:00:00.000Z'
    },
    authorityClass: 'CURRENT_OFFICIAL_PRIMARY',
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'trademark.application.official_fee',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    valueKind: 'EXACT',
    value: { amountMinor: 35000, currency: 'USD', unit: 'CLASS' },
    assertedAt: '2026-08-20T00:00:00.000Z',
    ...overrides
  } as BrainEvidenceAssertion;
}

describe('Brain evidence contracts', () => {
  it('parses a scoped evidence assertion and normalizes jurisdiction', () => {
    const parsed = parseBrainEvidenceAssertion({
      ...assertion(),
      scope: { ...assertion().scope, jurisdiction: 'us' }
    });
    expect(parsed.scope.jurisdiction).toBe('US');
    expect(parsed.authorityClass).toBe('CURRENT_OFFICIAL_PRIMARY');
  });

  it('rejects unsupported authority classes and unresolved value kinds', () => {
    expect(() =>
      parseBrainEvidenceAssertion({ ...assertion(), authorityClass: 'BLOG_GUESS' })
    ).toThrow(BrainContractError);
    expect(() =>
      parseBrainEvidenceAssertion({ ...assertion(), valueKind: 'CONFLICTED' })
    ).toThrow('valueKind is invalid');
  });

  it('rejects unsupported fields and non-JSON assertion payloads', () => {
    expect(() =>
      parseBrainEvidenceAssertion({ ...assertion(), providerModel: 'not-authorized' })
    ).toThrow('unsupported fields');
    expect(() =>
      parseBrainEvidenceAssertion({
        ...assertion(),
        value: { amountMinor: 35000, unsupported: undefined }
      })
    ).toThrow('cannot be undefined');
  });

  it('rejects an invalid effective window', () => {
    expect(() =>
      parseBrainEvidenceAssertion({
        ...assertion(),
        scope: {
          ...assertion().scope,
          effectiveFrom: '2026-08-01T00:00:00.000Z',
          effectiveTo: '2026-07-31T00:00:00.000Z'
        }
      })
    ).toThrow('effectiveTo must be after effectiveFrom');
  });
});
