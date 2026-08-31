import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  MethodOutcomeEvidenceAdmissionServiceV1,
  PostgresMethodOutcomeEvidenceAdmissionRepositoryV1
} from '../src/method-outcome-evidence.js';
import {
  MethodOutcomeReportServiceV1,
  PostgresMethodOutcomeReportReaderV1
} from '../src/method-outcome-report.js';
import {
  MethodImprovementAdmissionServiceV1,
  PostgresMethodImprovementAdmissionRepositoryV1
} from '../src/method-improvement.js';

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
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';
const packageRef = 'brain-method-package:package_cn-duration@1';
const methodRef = 'brain-method:method_cn-duration';
const methodVersionRef = 'brain-method-version:method-version_cn-duration';
const evaluationRef = 'brain-method-evaluation:evaluation_cn-duration';

function databaseConfig() {
  return parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: migrationNamespace,
    DB_APPLICATION_NAME: 'markorbit-phase7-method-improvement-tests'
  });
}

type Outcome = 'CONFIRMED' | 'OVERRIDDEN' | 'INCONCLUSIVE';
type Reason =
  | 'METHOD_ERROR'
  | 'INPUT_DATA_ERROR'
  | 'APPLICABILITY_ERROR'
  | 'PRODUCT_USER_PREFERENCE'
  | 'INCONCLUSIVE_EVIDENCE';

function evidence(suffix: string, outcome: Outcome, reason?: Reason) {
  const reviewId = `matter-intelligence-review_phase7-${suffix}`;
  return {
    schemaVersion: 1,
    workspaceId,
    source: {
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceId: reviewId,
      sourceVersion: 1,
      sourceFingerprintSha256: '1'.repeat(64)
    },
    formalMatter: { id: `formal-matter_phase7-${suffix}`, version: 1 },
    observation: {
      id: `matter-intelligence-observation_phase7-${suffix}`,
      fingerprintSha256: '2'.repeat(64),
      outputFingerprintSha256: '3'.repeat(64)
    },
    review: {
      id: reviewId,
      version: 1,
      fingerprintSha256: '4'.repeat(64),
      outcome,
      ...(reason ? { reason } : {}),
      reviewedByPrincipalId: 'principal_phase7-product-review',
      reviewedAt: '2026-08-31T04:20:00.000Z'
    },
    capability: {
      id: 'interpretation.cn-completed-duration-historical-band',
      version: '1.0.0',
      requestId: `capreq_phase7-${suffix}`,
      returnId: `capability-return_phase7-${suffix}`,
      outcomeId: `capability-outcome_phase7-${suffix}`,
      invocationId: `capability-invocation_phase7-${suffix}`,
      sessionReceiptId: `session-receipt_phase7-${suffix}`
    },
    implementation: {
      id: 'implementation-profile_cn-duration-band-classification-v1',
      version: 1,
      key: 'brain-method-package-runtime.cn-duration-band-classification.v1'
    },
    method: {
      packageRef,
      methodRef,
      methodVersionRef,
      evaluationRef,
      researchDatasetRef: 'research-dataset:cn-duration-band:accepted',
      evidenceFingerprintSha256: '5'.repeat(64),
      inputFingerprintSha256: '6'.repeat(64),
      outputFingerprintSha256: '3'.repeat(64)
    }
  };
}

function mission(hypothesis = 'A bounded duration-band edge case may explain the reviewed method error.') {
  return {
    schemaVersion: 1,
    missionId: 'brain-research-mission_phase7-cn-duration-postgres',
    capabilityDemand: 'Improve the governed CN completed-duration historical-band method.',
    problem: 'Research bounded reproducible causes for the admitted Phase 6 METHOD_ERROR signal.',
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
    knowledgeResearchPlan: ['Resolve exact authoritative CN duration sources with bounded lineage.'],
    dataEngineResearchPlan: ['Rebuild the accepted reproducible CN duration research cohort.'],
    hypotheses: [hypothesis],
    featurePlan: ['Evaluate deterministic completed-duration features only.'],
    evaluationPlan: ['Compare a candidate with the exact predecessor on reproducible bounded inputs.'],
    successMetrics: ['bounded predecessor comparison'],
    baselineMetrics: [evaluationRef],
    createdAt: '2026-08-31T04:21:00.000Z'
  } as const;
}

let database: ManagedDatabase;
let evidenceCounter = 0;

function outcomeAdmissions() {
  return new MethodOutcomeEvidenceAdmissionServiceV1({
    repository: new PostgresMethodOutcomeEvidenceAdmissionRepositoryV1(database),
    now: () => '2026-08-31T04:20:30.000Z',
    evidenceIdFactory: () => `phase7-${++evidenceCounter}`
  });
}

function reports() {
  return new MethodOutcomeReportServiceV1(new PostgresMethodOutcomeReportReaderV1(database));
}

async function admitOutcome(suffix: string, outcome: Outcome, reason?: Reason) {
  return outcomeAdmissions().admit({
    workspaceId,
    evidence: evidence(suffix, outcome, reason)
  });
}

