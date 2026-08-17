import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type {
  Payment,
  PaymentAttempt,
  VerifiedProviderPaymentEvent
} from '@markorbit/contracts/payment';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import {
  PaymentLifecycleService,
  type PaymentLifecycleProviderAdapter,
  type PaymentProviderSnapshot
} from '../src/payment-lifecycle.js';
import { PostgresPaymentRepository } from '../src/payment-postgres.js';

const url = process.env.PAYMENT_TEST_DATABASE_URL;
const required = process.env.PAYMENT_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error('PAYMENT_TEST_DATABASE_URL is required when PAYMENT_POSTGRES_REQUIRED=1.');
const suite = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const namespace = 'payment_test';
const at = '2026-08-16T08:30:00.000Z';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_payment-lifecycle-postgres',
  userId: 'user_payment-lifecycle-postgres',
  workspaceId: 'workspace_payment-lifecycle-postgres',
  membershipId: 'membership_payment-lifecycle-postgres',
  role: 'WORKSPACE_ADMIN',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-17T08:30:00.000Z'
};

const payment: Payment = {
  schemaVersion: 1,
  paymentId: 'payment_lifecycle-postgres',
  workspaceId: principal.workspaceId,
  checkoutSessionId: 'checkout_lifecycle-postgres',
  orderId: 'order_lifecycle-postgres',
  initiatedByUserId: principal.userId as Payment['initiatedByUserId'],
  productId: 'product_trademark-filing',
  productVersion: 4,
  priceId: 'price_direct-v4',
  priceVersion: 4,
  amount: { amountMinor: 29900, currency: 'USD' },
  provider: 'TEST_PROVIDER',
  status: 'PROCESSING',
  version: 2,
  refundedMinor: 0,
  createdAt: '2026-08-16T08:00:00.000Z',
  updatedAt: '2026-08-16T08:10:00.000Z'
};
const attempt: PaymentAttempt = {
  schemaVersion: 1,
  paymentAttemptId: 'payment_attempt_lifecycle-postgres',
  paymentId: payment.paymentId,
  provider: payment.provider,
  providerPaymentReference: 'provider_payment_lifecycle-postgres',
  attemptNumber: 1,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt
};

suite.sequential('PostgreSQL Payment lifecycle persistence', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'payment-lifecycle-postgres-test',
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
  it('survives reconnect with verified event, refund and reconciliation evidence intact', async () => {
    const repository = new PostgresPaymentRepository(database, database.getPool());
    await repository.createInitiationAtomically(
      payment,
      attempt,
      'payment-lifecycle-seed',
      'a'.repeat(64)
    );

    let event: VerifiedProviderPaymentEvent = {
      provider: 'TEST_PROVIDER',
      providerEventId: 'evt_lifecycle-postgres-success',
      providerPaymentReference: attempt.providerPaymentReference,
      canonicalType: 'PAYMENT_SUCCEEDED',
      amount: payment.amount,
      occurredAt: '2026-08-16T08:20:00.000Z'
    };
    let snapshot: PaymentProviderSnapshot = {
      providerPaymentReference: attempt.providerPaymentReference,
      status: 'SUCCEEDED',
      amountMinor: payment.amount.amountMinor,
      currency: payment.amount.currency,
      observedAt: at
    };
    const provider: PaymentLifecycleProviderAdapter = {
      code: 'TEST_PROVIDER',
      verifyWebhook: () => Promise.resolve(structuredClone(event)),
      createRefund: (command) =>
        Promise.resolve({
          providerRefundReference: `provider_refund_${command.refundId}`,
          status: 'PENDING'
        }),
      retrievePayment: () => Promise.resolve(structuredClone(snapshot))
    };
    const service = new PaymentLifecycleService(
      repository,
      provider,
      () => at,
      () => 'refund_lifecycle-postgres',
      () => 'reconciliation_lifecycle-postgres'
    );

    const succeeded = await service.handleWebhook({
      rawBody: new TextEncoder().encode('{"type":"payment.succeeded"}'),
      headers: { signature: 'verified-by-test-adapter' }
    });
    expect(succeeded.payment).toMatchObject({ status: 'SUCCEEDED', version: 3 });
    const duplicate = await service.handleWebhook({
      rawBody: new TextEncoder().encode('{"type":"payment.succeeded"}'),
      headers: { signature: 'verified-by-test-adapter' }
    });
    expect(duplicate.payment).toBeUndefined();

    const refund = await service.requestRefund(principal, {
      workspaceId: principal.workspaceId,
      paymentId: payment.paymentId,
      amountMinor: 5000,
      reason: 'PostgreSQL lifecycle proof',
      idempotencyKey: 'refund-lifecycle-postgres'
    });
    event = {
      provider: 'TEST_PROVIDER',
      providerEventId: 'evt_lifecycle-postgres-refund',
      providerPaymentReference: attempt.providerPaymentReference,
      providerRefundReference: refund.providerRefundReference!,
      canonicalType: 'REFUND_SUCCEEDED',
      amount: refund.amount,
      occurredAt: '2026-08-16T08:25:00.000Z'
    };
    const refunded = await service.handleWebhook({
      rawBody: new TextEncoder().encode('{"type":"refund.succeeded"}'),
      headers: { signature: 'verified-by-test-adapter' }
    });
    expect(refunded.refund?.status).toBe('SUCCEEDED');
    expect(refunded.payment?.refundedMinor).toBe(5000);

    snapshot = { ...snapshot, observedAt: at };
    const reconciliation = await service.reconcile(
      principal,
      principal.workspaceId,
      payment.paymentId
    );
    expect(reconciliation.classification).toBe('MATCH');

    const fresh = new ManagedDatabase({
      connection: { url: url! },
      applicationName: 'payment-lifecycle-reconnect-test',
      poolMaximum: 2,
      connectionTimeoutMs: 2000,
      idleTimeoutMs: 2000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: namespace
    });
    await fresh.start();
    try {
      const reconnected = new PostgresPaymentRepository(fresh, fresh.getPool());
      expect(await reconnected.findById(principal.workspaceId, payment.paymentId)).toMatchObject({
        status: 'SUCCEEDED',
        refundedMinor: 5000,
        version: 4
      });
      expect(
        await reconnected.findEventReceipt('TEST_PROVIDER', 'evt_lifecycle-postgres-success')
      ).toMatchObject({
        applied: true,
        providerPaymentReference: attempt.providerPaymentReference
      });
      expect(
        await reconnected.findRefundByProviderReference(refund.providerRefundReference!)
      ).toMatchObject({
        refundId: refund.refundId,
        status: 'SUCCEEDED'
      });
      const reconciliationRows = await fresh
        .getPool()
        .query(
          'SELECT classification,disposition FROM payment_reconciliations WHERE reconciliation_id=$1',
          [reconciliation.reconciliationId]
        );
      expect(reconciliationRows.rows[0]).toEqual({ classification: 'MATCH', disposition: 'OPEN' });
    } finally {
      await fresh.close();
    }
  });
});
