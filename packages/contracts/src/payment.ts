import type { MarkOrbitId, Money } from './index.js';
import type { CheckoutSessionId, CommercialPriceId, CommercialProductId } from './commercial.js';
import { assertCommercialMoney } from './commercial.js';
import type { OrderId } from './order.js';

export type PaymentId = `payment_${string}`;
export type PaymentAttemptId = `payment_attempt_${string}`;
export type PaymentRefundId = `refund_${string}`;
export type PaymentProviderEventReceiptId = `provider_event_${string}`;
export type PaymentReconciliationId = `reconciliation_${string}`;

export const paymentStatuses = [
  'PENDING',
  'REQUIRES_ACTION',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED'
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const paymentRefundStatuses = ['PENDING', 'SUCCEEDED', 'FAILED'] as const;
export type PaymentRefundStatus = (typeof paymentRefundStatuses)[number];

export const paymentReconciliationClassifications = ['MATCH', 'MISMATCH'] as const;
export type PaymentReconciliationClassification =
  (typeof paymentReconciliationClassifications)[number];

export const paymentReconciliationDispositions = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export type PaymentReconciliationDisposition = (typeof paymentReconciliationDispositions)[number];

export const canonicalProviderPaymentEvents = [
  'PAYMENT_REQUIRES_ACTION',
  'PAYMENT_PROCESSING',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'PAYMENT_CANCELLED',
  'REFUND_PENDING',
  'REFUND_SUCCEEDED',
  'REFUND_FAILED'
] as const;
export type CanonicalProviderPaymentEvent = (typeof canonicalProviderPaymentEvents)[number];

export type PaymentProviderCode = string;

export class PaymentContractError extends Error {
  readonly code = 'INVALID_PAYMENT_CONTRACT' as const;

  constructor(message: string) {
    super(message);
    this.name = 'PaymentContractError';
  }
}

export interface Payment {
  schemaVersion: 1;
  paymentId: PaymentId;
  workspaceId: string;
  checkoutSessionId: CheckoutSessionId;
  orderId: OrderId;
  initiatedByUserId: MarkOrbitId;
  productId: CommercialProductId;
  productVersion: number;
  priceId: CommercialPriceId;
  priceVersion: number;
  amount: Readonly<Money>;
  provider: PaymentProviderCode;
  status: PaymentStatus;
  version: number;
  refundedMinor: number;
  createdAt: string;
  updatedAt: string;
  succeededAt?: string;
  failedAt?: string;
  cancelledAt?: string;
}

export interface PaymentAttempt {
  schemaVersion: 1;
  paymentAttemptId: PaymentAttemptId;
  paymentId: PaymentId;
  provider: PaymentProviderCode;
  providerPaymentReference: string;
  attemptNumber: number;
  createdAt: string;
  updatedAt: string;
}

export type PaymentProviderAction =
  | Readonly<{ kind: 'NONE' }>
  | Readonly<{ kind: 'REDIRECT'; url: string }>
  | Readonly<{ kind: 'CLIENT_CONFIRMATION'; secret: string }>;

export interface InitiatePaymentCommand {
  workspaceId: string;
  checkoutSessionId: CheckoutSessionId;
  idempotencyKey: string;
}

export interface InitiatePaymentResult {
  payment: Readonly<Payment>;
  attempt: Readonly<PaymentAttempt>;
  providerAction: PaymentProviderAction;
}

export interface VerifiedProviderPaymentEvent {
  provider: PaymentProviderCode;
  providerEventId: string;
  providerPaymentReference: string;
  canonicalType: CanonicalProviderPaymentEvent;
  amount?: Readonly<Money>;
  providerRefundReference?: string;
  occurredAt: string;
}

export interface PaymentProviderEventReceipt {
  schemaVersion: 1;
  receiptId: PaymentProviderEventReceiptId;
  provider: PaymentProviderCode;
  providerEventId: string;
  providerPaymentReference: string;
  rawSha256: string;
  canonicalType: CanonicalProviderPaymentEvent;
  paymentId?: PaymentId;
  refundId?: PaymentRefundId;
  occurredAt: string;
  receivedAt: string;
  verifiedAt: string;
  applied: boolean;
  ignoredReason?: string;
}

export interface PaymentRefund {
  schemaVersion: 1;
  refundId: PaymentRefundId;
  paymentId: PaymentId;
  workspaceId: string;
  requestedByUserId: MarkOrbitId;
  amount: Readonly<Money>;
  status: PaymentRefundStatus;
  version: number;
  providerRefundReference?: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
  succeededAt?: string;
  failedAt?: string;
}

export interface CreatePaymentRefundCommand {
  workspaceId: string;
  paymentId: PaymentId;
  amountMinor: number;
  reason: string;
  idempotencyKey: string;
}

export interface PaymentReconciliationObservation {
  schemaVersion: 1;
  reconciliationId: PaymentReconciliationId;
  workspaceId: string;
  paymentId: PaymentId;
  provider: PaymentProviderCode;
  providerPaymentReference: string;
  localStatus: PaymentStatus;
  observedProviderStatus: string;
  localAmount: Readonly<Money>;
  observedAmount: Readonly<Money>;
  classification: PaymentReconciliationClassification;
  disposition: PaymentReconciliationDisposition;
  operatorNote?: string;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSucceededAuthorityConsequences {
  paymentSucceeded: true;
  orderMarkedPaid: false;
  matterCreated: false;
  matterCompleted: false;
  professionalAppointed: false;
  providerAssignedExternally: false;
  filingCreated: false;
  filingSubmitted: false;
  officialApplicationCreated: false;
  trademarkOfficeContacted: false;
}

export const paymentSucceededAuthorityConsequences: Readonly<PaymentSucceededAuthorityConsequences> =
  Object.freeze({
    paymentSucceeded: true,
    orderMarkedPaid: false,
    matterCreated: false,
    matterCompleted: false,
    professionalAppointed: false,
    providerAssignedExternally: false,
    filingCreated: false,
    filingSubmitted: false,
    officialApplicationCreated: false,
    trademarkOfficeContacted: false
  });

export function assertPaymentProviderCode(provider: string): void {
  if (!/^[A-Z][A-Z0-9_]{1,63}$/u.test(provider))
    throw new PaymentContractError('Payment provider code must be a stable uppercase identifier.');
}

export function assertPayment(value: Readonly<Payment>): void {
  assertCommercialMoney(value.amount);
  assertPaymentProviderCode(value.provider);
  if (!Number.isSafeInteger(value.version) || value.version < 1)
    throw new PaymentContractError('Payment version must be a positive integer.');
  if (!Number.isSafeInteger(value.refundedMinor) || value.refundedMinor < 0)
    throw new PaymentContractError('Payment refundedMinor must be a non-negative integer.');
  if (value.refundedMinor > value.amount.amountMinor)
    throw new PaymentContractError('Payment refundedMinor cannot exceed the successful amount.');
  if (!Number.isSafeInteger(value.productVersion) || value.productVersion < 1)
    throw new PaymentContractError('Payment Product version must be a positive integer.');
  if (!Number.isSafeInteger(value.priceVersion) || value.priceVersion < 1)
    throw new PaymentContractError('Payment Price version must be a positive integer.');
  if (
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !Number.isFinite(Date.parse(value.updatedAt))
  )
    throw new PaymentContractError('Payment timestamps are invalid.');
}

export function assertPaymentRefund(value: Readonly<PaymentRefund>): void {
  assertCommercialMoney(value.amount);
  if (value.amount.amountMinor <= 0)
    throw new PaymentContractError('Refund amount must be greater than zero.');
  if (!Number.isSafeInteger(value.version) || value.version < 1)
    throw new PaymentContractError('Refund version must be a positive integer.');
  if (value.reason.trim().length === 0)
    throw new PaymentContractError('Refund reason is required.');
  if (
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !Number.isFinite(Date.parse(value.updatedAt))
  )
    throw new PaymentContractError('Refund timestamps are invalid.');
}

export function assertPaymentReconciliation(
  value: Readonly<PaymentReconciliationObservation>
): void {
  assertCommercialMoney(value.localAmount);
  assertCommercialMoney(value.observedAmount);
  assertPaymentProviderCode(value.provider);
  if (
    !Number.isFinite(Date.parse(value.observedAt)) ||
    !Number.isFinite(Date.parse(value.createdAt))
  )
    throw new PaymentContractError('Reconciliation timestamps are invalid.');
}
