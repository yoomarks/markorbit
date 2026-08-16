import { describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type {
  Payment,
  PaymentAttempt,
  VerifiedProviderPaymentEvent
} from '@markorbit/contracts/payment';
import {
  InMemoryPaymentLifecycleRepository,
  PaymentLifecycleError,
  PaymentLifecycleService,
  type PaymentLifecycleLookupRepository,
  type PaymentLifecycleProviderAdapter,
  type PaymentProviderSnapshot
} from '../src/payment-lifecycle.js';

const at = '2026-08-16T07:30:00.000Z';
const payment: Payment = {
  schemaVersion: 1,
  paymentId: 'payment_lifecycle-test',
  workspaceId: 'workspace_lifecycle-test',
  checkoutSessionId: 'checkout_lifecycle-test',
  orderId: 'order_lifecycle-test',
  initiatedByUserId: 'user_lifecycle-test' as Payment['initiatedByUserId'],
  productId: 'product_trademark-filing',
  productVersion: 2,
  priceId: 'price_direct-v2',
  priceVersion: 2,
  amount: { amountMinor: 29900, currency: 'USD' },
  provider: 'TEST_PROVIDER',
  status: 'PROCESSING',
  version: 2,
  refundedMinor: 0,
  createdAt: '2026-08-16T07:00:00.000Z',
  updatedAt: '2026-08-16T07:10:00.000Z'
};
const attempt: PaymentAttempt = {
  schemaVersion: 1,
  paymentAttemptId: 'payment_attempt_lifecycle-test',
  paymentId: payment.paymentId,
  provider: payment.provider,
  providerPaymentReference: 'provider_payment_lifecycle-test',
  attemptNumber: 1,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt
};
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_lifecycle-test',
  userId: 'user_lifecycle-test',
  workspaceId: payment.workspaceId,
  membershipId: 'membership_lifecycle-test',
  role: 'WORKSPACE_ADMIN',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-17T07:30:00.000Z'
};

function harness(initial: Payment = payment) {
  const repository = new InMemoryPaymentLifecycleRepository() as PaymentLifecycleLookupRepository &
    InMemoryPaymentLifecycleRepository;
  repository.putPayment(initial, attempt);
  repository.findByPaymentId = async (workspaceId, paymentId) => {
    const aggregate = await repository.findByProviderPaymentReference(
      attempt.provider,
      attempt.providerPaymentReference
    );
    return aggregate?.payment.workspaceId === workspaceId &&
      aggregate.payment.paymentId === paymentId
      ? aggregate
      : null;
  };

  let verifiedEvent: VerifiedProviderPaymentEvent = {
    provider: 'TEST_PROVIDER',
    providerEventId: 'evt_payment-succeeded',
    providerPaymentReference: attempt.providerPaymentReference,
    canonicalType: 'PAYMENT_SUCCEEDED',
    amount: { amountMinor: 29900, currency: 'USD' },
    occurredAt: '2026-08-16T07:25:00.000Z'
  };
  let verificationError: Error | undefined;
  let refundCalls = 0;
  let snapshot: PaymentProviderSnapshot = {
    providerPaymentReference: attempt.providerPaymentReference,
    status: initial.status,
    amountMinor: initial.amount.amountMinor,
    currency: initial.amount.currency,
    observedAt: at
  };
  const provider: PaymentLifecycleProviderAdapter = {
    code: 'TEST_PROVIDER',
    verifyWebhook: () => {
      if (verificationError) return Promise.reject(verificationError);
      return Promise.resolve(structuredClone(verifiedEvent));
    },
    createRefund: (command) => {
      refundCalls += 1;
      return Promise.resolve({
        providerRefundReference: `provider_refund_${command.refundId}`,
        status: 'PENDING'
      });
    },
    retrievePayment: () => Promise.resolve(structuredClone(snapshot))
  };
  const service = new PaymentLifecycleService(
    repository,
    provider,
    () => at,
    () => 'refund_lifecycle-test',
    () => 'reconciliation_lifecycle-test'
  );
  return {
    repository,
    service,
    setEvent: (event: VerifiedProviderPaymentEvent) => {
      verifiedEvent = event;
    },
    setVerificationError: (error?: Error) => {
      verificationError = error;
    },
    setSnapshot: (value: PaymentProviderSnapshot) => {
      snapshot = value;
    },
    refundCalls: () => refundCalls
  };
}

