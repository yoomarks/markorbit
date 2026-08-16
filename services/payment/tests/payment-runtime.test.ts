import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { createRuntime } from '../src/index.js';
import {
  HttpPaymentCheckoutSource,
  UnconfiguredPaymentProviderAdapter
} from '../src/payment-runtime.js';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_payment-runtime',
  userId: 'user_payment-runtime',
  workspaceId: 'workspace_payment-runtime',
  membershipId: 'membership_payment-runtime',
  role: 'WORKSPACE_ADMIN',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-17T08:00:00.000Z'
};

const runtimes: ReturnType<typeof createRuntime>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
});

describe('Payment runtime', () => {
  it('starts a real HTTP runtime on the Payment service port boundary', async () => {
    const runtime = createRuntime({ port: 0, providerCode: 'UNCONFIGURED' });
    runtimes.push(runtime);
    await runtime.start();
    const health = await fetch(`http://127.0.0.1:${runtime.listeningPort}/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({ service: 'payment' });
  });

  it('fetches Checkout truth from MarkReg using the real internal Principal', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          checkoutSessionId: 'checkout_runtime',
          workspaceId: principal.workspaceId
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    const source = new HttpPaymentCheckoutSource('http://markreg.test', 'internal-secret');
    await source.findCheckout(principal, principal.workspaceId, 'checkout_runtime');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://markreg.test/v1/checkouts/checkout_runtime');
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-markorbit-internal-authorization']).toBe('internal-secret');
    expect(headers['x-markorbit-workspace-id']).toBe(principal.workspaceId);
    expect(headers['x-markorbit-principal']).toBeTruthy();
  });

  it('fails closed when no real provider adapter is configured', async () => {
    const provider = new UnconfiguredPaymentProviderAdapter();
    await expect(
      provider.createPayment({
        paymentId: 'payment_runtime',
        checkoutSessionId: 'checkout_runtime',
        orderId: 'order_runtime',
        amountMinor: 29900,
        currency: 'USD',
        providerIdempotencyKey: 'payment_runtime',
        metadata: {}
      })
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
});
