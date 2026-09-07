import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  noRecommendationSourceAuthorityConsequences,
  type CreateProductionIntakeCommandV1,
  type RecommendationSourceReferenceV1
} from '@markorbit/contracts/markreg-early-funnel';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresProductionIntakeService } from '../src/production-intake.js';
import {
  PostgresProductionRecommendationService,
  productionRecommendationSha256,
  type CreateProductionRecommendationCommandV1
} from '../src/production-recommendation.js';
import type {
  RecommendationCapableSourceMaterialV1,
  RecommendationSourceReadResultV1
} from '../src/recommendation-source.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_PRODUCTION_RECOMMENDATION_POSTGRES_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'MARKREG_TEST_DATABASE_URL is required in required Production Recommendation mode.'
  );
}
const suite = url ? describe : describe.skip;
const workspaceId = '60606060-6060-4606-8606-606060606060';
const otherWorkspaceId = '61616161-6161-4616-8616-616161616161';
const at = '2026-09-07T05:00:00.000Z';

const principal = (
  workspace = workspaceId,
  permissions: WorkspacePrincipal['permissions'] = ['workspace:read', 'matter:create']
): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0757_pg',
  userId: 'user_task0757_pg',
  workspaceId: workspace,
  membershipId: 'membership_task0757_pg',
  role: 'WORKSPACE_ADMIN',
  permissions,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const intakeCommand = (key = 'production-intake-task0757'): CreateProductionIntakeCommandV1 => ({
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Prepare a bounded US trademark filing strategy review.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Labs LLC', country: 'US' },
    trademark: { type: 'COMPOSITE', representationText: 'MARK ORBIT + DEVICE' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Software for trademark portfolio management.' },
    filingGoal: 'Prepare a US application for human attorney review.'
  },
  idempotencyKey: key,
  correlationId: 'correlation_task0757_intake'
});

const sourceReference = (suffix = 'task0757') => ({
  schemaVersion: 1 as const,
  idempotencyKey: `capability-strategy-${suffix}`,
  requestFingerprintSha256: 'a'.repeat(64),
  capabilityRequestId: `capreq_strategy-${suffix}`,
  sessionReceiptId: `session-receipt_strategy-${suffix}`
});

function source(): RecommendationSourceReferenceV1 {
  return {
    sourceKind: 'CAPABILITY_RESULT',
    sourceId: 'markreg.us-trademark-mark-representation-strategy-source',
    sourceVersion:
      '1.0.0|runtime:runtime-capability_us-trademark-mark-representation-strategy-source-v1@1|implementation:implementation-profile_us-trademark-mark-representation-strategy-source-v1@1|evidence:capability-source-admission-evidence_task0757@5',
    fingerprintSha256: 'b'.repeat(64),
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: '2026-09-07T05:01:00.000Z',
    provenanceRefs: ['capability-output:brain.us-trademark-mark-representation-strategy.v1'],
    assumptions: ['Customer-supplied mark classification remains accurate.'],
    limitations: ['Human review is required.'],
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  };
}

function material(
  input: CreateProductionIntakeCommandV1['input']
): RecommendationCapableSourceMaterialV1 {
  return {
    outputFamilyId: 'us-trademark-mark-representation-strategy',
    outputFamilyVersion: 1,
    analyzedInputFingerprintSha256: productionRecommendationSha256(input),
    candidates: [
      {
        dimension: 'WORDING_STANDARD_CHARACTER',
        support: 'SUPPORTED_FOR_HUMAN_REVIEW',
        rationaleCode: 'CUSTOMER_SUPPLIED_WORDING_DIMENSION',
        evidenceRoles: [
          'DECISION_FACTORS',
          'DRAWING_TYPE_DEFINITIONS',
          'PROTECTION_SCOPE_AND_SPECIAL_FORM_REQUIRED'
        ]
      },
      {
        dimension: 'DESIGN_STYLIZATION_SPECIAL_FORM',
        support: 'SUPPORTED_FOR_HUMAN_REVIEW',
        rationaleCode: 'CUSTOMER_SUPPLIED_DESIGN_OR_STYLIZATION_DIMENSION',
        evidenceRoles: [
          'DECISION_FACTORS',
          'DRAWING_TYPE_DEFINITIONS',
          'PROTECTION_SCOPE_AND_SPECIAL_FORM_REQUIRED'
        ]
      }
    ],
    assumptions: ['Customer-supplied mark classification remains accurate.'],
    limitations: ['Human review is required.'],
    provenanceRefs: ['knowledge-reference:uspto-mark-drawing-strategy'],
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  };
}

