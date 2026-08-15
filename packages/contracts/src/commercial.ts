import type { Channel, MarkOrbitId, Money, RelationshipModel } from './index.js';
import type { OrderId } from './order.js';

export type CommercialProductId = `product_${string}`;
export type CommercialPriceId = `price_${string}`;
export type CheckoutSessionId = `checkout_${string}`;

export const commercialProductStatuses = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export type CommercialProductStatus = (typeof commercialProductStatuses)[number];

export const commercialPriceStatuses = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export type CommercialPriceStatus = (typeof commercialPriceStatuses)[number];

export const checkoutSessionStatuses = ['INITIATED', 'EXPIRED', 'CANCELLED'] as const;
export type CheckoutSessionStatus = (typeof checkoutSessionStatuses)[number];

export const commercialServiceTypes = ['TrademarkFiling'] as const;
export type CommercialServiceType = (typeof commercialServiceTypes)[number];

export class CommercialContractError extends Error {
  readonly code = 'INVALID_COMMERCIAL_CONTRACT' as const;

  constructor(message: string) {
    super(message);
    this.name = 'CommercialContractError';
  }
}

export function assertCommercialMoney(value: Readonly<Money>): void {
  if (!Number.isSafeInteger(value.amountMinor) || value.amountMinor < 0)
    throw new CommercialContractError('Commercial money must use non-negative safe integer minor units.');
  if (!/^[A-Z]{3}$/u.test(value.currency))
    throw new CommercialContractError('Commercial money currency must be an ISO 4217-style code.');
}

export interface CommercialProduct {
  schemaVersion: 1;
  productId: CommercialProductId;
  code: string;
  name: string;
  serviceType: CommercialServiceType;
  status: CommercialProductStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialPrice {
  schemaVersion: 1;
  priceId: CommercialPriceId;
  productId: CommercialProductId;
  priceVersion: number;
  channel: Channel;
  relationshipModel: RelationshipModel;
  amount: Readonly<Money>;
  status: CommercialPriceStatus;
  validFrom: string;
  validUntil?: string;
  createdAt: string;
}

export interface CommercialCatalogItem {
  product: Readonly<CommercialProduct>;
  prices: readonly Readonly<CommercialPrice>[];
}

export interface CommercialCatalogQuery {
  channel: Channel;
  relationshipModel: RelationshipModel;
  at?: string;
}

export interface CreateCheckoutSessionCommand {
  workspaceId: string;
  orderId: OrderId;
  productId: CommercialProductId;
  expectedProductVersion: number;
  priceId: CommercialPriceId;
  expectedPriceVersion: number;
  idempotencyKey: string;
}

export interface CancelCheckoutSessionCommand {
  workspaceId: string;
  checkoutSessionId: CheckoutSessionId;
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
}

export interface CheckoutSession {
  schemaVersion: 1;
  checkoutSessionId: CheckoutSessionId;
  workspaceId: string;
  orderId: OrderId;
  initiatedByUserId: MarkOrbitId;
  productId: CommercialProductId;
  productVersion: number;
  priceId: CommercialPriceId;
  priceVersion: number;
  amount: Readonly<Money>;
  status: CheckoutSessionStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  cancelledReason?: string;
}

export interface CheckoutAuthorityConsequences {
  checkoutInitiated: true;
  paymentCreated: false;
  paymentSucceeded: false;
  orderMarkedPaid: false;
  matterCreated: false;
  professionalAppointed: false;
  providerAssignedExternally: false;
  filingCreated: false;
  filingSubmitted: false;
  officialApplicationCreated: false;
  trademarkOfficeContacted: false;
}

export const checkoutInitiatedAuthorityConsequences: Readonly<CheckoutAuthorityConsequences> =
  Object.freeze({
    checkoutInitiated: true,
    paymentCreated: false,
    paymentSucceeded: false,
    orderMarkedPaid: false,
    matterCreated: false,
    professionalAppointed: false,
    providerAssignedExternally: false,
    filingCreated: false,
    filingSubmitted: false,
    officialApplicationCreated: false,
    trademarkOfficeContacted: false
  });

export function isCommercialPriceActive(price: Readonly<CommercialPrice>, at: string): boolean {
  const timestamp = Date.parse(at);
  if (!Number.isFinite(timestamp)) return false;
  const from = Date.parse(price.validFrom);
  const until = price.validUntil ? Date.parse(price.validUntil) : Number.POSITIVE_INFINITY;
  return (
    price.status === 'ACTIVE' &&
    Number.isFinite(from) &&
    Number.isFinite(until) &&
    timestamp >= from &&
    timestamp < until
  );
}

export function assertCommercialProduct(value: Readonly<CommercialProduct>): void {
  if (!Number.isSafeInteger(value.version) || value.version < 1)
    throw new CommercialContractError('Commercial Product version must be a positive integer.');
  if (value.code.trim().length === 0 || value.name.trim().length === 0)
    throw new CommercialContractError('Commercial Product code and name are required.');
  if (!Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt)))
    throw new CommercialContractError('Commercial Product timestamps are invalid.');
}

export function assertCommercialPrice(value: Readonly<CommercialPrice>): void {
  if (!Number.isSafeInteger(value.priceVersion) || value.priceVersion < 1)
    throw new CommercialContractError('Commercial Price version must be a positive integer.');
  assertCommercialMoney(value.amount);
  if (!Number.isFinite(Date.parse(value.validFrom)))
    throw new CommercialContractError('Commercial Price validFrom is invalid.');
  if (value.validUntil !== undefined) {
    const from = Date.parse(value.validFrom);
    const until = Date.parse(value.validUntil);
    if (!Number.isFinite(until) || until <= from)
      throw new CommercialContractError('Commercial Price validUntil must be after validFrom.');
  }
  if (!Number.isFinite(Date.parse(value.createdAt)))
    throw new CommercialContractError('Commercial Price createdAt is invalid.');
}
