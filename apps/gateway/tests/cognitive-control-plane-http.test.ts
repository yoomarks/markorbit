import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { createGatewayCapabilityRoutes } from '../src/capability-http.js';

const internalServiceSecret = 'integration-769-internal-secret-0000000001';
const coreUrl = 'http://core.test';
const capabilityEngineUrl = 'http://capability.test';
const correlationId = 'correlation-769';
const requestId = 'request-769';
const cognitivePrincipal: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session-769',
  userId: 'user-769',
  capabilities: ['control-plane:cognitive:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const commercialOnlyPrincipal: InternalOperatorPrincipal = {
  ...cognitivePrincipal,
  capabilities: ['commercial-admin:read', 'commercial-admin:operate']
};
const coreProjection = {
  schemaVersion: 1,
  generatedAt: '2026-09-05T00:00:00.000Z',
  source: {
    domain: 'CORE',
    authority: 'BRAIN_REGISTRIES',
    availability: 'AVAILABLE'
  },
  brainAssets: [{ brainAssetId: 'brain-asset_769' }],
  brainGaps: [],
  methodImprovements: [{ ownerField: 'preserve-method-improvement' }],
  brainBuildRuns: {
    availability: 'NOT_DURABLY_RECORDED',
    inventory: null,
    reasonCode: 'NO_DURABLE_BUILD_RUN_REGISTRY'
  },
  summary: {
    brainAssetCount: 1,
    brainGapCount: 0,
    openBrainGapCount: 0,
    methodImprovementAdmissionCount: 1,
    performanceGapAdmissionCount: 1,
    coverageGapAdmissionCount: 0,
    brainBuildRunInventoryAvailable: false
  },
  futureOwnerField: { preserve: true }
};
const capabilityProjection = {
  schemaVersion: 1,
  generatedAt: '2026-09-05T00:00:00.000Z',
  source: {
    domain: 'CAPABILITY_ENGINE',
    authority: 'RUNTIME_CAPABILITY_AND_IMPLEMENTATION_PROFILE_REGISTRIES',
    availability: 'AVAILABLE'
  },
  sourceAdmissionPolicySource: {
    domain: 'CAPABILITY_ENGINE',
    authority: 'SOURCE_ADMISSION_POLICY_CATALOG',
    availability: 'AVAILABLE'
  },
  runtimeCapabilities: [{ capabilityId: 'capability-769' }],
  implementationProfiles: [],
  sourceAdmissionPolicies: [],
  summary: {
    runtimeCapabilityCount: 1,
    implementationProfileCount: 0,
    approvedImplementationProfileCount: 0,
    retiredImplementationProfileCount: 0,
    sourceAdmissionPolicyCount: 0,
    productionAdmissibleSourcePolicyCount: 0,
    pilotSourcePolicyCount: 0,
    fixtureTestSourcePolicyCount: 0,
    unsupportedSourcePolicyCount: 0
  },
  futureOwnerField: { preserve: true }
};

