import { describe, expect, it } from 'vitest';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER,
  type DataEngineResourceKind
} from '@markorbit/contracts/data-engine';
import { createDataEngineClient } from '../src/data-engine-http.js';

const acceptanceKey = 'g1-unit-acceptance-key-0000000000000000000000000000';

function envelope(resourceKind: DataEngineResourceKind, payload: unknown = {}) {
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'M1.7',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    jurisdiction: resourceKind === 'TRADEMARK_CASE' ? 'CN' : 'US',
    resource_kind: resourceKind,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    legal_conclusion: false,
    fact_state: 'observed',
    payload
  };
}

function descriptor(authMode = 'required') {
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'M1.7',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    service_role: 'SOURCE_FACT_SERVICE',
    consumer_policy: {
      query_plane_read_only: true,
      change_feed_read_only: true,
      cross_service_database_access: false,
      consumer_writeback_to_source_facts: false,
      business_state_owned_outside_data_engine: true
    },
    security: {
      scheme: 'BEARER_API_KEY',
      authorization_header: 'Authorization: Bearer <key>',
      auth_mode: authMode,
      default_mode: 'disabled',
      required_mode: 'required',
      minimum_key_length: 32,
      multi_key_rotation: true,
      fail_closed_when_required: true
    },
    transport: {
      request_id_header: 'X-Request-ID',
      correlation_id_header: 'x-correlation-id',
      request_id_echoed: true,
      correlation_id_echoed: true,
      contract_version_header: 'X-MarkOrbit-Contract-Version',
      source_owner_header: 'X-MarkOrbit-Source-Owner'
    },
    planes: {
      query: { prefix: '/api/v1', methods: ['GET'] },
      change_feed: {
        path: '/api/v1/us/changes',
        methods: ['GET'],
        cursor_semantics: 'LOSSLESS_OBSERVATION_CURSOR_NOT_LEGAL_CONCLUSION'
      },
      admin: { prefixes: ['/api/admin', '/api/jobs'], part_of_consumer_contract: false }
    },
    stable_resources: ['/api/v1/contract', '/api/v1/cn/cases/{application_number}'],
    g0_contract: {
      contract_id: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
      source_owner: DATA_ENGINE_SOURCE_OWNER,
      compatibility: {
        v1_default: 'additive',
        breaking_change_policy: 'cross_repo_migration_or_new_version',
        deprecation_policy: 'no_v1_removal_without_cross_repo_review'
      },
      query_contract: {
        methods: ['GET'],
        storage_independent: true,
        resources: [{ path: '/api/v1/contract', query: {}, pagination: 'none' }]
      },
      fact_semantics: {
        observed: 'observed',
        not_found: 'not found without coverage proof',
        not_covered: 'reserved',
        no_observation: 'reserved',
        tombstone: 'reserved',
        service_unavailable: 'unavailable',
        current_explicit_states: ['observed', 'not_found', 'service_unavailable'],
        reserved_not_yet_emitted: ['not_covered', 'no_observation', 'tombstone']
      },
      security: {
        scheme: 'BEARER_API_KEY',
        authorization_header: 'Authorization: Bearer <key>',
        g1_target_mode: 'required',
        environment_isolation: true,
        minimum_key_length: 32,
        multi_key_rotation: true,
        unauthenticated_status: 401,
        forbidden_status: 403,
        forbidden_current_behavior: 'reserved; V1 has no scope/role authorization layer'
      },
      tracing: {
        request_id_header: 'X-Request-ID',
        correlation_id_header: 'x-correlation-id',
        response_echo: [
          'X-Request-ID',
          'x-correlation-id',
          'X-MarkOrbit-Contract-Version',
          'X-MarkOrbit-Source-Owner'
        ],
        provider_trace_identifier: 'X-Request-ID'
      },
      runtime_errors: {
        schema: { required: ['code', 'message', 'retryable'], optional: ['detail', 'fact_state'] },
        status_codes: {
          '401': { retryable: false, meaning: 'auth' },
          '404': { retryable: false, meaning: 'not found' },
          '429': { retryable: true, meaning: 'rate limit' },
          '503': { retryable: true, meaning: 'unavailable' }
        },
        timeout: 'retryable',
        schema_mismatch: 'fail closed'
      },
      rate_limit: {
        server_enforcement_default: false,
        enabled_config: 'INTEGRATION_RATE_LIMIT_ENABLED',
        throttled_status: 429,
        retry_after_header: 'Retry-After'
      }
    }
  };
}

function providerHeaders(requestId: string, correlationId: string, extra: HeadersInit = {}): Headers {
  return new Headers({
    'content-type': 'application/json',
    'X-Request-ID': requestId,
    'x-correlation-id': correlationId,
    'X-MarkOrbit-Contract-Version': DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    'X-MarkOrbit-Source-Owner': DATA_ENGINE_SOURCE_OWNER,
    ...Object.fromEntries(new Headers(extra))
  });
}

