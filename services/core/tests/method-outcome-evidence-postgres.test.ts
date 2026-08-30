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

const dedicatedUrl = process.env.CORE_METHOD_OUTCOME_EVIDENCE_TEST_DATABASE_URL;
const url = dedicatedUrl ?? process.env.IDENTITY_TEST_DATABASE_URL;
const required =
  process.env.CORE_METHOD_OUTCOME_EVIDENCE_POSTGRES_REQUIRED === '1' ||
  process.env.IDENTITY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'Method Outcome Evidence PostgreSQL acceptance requires CORE_METHOD_OUTCOME_EVIDENCE_TEST_DATABASE_URL or IDENTITY_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const coreMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service');
const migrationNamespace = dedicatedUrl ? 'core_method_outcome_evidence' : 'core_identity';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';

function databaseConfig() {
  return parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: migrationNamespace,
    DB_APPLICATION_NAME: 'markorbit-phase6-method-outcome-evidence-tests'
  });
}

function admission(
  options: {
    reviewId?: string;
    reviewVersion?: number;
    sourceFingerprint?: string;
    reviewFingerprint?: string;
    invocationId?: string;
    workspace?: string;
  } = {}
) {
  const reviewId = options.reviewId ?? 'matter-intelligence-review_phase6-core-pg-v1';
  const reviewVersion = options.reviewVersion ?? 1;
  return {
    schemaVersion: 1,
    workspaceId: options.workspace ?? workspaceId,
    source: {
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceId: reviewId,
      sourceVersion: reviewVersion,
      sourceFingerprintSha256: options.sourceFingerprint ?? '1'.repeat(64)
    },
    formalMatter: { id: 'formal-matter_phase6-core-pg', version: 1 },
    observation: {
      id: 'matter-intelligence-observation_phase6-core-pg',
      fingerprintSha256: '2'.repeat(64),
      outputFingerprintSha256: '3'.repeat(64)
    },
    review: {
      id: reviewId,
      version: reviewVersion,
      fingerprintSha256: options.reviewFingerprint ?? '4'.repeat(64),
      outcome: reviewVersion === 1 ? 'CONFIRMED' : 'OVERRIDDEN',
      ...(reviewVersion === 1 ? {} : { reason: 'METHOD_ERROR' }),
      reviewedByPrincipalId: 'principal_phase6-core-pg',
      reviewedAt: reviewVersion === 1 ? '2026-08-30T20:00:00.000Z' : '2026-08-30T20:10:00.000Z'
    },
    capability: {
      id: 'interpretation.cn-completed-duration-historical-band',
      version: '1.0.0',
      requestId: 'capreq_phase6-core-pg',
      returnId: 'capability-return_phase6-core-pg',
      outcomeId: 'capability-outcome_phase6-core-pg',
      invocationId: options.invocationId ?? 'capability-invocation_phase6-core-pg',
      sessionReceiptId: 'session-receipt_phase6-core-pg'
    },
    implementation: {
      id: 'implementation-profile_cn-duration-band-classification-v1',
      version: 1,
      key: 'brain-method-package-runtime.cn-duration-band-classification.v1'
    },
    method: {
      packageRef: 'brain-method-package:package_cn-duration@1',
      methodRef: 'brain-method:method_cn-duration',
      methodVersionRef: 'brain-method-version:method-version_cn-duration',
      evaluationRef: 'brain-method-evaluation:evaluation_cn-duration',
      researchDatasetRef: 'research-dataset:cn-duration-band:accepted',
      evidenceFingerprintSha256: '5'.repeat(64),
      inputFingerprintSha256: '6'.repeat(64),
      outputFingerprintSha256: '3'.repeat(64)
    }
  };
}

let database: ManagedDatabase;

function service(now = '2026-08-30T20:01:00.000Z', id = 'phase6-core-pg') {
  return new MethodOutcomeEvidenceAdmissionServiceV1({
    repository: new PostgresMethodOutcomeEvidenceAdmissionRepositoryV1(database),
    now: () => now,
    evidenceIdFactory: () => id
  });
}

integration('PostgreSQL Method Outcome Evidence admission', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(databaseConfig());
    await database.start();
    await migrate(database.getPool(), migrationNamespace, await coreMigrations());
  });

  beforeEach(async () => {
    await database.getPool().query('TRUNCATE core_method_outcome_evidence');
  });

  afterAll(async () => database.close());

  it('admits once and exact replay returns the original immutable evidence', async () => {
    const first = await service().admit({ workspaceId, evidence: admission() });
    const replay = await service('2026-08-30T20:02:00.000Z', 'would-be-new-id').admit({
      workspaceId,
      evidence: admission()
    });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.evidence).toEqual(first.evidence);
    const rows = await database
      .getPool()
      .query('SELECT method_outcome_evidence_id FROM core_method_outcome_evidence');
    expect(rows.rows).toHaveLength(1);
  });

  it('fails closed when the same product review identity carries different bounded provenance', async () => {
    await service().admit({ workspaceId, evidence: admission() });

    await expect(
      service('2026-08-30T20:02:00.000Z', 'conflicting-id').admit({
        workspaceId,
        evidence: admission({ invocationId: 'capability-invocation_phase6-core-pg-different' })
      })
    ).rejects.toMatchObject({ code: 'EVIDENCE_CONFLICT' });
    const rows = await database.getPool().query('SELECT 1 FROM core_method_outcome_evidence');
    expect(rows.rows).toHaveLength(1);
  });

  it('admits a later product review correction as a second immutable evidence identity', async () => {
    const first = await service().admit({ workspaceId, evidence: admission() });
    const corrected = await service('2026-08-30T20:11:00.000Z', 'phase6-core-pg-v2').admit({
      workspaceId,
      evidence: admission({
        reviewId: 'matter-intelligence-review_phase6-core-pg-v2',
        reviewVersion: 2,
        sourceFingerprint: '7'.repeat(64),
        reviewFingerprint: '8'.repeat(64)
      })
    });

    expect(corrected.replayed).toBe(false);
    expect(corrected.evidence.review).toMatchObject({
      version: 2,
      outcome: 'OVERRIDDEN',
      reason: 'METHOD_ERROR'
    });
    expect(corrected.evidence.methodOutcomeEvidenceId).not.toBe(
      first.evidence.methodOutcomeEvidenceId
    );
    const versions = await database
      .getPool()
      .query<{ review_version: number }>(
        'SELECT review_version FROM core_method_outcome_evidence ORDER BY review_version'
      );
    expect(versions.rows.map((row) => row.review_version)).toEqual([1, 2]);
  });

  it('enforces trusted workspace isolation before persistence', async () => {
    await expect(
      service().admit({ workspaceId: otherWorkspaceId, evidence: admission() })
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' });
    expect(
      (await database.getPool().query('SELECT 1 FROM core_method_outcome_evidence')).rows
    ).toHaveLength(0);
  });

  it('rejects update and delete so admitted evidence remains append-only', async () => {
    const first = await service().admit({ workspaceId, evidence: admission() });

    await expect(
      database
        .getPool()
        .query(
          "UPDATE core_method_outcome_evidence SET outcome='OVERRIDDEN' WHERE method_outcome_evidence_id=$1",
          [first.evidence.methodOutcomeEvidenceId]
        )
    ).rejects.toThrow(/append-only/u);
    await expect(
      database
        .getPool()
        .query('DELETE FROM core_method_outcome_evidence WHERE method_outcome_evidence_id=$1', [
          first.evidence.methodOutcomeEvidenceId
        ])
    ).rejects.toThrow(/append-only/u);
  });
});