function response(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

function routes() {
  return createGatewayCapabilityRoutes({
    coreUrl,
    capabilityEngineUrl,
    internalServiceSecret,
    csrfSecret: 'integration-769-csrf-secret-0000000000001',
    allowedOrigins: []
  });
}

function route(path: string) {
  const found = routes().find((candidate) => candidate.method === 'GET' && candidate.path === path);
  if (!found) throw new Error(`Missing route ${path}`);
  return found;
}

function request(path: string, headers: Record<string, string> = {}): JsonRequest {
  return {
    method: 'GET',
    path,
    body: undefined,
    params: {},
    query: {},
    headers: {
      cookie: 'mo_session=browser-session-token-769',
      'x-correlation-id': correlationId,
      'x-request-id': requestId,
      'x-markorbit-principal': 'browser-invented-principal',
      'x-markorbit-internal-authorization': 'browser-invented-service-auth',
      ...headers
    }
  };
}

function assertResolverRequest(input: string | URL | Request, init?: RequestInit) {
  expect(String(input)).toBe(`${coreUrl}/internal/control-plane/operator-principals/resolve`);
  expect(init?.method).toBe('POST');
  expect(JSON.parse(String(init?.body))).toEqual({ token: 'browser-session-token-769' });
  const headers = init?.headers as Record<string, string>;
  expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
  expect(headers['x-correlation-id']).toBe(correlationId);
  expect(headers['x-request-id']).toBe(requestId);
  expect(headers['x-markorbit-principal']).toBeUndefined();
}

function assertTrustedOwnerHeaders(init?: RequestInit) {
  const headers = init?.headers as Record<string, string>;
  expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
  expect(headers['x-correlation-id']).toBe(correlationId);
  expect(headers['x-request-id']).toBe(requestId);
  expect(headers['x-markorbit-principal']).not.toBe('browser-invented-principal');
  expect(parseInternalOperatorPrincipal(headers['x-markorbit-principal'])).toEqual(
    cognitivePrincipal
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Cognitive Platform bounded owner reads', () => {
  it('resolves the canonical cognitive operator and forwards the complete Core owner projection', async () => {
    const downstream = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const url = String(input);
        if (url.endsWith('/internal/control-plane/operator-principals/resolve')) {
          assertResolverRequest(input, init);
          return response(200, cognitivePrincipal);
        }
        expect(url).toBe(`${coreUrl}/internal/control-plane/cognitive`);
        expect(init?.method).toBe('GET');
        assertTrustedOwnerHeaders(init);
        return response(200, coreProjection);
      }
    );
    vi.stubGlobal('fetch', downstream);

    const result = await route('/api/internal/control-plane/cognitive/brain').handle(
      request('/api/internal/control-plane/cognitive/brain')
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual(coreProjection);
    expect(result.body).toMatchObject({
      methodImprovements: coreProjection.methodImprovements,
      brainBuildRuns: {
        availability: 'NOT_DURABLY_RECORDED',
        inventory: null,
        reasonCode: 'NO_DURABLE_BUILD_RUN_REGISTRY'
      },
      futureOwnerField: { preserve: true }
    });
    expect(downstream).toHaveBeenCalledTimes(2);
  });

  it('forwards the exact Capability Engine cognitive owner route without synthesizing a joined view', async () => {
    const downstream = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const url = String(input);
        if (url.endsWith('/internal/control-plane/operator-principals/resolve'))
          return response(200, cognitivePrincipal);
        expect(url).toBe(
          `${capabilityEngineUrl}/internal/control-plane/cognitive/capabilities`
        );
        expect(init?.method).toBe('GET');
        assertTrustedOwnerHeaders(init);
        return response(200, capabilityProjection);
      }
    );
    vi.stubGlobal('fetch', downstream);

    const result = await route('/api/internal/control-plane/cognitive/capabilities').handle(
      request('/api/internal/control-plane/cognitive/capabilities')
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual(capabilityProjection);
    expect(result.body).toMatchObject({ futureOwnerField: { preserve: true } });
    expect(downstream).toHaveBeenCalledTimes(2);
  });

  it('denies a commercial-only Internal Operator even if Core returns it successfully', async () => {
    const downstream = vi.fn(() => response(200, commercialOnlyPrincipal));
    vi.stubGlobal('fetch', downstream);

    const result = await route('/api/internal/control-plane/cognitive/brain').handle(
      request('/api/internal/control-plane/cognitive/brain')
    );

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('preserves typed Core cognitive-grant denial without contacting an owner route', async () => {
    const denial = { code: 'PERMISSION_DENIED', marker: 'explicit-core-grant-denial' };
    const downstream = vi.fn(() => response(403, denial));
    vi.stubGlobal('fetch', downstream);

    const result = await route('/api/internal/control-plane/cognitive/brain').handle(
      request('/api/internal/control-plane/cognitive/brain')
    );

    expect(result.status).toBe(403);
    expect(result.body).toEqual(denial);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('requires the HttpOnly session and never accepts browser authority headers as a substitute', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      route('/api/internal/control-plane/cognitive/brain').handle(
        request('/api/internal/control-plane/cognitive/brain', { cookie: '' })
      )
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('fails closed on a malformed successful owner projection', async () => {
    const downstream = vi.fn((input: string | URL | Request) =>
      String(input).endsWith('/internal/control-plane/operator-principals/resolve')
        ? response(200, cognitivePrincipal)
        : response(200, { schemaVersion: 1, brainAssets: [] })
    );
    vi.stubGlobal('fetch', downstream);

    await expect(
      route('/api/internal/control-plane/cognitive/brain').handle(
        request('/api/internal/control-plane/cognitive/brain')
      )
    ).rejects.toMatchObject({ status: 503, code: 'COGNITIVE_OWNER_RESPONSE_INVALID' });
  });

  it('preserves owner 503 status/body and maps owner transport failure to explicit 503', async () => {
    const unavailable = { code: 'COGNITIVE_READ_SOURCE_UNAVAILABLE', marker: 'owner-truth' };
    const preserved = vi.fn((input: string | URL | Request) =>
      String(input).endsWith('/internal/control-plane/operator-principals/resolve')
        ? response(200, cognitivePrincipal)
        : response(503, unavailable)
    );
    vi.stubGlobal('fetch', preserved);

    const result = await route('/api/internal/control-plane/cognitive/brain').handle(
      request('/api/internal/control-plane/cognitive/brain')
    );
    expect(result.status).toBe(503);
    expect(result.body).toEqual(unavailable);

    vi.unstubAllGlobals();
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        calls += 1;
        return calls === 1
          ? response(200, cognitivePrincipal)
          : Promise.reject(new Error('owner transport failed'));
      })
    );
    await expect(
      route('/api/internal/control-plane/cognitive/brain').handle(
        request('/api/internal/control-plane/cognitive/brain')
      )
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
  });

  it('exposes only two explicit Cognitive Platform GET routes and no generic proxy', () => {
    const cognitiveRoutes = routes()
      .filter((candidate) => candidate.path.includes('/control-plane/cognitive'))
      .map((candidate) => `${candidate.method} ${candidate.path}`)
      .sort();
    expect(cognitiveRoutes).toEqual([
      'GET /api/internal/control-plane/cognitive/brain',
      'GET /api/internal/control-plane/cognitive/capabilities'
    ]);
    expect(cognitiveRoutes.some((value) => value.includes('*'))).toBe(false);
    expect(cognitiveRoutes.some((value) => value.includes(':path'))).toBe(false);
  });
});
