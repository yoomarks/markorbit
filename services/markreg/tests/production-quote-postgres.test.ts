import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  noRecommendationSourceAuthorityConsequences,
  parseRecommendationArtifactV1,
  type CreateProductionFeeFactsCommandV1,
  type CreateProductionIntakeCommandV1,
  type CreateProductionQuoteCommandV1,
  type CreateUserSelectionCommandV1,
  type ProductionIntakeV1,
  type RecommendationArtifactV1
} from '@markorbit/contracts/markreg-early-funnel';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresProductionIntakeService } from '../src/production-intake.js';
import {
  PostgresProductionRecommendationService,
  productionRecommendationSha256
} from '../src/production-recommendation.js';
import { PostgresProductionUserSelectionService } from '../src/production-user-selection.js';
import { PostgresProductionFeeFactsService } from '../src/production-fee-facts.js';
import { PostgresProductionQuoteServiceV1 } from '../src/production-quote.js';
import type { ProductionServicePricingSourceV1 } from '../src/production-service-pricing-source.js';
import type { ProductionOfficialFeeSourceV1 } from '../src/production-official-fee-source.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const workspaceId = '75757575-7575-4757-8757-757575757575';
const otherWorkspaceId = '76767676-7676-4767-8767-767676767676';
const intakeAt = '2026-09-15T04:00:00.000Z';
const recommendationAt = '2026-09-15T04:10:00.000Z';
const sourceAt = '2026-09-15T04:50:00.000Z';
let quoteClock = 0;

const principal = (workspace = workspaceId): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_wif06_quote_pg',
  userId: 'user_wif06_quote_pg',
  workspaceId: workspace,
  membershipId: 'membership_wif06_quote_pg',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:create', 'review:perform', 'order:read', 'order:create'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const intakeCommand = (): CreateProductionIntakeCommandV1 => ({
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Create one durable governed production Quote.',
    applicant: { type: 'ORGANIZATION', name: 'Quote Orbit LLC', country: 'US' },
    trademark: { type: 'WORD', representationText: 'QUOTE ORBIT' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Trademark portfolio software and related services.' },
    filingGoal: 'Prepare a bounded US filing quote for review.'
  },
  idempotencyKey: 'production-intake-wif06-quote-pg',
  correlationId: 'correlation_wif06_quote-intake-pg'
});

function recommendationFor(intake: ProductionIntakeV1): RecommendationArtifactV1 {
  const base: Omit<RecommendationArtifactV1, 'fingerprintSha256'> = {
    schemaVersion: 1,
    recommendationId: 'recommendation_wif06-quote-pg',
    workspaceId,
    version: 1,
    intake: {
      id: intake.intakeId,
      version: intake.version,
      fingerprintSha256: intake.fingerprintSha256
    },
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    source: {
      sourceKind: 'CAPABILITY_RESULT',
      sourceId: 'markreg.us-trademark-mark-representation-strategy-source',
      sourceVersion: '1.0.0|runtime:runtime-capability_wif06@1',
      fingerprintSha256: 'b'.repeat(64),
      admissionClass: 'PRODUCTION_ADMISSIBLE',
      currentness: 'CURRENT',
      currentnessCheckedAt: recommendationAt,
      provenanceRefs: ['capability-source:wif06-quote-pg'],
      assumptions: ['Customer-supplied facts remain accurate.'],
      limitations: ['Recommendation is advisory only.'],
      authorityConsequences: noRecommendationSourceAuthorityConsequences
    },
    options: [
      { code: 'A', title: 'A', description: 'Essential protection.' },
      { code: 'B', title: 'B', description: 'Balanced protection.' },
      { code: 'C', title: 'C', description: 'Extended protection.' }
    ],
    rationale: 'Bounded strategy recommendation for quote validation.',
    assumptions: [],
    limitations: ['No filing authority is created.'],
    provenanceRefs: ['production-intake:wif06-quote-pg'],
    generatedAt: recommendationAt,
    authorityConsequences: noEarlyFunnelAuthorityConsequences
  };
  return parseRecommendationArtifactV1({
    ...base,
    fingerprintSha256: productionRecommendationSha256(base)
  });
}

