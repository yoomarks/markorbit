import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import type { FormalMatterId } from '@markorbit/contracts';
import type {
  CurrentLifecycleView,
  LifecycleProjectionSource,
  LifecycleProjectionState
} from '@markorbit/contracts/evidence-lifecycle';
import { PostgresLifecycleProjectionRepository } from '../src/lifecycle-projection.js';
import {
  RECOMMENDED_ACTION_POLICY_VERSION,
  PostgresRecommendedActionRepository,
  RecommendedActionService,
  type RegenerateRecommendedActionCommand
} from '../src/recommended-action.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required when MARKREG_POSTGRES_TEST_REQUIRED=1.');
const suite = url ? describe : describe.skip;
const workspaceId = '44444444-4444-4444-8444-444444444444';
const otherWorkspaceId = '55555555-5555-4555-8555-555555555555';
const recordedAt = '2026-08-10T01:20:00.000Z';
const sha = (character: string) => character.repeat(64);

suite('PostgreSQL MarkReg Recommended Actions', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-recommended-action-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const migrations = () =>
    loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/markreg-service');

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
          JSON.stringify({ preparation: { applicantName: 'Orbit Ltd', trademark: 'ORBIT' } }),
          sha('f'),
          `user_${suffix}`,
          '2026-08-10T01:00:00.000Z'
        ]
      );
    return formalMatterId;
  }

  async function setLifecycle(
    suffix: string,
    formalMatterId: FormalMatterId,
    state: LifecycleProjectionState,
    version = 1,
    viewId = `lifecycle-view_${suffix}`,
    fingerprintCharacter = 'e'
  ): Promise<CurrentLifecycleView> {
    const eventId = `lifecycle-event_${suffix}-${version}`;
    const source: LifecycleProjectionSource = {
      reviewedSourceAdmission: { id: `reviewed-source-admission_${suffix}-${version}`, version: 1 },
      admissionFingerprintSha256: sha('a'),
      evidenceReviewDecision: { id: `evidence-review-decision_${suffix}-${version}`, version: 1 },
      evidenceReceipt: { id: `evidence-receipt_${suffix}-${version}`, version: 1 },
      providerReturn: { id: `provider-return_${suffix}-${version}`, version: 1 },
      formalMatter: { id: formalMatterId, version: 1 }
    };
    const eventFingerprint = sha(String((version % 9) + 1));
    const viewFingerprint = sha(fingerprintCharacter);
    const summary =
      state === 'CUSTOMER_ACTION_NEEDED'
        ? 'Please review the current Matter information and take the requested next step.'
        : state === 'CORRECTION_OR_REVIEW_ISSUE'
          ? 'Reviewed evidence indicates a correction or review issue.'
          : 'No customer action is currently required.';
    await database
      .getPool()
      .query(
        'INSERT INTO markreg_lifecycle_events (lifecycle_event_id,workspace_id,formal_matter_id,formal_matter_version,version,reviewed_source_admission_id,reviewed_source_admission_version,admission_fingerprint_sha256,source_provenance,state,event_code,customer_safe_label,customer_safe_summary,occurred_at,projected_at,lifecycle_event_fingerprint_sha256,official_status_verified,correlation_id,projection_request_fingerprint) VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,false,$15,$16)',
        [
          eventId,
          workspaceId,
          formalMatterId,
          '1',
          version,
          source.reviewedSourceAdmission.id,
          source.admissionFingerprintSha256,
          JSON.stringify(source),
          state,
          `EVENT_${suffix}_${version}`,
          state === 'CUSTOMER_ACTION_NEEDED' ? 'Action needed' : 'Lifecycle updated',
          summary,
          `2026-08-10T01:0${version}:00.000Z`,
          `2026-08-10T01:1${version}:00.000Z`,
          eventFingerprint,
          `correlation_${suffix}`,
          sha('9')
        ]
      );
    await database
      .getPool()
      .query(
        'INSERT INTO markreg_lifecycle_views (lifecycle_view_id,workspace_id,formal_matter_id,formal_matter_version,version,current_event_id,current_event_version,current_event_fingerprint_sha256,state,customer_safe_label,customer_safe_summary,lifecycle_view_fingerprint_sha256,official_status_verified,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$5,$7,$8,$9,$10,$11,false,$12) ON CONFLICT (workspace_id,formal_matter_id) DO UPDATE SET version=EXCLUDED.version,current_event_id=EXCLUDED.current_event_id,current_event_version=EXCLUDED.current_event_version,current_event_fingerprint_sha256=EXCLUDED.current_event_fingerprint_sha256,state=EXCLUDED.state,customer_safe_label=EXCLUDED.customer_safe_label,customer_safe_summary=EXCLUDED.customer_safe_summary,lifecycle_view_fingerprint_sha256=EXCLUDED.lifecycle_view_fingerprint_sha256,updated_at=EXCLUDED.updated_at',
        [
          viewId,
          workspaceId,
          formalMatterId,
          '1',
          version,
          eventId,
          eventFingerprint,
          state,
          state === 'CUSTOMER_ACTION_NEEDED' ? 'Action needed' : 'Lifecycle updated',
          summary,
          viewFingerprint,
          `2026-08-10T01:1${version}:00.000Z`
        ]
      );
    const view = await new PostgresLifecycleProjectionRepository(
      database,
      database.getPool()
    ).getCurrentView(workspaceId, formalMatterId);
    if (!view) throw new Error('fixture lifecycle view was not created');
    return view;
  }

  function fixture() {
    const lifecycle = new PostgresLifecycleProjectionRepository(database, database.getPool());
    const repository = new PostgresRecommendedActionRepository(database, database.getPool());
    const service = new RecommendedActionService(
      repository,
      lifecycle,
      undefined,
      () => recordedAt,
      () => 'recommended-action_fixture'
    );
    return { repository, service };
  }

  function command(
    view: CurrentLifecycleView,
    input: Partial<RegenerateRecommendedActionCommand> = {}
  ): RegenerateRecommendedActionCommand {
    return {
      workspaceId,
      formalMatterId: view.formalMatter.id,
      expectedLifecycleViewId: view.lifecycleViewId,
      expectedLifecycleViewVersion: view.version,
      expectedLifecycleViewFingerprintSha256: view.lifecycleViewFingerprintSha256,
      policyVersion: RECOMMENDED_ACTION_POLICY_VERSION,
      idempotencyKey: `recommend-${view.formalMatter.id}-${view.version}`,
      correlationId: `correlation-${view.formalMatter.id}-${view.version}`,
      ...input
    };
  }

  it('applies and verifies owner migration 0035', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => migration.version)).toContain('0035');
    expect(
      (await migrationStatus(database.getPool(), MARKREG_TEST_MIGRATION_NAMESPACE, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), MARKREG_TEST_MIGRATION_NAMESPACE, owned);
  });

  it('creates a deterministic non-executing action with customer-safe projection', async () => {
    const matter = await insertMatter('generate');
    const view = await setLifecycle('generate', matter, 'CUSTOMER_ACTION_NEEDED');
    const { repository, service } = fixture();
    const result = await service.regenerate(command(view));
    expect(result.action).toMatchObject({
      recommendedActionId: 'recommended-action_fixture',
      workspaceId,
      version: 1,
      sourceLifecycleView: { id: view.lifecycleViewId, version: 1 },
      policyVersion: RECOMMENDED_ACTION_POLICY_VERSION,
      actionCode: 'CUSTOMER_ACTION_REQUIRED',
      status: 'OPEN',
      executionAuthorized: false
    });
    expect(result.action).not.toHaveProperty('dueAt');
    expect(result.action?.timingBasis).toContain('no deadline is inferred');
    expect(await repository.findByMatter(workspaceId, matter)).toEqual(result.action);
    const customer = await service.getCustomerProjection(workspaceId, matter);
    expect(customer).toMatchObject({ status: 'OPEN', executionAuthorized: false });
    expect(customer).not.toHaveProperty('sourceLifecycleViewFingerprintSha256');
    expect(customer).not.toHaveProperty('policyVersion');
    expect(result.action).not.toHaveProperty('payment');
    expect(result.action).not.toHaveProperty('filingSubmitted');
  });

  it('replays and serializes identical evaluation without duplicate state', async () => {
    const matter = await insertMatter('replay');
    const view = await setLifecycle('replay', matter, 'CUSTOMER_ACTION_NEEDED');
    const { service } = fixture();
    const firstCommand = command(view, { idempotencyKey: 'recommended-replay' });
    const [first, second] = await Promise.all([
      service.regenerate(firstCommand),
      service.regenerate(firstCommand)
    ]);
    expect(second).toEqual(first);
    const duplicate = await service.regenerate(
      command(view, { idempotencyKey: 'recommended-replay-other-key' })
    );
    expect(duplicate.action).toEqual(first.action);
    expect(
      (
        await database
          .getPool()
          .query(
            'SELECT (SELECT count(*) FROM markreg_recommended_actions) actions,(SELECT count(*) FROM markreg_recommended_action_audit) audits,(SELECT count(*) FROM markreg_recommended_action_commands) commands'
          )
      ).rows[0]
    ).toEqual({ actions: '1', audits: '1', commands: '2' });
  });

  it('supports acknowledgement and dismissal while execution remains forbidden', async () => {
    const matter = await insertMatter('transition');
    const view = await setLifecycle('transition', matter, 'CUSTOMER_ACTION_NEEDED');
    const { service } = fixture();
    const generated = await service.regenerate(command(view));
    const actionId = generated.action!.recommendedActionId;
    const acknowledged = await service.transition({
      workspaceId,
      recommendedActionId: actionId,
      expectedVersion: 1,
      targetStatus: 'ACKNOWLEDGED',
      idempotencyKey: 'recommended-ack',
      correlationId: 'correlation-ack'
    });
    expect(acknowledged.action).toMatchObject({
      version: 2,
      status: 'ACKNOWLEDGED',
      executionAuthorized: false
    });
    const dismissed = await service.transition({
      workspaceId,
      recommendedActionId: actionId,
      expectedVersion: 2,
      targetStatus: 'DISMISSED',
      idempotencyKey: 'recommended-dismiss',
      correlationId: 'correlation-dismiss'
    });
    expect(dismissed.action).toMatchObject({
      version: 3,
      status: 'DISMISSED',
      executionAuthorized: false
    });
    const audit = await database
      .getPool()
      .query(
        'SELECT event_type,action_version FROM markreg_recommended_action_audit ORDER BY audit_id'
      );
    expect(audit.rows).toMatchObject([
      { event_type: 'GENERATED', action_version: 1 },
      { event_type: 'ACKNOWLEDGED', action_version: 2 },
      { event_type: 'DISMISSED', action_version: 3 }
    ]);
  });

  it('suppresses on a newer no-action view and regenerates on a later actionable view', async () => {
    const matter = await insertMatter('lifecycle-change');
    const firstView = await setLifecycle('lifecycle-change', matter, 'CUSTOMER_ACTION_NEEDED');
    const { service } = fixture();
    const first = await service.regenerate(command(firstView));
    const actionId = first.action!.recommendedActionId;
    const noAction = await setLifecycle(
      'lifecycle-change-no-action',
      matter,
      'WAITING_NO_ACTION',
      2,
      firstView.lifecycleViewId,
      '7'
    );
    const suppressed = await service.regenerate(
      command(noAction, { idempotencyKey: 'recommended-suppress' })
    );
    expect(suppressed.action).toMatchObject({ version: 2, status: 'SUPPRESSED' });
    await expect(service.getCustomerProjection(workspaceId, matter)).resolves.toBeNull();

    const actionable = await setLifecycle(
      'lifecycle-change-actionable',
      matter,
      'CORRECTION_OR_REVIEW_ISSUE',
      3,
      firstView.lifecycleViewId,
      '8'
    );
    const regenerated = await service.regenerate(
      command(actionable, { idempotencyKey: 'recommended-regenerate' })
    );
    expect(regenerated.action).toMatchObject({
      recommendedActionId: actionId,
      version: 3,
      sourceLifecycleView: { id: firstView.lifecycleViewId, version: 3 },
      actionCode: 'REVIEW_CORRECTION_ISSUE',
      status: 'OPEN',
      executionAuthorized: false
    });
  });

  it('fails closed for stale exactness and cross-Workspace access', async () => {
    const matter = await insertMatter('stale');
    const firstView = await setLifecycle('stale', matter, 'CUSTOMER_ACTION_NEEDED');
    const { service } = fixture();
    const generated = await service.regenerate(command(firstView));
    const nextView = await setLifecycle(
      'stale-next',
      matter,
      'WAITING_NO_ACTION',
      2,
      firstView.lifecycleViewId,
      '6'
    );
    await expect(service.regenerate(command(firstView))).rejects.toMatchObject({
      code: 'SOURCE_VERSION_MISMATCH'
    });
    await expect(
      service.regenerate(command(nextView, { expectedLifecycleViewFingerprintSha256: sha('5') }))
    ).rejects.toMatchObject({ code: 'SOURCE_FINGERPRINT_MISMATCH' });
    await expect(
      service.transition({
        workspaceId,
        recommendedActionId: generated.action!.recommendedActionId,
        expectedVersion: 1,
        targetStatus: 'ACKNOWLEDGED',
        idempotencyKey: 'recommended-stale-transition',
        correlationId: 'correlation-stale-transition'
      })
    ).rejects.toMatchObject({ code: 'RECOMMENDATION_SOURCE_STALE' });
    await expect(service.getForOperations(otherWorkspaceId, matter)).resolves.toBeUndefined();
    await expect(
      service.transition({
        workspaceId: otherWorkspaceId,
        recommendedActionId: generated.action!.recommendedActionId,
        expectedVersion: 1,
        targetStatus: 'ACKNOWLEDGED',
        idempotencyKey: 'recommended-cross-workspace',
        correlationId: 'correlation-cross-workspace'
      })
    ).rejects.toMatchObject({ code: 'RECOMMENDATION_NOT_FOUND' });
  });

  it('records an idempotent no-candidate evaluation without inventing an action', async () => {
    const matter = await insertMatter('no-action');
    const view = await setLifecycle('no-action', matter, 'REVIEWED_PROVIDER_EVIDENCE');
    const { service } = fixture();
    const result = await service.regenerate(command(view));
    expect(result.action).toBeNull();
    expect(
      (
        await database
          .getPool()
          .query(
            'SELECT (SELECT count(*) FROM markreg_recommended_actions) actions,(SELECT count(*) FROM markreg_recommended_action_audit) audits,(SELECT count(*) FROM markreg_recommended_action_commands) commands'
          )
      ).rows[0]
    ).toEqual({ actions: '0', audits: '0', commands: '1' });
  });
});
