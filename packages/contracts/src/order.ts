import type {
  Channel,
  CustomerConfirmationId,
  FormalMatterId,
  MarkOrbitId,
  RelationshipModel
} from './index.js';

/**
 * Milestone 3 trademark-service Order contract.
 *
 * Order is the governed commercial service request. It is deliberately distinct from
 * Formal Matter, Payment, Invoice and external Filing authority.
 */
export type OrderId = `order_${string}`;

export const orderTypes = ['TRADEMARK_FILING'] as const;
export type OrderType = (typeof orderTypes)[number];

export const orderStatuses = [
  'DRAFT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'READY_FOR_MATTER',
  'MATTER_CREATED',
  'IN_PROGRESS',
  'CANCELLED'
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const orderTransitionMatrix = Object.freeze({
  DRAFT: ['PENDING_CONFIRMATION', 'CANCELLED'],
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['READY_FOR_MATTER', 'CANCELLED'],
  READY_FOR_MATTER: ['MATTER_CREATED', 'CANCELLED'],
  MATTER_CREATED: ['IN_PROGRESS'],
  IN_PROGRESS: [],
  CANCELLED: []
} as const satisfies Readonly<Record<OrderStatus, readonly OrderStatus[]>>);

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (orderStatuses as readonly string[]).includes(value);
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return (orderTransitionMatrix[from] as readonly OrderStatus[]).includes(to);
}

export class OrderTransitionError extends Error {
  readonly code = 'INVALID_TRANSITION' as const;

  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Order cannot transition from ${from} to ${to}.`);
    this.name = 'OrderTransitionError';
  }
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) throw new OrderTransitionError(from, to);
}

export interface CommercialPartyReference {
  referenceId: string;
  displayName?: string;
  sourceSystem?: string;
}

/**
 * Bounded relationship references required by the product lock. These references do
 * not grant lifecycle ownership to Order over Payment, delivery, communication or
 * professional-authority systems.
 */
export interface CommercialRelationshipReferences {
  contractingParty?: Readonly<CommercialPartyReference>;
  paymentReceiver?: Readonly<CommercialPartyReference>;
  deliveryOwner?: Readonly<CommercialPartyReference>;
  communicationOwner?: Readonly<CommercialPartyReference>;
  customerFacingBrand?: Readonly<CommercialPartyReference>;
  professionalAuthority?: Readonly<CommercialPartyReference>;
}

export interface CommercialScopeSnapshot {
  applicantReference: string;
  trademarkReference: string;
  jurisdictionReference: string;
  classNumbers: readonly number[];
  goodsServices: readonly string[];
  selectedPlanId: MarkOrbitId;
  selectedPlanVersion: string;
}

/** Immutable exact-source evidence captured when an Order is admitted. */
export interface CommercialSourceSnapshot {
  schemaVersion: 1;
  quote: Readonly<{
    quoteId: MarkOrbitId;
    quoteVersion: string;
    currency: string;
    totalMinor: number;
  }>;
  customerConfirmation: Readonly<{
    confirmationId: CustomerConfirmationId;
    confirmationVersion: number;
    status: 'CONFIRMED';
  }>;
  customerId: MarkOrbitId;
  channel: Channel;
  relationshipModel: RelationshipModel;
  commercialScope: Readonly<CommercialScopeSnapshot>;
  relationshipReferences: Readonly<CommercialRelationshipReferences>;
  sourceCorrelationId: MarkOrbitId;
  sourceSha256: string;
  capturedAt: string;
}

export type OrderMatterLinkKind = 'CREATED_FROM_ORDER' | 'COMPATIBILITY_LINK';

export interface OrderMatterReference {
  formalMatterId: FormalMatterId;
  formalMatterVersion: number;
  linkKind: OrderMatterLinkKind;
  linkedAt: string;
  linkedByUserId: MarkOrbitId;
}

export interface Order {
  schemaVersion: 1;
  orderId: OrderId;
  workspaceId: string;
  orderType: OrderType;
  status: OrderStatus;
  version: number;
  customerId: MarkOrbitId;
  channel: Channel;
  relationshipModel: RelationshipModel;
  commercialSourceSnapshot: Readonly<CommercialSourceSnapshot>;
  commercialSourceSnapshotSha256: string;
  matter?: Readonly<OrderMatterReference>;
  createdByUserId: MarkOrbitId;
  updatedByUserId: MarkOrbitId;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderCommand {
  workspaceId: string;
  orderType: OrderType;
  quoteId: MarkOrbitId;
  expectedQuoteVersion: string;
  customerConfirmationId: CustomerConfirmationId;
  expectedCustomerConfirmationVersion: number;
  channel: Channel;
  relationshipModel: RelationshipModel;
  idempotencyKey: string;
}

export interface RequestOrderConfirmationCommand {
  workspaceId: string;
  orderId: OrderId;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface ConfirmOrderCommand {
  workspaceId: string;
  orderId: OrderId;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface EvaluateOrderReadinessCommand {
  workspaceId: string;
  orderId: OrderId;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface CreateMatterFromOrderCommand {
  workspaceId: string;
  orderId: OrderId;
  expectedOrderVersion: number;
  expectedCommercialSourceSha256: string;
  idempotencyKey: string;
}

export interface LinkExistingMatterToOrderCommand {
  workspaceId: string;
  orderId: OrderId;
  expectedOrderVersion: number;
  formalMatterId: FormalMatterId;
  expectedFormalMatterVersion: number;
  expectedCommercialSourceSha256: string;
  idempotencyKey: string;
}

export interface CancelOrderCommand {
  workspaceId: string;
  orderId: OrderId;
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
}

export const orderErrorCodes = [
  'STALE_SOURCE',
  'INVALID_TRANSITION',
  'PERMISSION_DENIED',
  'POLICY_DENIED',
  'IDEMPOTENCY_CONFLICT',
  'VERSION_CONFLICT',
  'DUPLICATE_SOURCE',
  'PERSISTENCE_UNAVAILABLE'
] as const;
export type OrderErrorCode = (typeof orderErrorCodes)[number];

export interface OrderOperationError {
  code: OrderErrorCode;
  message: string;
  retryable: boolean;
}

/**
 * Authority evidence for the M3 Order path. Internal Order/Matter truth may be made
 * explicit by their named commands; financial, provider and external-filing
 * consequences remain false.
 */
export interface OrderAuthorityConsequences {
  orderCreated: boolean;
  formalMatterCreated: boolean;
  paymentCreated: false;
  invoiceCreated: false;
  professionalAppointed: false;
  providerAssignedExternally: false;
  filingCreated: false;
  filingSubmitted: false;
  officialApplicationCreated: false;
  officialApplicationNumberReceived: false;
  customerMessageSent: false;
  externalDocumentSent: false;
  trademarkOfficeContacted: false;
}

export const explicitOrderCreatedAuthorityConsequences: Readonly<OrderAuthorityConsequences> =
  Object.freeze({
    orderCreated: true,
    formalMatterCreated: false,
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

export const explicitMatterCreatedFromOrderAuthorityConsequences: Readonly<OrderAuthorityConsequences> =
  Object.freeze({
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
