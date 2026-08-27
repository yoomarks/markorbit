import { describe, expect, it } from 'vitest';
import type { BrainBuildRequest } from '@markorbit/contracts/brain-build';
import type { BrainEvidenceAssertion } from '@markorbit/contracts/brain-evidence';
import {
  BrainAssetRegistryError,
  InMemoryBrainAssetRegistry
} from '../src/brain-asset-registry.js';
import { runBrainBuild } from '../src/brain-build-runtime.js';

const sourceSha = 'c'.repeat(64);

function assertion(id: string, value: unknown): BrainEvidenceAssertion {
  return {
    schemaVersion: 1,
    evidenceRef: {
      sourceOwner: 'KNOWLEDGE',
      sourceObjectId: id,
      sourceVersion: '2026-08',
      sourceFingerprintSha256: sourceSha,
      observedAt: '2026-08-26T00:00:00.000Z'
    },
    authorityClass: 'CURRENT_OFFICIAL_PRIMARY',
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'test.registry.value',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    valueKind: 'EXACT',
    value,
    assertedAt: '2026-08-26T00:00:00.000Z'
  };
}

function request(
  assertions: BrainEvidenceAssertion[],
  builtAt: string,
  validation = 0.2
): BrainBuildRequest {
  return {
    assertions,
    query: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'test.registry.value',
      asOf: builtAt
    },
    qualityEvidence: {
      coverage: 1,
      validation,
      methodQuality: 1,
      coverageReason: 'Registry admission fixture coverage.',
      validationReason: 'Registry admission fixture validation evidence.',
      methodQualityReason: 'Direct deterministic evidence resolution.'
    },
    assetScope: {
      inputSchemaId: 'brain-input.registry.v1',
      outputSchemaId: 'brain-output.registry.v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    builtAt
  };
}

describe('Brain Build Runtime registry admission', () => {
  it('admits a first Build Runtime candidate as registry version 1 without weakening generic DRAFT rules', () => {
    const registry = new InMemoryBrainAssetRegistry();
    const result = runBrainBuild(
      request([assertion('official-a', { amountMinor: 35000 })], '2026-08-27T00:00:00.000Z')
    );

    const admitted = registry.admitBuildResult(result);
    expect(result.run.status).toBe('CANDIDATE_READY');
    expect(admitted.version).toBe(1);
    expect(admitted.status).toBe('CANDIDATE');
    expect(admitted.status).not.toBe('ACTIVE');
    expect(registry.listVersions(admitted.brainAssetId)).toHaveLength(1);
  });

  it('admits independently validated build output directly as VALIDATED but never ACTIVE', () => {
    const registry = new InMemoryBrainAssetRegistry();
    const result = runBrainBuild(
      request(
        [
          assertion('official-a', { amountMinor: 35000 }),
          assertion('official-b', { amountMinor: 35000 })
        ],
        '2026-08-27T00:00:00.000Z',
        0.9
      )
    );

    const admitted = registry.admitBuildResult(result);
    expect(result.run.status).toBe('VALIDATED_READY');
    expect(admitted.version).toBe(1);
    expect(admitted.status).toBe('VALIDATED');
    expect(admitted.status).not.toBe('ACTIVE');
    expect(admitted.validatedAt).toBe('2026-08-27T00:00:00.000Z');
    expect(admitted.evidenceRefs).toHaveLength(2);
  });

  it('allocates a contiguous version and deterministic version id for a later build of the same asset identity', () => {
    const registry = new InMemoryBrainAssetRegistry();
    const first = runBrainBuild(
      request([assertion('official-a', { amountMinor: 35000 })], '2026-08-27T00:00:00.000Z')
    );
    const second = runBrainBuild(
      request([assertion('official-c', { amountMinor: 36000 })], '2026-08-28T00:00:00.000Z')
    );

    const admittedFirst = registry.admitBuildResult(first);
    const admittedSecond = registry.admitBuildResult(second);

    expect(admittedFirst.brainAssetId).toBe(admittedSecond.brainAssetId);
    expect(admittedSecond.version).toBe(2);
    expect(admittedSecond.brainAssetVersionId).not.toBe(admittedFirst.brainAssetVersionId);
    expect(admittedSecond.brainAssetVersionId).toMatch(/^brain-asset-version_[0-9a-f]{64}$/);
    expect(registry.listVersions(admittedFirst.brainAssetId)).toHaveLength(2);
  });

  it('is idempotent for replay of the same BuildRun', () => {
    const registry = new InMemoryBrainAssetRegistry();
    const result = runBrainBuild(
      request([assertion('official-a', { amountMinor: 35000 })], '2026-08-27T00:00:00.000Z')
    );

    const first = registry.admitBuildResult(result);
    const replay = registry.admitBuildResult(result);

    expect(replay).toEqual(first);
    expect(registry.listVersions(first.brainAssetId)).toHaveLength(1);
  });

  it('fails closed for blocked BuildRuns', () => {
    const registry = new InMemoryBrainAssetRegistry();
    const result = runBrainBuild(
      request(
        [
          {
            ...assertion('official-eu', { amountMinor: 35000 }),
            scope: {
              domain: 'TRADEMARK',
              jurisdiction: 'EU',
              concept: 'test.registry.value',
              effectiveFrom: '2026-01-01T00:00:00.000Z'
            }
          }
        ],
        '2026-08-27T00:00:00.000Z'
      )
    );

    expect(result.run.status).toBe('BLOCKED');
    expect(() => registry.admitBuildResult(result)).toThrow(BrainAssetRegistryError);
  });
});
