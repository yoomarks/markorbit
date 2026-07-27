import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../src/api/client.js';
import { createMarkregClient } from '../src/api/markreg.js';

describe('markreg API client', () => {
  it('sends the contract body and governed request headers', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      })
    );
    const client = createMarkregClient(createApiClient('http://gateway.test', 1000, fetcher));
    await client.createIntake({
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      customerIntent: {
        brandName: 'Northstar',
        applicantCountry: 'GB',
        targetJurisdictions: ['US'],
        goodsServicesDescription: 'Software'
      },
      actor: {
        actorId: 'actor_test',
        workplaceId: 'workplace_test',
        product: 'MARKREG_COM',
        purpose: 'Test'
      },
      idempotencyKey: 'stable-key',
      correlationId: 'correlation_test'
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [, request] = fetcher.mock.calls[0]!;
    expect(request?.headers).toMatchObject({
      'content-type': 'application/json',
      'Idempotency-Key': 'stable-key',
      'X-Correlation-ID': 'correlation_test'
    });
    expect(JSON.parse(String(request?.body))).not.toHaveProperty('idempotencyKey');
  });
  it.each([502, 503])('maps %s without exposing internal errors', async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'DOWNSTREAM_UNAVAILABLE',
          message: 'MarkReg secret stack',
          correlationId: 'correlation_test',
          retryable: status === 502
        }),
        { status }
      )
    );
    await expect(createApiClient('', 1000, fetcher).post('/x', {}, {})).rejects.not.toThrow(
      /MarkReg|stack/
    );
  });
  it('maps timeout to a retryable message', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener('abort', () =>
              reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
            )
          )
      );
    const error = await createApiClient('http://gateway.test', 1, fetcher)
      .post('/x', {}, {})
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('took too long');
  });
});
