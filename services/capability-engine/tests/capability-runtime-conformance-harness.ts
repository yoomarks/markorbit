import { describe, expect, it } from 'vitest';
import type { CapabilityRuntimeExecution } from '../src/capability-runtime.js';

export type CapabilityRuntimeConformanceMode =
  | 'DEFAULT'
  | 'INVALID_OUTPUT'
  | 'EXECUTOR_FAILURE'
  | 'CALLER_FORBIDDEN'
  | 'RISK_FORBIDDEN'
  | 'SCHEMA_MISMATCH'
  | 'STALE_DEFINITION'
  | 'STALE_PROFILE'
  | 'RETIRED_PROFILE'
  | 'INCOMPATIBLE_IMPLEMENTATION_KIND'
  | 'MISSING_IMPLEMENTATION';

export interface CapabilityRuntimeConformanceCommandOverrides {
  capabilityVersion?: string;
  input?: unknown;
  extraFields?: Readonly<Record<string, unknown>>;
}

export interface CapabilityRuntimeConformanceFixture {
  invoke(command: unknown): Promise<CapabilityRuntimeExecution>;
  executionCount(): number;
  selectionCount(): number;
}

export interface CapabilityRuntimeConformanceAdapter {
  create(mode?: CapabilityRuntimeConformanceMode): CapabilityRuntimeConformanceFixture;
  command(overrides?: Readonly<CapabilityRuntimeConformanceCommandOverrides>): unknown;
}

export const capabilityRuntimeBindingFailureGoldenCases = [
  ['STALE_DEFINITION', 'CAPABILITY_VERSION_MISMATCH', 0],
  ['STALE_PROFILE', 'CAPABILITY_VERSION_MISMATCH', 0],
  ['RETIRED_PROFILE', 'NO_APPROVED_IMPLEMENTATION', 0],
  ['INCOMPATIBLE_IMPLEMENTATION_KIND', 'IMPLEMENTATION_NOT_ADMITTED', 0],
  ['MISSING_IMPLEMENTATION', 'NO_APPROVED_IMPLEMENTATION', 0],
  ['CALLER_FORBIDDEN', 'CALLER_NOT_ALLOWED', 0],
  ['RISK_FORBIDDEN', 'RISK_NOT_ALLOWED', 0],
  ['SCHEMA_MISMATCH', 'SCHEMA_MISMATCH', 0]
] as const;

export const capabilityRuntimeForbiddenControlGoldenCases = [
  ['provider', 'provider-a'],
  ['providerId', 'provider-a'],
  ['model', 'model-a'],
  ['modelId', 'model-a'],
  ['implementation', 'implementation-profile_other'],
  ['implementationKey', 'service:other'],
  ['implementationProfileId', 'implementation-profile_other']
] as const;

function governedIdentifiers(execution: CapabilityRuntimeExecution) {
  return {
    capabilityRequestId: execution.request.capabilityRequestId,
    implementationBindingId: execution.binding.implementationBindingId,
    capabilityInvocationId: execution.invocation.capabilityInvocationId,
    capabilityOutcomeId: execution.outcome.capabilityOutcomeId,
    capabilityReturnId: execution.returnValue.capabilityReturnId,
    sessionReceiptId: execution.receipt.sessionReceiptId,
    runtimeCapability: execution.binding.runtimeCapability,
    implementation: execution.binding.implementation
  };
}

function expectNoAuthority(execution: CapabilityRuntimeExecution): void {
  for (const authority of [
    execution.outcome.authority,
    execution.returnValue.authority,
    execution.receipt.authority
  ]) {
    expect(Object.values(authority).every((value) => value === false)).toBe(true);
  }
}