describe('Payment lifecycle', () => {
  it('rejects an unverifiable webhook before recording or mutating Payment truth', async () => {
    const h = harness();
    h.setVerificationError(new Error('bad signature'));
    await expect(
      h.service.handleWebhook({ rawBody: new TextEncoder().encode('{"id":"evt"}'), headers: {} })
    ).rejects.toMatchObject({ code: 'WEBHOOK_VERIFICATION_FAILED' });
    expect(
      await h.repository.findEventReceipt('TEST_PROVIDER', 'evt_payment-succeeded')
    ).toBeNull();
    expect(
      (
        await h.repository.findByProviderPaymentReference(
          'TEST_PROVIDER',
          attempt.providerPaymentReference
        )
      )?.payment.status
    ).toBe('PROCESSING');
  });

  it('applies a verified success exactly once and protects terminal truth from later regression', async () => {
    const h = harness();
    const raw = new TextEncoder().encode('{"provider":"success"}');
    const first = await h.service.handleWebhook({ rawBody: raw, headers: { signature: 'valid' } });
    expect(first.receipt).toMatchObject({ applied: true, canonicalType: 'PAYMENT_SUCCEEDED' });
    expect(first.payment).toMatchObject({ status: 'SUCCEEDED', version: 3, succeededAt: at });

    const duplicate = await h.service.handleWebhook({
      rawBody: raw,
      headers: { signature: 'valid' }
    });
    expect(duplicate.receipt).toEqual(first.receipt);
    expect(duplicate.payment).toBeUndefined();

    h.setEvent({
      provider: 'TEST_PROVIDER',
      providerEventId: 'evt_late-failure',
      providerPaymentReference: attempt.providerPaymentReference,
      canonicalType: 'PAYMENT_FAILED',
      occurredAt: '2026-08-16T07:20:00.000Z'
    });
    const late = await h.service.handleWebhook({
      rawBody: new TextEncoder().encode('late'),
      headers: {}
    });
    expect(late.receipt).toMatchObject({
      applied: false,
      ignoredReason: 'TERMINAL_OR_REGRESSIVE_PAYMENT_EVENT'
    });
    expect(
      (
        await h.repository.findByProviderPaymentReference(
          'TEST_PROVIDER',
          attempt.providerPaymentReference
        )
      )?.payment.status
    ).toBe('SUCCEEDED');
  });

  it('records but does not apply a success event with mismatched amount or currency', async () => {
    const h = harness();
    h.setEvent({
      provider: 'TEST_PROVIDER',
      providerEventId: 'evt_wrong-amount',
      providerPaymentReference: attempt.providerPaymentReference,
      canonicalType: 'PAYMENT_SUCCEEDED',
      amount: { amountMinor: 29901, currency: 'USD' },
      occurredAt: at
    });
    const result = await h.service.handleWebhook({
      rawBody: new TextEncoder().encode('wrong'),
      headers: {}
    });
    expect(result.receipt).toMatchObject({
      applied: false,
      ignoredReason: 'PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH'
    });
    expect(
      (
        await h.repository.findByProviderPaymentReference(
          'TEST_PROVIDER',
          attempt.providerPaymentReference
        )
      )?.payment.status
    ).toBe('PROCESSING');
  });

  it('keeps refund creation admin-only, idempotent, and bounded by successful Payment amount', async () => {
    const h = harness({ ...payment, status: 'SUCCEEDED', succeededAt: at });
    const command = {
      workspaceId: payment.workspaceId,
      paymentId: payment.paymentId,
      amountMinor: 20000,
      reason: 'Customer-approved partial refund',
      idempotencyKey: 'refund-key-1'
    } as const;
    const created = await h.service.requestRefund(principal, command);
    expect(created).toMatchObject({
      status: 'PENDING',
      amount: { amountMinor: 20000, currency: 'USD' }
    });
    expect(await h.service.requestRefund(principal, command)).toEqual(created);
    expect(h.refundCalls()).toBe(1);

    await expect(
      h.service.requestRefund(principal, {
        ...command,
        amountMinor: 10000,
        idempotencyKey: 'refund-key-2'
      })
    ).rejects.toMatchObject({ code: 'REFUND_AMOUNT_EXCEEDED' });
  });

  it('applies a matched verified refund webhook and increments refundedMinor exactly once', async () => {
    const h = harness({ ...payment, status: 'SUCCEEDED', succeededAt: at });
    const refund = await h.service.requestRefund(principal, {
      workspaceId: payment.workspaceId,
      paymentId: payment.paymentId,
      amountMinor: 5000,
      reason: 'Partial refund',
      idempotencyKey: 'refund-webhook-key'
    });
    h.setEvent({
      provider: 'TEST_PROVIDER',
      providerEventId: 'evt_refund-succeeded',
      providerPaymentReference: attempt.providerPaymentReference,
      providerRefundReference: refund.providerRefundReference,
      canonicalType: 'REFUND_SUCCEEDED',
      amount: { amountMinor: 5000, currency: 'USD' },
      occurredAt: at
    });
    const applied = await h.service.handleWebhook({
      rawBody: new TextEncoder().encode('refund'),
      headers: {}
    });
    expect(applied.receipt.applied).toBe(true);
    expect(applied.refund?.status).toBe('SUCCEEDED');
    expect(applied.payment?.refundedMinor).toBe(5000);
  });

  it('writes reconciliation mismatch evidence without rewriting local Payment truth', async () => {
    const h = harness({ ...payment, status: 'SUCCEEDED', succeededAt: at });
    h.setSnapshot({
      providerPaymentReference: attempt.providerPaymentReference,
      status: 'PROCESSING',
      amountMinor: 29900,
      currency: 'USD',
      observedAt: at
    });
    const before = await h.repository.findByProviderPaymentReference(
      'TEST_PROVIDER',
      attempt.providerPaymentReference
    );
    const observation = await h.service.reconcile(
      principal,
      payment.workspaceId,
      payment.paymentId
    );
    const after = await h.repository.findByProviderPaymentReference(
      'TEST_PROVIDER',
      attempt.providerPaymentReference
    );
    expect(observation).toMatchObject({
      classification: 'MISMATCH',
      disposition: 'OPEN',
      localStatus: 'SUCCEEDED',
      observedProviderStatus: 'PROCESSING'
    });
    expect(after?.payment).toEqual(before?.payment);
  });

  it('rejects refunds from non-admin workspace roles', async () => {
    const h = harness({ ...payment, status: 'SUCCEEDED', succeededAt: at });
    await expect(
      h.service.requestRefund(
        { ...principal, role: 'MATTER_MANAGER' },
        {
          workspaceId: payment.workspaceId,
          paymentId: payment.paymentId,
          amountMinor: 1000,
          reason: 'Not authorized',
          idempotencyKey: 'refund-role-key'
        }
      )
    ).rejects.toBeInstanceOf(PaymentLifecycleError);
  });
});
