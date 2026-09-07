import { afterEach, describe, expect, it, vi } from 'vitest';
import { type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayMarkRegEarlyFunnelRoutes } from '../src/markreg-early-funnel-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000000953';
const sessionId = '018f0000-0000-7000-8000-000000000954';
const userId = '018f0000-0000-7000-8000-000000000955';
const csrfSecret = 'integration-953-csrf-secret-0123456789';
const internalServiceSecret = 'integration-953-internal-secret-012345';
const fingerprint = 'a'.repeat(64);
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId,
  sessionId,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: '018f0000-0000-7000-8000-000000000956',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:read', 'matter:create']
};

const recommendationBody = {
  schemaVersion: 1,
  intakeId: 'production-intake_953',
  expectedIntakeVersion: 1,
  expectedIntakeFingerprintSha256: fingerprint
} as const;
const selectionBody = {
  schemaVersion: 1,
  recommendationId: 'production-recommendation_953',
  expectedRecommendationVersion: 1,
  selectedOptionCode: 'B'
} as const;

function client(overrides: Partial<CoreAuthenticationClient> = {}): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('issue is not expected')),
    resolve: () => Promise.reject(new Error('resolve is not expected')),
    resolveWorkspace: () => Promise.resolve(principal),
    revoke: () => Promise.resolve(),
    ...overrides
  };
}

function routes(authenticationClient: CoreAuthenticationClient = client()) {
  return createGatewayMarkRegEarlyFunnelRoutes({
    markRegUrl: 'http://markreg.test',
    authenticationClient,
    internalServiceSecret,
    csrfSecret,
    allowedOrigins: ['https://app.example']
  });
}