const selectionCommand = (recommendationId: string): CreateUserSelectionCommandV1 => ({
  schemaVersion: 1 as const,
  recommendationId: recommendationId as `recommendation_${string}`,
  expectedRecommendationVersion: 1,
  selectedOptionCode: 'B' as const,
  idempotencyKey: 'production-selection-wif06-quote-pg',
  correlationId: 'correlation_wif06_quote-selection-pg'
});

const feeCommand = (intake: ProductionIntakeV1): CreateProductionFeeFactsCommandV1 => ({
  schemaVersion: 1,
  intakeId: intake.intakeId,
  expectedIntakeVersion: intake.version,
  filingBasis: 'SECTION_1',
  niceClasses: [9, 42],
  filingBasisSourceClass: 'CUSTOMER_SUPPLIED',
  classSelectionSourceClass: 'CUSTOMER_SUPPLIED',
  idempotencyKey: 'production-fee-facts-wif06-quote-pg',
  correlationId: 'correlation_wif06_quote-fee-pg'
});

function servicePricing(intake: ProductionIntakeV1): ProductionServicePricingSourceV1 {
  return {
    schemaVersion: 1,
    workspaceId,
    intake: {
      id: intake.intakeId,
      version: intake.version,
      fingerprintSha256: intake.fingerprintSha256
    },
    source: {
      sourceKind: 'PRICING_SOURCE',
      sourceId: 'markreg.service-pricing.trademark-filing',
      sourceVersion: 'product:product_trademark-filing@3|price:price_direct@2',
      fingerprintSha256: 'e'.repeat(64),
      admissionClass: 'PRODUCTION_ADMISSIBLE',
      currentness: 'CURRENT',
      currentnessCheckedAt: sourceAt,
      provenanceRefs: ['commercial-price:price_direct@2'],
      assumptions: ['Exact commercial context remains applicable.'],
      limitations: ['Service fee only.']
    },
    material: {
      policyId: 'markreg.service-pricing-source.trademark-filing.v1',
      product: {
        productId: 'product_trademark-filing',
        version: 3,
        code: 'TRADEMARK_FILING',
        serviceType: 'TrademarkFiling'
      },
      price: {
        priceId: 'price_direct',
        priceVersion: 2,
        channel: 'MARKREG_DIRECT',
        relationshipModel: 'DIRECT',
        amount: { amountMinor: 29900, currency: 'USD' },
        status: 'ACTIVE',
        validFrom: '2026-09-01T00:00:00.000Z'
      }
    },
    authorityConsequences: noEarlyFunnelAuthorityConsequences
  };
}

function officialFee(
  intake: ProductionIntakeV1,
  facts: { feeFactsId: string; version: number; fingerprintSha256: string }
): ProductionOfficialFeeSourceV1 {
  return {
    schemaVersion: 1,
    workspaceId,
    intake: {
      id: intake.intakeId,
      version: intake.version,
      fingerprintSha256: intake.fingerprintSha256
    },
    feeFacts: {
      id: facts.feeFactsId as `fee-facts_${string}`,
      version: facts.version,
      fingerprintSha256: facts.fingerprintSha256
    },
    source: {
      sourceKind: 'PRICING_SOURCE',
      sourceId: 'resolver.uspto-official-fee-base-application-per-class',
      sourceVersion: '1.0.0|reference:official-fee-ref_wif06@4|evidence:source-evidence_wif06-pg',
      fingerprintSha256: '1'.repeat(64),
      admissionClass: 'PRODUCTION_ADMISSIBLE',
      currentness: 'CURRENT',
      currentnessCheckedAt: sourceAt,
      provenanceRefs: ['official-fee-reference:wif06-pg'],
      assumptions: ['Exact current fee facts remain applicable.'],
      limitations: ['Base application fee only.']
    },
    material: {
      filingBasis: 'SECTION_1',
      classCount: 2,
      feePerClass: { amountMinor: 35000, currency: 'USD' },
      totalOfficialFee: { amountMinor: 70000, currency: 'USD' },
      referenceId: 'official-fee-ref_wif06',
      referenceVersion: '4',
      effectiveFrom: '2025-01-18T00:00:00.000Z',
      productionEvidenceId: 'source-evidence_wif06-pg'
    },
    authorityConsequences: noEarlyFunnelAuthorityConsequences
  };
}

