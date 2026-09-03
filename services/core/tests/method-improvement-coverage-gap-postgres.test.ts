import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { MethodImprovementCoverageGapEvidenceSourceV1 } from '@markorbit/contracts/method-improvement-coverage-gap';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { MethodImprovementCoverageGapAdmissionServiceV1 } from '../src/method-improvement-coverage-gap.js';
import { PostgresMethodImprovementCoverageGapAdmissionRepositoryV1 } from '../src/method-improvement-coverage-gap-postgres.js';

const dedicatedUrl = process.env.CORE_METHOD_IMPROVEMENT_TEST_DATABASE_URL;
const url =
  dedicatedUrl ??
  process.env.CORE_METHOD_OUTCOME_EVIDENCE_TEST_DATABASE_URL ??
  process.env.IDENTITY_TEST_DATABASE_URL;
const required =
  process.env.CORE_METHOD_IMPROVEMENT_POSTGRES_REQUIRED === '1' ||
  process.env.CORE_METHOD_OUTCOME_EVIDENCE_POSTGRES_REQUIRED === '1' ||
  process.env.IDENTITY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'Coverage Gap PostgreSQL acceptance requires a Core PostgreSQL test database URL.'
  );
}
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const coverageGapMigrations = async () =>
  (
    await loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service')
  ).filter((migration) => migration.version === '0091');
const workspaceId = '11111111-1111-4111-8111-111111111111';
const createdAt = '2026-09-03T00:00:00.000Z';

let database: ManagedDatabase;

function config() {
  return parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_method_improvement_coverage_gap',
    DB_APPLICATION_NAME: 'markorbit-coverage-gap-tests'
  });
}

function digest(character: string): string {
  return character.repeat(64);
}

function source(
  coverageStatus: 'MISSING_RUNTIME_CAPABILITY' | 'NO_APPROVED_IMPLEMENTATION' =
    'MISSING_RUNTIME_CAPABILITY'
): MethodImprovementCoverageGapEvidenceSourceV1 {
  const evidenceFingerprintSha256 = digest('a');
  const candidateFingerprintSha256 = digest('c');
  const demandFingerprintSha256 = digest('d');
  return {
    kind: 'CAPABILITY_COVERAGE_GAP_EVIDENCE_V1',
    classification: 'COVERAGE_GAP_EVIDENCE',
    phase7AdmissionStatus: 'NOT_ADMITTED',
    sourceKind: 'CAPABILITY_DEMAND_COVERAGE_AUDIT_V1',
    evidenceId: `capability-coverage-gap-evidence_${evidenceFingerprintSha256}`,
    evidenceFingerprintSha256,
    sourceAuditFingerprintSha256: digest('b'),
    candidateId: `capability-coverage-gap-candidate_${candidateFingerprintSha256}`,
    candidateFingerprintSha256,
    coverageStatus,
    demandId: `capability-demand_${demandFingerprintSha256}`,
    demandFingerprintSha256
  };
}

function mission() {
  return {
    schemaVersion: 1,
    missionId: 'brain-research-mission_coverage-gap-postgres',
    capabilityDemand:
      'Research the exact governed capability demand represented by the Coverage Gap.',
    problem: 'Determine a bounded method path for the explicitly admitted Coverage Gap.',
    targetMethodFamily: 'SOURCE_RESOLUTION',
    applicabilityTarget: {
      jurisdictions: ['US'],
      authorities: ['USPTO'],
      objectTypes: ['TRADEMARK_APPLICATION'],
      operations: ['OFFICIAL_FEE_RESOLUTION'],
      procedures: ['ELECTRONIC_FILING'],
      stages: ['NEW_APPLICATION'],
      filingBases: ['SECTION_1'],
      segments: ['BASE_FEE'],
      requiredData: ['GOVERNED_CAPABILITY_DEMAND'],
      effectiveFrom: createdAt
    },
    knowledgeResearchPlan: ['Resolve bounded authoritative knowledge for the admitted demand.'],
    dataEngineResearchPlan: ['Request only reproducible data needed for later evaluation.'],
    hypotheses: ['A bounded governed method may satisfy the capability demand.'],
    featurePlan: ['Define deterministic inputs before candidate creation.'],
    evaluationPlan: ['Evaluate any later candidate against explicit success criteria.'],
    successMetrics: ['bounded reproducible method evaluation'],
    baselineMetrics: ['no accepted remediation for the exact Coverage Gap'],
    createdAt
  };
}

function command(
  sourceValue: MethodImprovementCoverageGapEvidenceSourceV1,
  existingMethod = false,
  reason = 'Explicit Core governance admission of exact Coverage Gap evidence for bounded research.'
) {
  return {
    schemaVersion: 1,
    workspaceId,
    triggerType: 'COVERAGE_GAP',
    source: sourceValue,
    target: existingMethod
      ? {
          kind: 'EXISTING_METHOD',
          predecessor: {
            methodPackageRef: 'brain-method-package:package_coverage-gap@1',
            methodRef: 'brain-method:method_coverage-gap',
            methodVersionRef: 'brain-method-version:method-version_coverage-gap',
            evaluationRef: 'brain-method-evaluation:evaluation_coverage-gap',
            packageFingerprintSha256: digest('e')
          }
        }
      : {
          kind: 'NEW_CAPABILITY_METHOD_DEMAND',
          demandId: sourceValue.demandId,
          demandFingerprintSha256: sourceValue.demandFingerprintSha256
        },
    reason,
    createdByPrincipalId: 'principal_coverage-gap-governance',
    mission: mission()
  };
}

