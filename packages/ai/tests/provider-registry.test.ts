import { describe, expect, it, vi } from 'vitest';
import {
  AI_PROVIDER_ADAPTER_PROTOCOL_VERSION,
  AiGatewayBoundaryError,
  AiProviderRegistryV1,
  parseAiProviderExecutionRequestV1,
  type AiProviderAdapterV1,
} from '../src/index.js';

const request = () => ({
  protocolVersion: AI_PROVIDER_ADAPTER_PROTOCOL_VERSION,
  executionId: 'aiexec_test',
  implementationKey: 'ai:test-provider:v1',
  correlationId: 'corr_test',
  timeoutMs: 30_000,
  input: { prompt: 'test' },
});

function adapter(
  overrides: Partial<AiProviderAdapterV1> = {},
): AiProviderAdapterV1 {
  return {
    implementationKey: 'ai:test-provider:v1',
    provider: 'TEST_PROVIDER',
    execute: vi.fn(() =>
      Promise.resolve({
        kind: 'SUCCESS' as const,
        provider: 'TEST_PROVIDER',
        model: 'test-model-v1',
        deliveryState: 'PROVIDER_COMPLETED' as const,
        retryDisposition: 'RETRY_FORBIDDEN' as const,
        exactResponse: new Uint8Array([1, 2, 3]),
        providerRequestId: 'provider_request_test',
        structuredOutput: { ok: true },
        usage: { inputUnits: 10, outputUnits: 5, latencyMs: 100 },
      }),
    ),
    ...overrides,
  };
}

describe('AI Gateway provider boundary', () => {
  it('routes only through the trusted implementation key', async () => {
    const execute = vi.fn(() =>
      Promise.resolve({
        kind: 'SUCCESS' as const,
        provider: 'TEST_PROVIDER',
        model: 'test-model-v1',
        deliveryState: 'PROVIDER_COMPLETED' as const,
        retryDisposition: 'RETRY_FORBIDDEN' as const,
        exactResponse: new Uint8Array([4, 5, 6]),
      }),
    );
    const registry = new AiProviderRegistryV1([adapter({ execute })]);

    const result = await registry.execute(request());

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        implementationKey: 'ai:test-provider:v1',
        correlationId: 'corr_test',
      }),
    );
    expect(result.kind).toBe('SUCCESS');
    if (result.kind === 'SUCCESS') {
      expect([...result.exactResponse]).toEqual([4, 5, 6]);
    }
  });

  it.each(['provider', 'model', 'endpoint', 'credential', 'apiKey', 'retryMode'])(
    'rejects raw implementation-control field %s at the gateway request boundary',
    (field) => {
      expect(() =>
        parseAiProviderExecutionRequestV1({
          ...request(),
          [field]: 'caller-controlled',
        }),
      ).toThrow(AiGatewayBoundaryError);
    },
  );

  it('fails closed when an implementation key is not registered', async () => {
    const registry = new AiProviderRegistryV1([adapter()]);

    await expect(
      registry.execute({ ...request(), implementationKey: 'ai:missing:v1' }),
    ).rejects.toMatchObject({ code: 'AI_GATEWAY_IMPLEMENTATION_NOT_FOUND' });
  });

  it('rejects duplicate implementation registrations', () => {
    expect(() => new AiProviderRegistryV1([adapter(), adapter()])).toThrow(
      /Duplicate AI implementation key/u,
    );
  });

  it('returns only credential-free registry descriptors', () => {
    const registry = new AiProviderRegistryV1([adapter()]);

    expect(registry.describe()).toEqual([
      {
        protocolVersion: AI_PROVIDER_ADAPTER_PROTOCOL_VERSION,
        implementationKey: 'ai:test-provider:v1',
        provider: 'TEST_PROVIDER',
      },
    ]);
  });

  it('forces delivery uncertainty to reconciliation-required', async () => {
    const registry = new AiProviderRegistryV1([
      adapter({
        execute: vi.fn(() =>
          Promise.resolve({
            kind: 'FAILURE' as const,
            provider: 'TEST_PROVIDER',
            deliveryState: 'DELIVERY_UNCERTAIN' as const,
            retryDisposition: 'RETRY_ALLOWED' as const,
            error: { code: 'TIMEOUT', message: 'Delivery cannot be proven.' },
          }),
        ),
      }),
    ]);

    await expect(registry.execute(request())).rejects.toThrow(
      /must require reconciliation/u,
    );
  });

  it('rejects provider identity drift from an adapter result', async () => {
    const registry = new AiProviderRegistryV1([
      adapter({
        execute: vi.fn(() =>
          Promise.resolve({
            kind: 'SUCCESS' as const,
            provider: 'OTHER_PROVIDER',
            model: 'other-model',
            deliveryState: 'PROVIDER_COMPLETED' as const,
            retryDisposition: 'RETRY_FORBIDDEN' as const,
            exactResponse: new Uint8Array([1]),
          }),
        ),
      }),
    ]);

    await expect(registry.execute(request())).rejects.toMatchObject({
      code: 'AI_GATEWAY_ADAPTER_RESULT_INVALID',
    });
  });
});