suite('PostgreSQL Production Quote', () => {
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
  const recommendationService = () =>
    new PostgresProductionRecommendationService(
      database,
      database.getPool(),
      { read: () => Promise.reject(new Error('Recommendation source read is not used by get().')) },
      () => recommendationAt
    );
  const selectionService = () =>
    new PostgresProductionUserSelectionService(
      database,
      database.getPool(),
      () => '2026-09-15T04:20:00.000Z'
    );
  const feeService = () =>
    new PostgresProductionFeeFactsService(
      database,
      database.getPool(),
      () => '2026-09-15T04:30:00.000Z'
    );

  async function persistRecommendation(intake: ProductionIntakeV1) {
    const recommendation = recommendationFor(intake);
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

  async function setupLineage() {
    const intake = await intakeService().create(principal(), intakeCommand());
    const recommendation = await persistRecommendation(intake);
    const selection = await selectionService().create(
      principal(),
      selectionCommand(recommendation.recommendationId)
    );
    const feeFacts = await feeService().create(principal(), feeCommand(intake));
    return { intake, recommendation, selection, feeFacts };
  }

  function quoteService(lineage: Awaited<ReturnType<typeof setupLineage>>) {
    return new PostgresProductionQuoteServiceV1(
      database,
      database.getPool(),
      {
        intakes: intakeService(),
        recommendations: recommendationService(),
        selections: selectionService(),
        servicePricing: { read: () => Promise.resolve(servicePricing(lineage.intake)) },
        officialFees: {
          resolve: () => Promise.resolve(officialFee(lineage.intake, lineage.feeFacts))
        }
      },
      () => {
        quoteClock += 1;
        return `2026-09-15T05:0${quoteClock}:00.000Z`;
      }
    );
  }
  const quoteCommand = (
    lineage: Awaited<ReturnType<typeof setupLineage>>,
    overrides: Partial<CreateProductionQuoteCommandV1> = {}
  ): CreateProductionQuoteCommandV1 => ({
    schemaVersion: 1,
    intakeId: lineage.intake.intakeId,
    expectedIntakeVersion: lineage.intake.version,
    recommendationId: lineage.recommendation.recommendationId,
    expectedRecommendationVersion: lineage.recommendation.version,
    selectionId: lineage.selection.selectionId,
    expectedSelectionVersion: lineage.selection.version,
    idempotencyKey: 'production-quote-wif06-pg',
    correlationId: 'correlation_wif06_quote-pg',
    ...overrides
  });

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });

  beforeEach(async () => {
    quoteClock = 0;
    await database.getPool().query(`TRUNCATE
      markreg_production_fee_fact_audit,
      markreg_production_fee_fact_commands,
      markreg_production_fee_fact_state_events,      markreg_production_fee_facts,
      markreg_early_funnel_audit,
      markreg_early_funnel_commands,
      markreg_early_funnel_quote_state_events,
      markreg_early_funnel_quotes,
      markreg_early_funnel_selection_state_events,
      markreg_early_funnel_selections,
      markreg_early_funnel_recommendations,
      markreg_early_funnel_intakes
      RESTART IDENTITY CASCADE`);
  });

  afterAll(() => database.close());

  it('persists and replays one exact governed Quote across service restart', async () => {
    const lineage = await setupLineage();
    const command = quoteCommand(lineage);
    const created = await quoteService(lineage).create(principal(), command);

    expect(created).toMatchObject({
      workspaceId,
      status: 'READY',
      estimatedOfficialFees: { amountMinor: 70000, currency: 'USD' },
      estimatedServiceFees: { amountMinor: 29900, currency: 'USD' },
      total: { amountMinor: 99900, currency: 'USD' },
      authorityConsequences: noEarlyFunnelAuthorityConsequences
    });
    const restarted = quoteService(lineage);
    expect(await restarted.create(principal(), command)).toEqual(created);
    expect(await restarted.get(principal(), created.quoteId)).toEqual(created);
    const counts = await database.getPool().query(`SELECT
      (SELECT count(*)::int FROM markreg_early_funnel_quotes) AS quotes,
      (SELECT count(*)::int FROM markreg_early_funnel_quote_state_events) AS events,
      (SELECT count(*)::int FROM markreg_early_funnel_commands WHERE command_type='CREATE_QUOTE') AS commands,
      (SELECT count(*)::int FROM markreg_early_funnel_audit WHERE entity_type='QUOTE') AS audits`);
    expect(counts.rows[0]).toEqual({ quotes: 1, events: 1, commands: 1, audits: 1 });
  });

  it('fails closed on idempotency conflict and cross-Workspace reads', async () => {
    const lineage = await setupLineage();
    const service = quoteService(lineage);
    const command = quoteCommand(lineage);
    const created = await service.create(principal(), command);

    await expect(
      service.create(principal(), { ...command, expectedSelectionVersion: 2 })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
    await expect(service.get(principal(otherWorkspaceId), created.quoteId)).rejects.toMatchObject({
      code: 'PRODUCTION_QUOTE_NOT_FOUND',
      status: 404
    });
  });

  it('supersedes the prior READY Quote using append-only state events', async () => {
    const lineage = await setupLineage();
    const service = quoteService(lineage);
    const first = await service.create(principal(), quoteCommand(lineage));
    const second = await service.create(
      principal(),
      quoteCommand(lineage, {
        idempotencyKey: 'production-quote-wif06-pg-second',
        correlationId: 'correlation_wif06_quote-pg-second'
      })
    );
    expect(second.supersedesQuoteId).toBe(first.quoteId);
    expect(await service.get(principal(), first.quoteId)).toMatchObject({
      quoteId: first.quoteId,
      status: 'SUPERSEDED'
    });
    expect(await service.get(principal(), second.quoteId)).toMatchObject({
      quoteId: second.quoteId,
      status: 'READY'
    });

    const events = await database.getPool().query(
      `SELECT quote_id,state,superseding_quote_id
       FROM markreg_early_funnel_quote_state_events ORDER BY state_event_id`
    );
    expect(events.rows).toEqual([
      { quote_id: first.quoteId, state: 'READY', superseding_quote_id: null },
      {
        quote_id: first.quoteId,
        state: 'SUPERSEDED',
        superseding_quote_id: second.quoteId
      },
      { quote_id: second.quoteId, state: 'READY', superseding_quote_id: null }
    ]);
    await expect(
      database.getPool().query(
        `UPDATE markreg_early_funnel_quotes SET currency='EUR'
         WHERE workspace_id=$1 AND quote_id=$2`,
        [workspaceId, first.quoteId]
      )
    ).rejects.toBeTruthy();
  });
  it('replays one durable Quote under concurrent identical creation', async () => {
    const lineage = await setupLineage();
    const command = quoteCommand(lineage, {
      idempotencyKey: 'production-quote-wif06-pg-concurrent',
      correlationId: 'correlation_wif06_quote-pg-concurrent'
    });
    const firstService = quoteService(lineage);
    const secondService = quoteService(lineage);
    const [first, second] = await Promise.all([
      firstService.create(principal(), command),
      secondService.create(principal(), command)
    ]);
    expect(second).toEqual(first);

    const counts = await database.getPool().query(`SELECT
      (SELECT count(*)::int FROM markreg_early_funnel_quotes) AS quotes,
      (SELECT count(*)::int FROM markreg_early_funnel_commands WHERE command_type='CREATE_QUOTE') AS commands`);
    expect(counts.rows[0]).toEqual({ quotes: 1, commands: 1 });
  });

  it('fails closed when a stored replay receipt is tampered', async () => {
    const lineage = await setupLineage();
    const command = quoteCommand(lineage, {
      idempotencyKey: 'production-quote-wif06-pg-tamper',
      correlationId: 'correlation_wif06_quote-pg-tamper'
    });
    const service = quoteService(lineage);
    await service.create(principal(), command);

    await database
      .getPool()
      .query('ALTER TABLE markreg_early_funnel_commands DISABLE TRIGGER USER');
    try {
      await database.getPool().query(
        `UPDATE markreg_early_funnel_commands
         SET response_data=jsonb_set(response_data,'{fingerprintSha256}',to_jsonb($3::text))
         WHERE workspace_id=$1 AND command_type='CREATE_QUOTE' AND idempotency_key=$2`,
        [workspaceId, command.idempotencyKey, 'f'.repeat(64)]
      );
    } finally {
      await database
        .getPool()
        .query('ALTER TABLE markreg_early_funnel_commands ENABLE TRIGGER USER');
    }

    await expect(service.create(principal(), command)).rejects.toMatchObject({
      code: 'PERSISTED_QUOTE_INTEGRITY_FAILURE',
      status: 500
    });
  });
});
