import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { VerifiedProviderPaymentEvent } from '@markorbit/contracts/payment';
import { describe, expect, it } from 'vitest';
import { STRIPE_API_VERSION, StripePaymentProviderAdapter } from '../src/stripe-provider.js';

const sandboxEnabled = process.env.STRIPE_SANDBOX_ACCEPTANCE === '1';
const webhookPort = Number(process.env.STRIPE_WEBHOOK_PORT ?? '4318');
const amountMinor = 100;
const currency = 'USD';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Stripe sandbox acceptance.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Stripe ${label} response is invalid.`);
  return value;
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`Stripe ${label} response field is invalid.`);
  return value;
}

function requireInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`Stripe ${label} response field is invalid.`);
  return value as number;
}

interface StripeApiResult {
  payload: Record<string, unknown>;
  requestId: string | undefined;
}

async function stripeApiRequest(
  secretKey: string,
  method: 'GET' | 'POST',
  path: string,
  body?: URLSearchParams
): Promise<StripeApiResult> {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${secretKey}`,
      'stripe-version': STRIPE_API_VERSION,
      ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {})
    },
    ...(body ? { body: body.toString() } : {})
  });
  const requestId = response.headers.get('request-id') ?? undefined;
  const payload: unknown = await response.json();
  const record = requireRecord(payload, 'API');
  if (!response.ok) {
    const error = isRecord(record.error) ? record.error : undefined;
    const errorType = error && typeof error.type === 'string' ? error.type : 'unknown_error';
    throw new Error(
      `Stripe API request failed (${response.status}, ${errorType}, request ${requestId ?? 'unknown'}).`
    );
  }
  return { payload: record, requestId };
}

async function readRawBody(request: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of request as AsyncIterable<unknown>) {
    if (!(chunk instanceof Uint8Array))
      throw new Error('Stripe sandbox webhook stream chunk is not binary data.');
    chunks.push(Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks));
}

