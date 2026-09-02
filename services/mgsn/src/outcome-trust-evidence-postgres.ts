import { isDeepStrictEqual } from 'node:util';
import {
  parseTrustEvidenceItemV1,
  parseTrustEvidenceVisibilityProjectionV1,
  parseTrustExplanationV1,
  type TrustEvidenceItemReferenceV1,
  type TrustEvidenceItemV1,
  type TrustEvidenceVisibilityProjectionIdV1,
  type TrustEvidenceVisibilityProjectionV1,
  type TrustExplanationV1
} from '@markorbit/contracts/outcome-trust-evidence';
import type { QueryClient } from '@markorbit/persistence';
import type { OutcomeTrustEvidenceRepository } from './outcome-trust-evidence.js';

type Row = Record<string, unknown>;

export interface OutcomeTrustEvidenceTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

export type OutcomeTrustEvidencePersistenceErrorCode =
  | 'PERSISTENCE_UNAVAILABLE'
  | 'PERSISTED_RECORD_CONFLICT'
  | 'PERSISTED_RECORD_INVALID';

export class OutcomeTrustEvidencePersistenceError extends Error {
  constructor(
    readonly code: OutcomeTrustEvidencePersistenceErrorCode,
    message: string,
    readonly status = code === 'PERSISTENCE_UNAVAILABLE' ? 503 : 409,
    readonly retryable = code === 'PERSISTENCE_UNAVAILABLE',
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OutcomeTrustEvidencePersistenceError';
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new OutcomeTrustEvidencePersistenceError(
      'PERSISTED_RECORD_INVALID',
      `Persisted ${field} is malformed.`
    );
  }
  return value;
}

function integer(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new OutcomeTrustEvidencePersistenceError(
      'PERSISTED_RECORD_INVALID',
      `Persisted ${field} is malformed.`
    );
  }
  return parsed;
}

function instant(value: unknown, field: string): string {
  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.valueOf())) {
    throw new OutcomeTrustEvidencePersistenceError(
      'PERSISTED_RECORD_INVALID',
      `Persisted ${field} is malformed.`
    );
  }
  return parsed.toISOString();
}

function exactReplay<T>(persisted: T, expected: T, kind: string): void {
  if (!isDeepStrictEqual(persisted, expected)) {
    throw new OutcomeTrustEvidencePersistenceError(
      'PERSISTED_RECORD_CONFLICT',
      `${kind} identity already exists with different immutable content.`
    );
  }
}

export class PostgresOutcomeTrustEvidenceRepository implements OutcomeTrustEvidenceRepository {
  constructor(
    private readonly database: OutcomeTrustEvidenceTransactionHost,
    private readonly query: QueryClient
  ) {}

  async putEvidenceItem(value: Readonly<TrustEvidenceItemV1>): Promise<void> {
    const item = parseTrustEvidenceItemV1(value);
    try {
      await this.database.transact(async (client) => {
        const inserted = await client.query(
          `INSERT INTO mgsn_trust_evidence_items(
             trust_evidence_item_id,version,provider_id,lifecycle_state,
             context_fingerprint_sha256,source_kind,source_authority_state,freshness_state,
             trust_evidence_item_fingerprint_sha256,item_record,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
           ON CONFLICT DO NOTHING
           RETURNING trust_evidence_item_id`,
          [
            item.trustEvidenceItemId,
            item.version,
            item.providerId,
            item.lifecycleState,
            item.context.contextFingerprintSha256,
            item.source.kind,
            item.sourceAuthority.authorityState,
            item.freshness.state,
            item.trustEvidenceItemFingerprintSha256,
            JSON.stringify(item),
            item.createdAt
          ]
        );
        if (inserted.rows.length === 0) {
          const existing = await this.readEvidenceItem(client, {
            trustEvidenceItemId: item.trustEvidenceItemId,
            version: item.version,
            trustEvidenceItemFingerprintSha256: item.trustEvidenceItemFingerprintSha256
          });
          if (!existing) {
            throw new OutcomeTrustEvidencePersistenceError(
              'PERSISTED_RECORD_CONFLICT',
              'Trust Evidence item identity already exists with a different immutable fingerprint.'
            );
          }
          exactReplay(existing, item, 'Trust Evidence item');
          return;
        }
        await client.query(
          `INSERT INTO mgsn_trust_evidence_owner_audit_events(
             object_type,target_id,target_version,target_fingerprint_sha256,provider_id,action,occurred_at
           ) VALUES('EVIDENCE_ITEM',$1,$2,$3,$4,'EVIDENCE_ITEM_RECORDED',$5)`,
          [
            item.trustEvidenceItemId,
            item.version,
            item.trustEvidenceItemFingerprintSha256,
            item.providerId,
            item.createdAt
          ]
        );
      });
    } catch (cause) {
      this.rethrow(cause);
    }
  }

