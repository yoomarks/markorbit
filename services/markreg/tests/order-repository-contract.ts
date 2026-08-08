import { describe, expect, it } from 'vitest';
import type { CommercialSourceSnapshot, Order } from '@markorbit/contracts/order';
import {
  hashCommercialSourceSnapshot,
  hashOrderPersistenceValue,
  type OrderAuditRecord,
  type OrderRepository
} from '../src/order-persistence.js';

export const ORDER_WORKSPACE_ID = '44444444-4444-4444-8444-444444444444';
export const OTHER_ORDER_WORKSPACE_ID = '66666666-6666-4666-8666-666666666666';
const at = '2026-08-08T05:00:00.000Z';

export function orderFixture(suffix: string, overrides: Partial<Order> = {}): Order {
  const source = {
    schemaVersion: 1,
    quote: {
      quoteId: `quote_order-${suffix}`,
      quoteVersion: 'quote-v1',
      currency: 'USD',
      totalMinor: 29900
    },
    customerConfirmation: {
      confirmationId: `confirmation_order-${suffix}`,
      confirmationVersion: 1,
      status: 'CONFIRMED'
    },
    customerId: `customer_order-${suffix}`,
    channel: 'MARKREG_DIRECT',
    relationshipModel: 'DIRECT',
    commercialScope: {
      applicantReference: `applicant:${suffix}`,
      trademarkReference: `mark:${suffix}`,
      jurisdictionReference: 'US',
      classNumbers: [9, 42],
      goodsServices: ['downloadable software', 'software as a service'],
      selectedPlanId: `plan_order-${suffix}`,
      selectedPlanVersion: 'plan-v1'
    },
    relationshipReferences: {
      contractingParty: { referenceId: 'party_markreg' },
      paymentReceiver: { referenceId: 'party_receiver' },
      deliveryOwner: { referenceId: 'team_delivery' },
      communicationOwner: { referenceId: 'team_care' },
      customerFacingBrand: { referenceId: 'brand_markreg' }
    },
    sourceCorrelationId: `correlation_order-${suffix}`,
    sourceSha256: 'a'.repeat(64),
    capturedAt: at
  } as CommercialSourceSnapshot;
  const base = {
    schemaVersion: 1,
    orderId: `order_${suffix}`,
    workspaceId: ORDER_WORKSPACE_ID,
    orderType: 'TrademarkFiling',
    status: 'Draft',
    version: 1,
    customerId: source.customerId,
    channel: source.channel,
    relationshipModel: source.relationshipModel,
    commercialSourceSnapshot: source,
    commercialSourceSnapshotSha256: hashCommercialSourceSnapshot(source),
    createdByUserId: 'user_order-owner',
    updatedByUserId: 'user_order-owner',
    createdAt: at,
    updatedAt: at
  } as Order;
  return { ...base, ...overrides } as Order;
}

export function createFingerprint(value: Order, key: string): string {
  return hashOrderPersistenceValue({ operation: 'CREATE', key, value });
}

export function updateFingerprint(value: Order, expectedVersion: number, key: string): string {
  return hashOrderPersistenceValue({ operation: 'UPDATE', expectedVersion, key, value });
}

export function orderAudit(
  value: Order,
  action: OrderAuditRecord['action'],
  fromStatus?: Order['status']
): OrderAuditRecord {
  return {
    workspaceId: value.workspaceId,
    orderId: value.orderId,
    action,
    actorId: value.updatedByUserId,
    ...(fromStatus ? { fromStatus } : {}),
    toStatus: value.status,
    version: value.version,
    correlationId: `correlation_${value.orderId}_${value.version}`,
    createdAt: value.updatedAt
  };
}

