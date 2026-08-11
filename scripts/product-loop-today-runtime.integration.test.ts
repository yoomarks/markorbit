import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '../packages/contracts/dist/index.js';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate
} from '../packages/persistence/dist/index.js';
import {
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from '../services/lite/src/content-preparation.js';
import { PostgresProductLoopFeedbackStore } from '../services/lite/src/feedback.js';
import {
  PostgresPreparedActionStore,
  PreparedActionJourneyService,
  handoffResult,
  type PreparedActionHandoffAuthority
} from '../services/lite/src/prepared-action.js';
import { createLiteProductLoopRoutes } from '../services/lite/src/http.js';
import { PostgresLiteCandidateQualificationStore } from '../services/lite/src/candidate-qualification.js';
import { createServiceRuntime } from '../packages/service-kit/dist/index.js';

const url = process.env.LITE_TODAY_TEST_DATABASE_URL;
const required = process.env.LITE_TODAY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('LITE_TODAY_TEST_DATABASE_URL is required for WP-05 HTTP integration.');
const suite = url ? describe : describe.skip;
const secret = 'wp05-internal-service-key-0123456789';
const workspaceId = '27272727-2727-4272-8272-272727272727';
const otherWorkspaceId = '28282828-2828-4282-8282-282828282828';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_wp05',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_wp05',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:read', 'matter:create', 'matter:manage']
};
const sourceFingerprint = createHash('sha256').update('wp05-http-source').digest('hex');

