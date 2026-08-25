import { describe, expect, it, vi } from 'vitest';
import {
  DEEPSEEK_CANONICAL_ENDPOINT,
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_SECRET_ENV,
  type AiHttpTransportRequest
} from '@markorbit/ai';
import type { QueryClient } from '@markorbit/persistence';
import {
  MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED_ENV,
  MANAGED_AI_RUNTIME_ENABLED_ENV,
  createManagedAiRuntimeBindingsV1
} from '../src/managed-ai-bootstrap.js';
import {
  PostgresManagedAiExecutionClaimStoreV1,
  type ManagedAiExecutionClaimTransactionHostV1
} from '../src/managed-ai-execution-claim.js';
import { PostgresManagedAiExactOutputStoreV1 } from '../src/managed-ai-exact-output.js';

const input = {
  schemaVersion: 1,
  processingClass: 'SOURCE_ACQUISITION',
  dataClassification: 'PUBLIC',
  taskInput: {
    schemaVersion: 1,
    kind: 'TEXT_GENERATION',
    prompt: 'Summarize the grounded source pack.',
    systemInstruction: 'Return Markdown only.',
    outputFormat: 'MARKDOWN'
  },
  requestedOutput: {
    schemaId: 'knowledge.ai-distilled-markdown.v1',
    format: 'MARKDOWN'
  },
  requirements: {
    capabilities: ['text-generation'],
    maxLatencyMs: 45_000,
    exactProviderOutputRequired: true,
    provenanceRequired: true
  },
  promptPolicy: {
    policyId: 'knowledge.ai-distillation',
    policyVersion: '1'
  },
  evidence: {
    exactOutput: 'REQUIRED',
    providerRequestId: 'REQUIRED_WHEN_AVAILABLE'
  }
} as const;

function persistence() {
  const query = {
    query: vi.fn()
  } as unknown as QueryClient;
  const database: ManagedAiExecutionClaimTransactionHostV1 = {
    transact: async <T>(callback: (client: QueryClient) => Promise<T>) => callback(query)
  };
  return { database, query };
}

function enabledEnvironment(
  secret = 'deepseek-test-secret-not-a-real-credential'
): NodeJS.ProcessEnv {
  return {
    [MANAGED_AI_RUNTIME_ENABLED_ENV]: '1',
    [MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED_ENV]: '1',
    [DEEPSEEK_SECRET_ENV]: secret
  };
}

describe('Managed AI server bootstrap', () => {
  it('keeps Managed AI absent by default', () => {
    const { database, query } = persistence();
    expect(createManagedAiRuntimeBindingsV1({ environment: {}, database, query })).toBeNull();
  });

  it.each([
    [
      { [MANAGED_AI_RUNTIME_ENABLED_ENV]: '1' },
      `${MANAGED_AI_RUNTIME_ENABLED_ENV}=1 requires ${MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED_ENV}=1.`
    ],
    [
      { [MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED_ENV]: '1' },
      `${MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED_ENV}=1 requires ${MANAGED_AI_RUNTIME_ENABLED_ENV}=1.`
    ],
    [
      {
        [MANAGED_AI_RUNTIME_ENABLED_ENV]: '1',
        [MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED_ENV]: '1'
      },
      `${DEEPSEEK_SECRET_ENV} is required when governed Managed AI provider dispatch is authorized.`
    ],
    [
      {
        [MANAGED_AI_RUNTIME_ENABLED_ENV]: 'true',
        [MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED_ENV]: '1',
        [DEEPSEEK_SECRET_ENV]: 'not-real'
      },
      `${MANAGED_AI_RUNTIME_ENABLED_ENV} must be exactly '0' or '1' when configured.`
    ]
  ])('fails closed for inconsistent runtime authorization %#', (environment, message) => {
    const { database, query } = persistence();
    expect(() => createManagedAiRuntimeBindingsV1({ environment, database, query })).toThrow(
      message
    );
  });

  it('composes only the trusted DeepSeek implementation through an injected no-network transport', async () => {
    const { database, query } = persistence();
    const raw = new TextEncoder().encode(
      JSON.stringify({
        id: 'deepseek-request-1',
        model: DEEPSEEK_DEFAULT_MODEL,
        choices: [{ message: { content: '# Grounded result' } }],
        usage: { prompt_tokens: 11, completion_tokens: 7 }
      })
    );
    let capturedRequest: Readonly<AiHttpTransportRequest> | undefined;
    const transportSpy = vi.fn((request: Readonly<AiHttpTransportRequest>) => {
      capturedRequest = request;
      return Promise.resolve({ status: 200, body: raw });
    });
    const bindings = createManagedAiRuntimeBindingsV1({
      environment: enabledEnvironment(),
      database,
      query,
      deepSeekTransport: transportSpy,
      now: () => new Date('2026-08-23T00:00:00.000Z')
    });

    expect(bindings).not.toBeNull();
    expect(bindings!.managedAiClaimStore).toBeInstanceOf(PostgresManagedAiExecutionClaimStoreV1);
    expect(bindings!.managedAiExactOutputStore).toBeInstanceOf(PostgresManagedAiExactOutputStoreV1);
    const outcome = await bindings!.managedAiExecutor.execute(input, {
      executionId: 'maiexec_0123456789abcdef0123456789abcdef',
      correlationId: 'knowledge_assignment_1'
    });

    expect(transportSpy).toHaveBeenCalledTimes(1);
    if (!capturedRequest)
      throw new Error('Expected the governed DeepSeek transport to be invoked.');
    expect(capturedRequest.url).toBe(DEEPSEEK_CANONICAL_ENDPOINT);
    expect(capturedRequest.headers.authorization).toBe(
      'Bearer deepseek-test-secret-not-a-real-credential'
    );
    expect(JSON.parse(capturedRequest.body)).toMatchObject({
      model: DEEPSEEK_DEFAULT_MODEL,
      stream: false
    });
    expect(outcome).toMatchObject({
      status: 'COMPLETED',
      deliveryState: 'PROVIDER_COMPLETED',
      provenance: {
        provider: 'DEEPSEEK',
        model: DEEPSEEK_DEFAULT_MODEL,
        implementationKey: 'ai:deepseek:chat-completions:v1',
        providerRequestId: 'deepseek-request-1'
      },
      exactOutput: {
        kind: 'INLINE_BASE64',
        sizeBytes: raw.byteLength,
        dataBase64: Buffer.from(raw).toString('base64')
      }
    });
  });

  it('preserves the governed off-peak dispatch policy before transport access', async () => {
    const { database, query } = persistence();
    const transportSpy = vi.fn(() =>
      Promise.reject(new Error('transport must not be called during governed peak window'))
    );
    const bindings = createManagedAiRuntimeBindingsV1({
      environment: enabledEnvironment(),
      database,
      query,
      deepSeekTransport: transportSpy,
      now: () => new Date('2026-08-25T02:00:00.000Z')
    });

    const outcome = await bindings!.managedAiExecutor.execute(input, {
      executionId: 'maiexec_fedcba9876543210fedcba9876543210',
      correlationId: 'knowledge_assignment_peak_window'
    });

    expect(transportSpy).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      status: 'BLOCKED',
      deliveryState: 'NOT_DELIVERED',
      error: { code: 'POLICY_BLOCKED' }
    });
  });
});
