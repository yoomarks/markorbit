import { describe, expect, it } from 'vitest';
import {
  ROLE_PERMISSION_MATRIX,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { CommercialSourceSnapshot, CreateOrderCommand } from '@markorbit/contracts/order';
import { InMemoryOrderRepository } from '../src/order-persistence.js';
import {
  InMemoryOrderCommercialSourceProvider,
  OrderService,
  type OrderProjection
} from '../src/order-service.js';

const WORKSPACE = '44444444-4444-4444-8444-444444444444';
const OTHER_WORKSPACE = '66666666-6666-4666-8666-666666666666';
const SOURCE_AT = '2026-08-08T08:00:00.000Z';

const principal = (
  role: WorkspacePrincipal['role'] = 'MATTER_MANAGER',
  workspaceId = WORKSPACE
): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: `session_order-${role.toLowerCase()}`,
  userId: `user_order-${role.toLowerCase()}`,
  workspaceId,
  membershipId: `membership_order-${role.toLowerCase()}`,
  role,
  permissions: ROLE_PERMISSION_MATRIX[role],
  sessionExpiresAt: '2026-08-09T00:00:00.000Z'
});

const source = (suffix = 'service'): CommercialSourceSnapshot => ({
  schemaVersion: 1,
  quote: {
    quoteId: `quote_order-${suffix}`,
    quoteVersion: 'quote-v7',
    currency: 'USD',
    totalMinor: 29900
  },
  customerConfirmation: {
    confirmationId: `confirmation_order-${suffix}`,
    confirmationVersion: 3,
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
    selectedPlanVersion: 'plan-v2'
  },
  relationshipReferences: {
    contractingParty: { referenceId: 'party_markreg' },
    paymentReceiver: { referenceId: 'party_receiver' },
    deliveryOwner: { referenceId: 'team_delivery' },
    communicationOwner: { referenceId: 'team_care' },
    customerFacingBrand: { referenceId: 'brand_markreg' },
    professionalAuthority: { referenceId: 'authority_unassigned' }
  },
  sourceCorrelationId: `correlation_order-${suffix}`,
  sourceSha256: 'a'.repeat(64),
  capturedAt: SOURCE_AT
});

const command = (value: CommercialSourceSnapshot, key = 'order-create-key'): CreateOrderCommand => ({
  workspaceId: WORKSPACE,
  orderType: 'TrademarkFiling',
  quoteId: value.quote.quoteId,
  expectedQuoteVersion: value.quote.quoteVersion,
  customerConfirmationId: value.customerConfirmation.confirmationId,
  expectedCustomerConfirmationVersion: value.customerConfirmation.confirmationVersion,
  channel: value.channel,
  relationshipModel: value.relationshipModel,
  idempotencyKey: key
});

function fixture(value = source()) {
  const repository = new InMemoryOrderRepository();
  const sources = new InMemoryOrderCommercialSourceProvider();
  sources.put(WORKSPACE, value);
  let tick = 0;
  const service = new OrderService(
    repository,
    sources,
    () => new Date(Date.parse(SOURCE_AT) + tick++ * 60_000).toISOString(),
    () => 'order_service-test'
  );
  return { repository, sources, service, value };
}

async function createDraft(
  service: OrderService,
  value: CommercialSourceSnapshot,
  key = 'order-create-key'
) {
  return service.create(principal(), command(value, key), 'correlation_order-create');
}

async function toPending(service: OrderService, value: CommercialSourceSnapshot) {
  const created = await createDraft(service, value);
  return service.requestConfirmation(
    principal(),
    {
      workspaceId: WORKSPACE,
      orderId: created.orderId,
      expectedVersion: 1,
      idempotencyKey: 'order-pending-key'
    },
    'correlation_order-pending'
  );
}

async function toConfirmed(service: OrderService, value: CommercialSourceSnapshot) {
  const pending = await toPending(service, value);
  return service.confirm(
    principal(),
    {
      workspaceId: WORKSPACE,
      orderId: pending.orderId,
      expectedVersion: 2,
      idempotencyKey: 'order-confirm-key'
    },
    'correlation_order-confirm'
  );
}

