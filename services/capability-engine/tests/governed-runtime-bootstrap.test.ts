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
import type { ManagedAiExecutionAuthorityV1 } from '../src/managed-ai-http.js';

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
  implementationKey: string = KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
  implementationProfileId: ImplementationProfile['implementationProfileId'] = 'implementation-profile_managed-ai-knowledge',
  status: ImplementationProfile['status'] = 'APPROVED'
): ImplementationProfile {
  return {
    schemaVersion: 1,
    implementationProfileId,
    version: 1,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    kind: 'AI_ASSISTED_SERVICE',
    status,
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

function registry(...selected: ImplementationProfile[]): DurableImplementationProfileRegistryV1 {
  return {
    register: vi.fn((value: unknown) => Promise.resolve(value as ImplementationProfile)),
    findCurrent: vi.fn((implementationProfileId: string) =>
      Promise.resolve(
        selected.find((item) => item.implementationProfileId === implementationProfileId)
      )
    ),
    findVersion: vi.fn((implementationProfileId: string, version: number) =>
      Promise.resolve(
        selected.find(
          (item) =>
            item.implementationProfileId === implementationProfileId && item.version === version
        )
      )
    ),
    listCurrent: vi.fn(() => Promise.resolve(selected))
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

function command(
  workspaceId = 'workspace_test',
  idempotencyKey = 'wp07-governed-runtime-1',
  correlationId = 'correlation_wp07'
) {
  return {
    schemaVersion: 2 as const,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    caller: {
      workspaceId,
      principalId: 'principal_test',
      callerProduct: 'LITE',
      permissionContextRef: 'core-workspace-membership:membership_test'
    },
    purpose: 'Acquire one governed AI result.',
    input: managedInput(),
    inputSchemaId: MANAGED_AI_CAPABILITY_INPUT_SCHEMA_ID,
    outputSchemaId: MANAGED_AI_CAPABILITY_OUTPUT_SCHEMA_ID,
    riskClass: 'MODERATE' as const,
    idempotencyKey,
    correlationId
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

  it('uses one stable Managed AI Capability with global fallback for Workspace A and an approved local implementation for Workspace B', async () => {
    const workspaceImplementationKey = 'ai:workspace-approved:chat-completions:v1';
    const defaultProfile = profile();
    const workspaceProfile = profile(
      workspaceImplementationKey,
      'implementation-profile_managed-ai-workspace'
    );
    const workspacePolicyVersion = 'workspace-implementation-preference.v1:test-proof';
    const workspacePreferences = {
      resolve: vi.fn((context: { workspaceId: string }) =>
        Promise.resolve(
          context.workspaceId === 'workspace_b'
            ? {
                policyVersion: workspacePolicyVersion,
                preferredImplementationKeys: [workspaceImplementationKey]
              }
            : undefined
        )
      )
    };
    const execute = vi.fn((...args: Parameters<ManagedAiExecutionAuthorityV1['execute']>) => {
      const executionContext = args[1];
      const implementationKey =
        executionContext.selectedImplementationKey ?? KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY;
      return Promise.resolve(outcome(implementationKey));
    });
    const instance = createGovernedProductionRuntimeV1({
      definitions: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
      implementationProfiles: registry(defaultProfile, workspaceProfile),
      workspaceImplementationPreferences: workspacePreferences,
      managedAiRuntime: {
        managedAiExecutor: { execute },
        managedAiClaimStore: new InMemoryManagedAiExecutionClaimStoreV1(),
        managedAiExactOutputStore: new InMemoryManagedAiExactOutputStoreV1()
      },
      internalServiceSecret
    });
    if (!instance) throw new Error('Expected governed production runtime.');

    const workspaceA = await instance.invoke(
      command('workspace_a', 'wp07-workspace-a-1', 'correlation_wp07_a')
    );
    const workspaceB = await instance.invoke(
      command('workspace_b', 'wp07-workspace-b-1', 'correlation_wp07_b')
    );

    expect(workspaceA.binding.runtimeCapability).toEqual(workspaceB.binding.runtimeCapability);
    expect(workspaceA.binding.implementation.implementationKey).toBe(
      KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY
    );
    expect(workspaceA.binding.selectionPolicyVersion).toBe('capability-managed-ai-selection.v1');
    expect(workspaceB.binding.implementation).toMatchObject({
      id: workspaceProfile.implementationProfileId,
      implementationKey: workspaceImplementationKey,
      kind: 'AI_ASSISTED_SERVICE'
    });
    expect(workspaceB.binding.selectionPolicyVersion).toBe(workspacePolicyVersion);
    expect(workspaceA.receipt.workspaceId).toBe('workspace_a');
    expect(workspaceB.receipt.workspaceId).toBe('workspace_b');
    expect(workspaceA.outcome.output).toMatchObject({
      provenance: { implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY }
    });
    expect(workspaceB.outcome.output).toMatchObject({
      provenance: { implementationKey: workspaceImplementationKey }
    });
    expect(execute.mock.calls.map((call) => call[1].selectedImplementationKey)).toEqual([
      KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
      workspaceImplementationKey
    ]);
    expect(workspacePreferences.resolve).toHaveBeenCalledTimes(2);
  });

  it('fails closed when a Workspace preference selects no approved eligible implementation', async () => {
    const execute = vi.fn(() => Promise.resolve(outcome()));
    const instance = createGovernedProductionRuntimeV1({
      definitions: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
      implementationProfiles: registry(profile()),
      workspaceImplementationPreferences: {
        resolve: vi.fn(() =>
          Promise.resolve({
            policyVersion: 'workspace-implementation-preference.v1:invalid',
            preferredImplementationKeys: ['ai:workspace-missing:v1']
          })
        )
      },
      managedAiRuntime: {
        managedAiExecutor: { execute },
        managedAiClaimStore: new InMemoryManagedAiExecutionClaimStoreV1(),
        managedAiExactOutputStore: new InMemoryManagedAiExactOutputStoreV1()
      },
      internalServiceSecret
    });
    if (!instance) throw new Error('Expected governed production runtime.');

    await expect(
      instance.invoke(
        command('workspace_b', 'wp07-workspace-b-invalid', 'correlation_wp07_invalid')
      )
    ).rejects.toMatchObject({ code: 'NO_APPROVED_IMPLEMENTATION', status: 409 });
    expect(execute).not.toHaveBeenCalled();
  });

  it('fails closed before provider dispatch for unknown Capability input contracts', async () => {
    const { instance, execute } = runtime();
    await expect(
      instance.invoke({ ...command(), inputSchemaId: 'caller-owned-schema.v1' })
    ).rejects.toMatchObject({ code: 'INPUT_CONTRACT_INVALID' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('fails closed when the global policy cannot select the only registered implementation key', async () => {
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