suite('WP-05 authenticated Lite HTTP integration', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'wp05-http-integration',
    poolMaximum: 8,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_today_test'
  });
  const migrationsDirectory = path.resolve('infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('infrastructure/persistence/migration-owners.json');
  const sourceAuthority: ProductLoopSourceAuthority = {
    resolve() {
      return Promise.resolve({
        schemaVersion: 1,
        owner: 'KNOWLEDGE',
        kind: 'KNOWLEDGE_READY_PACKAGE',
        sourceId: 'rdp_wp05-http',
        sourceVersion: 'v1',
        sourceFingerprintSha256: sourceFingerprint,
        observedAt: '2026-08-11T10:30:00.000Z'
      });
    }
  };
  let runtime: ReturnType<typeof createServiceRuntime>;
  let base = '';

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    await migrate(
      database.getPool(),
      'lite_today_test',
      await loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/lite-service')
    );
    await database.getPool().query(
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES
       ($1,'WP05 HTTP','wp05-http'),($2,'WP05 HTTP Other','wp05-http-other')
       ON CONFLICT(workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
    const content = new PostgresLiteContentPreparationStore(
      database,
      database.getPool(),
      sourceAuthority
    );
    const candidate = new PostgresLiteCandidateQualificationStore(
      database,
      database.getPool(),
      sourceAuthority,
      { isAccessible: async () => true }
    );
    const prepared = new PostgresPreparedActionStore(database, database.getPool());
    const feedback = new PostgresProductLoopFeedbackStore(database, database.getPool());
    const authority: PreparedActionHandoffAuthority = {
      async perform(action, plan, _confirmation, key) {
        if (plan.kind !== 'PREPARE_CONTENT') throw new Error('unexpected handoff plan');
        const opportunity = await content.acceptContentOpportunity({
          workspaceId: action.workspaceId,
          recommendation: {
            id: action.recommendation.id,
            version: Number(action.recommendation.version)
          },
          expectedRecommendationFingerprintSha256: action.recommendationFingerprintSha256,
          title: plan.title,
          rationale: plan.rationale,
          idempotencyKey: key
        });
        return handoffResult({
          preparedAction: action,
          owner: 'LITE',
          ownerRecord: { id: opportunity.contentOpportunityId, version: opportunity.version },
          completedAt: opportunity.updatedAt
        });
      }
    };
    runtime = createServiceRuntime(
      { name: 'wp05-lite-http', port: 0, version: '0.1.0' },
      {
        routes: createLiteProductLoopRoutes({
          internalServiceSecret: secret,
          journeyService: new PreparedActionJourneyService(prepared, authority),
          candidateStore: candidate,
          feedbackStore: feedback
        })
      }
    );
    await runtime.start();
    base = `http://127.0.0.1:${runtime.listeningPort}`;
  });

  beforeEach(async () => {
    await database.getPool().query(
      `TRUNCATE lite_product_loop_feedback_commands,lite_product_loop_use_feedback,
       lite_prepared_action_commands,lite_prepared_action_handoff_results,
       lite_prepared_action_confirmations,lite_prepared_actions,
       lite_candidate_qualification_commands,lite_opportunity_qualification_decisions,
       lite_opportunity_candidates,lite_content_preparation_commands,lite_publish_packages,
       lite_content_review_decisions,lite_content_drafts,lite_content_opportunities,
       lite_today_recommendations CASCADE`
    );
  });

  afterAll(async () => {
    await runtime?.stop();
    await database.close();
  });

  const headers = (workspace = workspaceId, p = principal) => ({
    'content-type': 'application/json',
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(p),
    'x-markorbit-workspace-id': workspace
  });

  async function seedRecommendation() {
    const content = new PostgresLiteContentPreparationStore(
      database,
      database.getPool(),
      sourceAuthority
    );
    return content.createRecommendation({
      workspaceId,
      title: 'Prepare the reviewed trademark update',
      explanation: 'Exact governed Knowledge is ready for a bounded content action.',
      sources: [
        {
          owner: 'KNOWLEDGE',
          kind: 'KNOWLEDGE_READY_PACKAGE',
          sourceId: 'rdp_wp05-http'
        }
      ],
      idempotencyKey: 'wp05-http-rec'
    });
  }

  it('reads Today and records the authenticated Core Principal through prepare and confirm', async () => {
    const rec = await seedRecommendation();
    const today = await fetch(`${base}/v1/today`, { headers: headers() });
    expect(today.status).toBe(200);
    const todayPayload = await today.json();
    expect(todayPayload.items[0].recommendation.todayRecommendationId).toBe(
      rec.todayRecommendationId
    );
    expect(todayPayload.recentFeedback).toEqual([]);

    const prepared = await fetch(
      `${base}/v1/today/${encodeURIComponent(rec.todayRecommendationId)}/prepared-actions`,
      {
        method: 'POST',
        headers: { ...headers(), 'idempotency-key': 'wp05-http-prepare' },
        body: JSON.stringify({
          recommendationVersion: rec.version,
          expectedRecommendationFingerprintSha256: rec.recommendationFingerprintSha256,
          plan: { kind: 'PREPARE_CONTENT', title: rec.title, rationale: rec.explanation }
        })
      }
    );
    expect(prepared.status).toBe(201);
    const journey = await prepared.json();

    const confirmed = await fetch(
      `${base}/v1/prepared-actions/${encodeURIComponent(journey.preparedAction.preparedActionId)}/confirm`,
      {
        method: 'POST',
        headers: { ...headers(), 'idempotency-key': 'wp05-http-confirm' },
        body: JSON.stringify({
          preparedActionVersion: 1,
          expectedPreparedActionFingerprintSha256:
            journey.preparedAction.preparedActionFingerprintSha256,
          acknowledgedEffect: journey.preparedAction.confirmationEffect,
          confirmedByPrincipalId: 'attacker-supplied-id'
        })
      }
    );
    expect(confirmed.status).toBe(200);
    const completed = await confirmed.json();
    expect(completed.handoffState).toBe('HANDOFF_COMPLETED');
    expect(completed.confirmation.confirmedByPrincipalId).toBe(principal.userId);
    expect(completed.confirmation.confirmedByPrincipalId).not.toBe('attacker-supplied-id');
  });

  it('fails workspace mismatch, permission denial and untrusted internal calls closed', async () => {
    await seedRecommendation();
    expect(
      await fetch(`${base}/v1/today`, {
        headers: headers(otherWorkspaceId)
      }).then((response) => response.status)
    ).toBe(404);
    expect(
      await fetch(`${base}/v1/today`, {
        headers: headers(workspaceId, { ...principal, permissions: [] })
      }).then((response) => response.status)
    ).toBe(403);
    expect(
      await fetch(`${base}/v1/today`, {
        headers: {
          ...headers(),
          'x-markorbit-internal-authorization': 'not-trusted'
        }
      }).then((response) => response.status)
    ).toBe(401);
  });
});
