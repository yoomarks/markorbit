import { createHash, randomUUID } from 'node:crypto';
import { parseCapabilityRequestV2Command, type CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';
import {
  GovernedCapabilityRuntimeError,
  type CapabilityRuntimeExecution,
  type GovernedCapabilityRuntime
} from './capability-runtime.js';
import {
  CapabilityRuntimeReplayStoreError,
  type CapabilityRuntimeReplayStoreV1
} from './capability-runtime-replay-store.js';

export interface DurableGovernedCapabilityRuntimeOptionsV1 {
  runtime: GovernedCapabilityRuntime;
  replayStore: CapabilityRuntimeReplayStoreV1;
  now?: () => string;
  ownerTokenFactory?: () => string;
  waitTimeoutMs?: number;
}

type InFlight = {
  fingerprint: string;
  result: Promise<CapabilityRuntimeExecution>;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function requestFingerprint(command: CapabilityRequestV2Command): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(command)))
    .digest('hex');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function replay(execution: Readonly<CapabilityRuntimeExecution>): CapabilityRuntimeExecution {
  return { ...clone(execution), replayed: true };
}

export class DurableGovernedCapabilityRuntimeV1 {
  private readonly now: () => string;
  private readonly ownerTokenFactory: () => string;
  private readonly waitTimeoutMs: number;
  private readonly inFlight = new Map<string, InFlight>();

  constructor(private readonly options: Readonly<DurableGovernedCapabilityRuntimeOptionsV1>) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.ownerTokenFactory = options.ownerTokenFactory ?? randomUUID;
    this.waitTimeoutMs = options.waitTimeoutMs ?? 60_000;
    if (!Number.isInteger(this.waitTimeoutMs) || this.waitTimeoutMs < 1_000 || this.waitTimeoutMs > 300_000)
      throw new Error('waitTimeoutMs must be between 1000 and 300000 milliseconds.');
  }

  async invoke(value: unknown): Promise<CapabilityRuntimeExecution> {
    const command = parseCapabilityRequestV2Command(value);
    const fingerprint = requestFingerprint(command);
    const pending = this.inFlight.get(command.idempotencyKey);
    if (pending) {
      if (pending.fingerprint !== fingerprint) this.throwConflict();
      return replay(await pending.result);
    }

    const result = this.coordinate(command, fingerprint);
    this.inFlight.set(command.idempotencyKey, { fingerprint, result });
    try {
      return await result;
    } finally {
      if (this.inFlight.get(command.idempotencyKey)?.result === result)
        this.inFlight.delete(command.idempotencyKey);
    }
  }

  private async coordinate(
    command: CapabilityRequestV2Command,
    fingerprint: string
  ): Promise<CapabilityRuntimeExecution> {
    const lookup = { idempotencyKey: command.idempotencyKey, requestFingerprintSha256: fingerprint };
    const inspected = await this.options.replayStore.inspect(lookup);
    if (inspected.kind === 'REPLAY') return replay(inspected.execution);
    if (inspected.kind === 'CONFLICT') this.throwConflict();
    if (inspected.kind === 'IN_PROGRESS')
      return replay(
        await this.options.replayStore.waitForCompletion({
          ...lookup,
          timeoutMs: this.waitTimeoutMs
        })
      );

    const ownerToken = this.ownerTokenFactory();
    const claimedAt = this.now();
    const claimInput = { ...lookup, ownerToken, now: claimedAt } as const;
    const claim = await this.options.replayStore.claim(claimInput);
    if (claim.kind === 'REPLAY') return replay(claim.execution);
    if (claim.kind === 'CONFLICT') this.throwConflict();
    if (claim.kind === 'IN_PROGRESS')
      return replay(
        await this.options.replayStore.waitForCompletion({
          ...lookup,
          timeoutMs: this.waitTimeoutMs
        })
      );

    try {
      const execution = await this.options.runtime.invoke(command);
      const canonicalExecution = { ...clone(execution), replayed: false };
      await this.options.replayStore.complete({
        ...claimInput,
        now: this.now(),
        execution: canonicalExecution
      });
      return clone(execution);
    } catch (error) {
      if (error instanceof GovernedCapabilityRuntimeError) {
        try {
          await this.options.replayStore.release({ ...claimInput, now: this.now() });
        } catch (releaseError) {
          throw new CapabilityRuntimeReplayStoreError(
            'PERSISTENCE_UNAVAILABLE',
            'A rejected governed Capability request could not safely release its replay claim.',
            { cause: releaseError instanceof Error ? releaseError : undefined }
          );
        }
      }
      throw error;
    }
  }

  private throwConflict(): never {
    throw new GovernedCapabilityRuntimeError(
      'IDEMPOTENCY_CONFLICT',
      'Idempotency key was already used with a different normalized Capability request.',
      409
    );
  }
}
