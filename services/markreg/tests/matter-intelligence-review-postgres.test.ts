import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { CN_DURATION_BAND_ACCEPTED_DATASET_REF } from '@markorbit/contracts/brain-cn-duration-band-classification';
import { ManagedDatabase } from '@markorbit/persistence';
import {
  PostgresMatterIntelligenceRepository,
  type MarkRegMatterIntelligenceObservationV1
} from '../src/matter-intelligence.js';
import {
  MatterIntelligenceReviewError,
  MatterIntelligenceReviewService,
  PostgresMatterIntelligenceReviewRepository
} from '../src/matter-intelligence-review.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url =
  process.env.MARKREG_MATTER_INTELLIGENCE_TEST_DATABASE_URL ??
  process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_MATTER_INTELLIGENCE_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MARKREG_MATTER_INTELLIGENCE_TEST_DATABASE_URL or MARKREG_TEST_DATABASE_URL is required when MARKREG_MATTER_INTELLIGENCE_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '33333333-3333-4333-8333-333333333333';
const otherWorkspaceId = '44444444-4444-4444-8444-444444444444';
const formalMatterId = 'formal-matter_phase6-review';
const observationId = 'matter-intelligence-observation_phase6-review';
const evidenceRefs = [
  'brain-method-package:package_cn-duration@1',
  'brain-method:method_cn-duration',
  'brain-method-version:method-version_cn-duration',
  'brain-method-evaluation:evaluation_cn-duration',
  `research-dataset:${CN_DURATION_BAND_ACCEPTED_DATASET_REF}:accepted`
];

function principal(
  workspace = workspaceId,
  permissions: WorkspacePrincipal['permissions'] = [
    'workspace:read',
    'matter:read',
    'matter:manage'
  ]
): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_phase6-review',
    userId: 'user_phase6-reviewer',
    workspaceId: workspace,
    membershipId: 'membership_phase6-reviewer',
    role: 'MATTER_MANAGER',
    permissions,
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
    capabilityRequestId: 'capreq_phase6-review',
    capabilityInvocationId: 'capability-invocation_phase6-review',
    capabilityOutcomeId: 'capability-outcome_phase6-review',
    capabilityReturnId: 'capability-return_phase6-review',
    sessionReceiptId: 'session-receipt_phase6-review',
    implementation: {
      id: 'implementation-profile_cn-duration-band-classification-v1',
      version: 1,
      implementationKey: 'brain-method-package-runtime.cn-duration-band-classification.v1'
    },
    correlationId: 'correlation-phase6-review',
    capabilityCorrelationId: 'capability-correlation-phase6-review',
    methodPackageRef: evidenceRefs[0]!,
    methodRef: evidenceRefs[1]!,
    methodVersionRef: evidenceRefs[2]!,
    evaluationRef: evidenceRefs[3]!,
    researchDatasetRef: evidenceRefs[4]!,
    evidenceRefs,
    evidenceFingerprintSha256: 'b'.repeat(64),
    inputFingerprintSha256: 'c'.repeat(64),
    outputFingerprintSha256: 'd'.repeat(64),
    recordedByPrincipalId: 'user_phase5-producer',
    recordedAt: '2026-08-30T02:00:00.000Z'
  };
}

