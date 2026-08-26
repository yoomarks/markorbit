import type { QueryClient } from '@markorbit/persistence';
import {
  KnowledgeCasePromotionError,
  isKnowledgeCaseIntakeReceiptV1,
  type KnowledgeCaseCandidateV1,
  type KnowledgeCaseIntakeReceiptV1,
  type KnowledgeCasePromotionClaim,
  type KnowledgeCasePromotionRecord,
  type KnowledgeCasePromotionRepository
} from './knowledge-case-promotion.js';

export interface KnowledgeCasePromotionTransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}

type Row = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);

function postgresCode(cause: unknown): string | undefined {
  if (!cause || typeof cause !== 'object') return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function unavailable(cause: unknown): KnowledgeCasePromotionError {
  return new KnowledgeCasePromotionError(
    'PERSISTENCE_UNAVAILABLE',
    'Knowledge Case promotion persistence is unavailable.',
    true,
    { cause: cause instanceof Error ? cause : undefined }
  );
}

export class PostgresKnowledgeCasePromotionRepository implements KnowledgeCasePromotionRepository {
  constructor(
    private readonly database: KnowledgeCasePromotionTransactionHost,
    private readonly query: QueryClient
  ) {}

  async claim(input: {
    record: KnowledgeCasePromotionRecord;
    idempotencyKey: string;
  }): Promise<KnowledgeCasePromotionClaim> {
    try {
      return await this.database.transact(
        async (client) => {
          const command = await client.query(
            `SELECT request_fingerprint_sha256, producer_promotion_ref
               FROM markreg_knowledge_case_promotion_commands
              WHERE workspace_id=$1 AND idempotency_key=$2
              FOR UPDATE`,
            [input.record.workspaceId, input.idempotencyKey]
          );
          if (command.rowCount) {
            const row = command.rows[0] as Row;
            if (String(row.request_fingerprint_sha256) !== input.record.requestFingerprintSha256)
              throw new KnowledgeCasePromotionError(
                'IDEMPOTENCY_CONFLICT',
                'Knowledge Case promotion idempotency key has conflicting input.'
              );
            return {
              acquired: false,
              record: await this.requireWith(client, String(row.producer_promotion_ref), true)
            };
          }

          const bySource = await client.query(
            `SELECT * FROM markreg_knowledge_case_promotions
              WHERE workspace_id=$1 AND source_identity_sha256=$2
              FOR UPDATE`,
            [input.record.workspaceId, input.record.sourceIdentitySha256]
          );
          if (bySource.rowCount) {
            const existing = this.map(bySource.rows[0] as Row);
            if (existing.requestFingerprintSha256 !== input.record.requestFingerprintSha256)
              throw new KnowledgeCasePromotionError(
                'SOURCE_PROMOTION_CONFLICT',
                'The exact Formal Matter snapshot already has different Knowledge promotion semantics.'
              );
            await this.insertCommand(client, input, existing.producerPromotionRef);
            return { acquired: false, record: existing };
          }

          await client.query(
            `INSERT INTO markreg_knowledge_case_promotions(
              producer_promotion_ref,workspace_id,source_identity_sha256,source_matter_id,
              source_matter_version,source_snapshot_sha256,request_fingerprint_sha256,candidate_id,
              candidate_json,state,created_at,updated_at
            ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
            [
              input.record.producerPromotionRef,
              input.record.workspaceId,
              input.record.sourceIdentitySha256,
              input.record.candidate.sourceMatterId,
              input.record.candidate.sourceMatterVersion,
              input.record.candidate.sourceSnapshotSha256,
              input.record.requestFingerprintSha256,
              input.record.candidate.candidateId,
              JSON.stringify(input.record.candidate),
              input.record.state,
              input.record.createdAt,
              input.record.updatedAt
            ]
          );
          await this.insertCommand(client, input, input.record.producerPromotionRef);
          return { acquired: true, record: clone(input.record) };
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof KnowledgeCasePromotionError) throw cause;
      if (['23505', '40001'].includes(postgresCode(cause) ?? ''))
        return this.resolveConcurrentWinner(input);
      throw unavailable(cause);
    }
  }

  async markDispatching(
    producerPromotionRef: string,
    at: string
  ): Promise<KnowledgeCasePromotionRecord> {
    try {
      const result = await this.query.query(
        `UPDATE markreg_knowledge_case_promotions
            SET state='DISPATCHING',dispatched_at=$2,updated_at=$2
          WHERE producer_promotion_ref=$1 AND state='CLAIMED'
          RETURNING *`,
        [producerPromotionRef, at]
      );
      if (!result.rowCount)
        throw new KnowledgeCasePromotionError(
          'PROMOTION_IN_PROGRESS',
          'Knowledge Case promotion is not claimable for dispatch.'
        );
      return this.map(result.rows[0] as Row);
    } catch (cause) {
      if (cause instanceof KnowledgeCasePromotionError) throw cause;
      throw unavailable(cause);
    }
  }

  async markCompleted(
    producerPromotionRef: string,
    receipt: KnowledgeCaseIntakeReceiptV1,
    at: string
  ): Promise<KnowledgeCasePromotionRecord> {
    try {
      const result = await this.query.query(
        `UPDATE markreg_knowledge_case_promotions
            SET state='COMPLETED',receipt_json=$2::jsonb,completed_at=$3,updated_at=$3,
                reconciliation_reason=NULL
          WHERE producer_promotion_ref=$1 AND state='DISPATCHING'
          RETURNING *`,
        [producerPromotionRef, JSON.stringify(receipt), at]
      );
      if (!result.rowCount)
        throw new KnowledgeCasePromotionError(
          'PROMOTION_IN_PROGRESS',
          'Knowledge Case promotion is not dispatching.'
        );
      return this.map(result.rows[0] as Row);
    } catch (cause) {
      if (cause instanceof KnowledgeCasePromotionError) throw cause;
      throw unavailable(cause);
    }
  }

  async markReconciliationRequired(
    producerPromotionRef: string,
    reason: string,
    at: string
  ): Promise<KnowledgeCasePromotionRecord> {
    try {
      const result = await this.query.query(
        `UPDATE markreg_knowledge_case_promotions
            SET state='RECONCILIATION_REQUIRED',reconciliation_reason=$2,updated_at=$3
          WHERE producer_promotion_ref=$1
            AND state IN ('CLAIMED','DISPATCHING','RECONCILIATION_REQUIRED')
          RETURNING *`,
        [producerPromotionRef, reason, at]
      );
      if (!result.rowCount)
        throw new KnowledgeCasePromotionError(
          'PERSISTENCE_UNAVAILABLE',
          'Knowledge Case promotion could not persist reconciliation state.',
          true
        );
      return this.map(result.rows[0] as Row);
    } catch (cause) {
      if (cause instanceof KnowledgeCasePromotionError) throw cause;
      throw unavailable(cause);
    }
  }

  private async insertCommand(
    client: QueryClient,
    input: { record: KnowledgeCasePromotionRecord; idempotencyKey: string },
    producerPromotionRef: string
  ) {
    await client.query(
      `INSERT INTO markreg_knowledge_case_promotion_commands(
        workspace_id,idempotency_key,request_fingerprint_sha256,producer_promotion_ref,created_at
      ) VALUES($1,$2,$3,$4,$5)`,
      [
        input.record.workspaceId,
        input.idempotencyKey,
        input.record.requestFingerprintSha256,
        producerPromotionRef,
        input.record.createdAt
      ]
    );
  }

  private async resolveConcurrentWinner(input: {
    record: KnowledgeCasePromotionRecord;
    idempotencyKey: string;
  }): Promise<KnowledgeCasePromotionClaim> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const command = await this.query.query(
        `SELECT request_fingerprint_sha256,producer_promotion_ref
           FROM markreg_knowledge_case_promotion_commands
          WHERE workspace_id=$1 AND idempotency_key=$2`,
        [input.record.workspaceId, input.idempotencyKey]
      );
      if (command.rowCount) {
        const row = command.rows[0] as Row;
        if (String(row.request_fingerprint_sha256) !== input.record.requestFingerprintSha256)
          throw new KnowledgeCasePromotionError(
            'IDEMPOTENCY_CONFLICT',
            'Knowledge Case promotion idempotency key has conflicting input.'
          );
        return {
          acquired: false,
          record: await this.require(String(row.producer_promotion_ref))
        };
      }
      const source = await this.query.query(
        `SELECT * FROM markreg_knowledge_case_promotions
          WHERE workspace_id=$1 AND source_identity_sha256=$2`,
        [input.record.workspaceId, input.record.sourceIdentitySha256]
      );
      if (source.rowCount) {
        const existing = this.map(source.rows[0] as Row);
        if (existing.requestFingerprintSha256 !== input.record.requestFingerprintSha256)
          throw new KnowledgeCasePromotionError(
            'SOURCE_PROMOTION_CONFLICT',
            'The exact Formal Matter snapshot already has different Knowledge promotion semantics.'
          );
        try {
          await this.query.query(
            `INSERT INTO markreg_knowledge_case_promotion_commands(
              workspace_id,idempotency_key,request_fingerprint_sha256,producer_promotion_ref,created_at
            ) VALUES($1,$2,$3,$4,$5)
            ON CONFLICT (workspace_id,idempotency_key) DO NOTHING`,
            [
              input.record.workspaceId,
              input.idempotencyKey,
              input.record.requestFingerprintSha256,
              existing.producerPromotionRef,
              input.record.createdAt
            ]
          );
        } catch (cause) {
          throw unavailable(cause);
        }
        return { acquired: false, record: existing };
      }
      if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
    throw new KnowledgeCasePromotionError(
      'PERSISTENCE_UNAVAILABLE',
      'The concurrent Knowledge Case promotion result is not yet available.',
      true
    );
  }

  private async require(producerPromotionRef: string): Promise<KnowledgeCasePromotionRecord> {
    return this.requireWith(this.query, producerPromotionRef, false);
  }

  private async requireWith(
    client: QueryClient,
    producerPromotionRef: string,
    lock: boolean
  ): Promise<KnowledgeCasePromotionRecord> {
    const result = await client.query(
      `SELECT * FROM markreg_knowledge_case_promotions
        WHERE producer_promotion_ref=$1${lock ? ' FOR UPDATE' : ''}`,
      [producerPromotionRef]
    );
    if (!result.rowCount)
      throw new KnowledgeCasePromotionError(
        'PERSISTENCE_UNAVAILABLE',
        'Knowledge Case promotion record is unavailable.',
        true
      );
    return this.map(result.rows[0] as Row);
  }

  private map(row: Row): KnowledgeCasePromotionRecord {
    const candidate = clone(row.candidate_json as KnowledgeCaseCandidateV1);
    const receipt = row.receipt_json
      ? clone(row.receipt_json as KnowledgeCaseIntakeReceiptV1)
      : undefined;
    if (receipt && !isKnowledgeCaseIntakeReceiptV1(receipt))
      throw new KnowledgeCasePromotionError(
        'PERSISTENCE_UNAVAILABLE',
        'Stored Knowledge Case intake receipt is invalid.',
        true
      );
    return {
      producerPromotionRef: String(row.producer_promotion_ref),
      workspaceId: String(row.workspace_id),
      sourceIdentitySha256: String(row.source_identity_sha256),
      requestFingerprintSha256: String(row.request_fingerprint_sha256),
      candidate,
      state: String(row.state) as KnowledgeCasePromotionRecord['state'],
      ...(receipt ? { receipt } : {}),
      ...(typeof row.reconciliation_reason === 'string'
        ? { reconciliationReason: row.reconciliation_reason }
        : {}),
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString(),
      ...(row.dispatched_at
        ? { dispatchedAt: new Date(row.dispatched_at as string).toISOString() }
        : {}),
      ...(row.completed_at
        ? { completedAt: new Date(row.completed_at as string).toISOString() }
        : {})
    };
  }
}
