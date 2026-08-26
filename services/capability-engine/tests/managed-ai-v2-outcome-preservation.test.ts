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
  runtimeCapabilityDefinitionId: 'runtime-capability_managed-ai-v2-preservation',
  version: 1,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  title: 'Managed AI Execution',
  description: 'Governed provider-neutral AI execution.',
  lineage: { capabilityId: 'managed-ai-execution' },
  canonReference: {
    canonId: 'capability-foundation',
    canonVersion: '2026-08-26',
    sourceFingerprintSha256: 'a'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-08-26T15:00:00.000Z'
};

const profile: ImplementationProfile = {
  schemaVersion: 1,
  implementationProfileId: 'implementation-profile_managed-ai-v2-preservation',
  version: 1,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  kind: 'AI_ASSISTED_SERVICE',
  status: 'APPROVED',
  implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
  inputSchemaId: MANAGED_AI_CAPABILITY_INPUT_SCHEMA_ID,
  outputSchemaId: MANAGED_AI_CAPABILITY_OUTPUT_SCHEMA_ID,
  allowedCallerProducts: ['KNOWLEDGE'],
  maximumRiskClass: 'MODERATE',
  timeoutMs: 45_000,
  maxAttempts: 1,
  approvalPolicyVersion: 'implementation-admission.v1',
  createdAt: '2026-08-26T15:00:00.000Z'
};

function registry(): DurableImplementationProfileRegistryV1 {
  return {
    register: vi.fn((value: unknown) => Promise.resolve(value as ImplementationProfile)),
    findCurrent: vi.fn(() => Promise.resolve(profile)),
    findVersion: vi.fn(() => Promise.resolve(profile)),
    listCurrent: vi.fn(() => Promise.resolve([profile]))
  };
}

function command(idempotencyKey: string) {
  return {
    schemaVersion: 2 as const,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    caller: {
      workspaceId: 'workspace_knowledge',
      principalId: 'principal_knowledge',
      callerProduct: 'KNOWLEDGE',
      permissionContextRef: 'core-workspace-membership:membership_knowledge'
    },
    purpose: 'Acquire one Knowledge source through governed Managed AI.',
    input: {
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
    },
    inputSchemaId: MANAGED_AI_CAPABILITY_INPUT_SCHEMA_ID,
    outputSchemaId: MANAGED_AI_CAPABILITY_OUTPUT_SCHEMA_ID,
    riskClass: 'MODERATE' as const,
    idempotencyKey,
    correlationId: `correlation_${idempotencyKey}`
  };
}

function runtime(returnedOutcome: ManagedAiExecutionOutcomeV1) {
  const execute = vi.fn(() => Promise.resolve(returnedOutcome));
  const instance = createGovernedProductionRuntimeV1({
    definitions: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
    implementationProfiles: registry(),
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

function failedOutcome(): ManagedAiExecutionOutcomeV1 {
  return {
    schemaVersion: 1,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    status: 'FAILED',
    deliveryState: 'NOT_DELIVERED',
    retryDisposition: 'RETRY_ALLOWED',
    error: { code: 'RATE_LIMITED', message: 'Provider rate limited the governed request.' },
    authority: managedAiNoAuthorityConsequences
  };
}

function blockedOutcome(): ManagedAiExecutionOutcomeV1 {
  return {
    schemaVersion: 1,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    status: 'BLOCKED',
    deliveryState: 'NOT_DELIVERED',
    retryDisposition: 'RETRY_FORBIDDEN',
    error: { code: 'AUTHENTICATION_FAILED', message: 'Provider credential is unavailable.' },
    authority: managedAiNoAuthorityConsequences
  };
}

describe('MO-CAP-002 Managed AI outcome preservation through Capability V2', () => {
  it.each([
    ['FAILED', failedOutcome()],
    ['BLOCKED', blockedOutcome()]
  ] as const)('preserves a valid %s outcome and fails closed at the Capability layer', async (_, managedOutcome) => {
    const { instance, execute } = runtime(managedOutcome);
    const request = command(`knowledge-v2-${managedOutcome.status.toLowerCase()}-1`);

    const first = await instance.invoke(request);
    const replay = await instance.invoke(request);

    expect(first.outcome.status).toBe('REQUIRES_REVIEW');
    expect(first.returnValue.status).toBe('REVIEW_REQUIRED');
    expect(first.returnValue.output).toEqual(managedOutcome);
    expect(first.outcome.output).toEqual(managedOutcome);
    expect(first.receipt.callerProduct).toBe('KNOWLEDGE');
    expect(first.receipt.authority.providerSelectionAuthorityGrantedToCaller).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.returnValue.output).toEqual(managedOutcome);
    expect(replay.receipt.sessionReceiptId).toBe(first.receipt.sessionReceiptId);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
