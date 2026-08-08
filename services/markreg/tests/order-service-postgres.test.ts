import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ROLE_PERMISSION_MATRIX, type WorkspacePrincipal } from '@markorbit/contracts';
import type { CommercialSourceSnapshot, CreateOrderCommand } from '@markorbit/contracts/order';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresOrderRepository } from '../src/order-persistence.js';
import {
  InMemoryOrderCommercialSourceProvider,
  OrderService
} from '../src/order-service.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_ORDER_SERVICE_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MARKREG_TEST_DATABASE_URL is required when MARKREG_ORDER_SERVICE_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const WORKSPACE = '44444444-4444-4444-8444-444444444444';
const OTHER_WORKSPACE = '66666666-6666-4666-8666-666666666666';
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const SOURCE_AT = '2026-08-08T09:00:00.000Z';

const principal = (workspaceId = WORKSPACE): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_order-service-postgres',
  userId: 'user_order-service-postgres',
  workspaceId,
  membershipId: 'membership_order-service-postgres',
  role: 'MATTER_MANAGER',
  permissions: ROLE_PERMISSION_MATRIX.MATTER_MANAGER,
  sessionExpiresAt: '2026-08-09T00:00:00.000Z'
});

const source: CommercialSourceSnapshot = {
  schemaVersion: 1,
  quote: {
    quoteId: 'quote_order-service-postgres',
    quoteVersion: 'quote-v11',
    currency: 'USD',
    totalMinor: 45900
  },
  customerConfirmation: {
    confirmationId: 'confirmation_order-service-postgres',
    confirmationVersion: 5,
    status: 'CONFIRMED'
  },
  customerId: 'customer_order-service-postgres',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  commercialScope: {
    applicantReference: 'applicant:postgres-service',
    trademarkReference: 'mark:POSTGRES-SERVICE',
    jurisdictionReference: 'US',
    classNumbers: [9, 42],
    goodsServices: ['downloadable software', 'software as a service'],
    selectedPlanId: 'plan_order-service-postgres',
    selectedPlanVersion: 'plan-v3'
  },
  relationshipReferences: {
    contractingParty: { referenceId: 'party_markreg' },
    paymentReceiver: { referenceId: 'party_receiver' },
    deliveryOwner: { referenceId: 'team_delivery' },
    communicationOwner: { referenceId: 'team_care' },
    customerFacingBrand: { referenceId: 'brand_markreg' }
  },
  sourceCorrelationId: 'correlation_order-service-postgres',
  sourceSha256: 'b'.repeat(64),
  capturedAt: SOURCE_AT
};

const createCommand: CreateOrderCommand = {
  workspaceId: WORKSPACE,
  orderType: 'TrademarkFiling',
  quoteId: source.quote.quoteId,
  expectedQuoteVersion: source.quote.quoteVersion,
  customerConfirmationId: source.customerConfirmation.confirmationId,
  expectedCustomerConfirmationVersion: source.customerConfirmation.confirmationVersion,
  channel: source.channel,
  relationshipModel: source.relationshipModel,
  idempotencyKey: 'postgres-order-create'
};

