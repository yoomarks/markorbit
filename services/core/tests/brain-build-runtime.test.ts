import { describe, expect, it } from 'vitest';
import type { BrainBuildRequest } from '@markorbit/contracts/brain-build';
import type { BrainEvidenceAssertion } from '@markorbit/contracts/brain-evidence';
import { runBrainBuild } from '../src/brain-build-runtime.js';

const sourceSha = 'a'.repeat(64);

function assertion(
  id: string,
  value: unknown,
  overrides: Partial<BrainEvidenceAssertion> = {}
): BrainEvidenceAssertion {
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
      concept: 'test.official.value',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    valueKind: 'EXACT',
    value,
    assertedAt: '2026-08-26T00:00:00.000Z',
    ...overrides
  };
}

function request(
  assertions: BrainEvidenceAssertion[],
  validation = 0.2,
  coverage = 1,
  methodQuality = 1
): BrainBuildRequest {
  return {
    assertions,
    query: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'test.official.value',
      asOf: '2026-08-27T00:00:00.000Z'
    },
    qualityEvidence: {
      coverage,
      validation,
      methodQuality,
      coverageReason: 'Build fixture scope coverage.',
      validationReason: 'Build fixture independent validation evidence.',
      methodQualityReason: 'Direct deterministic evidence resolution.'
    },
    assetScope: {
      inputSchemaId: 'brain-input.test.v1',
      outputSchemaId: 'brain-output.test.v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    builtAt: '2026-08-27T00:00:00.000Z'
  };
}

describe('Brain Build Runtime', () => {
  it('deterministically compiles supported exact evidence into a candidate asset', () => {
    const input = request([assertion('official-a', { amountMinor: 35000, currency: 'USD' })]);
    const first = runBrainBuild(input);
    const second = runBrainBuild(input);

    expect(first).toEqual(second);
    expect(first.run.status).toBe('CANDIDATE_READY');
    expect(first.run.producedAssetVersion?.status).toBe('CANDIDATE');
    expect(first.run.producedAssetVersion?.assetType).toBe('RESOLVED_VALUE');
    expect(first.run.producedAssetVersion?.evidenceRefs).toHaveLength(1);
    expect(first.run.brainBuildRunId).toContain(first.run.inputFingerprintSha256);
  });

  it('can compile high-confidence independently validated evidence as VALIDATED but never ACTIVE', () => {
    const result = runBrainBuild(
      request(
        [
          assertion('official-a', { amountMinor: 35000, currency: 'USD' }),
          assertion('official-b', { amountMinor: 35000, currency: 'USD' })
        ],
        0.9
      )
    );

    expect(result.run.status).toBe('VALIDATED_READY');
    expect(result.run.producedAssetVersion?.status).toBe('VALIDATED');
    expect(result.run.producedAssetVersion?.status).not.toBe('ACTIVE');
    expect(result.run.producedAssetVersion?.validatedAt).toBe('2026-08-27T00:00:00.000Z');
  });

  it('fails closed when no evidence applies or highest-authority evidence conflicts', () => {
    const wrongJurisdiction = assertion(
      'official-eu',
      { answer: 1 },
      {
        scope: {
          domain: 'TRADEMARK',
          jurisdiction: 'EU',
          concept: 'test.official.value',
          effectiveFrom: '2026-01-01T00:00:00.000Z'
        }
      }
    );
    const noEvidence = runBrainBuild(request([wrongJurisdiction]));
    expect(noEvidence.run.status).toBe('BLOCKED');
    expect(noEvidence.run.blockedReason).toBe('NO_APPLICABLE_EVIDENCE');
    expect(noEvidence.run.producedAssetVersion).toBeUndefined();

    const conflict = runBrainBuild(
      request([assertion('official-a', { answer: 1 }), assertion('official-b', { answer: 2 })])
    );
    expect(conflict.run.status).toBe('BLOCKED');
    expect(conflict.run.blockedReason).toBe('EVIDENCE_CONFLICT');
    expect(conflict.run.producedAssetVersion).toBeUndefined();
  });

  it('blocks low-confidence and unsupported derived candidates', () => {
    const low = runBrainBuild(request([assertion('official-a', { answer: 1 })], 0, 0, 0));
    expect(low.run.status).toBe('BLOCKED');
    expect(low.run.blockedReason).toBe('CONFIDENCE_BELOW_CANDIDATE_THRESHOLD');

    const derived = assertion('derived-a', { answer: 1 }, { valueKind: 'DERIVED' });
    const unsupported = runBrainBuild(request([derived], 1));
    expect(unsupported.run.status).toBe('BLOCKED');
    expect(unsupported.run.blockedReason).toBe('UNSUPPORTED_VALUE_KIND');
  });
});
