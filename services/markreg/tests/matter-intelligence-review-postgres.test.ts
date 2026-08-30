import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FormalMatterId, WorkspacePrincipal } from '@markorbit/contracts';
import { CN_DURATION_BAND_ACCEPTED_DATASET_REF } from '@markorbit/contracts/brain-cn-duration-band-classification';
import { ManagedDatabase } from '@markorbit/persistence';
import {
  PostgresMatterIntelligenceRepository,
  type MarkRegMatterIntelligenceObservationV1
} from '../src/matter-intelligence.js';
import {
  MatterIntelligenceReviewService,
  PostgresMatterIntelligenceReviewRepository,
  type MatterIntelligenceReviewError
} from '../src/matter-intelligence-review.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url =
  process.env.MARKREG_MATTER_INTELLIGENCE_REVIEW_TEST_DATABASE_URL ??
  process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_MATTER_INTELLIGENCE_REVIEW_POSTGRES_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'MARKREG_MATTER_INTELLIGENCE_REVIEW_TEST_DATABASE_URL or MARKREG_TEST_DATABASE_URL is required when MARKREG_MATTER_INTELLIGENCE_REVIEW_POSTGRES_REQUIRED=1.'
  );
}
const suite = url ? describe : describe.skip;
const workspaceId = '55555555-5555-4555-8555-555555555555';
const otherWorkspaceId = '66666666-6666-4666-8666-666666666666';
const formalMatterId = 'formal-matter_phase6-review-postgres' as FormalMatterId;
const observationId = 'matter-intelligence-observation_phase6-review-postgres';
const evidenceRefs = [
  'brain-method-package:package_cn-duration@1',
  'brain-method:method_cn-duration',
  'brain-method-version:method-version_cn-duration',
  'brain-method-evaluation:evaluation_cn-duration',
  `research-dataset:${CN_DURATION_BAND_ACCEPTED_DATASET_REF}:accepted`
];

function principal(workspace = workspaceId): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_phase6-review-postgres',
    userId: 'principal_phase6-review-postgres',
    workspaceId: workspace,
    membershipId: 'membership_phase6-review-postgres',
    role: 'MATTER_MANAGER',
    permissions: ['workspace:read', 'matter:read', 'matter:manage'],
    sessionExpiresAt: '2026-08-31T00:00:00.000Z'
  };
}

function observation(): MarkRegMatterIntelligenceObservationV1 {
  return {
    schemaVersion: 1,
    matterIntelligenceObservationId: observationId,
    workspaceId,
    formalMatter: {
      id: formalMatterId,
      version: 1,
      snapshotSha256: 'a'.repeat(64)
    },
    observationKind: 'CN_COMPLETED_DURATION_HISTORICAL_BAND',
    observedCompletedDurationDays: 336,
    historicalBand: 'LOWER_INTERQUARTILE',
    datasetRefId: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
    capability: {
      id: 'interpretation.cn-completed-duration-historical-band',
      version: '1.0.0',
      inputSchemaId: 'brain-input.cn-completed-duration-historical-band.v1',
      outputSchemaId: 'brain.cn-completed-duration-historical-band.v1'
    },
    capabilityRequestId: 'capreq_phase6-review-postgres',
    capabilityInvocationId: 'capability-invocation_phase6-review-postgres',
    capabilityOutcomeId: 'capability-outcome_phase6-review-postgres',
    capabilityReturnId: 'capability-return_phase6-review-postgres',
    sessionReceiptId: 'session-receipt_phase6-review-postgres',
    implementation: {
      id: 'implementation-profile_cn-duration-band-classification-v1',
      version: 1,
      implementationKey: 'brain-method-package-runtime.cn-duration-band-classification.v1'
    },
    correlationId: 'correlation-phase6-review-observation',
    capabilityCorrelationId: 'capability-correlation-phase6-review-observation',
    methodPackageRef: evidenceRefs[0]!,
    methodRef: evidenceRefs[1]!,
    methodVersionRef: evidenceRefs[2]!,
    evaluationRef: evidenceRefs[3]!,
    researchDatasetRef: evidenceRefs[4]!,
    evidenceRefs,
    evidenceFingerprintSha256: 'b'.repeat(64),
    inputFingerprintSha256: 'c'.repeat(64),
    outputFingerprintSha256: 'd'.repeat(64),
    recordedByPrincipalId: 'principal_phase5-observation',
    recordedAt: '2026-08-30T04:00:00.000Z'
  };
}

