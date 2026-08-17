import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { STRIPE_API_VERSION, StripePaymentProviderAdapter } from '../src/stripe-provider.js';

const stripeSecret = 'sk_test_markorbit_contract';
const webhookSecret = 'whsec_markorbit_contract';
const timestamp = 1786968000;

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', 'request-id': 'req_markorbit_contract' }
  });
}

function signedWebhook(value: unknown) {
  const rawBody = new TextEncoder().encode(JSON.stringify(value));
  const signature = createHmac('sha256', webhookSecret)
    .update(
      Buffer.concat([
        Buffer.from(String(timestamp), 'utf8'),
        Buffer.from('.', 'utf8'),
        Buffer.from(rawBody)
      ])
    )
    .digest('hex');
  return {
    rawBody,
    headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` }
  };
}

describe('Stripe Payment provider adapter', () => {
  it('creates governed PaymentIntents with metadata and idempotency', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const adapter = new StripePaymentProviderAdapter({
      secretKey: stripeSecret,
      webhookSecret,
      nowSeconds: () => timestamp,
      fetch: (async (input, init) => {
        calls.push({ url: String(input), init });
        return jsonResponse({
          id: 'pi_markorbit_create',
          object: 'payment_intent',
          amount: 29900,
          currency: 'usd',
          status: 'requires_payment_method',
          client_secret: 'pi_markorbit_create_secret_contract'
        });
      }) as typeof fetch
    });

    const result = await adapter.createPayment({
      paymentId: 'payment_contract',
      checkoutSessionId: 'checkout_contract',
      orderId: 'order_contract',
      amountMinor: 29900,
      currency: 'USD',
      providerIdempotencyKey: 'payment_contract',
      metadata: {
        markorbitPaymentId: 'payment_contract',
        markorbitCheckoutSessionId: 'checkout_contract',
        markorbitOrderId: 'order_contract',
        markorbitWorkspaceId: 'workspace_contract'
      }
    });

    expect(result).toEqual({
      providerPaymentReference: 'pi_markorbit_create',
      status: 'PENDING',
      action: { kind: 'CLIENT_CONFIRMATION', secret: 'pi_markorbit_create_secret_contract' }
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.stripe.com/v1/payment_intents');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.headers).toMatchObject({
      authorization: `Bearer ${stripeSecret}`,
      'stripe-version': STRIPE_API_VERSION,
      'idempotency-key': 'payment_contract'
    });
    const body = new URLSearchParams(String(calls[0]?.init?.body));
    expect(body.get('amount')).toBe('29900');
    expect(body.get('currency')).toBe('usd');
    expect(body.get('automatic_payment_methods[enabled]')).toBe('true');
    expect(body.get('metadata[markorbitPaymentId]')).toBe('payment_contract');
    expect(body.get('metadata[markorbitCheckoutSessionId]')).toBe('checkout_contract');
    expect(body.get('metadata[markorbitOrderId]')).toBe('order_contract');
    expect(body.get('metadata[markorbitWorkspaceId]')).toBe('workspace_contract');
  });

  it('verifies exact raw webhook bytes before succeeded truth', async () => {
    const adapter = new StripePaymentProviderAdapter({
      secretKey: stripeSecret,
      webhookSecret,
      nowSeconds: () => timestamp
    });
    const input = signedWebhook({
      id: 'evt_markorbit_succeeded',
      object: 'event',
      type: 'payment_intent.succeeded',
      created: timestamp,
      data: {
        object: {
          id: 'pi_markorbit_succeeded',
          object: 'payment_intent',
          amount: 29900,
          amount_received: 29900,
          currency: 'usd',
          status: 'succeeded'
        }
      }
    });

    await expect(adapter.verifyWebhook(input)).resolves.toEqual({
      provider: 'STRIPE',
      providerEventId: 'evt_markorbit_succeeded',
      providerPaymentReference: 'pi_markorbit_succeeded',
      canonicalType: 'PAYMENT_SUCCEEDED',
      amount: { amountMinor: 29900, currency: 'USD' },
      occurredAt: new Date(timestamp * 1000).toISOString()
    });

    const changed = new Uint8Array(input.rawBody);
    changed[changed.length - 2] = changed[changed.length - 2]! === 48 ? 49 : 48;
    await expect(
      adapter.verifyWebhook({ rawBody: changed, headers: input.headers })
    ).rejects.toMatchObject({ code: 'WEBHOOK_VERIFICATION_FAILED' });
  });

  it('keeps payment_failed retryable instead of terminal FAILED', async () => {
    const adapter = new StripePaymentProviderAdapter({
      secretKey: stripeSecret,
      webhookSecret,
      nowSeconds: () => timestamp
    });
    const input = signedWebhook({
      id: 'evt_markorbit_retryable-failure',
      object: 'event',
      type: 'payment_intent.payment_failed',
      created: timestamp,
      data: {
        object: {
          id: 'pi_markorbit_retryable-failure',
          object: 'payment_intent',
          amount: 29900,
          currency: 'usd',
          status: 'requires_payment_method'
        }
      }
    });

    await expect(adapter.verifyWebhook(input)).resolves.toMatchObject({
      canonicalType: 'PAYMENT_REQUIRES_ACTION',
      providerPaymentReference: 'pi_markorbit_retryable-failure'
    });
  });

  it('creates bounded refunds and retrieves reconciliation truth', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const adapter = new StripePaymentProviderAdapter({
      secretKey: stripeSecret,
      webhookSecret,
      nowSeconds: () => timestamp,
      fetch: (async (input, init) => {
        calls.push({ url: String(input), init });
        if (String(input).endsWith('/v1/refunds'))
          return jsonResponse({
            id: 're_markorbit_contract',
            object: 'refund',
            amount: 5000,
            currency: 'usd',
            payment_intent: 'pi_markorbit_contract',
            status: 'pending'
          });
        return jsonResponse({
          id: 'pi_markorbit_contract',
          object: 'payment_intent',
          amount: 29900,
          amount_received: 29900,
          currency: 'usd',
          status: 'succeeded'
        });
      }) as typeof fetch
    });

    await expect(
      adapter.createRefund({
        paymentId: 'payment_contract',
        providerPaymentReference: 'pi_markorbit_contract',
        refundId: 'refund_contract',
        amountMinor: 5000,
        currency: 'USD',
        providerIdempotencyKey: 'refund-contract-idempotency',
        reason: 'Customer request'
      })
    ).resolves.toEqual({ providerRefundReference: 're_markorbit_contract', status: 'PENDING' });

    const refundBody = new URLSearchParams(String(calls[0]?.init?.body));
    expect(refundBody.get('payment_intent')).toBe('pi_markorbit_contract');
    expect(refundBody.get('amount')).toBe('5000');
    expect(calls[0]?.init?.headers).toMatchObject({
      'idempotency-key': 'refund-contract-idempotency'
    });

    await expect(adapter.retrievePayment('pi_markorbit_contract')).resolves.toMatchObject({
      providerPaymentReference: 'pi_markorbit_contract',
      status: 'SUCCEEDED',
      amountMinor: 29900,
      currency: 'USD'
    });
  });

  it('normalizes signed refund webhooks', async () => {
    const adapter = new StripePaymentProviderAdapter({
      secretKey: stripeSecret,
      webhookSecret,
      nowSeconds: () => timestamp
    });
    const input = signedWebhook({
      id: 'evt_markorbit_refund',
      object: 'event',
      type: 'refund.updated',
      created: timestamp,
      data: {
        object: {
          id: 're_markorbit_contract',
          object: 'refund',
          amount: 5000,
          currency: 'usd',
          payment_intent: 'pi_markorbit_contract',
          status: 'succeeded'
        }
      }
    });

    await expect(adapter.verifyWebhook(input)).resolves.toEqual({
      provider: 'STRIPE',
      providerEventId: 'evt_markorbit_refund',
      providerPaymentReference: 'pi_markorbit_contract',
      providerRefundReference: 're_markorbit_contract',
      canonicalType: 'REFUND_SUCCEEDED',
      amount: { amountMinor: 5000, currency: 'USD' },
      occurredAt: new Date(timestamp * 1000).toISOString()
    });
  });
});
