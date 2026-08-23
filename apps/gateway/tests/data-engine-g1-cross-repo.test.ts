import { createServer, type Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDataEngineClient } from '../src/data-engine-http.js';
import { createDataEngineProtectedQueryRuntime } from '../src/data-engine-g1-runtime.js';

const crossRepoDescribe = process.env.MO_DE_G1_CROSS_REPO === '1' ? describe : describe.skip;

crossRepoDescribe('MO-DE-006 real authenticated cross-repo acceptance', () => {
  const providerUrl = process.env.MO_DE_G1_PROVIDER_URL!;
  const rateLimitProviderUrl = process.env.MO_DE_G1_RATE_LIMIT_PROVIDER_URL!;
  const invalidConfigProviderUrl = process.env.MO_DE_G1_INVALID_CONFIG_PROVIDER_URL!;
  const apiKey = process.env.MO_DE_G1_API_KEY!;
  const runtime = createDataEngineProtectedQueryRuntime({
    dataEngineUrl: providerUrl,
    dataEngineApiKey: apiKey,
    port: 0,
    timeoutMs: 2_000
  });
  let gatewayUrl = '';

  beforeAll(async () => {
    expect(providerUrl).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect(rateLimitProviderUrl).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect(invalidConfigProviderUrl).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect(apiKey.length).toBeGreaterThanOrEqual(32);
    await runtime.start();
    gatewayUrl = `http://127.0.0.1:${runtime.listeningPort}`;
  });

  afterAll(async () => {
    await runtime.stop();
  });

  it('proves Gateway -> auth-required Data Engine -> validated contract with tracing', async () => {
    const response = await fetch(`${gatewayUrl}/api/data-engine/contract`, {
      headers: {
        'X-Request-ID': 'mo-de-006-provider-hop-1',
        'x-correlation-id': 'mo-de-006-correlation-1'
      }
    });
    const body = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(200);
    expect(body.contract_version).toBe('MARKORBIT_DATA_ENGINE_INTEGRATION_V1');
    expect(body.security?.auth_mode).toBe('required');
    expect(body.g0_contract?.security?.g1_target_mode).toBe('required');
    expect(response.headers.get('x-correlation-id')).toBe('mo-de-006-correlation-1');
    expect(response.headers.get('x-data-engine-request-id')).toBe('mo-de-006-provider-hop-1');
    expect(response.headers.get('x-data-engine-contract-version')).toBe(
      'MARKORBIT_DATA_ENGINE_INTEGRATION_V1'
    );
  });

  it('proves missing provider credentials fail with real 401', async () => {
    const client = createDataEngineClient({ dataEngineUrl: providerUrl });
    await expect(
      client.contract({ requestId: 'mo-de-006-unauth-1', correlationId: 'mo-de-006-unauth-corr' })
    ).rejects.toMatchObject({
      code: 'DATA_ENGINE_AUTH_FAILED',
      status: 401,
      retryable: false
    });
  });

  it('proves real provider 404 stays not_found with coverage unknown through Gateway', async () => {
    const response = await fetch(`${gatewayUrl}/api/data-engine/not-found-probe`, {
      headers: {
        'X-Request-ID': 'mo-de-006-not-found-1',
        'x-correlation-id': 'mo-de-006-not-found-corr'
      }
    });
    const body = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(404);
    expect(body.code).toBe('DATA_ENGINE_INTEGRATION_NOT_FOUND');
    expect(body.retryable).toBe(false);
    expect(body.details?.factState).toBe('not_found');
    expect(body.details?.coverageState).toBe('unknown');
  });

  it('proves real provider backpressure returns retryable 429 with Retry-After', async () => {
    const client = createDataEngineClient({
      dataEngineUrl: rateLimitProviderUrl,
      apiKey,
      requestIdFactory: () => 'mo-de-006-rate-request'
    });

    await client.contract({
      requestId: 'mo-de-006-rate-first',
      correlationId: 'mo-de-006-rate-corr'
    });
    await expect(
      client.contract({ requestId: 'mo-de-006-rate-second', correlationId: 'mo-de-006-rate-corr' })
    ).rejects.toMatchObject({
      code: 'DATA_ENGINE_RATE_LIMITED',
      status: 429,
      retryable: true,
      retryAfterSeconds: expect.any(Number)
    });
  });

  it('proves invalid required-mode provider configuration fails closed as service_unavailable', async () => {
    const client = createDataEngineClient({
      dataEngineUrl: invalidConfigProviderUrl,
      apiKey
    });
    await expect(
      client.contract({ requestId: 'mo-de-006-503-1', correlationId: 'mo-de-006-503-corr' })
    ).rejects.toMatchObject({
      code: 'DATA_ENGINE_UNAVAILABLE',
      status: 503,
      retryable: true,
      factState: 'service_unavailable'
    });
  });

  it('fails closed against the real provider when the consumer expects another contract version', async () => {
    const client = createDataEngineClient({
      dataEngineUrl: providerUrl,
      apiKey,
      expectedContractVersion: 'MARKORBIT_DATA_ENGINE_INTEGRATION_V999'
    });
    await expect(
      client.contract({ requestId: 'mo-de-006-version-1', correlationId: 'mo-de-006-version-corr' })
    ).rejects.toMatchObject({ code: 'DATA_ENGINE_CONTRACT_MISMATCH' });
  });

  it('records 403 and coverage-state cases as not applicable until the frozen provider emits them', async () => {
    const client = createDataEngineClient({ dataEngineUrl: providerUrl, apiKey });
    const contract = await client.contract({
      requestId: 'mo-de-006-contract-semantics-1',
      correlationId: 'mo-de-006-contract-semantics-corr'
    });

    expect(contract.g0_contract.security.forbidden_current_behavior).toContain('reserved');
    expect(contract.g0_contract.fact_semantics.current_explicit_states).toEqual(
      expect.arrayContaining(['observed', 'not_found', 'service_unavailable'])
    );
    expect(contract.g0_contract.fact_semantics.reserved_not_yet_emitted).toEqual(
      expect.arrayContaining(['not_covered', 'no_observation', 'tombstone'])
    );
  });

  it('proves timeout handling with a real stalled TCP transport and no mocked fetch', async () => {
    let stalledServer: Server | undefined;
    try {
      stalledServer = createServer(() => {
        // Intentionally accept the TCP connection and never write an HTTP response.
      });
      await new Promise<void>((resolve, reject) => {
        stalledServer!.once('error', reject);
        stalledServer!.listen(0, '127.0.0.1', resolve);
      });
      const address = stalledServer.address();
      if (!address || typeof address === 'string') throw new Error('Stalled transport did not bind.');
      const client = createDataEngineClient({
        dataEngineUrl: `http://127.0.0.1:${address.port}`,
        apiKey,
        timeoutMs: 25
      });

      await expect(
        client.contract({ requestId: 'mo-de-006-timeout-1', correlationId: 'mo-de-006-timeout-corr' })
      ).rejects.toMatchObject({
        code: 'DATA_ENGINE_UNAVAILABLE',
        retryable: true,
        factState: 'service_unavailable'
      });
    } finally {
      if (stalledServer)
        await new Promise<void>((resolve) => stalledServer!.close(() => resolve()));
    }
  });
});
