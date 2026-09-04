import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BrainResearchMissionV1 } from '@markorbit/contracts/brain-method';
import {
  methodImprovementCoverageGapMissionFingerprintV1,
  methodImprovementCoverageGapNoDownstreamAuthority,
  methodImprovementCoverageGapReplayKeyFingerprintV1,
  methodImprovementCoverageGapTriggerFingerprintV1
} from '@markorbit/contracts/method-improvement-coverage-gap';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { createPostgresBrainCognitiveReadServiceV1 } from '../src/brain-cognitive-read-postgres.js';
import {
  MethodImprovementCognitiveReadSourceError,
  PostgresMethodImprovementCognitiveReadSourceV1
} from '../src/method-improvement-cognitive-read-postgres.js';

const dedicatedUrl = process.env.CORE_METHOD_IMPROVEMENT_TEST_DATABASE_URL;
const url =
  dedicatedUrl ??
  process.env.CORE_METHOD_OUTCOME_EVIDENCE_TEST_DATABASE_URL ??
  process.env.IDENTITY_TEST_DATABASE_URL;
const required =
  process.env.CORE_METHOD_IMPROVEMENT_POSTGRES_REQUIRED === '1' ||
  process.env.CORE_METHOD_OUTCOME_EVIDENCE_POSTGRES_REQUIRED === '1' ||
  process.env.IDENTITY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'Method Improvement PostgreSQL acceptance requires CORE_METHOD_IMPROVEMENT_TEST_DATABASE_URL, CORE_METHOD_OUTCOME_EVIDENCE_TEST_DATABASE_URL or IDENTITY_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const coreMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service');
const migrationNamespace = dedicatedUrl ? 'core_method_improvement' : 'core_identity';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const predecessor = {
  methodPackageRef: 'brain-method-package:package_cn-duration@1',
  methodRef: 'brain-method:method_cn-duration',
  methodVersionRef: 'brain-method-version:method-version_cn-duration',
  evaluationRef: 'brain-method-evaluation:evaluation_cn-duration',
  packageFingerprintSha256: '1'.repeat(64)
};

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

function databaseConfig() {
  return parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: migrationNamespace,
    DB_APPLICATION_NAME: 'markorbit-method-improvement-cognitive-read-tests'
  });
}

function mission(
  suffix: string,
  createdAt: string,
  targetMethodFamily: BrainResearchMissionV1['targetMethodFamily'] = 'CLASSIFICATION'
): BrainResearchMissionV1 {
  return {
    schemaVersion: 1,
    missionId: `brain-research-mission_${suffix}`,
    capabilityDemand: 'Improve one governed bounded cognitive method.',
    problem: 'Research reproducible causes for one explicitly admitted governed gap.',
    targetMethodFamily,
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
    knowledgeResearchPlan: ['Resolve exact authoritative bounded sources.'],
    dataEngineResearchPlan: ['Rebuild one accepted reproducible research cohort.'],
    hypotheses: ['A bounded edge case may explain the admitted gap.'],
    featurePlan: ['Evaluate deterministic features only.'],
    evaluationPlan: ['Compare a candidate with the exact governed predecessor or demand.'],
    successMetrics: ['bounded reproducible comparison'],
    baselineMetrics: [predecessor.evaluationRef],
    createdAt
  };
}

