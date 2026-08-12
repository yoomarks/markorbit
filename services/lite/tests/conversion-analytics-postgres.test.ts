import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresProductConversionAnalyticsStore } from '../src/conversion-analytics.js';

const url = process.env.LITE_CONVERSION_ANALYTICS_TEST_DATABASE_URL;
const required = process.env.LITE_CONVERSION_ANALYTICS_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_CONVERSION_ANALYTICS_TEST_DATABASE_URL is required when LITE_CONVERSION_ANALYTICS_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '31313131-3131-4313-8313-313131313131';
const otherWorkspaceId = '32323232-3232-4323-8323-323232323232';
const emptyWorkspaceId = '33333333-3333-4333-8333-333333333333';
const fingerprint = 'a'.repeat(64);
const timestamp = '2026-08-12T07:00:00.000Z';

suite('PostgreSQL bounded Product conversion analytics', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-conversion-analytics-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_conversion_analytics_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const liteMigrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_conversion_analytics_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Analytics Primary','analytics-primary'),
       ($2,'Analytics Other','analytics-other'),
       ($3,'Analytics Empty','analytics-empty')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId, emptyWorkspaceId]
    );
  });

  beforeEach(async () => {
    await database.getPool().query(
      `TRUNCATE
        lite_product_loop_feedback_commands,
        lite_product_loop_use_feedback,
        lite_prepared_action_commands,
        lite_prepared_action_handoff_results,
        lite_prepared_action_confirmations,
        lite_prepared_actions,
        lite_candidate_qualification_commands,
        lite_opportunity_qualification_decisions,
        lite_opportunity_candidates,
        lite_content_preparation_commands,
        lite_publish_packages,
        lite_content_review_decisions,
        lite_content_drafts,
        lite_content_opportunities,
        lite_today_recommendations
       CASCADE`
    );
  });

  afterAll(() => database.close());

  async function seedWorkspace(targetWorkspaceId: string, prefix: string) {
    const pool = database.getPool();
    for (let index = 1; index <= 3; index += 1) {
      await pool.query(
        'INSERT INTO lite_today_recommendations (workspace_id,today_recommendation_id,version,recommendation_fingerprint_sha256,document_json,created_at,updated_at) VALUES ($1,$2,1,$3,$4::jsonb,$5,$5)',
        [
          targetWorkspaceId,
          `today-recommendation_${prefix}-content-${index}`,
          fingerprint,
          '{}',
          timestamp
        ]
      );
      await pool.query(
        'INSERT INTO lite_content_opportunities (workspace_id,content_opportunity_id,version,source_recommendation_id,source_recommendation_version,content_opportunity_fingerprint_sha256,document_json,created_at,updated_at) VALUES ($1,$2,1,$3,1,$4,$5::jsonb,$6,$6)',
        [
          targetWorkspaceId,
          `content-opportunity_${prefix}-${index}`,
          `today-recommendation_${prefix}-content-${index}`,
          fingerprint,
          '{}',
          timestamp
        ]
      );
    }

    for (let index = 1; index <= 2; index += 1) {
      await pool.query(
        'INSERT INTO lite_content_drafts (workspace_id,content_draft_id,version,content_opportunity_id,content_opportunity_version,status,content_draft_fingerprint_sha256,document_json,created_at,updated_at) VALUES ($1,$2,1,$3,1,$4,$5,$6::jsonb,$7,$7)',
        [
          targetWorkspaceId,
          `content-draft_${prefix}-${index}`,
          `content-opportunity_${prefix}-${index}`,
          index === 1 ? 'READY_FOR_HUMAN_REVIEW' : 'DRAFT',
          fingerprint,
          '{}',
          timestamp
        ]
      );
    }

    await pool.query(
      'INSERT INTO lite_content_review_decisions (workspace_id,content_review_decision_id,version,content_draft_id,content_draft_version,outcome,document_json,reviewed_at) VALUES ($1,$2,1,$3,1,$4,$5::jsonb,$6)',
      [
        targetWorkspaceId,
        `content-review-decision_${prefix}-1`,
        `content-draft_${prefix}-1`,
        'APPROVED_FOR_PUBLISH_PACKAGE',
        '{}',
        timestamp
      ]
    );
    await pool.query(
      'INSERT INTO lite_publish_packages (workspace_id,publish_package_id,version,content_draft_id,content_draft_version,content_review_decision_id,content_review_decision_version,publish_package_fingerprint_sha256,document_json,created_at) VALUES ($1,$2,1,$3,1,$4,1,$5,$6::jsonb,$7)',
      [
        targetWorkspaceId,
        `publish-package_${prefix}-1`,
        `content-draft_${prefix}-1`,
        `content-review-decision_${prefix}-1`,
        fingerprint,
        '{}',
        timestamp
      ]
    );
    await pool.query(
      'INSERT INTO lite_product_loop_use_feedback (workspace_id,product_loop_feedback_id,version,publish_package_id,publish_package_version,expected_publish_package_fingerprint_sha256,outcome,external_reference,recorded_by_principal_id,document_json,recorded_at) VALUES ($1,$2,1,$3,1,$4,$5,NULL,$6,$7::jsonb,$8)',
      [
        targetWorkspaceId,
        `product-loop-feedback_${prefix}-1`,
        `publish-package_${prefix}-1`,
        fingerprint,
        'USER_REPORTED_USED',
        'user_analytics-test',
        '{}',
        timestamp
      ]
    );

    for (let index = 1; index <= 3; index += 1) {
      await pool.query(
        'INSERT INTO lite_opportunity_candidates (workspace_id,opportunity_candidate_id,version,customer_id,status,opportunity_candidate_fingerprint_sha256,document_json,created_at,updated_at) VALUES ($1,$2,1,NULL,$3,$4,$5::jsonb,$6,$6)',
        [
          targetWorkspaceId,
          `opportunity-candidate_${prefix}-${index}`,
          index <= 2 ? 'DISPOSITIONED' : 'OPEN',
          fingerprint,
          '{}',
          timestamp
        ]
      );
    }

    for (let index = 1; index <= 2; index += 1) {
      await pool.query(
        'INSERT INTO lite_opportunity_qualification_decisions (workspace_id,opportunity_qualification_decision_id,version,opportunity_candidate_id,opportunity_candidate_version,outcome,decided_by_principal_id,expected_candidate_fingerprint_sha256,document_json,decided_at) VALUES ($1,$2,1,$3,1,$4,$5,$6,$7::jsonb,$8)',
        [
          targetWorkspaceId,
          `opportunity-qualification_${prefix}-${index}`,
          `opportunity-candidate_${prefix}-${index}`,
          index === 1 ? 'QUALIFIED_FOR_MARKREG' : 'REJECTED',
          'user_analytics-test',
          fingerprint,
          '{}',
          timestamp
        ]
      );
    }

    await pool.query(
      'INSERT INTO lite_today_recommendations (workspace_id,today_recommendation_id,version,recommendation_fingerprint_sha256,document_json,created_at,updated_at) VALUES ($1,$2,1,$3,$4::jsonb,$5,$5)',
      [targetWorkspaceId, `today-recommendation_${prefix}-formal`, fingerprint, '{}', timestamp]
    );
    const plan = {
      kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      candidate: { id: `opportunity-candidate_${prefix}-1`, version: 1 },
      qualificationDecision: { id: `opportunity-qualification_${prefix}-1`, version: 1 }
    };
    await pool.query(
      'INSERT INTO lite_prepared_actions (workspace_id,prepared_action_id,version,recommendation_id,recommendation_version,recommendation_fingerprint_sha256,kind,handoff_target,prepared_action_fingerprint_sha256,plan_json,document_json,created_at,updated_at) VALUES ($1,$2,1,$3,1,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$10)',
      [
        targetWorkspaceId,
        `prepared-action_${prefix}-formal`,
        `today-recommendation_${prefix}-formal`,
        fingerprint,
        'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
        'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
        fingerprint,
        JSON.stringify(plan),
        '{}',
        timestamp
      ]
    );
    await pool.query(
      'INSERT INTO lite_prepared_action_handoff_results (workspace_id,prepared_action_id,prepared_action_version,handoff_target,owner,owner_record_id,owner_record_version,document_json,completed_at) VALUES ($1,$2,1,$3,$4,$5,$6,$7::jsonb,$8)',
      [
        targetWorkspaceId,
        `prepared-action_${prefix}-formal`,
        'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
        'MARKREG',
        `trademark-service-opportunity_${prefix}-1`,
        '1',
        '{}',
        timestamp
      ]
    );
  }

  it('derives bounded Workspace funnels from Lite-owned durable facts without cross-owner SQL', async () => {
    await seedWorkspace(workspaceId, 'primary');
    await seedWorkspace(otherWorkspaceId, 'other');
    const store = new PostgresProductConversionAnalyticsStore(
      database.getPool(),
      () => '2026-08-12T07:30:00.000Z'
    );

    const snapshot = await store.snapshot(workspaceId);
    expect(snapshot.workspaceId).toBe(workspaceId);
    expect(snapshot.content).toMatchObject({
      contentOpportunities: 3,
      draftPrepared: 2,
      humanReviewRecorded: 1,
      publishPackagesPrepared: 1,
      userReportedUseFeedback: 1
    });
    expect(snapshot.content.rates.opportunityToDraft).toEqual({
      numerator: 2,
      denominator: 3,
      rate: 0.666667
    });
    expect(snapshot.content.rates.draftToHumanReview.rate).toBe(0.5);
    expect(snapshot.opportunity).toMatchObject({
      opportunityCandidates: 3,
      qualificationDecisions: 2,
      qualifiedForMarkReg: 1,
      formalOpportunityHandoffResults: 1
    });
    expect(snapshot.opportunity.rates.candidateToQualification.rate).toBe(0.666667);
    expect(snapshot.opportunity.rates.qualificationToQualified.rate).toBe(0.5);
    expect(snapshot.opportunity.rates.qualifiedToFormalOpportunityHandoff.rate).toBe(1);
    expect(snapshot.crossOwnerEvidence).toEqual({
      evidenceOwner: 'LITE',
      downstreamOwner: 'MARKREG',
      sourceKind: 'PREPARED_ACTION_HANDOFF_RESULT',
      directMarkRegQueryPerformed: false
    });
    expect(snapshot.observationalOnly).toBe(true);
    expect(snapshot.mutatesBusinessState).toBe(false);
    expect(snapshot.userReportedExternalUseVerified).toBe(false);
    expect(Object.values(snapshot.authority).every((value) => value === false)).toBe(true);
  });

  it('returns zero counts and null rates for an empty Workspace', async () => {
    const snapshot = await new PostgresProductConversionAnalyticsStore(database.getPool()).snapshot(
      emptyWorkspaceId
    );
    expect(snapshot.content.contentOpportunities).toBe(0);
    expect(snapshot.content.rates.opportunityToDraft).toEqual({
      numerator: 0,
      denominator: 0,
      rate: null
    });
    expect(snapshot.opportunity.opportunityCandidates).toBe(0);
    expect(snapshot.opportunity.rates.candidateToQualification.rate).toBeNull();
  });
});
