import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FormalMatterId } from '@markorbit/contracts';
import type {
  ReviewedSourceAdmissionEnvelope,
  ReviewedSourceAdmissionId
} from '@markorbit/contracts/evidence-lifecycle';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresFormalMatterRepository } from '../src/formal-matter.js';
import {
  LifecycleProjectionService,
  PostgresLifecycleProjectionRepository,
  type ReviewedSourceAdmissionReader
} from '../src/lifecycle-projection.js';
import {
  PostgresRecommendedActionRepository,
  RECOMMENDED_ACTION_POLICY_VERSION,
  RecommendedActionService
} from '../src/recommended-action.js';
import {
  PostgresWorkspaceActionSourceReader,
  WorkspaceActionReadService
} from '../src/workspace-action-read.js';
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
const generatedAt = '2026-09-06T00:00:00.000Z';

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

suite('PostgreSQL Workspace Action Projection V1', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-workspace-action-read-test',
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
        'TRUNCATE markreg_recommended_action_commands,markreg_recommended_action_audit,markreg_recommended_actions,markreg_lifecycle_commands,markreg_lifecycle_views,markreg_lifecycle_events,formal_matters RESTART IDENTITY CASCADE'
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
      reviewDecision: { id: `evidence-review-decision_${suffix}`, version: 1 },
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

  it('reconstructs the same exact current Workspace Action truth after read-side restart', async () => {
    const formalMatterId = await insertMatter('restart');
    const source = admission('restart', formalMatterId);
    const formalMatters = new PostgresFormalMatterRepository(database, database.getPool());
    const lifecycleRepository = new PostgresLifecycleProjectionRepository(
      database,
      database.getPool()
    );
    const lifecycle = new LifecycleProjectionService(
      lifecycleRepository,
      formalMatters,
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
      state: 'CUSTOMER_ACTION_NEEDED',
      eventCode: 'EXAMINATION_CUSTOMER_ACTION_NEEDED',
      customerSafeLabel: 'Customer action needed',
      customerSafeSummary: 'Reviewed evidence requires customer attention.',
      occurredAt: '2026-09-05T01:03:00.000Z',
      idempotencyKey: 'workspace-action-restart-project',
      correlationId: source.correlationId
    });

    const recommended = new RecommendedActionService(
      new PostgresRecommendedActionRepository(database, database.getPool()),
      lifecycleRepository,
      undefined,
      () => '2026-09-05T01:05:00.000Z',
      () => 'recommended-action_workspace-restart'
    );
    await recommended.regenerate({
      workspaceId,
      formalMatterId,
      expectedLifecycleViewId: projected.currentView.lifecycleViewId,
      expectedLifecycleViewVersion: projected.currentView.version,
      expectedLifecycleViewFingerprintSha256: projected.currentView.lifecycleViewFingerprintSha256,
      policyVersion: RECOMMENDED_ACTION_POLICY_VERSION,
      idempotencyKey: 'workspace-action-restart-recommend',
      correlationId: 'correlation_workspace-action-restart'
    });

    const beforeRestart = await new WorkspaceActionReadService(
      new PostgresWorkspaceActionSourceReader(database.getPool()),
      () => generatedAt
    ).get(workspaceId);
    expect(beforeRestart).toMatchObject({
      schemaVersion: 1,
      workspaceId,
      needsAttention: [
        {
          formalMatter: {
            id: formalMatterId,
            trademark: 'ORBIT',
            applicant: 'Orbit Ltd',
            jurisdiction: 'US'
          },
          currentness: 'CURRENT',
          attentionStatus: 'OPEN',
          lifecycle: {
            id: projected.currentView.lifecycleViewId,
            version: projected.currentView.version,
            officialStatusVerified: false
          },
          recommendedAction: {
            id: 'recommended-action_workspace-restart',
            status: 'OPEN',
            executionAuthorized: false
          },
          examination: {
            status: 'ESTABLISHED',
            eventCode: 'EXAMINATION_CUSTOMER_ACTION_NEEDED',
            deadline: null,
            deadlineStatus: 'UNAVAILABLE',
            officialStatusVerified: false
          },
          officialStatusVerified: false
        }
      ],
      officialStatusVerified: false
    });
    expect(beforeRestart.needsAttention[0]?.recommendedAction).not.toHaveProperty('dueAt');

    const afterRestart = await new WorkspaceActionReadService(
      new PostgresWorkspaceActionSourceReader(database.getPool()),
      () => generatedAt
    ).get(workspaceId);
    expect(afterRestart).toEqual(beforeRestart);

    const workspaceActionTables = await database
      .getPool()
      .query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%workspace_action%'"
      );
    expect(workspaceActionTables.rows).toEqual([]);
  });
});
