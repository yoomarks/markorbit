import {
  parseManagedAiExecutionOutcomeV1,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import type { QueryClient } from '@markorbit/persistence';

export type ManagedAiExecutionClaimStateV1 =
  'CLAIMED' | 'DISPATCHING' | 'COMPLETED' | 'RECONCILIATION_REQUIRED';

export interface ManagedAiExecutionClaimCommandV1 {
  idempotencyKey: string;
  fingerprintSha256: string;
  executionId: string;
  correlationId: string;
  ownerToken: string;
  now: string;
  leaseExpiresAt: string;
}

export type ManagedAiExecutionClaimResultV1 =
  | { kind: 'ACQUIRED' }
  | { kind: 'REPLAY'; outcome: Readonly<ManagedAiExecutionOutcomeV1> }
  | { kind: 'IN_PROGRESS' }
  | { kind: 'RECONCILIATION_REQUIRED' }
  | { kind: 'CONFLICT' };

export interface ManagedAiExecutionClaimIdentityV1 {
  idempotencyKey: string;
  fingerprintSha256: string;
  ownerToken: string;
  now: string;
}

export interface ManagedAiExecutionCompletionV1 extends ManagedAiExecutionClaimIdentityV1 {
  outcome: Readonly<ManagedAiExecutionOutcomeV1>;
}

export interface ManagedAiExecutionReconciliationV1 extends ManagedAiExecutionClaimIdentityV1 {
  reason: string;
}

export interface ManagedAiExecutionClaimStoreV1 {
  claim(
    command: Readonly<ManagedAiExecutionClaimCommandV1>
  ): Promise<ManagedAiExecutionClaimResultV1>;
  markDispatching(command: Readonly<ManagedAiExecutionClaimIdentityV1>): Promise<void>;
  complete(command: Readonly<ManagedAiExecutionCompletionV1>): Promise<void>;
  markReconciliationRequired(command: Readonly<ManagedAiExecutionReconciliationV1>): Promise<void>;
}

export type ManagedAiExecutionClaimStoreErrorCode =
  'PERSISTENCE_UNAVAILABLE' | 'INVALID_PERSISTED_OUTCOME' | 'CLAIM_STATE_CONFLICT';

export class ManagedAiExecutionClaimStoreError extends Error {
  constructor(
    readonly code: ManagedAiExecutionClaimStoreErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ManagedAiExecutionClaimStoreError';
  }
}

interface MemoryClaimRow {
  fingerprintSha256: string;
  executionId: string;
  correlationId: string;
  state: ManagedAiExecutionClaimStateV1;
  ownerToken: string;
  leaseExpiresAt: string;
  outcome?: Readonly<ManagedAiExecutionOutcomeV1>;
  reconciliationReason?: string;
}

function cloneOutcome(
  outcome: Readonly<ManagedAiExecutionOutcomeV1>
): Readonly<ManagedAiExecutionOutcomeV1> {
  return structuredClone(outcome);
}

function expired(leaseExpiresAt: string, now: string): boolean {
  return Date.parse(leaseExpiresAt) <= Date.parse(now);
}

export class InMemoryManagedAiExecutionClaimStoreV1 implements ManagedAiExecutionClaimStoreV1 {
  private readonly rows = new Map<string, MemoryClaimRow>();

  claim(
    command: Readonly<ManagedAiExecutionClaimCommandV1>
  ): Promise<ManagedAiExecutionClaimResultV1> {
    const existing = this.rows.get(command.idempotencyKey);
    if (!existing) {
      this.rows.set(command.idempotencyKey, {
        fingerprintSha256: command.fingerprintSha256,
        executionId: command.executionId,
        correlationId: command.correlationId,
        state: 'CLAIMED',
        ownerToken: command.ownerToken,
        leaseExpiresAt: command.leaseExpiresAt
      });
      return Promise.resolve({ kind: 'ACQUIRED' });
    }
    if (existing.fingerprintSha256 !== command.fingerprintSha256)
      return Promise.resolve({ kind: 'CONFLICT' });
    if (existing.state === 'COMPLETED') {
      if (!existing.outcome)
        throw new ManagedAiExecutionClaimStoreError(
          'INVALID_PERSISTED_OUTCOME',
          'Completed Managed AI claim is missing its governed outcome.'
        );
      return Promise.resolve({ kind: 'REPLAY', outcome: cloneOutcome(existing.outcome) });
    }
    if (existing.state === 'RECONCILIATION_REQUIRED')
      return Promise.resolve({ kind: 'RECONCILIATION_REQUIRED' });
    if (!expired(existing.leaseExpiresAt, command.now))
      return Promise.resolve({ kind: 'IN_PROGRESS' });
    if (existing.state === 'DISPATCHING') {
      existing.state = 'RECONCILIATION_REQUIRED';
      existing.reconciliationReason = 'DISPATCH_LEASE_EXPIRED';
      return Promise.resolve({ kind: 'RECONCILIATION_REQUIRED' });
    }
    existing.ownerToken = command.ownerToken;
    existing.leaseExpiresAt = command.leaseExpiresAt;
    return Promise.resolve({ kind: 'ACQUIRED' });
  }

  markDispatching(command: Readonly<ManagedAiExecutionClaimIdentityV1>): Promise<void> {
    const row = this.requireOwned(command, 'CLAIMED');
    row.state = 'DISPATCHING';
    return Promise.resolve();
  }

  complete(command: Readonly<ManagedAiExecutionCompletionV1>): Promise<void> {
    const row = this.rows.get(command.idempotencyKey);
    if (
      !row ||
      row.fingerprintSha256 !== command.fingerprintSha256 ||
      row.ownerToken !== command.ownerToken ||
      (row.state !== 'DISPATCHING' && row.state !== 'RECONCILIATION_REQUIRED')
    )
      throw new ManagedAiExecutionClaimStoreError(
        'CLAIM_STATE_CONFLICT',
        'Managed AI claim cannot be completed from its current state.'
      );
    row.state = 'COMPLETED';
    row.outcome = cloneOutcome(command.outcome);
    delete row.reconciliationReason;
    return Promise.resolve();
  }

  markReconciliationRequired(command: Readonly<ManagedAiExecutionReconciliationV1>): Promise<void> {
    const row = this.rows.get(command.idempotencyKey);
    if (
      !row ||
      row.fingerprintSha256 !== command.fingerprintSha256 ||
      row.ownerToken !== command.ownerToken
    )
      throw new ManagedAiExecutionClaimStoreError(
        'CLAIM_STATE_CONFLICT',
        'Managed AI claim ownership changed before reconciliation could be recorded.'
      );
    if (row.state === 'COMPLETED') return Promise.resolve();
    if (row.state !== 'DISPATCHING' && row.state !== 'RECONCILIATION_REQUIRED')
      throw new ManagedAiExecutionClaimStoreError(
        'CLAIM_STATE_CONFLICT',
        'Managed AI claim cannot require reconciliation before dispatch begins.'
      );
    row.state = 'RECONCILIATION_REQUIRED';
    row.reconciliationReason = command.reason;
    return Promise.resolve();
  }

  private requireOwned(
    command: Readonly<ManagedAiExecutionClaimIdentityV1>,
    state: ManagedAiExecutionClaimStateV1
  ): MemoryClaimRow {
    const row = this.rows.get(command.idempotencyKey);
    if (
      !row ||
      row.fingerprintSha256 !== command.fingerprintSha256 ||
      row.ownerToken !== command.ownerToken ||
      row.state !== state
    )
      throw new ManagedAiExecutionClaimStoreError(
        'CLAIM_STATE_CONFLICT',
        'Managed AI claim ownership or state no longer permits this transition.'
      );
    return row;
  }
}

export interface ManagedAiExecutionClaimTransactionHostV1 {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

type ClaimRow = {
  request_fingerprint_sha256: unknown;
  state: unknown;
  owner_token: unknown;
  lease_expires_at: unknown;
  outcome_json: unknown;
};

function persistedOutcome(value: unknown): ManagedAiExecutionOutcomeV1 {
  try {
    return parseManagedAiExecutionOutcomeV1(value);
  } catch (error) {
    throw new ManagedAiExecutionClaimStoreError(
      'INVALID_PERSISTED_OUTCOME',
      'Persisted Managed AI governed outcome is invalid.',
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function state(value: unknown): ManagedAiExecutionClaimStateV1 {
  if (
    value === 'CLAIMED' ||
    value === 'DISPATCHING' ||
    value === 'COMPLETED' ||
    value === 'RECONCILIATION_REQUIRED'
  )
    return value;
  throw new ManagedAiExecutionClaimStoreError(
    'PERSISTENCE_UNAVAILABLE',
    'Persisted Managed AI claim state is invalid.'
  );
}

export class PostgresManagedAiExecutionClaimStoreV1 implements ManagedAiExecutionClaimStoreV1 {
  constructor(
    private readonly database: ManagedAiExecutionClaimTransactionHostV1,
    private readonly query: QueryClient
  ) {}

  async claim(
    command: Readonly<ManagedAiExecutionClaimCommandV1>
  ): Promise<ManagedAiExecutionClaimResultV1> {
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `managed-ai-execution:${command.idempotencyKey}`
        ]);
        const found = await client.query(
          `SELECT request_fingerprint_sha256,state,owner_token,lease_expires_at,outcome_json
             FROM capability_managed_ai_execution_claims
            WHERE idempotency_key=$1`,
          [command.idempotencyKey]
        );
        const row = found.rows[0] as ClaimRow | undefined;
        if (!row) {
          await client.query(
            `INSERT INTO capability_managed_ai_execution_claims (
               idempotency_key,request_fingerprint_sha256,execution_id,correlation_id,state,
               owner_token,lease_expires_at,created_at,updated_at
             ) VALUES ($1,$2,$3,$4,'CLAIMED',$5,$6,$7,$7)`,
            [
              command.idempotencyKey,
              command.fingerprintSha256,
              command.executionId,
              command.correlationId,
              command.ownerToken,
              command.leaseExpiresAt,
              command.now
            ]
          );
          return { kind: 'ACQUIRED' };
        }
        if (String(row.request_fingerprint_sha256) !== command.fingerprintSha256)
          return { kind: 'CONFLICT' };
        const persistedState = state(row.state);
        if (persistedState === 'COMPLETED')
          return { kind: 'REPLAY', outcome: persistedOutcome(row.outcome_json) };
        if (persistedState === 'RECONCILIATION_REQUIRED')
          return { kind: 'RECONCILIATION_REQUIRED' };
        if (!expired(String(row.lease_expires_at), command.now)) return { kind: 'IN_PROGRESS' };
        if (persistedState === 'DISPATCHING') {
          await client.query(
            `UPDATE capability_managed_ai_execution_claims
                SET state='RECONCILIATION_REQUIRED',
                    reconciliation_reason='DISPATCH_LEASE_EXPIRED',updated_at=$2
              WHERE idempotency_key=$1`,
            [command.idempotencyKey, command.now]
          );
          return { kind: 'RECONCILIATION_REQUIRED' };
        }
        await client.query(
          `UPDATE capability_managed_ai_execution_claims
              SET owner_token=$2,lease_expires_at=$3,updated_at=$4
            WHERE idempotency_key=$1 AND state='CLAIMED'`,
          [command.idempotencyKey, command.ownerToken, command.leaseExpiresAt, command.now]
        );
        return { kind: 'ACQUIRED' };
      });
    } catch (error) {
      if (error instanceof ManagedAiExecutionClaimStoreError) throw error;
      throw new ManagedAiExecutionClaimStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed AI durable claim persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async markDispatching(command: Readonly<ManagedAiExecutionClaimIdentityV1>): Promise<void> {
    await this.transition(
      `UPDATE capability_managed_ai_execution_claims
          SET state='DISPATCHING',dispatched_at=COALESCE(dispatched_at,$4),updated_at=$4
        WHERE idempotency_key=$1 AND request_fingerprint_sha256=$2 AND owner_token=$3 AND state='CLAIMED'`,
      command,
      'Managed AI claim could not be marked as dispatching.'
    );
  }

  async complete(command: Readonly<ManagedAiExecutionCompletionV1>): Promise<void> {
    try {
      const result = await this.query.query(
        `UPDATE capability_managed_ai_execution_claims
            SET state='COMPLETED',outcome_json=$4::jsonb,reconciliation_reason=NULL,
                completed_at=$5,updated_at=$5
          WHERE idempotency_key=$1 AND request_fingerprint_sha256=$2 AND owner_token=$3
            AND state IN ('DISPATCHING','RECONCILIATION_REQUIRED')`,
        [
          command.idempotencyKey,
          command.fingerprintSha256,
          command.ownerToken,
          JSON.stringify(command.outcome),
          command.now
        ]
      );
      if (result.rowCount !== 1)
        throw new ManagedAiExecutionClaimStoreError(
          'CLAIM_STATE_CONFLICT',
          'Managed AI claim cannot be completed from its current durable state.'
        );
    } catch (error) {
      if (error instanceof ManagedAiExecutionClaimStoreError) throw error;
      throw new ManagedAiExecutionClaimStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed AI completion persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async markReconciliationRequired(
    command: Readonly<ManagedAiExecutionReconciliationV1>
  ): Promise<void> {
    try {
      const result = await this.query.query(
        `UPDATE capability_managed_ai_execution_claims
            SET state='RECONCILIATION_REQUIRED',reconciliation_reason=$4,updated_at=$5
          WHERE idempotency_key=$1 AND request_fingerprint_sha256=$2 AND owner_token=$3
            AND state IN ('DISPATCHING','RECONCILIATION_REQUIRED')`,
        [
          command.idempotencyKey,
          command.fingerprintSha256,
          command.ownerToken,
          command.reason,
          command.now
        ]
      );
      if (result.rowCount !== 1)
        throw new ManagedAiExecutionClaimStoreError(
          'CLAIM_STATE_CONFLICT',
          'Managed AI claim could not be moved to reconciliation-required state.'
        );
    } catch (error) {
      if (error instanceof ManagedAiExecutionClaimStoreError) throw error;
      throw new ManagedAiExecutionClaimStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed AI reconciliation persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  private async transition(
    sql: string,
    command: Readonly<ManagedAiExecutionClaimIdentityV1>,
    conflictMessage: string
  ): Promise<void> {
    try {
      const result = await this.query.query(sql, [
        command.idempotencyKey,
        command.fingerprintSha256,
        command.ownerToken,
        command.now
      ]);
      if (result.rowCount !== 1)
        throw new ManagedAiExecutionClaimStoreError('CLAIM_STATE_CONFLICT', conflictMessage);
    } catch (error) {
      if (error instanceof ManagedAiExecutionClaimStoreError) throw error;
      throw new ManagedAiExecutionClaimStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed AI claim transition persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
