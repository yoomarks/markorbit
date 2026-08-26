import { createHash } from 'node:crypto';
import type { QueryClient } from '@markorbit/persistence';
import type { CapabilityRuntimeExecution } from './capability-runtime.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const PERSISTED_REPLAY_IDEMPOTENCY_KEY = '__MARKORBIT_REPLAY_KEY_REDACTED__';

type Row = Record<string, unknown>;

type StoredReplay = {
  requestFingerprintSha256: string;
  ownerToken: string;
  state: 'IN_PROGRESS' | 'COMPLETED';
  execution?: CapabilityRuntimeExecution;
  executionFingerprintSha256?: string;
};

export type CapabilityRuntimeReplayStoreErrorCode =
  | 'PERSISTENCE_UNAVAILABLE'
  | 'INVALID_PERSISTED_REPLAY'
  | 'CLAIM_OWNERSHIP_CONFLICT'
  | 'WAIT_TIMEOUT';

export class CapabilityRuntimeReplayStoreError extends Error {
  constructor(
    readonly code: CapabilityRuntimeReplayStoreErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'CapabilityRuntimeReplayStoreError';
  }
}

export type CapabilityRuntimeReplayDecisionV1 =
  | Readonly<{ kind: 'MISS' }>
  | Readonly<{ kind: 'CONFLICT' }>
  | Readonly<{ kind: 'IN_PROGRESS' }>
  | Readonly<{ kind: 'REPLAY'; execution: Readonly<CapabilityRuntimeExecution> }>;

export type CapabilityRuntimeReplayClaimDecisionV1 =
  | Readonly<{ kind: 'ACQUIRED' }>
  | Exclude<CapabilityRuntimeReplayDecisionV1, Readonly<{ kind: 'MISS' }>>;

export interface CapabilityRuntimeReplayLookupV1 {
  idempotencyKey: string;
  requestFingerprintSha256: string;
}

export interface CapabilityRuntimeReplayClaimV1 extends CapabilityRuntimeReplayLookupV1 {
  ownerToken: string;
  now: string;
}

export interface CapabilityRuntimeReplayCompletionV1 extends CapabilityRuntimeReplayClaimV1 {
  execution: Readonly<CapabilityRuntimeExecution>;
}

export interface CapabilityRuntimeReplayWaitV1 extends CapabilityRuntimeReplayLookupV1 {
  timeoutMs: number;
}

export interface CapabilityRuntimeReplayStoreV1 {
  inspect(
    input: Readonly<CapabilityRuntimeReplayLookupV1>
  ): Promise<CapabilityRuntimeReplayDecisionV1>;
  claim(
    input: Readonly<CapabilityRuntimeReplayClaimV1>
  ): Promise<CapabilityRuntimeReplayClaimDecisionV1>;
  complete(input: Readonly<CapabilityRuntimeReplayCompletionV1>): Promise<void>;
  release(input: Readonly<CapabilityRuntimeReplayClaimV1>): Promise<void>;
  waitForCompletion(
    input: Readonly<CapabilityRuntimeReplayWaitV1>
  ): Promise<Readonly<CapabilityRuntimeExecution>>;
}

export interface CapabilityRuntimeReplayTransactionHostV1 {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function idempotencyDigest(value: string): string {
  if (!value.trim() || value.length > 300)
    throw new CapabilityRuntimeReplayStoreError(
      'INVALID_PERSISTED_REPLAY',
      'Capability replay idempotency key must contain 1 to 300 characters.'
    );
  return sha256(value);
}

function requestFingerprint(value: string): string {
  if (!SHA256.test(value))
    throw new CapabilityRuntimeReplayStoreError(
      'INVALID_PERSISTED_REPLAY',
      'Capability replay request fingerprint must be a lowercase SHA-256 digest.'
    );
  return value;
}

function ownerToken(value: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 300)
    throw new CapabilityRuntimeReplayStoreError(
      'CLAIM_OWNERSHIP_CONFLICT',
      'Capability replay owner token must contain 1 to 300 characters.'
    );
  return cleaned;
}

