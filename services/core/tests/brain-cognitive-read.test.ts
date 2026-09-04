import { describe, expect, it } from 'vitest';
import type { BrainAssetVersion } from '@markorbit/contracts/brain';
import type { BrainGapRegistryRecord } from '@markorbit/contracts/brain-gap';
import { BrainAssetRegistryError } from '../src/brain-asset-registry.js';
import {
  BrainCognitiveReadError,
  BrainCognitiveReadServiceV1,
  type BrainAssetCurrentReadAuthority,
  type BrainGapReadAuthority
} from '../src/brain-cognitive-read.js';
import { BrainGapRegistryError } from '../src/brain-gap-registry.js';

function asset(
  id: string,
  version: number,
  status: BrainAssetVersion['status']
): BrainAssetVersion {
  return {
    schemaVersion: 1,
    brainAssetId: `brain-asset_${id}`,
    brainAssetVersionId: `brain-asset-version_${id}-v${version}`,
    version,
    assetType: 'STATISTICAL_ESTIMATE',
    status,
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: `control-center.${id}`,
      inputSchemaId: 'brain-input.control-center.v1',
      outputSchemaId: 'brain-output.control-center.v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    evidenceRefs: [
      {
        sourceOwner: 'KNOWLEDGE',
        sourceObjectId: `knowledge:${id}`,
        sourceVersion: '2026-09',
        sourceFingerprintSha256: 'a'.repeat(64),
        observedAt: '2026-09-01T00:00:00.000Z'
      }
    ],
    derivedFromBrainAssetVersionIds: [],
    confidence: {
      score: status === 'DEGRADED' ? 0.55 : 0.91,
      band: status === 'DEGRADED' ? 'MEDIUM' : 'VERY_HIGH',
      factors: {
        authority: 1,
        freshness: 0.9,
        agreement: 0.9,
        coverage: 0.9,
        validation: 0.9,
        methodQuality: 0.9
      }
    },
    payload: {
      internalComputation: 'MUST_NOT_APPEAR_IN_OPERATOR_PROJECTION',
      rows: [1, 2, 3]
    },
    createdAt: `2026-09-0${version}T00:00:00.000Z`,
    ...(status === 'VALIDATED' || status === 'ACTIVE' || status === 'DEGRADED'
      ? { validatedAt: '2026-09-01T12:00:00.000Z' }
      : {})
  };
}

function gap(keySuffix: string, status: BrainGapRegistryRecord['status']): BrainGapRegistryRecord {
  return {
    schemaVersion: 1,
    brainGapRegistryKey: `brain-gap-key_${keySuffix}`,
    identityFingerprintSha256: 'b'.repeat(64),
    status,
    firstDetectedAt: '2026-09-01T00:00:00.000Z',
    lastDetectedAt: '2026-09-02T00:00:00.000Z',
    occurrenceCount: 2,
    latestGap: {
      schemaVersion: 1,
      brainGapId: `brain-gap_${'b'.repeat(64)}`,
      fingerprintSha256: 'b'.repeat(64),
      gapType: 'STALE_EVIDENCE',
      severity: 'HIGH',
      businessImpact: 'HIGH',
      status: 'OPEN',
      detectionSource: 'ASSET_AUDIT',
      scope: {
        domain: 'TRADEMARK',
        jurisdiction: 'US',
        concept: `control-center.${keySuffix}`
      },
      targetModule: 'KNOWLEDGE',
      reasonCode: 'SOURCE_FRESHNESS_BELOW_POLICY',
      explanation: 'Detailed internal explanation must not be projected.',
      remediationHint: 'Detailed remediation text must not be projected.',
      evidenceRefs: [
        {
          sourceOwner: 'KNOWLEDGE',
          sourceObjectId: 'private-evidence-object',
          sourceVersion: 'v9',
          sourceFingerprintSha256: 'c'.repeat(64)
        }
      ],
      relatedBrainBuildRunId: 'brain-build-run_control-center',
      relatedBrainAssetVersionId: 'brain-asset-version_asset-b-v2',
      detectedAt: '2026-09-02T00:00:00.000Z'
    },
    latestDisposition: {
      status,
      occurredAt: '2026-09-02T06:00:00.000Z',
      reason: 'Operator-private disposition reason must not be projected.',
      source: 'MANUAL'
    }
  };
}

