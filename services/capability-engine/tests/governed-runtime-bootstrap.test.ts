import { describe, expect, it, vi } from 'vitest';
import {
  KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
  KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
  KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION,
  KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID
} from '@markorbit/ai';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  managedAiNoAuthorityConsequences,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import {
  InMemoryManagedAiExecutionClaimStoreV1,
  InMemoryManagedAiExactOutputStoreV1
} from '../src/index.js';
import {
  createGovernedProductionRuntimeV1,
  MANAGED_AI_CAPABILITY_INPUT_SCHEMA_ID,
  MANAGED_AI_CAPABILITY_OUTPUT_SCHEMA_ID
} from '../src/governed-runtime-bootstrap.js';
import type { DurableImplementationProfileRegistryV1 } from '../src/implementation-profile-registry-postgres.js';

const internalServiceSecret = 's'.repeat(40);
const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_managed-ai',
  version: 1,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  title: 'Managed AI Execution',
  description: 'Governed provider-neutral AI execution.',
  lineage: { capabilityId: 'managed-ai-execution' },
  canonReference: {
    canonId: 'capability-foundation',
    canonVersion: '2026-08-25',
    sourceFingerprintSha256: 'a'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-08-25T01:00:00.000Z'
};

function profile(
  implementationKey: string = KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY
): ImplementationProfile {
  return {
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_managed-ai-knowledge',
    version: 1,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    kind: 'AI_ASSISTED_SERVICE',
    status: 'APPROVED',
    implementationKey,
    inputSchemaId: MANAGED_AI_CAPABILITY_INPUT_SCHEMA_ID,
    outputSchemaId: MANAGED_AI_CAPABILITY_OUTPUT_SCHEMA_ID,
    allowedCallerProducts: ['LITE'],
    maximumRiskClass: 'MODERATE',
    timeoutMs: 45_000,
    maxAttempts: 1,
    approvalPolicyVersion: 'implementation-admission.v1',
    createdAt: '2026-08-25T01:00:00.000Z'
  };
}

function registry(selected: ImplementationProfile): DurableImplementationProfileRegistryV1 {
  return {
    register: vi.fn((value: unknown) => Promise.resolve(value as ImplementationProfile)),
    findCurrent: vi.fn(() => Promise.resolve(selected)),
    findVersion: vi.fn(() => Promise.resolve(selected)),
    listCurrent: vi.fn(() => Promise.resolve([selected]))
  };
}

function managedInput() {
  return {
    schemaVersion: 1 as const,
    processingClass: 'SOURCE_ACQUISITION' as const,
    dataClassification: 'PUBLIC' as const,
    taskInput: { question: 'What changed?' },
    requestedOutput: {
      schemaId: KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID,
      format: 'MARKDOWN' as const
    },
    requirements: {
      capabilities: ['text-generation'],
      exactProviderOutputRequired: false,
      provenanceRequired: true
    },
    promptPolicy: {
      policyId: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
      policyVersion: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION
    },
    evidence: {
      exactOutput: 'OPTIONAL' as const,
      providerRequestId: 'OPTIONAL' as const
    }
  };
}

function outcome(
  implementationKey: string = KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY
): ManagedAiExecutionOutcomeV1 {
  return {
    schemaVersion: 1,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    status: 'COMPLETED',
    deliveryState: 'PROVIDER_COMPLETED',
    retryDisposition: 'RETRY_FORBIDDEN',
    provenance: {
      implementationProfileId: 'managed-ai:knowledge-deepseek:v1',
      implementationProfileVersion: 1,
      implementationKey,
      provider: 'DEEPSEEK',
      model: 'deepseek-chat',
      promptPolicyId: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
      promptPolicyVersion: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION,
      outputSchemaId: KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID,
      inputSha256: 'b'.repeat(64),
      startedAt: '2026-08-25T01:01:00.000Z',
      completedAt: '2026-08-25T01:01:01.000Z'
    },
    structuredOutput: { answer: 'governed result' },
    usage: { latencyMs: 10, inputUnits: 20, outputUnits: 5 },
    authority: managedAiNoAuthorityConsequences
  };
}

function command() {
  return {
    schemaVersion: 2 as const,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    caller: {
      workspaceId: 'workspace_test',
      principalId: 'principal_test',
      callerProduct: 'LITE',
      permissionContextRef: 'core-workspace-membership:membership_test'
    },
    purpose: 'Acquire one governed AI result.',
    input: managedInput(),
    inputSchemaId: MANAGED_AI_CAPABILITY_INPUT_SCHEMA_ID,
    outputSchemaId: MANAGED_AI_CAPABILITY_OUTPUT_SCHEMA_ID,
    riskClass: 'MODERATE' as const,
    idempotencyKey: 'wp07-governed-runtime-1',
    correlationId: 'correlation_wp07'
  };
}

function runtime(selected = profile(), returnedOutcome = outcome()) {
  const execute = vi.fn(() => Promise.resolve(returnedOutcome));
  const instance = createGovernedProductionRuntimeV1({
    definitions: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
    implementationProfiles: registry(selected),
    managedAiRuntime: {
      managedAiExecutor: { execute },
      managedAiClaimStore: new InMemoryManagedAiExecutionClaimStoreV1(),
      managedAiExactOutputStore: new InMemoryManagedAiExactOutputStoreV1()
    },
    internalServiceSecret
  });
  if (!instance) throw new Error('Expected governed production runtime.');
  return { instance, execute };
}

describe('MO-CAP-001 WP07 governed production runtime bootstrap', () => {
  it('stays disabled when the governed Managed AI execution closure is not authorized', () => {
    expect(
      createGovernedProductionRuntimeV1({
        definitions: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
        implementationProfiles: registry(profile()),
        managedAiRuntime: null,
        internalServiceSecret
      })
    ).toBeNull();
  });

  it('selects the durable approved profile and executes through the existing Managed AI claim path', async () => {
    const { instance, execute } = runtime();
    const first = await instance.invoke(command());
    const replay = await instance.invoke(command());

    expect(first.outcome).toMatchObject({
      status: 'SUCCEEDED',
      output: { status: 'COMPLETED', structuredOutput: { answer: 'governed result' } }
    });
    expect(first.binding.implementation).toMatchObject({
      implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
      kind: 'AI_ASSISTED_SERVICE'
    });
    expect(replay.replayed).toBe(true);
    expect(replay.receipt.sessionReceiptId).toBe(first.receipt.sessionReceiptId);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('fails closed before provider dispatch for unknown Capability input contracts', async () => {
    const { instance, execute } = runtime();
    await expect(
      instance.invoke({ ...command(), inputSchemaId: 'caller-owned-schema.v1' })
    ).rejects.toMatchObject({ code: 'INPUT_CONTRACT_INVALID' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not dispatch a durable profile whose implementation key is outside the production adapter set', async () => {
    const { instance, execute } = runtime(profile('ai:caller-selected:unsafe-v1'));

    await expect(instance.invoke(command())).rejects.toMatchObject({
      code: 'NO_APPROVED_IMPLEMENTATION',
      status: 409
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('fails the outer governed execution when Managed AI provenance drifts from the bound implementation', async () => {
    const { instance, execute } = runtime(profile(), outcome('ai:drifted:implementation-v1'));
    const result = await instance.invoke(command());

    expect(result.outcome).toMatchObject({
      status: 'FAILED',
      error: { code: 'IMPLEMENTATION_FAILED' }
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
