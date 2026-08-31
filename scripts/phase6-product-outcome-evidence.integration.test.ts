import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '../packages/contracts/src/auth.js';
import { CN_DURATION_BAND_ACCEPTED_DATASET_REF } from '../packages/contracts/src/brain-cn-duration-band-classification.js';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate
} from '../packages/persistence/src/index.js';
import {
  MethodOutcomeEvidenceAdmissionServiceV1,
  PostgresMethodOutcomeEvidenceAdmissionRepositoryV1
} from '../services/core/src/method-outcome-evidence.js';
import {
  MethodOutcomeReportServiceV1,
  PostgresMethodOutcomeReportReaderV1
} from '../services/core/src/method-outcome-report.js';
import { createRuntime as createCoreRuntime } from '../services/core/src/index.js';
import {
  PostgresMatterIntelligenceRepository,
  type MarkRegMatterIntelligenceObservationV1
} from '../services/markreg/src/matter-intelligence.js';
import { createMatterIntelligenceReviewRoutes } from '../services/markreg/src/matter-intelligence-review-http.js';
import {
  MatterIntelligenceReviewService,
  PostgresMatterIntelligenceReviewRepository
} from '../services/markreg/src/matter-intelligence-review.js';
import {
  HttpCoreMethodOutcomeEvidenceAdmissionClientV1,
  MarkRegMethodOutcomeEvidenceEmitterV1,
  PostgresMarkRegMethodOutcomeEvidenceSourceV1
} from '../services/markreg/src/method-outcome-evidence-emission.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from '../services/markreg/tests/support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'Phase 6 product-integrated acceptance requires MARKREG_TEST_DATABASE_URL when MARKREG_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '77777777-7777-4777-8777-777777777777';
const otherWorkspaceId = '88888888-8888-4888-8888-888888888888';
const formalMatterId = 'formal-matter_phase6-product-integrated' as const;
const observationId = 'matter-intelligence-observation_phase6-product-integrated';
const secret = 'phase6-product-integrated-secret-32-bytes-minimum';
const coreMigrationNamespace = 'phase6_product_integrated_core';
const evidenceRefs = [
  'brain-method-package:package_cn-duration@1',
  'brain-method:method_cn-duration',
  'brain-method-version:method-version_cn-duration',
  'brain-method-evaluation:evaluation_cn-duration',
  `research-dataset:${CN_DURATION_BAND_ACCEPTED_DATASET_REF}:accepted`
];

function principal(): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_phase6-product-integrated',
    userId: 'principal_phase6-product-integrated',
    workspaceId,
    membershipId: 'membership_phase6-product-integrated',
    role: 'MATTER_MANAGER',
    permissions: ['workspace:read', 'matter:read', 'matter:manage'],
    sessionExpiresAt: '2026-09-01T00:00:00.000Z'
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
    capabilityRequestId: 'capreq_phase6-product-integrated',
    capabilityInvocationId: 'capability-invocation_phase6-product-integrated',
    capabilityOutcomeId: 'capability-outcome_phase6-product-integrated',
    capabilityReturnId: 'capability-return_phase6-product-integrated',
    sessionReceiptId: 'session-receipt_phase6-product-integrated',
    implementation: {
      id: 'implementation-profile_cn-duration-band-classification-v1',
      version: 1,
      implementationKey: 'brain-method-package-runtime.cn-duration-band-classification.v1'
    },
    correlationId: 'correlation-phase6-product-integrated-observation',
    capabilityCorrelationId: 'capability-correlation-phase6-product-integrated-observation',
    methodPackageRef: evidenceRefs[0]!,
    methodRef: evidenceRefs[1]!,
    methodVersionRef: evidenceRefs[2]!,
    evaluationRef: evidenceRefs[3]!,
    researchDatasetRef: evidenceRefs[4]!,
    evidenceRefs,
    evidenceFingerprintSha256: 'b'.repeat(64),
    inputFingerprintSha256: 'c'.repeat(64),
    outputFingerprintSha256: 'd'.repeat(64),
    recordedByPrincipalId: 'principal_phase5-product-observation',
    recordedAt: '2026-08-31T00:00:00.000Z'
  };
}

