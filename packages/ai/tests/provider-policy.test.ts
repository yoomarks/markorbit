import { describe, expect, it } from 'vitest';
import {
  AiProviderRegistryV1,
  KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
  KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
  KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION,
  KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID,
  ManagedAiExecutorV1,
  ManagedAiImplementationRegistryV1,
  deriveAiProviderFollowupPolicyV1,
  knowledgeDeepSeekImplementationProfileV1,
  type AiProviderAdapterV1,
  type AiProviderExecutionFailureV1,
  type AiProviderExecutionResultV1
} from '../src/index.js';

function failure(
  errorCode: string,
  deliveryState: AiProviderExecutionFailureV1['deliveryState'] = 'DELIVERED_CONFIRMED',
  retryDisposition: AiProviderExecutionFailureV1['retryDisposition'] = 'RETRY_ALLOWED'
): AiProviderExecutionFailureV1 {
  return {
    kind: 'FAILURE',
    provider: 'DEEPSEEK',
    model: 'deepseek-v4-flash',
    deliveryState,
    retryDisposition,
    error: { code: errorCode, message: errorCode }
  };
}

const managedInput = {
  schemaVersion: 1,
  processingClass: 'SOURCE_ACQUISITION',
  dataClassification: 'PUBLIC',
  taskInput: {
    schemaVersion: 1,
    kind: 'TEXT_GENERATION',
    prompt: 'Write a governed research memo.',
    outputFormat: 'MARKDOWN'
  },
  requestedOutput: {
    schemaId: KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID,
    format: 'MARKDOWN'
  },
  requirements: {
    capabilities: ['text-generation'],
    exactProviderOutputRequired: true,
    provenanceRequired: true
  },
  promptPolicy: {
    policyId: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
    policyVersion: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION
  },
  evidence: {
    exactOutput: 'REQUIRED',
    providerRequestId: 'OPTIONAL'
  }
} as const;

describe('provider follow-up policy V1', () => {
  it('keeps rate limits and temporary service failures distinct while requiring budget recheck', () => {
    expect(deriveAiProviderFollowupPolicyV1(failure('AI_PROVIDER_RATE_LIMITED'))).toEqual({
      reason: 'RATE_LIMITED',
      retryCandidate: true,
      fallbackCandidate: true,
      budgetCheckRequired: true,
      reconciliationRequired: false
    });
    expect(deriveAiProviderFollowupPolicyV1(failure('AI_PROVIDER_TEMPORARY_FAILURE'))).toEqual({
      reason: 'TEMPORARY_SERVICE',
      retryCandidate: true,
      fallbackCandidate: true,
      budgetCheckRequired: true,
      reconciliationRequired: false
    });
  });

  it('never exposes retry or fallback candidates for delivery uncertainty', () => {
    expect(
      deriveAiProviderFollowupPolicyV1(
        failure('AI_HTTP_TIMEOUT', 'DELIVERY_UNCERTAIN', 'RECONCILIATION_REQUIRED')
      )
    ).toEqual({
      reason: 'RECONCILIATION_REQUIRED',
      retryCandidate: false,
      fallbackCandidate: false,
      budgetCheckRequired: false,
      reconciliationRequired: true
    });
  });

  it('treats candidate follow-up as policy input rather than automatic execution authority', () => {
    expect(
      deriveAiProviderFollowupPolicyV1(
        failure('AI_HTTP_NETWORK_ERROR', 'NOT_DELIVERED', 'RETRY_ALLOWED')
      )
    ).toEqual({
      reason: 'NOT_DELIVERED',
      retryCandidate: true,
      fallbackCandidate: true,
      budgetCheckRequired: true,
      reconciliationRequired: false
    });
    expect(
      deriveAiProviderFollowupPolicyV1(
        failure('AI_PROVIDER_REJECTED', 'DELIVERED_CONFIRMED', 'RETRY_FORBIDDEN')
      )
    ).toEqual({
      reason: 'NONE',
      retryCandidate: false,
      fallbackCandidate: false,
      budgetCheckRequired: false,
      reconciliationRequired: false
    });
  });
});

describe('Managed AI rate-limit mapping', () => {
  it('preserves provider rate limiting as the existing RATE_LIMITED capability error', async () => {
    const result: AiProviderExecutionResultV1 = failure('AI_PROVIDER_RATE_LIMITED');
    const adapter: AiProviderAdapterV1 = {
      implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
      provider: 'DEEPSEEK',
      execute: () => Promise.resolve(result)
    };
    const executor = new ManagedAiExecutorV1(
      new ManagedAiImplementationRegistryV1([knowledgeDeepSeekImplementationProfileV1]),
      new AiProviderRegistryV1([adapter]),
      { now: () => new Date('2026-08-25T00:00:00.000Z') }
    );

    await expect(
      executor.execute(managedInput, {
        executionId: 'aiexec_rate_limit',
        correlationId: 'corr_rate_limit'
      })
    ).resolves.toMatchObject({
      status: 'FAILED',
      deliveryState: 'DELIVERED_CONFIRMED',
      retryDisposition: 'RETRY_ALLOWED',
      error: { code: 'RATE_LIMITED' }
    });
  });
});