function jsonResponse(
  body: unknown,
  status = 200,
  requestId = 'req-1',
  correlationId = 'corr-1',
  extraHeaders: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: providerHeaders(requestId, correlationId, extraHeaders)
  });
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe('Gateway Data Engine G1 client', () => {
  it('injects Bearer auth, preserves correlation, and validates provider transport metadata', async () => {
    const traces: unknown[] = [];
    const calls: Array<{ url: string; headers: Headers }> = [];
    const fetchImpl: typeof fetch = (input, init) => {
      calls.push({ url: requestUrl(input), headers: new Headers(init?.headers) });
      return Promise.resolve(jsonResponse(descriptor(), 200));
    };
    const client = createDataEngineClient({
      dataEngineUrl: 'http://data-engine.test/',
      apiKey: acceptanceKey,
      fetchImpl,
      requestIdFactory: () => 'req-1',
      onTrace: (trace) => traces.push(trace)
    });

    const contract = await client.contract({ requestId: 'req-1', correlationId: 'corr-1' });

    expect(contract.security.auth_mode).toBe('required');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers.get('authorization')).toBe(`Bearer ${acceptanceKey}`);
    expect(calls[0]?.headers.get('x-request-id')).toBe('req-1');
    expect(calls[0]?.headers.get('x-correlation-id')).toBe('corr-1');
    expect(traces).toEqual([
      expect.objectContaining({
        status: 200,
        requestId: 'req-1',
        correlationId: 'corr-1',
        providerRequestId: 'req-1',
        providerCorrelationId: 'corr-1'
      })
    ]);
  });

  it('keeps 404 not_found separate from coverage and preserves unknown', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        jsonResponse(
          {
            code: 'DATA_ENGINE_INTEGRATION_NOT_FOUND',
            message: 'Resource not found.',
            retryable: false,
            fact_state: 'not_found'
          },
          404
        )
      );
    const client = createDataEngineClient({
      dataEngineUrl: 'http://data-engine.test',
      apiKey: acceptanceKey,
      fetchImpl,
      requestIdFactory: () => 'req-1'
    });

    await expect(
      client.rawGet('/api/v1/does-not-exist', { requestId: 'req-1', correlationId: 'corr-1' })
    ).rejects.toMatchObject({
      code: 'DATA_ENGINE_NOT_FOUND',
      status: 404,
      retryable: false,
      factState: 'not_found',
      coverageState: 'unknown'
    });
  });

  it('honors provider 429 retry metadata without converting it to a factual negative', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        jsonResponse(
          {
            code: 'DATA_ENGINE_INTEGRATION_RATE_LIMITED',
            message: 'Slow down.',
            retryable: true
          },
          429,
          'req-1',
          'corr-1',
          { 'Retry-After': '7' }
        )
      );
    const client = createDataEngineClient({
      dataEngineUrl: 'http://data-engine.test',
      apiKey: acceptanceKey,
      fetchImpl,
      requestIdFactory: () => 'req-1'
    });

    await expect(
      client.contract({ requestId: 'req-1', correlationId: 'corr-1' })
    ).rejects.toMatchObject({
      code: 'DATA_ENGINE_RATE_LIMITED',
      status: 429,
      retryable: true,
      retryAfterSeconds: 7
    });
  });

  it('maps provider 401 as a non-retryable service authentication failure', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        jsonResponse(
          {
            code: 'DATA_ENGINE_INTEGRATION_AUTH_REQUIRED',
            message: 'A valid bearer key is required.',
            retryable: false
          },
          401
        )
      );
    const client = createDataEngineClient({
      dataEngineUrl: 'http://data-engine.test',
      fetchImpl,
      requestIdFactory: () => 'req-1'
    });

    await expect(
      client.contract({ requestId: 'req-1', correlationId: 'corr-1' })
    ).rejects.toMatchObject({ code: 'DATA_ENGINE_AUTH_FAILED', status: 401, retryable: false });
  });

  it('fails closed when provider response transport metadata drifts', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify(descriptor()), {
          status: 200,
          headers: providerHeaders('wrong-request', 'corr-1')
        })
      );
    const client = createDataEngineClient({
      dataEngineUrl: 'http://data-engine.test',
      apiKey: acceptanceKey,
      fetchImpl,
      requestIdFactory: () => 'req-1'
    });

    await expect(
      client.contract({ requestId: 'req-1', correlationId: 'corr-1' })
    ).rejects.toMatchObject({ code: 'DATA_ENGINE_CONTRACT_MISMATCH' });
  });

  it('fails closed when a fact response tries to promote a legal conclusion', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        jsonResponse(
          {
            ...envelope('RECORDED_ASSIGNMENT_FACTS'),
            legal_conclusion: true
          },
          200
        )
      );
    const client = createDataEngineClient({
      dataEngineUrl: 'http://data-engine.test',
      apiKey: acceptanceKey,
      fetchImpl,
      requestIdFactory: () => 'req-1'
    });

    await expect(
      client.usAssignments('99278031', 25, { requestId: 'req-1', correlationId: 'corr-1' })
    ).rejects.toMatchObject({ code: 'DATA_ENGINE_CONTRACT_MISMATCH' });
  });

  it('classifies an actual transport timeout as retryable service_unavailable', async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    const client = createDataEngineClient({
      dataEngineUrl: 'http://data-engine.test',
      apiKey: acceptanceKey,
      fetchImpl,
      timeoutMs: 5,
      requestIdFactory: () => 'req-1'
    });

    await expect(
      client.contract({ requestId: 'req-1', correlationId: 'corr-1' })
    ).rejects.toMatchObject({
      code: 'DATA_ENGINE_UNAVAILABLE',
      retryable: true,
      factState: 'service_unavailable'
    });
  });

  it('rejects configured service keys shorter than the frozen provider minimum', () => {
    expect(() =>
      createDataEngineClient({ dataEngineUrl: 'http://data-engine.test', apiKey: 'too-short' })
    ).toThrow('at least 32 characters');
  });
});
