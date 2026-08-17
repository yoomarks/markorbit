import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CheckoutSession } from '@markorbit/contracts/commercial';
import type { PaymentProviderAction } from '@markorbit/contracts/payment';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate,
  migrationStatus
} from '@markorbit/persistence';
import {
  PaymentService,
  type PaymentProviderAdapter,
  type PaymentProviderCreateCommand,
  type PaymentProviderCreateResult
} from '../src/payment-service.js';
import { PostgresPaymentRepository } from '../src/payment-postgres.js';

const url = process.env.PAYMENT_TEST_DATABASE_URL;
const required = process.env.PAYMENT_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error('PAYMENT_TEST_DATABASE_URL is required when PAYMENT_POSTGRES_REQUIRED=1.');
const suite = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const namespace = 'payment_test';
const now = '2026-08-16T06:00:00.000Z';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_payment-postgres-test',
  userId: 'user_payment-postgres-test',
  workspaceId: 'workspace_payment-postgres-test',
  membershipId: 'membership_payment-postgres-test',
  role: 'WORKSPACE_ADMIN',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-17T06:00:00.000Z'
};

const checkout: CheckoutSession = {
  schemaVersion: 1,
  checkoutSessionId: 'checkout_payment-postgres-test',
  workspaceId: principal.workspaceId,
  orderId: 'order_payment-postgres-test',
  initiatedByUserId: principal.userId as CheckoutSession['initiatedByUserId'],
  productId: 'product_trademark-filing',
  productVersion: 3,
  priceId: 'price_direct-filing-v3',
  priceVersion: 3,
  amount: { amountMinor: 29900, currency: 'USD' },
  status: 'INITIATED',
  version: 1,
  createdAt: '2026-08-16T05:45:00.000Z',
  updatedAt: '2026-08-16T05:45:00.000Z',
  expiresAt: '2026-08-16T06:30:00.000Z'
};

suite.sequential('PostgreSQL Payment initiation persistence', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'payment-postgres-test',
    poolMaximum: 6,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });

  beforeAll(async () => {
    await database.start();
    const migrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/payment-service'
    );
    await migrate(database.getPool(), namespace, migrations);
  });

  beforeEach(() =>
    database
      .getPool()
      .query(
        'TRUNCATE payment_reconciliations,payment_refund_commands,payment_provider_event_receipts,payment_refunds,payment_commands,payment_attempts,payment_payments RESTART IDENTITY CASCADE'
      )
  );

  afterAll(() => database.close());

  function service(repository: PostgresPaymentRepository) {
    const createPayment = vi.fn<
      (command: PaymentProviderCreateCommand) => Promise<PaymentProviderCreateResult>
    >(() =>
      Promise.resolve({
        providerPaymentReference: 'provider_payment_postgres-test',
        status: 'REQUIRES_ACTION',
        action: { kind: 'CLIENT_CONFIRMATION', secret: 'client_test_secret' }
      })
    );
    const resumePayment = vi.fn<(reference: string) => Promise<PaymentProviderAction>>(() =>
      Promise.resolve({ kind: 'CLIENT_CONFIRMATION', secret: 'client_test_secret' })
    );
    const provider: PaymentProviderAdapter = {
      code: 'TEST_PROVIDER',
      createPayment,
      resumePayment
    };
    return {
      service: new PaymentService(
        repository,
        {
          findCheckout: (_principal, workspaceId, checkoutSessionId) =>
            Promise.resolve(
              workspaceId === checkout.workspaceId &&
                checkoutSessionId === checkout.checkoutSessionId
                ? structuredClone(checkout)
                : null
            )
        },
        provider,
        () => now,
        () => 'payment_attempt_postgres-test'
      ),
      createPayment,
      resumePayment
    };
  }

  it('registers and applies the Payment-owned 0051 migration', async () => {
    const owned = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/payment-service'
    );
    expect(owned.map((migration) => migration.version)).toEqual(['0051']);
    expect((await migrationStatus(database.getPool(), namespace, owned)).at(-1)?.state).toBe(
      'applied'
    );
    const relations = await database
      .getPool()
      .query(
        "SELECT to_regclass('payment_payments') payments,to_regclass('payment_attempts') attempts,to_regclass('payment_commands') commands,to_regclass('payment_provider_event_receipts') events,to_regclass('payment_refunds') refunds,to_regclass('payment_reconciliations') reconciliations"
      );
    expect(relations.rows[0]).toEqual({
      payments: 'payment_payments',
      attempts: 'payment_attempts',
      commands: 'payment_commands',
      events: 'payment_provider_event_receipts',
      refunds: 'payment_refunds',
      reconciliations: 'payment_reconciliations'
    });
  });

  it('persists Checkout-derived Payment truth and exact idempotency across reconnect', async () => {
    const repository = new PostgresPaymentRepository(database, database.getPool());
    const firstHarness = service(repository);
    const command = {
      workspaceId: principal.workspaceId,
      checkoutSessionId: checkout.checkoutSessionId,
      idempotencyKey: 'payment-postgres-initiate'
    };
    const created = await firstHarness.service.initiatePayment(principal, command);
    expect(created.payment).toMatchObject({
      workspaceId: principal.workspaceId,
      checkoutSessionId: checkout.checkoutSessionId,
      orderId: checkout.orderId,
      productVersion: 3,
      priceVersion: 3,
      amount: { amountMinor: 29900, currency: 'USD' },
      status: 'REQUIRES_ACTION'
    });
    expect(firstHarness.createPayment).toHaveBeenCalledTimes(1);

    const fresh = new ManagedDatabase({
      connection: { url: url! },
      applicationName: 'payment-postgres-reconnect-test',
      poolMaximum: 2,
      connectionTimeoutMs: 2000,
      idleTimeoutMs: 2000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: namespace
    });
    await fresh.start();
    try {
      const reconnectRepository = new PostgresPaymentRepository(fresh, fresh.getPool());
      expect(
        await reconnectRepository.findById(principal.workspaceId, created.payment.paymentId)
      ).toEqual(created.payment);
      const replay = await reconnectRepository.findInitiationReplay(
        principal.workspaceId,
        command.idempotencyKey
      );
      expect(replay?.payment).toEqual(created.payment);
      expect(replay?.attempt).toEqual(created.attempt);
      expect(replay?.fingerprint).toMatch(/^[0-9a-f]{64}$/u);

      const replayHarness = service(reconnectRepository);
      const replayed = await replayHarness.service.initiatePayment(principal, command);
      expect(replayed.payment).toEqual(created.payment);
      expect(replayed.attempt).toEqual(created.attempt);
      expect(replayHarness.createPayment).not.toHaveBeenCalled();
      expect(replayHarness.resumePayment).toHaveBeenCalledTimes(1);
    } finally {
      await fresh.close();
    }
  });
});