suite('PostgreSQL MarkReg Matter Intelligence Review persistence', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-matter-intelligence-review-test',
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
        'confirmation_phase6-review-postgres',
        'matter-draft_phase6-review-postgres',
        'quote_phase6-review-postgres',
        'quote-v1',
        JSON.stringify({ schemaVersion: 1, source: 'phase6-review-postgres-test' }),
        'a'.repeat(64),
        'principal_phase6-review-postgres',
        '2026-08-30T04:00:00.000Z'
      ]
    );
    const phase5 = new PostgresMatterIntelligenceRepository(database, pool);
    const value = observation();
    await phase5.record({
      observation: value,
      idempotencyKey: 'phase6-seed-observation',
      requestFingerprintSha256: '1'.repeat(64),
      correlationId: value.correlationId,
      capabilityReplayed: false
    });
  });

  afterAll(() => database.close());

  function service(now = '2026-08-30T04:10:00.000Z') {
    return new MatterIntelligenceReviewService(
      new PostgresMatterIntelligenceReviewRepository(database),
      () => now
    );
  }

  function reviewCommand(overrides: Record<string, unknown> = {}) {
    return {
      workspaceId,
      formalMatterId,
      matterIntelligenceObservationId: observationId,
      outcome: 'CONFIRMED' as const,
      principal: principal(),
      idempotencyKey: 'phase6-review-key-one',
      correlationId: 'phase6-review-correlation-one',
      ...overrides
    };
  }

  it('persists CONFIRMED once, replays exact command and semantically dedupes latest review under another key', async () => {
    const reviews = service();
    const first = await reviews.recordReview(reviewCommand());
    expect(first).toMatchObject({ replayed: false, semanticDuplicate: false });
    expect(first.review).toMatchObject({
      reviewVersion: 1,
      outcome: 'CONFIRMED',
      reviewedByPrincipalId: 'principal_phase6-review-postgres'
    });
    expect(first.review.reason).toBeUndefined();
    expect(first.review.observationFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.review.reviewFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.review.productSourceFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);

    const replay = await reviews.recordReview(reviewCommand());
    expect(replay.replayed).toBe(true);
    expect(replay.review).toEqual(first.review);

    const duplicate = await reviews.recordReview(
      reviewCommand({
        idempotencyKey: 'phase6-review-key-two',
        correlationId: 'phase6-review-correlation-two'
      })
    );
    expect(duplicate.replayed).toBe(false);
    expect(duplicate.semanticDuplicate).toBe(true);
    expect(duplicate.review).toEqual(first.review);

    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*)::int FROM markreg_matter_intelligence_reviews) AS reviews,(SELECT count(*)::int FROM markreg_matter_intelligence_review_commands) AS commands'
      );
    expect(counts.rows[0]).toMatchObject({ reviews: 1, commands: 2 });
  });

  it('rejects same idempotency key with different product review payload and writes nothing new', async () => {
    const reviews = service();
    await reviews.recordReview(reviewCommand());

    await expect(
      reviews.recordReview(
        reviewCommand({
          outcome: 'OVERRIDDEN',
          reason: 'METHOD_ERROR'
        })
      )
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    } satisfies Partial<MatterIntelligenceReviewError>);

    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*)::int FROM markreg_matter_intelligence_reviews) AS reviews,(SELECT count(*)::int FROM markreg_matter_intelligence_review_commands) AS commands'
      );
    expect(counts.rows[0]).toMatchObject({ reviews: 1, commands: 1 });
  });

  it('requires exact latest supersession and preserves a confirmed -> overridden -> confirmed history', async () => {
    const first = await service('2026-08-30T04:10:00.000Z').recordReview(reviewCommand());

    await expect(
      service('2026-08-30T04:11:00.000Z').recordReview(
        reviewCommand({
          idempotencyKey: 'phase6-review-key-no-supersedes',
          correlationId: 'phase6-review-correlation-no-supersedes',
          outcome: 'OVERRIDDEN',
          reason: 'METHOD_ERROR'
        })
      )
    ).rejects.toMatchObject({ code: 'REVIEW_SUPERSESSION_REQUIRED' });

    const overridden = await service('2026-08-30T04:12:00.000Z').recordReview(
      reviewCommand({
        idempotencyKey: 'phase6-review-key-overridden',
        correlationId: 'phase6-review-correlation-overridden',
        outcome: 'OVERRIDDEN',
        reason: 'METHOD_ERROR',
        rationale: 'The historical band was reviewed as incorrect for the admitted input.',
        supersedes: {
          reviewId: first.review.matterIntelligenceReviewId,
          reviewVersion: first.review.reviewVersion
        }
      })
    );
    expect(overridden.review).toMatchObject({
      reviewVersion: 2,
      outcome: 'OVERRIDDEN',
      reason: 'METHOD_ERROR',
      supersedes: {
        reviewId: first.review.matterIntelligenceReviewId,
        reviewVersion: 1
      }
    });

    await expect(
      service('2026-08-30T04:13:00.000Z').recordReview(
        reviewCommand({
          idempotencyKey: 'phase6-review-key-stale-supersedes',
          correlationId: 'phase6-review-correlation-stale-supersedes',
          outcome: 'INCONCLUSIVE',
          reason: 'INCONCLUSIVE_EVIDENCE',
          supersedes: {
            reviewId: first.review.matterIntelligenceReviewId,
            reviewVersion: 1
          }
        })
      )
    ).rejects.toMatchObject({ code: 'REVIEW_SUPERSESSION_CONFLICT' });

    const confirmedAgain = await service('2026-08-30T04:14:00.000Z').recordReview(
      reviewCommand({
        idempotencyKey: 'phase6-review-key-confirmed-again',
        correlationId: 'phase6-review-correlation-confirmed-again',
        supersedes: {
          reviewId: overridden.review.matterIntelligenceReviewId,
          reviewVersion: overridden.review.reviewVersion
        }
      })
    );
    expect(confirmedAgain.review).toMatchObject({
      reviewVersion: 3,
      outcome: 'CONFIRMED',
      supersedes: {
        reviewId: overridden.review.matterIntelligenceReviewId,
        reviewVersion: 2
      }
    });

    const history = await database
      .getPool()
      .query(
        'SELECT review_version,outcome,reason,supersedes_review_version FROM markreg_matter_intelligence_reviews ORDER BY review_version ASC'
      );
    expect(history.rows).toEqual([
      {
        review_version: 1,
        outcome: 'CONFIRMED',
        reason: null,
        supersedes_review_version: null
      },
      {
        review_version: 2,
        outcome: 'OVERRIDDEN',
        reason: 'METHOD_ERROR',
        supersedes_review_version: 1
      },
      {
        review_version: 3,
        outcome: 'CONFIRMED',
        reason: null,
        supersedes_review_version: 2
      }
    ]);
  });

  it('fails closed on missing/wrong-workspace observation and leaves review state empty', async () => {
    await expect(
      service().recordReview(
        reviewCommand({
          matterIntelligenceObservationId: 'matter-intelligence-observation_missing'
        })
      )
    ).rejects.toMatchObject({ code: 'OBSERVATION_NOT_FOUND' });

    await expect(
      service().recordReview(
        reviewCommand({
          workspaceId: otherWorkspaceId,
          principal: principal(otherWorkspaceId),
          idempotencyKey: 'phase6-review-other-workspace'
        })
      )
    ).rejects.toMatchObject({ code: 'OBSERVATION_NOT_FOUND' });

    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*)::int FROM markreg_matter_intelligence_reviews) AS reviews,(SELECT count(*)::int FROM markreg_matter_intelligence_review_commands) AS commands'
      );
    expect(counts.rows[0]).toMatchObject({ reviews: 0, commands: 0 });
  });

  it('keeps review evidence append-only and does not mutate the Phase 5 observation or neighboring product state', async () => {
    const first = await service().recordReview(reviewCommand());

    await expect(
      database
        .getPool()
        .query(
          "UPDATE markreg_matter_intelligence_reviews SET outcome='OVERRIDDEN' WHERE matter_intelligence_review_id=$1",
          [first.review.matterIntelligenceReviewId]
        )
    ).rejects.toThrow(/append-only/i);
    await expect(
      database
        .getPool()
        .query('DELETE FROM markreg_matter_intelligence_review_commands WHERE workspace_id=$1', [
          workspaceId
        ])
    ).rejects.toThrow(/append-only/i);

    const observationState = await database
      .getPool()
      .query(
        'SELECT observed_completed_duration_days,historical_band,output_fingerprint_sha256 FROM markreg_matter_intelligence_observations WHERE matter_intelligence_observation_id=$1',
        [observationId]
      );
    expect(observationState.rows[0]).toMatchObject({
      observed_completed_duration_days: 336,
      historical_band: 'LOWER_INTERQUARTILE',
      output_fingerprint_sha256: 'd'.repeat(64)
    });

    const matterState = await database
      .getPool()
      .query(
        'SELECT status,version,snapshot_sha256 FROM formal_matters WHERE formal_matter_id=$1',
        [formalMatterId]
      );
    expect(matterState.rows[0]).toMatchObject({
      status: 'OPEN',
      version: 1,
      snapshot_sha256: 'a'.repeat(64)
    });

    const neighbors = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*)::int FROM markreg_recommended_actions) AS recommended_actions,(SELECT count(*)::int FROM markreg_formal_trademark_service_opportunities) AS formal_opportunities'
      );
    expect(neighbors.rows[0]).toMatchObject({ recommended_actions: 0, formal_opportunities: 0 });
  });
});
