import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CreateProductionIntakeCommandV1 } from '@markorbit/contracts/markreg-early-funnel';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresCommercialCatalogRepository } from '../src/commercial-checkout-postgres.js';
import { PostgresProductionIntakeService } from '../src/production-intake.js';
import {
  MARKREG_SERVICE_PRICING_SOURCE_ID,
  ProductionServicePricingSourceService,
  productionServicePricingSourceSha256
} from '../src/production-service-pricing-source.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_SERVICE_PRICING_SOURCE_POSTGRES_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'MARKREG_TEST_DATABASE_URL is required in service-pricing source PostgreSQL mode.'
  );
}
const suite = url ? describe : describe.skip;
const workspaceId = '60606060-6060-4606-8606-606060606060';
const otherWorkspaceId = '61616161-6161-4616-8616-616161616161';
const createdAt = '2026-09-07T12:00:00.000Z';
const checkedAt = '2026-09-07T12:30:00.000Z';

const principal = (workspace = workspaceId): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0946_pg',
  userId: 'user_task0946_pg',
  workspaceId: workspace,
  membershipId: 'membership_task0946_pg',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:create', 'order:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const intakeCommand = (key = 'production-intake-task0946'): CreateProductionIntakeCommandV1 => ({
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Prepare governed commercial service pricing.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Pricing LLC', country: 'US' },
    trademark: { type: 'WORD', representationText: 'ORBIT PRICE' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Trademark portfolio software.' },
    filingGoal: 'Review the service price separately from official fees.'
  },
  idempotencyKey: key,
  correlationId: 'correlation_task0946_intake'
});

