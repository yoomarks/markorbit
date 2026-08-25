import { describe, expect, it, vi } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  GovernedCapabilityRuntime,
  GovernedCapabilityRuntimeError,
  type CapabilityRuntimeIdFactory
} from '../src/capability-runtime.js';

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_managed-ai-execution',
  version: 3,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  title: 'Managed AI Execution',
  description: 'Provider-neutral governed AI execution capability.',
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

const profile: ImplementationProfile = {
  schemaVersion: 1,
  implementationProfileId: 'implementation-profile_deterministic-ai-fixture',
  version: 2,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  kind: 'DETERMINISTIC_SERVICE',
  status: 'APPROVED',
  implementationKey: 'capability-engine:test:deterministic-ai',
  inputSchemaId: 'managed-ai-input.v1',
  outputSchemaId: 'managed-ai-output.v1',
  allowedCallerProducts: ['KNOWLEDGE'],
  maximumRiskClass: 'MODERATE',
  timeoutMs: 1000,
  maxAttempts: 1,
  approvalPolicyVersion: 'capability-binding-policy.v1',
  createdAt: '2026-08-25T01:00:00.000Z'
};

const request = () => ({
  schemaVersion: 2 as const,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  caller: {
    workspaceId: 'workspace_test',
    principalId: 'principal_test',
    callerProduct: 'KNOWLEDGE',
    permissionContextRef: 'permission_context_test'
  },
  purpose: 'Acquire one governed AI source result.',
  input: { question: 'What changed?' },
  inputSchemaId: 'managed-ai-input.v1',
  outputSchemaId: 'managed-ai-output.v1',
  riskClass: 'MODERATE' as const,
  idempotencyKey: 'knowledge-ai-source-1',
  correlationId: 'correlation_test'
});

function ids(): CapabilityRuntimeIdFactory {
  return {
    capabilityRequest: () => 'capreq_test',
    implementationBinding: () => 'implementation-binding_test',
    capabilityInvocation: () => 'capability-invocation_test',
    capabilityOutcome: () => 'capability-outcome_test',
    capabilityReturn: () => 'capability-return_test',
    sessionReceipt: () => 'session-receipt_test'
  };
}

function runtime(options?: { outputValid?: boolean; allowedCallerProducts?: readonly string[] }) {
  const execute = vi.fn(() =>
    Promise.resolve({
      output: { answer: 'deterministic answer' },
      evidenceRefs: ['evidence_fixture_1'],
      usage: { latencyMs: 12 }
    })
  );
  const selectedProfile: ImplementationProfile = {
    ...profile,
    ...(options?.allowedCallerProducts
      ? { allowedCallerProducts: options.allowedCallerProducts }
      : {})
  };
  const instance = new GovernedCapabilityRuntime({
    definitions: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
    implementations: {
      select: vi.fn(() =>
        Promise.resolve({
          profile: selectedProfile,
          policyVersion: 'capability-binding-policy.v1'
        })
      )
    },
    inputContracts: { validate: vi.fn(() => true) },
    outputContracts: { validate: vi.fn(() => options?.outputValid ?? true) },
    executor: { execute },
    now: () => '2026-08-25T01:01:00.000Z',
    ids: ids()
  });
  return { instance, execute };
}

describe('MO-CAP-001 deterministic governed invocation core', () => {
  it('binds the exact accepted definition and approved profile before returning an outcome', async () => {
    const { instance, execute } = runtime();
    const result = await instance.invoke(request());

    expect(result.replayed).toBe(false);
    expect(result.eligibility).toMatchObject({ decision: 'ELIGIBLE', eligible: true });
    expect(result.binding.runtimeCapability).toEqual({
      id: definition.runtimeCapabilityDefinitionId,
      version: definition.version,
      capabilityId: definition.capabilityId,
      capabilityVersion: definition.capabilityVersion
    });
    expect(result.binding.implementation).toMatchObject({
      id: profile.implementationProfileId,
      version: profile.version,
      implementationKey: profile.implementationKey,
      kind: 'DETERMINISTIC_SERVICE'
    });
    expect(result.invocation).toMatchObject({ attempt: 1, status: 'COMPLETED', timeoutMs: 1000 });
    expect(result.outcome).toMatchObject({
      status: 'SUCCEEDED',
      output: { answer: 'deterministic answer' },
      evidenceRefs: ['evidence_fixture_1']
    });
    expect(result.returnValue.status).toBe('COMPLETED');
    expect(result.receipt.workspaceId).toBe('workspace_test');
    expect(result.receipt.principalId).toBe('principal_test');
    expect(Object.values(result.outcome.authority).every((value) => value === false)).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('replays the exact durable logical execution without a second implementation side effect', async () => {
    const { instance, execute } = runtime();
    const first = await instance.invoke(request());
    const replay = await instance.invoke(request());

    expect(replay.replayed).toBe(true);
    expect(replay.request.capabilityRequestId).toBe(first.request.capabilityRequestId);
    expect(replay.receipt.sessionReceiptId).toBe(first.receipt.sessionReceiptId);
    expect(replay.outcome.capabilityOutcomeId).toBe(first.outcome.capabilityOutcomeId);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects conflicting replay before a second implementation execution', async () => {
    const { instance, execute } = runtime();
    await instance.invoke(request());

    await expect(
      instance.invoke({
        ...request(),
        input: { question: 'Different input under the same key.' }
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('persists an output-contract failure as a non-retryable failed outcome', async () => {
    const { instance, execute } = runtime({ outputValid: false });
    const first = await instance.invoke(request());
    const replay = await instance.invoke(request());

    expect(first.outcome).toMatchObject({
      status: 'FAILED',
      error: { code: 'OUTPUT_CONTRACT_INVALID', retryable: false }
    });
    expect(first.returnValue.status).toBe('FAILED');
    expect(replay.replayed).toBe(true);
    expect(replay.outcome.capabilityOutcomeId).toBe(first.outcome.capabilityOutcomeId);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('fails closed when caller product is outside the approved implementation envelope', async () => {
    const { instance, execute } = runtime({ allowedCallerProducts: ['BRAIN'] });

    await expect(instance.invoke(request())).rejects.toBeInstanceOf(GovernedCapabilityRuntimeError);
    await expect(instance.invoke(request())).rejects.toMatchObject({ code: 'CALLER_NOT_ALLOWED' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects stale requested Capability versions before implementation execution', async () => {
    const { instance, execute } = runtime();

    await expect(
      instance.invoke({ ...request(), capabilityVersion: '0.9.0' })
    ).rejects.toMatchObject({ code: 'CAPABILITY_VERSION_MISMATCH' });
    expect(execute).not.toHaveBeenCalled();
  });
});
