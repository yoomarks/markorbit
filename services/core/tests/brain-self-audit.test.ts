import { describe, expect, it } from 'vitest';
import type { BrainBuildRequest } from '@markorbit/contracts/brain-build';
import type { BrainEvidenceAssertion } from '@markorbit/contracts/brain-evidence';
import { runBrainBuild } from '../src/brain-build-runtime.js';
import { auditBrainBuildRun } from '../src/brain-self-audit.js';

const sourceSha = 'b'.repeat(64);
const builtAt = '2026-08-27T00:00:00.000Z';

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
      concept: 'test.self-audit.value',
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
  validation = 0.9,
  coverage = 1,
  methodQuality = 1
): BrainBuildRequest {
  return {
    assertions,
    query: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'test.self-audit.value',
      asOf: builtAt
    },
    qualityEvidence: {
      coverage,
      validation,
      methodQuality,
      coverageReason: 'Self-audit fixture coverage.',
      validationReason: 'Self-audit fixture validation.',
      methodQualityReason: 'Deterministic self-audit fixture method.'
    },
    assetScope: {
      inputSchemaId: 'brain-input.self-audit.v1',
      outputSchemaId: 'brain-output.self-audit.v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    builtAt
  };
}

function audit(input: BrainBuildRequest) {
  return auditBrainBuildRun(runBrainBuild(input).run, builtAt);
}

describe('Brain Cognitive Self-Audit', () => {
  it('surfaces missing evidence with stable lineage and a Knowledge target', () => {
    const wrongJurisdiction = assertion(
      'eu-only',
      { answer: 1 },
      {
        scope: {
          domain: 'TRADEMARK',
          jurisdiction: 'EU',
          concept: 'test.self-audit.value',
          effectiveFrom: '2026-01-01T00:00:00.000Z'
        }
      }
    );
    const run = runBrainBuild(request([wrongJurisdiction])).run;
    const first = auditBrainBuildRun(run, builtAt);
    const second = auditBrainBuildRun(run, '2026-08-28T00:00:00.000Z');

    expect(first.gaps).toHaveLength(1);
    expect(first.gaps[0]?.gapType).toBe('MISSING_EVIDENCE');
    expect(first.gaps[0]?.targetModule).toBe('KNOWLEDGE');
    expect(first.gaps[0]?.relatedBrainBuildRunId).toBe(run.brainBuildRunId);
    expect(first.gaps[0]?.fingerprintSha256).toBe(second.gaps[0]?.fingerprintSha256);
    expect(first.gaps[0]?.detectedAt).not.toBe(second.gaps[0]?.detectedAt);
  });

  it('surfaces highest-authority conflicts instead of collapsing them', () => {
    const result = audit(
      request([assertion('official-a', { answer: 1 }), assertion('official-b', { answer: 2 })])
    );

    expect(result.gaps.map((item) => item.gapType)).toEqual(['CONFLICTING_EVIDENCE']);
    expect(result.gaps[0]?.reasonCode).toBe('HIGHEST_AUTHORITY_CONFLICT');
    expect(result.gaps[0]?.targetModule).toBe('KNOWLEDGE');
    expect(result.gaps[0]?.evidenceRefs).toHaveLength(2);
  });

  it('detects stale evidence independently of agreement', () => {
    const staleEvidence = assertion(
      'old-official',
      { answer: 1 },
      {
        evidenceRef: {
          sourceOwner: 'KNOWLEDGE',
          sourceObjectId: 'old-official',
          sourceVersion: '2024-01',
          sourceFingerprintSha256: sourceSha,
          observedAt: '2024-01-01T00:00:00.000Z'
        }
      }
    );
    const result = audit(request([staleEvidence]));

    expect(result.gaps.some((item) => item.gapType === 'STALE_EVIDENCE')).toBe(true);
    expect(result.gaps.find((item) => item.gapType === 'STALE_EVIDENCE')?.targetModule).toBe(
      'KNOWLEDGE'
    );
  });

  it('uses decomposed confidence to surface low-confidence cognition', () => {
    const result = audit(request([assertion('official-a', { answer: 1 })], 0, 0, 0));
    const gap = result.gaps.find((item) => item.gapType === 'LOW_CONFIDENCE');

    expect(gap).toBeDefined();
    expect(gap?.targetModule).toBe('BRAIN_BUILD');
    expect(gap?.reasonCode).toBe('CONFIDENCE_BELOW_OPERATIONAL_THRESHOLD');
    expect(gap?.evidenceRefs).toHaveLength(1);
  });

  it('routes low-coverage statistical estimates to Data Engine without collapsing other gaps', () => {
    const statistical = assertion(
      'stats-a',
      { medianMonths: 8, sampleSize: 12 },
      {
        authorityClass: 'CURRENT_OFFICIAL_STATISTICAL',
        valueKind: 'STATISTICAL_RANGE'
      }
    );
    const result = audit(request([statistical], 0, 0.2, 0));
    const types = result.gaps.map((item) => item.gapType);

    expect(types).toContain('INSUFFICIENT_SAMPLE');
    expect(types).toContain('LOW_CONFIDENCE');
    expect(result.gaps.find((item) => item.gapType === 'INSUFFICIENT_SAMPLE')?.targetModule).toBe(
      'DATA_ENGINE'
    );
    expect(new Set(result.gaps.map((item) => item.fingerprintSha256)).size).toBe(
      result.gaps.length
    );
    expect([...types].sort()).toEqual(types);
  });

  it('does not manufacture a gap for a fresh high-quality build', () => {
    const result = audit(
      request([assertion('official-a', { answer: 1 }), assertion('official-b', { answer: 1 })])
    );

    expect(result.gaps).toEqual([]);
  });
});
