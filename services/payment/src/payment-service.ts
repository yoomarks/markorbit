import { createHash, randomUUID } from 'node:crypto';
import type { Permission, WorkspacePrincipal } from '@markorbit/contracts';
import type { CheckoutSession, CheckoutSessionId } from '@markorbit/contracts/commercial';
import type {
  InitiatePaymentCommand,
  InitiatePaymentResult,
  Payment,
  PaymentAttempt,
  PaymentAttemptId,
  PaymentId,
  PaymentProviderAction,
  PaymentProviderCode
} from '@markorbit/contracts/payment';
import { assertPayment, assertPaymentProviderCode } from '@markorbit/contracts/payment';

export type PaymentServiceErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'WORKSPACE_MISMATCH'
  | 'PERMISSION_DENIED'
  | 'CHECKOUT_NOT_FOUND'
  | 'CHECKOUT_SOURCE_UNAVAILABLE'
  | 'CHECKOUT_NOT_PAYABLE'
  | 'CHECKOUT_EXPIRED'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_ALREADY_EXISTS'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_CONTRACT_INVALID'
  | 'PERSISTENCE_UNAVAILABLE';

export class PaymentServiceError extends Error {
  constructor(
    readonly code: PaymentServiceErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PaymentServiceError';
  }
}

export interface PaymentCheckoutSource {
  findCheckout(
    principal: WorkspacePrincipal,
    workspaceId: string,
    checkoutSessionId: CheckoutSessionId
  ): Promise<CheckoutSession | null>;
}

export interface PaymentProviderCreateCommand {
  paymentId: PaymentId;
  checkoutSessionId: CheckoutSessionId;
  orderId: string;
  amountMinor: number;
  currency: string;
  providerIdempotencyKey: string;
  metadata: Readonly<Record<string, string>>;
}

export interface PaymentProviderCreateResult {
  providerPaymentReference: string;
  status: 'PENDING' | 'REQUIRES_ACTION' | 'PROCESSING';
  action: PaymentProviderAction;
}

export interface PaymentProviderAdapter {
  readonly code: PaymentProviderCode;
  createPayment(
    command: Readonly<PaymentProviderCreateCommand>
  ): Promise<PaymentProviderCreateResult>;
  resumePayment(providerPaymentReference: string): Promise<PaymentProviderAction>;
}

export interface PaymentInitiationReplay {
  fingerprint: string;
  payment: Payment;
  attempt: PaymentAttempt;
}

export interface PaymentRepository {
  findInitiationReplay(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<PaymentInitiationReplay | null>;
  findByCheckout(
    workspaceId: string,
    checkoutSessionId: CheckoutSessionId
  ): Promise<Payment | null>;
  findById(workspaceId: string, paymentId: PaymentId): Promise<Payment | null>;
  findAttempt(paymentId: PaymentId): Promise<PaymentAttempt | null>;
  createInitiationAtomically(
    payment: Payment,
    attempt: PaymentAttempt,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<PaymentInitiationReplay>;
}

const clone = <T>(value: T): T => structuredClone(value);

function authorize(
  principal: WorkspacePrincipal,
  workspaceId: string,
  permission: Permission
): void {
  if (principal.kind !== 'WORKSPACE')
    throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'A Workspace Principal is required.');
  if (principal.workspaceId !== workspaceId)
    throw new PaymentServiceError('WORKSPACE_MISMATCH', 'Workspace context does not match.');
  if (!principal.permissions.includes(permission))
    throw new PaymentServiceError('PERMISSION_DENIED', `${permission} permission is required.`);
}

function commandFingerprint(command: InitiatePaymentCommand): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        workspaceId: command.workspaceId,
        checkoutSessionId: command.checkoutSessionId
      })
    )
    .digest('hex');
}

function paymentIdFor(workspaceId: string, checkoutSessionId: CheckoutSessionId): PaymentId {
  const digest = createHash('sha256')
    .update(`${workspaceId}:${checkoutSessionId}`)
    .digest('hex')
    .slice(0, 32);
  return `payment_${digest}`;
}