function route(method: 'GET' | 'POST', path: string, authenticationClient = client()) {
  const matches = routes(authenticationClient).filter(
    (candidate) => candidate.method === method && candidate.path === path
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function request(
  method: 'GET' | 'POST',
  path: string,
  body: unknown = undefined,
  headers: Record<string, string> = {},
  params: Record<string, string> = {}
): JsonRequest {
  return {
    method,
    path,
    body,
    params,
    query: {},
    headers: {
      cookie: 'mo_session=token-953',
      'x-markorbit-workspace-id': workspaceId,
      'x-correlation-id': 'correlation_953',
      'x-request-id': 'request-953',
      ...(method === 'POST'
        ? {
            origin: 'https://app.example',
            'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret),
            'idempotency-key': 'production-consumer-key-953'
          }
        : {}),
      ...headers
    }
  };
}

function response(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Production Recommendation and User Selection Gateway bridge', () => {
  it('registers all four browser-safe production routes exactly once', () => {
    const values = routes();
    for (const [method, path] of [
      ['POST', '/api/markreg/production-recommendations'],
      ['GET', '/api/markreg/production-recommendations/:recommendationId'],
      ['POST', '/api/markreg/production-user-selections'],
      ['GET', '/api/markreg/production-user-selections/:selectionId']
    ] as const) {
      expect(
        values.filter((candidate) => candidate.method === method && candidate.path === path)
      ).toHaveLength(1);
    }
  });

  it('forwards only the exact Recommendation orchestration command with trusted Workspace authority', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://markreg.test/internal/v1/production-recommendation-orchestrations');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['idempotency-key']).toBe('production-consumer-key-953');
      expect(headers['x-correlation-id']).toBe('correlation_953');
      expect(headers).not.toHaveProperty('cookie');
      const envelope = JSON.parse(
        Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as { principal: WorkspacePrincipal };
      expect(envelope.principal).toMatchObject({ userId, workspaceId });
      expect(JSON.parse(init.body as string)).toEqual({
        ...recommendationBody,
        idempotencyKey: 'production-consumer-key-953',
        correlationId: 'correlation_953'
      });
      return response(200, {
        recommendation: { recommendationId: 'production-recommendation_953' }
      });
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('POST', '/api/markreg/production-recommendations').handle(
      request('POST', '/api/markreg/production-recommendations', recommendationBody)
    );

    expect(result.status).toBe(200);
    expect(result.headers).toEqual({ 'x-correlation-id': 'correlation_953' });
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('forwards only the exact User Selection command and preserves A/B/C choice', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://markreg.test/internal/v1/production-user-selections');
      expect(JSON.parse(init.body as string)).toEqual({
        ...selectionBody,
        idempotencyKey: 'production-consumer-key-953',
        correlationId: 'correlation_953'
      });
      return response(200, { selection: { selectionId: 'production-selection_953' } });
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('POST', '/api/markreg/production-user-selections').handle(
      request('POST', '/api/markreg/production-user-selections', selectionBody)
    );

    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('forwards Recommendation and Selection reads with workspace:read only', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(init.method).toBe('GET');
      return response(200, { ok: true, url });
    });
    vi.stubGlobal('fetch', downstream);
    const readOnly = client({
      resolveWorkspace: () => Promise.resolve({ ...principal, permissions: ['workspace:read'] })
    });

    await route(
      'GET',
      '/api/markreg/production-recommendations/:recommendationId',
      readOnly
    ).handle(
      request(
        'GET',
        '/api/markreg/production-recommendations/id',
        undefined,
        {},
        {
          recommendationId: 'production-recommendation_953'
        }
      )
    );
    await route('GET', '/api/markreg/production-user-selections/:selectionId', readOnly).handle(
      request(
        'GET',
        '/api/markreg/production-user-selections/id',
        undefined,
        {},
        {
          selectionId: 'production-selection_953'
        }
      )
    );

    expect(downstream.mock.calls.map(([url]) => url)).toEqual([
      'http://markreg.test/internal/v1/production-recommendations/production-recommendation_953',
      'http://markreg.test/internal/v1/production-user-selections/production-selection_953'
    ]);
  });

  it.each([
    ['workspaceId', workspaceId, 'ACTOR_SPOOF_REJECTED'],
    ['capabilityId', 'capability_spoof', 'PRODUCER_CONTROL_REJECTED'],
    ['producerReference', { capabilityRequestId: 'spoof' }, 'PRODUCER_CONTROL_REJECTED'],
    ['unexpectedField', 'spoof', 'INVALID_PRODUCTION_RECOMMENDATION_REQUEST']
  ] as const)(
    'rejects browser field %s before authentication and downstream',
    async (field, value, code) => {
      const resolveWorkspace = vi.fn(() => Promise.resolve(principal));
      const downstream = vi.fn();
      vi.stubGlobal('fetch', downstream);
      await expect(
        route(
          'POST',
          '/api/markreg/production-recommendations',
          client({ resolveWorkspace })
        ).handle(
          request('POST', '/api/markreg/production-recommendations', {
            ...recommendationBody,
            [field]: value
          })
        )
      ).rejects.toMatchObject({ status: 400, code });
      expect(resolveWorkspace).not.toHaveBeenCalled();
      expect(downstream).not.toHaveBeenCalled();
    }
  );

  it('requires idempotency, trusted Origin, CSRF, and matter:create for mutations', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const create = route('POST', '/api/markreg/production-recommendations');

    await expect(
      create.handle(
        request('POST', '/api/markreg/production-recommendations', recommendationBody, {
          'idempotency-key': ''
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    await expect(
      create.handle(
        request('POST', '/api/markreg/production-recommendations', recommendationBody, {
          origin: 'https://evil.example'
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'UNTRUSTED_ORIGIN' });
    await expect(
      create.handle(
        request('POST', '/api/markreg/production-recommendations', recommendationBody, {
          'x-markorbit-csrf-token': ''
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });

    const denied = client({
      resolveWorkspace: () => Promise.resolve({ ...principal, permissions: ['workspace:read'] })
    });
    await expect(
      route('POST', '/api/markreg/production-recommendations', denied).handle(
        request('POST', '/api/markreg/production-recommendations', recommendationBody)
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('preserves owner 409 and 422 status/code without fallback', async () => {
    const downstream = vi
      .fn()
      .mockImplementationOnce(() => response(409, { code: 'INTAKE_VERSION_CONFLICT' }))
      .mockImplementationOnce(() => response(422, { code: 'RECOMMENDATION_NOT_APPLICABLE' }));
    vi.stubGlobal('fetch', downstream);

    const recommendation = await route('POST', '/api/markreg/production-recommendations').handle(
      request('POST', '/api/markreg/production-recommendations', recommendationBody)
    );
    const selection = await route('POST', '/api/markreg/production-user-selections').handle(
      request('POST', '/api/markreg/production-user-selections', selectionBody)
    );

    expect(recommendation).toMatchObject({
      status: 409,
      body: { code: 'INTAKE_VERSION_CONFLICT' }
    });
    expect(selection).toMatchObject({
      status: 422,
      body: { code: 'RECOMMENDATION_NOT_APPLICABLE' }
    });
    expect(downstream).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed exact identities and options before downstream', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route('POST', '/api/markreg/production-recommendations').handle(
        request('POST', '/api/markreg/production-recommendations', {
          ...recommendationBody,
          expectedIntakeFingerprintSha256: 'BAD'
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    await expect(
      route('POST', '/api/markreg/production-user-selections').handle(
        request('POST', '/api/markreg/production-user-selections', {
          ...selectionBody,
          selectedOptionCode: 'D'
        })
      )
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_PRODUCTION_USER_SELECTION_REQUEST'
    });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('maps downstream transport failure to retryable 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline')))
    );
    await expect(
      route('POST', '/api/markreg/production-recommendations').handle(
        request('POST', '/api/markreg/production-recommendations', recommendationBody)
      )
    ).rejects.toMatchObject({
      status: 503,
      code: 'DOWNSTREAM_UNAVAILABLE',
      retryable: true
    });
  });
});