class Assets implements BrainAssetCurrentReadAuthority {
  constructor(private readonly values: readonly BrainAssetVersion[]) {}
  listCurrent(): readonly BrainAssetVersion[] {
    return structuredClone(this.values);
  }
}

class Gaps implements BrainGapReadAuthority {
  constructor(private readonly values: readonly BrainGapRegistryRecord[]) {}
  query(): readonly BrainGapRegistryRecord[] {
    return structuredClone(this.values);
  }
}

describe('BrainCognitiveReadServiceV1', () => {
  it('projects deterministic bounded current Brain and BrainGap metadata without payload bodies', async () => {
    const service = new BrainCognitiveReadServiceV1(
      new Assets([asset('z', 4, 'DEGRADED'), asset('a', 2, 'ACTIVE')]),
      new Gaps([gap('z', 'RESOLVED'), gap('a', 'OPEN')]),
      () => new Date('2026-09-04T10:00:00.000Z')
    );

    const result = await service.read();

    expect(result.generatedAt).toBe('2026-09-04T10:00:00.000Z');
    expect(result.source).toEqual({
      domain: 'CORE',
      authority: 'BRAIN_REGISTRIES',
      availability: 'AVAILABLE'
    });
    expect(result.brainAssets.map((item) => item.brainAssetId)).toEqual([
      'brain-asset_a',
      'brain-asset_z'
    ]);
    expect(result.brainAssets.map((item) => item.status)).toEqual(['ACTIVE', 'DEGRADED']);
    expect(result.brainGaps.map((item) => item.brainGapRegistryKey)).toEqual([
      'brain-gap-key_a',
      'brain-gap-key_z'
    ]);
    expect(result.summary).toEqual({
      brainAssetCount: 2,
      brainGapCount: 2,
      openBrainGapCount: 1
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('MUST_NOT_APPEAR_IN_OPERATOR_PROJECTION');
    expect(serialized).not.toContain('Detailed internal explanation');
    expect(serialized).not.toContain('Detailed remediation text');
    expect(serialized).not.toContain('Operator-private disposition reason');
    expect(serialized).not.toContain('private-evidence-object');
    expect(result.brainAssets[0]).not.toHaveProperty('payload');
    expect(result.brainGaps[0]).not.toHaveProperty('explanation');
    expect(result.brainGaps[0]).not.toHaveProperty('remediationHint');
  });

  it('represents a successfully-read empty registry as available empty truth', async () => {
    const result = await new BrainCognitiveReadServiceV1(
      new Assets([]),
      new Gaps([]),
      () => new Date('2026-09-04T10:00:00.000Z')
    ).read();

    expect(result.source.availability).toBe('AVAILABLE');
    expect(result.brainAssets).toEqual([]);
    expect(result.brainGaps).toEqual([]);
    expect(result.summary).toEqual({
      brainAssetCount: 0,
      brainGapCount: 0,
      openBrainGapCount: 0
    });
  });

  it('maps Brain Asset persistence failure to explicit source unavailable', async () => {
    const failingAssets: BrainAssetCurrentReadAuthority = {
      listCurrent() {
        throw new BrainAssetRegistryError(
          'PERSISTENCE_UNAVAILABLE',
          'Database connection unavailable.'
        );
      }
    };

    await expect(
      new BrainCognitiveReadServiceV1(failingAssets, new Gaps([])).read()
    ).rejects.toMatchObject<Partial<BrainCognitiveReadError>>({
      name: 'BrainCognitiveReadError',
      code: 'SOURCE_UNAVAILABLE'
    });
  });

  it('maps BrainGap persistence failure to explicit source unavailable', async () => {
    const failingGaps: BrainGapReadAuthority = {
      query() {
        throw new BrainGapRegistryError(
          'PERSISTENCE_UNAVAILABLE',
          'Database connection unavailable.'
        );
      }
    };

    await expect(
      new BrainCognitiveReadServiceV1(new Assets([]), failingGaps).read()
    ).rejects.toMatchObject<Partial<BrainCognitiveReadError>>({
      name: 'BrainCognitiveReadError',
      code: 'SOURCE_UNAVAILABLE'
    });
  });
});