function service(sourceValue: MethodImprovementCoverageGapEvidenceSourceV1) {
  let triggerSequence = 0;
  let missionSequence = 0;
  return new MethodImprovementCoverageGapAdmissionServiceV1({
    repository: new PostgresMethodImprovementCoverageGapAdmissionRepositoryV1(database),
    evidence: {
      resolveExact: () => Promise.resolve({ status: 'RESOLVED' as const, source: sourceValue })
    },
    now: () => createdAt,
    triggerIdFactory: () => `coverage-gap-postgres-trigger-${++triggerSequence}`,
    researchMissionIdFactory: () => `coverage-gap-postgres-mission-${++missionSequence}`
  });
}

function request(body: unknown) {
  return {
    workspaceId,
    idempotencyKey: 'coverage-gap-postgres-key',
    correlationId: 'coverage-gap-postgres-correlation',
    command: body
  };
}

async function reopen(): Promise<void> {
  await database.close();
  database = new ManagedDatabase(config());
  await database.start();
}

integration('PostgreSQL Coverage Gap Method Improvement admission', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS core_method_improvement_coverage_gap_research_missions,
        core_method_improvement_coverage_gap_triggers CASCADE;
       DROP SCHEMA IF EXISTS markorbit_persistence CASCADE`
    );
    await migrate(
      database.getPool(),
      'core_method_improvement_coverage_gap',
      await coverageGapMigrations()
    );
  });

  beforeEach(async () => {
    await database
      .getPool()
      .query(
        'TRUNCATE core_method_improvement_coverage_gap_research_missions,core_method_improvement_coverage_gap_triggers CASCADE'
      );
  });

  afterAll(async () => database.close());

  it('replays the exact new-capability admission across restart without duplication', async () => {
    const gapSource = source();
    const first = await service(gapSource).admit(request(command(gapSource)));
    expect(first.replayed).toBe(false);

    await reopen();
    const replay = await service(gapSource).admit(request(command(gapSource)));

    expect(replay.replayed).toBe(true);
    expect(replay.trigger).toEqual(first.trigger);
    expect(replay.researchMission).toEqual(first.researchMission);
    expect(
      (await database.getPool().query('SELECT 1 FROM core_method_improvement_coverage_gap_triggers'))
        .rowCount
    ).toBe(1);
    expect(
      (
        await database
          .getPool()
          .query('SELECT 1 FROM core_method_improvement_coverage_gap_research_missions')
      ).rowCount
    ).toBe(1);
  });

  it('persists exact predecessor lineage for an existing-method Coverage Gap', async () => {
    const gapSource = source('NO_APPROVED_IMPLEMENTATION');
    const result = await service(gapSource).admit(request(command(gapSource, true)));
    expect(result.trigger.target.kind).toBe('EXISTING_METHOD');
    const rows = await database.getPool().query(
      `SELECT target_kind,predecessor_method_ref,target_demand_id
         FROM core_method_improvement_coverage_gap_triggers`
    );
    expect(rows.rows[0]).toMatchObject({
      target_kind: 'EXISTING_METHOD',
      predecessor_method_ref: 'brain-method:method_coverage-gap',
      target_demand_id: null
    });
  });

  it('fails closed when exact evidence identity is reused with materially different content', async () => {
    const gapSource = source();
    const runtime = service(gapSource);
    await runtime.admit(request(command(gapSource)));
    await expect(
      runtime.admit(request(command(gapSource, false, 'Materially different governance reason.')))
    ).rejects.toMatchObject({ code: 'TRIGGER_CONFLICT' });
  });

  it('fails closed on corrupt durable trigger content', async () => {
    const gapSource = source();
    await service(gapSource).admit(request(command(gapSource)));
    const pool = database.getPool();
    await pool.query(
      'ALTER TABLE core_method_improvement_coverage_gap_triggers DISABLE TRIGGER core_method_improvement_coverage_gap_trigger_append_only'
    );
    try {
      await pool.query(
        `UPDATE core_method_improvement_coverage_gap_triggers
            SET trigger_json=jsonb_set(trigger_json,'{reason}','"tampered"'::jsonb)`
      );
    } finally {
      await pool.query(
        'ALTER TABLE core_method_improvement_coverage_gap_triggers ENABLE TRIGGER core_method_improvement_coverage_gap_trigger_append_only'
      );
    }

    await expect(service(gapSource).admit(request(command(gapSource)))).rejects.toMatchObject({
      code: 'EVIDENCE_UNAVAILABLE',
      retryable: true
    });
  });

  it('propagates database unavailability instead of falling back to memory', async () => {
    const gapSource = source();
    const runtime = service(gapSource);
    await database.close();
    await expect(runtime.admit(request(command(gapSource)))).rejects.toMatchObject({
      code: 'EVIDENCE_UNAVAILABLE',
      retryable: true
    });
    database = new ManagedDatabase(config());
    await database.start();
  });
});
