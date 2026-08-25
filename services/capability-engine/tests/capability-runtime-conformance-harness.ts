import { describe, expect, it } from 'vitest';
import type { CapabilityRuntimeExecution } from '../src/capability-runtime.js';

export type CapabilityRuntimeConformanceMode =
  | 'DEFAULT'
  | 'INVALID_OUTPUT'
  | 'EXECUTOR_FAILURE'
  | 'CALLER_FORBIDDEN'
  | 'RISK_FORBIDDEN'
  | 'SCHEMA_MISMATCH';

export interface CapabilityRuntimeConformanceFixture {
  invoke(command: unknown): Promise<CapabilityRuntimeExecution>;
  executionCount(): number;
}

export interface CapabilityRuntimeConformanceAdapter {
  create(mode?: CapabilityRuntimeConformanceMode): CapabilityRuntimeConformanceFixture;
  command(overrides?: Readonly<{ capabilityVersion?: string; input?: unknown }>): unknown;
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
    it('replays an exact completed request without a second implementation execution', async () => {
      const fixture = adapter.create();
      const command = adapter.command();

      const first = await fixture.invoke(command);
      const replay = await fixture.invoke(command);

      expect(first.replayed).toBe(false);
      expect(replay.replayed).toBe(true);
      expect(replay.request.capabilityRequestId).toBe(first.request.capabilityRequestId);
      expect(replay.outcome.capabilityOutcomeId).toBe(first.outcome.capabilityOutcomeId);
      expect(replay.receipt.sessionReceiptId).toBe(first.receipt.sessionReceiptId);
      expect(fixture.executionCount()).toBe(1);
    });

    it('deduplicates identical concurrent requests into one implementation execution', async () => {
      const fixture = adapter.create();
      const command = adapter.command();

      const [left, right] = await Promise.all([fixture.invoke(command), fixture.invoke(command)]);

      expect([left.replayed, right.replayed].sort()).toEqual([false, true]);
      expect(left.request.capabilityRequestId).toBe(right.request.capabilityRequestId);
      expect(left.outcome.capabilityOutcomeId).toBe(right.outcome.capabilityOutcomeId);
      expect(fixture.executionCount()).toBe(1);
    });

    it('rejects a conflicting in-flight idempotency reuse before a second execution', async () => {
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
    });

    it('persists invalid output as a non-retryable governed failure with stable replay', async () => {
      const fixture = adapter.create('INVALID_OUTPUT');
      const command = adapter.command();

      const first = await fixture.invoke(command);
      const replay = await fixture.invoke(command);

      expect(first.outcome).toMatchObject({
        status: 'FAILED',
        error: { code: 'OUTPUT_CONTRACT_INVALID', retryable: false }
      });
      expect(first.returnValue.status).toBe('FAILED');
      expect(replay.outcome.capabilityOutcomeId).toBe(first.outcome.capabilityOutcomeId);
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
      expect(replay.outcome.capabilityOutcomeId).toBe(first.outcome.capabilityOutcomeId);
      expect(fixture.executionCount()).toBe(1);
      expectNoAuthority(first);
    });

    it.each([
      ['CALLER_FORBIDDEN', 'CALLER_NOT_ALLOWED'],
      ['RISK_FORBIDDEN', 'RISK_NOT_ALLOWED'],
      ['SCHEMA_MISMATCH', 'SCHEMA_MISMATCH']
    ] as const)('fails closed for %s before implementation execution', async (mode, errorCode) => {
      const fixture = adapter.create(mode);

      await expect(fixture.invoke(adapter.command())).rejects.toMatchObject({ code: errorCode });
      expect(fixture.executionCount()).toBe(0);
    });

    it('rejects a stale Capability version before implementation execution', async () => {
      const fixture = adapter.create();

      await expect(
        fixture.invoke(adapter.command({ capabilityVersion: '0.9.0' }))
      ).rejects.toMatchObject({ code: 'CAPABILITY_VERSION_MISMATCH' });
      expect(fixture.executionCount()).toBe(0);
    });

    it('keeps every returned authority consequence false on a successful invocation', async () => {
      const fixture = adapter.create();
      const execution = await fixture.invoke(adapter.command());

      expect(execution.outcome.status).toBe('SUCCEEDED');
      expectNoAuthority(execution);
    });
  });
}
