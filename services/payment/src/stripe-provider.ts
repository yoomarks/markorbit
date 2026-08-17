import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  PaymentProviderAction,
  VerifiedProviderPaymentEvent
} from '@markorbit/contracts/payment';
import type {
  PaymentLifecycleProviderAdapter,
  PaymentProviderRefundCommand,
  PaymentProviderRefundResult,
  PaymentProviderSnapshot,
  PaymentWebhookInput
} from './payment-lifecycle.js';
import { PaymentLifecycleError } from './payment-lifecycle.js';
import type {
  PaymentProviderAdapter,
  PaymentProviderCreateCommand,
  PaymentProviderCreateResult
} from './payment-service.js';
import { PaymentServiceError } from './payment-service.js';

export const STRIPE_PROVIDER_CODE = 'STRIPE' as const;
export const STRIPE_API_VERSION = '2026-02-25.clover' as const;

export interface StripePaymentProviderOptions {
  secretKey: string;
  webhookSecret: string;
  apiVersion?: string;
  apiBaseUrl?: string;
  webhookToleranceSeconds?: number;
  fetch?: typeof fetch;
  nowSeconds?: () => number;
}

interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  amount_received?: number;
  currency: string;
  status:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'requires_capture'
    | 'canceled'
    | 'succeeded';
  client_secret?: string | null;
  next_action?: {
    type?: string;
    redirect_to_url?: { url?: string | null } | null;
  } | null;
  created?: number;
}

interface StripeRefund {
  id: string;
  object: 'refund';
  amount: number;
  currency: string;
  payment_intent?: string | { id?: string } | null;
  status?: 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'canceled' | null;
  created?: number;
}

interface StripeEvent {
  id: string;
  object: 'event';
  type: string;
  created: number;
  data: { object: unknown };
}

class StripeProviderError extends Error {
  constructor(
    message: string,
    readonly requestId?: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'StripeProviderError';
  }
}