suite.sequential('M3-WP-03 PostgreSQL Order service lifecycle', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-order-service-test',
    poolMaximum: 8,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const sources = new InMemoryOrderCommercialSourceProvider();
  let tick = 0;
  const clock = () => new Date(Date.parse(SOURCE_AT) + tick++ * 60_000).toISOString();

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory,
      migrationOwners
    });
  });
  beforeEach(async () => {
    await database
      .getPool()
      .query('TRUNCATE order_audit,order_commands,orders RESTART IDENTITY CASCADE');
    sources.put(WORKSPACE, source);
    tick = 0;
  });
  afterAll(() => database.close());

  it('persists exact lifecycle, audit and idempotent command results across a fresh pool', async () => {
    const repository = new PostgresOrderRepository(database, database.getPool());
    const service = new OrderService(
      repository,
      sources,
      clock,
      () => 'order_service-postgres'
    );
    const created = await service.create(principal(), createCommand, 'correlation_create');
    const pendingCommand = {
      workspaceId: WORKSPACE,
      orderId: created.orderId,
      expectedVersion: 1,
      idempotencyKey: 'postgres-order-pending'
    } as const;
    const pending = await service.requestConfirmation(
      principal(),
      pendingCommand,
      'correlation_pending'
    );
    const confirmed = await service.confirm(
      principal(),
      {
        workspaceId: WORKSPACE,
        orderId: created.orderId,
        expectedVersion: 2,
        idempotencyKey: 'postgres-order-confirm'
      },
      'correlation_confirm'
    );
    const ready = await service.evaluateReadiness(
      principal(),
      {
        workspaceId: WORKSPACE,
        orderId: created.orderId,
        expectedVersion: 3,
        idempotencyKey: 'postgres-order-ready'
      },
      'correlation_ready'
    );
    expect([created.status, pending.status, confirmed.status, ready.status]).toEqual([
      'Draft',
      'PendingConfirmation',
      'Confirmed',
      'ReadyForMatter'
    ]);
    expect(ready).toMatchObject({ version: 4, orderId: 'order_service-postgres' });

    const fresh = new ManagedDatabase({
      connection: { url: url! },
      applicationName: 'markreg-order-service-reconnect',
      poolMaximum: 2,
      connectionTimeoutMs: 2000,
      idleTimeoutMs: 2000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
    });
    await fresh.start();
    try {
      const reconnectRepository = new PostgresOrderRepository(fresh, fresh.getPool());
      const reconnect = new OrderService(reconnectRepository, sources, clock);
      expect(await reconnect.get(principal(), WORKSPACE, created.orderId)).toEqual(ready);
      expect(await reconnect.requestConfirmation(principal(), pendingCommand)).toEqual(pending);
      expect(await reconnectRepository.listAudit(WORKSPACE, created.orderId)).toMatchObject([
        { action: 'ORDER_CREATED', version: 1, toStatus: 'Draft' },
        {
          action: 'ORDER_STATUS_CHANGED',
          version: 2,
          fromStatus: 'Draft',
          toStatus: 'PendingConfirmation'
        },
        {
          action: 'ORDER_STATUS_CHANGED',
          version: 3,
          fromStatus: 'PendingConfirmation',
          toStatus: 'Confirmed'
        },
        {
          action: 'ORDER_STATUS_CHANGED',
          version: 4,
          fromStatus: 'Confirmed',
          toStatus: 'ReadyForMatter'
        }
      ]);
      await expect(
        reconnect.get(principal(OTHER_WORKSPACE), WORKSPACE, created.orderId)
      ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' });
    } finally {
      await fresh.close();
    }
  });

  it('fails closed on stale source and preserves the durable version', async () => {
    const repository = new PostgresOrderRepository(database, database.getPool());
    const service = new OrderService(repository, sources, clock, () => 'order_stale-postgres');
    const created = await service.create(
      principal(),
      { ...createCommand, idempotencyKey: 'postgres-stale-create' }
    );
    const pending = await service.requestConfirmation(principal(), {
      workspaceId: WORKSPACE,
      orderId: created.orderId,
      expectedVersion: 1,
      idempotencyKey: 'postgres-stale-pending'
    });
    sources.invalidate(WORKSPACE, source.customerConfirmation.confirmationId);
    await expect(
      service.confirm(principal(), {
        workspaceId: WORKSPACE,
        orderId: created.orderId,
        expectedVersion: 2,
        idempotencyKey: 'postgres-stale-confirm'
      })
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
    expect(await service.get(principal(), WORKSPACE, created.orderId)).toEqual(pending);
    expect(await repository.listAudit(WORKSPACE, created.orderId)).toHaveLength(2);
  });
});
