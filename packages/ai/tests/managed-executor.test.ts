import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  AI_PROVIDER_ADAPTER_PROTOCOL_VERSION,
  AiProviderRegistryV1,
  KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
  KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
  KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION,
  KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID,
  ManagedAiExecutorV1,
  ManagedAiImplementationRegistryV1,
  knowledgeDeepSeekImplementationProfileV1,
  type AiProviderAdapterV1,
  type AiProviderExecutionRequestV1,
  type AiProviderExecutionResultV1
} from '../src/index.js';

const managedInput = (taskInput: unknown = {
  schemaVersion: 1,
  kind: 'TEXT_GENERATION',
  prompt: 'Write a governed research memo.',
  systemInstruction: 'Return Markdown only.',
  outputFormat: 'MARKDOWN'
}) => ({
  schemaVersion: 1,
  processingClass: 'SOURCE_ACQUISITION',
  dataClassification: 'PUBLIC',
  taskInput,
  requestedOutput: {
    schemaId: KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID,
    format: 'MARKDOWN'
  },
  requirements: {
    capabilities: ['text-generation'],
    maxLatencyMs: 45_000,
    exactProviderOutputRequired: true,
    provenanceRequired: true
  },
  promptPolicy: {
    policyId: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
    policyVersion: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION
  },
  evidence: {
    exactOutput: 'REQUIRED',
    providerRequestId: 'REQUIRED_WHEN_AVAILABLE'
  }
});

const context = {
  executionId: 'aiexec_knowledge_1',
  correlationId: 'corr_knowledge_1'
};

function executorWith(
  result: AiProviderExecutionResultV1,
  captured: AiProviderExecutionRequestV1[] = []
): ManagedAiExecutorV1 {
  const adapter: AiProviderAdapterV1 = {
    implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
    provider: 'DEEPSEEK',
    execute: (request) => {
      captured.push(request);
      return Promise.resolve(result);
    }
  };
  const providers = new AiProviderRegistryV1([adapter]);
  const implementations = new ManagedAiImplementationRegistryV1([
    knowledgeDeepSeekImplementationProfileV1
  ]);
  const moments = [
    new Date('2026-08-25T02:40:00.000Z'),
    new Date('2026-08-25T02:40:00.125Z')
  ];
  return new ManagedAiExecutorV1(implementations, providers, {
    now: () => moments.shift() ?? new Date('2026-08-25T02:40:00.125Z')
  });
}

function success(raw: Uint8Array): AiProviderExecutionResultV1 {
  return {
    kind: 'SUCCESS',
    provider: 'DEEPSEEK',
    model: 'deepseek-v4-flash',
    deliveryState: 'PROVIDER_COMPLETED',
    retryDisposition: 'RETRY_FORBIDDEN',
    exactResponse: raw,
    providerRequestId: 'deepseek_request_1',
    structuredOutput: {
      text: '# Governed result',
      outputFormat: 'MARKDOWN'
    },
    usage: {
      inputUnits: 12,
      outputUnits: 7,
      cachedInputUnits: 3,
      latencyMs: 125
    }
  };
}

