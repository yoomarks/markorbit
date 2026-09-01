import { describe, expect, it } from 'vitest';
import type { BrainBuildRequest } from '@markorbit/contracts/brain-build';
import type { BrainEvidenceAssertion } from '@markorbit/contracts/brain-evidence';
import {
  auditAndRecordBrainBuildRun,
  brainBuildSelfAuditObservationNoAuthorityV1,
  type BrainGapAuditAdmissionAuthorityV1
} from '../src/brain-build-self-audit-observation.js';
import { runBrainBuild } from '../src/brain-build-runtime.js';
import { InMemoryBrainGapRegistry } from '../src/brain-gap-registry.js';

const sourceSha = 'd'.repeat(64);
const builtAt = '2026-09-01T01:00:00.000Z';

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
      sourceVersion: '2026-09',
      sourceFingerprintSha256: sourceSha,
      observedAt: '2026-09-01T00:00:00.000Z'
    },
    authorityClass: 'CURRENT_OFFICIAL_PRIMARY',
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'test.brain-build-gap-observation',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    valueKind: 'EXACT',
    value,
    assertedAt: '2026-09-01T00:00:00.000Z',
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
      concept: 'test.brain-build-gap-observation',
      asOf: builtAt
    },
    qualityEvidence: {
      coverage,
      validation,
      methodQuality,
      coverageReason: 'Governed observation fixture coverage.',
      validationReason: 'Governed observation fixture validation.',
      methodQualityReason: 'Governed observation fixture method quality.'
    },
    assetScope: {
      inputSchemaId: 'brain-input.gap-observation.v1',
      outputSchemaId: 'brain-output.gap-observation.v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    builtAt
  };
}

describe('governed Brain build self-audit observation', () => {
  it('audits and records a blocked BuildRun as the exact governed gap', async () => {
    const wrongJurisdiction = assertion(
      'eu-only',
      { answer: 1 },
      {
        scope: {
          domain: 'TRADEMARK',
          jurisdiction: 'EU',
          concept: 'test.brain-build-gap-observation',
          effectiveFrom: '2026-01-01T00:00:00.000Z'
        }
      }
    );
    const run = runBrainBuild(request([wrongJurisdiction])).run;
    const registry = new InMemoryBrainGapRegistry();

    const observed = await auditAndRecordBrainBuildRun(run, builtAt, registry);

    expect(run.status).toBe('BLOCKED');
    expect(observed.audit.gaps).toHaveLength(1);
    expect(observed.audit.gaps[0]?.gapType).toBe('MISSING_EVIDENCE');
    expect(observed.audit.gaps[0]?.relatedBrainBuildRunId).toBe(run.brainBuildRunId);
    expect(observed.admittedGapRecords).toHaveLength(1);
    expect(observed.admittedGapRecords[0]?.identityFingerprintSha256).toBe(
      observed.audit.gaps[0]?.fingerprintSha256
    );
    expect(registry.query()).toEqual(observed.admittedGapRecords);
  });

  it('records no gaps for a fresh high-quality BuildRun', async () => {
    const run = runBrainBuild(
      request([assertion('official-a', { answer: 1 }), assertion('official-b', { answer: 1 })])
    ).run;
    const registry = new InMemoryBrainGapRegistry();

    const observed = await auditAndRecordBrainBuildRun(run, builtAt, registry);

    expect(run.status).toBe('VALIDATED_READY');
    expect(observed.audit.gaps).toEqual([]);
    expect(observed.admittedGapRecords).toEqual([]);
    expect(registry.query()).toEqual([]);
  });

  it('admits a multi-gap audit as one batch and returns records in deterministic key order', async () => {
    const statistical = assertion(
      'statistical-a',
      { medianMonths: 8, sampleSize: 12 },
      {
        authorityClass: 'CURRENT_OFFICIAL_STATISTICAL',
        valueKind: 'STATISTICAL_RANGE'
      }
    );
    const run = runBrainBuild(request([statistical], 0, 0.2, 0)).run;
    const registry = new InMemoryBrainGapRegistry();
    let admissionCalls = 0;
    const authority: BrainGapAuditAdmissionAuthorityV1 = {
      admitAudit(result) {
        admissionCalls += 1;
        return registry.admitAudit(result);
      }
    };

    const observed = await auditAndRecordBrainBuildRun(run, builtAt, authority);
    const keys = observed.admittedGapRecords.map((record) => record.brainGapRegistryKey);

    expect(observed.audit.gaps.map((gap) => gap.gapType)).toContain('INSUFFICIENT_SAMPLE');
    expect(observed.audit.gaps.map((gap) => gap.gapType)).toContain('LOW_CONFIDENCE');
    expect(observed.audit.gaps.map((gap) => gap.gapType)).not.toContain('MISSING_CAPABILITY');
    expect(admissionCalls).toBe(1);
    expect(observed.admittedGapRecords).toHaveLength(observed.audit.gaps.length);
    expect(keys).toEqual([...keys].sort());
  });

  it('preserves exact replay idempotence through the existing registry authority', async () => {
    const wrongJurisdiction = assertion(
      'eu-only',
      { answer: 1 },
      {
        scope: {
          domain: 'TRADEMARK',
          jurisdiction: 'EU',
          concept: 'test.brain-build-gap-observation',
          effectiveFrom: '2026-01-01T00:00:00.000Z'
        }
      }
    );
    const run = runBrainBuild(request([wrongJurisdiction])).run;
    const registry = new InMemoryBrainGapRegistry();

    const first = await auditAndRecordBrainBuildRun(run, builtAt, registry);
    const replay = await auditAndRecordBrainBuildRun(run, builtAt, registry);

    expect(replay).toEqual(first);
    expect(registry.query()).toHaveLength(1);
    expect(registry.query()[0]?.occurrenceCount).toBe(1);
  });

  it('surfaces registry admission failure instead of reporting a successful observation', async () => {
    const run = runBrainBuild(request([assertion('official-a', { answer: 1 })], 0, 0, 0)).run;
    const authority: BrainGapAuditAdmissionAuthorityV1 = {
      admitAudit() {
        throw new Error('registry unavailable');
      }
    };

    await expect(auditAndRecordBrainBuildRun(run, builtAt, authority)).rejects.toThrow(
      'registry unavailable'
    );
  });

  it('makes the coordinator non-authority boundary explicit', async () => {
    const run = runBrainBuild(request([assertion('official-a', { answer: 1 })], 0, 0, 0)).run;
    const registry = new InMemoryBrainGapRegistry();

    const observed = await auditAndRecordBrainBuildRun(run, builtAt, registry);

    expect(observed.noAuthority).toBe(brainBuildSelfAuditObservationNoAuthorityV1);
    expect(observed.noAuthority).toEqual({
      missingCapabilityInferred: false,
      researchMissionCreated: false,
      methodImprovementTriggerCreated: false,
      brainAssetAdmitted: false,
      brainAssetActivated: false,
      methodActivated: false,
      productStateCreated: false,
      recommendationCreated: false,
      officialTruthCreated: false
    });
  });
});