function validateProviderResult(result: Readonly<PaymentProviderCreateResult>): void {
  if (result.providerPaymentReference.trim().length === 0)
    throw new PaymentServiceError(
      'PROVIDER_CONTRACT_INVALID',
      'Payment provider returned an empty payment reference.'
    );
  if (!['PENDING', 'REQUIRES_ACTION', 'PROCESSING'].includes(result.status))
    throw new PaymentServiceError(
      'PROVIDER_CONTRACT_INVALID',
      'Provider creation cannot author terminal Payment truth.'
    );
}

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly payments = new Map<string, Payment>();
  private readonly attempts = new Map<string, PaymentAttempt>();
  private readonly commands = new Map<string, PaymentInitiationReplay>();
  private chain: Promise<void> = Promise.resolve();

  findInitiationReplay(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<PaymentInitiationReplay | null> {
    const value = this.commands.get(`${workspaceId}:${idempotencyKey}`);
    return Promise.resolve(value ? clone(value) : null);
  }

  findByCheckout(
    workspaceId: string,
    checkoutSessionId: CheckoutSessionId
  ): Promise<Payment | null> {
    const value = [...this.payments.values()].find(
      (payment) =>
        payment.workspaceId === workspaceId && payment.checkoutSessionId === checkoutSessionId
    );
    return Promise.resolve(value ? clone(value) : null);
  }

  findById(workspaceId: string, paymentId: PaymentId): Promise<Payment | null> {
    const value = this.payments.get(paymentId);
    return Promise.resolve(value?.workspaceId === workspaceId ? clone(value) : null);
  }

  findAttempt(paymentId: PaymentId): Promise<PaymentAttempt | null> {
    const value = [...this.attempts.values()].find((attempt) => attempt.paymentId === paymentId);
    return Promise.resolve(value ? clone(value) : null);
  }

  async createInitiationAtomically(
    payment: Payment,
    attempt: PaymentAttempt,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<PaymentInitiationReplay> {
    let result!: PaymentInitiationReplay;
    const work = this.chain.then(() => {
      const commandKey = `${payment.workspaceId}:${idempotencyKey}`;
      const replay = this.commands.get(commandKey);
      if (replay) {
        if (replay.fingerprint !== fingerprint)
          throw new PaymentServiceError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key has conflicting input.'
          );
        result = clone(replay);
        return;
      }
      const existing = [...this.payments.values()].find(
        (value) =>
          value.workspaceId === payment.workspaceId &&
          value.checkoutSessionId === payment.checkoutSessionId
      );
      if (existing)
        throw new PaymentServiceError('PAYMENT_ALREADY_EXISTS', 'Checkout already has a Payment.');
      this.payments.set(payment.paymentId, clone(payment));
      this.attempts.set(attempt.paymentAttemptId, clone(attempt));
      const replayValue = { fingerprint, payment: clone(payment), attempt: clone(attempt) };
      this.commands.set(commandKey, replayValue);
      result = clone(replayValue);
    });
    this.chain = work.then(
      () => undefined,
      () => undefined
    );
    await work;
    return result;
  }
}

export class PaymentService {
  constructor(
    private readonly repository: PaymentRepository,
    private readonly checkouts: PaymentCheckoutSource,
    private readonly provider: PaymentProviderAdapter,
    private readonly now = () => new Date().toISOString(),
    private readonly attemptId = () => `payment_attempt_${randomUUID()}` as PaymentAttemptId
  ) {
    assertPaymentProviderCode(provider.code);
  }

  async initiatePayment(
    principal: WorkspacePrincipal,
    command: InitiatePaymentCommand
  ): Promise<Readonly<InitiatePaymentResult>> {
    authorize(principal, command.workspaceId, 'order:update');
    const fingerprint = commandFingerprint(command);
    const replay = await this.repository.findInitiationReplay(
      command.workspaceId,
      command.idempotencyKey
    );
    if (replay) {
      if (replay.fingerprint !== fingerprint)
        throw new PaymentServiceError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has conflicting input.'
        );
      return Object.freeze({
        payment: Object.freeze(clone(replay.payment)),
        attempt: Object.freeze(clone(replay.attempt)),
        providerAction: Object.freeze(
          clone(await this.provider.resumePayment(replay.attempt.providerPaymentReference))
        )
      });
    }

