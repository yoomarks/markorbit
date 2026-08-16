import type { QueryClient } from '@markorbit/persistence';
import {
  assertPayment,
  type Payment,
  type PaymentAttempt,
  type PaymentAttemptId,
  type PaymentId
} from '@markorbit/contracts/payment';
import type { PaymentInitiationReplay, PaymentRepository } from './payment-service.js';
import { PaymentServiceError } from './payment-service.js';

export interface PaymentTransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}

type Row = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);

function unavailable(cause: unknown): PaymentServiceError {
  return new PaymentServiceError('PERSISTENCE_UNAVAILABLE', 'Payment persistence is unavailable.', {
    cause: cause instanceof Error ? cause : undefined
  });
}

function postgresCode(cause: unknown): string | undefined {
  if (!cause || typeof cause !== 'object') return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function mapPayment(row: Row): Payment {
  const value: Payment = {
    schemaVersion: 1,
    paymentId: String(row.payment_id) as PaymentId,
    workspaceId: String(row.workspace_id),
    checkoutSessionId: String(row.checkout_session_id) as Payment['checkoutSessionId'],
    orderId: String(row.order_id) as Payment['orderId'],
    initiatedByUserId: String(row.initiated_by_user_id) as Payment['initiatedByUserId'],
    productId: String(row.product_id) as Payment['productId'],
    productVersion: Number(row.product_version),
    priceId: String(row.price_id) as Payment['priceId'],
    priceVersion: Number(row.price_version),
    amount: {
      amountMinor: Number(row.amount_minor),
      currency: String(row.currency)
    },
    provider: String(row.provider),
    status: String(row.status) as Payment['status'],
    version: Number(row.version),
    refundedMinor: Number(row.refunded_minor),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    ...(row.succeeded_at
      ? { succeededAt: new Date(row.succeeded_at as string).toISOString() }
      : {}),
    ...(row.failed_at ? { failedAt: new Date(row.failed_at as string).toISOString() } : {}),
    ...(row.cancelled_at ? { cancelledAt: new Date(row.cancelled_at as string).toISOString() } : {})
  };
  assertPayment(value);
  return value;
}

function mapAttempt(row: Row): PaymentAttempt {
  return {
    schemaVersion: 1,
    paymentAttemptId: String(row.payment_attempt_id) as PaymentAttemptId,
    paymentId: String(row.payment_id) as PaymentId,
    provider: String(row.provider),
    providerPaymentReference: String(row.provider_payment_reference),
    attemptNumber: Number(row.attempt_number),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function replayFromRow(row: Row): PaymentInitiationReplay {
  const payment = clone(row.payment_snapshot as Payment);
  const attempt = clone(row.attempt_snapshot as PaymentAttempt);
  assertPayment(payment);
  return {
    fingerprint: String(row.request_fingerprint),
    payment,
    attempt
  };
}

export class PostgresPaymentRepository implements PaymentRepository {
  constructor(
    private readonly database: PaymentTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findInitiationReplay(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<PaymentInitiationReplay | null> {
    try {
      const result = await this.query.query(
        'SELECT request_fingerprint,payment_snapshot,attempt_snapshot FROM payment_commands WHERE workspace_id=$1 AND idempotency_key=$2',
        [workspaceId, idempotencyKey]
      );
      return result.rowCount ? replayFromRow(result.rows[0] as Row) : null;
    } catch (cause) {
      if (cause instanceof PaymentServiceError) throw cause;
      throw unavailable(cause);
    }
  }

  async findByCheckout(workspaceId: string, checkoutSessionId: string): Promise<Payment | null> {
    try {
      const result = await this.query.query(
        'SELECT * FROM payment_payments WHERE workspace_id=$1 AND checkout_session_id=$2',
        [workspaceId, checkoutSessionId]
      );
      return result.rowCount ? mapPayment(result.rows[0] as Row) : null;
    } catch (cause) {
      if (cause instanceof PaymentServiceError) throw cause;
      throw unavailable(cause);
    }
  }

  async findById(workspaceId: string, paymentId: PaymentId): Promise<Payment | null> {
    try {
      const result = await this.query.query(
        'SELECT * FROM payment_payments WHERE workspace_id=$1 AND payment_id=$2',
        [workspaceId, paymentId]
      );
      return result.rowCount ? mapPayment(result.rows[0] as Row) : null;
    } catch (cause) {
      if (cause instanceof PaymentServiceError) throw cause;
      throw unavailable(cause);
    }
  }

  async findAttempt(paymentId: PaymentId): Promise<PaymentAttempt | null> {
    try {
      const result = await this.query.query(
        'SELECT * FROM payment_attempts WHERE payment_id=$1 ORDER BY attempt_number DESC LIMIT 1',
        [paymentId]
      );
      return result.rowCount ? mapAttempt(result.rows[0] as Row) : null;
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  async createInitiationAtomically(
    payment: Payment,
    attempt: PaymentAttempt,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<PaymentInitiationReplay> {
    try {
      return await this.database.transact(
        async (client) => {
          const replay = await this.findReplay(client, payment.workspaceId, idempotencyKey, true);
          if (replay) return this.resolveReplay(replay, fingerprint);

          const existing = await client.query(
            'SELECT payment_id FROM payment_payments WHERE workspace_id=$1 AND checkout_session_id=$2 FOR UPDATE',
            [payment.workspaceId, payment.checkoutSessionId]
          );
          if (existing.rowCount)
            throw new PaymentServiceError(
              'PAYMENT_ALREADY_EXISTS',
              'Checkout already has a Payment.'
            );

          await client.query(
            `INSERT INTO payment_payments(
              payment_id,workspace_id,checkout_session_id,order_id,initiated_by_user_id,
              product_id,product_version,price_id,price_version,amount_minor,currency,provider,
              status,version,refunded_minor,created_at,updated_at,succeeded_at,failed_at,cancelled_at
            ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
            [
              payment.paymentId,
              payment.workspaceId,
              payment.checkoutSessionId,
              payment.orderId,
              payment.initiatedByUserId,
              payment.productId,
              payment.productVersion,
              payment.priceId,
              payment.priceVersion,
              payment.amount.amountMinor,
              payment.amount.currency,
              payment.provider,
              payment.status,
              payment.version,
              payment.refundedMinor,
              payment.createdAt,
              payment.updatedAt,
              payment.succeededAt ?? null,
              payment.failedAt ?? null,
              payment.cancelledAt ?? null
            ]
          );
          await client.query(
            `INSERT INTO payment_attempts(
              payment_attempt_id,payment_id,provider,provider_payment_reference,attempt_number,created_at,updated_at
            ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
            [
              attempt.paymentAttemptId,
              attempt.paymentId,
              attempt.provider,
              attempt.providerPaymentReference,
              attempt.attemptNumber,
              attempt.createdAt,
              attempt.updatedAt
            ]
          );
          await client.query(
            `INSERT INTO payment_commands(
              workspace_id,idempotency_key,request_fingerprint,payment_id,payment_attempt_id,
              payment_snapshot,attempt_snapshot,created_at
            ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)`,
            [
              payment.workspaceId,
              idempotencyKey,
              fingerprint,
              payment.paymentId,
              attempt.paymentAttemptId,
              JSON.stringify(payment),
              JSON.stringify(attempt),
              payment.createdAt
            ]
          );
          return { fingerprint, payment: clone(payment), attempt: clone(attempt) };
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof PaymentServiceError) throw cause;
      if (postgresCode(cause) === '23505') {
        const replay = await this.findInitiationReplay(payment.workspaceId, idempotencyKey);
        if (replay) return this.resolveReplay(replay, fingerprint);
        const existing = await this.findByCheckout(payment.workspaceId, payment.checkoutSessionId);
        if (existing)
          throw new PaymentServiceError(
            'PAYMENT_ALREADY_EXISTS',
            'Checkout already has a Payment.'
          );
      }
      throw unavailable(cause);
    }
  }

  private async findReplay(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    lock: boolean
  ): Promise<PaymentInitiationReplay | null> {
    const result = await client.query(
      `SELECT request_fingerprint,payment_snapshot,attempt_snapshot FROM payment_commands WHERE workspace_id=$1 AND idempotency_key=$2${lock ? ' FOR UPDATE' : ''}`,
      [workspaceId, idempotencyKey]
    );
    return result.rowCount ? replayFromRow(result.rows[0] as Row) : null;
  }

  private resolveReplay(
    replay: PaymentInitiationReplay,
    fingerprint: string
  ): PaymentInitiationReplay {
    if (replay.fingerprint !== fingerprint)
      throw new PaymentServiceError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has conflicting input.'
      );
    return clone(replay);
  }
}