async function waitForWebhook(
  events: VerifiedProviderPaymentEvent[],
  errors: Error[],
  predicate: (event: VerifiedProviderPaymentEvent) => boolean,
  label: string,
  timeoutMs = 45_000
): Promise<VerifiedProviderPaymentEvent> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (errors[0]) throw errors[0];
    const event = events.find(predicate);
    if (event) return event;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for Stripe sandbox webhook: ${label}.`);
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function writeEvidence(value: Readonly<Record<string, unknown>>): Promise<void> {
  const directory = process.env.STRIPE_SANDBOX_EVIDENCE_DIR?.trim();
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(
    `${directory}/stripe-sandbox-acceptance.json`,
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
}

describe.skipIf(!sandboxEnabled)('Stripe real-provider sandbox acceptance', () => {
  it('creates, confirms, verifies webhooks, retrieves, and refunds a real test-mode payment', async () => {
    const secretKey = requiredEnv('STRIPE_SECRET_KEY');
    if (!/^(?:sk|rk)_test_/u.test(secretKey))
      throw new Error('Stripe sandbox acceptance refuses non-test API credentials.');
    const webhookSecret = requiredEnv('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret.startsWith('whsec_'))
      throw new Error('STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret.');

    const provider = new StripePaymentProviderAdapter({ secretKey, webhookSecret });
    const webhookEvents: VerifiedProviderPaymentEvent[] = [];
    const webhookErrors: Error[] = [];
    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      void (async () => {
        if (request.method !== 'POST' || request.url !== '/stripe-webhook') {
          response.statusCode = 404;
          response.end('not found');
          return;
        }
        const signatureHeader = request.headers['stripe-signature'];
        const signature = Array.isArray(signatureHeader)
          ? signatureHeader.join(',')
          : signatureHeader;
        if (!signature) throw new Error('Stripe sandbox webhook did not include Stripe-Signature.');
        const event = await provider.verifyWebhook({
          rawBody: await readRawBody(request),
          headers: { 'stripe-signature': signature }
        });
        webhookEvents.push(event);
        response.statusCode = 200;
        response.end('ok');
      })().catch((cause: unknown) => {
        webhookErrors.push(
          cause instanceof Error ? cause : new Error('Stripe sandbox webhook handling failed.')
        );
        response.statusCode = 400;
        response.end('invalid');
      });
    });

    server.listen(webhookPort, '127.0.0.1');
    await once(server, 'listening');

    try {
      const suffix = randomUUID().replaceAll('-', '');
      const paymentId = `payment_stripe_sandbox_${suffix}` as const;
      const checkoutSessionId = `checkout_stripe_sandbox_${suffix}` as const;
      const refundId = `refund_stripe_sandbox_${suffix}` as const;

      const created = await provider.createPayment({
        paymentId,
        checkoutSessionId,
        orderId: `order_stripe_sandbox_${suffix}`,
        amountMinor,
        currency,
        providerIdempotencyKey: paymentId,
        metadata: {
          markorbitPaymentId: paymentId,
          markorbitCheckoutSessionId: checkoutSessionId,
          markorbitOrderId: `order_stripe_sandbox_${suffix}`,
          markorbitWorkspaceId: 'workspace_stripe_sandbox_acceptance'
        }
      });
      expect(created.status).toBe('PENDING');
      expect(created.providerPaymentReference).toMatch(/^pi_/u);
      expect(created.action.kind).toBe('CLIENT_CONFIRMATION');

      const confirmBody = new URLSearchParams({
        payment_method: 'pm_card_visa',
        return_url: 'https://example.com/markorbit/stripe-sandbox-acceptance'
      });
      const confirmed = await stripeApiRequest(
        secretKey,
        'POST',
        `/v1/payment_intents/${encodeURIComponent(created.providerPaymentReference)}/confirm`,
        confirmBody
      );
      expect(confirmed.payload.livemode).toBe(false);
      expect(confirmed.payload.status).toBe('succeeded');
      expect(
        requireInteger(confirmed.payload.amount_received, 'PaymentIntent amount_received')
      ).toBe(amountMinor);

      const paymentEvent = await waitForWebhook(
        webhookEvents,
        webhookErrors,
        (event) =>
          event.providerPaymentReference === created.providerPaymentReference &&
          event.canonicalType === 'PAYMENT_SUCCEEDED',
        'payment_intent.succeeded'
      );
      expect(paymentEvent.amount).toEqual({ amountMinor, currency });

      const snapshot = await provider.retrievePayment(created.providerPaymentReference);
      expect(snapshot).toMatchObject({
        providerPaymentReference: created.providerPaymentReference,
        status: 'SUCCEEDED',
        amountMinor,
        currency
      });

      const refund = await provider.createRefund({
        paymentId,
        providerPaymentReference: created.providerPaymentReference,
        refundId,
        amountMinor,
        currency,
        providerIdempotencyKey: refundId,
        reason: 'MarkOrbit Stripe sandbox acceptance cleanup'
      });
      expect(refund.providerRefundReference).toMatch(/^re_/u);
      expect(refund.status).toBe('PENDING');

      const refundEvent = await waitForWebhook(
        webhookEvents,
        webhookErrors,
        (event) =>
          event.providerRefundReference === refund.providerRefundReference &&
          event.canonicalType === 'REFUND_SUCCEEDED',
        'refund.created/refund.updated'
      );
      expect(refundEvent.amount).toEqual({ amountMinor, currency });

      const refundRetrieved = await stripeApiRequest(
        secretKey,
        'GET',
        `/v1/refunds/${encodeURIComponent(refund.providerRefundReference)}`
      );
      expect(refundRetrieved.payload.status).toBe('succeeded');
      expect(requireInteger(refundRetrieved.payload.amount, 'Refund amount')).toBe(amountMinor);
      expect(requireText(refundRetrieved.payload.currency, 'Refund currency').toUpperCase()).toBe(
        currency
      );

      await writeEvidence({
        schemaVersion: 1,
        provider: 'STRIPE',
        providerMode: 'test',
        apiVersion: STRIPE_API_VERSION,
        stripeCliVersion: process.env.STRIPE_CLI_VERSION ?? null,
        amountMinor,
        currency,
        paymentIntentId: created.providerPaymentReference,
        paymentEventId: paymentEvent.providerEventId,
        paymentStatus: snapshot.status,
        confirmRequestId: confirmed.requestId ?? null,
        refundId: refund.providerRefundReference,
        refundEventId: refundEvent.providerEventId,
        refundStatus: refundRetrieved.payload.status,
        refundRetrieveRequestId: refundRetrieved.requestId ?? null,
        observedAt: new Date().toISOString()
      });
    } finally {
      await closeServer(server);
    }
  }, 120_000);
});
