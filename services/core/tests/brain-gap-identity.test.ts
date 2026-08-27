import { describe, expect, it } from 'vitest';
import type { BrainBuildRequest } from '@markorbit/contracts/brain-build';
import { runBrainBuild } from '../src/brain-build-runtime.js';
import { auditBrainBuildRun } from '../src/brain-self-audit.js';

function request(builtAt: string): BrainBuildRequest {
  return {
    assertions: [],
    query: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'brain.gap.identity.missing-evidence',
      asOf: builtAt
    },
    qualityEvidence: {
      coverage: 0,
      validation: 0,
      methodQuality: 1,
      coverageReason: 'No applicable evidence exists.',
      validationReason: 'No resolved value exists to validate.',
      methodQualityReason: 'Deterministic missing-evidence build fixture.'
    },
    assetScope: {
      inputSchemaId: 'brain-input.gap-identity.v1',
      outputSchemaId: 'brain-output.gap-identity.v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    builtAt
  };
}

describe('BrainGap longitudinal identity', () => {
  it('stays stable across distinct BuildRuns while preserving occurrence lineage', () => {
    const firstRun = runBrainBuild(request('2026-08-27T00:00:00.000Z')).run;
    const secondRun = runBrainBuild(request('2026-08-28T00:00:00.000Z')).run;
    const firstGap = auditBrainBuildRun(firstRun, '2026-08-27T00:05:00.000Z').gaps[0];
    const secondGap = auditBrainBuildRun(secondRun, '2026-08-28T00:05:00.000Z').gaps[0];

    expect(firstRun.brainBuildRunId).not.toBe(secondRun.brainBuildRunId);
    expect(firstGap?.gapType).toBe('MISSING_EVIDENCE');
    expect(secondGap?.gapType).toBe('MISSING_EVIDENCE');
    expect(firstGap?.brainGapId).toBe(secondGap?.brainGapId);
    expect(firstGap?.fingerprintSha256).toBe(secondGap?.fingerprintSha256);
    expect(firstGap?.relatedBrainBuildRunId).not.toBe(secondGap?.relatedBrainBuildRunId);
    expect(firstGap?.detectedAt).not.toBe(secondGap?.detectedAt);
  });
});
