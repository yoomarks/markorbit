import {
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';
import type { InternalOperatorPrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGatewayDataControlPlaneRoutes } from '../src/data-control-plane-http.js';

const coreUrl = 'http://core.test';
const dataEngineUrl = 'http://data-engine.test';
const internalServiceSecret = 'integration-882-internal-secret-0000000001';
const dataEngineApiKey = 'integration-882-data-engine-key-0000000000000000000001';
const correlationId = 'correlation-882';
const requestId = 'request-882';
const dataPrincipal: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session-882',
  userId: 'user-882',
  capabilities: ['control-plane:data:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const cognitiveOnlyPrincipal: InternalOperatorPrincipal = {
  ...dataPrincipal,
  capabilities: ['control-plane:cognitive:read']
};
const ownerSummary = {
  contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  engine_version: 'M1.9',
  source_owner: DATA_ENGINE_SOURCE_OWNER,
  authority: 'DATA_ENGINE_FACT_READ_MODEL',
  read_only: true,
  generated_at: '2026-09-05T08:30:00+00:00',
  health: { status: 'degraded' },
  operations: {
    version: 'MARKORBIT_OPERATIONS_V2',
    action_authority:
      'ADVISORY_ONLY_EXISTING_DOMAIN_GATES_AND_CHECKPOINT_VALIDATORS_REMAIN_AUTHORITATIVE',
    summary: {
      operation_count: 7,
      state_counts: { RUNNING: 1, BLOCKED: 2 },
      resume_candidates: 1,
      retry_candidates: 1,
      operator_required: 2,
      partial_state_preservation_required: 3
    }
  },
  domain_progress: {
    version: 'MARKORBIT_ADMIN_PROGRESS_V2',
    active_count: 1
  },
  future_admin_detail: {
    run_id: 'must-not-leak',
    latest_error: 'must-not-leak'
  }
};

function request(headers: Record<string, string> = {}): JsonRequest {
  return {
    method: 'GET',
    path: '/api/internal/control-plane/data/summary',
    params: {},
    query: {},
    body: undefined,
    headers: {
      cookie: 'mo_session=browser-session-token-882',
      'x-correlation-id': correlationId,
      'x-request-id': requestId,
      'x-markorbit-principal': 'browser-invented-principal',
      'x-markorbit-internal-authorization': 'browser-invented-service-auth',
      ...headers
    }
  };
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function dataHeaders(): Headers {
  return new Headers({
    'content-type': 'application/json',
    'x-request-id': requestId,
    'x-correlation-id': correlationId,
    'x-markorbit-contract-version': DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    'x-markorbit-source-owner': DATA_ENGINE_SOURCE_OWNER
  });
}

function dataResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: dataHeaders() });
}

function coreResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

function routes(dataFetch: typeof fetch) {
  return createGatewayDataControlPlaneRoutes({
    coreUrl,
    internalServiceSecret,
    dataEngineUrl,
    dataEngineApiKey,
    fetchImpl: dataFetch
  });
}

function route(dataFetch: typeof fetch) {
  const found = routes(dataFetch).find(
    (candidate) =>
      candidate.method === 'GET' && candidate.path === '/api/internal/control-plane/data/summary'
  );
  if (!found) throw new Error('Missing Data Control Plane summary route.');
  return found;
}

function requestBody(init?: RequestInit): string {
  const body = init?.body;
  if (typeof body !== 'string') throw new Error('Expected string request body.');
  return body;
}

