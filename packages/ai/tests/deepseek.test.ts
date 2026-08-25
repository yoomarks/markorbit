import { describe, expect, it, vi } from 'vitest';
import {
  AI_PROVIDER_ADAPTER_PROTOCOL_VERSION,
  AiHttpTransportError,
  DEEPSEEK_CANONICAL_ENDPOINT,
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_IMPLEMENTATION_KEY,
  DeepSeekProviderAdapterV1,
  isDeepSeekPeakPricingWindow,
  type AiHttpTransport,
  type AiProviderExecutionRequestV1
} from '../src/index.js';

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

const request = (
  input: AiProviderExecutionRequestV1['input'] = {
    schemaVersion: 1,
    kind: 'TEXT_GENERATION',
    prompt: 'Return a governed research note.',
    systemInstruction: 'Return Markdown only.',
    outputFormat: 'MARKDOWN'
  }
): AiProviderExecutionRequestV1 => ({
  protocolVersion: AI_PROVIDER_ADAPTER_PROTOCOL_VERSION,
  executionId: 'aiexec_deepseek_test',
  implementationKey: DEEPSEEK_IMPLEMENTATION_KEY,
  correlationId: 'corr_deepseek_test',
  timeoutMs: 30_000,
  input
});

const offPeakNow = () => new Date('2026-08-23T00:00:00.000Z');

function successTransport(): AiHttpTransport {
  return vi.fn(() =>
    Promise.resolve({
      status: 200,
      body: encode({
        id: 'deepseek_request_1',
        model: DEEPSEEK_DEFAULT_MODEL,
        choices: [{ message: { content: '# Governed result' } }],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 7,
          prompt_cache_hit_tokens: 3
        }
      })
    })
  );
}

