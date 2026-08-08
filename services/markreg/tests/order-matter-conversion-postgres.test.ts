import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ROLE_PERMISSION_MATRIX, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  CommercialSourceSnapshot,
  CreateMatterFromOrderCommand,
  CreateOrderCommand
} from '@markorbit/contracts/order';
import { ManagedDatabase } from '@markorbit/persistence';
import {
  OrderMatterConversionError,
  PostgresOrderMatterConversionService
} from '../src/order-matter-conversion.js';
import { PostgresOrderRepository } from '../src/order-persistence.js';
import { InMemoryOrderCommercialSourceProvider, OrderService } from '../src/order-service.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_ORDER_MATTER_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MARKREG_TEST_DATABASE_URL is required when MARKREG_ORDER_MATTER_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const WORKSPACE = '44444444-4444-4444-8444-444444444444';
const OTHER_WORKSPACE = '66666666-6666-4666-8666-666666666666';
const SOURCE_AT = '2026-08-08T10:00:00.000Z';
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');

const principal = (workspaceId = WORKSPACE): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_wp04',
  userId: 'user_wp04',
  workspaceId,
  membershipId: 'membership_wp04',
  role: 'MATTER_MANAGER',
  permissions: ROLE_PERMISSION_MATRIX.MATTER_MANAGER,
  sessionExpiresAt: '2026-08-09T00:00:00.000Z'
});

const commercialSource = (suffix: string): CommercialSourceSnapshot => ({
  schemaVersion: 1,
  quote: {
    quoteId: `quote_wp04-${suffix}`,
    quoteVersion: 'quote-v4',
    currency: 'USD',
    totalMinor: 88000
  },
  customerConfirmation: {
    confirmationId: `confirmation_wp04-${suffix}`,
    confirmationVersion: 3,
    status: 'CONFIRMED'
  },
  customerId: `customer_wp04-${suffix}`,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  commercialScope: {
    applicantReference: `applicant:${suffix}`,
    trademarkReference: `mark:${suffix}`,
    jurisdictionReference: 'US',
    classNumbers: [9, 42],
    goodsServices: ['downloadable software', 'software as a service'],
    selectedPlanId: `plan_wp04-${suffix}`,
    selectedPlanVersion: 'plan-v2'
  },
  relationshipReferences: {
    contractingParty: { referenceId: 'party_markreg' },
    paymentReceiver: { referenceId: 'party_receiver' },
    deliveryOwner: { referenceId: 'team_delivery' },
    communicationOwner: { referenceId: 'team_care' },
    customerFacingBrand: { referenceId: 'brand_markreg' }
  },
  sourceCorrelationId: `correlation_wp04-${suffix}`,
  sourceSha256: 'a'.repeat(64),
  capturedAt: SOURCE_AT
});

const createCommand = (source: CommercialSourceSnapshot, key: string): CreateOrderCommand => ({
  workspaceId: WORKSPACE,
  orderType: 'TrademarkFiling',
  quoteId: source.quote.quoteId,
  expectedQuoteVersion: source.quote.quoteVersion,
  customerConfirmationId: source.customerConfirmation.confirmationId,
  expectedCustomerConfirmationVersion: source.customerConfirmation.confirmationVersion,
  channel: source.channel,
  relationshipModel: source.relationshipModel,
  idempotencyKey: key
});

