import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CN_DURATION_BAND_ACCEPTED_DATASET_REF,
  CN_DURATION_BAND_ACCEPTED_ENGINE_VERSION,
  CN_DURATION_BAND_ACCEPTED_INTEGRITY_SHA256,
  CN_DURATION_BAND_ACCEPTED_QUERY_FINGERPRINT_SHA256,
  CN_DURATION_BAND_ACCEPTED_WATERMARK
} from '@markorbit/contracts/brain-cn-duration-band-classification';
import {
  parseBrainMethodContractV1,
  parseExecutableMethodPackageV1
} from '@markorbit/contracts/brain-method';
import type { MethodImprovementResearchMissionV1 } from '@markorbit/contracts/method-improvement';
import {
  MethodImprovementAdmissionServiceV1,
  type MethodImprovementAdmissionRepositoryV1,
  type PreparedMethodImprovementAdmissionV1
} from '../src/method-improvement.js';
import {
  MethodImprovementCandidateError,
  PHASE7_PILOT_A_CANONICAL_PREDECESSOR_METHOD_VERSION_ID,
  buildMethodImprovementCandidateV1
} from '../src/method-improvement-candidate.js';
import type { MethodOutcomeReportV1 } from '../src/method-outcome-report.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const predecessor = {
  methodPackageRef: 'brain-method-package:package_cn-duration@1',
  methodRef: 'brain-method:method_cn-duration',
  methodVersionRef: 'brain-method-version:method-version_cn-duration',
  evaluationRef: 'brain-method-evaluation:evaluation_cn-duration'
} as const;
const watermark = {
  admissionSequence: 7,
  methodOutcomeEvidenceId: 'method-outcome-evidence_phase7-candidate-7'
} as const;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function mission(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    missionId: 'brain-research-mission_phase7-cn-duration-candidate',
    capabilityDemand: 'Improve the governed CN completed-duration historical-band method.',
    problem: 'Research bounded reproducible causes for an admitted Phase 6 METHOD_ERROR signal.',
    targetMethodFamily: 'CLASSIFICATION',
    applicabilityTarget: {
      jurisdictions: ['CN'],
      authorities: ['CNIPA'],
      objectTypes: ['TRADEMARK_CASE'],
      operations: ['DURATION_BAND_CLASSIFICATION'],
      procedures: ['COMPLETED_CASE_RESEARCH'],
      stages: ['COMPLETED'],
      filingBases: ['NOT_APPLICABLE'],
      segments: ['HISTORICAL_BAND'],
      requiredData: ['COMPLETED_DURATION_FACTS'],
      effectiveFrom: '2026-08-31T00:00:00.000Z'
    },
    knowledgeResearchPlan: ['Resolve exact authoritative CN duration sources.'],
    dataEngineResearchPlan: ['Rebuild a new accepted reproducible CN duration cohort.'],
    hypotheses: ['A refreshed bounded duration distribution may improve historical-band boundaries.'],
    featurePlan: ['Evaluate deterministic completed-duration features only.'],
    evaluationPlan: ['Produce a candidate for later comparison with the exact predecessor.'],
    successMetrics: ['reproducible candidate boundaries'],
    baselineMetrics: [predecessor.evaluationRef],
    createdAt: '2026-08-31T04:10:00.000Z',
    ...overrides
  };
}

function command() {
  return {
    schemaVersion: 1,
    workspaceId,
    triggerType: 'PERFORMANCE_GAP',
    predecessor,
    reportQuery: {
      schemaVersion: 1,
      workspaceId,
      methodPackageRef: predecessor.methodPackageRef,
      methodVersionRef: predecessor.methodVersionRef,
      watermark
    },
    reason: 'Explicit bounded Phase 7 performance-gap research trigger.',
    createdByPrincipalId: 'principal_phase7-governance',
    mission: mission()
  };
}

function report(): MethodOutcomeReportV1 {
  return {
    schemaVersion: 1,
    workspaceId,
    methodPackageRef: predecessor.methodPackageRef,
    methodVersionRef: predecessor.methodVersionRef,
    watermark,
    admittedReviews: 1,
    confirmed: { count: 0, rate: 0 },
    overridden: { count: 1, rate: 1 },
    methodError: { count: 1, rate: 1 },
    inputDataError: { count: 0, rate: 0 },
    applicabilityError: { count: 0, rate: 0 },
    productUserPreference: { count: 0, rate: 0 },
    inconclusive: { count: 0, rate: 0 },
    sampleEvidenceRefs: [
      {
        admissionSequence: 7,
        methodOutcomeEvidenceId: watermark.methodOutcomeEvidenceId,
        reviewId: 'matter-intelligence-review_phase7-candidate',
        reviewVersion: 1,
        outcome: 'OVERRIDDEN',
        reason: 'METHOD_ERROR',
        admittedAt: '2026-08-31T04:09:00.000Z'
      }
    ]
  };
}

