import { describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CommercialPrice, CommercialProduct } from '@markorbit/contracts/commercial';
import type { Order } from '@markorbit/contracts/order';
import {
  CommercialCheckoutError,
  CommercialCheckoutService,
  InMemoryCommercialCatalogRepository
} from '../src/commercial-checkout.js';

const now = '2026-08-15T12:00:00.000Z';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_test',
  userId: 'user_customer',
  workspaceId: 'workspace_customer',
  membershipId: 'membership_customer',
  role: 'WORKSPACE_ADMIN',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-16T12:00:00.000Z'
};

const product: CommercialProduct = {
  schemaVersion: 1,
  productId: 'product_trademark-filing',
  code: 'TRADEMARK_FILING',
  name: 'Trademark filing',
  serviceType: 'TrademarkFiling',
  status: 'ACTIVE',
  version: 1,
  createdAt: now,
  updatedAt: now
};

const price: CommercialPrice = {
  schemaVersion: 1,
  priceId: 'price_direct-filing-v1',
  productId: product.productId,
  priceVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  amount: { amountMinor: 29900, currency: 'USD' },
  status: 'ACTIVE',
  validFrom: '2026-08-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z'
};

const order = (overrides: Partial<Order> = {}): Order =>
  ({
    schemaVersion: 1,
    orderId: 'order_customer-1',
    workspaceId: principal.workspaceId,
    orderType: 'TrademarkFiling',
    status: 'Confirmed',
    version: 3,
    customerId: 'customer_direct',
    channel: 'MARKREG_DIRECT',
    relationshipModel: 'DIRECT',
    commercialSourceSnapshot: {
      schemaVersion: 1,
      quote: {
        quoteId: 'quote_direct-1',
        quoteVersion: '1',
        currency: 'USD',
        totalMinor: 29900
      },
      customerConfirmation: {
        confirmationId: 'confirmation_direct-1',
        confirmationVersion: 1,
        status: 'CONFIRMED'
      },
      customerId: 'customer_direct',
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      commercialScope: {
        applicantReference: 'applicant_1',
        trademarkReference: 'trademark_1',
        jurisdictionReference: 'jurisdiction_cn',
        classNumbers: [25],
        goodsServices: ['Clothing'],
        selectedPlanId: 'plan_direct-1',
        selectedPlanVersion: '1'
      },
      relationshipReferences: {},
      sourceCorrelationId: 'correlation_direct-1',
      sourceSha256: 'a'.repeat(64),
      capturedAt: now
    },
    commercialSourceSnapshotSha256: 'b'.repeat(64),
    createdByUserId: principal.userId,
    updatedByUserId: principal.userId,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }) as Order;

function harness(
  value: Order = order(),
  clock: () => string = () => now,
  checkoutId: () => `checkout_${string}` = () => 'checkout_direct-1'
) {
  const repository = new InMemoryCommercialCatalogRepository();
  repository.putProduct(product);
  repository.putPrice(price);
  const orderSource = {
    findById: (workspaceId: string, orderId: string) => {
      const matches = workspaceId === value.workspaceId && orderId === value.orderId;
      return Promise.resolve(matches ? structuredClone(value) : null);
    }
  };
  const service = new CommercialCheckoutService(repository, orderSource, clock, checkoutId);
  return { repository, service, orderSource };
}

const command = {
  workspaceId: principal.workspaceId,
  orderId: 'order_customer-1' as const,
  productId: product.productId,
  expectedProductVersion: 1,
  priceId: price.priceId,
  expectedPriceVersion: 1,
  idempotencyKey: 'checkout-key-1'
};

describe('CommercialCheckoutService', () => {
  it('returns active prices for the requested channel and relationship', async () => {
    const { repository, service } = harness();
    repository.putPrice({
      ...price,
      priceId: 'price_partner-filing-v1',
      channel: 'MARKREG_PARTNER_REFERRAL',
      relationshipModel: 'REFERRAL'
    });

    const catalog = await service.listCatalog(principal, principal.workspaceId, {
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT'
    });

    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.product.productId).toBe(product.productId);
    expect(catalog[0]?.prices.map((item) => item.priceId)).toEqual([price.priceId]);
  });

  it('initiates checkout from persisted price truth, never client amount', async () => {
    const { service } = harness();
    const checkout = await service.createCheckout(principal, command);

    expect(checkout).toMatchObject({
      checkoutSessionId: 'checkout_direct-1',
      orderId: command.orderId,
      productId: product.productId,
      productVersion: product.version,
      priceId: price.priceId,
      priceVersion: price.priceVersion,
      amount: price.amount,
      status: 'INITIATED',
      version: 1
    });
  });

  it('replays the same idempotent checkout and rejects changed semantic input', async () => {
    const { service } = harness();
    const first = await service.createCheckout(principal, command);
    const replay = await service.createCheckout(principal, command);
    expect(replay).toEqual(first);

    await expect(
      service.createCheckout(principal, { ...command, expectedPriceVersion: 2 })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('expires a stale checkout and allows the same Order to initiate a new session', async () => {
    const { repository, service, orderSource } = harness();
    const first = await service.createCheckout(principal, command);
    const later = '2026-08-15T12:31:00.000Z';
    const retry = new CommercialCheckoutService(
      repository,
      orderSource,
      () => later,
      () => 'checkout_direct-2'
    );

    const second = await retry.createCheckout(principal, {
      ...command,
      idempotencyKey: 'checkout-key-2'
    });

    expect(second.checkoutSessionId).toBe('checkout_direct-2');
    expect(second.status).toBe('INITIATED');
    const expired = await retry.getCheckout(principal, principal.workspaceId, first.checkoutSessionId);
    expect(expired).toMatchObject({
      status: 'EXPIRED',
      version: 2,
      updatedAt: later
    });
  });

  it('rejects inactive, mismatched or non-confirmed commercial state', async () => {
    const mismatchHarness = harness(
      order({
        commercialSourceSnapshot: {
          ...order().commercialSourceSnapshot,
          quote: {
            ...order().commercialSourceSnapshot.quote,
            totalMinor: 30000
          }
        }
      })
    );
    await expect(mismatchHarness.service.createCheckout(principal, command)).rejects.toMatchObject({
      code: 'PRICE_ORDER_MISMATCH'
    });

    const draftHarness = harness(order({ status: 'Draft' }));
    await expect(draftHarness.service.createCheckout(principal, command)).rejects.toMatchObject({
      code: 'ORDER_NOT_ELIGIBLE'
    });

    const inactiveRepository = new InMemoryCommercialCatalogRepository();
    inactiveRepository.putProduct({ ...product, status: 'INACTIVE' });
    inactiveRepository.putPrice(price);
    const inactiveService = new CommercialCheckoutService(
      inactiveRepository,
      { findById: () => Promise.resolve(order()) },
      () => now
    );
    await expect(inactiveService.createCheckout(principal, command)).rejects.toBeInstanceOf(
      CommercialCheckoutError
    );
    await expect(inactiveService.createCheckout(principal, command)).rejects.toMatchObject({
      code: 'PRODUCT_INACTIVE'
    });
  });

  it('enforces workspace scope before reading commercial state', async () => {
    const { service } = harness();
    await expect(
      service.createCheckout({ ...principal, workspaceId: 'workspace_other' }, command)
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' });
  });
});