suite.sequential('M3-WP-04 atomic governed Order-to-Matter conversion', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-order-matter-test',
    poolMaximum: 12,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  let sequence = 0;
  const now = () => new Date(Date.parse(SOURCE_AT) + sequence++ * 60_000).toISOString();

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory,
      migrationOwners
    });
  });

  beforeEach(async () => {
    await database.getPool().query(`
      DROP TRIGGER IF EXISTS wp04_fail_formal_matter ON formal_matters;
      DROP TRIGGER IF EXISTS wp04_fail_order_audit ON order_audit;
      DROP FUNCTION IF EXISTS wp04_fail_formal_matter() CASCADE;
      DROP FUNCTION IF EXISTS wp04_fail_order_audit() CASCADE;
      TRUNCATE formal_matter_audit,formal_matter_commands,formal_matters,
               order_audit,order_commands,orders,matter_drafts,customer_confirmations
               RESTART IDENTITY CASCADE;
    `);
    sequence = 0;
  });

  afterAll(() => database.close());

  async function seedCommercialTruth(source: CommercialSourceSnapshot) {
    const acceptedSnapshot = {
      schemaVersion: 1,
      quoteId: source.quote.quoteId,
      quoteVersion: source.quote.quoteVersion,
      planId: source.commercialScope.selectedPlanId,
      planVersion: source.commercialScope.selectedPlanVersion,
      currency: source.quote.currency,
      totalMinor: source.quote.totalMinor,
      lineItems: [],
      termsVersion: 'terms-v1',
      acknowledgementCodes: ['SCOPE_CONFIRMED'],
      selectedOptionCode: 'B',
      recommendationId: `recommendation_${source.quote.quoteId}`,
      assumptions: [],
      limitations: []
    };
    await database.getPool().query(
      `INSERT INTO customer_confirmations(
        confirmation_id,workspace_id,source_quote_id,source_quote_version,status,version,
        snapshot_schema_version,source_snapshot,source_snapshot_hash,accepted_at,updated_at,withdrawn_at
      ) VALUES($1,$2,$3,$4,'CONFIRMED',$5,1,$6::jsonb,$7,$8,$8,NULL)`,
      [
        source.customerConfirmation.confirmationId,
        WORKSPACE,
        source.quote.quoteId,
        source.quote.quoteVersion,
        source.customerConfirmation.confirmationVersion,
        JSON.stringify(acceptedSnapshot),
        'b'.repeat(64),
        SOURCE_AT
      ]
    );
    const preparation = {
      applicantName: `Applicant ${source.customerId}`,
      applicantAddress: '1 Orbit Way',
      trademark: source.commercialScope.trademarkReference,
      targetJurisdiction: source.commercialScope.jurisdictionReference,
      classes: [...source.commercialScope.classNumbers],
      goodsServices: source.commercialScope.goodsServices.join('; '),
      filingBasis: 'INTENT_TO_USE',
      representativeRequired: false,
      documentReferences: ['document_scope-confirmation'],
      commercialScopeUnchanged: true
    };
    const readiness = {
      evaluatedAt: SOURCE_AT,
      checks: [],
      readyForProfessionalReview: true
    };
    await database.getPool().query(
      `INSERT INTO matter_drafts(
        matter_draft_id,workspace_id,customer_confirmation_id,customer_confirmation_version,
        source_quote_id,source_quote_version,preparation,instruction_completeness,document_readiness,
        readiness,missing_information,status,version,created_at,updated_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'COMPLETE','READY',$8::jsonb,'[]'::jsonb,
        'READY_FOR_PROFESSIONAL_REVIEW',7,$9,$9)`,
      [
        `matter-draft_wp04-${source.customerId}`,
        WORKSPACE,
        source.customerConfirmation.confirmationId,
        source.customerConfirmation.confirmationVersion,
        source.quote.quoteId,
        source.quote.quoteVersion,
        JSON.stringify(preparation),
        JSON.stringify(readiness),
        SOURCE_AT
      ]
    );
  }

  async function createReadyOrder(suffix: string) {
    const source = commercialSource(suffix);
    await seedCommercialTruth(source);
    const sources = new InMemoryOrderCommercialSourceProvider();
    sources.put(WORKSPACE, source);
    const repository = new PostgresOrderRepository(database, database.getPool());
    const service = new OrderService(repository, sources, now, () => `order_wp04-${suffix}`);
    const draft = await service.create(
      principal(),
      createCommand(source, `create-${suffix}`),
      `correlation_create-${suffix}`
    );
    const pending = await service.requestConfirmation(principal(), {
      workspaceId: WORKSPACE,
      orderId: draft.orderId,
      expectedVersion: 1,
      idempotencyKey: `pending-${suffix}`
    });
    const confirmed = await service.confirm(principal(), {
      workspaceId: WORKSPACE,
      orderId: pending.orderId,
      expectedVersion: 2,
      idempotencyKey: `confirm-${suffix}`
    });
    const ready = await service.evaluateReadiness(principal(), {
      workspaceId: WORKSPACE,
      orderId: confirmed.orderId,
      expectedVersion: 3,
      idempotencyKey: `ready-${suffix}`
    });
    return { source, ready, repository };
  }

  const conversionCommand = (
    ready: Awaited<ReturnType<typeof createReadyOrder>>['ready'],
    key: string
  ): CreateMatterFromOrderCommand => ({
    workspaceId: WORKSPACE,
    orderId: ready.orderId,
    expectedOrderVersion: ready.version,
    expectedCommercialSourceSha256: ready.source.snapshotSha256,
    idempotencyKey: key
  });

  it('commits Matter, Order link, command results and both audits as one governed result', async () => {
    const { ready, repository } = await createReadyOrder('forward');
    const service = new PostgresOrderMatterConversionService(
      database,
      database.getPool(),
      now,
      () => 'formal-matter_wp04-forward'
    );
    const command = conversionCommand(ready, 'convert-forward');
    const converted = await service.createMatterFromOrder(
      principal(),
      command,
      'correlation_convert-forward'
    );
    expect(converted).toEqual({
      orderId: ready.orderId,
      orderStatus: 'MatterCreated',
      orderVersion: 5,
      formalMatterId: 'formal-matter_wp04-forward',
      formalMatterVersion: 1,
      linkKind: 'CREATED_FROM_ORDER',
      linkedAt: expect.any(String)
    });
    const storedOrder = await repository.findById(WORKSPACE, ready.orderId);
    expect(storedOrder).toMatchObject({
      status: 'MatterCreated',
      version: 5,
      matter: {
        formalMatterId: 'formal-matter_wp04-forward',
        formalMatterVersion: 1,
        linkKind: 'CREATED_FROM_ORDER'
      }
    });
    const counts = await database.getPool().query(`
      SELECT
        (SELECT count(*)::int FROM formal_matters) AS matters,
        (SELECT count(*)::int FROM formal_matter_commands) AS matter_commands,
        (SELECT count(*)::int FROM formal_matter_audit) AS matter_audits,
        (SELECT count(*)::int FROM order_commands WHERE idempotency_key='convert-forward') AS conversion_commands,
        (SELECT count(*)::int FROM order_audit WHERE action='ORDER_MATTER_LINKED') AS link_audits
    `);
    expect(counts.rows[0]).toEqual({
      matters: 1,
      matter_commands: 1,
      matter_audits: 1,
      conversion_commands: 1,
      link_audits: 1
    });
  });

  it('returns exact replay after restart and rejects different input under the same key', async () => {
    const { ready } = await createReadyOrder('replay');
    const command = conversionCommand(ready, 'convert-replay');
    const service = new PostgresOrderMatterConversionService(
      database,
      database.getPool(),
      now,
      () => 'formal-matter_wp04-replay'
    );
    const first = await service.createMatterFromOrder(principal(), command);
    const fresh = new ManagedDatabase({
      connection: { url: url! },
      applicationName: 'markreg-order-matter-reconnect',
      poolMaximum: 2,
      connectionTimeoutMs: 2000,
      idleTimeoutMs: 2000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
    });
    await fresh.start();
    try {
      const reconnect = new PostgresOrderMatterConversionService(fresh, fresh.getPool(), now);
      expect(await reconnect.createMatterFromOrder(principal(), command)).toEqual(first);
      await expect(
        reconnect.createMatterFromOrder(principal(), {
          ...command,
          expectedOrderVersion: command.expectedOrderVersion + 1
        })
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    } finally {
      await fresh.close();
    }
  });

  it('serializes concurrent identical conversion so both callers observe one Matter', async () => {
    const { ready } = await createReadyOrder('concurrent');
    const command = conversionCommand(ready, 'convert-concurrent');
    let generated = 0;
    const service = new PostgresOrderMatterConversionService(
      database,
      database.getPool(),
      now,
      () => `formal-matter_wp04-concurrent-${++generated}`
    );
    const [left, right] = await Promise.all([
      service.createMatterFromOrder(principal(), command),
      service.createMatterFromOrder(principal(), command)
    ]);
    expect(left).toEqual(right);
    expect(
      Number(
        (await database.getPool().query('SELECT count(*) AS count FROM formal_matters')).rows[0]
          .count
      )
    ).toBe(1);
  });

  it('rejects stale Order version or source hash before writing conversion truth', async () => {
    const { ready, repository } = await createReadyOrder('stale');
    const service = new PostgresOrderMatterConversionService(database, database.getPool(), now);
    const base = conversionCommand(ready, 'convert-stale-version');
    await expect(
      service.createMatterFromOrder(principal(), { ...base, expectedOrderVersion: 3 })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await expect(
      service.createMatterFromOrder(principal(), {
        ...base,
        idempotencyKey: 'convert-stale-source',
        expectedCommercialSourceSha256: 'f'.repeat(64)
      })
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
    expect((await repository.findById(WORKSPACE, ready.orderId))?.status).toBe('ReadyForMatter');
    expect(
      Number(
        (await database.getPool().query('SELECT count(*) AS count FROM formal_matters')).rows[0]
          .count
      )
    ).toBe(0);
  });

  it('rolls back the Order when Formal Matter creation fails', async () => {
    const { ready, repository } = await createReadyOrder('matter-failure');
    await database.getPool().query(`
      CREATE FUNCTION wp04_fail_formal_matter() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected formal matter failure'; END $$;
      CREATE TRIGGER wp04_fail_formal_matter BEFORE INSERT ON formal_matters
      FOR EACH ROW EXECUTE FUNCTION wp04_fail_formal_matter();
    `);
    const service = new PostgresOrderMatterConversionService(database, database.getPool(), now);
    await expect(
      service.createMatterFromOrder(principal(), conversionCommand(ready, 'convert-matter-failure'))
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' });
    expect((await repository.findById(WORKSPACE, ready.orderId))?.status).toBe('ReadyForMatter');
    expect(
      Number(
        (await database.getPool().query('SELECT count(*) AS count FROM formal_matters')).rows[0]
          .count
      )
    ).toBe(0);
  });

  it('rolls back newly created Matter when Order link audit fails', async () => {
    const { ready, repository } = await createReadyOrder('audit-failure');
    await database.getPool().query(`
      CREATE FUNCTION wp04_fail_order_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.action = 'ORDER_MATTER_LINKED' THEN
          RAISE EXCEPTION 'injected order link audit failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER wp04_fail_order_audit BEFORE INSERT ON order_audit
      FOR EACH ROW EXECUTE FUNCTION wp04_fail_order_audit();
    `);
    const service = new PostgresOrderMatterConversionService(
      database,
      database.getPool(),
      now,
      () => 'formal-matter_wp04-rolled-back'
    );
    await expect(
      service.createMatterFromOrder(principal(), conversionCommand(ready, 'convert-audit-failure'))
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' });
    expect((await repository.findById(WORKSPACE, ready.orderId))?.status).toBe('ReadyForMatter');
    const counts = await database.getPool().query(`
      SELECT
        (SELECT count(*)::int FROM formal_matters) AS matters,
        (SELECT count(*)::int FROM formal_matter_commands) AS matter_commands,
        (SELECT count(*)::int FROM formal_matter_audit) AS matter_audits,
        (SELECT count(*)::int FROM order_commands WHERE idempotency_key='convert-audit-failure') AS conversion_commands
    `);
    expect(counts.rows[0]).toEqual({
      matters: 0,
      matter_commands: 0,
      matter_audits: 0,
      conversion_commands: 0
    });
  });

  async function insertCompatibilityMatter(
    ready: Awaited<ReturnType<typeof createReadyOrder>>['ready'],
    formalMatterId: string,
    workspaceId: string
  ) {
    const order = (
      await database
        .getPool()
        .query('SELECT commercial_source_snapshot FROM orders WHERE order_id=$1', [ready.orderId])
    ).rows[0].commercial_source_snapshot as CommercialSourceSnapshot;
    const draft = (
      await database
        .getPool()
        .query('SELECT * FROM matter_drafts WHERE customer_confirmation_id=$1', [
          order.customerConfirmation.confirmationId
        ])
    ).rows[0] as Record<string, unknown>;
    const snapshot = {
      schemaVersion: 1,
      customerConfirmation: {
        id: order.customerConfirmation.confirmationId,
        version: order.customerConfirmation.confirmationVersion,
        status: 'CONFIRMED'
      },
      quote: {
        id: order.quote.quoteId,
        version: order.quote.quoteVersion,
        currency: order.quote.currency,
        totalMinor: order.quote.totalMinor
      },
      matterDraft: {
        id: String(draft.matter_draft_id),
        version: Number(draft.version),
        status: 'READY_FOR_PROFESSIONAL_REVIEW',
        readiness: draft.readiness
      },
      preparation: draft.preparation
    };
    await database.getPool().query(
      `INSERT INTO formal_matters(
        formal_matter_id,workspace_id,kind,status,version,source_customer_confirmation_id,
        source_customer_confirmation_version,source_matter_draft_id,source_matter_draft_version,
        source_quote_id,source_quote_version,source_snapshot,snapshot_schema_version,snapshot_sha256,
        created_by_user_id,created_at,updated_at
      ) VALUES($1,$2,'TRADEMARK_REGISTRATION','OPEN',1,$3,$4,$5,$6,$7,$8,$9::jsonb,1,$10,$11,$12,$12)`,
      [
        formalMatterId,
        workspaceId,
        order.customerConfirmation.confirmationId,
        order.customerConfirmation.confirmationVersion,
        String(draft.matter_draft_id),
        Number(draft.version),
        order.quote.quoteId,
        order.quote.quoteVersion,
        JSON.stringify(snapshot),
        'c'.repeat(64),
        principal().userId,
        SOURCE_AT
      ]
    );
  }

  it('links a same-Workspace pre-M3 Matter only when exact lineage matches', async () => {
    const { ready, repository } = await createReadyOrder('compatibility');
    await insertCompatibilityMatter(ready, 'formal-matter_wp04-existing', WORKSPACE);
    const service = new PostgresOrderMatterConversionService(database, database.getPool(), now);
    const linked = await service.linkExistingMatter(principal(), {
      workspaceId: WORKSPACE,
      orderId: ready.orderId,
      expectedOrderVersion: 4,
      formalMatterId: 'formal-matter_wp04-existing',
      expectedFormalMatterVersion: 1,
      expectedCommercialSourceSha256: ready.source.snapshotSha256,
      idempotencyKey: 'link-existing'
    });
    expect(linked).toMatchObject({
      orderStatus: 'MatterCreated',
      orderVersion: 5,
      formalMatterId: 'formal-matter_wp04-existing',
      linkKind: 'COMPATIBILITY_LINK'
    });
    expect(await repository.findById(WORKSPACE, ready.orderId)).toMatchObject({
      status: 'MatterCreated',
      matter: { formalMatterId: 'formal-matter_wp04-existing', linkKind: 'COMPATIBILITY_LINK' }
    });
  });

  it('conceals a cross-Workspace compatibility Matter and leaves Order unchanged', async () => {
    const { ready, repository } = await createReadyOrder('cross-workspace');
    await insertCompatibilityMatter(ready, 'formal-matter_wp04-other-workspace', OTHER_WORKSPACE);
    const service = new PostgresOrderMatterConversionService(database, database.getPool(), now);
    const command = {
      workspaceId: WORKSPACE,
      orderId: ready.orderId,
      expectedOrderVersion: 4,
      formalMatterId: 'formal-matter_wp04-other-workspace',
      expectedFormalMatterVersion: 1,
      expectedCommercialSourceSha256: ready.source.snapshotSha256,
      idempotencyKey: 'link-cross-workspace'
    } as const;
    await expect(service.linkExistingMatter(principal(), command)).rejects.toEqual(
      expect.objectContaining({
        code: 'FORMAL_MATTER_NOT_FOUND',
        message: 'Formal Matter was not found.'
      })
    );
    expect((await repository.findById(WORKSPACE, ready.orderId))?.status).toBe('ReadyForMatter');
  });

  it('maps a database outage without leaking driver details', async () => {
    const service = new PostgresOrderMatterConversionService(
      {
        transact: () => Promise.reject(new Error('secret database driver detail'))
      },
      {
        query: () => Promise.reject(new Error('secret database driver detail'))
      }
    );
    const source = commercialSource('outage');
    const command: CreateMatterFromOrderCommand = {
      workspaceId: WORKSPACE,
      orderId: 'order_wp04-outage',
      expectedOrderVersion: 4,
      expectedCommercialSourceSha256: 'd'.repeat(64),
      idempotencyKey: 'convert-outage'
    };
    await service
      .createMatterFromOrder(principal(), command)
      .catch((error: OrderMatterConversionError) => {
        expect(error.code).toBe('PERSISTENCE_UNAVAILABLE');
        expect(error.message).not.toContain('secret database driver detail');
      });
    expect(source.customerId).toContain('outage');
  });
});