function sourceRead(
  input: CreateProductionIntakeCommandV1['input']
): RecommendationSourceReadResultV1 {
  return {
    status: 'PRODUCTION_ADMISSIBLE',
    source: source(),
    producerReference: sourceReference(),
    recommendationMaterial: material(input)
  };
}

function command(
  intakeId: CreateProductionRecommendationCommandV1['intakeId'],
  overrides: Partial<CreateProductionRecommendationCommandV1> = {}
): CreateProductionRecommendationCommandV1 {
  return {
    schemaVersion: 1,
    intakeId,
    expectedIntakeVersion: 1,
    producerReference: sourceReference(),
    idempotencyKey: 'production-recommendation-task0757',
    correlationId: 'correlation_task0757_recommendation',
    ...overrides
  };
}

suite('PostgreSQL Production Recommendation', () => {
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
    new PostgresProductionIntakeService(database, database.getPool(), () => at);
  const recommendationService = (
    read: () => Promise<RecommendationSourceReadResultV1> = () =>
      Promise.resolve(sourceRead(intakeCommand().input))
  ) =>
    new PostgresProductionRecommendationService(
      database,
      database.getPool(),
      { read },
      () => '2026-09-07T05:02:00.000Z'
    );

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });

  beforeEach(() =>
    database.getPool().query(
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
    )
  );

  afterAll(() => database.close());

  it('atomically persists Recommendation before advancing Intake and replays across restart without rereading Capability', async () => {
    const createdIntake = await intakeService().create(principal(), intakeCommand());
    const service = recommendationService(() => Promise.resolve(sourceRead(createdIntake.input)));
    const created = await service.create(principal(), command(createdIntake.intakeId));

    expect(created).toMatchObject({
      workspaceId,
      version: 1,
      admissionClass: 'PRODUCTION_ADMISSIBLE',
      currentness: 'CURRENT',
      intake: {
        id: createdIntake.intakeId,
        version: 1,
        fingerprintSha256: createdIntake.fingerprintSha256
      },
      source: {
        sourceId: 'markreg.us-trademark-mark-representation-strategy-source',
        admissionClass: 'PRODUCTION_ADMISSIBLE'
      }
    });
    expect(created.options.map((option) => option.code)).toEqual(['A', 'B', 'C']);

    const latestIntake = await intakeService().get(principal(), createdIntake.intakeId);
    expect(latestIntake).toMatchObject({ version: 2, status: 'RECOMMENDATION_READY' });

    const restarted = recommendationService(() =>
      Promise.reject(new Error('must not reread source'))
    );
    expect(await restarted.create(principal(), command(createdIntake.intakeId))).toEqual(created);
    expect(await restarted.get(principal(), created.recommendationId)).toEqual(created);

    const counts = await database.getPool().query(
      `SELECT
        (SELECT count(*)::int FROM markreg_early_funnel_intakes) AS intakes,
        (SELECT count(*)::int FROM markreg_early_funnel_recommendations) AS recommendations,
        (SELECT count(*)::int FROM markreg_early_funnel_selections) AS selections,
        (SELECT count(*)::int FROM markreg_early_funnel_quotes) AS quotes,
        (SELECT count(*)::int FROM markreg_early_funnel_commands WHERE command_type='CREATE_RECOMMENDATION') AS commands`
    );
    expect(counts.rows[0]).toEqual({
      intakes: 2,
      recommendations: 1,
      selections: 0,
      quotes: 0,
      commands: 1
    });
    const audit = await database.getPool().query(
      `SELECT entity_type,action FROM markreg_early_funnel_audit
       WHERE workspace_id=$1 ORDER BY audit_id`,
      [workspaceId]
    );
    expect(audit.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity_type: 'RECOMMENDATION',
          action: 'PRODUCTION_RECOMMENDATION_CREATED'
        }),
        expect.objectContaining({
          entity_type: 'INTAKE',
          action: 'PRODUCTION_INTAKE_RECOMMENDATION_READY'
        })
      ])
    );
  });

  it('rejects materially different idempotency replay and cross-Workspace reads', async () => {
    const firstIntake = await intakeService().create(principal(), intakeCommand());
    const first = await recommendationService(() =>
      Promise.resolve(sourceRead(firstIntake.input))
    ).create(principal(), command(firstIntake.intakeId));
    await expect(
      recommendationService().create(
        principal(),
        command(firstIntake.intakeId, {
          producerReference: { ...sourceReference(), requestFingerprintSha256: 'c'.repeat(64) }
        })
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
    await expect(
      recommendationService().get(principal(otherWorkspaceId), first.recommendationId)
    ).rejects.toMatchObject({ code: 'PRODUCTION_RECOMMENDATION_NOT_FOUND', status: 404 });
  });

  it('keeps Intake RECEIVED when source is unavailable, fee-only, or bound to another input', async () => {
    const unavailableIntake = await intakeService().create(
      principal(),
      intakeCommand('intake-unavailable-0757')
    );
    await expect(
      recommendationService(() =>
        Promise.resolve({
          status: 'UNAVAILABLE',
          retryable: true,
          code: 'CAPABILITY_SOURCE_READ_UNAVAILABLE',
          reason: 'Capability source is unavailable.'
        })
      ).create(
        principal(),
        command(unavailableIntake.intakeId, { idempotencyKey: 'recommendation-unavailable-0757' })
      )
    ).rejects.toMatchObject({
      code: 'RECOMMENDATION_SOURCE_UNAVAILABLE',
      status: 503,
      retryable: true
    });

    const feeIntake = await intakeService().create(principal(), intakeCommand('intake-fee-0757'));
    const feeSourceRead: RecommendationSourceReadResultV1 = {
      status: 'PRODUCTION_ADMISSIBLE',
      source: {
        ...source(),
        sourceId: 'official-fee-resolver',
        sourceVersion: '2.0.0|runtime:runtime-capability_uspto-official-fee-resolver@2'
      },
      producerReference: sourceReference('fee')
    };
    await expect(
      recommendationService(() => Promise.resolve(feeSourceRead)).create(
        principal(),
        command(feeIntake.intakeId, {
          idempotencyKey: 'recommendation-fee-0757',
          producerReference: sourceReference('fee')
        })
      )
    ).rejects.toMatchObject({ code: 'SOURCE_NOT_RECOMMENDATION_CAPABLE', status: 422 });

    const wrongIntake = await intakeService().create(
      principal(),
      intakeCommand('intake-wrong-0757')
    );
    const wrong = sourceRead(wrongIntake.input);
    if (wrong.status !== 'PRODUCTION_ADMISSIBLE' || !wrong.recommendationMaterial)
      throw new Error('fixture');
    const wrongRead = {
      ...wrong,
      recommendationMaterial: {
        ...wrong.recommendationMaterial,
        analyzedInputFingerprintSha256: 'f'.repeat(64)
      }
    } as RecommendationSourceReadResultV1;
    await expect(
      recommendationService(() => Promise.resolve(wrongRead)).create(
        principal(),
        command(wrongIntake.intakeId, { idempotencyKey: 'recommendation-wrong-0757' })
      )
    ).rejects.toMatchObject({ code: 'SOURCE_INPUT_FINGERPRINT_MISMATCH', status: 409 });

    for (const intake of [unavailableIntake, feeIntake, wrongIntake]) {
      expect(await intakeService().get(principal(), intake.intakeId)).toMatchObject({
        version: 1,
        status: 'RECEIVED'
      });
    }
  });

  it('enforces create/read permissions and maps persistence unavailability', async () => {
    const createdIntake = await intakeService().create(principal(), intakeCommand());
    await expect(
      recommendationService().create(
        principal(workspaceId, ['workspace:read']),
        command(createdIntake.intakeId)
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });

    const unavailable = new PostgresProductionRecommendationService(
      { transact: () => Promise.reject(new Error('offline')) },
      { query: () => Promise.reject(new Error('offline')) } as never,
      { read: () => Promise.reject(new Error('must not reach source')) }
    );
    await expect(unavailable.get(principal(), 'recommendation_missing')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });
});
