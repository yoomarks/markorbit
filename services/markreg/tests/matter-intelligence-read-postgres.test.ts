import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FormalMatterId, WorkspacePrincipal } from '@markorbit/contracts';
import { CN_DURATION_BAND_ACCEPTED_DATASET_REF } from '@markorbit/contracts/brain-cn-duration-band-classification';
import { ManagedDatabase } from '@markorbit/persistence';
import { assertMatterIntelligenceReadIntegrity } from '../src/matter-intelligence-read-integrity.js';
import {
  MatterIntelligenceReadService,
  PostgresMatterIntelligenceReadRepository,
  type MatterIntelligenceReadError
} from '../src/matter-intelligence-read.js';
import {
  PostgresMatterIntelligenceRepository,
  type MarkRegMatterIntelligenceObservationV1
} from '../src/matter-intelligence.js';
import {
  MatterIntelligenceReviewService,
  PostgresMatterIntelligenceReviewRepository
} from '../src/matter-intelligence-review.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url =
  process.env.MARKREG_MATTER_INTELLIGENCE_READ_TEST_DATABASE_URL ??
  process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_MATTER_INTELLIGENCE_READ_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MARKREG_MATTER_INTELLIGENCE_READ_TEST_DATABASE_URL or MARKREG_TEST_DATABASE_URL is required when MARKREG_MATTER_INTELLIGENCE_READ_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;

const workspaceId = '99999999-9999-4999-8999-999999999999';
const otherWorkspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const formalMatterId = 'formal-matter_intelligence-read-postgres' as FormalMatterId;
const evidenceRefs = [
  'brain-method-package:package_cn-duration@1',
  'brain-method:method_cn-duration',
  'brain-method-version:method-version_cn-duration',
  'brain-method-evaluation:evaluation_cn-duration',
  `research-dataset:${CN_DURATION_BAND_ACCEPTED_DATASET_REF}:accepted`
];
const evidenceFingerprintSha256 = createHash('sha256')
  .update(JSON.stringify(evidenceRefs))
  .digest('hex');

function principal(workspace = workspaceId): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_intelligence-read-postgres',
    userId: 'user_intelligence-read-postgres',
    workspaceId: workspace,
    membershipId: 'membership_intelligence-read-postgres',
    role: 'MATTER_MANAGER',
    permissions: ['workspace:read', 'matter:read', 'matter:manage'],
    sessionExpiresAt: '2026-09-02T00:00:00.000Z'
  };
}

function observation(
  suffix: string,
  days: number,
  recordedAt: string
): MarkRegMatterIntelligenceObservationV1 {
  return {
    schemaVersion: 1,
    matterIntelligenceObservationId: `matter-intelligence-observation_read-${suffix}`,
    workspaceId,
    formalMatter: {
      id: formalMatterId,
      version: 1,
      snapshotSha256: 'a'.repeat(64)
    },
    observationKind: 'CN_COMPLETED_DURATION_HISTORICAL_BAND',
    observedCompletedDurationDays: days,
    historicalBand:
      days <= 335
        ? 'LOWER_QUARTILE_OR_BELOW'
        : days <= 336
          ? 'LOWER_INTERQUARTILE'
          : days <= 383
            ? 'UPPER_INTERQUARTILE'
            : 'UPPER_QUARTILE',
    datasetRefId: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
    capability: {
      id: 'interpretation.cn-completed-duration-historical-band',
      version: '1.0.0',
      inputSchemaId: 'brain-input.cn-completed-duration-historical-band.v1',
      outputSchemaId: 'brain.cn-completed-duration-historical-band.v1'
    },
    capabilityRequestId: `capreq_read-${suffix}`,
    capabilityInvocationId: `capability-invocation_read-${suffix}`,
    capabilityOutcomeId: `capability-outcome_read-${suffix}`,
    capabilityReturnId: `capability-return_read-${suffix}`,
    sessionReceiptId: `session-receipt_read-${suffix}`,
    implementation: {
      id: 'implementation-profile_cn-duration-band-classification-v1',
      version: 1,
      implementationKey: 'brain-method-package-runtime.cn-duration-band-classification.v1'
    },
    correlationId: `correlation-read-${suffix}`,
    capabilityCorrelationId: `capability-correlation-read-${suffix}`,
    methodPackageRef: evidenceRefs[0]!,
    methodRef: evidenceRefs[1]!,
    methodVersionRef: evidenceRefs[2]!,
    evaluationRef: evidenceRefs[3]!,
    researchDatasetRef: evidenceRefs[4]!,
    evidenceRefs,
    evidenceFingerprintSha256,
    inputFingerprintSha256: suffix === 'two' ? 'e'.repeat(64) : 'c'.repeat(64),
    outputFingerprintSha256: suffix === 'two' ? 'f'.repeat(64) : 'd'.repeat(64),
    recordedByPrincipalId: 'user_intelligence-read-postgres',
    recordedAt
  };
}

