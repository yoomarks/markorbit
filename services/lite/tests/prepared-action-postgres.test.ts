import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type {
  ContentOpportunityId,
  PreparedActionId,
  ProductLoopSourceReference,
  TodayRecommendationId
} from '@markorbit/contracts/product-loop';
import {
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from '../src/content-preparation.js';
import {
  handoffResult,
  PostgresPreparedActionStore,
  PreparedActionJourneyError,
  PreparedActionJourneyService,
  type PreparedActionHandoffAuthority
} from '../src/prepared-action.js';

const url = process.env.LITE_TODAY_TEST_DATABASE_URL;
const required = process.env.LITE_TODAY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_TODAY_TEST_DATABASE_URL is required when LITE_TODAY_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '25252525-2525-4252-8252-252525252525';
const otherWorkspaceId = '26262626-2626-4262-8262-262626262626';
const principalId = '11111111-1111-4111-8111-111111111111';
const sourceFingerprint = 'a'.repeat(64);

function sequence<T extends string>(prefix: string) {
  let value = 0;
  return () => `${prefix}_${++value}` as T;
}

suite('PostgreSQL Lite Today Prepared Action journey', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-prepared-action-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_today_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const source: ProductLoopSourceReference = {
    schemaVersion: 1,
    owner: 'KNOWLEDGE',
    kind: 'KNOWLEDGE_READY_PACKAGE',
    sourceId: 'rdp_wp05-today',
    sourceVersion: 'accepted-v3',
    sourceFingerprintSha256: sourceFingerprint,
    observedAt: '2026-08-11T10:00:00.000Z',
    correlationId: 'correlation_wp05-today'
  };
  const sourceAuthority: ProductLoopSourceAuthority = {
    resolve(requestWorkspaceId, locator) {
      if (![workspaceId, otherWorkspaceId].includes(requestWorkspaceId))
        throw new Error('unexpected workspace');
      if (
        locator.owner !== source.owner ||
        locator.kind !== source.kind ||
        locator.sourceId !== source.sourceId
      )
        throw new Error('unexpected source locator');
      return Promise.resolve(structuredClone(source));
    }
  };
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 7, 11, 10, 1, tick++)).toISOString();
  const contentIds = {
    recommendation: sequence<TodayRecommendationId>('today-recommendation'),
    opportunity: sequence<ContentOpportunityId>('content-opportunity'),
    draft: sequence<`content-draft_${string}`>('content-draft'),
    review: sequence<`content-review-decision_${string}`>('content-review-decision'),
    publishPackage: sequence<`publish-package_${string}`>('publish-package')
  };
  const preparedActionId = sequence<PreparedActionId>('prepared-action');

  const contentStore = () =>
    new PostgresLiteContentPreparationStore(
      database,
      database.getPool(),
      sourceAuthority,
      now,
      contentIds
    );
  const preparedStore = () =>
    new PostgresPreparedActionStore(database, database.getPool(), now, preparedActionId);

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
    await migrate(database.getPool(), 'lite_today_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'WP05 Today','wp05-today'),
       ($2,'WP05 Other','wp05-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    tick = 0;
    await database.getPool().query(
      `TRUNCATE
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

  async function recommendation() {
    return contentStore().createRecommendation({
      workspaceId,
      title: 'Explain the reviewed trademark maintenance change',
      explanation: 'Accepted Knowledge is ready for one bounded professional content preparation.',
      sources: [
        {
          owner: source.owner,
          kind: source.kind,
          sourceId: source.sourceId
        }
      ],
      idempotencyKey: 'wp05-recommendation'
    });
  }

  async function prepare() {
    const rec = await recommendation();
    const store = preparedStore();
    const journey = await store.prepare({
      workspaceId,
      recommendation: { id: rec.todayRecommendationId, version: rec.version },
      expectedRecommendationFingerprintSha256: rec.recommendationFingerprintSha256,
      plan: {
        kind: 'PREPARE_CONTENT',
        title: rec.title,
        rationale: rec.explanation
      },
      idempotencyKey: 'wp05-prepare'
    });
    return { rec, store, journey };
  }

  it('persists exact Prepared Action, Core Principal confirmation and one content handoff across restart/replay', async () => {
    const { journey } = await prepare();
    let ownerCalls = 0;
    const authority: PreparedActionHandoffAuthority = {
      async perform(action, plan, _confirmation, key) {
        ownerCalls += 1;
        expect(plan.kind).toBe('PREPARE_CONTENT');
        if (plan.kind !== 'PREPARE_CONTENT') throw new Error('unexpected plan');
        const opportunity = await contentStore().acceptContentOpportunity({
          workspaceId,
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
    const service = new PreparedActionJourneyService(preparedStore(), authority);
    const command = {
      workspaceId,
      preparedAction: {
        id: journey.preparedAction.preparedActionId,
        version: journey.preparedAction.version
      },
      expectedPreparedActionFingerprintSha256:
        journey.preparedAction.preparedActionFingerprintSha256,
      confirmedByPrincipalId: principalId,
      acknowledgedEffect: journey.preparedAction.confirmationEffect,
      idempotencyKey: 'wp05-confirm'
    };
    const completed = await service.confirmAndHandoff(command);
    expect(completed.handoffState).toBe('HANDOFF_COMPLETED');
    expect(completed.confirmation?.confirmedByPrincipalId).toBe(principalId);
    expect(completed.handoffResult).toMatchObject({
      owner: 'LITE',
      target: 'LITE_CONTENT_PREPARATION'
    });
    expect(completed.handoffResult?.consequences).toMatchObject({
      externalPublishExecuted: false,
      customerContactedAutomatically: false,
      orderCreatedAutomatically: false,
      matterCreatedAutomatically: false,
      paymentCreated: false,
      providerAppointed: false,
      filingSubmitted: false,
      officialTruthCreated: false
    });
    expect(ownerCalls).toBe(1);

    const afterRestart = new PreparedActionJourneyService(preparedStore(), authority);
    expect(
      await afterRestart.findJourney(workspaceId, journey.preparedAction.preparedActionId)
    ).toEqual(completed);
    expect(await afterRestart.confirmAndHandoff(command)).toEqual(completed);
    expect(ownerCalls).toBe(1);
    const count = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM lite_content_opportunities');
    expect((count.rows[0] as { count?: number } | undefined)?.count).toBe(1);
  });

  it('keeps confirmation durable when the owner is unavailable, then retries without a second confirmation', async () => {
    const { journey } = await prepare();
    let calls = 0;
    const authority: PreparedActionHandoffAuthority = {
      perform(action) {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error('owner temporarily unavailable'));
        return Promise.resolve(
          handoffResult({
            preparedAction: action,
            owner: 'LITE',
            ownerRecord: { id: 'content-opportunity_retry', version: 1 },
            completedAt: '2026-08-11T10:10:00.000Z'
          })
        );
      }
    };
    const command = {
      workspaceId,
      preparedAction: { id: journey.preparedAction.preparedActionId, version: 1 },
      expectedPreparedActionFingerprintSha256:
        journey.preparedAction.preparedActionFingerprintSha256,
      confirmedByPrincipalId: principalId,
      acknowledgedEffect: journey.preparedAction.confirmationEffect,
      idempotencyKey: 'wp05-confirm-retry'
    };
    await expect(
      new PreparedActionJourneyService(preparedStore(), authority).confirmAndHandoff(command)
    ).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { confirmationPersisted: true, handoffPending: true }
    });

    const pending = await preparedStore().findJourney(
      workspaceId,
      journey.preparedAction.preparedActionId
    );
    expect(pending?.handoffState).toBe('HANDOFF_PENDING');
    expect(pending?.confirmation?.confirmedByPrincipalId).toBe(principalId);
    const confirmationCount = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM lite_prepared_action_confirmations');
    expect((confirmationCount.rows[0] as { count?: number } | undefined)?.count).toBe(1);

    const retried = await new PreparedActionJourneyService(
      preparedStore(),
      authority
    ).confirmAndHandoff(command);
    expect(retried.handoffState).toBe('HANDOFF_COMPLETED');
    expect(calls).toBe(2);
    const confirmationCountAfter = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM lite_prepared_action_confirmations');
    expect((confirmationCountAfter.rows[0] as { count?: number } | undefined)?.count).toBe(1);
  });

  it('fails stale fingerprints closed and keeps Workspace reads isolated', async () => {
    const { rec, store, journey } = await prepare();
    await expect(
      preparedStore().prepare({
        workspaceId,
        recommendation: { id: rec.todayRecommendationId, version: rec.version },
        expectedRecommendationFingerprintSha256: 'f'.repeat(64),
        plan: { kind: 'PREPARE_CONTENT', title: rec.title, rationale: rec.explanation },
        idempotencyKey: 'wp05-stale'
      })
    ).rejects.toMatchObject({ code: 'SOURCE_FINGERPRINT_MISMATCH' });
    expect(
      await store.findJourney(otherWorkspaceId, journey.preparedAction.preparedActionId)
    ).toBeUndefined();
    const today = await store.listToday(workspaceId);
    expect(today).toMatchObject({ workspaceId, partial: false });
    expect(today.items).toHaveLength(1);
    expect(today.items[0]?.preparedActions[0]?.preparedAction.preparedActionId).toBe(
      journey.preparedAction.preparedActionId
    );
  });

  it('rejects acknowledgement drift and a spoofed consequence result', async () => {
    const { store, journey } = await prepare();
    await expect(
      store.confirm({
        workspaceId,
        preparedAction: { id: journey.preparedAction.preparedActionId, version: 1 },
        expectedPreparedActionFingerprintSha256:
          journey.preparedAction.preparedActionFingerprintSha256,
        confirmedByPrincipalId: principalId,
        acknowledgedEffect: 'I did not review the actual effect.',
        idempotencyKey: 'wp05-bad-ack'
      })
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });

    const confirmed = await store.confirm({
      workspaceId,
      preparedAction: { id: journey.preparedAction.preparedActionId, version: 1 },
      expectedPreparedActionFingerprintSha256:
        journey.preparedAction.preparedActionFingerprintSha256,
      confirmedByPrincipalId: principalId,
      acknowledgedEffect: journey.preparedAction.confirmationEffect,
      idempotencyKey: 'wp05-good-ack'
    });
    expect(confirmed.handoffState).toBe('HANDOFF_PENDING');
    await expect(
      store.recordHandoff({
        workspaceId,
        preparedAction: { id: journey.preparedAction.preparedActionId, version: 1 },
        result: {
          ...handoffResult({
            preparedAction: journey.preparedAction,
            owner: 'LITE',
            ownerRecord: { id: 'content-opportunity_spoof', version: 1 },
            completedAt: '2026-08-11T10:20:00.000Z'
          }),
          consequences: {
            ...handoffResult({
              preparedAction: journey.preparedAction,
              owner: 'LITE',
              ownerRecord: { id: 'content-opportunity_spoof', version: 1 },
              completedAt: '2026-08-11T10:20:00.000Z'
            }).consequences,
            filingSubmitted: true
          }
        } as never,
        idempotencyKey: 'wp05-spoof-result'
      })
    ).rejects.toBeInstanceOf(PreparedActionJourneyError);
  });
});
