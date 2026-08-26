import { describe, expect, it, vi } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  GovernedCapabilityRuntime,
  type CapabilityRuntimeExecution
} from '../src/capability-runtime.js';
import { InMemoryCapabilityRuntimeReplayStoreV1 } from '../src/capability-runtime-replay-store.js';
import { DurableGovernedCapabilityRuntimeV1 } from '../src/durable-governed-capability-runtime.js';

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_replay-test',
  version: 1,
  capabilityId: 'replay-capability',
  capabilityVersion: '1.0.0',
  title: 'Replay Capability',
  description: 'Test-only governed Capability for durable replay conformance.',
  lineage: { capabilityId: 'replay-capability' },
  canonReference: {
    canonId: 'capability-replay-test',
    canonVersion: '1',
    sourceFingerprintSha256: 'a'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-08-26T01:00:00.000Z'
};

const profile: ImplementationProfile = {
  schemaVersion: 1,
  implementationProfileId: 'implementation-profile_replay-test',
  version: 1,
  capabilityId: 'replay-capability',
  capabilityVersion: '1.0.0',
  kind: 'DETERMINISTIC_SERVICE',
  status: 'APPROVED',
  implementationKey: 'capability-engine:test:durable-replay',
  inputSchemaId: 'replay-input.v1',
  outputSchemaId: 'replay-output.v1',
  allowedCallerProducts: ['LITE'],
  maximumRiskClass: 'MODERATE',
  timeoutMs: 2_000,
  maxAttempts: 1,
  approvalPolicyVersion: 'replay-policy.v1',
  createdAt: '2026-08-26T01:00:00.000Z'
};

function command(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    capabilityId: 'replay-capability',
    capabilityVersion: '1.0.0',
    caller: {
      workspaceId: 'workspace_replay',
      principalId: 'principal_replay',
      callerProduct: 'LITE',
      permissionContextRef: 'permission_replay'
    },
    purpose: 'Exercise restart-safe governed replay.',
    input: { question: 'What changed?' },
    inputSchemaId: 'replay-input.v1',
    outputSchemaId: 'replay-output.v1',
    riskClass: 'MODERATE',
    idempotencyKey: 'durable-replay-1',
    correlationId: 'correlation_durable_replay',
    ...overrides
  };
}

function governedIds(execution: CapabilityRuntimeExecution) {
  return {
    capabilityRequestId: execution.request.capabilityRequestId,
    implementationBindingId: execution.binding.implementationBindingId,
    capabilityInvocationId: execution.invocation.capabilityInvocationId,
    capabilityOutcomeId: execution.outcome.capabilityOutcomeId,
    capabilityReturnId: execution.returnValue.capabilityReturnId,
    sessionReceiptId: execution.receipt.sessionReceiptId
  };
}

function expectNoAuthority(execution: CapabilityRuntimeExecution) {
  for (const authority of [
    execution.outcome.authority,
    execution.returnValue.authority,
    execution.receipt.authority
  ]) {
    expect(Object.values(authority).every((value) => value === false)).toBe(true);
  }
}

function runtime(
  replayStore: InMemoryCapabilityRuntimeReplayStoreV1,
  execute: ReturnType<typeof vi.fn>,
  outputValid = true
) {
  const base = new GovernedCapabilityRuntime({
    definitions: { findCurrent: () => Promise.resolve(definition) },
    implementations: {
      select: () => Promise.resolve({ profile, policyVersion: 'replay-policy.v1' })
    },
    inputContracts: { validate: () => true },
    outputContracts: { validate: () => outputValid },
    executor: { execute },
    now: () => '2026-08-26T01:01:00.000Z'
  });
  return new DurableGovernedCapabilityRuntimeV1({
    runtime: base,
    replayStore,
    now: () => '2026-08-26T01:01:00.000Z',
    waitTimeoutMs: 2_000
  });
}

describe('MO-CAP-001 WP07B durable governed replay coordinator', () => {
  it('preserves every governed identifier and performs no second execution after runtime reconstruction', async () => {
    const replayStore = new InMemoryCapabilityRuntimeReplayStoreV1();
    const execute = vi.fn(async () => ({ output: { answer: 'durable result' } }));

    const first = await runtime(replayStore, execute).invoke(command());
    const afterRestart = await runtime(replayStore, execute).invoke(command());

    expect(first.replayed).toBe(false);
    expect(afterRestart.replayed).toBe(true);
    expect(governedIds(afterRestart)).toEqual(governedIds(first));
    expect(afterRestart.outcome).toEqual(first.outcome);
    expect(afterRestart.returnValue).toEqual(first.returnValue);
    expect(afterRestart.receipt).toEqual(first.receipt);
    expect(execute).toHaveBeenCalledTimes(1);
    expectNoAuthority(afterRestart);
  });

  it('fails closed for conflicting reuse after restart without executing again', async () => {
    const replayStore = new InMemoryCapabilityRuntimeReplayStoreV1();
    const execute = vi.fn(async () => ({ output: { answer: 'durable result' } }));
    await runtime(replayStore, execute).invoke(command());

    await expect(
      runtime(replayStore, execute).invoke(
        command({ input: { question: 'Conflicting request under the same key.' } })
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('coordinates concurrent same-key requests across independent runtime instances into one execution', async () => {
    const replayStore = new InMemoryCapabilityRuntimeReplayStoreV1();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const execute = vi.fn(async () => {
      await gate;
      return { output: { answer: 'concurrent durable result' } };
    });
    const leftRuntime = runtime(replayStore, execute);
    const rightRuntime = runtime(replayStore, execute);

    const left = leftRuntime.invoke(command());
    while (execute.mock.calls.length === 0) await new Promise((resolve) => setTimeout(resolve, 1));
    const right = rightRuntime.invoke(command());
    release();

    const [first, replayed] = await Promise.all([left, right]);
    expect(first.replayed).toBe(false);
    expect(replayed.replayed).toBe(true);
    expect(governedIds(replayed)).toEqual(governedIds(first));
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('replays output-contract failure as the original governed failure rather than promoting success', async () => {
    const replayStore = new InMemoryCapabilityRuntimeReplayStoreV1();
    const execute = vi.fn(async () => ({ output: { invalid: true } }));

    const first = await runtime(replayStore, execute, false).invoke(command());
    const afterRestart = await runtime(replayStore, execute, true).invoke(command());

    expect(first.outcome).toMatchObject({
      status: 'FAILED',
      error: { code: 'OUTPUT_CONTRACT_INVALID', retryable: false }
    });
    expect(first.returnValue.status).toBe('FAILED');
    expect(afterRestart.outcome).toEqual(first.outcome);
    expect(afterRestart.returnValue).toEqual(first.returnValue);
    expect(afterRestart.replayed).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    expectNoAuthority(afterRestart);
  });

  it('keeps the immutable durable replay isolated from caller mutation of a returned clone', async () => {
    const replayStore = new InMemoryCapabilityRuntimeReplayStoreV1();
    const execute = vi.fn(async () => ({ output: { answer: 'immutable result' } }));

    const first = await runtime(replayStore, execute).invoke(command());
    (first.returnValue.output as { answer: string }).answer = 'caller-mutated';
    const afterRestart = await runtime(replayStore, execute).invoke(command());

    expect(afterRestart.returnValue.output).toEqual({ answer: 'immutable result' });
    expect(afterRestart.replayed).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