class CaptureRepository implements MethodImprovementAdmissionRepositoryV1 {
  admit(input: Readonly<PreparedMethodImprovementAdmissionV1>) {
    return Promise.resolve({
      trigger: input.trigger,
      researchMission: input.researchMission,
      replayed: false
    });
  }
}

async function admitted() {
  const service = new MethodImprovementAdmissionServiceV1({
    repository: new CaptureRepository(),
    reports: { report: () => Promise.resolve(report()) },
    now: () => '2026-08-31T04:11:00.000Z',
    triggerIdFactory: () => 'phase7-candidate-trigger',
    researchMissionIdFactory: () => 'phase7-candidate-mission'
  });
  return service.admit({
    workspaceId,
    idempotencyKey: 'phase7-candidate-admission',
    correlationId: 'phase7-candidate-correlation',
    command: command()
  });
}

interface ResearchFixtureOptions {
  querySha?: string;
  integritySha?: string;
  engineSha?: string;
  datasetRefId?: string;
  researchWatermark?: string;
  p25Days?: number;
  medianDays?: number;
  p75Days?: number;
  receiptIntegritySha?: string;
  replayMedianDays?: number;
}

function researchFixture(options: ResearchFixtureOptions = {}) {
  const querySha = options.querySha ?? 'd'.repeat(64);
  const integritySha = options.integritySha ?? 'e'.repeat(64);
  const engineSha = options.engineSha ?? 'f'.repeat(40);
  const datasetRefId = options.datasetRefId ?? `research-dataset_${querySha}`;
  const researchWatermark =
    options.researchWatermark ??
    'cn-serving-epoch:coverage=2026-08-31:max-success-sequence=200:success-count=200';
  const p25Days = options.p25Days ?? 330;
  const medianDays = options.medianDays ?? 340;
  const p75Days = options.p75Days ?? 390;
  const statistics = {
    count: 9_990,
    min_days: 10,
    p25_days: p25Days,
    median_days: medianDays,
    p75_days: p75Days,
    max_days: 500
  };
  const dataset = {
    contract_version: 1,
    dataset_ref_id: datasetRefId,
    engine_version: `git:${engineSha}`,
    fact_schema_version: 'CN_CASE_CURRENT_FILING_TO_PRELIM_DURATION_V1',
    jurisdictions: ['CN'],
    resource_kinds: ['cn_case_current'],
    query: {
      dataset: 'CN_FILING_TO_PRELIM_PUBLICATION_DURATION_V1',
      engine: 'clickhouse',
      source_table: 'markorbit_facts.cn_case_current',
      selected_fields: [
        'application_number',
        'filing_date',
        'prelim_pub_date',
        'source_package_id',
        'source_effective_date',
        'source_row_hash',
        'record_hash',
        'source_rank'
      ],
      source_column_aliases: { source_package_id: 'last_source_package_id' },
      source_predicate: {
        is_deleted: 0,
        filing_date: 'NOT_NULL',
        prelim_pub_date: 'NOT_NULL'
      },
      derived_fields: {
        duration_days: 'CALENDAR_DAYS(prelim_pub_date-filing_date)',
        quality: ['VALID', 'INVALID_DATE_ORDER']
      },
      source_lineage: 'PER_ROW_PACKAGE_AND_HASH_BOUND',
      replay_scope: 'QUIESCENT_CURRENT_SERVING_EPOCH',
      historic_as_of_reconstruction: false,
      missing_temporal_policy: 'EXCLUDE_DECLARED',
      invalid_date_order_policy: 'RETAIN_WITH_NULL_DURATION_AND_QUALITY_FLAG',
      ordering: ['application_number ASC'],
      population_bound: { strategy: 'ORDERED_PREFIX', max_rows: 10_000 },
      legal_conclusion: false,
      actionability: 'SOURCE_FACT_ONLY'
    },
    as_of: null,
    watermark: researchWatermark,
    completeness: 'COMPLETE_BOUNDED',
    pagination: {
      strategy: 'KEYSET',
      order_by: ['application_number ASC'],
      cursor_field: 'application_number',
      execution_batch_size_in_replay_identity: false
    },
    aggregation: null,
    sampling: null,
    partition: null,
    row_count: 10_000,
    generated_at: '2026-08-31T05:20:00.000Z',
    query_fingerprint_sha256: querySha,
    integrity_sha256: integritySha
  };
  const acceptanceReceipt = {
    receipt_version: 'CN_FILING_TO_PRELIM_RESEARCH_ACCEPTANCE_V1',
    status: 'PASS',
    redacted: true,
    objective_only: true,
    data_engine_sha: engineSha,
    engine_version: `git:${engineSha}`,
    dataset_ref_id: datasetRefId,
    query_fingerprint_sha256: querySha,
    row_count: 10_000,
    integrity_sha256: options.receiptIntegritySha ?? integritySha,
    watermark: researchWatermark,
    completeness: 'COMPLETE_BOUNDED',
    valid_rows: 9_990,
    invalid_date_order_rows: 10,
    replay_match: true,
    first_batch_size: 5_000,
    replay_batch_size: 1_000,
    physical_batch_size_in_identity: false,
    max_rows: 10_000,
    population_scope: 'DETERMINISTIC_ORDERED_PREFIX',
    replay_scope: 'QUIESCENT_CURRENT_SERVING_EPOCH',
    historic_as_of_reconstruction: false,
    legal_conclusion: false,
    raw_population_rows_emitted: false
  };
  const summary = (computedAt: string, medianOverride?: number) => ({
    schemaVersion: 1,
    sourceSystem: 'MARKORBIT_DATA_ENGINE',
    dataset_ref_id: datasetRefId,
    engine_version: `git:${engineSha}`,
    query_fingerprint_sha256: querySha,
    row_count: 10_000,
    integrity_sha256: integritySha,
    watermark: researchWatermark,
    valid_rows: 9_990,
    invalid_date_order_rows: 10,
    quantile_method: 'NEAREST_RANK',
    statistics: {
      ...statistics,
      ...(medianOverride === undefined ? {} : { median_days: medianOverride })
    },
    objective_only: true,
    legal_conclusion: false,
    predictive_claim: false,
    raw_population_rows_emitted: false,
    computed_at: computedAt
  });
  return {
    dataset,
    acceptanceReceipt,
    firstSummary: summary('2026-08-31T05:24:00.000Z'),
    replaySummary: summary('2026-08-31T05:25:00.000Z', options.replayMedianDays)
  };
}