function timestamp(value: string): string {
  const cleaned = value.trim();
  if (!cleaned || Number.isNaN(Date.parse(cleaned)))
    throw new CapabilityRuntimeReplayStoreError(
      'INVALID_PERSISTED_REPLAY',
      'Capability replay timestamp must be a valid ISO-compatible timestamp.'
    );
  return cleaned;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function jsonClone<T>(value: T): T {
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new CapabilityRuntimeReplayStoreError(
      'INVALID_PERSISTED_REPLAY',
      'Capability replay execution must be JSON serializable.'
    );
  try {
    return JSON.parse(serialized) as T;
  } catch (error) {
    throw new CapabilityRuntimeReplayStoreError(
      'INVALID_PERSISTED_REPLAY',
      'Capability replay execution must be valid JSON.',
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function executionFingerprint(execution: Readonly<CapabilityRuntimeExecution>): string {
  return sha256(JSON.stringify(canonicalize(jsonClone(execution))));
}

function noAuthority(execution: Readonly<CapabilityRuntimeExecution>): boolean {
  return [
    execution.outcome.authority,
    execution.returnValue.authority,
    execution.receipt.authority
  ].every((authority) => Object.values(authority).every((value) => value === false));
}

function preparePersistedExecution(
  execution: Readonly<CapabilityRuntimeExecution>,
  expectedIdempotencyDigest: string
): CapabilityRuntimeExecution {
  const replay = jsonClone(execution);
  if (
    typeof replay !== 'object' ||
    replay === null ||
    replay.replayed !== false ||
    typeof replay.request?.idempotencyKey !== 'string' ||
    idempotencyDigest(replay.request.idempotencyKey) !== expectedIdempotencyDigest ||
    !noAuthority(replay)
  )
    throw new CapabilityRuntimeReplayStoreError(
      'INVALID_PERSISTED_REPLAY',
      'Governed Capability replay violates identity or authority invariants before persistence.'
    );
  return {
    ...replay,
    request: {
      ...replay.request,
      idempotencyKey: PERSISTED_REPLAY_IDEMPOTENCY_KEY
    }
  };
}

function restorePersistedExecution(
  execution: Readonly<CapabilityRuntimeExecution>,
  expectedIdempotencyKey: string,
  expectedExecutionFingerprint: string
): CapabilityRuntimeExecution {
  idempotencyDigest(expectedIdempotencyKey);
  const replay = jsonClone(execution);
  if (
    typeof replay !== 'object' ||
    replay === null ||
    replay.replayed !== false ||
    replay.request?.idempotencyKey !== PERSISTED_REPLAY_IDEMPOTENCY_KEY ||
    !noAuthority(replay)
  )
    throw new CapabilityRuntimeReplayStoreError(
      'INVALID_PERSISTED_REPLAY',
      'Persisted governed Capability replay violates identity or authority invariants.'
    );
  const actualFingerprint = executionFingerprint(replay);
  if (actualFingerprint !== expectedExecutionFingerprint)
    throw new CapabilityRuntimeReplayStoreError(
      'INVALID_PERSISTED_REPLAY',
      'Persisted governed Capability replay fingerprint does not match its immutable execution.'
    );
  return {
    ...replay,
    request: {
      ...replay.request,
      idempotencyKey: expectedIdempotencyKey
    }
  };
}

function decisionFromStored(
  stored: StoredReplay | undefined,
  expectedRequestFingerprint: string,
  expectedIdempotencyKey: string
): CapabilityRuntimeReplayDecisionV1 {
  if (!stored) return { kind: 'MISS' };
  if (stored.requestFingerprintSha256 !== expectedRequestFingerprint) return { kind: 'CONFLICT' };
  if (stored.state === 'IN_PROGRESS') return { kind: 'IN_PROGRESS' };
  if (!stored.execution || !stored.executionFingerprintSha256)
    throw new CapabilityRuntimeReplayStoreError(
      'INVALID_PERSISTED_REPLAY',
      'Completed governed Capability replay is missing its immutable execution.'
    );
  return {
    kind: 'REPLAY',
    execution: restorePersistedExecution(
      stored.execution,
      expectedIdempotencyKey,
      stored.executionFingerprintSha256
    )
  };
}

function storedFromRow(row: Row | undefined): StoredReplay | undefined {
  if (!row) return undefined;
  const state = row.state;
  const requestFingerprintSha256 = row.request_fingerprint_sha256;
  const persistedOwnerToken = row.owner_token;
  if (
    (state !== 'IN_PROGRESS' && state !== 'COMPLETED') ||
    typeof requestFingerprintSha256 !== 'string' ||
    !SHA256.test(requestFingerprintSha256) ||
    typeof persistedOwnerToken !== 'string' ||
    !persistedOwnerToken
  )
    throw new CapabilityRuntimeReplayStoreError(
      'INVALID_PERSISTED_REPLAY',
      'Persisted governed Capability replay claim is invalid.'
    );
  if (state === 'IN_PROGRESS')
    return {
      state,
      requestFingerprintSha256,
      ownerToken: persistedOwnerToken
    };
  const execution = row.execution_json;
  const persistedFingerprint = row.execution_fingerprint_sha256;
  if (
    typeof execution !== 'object' ||
    execution === null ||
    Array.isArray(execution) ||
    typeof persistedFingerprint !== 'string' ||
    !SHA256.test(persistedFingerprint)
  )
    throw new CapabilityRuntimeReplayStoreError(
      'INVALID_PERSISTED_REPLAY',
      'Persisted governed Capability replay execution is invalid.'
    );
  return {
    state,
    requestFingerprintSha256,
    ownerToken: persistedOwnerToken,
    execution: jsonClone(execution as CapabilityRuntimeExecution),
    executionFingerprintSha256: persistedFingerprint
  };
}

async function pause(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export class InMemoryCapabilityRuntimeReplayStoreV1 implements CapabilityRuntimeReplayStoreV1 {
  private readonly rows = new Map<string, StoredReplay>();

  async inspect(
    input: Readonly<CapabilityRuntimeReplayLookupV1>
  ): Promise<CapabilityRuntimeReplayDecisionV1> {
    await Promise.resolve();
    const digest = idempotencyDigest(input.idempotencyKey);
    const fingerprint = requestFingerprint(input.requestFingerprintSha256);
    return decisionFromStored(this.rows.get(digest), fingerprint, input.idempotencyKey);
  }

  async claim(
    input: Readonly<CapabilityRuntimeReplayClaimV1>
  ): Promise<CapabilityRuntimeReplayClaimDecisionV1> {
    await Promise.resolve();
    const digest = idempotencyDigest(input.idempotencyKey);
    const fingerprint = requestFingerprint(input.requestFingerprintSha256);
    const token = ownerToken(input.ownerToken);
    timestamp(input.now);
    const decision = decisionFromStored(this.rows.get(digest), fingerprint, input.idempotencyKey);
    if (decision.kind !== 'MISS') return decision;
    this.rows.set(digest, {
      requestFingerprintSha256: fingerprint,
      ownerToken: token,
      state: 'IN_PROGRESS'
    });
    return { kind: 'ACQUIRED' };
  }

  async complete(input: Readonly<CapabilityRuntimeReplayCompletionV1>): Promise<void> {
    await Promise.resolve();
    const digest = idempotencyDigest(input.idempotencyKey);
    const fingerprint = requestFingerprint(input.requestFingerprintSha256);
    const token = ownerToken(input.ownerToken);
    timestamp(input.now);
    const stored = this.rows.get(digest);
    if (!stored || stored.requestFingerprintSha256 !== fingerprint || stored.ownerToken !== token)
      throw new CapabilityRuntimeReplayStoreError(
        'CLAIM_OWNERSHIP_CONFLICT',
        'Governed Capability replay completion does not own the durable claim.'
      );
    const execution = preparePersistedExecution(input.execution, digest);
    const immutableFingerprint = executionFingerprint(execution);
    if (stored.state === 'COMPLETED') {
      if (stored.executionFingerprintSha256 !== immutableFingerprint)
        throw new CapabilityRuntimeReplayStoreError(
          'INVALID_PERSISTED_REPLAY',
          'Governed Capability replay completion conflicts with the immutable stored execution.'
        );
      return;
    }
    this.rows.set(digest, {
      requestFingerprintSha256: fingerprint,
      ownerToken: token,
      state: 'COMPLETED',
      execution,
      executionFingerprintSha256: immutableFingerprint
    });
  }

  async release(input: Readonly<CapabilityRuntimeReplayClaimV1>): Promise<void> {
    await Promise.resolve();
    const digest = idempotencyDigest(input.idempotencyKey);
    const fingerprint = requestFingerprint(input.requestFingerprintSha256);
    const token = ownerToken(input.ownerToken);
    timestamp(input.now);
    const stored = this.rows.get(digest);
    if (!stored) return;
    if (
      stored.state !== 'IN_PROGRESS' ||
      stored.requestFingerprintSha256 !== fingerprint ||
      stored.ownerToken !== token
    )
      throw new CapabilityRuntimeReplayStoreError(
        'CLAIM_OWNERSHIP_CONFLICT',
        'Governed Capability replay release does not own the in-progress claim.'
      );
    this.rows.delete(digest);
  }

  async waitForCompletion(
    input: Readonly<CapabilityRuntimeReplayWaitV1>
  ): Promise<Readonly<CapabilityRuntimeExecution>> {
    const started = Date.now();
    while (Date.now() - started <= input.timeoutMs) {
      const decision = await this.inspect(input);
      if (decision.kind === 'REPLAY') return decision.execution;
      if (decision.kind === 'CONFLICT')
        throw new CapabilityRuntimeReplayStoreError(
          'INVALID_PERSISTED_REPLAY',
          'Governed Capability replay changed fingerprint while waiting for completion.'
        );
      await pause(10);
    }
    throw new CapabilityRuntimeReplayStoreError(
      'WAIT_TIMEOUT',
      'Timed out waiting for the in-progress governed Capability replay to complete.'
    );
  }
}

export class PostgresCapabilityRuntimeReplayStoreV1 implements CapabilityRuntimeReplayStoreV1 {
  constructor(
    private readonly database: CapabilityRuntimeReplayTransactionHostV1,
    private readonly query: QueryClient
  ) {}

  async inspect(
    input: Readonly<CapabilityRuntimeReplayLookupV1>
  ): Promise<CapabilityRuntimeReplayDecisionV1> {
    const digest = idempotencyDigest(input.idempotencyKey);
    const fingerprint = requestFingerprint(input.requestFingerprintSha256);
    try {
      const result = await this.query.query(
        `SELECT request_fingerprint_sha256,state,owner_token,execution_fingerprint_sha256,execution_json
           FROM capability_governed_runtime_replays
          WHERE idempotency_key_sha256=$1`,
        [digest]
      );
      return decisionFromStored(
        storedFromRow(result.rows[0] as Row | undefined),
        fingerprint,
        input.idempotencyKey
      );
    } catch (error) {
      if (error instanceof CapabilityRuntimeReplayStoreError) throw error;
      throw new CapabilityRuntimeReplayStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Governed Capability replay lookup is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async claim(
    input: Readonly<CapabilityRuntimeReplayClaimV1>
  ): Promise<CapabilityRuntimeReplayClaimDecisionV1> {
    const digest = idempotencyDigest(input.idempotencyKey);
    const fingerprint = requestFingerprint(input.requestFingerprintSha256);
    const token = ownerToken(input.ownerToken);
    const now = timestamp(input.now);
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `capability-governed-replay:${digest}`
        ]);
        const existing = await client.query(
          `SELECT request_fingerprint_sha256,state,owner_token,execution_fingerprint_sha256,execution_json
             FROM capability_governed_runtime_replays
            WHERE idempotency_key_sha256=$1
            FOR UPDATE`,
          [digest]
        );
        const decision = decisionFromStored(
          storedFromRow(existing.rows[0] as Row | undefined),
          fingerprint,
          input.idempotencyKey
        );
        if (decision.kind !== 'MISS') return decision;
        await client.query(
          `INSERT INTO capability_governed_runtime_replays (
             idempotency_key_sha256,request_fingerprint_sha256,state,owner_token,created_at
           ) VALUES ($1,$2,'IN_PROGRESS',$3,$4)`,
          [digest, fingerprint, token, now]
        );
        return { kind: 'ACQUIRED' } as const;
      });
    } catch (error) {
      if (error instanceof CapabilityRuntimeReplayStoreError) throw error;
      throw new CapabilityRuntimeReplayStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Governed Capability replay claim is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async complete(input: Readonly<CapabilityRuntimeReplayCompletionV1>): Promise<void> {
    const digest = idempotencyDigest(input.idempotencyKey);
    const fingerprint = requestFingerprint(input.requestFingerprintSha256);
    const token = ownerToken(input.ownerToken);
    const now = timestamp(input.now);
    const execution = preparePersistedExecution(input.execution, digest);
    const immutableFingerprint = executionFingerprint(execution);
    try {
      await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `capability-governed-replay:${digest}`
        ]);
        const result = await client.query(
          `SELECT request_fingerprint_sha256,state,owner_token,execution_fingerprint_sha256,execution_json
             FROM capability_governed_runtime_replays
            WHERE idempotency_key_sha256=$1
            FOR UPDATE`,
          [digest]
        );
        const stored = storedFromRow(result.rows[0] as Row | undefined);
        if (
          !stored ||
          stored.requestFingerprintSha256 !== fingerprint ||
          stored.ownerToken !== token
        )
          throw new CapabilityRuntimeReplayStoreError(
            'CLAIM_OWNERSHIP_CONFLICT',
            'Governed Capability replay completion does not own the durable claim.'
          );
        if (stored.state === 'COMPLETED') {
          if (stored.executionFingerprintSha256 !== immutableFingerprint)
            throw new CapabilityRuntimeReplayStoreError(
              'INVALID_PERSISTED_REPLAY',
              'Governed Capability replay completion conflicts with the immutable stored execution.'
            );
          return;
        }
        await client.query(
          `UPDATE capability_governed_runtime_replays
              SET state='COMPLETED',execution_fingerprint_sha256=$2,execution_json=$3::jsonb,completed_at=$4
            WHERE idempotency_key_sha256=$1`,
          [digest, immutableFingerprint, JSON.stringify(execution), now]
        );
      });
    } catch (error) {
      if (error instanceof CapabilityRuntimeReplayStoreError) throw error;
      throw new CapabilityRuntimeReplayStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Governed Capability replay completion persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async release(input: Readonly<CapabilityRuntimeReplayClaimV1>): Promise<void> {
    const digest = idempotencyDigest(input.idempotencyKey);
    const fingerprint = requestFingerprint(input.requestFingerprintSha256);
    const token = ownerToken(input.ownerToken);
    timestamp(input.now);
    try {
      await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `capability-governed-replay:${digest}`
        ]);
        const result = await client.query(
          `SELECT request_fingerprint_sha256,state,owner_token
             FROM capability_governed_runtime_replays
            WHERE idempotency_key_sha256=$1
            FOR UPDATE`,
          [digest]
        );
        const row = result.rows[0] as Row | undefined;
        if (!row) return;
        if (
          row.state !== 'IN_PROGRESS' ||
          row.request_fingerprint_sha256 !== fingerprint ||
          row.owner_token !== token
        )
          throw new CapabilityRuntimeReplayStoreError(
            'CLAIM_OWNERSHIP_CONFLICT',
            'Governed Capability replay release does not own the in-progress claim.'
          );
        await client.query(
          'DELETE FROM capability_governed_runtime_replays WHERE idempotency_key_sha256=$1',
          [digest]
        );
      });
    } catch (error) {
      if (error instanceof CapabilityRuntimeReplayStoreError) throw error;
      throw new CapabilityRuntimeReplayStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Governed Capability replay claim release is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async waitForCompletion(
    input: Readonly<CapabilityRuntimeReplayWaitV1>
  ): Promise<Readonly<CapabilityRuntimeExecution>> {
    const started = Date.now();
    while (Date.now() - started <= input.timeoutMs) {
      const decision = await this.inspect(input);
      if (decision.kind === 'REPLAY') return decision.execution;
      if (decision.kind === 'CONFLICT')
        throw new CapabilityRuntimeReplayStoreError(
          'INVALID_PERSISTED_REPLAY',
          'Governed Capability replay changed fingerprint while waiting for completion.'
        );
      await pause(25);
    }
    throw new CapabilityRuntimeReplayStoreError(
      'WAIT_TIMEOUT',
      'Timed out waiting for the in-progress governed Capability replay to complete.'
    );
  }
}
