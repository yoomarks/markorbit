import { describe, expect, it } from 'vitest';
import {
  BrainAssetRegistryError,
  InMemoryBrainAssetRegistry
} from '../src/brain-asset-registry.js';

const sha = 'b'.repeat(64);

function asset(
  version: number,
  status: 'DRAFT' | 'CANDIDATE' | 'VALIDATED' | 'ACTIVE' | 'DEGRADED' | 'RETIRED',
  overrides: Record<string, unknown> = {}
) {
  const grounded = ['VALIDATED', 'ACTIVE', 'DEGRADED'].includes(status);
  return {
    schemaVersion: 1,
    brainAssetId: 'brain-asset_us-filing-time',
    brainAssetVersionId: `brain-asset-version_us-filing-time-v${version}`,
    version,
    assetType: 'STATISTICAL_ESTIMATE',
    status,
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'trademark.application.time_to_first_action',
      inputSchemaId: 'brain.operational.query.v1',
      outputSchemaId: 'brain.statistical-range.v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    evidenceRefs: grounded
      ? [
          {
            sourceOwner: 'DATA_ENGINE',
            sourceObjectId: 'dataset_us_application_events',
            sourceVersion: '2026-08',
            sourceFingerprintSha256: sha
          }
        ]
      : [],
    derivedFromBrainAssetVersionIds: [],
    confidence: {
      score: grounded ? 0.88 : 0.2,
      band: grounded ? 'HIGH' : 'VERY_LOW',
      factors: {
        authority: grounded ? 0.95 : 0.2,
        freshness: grounded ? 0.9 : 0.2,
        agreement: grounded ? 0.85 : 0.2,
        coverage: grounded ? 0.8 : 0.2,
        validation: grounded ? 0.9 : 0,
        methodQuality: grounded ? 0.85 : 0.2
      }
    },
    payload: { medianMonths: 7.1 },
    createdAt: `2026-08-${String(version).padStart(2, '0')}T00:00:00.000Z`,
    ...(grounded ? { validatedAt: '2026-08-20T00:00:00.000Z' } : {}),
    ...overrides
  };
}

describe('InMemoryBrainAssetRegistry', () => {
  it('requires the lifecycle to begin with version 1 DRAFT', () => {
    const registry = new InMemoryBrainAssetRegistry();
    expect(() => registry.register(asset(1, 'ACTIVE'))).toThrow(BrainAssetRegistryError);
  });

  it('keeps immutable historical versions while promoting to ACTIVE', () => {
    const registry = new InMemoryBrainAssetRegistry();
    registry.register(asset(1, 'DRAFT'));
    registry.register(asset(2, 'CANDIDATE'));
    registry.register(asset(3, 'VALIDATED'));
    registry.register(asset(4, 'ACTIVE'));

    expect(registry.listVersions('brain-asset_us-filing-time')).toHaveLength(4);
    expect(registry.getVersion('brain-asset-version_us-filing-time-v1').status).toBe('DRAFT');
    expect(registry.getVersion('brain-asset-version_us-filing-time-v4').status).toBe('ACTIVE');
  });

  it('resolves the latest effective ACTIVE version for one governed asset identity', () => {
    const registry = new InMemoryBrainAssetRegistry();
    registry.register(asset(1, 'DRAFT'));
    registry.register(asset(2, 'CANDIDATE'));
    registry.register(asset(3, 'VALIDATED'));
    registry.register(asset(4, 'ACTIVE'));
    registry.register(
      asset(5, 'ACTIVE', {
        payload: { medianMonths: 6.8 },
        scope: {
          ...asset(5, 'ACTIVE').scope,
          effectiveFrom: '2026-08-01T00:00:00.000Z'
        }
      })
    );

    const resolved = registry.resolveActive({
      domain: 'TRADEMARK',
      jurisdiction: 'us',
      concept: 'trademark.application.time_to_first_action',
      asOf: '2026-08-27T00:00:00.000Z'
    });
    expect(resolved.brainAssetVersionId).toBe('brain-asset-version_us-filing-time-v5');
    expect(resolved.payload).toEqual({ medianMonths: 6.8 });
  });

  it('fails closed when the latest lifecycle is degraded and no ACTIVE asset remains effective', () => {
    const registry = new InMemoryBrainAssetRegistry();
    registry.register(asset(1, 'DRAFT'));
    registry.register(asset(2, 'CANDIDATE'));
    registry.register(asset(3, 'VALIDATED'));
    registry.register(
      asset(4, 'ACTIVE', {
        scope: {
          ...asset(4, 'ACTIVE').scope,
          effectiveTo: '2026-08-20T00:00:00.000Z'
        }
      })
    );
    registry.register(asset(5, 'DEGRADED'));

    expect(() =>
      registry.resolveActive({
        domain: 'TRADEMARK',
        jurisdiction: 'US',
        concept: 'trademark.application.time_to_first_action',
        asOf: '2026-08-27T00:00:00.000Z'
      })
    ).toThrow('No ACTIVE Brain asset');
  });

  it('rejects version gaps and scope mutation', () => {
    const registry = new InMemoryBrainAssetRegistry();
    registry.register(asset(1, 'DRAFT'));
    expect(() => registry.register(asset(3, 'CANDIDATE'))).toThrow('contiguous');
    expect(() =>
      registry.register(
        asset(2, 'CANDIDATE', {
          scope: { ...asset(2, 'CANDIDATE').scope, jurisdiction: 'EU' }
        })
      )
    ).toThrow('cannot change domain, jurisdiction, or concept');
  });

  it('returns clones so callers cannot mutate registered cognition', () => {
    const registry = new InMemoryBrainAssetRegistry();
    registry.register(asset(1, 'DRAFT'));
    const first = registry.getVersion('brain-asset-version_us-filing-time-v1') as {
      payload: { medianMonths: number };
    };
    first.payload.medianMonths = 99;
    expect(
      (
        registry.getVersion('brain-asset-version_us-filing-time-v1').payload as {
          medianMonths: number;
        }
      ).medianMonths
    ).toBe(7.1);
  });
});