function requireSecret(value: string, name: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${name} is required for Stripe Payment provider.`);
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value)) throw new StripeProviderError(`Stripe ${name} is invalid.`);
  return value as number;
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new StripeProviderError(`Stripe ${name} is invalid.`);
  return value;
}

function asPaymentIntent(value: unknown): StripePaymentIntent {
  if (!isRecord(value) || value.object !== 'payment_intent')
    throw new StripeProviderError('Stripe PaymentIntent response is invalid.');
  const status = text(value.status, 'PaymentIntent status');
  if (
    ![
      'requires_payment_method',
      'requires_confirmation',
      'requires_action',
      'processing',
      'requires_capture',
      'canceled',
      'succeeded'
    ].includes(status)
  )
    throw new StripeProviderError('Stripe PaymentIntent status is unsupported.');
  return value as unknown as StripePaymentIntent;
}

function asRefund(value: unknown): StripeRefund {
  if (!isRecord(value) || value.object !== 'refund')
    throw new StripeProviderError('Stripe Refund response is invalid.');
  return value as unknown as StripeRefund;
}

function paymentStatus(intent: StripePaymentIntent): PaymentProviderCreateResult['status'] {
  switch (intent.status) {
    case 'requires_action':
      return 'REQUIRES_ACTION';
    case 'processing':
    case 'requires_capture':
      return 'PROCESSING';
    case 'requires_payment_method':
    case 'requires_confirmation':
      return 'PENDING';
    case 'canceled':
    case 'succeeded':
      throw new StripeProviderError(
        'Stripe PaymentIntent creation returned terminal truth before webhook authority.'
      );
  }
}

function canonicalPaymentStatus(intent: StripePaymentIntent): PaymentProviderSnapshot['status'] {
  switch (intent.status) {
    case 'requires_payment_method':
    case 'requires_confirmation':
      return 'PENDING';
    case 'requires_action':
      return 'REQUIRES_ACTION';
    case 'processing':
    case 'requires_capture':
      return 'PROCESSING';
    case 'canceled':
      return 'CANCELLED';
    case 'succeeded':
      return 'SUCCEEDED';
  }
}

function providerAction(intent: StripePaymentIntent): PaymentProviderAction {
  const redirect = intent.next_action?.redirect_to_url?.url;
  if (typeof redirect === 'string' && redirect.length > 0)
    return { kind: 'REDIRECT', url: redirect };
  if (typeof intent.client_secret === 'string' && intent.client_secret.length > 0)
    return { kind: 'CLIENT_CONFIRMATION', secret: intent.client_secret };
  return { kind: 'NONE' };
}

function paymentIntentReference(value: StripeRefund['payment_intent']): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (isRecord(value) && typeof value.id === 'string' && value.id.trim()) return value.id;
  throw new StripeProviderError('Stripe Refund does not reference a PaymentIntent.');
}

function isoFromUnix(value: unknown, fallbackSeconds: number): string {
  const seconds = Number.isSafeInteger(value) ? (value as number) : fallbackSeconds;
  return new Date(seconds * 1000).toISOString();
}

function timingSafeHexEqual(leftHex: string, rightHex: string): boolean {
  if (!/^[0-9a-f]{64}$/iu.test(leftHex) || !/^[0-9a-f]{64}$/iu.test(rightHex)) return false;
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export class StripePaymentProviderAdapter
  implements PaymentProviderAdapter, PaymentLifecycleProviderAdapter
{
  readonly code = STRIPE_PROVIDER_CODE;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly apiVersion: string;
  private readonly apiBaseUrl: string;
  private readonly webhookToleranceSeconds: number;
  private readonly fetcher: typeof fetch;
  private readonly nowSeconds: () => number;

  constructor(options: StripePaymentProviderOptions) {
    this.secretKey = requireSecret(options.secretKey, 'STRIPE_SECRET_KEY');
    this.webhookSecret = requireSecret(options.webhookSecret, 'STRIPE_WEBHOOK_SECRET');
    this.apiVersion = options.apiVersion?.trim() || STRIPE_API_VERSION;
    this.apiBaseUrl = (options.apiBaseUrl?.trim() || 'https://api.stripe.com').replace(/\/$/u, '');
    this.webhookToleranceSeconds = options.webhookToleranceSeconds ?? 300;
    if (!Number.isSafeInteger(this.webhookToleranceSeconds) || this.webhookToleranceSeconds < 0)
      throw new Error('Stripe webhook tolerance must be a non-negative integer.');
    this.fetcher = options.fetch ?? fetch;
    this.nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  }

  async createPayment(
    command: Readonly<PaymentProviderCreateCommand>
  ): Promise<PaymentProviderCreateResult> {
    const body = new URLSearchParams();
    body.set('amount', String(command.amountMinor));
    body.set('currency', command.currency.toLowerCase());
    body.set('automatic_payment_methods[enabled]', 'true');
    for (const [key, value] of Object.entries(command.metadata))
      body.set(`metadata[${key}]`, value);
    body.set('metadata[markorbitPaymentId]', command.paymentId);
    body.set('metadata[markorbitCheckoutSessionId]', command.checkoutSessionId);
    body.set('metadata[markorbitOrderId]', command.orderId);

    const intent = asPaymentIntent(
      await this.request('POST', '/v1/payment_intents', body, command.providerIdempotencyKey)
    );
    return {
      providerPaymentReference: intent.id,
      status: paymentStatus(intent),
      action: providerAction(intent)
    };
  }

  async resumePayment(providerPaymentReference: string): Promise<PaymentProviderAction> {
    const intent = asPaymentIntent(
      await this.request(
        'GET',
        `/v1/payment_intents/${encodeURIComponent(providerPaymentReference)}`
      )
    );
    return providerAction(intent);
  }

  async verifyWebhook(input: Readonly<PaymentWebhookInput>): Promise<VerifiedProviderPaymentEvent> {
    const signatureHeader = input.headers['stripe-signature'] ?? input.headers['Stripe-Signature'];
    if (!signatureHeader)
      throw new PaymentLifecycleError(
        'WEBHOOK_VERIFICATION_FAILED',
        'Stripe-Signature header is required.'
      );
    const parts = signatureHeader.split(',').map((part) => part.trim());
    const timestampText = parts.find((part) => part.startsWith('t='))?.slice(2);
    const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
    const timestamp = Number(timestampText);
    if (!Number.isSafeInteger(timestamp) || signatures.length === 0)
      throw new PaymentLifecycleError(
        'WEBHOOK_VERIFICATION_FAILED',
        'Stripe webhook signature header is invalid.'
      );
    if (Math.abs(this.nowSeconds() - timestamp) > this.webhookToleranceSeconds)
      throw new PaymentLifecycleError(
        'WEBHOOK_VERIFICATION_FAILED',
        'Stripe webhook signature timestamp is outside tolerance.'
      );
    const signedPayload = Buffer.concat([
      Buffer.from(String(timestamp), 'utf8'),
      Buffer.from('.', 'utf8'),
      Buffer.from(input.rawBody)
    ]);
    const expected = createHmac('sha256', this.webhookSecret).update(signedPayload).digest('hex');
    if (!signatures.some((candidate) => timingSafeHexEqual(candidate, expected)))
      throw new PaymentLifecycleError(
        'WEBHOOK_VERIFICATION_FAILED',
        'Stripe webhook signature could not be verified.'
      );

    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(input.rawBody).toString('utf8'));
    } catch (cause) {
      throw new PaymentLifecycleError('PROVIDER_EVENT_INVALID', 'Stripe webhook JSON is invalid.', {
        cause: cause instanceof Error ? cause : undefined
      });
    }
    if (!isRecord(parsed) || parsed.object !== 'event' || !isRecord(parsed.data))
      throw new PaymentLifecycleError('PROVIDER_EVENT_INVALID', 'Stripe Event payload is invalid.');
    const event = parsed as unknown as StripeEvent;
    const providerEventId = text(event.id, 'Event ID');
    const occurredAt = isoFromUnix(event.created, timestamp);

    if (event.type.startsWith('payment_intent.')) {
      const intent = asPaymentIntent(event.data.object);
      const canonicalType = (() => {
        switch (event.type) {
          case 'payment_intent.requires_action':
            return 'PAYMENT_REQUIRES_ACTION' as const;
          case 'payment_intent.processing':
            return 'PAYMENT_PROCESSING' as const;
          case 'payment_intent.succeeded':
            return 'PAYMENT_SUCCEEDED' as const;
          case 'payment_intent.canceled':
            return 'PAYMENT_CANCELLED' as const;
          case 'payment_intent.payment_failed':
            // Stripe PaymentIntents have no terminal FAILED status. A failed attempt can return
            // to requires_payment_method and later succeed, so do not freeze MarkOrbit truth as FAILED.
            return 'PAYMENT_REQUIRES_ACTION' as const;
          default:
            throw new PaymentLifecycleError(
              'PROVIDER_EVENT_INVALID',
              `Unsupported Stripe PaymentIntent event: ${event.type}.`
            );
        }
      })();
      return {
        provider: this.code,
        providerEventId,
        providerPaymentReference: text(intent.id, 'PaymentIntent ID'),
        canonicalType,
        amount: {
          amountMinor:
            canonicalType === 'PAYMENT_SUCCEEDED'
              ? integer(intent.amount_received ?? intent.amount, 'PaymentIntent amount')
              : integer(intent.amount, 'PaymentIntent amount'),
          currency: text(intent.currency, 'PaymentIntent currency').toUpperCase()
        },
        occurredAt
      };
    }

    if (
      event.type === 'refund.created' ||
      event.type === 'refund.updated' ||
      event.type === 'refund.failed'
    ) {
      const refund = asRefund(event.data.object);
      const status = event.type === 'refund.failed' ? 'failed' : refund.status;
      const canonicalType =
        status === 'succeeded'
          ? ('REFUND_SUCCEEDED' as const)
          : status === 'failed' || status === 'canceled'
            ? ('REFUND_FAILED' as const)
            : ('REFUND_PENDING' as const);
      return {
        provider: this.code,
        providerEventId,
        providerPaymentReference: paymentIntentReference(refund.payment_intent),
        providerRefundReference: text(refund.id, 'Refund ID'),
        canonicalType,
        amount: {
          amountMinor: integer(refund.amount, 'Refund amount'),
          currency: text(refund.currency, 'Refund currency').toUpperCase()
        },
        occurredAt
      };
    }

    throw new PaymentLifecycleError(
      'PROVIDER_EVENT_INVALID',
      `Unsupported Stripe event: ${event.type}.`
    );
  }

  async createRefund(
    command: Readonly<PaymentProviderRefundCommand>
  ): Promise<PaymentProviderRefundResult> {
    const body = new URLSearchParams();
    body.set('payment_intent', command.providerPaymentReference);
    body.set('amount', String(command.amountMinor));
    body.set('metadata[markorbitPaymentId]', command.paymentId);
    body.set('metadata[markorbitRefundId]', command.refundId);
    const refund = asRefund(
      await this.request('POST', '/v1/refunds', body, command.providerIdempotencyKey)
    );
    if (integer(refund.amount, 'Refund amount') !== command.amountMinor)
      throw new StripeProviderError('Stripe Refund amount does not match the governed command.');
    if (text(refund.currency, 'Refund currency').toUpperCase() !== command.currency.toUpperCase())
      throw new StripeProviderError('Stripe Refund currency does not match the governed command.');
    if (paymentIntentReference(refund.payment_intent) !== command.providerPaymentReference)
      throw new StripeProviderError(
        'Stripe Refund PaymentIntent does not match the governed command.'
      );
    return { providerRefundReference: text(refund.id, 'Refund ID'), status: 'PENDING' };
  }

  async retrievePayment(providerPaymentReference: string): Promise<PaymentProviderSnapshot> {
    const intent = asPaymentIntent(
      await this.request(
        'GET',
        `/v1/payment_intents/${encodeURIComponent(providerPaymentReference)}`
      )
    );
    return {
      providerPaymentReference: text(intent.id, 'PaymentIntent ID'),
      status: canonicalPaymentStatus(intent),
      amountMinor: integer(intent.amount, 'PaymentIntent amount'),
      currency: text(intent.currency, 'PaymentIntent currency').toUpperCase(),
      observedAt: new Date().toISOString()
    };
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: URLSearchParams,
    idempotencyKey?: string
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.apiBaseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.secretKey}`,
          'stripe-version': this.apiVersion,
          ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
          ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
        },
        ...(body ? { body: body.toString() } : {})
      });
    } catch {
      throw new StripeProviderError('Stripe API is unavailable.');
    }
    const requestId = response.headers.get('request-id') ?? undefined;
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new StripeProviderError(
        'Stripe API returned invalid JSON.',
        requestId,
        response.status
      );
    }
    if (!response.ok) {
      const message =
        isRecord(payload) && isRecord(payload.error) && typeof payload.error.type === 'string'
          ? `Stripe API request failed: ${payload.error.type}.`
          : 'Stripe API request failed.';
      throw new StripeProviderError(message, requestId, response.status);
    }
    return payload;
  }
}

export function createStripePaymentProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env
): StripePaymentProviderAdapter {
  return new StripePaymentProviderAdapter({
    secretKey: env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
    apiVersion: env.STRIPE_API_VERSION ?? STRIPE_API_VERSION
  });
}

export function createConfiguredPaymentProvider(
  providerCode: string,
  env: NodeJS.ProcessEnv = process.env
): PaymentProviderAdapter & PaymentLifecycleProviderAdapter {
  if (providerCode === STRIPE_PROVIDER_CODE) return createStripePaymentProviderFromEnv(env);
  throw new PaymentServiceError(
    'PROVIDER_UNAVAILABLE',
    `Payment provider ${providerCode} is not configured.`
  );
}
