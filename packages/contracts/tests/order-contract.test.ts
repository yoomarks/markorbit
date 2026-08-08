import { describe, expect, it } from 'vitest';
import type { CustomerConfirmation, FormalMatter, Quote } from '../src/index.js';
import {
  assertOrderTransition,
  canTransitionOrder,
  explicitMatterCreatedFromOrderAuthorityConsequences,
  explicitOrderCreatedAuthorityConsequences,
  isOrderStatus,
  m3PrimaryOrderPath,
  orderErrorCodes,
  orderStatuses,
  orderTransitionMatrix,
  orderTypes,
  OrderTransitionError,
  type CancelOrderCommand,
  type CommercialSourceSnapshot,
  type ConfirmOrderCommand,
  type CreateMatterFromOrderCommand,
  type CreateOrderCommand,
  type EvaluateOrderReadinessCommand,
  type LinkExistingMatterToOrderCommand,
  type OrderMatterReference,
  type RequestOrderConfirmationCommand
} from '../src/order.js';

const commercialSource = {
  schemaVersion: 1,
  quote: {
    quoteId: 'quote_order-source',
    quoteVersion: 'quote-v7',
    currency: 'USD',
    totalMinor: 29900
  },
  customerConfirmation: {
    confirmationId: 'confirmation_order-source',
    confirmationVersion: 3,
    status: 'CONFIRMED'
  },
  customerId: 'customer_order-source',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  commercialScope: {
    applicantReference: 'applicant:customer_order-source',
    trademarkReference: 'mark:ORBIT',
    jurisdictionReference: 'US',
    classNumbers: [9, 42],
    goodsServices: ['downloadable software', 'software as a service'],
    selectedPlanId: 'plan_order-source',
    selectedPlanVersion: 'plan-v2'
  },
  relationshipReferences: {
    contractingParty: { referenceId: 'party_markreg-us', displayName: 'MarkReg' },
    paymentReceiver: { referenceId: 'party_payment-receiver' },
    deliveryOwner: { referenceId: 'team_markreg-delivery' },
    communicationOwner: { referenceId: 'team_markreg-care' },
    customerFacingBrand: { referenceId: 'brand_markreg' },
    professionalAuthority: { referenceId: 'authority_unassigned' }
  },
  sourceCorrelationId: 'correlation_order-source',
  sourceSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  capturedAt: '2026-08-08T03:00:00.000Z'
} as const satisfies CommercialSourceSnapshot;

