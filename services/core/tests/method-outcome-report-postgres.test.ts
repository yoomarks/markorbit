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
import { PostgresMethodOutcomeReportReaderV1 } from '../src/method-outcome-report.js';

const dedicatedUrl = process.env.CORE_METHOD_OUTCOME_EVIDENCE_TEST_DATABASE_URL;
const url = dedicatedUrl ?? process.env.IDENTITY_TEST_DATABASE_URL;
const required =
  process.env.CORE_METHOD_OUTCOME_EVIDENCE_POSTGRES_REQUIRED === '1' ||
  process.env.IDENTITY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'Method Outcome report PostgreSQL acceptance requires CORE_METHOD_OUTCOME_EVIDENCE_TEST_DATABASE_URL or IDENTITY_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const coreMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service');
const migrationNamespace = dedicatedUrl ? 'core_method_outcome_evidence' : 'core_identity';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';
const packageRef = 'brain-method-package:package_cn-duration@1';
const methodVersionRef = 'brain-method-version:method-version_cn-duration';
const datasetA = 'research-dataset:cn-duration-band:accepted';
const datasetB = 'research-dataset:cn-duration-band:secondary';
const implementationA = 'brain-method-package-runtime.cn-duration-band-classification.v1';
const implementationB = 'brain-method-package-runtime.cn-duration-band-classification.v1-alt';

function databaseConfig() {
  return parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: migrationNamespace,
    DB_APPLICATION_NAME: 'markorbit-phase6-method-outcome-report-tests'
  });
}

type Outcome = 'CONFIRMED' | 'OVERRIDDEN' | 'INCONCLUSIVE';
type Reason =
  | 'METHOD_ERROR'
  | 'INPUT_DATA_ERROR'
  | 'APPLICABILITY_ERROR'
  | 'PRODUCT_USER_PREFERENCE'
  | 'INCONCLUSIVE_EVIDENCE';

function admission(
  suffix: string,
  outcome: Outcome,
  reason?: Reason,
  options: {
    workspace?: string;
    packageRef?: string;
    methodVersionRef?: string;
    dataset?: string;
    implementationKey?: string;
  } = {}
) {
  const reviewId = `matter-intelligence-review_phase6-report-${suffix}`;
  return {
    schemaVersion: 1,
    workspaceId: options.workspace ?? workspaceId,
    source: {
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceId: reviewId,
      sourceVersion: 1,
      sourceFingerprintSha256: '1'.repeat(64)
    },
    formalMatter: { id: `formal-matter_phase6-report-${suffix}`, version: 1 },
    observation: {
      id: `matter-intelligence-observation_phase6-report-${suffix}`,
      fingerprintSha256: '2'.repeat(64),
      outputFingerprintSha256: '3'.repeat(64)
    },
    review: {
      id: reviewId,
      version: 1,
      fingerprintSha256: '4'.repeat(64),
      outcome,
      ...(reason ? { reason } : {}),
      reviewedByPrincipalId: 'principal_phase6-report',
      reviewedAt: '2026-08-30T21:00:00.000Z'
    },
    capability: {
      id: 'interpretation.cn-completed-duration-historical-band',
      version: '1.0.0',
      requestId: `capreq_phase6-report-${suffix}`,
      returnId: `capability-return_phase6-report-${suffix}`,
      outcomeId: `capability-outcome_phase6-report-${suffix}`,
      invocationId: `capability-invocation_phase6-report-${suffix}`,
      sessionReceiptId: `session-receipt_phase6-report-${suffix}`
    },
    implementation: {
      id: 'implementation-profile_cn-duration-band-classification-v1',
      version: 1,
      key: options.implementationKey ?? implementationA
    },
    method: {
      packageRef: options.packageRef ?? packageRef,
      methodRef: 'brain-method:method_cn-duration',
      methodVersionRef: options.methodVersionRef ?? methodVersionRef,
      evaluationRef: 'brain-method-evaluation:evaluation_cn-duration',
      researchDatasetRef: options.dataset ?? datasetA,
      evidenceFingerprintSha256: '5'.repeat(64),
      inputFingerprintSha256: '6'.repeat(64),
      outputFingerprintSha256: '3'.repeat(64)
    }
  };
}