export function registerCapabilityRuntimeConformanceSuite(
  name: string,
  adapter: Readonly<CapabilityRuntimeConformanceAdapter>
): void {
  describe(name, () => {
    it('replays an exact completed request with every original governed identifier and no second execution', async () => {
      const fixture = adapter.create();
      const command = adapter.command();

      const first = await fixture.invoke(command);
      const replay = await fixture.invoke(command);

      expect(first.replayed).toBe(false);
      expect(replay.replayed).toBe(true);
      expect(governedIdentifiers(replay)).toEqual(governedIdentifiers(first));
      expect(replay.outcome).toEqual(first.outcome);
      expect(replay.returnValue).toEqual(first.returnValue);
      expect(replay.receipt).toEqual(first.receipt);
      expect(fixture.executionCount()).toBe(1);
      expect(fixture.selectionCount()).toBe(1);
    });

    it('deduplicates identical concurrent requests into one deterministic governed execution', async () => {
      const fixture = adapter.create();
      const command = adapter.command();

      const [left, right] = await Promise.all([fixture.invoke(command), fixture.invoke(command)]);

      expect([left.replayed, right.replayed].sort()).toEqual([false, true]);
      expect(governedIdentifiers(left)).toEqual(governedIdentifiers(right));
      expect(left.outcome).toEqual(right.outcome);
      expect(left.returnValue).toEqual(right.returnValue);
      expect(fixture.executionCount()).toBe(1);
      expect(fixture.selectionCount()).toBe(1);
      expectNoAuthority(left);
      expectNoAuthority(right);
    });

    it('rejects a conflicting in-flight idempotency reuse before selection or second execution', async () => {
      const fixture = adapter.create();
      const first = fixture.invoke(adapter.command());
      const conflicting = fixture.invoke(
        adapter.command({
          input: { question: 'Conflicting input under the same idempotency key.' }
        })
      );

      await expect(conflicting).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      await expect(first).resolves.toMatchObject({ replayed: false });
      expect(fixture.executionCount()).toBe(1);
      expect(fixture.selectionCount()).toBe(1);
    });

    it('rejects conflicting reuse after completion without re-selecting or re-executing', async () => {
      const fixture = adapter.create();
      await fixture.invoke(adapter.command());

      await expect(
        fixture.invoke(
          adapter.command({
            input: { question: 'Different completed replay payload.' }
          })
        )
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expect(fixture.executionCount()).toBe(1);
      expect(fixture.selectionCount()).toBe(1);
    });

    it('keeps the stored replay immutable from mutations to a previous returned clone', async () => {
      const fixture = adapter.create();
      const command = adapter.command();
      const first = await fixture.invoke(command);
      const firstOutput = first.returnValue.output as { answer: string };
      firstOutput.answer = 'caller-mutated-output';

      const replay = await fixture.invoke(command);

      expect(replay.returnValue.output).toEqual({ answer: 'conformant deterministic output' });
      expect(replay.replayed).toBe(true);
      expect(fixture.executionCount()).toBe(1);
    });

    it('persists invalid output as a non-retryable governed failure and never promotes it to success', async () => {
      const fixture = adapter.create('INVALID_OUTPUT');
      const command = adapter.command();

      const first = await fixture.invoke(command);
      const replay = await fixture.invoke(command);

      expect(first.invocation.status).toBe('COMPLETED');
      expect(first.outcome).toMatchObject({
        status: 'FAILED',
        error: { code: 'OUTPUT_CONTRACT_INVALID', retryable: false }
      });
      expect(first.outcome.output).toBeUndefined();
      expect(first.returnValue.status).toBe('FAILED');
      expect(first.returnValue.output).toBeUndefined();
      expect(governedIdentifiers(replay)).toEqual(governedIdentifiers(first));
      expect(fixture.executionCount()).toBe(1);
      expectNoAuthority(first);
    });

    it('turns implementation exceptions into non-retryable governed outcomes with stable replay', async () => {
      const fixture = adapter.create('EXECUTOR_FAILURE');
      const command = adapter.command();

      const first = await fixture.invoke(command);
      const replay = await fixture.invoke(command);

      expect(first.invocation.status).toBe('FAILED');
      expect(first.outcome).toMatchObject({
        status: 'FAILED',
        error: { code: 'IMPLEMENTATION_FAILED', retryable: false }
      });
      expect(replay.replayed).toBe(true);
      expect(governedIdentifiers(replay)).toEqual(governedIdentifiers(first));
      expect(fixture.executionCount()).toBe(1);
      expectNoAuthority(first);
    });

    it.each(capabilityRuntimeBindingFailureGoldenCases)(
      'fails closed for %s before implementation execution',
      async (mode, errorCode, expectedExecutions) => {
        const fixture = adapter.create(mode);

        await expect(fixture.invoke(adapter.command())).rejects.toMatchObject({ code: errorCode });
        expect(fixture.executionCount()).toBe(expectedExecutions);
      }
    );

    it('rejects a stale requested Capability version before implementation selection', async () => {
      const fixture = adapter.create();

      await expect(
        fixture.invoke(adapter.command({ capabilityVersion: '0.9.0' }))
      ).rejects.toMatchObject({ code: 'CAPABILITY_VERSION_MISMATCH' });
      expect(fixture.executionCount()).toBe(0);
      expect(fixture.selectionCount()).toBe(0);
    });

    it.each(capabilityRuntimeForbiddenControlGoldenCases)(
      'rejects caller-supplied %s implementation authority before selection or execution',
      async (field, value) => {
        const fixture = adapter.create();

        await expect(
          fixture.invoke(adapter.command({ extraFields: { [field]: value } }))
        ).rejects.toThrow(/unsupported fields/u);
        expect(fixture.selectionCount()).toBe(0);
        expect(fixture.executionCount()).toBe(0);
      }
    );

    it('keeps every returned authority consequence false on a successful invocation', async () => {
      const fixture = adapter.create();
      const execution = await fixture.invoke(adapter.command());

      expect(execution.outcome.status).toBe('SUCCEEDED');
      expectNoAuthority(execution);
    });
  });
}
