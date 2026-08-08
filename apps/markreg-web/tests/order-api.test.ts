import { describe, expect, it } from 'vitest';
import type { ApiClient } from '../src/api/client.js';
import { createOrderClient } from '../src/api/order.js';

class RecordingApi implements ApiClient {
  readonly calls: { method: string; path: string; body?: unknown; headers?: Record<string, string> }[] = [];
  post<T>(path: string, body: unknown, headers: Record<string, string>): Promise<T> {
    this.calls.push({ method: 'POST', path, body, headers });
    return Promise.resolve({} as T);
  }
  get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    this.calls.push({ method: 'GET', path, headers });
    return Promise.resolve({} as T);
  }
  patch<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    this.calls.push({ method: 'PATCH', path, body, headers });
    return Promise.resolve({} as T);
  }
}

const workspaceId = '45454545-4545-4454-8545-454545454545';

describe('M3-WP-05 typed Order browser client', () => {
  it('uses canonical Gateway paths and Idempotency-Key for every mutation', async () => {
    const api = new RecordingApi();
    const client = createOrderClient(api);
    const base = {
      workspaceId,
      orderId: 'order_client' as const,
      expectedVersion: 4,
      idempotencyKey: 'order-client-key'
    };

    await client.create({
      workspaceId,
      orderType: 'TrademarkFiling',
      quoteId: 'quote_client',
      expectedQuoteVersion: 'quote-v1',
      customerConfirmationId: 'confirmation_client',
      expectedCustomerConfirmationVersion: 3,
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      idempotencyKey: 'create-client'
    });
    await client.get(base.orderId);
    await client.list({ status: 'ReadyForMatter', customerId: 'customer_client', page: 2, pageSize: 25 });
    await client.requestConfirmation(base);
    await client.confirm(base);
    await client.evaluateReadiness(base);
    await client.createMatter({
      workspaceId,
      orderId: base.orderId,
      expectedOrderVersion: 4,
      expectedCommercialSourceSha256: 'a'.repeat(64),
      idempotencyKey: 'create-matter-client'
    });
    await client.linkMatter({
      workspaceId,
      orderId: base.orderId,
      expectedOrderVersion: 4,
      formalMatterId: 'formal-matter_client',
      expectedFormalMatterVersion: 1,
      expectedCommercialSourceSha256: 'a'.repeat(64),
      idempotencyKey: 'link-matter-client'
    });
    await client.cancel({ ...base, reason: 'Customer requested cancellation.' });

    expect(api.calls.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /api/markreg/orders',
      'GET /api/markreg/orders/order_client',
      'GET /api/markreg/orders?status=ReadyForMatter&customerId=customer_client&page=2&pageSize=25',
      'POST /api/markreg/orders/order_client/request-confirmation',
      'POST /api/markreg/orders/order_client/confirm',
      'POST /api/markreg/orders/order_client/evaluate-readiness',
      'POST /api/markreg/orders/order_client/create-matter',
      'POST /api/markreg/orders/order_client/link-matter',
      'POST /api/markreg/orders/order_client/cancel'
    ]);
    for (const call of api.calls.filter((value) => value.method === 'POST'))
      expect(call.headers?.['Idempotency-Key']).toBeTruthy();
  });
});