let database: ManagedDatabase;
let nextEvidence = 0;

function admissionService(now = '2026-08-30T21:01:00.000Z') {
  nextEvidence += 1;
  return new MethodOutcomeEvidenceAdmissionServiceV1({
    repository: new PostgresMethodOutcomeEvidenceAdmissionRepositoryV1(database),
    now: () => now,
    evidenceIdFactory: () => `phase6-report-${nextEvidence}`
  });
}

async function admit(
  suffix: string,
  outcome: Outcome,
  reason?: Reason,
  options: Parameters<typeof admission>[3] = {},
  now = '2026-08-30T21:01:00.000Z'
) {
  return admissionService(now).admit({
    workspaceId: options.workspace ?? workspaceId,
    evidence: admission(suffix, outcome, reason, options)
  });
}

function reader() {
  return new PostgresMethodOutcomeReportReaderV1(database);
}

function query(
  overrides: Partial<{
    workspaceId: string;
    methodPackageRef: string;
    methodVersionRef: string;
    segment: { kind: 'RESEARCH_DATASET' | 'IMPLEMENTATION_KEY'; value: string };
    watermark: {
      admissionSequence: number;
      methodOutcomeEvidenceId: `method-outcome-evidence_${string}`;
    };
  }> = {}
) {
  return {
    schemaVersion: 1 as const,
    workspaceId: overrides.workspaceId ?? workspaceId,
    methodPackageRef: overrides.methodPackageRef ?? packageRef,
    methodVersionRef: overrides.methodVersionRef ?? methodVersionRef,
    ...(overrides.segment ? { segment: overrides.segment } : {}),
    ...(overrides.watermark ? { watermark: overrides.watermark } : {})
  };
}

