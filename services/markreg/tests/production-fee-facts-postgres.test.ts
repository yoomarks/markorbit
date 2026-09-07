import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  parseProductionIntakeV1,
  type CreateProductionFeeFactsCommandV1,
  type CreateProductionIntakeCommandV1,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresProductionIntakeService } from '../src/production-intake.js';
import {
  PostgresProductionFeeFactsService,
  productionFeeFactsSha256
} from '../src/production-fee-facts.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const workspaceId = '64646464-6464-4646-8646-646464646464';
const otherWorkspaceId = '65656565-6565-4656-8656-656565656565';
let clock = 0;

const principal = (
  workspace = workspaceId,
  permissions: WorkspacePrincipal['permissions'] = [
    'workspace:read',
    'matter:create',
    'review:perform'
  ]
): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0944_pg',
  userId: 'user_task0944_pg',
  workspaceId: workspace,
  membershipId: 'membership_task0944_pg',
  role: 'WORKSPACE_ADMIN',
  permissions,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const intakeCommand = (): CreateProductionIntakeCommandV1 => ({
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Record exact fee-driving facts before Quote.',
    applicant: { type: 'ORGANIZATION', name: 'Fee Facts Orbit LLC', country: 'US' },
    trademark: { type: 'WORD', representationText: 'FEE FACTS ORBIT' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Software and software services.' },
    filingGoal: 'Prepare a bounded US application quote.'
  },
  idempotencyKey: 'production-intake-task0944',
  correlationId: 'correlation_task0944_intake'
});

const feeCommand = (
  intake: ProductionIntakeV1,
  overrides: Partial<CreateProductionFeeFactsCommandV1> = {}
): CreateProductionFeeFactsCommandV1 => ({
  schemaVersion: 1,
  intakeId: intake.intakeId,
  expectedIntakeVersion: intake.version,
  filingBasis: 'SECTION_1',
  niceClasses: [9, 42],
  filingBasisSourceClass: 'CUSTOMER_SUPPLIED',
  classSelectionSourceClass: 'CUSTOMER_SUPPLIED',
  idempotencyKey: 'production-fee-facts-task0944',
  correlationId: 'correlation_task0944_fee-facts',
  ...overrides
});

