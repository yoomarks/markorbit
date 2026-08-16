import { createHash, randomUUID } from 'node:crypto';
import type { Permission, WorkspacePrincipal } from '@markorbit/contracts';
import type {
  CanonicalProviderPaymentEvent,
  CreatePaymentRefundCommand,
  Payment,
  PaymentAttempt,
  PaymentId,
  PaymentProviderCode,
  PaymentProviderEventReceipt,
  PaymentProviderEventReceiptId,
  PaymentReconciliationId,
  PaymentReconciliationObservation,
  PaymentRefund,
  PaymentRefundId,
  VerifiedProviderPaymentEvent
} from '@markorbit/contracts/payment';
import {
  assertPayment,
  assertPaymentProviderCode,
  assertPaymentReconciliation,
  assertPaymentRefund
} from '@markorbit/contracts/payment';

export type PaymentLifecycleErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'WORKSPACE_MISMATCH'
  | 'PERMISSION_DENIED'
  | 'PAYMENT_NOT_FOUND'
  | 'REFUND_NOT_FOUND'
  | 'REFUND_NOT_ALLOWED'
  | 'REFUND_AMOUNT_EXCEEDED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'WEBHOOK_VERIFICATION_FAILED'
  | 'PROVIDER_EVENT_INVALID'
  | 'PROVIDER_UNAVAILABLE'
  | 'PERSISTENCE_UNAVAILABLE';

export class PaymentLifecycleError extends Error {
  constructor(
    readonly code: PaymentLifecycleErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PaymentLifecycleError';
  }
}

export interface PaymentWebhookInput {
  rawBody: Uint8Array;
  headers: Readonly<Record<string, string | undefined>>;
  receivedAt?: string;
}

export interface PaymentProviderRefundCommand {
  paymentId: PaymentId;
  providerPaymentReference: string;
  refundId: PaymentRefundId;
  amountMinor: number;
  currency: string;
  providerIdempotencyKey: string;
  reason: string;
}

export interface PaymentProviderRefundResult {
  providerRefundReference: string;
  status: 'PENDING';
}

export interface PaymentProviderSnapshot {
  providerPaymentReference: string;
  status: string;
  amountMinor: number;
  currency: string;
  observedAt: string;
}

export interface PaymentLifecycleProviderAdapter {
  readonly code: PaymentProviderCode;
  verifyWebhook(input: Readonly<PaymentWebhookInput>): Promise<VerifiedProviderPaymentEvent>;
  createRefund(
    command: Readonly<PaymentProviderRefundCommand>
  ): Promise<PaymentProviderRefundResult>;
  retrievePayment(providerPaymentReference: string): Promise<PaymentProviderSnapshot>;
}

export interface PaymentLifecycleAggregate {
  payment: Payment;
  attempt: PaymentAttempt;
}

export interface PaymentRefundReplay {
  fingerprint: string;
  refund: PaymentRefund;
}

export interface PaymentEventApplyResult {
  receipt: PaymentProviderEventReceipt;
  payment?: Payment;
  refund?: PaymentRefund;
}