function persistedPerformanceAdmission(suffix: string, admittedAt: string) {
  const evidenceId = `method-outcome-evidence_${suffix}`;
  const triggerId = `method-improvement-trigger_${suffix}`;
  const researchMissionId = `method-improvement-research-mission_${suffix}`;
  const source = {
    kind: 'CORE_METHOD_OUTCOME_REPORT_V1' as const,
    query: {
      schemaVersion: 1 as const,
      workspaceId,
      methodPackageRef: predecessor.methodPackageRef,
      methodVersionRef: predecessor.methodVersionRef,
      watermark: {
        admissionSequence: 1,
        methodOutcomeEvidenceId: evidenceId
      }
    },
    admittedReviews: 1,
    counts: {
      confirmed: 0,
      overridden: 1,
      inconclusive: 0,
      methodError: 1,
      inputDataError: 0,
      applicabilityError: 0,
      productUserPreference: 0
    },
    sampleEvidenceRefs: [
      {
        admissionSequence: 1,
        methodOutcomeEvidenceId: evidenceId,
        reviewId: `matter-intelligence-review_${suffix}`,
        reviewVersion: 1,
        outcome: 'OVERRIDDEN' as const,
        reason: 'METHOD_ERROR' as const,
        admittedAt: '2026-08-31T04:20:30.000Z'
      }
    ],
    reportFingerprintSha256: '2'.repeat(64)
  };
  const triggerContent = {
    schemaVersion: 1 as const,
    workspaceId,
    triggerType: 'PERFORMANCE_GAP' as const,
    predecessor,
    source,
    reason: `Governed reason ${suffix}.`,
    createdByPrincipalId: 'principal_phase7-governance'
  };
  const triggerFingerprintSha256 = fingerprint(triggerContent);
  const trigger = {
    schemaVersion: 1 as const,
    triggerId,
    workspaceId,
    triggerType: 'PERFORMANCE_GAP' as const,
    predecessor,
    source,
    reason: triggerContent.reason,
    createdByPrincipalId: triggerContent.createdByPrincipalId,
    triggerFingerprintSha256,
    admittedAt
  };
  const research = mission(suffix, admittedAt);
  const missionContent = {
    schemaVersion: 1 as const,
    workspaceId,
    triggerId,
    triggerFingerprintSha256,
    predecessor,
    mission: research,
    createdByPrincipalId: trigger.createdByPrincipalId,
    createdAt: admittedAt
  };
  const missionFingerprintSha256 = fingerprint(missionContent);
  const researchMission = {
    researchMissionId,
    ...missionContent,
    missionFingerprintSha256
  };
  return {
    trigger,
    researchMission,
    sourceIdentityFingerprintSha256: fingerprint({
      query: source.query,
      reportFingerprintSha256: source.reportFingerprintSha256
    })
  };
}

function persistedCoverageAdmission(suffix: string, admittedAt: string) {
  const evidenceFingerprintSha256 = 'a'.repeat(64);
  const candidateFingerprintSha256 = 'c'.repeat(64);
  const demandFingerprintSha256 = 'd'.repeat(64);
  const source = {
    kind: 'CAPABILITY_COVERAGE_GAP_EVIDENCE_V1' as const,
    classification: 'COVERAGE_GAP_EVIDENCE' as const,
    phase7AdmissionStatus: 'NOT_ADMITTED' as const,
    sourceKind: 'CAPABILITY_DEMAND_COVERAGE_AUDIT_V1' as const,
    evidenceId: `capability-coverage-gap-evidence_${evidenceFingerprintSha256}` as const,
    evidenceFingerprintSha256,
    sourceAuditFingerprintSha256: 'b'.repeat(64),
    candidateId: `capability-coverage-gap-candidate_${candidateFingerprintSha256}` as const,
    candidateFingerprintSha256,
    coverageStatus: 'MISSING_RUNTIME_CAPABILITY' as const,
    demandId: `capability-demand_${demandFingerprintSha256}` as const,
    demandFingerprintSha256
  };
  const target = {
    kind: 'NEW_CAPABILITY_METHOD_DEMAND' as const,
    demandId: source.demandId,
    demandFingerprintSha256
  };
  const createdByPrincipalId = 'principal_phase7-coverage-governance';
  const idempotencyKey = `coverage-cognitive-${suffix}`;
  const admission = {
    kind: 'EXPLICIT_CORE_GOVERNANCE_ADMISSION' as const,
    idempotencyKey,
    sourceEvidenceResolution: 'EXACT_EVIDENCE_VERIFIED' as const,
    replayKeyFingerprintSha256: methodImprovementCoverageGapReplayKeyFingerprintV1({
      workspaceId,
      evidenceId: source.evidenceId,
      evidenceFingerprintSha256,
      idempotencyKey,
      createdByPrincipalId
    })
  };
  const triggerBase = {
    schemaVersion: 1 as const,
    workspaceId,
    triggerType: 'COVERAGE_GAP' as const,
    target,
    source,
    admission,
    reason: `Governed Coverage Gap reason ${suffix}.`,
    createdByPrincipalId,
    authorityConsequences: methodImprovementCoverageGapNoDownstreamAuthority
  };
  const triggerFingerprintSha256 = methodImprovementCoverageGapTriggerFingerprintV1(triggerBase);
  const trigger = {
    ...triggerBase,
    triggerId: `method-improvement-trigger_coverage-${suffix}` as const,
    triggerFingerprintSha256,
    admittedAt
  };
  const research = mission(`coverage-${suffix}`, admittedAt, 'SOURCE_RESOLUTION');
  const missionBase = {
    schemaVersion: 1 as const,
    workspaceId,
    triggerId: trigger.triggerId,
    triggerFingerprintSha256,
    target,
    source,
    mission: research,
    createdByPrincipalId,
    createdAt: admittedAt
  };
  const missionFingerprintSha256 = methodImprovementCoverageGapMissionFingerprintV1(missionBase);
  const researchMission = {
    ...missionBase,
    researchMissionId: `method-improvement-research-mission_coverage-${suffix}` as const,
    missionFingerprintSha256
  };
  return {
    trigger,
    researchMission,
    sourceIdentityFingerprintSha256: fingerprint({
      workspaceId,
      evidenceId: source.evidenceId,
      evidenceFingerprintSha256
    })
  };
}