integration('PostgreSQL bounded Method Outcome reporting', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(databaseConfig());
    await database.start();
    await migrate(database.getPool(), migrationNamespace, await coreMigrations());
  });

  beforeEach(async () => {
    nextEvidence = 0;
    await database.getPool().query('TRUNCATE core_method_outcome_evidence RESTART IDENTITY');
  });

  afterAll(async () => database.close());

  it('computes the frozen counts/rates by exact package and method version', async () => {
    await admit('confirmed', 'CONFIRMED');
    await admit('method-error', 'OVERRIDDEN', 'METHOD_ERROR');
    await admit('input-error', 'OVERRIDDEN', 'INPUT_DATA_ERROR');
    await admit('applicability-error', 'OVERRIDDEN', 'APPLICABILITY_ERROR');
    await admit('preference', 'OVERRIDDEN', 'PRODUCT_USER_PREFERENCE');
    await admit('inconclusive', 'INCONCLUSIVE', 'INCONCLUSIVE_EVIDENCE');
    await admit('other-package', 'CONFIRMED', undefined, {
      packageRef: 'brain-method-package:package_other@1'
    });
    await admit('other-version', 'CONFIRMED', undefined, {
      methodVersionRef: 'brain-method-version:method-version_cn-duration-v2'
    });

    const report = await reader().report(query());

    expect(report.admittedReviews).toBe(6);
    expect(report.confirmed).toEqual({ count: 1, rate: 1 / 6 });
    expect(report.overridden).toEqual({ count: 4, rate: 4 / 6 });
    expect(report.methodError).toEqual({ count: 1, rate: 1 / 6 });
    expect(report.inputDataError).toEqual({ count: 1, rate: 1 / 6 });
    expect(report.applicabilityError).toEqual({ count: 1, rate: 1 / 6 });
    expect(report.productUserPreference).toEqual({ count: 1, rate: 1 / 6 });
    expect(report.inconclusive).toEqual({ count: 1, rate: 1 / 6 });
    expect(report.sampleEvidenceRefs).toHaveLength(6);
    expect(report.watermark?.admissionSequence).toBeGreaterThan(0);
  });

  it('filters only the explicit supported dataset or implementation segment', async () => {
    await admit('dataset-a-1', 'CONFIRMED', undefined, { dataset: datasetA });
    await admit('dataset-a-2', 'OVERRIDDEN', 'METHOD_ERROR', { dataset: datasetA });
    await admit('dataset-b', 'CONFIRMED', undefined, {
      dataset: datasetB,
      implementationKey: implementationB
    });

    const datasetReport = await reader().report(
      query({ segment: { kind: 'RESEARCH_DATASET', value: datasetA } })
    );
    const implementationReport = await reader().report(
      query({ segment: { kind: 'IMPLEMENTATION_KEY', value: implementationB } })
    );

    expect(datasetReport.admittedReviews).toBe(2);
    expect(datasetReport.methodError.count).toBe(1);
    expect(implementationReport.admittedReviews).toBe(1);
    expect(implementationReport.confirmed.count).toBe(1);
  });

  it('replays exactly from a monotonic watermark after a later same-timestamp admission', async () => {
    const sameTimestamp = '2026-08-30T21:05:00.000Z';
    await admit('watermark-first', 'CONFIRMED', undefined, {}, sameTimestamp);
    const first = await reader().report(query());
    expect(first.admittedReviews).toBe(1);
    expect(first.watermark).toBeDefined();

    await admit('watermark-later-same-ms', 'OVERRIDDEN', 'METHOD_ERROR', {}, sameTimestamp);
    const replay = await reader().report(query({ watermark: first.watermark! }));
    const current = await reader().report(query());

    expect(replay).toEqual(first);
    expect(current.admittedReviews).toBe(2);
    expect(current.watermark!.admissionSequence).toBeGreaterThan(
      first.watermark!.admissionSequence
    );
  });

  it('fails closed when a supplied watermark belongs to another workspace or filter', async () => {
    await admit('package-a', 'CONFIRMED');
    const source = await reader().report(query());
    await admit('package-b', 'CONFIRMED', undefined, {
      packageRef: 'brain-method-package:package_other@1'
    });
    await admit('other-workspace', 'CONFIRMED', undefined, { workspace: otherWorkspaceId });

    await expect(
      reader().report(
        query({
          methodPackageRef: 'brain-method-package:package_other@1',
          watermark: source.watermark!
        })
      )
    ).rejects.toMatchObject({ code: 'WATERMARK_MISMATCH' });
    await expect(
      reader().report(query({ workspaceId: otherWorkspaceId, watermark: source.watermark! }))
    ).rejects.toMatchObject({ code: 'WATERMARK_MISMATCH' });
  });

  it('returns a bounded deterministic sample and zero metrics for an empty set', async () => {
    for (let index = 1; index <= 23; index += 1) await admit(`sample-${index}`, 'CONFIRMED');

    const populated = await reader().report(query());
    expect(populated.sampleEvidenceRefs).toHaveLength(20);
    expect(populated.sampleEvidenceRefs.map((item) => item.admissionSequence)).toEqual(
      [...populated.sampleEvidenceRefs.map((item) => item.admissionSequence)].sort((a, b) => b - a)
    );

    const empty = await reader().report(
      query({ methodPackageRef: 'brain-method-package:package_absent@1' })
    );
    expect(empty).toMatchObject({
      admittedReviews: 0,
      confirmed: { count: 0, rate: 0 },
      overridden: { count: 0, rate: 0 },
      methodError: { count: 0, rate: 0 },
      inputDataError: { count: 0, rate: 0 },
      applicabilityError: { count: 0, rate: 0 },
      productUserPreference: { count: 0, rate: 0 },
      inconclusive: { count: 0, rate: 0 },
      sampleEvidenceRefs: []
    });
    expect(empty.watermark).toBeUndefined();
  });
});