suite('PostgreSQL Production fee facts', () => {
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
    new PostgresProductionIntakeService(
      database,
      database.getPool(),
      () => '2026-09-07T05:00:00.000Z'
    );
  const feeService = () =>
    new PostgresProductionFeeFactsService(database, database.getPool(), () => {
      clock += 1;
      return `2026-09-07T05:0${clock}:00.000Z`;
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
    clock = 0;
    await database.getPool().query(`TRUNCATE
      markreg_production_fee_fact_audit,
      markreg_production_fee_fact_commands,
      markreg_production_fee_fact_state_events,
      markreg_production_fee_facts,
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

  it('persists exact Intake lineage and replays idempotently across restart', async () => {
    const intake = await intakeService().create(principal(), intakeCommand());
    const command = feeCommand(intake);
    const created = await feeService().create(principal(), command);

    expect(created).toMatchObject({
      workspaceId,
      version: 1,
      currentness: 'CURRENT',
      intake: { id: intake.intakeId, version: 1, fingerprintSha256: intake.fingerprintSha256 },
      filingBasis: 'SECTION_1',
      niceClasses: [9, 42],
      classCount: 2,
      authorityConsequences: noEarlyFunnelAuthorityConsequences
    });
    expect(created.filingBasisProvenance).toMatchObject({
      sourceClass: 'CUSTOMER_SUPPLIED',
      actorId: principal().userId,
      membershipId: principal().membershipId
    });
    const { fingerprintSha256: ignored, currentness: ignoredCurrentness, ...immutable } = created;
    void ignored;
    void ignoredCurrentness;
    expect(created.fingerprintSha256).toBe(productionFeeFactsSha256(immutable));

    expect(await feeService().create(principal(), command)).toEqual(created);
    expect(await feeService().getCurrent(principal(), intake.intakeId, intake.version)).toEqual(
      created
    );
    const counts = await database.getPool().query(`SELECT
      (SELECT count(*)::int FROM markreg_production_fee_facts) AS facts,
      (SELECT count(*)::int FROM markreg_production_fee_fact_state_events) AS events,
      (SELECT count(*)::int FROM markreg_production_fee_fact_commands) AS commands,
      (SELECT count(*)::int FROM markreg_early_funnel_quotes) AS quotes`);
    expect(counts.rows[0]).toEqual({ facts: 1, events: 1, commands: 1, quotes: 0 });
  });

  it('supersedes prior current facts through append-only events and preserves immutable history', async () => {
    const intake = await intakeService().create(principal(), intakeCommand());
    const service = feeService();
    const first = await service.create(principal(), feeCommand(intake));
    const second = await service.create(
      principal(),
      feeCommand(intake, {
        filingBasis: 'SECTION_44',
        niceClasses: [35, 42],
        idempotencyKey: 'production-fee-facts-task0944-second',
        correlationId: 'correlation_task0944_fee-facts-second'
      })
    );
    expect(await service.getCurrent(principal(), intake.intakeId, 1)).toEqual(second);
    const events = await database.getPool().query(
      `SELECT fee_facts_id,state,superseding_fee_facts_id
       FROM markreg_production_fee_fact_state_events ORDER BY state_event_id`
    );
    expect(events.rows).toEqual([
      { fee_facts_id: first.feeFactsId, state: 'CURRENT', superseding_fee_facts_id: null },
      {
        fee_facts_id: first.feeFactsId,
        state: 'SUPERSEDED',
        superseding_fee_facts_id: second.feeFactsId
      },
      { fee_facts_id: second.feeFactsId, state: 'CURRENT', superseding_fee_facts_id: null }
    ]);
    await expect(
      database.getPool().query(
        `UPDATE markreg_production_fee_facts SET filing_basis='SECTION_44'
         WHERE workspace_id=$1 AND fee_facts_id=$2`,
        [workspaceId, first.feeFactsId]
      )
    ).rejects.toBeTruthy();
  });

  it('fails closed on Intake drift, cross-Workspace reads and untrusted professional provenance', async () => {
    const intake = await intakeService().create(principal(), intakeCommand());
    const service = feeService();
    await service.create(principal(), feeCommand(intake));

    await expect(
      service.getCurrent(principal(otherWorkspaceId), intake.intakeId, 1)
    ).rejects.toMatchObject({
      code: 'PRODUCTION_INTAKE_NOT_FOUND',
      status: 404
    });
    await expect(
      service.create(
        principal(workspaceId, ['workspace:read', 'matter:create']),
        feeCommand(intake, {
          filingBasisSourceClass: 'PROFESSIONALLY_ESTABLISHED',
          idempotencyKey: 'professional-without-review-task0944'
        })
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });

    const { fingerprintSha256: ignored, ...nextBase } = intake;
    void ignored;
    const next = parseProductionIntakeV1({
      ...nextBase,
      version: 2,
      updatedAt: '2026-09-07T05:30:00.000Z',
      fingerprintSha256: productionFeeFactsSha256({
        ...nextBase,
        version: 2,
        updatedAt: '2026-09-07T05:30:00.000Z'
      })
    });
    await database.getPool().query(
      `INSERT INTO markreg_early_funnel_intakes (
        workspace_id,intake_id,version,status,channel,relationship_model,source_class,
        input_snapshot,fingerprint_sha256,intake_record,created_by,created_at,updated_at
       ) VALUES ($1,$2,2,$3,$4,$5,'CUSTOMER_SUPPLIED',$6::jsonb,$7,$8::jsonb,$9,$10,$11)`,
      [
        workspaceId,
        next.intakeId,
        next.status,
        next.channel,
        next.relationshipModel,
        JSON.stringify(next.input),
        next.fingerprintSha256,
        JSON.stringify(next),
        principal().userId,
        next.createdAt,
        next.updatedAt
      ]
    );
    await expect(service.getCurrent(principal(), intake.intakeId, 1)).rejects.toMatchObject({
      code: 'PRODUCTION_INTAKE_VERSION_CONFLICT',
      status: 409
    });
  });
});