suite('Phase 6 product outcome -> evidence -> report PostgreSQL acceptance', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-phase6-product-integrated-acceptance',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const migrationsDirectory = path.resolve('infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('infrastructure/persistence/migration-owners.json');
  let coreRuntime: ReturnType<typeof createCoreRuntime>;
  let coreUrl: string;

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory,
      migrationOwners
    });
    const coreMigrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/core-service'
    );
    await migrate(database.getPool(), coreMigrationNamespace, coreMigrations);

    const evidenceAdmissions = new MethodOutcomeEvidenceAdmissionServiceV1({
      repository: new PostgresMethodOutcomeEvidenceAdmissionRepositoryV1(database),
      now: () => '2026-08-31T00:20:00.000Z',
      evidenceIdFactory: () => 'phase6-product-integrated'
    });
    const reports = new MethodOutcomeReportServiceV1(
      new PostgresMethodOutcomeReportReaderV1(database)
    );
    coreRuntime = createCoreRuntime({
      port: 0,
      methodOutcomeEvidenceAdmissions: evidenceAdmissions,
      methodOutcomeReports: reports,
      internalServiceSecret: secret
    });
    await coreRuntime.start();
    coreUrl = `http://127.0.0.1:${coreRuntime.listeningPort}`;
  });

  beforeEach(async () => {
    const pool = database.getPool();
    await pool.query(
      'TRUNCATE markreg_matter_intelligence_review_commands,markreg_matter_intelligence_reviews,markreg_matter_intelligence_commands,markreg_matter_intelligence_observations,formal_matters,core_method_outcome_evidence RESTART IDENTITY CASCADE'
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
        'confirmation_phase6-product-integrated',
        'matter-draft_phase6-product-integrated',
        'quote_phase6-product-integrated',
        'quote-v1',
        JSON.stringify({ schemaVersion: 1, source: 'phase6-product-integrated-acceptance' }),
        'a'.repeat(64),
        'principal_phase6-product-integrated',
        '2026-08-31T00:00:00.000Z'
      ]
    );
    const phase5 = new PostgresMatterIntelligenceRepository(database, pool);
    const value = observation();
    await phase5.record({
      observation: value,
      idempotencyKey: 'phase6-product-integrated-observation-key',
      requestFingerprintSha256: '1'.repeat(64),
      correlationId: value.correlationId,
      capabilityReplayed: false
    });
  });

  afterAll(async () => {
    if (coreRuntime) await coreRuntime.stop();
    await database.close();
  });

  function realEmitter() {
    return new MarkRegMethodOutcomeEvidenceEmitterV1(
      new PostgresMarkRegMethodOutcomeEvidenceSourceV1(database.getPool()),
      new HttpCoreMethodOutcomeEvidenceAdmissionClientV1(coreUrl, secret)
    );
  }

  function reviewRoute(emitter = realEmitter()) {
    return createMatterIntelligenceReviewRoutes({
      internalServiceSecret: secret,
      service: new MatterIntelligenceReviewService(
        new PostgresMatterIntelligenceReviewRepository(database),
        () => '2026-08-31T00:10:00.000Z'
      ),
      evidenceEmitter: emitter
    })[0]!;
  }

  function request(idempotencyKey = 'phase6-product-integrated-review-key') {
    return {
      method: 'POST' as const,
      path: `/internal/v1/formal-matters/${formalMatterId}/intelligence-observations/${observationId}/reviews`,
      params: { formalMatterId, observationId },
      query: {},
      headers: {
        'x-markorbit-internal-authorization': secret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal()),
        'x-markorbit-workspace-id': workspaceId,
        'idempotency-key': idempotencyKey,
        'x-correlation-id': 'phase6-product-integrated-review-correlation'
      },
      body: { outcome: 'OVERRIDDEN', reason: 'METHOD_ERROR' }
    };
  }

  async function report() {
    return new MethodOutcomeReportServiceV1(
      new PostgresMethodOutcomeReportReaderV1(database)
    ).report({
      workspaceId,
      query: {
        schemaVersion: 1,
        workspaceId,
        methodPackageRef: evidenceRefs[0],
        methodVersionRef: evidenceRefs[2]
      }
    });
  }

  it('turns one authoritative MarkReg METHOD_ERROR review into exactly one attributable Core signal and replay does not distort it', async () => {
    const route = reviewRoute();
    const first = await route.handle(request());
    expect(first.status).toBe(201);

    const firstReport = await report();
    expect(firstReport).toMatchObject({
      admittedReviews: 1,
      confirmed: { count: 0, rate: 0 },
      overridden: { count: 1, rate: 1 },
      methodError: { count: 1, rate: 1 },
      inputDataError: { count: 0, rate: 0 },
      applicabilityError: { count: 0, rate: 0 },
      productUserPreference: { count: 0, rate: 0 },
      inconclusive: { count: 0, rate: 0 }
    });
    expect(firstReport.sampleEvidenceRefs).toHaveLength(1);
    expect(firstReport.sampleEvidenceRefs[0]).toMatchObject({
      outcome: 'OVERRIDDEN',
      reason: 'METHOD_ERROR',
      reviewVersion: 1
    });

    const replay = await route.handle(request());
    expect(replay.status).toBe(200);
    const replayedReport = await report();
    expect(replayedReport).toEqual(firstReport);

    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*)::int FROM markreg_matter_intelligence_reviews) AS reviews,(SELECT count(*)::int FROM core_method_outcome_evidence) AS evidence'
      );
    expect(counts.rows[0]).toEqual({ reviews: 1, evidence: 1 });
  });

  it('persists product truth when Core is unavailable and safely completes admission on exact retry', async () => {
    const unavailable = new MarkRegMethodOutcomeEvidenceEmitterV1(
      new PostgresMarkRegMethodOutcomeEvidenceSourceV1(database.getPool()),
      new HttpCoreMethodOutcomeEvidenceAdmissionClientV1(coreUrl, secret, async () => {
        throw new Error('simulated Core outage');
      })
    );

    await expect(reviewRoute(unavailable).handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'OUTCOME_EVIDENCE_UNAVAILABLE',
      retryable: true
    });
    const afterFailure = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*)::int FROM markreg_matter_intelligence_reviews) AS reviews,(SELECT count(*)::int FROM core_method_outcome_evidence) AS evidence'
      );
    expect(afterFailure.rows[0]).toEqual({ reviews: 1, evidence: 0 });

    const retry = await reviewRoute().handle(request());
    expect(retry.status).toBe(200);
    const accepted = await report();
    expect(accepted).toMatchObject({
      admittedReviews: 1,
      overridden: { count: 1, rate: 1 },
      methodError: { count: 1, rate: 1 }
    });
  });

  it('fails closed when review workspace or observation fingerprint cannot resolve the exact product source', async () => {
    const reviews = new MatterIntelligenceReviewService(
      new PostgresMatterIntelligenceReviewRepository(database),
      () => '2026-08-31T00:10:00.000Z'
    );
    const disposition = await reviews.recordReview({
      workspaceId,
      formalMatterId,
      matterIntelligenceObservationId: observationId,
      outcome: 'OVERRIDDEN',
      reason: 'METHOD_ERROR',
      principal: principal(),
      idempotencyKey: 'phase6-product-integrated-source-check',
      correlationId: 'phase6-product-integrated-source-check-correlation'
    });
    const source = new PostgresMarkRegMethodOutcomeEvidenceSourceV1(database.getPool());

    await expect(
      source.build({ ...disposition.review, workspaceId: otherWorkspaceId })
    ).rejects.toMatchObject({ code: 'OUTCOME_EVIDENCE_REJECTED' });
    await expect(
      source.build({ ...disposition.review, observationFingerprintSha256: 'f'.repeat(64) })
    ).rejects.toMatchObject({ code: 'OUTCOME_EVIDENCE_REJECTED' });
  });
});