describe('DeepSeek provider adapter V1', () => {
  it('keeps credentials runtime-only and preserves exact provider bytes', async () => {
    const transport = successTransport();
    const adapter = new DeepSeekProviderAdapterV1({
      environment: { DEEPSEEK_API_KEY: 'test-secret-never-persist' },
      transport,
      now: offPeakNow,
      clockMs: (() => {
        const values = [1000, 1125];
        return () => values.shift() ?? 1125;
      })()
    });

    const result = await adapter.execute(request());

    expect(transport).toHaveBeenCalledTimes(1);
    const expectedHeaders: unknown = expect.objectContaining({
      authorization: 'Bearer test-secret-never-persist'
    });
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        url: DEEPSEEK_CANONICAL_ENDPOINT,
        timeoutMs: 30_000,
        headers: expectedHeaders
      })
    );
    expect(result).toMatchObject({
      kind: 'SUCCESS',
      provider: 'DEEPSEEK',
      model: DEEPSEEK_DEFAULT_MODEL,
      deliveryState: 'PROVIDER_COMPLETED',
      retryDisposition: 'RETRY_FORBIDDEN',
      providerRequestId: 'deepseek_request_1',
      structuredOutput: { text: '# Governed result', outputFormat: 'MARKDOWN' },
      usage: { inputUnits: 12, outputUnits: 7, cachedInputUnits: 3, latencyMs: 125 }
    });
    if (result.kind === 'SUCCESS') {
      expect(new TextDecoder().decode(result.exactResponse)).toContain('deepseek_request_1');
      expect(JSON.stringify(result)).not.toContain('test-secret-never-persist');
    }
  });

  it('blocks before transport when the runtime credential is missing', async () => {
    const transport = successTransport();
    const adapter = new DeepSeekProviderAdapterV1({ environment: {}, transport, now: offPeakNow });

    await expect(adapter.execute(request())).resolves.toMatchObject({
      kind: 'FAILURE',
      deliveryState: 'NOT_DELIVERED',
      retryDisposition: 'RETRY_FORBIDDEN',
      error: { code: 'AI_PROVIDER_CREDENTIAL_MISSING' }
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it('preserves the governed DeepSeek off-peak policy before transport', async () => {
    const transport = successTransport();
    const adapter = new DeepSeekProviderAdapterV1({
      environment: { DEEPSEEK_API_KEY: 'test-secret' },
      transport,
      now: () => new Date('2026-08-24T01:00:00.000Z')
    });

    await expect(adapter.execute(request())).resolves.toMatchObject({
      kind: 'FAILURE',
      deliveryState: 'NOT_DELIVERED',
      retryDisposition: 'RETRY_ALLOWED',
      error: { code: 'AI_PROVIDER_PEAK_PRICING_WINDOW' }
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it('distinguishes rate limiting from temporary provider service failure', async () => {
    const cases = [
      [429, 'AI_PROVIDER_RATE_LIMITED'],
      [503, 'AI_PROVIDER_TEMPORARY_FAILURE']
    ] as const;

    for (const [status, errorCode] of cases) {
      const raw = encode({ id: `deepseek_${status}`, error: { message: 'temporary' } });
      const transport: AiHttpTransport = vi.fn(() => Promise.resolve({ status, body: raw }));
      const adapter = new DeepSeekProviderAdapterV1({
        environment: { DEEPSEEK_API_KEY: 'test-secret' },
        transport,
        now: offPeakNow
      });

      const result = await adapter.execute(request());

      expect(result).toMatchObject({
        kind: 'FAILURE',
        deliveryState: 'DELIVERED_CONFIRMED',
        retryDisposition: 'RETRY_ALLOWED',
        providerRequestId: `deepseek_${status}`,
        error: { code: errorCode }
      });
      if (result.kind === 'FAILURE') expect(result.exactResponse).toEqual(raw);
    }
  });

  it('classifies a non-retryable provider rejection as delivered confirmed', async () => {
    const transport: AiHttpTransport = vi.fn(() =>
      Promise.resolve({ status: 400, body: encode({ id: 'deepseek_400', error: 'bad request' }) })
    );
    const adapter = new DeepSeekProviderAdapterV1({
      environment: { DEEPSEEK_API_KEY: 'test-secret' },
      transport,
      now: offPeakNow
    });

    await expect(adapter.execute(request())).resolves.toMatchObject({
      kind: 'FAILURE',
      deliveryState: 'DELIVERED_CONFIRMED',
      retryDisposition: 'RETRY_FORBIDDEN',
      error: { code: 'AI_PROVIDER_REJECTED' }
    });
  });

  it('quarantines timeout/network uncertainty instead of treating it as safe retry', async () => {
    const transport: AiHttpTransport = vi.fn(() =>
      Promise.reject(
        new AiHttpTransportError(
          'AI_HTTP_TIMEOUT',
          'Timed out after dispatch.',
          'DELIVERY_UNCERTAIN'
        )
      )
    );
    const adapter = new DeepSeekProviderAdapterV1({
      environment: { DEEPSEEK_API_KEY: 'test-secret' },
      transport,
      now: offPeakNow
    });

    await expect(adapter.execute(request())).resolves.toMatchObject({
      kind: 'FAILURE',
      deliveryState: 'DELIVERY_UNCERTAIN',
      retryDisposition: 'RECONCILIATION_REQUIRED',
      error: { code: 'AI_HTTP_TIMEOUT' }
    });
  });

  it('allows retry only when transport can prove non-delivery', async () => {
    const transport: AiHttpTransport = vi.fn(() =>
      Promise.reject(
        new AiHttpTransportError(
          'AI_HTTP_NETWORK_ERROR',
          'Connection failed before dispatch.',
          'NOT_DELIVERED'
        )
      )
    );
    const adapter = new DeepSeekProviderAdapterV1({
      environment: { DEEPSEEK_API_KEY: 'test-secret' },
      transport,
      now: offPeakNow
    });

    await expect(adapter.execute(request())).resolves.toMatchObject({
      kind: 'FAILURE',
      deliveryState: 'NOT_DELIVERED',
      retryDisposition: 'RETRY_ALLOWED',
      error: { code: 'AI_HTTP_NETWORK_ERROR' }
    });
  });

  it('treats malformed successful provider responses as delivered but not completed', async () => {
    const raw = new TextEncoder().encode('{not-json');
    const transport: AiHttpTransport = vi.fn(() => Promise.resolve({ status: 200, body: raw }));
    const adapter = new DeepSeekProviderAdapterV1({
      environment: { DEEPSEEK_API_KEY: 'test-secret' },
      transport,
      now: offPeakNow
    });

    const result = await adapter.execute(request());

    expect(result).toMatchObject({
      kind: 'FAILURE',
      deliveryState: 'DELIVERED_CONFIRMED',
      retryDisposition: 'RETRY_FORBIDDEN',
      error: { code: 'AI_PROVIDER_RESPONSE_INVALID' }
    });
    if (result.kind === 'FAILURE') expect(result.exactResponse).toEqual(raw);
  });

  it('rejects provider/model/endpoint controls inside normalized provider input', async () => {
    const transport = successTransport();
    const adapter = new DeepSeekProviderAdapterV1({
      environment: { DEEPSEEK_API_KEY: 'test-secret' },
      transport,
      now: offPeakNow
    });

    for (const field of ['provider', 'model', 'endpoint', 'credential', 'apiKey', 'retryMode']) {
      const result = await adapter.execute(
        request({
          schemaVersion: 1,
          kind: 'TEXT_GENERATION',
          prompt: 'test',
          outputFormat: 'TEXT',
          [field]: 'caller-controlled'
        })
      );
      expect(result).toMatchObject({
        kind: 'FAILURE',
        deliveryState: 'NOT_DELIVERED',
        retryDisposition: 'RETRY_FORBIDDEN',
        error: { code: 'AI_PROVIDER_INPUT_INVALID' }
      });
    }
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('DeepSeek governed pricing window', () => {
  it('uses the frozen Beijing weekday peak windows and treats weekends as off-peak', () => {
    expect(isDeepSeekPeakPricingWindow(new Date('2026-08-24T01:00:00.000Z'))).toBe(true);
    expect(isDeepSeekPeakPricingWindow(new Date('2026-08-24T04:00:00.000Z'))).toBe(false);
    expect(isDeepSeekPeakPricingWindow(new Date('2026-08-24T06:00:00.000Z'))).toBe(true);
    expect(isDeepSeekPeakPricingWindow(new Date('2026-08-23T01:00:00.000Z'))).toBe(false);
  });
});
