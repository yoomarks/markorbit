import type { CreateProductionQuoteCommandV1 } from '@markorbit/contracts/markreg-early-funnel';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client.js';
import { createProductionQuoteClient } from './production-quote.js';

const workspaceId = '64646464-6464-4646-8646-646464646464';
const command: CreateProductionQuoteCommandV1 = {
  schemaVersion: 1,
  intakeId: 'production-intake_wif07',
  expectedIntakeVersion: 1,
  recommendationId: 'production-recommendation_wif07',
  expectedRecommendationVersion: 2,
  selectionId: 'production-selection_wif07',
  expectedSelectionVersion: 3,
  idempotencyKey: 'quote-wif07-browser',
  correlationId: 'correlation_wif07_browser'
};
const envelope = { quote: { quoteId: 'quote_wif07_browser' } };

describe('Production Quote browser client', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('markorbit-workspace-id', workspaceId);
    sessionStorage.setItem('markorbit-csrf-token', 'csrf-wif07');
  });
  it('posts only exact artifact identity while Workspace, CSRF, idempotency and correlation stay in headers', async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    const client = createProductionQuoteClient(createApiClient('', 10_000, fetcher));

    await expect(client.create(command)).resolves.toEqual(envelope);

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/markreg/production-quotes');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(init?.headers).toMatchObject({
      'X-MarkOrbit-Workspace-Id': workspaceId,
      'X-MarkOrbit-CSRF-Token': 'csrf-wif07',
      'Idempotency-Key': command.idempotencyKey,
      'X-Correlation-ID': command.correlationId
    });
    if (typeof init?.body !== 'string') throw new Error('expected JSON request body');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body).toEqual({
      schemaVersion: 1,
      intakeId: command.intakeId,
      expectedIntakeVersion: command.expectedIntakeVersion,
      recommendationId: command.recommendationId,
      expectedRecommendationVersion: command.expectedRecommendationVersion,
      selectionId: command.selectionId,
      expectedSelectionVersion: command.expectedSelectionVersion
    });
    for (const field of [
      'workspaceId',
      'amount',
      'currency',
      'pricingSource',
      'officialFee',
      'serviceFee',
      'status',
      'validUntil'
    ]) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it('reloads durable Quote by exact id without CSRF or mutation headers', async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    const client = createProductionQuoteClient(createApiClient('', 10_000, fetcher));

    await expect(client.get('quote_wif07_browser')).resolves.toEqual(envelope);

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/markreg/production-quotes/quote_wif07_browser');
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('include');
    expect(init?.headers).toMatchObject({ 'X-MarkOrbit-Workspace-Id': workspaceId });
    expect(init?.headers).not.toHaveProperty('X-MarkOrbit-CSRF-Token');
    expect(init?.headers).not.toHaveProperty('Idempotency-Key');
  });

  it.each([400, 401, 403, 409, 502, 503])(
    'preserves HTTP %s as MarkReg API error',
    async (status) => {
      const fetcher = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              code: `STATUS_${status}`,
              message: `status ${status}`,
              retryable: status >= 500
            }),
            { status, headers: { 'content-type': 'application/json' } }
          )
        )
      );
      const client = createProductionQuoteClient(createApiClient('', 10_000, fetcher));
      await expect(client.create(command)).rejects.toMatchObject({
        status,
        code: `STATUS_${status}`
      });
    }
  );
});