describe('Milestone 3 Order contract', () => {
  it('consumes the initial Order type and exact canonical publication status values', () => {
    expect(orderTypes).toEqual(['TrademarkFiling']);
    expect(orderStatuses).toEqual([
      'Draft',
      'PendingConfirmation',
      'Confirmed',
      'ReadyForMatter',
      'MatterCreated',
      'InProgress',
      'WaitingForCustomer',
      'Completed',
      'Cancelled',
      'Archived',
      'DeletedReferenceOnly'
    ]);
    expect(m3PrimaryOrderPath).toEqual([
      'Draft',
      'PendingConfirmation',
      'Confirmed',
      'ReadyForMatter',
      'MatterCreated',
      'InProgress'
    ]);
    expect(new Set(orderStatuses).size).toBe(orderStatuses.length);
    expect(orderStatuses.every(isOrderStatus)).toBe(true);
    expect(isOrderStatus('Paid')).toBe(false);
    expect(isOrderStatus('Filed')).toBe(false);
    expect(isOrderStatus('Accepted')).toBe(false);
  });

  it('locks the complete B02 canonical Order transition matrix', () => {
    expect(orderTransitionMatrix).toEqual({
      Draft: ['PendingConfirmation', 'Cancelled', 'Archived'],
      PendingConfirmation: ['Draft', 'Confirmed', 'Cancelled'],
      Confirmed: ['ReadyForMatter', 'InProgress', 'Cancelled'],
      ReadyForMatter: ['MatterCreated', 'InProgress', 'Cancelled'],
      MatterCreated: ['InProgress', 'Completed', 'Cancelled'],
      InProgress: ['WaitingForCustomer', 'Completed', 'Cancelled'],
      WaitingForCustomer: ['InProgress', 'Cancelled'],
      Completed: ['Archived'],
      Cancelled: ['Archived'],
      Archived: [],
      DeletedReferenceOnly: []
    });

    expect(canTransitionOrder('Draft', 'PendingConfirmation')).toBe(true);
    expect(canTransitionOrder('PendingConfirmation', 'Confirmed')).toBe(true);
    expect(canTransitionOrder('Confirmed', 'ReadyForMatter')).toBe(true);
    expect(canTransitionOrder('ReadyForMatter', 'MatterCreated')).toBe(true);
    expect(canTransitionOrder('MatterCreated', 'InProgress')).toBe(true);
    expect(canTransitionOrder('InProgress', 'WaitingForCustomer')).toBe(true);
    expect(canTransitionOrder('Completed', 'Archived')).toBe(true);
    expect(canTransitionOrder('Cancelled', 'Archived')).toBe(true);
  });

  it('rejects unlisted transitions instead of treating actions, finance or filing as state', () => {
    expect(canTransitionOrder('Draft', 'Confirmed')).toBe(false);
    expect(canTransitionOrder('Confirmed', 'MatterCreated')).toBe(false);
    expect(canTransitionOrder('Archived', 'Draft')).toBe(false);
    expect(canTransitionOrder('DeletedReferenceOnly', 'Draft')).toBe(false);

    expect(() => assertOrderTransition('Confirmed', 'MatterCreated')).toThrow(
      OrderTransitionError
    );
    try {
      assertOrderTransition('Confirmed', 'MatterCreated');
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_TRANSITION' });
    }
  });

  it('captures exact commercial source and remains type-compatible with existing contracts', () => {
    const quoteId: Quote['quoteId'] = commercialSource.quote.quoteId;
    const confirmationId: CustomerConfirmation['confirmationId'] =
      commercialSource.customerConfirmation.confirmationId;
    const matterReference = {
      formalMatterId: 'formal-matter_order-source',
      formalMatterVersion: 1,
      linkKind: 'CREATED_FROM_ORDER',
      linkedAt: '2026-08-08T03:05:00.000Z',
      linkedByUserId: 'user_order-manager'
    } as const satisfies OrderMatterReference;
    const matterId: FormalMatter['formalMatterId'] = matterReference.formalMatterId;

    expect(quoteId).toBe('quote_order-source');
    expect(confirmationId).toBe('confirmation_order-source');
    expect(matterId).toBe('formal-matter_order-source');
    expect(commercialSource.channel).toBe('MARKREG_DIRECT');
    expect(commercialSource.relationshipModel).toBe('DIRECT');
    expect(commercialSource.commercialScope.classNumbers).toEqual([9, 42]);
    expect(commercialSource.sourceSha256).toHaveLength(64);
  });

  it('defines exact-version commands for the complete bounded M3 lifecycle', () => {
    const create = {
      workspaceId: 'workspace-order',
      orderType: 'TrademarkFiling',
      quoteId: commercialSource.quote.quoteId,
      expectedQuoteVersion: commercialSource.quote.quoteVersion,
      customerConfirmationId: commercialSource.customerConfirmation.confirmationId,
      expectedCustomerConfirmationVersion:
        commercialSource.customerConfirmation.confirmationVersion,
      channel: commercialSource.channel,
      relationshipModel: commercialSource.relationshipModel,
      idempotencyKey: 'order-create-key'
    } satisfies CreateOrderCommand;
    const pending = {
      workspaceId: create.workspaceId,
      orderId: 'order_test',
      expectedVersion: 1,
      idempotencyKey: 'order-pending-key'
    } satisfies RequestOrderConfirmationCommand;
    const confirm = {
      ...pending,
      expectedVersion: 2,
      idempotencyKey: 'order-confirm-key'
    } satisfies ConfirmOrderCommand;
    const readiness = {
      ...pending,
      expectedVersion: 3,
      idempotencyKey: 'order-readiness-key'
    } satisfies EvaluateOrderReadinessCommand;
    const createMatter = {
      workspaceId: create.workspaceId,
      orderId: pending.orderId,
      expectedOrderVersion: 4,
      expectedCommercialSourceSha256: commercialSource.sourceSha256,
      idempotencyKey: 'order-matter-key'
    } satisfies CreateMatterFromOrderCommand;
    const linkMatter = {
      ...createMatter,
      formalMatterId: 'formal-matter_existing',
      expectedFormalMatterVersion: 1,
      idempotencyKey: 'order-link-key'
    } satisfies LinkExistingMatterToOrderCommand;
    const cancel = {
      workspaceId: create.workspaceId,
      orderId: pending.orderId,
      expectedVersion: 3,
      reason: 'Customer withdrew the commercial request.',
      idempotencyKey: 'order-cancel-key'
    } satisfies CancelOrderCommand;

    expect(create.expectedCustomerConfirmationVersion).toBe(3);
    expect(confirm.expectedVersion).toBe(2);
    expect(readiness.expectedVersion).toBe(3);
    expect(createMatter.expectedCommercialSourceSha256).toBe(commercialSource.sourceSha256);
    expect(linkMatter.formalMatterId).toBe('formal-matter_existing');
    expect(cancel.reason).toContain('withdrew');
  });

  it('locks the required typed error vocabulary', () => {
    expect(orderErrorCodes).toEqual([
      'STALE_SOURCE',
      'INVALID_TRANSITION',
      'PERMISSION_DENIED',
      'POLICY_DENIED',
      'IDEMPOTENCY_CONFLICT',
      'VERSION_CONFLICT',
      'DUPLICATE_SOURCE',
      'PERSISTENCE_UNAVAILABLE'
    ]);
    expect(new Set(orderErrorCodes).size).toBe(orderErrorCodes.length);
  });

  it('proves Confirmed is not paid and MatterCreated is not filed', () => {
    expect(explicitOrderCreatedAuthorityConsequences).toMatchObject({
      orderCreated: true,
      formalMatterCreated: false,
      paymentCreated: false,
      invoiceCreated: false,
      filingCreated: false,
      filingSubmitted: false
    });
    expect(explicitMatterCreatedFromOrderAuthorityConsequences).toMatchObject({
      orderCreated: true,
      formalMatterCreated: true,
      paymentCreated: false,
      invoiceCreated: false,
      professionalAppointed: false,
      providerAssignedExternally: false,
      filingCreated: false,
      filingSubmitted: false,
      officialApplicationCreated: false,
      officialApplicationNumberReceived: false,
      customerMessageSent: false,
      externalDocumentSent: false,
      trademarkOfficeContacted: false
    });
  });
});
