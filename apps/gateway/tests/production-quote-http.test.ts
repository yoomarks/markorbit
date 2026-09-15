import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayMarkRegEarlyFunnelRoutes } from '../src/markreg-early-funnel-http.js';

const workspaceId = '64646464-6464-4646-8646-646464646464';
const sessionId = 'session_wif07_quote_gateway';
const csrfSecret = 'gateway-wif07-csrf-secret-0123456789';
const internalServiceSecret = 'gateway-wif07-internal-secret-012345';
const quoteId = 'quote_wif07_gateway';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_wif07_gateway',
  sessionId,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_wif07_gateway',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'order:create']
};

function client(): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('not expected')),
    resolve: () => Promise.reject(new Error('not expected')),
    resolveWorkspace: () => Promise.resolve(principal),
    revoke: () => Promise.resolve()
  };
}
function routes() {
  return createGatewayMarkRegEarlyFunnelRoutes({
    markRegUrl: 'http://markreg.test',
    authenticationClient: client(),
    internalServiceSecret,
    csrfSecret,
    allowedOrigins: ['https://app.example']
  });
}

function route(method: 'GET' | 'POST', path: string) {
  const matches = routes().filter(
    (candidate) => candidate.method === method && candidate.path === path
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function request(method: 'GET' | 'POST', path: string, body: unknown = undefined): JsonRequest {
  return {
    method,
    path,
    body,
    params: { quoteId },
    query: {},
    headers: {
      cookie: 'mo_session=token-wif07',
      'x-markorbit-workspace-id': workspaceId,
      'x-correlation-id': 'correlation_wif07_quote_gateway',
      ...(method === 'POST'
        ? {
            origin: 'https://app.example',
            'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret),
            'idempotency-key': 'quote-wif07-gateway'
          }
        : {})
    }
  };
}

const response = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Production Quote Gateway boundary', () => {
  it('registers create and durable read routes', () => {
    expect(
      routes().filter(
        (candidate) =>
          candidate.method === 'POST' && candidate.path === '/api/markreg/production-quotes'
      )
    ).toHaveLength(1);
    expect(
      routes().filter(
        (candidate) =>
          candidate.method === 'GET' && candidate.path === '/api/markreg/production-quotes/:quoteId'
      )
    ).toHaveLength(1);
  });

  it('forwards only exact upstream artifact identity while pricing authority stays server-owned', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://markreg.test/internal/v1/production-quotes');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      const body: unknown = JSON.parse(init.body as string);
      expect(body).toEqual({
        schemaVersion: 1,
        intakeId: 'production-intake_wif07',
        expectedIntakeVersion: 1,
        recommendationId: 'production-recommendation_wif07',
        expectedRecommendationVersion: 2,
        selectionId: 'production-selection_wif07',
        expectedSelectionVersion: 3,
        idempotencyKey: 'quote-wif07-gateway',
        correlationId: 'correlation_wif07_quote_gateway'
      });
      expect(body).not.toHaveProperty('amount');
      expect(body).not.toHaveProperty('currency');
      expect(body).not.toHaveProperty('pricingSource');
      expect(body).not.toHaveProperty('officialFee');
      return response({ quote: { quoteId } });
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('POST', '/api/markreg/production-quotes').handle(
      request('POST', '/api/markreg/production-quotes', {
        schemaVersion: 1,
        intakeId: 'production-intake_wif07',
        expectedIntakeVersion: 1,
        recommendationId: 'production-recommendation_wif07',
        expectedRecommendationVersion: 2,
        selectionId: 'production-selection_wif07',
        expectedSelectionVersion: 3
      })
    );

    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('rejects browser attempts to supply Quote owner authority', async () => {
    vi.stubGlobal('fetch', vi.fn());
    for (const extra of [
      { amount: { amountMinor: 1, currency: 'USD' } },
      { currency: 'USD' },
      { pricingSource: { sourceId: 'attacker' } },
      { status: 'READY' },
      { validUntil: '2030-01-01T00:00:00.000Z' }
    ]) {
      await expect(
        route('POST', '/api/markreg/production-quotes').handle(
          request('POST', '/api/markreg/production-quotes', {
            schemaVersion: 1,
            intakeId: 'production-intake_wif07',
            expectedIntakeVersion: 1,
            recommendationId: 'production-recommendation_wif07',
            expectedRecommendationVersion: 2,
            selectionId: 'production-selection_wif07',
            expectedSelectionVersion: 3,
            ...extra
          })
        )
      ).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_PRODUCTION_QUOTE_REQUEST'
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reloads the durable Quote through an authenticated exact-id read', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(`http://markreg.test/internal/v1/production-quotes/${quoteId}`);
      expect(init.method).toBe('GET');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      return response({ quote: { quoteId } });
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('GET', '/api/markreg/production-quotes/:quoteId').handle(
      request('GET', `/api/markreg/production-quotes/${quoteId}`)
    );
    expect(result.status).toBe(200);
  });
});
