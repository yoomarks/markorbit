import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrationStatus
} from '@markorbit/persistence';
import { CommercialCheckoutService } from '../src/commercial-checkout.js';
import { PostgresCommercialCatalogRepository } from '../src/commercial-checkout-postgres.js';
import { PostgresOrderRepository } from '../src/order-persistence.js';
import {
  ORDER_WORKSPACE_ID,
  createFingerprint,
  orderAudit,
  orderFixture
} from './order-repository-contract.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_ORDER_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required when MARKREG_ORDER_POSTGRES_REQUIRED=1.');
const suite = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const now = '2026-08-15T12:00:00.000Z';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_commercial-test',
  userId: 'user_commercial-test',
  workspaceId: ORDER_WORKSPACE_ID,
  membershipId: 'membership_commercial-test',
  role: 'WORKSPACE_ADMIN',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-16T12:00:00.000Z'
};

suite.sequential('PostgreSQL commercial catalog and checkout', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-commercial-checkout-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });

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
        'TRUNCATE checkout_commands,checkout_sessions,commercial_prices,commercial_products,order_audit,order_commands,orders RESTART IDENTITY CASCADE'
      )
  );
  afterAll(() => database.close());

  async function seedCommercialState() {
    await database.getPool().query(
      `INSERT INTO commercial_products(product_id,code,name,service_type,status,version,created_at,updated_at)
       VALUES('product_trademark-filing','TRADEMARK_FILING','Trademark filing','TrademarkFiling','ACTIVE',1,$1,$1)`,
      [now]
    );
    await database.getPool().query(
      `INSERT INTO commercial_prices(
        price_id,product_id,price_version,channel,relationship_model,amount_minor,currency,status,valid_from,valid_until,created_at
       ) VALUES('price_direct-filing-v1','product_trademark-filing',1,'MARKREG_DIRECT','DIRECT',29900,'USD','ACTIVE','2026-08-01T00:00:00.000Z',NULL,'2026-08-01T00:00:00.000Z')`
    );
    const orderRepository = new PostgresOrderRepository(database, database.getPool());
    const value = orderFixture('commercial-checkout', {
      status: 'Confirmed',
      createdAt: now,
      updatedAt: now
    });
    const key = 'commercial-order-create';
    await orderRepository.createAtomically(
      value,
      key,
      createFingerprint(value, key),
      orderAudit(value, 'ORDER_CREATED')
    );
    return { orderRepository, order: value };
  }

  it('registers and applies the MarkReg-owned 0050 migration', async () => {
    const owned = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/markreg-service'
    );
    expect(owned.at(-1)?.version).toBe('0050');
    expect(
      (await migrationStatus(database.getPool(), MARKREG_TEST_MIGRATION_NAMESPACE, owned)).at(-1)
        ?.state
    ).toBe('applied');
    const relations = await database
      .getPool()
      .query(
        "SELECT to_regclass('commercial_products') products,to_regclass('commercial_prices') prices,to_regclass('checkout_sessions') checkouts,to_regclass('checkout_commands') commands"
      );
    expect(relations.rows[0]).toEqual({
      products: 'commercial_products',
      prices: 'commercial_prices',
      checkouts: 'checkout_sessions',
      commands: 'checkout_commands'
    });
  });

  it('reads governed catalog truth and persists an exact idempotent checkout', async () => {
    const { orderRepository, order } = await seedCommercialState();
    const repository = new PostgresCommercialCatalogRepository(database, database.getPool());
    const service = new CommercialCheckoutService(
      repository,
      orderRepository,
      () => now,
      () => 'checkout_commercial-1'
    );

    const catalog = await service.listCatalog(principal, ORDER_WORKSPACE_ID, {
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT'
    });
    expect(catalog).toMatchObject([
      {
        product: { productId: 'product_trademark-filing', status: 'ACTIVE', version: 1 },
        prices: [
          {
            priceId: 'price_direct-filing-v1',
            amount: { amountMinor: 29900, currency: 'USD' },
            status: 'ACTIVE'
          }
        ]
      }
    ]);

    const command = {
      workspaceId: ORDER_WORKSPACE_ID,
      orderId: order.orderId,
      productId: 'product_trademark-filing' as const,
      expectedProductVersion: 1,
      priceId: 'price_direct-filing-v1' as const,
      expectedPriceVersion: 1,
      idempotencyKey: 'commercial-checkout-create'
    };
    const created = await service.createCheckout(principal, command);
    expect(created).toMatchObject({
      checkoutSessionId: 'checkout_commercial-1',
      workspaceId: ORDER_WORKSPACE_ID,
      orderId: order.orderId,
      amount: { amountMinor: 29900, currency: 'USD' },
      status: 'INITIATED'
    });
    expect(await service.createCheckout(principal, command)).toEqual(created);
  });

  it('reloads checkout and idempotency truth from a fresh pool after reconnect', async () => {
    const { orderRepository, order } = await seedCommercialState();
    const repository = new PostgresCommercialCatalogRepository(database, database.getPool());
    const service = new CommercialCheckoutService(
      repository,
      orderRepository,
      () => now,
      () => 'checkout_reconnect-1'
    );
    const command = {
      workspaceId: ORDER_WORKSPACE_ID,
      orderId: order.orderId,
      productId: 'product_trademark-filing' as const,
      expectedProductVersion: 1,
      priceId: 'price_direct-filing-v1' as const,
      expectedPriceVersion: 1,
      idempotencyKey: 'commercial-checkout-reconnect'
    };
    const created = await service.createCheckout(principal, command);

    const fresh = new ManagedDatabase({
      connection: { url: url! },
      applicationName: 'markreg-commercial-checkout-reconnect',
      poolMaximum: 2,
      connectionTimeoutMs: 2000,
      idleTimeoutMs: 2000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
    });
    await fresh.start();
    try {
      const reconnect = new PostgresCommercialCatalogRepository(fresh, fresh.getPool());
      expect(await reconnect.findCheckout(ORDER_WORKSPACE_ID, created.checkoutSessionId)).toEqual(
        created
      );
      const replay = await reconnect.findCheckoutByIdempotencyKey(
        ORDER_WORKSPACE_ID,
        command.idempotencyKey
      );
      expect(replay?.checkout).toEqual(created);
      expect(replay?.fingerprint).toMatch(/^[0-9a-f]{64}$/u);
    } finally {
      await fresh.close();
    }
  });
});
