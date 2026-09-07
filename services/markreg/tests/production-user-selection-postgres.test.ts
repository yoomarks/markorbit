import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  noRecommendationSourceAuthorityConsequences,
  parseRecommendationArtifactV1,
  type CreateProductionIntakeCommandV1,
  type CreateUserSelectionCommandV1,
  type ProductionIntakeV1,
  type RecommendationArtifactV1
} from '@markorbit/contracts/markreg-early-funnel';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresProductionIntakeService } from '../src/production-intake.js';
import { productionRecommendationSha256 } from '../src/production-recommendation.js';
import {
  PostgresProductionUserSelectionService,
  productionUserSelectionSha256
} from '../src/production-user-selection.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const workspaceId = '62626262-6262-4626-8626-626262626262';
const otherWorkspaceId = '63636363-6363-4636-8636-636363636363';
const intakeAt = '2026-09-07T06:00:00.000Z';
const recommendationAt = '2026-09-07T06:01:00.000Z';
let selectionClock = 0;

const principal = (
  workspace = workspaceId,
  permissions: WorkspacePrincipal['permissions'] = ['workspace:read', 'matter:create']
): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0942_pg',
  userId: 'user_task0942_pg',
  workspaceId: workspace,
  membershipId: 'membership_task0942_pg',
  role: 'WORKSPACE_ADMIN',
  permissions,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const intakeCommand = (key = 'production-intake-task0942'): CreateProductionIntakeCommandV1 => ({
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Select one bounded strategy-review option.',
    applicant: { type: 'ORGANIZATION', name: 'Selection Orbit LLC', country: 'US' },
    trademark: { type: 'COMPOSITE', representationText: 'SELECTION ORBIT + DEVICE' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Software for trademark portfolio management.' },
    filingGoal: 'Prepare a US filing plan for human review.'
  },
  idempotencyKey: key,
  correlationId: 'correlation_task0942_intake'
});

const command = (
  recommendationId: CreateUserSelectionCommandV1['recommendationId'],
  overrides: Partial<CreateUserSelectionCommandV1> = {}
): CreateUserSelectionCommandV1 => ({
  schemaVersion: 1,
  recommendationId,
  expectedRecommendationVersion: 1,
  selectedOptionCode: 'B',
  idempotencyKey: 'production-selection-task0942',
  correlationId: 'correlation_task0942_selection',
  ...overrides
});

function recommendationFor(
  intake: ProductionIntakeV1,
  overrides: Partial<
    Pick<RecommendationArtifactV1, 'admissionClass' | 'currentness'> & {
      sourceAdmissionClass: RecommendationArtifactV1['source']['admissionClass'];
      sourceCurrentness: RecommendationArtifactV1['source']['currentness'];
    }
  > = {}
): RecommendationArtifactV1 {
  const recommendationId =
    'recommendation_task0942' as RecommendationArtifactV1['recommendationId'];
  const base: Omit<RecommendationArtifactV1, 'fingerprintSha256'> = {
    schemaVersion: 1,
    recommendationId,
    workspaceId,
    version: 1,
    intake: {
      id: intake.intakeId,
      version: intake.version,
      fingerprintSha256: intake.fingerprintSha256
    },
    admissionClass: overrides.admissionClass ?? 'PRODUCTION_ADMISSIBLE',
    currentness: overrides.currentness ?? 'CURRENT',
    source: {
      sourceKind: 'CAPABILITY_RESULT',
      sourceId: 'markreg.us-trademark-mark-representation-strategy-source',
      sourceVersion:
        '1.0.0|runtime:runtime-capability_us-trademark-mark-representation-strategy-source-v1@1',
      fingerprintSha256: 'b'.repeat(64),
      admissionClass: overrides.sourceAdmissionClass ?? 'PRODUCTION_ADMISSIBLE',
      currentness: overrides.sourceCurrentness ?? 'CURRENT',
      currentnessCheckedAt: recommendationAt,
      provenanceRefs: ['capability-output:brain.us-trademark-mark-representation-strategy.v1'],
      assumptions: ['Customer-supplied mark facts remain accurate.'],
      limitations: ['Human review is required.'],
      authorityConsequences: noRecommendationSourceAuthorityConsequences
    },
    options: [
      { code: 'A', title: 'Review dimensions', description: 'Review admitted dimensions.' },
      { code: 'B', title: 'Validate assumptions', description: 'Validate customer assumptions.' },
      { code: 'C', title: 'Professional review', description: 'Escalate for professional review.' }
    ],
    rationale: 'Bounded strategy review only.',
    assumptions: ['Customer-supplied mark facts remain accurate.'],
    limitations: ['No filing or protected action is authorized.'],
    provenanceRefs: ['markreg-consumer-policy:task0942'],
    generatedAt: recommendationAt,
    authorityConsequences: noEarlyFunnelAuthorityConsequences
  };
  return parseRecommendationArtifactV1({
    ...base,
    fingerprintSha256: productionRecommendationSha256(base)
  });
}