    const checkout = await this.checkouts.findCheckout(
      principal,
      command.workspaceId,
      command.checkoutSessionId
    );
    if (!checkout)
      throw new PaymentServiceError('CHECKOUT_NOT_FOUND', 'Checkout session was not found.');
    if (checkout.workspaceId !== command.workspaceId)
      throw new PaymentServiceError('WORKSPACE_MISMATCH', 'Checkout belongs to another Workspace.');
    if (checkout.status !== 'INITIATED')
      throw new PaymentServiceError(
        'CHECKOUT_NOT_PAYABLE',
        'Only an initiated Checkout can create Payment.'
      );
    const at = this.now();
    if (Date.parse(checkout.expiresAt) <= Date.parse(at))
      throw new PaymentServiceError('CHECKOUT_EXPIRED', 'Checkout session has expired.');

    const existing = await this.repository.findByCheckout(
      command.workspaceId,
      command.checkoutSessionId
    );
    if (existing)
      throw new PaymentServiceError('PAYMENT_ALREADY_EXISTS', 'Checkout already has a Payment.');

    const paymentId = paymentIdFor(command.workspaceId, command.checkoutSessionId);
    let providerResult: PaymentProviderCreateResult;
    try {
      providerResult = await this.provider.createPayment({
        paymentId,
        checkoutSessionId: checkout.checkoutSessionId,
        orderId: checkout.orderId,
        amountMinor: checkout.amount.amountMinor,
        currency: checkout.amount.currency,
        providerIdempotencyKey: paymentId,
        metadata: Object.freeze({
          markorbitPaymentId: paymentId,
          markorbitCheckoutSessionId: checkout.checkoutSessionId,
          markorbitOrderId: checkout.orderId,
          markorbitWorkspaceId: checkout.workspaceId
        })
      });
    } catch (cause) {
      if (cause instanceof PaymentServiceError) throw cause;
      throw new PaymentServiceError('PROVIDER_UNAVAILABLE', 'Payment provider is unavailable.', {
        cause: cause instanceof Error ? cause : undefined
      });
    }
    validateProviderResult(providerResult);

    const payment: Payment = {
      schemaVersion: 1,
      paymentId,
      workspaceId: checkout.workspaceId,
      checkoutSessionId: checkout.checkoutSessionId,
      orderId: checkout.orderId,
      initiatedByUserId: principal.userId as Payment['initiatedByUserId'],
      productId: checkout.productId,
      productVersion: checkout.productVersion,
      priceId: checkout.priceId,
      priceVersion: checkout.priceVersion,
      amount: clone(checkout.amount),
      provider: this.provider.code,
      status: providerResult.status,
      version: 1,
      refundedMinor: 0,
      createdAt: at,
      updatedAt: at
    };
    assertPayment(payment);
    const attempt: PaymentAttempt = {
      schemaVersion: 1,
      paymentAttemptId: this.attemptId(),
      paymentId,
      provider: this.provider.code,
      providerPaymentReference: providerResult.providerPaymentReference,
      attemptNumber: 1,
      createdAt: at,
      updatedAt: at
    };

    const stored = await this.repository.createInitiationAtomically(
      payment,
      attempt,
      command.idempotencyKey,
      fingerprint
    );
    return Object.freeze({
      payment: Object.freeze(clone(stored.payment)),
      attempt: Object.freeze(clone(stored.attempt)),
      providerAction: Object.freeze(clone(providerResult.action))
    });
  }

  async getPayment(
    principal: WorkspacePrincipal,
    workspaceId: string,
    paymentId: PaymentId
  ): Promise<Readonly<Payment>> {
    authorize(principal, workspaceId, 'order:read');
    const payment = await this.repository.findById(workspaceId, paymentId);
    if (!payment) throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Payment was not found.');
    assertPayment(payment);
    return Object.freeze(clone(payment));
  }
}
