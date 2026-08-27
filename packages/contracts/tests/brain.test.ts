import { describe, expect, it } from 'vitest';
import {
  BrainContractError,
  parseBrainAssetVersion,
  parseBrainOperationalResolution
} from '../src/brain.js';

const sha = 'a'.repeat(64);

const confidence = {
  score: 0.88,
  band: 'HIGH',
  factors: {
    authority: 0.95,
    freshness: 0.9,
    agreement: 0.85,
    coverage: 0.8,
    validation: 0.9,
    methodQuality: 0.85
  }
} as const;

function activeAsset() {
  return {
    schemaVersion: 1,
    brainAssetId: 'brain-asset_us-filing-time',
    brainAssetVersionId: 'brain-asset-version_us-filing-time-v1',
    version: 1,
    assetType: 'STATISTICAL_ESTIMATE',
    status: 'ACTIVE',
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'us',
      concept: 'trademark.application.time_to_first_action',
      inputSchemaId: 'brain.operational.query.v1',
      outputSchemaId: 'brain.statistical-range.v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    evidenceRefs: [
      {
        sourceOwner: 'DATA_ENGINE',
        sourceObjectId: 'dataset_us_application_events',
        sourceVersion: '2026-08',
        sourceFingerprintSha256: sha,
        observedAt: '2026-08-26T00:00:00.000Z'
      }
    ],
    derivedFromBrainAssetVersionIds: [],
    confidence,
    payload: { medianMonths: 7.1, p25Months: 5.9, p75Months: 8.6, sampleSize: 21537 },
    createdAt: '2026-08-26T01:00:00.000Z',
    validatedAt: '2026-08-26T02:00:00.000Z'
  } as const;
}

describe('Brain contracts', () => {
  it('parses an evidence-grounded ACTIVE statistical asset and normalizes jurisdiction', () => {
    const parsed = parseBrainAssetVersion(activeAsset());
    expect(parsed.scope.jurisdiction).toBe('US');
    expect(parsed.evidenceRefs[0]?.sourceOwner).toBe('DATA_ENGINE');
    expect(parsed.confidence.factors.validation).toBe(0.9);
  });

  it('rejects an ACTIVE asset without evidence grounding', () => {
    const input = { ...activeAsset(), evidenceRefs: [] };
    expect(() => parseBrainAssetVersion(input)).toThrow(BrainContractError);
  });

  it('rejects an ACTIVE asset without validation evidence', () => {
    const input = { ...activeAsset(), validatedAt: undefined };
    expect(() => parseBrainAssetVersion(input)).toThrow('ACTIVE Brain assets require validatedAt');
  });

  it('parses a resolved operational result with exact asset attribution', () => {
    const resolution = parseBrainOperationalResolution({
      schemaVersion: 1,
      concept: 'trademark.application.time_to_first_action',
      jurisdiction: 'us',
      asOf: '2026-08-27T00:00:00.000Z',
      status: 'RESOLVED',
      valueKind: 'STATISTICAL_RANGE',
      value: { medianMonths: 7.1, p25Months: 5.9, p75Months: 8.6 },
      brainAssetVersionId: 'brain-asset-version_us-filing-time-v1',
      confidence,
      evidenceRefs: activeAsset().evidenceRefs,
      explanation: 'Resolved from current statistical evidence.'
    });
    expect(resolution.status).toBe('RESOLVED');
    expect(resolution.jurisdiction).toBe('US');
  });

  it.each(['UNKNOWN', 'INSUFFICIENT_EVIDENCE', 'CONFLICTED'] as const)(
    'represents %s without manufacturing a value',
    (status) => {
      const resolution = parseBrainOperationalResolution({
        schemaVersion: 1,
        concept: 'trademark.application.time_to_first_action',
        jurisdiction: 'US',
        asOf: '2026-08-27T00:00:00.000Z',
        status,
        valueKind: status,
        evidenceRefs: [],
        explanation: 'No reliable operational value is available.'
      });
      expect(resolution.status).toBe(status);
      expect(resolution.value).toBeUndefined();
    }
  );

  it('rejects unsupported contract fields instead of silently accepting authority drift', () => {
    expect(() =>
      parseBrainAssetVersion({
        ...activeAsset(),
        providerModel: 'hidden-provider-control'
      })
    ).toThrow('unsupported fields');
  });
});