suite('PostgreSQL Production User Selection', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: MARKREG_TEST_MIGRATION_NAMESPACE,
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const intakeService = () =>
    new PostgresProductionIntakeService(database, database.getPool(), () => intakeAt);
  const selectionService = () =>
    new PostgresProductionUserSelectionService(database, database.getPool(), () => {
      selectionClock += 1;
      return `2026-09-07T06:0${selectionClock + 1}:00.000Z`;
    });

  async function persistRecommendation(
    intake: ProductionIntakeV1,
    overrides: Parameters<typeof recommendationFor>[1] = {}
  ) {
    const recommendation = recommendationFor(intake, overrides);
    await database.getPool().query(
      `INSERT INTO markreg_early_funnel_recommendations (
        workspace_id,recommendation_id,version,intake_id,intake_version,
        intake_fingerprint_sha256,admission_class,currentness,source_id,source_version,
        source_fingerprint_sha256,source_admission_class,source_currentness,
        source_currentness_checked_at,source_provenance,recommendation_record,
        fingerprint_sha256,generated_at,created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18,$19)`,
      [
        recommendation.workspaceId,
        recommendation.recommendationId,
        recommendation.version,
        recommendation.intake.id,
        recommendation.intake.version,
        recommendation.intake.fingerprintSha256,
        recommendation.admissionClass,
        recommendation.currentness,
        recommendation.source.sourceId,
        recommendation.source.sourceVersion,
        recommendation.source.fingerprintSha256,
        recommendation.source.admissionClass,
        recommendation.source.currentness,
        recommendation.source.currentnessCheckedAt,
        JSON.stringify({ provenanceRefs: recommendation.provenanceRefs }),
        JSON.stringify(recommendation),
        recommendation.fingerprintSha256,
        recommendation.generatedAt,
        principal().userId
      ]
    );
    return recommendation;
  }

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });

  beforeEach(async () => {
    selectionClock = 0;
    await database.getPool().query(
      `TRUNCATE
        markreg_early_funnel_audit,
        markreg_early_funnel_commands,
        markreg_early_funnel_quote_state_events,
        markreg_early_funnel_quotes,
        markreg_early_funnel_selection_state_events,
        markreg_early_funnel_selections,
        markreg_early_funnel_recommendations,
        markreg_early_funnel_intakes
       RESTART IDENTITY CASCADE`
    );
  });

  afterAll(() => database.close());

  it('persists exact Recommendation lineage and replays across restart without duplicate events', async () => {
    const intake = await intakeService().create(principal(), intakeCommand());
    const recommendation = await persistRecommendation(intake);
    const firstService = selectionService();
    const created = await firstService.create(
      principal(),
      command(recommendation.recommendationId)
    );

    expect(created).toMatchObject({
      workspaceId,
      version: 1,
      status: 'CURRENT',
      recommendation: {
        id: recommendation.recommendationId,
        version: recommendation.version,
        fingerprintSha256: recommendation.fingerprintSha256
      },
      selectedOptionCode: 'B',
      authorityConsequences: noEarlyFunnelAuthorityConsequences
    });
    const { fingerprintSha256: ignoredFingerprint, status: ignoredStatus, ...immutable } = created;
    void ignoredFingerprint;
    void ignoredStatus;
    expect(created.fingerprintSha256).toBe(productionUserSelectionSha256(immutable));

    const restarted = selectionService();
    expect(await restarted.create(principal(), command(recommendation.recommendationId))).toEqual(
      created
    );
    expect(await restarted.get(principal(), created.selectionId)).toEqual(created);

    const counts = await database.getPool().query(
      `SELECT
        (SELECT count(*)::int FROM markreg_early_funnel_selections) AS selections,
        (SELECT count(*)::int FROM markreg_early_funnel_selection_state_events) AS events,
        (SELECT count(*)::int FROM markreg_early_funnel_commands WHERE command_type='CREATE_SELECTION') AS commands,
        (SELECT count(*)::int FROM markreg_early_funnel_quotes) AS quotes`
    );
    expect(counts.rows[0]).toEqual({ selections: 1, events: 1, commands: 1, quotes: 0 });
  });

  it('supersedes the prior current Selection through append-only events without mutating history', async () => {
    const intake = await intakeService().create(principal(), intakeCommand());
    const recommendation = await persistRecommendation(intake);
    const service = selectionService();
    const first = await service.create(principal(), command(recommendation.recommendationId));
    const second = await service.create(
      principal(),
      command(recommendation.recommendationId, {
        selectedOptionCode: 'C',
        idempotencyKey: 'production-selection-task0942-second',
        correlationId: 'correlation_task0942_selection-second'
      })
    );

    expect(await service.get(principal(), first.selectionId)).toMatchObject({
      selectionId: first.selectionId,
      status: 'SUPERSEDED',
      fingerprintSha256: first.fingerprintSha256
    });
    expect(await service.get(principal(), second.selectionId)).toMatchObject({
      selectionId: second.selectionId,
      status: 'CURRENT',
      selectedOptionCode: 'C'
    });

    const history = await database.getPool().query(
      `SELECT selection_id,state,superseding_selection_id
       FROM markreg_early_funnel_selection_state_events
       ORDER BY state_event_id`
    );
    expect(history.rows).toEqual([
      {
        selection_id: first.selectionId,
        state: 'CURRENT',
        superseding_selection_id: null
      },
      {
        selection_id: first.selectionId,
        state: 'SUPERSEDED',
        superseding_selection_id: second.selectionId
      },
      {
        selection_id: second.selectionId,
        state: 'CURRENT',
        superseding_selection_id: null
      }
    ]);
    const artifact = await database.getPool().query(
      `SELECT initial_status,selection_record->>'status' AS stored_status,fingerprint_sha256
       FROM markreg_early_funnel_selections
       WHERE workspace_id=$1 AND selection_id=$2`,
      [workspaceId, first.selectionId]
    );
    expect(artifact.rows[0]).toEqual({
      initial_status: 'CURRENT',
      stored_status: 'CURRENT',
      fingerprint_sha256: first.fingerprintSha256
    });
    await expect(
      database.getPool().query(
        `UPDATE markreg_early_funnel_selections SET selected_option_code='A'
         WHERE workspace_id=$1 AND selection_id=$2`,
        [workspaceId, first.selectionId]
      )
    ).rejects.toBeTruthy();
  });

  it('fails closed for stale/non-production/exact-version drift and cross-Workspace access', async () => {
    const staleIntake = await intakeService().create(
      principal(),
      intakeCommand('intake-stale-0942')
    );
    const stale = await persistRecommendation(staleIntake, { currentness: 'STALE' });
    await expect(
      selectionService().create(
        principal(),
        command(stale.recommendationId, { idempotencyKey: 'selection-stale-0942' })
      )
    ).rejects.toMatchObject({ code: 'RECOMMENDATION_NOT_CURRENT', status: 409 });

    await database
      .getPool()
      .query(`TRUNCATE markreg_early_funnel_recommendations,markreg_early_funnel_intakes CASCADE`);
    const unsupportedIntake = await intakeService().create(
      principal(),
      intakeCommand('intake-unsupported-0942')
    );
    const unsupported = await persistRecommendation(unsupportedIntake, {
      admissionClass: 'FIXTURE_TEST',
      sourceAdmissionClass: 'FIXTURE_TEST'
    });
    await expect(
      selectionService().create(
        principal(),
        command(unsupported.recommendationId, {
          idempotencyKey: 'selection-unsupported-0942'
        })
      )
    ).rejects.toMatchObject({
      code: 'RECOMMENDATION_NOT_PRODUCTION_ADMISSIBLE',
      status: 422
    });

    await database
      .getPool()
      .query(`TRUNCATE markreg_early_funnel_recommendations,markreg_early_funnel_intakes CASCADE`);
    const currentIntake = await intakeService().create(
      principal(),
      intakeCommand('intake-current-0942')
    );
    const current = await persistRecommendation(currentIntake);
    await expect(
      selectionService().create(
        principal(),
        command(current.recommendationId, {
          expectedRecommendationVersion: 2,
          idempotencyKey: 'selection-version-0942'
        })
      )
    ).rejects.toMatchObject({ code: 'RECOMMENDATION_VERSION_CONFLICT', status: 409 });

    const created = await selectionService().create(
      principal(),
      command(current.recommendationId, { idempotencyKey: 'selection-current-0942' })
    );
    await expect(
      selectionService().get(principal(otherWorkspaceId), created.selectionId)
    ).rejects.toMatchObject({ code: 'PRODUCTION_USER_SELECTION_NOT_FOUND', status: 404 });
  });

  it('enforces permissions, idempotency conflict, audit lineage and no Quote consequence', async () => {
    const intake = await intakeService().create(principal(), intakeCommand());
    const recommendation = await persistRecommendation(intake);
    await expect(
      selectionService().create(
        principal(workspaceId, ['workspace:read']),
        command(recommendation.recommendationId)
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });

    const service = selectionService();
    const created = await service.create(principal(), command(recommendation.recommendationId));
    await expect(
      service.create(
        principal(),
        command(recommendation.recommendationId, { selectedOptionCode: 'C' })
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });

    const audit = await database.getPool().query(
      `SELECT entity_type,action,source_lineage
       FROM markreg_early_funnel_audit
       WHERE entity_type='SELECTION' AND entity_id=$1 ORDER BY audit_id`,
      [created.selectionId]
    );
    expect(audit.rows).toEqual([
      expect.objectContaining({
        entity_type: 'SELECTION',
        action: 'PRODUCTION_USER_SELECTION_CREATED',
        source_lineage: {
          recommendation: created.recommendation
        }
      })
    ]);
    const quoteCount = await database
      .getPool()
      .query(`SELECT count(*)::int AS count FROM markreg_early_funnel_quotes`);
    expect(quoteCount.rows[0]).toEqual({ count: 0 });
  });
});