suite('PostgreSQL MarkReg Matter Intelligence Review source authority', () => {
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
        'confirmation_phase6-review',
        'matter-draft_phase6-review',
        'quote_phase6-review',
        'quote-v1',
        JSON.stringify({ schemaVersion: 1, source: 'phase6-review-test' }),
        'a'.repeat(64),
        'user_phase6-review',
        '2026-08-30T01:00:00.000Z'
      ]
    );
    const intelligence = new PostgresMatterIntelligenceRepository(database, pool);
    await intelligence.record({
      observation: observation(),
      idempotencyKey: 'phase6-seed-observation',
      requestFingerprintSha256: '1'.repeat(64),
      correlationId: 'phase6-seed-correlation',
      capabilityReplayed: false
    });
  });

  afterAll(() => database.close());

  function reviewService() {
    return new MatterIntelligenceReviewService(
      new PostgresMatterIntelligenceReviewRepository(database, database.getPool()),
      () => '2026-08-30T03:00:00.000Z',
      () => 'matter-intelligence-review_phase6-one'
    );
  }

  function command() {
    return {
      workspaceId,
      formalMatterId,
      observationId,
      outcome: 'OVERRIDDEN' as const,
      reasonCode: 'METHOD_OUTPUT_INCORRECT' as const,
      rationale: 'Independent review found the deterministic band output incorrect.',
      principal: principal(),
      idempotencyKey: 'phase6-review-key-one',
      correlationId: 'phase6-review-correlation-one'
    };
  }

  it('persists one product-owned review and resolves a compact exact source assertion', async () => {
    const service = reviewService();
    const created = await service.record(command());
    expect(created).toMatchObject({ replayed: false, semanticDuplicate: false });
    expect(created.review).toMatchObject({
      matterIntelligenceReviewId: 'matter-intelligence-review_phase6-one',
      version: 1,
      outcome: 'OVERRIDDEN',
      reasonCode: 'METHOD_OUTPUT_INCORRECT',
      reviewerPrincipalId: 'user_phase6-reviewer',
      reviewerMembershipId: 'membership_phase6-reviewer'
    });

    const source = await service.resolveSource(
      workspaceId,
      created.review.matterIntelligenceReviewId,
      1
    );
    expect(source.source).toMatchObject({
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceVersion: 1,
      sourceFingerprintSha256: created.review.reviewFingerprintSha256
    });
    expect(source.reviewedObservation.id).toBe(observationId);
    expect(source.production).toMatchObject({
      capability: {
        id: 'interpretation.cn-completed-duration-historical-band',
        version: '1.0.0',
        returnId: 'capability-return_phase6-review',
        sessionReceiptId: 'session-receipt_phase6-review'
      },
      methodPackageRef: evidenceRefs[0],
      methodRef: evidenceRefs[1],
      methodVersionRef: evidenceRefs[2],
      evaluationRef: evidenceRefs[3],
      researchDatasetRef: evidenceRefs[4],
      inputFingerprintSha256: 'c'.repeat(64),
      outputFingerprintSha256: 'd'.repeat(64),
      evidenceFingerprintSha256: 'b'.repeat(64)
    });
    expect(source).not.toHaveProperty('customer');
    expect(source).not.toHaveProperty('order');
    expect(source.formalMatter).toEqual({ id: formalMatterId, version: 1 });
  });

  it('replays exact commands, semantically dedupes an identical second key and rejects conflicting review truth', async () => {
    const service = reviewService();
    const first = await service.record(command());
    const replay = await service.record(command());
    expect(replay.replayed).toBe(true);
    expect(replay.review).toEqual(first.review);

    const semantic = await service.record({
      ...command(),
      idempotencyKey: 'phase6-review-key-two',
      correlationId: 'phase6-review-correlation-two'
    });
    expect(semantic.semanticDuplicate).toBe(true);
    expect(semantic.review).toEqual(first.review);

    await expect(
      service.record({
        ...command(),
        idempotencyKey: 'phase6-review-key-three',
        outcome: 'INCONCLUSIVE',
        reasonCode: 'INSUFFICIENT_EVIDENCE',
        rationale: undefined,
        correlationId: 'phase6-review-correlation-three'
      })
    ).rejects.toMatchObject({
      code: 'REVIEW_ALREADY_EXISTS'
    } satisfies Partial<MatterIntelligenceReviewError>);

    await expect(
      service.record({
        ...command(),
        outcome: 'OVERRIDDEN',
        reasonCode: 'INPUT_FACT_INCORRECT'
      })
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    } satisfies Partial<MatterIntelligenceReviewError>);

    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*)::int FROM markreg_matter_intelligence_reviews) AS reviews,(SELECT count(*)::int FROM markreg_matter_intelligence_review_commands) AS commands'
      );
    expect(counts.rows[0]).toMatchObject({ reviews: 1, commands: 2 });
  });

  it('enforces taxonomy, workspace ownership and reviewer permissions before persistence', async () => {
    const service = reviewService();
    await expect(
      service.record({
        ...command(),
        outcome: 'CONFIRMED_AS_PRESENTED',
        reasonCode: 'METHOD_OUTPUT_INCORRECT'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' } satisfies Partial<MatterIntelligenceReviewError>);

    await expect(
      service.record({ ...command(), workspaceId: otherWorkspaceId })
    ).rejects.toMatchObject({
      code: 'WORKSPACE_MISMATCH'
    } satisfies Partial<MatterIntelligenceReviewError>);

    await expect(
      service.record({
        ...command(),
        principal: principal(workspaceId, ['workspace:read', 'matter:read'])
      })
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED'
    } satisfies Partial<MatterIntelligenceReviewError>);

    await expect(
      service.record({
        ...command(),
        observationId: 'matter-intelligence-observation_missing'
      })
    ).rejects.toMatchObject({
      code: 'OBSERVATION_NOT_FOUND'
    } satisfies Partial<MatterIntelligenceReviewError>);

    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*)::int FROM markreg_matter_intelligence_reviews) AS reviews,(SELECT count(*)::int FROM markreg_matter_intelligence_review_commands) AS commands'
      );
    expect(counts.rows[0]).toMatchObject({ reviews: 0, commands: 0 });
  });

  it('keeps review evidence append-only and leaves neighboring product/capability state untouched', async () => {
    const service = reviewService();
    const created = await service.record(command());
    await expect(
      database
        .getPool()
        .query(
          'UPDATE markreg_matter_intelligence_reviews SET rationale=$1 WHERE matter_intelligence_review_id=$2',
          ['mutated', created.review.matterIntelligenceReviewId]
        )
    ).rejects.toThrow(/append-only/i);
    await expect(
      database
        .getPool()
        .query('DELETE FROM markreg_matter_intelligence_review_commands WHERE workspace_id=$1', [
          workspaceId
        ])
    ).rejects.toThrow(/append-only/i);

    const matter = await database
      .getPool()
      .query('SELECT status,version FROM formal_matters WHERE formal_matter_id=$1', [formalMatterId]);
    expect(matter.rows[0]).toMatchObject({ status: 'OPEN', version: 1 });
    const neighbors = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*)::int FROM markreg_recommended_actions) AS recommended_actions,(SELECT count(*)::int FROM markreg_formal_trademark_service_opportunities) AS formal_opportunities'
      );
    expect(neighbors.rows[0]).toMatchObject({ recommended_actions: 0, formal_opportunities: 0 });
  });

  it('fails exact source resolution for the wrong workspace/version without leaking review data', async () => {
    const service = reviewService();
    const created = await service.record(command());
    await expect(
      service.resolveSource(otherWorkspaceId, created.review.matterIntelligenceReviewId, 1)
    ).rejects.toMatchObject({ code: 'REVIEW_NOT_FOUND' });
    await expect(
      service.resolveSource(workspaceId, created.review.matterIntelligenceReviewId, 2)
    ).rejects.toMatchObject({ code: 'REVIEW_NOT_FOUND' });
  });
});