export function runOrderRepositoryContract(
  name: string,
  repositoryFactory: () => OrderRepository | Promise<OrderRepository>
) {
  describe(name, () => {
    it('creates exact durable Order truth, lists it by Workspace and hides it cross-Workspace', async () => {
      const repository = await repositoryFactory();
      const value = orderFixture('create');
      const key = 'create-order';
      const created = await repository.createAtomically(
        value,
        key,
        createFingerprint(value, key),
        orderAudit(value, 'ORDER_CREATED')
      );
      expect(await repository.findById(ORDER_WORKSPACE_ID, value.orderId)).toEqual(created);
      expect(await repository.findById(OTHER_ORDER_WORKSPACE_ID, value.orderId)).toBeNull();
      expect(await repository.list(ORDER_WORKSPACE_ID, { page: 1, pageSize: 20 })).toEqual({
        items: [created],
        page: 1,
        pageSize: 20,
        total: 1
      });
      expect(await repository.list(OTHER_ORDER_WORKSPACE_ID, { page: 1, pageSize: 20 })).toEqual({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0
      });
      expect(created.commercialSourceSnapshot).toEqual(value.commercialSourceSnapshot);
      expect(created.commercialSourceSnapshotSha256).toBe(
        hashCommercialSourceSnapshot(value.commercialSourceSnapshot)
      );
    });

    it('replays identical create, rejects conflicting key reuse and rejects a second Order for the exact source', async () => {
      const repository = await repositoryFactory();
      const value = orderFixture('idempotency');
      const key = 'same-create-key';
      const fingerprint = createFingerprint(value, key);
      const first = await repository.createAtomically(
        value,
        key,
        fingerprint,
        orderAudit(value, 'ORDER_CREATED')
      );
      expect(
        await repository.createAtomically(
          value,
          key,
          fingerprint,
          orderAudit(value, 'ORDER_CREATED')
        )
      ).toEqual(first);
      await expect(
        repository.createAtomically(
          value,
          key,
          hashOrderPersistenceValue({ conflicting: true }),
          orderAudit(value, 'ORDER_CREATED')
        )
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      const duplicate = { ...value, orderId: 'order_duplicate-source' } as Order;
      const duplicateKey = 'different-create-key';
      await expect(
        repository.createAtomically(
          duplicate,
          duplicateKey,
          createFingerprint(duplicate, duplicateKey),
          orderAudit(duplicate, 'ORDER_CREATED')
        )
      ).rejects.toMatchObject({ code: 'DUPLICATE_SOURCE' });
      expect(await repository.listAudit(ORDER_WORKSPACE_ID, value.orderId)).toHaveLength(1);
    });

    it('updates only at the exact expected version and preserves append-only mutation evidence', async () => {
      const repository = await repositoryFactory();
      const value = orderFixture('version');
      const createKey = 'version-create';
      await repository.createAtomically(
        value,
        createKey,
        createFingerprint(value, createKey),
        orderAudit(value, 'ORDER_CREATED')
      );
      const updated = {
        ...value,
        status: 'PendingConfirmation',
        version: 2,
        updatedByUserId: 'user_order-reviewer',
        updatedAt: '2026-08-08T05:01:00.000Z'
      } as Order;
      const updateKey = 'version-update';
      const fingerprint = updateFingerprint(updated, 1, updateKey);
      expect(
        await repository.updateAtomically(
          updated,
          1,
          updateKey,
          fingerprint,
          orderAudit(updated, 'ORDER_STATUS_CHANGED', 'Draft')
        )
      ).toEqual(updated);
      await expect(
        repository.updateAtomically(
          { ...updated, version: 3, status: 'Confirmed' } as Order,
          1,
          'stale-update',
          hashOrderPersistenceValue({ stale: true }),
          orderAudit(
            { ...updated, version: 3, status: 'Confirmed' } as Order,
            'ORDER_STATUS_CHANGED'
          )
        )
      ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
      expect(await repository.findById(ORDER_WORKSPACE_ID, value.orderId)).toEqual(updated);
      expect(await repository.listAudit(ORDER_WORKSPACE_ID, value.orderId)).toMatchObject([
        { action: 'ORDER_CREATED', version: 1, toStatus: 'Draft' },
        {
          action: 'ORDER_STATUS_CHANGED',
          version: 2,
          fromStatus: 'Draft',
          toStatus: 'PendingConfirmation'
        }
      ]);
    });

    it('returns the original idempotent update result even after the Order advances again', async () => {
      const repository = await repositoryFactory();
      const value = orderFixture('replay-update');
      const createKey = 'replay-create';
      await repository.createAtomically(
        value,
        createKey,
        createFingerprint(value, createKey),
        orderAudit(value, 'ORDER_CREATED')
      );
      const second = {
        ...value,
        status: 'PendingConfirmation',
        version: 2,
        updatedAt: '2026-08-08T05:02:00.000Z'
      } as Order;
      const secondKey = 'replay-update-v2';
      const secondFingerprint = updateFingerprint(second, 1, secondKey);
      await repository.updateAtomically(
        second,
        1,
        secondKey,
        secondFingerprint,
        orderAudit(second, 'ORDER_STATUS_CHANGED', 'Draft')
      );
      const third = {
        ...second,
        status: 'Confirmed',
        version: 3,
        updatedAt: '2026-08-08T05:03:00.000Z'
      } as Order;
      const thirdKey = 'replay-update-v3';
      await repository.updateAtomically(
        third,
        2,
        thirdKey,
        updateFingerprint(third, 2, thirdKey),
        orderAudit(third, 'ORDER_STATUS_CHANGED', 'PendingConfirmation')
      );
      expect(
        await repository.updateAtomically(
          second,
          1,
          secondKey,
          secondFingerprint,
          orderAudit(second, 'ORDER_STATUS_CHANGED', 'Draft')
        )
      ).toEqual(second);
      expect(await repository.findById(ORDER_WORKSPACE_ID, value.orderId)).toEqual(third);
    });

    it('prevents immutable commercial source rewriting', async () => {
      const repository = await repositoryFactory();
      const value = orderFixture('immutable');
      const createKey = 'immutable-create';
      await repository.createAtomically(
        value,
        createKey,
        createFingerprint(value, createKey),
        orderAudit(value, 'ORDER_CREATED')
      );
      const changedSource = {
        ...value.commercialSourceSnapshot,
        quote: { ...value.commercialSourceSnapshot.quote, quoteVersion: 'quote-v2' }
      } as CommercialSourceSnapshot;
      const rewritten = {
        ...value,
        status: 'PendingConfirmation',
        version: 2,
        commercialSourceSnapshot: changedSource,
        commercialSourceSnapshotSha256: hashCommercialSourceSnapshot(changedSource),
        updatedAt: '2026-08-08T05:04:00.000Z'
      } as Order;
      const updateKey = 'immutable-update';
      await expect(
        repository.updateAtomically(
          rewritten,
          1,
          updateKey,
          updateFingerprint(rewritten, 1, updateKey),
          orderAudit(rewritten, 'ORDER_STATUS_CHANGED', 'Draft')
        )
      ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
      expect(await repository.findById(ORDER_WORKSPACE_ID, value.orderId)).toEqual(value);
    });

    it('serializes concurrent writers so one exact expected version wins', async () => {
      const repository = await repositoryFactory();
      const value = orderFixture('concurrency');
      const createKey = 'concurrency-create';
      await repository.createAtomically(
        value,
        createKey,
        createFingerprint(value, createKey),
        orderAudit(value, 'ORDER_CREATED')
      );
      const candidate = (key: string, timestamp: string) => {
        const next = {
          ...value,
          status: 'PendingConfirmation',
          version: 2,
          updatedByUserId: `user_${key}`,
          updatedAt: timestamp
        } as Order;
        return repository.updateAtomically(
          next,
          1,
          key,
          updateFingerprint(next, 1, key),
          orderAudit(next, 'ORDER_STATUS_CHANGED', 'Draft')
        );
      };
      const settled = await Promise.allSettled([
        candidate('concurrent-a', '2026-08-08T05:05:00.000Z'),
        candidate('concurrent-b', '2026-08-08T05:05:01.000Z')
      ]);
      expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = settled.filter((result) => result.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
        code: 'VERSION_CONFLICT'
      });
      expect(await repository.listAudit(ORDER_WORKSPACE_ID, value.orderId)).toHaveLength(2);
    });
  });
}
