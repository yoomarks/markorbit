import type { QueryClient } from '@markorbit/persistence';
import {
  assertPayment,
  assertPaymentReconciliation,
  assertPaymentRefund,
  type Payment,
  type PaymentAttempt,
  type PaymentAttemptId,
  type PaymentId,
  type PaymentProviderCode,
  type PaymentProviderEventReceipt,
  type PaymentProviderEventReceiptId,
  type PaymentReconciliationObservation,
  type PaymentRefund,
  type PaymentRefundId
} from '@markorbit/contracts/payment';
import {
  PaymentLifecycleError,
  type PaymentEventApplyResult,
  type PaymentLifecycleAggregate,
  type PaymentLifecycleRepository,
  type PaymentRefundReplay
} from './payment-lifecycle.js';
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

function lifecycleUnavailable(cause: unknown): PaymentLifecycleError {
  return new PaymentLifecycleError(
    'PERSISTENCE_UNAVAILABLE',
    'Payment lifecycle persistence is unavailable.',
    { cause: cause instanceof Error ? cause : undefined }
  );
}

function postgresCode(cause: unknown): string | undefined {
  if (!cause || typeof cause !== 'object') return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function iso(value: unknown): string {
  return new Date(value as string).toISOString();
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
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    ...(row.succeeded_at ? { succeededAt: iso(row.succeeded_at) } : {}),
    ...(row.failed_at ? { failedAt: iso(row.failed_at) } : {}),
    ...(row.cancelled_at ? { cancelledAt: iso(row.cancelled_at) } : {})
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
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function mapJoinedAttempt(row: Row): PaymentAttempt {
  return {
    schemaVersion: 1,
    paymentAttemptId: String(row.payment_attempt_id) as PaymentAttemptId,
    paymentId: String(row.payment_id) as PaymentId,
    provider: String(row.attempt_provider),
    providerPaymentReference: String(row.provider_payment_reference),
    attemptNumber: Number(row.attempt_number),
    createdAt: iso(row.attempt_created_at),
    updatedAt: iso(row.attempt_updated_at)
  };
}

function mapReceipt(row: Row): PaymentProviderEventReceipt {
  return {
    schemaVersion: 1,
    receiptId: String(row.receipt_id) as PaymentProviderEventReceiptId,
    provider: String(row.provider),
    providerEventId: String(row.provider_event_id),
    providerPaymentReference: String(row.provider_payment_reference),
    rawSha256: String(row.raw_sha256),
    canonicalType: String(row.canonical_type) as PaymentProviderEventReceipt['canonicalType'],
    ...(typeof row.payment_id === 'string' ? { paymentId: row.payment_id as PaymentId } : {}),
    ...(typeof row.refund_id === 'string' ? { refundId: row.refund_id as PaymentRefundId } : {}),
    occurredAt: iso(row.occurred_at),
    receivedAt: iso(row.received_at),
    verifiedAt: iso(row.verified_at),
    applied: Boolean(row.applied),
    ...(typeof row.ignored_reason === 'string' ? { ignoredReason: row.ignored_reason } : {})
  };
}

function mapRefund(row: Row): PaymentRefund {
  const value: PaymentRefund = {
    schemaVersion: 1,
    refundId: String(row.refund_id) as PaymentRefundId,
    paymentId: String(row.payment_id) as PaymentId,
    workspaceId: String(row.workspace_id),
    requestedByUserId: String(row.requested_by_user_id) as PaymentRefund['requestedByUserId'],
    amount: {
      amountMinor: Number(row.amount_minor),
      currency: String(row.currency)
    },
    status: String(row.status) as PaymentRefund['status'],
    version: Number(row.version),
    ...(typeof row.provider_refund_reference === 'string'
      ? { providerRefundReference: row.provider_refund_reference }
      : {}),
    reason: String(row.reason),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    ...(row.succeeded_at ? { succeededAt: iso(row.succeeded_at) } : {}),
    ...(row.failed_at ? { failedAt: iso(row.failed_at) } : {})
  };
  assertPaymentRefund(value);
  return value;
}

function mapReconciliation(row: Row): PaymentReconciliationObservation {
  const value: PaymentReconciliationObservation = {
    schemaVersion: 1,
    reconciliationId: String(
      row.reconciliation_id
    ) as PaymentReconciliationObservation['reconciliationId'],
    workspaceId: String(row.workspace_id),
    paymentId: String(row.payment_id) as PaymentId,
    provider: String(row.provider),
    providerPaymentReference: String(row.provider_payment_reference),
    localStatus: String(row.local_status) as PaymentReconciliationObservation['localStatus'],
    observedProviderStatus: String(row.observed_provider_status),
    localAmount: {
      amountMinor: Number(row.local_amount_minor),
      currency: String(row.currency)
    },
    observedAmount: {
      amountMinor: Number(row.observed_amount_minor),
      currency: String(row.observed_currency)
    },
    classification: String(
      row.classification
    ) as PaymentReconciliationObservation['classification'],
    disposition: String(row.disposition) as PaymentReconciliationObservation['disposition'],
    ...(typeof row.operator_note === 'string' ? { operatorNote: row.operator_note } : {}),
    observedAt: iso(row.observed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
  assertPaymentReconciliation(value);
  return value;
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

function refundReplayFromRow(row: Row): PaymentRefundReplay {
  return {
    fingerprint: String(row.request_fingerprint),
    refund: mapRefund(row)
  };
}

export class PostgresPaymentRepository implements PaymentRepository, PaymentLifecycleRepository {
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

  async findByPaymentId(
    workspaceId: string,
    paymentId: PaymentId
  ): Promise<PaymentLifecycleAggregate | null> {
    try {
      const result = await this.query.query(
        `SELECT p.*,
          a.payment_attempt_id,
          a.provider AS attempt_provider,
          a.provider_payment_reference,
          a.attempt_number,
          a.created_at AS attempt_created_at,
          a.updated_at AS attempt_updated_at
        FROM payment_payments p
        JOIN payment_attempts a ON a.payment_id=p.payment_id
        WHERE p.workspace_id=$1 AND p.payment_id=$2
        ORDER BY a.attempt_number DESC
        LIMIT 1`,
        [workspaceId, paymentId]
      );
      if (!result.rowCount) return null;
      const row = result.rows[0] as Row;
      return { payment: mapPayment(row), attempt: mapJoinedAttempt(row) };
    } catch (cause) {
      if (cause instanceof PaymentLifecycleError) throw cause;
      throw lifecycleUnavailable(cause);
    }
  }

  async listAttempts(paymentId: PaymentId): Promise<readonly PaymentAttempt[]> {
    try {
      const result = await this.query.query(
        'SELECT * FROM payment_attempts WHERE payment_id=$1 ORDER BY attempt_number ASC',
        [paymentId]
      );
      return result.rows.map((row) => mapAttempt(row as Row));
    } catch (cause) {
      throw lifecycleUnavailable(cause);
    }
  }

  async listProviderEvents(paymentId: PaymentId): Promise<readonly PaymentProviderEventReceipt[]> {
    try {
      const result = await this.query.query(
        `SELECT * FROM payment_provider_event_receipts
         WHERE payment_id=$1
            OR refund_id IN (SELECT refund_id FROM payment_refunds WHERE payment_id=$1)
         ORDER BY occurred_at ASC, receipt_id ASC`,
        [paymentId]
      );
      return result.rows.map((row) => mapReceipt(row as Row));
    } catch (cause) {
      throw lifecycleUnavailable(cause);
    }
  }

  async listRefunds(workspaceId: string, paymentId: PaymentId): Promise<readonly PaymentRefund[]> {
    try {
      const result = await this.query.query(
        `SELECT * FROM payment_refunds
         WHERE workspace_id=$1 AND payment_id=$2
         ORDER BY created_at ASC, refund_id ASC`,
        [workspaceId, paymentId]
      );
      return result.rows.map((row) => mapRefund(row as Row));
    } catch (cause) {
      throw lifecycleUnavailable(cause);
    }
  }

  async listReconciliations(
    workspaceId: string,
    paymentId: PaymentId
  ): Promise<readonly PaymentReconciliationObservation[]> {
    try {
      const result = await this.query.query(
        `SELECT * FROM payment_reconciliations
         WHERE workspace_id=$1 AND payment_id=$2
         ORDER BY observed_at DESC, reconciliation_id DESC`,
        [workspaceId, paymentId]
      );
      return result.rows.map((row) => mapReconciliation(row as Row));
    } catch (cause) {
      throw lifecycleUnavailable(cause);
    }
  }

  async findByProviderPaymentReference(
    provider: PaymentProviderCode,
    providerPaymentReference: string
  ): Promise<PaymentLifecycleAggregate | null> {
    try {
      const result = await this.query.query(
        `SELECT p.*,
          a.payment_attempt_id,
          a.provider AS attempt_provider,
          a.provider_payment_reference,
          a.attempt_number,
          a.created_at AS attempt_created_at,
          a.updated_at AS attempt_updated_at
        FROM payment_attempts a
        JOIN payment_payments p ON p.payment_id=a.payment_id
        WHERE a.provider=$1 AND a.provider_payment_reference=$2
        LIMIT 1`,
        [provider, providerPaymentReference]
      );
      if (!result.rowCount) return null;
      const row = result.rows[0] as Row;
      return { payment: mapPayment(row), attempt: mapJoinedAttempt(row) };
    } catch (cause) {
      if (cause instanceof PaymentLifecycleError) throw cause;
      throw lifecycleUnavailable(cause);
    }
  }

  async findEventReceipt(
    provider: PaymentProviderCode,
    providerEventId: string
  ): Promise<PaymentProviderEventReceipt | null> {
    try {
      const result = await this.query.query(
        'SELECT * FROM payment_provider_event_receipts WHERE provider=$1 AND provider_event_id=$2',
        [provider, providerEventId]
      );
      return result.rowCount ? mapReceipt(result.rows[0] as Row) : null;
    } catch (cause) {
      throw lifecycleUnavailable(cause);
    }
  }

  async recordPaymentEventAtomically(
    receipt: PaymentProviderEventReceipt,
    expectedPaymentVersion: number | null,
    nextPayment?: Payment
  ): Promise<PaymentEventApplyResult> {
    try {
      return await this.database.transact(
        async (client) => {
          const duplicate = await client.query(
            'SELECT * FROM payment_provider_event_receipts WHERE provider=$1 AND provider_event_id=$2 FOR UPDATE',
            [receipt.provider, receipt.providerEventId]
          );
          if (duplicate.rowCount) return { receipt: mapReceipt(duplicate.rows[0] as Row) };
          if (nextPayment)
            await this.updatePayment(
              client,
              nextPayment,
              expectedPaymentVersion,
              'Payment version changed.'
            );
          await this.insertReceipt(client, receipt);
          return {
            receipt: clone(receipt),
            ...(nextPayment ? { payment: clone(nextPayment) } : {})
          };
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof PaymentLifecycleError) throw cause;
      if (postgresCode(cause) === '23505') {
        const duplicate = await this.findEventReceipt(receipt.provider, receipt.providerEventId);
        if (duplicate) return { receipt: duplicate };
      }
      throw lifecycleUnavailable(cause);
    }
  }

  async findRefundByProviderReference(
    providerRefundReference: string
  ): Promise<PaymentRefund | null> {
    try {
      const result = await this.query.query(
        'SELECT * FROM payment_refunds WHERE provider_refund_reference=$1 LIMIT 1',
        [providerRefundReference]
      );
      return result.rowCount ? mapRefund(result.rows[0] as Row) : null;
    } catch (cause) {
      throw lifecycleUnavailable(cause);
    }
  }

  async recordRefundEventAtomically(
    receipt: PaymentProviderEventReceipt,
    expectedRefundVersion: number | null,
    nextRefund?: PaymentRefund,
    expectedPaymentVersion: number | null = null,
    nextPayment?: Payment
  ): Promise<PaymentEventApplyResult> {
    try {
      return await this.database.transact(
        async (client) => {
          const duplicate = await client.query(
            'SELECT * FROM payment_provider_event_receipts WHERE provider=$1 AND provider_event_id=$2 FOR UPDATE',
            [receipt.provider, receipt.providerEventId]
          );
          if (duplicate.rowCount) return { receipt: mapReceipt(duplicate.rows[0] as Row) };
          if (nextRefund)
            await this.updateRefund(
              client,
              nextRefund,
              expectedRefundVersion,
              'Refund version changed.'
            );
          if (nextPayment)
            await this.updatePayment(
              client,
              nextPayment,
              expectedPaymentVersion,
              'Payment version changed.'
            );
          await this.insertReceipt(client, receipt);
          return {
            receipt: clone(receipt),
            ...(nextRefund ? { refund: clone(nextRefund) } : {}),
            ...(nextPayment ? { payment: clone(nextPayment) } : {})
          };
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof PaymentLifecycleError) throw cause;
      if (postgresCode(cause) === '23505') {
        const duplicate = await this.findEventReceipt(receipt.provider, receipt.providerEventId);
        if (duplicate) return { receipt: duplicate };
      }
      throw lifecycleUnavailable(cause);
    }
  }

  async findRefundReplay(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<PaymentRefundReplay | null> {
    try {
      const result = await this.query.query(
        `SELECT c.request_fingerprint,r.*
        FROM payment_refund_commands c
        JOIN payment_refunds r ON r.refund_id=c.refund_id
        WHERE c.workspace_id=$1 AND c.idempotency_key=$2`,
        [workspaceId, idempotencyKey]
      );
      return result.rowCount ? refundReplayFromRow(result.rows[0] as Row) : null;
    } catch (cause) {
      throw lifecycleUnavailable(cause);
    }
  }

  async sumReservedRefundMinor(paymentId: PaymentId): Promise<number> {
    try {
      const result = await this.query.query(
        `SELECT COALESCE(SUM(amount_minor),0) AS reserved_minor
        FROM payment_refunds
        WHERE payment_id=$1 AND status IN ('PENDING','SUCCEEDED')`,
        [paymentId]
      );
      return Number((result.rows[0] as Row | undefined)?.reserved_minor ?? 0);
    } catch (cause) {
      throw lifecycleUnavailable(cause);
    }
  }

  async createRefundAtomically(
    refund: PaymentRefund,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<PaymentRefundReplay> {
    try {
      return await this.database.transact(
        async (client) => {
          const replay = await client.query(
            `SELECT c.request_fingerprint,r.*
            FROM payment_refund_commands c
            JOIN payment_refunds r ON r.refund_id=c.refund_id
            WHERE c.workspace_id=$1 AND c.idempotency_key=$2
            FOR UPDATE`,
            [refund.workspaceId, idempotencyKey]
          );
          if (replay.rowCount)
            return this.resolveRefundReplay(
              refundReplayFromRow(replay.rows[0] as Row),
              fingerprint
            );

          const paymentResult = await client.query(
            'SELECT * FROM payment_payments WHERE workspace_id=$1 AND payment_id=$2 FOR UPDATE',
            [refund.workspaceId, refund.paymentId]
          );
          if (!paymentResult.rowCount)
            throw new PaymentLifecycleError('PAYMENT_NOT_FOUND', 'Payment was not found.');
          const payment = mapPayment(paymentResult.rows[0] as Row);
          if (payment.status !== 'SUCCEEDED')
            throw new PaymentLifecycleError(
              'REFUND_NOT_ALLOWED',
              'Only a successful Payment can be refunded.'
            );

          const reservedRows = await client.query<Row>(
            `SELECT amount_minor
            FROM payment_refunds
            WHERE payment_id=$1 AND status IN ('PENDING','SUCCEEDED')
            FOR UPDATE`,
            [refund.paymentId]
          );
          const reserved = reservedRows.rows.reduce(
            (sum, row) => sum + Number(row.amount_minor),
            0
          );
          if (reserved + refund.amount.amountMinor > payment.amount.amountMinor)
            throw new PaymentLifecycleError(
              'REFUND_AMOUNT_EXCEEDED',
              'Cumulative pending and successful refunds exceed the Payment amount.'
            );

          await client.query(
            `INSERT INTO payment_refunds(
              refund_id,payment_id,workspace_id,requested_by_user_id,amount_minor,currency,status,
              version,provider_refund_reference,reason,created_at,updated_at,succeeded_at,failed_at
            ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
              refund.refundId,
              refund.paymentId,
              refund.workspaceId,
              refund.requestedByUserId,
              refund.amount.amountMinor,
              refund.amount.currency,
              refund.status,
              refund.version,
              refund.providerRefundReference ?? null,
              refund.reason,
              refund.createdAt,
              refund.updatedAt,
              refund.succeededAt ?? null,
              refund.failedAt ?? null
            ]
          );
          await client.query(
            `INSERT INTO payment_refund_commands(
              workspace_id,idempotency_key,request_fingerprint,refund_id,created_at
            ) VALUES($1,$2,$3,$4,$5)`,
            [refund.workspaceId, idempotencyKey, fingerprint, refund.refundId, refund.createdAt]
          );
          return { fingerprint, refund: clone(refund) };
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof PaymentLifecycleError) throw cause;
      if (postgresCode(cause) === '23505') {
        const replay = await this.findRefundReplay(refund.workspaceId, idempotencyKey);
        if (replay) return this.resolveRefundReplay(replay, fingerprint);
      }
      throw lifecycleUnavailable(cause);
    }
  }

  async saveReconciliation(
    observation: PaymentReconciliationObservation
  ): Promise<PaymentReconciliationObservation> {
    assertPaymentReconciliation(observation);
    try {
      await this.query.query(
        `INSERT INTO payment_reconciliations(
          reconciliation_id,workspace_id,payment_id,provider,provider_payment_reference,local_status,
          observed_provider_status,local_amount_minor,observed_amount_minor,currency,observed_currency,
          classification,disposition,operator_note,observed_at,created_at,updated_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          observation.reconciliationId,
          observation.workspaceId,
          observation.paymentId,
          observation.provider,
          observation.providerPaymentReference,
          observation.localStatus,
          observation.observedProviderStatus,
          observation.localAmount.amountMinor,
          observation.observedAmount.amountMinor,
          observation.localAmount.currency,
          observation.observedAmount.currency,
          observation.classification,
          observation.disposition,
          observation.operatorNote ?? null,
          observation.observedAt,
          observation.createdAt,
          observation.updatedAt
        ]
      );
      return clone(observation);
    } catch (cause) {
      throw lifecycleUnavailable(cause);
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

  private async updatePayment(
    client: QueryClient,
    payment: Payment,
    expectedVersion: number | null,
    message: string
  ): Promise<void> {
    if (expectedVersion === null)
      throw new PaymentLifecycleError('PERSISTENCE_UNAVAILABLE', message);
    const result = await client.query(
      `UPDATE payment_payments SET
        status=$2,version=$3,refunded_minor=$4,updated_at=$5,succeeded_at=$6,failed_at=$7,cancelled_at=$8
      WHERE payment_id=$1 AND version=$9`,
      [
        payment.paymentId,
        payment.status,
        payment.version,
        payment.refundedMinor,
        payment.updatedAt,
        payment.succeededAt ?? null,
        payment.failedAt ?? null,
        payment.cancelledAt ?? null,
        expectedVersion
      ]
    );
    if (result.rowCount !== 1) throw new PaymentLifecycleError('PERSISTENCE_UNAVAILABLE', message);
  }

  private async updateRefund(
    client: QueryClient,
    refund: PaymentRefund,
    expectedVersion: number | null,
    message: string
  ): Promise<void> {
    if (expectedVersion === null)
      throw new PaymentLifecycleError('PERSISTENCE_UNAVAILABLE', message);
    const result = await client.query(
      `UPDATE payment_refunds SET
        status=$2,version=$3,updated_at=$4,succeeded_at=$5,failed_at=$6,provider_refund_reference=$7
      WHERE refund_id=$1 AND version=$8`,
      [
        refund.refundId,
        refund.status,
        refund.version,
        refund.updatedAt,
        refund.succeededAt ?? null,
        refund.failedAt ?? null,
        refund.providerRefundReference ?? null,
        expectedVersion
      ]
    );
    if (result.rowCount !== 1) throw new PaymentLifecycleError('PERSISTENCE_UNAVAILABLE', message);
  }

  private async insertReceipt(
    client: QueryClient,
    receipt: PaymentProviderEventReceipt
  ): Promise<void> {
    await client.query(
      `INSERT INTO payment_provider_event_receipts(
        receipt_id,provider,provider_event_id,provider_payment_reference,raw_sha256,canonical_type,
        payment_id,refund_id,occurred_at,received_at,verified_at,applied,ignored_reason
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        receipt.receiptId,
        receipt.provider,
        receipt.providerEventId,
        receipt.providerPaymentReference,
        receipt.rawSha256,
        receipt.canonicalType,
        receipt.paymentId ?? null,
        receipt.refundId ?? null,
        receipt.occurredAt,
        receipt.receivedAt,
        receipt.verifiedAt,
        receipt.applied,
        receipt.ignoredReason ?? null
      ]
    );
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

  private resolveRefundReplay(
    replay: PaymentRefundReplay,
    fingerprint: string
  ): PaymentRefundReplay {
    if (replay.fingerprint !== fingerprint)
      throw new PaymentLifecycleError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has conflicting input.'
      );
    return clone(replay);
  }
}