describe('Managed AI executor V1', () => {
  it('selects the trusted implementation profile and emits exact governed evidence', async () => {
    const raw = new TextEncoder().encode(
      JSON.stringify({ id: 'deepseek_request_1', choices: [{ message: { content: '# Governed result' } }] })
    );
    const captured: AiProviderExecutionRequestV1[] = [];
    const executor = executorWith(success(raw), captured);

    const outcome = await executor.execute(managedInput(), context);

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({
      protocolVersion: AI_PROVIDER_ADAPTER_PROTOCOL_VERSION,
      executionId: context.executionId,
      implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
      correlationId: context.correlationId,
      timeoutMs: 45_000,
      input: managedInput().taskInput
    });
    expect(outcome).toMatchObject({
      schemaVersion: 1,
      capabilityId: 'managed-ai-execution',
      capabilityVersion: '1.0.0',
      status: 'COMPLETED',
      deliveryState: 'PROVIDER_COMPLETED',
      retryDisposition: 'RETRY_FORBIDDEN',
      provenance: {
        implementationProfileId: knowledgeDeepSeekImplementationProfileV1.profileId,
        implementationProfileVersion: 1,
        implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
        provider: 'DEEPSEEK',
        model: 'deepseek-v4-flash',
        promptPolicyId: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
        promptPolicyVersion: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION,
        outputSchemaId: KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID,
        providerRequestId: 'deepseek_request_1',
        startedAt: '2026-08-25T02:40:00.000Z',
        completedAt: '2026-08-25T02:40:00.125Z'
      },
      structuredOutput: { text: '# Governed result', outputFormat: 'MARKDOWN' },
      usage: {
        inputUnits: 12,
        outputUnits: 7,
        cachedInputUnits: 3,
        latencyMs: 125,
        retryCount: 0,
        fallbackCount: 0
      },
      authority: {
        canonicalTruthCreated: false,
        capabilityCanonMutated: false,
        knowledgeApproved: false,
        brainConclusionCreated: false,
        professionalDecisionCreated: false,
        paymentCreated: false,
        filingSubmitted: false,
        externalMessageSent: false,
        externalProfessionalActionExecuted: false
      }
    });
    expect(outcome.exactOutput).toEqual({
      kind: 'INLINE_BASE64',
      mediaType: 'application/json',
      sha256: createHash('sha256').update(raw).digest('hex'),
      sizeBytes: raw.byteLength,
      dataBase64: Buffer.from(raw).toString('base64')
    });
    expect(outcome.provenance?.inputSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('never accepts provider/model/endpoint selection from the managed input', async () => {
    const providerExecute = vi.fn(() => Promise.resolve(success(new TextEncoder().encode('{}'))));
    const adapter: AiProviderAdapterV1 = {
      implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
      provider: 'DEEPSEEK',
      execute: providerExecute
    };
    const executor = new ManagedAiExecutorV1(
      new ManagedAiImplementationRegistryV1([knowledgeDeepSeekImplementationProfileV1]),
      new AiProviderRegistryV1([adapter])
    );

    const input = managedInput({
      ...managedInput().taskInput,
      provider: 'OPENAI',
      model: 'caller-model',
      endpoint: 'https://caller.invalid',
      credential: 'caller-secret'
    });
    const outcome = await executor.execute(input, context);

    expect(outcome).toMatchObject({
      status: 'FAILED',
      deliveryState: 'NOT_DELIVERED',
      retryDisposition: 'RETRY_FORBIDDEN',
      error: { code: 'INVALID_REQUEST' }
    });
    expect(providerExecute).toHaveBeenCalledTimes(1);
    expect(providerExecute.mock.calls[0]?.[0]).toMatchObject({
      implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY
    });
  });

  it('fails closed before provider execution when no trusted profile matches the policy', async () => {
    const providerExecute = vi.fn(() => Promise.resolve(success(new TextEncoder().encode('{}'))));
    const adapter: AiProviderAdapterV1 = {
      implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
      provider: 'DEEPSEEK',
      execute: providerExecute
    };
    const executor = new ManagedAiExecutorV1(
      new ManagedAiImplementationRegistryV1([knowledgeDeepSeekImplementationProfileV1]),
      new AiProviderRegistryV1([adapter])
    );
    const input = managedInput();
    input.promptPolicy.policyVersion = '999';

    await expect(executor.execute(input, context)).resolves.toMatchObject({
      status: 'BLOCKED',
      deliveryState: 'NOT_DELIVERED',
      retryDisposition: 'RETRY_FORBIDDEN',
      error: { code: 'POLICY_BLOCKED' }
    });
    expect(providerExecute).not.toHaveBeenCalled();
  });

  it('maps provider delivery uncertainty to reconciliation without retrying', async () => {
    const executor = executorWith({
      kind: 'FAILURE',
      provider: 'DEEPSEEK',
      model: 'deepseek-v4-flash',
      deliveryState: 'DELIVERY_UNCERTAIN',
      retryDisposition: 'RECONCILIATION_REQUIRED',
      error: { code: 'AI_HTTP_TIMEOUT', message: 'Timed out after dispatch.' }
    });

    await expect(executor.execute(managedInput(), context)).resolves.toMatchObject({
      status: 'REQUIRES_RECONCILIATION',
      deliveryState: 'DELIVERY_UNCERTAIN',
      retryDisposition: 'RECONCILIATION_REQUIRED',
      error: { code: 'TIMEOUT' },
      authority: {
        knowledgeApproved: false,
        professionalDecisionCreated: false,
        externalMessageSent: false
      }
    });
  });

  it('preserves safe retry only for proven non-delivery', async () => {
    const executor = executorWith({
      kind: 'FAILURE',
      provider: 'DEEPSEEK',
      model: 'deepseek-v4-flash',
      deliveryState: 'NOT_DELIVERED',
      retryDisposition: 'RETRY_ALLOWED',
      error: {
        code: 'AI_HTTP_NETWORK_ERROR',
        message: 'Connection failed before request delivery.'
      }
    });

    await expect(executor.execute(managedInput(), context)).resolves.toMatchObject({
      status: 'FAILED',
      deliveryState: 'NOT_DELIVERED',
      retryDisposition: 'RETRY_ALLOWED',
      error: { code: 'NETWORK_FAILURE_BEFORE_DELIVERY' }
    });
  });

  it('preserves delivered provider failure bytes and request identity', async () => {
    const raw = new TextEncoder().encode(
      JSON.stringify({ id: 'deepseek_503', error: { message: 'temporary' } })
    );
    const executor = executorWith({
      kind: 'FAILURE',
      provider: 'DEEPSEEK',
      model: 'deepseek-v4-flash',
      deliveryState: 'DELIVERED_CONFIRMED',
      retryDisposition: 'RETRY_ALLOWED',
      error: { code: 'AI_PROVIDER_TEMPORARY_FAILURE', message: 'DeepSeek returned HTTP 503.' },
      providerRequestId: 'deepseek_503',
      exactResponse: raw,
      usage: { latencyMs: 80 }
    });

    const outcome = await executor.execute(managedInput(), context);

    expect(outcome).toMatchObject({
      status: 'FAILED',
      deliveryState: 'DELIVERED_CONFIRMED',
      retryDisposition: 'RETRY_ALLOWED',
      provenance: { providerRequestId: 'deepseek_503' },
      error: { code: 'PROVIDER_INTERNAL_ERROR' },
      usage: { latencyMs: 80, retryCount: 0, fallbackCount: 0 }
    });
    expect(outcome.exactOutput).toMatchObject({
      kind: 'INLINE_BASE64',
      sha256: createHash('sha256').update(raw).digest('hex'),
      sizeBytes: raw.byteLength
    });
  });

  it('hashes semantically identical managed input deterministically despite object key order', async () => {
    const raw = new TextEncoder().encode('{}');
    const first = executorWith(success(raw));
    const second = executorWith(success(raw));
    const inputA = managedInput({ alpha: 1, beta: { x: true, y: 'two' } });
    const inputB = managedInput({ beta: { y: 'two', x: true }, alpha: 1 });

    const [a, b] = await Promise.all([
      first.execute(inputA, context),
      second.execute(inputB, context)
    ]);

    expect(a.provenance?.inputSha256).toBe(b.provenance?.inputSha256);
  });
});
