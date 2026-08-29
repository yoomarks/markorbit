import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CN_DURATION_BAND_ACCEPTED_DATASET_REF,
  CN_DURATION_BAND_ACCEPTED_EVIDENCE_SHA256,
  CN_DURATION_BAND_EXECUTABLE_KIND,
  CN_DURATION_BAND_METHOD_FAMILY,
  CN_DURATION_BAND_RESEARCH_MISSION_V1,
  classifyCnCompletedDurationHistoricalBandV1,
  compileCnDurationBandClassificationMethodPackageV1,
  evaluateCnDurationBandClassificationV1
} from '../src/brain-cn-duration-band-classification.js';

const evidencePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'evidence',
  'cn_filing_to_prelim_research_evidence_4ee0030dd77fac50f973573818225324888dc064.json'
);
const evidenceBytes = readFileSync(evidencePath);
const evidence = JSON.parse(evidenceBytes.toString('utf8')) as Record<string, unknown>;

function acceptedInput() {
  return {
    dataset: structuredClone(evidence.dataset),
    acceptanceReceipt: structuredClone(evidence.acceptance_receipt),
    firstSummary: structuredClone(evidence.first_summary),
    replaySummary: structuredClone(evidence.replay_summary)
  };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('expected record');
  }
  return value as Record<string, unknown>;
}

describe('Phase 4 CN completed-duration historical band classification precursor', () => {
  it('freezes a separate CLASSIFICATION research mission with no Knowledge plan', () => {
    expect(CN_DURATION_BAND_RESEARCH_MISSION_V1.targetMethodFamily).toBe('CLASSIFICATION');
    expect(CN_DURATION_BAND_METHOD_FAMILY).toBe('CLASSIFICATION');
    expect(CN_DURATION_BAND_RESEARCH_MISSION_V1.knowledgeResearchPlan).toEqual([]);
    expect(CN_DURATION_BAND_RESEARCH_MISSION_V1.dataEngineResearchPlan).toHaveLength(3);
    expect(CN_DURATION_BAND_RESEARCH_MISSION_V1.applicabilityTarget.operations).toEqual([
      'CLASSIFY_COMPLETED_DURATION_HISTORICAL_BAND'
    ]);
  });

  it('evaluates only the exact accepted Phase 3 evidence and compiles a VALIDATED package', () => {
    expect(createHash('sha256').update(evidenceBytes).digest('hex')).toBe(
      CN_DURATION_BAND_ACCEPTED_EVIDENCE_SHA256
    );

    const result = compileCnDurationBandClassificationMethodPackageV1(acceptedInput());
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') throw new Error(`expected READY, got ${result.status}`);

    expect(result.method.methodFamily).toBe('CLASSIFICATION');
    expect(result.method.lifecycle).toBe('VALIDATED');
    expect(result.method.evaluation.status).toBe('PASSED');
    expect(result.method.evaluation.metrics.boundaryCasePassRate).toBe(1);
    expect(result.method.evaluation.metrics.predictiveClaimRate).toBe(0);
    expect(result.method.evaluation.metrics.legalClaimRate).toBe(0);
    expect(result.method.evaluation.metrics.riskClaimRate).toBe(0);
    expect(result.method.evaluation.metrics.recommendationClaimRate).toBe(0);

    expect(result.package.lifecycle).toBe('VALIDATED');
    expect(result.package.activatedAt).toBeUndefined();
    expect(result.package.lineage.knowledgeSources).toEqual([]);
    expect(result.package.lineage.researchDatasets).toHaveLength(1);
    expect(result.package.lineage.researchDatasets[0]?.dataset_ref_id).toBe(
      CN_DURATION_BAND_ACCEPTED_DATASET_REF
    );
    expect(result.package.executable).toMatchObject({
      kind: CN_DURATION_BAND_EXECUTABLE_KIND,
      datasetRefId: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
      thresholds: { p25Days: 335, medianDays: 336, p75Days: 383 },
      legalConclusion: false,
      predictiveClaim: false,
      riskClaim: false,
      probabilityClaim: false,
      recommendation: false
    });
  });

  it('classifies all frozen threshold boundaries deterministically', () => {
    const thresholds = { p25Days: 335, medianDays: 336, p75Days: 383 } as const;
    expect(classifyCnCompletedDurationHistoricalBandV1(0, thresholds)).toBe(
      'LOWER_QUARTILE_OR_BELOW'
    );
    expect(classifyCnCompletedDurationHistoricalBandV1(334, thresholds)).toBe(
      'LOWER_QUARTILE_OR_BELOW'
    );
    expect(classifyCnCompletedDurationHistoricalBandV1(335, thresholds)).toBe(
      'LOWER_QUARTILE_OR_BELOW'
    );
    expect(classifyCnCompletedDurationHistoricalBandV1(336, thresholds)).toBe(
      'LOWER_INTERQUARTILE'
    );
    expect(classifyCnCompletedDurationHistoricalBandV1(337, thresholds)).toBe(
      'UPPER_INTERQUARTILE'
    );
    expect(classifyCnCompletedDurationHistoricalBandV1(383, thresholds)).toBe(
      'UPPER_INTERQUARTILE'
    );
    expect(classifyCnCompletedDurationHistoricalBandV1(384, thresholds)).toBe('UPPER_QUARTILE');
    expect(classifyCnCompletedDurationHistoricalBandV1(3654, thresholds)).toBe('UPPER_QUARTILE');
  });

  it('rejects invalid observed durations and invalid threshold contracts', () => {
    const thresholds = { p25Days: 335, medianDays: 336, p75Days: 383 } as const;
    expect(() => classifyCnCompletedDurationHistoricalBandV1(-1, thresholds)).toThrow(
      'non-negative safe integer'
    );
    expect(() => classifyCnCompletedDurationHistoricalBandV1(1.5, thresholds)).toThrow(
      'non-negative safe integer'
    );
    expect(() =>
      classifyCnCompletedDurationHistoricalBandV1(336, {
        p25Days: 336,
        medianDays: 336,
        p75Days: 383
      })
    ).toThrow('thresholds are invalid');
  });

  it('fails closed when replayed descriptive thresholds drift from accepted evidence', () => {
    const input = acceptedInput();
    const first = record(input.firstSummary);
    const replay = record(input.replaySummary);
    record(first.statistics).p25_days = 334;
    record(replay.statistics).p25_days = 334;

    expect(evaluateCnDurationBandClassificationV1(input)).toEqual({
      status: 'REJECTED',
      reason: 'SOURCE_EVIDENCE_IDENTITY_MISMATCH'
    });
  });

  it('fails closed when the accepted dataset identity is substituted', () => {
    const input = acceptedInput();
    record(input.dataset).dataset_ref_id = `research-dataset_${'f'.repeat(64)}`;

    const result = evaluateCnDurationBandClassificationV1(input);
    expect(result.status).toBe('REJECTED');
  });
});