suite('PostgreSQL Production Service Pricing Source', () => {
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

  const intakeService = (db = database) =>
    new PostgresProductionIntakeService(db, db.getPool(), () => createdAt);
  const pricingService = (db = database) =>
    new ProductionServicePricingSourceService(
      intakeService(db),
      new PostgresCommercialCatalogRepository(db, db.getPool()),
      () => checkedAt
    );

  async function seedCommercialState() {
    await database.getPool().query(
      `INSERT INTO commercial_products(
        product_id,code,name,service_type,status,version,created_at,updated_at
       ) VALUES(
        'product_trademark-filing','TRADEMARK_FILING','Trademark filing',
        'TrademarkFiling','ACTIVE',1,'2026-09-01T00:00:00.000Z','2026-09-01T00:00:00.000Z'
       )`
    );
    await database.getPool().query(
      `INSERT INTO commercial_prices(
        price_id,product_id,price_version,channel,relationship_model,amount_minor,currency,
        status,valid_from,valid_until,created_at
       ) VALUES(
        'price_direct-filing-v1','product_trademark-filing',1,'MARKREG_DIRECT','DIRECT',
        29900,'USD','ACTIVE','2026-09-01T00:00:00.000Z',NULL,'2026-09-01T00:00:00.000Z'
       )`
    );
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
    await database.getPool().query(
      `TRUNCATE
        markreg_early_funnel_audit,
        markreg_early_funnel_commands,
        markreg_early_funnel_quote_state_events,
        markreg_early_funnel_quotes,
        markreg_early_funnel_selection_state_events,
        markreg_early_funnel_selections,
        markreg_early_funnel_recommendations,
        markreg_early_funnel_intakes,
        checkout_commands,
        checkout_sessions,
        commercial_prices,
        commercial_products,
        order_audit,
        order_commands,
        orders
       RESTART IDENTITY CASCADE`
    );
    await seedCommercialState();
  });

  afterAll(() => database.close());

  it('projects exact durable Product/Price truth and is identical after database reconnect', async () => {
    const created = await intakeService().create(principal(), intakeCommand());
    const request = {
      schemaVersion: 1 as const,
      intakeId: created.intakeId,
      expectedIntakeVersion: created.version,
      expectedIntakeFingerprintSha256: created.fingerprintSha256
    };
    const source = await pricingService().read(principal(), request);
    expect(source).toMatchObject({
      workspaceId,
      intake: {
        id: created.intakeId,
        version: created.version,
        fingerprintSha256: created.fingerprintSha256
      },
      source: {
        sourceId: MARKREG_SERVICE_PRICING_SOURCE_ID,
        sourceKind: 'PRICING_SOURCE',
        admissionClass: 'PRODUCTION_ADMISSIBLE',
        currentness: 'CURRENT',
        currentnessCheckedAt: checkedAt
      },
      material: {
        product: { productId: 'product_trademark-filing', version: 1 },
        price: {
          priceId: 'price_direct-filing-v1',
          priceVersion: 1,
          amount: { amountMinor: 29900, currency: 'USD' },
          channel: 'MARKREG_DIRECT',
          relationshipModel: 'DIRECT'
        }
      }
    });
    expect(source.source.fingerprintSha256).toBe(
      productionServicePricingSourceSha256({ intake: source.intake, material: source.material })
    );

    const fresh = new ManagedDatabase({
      connection: { url: url! },
      applicationName: 'markreg-service-pricing-source-reconnect',
      poolMaximum: 2,
      connectionTimeoutMs: 2000,
      idleTimeoutMs: 2000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
    });
    await fresh.start();
    try {
      expect(await pricingService(fresh).read(principal(), request)).toEqual(source);
    } finally {
      await fresh.close();
    }

    const consequences = await database.getPool().query(
      `SELECT
        (SELECT count(*)::int FROM markreg_early_funnel_quotes) AS quotes,
        (SELECT count(*)::int FROM checkout_sessions) AS checkouts,
        (SELECT count(*)::int FROM orders) AS orders`
    );
    expect(consequences.rows[0]).toEqual({ quotes: 0, checkouts: 0, orders: 0 });
  });

  it('fails closed on overlapping current commercial prices instead of choosing a version', async () => {
    const created = await intakeService().create(principal(), intakeCommand());
    await database.getPool().query(
      `INSERT INTO commercial_prices(
        price_id,product_id,price_version,channel,relationship_model,amount_minor,currency,
        status,valid_from,valid_until,created_at
       ) VALUES(
        'price_direct-filing-v2','product_trademark-filing',2,'MARKREG_DIRECT','DIRECT',
        31900,'USD','ACTIVE','2026-09-02T00:00:00.000Z',NULL,'2026-09-02T00:00:00.000Z'
       )`
    );
    await expect(
      pricingService().read(principal(), {
        schemaVersion: 1,
        intakeId: created.intakeId,
        expectedIntakeVersion: created.version,
        expectedIntakeFingerprintSha256: created.fingerprintSha256
      })
    ).rejects.toMatchObject({ code: 'AMBIGUOUS_SERVICE_PRICE', status: 409 });
  });

  it('fails closed when the only price is inactive or not applicable to Intake commercial context', async () => {
    const created = await intakeService().create(principal(), intakeCommand());
    const request = {
      schemaVersion: 1 as const,
      intakeId: created.intakeId,
      expectedIntakeVersion: created.version,
      expectedIntakeFingerprintSha256: created.fingerprintSha256
    };
    await database
      .getPool()
      .query(
        "UPDATE commercial_prices SET status='INACTIVE' WHERE price_id='price_direct-filing-v1'"
      );
    await expect(pricingService().read(principal(), request)).rejects.toMatchObject({
      code: 'SERVICE_PRICE_NOT_FOUND',
      status: 404
    });

    await database
      .getPool()
      .query(
        "UPDATE commercial_prices SET status='ACTIVE',relationship_model='WHITE_LABEL' WHERE price_id='price_direct-filing-v1'"
      );
    await expect(pricingService().read(principal(), request)).rejects.toMatchObject({
      code: 'SERVICE_PRICE_NOT_FOUND',
      status: 404
    });
  });

  it('binds exact Intake version/fingerprint and preserves cross-Workspace privacy', async () => {
    const created = await intakeService().create(principal(), intakeCommand());
    await expect(
      pricingService().read(principal(), {
        schemaVersion: 1,
        intakeId: created.intakeId,
        expectedIntakeVersion: created.version + 1,
        expectedIntakeFingerprintSha256: created.fingerprintSha256
      })
    ).rejects.toMatchObject({ code: 'INTAKE_VERSION_CONFLICT', status: 409 });
    await expect(
      pricingService().read(principal(otherWorkspaceId), {
        schemaVersion: 1,
        intakeId: created.intakeId,
        expectedIntakeVersion: created.version,
        expectedIntakeFingerprintSha256: created.fingerprintSha256
      })
    ).rejects.toMatchObject({ code: 'PRODUCTION_INTAKE_NOT_FOUND', status: 404 });

    const counts = await database.getPool().query(
      `SELECT
        (SELECT count(*)::int FROM markreg_early_funnel_quotes) AS quotes,
        (SELECT count(*)::int FROM checkout_sessions) AS checkouts`
    );
    expect(counts.rows[0]).toEqual({ quotes: 0, checkouts: 0 });
  });
});
