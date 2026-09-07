// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client.js';
import {
  createProductionGuidanceClient,
  type CreateProductionRecommendationBrowserCommandV1
} from './production-guidance.js';
import type { CreateUserSelectionCommandV1 } from '@markorbit/contracts/markreg-early-funnel';

const workspaceId = '018f0000-0000-7000-8000-000000000954';
const requestUrl = (value: RequestInfo | URL): string =>
  typeof value === 'string' ? value : value instanceof URL ? value.href : value.url;
const fingerprint = 'a'.repeat(64);
const recommendationCommand = {
  schemaVersion: 1 as const,
  intakeId: 'production-intake_954',
  expectedIntakeVersion: 3,
  expectedIntakeFingerprintSha256: fingerprint,
  idempotencyKey: 'recommendation-intent-954',
  correlationId: 'correlation_954'
} satisfies CreateProductionRecommendationBrowserCommandV1;
const selectionCommand = {
  schemaVersion: 1 as const,
  recommendationId: 'production-recommendation_954',
  expectedRecommendationVersion: 2,
  selectedOptionCode: 'B' as const,
  idempotencyKey: 'selection-intent-954',
  correlationId: 'correlation_955'
} satisfies CreateUserSelectionCommandV1;
describe('Production Recommendation and Selection browser client', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('markorbit-workspace-id', workspaceId);
    sessionStorage.setItem('markorbit-csrf-token', 'csrf-954');
  });

  it('posts only exact Recommendation consumer material with browser auth headers', async () => {
    const envelope = { recommendation: { recommendationId: 'production-recommendation_954' } };
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    const client = createProductionGuidanceClient(createApiClient('', 10_000, fetcher));

    await expect(client.createRecommendation(recommendationCommand)).resolves.toEqual(envelope);

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/markreg/production-recommendations');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'X-MarkOrbit-Workspace-Id': workspaceId,
      'X-MarkOrbit-CSRF-Token': 'csrf-954',
      'Idempotency-Key': recommendationCommand.idempotencyKey,
      'X-Correlation-ID': recommendationCommand.correlationId
    });
    expect(init?.credentials).toBe('include');
    if (typeof init?.body !== 'string') throw new Error('expected JSON body');
    expect(JSON.parse(init.body)).toEqual({
      schemaVersion: 1,
      intakeId: recommendationCommand.intakeId,
      expectedIntakeVersion: recommendationCommand.expectedIntakeVersion,
      expectedIntakeFingerprintSha256: recommendationCommand.expectedIntakeFingerprintSha256
    });
    expect(init.body).not.toContain('workspaceId');
    expect(init.body).not.toContain('capability');
    expect(init.body).not.toContain('producerReference');
  });

  it('preserves exact A/B/C Selection material and uses only browser-safe routes', async () => {
    const fetcher = vi.fn<typeof fetch>((url) => {
      const selection = requestUrl(url).includes('user-selections');
      return Promise.resolve(
        new Response(
          JSON.stringify(
            selection
              ? { selection: { selectionId: 'production-selection_954' } }
              : { recommendation: { recommendationId: 'production-recommendation_954' } }
          ),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    const client = createProductionGuidanceClient(createApiClient('', 10_000, fetcher));
    await client.createSelection(selectionCommand);
    await client.getRecommendation('production-recommendation_954');
    await client.getSelection('production-selection_954');

    const [createUrl, createInit] = fetcher.mock.calls[0]!;
    expect(createUrl).toBe('/api/markreg/production-user-selections');
    if (typeof createInit?.body !== 'string') throw new Error('expected JSON body');
    expect(JSON.parse(createInit.body)).toEqual({
      schemaVersion: 1,
      recommendationId: selectionCommand.recommendationId,
      expectedRecommendationVersion: selectionCommand.expectedRecommendationVersion,
      selectedOptionCode: 'B'
    });
    expect(createInit?.headers).toMatchObject({
      'Idempotency-Key': selectionCommand.idempotencyKey,
      'X-Correlation-ID': selectionCommand.correlationId
    });
    expect(requestUrl(fetcher.mock.calls[1]![0])).toBe(
      '/api/markreg/production-recommendations/production-recommendation_954'
    );
    expect(requestUrl(fetcher.mock.calls[2]![0])).toBe(
      '/api/markreg/production-user-selections/production-selection_954'
    );
    for (const [url] of fetcher.mock.calls) {
      expect(requestUrl(url)).not.toContain('/internal/');
      expect(requestUrl(url)).not.toContain('capability');
      expect(requestUrl(url)).not.toContain('/api/lite/');
    }
  });
  it.each([409, 422, 503])('preserves owner HTTP %s without fallback', async (status) => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: `STATUS_${status}`,
            message: `status ${status}`,
            retryable: status === 503,
            correlationId: 'correlation_954'
          }),
          { status, headers: { 'content-type': 'application/json' } }
        )
      )
    );
    const client = createProductionGuidanceClient(createApiClient('', 10_000, fetcher));

    await expect(client.createRecommendation(recommendationCommand)).rejects.toMatchObject({
      status,
      code: `STATUS_${status}`
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