export interface PaymentLifecycleRepository {
  findEventReceipt(
    provider: PaymentProviderCode,
    providerEventId: string
  ): Promise<PaymentProviderEventReceipt | null>;
  findByPaymentId(
    workspaceId: string,
    paymentId: PaymentId
  ): Promise<PaymentLifecycleAggregate | null>;
  findByProviderPaymentReference(
    provider: PaymentProviderCode,
    providerPaymentReference: string
  ): Promise<PaymentLifecycleAggregate | null>;
  recordPaymentEventAtomically(
    receipt: PaymentProviderEventReceipt,
    expectedPaymentVersion: number | null,
    nextPayment?: Payment
  ): Promise<PaymentEventApplyResult>;
  findRefundByProviderReference(providerRefundReference: string): Promise<PaymentRefund | null>;
  recordRefundEventAtomically(
    receipt: PaymentProviderEventReceipt,
    expectedRefundVersion: number | null,
    nextRefund?: PaymentRefund,
    expectedPaymentVersion?: number | null,
    nextPayment?: Payment
  ): Promise<PaymentEventApplyResult>;
  findRefundReplay(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<PaymentRefundReplay | null>;
  sumReservedRefundMinor(paymentId: PaymentId): Promise<number>;
  createRefundAtomically(
    refund: PaymentRefund,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<PaymentRefundReplay>;
  saveReconciliation(
    observation: PaymentReconciliationObservation
  ): Promise<PaymentReconciliationObservation>;
}

const clone = <T>(value: T): T => structuredClone(value);
const terminalPaymentStatuses = new Set<Payment['status']>(['SUCCEEDED', 'FAILED', 'CANCELLED']);

function authorize(
  principal: WorkspacePrincipal,
  workspaceId: string,
  permission: Permission,
  adminOnly = false
): void {
  if (principal.kind !== 'WORKSPACE')
    throw new PaymentLifecycleError(
      'AUTHENTICATION_REQUIRED',
      'A Workspace Principal is required.'
    );
  if (principal.workspaceId !== workspaceId)
    throw new PaymentLifecycleError('WORKSPACE_MISMATCH', 'Workspace context does not match.');
  if (!principal.permissions.includes(permission))
    throw new PaymentLifecycleError('PERMISSION_DENIED', `${permission} permission is required.`);
  if (adminOnly && principal.role !== 'WORKSPACE_ADMIN')
    throw new PaymentLifecycleError('PERMISSION_DENIED', 'Workspace Admin role is required.');
}

function sha256(input: Uint8Array | string): string {
  return createHash('sha256').update(input).digest('hex');
}

function eventReceiptId(provider: string, providerEventId: string): PaymentProviderEventReceiptId {
  return `provider_event_${sha256(`${provider}:${providerEventId}`).slice(0, 32)}`;
}

function refundFingerprint(command: CreatePaymentRefundCommand): string {
  return sha256(
    JSON.stringify({
      workspaceId: command.workspaceId,
      paymentId: command.paymentId,
      amountMinor: command.amountMinor,
      reason: command.reason.trim()
    })
  );
}

function eventToPaymentStatus(type: CanonicalProviderPaymentEvent): Payment['status'] | null {
  switch (type) {
    case 'PAYMENT_REQUIRES_ACTION':
      return 'REQUIRES_ACTION';
    case 'PAYMENT_PROCESSING':
      return 'PROCESSING';
    case 'PAYMENT_SUCCEEDED':
      return 'SUCCEEDED';
    case 'PAYMENT_FAILED':
      return 'FAILED';
    case 'PAYMENT_CANCELLED':
      return 'CANCELLED';
    default:
      return null;
  }
}

function eventToRefundStatus(type: CanonicalProviderPaymentEvent): PaymentRefund['status'] | null {
  switch (type) {
    case 'REFUND_PENDING':
      return 'PENDING';
    case 'REFUND_SUCCEEDED':
      return 'SUCCEEDED';
    case 'REFUND_FAILED':
      return 'FAILED';
    default:
      return null;
  }
}

function validForwardPaymentTransition(
  current: Payment['status'],
  next: Payment['status']
): boolean {
  if (current === next) return true;
  if (terminalPaymentStatuses.has(current)) return false;
  if (current === 'PENDING') return true;
  if (current === 'REQUIRES_ACTION')
    return ['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'].includes(next);
  if (current === 'PROCESSING') return ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(next);
  return false;
}

function sameMoney(
  amount: Readonly<{ amountMinor: number; currency: string }> | undefined,
  expected: Readonly<{ amountMinor: number; currency: string }>
): boolean {
  return (
    amount !== undefined &&
    amount.amountMinor === expected.amountMinor &&
    amount.currency === expected.currency
  );
}

export class InMemoryPaymentLifecycleRepository implements PaymentLifecycleRepository {
  private readonly payments = new Map<string, Payment>();
  private readonly attempts = new Map<string, PaymentAttempt>();
  private readonly receipts = new Map<string, PaymentProviderEventReceipt>();
  private readonly refunds = new Map<string, PaymentRefund>();
  private readonly refundCommands = new Map<string, PaymentRefundReplay>();
  private readonly reconciliations = new Map<string, PaymentReconciliationObservation>();
  private chain: Promise<void> = Promise.resolve();

  putPayment(payment: Payment, attempt: PaymentAttempt): void {
    assertPayment(payment);
    this.payments.set(payment.paymentId, clone(payment));
    this.attempts.set(attempt.paymentAttemptId, clone(attempt));
  }

  findEventReceipt(provider: string, providerEventId: string) {
    const value = this.receipts.get(`${provider}:${providerEventId}`);
    return Promise.resolve(value ? clone(value) : null);
  }

  findByPaymentId(workspaceId: string, paymentId: PaymentId) {
    const payment = this.payments.get(paymentId);
    if (!payment || payment.workspaceId !== workspaceId) return Promise.resolve(null);
    const attempt = [...this.attempts.values()]
      .filter((candidate) => candidate.paymentId === paymentId)
      .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
    return Promise.resolve(attempt ? { payment: clone(payment), attempt: clone(attempt) } : null);
  }

  findByProviderPaymentReference(provider: string, reference: string) {
    const attempt = [...this.attempts.values()].find(
      (candidate) =>
        candidate.provider === provider && candidate.providerPaymentReference === reference
    );
    if (!attempt) return Promise.resolve(null);
    const payment = this.payments.get(attempt.paymentId);
    return Promise.resolve(payment ? { payment: clone(payment), attempt: clone(attempt) } : null);
  }

  async recordPaymentEventAtomically(
    receipt: PaymentProviderEventReceipt,
    expectedPaymentVersion: number | null,
    nextPayment?: Payment
  ): Promise<PaymentEventApplyResult> {
    return this.atomic(() => {
      const key = `${receipt.provider}:${receipt.providerEventId}`;
      const existing = this.receipts.get(key);
      if (existing) return { receipt: clone(existing) };
      if (nextPayment) {
        const current = this.payments.get(nextPayment.paymentId);
        if (!current || current.version !== expectedPaymentVersion)
          throw new PaymentLifecycleError('PERSISTENCE_UNAVAILABLE', 'Payment version changed.');
        this.payments.set(nextPayment.paymentId, clone(nextPayment));
      }
      this.receipts.set(key, clone(receipt));
      return { receipt: clone(receipt), ...(nextPayment ? { payment: clone(nextPayment) } : {}) };
    });
  }

  findRefundByProviderReference(reference: string): Promise<PaymentRefund | null> {
    const value = [...this.refunds.values()].find(
      (refund) => refund.providerRefundReference === reference
    );
    return Promise.resolve(value ? clone(value) : null);
  }

  async recordRefundEventAtomically(
    receipt: PaymentProviderEventReceipt,
    expectedRefundVersion: number | null,
    nextRefund?: PaymentRefund,
    expectedPaymentVersion: number | null = null,
    nextPayment?: Payment
  ): Promise<PaymentEventApplyResult> {
    return this.atomic(() => {
      const key = `${receipt.provider}:${receipt.providerEventId}`;
      const existing = this.receipts.get(key);
      if (existing) return { receipt: clone(existing) };
      if (nextRefund) {
        const currentRefund = this.refunds.get(nextRefund.refundId);
        if (!currentRefund || currentRefund.version !== expectedRefundVersion)
          throw new PaymentLifecycleError('PERSISTENCE_UNAVAILABLE', 'Refund version changed.');
      }
      if (nextPayment) {
        const currentPayment = this.payments.get(nextPayment.paymentId);
        if (!currentPayment || currentPayment.version !== expectedPaymentVersion)
          throw new PaymentLifecycleError('PERSISTENCE_UNAVAILABLE', 'Payment version changed.');
      }
      if (nextRefund) this.refunds.set(nextRefund.refundId, clone(nextRefund));
      if (nextPayment) this.payments.set(nextPayment.paymentId, clone(nextPayment));
      this.receipts.set(key, clone(receipt));
      return {
        receipt: clone(receipt),
        ...(nextRefund ? { refund: clone(nextRefund) } : {}),
        ...(nextPayment ? { payment: clone(nextPayment) } : {})
      };
    });
  }

  findRefundReplay(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<PaymentRefundReplay | null> {
    const value = this.refundCommands.get(`${workspaceId}:${idempotencyKey}`);
    return Promise.resolve(value ? clone(value) : null);
  }

  sumReservedRefundMinor(paymentId: PaymentId): Promise<number> {
    return Promise.resolve(
      [...this.refunds.values()]
        .filter(
          (refund) =>
            refund.paymentId === paymentId && ['PENDING', 'SUCCEEDED'].includes(refund.status)
        )
        .reduce((sum, refund) => sum + refund.amount.amountMinor, 0)
    );
  }

  async createRefundAtomically(
    refund: PaymentRefund,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<PaymentRefundReplay> {
    return this.atomic(() => {
      const key = `${refund.workspaceId}:${idempotencyKey}`;
      const existing = this.refundCommands.get(key);
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new PaymentLifecycleError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key has conflicting input.'
          );
        return clone(existing);
      }
      const payment = this.payments.get(refund.paymentId);
      if (!payment || payment.workspaceId !== refund.workspaceId)
        throw new PaymentLifecycleError('PAYMENT_NOT_FOUND', 'Payment was not found.');
      const reserved = [...this.refunds.values()]
        .filter(
          (candidate) =>
            candidate.paymentId === refund.paymentId &&
            ['PENDING', 'SUCCEEDED'].includes(candidate.status)
        )
        .reduce((sum, candidate) => sum + candidate.amount.amountMinor, 0);
      if (reserved + refund.amount.amountMinor > payment.amount.amountMinor)
        throw new PaymentLifecycleError(
          'REFUND_AMOUNT_EXCEEDED',
          'Cumulative pending and successful refunds exceed the Payment amount.'
        );
      this.refunds.set(refund.refundId, clone(refund));
      const replay = { fingerprint, refund: clone(refund) };
      this.refundCommands.set(key, replay);
      return clone(replay);
    });
  }

  saveReconciliation(observation: PaymentReconciliationObservation) {
    assertPaymentReconciliation(observation);
    this.reconciliations.set(observation.reconciliationId, clone(observation));
    return Promise.resolve(clone(observation));
  }

  private async atomic<T>(work: () => T): Promise<T> {
    let result!: T;
    let thrown: unknown;
    const run = this.chain.then(() => {
      try {
        result = work();
      } catch (error) {
        thrown = error;
      }
    });
    this.chain = run.then(
      () => undefined,
      () => undefined
    );
    await run;
    if (thrown !== undefined) {
      if (thrown instanceof Error) throw thrown;
      throw new PaymentLifecycleError(
        'PERSISTENCE_UNAVAILABLE',
        'Payment lifecycle operation failed.'
      );
    }
    return result;
  }
}

export class PaymentLifecycleService {
  constructor(
    private readonly repository: PaymentLifecycleRepository,
    private readonly provider: PaymentLifecycleProviderAdapter,
    private readonly now = () => new Date().toISOString(),
    private readonly refundId = () => `refund_${randomUUID()}` as PaymentRefundId,
    private readonly reconciliationId = () =>
      `reconciliation_${randomUUID()}` as PaymentReconciliationId
  ) {
    assertPaymentProviderCode(provider.code);
  }

  async handleWebhook(
    input: Readonly<PaymentWebhookInput>
  ): Promise<Readonly<PaymentEventApplyResult>> {
    let event: VerifiedProviderPaymentEvent;
    try {
      event = await this.provider.verifyWebhook(input);
    } catch (cause) {
      throw new PaymentLifecycleError(
        'WEBHOOK_VERIFICATION_FAILED',
        'Payment provider webhook signature could not be verified.',
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (event.provider !== this.provider.code)
      throw new PaymentLifecycleError(
        'PROVIDER_EVENT_INVALID',
        'Webhook provider does not match adapter.'
      );
    if (!event.providerEventId.trim() || !event.providerPaymentReference.trim())
      throw new PaymentLifecycleError(
        'PROVIDER_EVENT_INVALID',
        'Webhook event identifiers are required.'
      );
    if (!Number.isFinite(Date.parse(event.occurredAt)))
      throw new PaymentLifecycleError('PROVIDER_EVENT_INVALID', 'Webhook occurredAt is invalid.');

    const duplicate = await this.repository.findEventReceipt(event.provider, event.providerEventId);
    if (duplicate) return Object.freeze({ receipt: Object.freeze(clone(duplicate)) });

    const receivedAt = input.receivedAt ?? this.now();
    const baseReceipt = {
      schemaVersion: 1 as const,
      receiptId: eventReceiptId(event.provider, event.providerEventId),
      provider: event.provider,
      providerEventId: event.providerEventId,
      providerPaymentReference: event.providerPaymentReference,
      rawSha256: sha256(input.rawBody),
      canonicalType: event.canonicalType,
      occurredAt: event.occurredAt,
      receivedAt,
      verifiedAt: receivedAt
    };

    const paymentStatus = eventToPaymentStatus(event.canonicalType);
    if (paymentStatus) return this.applyPaymentEvent(event, baseReceipt, paymentStatus);
    const refundStatus = eventToRefundStatus(event.canonicalType);
    if (refundStatus) return this.applyRefundEvent(event, baseReceipt, refundStatus);
    throw new PaymentLifecycleError(
      'PROVIDER_EVENT_INVALID',
      'Unsupported canonical provider event.'
    );
  }

  async requestRefund(
    principal: WorkspacePrincipal,
    command: CreatePaymentRefundCommand
  ): Promise<Readonly<PaymentRefund>> {
    authorize(principal, command.workspaceId, 'order:update', true);
    if (!Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0)
      throw new PaymentLifecycleError(
        'REFUND_NOT_ALLOWED',
        'Refund amount must be a positive integer.'
      );
    if (!command.reason.trim())
      throw new PaymentLifecycleError('REFUND_NOT_ALLOWED', 'Refund reason is required.');
    const fingerprint = refundFingerprint(command);
    const replay = await this.repository.findRefundReplay(
      command.workspaceId,
      command.idempotencyKey
    );
    if (replay) {
      if (replay.fingerprint !== fingerprint)
        throw new PaymentLifecycleError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has conflicting input.'
        );
      return Object.freeze(clone(replay.refund));
    }

    const aggregate = await this.findAggregateByPayment(command.workspaceId, command.paymentId);
    const { payment, attempt } = aggregate;
    if (payment.status !== 'SUCCEEDED')
      throw new PaymentLifecycleError(
        'REFUND_NOT_ALLOWED',
        'Only a successful Payment can be refunded.'
      );
    const reserved = await this.repository.sumReservedRefundMinor(payment.paymentId);
    if (reserved + command.amountMinor > payment.amount.amountMinor)
      throw new PaymentLifecycleError(
        'REFUND_AMOUNT_EXCEEDED',
        'Cumulative pending and successful refunds exceed the Payment amount.'
      );

    const refundId = this.refundId();
    let providerResult: PaymentProviderRefundResult;
    try {
      providerResult = await this.provider.createRefund({
        paymentId: payment.paymentId,
        providerPaymentReference: attempt.providerPaymentReference,
        refundId,
        amountMinor: command.amountMinor,
        currency: payment.amount.currency,
        providerIdempotencyKey: sha256(
          `${payment.paymentId}:${command.workspaceId}:${command.idempotencyKey}`
        ),
        reason: command.reason.trim()
      });
    } catch (cause) {
      throw new PaymentLifecycleError(
        'PROVIDER_UNAVAILABLE',
        'Payment provider refund is unavailable.',
        {
          cause: cause instanceof Error ? cause : undefined
        }
      );
    }
    if (!providerResult.providerRefundReference.trim() || providerResult.status !== 'PENDING')
      throw new PaymentLifecycleError(
        'PROVIDER_EVENT_INVALID',
        'Provider refund creation returned an invalid result.'
      );
    const at = this.now();
    const refund: PaymentRefund = {
      schemaVersion: 1,
      refundId,
      paymentId: payment.paymentId,
      workspaceId: payment.workspaceId,
      requestedByUserId: principal.userId as PaymentRefund['requestedByUserId'],
      amount: { amountMinor: command.amountMinor, currency: payment.amount.currency },
      status: 'PENDING',
      version: 1,
      providerRefundReference: providerResult.providerRefundReference,
      reason: command.reason.trim(),
      createdAt: at,
      updatedAt: at
    };
    assertPaymentRefund(refund);
    const stored = await this.repository.createRefundAtomically(
      refund,
      command.idempotencyKey,
      fingerprint
    );
    return Object.freeze(clone(stored.refund));
  }

  async reconcile(
    principal: WorkspacePrincipal,
    workspaceId: string,
    paymentId: PaymentId
  ): Promise<Readonly<PaymentReconciliationObservation>> {
    authorize(principal, workspaceId, 'order:read', true);
    const aggregate = await this.findAggregateByPayment(workspaceId, paymentId);
    let snapshot: PaymentProviderSnapshot;
    try {
      snapshot = await this.provider.retrievePayment(aggregate.attempt.providerPaymentReference);
    } catch (cause) {
      throw new PaymentLifecycleError(
        'PROVIDER_UNAVAILABLE',
        'Payment provider reconciliation is unavailable.',
        {
          cause: cause instanceof Error ? cause : undefined
        }
      );
    }
    const match =
      snapshot.providerPaymentReference === aggregate.attempt.providerPaymentReference &&
      snapshot.status === aggregate.payment.status &&
      snapshot.amountMinor === aggregate.payment.amount.amountMinor &&
      snapshot.currency === aggregate.payment.amount.currency;
    const at = this.now();
    const observation: PaymentReconciliationObservation = {
      schemaVersion: 1,
      reconciliationId: this.reconciliationId(),
      workspaceId,
      paymentId,
      provider: aggregate.payment.provider,
      providerPaymentReference: aggregate.attempt.providerPaymentReference,
      localStatus: aggregate.payment.status,
      observedProviderStatus: snapshot.status,
      localAmount: clone(aggregate.payment.amount),
      observedAmount: { amountMinor: snapshot.amountMinor, currency: snapshot.currency },
      classification: match ? 'MATCH' : 'MISMATCH',
      disposition: 'OPEN',
      observedAt: snapshot.observedAt,
      createdAt: at,
      updatedAt: at
    };
    assertPaymentReconciliation(observation);
    return Object.freeze(clone(await this.repository.saveReconciliation(observation)));
  }

  private async findAggregateByPayment(
    workspaceId: string,
    paymentId: PaymentId
  ): Promise<PaymentLifecycleAggregate> {
    const aggregate = await this.repository.findByPaymentId(workspaceId, paymentId);
    if (aggregate) return aggregate;
    throw new PaymentLifecycleError('PAYMENT_NOT_FOUND', 'Payment was not found.');
  }

  private async applyPaymentEvent(
    event: VerifiedProviderPaymentEvent,
    baseReceipt: Omit<PaymentProviderEventReceipt, 'applied'>,
    nextStatus: Payment['status']
  ): Promise<Readonly<PaymentEventApplyResult>> {
    const aggregate = await this.repository.findByProviderPaymentReference(
      event.provider,
      event.providerPaymentReference
    );
    if (!aggregate) {
      const receipt: PaymentProviderEventReceipt = {
        ...baseReceipt,
        applied: false,
        ignoredReason: 'PROVIDER_PAYMENT_REFERENCE_NOT_FOUND'
      };
      return Object.freeze(
        clone(await this.repository.recordPaymentEventAtomically(receipt, null))
      );
    }
    const current = aggregate.payment;
    if (!validForwardPaymentTransition(current.status, nextStatus)) {
      const receipt: PaymentProviderEventReceipt = {
        ...baseReceipt,
        paymentId: current.paymentId,
        applied: false,
        ignoredReason: 'TERMINAL_OR_REGRESSIVE_PAYMENT_EVENT'
      };
      return Object.freeze(
        clone(await this.repository.recordPaymentEventAtomically(receipt, current.version))
      );
    }
    if (event.canonicalType === 'PAYMENT_SUCCEEDED' && !sameMoney(event.amount, current.amount)) {
      const receipt: PaymentProviderEventReceipt = {
        ...baseReceipt,
        paymentId: current.paymentId,
        applied: false,
        ignoredReason: 'PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH'
      };
      return Object.freeze(
        clone(await this.repository.recordPaymentEventAtomically(receipt, current.version))
      );
    }
    const next: Payment = {
      ...clone(current),
      status: nextStatus,
      version: current.version + 1,
      updatedAt: baseReceipt.receivedAt,
      ...(nextStatus === 'SUCCEEDED' ? { succeededAt: baseReceipt.receivedAt } : {}),
      ...(nextStatus === 'FAILED' ? { failedAt: baseReceipt.receivedAt } : {}),
      ...(nextStatus === 'CANCELLED' ? { cancelledAt: baseReceipt.receivedAt } : {})
    };
    assertPayment(next);
    const receipt: PaymentProviderEventReceipt = {
      ...baseReceipt,
      paymentId: current.paymentId,
      applied: true
    };
    return Object.freeze(
      clone(await this.repository.recordPaymentEventAtomically(receipt, current.version, next))
    );
  }

  private async applyRefundEvent(
    event: VerifiedProviderPaymentEvent,
    baseReceipt: Omit<PaymentProviderEventReceipt, 'applied'>,
    nextStatus: PaymentRefund['status']
  ): Promise<Readonly<PaymentEventApplyResult>> {
    if (!event.providerRefundReference) {
      const receipt: PaymentProviderEventReceipt = {
        ...baseReceipt,
        applied: false,
        ignoredReason: 'PROVIDER_REFUND_REFERENCE_REQUIRED'
      };
      return Object.freeze(clone(await this.repository.recordRefundEventAtomically(receipt, null)));
    }
    const refund = await this.repository.findRefundByProviderReference(
      event.providerRefundReference
    );
    if (!refund) {
      const receipt: PaymentProviderEventReceipt = {
        ...baseReceipt,
        applied: false,
        ignoredReason: 'PROVIDER_REFUND_REFERENCE_NOT_FOUND'
      };
      return Object.freeze(clone(await this.repository.recordRefundEventAtomically(receipt, null)));
    }
    if (!sameMoney(event.amount, refund.amount)) {
      const receipt: PaymentProviderEventReceipt = {
        ...baseReceipt,
        paymentId: refund.paymentId,
        refundId: refund.refundId,
        applied: false,
        ignoredReason: 'REFUND_AMOUNT_OR_CURRENCY_MISMATCH'
      };
      return Object.freeze(
        clone(await this.repository.recordRefundEventAtomically(receipt, refund.version))
      );
    }
    if (refund.status !== 'PENDING' || nextStatus === 'PENDING') {
      const receipt: PaymentProviderEventReceipt = {
        ...baseReceipt,
        paymentId: refund.paymentId,
        refundId: refund.refundId,
        applied: false,
        ignoredReason: 'TERMINAL_OR_DUPLICATE_REFUND_EVENT'
      };
      return Object.freeze(
        clone(await this.repository.recordRefundEventAtomically(receipt, refund.version))
      );
    }
    const aggregate = await this.findAggregateByPayment(refund.workspaceId, refund.paymentId);
    const nextRefund: PaymentRefund = {
      ...clone(refund),
      status: nextStatus,
      version: refund.version + 1,
      updatedAt: baseReceipt.receivedAt,
      ...(nextStatus === 'SUCCEEDED' ? { succeededAt: baseReceipt.receivedAt } : {}),
      ...(nextStatus === 'FAILED' ? { failedAt: baseReceipt.receivedAt } : {})
    };
    let nextPayment: Payment | undefined;
    if (nextStatus === 'SUCCEEDED') {
      nextPayment = {
        ...clone(aggregate.payment),
        refundedMinor: aggregate.payment.refundedMinor + refund.amount.amountMinor,
        version: aggregate.payment.version + 1,
        updatedAt: baseReceipt.receivedAt
      };
      assertPayment(nextPayment);
    }
    const receipt: PaymentProviderEventReceipt = {
      ...baseReceipt,
      paymentId: refund.paymentId,
      refundId: refund.refundId,
      applied: true
    };
    return Object.freeze(
      clone(
        await this.repository.recordRefundEventAtomically(
          receipt,
          refund.version,
          nextRefund,
          nextPayment ? aggregate.payment.version : null,
          nextPayment
        )
      )
    );
  }
}