let database: ManagedDatabase;

async function seedPerformance(
  suffix: string,
  admittedAt: string,
  storedTriggerFingerprint?: string,
  includeMission = true
) {
  const value = persistedPerformanceAdmission(suffix, admittedAt);
  await database.getPool().query(
    `INSERT INTO core_method_improvement_triggers (
       trigger_id,workspace_id,trigger_type,method_package_ref,method_ref,method_version_ref,
       evaluation_ref,package_fingerprint_sha256,report_watermark_sequence,
       report_watermark_evidence_id,report_fingerprint_sha256,source_identity_fingerprint_sha256,
       request_fingerprint_sha256,trigger_fingerprint_sha256,idempotency_key,correlation_id,
       trigger_json,admitted_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18)`,
    [
      value.trigger.triggerId,
      workspaceId,
      value.trigger.triggerType,
      predecessor.methodPackageRef,
      predecessor.methodRef,
      predecessor.methodVersionRef,
      predecessor.evaluationRef,
      predecessor.packageFingerprintSha256,
      value.trigger.source.query.watermark.admissionSequence,
      value.trigger.source.query.watermark.methodOutcomeEvidenceId,
      value.trigger.source.reportFingerprintSha256,
      value.sourceIdentityFingerprintSha256,
      '5'.repeat(64),
      storedTriggerFingerprint ?? value.trigger.triggerFingerprintSha256,
      `cognitive-read-${suffix}`,
      `correlation-${suffix}`,
      JSON.stringify(value.trigger),
      admittedAt
    ]
  );
  if (includeMission)
    await database.getPool().query(
      `INSERT INTO core_method_improvement_research_missions (
         research_mission_id,workspace_id,trigger_id,trigger_fingerprint_sha256,
         mission_fingerprint_sha256,mission_json,created_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [
        value.researchMission.researchMissionId,
        workspaceId,
        value.trigger.triggerId,
        value.trigger.triggerFingerprintSha256,
        value.researchMission.missionFingerprintSha256,
        JSON.stringify(value.researchMission),
        admittedAt
      ]
    );
  return value;
}

async function seedCoverage(suffix: string, admittedAt: string) {
  const value = persistedCoverageAdmission(suffix, admittedAt);
  await database.getPool().query(
    `INSERT INTO core_method_improvement_coverage_gap_triggers(
       trigger_id,workspace_id,trigger_type,target_kind,
       predecessor_method_package_ref,predecessor_method_ref,predecessor_method_version_ref,
       predecessor_evaluation_ref,predecessor_package_fingerprint_sha256,
       target_demand_id,target_demand_fingerprint_sha256,
       source_evidence_id,source_evidence_fingerprint_sha256,source_audit_fingerprint_sha256,
       source_candidate_id,source_candidate_fingerprint_sha256,source_coverage_status,
       source_demand_id,source_demand_fingerprint_sha256,source_identity_fingerprint_sha256,
       request_fingerprint_sha256,replay_key_fingerprint_sha256,trigger_fingerprint_sha256,
       idempotency_key,correlation_id,created_by_principal_id,trigger_json,admitted_at
     ) VALUES(
       $1,$2,'COVERAGE_GAP',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
       $19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27
     )`,
    [
      value.trigger.triggerId,
      workspaceId,
      value.trigger.target.kind,
      null,
      null,
      null,
      null,
      null,
      value.trigger.target.demandId,
      value.trigger.target.demandFingerprintSha256,
      value.trigger.source.evidenceId,
      value.trigger.source.evidenceFingerprintSha256,
      value.trigger.source.sourceAuditFingerprintSha256,
      value.trigger.source.candidateId,
      value.trigger.source.candidateFingerprintSha256,
      value.trigger.source.coverageStatus,
      value.trigger.source.demandId,
      value.trigger.source.demandFingerprintSha256,
      value.sourceIdentityFingerprintSha256,
      '8'.repeat(64),
      value.trigger.admission.replayKeyFingerprintSha256,
      value.trigger.triggerFingerprintSha256,
      value.trigger.admission.idempotencyKey,
      `coverage-correlation-${suffix}`,
      value.trigger.createdByPrincipalId,
      JSON.stringify(value.trigger),
      admittedAt
    ]
  );
  await database.getPool().query(
    `INSERT INTO core_method_improvement_coverage_gap_research_missions(
       research_mission_id,workspace_id,trigger_id,trigger_fingerprint_sha256,
       mission_fingerprint_sha256,target_kind,source_evidence_id,
       source_evidence_fingerprint_sha256,created_by_principal_id,mission_json,created_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
    [
      value.researchMission.researchMissionId,
      workspaceId,
      value.trigger.triggerId,
      value.trigger.triggerFingerprintSha256,
      value.researchMission.missionFingerprintSha256,
      value.trigger.target.kind,
      value.trigger.source.evidenceId,
      value.trigger.source.evidenceFingerprintSha256,
      value.trigger.createdByPrincipalId,
      JSON.stringify(value.researchMission),
      admittedAt
    ]
  );
  return value;
}

integration('PostgreSQL Method Improvement cognitive read source', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(databaseConfig());
    await database.start();
    await migrate(database.getPool(), migrationNamespace, await coreMigrations());
  });

  beforeEach(async () => {
    await database.getPool().query(
      `TRUNCATE core_method_improvement_coverage_gap_research_missions,
                core_method_improvement_coverage_gap_triggers,
                core_method_improvement_research_missions,
                core_method_improvement_triggers CASCADE`
    );
  });

  afterAll(async () => database.close());

  it('returns both durable admission families in deterministic cross-table order', async () => {
    const source = new PostgresMethodImprovementCognitiveReadSourceV1(database);
    await expect(source.listAdmissions()).resolves.toEqual([]);

    const later = await seedPerformance('performance', '2026-09-01T00:00:00.000Z');
    const earlier = await seedCoverage('coverage', '2026-08-31T04:22:00.000Z');
    const admissions = await source.listAdmissions();

    expect(admissions.map((item) => [item.kind, item.trigger.triggerId])).toEqual([
      ['COVERAGE_GAP', earlier.trigger.triggerId],
      ['PERFORMANCE_GAP', later.trigger.triggerId]
    ]);
    expect(admissions[0]).toEqual({
      kind: 'COVERAGE_GAP',
      trigger: earlier.trigger,
      researchMission: earlier.researchMission
    });
    expect(admissions[1]).toEqual({
      kind: 'PERFORMANCE_GAP',
      trigger: later.trigger,
      researchMission: later.researchMission
    });
  });

  it('wires both Method Improvement families into the production Core cognitive factory', async () => {
    await seedPerformance('factory-performance', '2026-08-31T04:22:00.000Z');
    await seedCoverage('factory-coverage', '2026-09-01T00:00:00.000Z');
    const service = createPostgresBrainCognitiveReadServiceV1(
      database,
      () => new Date('2026-09-04T16:20:00.000Z')
    );

    const projection = await service.read();
    expect(projection.methodImprovements.map((item) => item.trigger.triggerType)).toEqual([
      'PERFORMANCE_GAP',
      'COVERAGE_GAP'
    ]);
    expect(projection.brainBuildRuns).toEqual({
      availability: 'NOT_DURABLY_RECORDED',
      inventory: null,
      reasonCode: 'NO_DURABLE_BUILD_RUN_REGISTRY'
    });
    expect(projection.summary).toMatchObject({
      methodImprovementAdmissionCount: 2,
      performanceGapAdmissionCount: 1,
      coverageGapAdmissionCount: 1,
      brainBuildRunInventoryAvailable: false
    });
  });

  it('fails closed when persisted fingerprint metadata drifts from governed JSON', async () => {
    await seedPerformance('drifted', '2026-08-31T04:22:00.000Z', 'f'.repeat(64));
    const source = new PostgresMethodImprovementCognitiveReadSourceV1(database);

    await expect(source.listAdmissions()).rejects.toBeInstanceOf(
      MethodImprovementCognitiveReadSourceError
    );
  });

  it('fails closed instead of silently dropping a durable trigger whose mission is missing', async () => {
    await seedPerformance('orphan', '2026-08-31T04:22:00.000Z', undefined, false);
    const source = new PostgresMethodImprovementCognitiveReadSourceV1(database);

    await expect(source.listAdmissions()).rejects.toBeInstanceOf(
      MethodImprovementCognitiveReadSourceError
    );
  });
});