async function exactReport() {
  return reports().report({
    workspaceId,
    query: {
      schemaVersion: 1,
      workspaceId,
      methodPackageRef: packageRef,
      methodVersionRef
    }
  });
}

function command(
  reportWatermark: { admissionSequence: number; methodOutcomeEvidenceId: `method-outcome-evidence_${string}` },
  overrides: Record<string, unknown> = {}
) {
  return {
    schemaVersion: 1,
    workspaceId,
    triggerType: 'PERFORMANCE_GAP',
    predecessor: {
      methodPackageRef: packageRef,
      methodRef,
      methodVersionRef,
      evaluationRef
    },
    reportQuery: {
      schemaVersion: 1,
      workspaceId,
      methodPackageRef: packageRef,
      methodVersionRef,
      watermark: reportWatermark
    },
    reason: 'Explicitly admit the reviewed Phase 6 method-error signal for bounded research.',
    createdByPrincipalId: 'principal_phase7-governance',
    mission: mission(),
    ...overrides
  };
}

function improvementService(idSuffix: string) {
  return new MethodImprovementAdmissionServiceV1({
    repository: new PostgresMethodImprovementAdmissionRepositoryV1(database),
    reports: reports(),
    now: () => '2026-08-31T04:22:00.000Z',
    triggerIdFactory: () => `phase7-${idSuffix}-trigger`,
    researchMissionIdFactory: () => `phase7-${idSuffix}-mission`
  });
}

async function admitImprovement(
  service: MethodImprovementAdmissionServiceV1,
  body: unknown,
  requestOverrides: Partial<{ workspaceId: string; idempotencyKey: string; correlationId: string }> = {}
) {
  return service.admit({
    workspaceId: requestOverrides.workspaceId ?? workspaceId,
    idempotencyKey: requestOverrides.idempotencyKey ?? 'phase7-postgres-key',
    correlationId: requestOverrides.correlationId ?? 'phase7-postgres-correlation',
    command: body
  });
}