function assertCoreResolver(input: Parameters<typeof fetch>[0], init?: RequestInit) {
  expect(requestUrl(input)).toBe(`${coreUrl}/internal/control-plane/operator-principals/resolve`);
  expect(init?.method).toBe('POST');
  expect(JSON.parse(requestBody(init))).toEqual({
    token: 'browser-session-token-882',
    requiredCapability: 'control-plane:data:read'
  });
  const headers = new Headers(init?.headers);
  expect(headers.get('x-markorbit-internal-authorization')).toBe(internalServiceSecret);
  expect(headers.get('x-correlation-id')).toBe(correlationId);
  expect(headers.get('x-request-id')).toBe(requestId);
  expect(headers.get('x-markorbit-principal')).toBeNull();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Data Control Plane owner summary', () => {
  it('requires exact Data authority and returns only the bounded owner projection', async () => {
    const coreFetch = vi.fn((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      assertCoreResolver(input, init);
      return coreResponse(dataPrincipal);
    });
    vi.stubGlobal('fetch', coreFetch);

    let dataCalls = 0;
    const dataFetch: typeof fetch = (input, init) => {
      dataCalls += 1;
      expect(requestUrl(input)).toBe(`${dataEngineUrl}/api/v1/owner-summary`);
      expect(init?.method).toBe('GET');
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe(`Bearer ${dataEngineApiKey}`);
      expect(headers.get('x-correlation-id')).toBe(correlationId);
      expect(headers.get('x-request-id')).toBe(requestId);
      expect(headers.get('x-markorbit-principal')).toBeNull();
      expect(headers.get('x-markorbit-internal-authorization')).toBeNull();
      return Promise.resolve(dataResponse(ownerSummary));
    };

    const result = await route(dataFetch).handle(request());

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
      engine_version: 'M1.9',
      source_owner: DATA_ENGINE_SOURCE_OWNER,
      authority: 'DATA_ENGINE_FACT_READ_MODEL',
      read_only: true,
      generated_at: '2026-09-05T08:30:00+00:00',
      health: { status: 'degraded' },
      operations: ownerSummary.operations,
      domain_progress: ownerSummary.domain_progress
    });
    expect(JSON.stringify(result.body)).not.toContain('must-not-leak');
    expect(coreFetch).toHaveBeenCalledTimes(1);
    expect(dataCalls).toBe(1);
  });

  it('denies a cognitive-only principal before contacting Data Engine', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => coreResponse(cognitiveOnlyPrincipal))
    );
    const dataFetch = vi.fn<typeof fetch>();

    const result = await route(dataFetch).handle(request());

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(dataFetch).not.toHaveBeenCalled();
  });

  it('preserves typed Core Data-grant denial without contacting Data Engine', async () => {
    const denial = { code: 'PERMISSION_DENIED', marker: 'explicit-data-grant-denial' };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => coreResponse(denial, 403))
    );
    const dataFetch = vi.fn<typeof fetch>();

    const result = await route(dataFetch).handle(request());

    expect(result.status).toBe(403);
    expect(result.body).toEqual(denial);
    expect(dataFetch).not.toHaveBeenCalled();
  });

  it('requires the HttpOnly session and never accepts browser authority headers as a substitute', async () => {
    const coreFetch = vi.fn();
    const dataFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', coreFetch);

    await expect(route(dataFetch).handle(request({ cookie: '' }))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(coreFetch).not.toHaveBeenCalled();
    expect(dataFetch).not.toHaveBeenCalled();
  });

  it('fails closed when a successful Data Engine response is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => coreResponse(dataPrincipal))
    );
    const dataFetch: typeof fetch = vi.fn(() =>
      Promise.resolve(dataResponse({ ...ownerSummary, read_only: false }))
    );

    await expect(route(dataFetch).handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'DATA_ENGINE_CONTRACT_MISMATCH'
    });
  });

  it('keeps owner non-2xx and transport unavailability explicit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => coreResponse(dataPrincipal))
    );
    const ownerUnavailable: typeof fetch = vi.fn(() =>
      Promise.resolve(
        dataResponse(
          {
            code: 'DATA_ENGINE_INTEGRATION_UNAVAILABLE',
            message: 'Owner source unavailable.',
            retryable: true,
            fact_state: 'service_unavailable'
          },
          503
        )
      )
    );

    await expect(route(ownerUnavailable).handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'DATA_ENGINE_INTEGRATION_UNAVAILABLE'
    });

    const transportFailure: typeof fetch = vi.fn(() => Promise.reject(new Error('offline')));
    await expect(route(transportFailure).handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'DATA_ENGINE_UNAVAILABLE'
    });
  });

  it('exposes exactly one Data Control Plane GET route and no generic proxy', () => {
    const dataFetch = vi.fn<typeof fetch>();
    const controlPlaneRoutes = routes(dataFetch)
      .filter((candidate) => candidate.path.includes('/control-plane/data'))
      .map((candidate) => `${candidate.method} ${candidate.path}`);

    expect(controlPlaneRoutes).toEqual(['GET /api/internal/control-plane/data/summary']);
    expect(controlPlaneRoutes.some((value) => value.includes('*'))).toBe(false);
    expect(controlPlaneRoutes.some((value) => value.includes(':path'))).toBe(false);
  });
});