describe('M3-WP-03 protected Order service lifecycle', () => {
  it('runs the bounded Draft -> PendingConfirmation -> Confirmed -> ReadyForMatter path', async () => {
    const { repository, service, value } = fixture();
    const draft = await createDraft(service, value);
    expect(draft).toMatchObject({ status: 'Draft', version: 1 });

    const pending = await service.requestConfirmation(principal(), {
      workspaceId: WORKSPACE,
      orderId: draft.orderId,
      expectedVersion: 1,
      idempotencyKey: 'order-pending-key'
    });
    expect(pending).toMatchObject({ status: 'PendingConfirmation', version: 2 });

    const confirmed = await service.confirm(principal(), {
      workspaceId: WORKSPACE,
      orderId: draft.orderId,
      expectedVersion: 2,
      idempotencyKey: 'order-confirm-key'
    });
    expect(confirmed).toMatchObject({ status: 'Confirmed', version: 3 });

    const ready = await service.evaluateReadiness(principal(), {
      workspaceId: WORKSPACE,
      orderId: draft.orderId,
      expectedVersion: 3,
      idempotencyKey: 'order-ready-key'
    });
    expect(ready).toMatchObject({ status: 'ReadyForMatter', version: 4 });
    expect(await repository.listAudit(WORKSPACE, draft.orderId)).toMatchObject([
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
  });

  it('returns bounded projections and never leaks the owner-only full source snapshot', async () => {
    const { service, value } = fixture();
    const created = await createDraft(service, value);
    const loaded = await service.get(principal('READ_ONLY'), WORKSPACE, created.orderId);
    const page = await service.list(principal('REVIEWER'), WORKSPACE, { page: 1, pageSize: 20 });

    expect(loaded).toEqual(created);
    expect(page.items).toEqual([created]);
    const serialized = JSON.stringify(created);
    expect(serialized).not.toContain('relationshipReferences');
    expect(serialized).not.toContain('paymentReceiver');
    expect(serialized).not.toContain('commercialSourceSnapshot');
    expect(created.source).toMatchObject({
      quoteId: value.quote.quoteId,
      customerConfirmationId: value.customerConfirmation.confirmationId,
      jurisdictionReference: 'US',
      classNumbers: [9, 42]
    });
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.source)).toBe(true);
  });

  it('replays an exact mutation result even after the Order advances later', async () => {
    const { service, value } = fixture();
    const draft = await createDraft(service, value);
    const pendingCommand = {
      workspaceId: WORKSPACE,
      orderId: draft.orderId,
      expectedVersion: 1,
      idempotencyKey: 'order-replay-pending'
    } as const;
    const pending = await service.requestConfirmation(principal(), pendingCommand);
    await service.confirm(principal(), {
      workspaceId: WORKSPACE,
      orderId: draft.orderId,
      expectedVersion: 2,
      idempotencyKey: 'order-replay-confirm'
    });
    expect(await service.requestConfirmation(principal(), pendingCommand)).toEqual(pending);
    expect((await service.get(principal(), WORKSPACE, draft.orderId)).version).toBe(3);
  });

  it('rejects conflicting idempotency reuse, stale versions and invalid transitions without mutation', async () => {
    const { repository, service, value } = fixture();
    const draft = await createDraft(service, value);
    const pendingCommand = {
      workspaceId: WORKSPACE,
      orderId: draft.orderId,
      expectedVersion: 1,
      idempotencyKey: 'order-guard-key'
    } as const;
    await service.requestConfirmation(principal(), pendingCommand);
    await expect(
      service.requestConfirmation(principal(), { ...pendingCommand, expectedVersion: 2 })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(
      service.confirm(principal(), {
        workspaceId: WORKSPACE,
        orderId: draft.orderId,
        expectedVersion: 1,
        idempotencyKey: 'order-stale-confirm'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

    const second = fixture(source('invalid-transition'));
    const secondDraft = await createDraft(second.service, second.value, 'second-create');
    await expect(
      second.service.confirm(principal(), {
        workspaceId: WORKSPACE,
        orderId: secondDraft.orderId,
        expectedVersion: 1,
        idempotencyKey: 'direct-confirm'
      })
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

    expect((await repository.findById(WORKSPACE, draft.orderId))?.status).toBe('PendingConfirmation');
  });

  it('revalidates exact commercial source before protected forward transitions', async () => {
    const { repository, service, sources, value } = fixture();
    const pending = await toPending(service, value);
    sources.invalidate(WORKSPACE, value.customerConfirmation.confirmationId);
    await expect(
      service.confirm(principal(), {
        workspaceId: WORKSPACE,
        orderId: pending.orderId,
        expectedVersion: 2,
        idempotencyKey: 'order-stale-source-confirm'
      })
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
    expect((await repository.findById(WORKSPACE, pending.orderId))?.status).toBe(
      'PendingConfirmation'
    );
  });

  it('requires complete commercial scope before ReadyForMatter', async () => {
    const incomplete = source('incomplete');
    incomplete.commercialScope.goodsServices = [];
    const { service, value } = fixture(incomplete);
    const confirmed = await toConfirmed(service, value);
    await expect(
      service.evaluateReadiness(principal(), {
        workspaceId: WORKSPACE,
        orderId: confirmed.orderId,
        expectedVersion: 3,
        idempotencyKey: 'order-incomplete-ready'
      })
    ).rejects.toMatchObject({ code: 'POLICY_DENIED' });
    expect((await service.get(principal(), WORKSPACE, confirmed.orderId)).status).toBe('Confirmed');
  });

  it('derives Workspace and mutation authority from Principal, not command claims', async () => {
    const { service, value } = fixture();
    const draft = await createDraft(service, value);
    await expect(
      service.get(principal('READ_ONLY', OTHER_WORKSPACE), WORKSPACE, draft.orderId)
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' });
    await expect(
      service.requestConfirmation(principal('REVIEWER'), {
        workspaceId: WORKSPACE,
        orderId: draft.orderId,
        expectedVersion: 1,
        idempotencyKey: 'reviewer-forged-mutation'
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(await service.get(principal('REVIEWER'), WORKSPACE, draft.orderId)).toEqual(draft);
  });

  it('cancels only through the canonical transition and records protected cancellation audit', async () => {
    const { repository, service, value } = fixture();
    const draft = await createDraft(service, value);
    const cancelled = await service.cancel(principal(), {
      workspaceId: WORKSPACE,
      orderId: draft.orderId,
      expectedVersion: 1,
      reason: 'Customer withdrew the commercial request.',
      idempotencyKey: 'order-cancel-key'
    });
    expect(cancelled).toMatchObject({ status: 'Cancelled', version: 2 });
    expect(await repository.listAudit(WORKSPACE, draft.orderId)).toMatchObject([
      { action: 'ORDER_CREATED', version: 1 },
      {
        action: 'ORDER_CANCELLED',
        version: 2,
        fromStatus: 'Draft',
        toStatus: 'Cancelled'
      }
    ]);
    await expect(
      service.cancel(principal(), {
        workspaceId: WORKSPACE,
        orderId: draft.orderId,
        expectedVersion: 2,
        reason: 'Again',
        idempotencyKey: 'order-cancel-again'
      })
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('rejects mismatched source versions at admission without creating an Order', async () => {
    const { repository, service, value } = fixture();
    await expect(
      service.create(principal(), {
        ...command(value),
        expectedQuoteVersion: 'quote-v8'
      })
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
    expect(repository.evidence()).toEqual({ orders: 0, commands: 0, audits: 0 });
  });

  it('exposes only safe projection fields as the public service result', async () => {
    const { service, value } = fixture();
    const result: OrderProjection = await createDraft(service, value);
    expect(Object.keys(result).sort()).toEqual(
      [
        'channel',
        'createdAt',
        'customerId',
        'orderId',
        'orderType',
        'relationshipModel',
        'source',
        'status',
        'updatedAt',
        'version'
      ].sort()
    );
  });
});