  async findEvidenceItem(
    reference: Readonly<TrustEvidenceItemReferenceV1>
  ): Promise<Readonly<TrustEvidenceItemV1> | undefined> {
    try {
      return await this.readEvidenceItem(this.query, reference);
    } catch (cause) {
      return this.rethrow(cause);
    }
  }

  async putProjection(value: Readonly<TrustEvidenceVisibilityProjectionV1>): Promise<void> {
    const projection = parseTrustEvidenceVisibilityProjectionV1(value);
    try {
      await this.database.transact(async (client) => {
        const inserted = await client.query(
          `INSERT INTO mgsn_trust_evidence_visibility_projections(
             trust_evidence_visibility_projection_id,provider_id,purpose,audience_kind,
             context_fingerprint_sha256,projection_fingerprint_sha256,projection_record,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
           ON CONFLICT DO NOTHING
           RETURNING trust_evidence_visibility_projection_id`,
          [
            projection.trustEvidenceVisibilityProjectionId,
            projection.providerId,
            projection.purpose,
            projection.audience.kind,
            projection.contextFingerprintSha256,
            projection.projectionFingerprintSha256,
            JSON.stringify(projection),
            projection.createdAt
          ]
        );
        if (inserted.rows.length === 0) {
          const existing = await this.readProjection(
            client,
            projection.trustEvidenceVisibilityProjectionId
          );
          if (!existing) {
            throw new OutcomeTrustEvidencePersistenceError(
              'PERSISTED_RECORD_CONFLICT',
              'Trust Evidence visibility projection identity already exists with different immutable content.'
            );
          }
          exactReplay(existing, projection, 'Trust Evidence visibility projection');
          return;
        }
        await client.query(
          `INSERT INTO mgsn_trust_evidence_owner_audit_events(
             object_type,target_id,target_version,target_fingerprint_sha256,provider_id,action,occurred_at
           ) VALUES('VISIBILITY_PROJECTION',$1,NULL,$2,$3,'VISIBILITY_PROJECTION_RECORDED',$4)`,
          [
            projection.trustEvidenceVisibilityProjectionId,
            projection.projectionFingerprintSha256,
            projection.providerId,
            projection.createdAt
          ]
        );
      });
    } catch (cause) {
      this.rethrow(cause);
    }
  }

