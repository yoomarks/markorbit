import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase } from '@markorbit/persistence';
import type { FormalMatterId } from '@markorbit/contracts';
import type {
  ReviewedSourceAdmissionEnvelope,
  ReviewedSourceAdmissionId
} from '@markorbit/contracts/evidence-lifecycle';
import { ExaminationStageReadService } from '../src/examination-stage-read.js';
import { PostgresFormalMatterRepository } from '../src/formal-matter.js';
import {
  LifecycleProjectionService,
  PostgresLifecycleProjectionRepository,
  type ReviewedSourceAdmissionReader
} from '../src/lifecycle-projection.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required when MARKREG_POSTGRES_TEST_REQUIRED=1.');
const suite = url ? describe : describe.skip;
const workspaceId = '22222222-2222-4222-8222-222222222222';
const sha = (character: string) => character.repeat(64);

class FixtureAdmissionReader implements ReviewedSourceAdmissionReader {
  constructor(private readonly admission: ReviewedSourceAdmissionEnvelope) {}

  findReviewedSourceAdmission(reviewedSourceAdmissionId: ReviewedSourceAdmissionId) {
    return Promise.resolve(
      reviewedSourceAdmissionId === this.admission.reviewedSourceAdmissionId
        ? structuredClone(this.admission)
        : undefined
    );
  }
}

suite('PostgreSQL Examination Stage V1 read projection', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-examination-stage-read-test',
    poolMaximum: 6,
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

  beforeEach(() =>
    database
      .getPool()
      .query(
        'TRUNCATE markreg_lifecycle_commands,markreg_lifecycle_views,markreg_lifecycle_events,formal_matters RESTART IDENTITY CASCADE'
      )
  );

  afterAll(() => database.close());

  async function insertMatter(suffix: string) {
    const formalMatterId: FormalMatterId = `formal-matter_${suffix}`;
    await database
      .getPool()
      .query(
        'INSERT INTO formal_matters (formal_matter_id,workspace_id,kind,status,version,source_customer_confirmation_id,source_customer_confirmation_version,source_matter_draft_id,source_matter_draft_version,source_quote_id,source_quote_version,source_snapshot,snapshot_schema_version,snapshot_sha256,created_by_user_id,created_at,updated_at) VALUES ($1,$2,$3,$4,1,$5,1,$6,1,$7,$8,$9::jsonb,1,$10,$11,$12,$12)',
        [
          formalMatterId,
          workspaceId,
          'TRADEMARK_REGISTRATION',
          'OPEN',
          `confirmation_${suffix}`,
          `matter-draft_${suffix}`,
          `quote_${suffix}`,
          'quote-v1',
          JSON.stringify({
            preparation: {
              applicantName: 'Orbit Ltd',
              trademark: 'ORBIT',
              targetJurisdiction: 'US',
              classes: [9]
            }
          }),
          sha('f'),
          `user_${suffix}`,
          '2026-09-05T01:00:00.000Z'
        ]
      );
    return formalMatterId;
  }

  function admission(
    suffix: string,
    formalMatterId: FormalMatterId
  ): ReviewedSourceAdmissionEnvelope {
    const correlationId = `correlation_${suffix}` as never;
    return {
      schemaVersion: 1,
      reviewedSourceAdmissionId: `reviewed-source-admission_${suffix}`,
      workspaceId,
      version: 1,
      formalMatter: { id: formalMatterId, version: 1 },
      reviewDecision: {
        id: `evidence-review-decision_${suffix}`,
        version: 1
      },
      reviewDecisionFingerprintSha256: sha('b'),
      evidenceSource: {
        schemaVersion: 1,
        workspaceId,
        evidenceReceipt: { id: `evidence-receipt_${suffix}`, version: 1 },
        evidenceReceiptFingerprintSha256: sha('c'),
        evidenceHandoffId: `evidence-handoff_${suffix}`,
        providerReturn: { id: `provider-return_${suffix}`, version: 1 },
        providerReturnFingerprintSha256: sha('d'),
        providerId: `provider_${suffix}`,
        correlationId,
        capturedAt: '2026-09-05T01:01:00.000Z'
      },
      admittedEvidenceReferences: [`provider-evidence://${suffix}`],
      admissionFingerprintSha256: sha('a'),
      admittedAt: '2026-09-05T01:02:00.000Z',
      correlationId
    };
  }

  it('reconstructs the exact Examination projection after read-side repository restart with no Examination persistence', async () => {
    const formalMatterId = await insertMatter('restart');
    const source = admission('restart', formalMatterId);
    const lifecycleRepository = new PostgresLifecycleProjectionRepository(
      database,
      database.getPool()
    );
    const formalMatterRepository = new PostgresFormalMatterRepository(database, database.getPool());
    const lifecycle = new LifecycleProjectionService(
      lifecycleRepository,
      formalMatterRepository,
      new FixtureAdmissionReader(source),
      () => '2026-09-05T01:04:00.000Z'
    );

    const projected = await lifecycle.project({
      workspaceId,
      reviewedSourceAdmissionId: source.reviewedSourceAdmissionId,
      expectedReviewedSourceAdmissionVersion: source.version,
      expectedAdmissionFingerprintSha256: source.admissionFingerprintSha256,
      formalMatterId,
      expectedFormalMatterVersion: 1,
      state: 'REVIEWED_PROVIDER_EVIDENCE',
      eventCode: 'EXAMINATION_REVIEWED_EVIDENCE',
      customerSafeLabel: 'Examination evidence reviewed',
      customerSafeSummary: 'Reviewed evidence is available for internal Examination workflow.',
      occurredAt: '2026-09-05T01:03:00.000Z',
      idempotencyKey: 'examination-restart-project',
      correlationId: source.correlationId
    });

    const firstReader = new ExaminationStageReadService(formalMatterRepository, lifecycleRepository);
    const beforeRestart = await firstReader.get(workspaceId, formalMatterId);
    expect(beforeRestart).toMatchObject({
      status: 'ESTABLISHED',
      current: {
        eventCode: 'EXAMINATION_REVIEWED_EVIDENCE',
        lifecycleEvent: {
          id: projected.event.lifecycleEventId,
          version: projected.event.version,
          fingerprintSha256: projected.event.lifecycleEventFingerprintSha256
        },
        lifecycleView: {
          id: projected.currentView.lifecycleViewId,
          version: projected.currentView.version,
          fingerprintSha256: projected.currentView.lifecycleViewFingerprintSha256
        },
        source: {
          reviewedSourceAdmission: {
            id: source.reviewedSourceAdmissionId,
            version: source.version,
            fingerprintSha256: source.admissionFingerprintSha256
          },
          evidenceReviewDecision: source.reviewDecision,
          evidenceReceipt: source.evidenceSource.evidenceReceipt,
          providerReturn: source.evidenceSource.providerReturn
        },
        officialStatusVerified: false
      },
      deadline: null,
      officialStatusVerified: false
    });

    const restartedLifecycleRepository = new PostgresLifecycleProjectionRepository(
      database,
      database.getPool()
    );
    const restartedFormalMatterRepository = new PostgresFormalMatterRepository(
      database,
      database.getPool()
    );
    const afterRestart = await new ExaminationStageReadService(
      restartedFormalMatterRepository,
      restartedLifecycleRepository
    ).get(workspaceId, formalMatterId);

    expect(afterRestart).toEqual(beforeRestart);
    const examinationTables = await database
      .getPool()
      .query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%examination%'"
      );
    expect(examinationTables.rows).toEqual([]);
  });
});
