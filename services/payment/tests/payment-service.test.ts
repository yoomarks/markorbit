import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CheckoutSession } from '@markorbit/contracts/commercial';
import type { PaymentProviderAction } from '@markorbit/contracts/payment';
import {
  InMemoryPaymentRepository,
  PaymentService,
  PaymentServiceError,
  type PaymentProviderAdapter,
  type PaymentProviderCreateCommand,
  type PaymentProviderCreateResult
} from '../src/payment-service.js';

const now = '2026-08-15T12:00:00.000Z';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_payment-test',
  userId: 'user_payment-test',
  workspaceId: 'workspace_payment-test',
  membershipId: 'membership_payment-test',
  role: 'WORKSPACE_ADMIN',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-16T12:00:00.000Z'
};

const checkout = (overrides: Partial<CheckoutSession> = {}): CheckoutSession => ({
  schemaVersion: 1,
  checkoutSessionId: 'checkout_payment-test',
  workspaceId: principal.workspaceId,
  orderId: 'order_payment-test',
  initiatedByUserId: principal.userId as CheckoutSession['initiatedByUserId'],
  productId: 'product_trademark-filing',
  productVersion: 1,
  priceId: 'price_direct-filing-v1',
  priceVersion: 1,
  amount: { amountMinor: 29900, currency: 'USD' },
  status: 'INITIATED',
  version: 1,
  createdAt: '2026-08-15T11:45:00.000Z',
  updatedAt: '2026-08-15T11:45:00.000Z',
  expiresAt: '2026-08-15T12:15:00.000Z',
  ...overrides
});

function harness(
  source: CheckoutSession = checkout(),
  result: PaymentProviderCreateResult = {
    providerPaymentReference: 'provider_payment_1',
    status: 'REQUIRES_ACTION',
    action: { kind: 'CLIENT_CONFIRMATION', secret: 'client_test_secret' }
  }
) {
  const repository = new InMemoryPaymentRepository();
  const createPayment = vi.fn<
    (command: PaymentProviderCreateCommand) => Promise<PaymentProviderCreateResult>
  >(() => Promise.resolve(structuredClone(result)));
  const resumePayment = vi.fn<(reference: string) => Promise<PaymentProviderAction>>(() =>
    Promise.resolve({ kind: 'CLIENT_CONFIRMATION', secret: 'client_test_secret' })
  );
  const provider: PaymentProviderAdapter = {
    code: 'TEST_PROVIDER',
    createPayment,
    resumePayment
  };
  const service = new PaymentService(
    repository,
    {
      findCheckout: (workspaceId, checkoutSessionId) =>
        Promise.resolve(
          workspaceId === source.workspaceId && checkoutSessionId === source.checkoutSessionId
            ? structuredClone(source)
            : null
        )
    },
    provider,
    () => now,
    () => 'payment_attempt_test-1'
  );
  return { repository, service, createPayment, resumePayment };
}

const command = {
  workspaceId: principal.workspaceId,
  checkoutSessionId: 'checkout_payment-test' as const,
  idempotencyKey: 'payment-initiation-1'
};

describe('PaymentService', () => {
  it('derives provider amount and currency exclusively from governed Checkout truth', async () => {
    const { service, createPayment } = harness();
    const result = await service.initiatePayment(principal, command);

    expect(createPayment).toHaveBeenCalledTimes(1);
    expect(createPayment.mock.calls[0]?.[0]).toMatchObject({
      checkoutSessionId: command.checkoutSessionId,
      orderId: 'order_payment-test',
      amountMinor: 29900,
      currency: 'USD'
    });
    expect(createPayment.mock.calls[0]?.[0].providerIdempotencyKey).toBe(result.payment.paymentId);
    expect(result.payment).toMatchObject({
      checkoutSessionId: command.checkoutSessionId,
      amount: { amountMinor: 29900, currency: 'USD' },
      provider: 'TEST_PROVIDER',
      status: 'REQUIRES_ACTION',
      refundedMinor: 0,
      version: 1
    });
  });

  it('replays a semantic idempotent command without creating a second provider Payment', async () => {
    const { service, createPayment, resumePayment } = harness();
    const first = await service.initiatePayment(principal, command);
    const replay = await service.initiatePayment(principal, command);

    expect(createPayment).toHaveBeenCalledTimes(1);
    expect(resumePayment).toHaveBeenCalledTimes(1);
    expect(replay.payment).toEqual(first.payment);
    expect(replay.attempt).toEqual(first.attempt);
  });

  it('rejects a changed semantic command behind the same idempotency key', async () => {
    const alternate = checkout({ checkoutSessionId: 'checkout_payment-other' });
    const repository = new InMemoryPaymentRepository();
    const provider: PaymentProviderAdapter = {
      code: 'TEST_PROVIDER',
      createPayment: () =>
        Promise.resolve({
          providerPaymentReference: 'provider_payment_1',
          status: 'PENDING',
          action: { kind: 'NONE' }
        }),
      resumePayment: () => Promise.resolve({ kind: 'NONE' })
    };
    const source = {
      findCheckout: (_workspaceId: string, checkoutSessionId: string) =>
        Promise.resolve(
          checkoutSessionId === command.checkoutSessionId
            ? checkout()
            : checkoutSessionId === alternate.checkoutSessionId
              ? alternate
              : null
        )
    };
    const service = new PaymentService(repository, source, provider, () => now);
    await service.initiatePayment(principal, command);

    await expect(
      service.initiatePayment(principal, {
        ...command,
        checkoutSessionId: alternate.checkoutSessionId
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('rejects expired or non-initiated Checkout before calling the provider', async () => {
    const expired = harness(checkout({ expiresAt: '2026-08-15T11:59:59.000Z' }));
    await expect(expired.service.initiatePayment(principal, command)).rejects.toMatchObject({
      code: 'CHECKOUT_EXPIRED'
    });
    expect(expired.createPayment).not.toHaveBeenCalled();

    const cancelled = harness(checkout({ status: 'CANCELLED' }));
    await expect(cancelled.service.initiatePayment(principal, command)).rejects.toMatchObject({
      code: 'CHECKOUT_NOT_PAYABLE'
    });
    expect(cancelled.createPayment).not.toHaveBeenCalled();
  });

  it('rejects cross-Workspace initiation before provider access', async () => {
    const { service, createPayment } = harness();
    await expect(
      service.initiatePayment({ ...principal, workspaceId: 'workspace_other' }, command)
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('does not let provider creation author terminal success', async () => {
    const invalid = harness(checkout(), {
      providerPaymentReference: 'provider_payment_1',
      status: 'SUCCEEDED' as never,
      action: { kind: 'NONE' }
    });
    await expect(invalid.service.initiatePayment(principal, command)).rejects.toBeInstanceOf(
      PaymentServiceError
    );
    await expect(invalid.service.initiatePayment(principal, command)).rejects.toMatchObject({
      code: 'PROVIDER_CONTRACT_INVALID'
    });
  });
});