  async findProjection(
    projectionId: TrustEvidenceVisibilityProjectionIdV1
  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined> {
    try {
      return await this.readProjection(this.query, projectionId);
    } catch (cause) {
      return this.rethrow(cause);
    }
  }

  async putExplanation(value: Readonly<TrustExplanationV1>): Promise<void> {
    const explanation = parseTrustExplanationV1(value);
    try {
      await this.database.transact(async (client) => {
        const inserted = await client.query(
          `INSERT INTO mgsn_trust_explanations(
             trust_explanation_id,provider_id,context_fingerprint_sha256,result,
             trust_evidence_visibility_projection_id,projection_fingerprint_sha256,
             trust_explanation_fingerprint_sha256,explanation_record,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
           ON CONFLICT DO NOTHING
           RETURNING trust_explanation_id`,
          [
            explanation.trustExplanationId,
            explanation.providerId,
            explanation.contextFingerprintSha256,
            explanation.result,
            explanation.visibilityProjection.trustEvidenceVisibilityProjectionId,
            explanation.visibilityProjection.projectionFingerprintSha256,
            explanation.trustExplanationFingerprintSha256,
            JSON.stringify(explanation),
            explanation.createdAt
          ]
        );
        if (inserted.rows.length === 0) {
          const existing = await this.readExplanation(client, explanation.trustExplanationId);
          if (!existing) {
            throw new OutcomeTrustEvidencePersistenceError(
              'PERSISTED_RECORD_CONFLICT',
              'Trust Explanation identity already exists with different immutable content.'
            );
          }
          exactReplay(existing, explanation, 'Trust Explanation');
          return;
        }
        await client.query(
          `INSERT INTO mgsn_trust_evidence_owner_audit_events(
             object_type,target_id,target_version,target_fingerprint_sha256,provider_id,action,occurred_at
           ) VALUES('TRUST_EXPLANATION',$1,NULL,$2,$3,'TRUST_EXPLANATION_RECORDED',$4)`,
          [
            explanation.trustExplanationId,
            explanation.trustExplanationFingerprintSha256,
            explanation.providerId,
            explanation.createdAt
          ]
        );
      });
    } catch (cause) {
      this.rethrow(cause);
    }
  }

  async findExplanation(
    trustExplanationId: TrustExplanationV1['trustExplanationId']
  ): Promise<Readonly<TrustExplanationV1> | undefined> {
    try {
      return await this.readExplanation(this.query, trustExplanationId);
    } catch (cause) {
      return this.rethrow(cause);
    }
  }

  private async readEvidenceItem(
    client: QueryClient,
    reference: Readonly<TrustEvidenceItemReferenceV1>
  ): Promise<Readonly<TrustEvidenceItemV1> | undefined> {
    const result = await client.query(
      `SELECT * FROM mgsn_trust_evidence_items
       WHERE trust_evidence_item_id=$1 AND version=$2
         AND trust_evidence_item_fingerprint_sha256=$3`,
      [
        reference.trustEvidenceItemId,
        reference.version,
        reference.trustEvidenceItemFingerprintSha256
      ]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return undefined;
    const item = parseTrustEvidenceItemV1(row.item_record);
    if (
      item.trustEvidenceItemId !== text(row.trust_evidence_item_id, 'Trust Evidence item id') ||
      item.version !== integer(row.version, 'Trust Evidence item version') ||
      item.providerId !== text(row.provider_id, 'Trust Evidence provider id') ||
      item.lifecycleState !== row.lifecycle_state ||
      item.context.contextFingerprintSha256 !== row.context_fingerprint_sha256 ||
      item.source.kind !== row.source_kind ||
      item.sourceAuthority.authorityState !== row.source_authority_state ||
      item.freshness.state !== row.freshness_state ||
      item.trustEvidenceItemFingerprintSha256 !== row.trust_evidence_item_fingerprint_sha256 ||
      item.createdAt !== instant(row.created_at, 'Trust Evidence item createdAt')
    ) {
      throw new OutcomeTrustEvidencePersistenceError(
        'PERSISTED_RECORD_INVALID',
        'Persisted Trust Evidence item mirror columns do not match its canonical record.'
      );
    }
    return clone(item);
  }

  private async readProjection(
    client: QueryClient,
    projectionId: TrustEvidenceVisibilityProjectionIdV1
  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined> {
    const result = await client.query(
      `SELECT * FROM mgsn_trust_evidence_visibility_projections
       WHERE trust_evidence_visibility_projection_id=$1`,
      [projectionId]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return undefined;
    const projection = parseTrustEvidenceVisibilityProjectionV1(row.projection_record);
    if (
      projection.trustEvidenceVisibilityProjectionId !==
        text(row.trust_evidence_visibility_projection_id, 'Trust Evidence projection id') ||
      projection.providerId !== text(row.provider_id, 'Trust Evidence projection provider id') ||
      projection.purpose !== row.purpose ||
      projection.audience.kind !== row.audience_kind ||
      projection.contextFingerprintSha256 !== row.context_fingerprint_sha256 ||
      projection.projectionFingerprintSha256 !== row.projection_fingerprint_sha256 ||
      projection.createdAt !== instant(row.created_at, 'Trust Evidence projection createdAt')
    ) {
      throw new OutcomeTrustEvidencePersistenceError(
        'PERSISTED_RECORD_INVALID',
        'Persisted Trust Evidence visibility projection mirrors do not match its canonical record.'
      );
    }
    return clone(projection);
  }

  private async readExplanation(
    client: QueryClient,
    trustExplanationId: TrustExplanationV1['trustExplanationId']
  ): Promise<Readonly<TrustExplanationV1> | undefined> {
    const result = await client.query(
      `SELECT * FROM mgsn_trust_explanations WHERE trust_explanation_id=$1`,
      [trustExplanationId]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return undefined;
    const explanation = parseTrustExplanationV1(row.explanation_record);
    if (
      explanation.trustExplanationId !== text(row.trust_explanation_id, 'Trust Explanation id') ||
      explanation.providerId !== text(row.provider_id, 'Trust Explanation provider id') ||
      explanation.contextFingerprintSha256 !== row.context_fingerprint_sha256 ||
      explanation.result !== row.result ||
      explanation.visibilityProjection.trustEvidenceVisibilityProjectionId !==
        row.trust_evidence_visibility_projection_id ||
      explanation.visibilityProjection.projectionFingerprintSha256 !==
        row.projection_fingerprint_sha256 ||
      explanation.trustExplanationFingerprintSha256 !== row.trust_explanation_fingerprint_sha256 ||
      explanation.createdAt !== instant(row.created_at, 'Trust Explanation createdAt')
    ) {
      throw new OutcomeTrustEvidencePersistenceError(
        'PERSISTED_RECORD_INVALID',
        'Persisted Trust Explanation mirrors do not match its canonical record.'
      );
    }
    return clone(explanation);
  }

  private rethrow(cause: unknown): never {
    if (cause instanceof OutcomeTrustEvidencePersistenceError) throw cause;
    throw new OutcomeTrustEvidencePersistenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Outcome & Trust Evidence persistence is unavailable.',
      503,
      true,
      { cause }
    );
  }
}