function refingerprintMission(
  value: Readonly<MethodImprovementResearchMissionV1>,
  missionValue: MethodImprovementResearchMissionV1['mission']
): MethodImprovementResearchMissionV1 {
  const base = {
    schemaVersion: value.schemaVersion,
    workspaceId: value.workspaceId,
    triggerId: value.triggerId,
    triggerFingerprintSha256: value.triggerFingerprintSha256,
    predecessor: value.predecessor,
    mission: missionValue,
    createdByPrincipalId: value.createdByPrincipalId,
    createdAt: value.createdAt
  };
  return {
    ...base,
    researchMissionId: value.researchMissionId,
    missionFingerprintSha256: fingerprint(base)
  };
}

describe('Phase 7 trigger-bound Method Improvement candidate', () => {
  it('produces one deterministic CLASSIFICATION CANDIDATE from new reproducible research', async () => {
    const admission = await admitted();
    const input = {
      trigger: admission.trigger,
      researchMission: admission.researchMission,
      research: researchFixture()
    };
    const first = buildMethodImprovementCandidateV1(input);
    const replay = buildMethodImprovementCandidateV1(input);

    expect(replay).toEqual(first);
    expect(first.method.lifecycle).toBe('CANDIDATE');
    expect(first.package.lifecycle).toBe('CANDIDATE');
    expect(first.method.methodFamily).toBe('CLASSIFICATION');
    expect(first.package.methodFamily).toBe('CLASSIFICATION');
    expect(first.method.evaluation.status).toBe('CONDITIONAL');
    expect(first.package.evaluation.status).toBe('CONDITIONAL');
    expect(first.method.validatedAt).toBeUndefined();
    expect(first.package.activatedAt).toBeUndefined();
    expect(first.method.supersedesMethodVersionIds).toEqual([
      PHASE7_PILOT_A_CANONICAL_PREDECESSOR_METHOD_VERSION_ID
    ]);
    expect(first.predecessor).toEqual(predecessor);
    expect(first.method.lineage.researchDatasets[0]?.dataset_ref_id).toBe(
      `research-dataset_${'d'.repeat(64)}`
    );
    expect(first.package.executable).toMatchObject({
      thresholds: { p25Days: 330, medianDays: 340, p75Days: 390 },
      legalConclusion: false,
      predictiveClaim: false,
      riskClaim: false,
      probabilityClaim: false,
      recommendation: false,
      methodImprovement: {
        triggerId: admission.trigger.triggerId,
        researchMissionId: admission.researchMission.researchMissionId,
        predecessor
      }
    });
    expect(first.candidateFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.methodFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.packageFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(parseBrainMethodContractV1(first.method)).toEqual(first.method);
    expect(parseExecutableMethodPackageV1(first.package)).toEqual(first.package);
  });

  it('keeps candidate artifacts bounded and does not copy product state or raw population rows', async () => {
    const admission = await admitted();
    const candidate = buildMethodImprovementCandidateV1({
      trigger: admission.trigger,
      researchMission: admission.researchMission,
      research: researchFixture()
    });
    const serialized = JSON.stringify(candidate);

    expect(serialized).not.toContain('formalMatter');
    expect(serialized).not.toContain('customer');
    expect(serialized).not.toContain('capabilityPackage');
    expect(serialized).not.toContain('rawPopulationRows');
    expect(serialized).not.toContain('ACTIVE');
    expect(serialized).not.toContain('VALIDATED');
  });

  it('rejects tampered trigger or mission fingerprints and unrelated mission scope', async () => {
    const admission = await admitted();
    expect(() =>
      buildMethodImprovementCandidateV1({
        trigger: { ...admission.trigger, reason: 'tampered after admission' },
        researchMission: admission.researchMission,
        research: researchFixture()
      })
    ).toThrowError(expect.objectContaining({ code: 'INVALID_TRIGGER' }));

    const unrelatedMission = {
      ...admission.researchMission.mission,
      applicabilityTarget: {
        ...admission.researchMission.mission.applicabilityTarget,
        operations: ['UNRELATED_CLASSIFICATION']
      }
    };
    const refingerprinted = refingerprintMission(
      admission.researchMission,
      unrelatedMission as MethodImprovementResearchMissionV1['mission']
    );
    expect(() =>
      buildMethodImprovementCandidateV1({
        trigger: admission.trigger,
        researchMission: refingerprinted,
        research: researchFixture()
      })
    ).toThrowError(expect.objectContaining({ code: 'MISSION_MISMATCH' }));
  });

  it('rejects predecessor drift before producing any candidate artifact', async () => {
    const admission = await admitted();
    const driftedPredecessor = {
      ...predecessor,
      methodRef: 'brain-method:method_cn-duration-drift'
    };
    const driftedTrigger = {
      ...admission.trigger,
      predecessor: driftedPredecessor
    };
    const driftedMission = {
      ...admission.researchMission,
      predecessor: driftedPredecessor
    };

    expect(() =>
      buildMethodImprovementCandidateV1({
        trigger: driftedTrigger,
        researchMission: driftedMission,
        research: researchFixture()
      })
    ).toThrowError(expect.objectContaining({ code: 'PREDECESSOR_MISMATCH' }));
  });

  it('fails closed on receipt or descriptive replay drift', async () => {
    const admission = await admitted();
    expect(() =>
      buildMethodImprovementCandidateV1({
        trigger: admission.trigger,
        researchMission: admission.researchMission,
        research: researchFixture({ receiptIntegritySha: '9'.repeat(64) })
      })
    ).toThrowError(expect.objectContaining({ code: 'RESEARCH_REJECTED' }));

    expect(() =>
      buildMethodImprovementCandidateV1({
        trigger: admission.trigger,
        researchMission: admission.researchMission,
        research: researchFixture({ replayMedianDays: 341 })
      })
    ).toThrowError(expect.objectContaining({ code: 'RESEARCH_REJECTED' }));
  });

  it('rejects non-strict classification thresholds even when descriptive replay agrees', async () => {
    const admission = await admitted();
    expect(() =>
      buildMethodImprovementCandidateV1({
        trigger: admission.trigger,
        researchMission: admission.researchMission,
        research: researchFixture({ p25Days: 340, medianDays: 340, p75Days: 390 })
      })
    ).toThrowError(expect.objectContaining({ code: 'THRESHOLD_CONTRACT_MISMATCH' }));
  });

  it('rejects the exact accepted predecessor research identity as a no-op candidate', async () => {
    const admission = await admitted();
    const oldResearch = researchFixture({
      querySha: CN_DURATION_BAND_ACCEPTED_QUERY_FINGERPRINT_SHA256,
      integritySha: CN_DURATION_BAND_ACCEPTED_INTEGRITY_SHA256,
      engineSha: CN_DURATION_BAND_ACCEPTED_ENGINE_VERSION.slice(4),
      datasetRefId: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
      researchWatermark: CN_DURATION_BAND_ACCEPTED_WATERMARK,
      p25Days: 335,
      medianDays: 336,
      p75Days: 383
    });

    expect(() =>
      buildMethodImprovementCandidateV1({
        trigger: admission.trigger,
        researchMission: admission.researchMission,
        research: oldResearch
      })
    ).toThrowError(expect.objectContaining({ code: 'NO_CANDIDATE_CHANGE' }));
  });

  it('uses fail-closed typed errors for candidate rejection', async () => {
    const admission = await admitted();
    try {
      buildMethodImprovementCandidateV1({
        trigger: admission.trigger,
        researchMission: admission.researchMission,
        research: researchFixture({ receiptIntegritySha: '8'.repeat(64) })
      });
      throw new Error('expected candidate rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(MethodImprovementCandidateError);
      expect(error).toMatchObject({ code: 'RESEARCH_REJECTED' });
    }
  });
});
