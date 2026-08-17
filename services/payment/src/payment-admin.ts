import type { InternalOperatorPrincipal } from '@markorbit/contracts';
import type {
  PaymentAdminInspection,
  PaymentAttempt,
  PaymentId,
  PaymentProviderEventReceipt,
  PaymentReconciliationObservation,
  PaymentRefund
} from '@markorbit/contracts/payment';
import type { PaymentLifecycleAggregate } from './payment-lifecycle.js';

export type PaymentAdminReadErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'PAYMENT_NOT_FOUND'
  | 'PERSISTENCE_UNAVAILABLE';

export class PaymentAdminReadError extends Error {
  constructor(
    readonly code: PaymentAdminReadErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PaymentAdminReadError';
  }
}

export interface PaymentAdminReadRepository {
  findByPaymentId(workspaceId: string, paymentId: PaymentId): Promise<PaymentLifecycleAggregate | null>;
  listAttempts(paymentId: PaymentId): Promise<readonly PaymentAttempt[]>;
  listProviderEvents(paymentId: PaymentId): Promise<readonly PaymentProviderEventReceipt[]>;
  listRefunds(workspaceId: string, paymentId: PaymentId): Promise<readonly PaymentRefund[]>;
  listReconciliations(
    workspaceId: string,
    paymentId: PaymentId
  ): Promise<readonly PaymentReconciliationObservation[]>;
}

function authorize(principal: InternalOperatorPrincipal): void {
  if (principal.kind !== 'INTERNAL_OPERATOR')
    throw new PaymentAdminReadError(
      'AUTHENTICATION_REQUIRED',
      'An INTERNAL_OPERATOR Principal is required.'
    );
  if (!principal.capabilities.includes('commercial-admin:read'))
    throw new PaymentAdminReadError(
      'PERMISSION_DENIED',
      'commercial-admin:read capability is required.'
    );
}

export class PaymentAdminReadService {
  constructor(private readonly repository: PaymentAdminReadRepository) {}

  async inspectPayment(
    principal: InternalOperatorPrincipal,
    workspaceId: string,
    paymentId: PaymentId
  ): Promise<Readonly<PaymentAdminInspection>> {
    authorize(principal);
    const aggregate = await this.repository.findByPaymentId(workspaceId, paymentId);
    if (!aggregate) throw new PaymentAdminReadError('PAYMENT_NOT_FOUND', 'Payment was not found.');

    const [attempts, providerEvents, refunds, reconciliations] = await Promise.all([
      this.repository.listAttempts(paymentId),
      this.repository.listProviderEvents(paymentId),
      this.repository.listRefunds(workspaceId, paymentId),
      this.repository.listReconciliations(workspaceId, paymentId)
    ]);

    return Object.freeze({
      schemaVersion: 1,
      source: Object.freeze({ domain: 'PAYMENT', authority: 'PAYMENT_LIFECYCLE' }),
      payment: Object.freeze(structuredClone(aggregate.payment)),
      attempts: Object.freeze(attempts.map((value) => Object.freeze(structuredClone(value)))),
      providerEvents: Object.freeze(
        providerEvents.map((value) => Object.freeze(structuredClone(value)))
      ),
      refunds: Object.freeze(refunds.map((value) => Object.freeze(structuredClone(value)))),
      reconciliations: Object.freeze(
        reconciliations.map((value) => Object.freeze(structuredClone(value)))
      )
    });
  }
}