suite('PostgreSQL governed MarkReg Matter Intelligence reads', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-matter-intelligence-read-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory,
      migrationOwners
    });
  });

  beforeEach(async () => {
    const pool = database.getPool();
    await pool.query(
      'TRUNCATE markreg_matter_intelligence_review_commands,markreg_matter_intelligence_reviews,markreg_matter_intelligence_commands,markreg_matter_intelligence_observations,formal_matters CASCADE'
    );
    await pool.query(
      `INSERT INTO formal_matters (
        formal_matter_id,workspace_id,kind,status,version,
        source_customer_confirmation_id,source_customer_confirmation_version,
        source_matter_draft_id,source_matter_draft_version,
        source_quote_id,source_quote_version,source_snapshot,snapshot_schema_version,
        snapshot_sha256,created_by_user_id,created_at,updated_at
      ) VALUES ($1,$2,'TRADEMARK_REGISTRATION','OPEN',1,$3,1,$4,1,$5,$6,$7::jsonb,1,$8,$9,$10,$10)`,
      [
        formalMatterId,
        workspaceId,
        'confirmation_intelligence-read-postgres',
        'matter-draft_intelligence-read-postgres',
        'quote_intelligence-read-postgres',
        'quote-v1',
        JSON.stringify({ schemaVersion: 1, source: 'intelligence-read-postgres-test' }),
        'a'.repeat(64),
        'user_intelligence-read-postgres',
        '2026-08-31T09:00:00.000Z'
      ]
    );
  });

  afterAll(() => database.close());

  function reader() {
    return new MatterIntelligenceReadService(
      new PostgresMatterIntelligenceReadRepository(database)
    );
  }

  async function seedObservation(value: MarkRegMatterIntelligenceObservationV1, key: string) {
    const store = new PostgresMatterIntelligenceRepository(database, database.getPool());
    await store.record({
      observation: value,
      idempotencyKey: key,
      requestFingerprintSha256: key.endsWith('two') ? '2'.repeat(64) : '1'.repeat(64),
      correlationId: value.correlationId,
      capabilityReplayed: false
    });
  }

  it('returns a successful empty projection and a fresh reader instance sees the same durable truth', async () => {
    const first = await reader().getForMatter(principal(), formalMatterId);
    expect(first).toMatchObject({ items: [], total: 0 });
    assertMatterIntelligenceReadIntegrity(first, workspaceId);

    const freshReader = reader();
    const second = await freshReader.getForMatter(principal(), formalMatterId);
    expect(second).toEqual(first);
  });

  it('orders and paginates multiple durable observations deterministically', async () => {
    const older = observation('one', 336, '2026-08-31T09:10:00.000Z');
    const newer = observation('two', 337, '2026-08-31T09:20:00.000Z');
    await seedObservation(older, 'intelligence-read-one');
    await seedObservation(newer, 'intelligence-read-two');

    const pageOne = await reader().getForMatter(principal(), formalMatterId, {
      page: 1,
      pageSize: 1,
      reviewHistoryLimit: 10
    });
    expect(pageOne.total).toBe(2);
    expect(pageOne.items).toHaveLength(1);
    expect(pageOne.items[0]!.observation.matterIntelligenceObservationId).toBe(
      newer.matterIntelligenceObservationId
    );
    expect(pageOne.items[0]).toMatchObject({
      matterSourceCurrent: true,
      currentReview: null,
      reviewHistory: [],
      reviewHistoryTotal: 0,
      reviewHistoryComplete: true,
      reviewState: 'UNREVIEWED'
    });
    assertMatterIntelligenceReadIntegrity(pageOne, workspaceId);

    const pageTwo = await reader().getForMatter(principal(), formalMatterId, {
      page: 2,
      pageSize: 1
    });
    expect(pageTwo.items[0]!.observation.matterIntelligenceObservationId).toBe(
      older.matterIntelligenceObservationId
    );
  });

  it('returns exact current and superseded Human Review lineage bound to the durable observation', async () => {
    const value = observation('one', 336, '2026-08-31T09:10:00.000Z');
    await seedObservation(value, 'intelligence-read-one');

    const firstReviewService = new MatterIntelligenceReviewService(
      new PostgresMatterIntelligenceReviewRepository(database),
      () => '2026-08-31T09:30:00.000Z'
    );
    const first = await firstReviewService.recordReview({
      workspaceId,
      formalMatterId,
      matterIntelligenceObservationId: value.matterIntelligenceObservationId,
      outcome: 'CONFIRMED',
      principal: principal(),
      idempotencyKey: 'intelligence-read-review-one',
      correlationId: 'intelligence-read-review-correlation-one'
    });

    const secondReviewService = new MatterIntelligenceReviewService(
      new PostgresMatterIntelligenceReviewRepository(database),
      () => '2026-08-31T09:40:00.000Z'
    );
    const second = await secondReviewService.recordReview({
      workspaceId,
      formalMatterId,
      matterIntelligenceObservationId: value.matterIntelligenceObservationId,
      outcome: 'OVERRIDDEN',
      reason: 'METHOD_ERROR',
      rationale: 'Reviewer found a method-specific interpretation error.',
      supersedes: {
        reviewId: first.review.matterIntelligenceReviewId,
        reviewVersion: first.review.reviewVersion
      },
      principal: principal(),
      idempotencyKey: 'intelligence-read-review-two',
      correlationId: 'intelligence-read-review-correlation-two'
    });

    const projection = await reader().getForMatter(principal(), formalMatterId, {
      reviewHistoryLimit: 10
    });
    expect(projection.items[0]).toMatchObject({
      reviewState: 'REVIEWED',
      reviewHistoryTotal: 2,
      reviewHistoryComplete: true,
      currentReview: {
        matterIntelligenceReviewId: second.review.matterIntelligenceReviewId,
        reviewVersion: 2,
        outcome: 'OVERRIDDEN',
        reason: 'METHOD_ERROR'
      }
    });
    expect(projection.items[0]!.reviewHistory.map((review) => review.reviewVersion)).toEqual([
      2, 1
    ]);
    expect(projection.items[0]!.reviewHistory[0]!.supersedes).toEqual({
      reviewId: first.review.matterIntelligenceReviewId,
      reviewVersion: 1
    });
    assertMatterIntelligenceReadIntegrity(projection, workspaceId);
  });

  it('does not disclose another Workspace and keeps storage failure distinct from an empty result', async () => {
    await expect(
      reader().getForMatter(principal(otherWorkspaceId), formalMatterId)
    ).rejects.toMatchObject({
      code: 'FORMAL_MATTER_NOT_FOUND',
      status: 404
    } satisfies Partial<MatterIntelligenceReadError>);
  });

  it('fails the integrity gate when persisted review fingerprint lineage is corrupted', async () => {
    const value = observation('one', 336, '2026-08-31T09:10:00.000Z');
    await seedObservation(value, 'intelligence-read-one');
    const reviews = new MatterIntelligenceReviewService(
      new PostgresMatterIntelligenceReviewRepository(database),
      () => '2026-08-31T09:30:00.000Z'
    );
    await reviews.recordReview({
      workspaceId,
      formalMatterId,
      matterIntelligenceObservationId: value.matterIntelligenceObservationId,
      outcome: 'CONFIRMED',
      principal: principal(),
      idempotencyKey: 'intelligence-read-review-corrupt',
      correlationId: 'intelligence-read-review-corrupt-correlation'
    });
    await database
      .getPool()
      .query(
        'UPDATE markreg_matter_intelligence_reviews SET observation_fingerprint_sha256=$1 WHERE workspace_id=$2 AND matter_intelligence_observation_id=$3',
        ['0'.repeat(64), workspaceId, value.matterIntelligenceObservationId]
      );

    const projection = await reader().getForMatter(principal(), formalMatterId);
    let thrown: unknown;
    try {
      assertMatterIntelligenceReadIntegrity(projection, workspaceId);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' });
  });
});