integration('PostgreSQL governed Method Improvement admission', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(databaseConfig());
    await database.start();
    await migrate(database.getPool(), migrationNamespace, await coreMigrations());
  });

  beforeEach(async () => {
    evidenceCounter = 0;
    await database.getPool().query(
      `TRUNCATE core_method_improvement_research_missions,
                core_method_improvement_triggers,
                core_method_outcome_evidence RESTART IDENTITY CASCADE`
    );
  });

  afterAll(async () => database.close());

  it('creates exactly one bounded trigger and mission from the exact Phase 6 METHOD_ERROR report', async () => {
    await admitOutcome('method-error', 'OVERRIDDEN', 'METHOD_ERROR');
    const source = await exactReport();
    expect(source.watermark).toBeDefined();

    const lifecycleBefore = await database
      .getPool()
      .query('SELECT brain_asset_version_id,status FROM brain_asset_versions ORDER BY brain_asset_version_id');
    const result = await admitImprovement(
      improvementService('first'),
      command(source.watermark!)
    );

    expect(result.replayed).toBe(false);
    expect(result.trigger.source.query.watermark).toEqual(source.watermark);
    expect(result.trigger.source.counts.methodError).toBe(1);
    expect(result.researchMission.triggerId).toBe(result.trigger.triggerId);
    const counts = await database.getPool().query(
      `SELECT
         (SELECT count(*)::int FROM core_method_improvement_triggers) AS triggers,
         (SELECT count(*)::int FROM core_method_improvement_research_missions) AS missions`
    );
    expect(counts.rows[0]).toEqual({ triggers: 1, missions: 1 });

    const stored = await database.getPool().query(
      `SELECT t.method_package_ref,t.method_ref,t.method_version_ref,t.evaluation_ref,
              t.report_watermark_sequence::int AS report_watermark_sequence,
              t.report_watermark_evidence_id,t.trigger_json,m.mission_json
         FROM core_method_improvement_triggers t
         JOIN core_method_improvement_research_missions m
           ON m.trigger_id=t.trigger_id AND m.workspace_id=t.workspace_id`
    );
    expect(stored.rows[0]).toMatchObject({
      method_package_ref: packageRef,
      method_ref: methodRef,
      method_version_ref: methodVersionRef,
      evaluation_ref: evaluationRef,
      report_watermark_sequence: source.watermark!.admissionSequence,
      report_watermark_evidence_id: source.watermark!.methodOutcomeEvidenceId
    });
    const boundedJson = JSON.stringify({
      trigger: stored.rows[0]!.trigger_json,
      mission: stored.rows[0]!.mission_json
    });
    expect(boundedJson).not.toMatch(
      /formalMatter|customerSnapshot|productSnapshot|rawDataEngineRows|capabilityPackageBody|brainPackageBody/u
    );
    expect((stored.rows[0]!.trigger_json as { source: { sampleEvidenceRefs: unknown[] } }).source.sampleEvidenceRefs)
      .toHaveLength(1);

    const lifecycleAfter = await database
      .getPool()
      .query('SELECT brain_asset_version_id,status FROM brain_asset_versions ORDER BY brain_asset_version_id');
    expect(lifecycleAfter.rows).toEqual(lifecycleBefore.rows);
  });

  it('replays after service restart without duplicate rows and rejects immutable conflicts', async () => {
    await admitOutcome('replay', 'OVERRIDDEN', 'METHOD_ERROR');
    const source = await exactReport();
    const body = command(source.watermark!);
    const first = await admitImprovement(improvementService('before-restart'), body);
    const replay = await admitImprovement(improvementService('after-restart'), body);

    expect(replay.replayed).toBe(true);
    expect(replay.trigger).toEqual(first.trigger);
    expect(replay.researchMission).toEqual(first.researchMission);

    await expect(
      admitImprovement(
        improvementService('different-plan'),
        command(source.watermark!, {
          mission: mission('A materially different immutable mission plan must conflict.')
        })
      )
    ).rejects.toMatchObject({ code: 'TRIGGER_CONFLICT' });

    await expect(
      admitImprovement(
        improvementService('different-predecessor'),
        command(source.watermark!, {
          predecessor: {
            methodPackageRef: packageRef,
            methodRef: 'brain-method:method_cn-duration-other',
            methodVersionRef,
            evaluationRef
          }
        }),
        { idempotencyKey: 'phase7-postgres-other-key' }
      )
    ).rejects.toMatchObject({ code: 'TRIGGER_CONFLICT' });

    const counts = await database.getPool().query(
      `SELECT
         (SELECT count(*)::int FROM core_method_improvement_triggers) AS triggers,
         (SELECT count(*)::int FROM core_method_improvement_research_missions) AS missions`
    );
    expect(counts.rows[0]).toEqual({ triggers: 1, missions: 1 });
  });

  it('fails closed for foreign workspace, watermark mismatch, no METHOD_ERROR and empty source', async () => {
    await admitOutcome('guard', 'OVERRIDDEN', 'METHOD_ERROR');
    const source = await exactReport();
    const service = improvementService('guards');

    await expect(
      admitImprovement(service, command(source.watermark!), { workspaceId: otherWorkspaceId })
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' });

    await expect(
      admitImprovement(
        service,
        command({
          admissionSequence: source.watermark!.admissionSequence + 100,
          methodOutcomeEvidenceId: 'method-outcome-evidence_phase7-missing-watermark'
        }),
        { idempotencyKey: 'phase7-watermark-mismatch' }
      )
    ).rejects.toMatchObject({ code: 'REPORT_MISMATCH' });

    await database.getPool().query(
      `TRUNCATE core_method_improvement_research_missions,
                core_method_improvement_triggers,
                core_method_outcome_evidence RESTART IDENTITY CASCADE`
    );
    await admitOutcome('confirmed-only', 'CONFIRMED');
    const confirmedOnly = await exactReport();
    await expect(
      admitImprovement(
        improvementService('no-method-error'),
        command(confirmedOnly.watermark!),
        { idempotencyKey: 'phase7-no-method-error' }
      )
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_EVIDENCE' });

    await database.getPool().query(
      `TRUNCATE core_method_improvement_research_missions,
                core_method_improvement_triggers,
                core_method_outcome_evidence RESTART IDENTITY CASCADE`
    );
    await expect(
      admitImprovement(
        improvementService('empty'),
        command({
          admissionSequence: 1,
          methodOutcomeEvidenceId: 'method-outcome-evidence_phase7-empty'
        }),
        { idempotencyKey: 'phase7-empty-source' }
      )
    ).rejects.toMatchObject({ code: 'REPORT_MISMATCH' });

    const persisted = await database.getPool().query(
      'SELECT count(*)::int AS count FROM core_method_improvement_triggers'
    );
    expect(persisted.rows[0]?.count).toBe(0);
  });

  it('rejects UPDATE and DELETE for both trigger and mission records', async () => {
    await admitOutcome('append-only', 'OVERRIDDEN', 'METHOD_ERROR');
    const source = await exactReport();
    const result = await admitImprovement(
      improvementService('append-only'),
      command(source.watermark!)
    );

    await expect(
      database
        .getPool()
        .query('UPDATE core_method_improvement_triggers SET reason=$1 WHERE trigger_id=$2', [
          'mutated',
          result.trigger.triggerId
        ])
    ).rejects.toThrow(/append-only/u);
    await expect(
      database
        .getPool()
        .query('DELETE FROM core_method_improvement_triggers WHERE trigger_id=$1', [
          result.trigger.triggerId
        ])
    ).rejects.toThrow(/append-only/u);
    await expect(
      database
        .getPool()
        .query(
          'UPDATE core_method_improvement_research_missions SET created_at=clock_timestamp() WHERE research_mission_id=$1',
          [result.researchMission.researchMissionId]
        )
    ).rejects.toThrow(/append-only/u);
    await expect(
      database
        .getPool()
        .query('DELETE FROM core_method_improvement_research_missions WHERE research_mission_id=$1', [
          result.researchMission.researchMissionId
        ])
    ).rejects.toThrow(/append-only/u);
  });
});
