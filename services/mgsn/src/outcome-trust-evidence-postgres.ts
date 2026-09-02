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
import {
  OutcomeTrustEvidenceRuntimeError,
  type OutcomeTrustEvidenceRepository
} from './outcome-trust-evidence.js';

type Row = Record<string, unknown>;

export interface OutcomeTrustEvidenceTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

function same(left: unknown, right: unknown): boolean {
  return isDeepStrictEqual(structuredClone(left), structuredClone(right));
}

function unavailable(cause: unknown): OutcomeTrustEvidenceRuntimeError {
  if (cause instanceof OutcomeTrustEvidenceRuntimeError) return cause;
  return new OutcomeTrustEvidenceRuntimeError(
    'AUTHORITY_UNAVAILABLE',
    503,
    'Durable Outcome & Trust Evidence state is unavailable.'
  );
}

function immutable(message: string): OutcomeTrustEvidenceRuntimeError {
  return new OutcomeTrustEvidenceRuntimeError('INVALID_INPUT', 409, message);
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
        const lockKey = `trust-evidence:item:${item.trustEvidenceItemId}:${item.version}`;
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [lockKey]);
        const existing = await client.query(
          `SELECT * FROM mgsn_trust_evidence_items
           WHERE trust_evidence_item_id=$1 AND version=$2`,
          [item.trustEvidenceItemId, item.version]
        );
        if (existing.rows[0]) {
          const persisted = this.itemFromRow(existing.rows[0] as Row);
          if (same(persisted, item)) return;
          throw immutable('Trust Evidence item identity/version is immutable.');
        }
        await client.query(
          `INSERT INTO mgsn_trust_evidence_items(
             trust_evidence_item_id,version,provider_id,lifecycle_state,context_fingerprint_sha256,
             source_kind,source_authority_state,freshness_state,trust_evidence_item_fingerprint_sha256,
             item_record,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
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
      throw unavailable(cause);
    }
  }

  async findEvidenceItem(
    reference: Readonly<TrustEvidenceItemReferenceV1>
  ): Promise<Readonly<TrustEvidenceItemV1> | undefined> {
    try {
      const result = await this.query.query(
        `SELECT * FROM mgsn_trust_evidence_items
         WHERE trust_evidence_item_id=$1 AND version=$2 AND trust_evidence_item_fingerprint_sha256=$3`,
        [
          reference.trustEvidenceItemId,
          reference.version,
          reference.trustEvidenceItemFingerprintSha256
        ]
      );
      return result.rows[0] ? this.itemFromRow(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  async putProjection(value: Readonly<TrustEvidenceVisibilityProjectionV1>): Promise<void> {
    const projection = parseTrustEvidenceVisibilityProjectionV1(value);
    try {
      await this.database.transact(async (client) => {
        const lockKey = `trust-evidence:projection:${projection.trustEvidenceVisibilityProjectionId}`;
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [lockKey]);
        const existing = await client.query(
          `SELECT * FROM mgsn_trust_evidence_visibility_projections
           WHERE trust_evidence_visibility_projection_id=$1`,
          [projection.trustEvidenceVisibilityProjectionId]
        );
        if (existing.rows[0]) {
          const persisted = this.projectionFromRow(existing.rows[0] as Row);
          if (same(persisted, projection)) return;
          throw immutable('Trust Evidence visibility projection identity is immutable.');
        }
        await client.query(
          `INSERT INTO mgsn_trust_evidence_visibility_projections(
             trust_evidence_visibility_projection_id,provider_id,purpose,audience_kind,
             context_fingerprint_sha256,projection_fingerprint_sha256,projection_record,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
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
      throw unavailable(cause);
    }
  }

  async findProjection(
    projectionId: TrustEvidenceVisibilityProjectionIdV1
  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined> {
    try {
      const result = await this.query.query(
        `SELECT * FROM mgsn_trust_evidence_visibility_projections
         WHERE trust_evidence_visibility_projection_id=$1`,
        [projectionId]
      );
      return result.rows[0] ? this.projectionFromRow(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  async putExplanation(value: Readonly<TrustExplanationV1>): Promise<void> {
    const explanation = parseTrustExplanationV1(value);
    try {
      await this.database.transact(async (client) => {
        const lockKey = `trust-evidence:explanation:${explanation.trustExplanationId}`;
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [lockKey]);
        const existing = await client.query(
          `SELECT * FROM mgsn_trust_explanations WHERE trust_explanation_id=$1`,
          [explanation.trustExplanationId]
        );
        if (existing.rows[0]) {
          const persisted = this.explanationFromRow(existing.rows[0] as Row);
          if (same(persisted, explanation)) return;
          throw immutable('Trust Explanation identity is immutable.');
        }
        await client.query(
          `INSERT INTO mgsn_trust_explanations(
             trust_explanation_id,provider_id,context_fingerprint_sha256,result,
             trust_evidence_visibility_projection_id,projection_fingerprint_sha256,
             trust_explanation_fingerprint_sha256,explanation_record,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
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
      throw unavailable(cause);
    }
  }

  async findExplanation(
    trustExplanationId: TrustExplanationV1['trustExplanationId']
  ): Promise<Readonly<TrustExplanationV1> | undefined> {
    try {
      const result = await this.query.query(
        `SELECT * FROM mgsn_trust_explanations WHERE trust_explanation_id=$1`,
        [trustExplanationId]
      );
      return result.rows[0] ? this.explanationFromRow(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  private itemFromRow(row: Row): Readonly<TrustEvidenceItemV1> {
    const item = parseTrustEvidenceItemV1(row.item_record);
    if (
      row.trust_evidence_item_id !== item.trustEvidenceItemId ||
      Number(row.version) !== item.version ||
      row.provider_id !== item.providerId ||
      row.lifecycle_state !== item.lifecycleState ||
      row.context_fingerprint_sha256 !== item.context.contextFingerprintSha256 ||
      row.source_kind !== item.source.kind ||
      row.source_authority_state !== item.sourceAuthority.authorityState ||
      row.freshness_state !== item.freshness.state ||
      row.trust_evidence_item_fingerprint_sha256 !== item.trustEvidenceItemFingerprintSha256 ||
      new Date(String(row.created_at)).toISOString() !== item.createdAt
    ) {
      throw new Error(
        'Persisted Trust Evidence item normalized state conflicts with canonical record.'
      );
    }
    return structuredClone(item);
  }

  private projectionFromRow(row: Row): Readonly<TrustEvidenceVisibilityProjectionV1> {
    const projection = parseTrustEvidenceVisibilityProjectionV1(row.projection_record);
    if (
      row.trust_evidence_visibility_projection_id !==
        projection.trustEvidenceVisibilityProjectionId ||
      row.provider_id !== projection.providerId ||
      row.purpose !== projection.purpose ||
      row.audience_kind !== projection.audience.kind ||
      row.context_fingerprint_sha256 !== projection.contextFingerprintSha256 ||
      row.projection_fingerprint_sha256 !== projection.projectionFingerprintSha256 ||
      new Date(String(row.created_at)).toISOString() !== projection.createdAt
    ) {
      throw new Error(
        'Persisted Trust Evidence projection normalized state conflicts with canonical record.'
      );
    }
    return structuredClone(projection);
  }

  private explanationFromRow(row: Row): Readonly<TrustExplanationV1> {
    const explanation = parseTrustExplanationV1(row.explanation_record);
    if (
      row.trust_explanation_id !== explanation.trustExplanationId ||
      row.provider_id !== explanation.providerId ||
      row.context_fingerprint_sha256 !== explanation.contextFingerprintSha256 ||
      row.result !== explanation.result ||
      row.trust_evidence_visibility_projection_id !==
        explanation.visibilityProjection.trustEvidenceVisibilityProjectionId ||
      row.projection_fingerprint_sha256 !==
        explanation.visibilityProjection.projectionFingerprintSha256 ||
      row.trust_explanation_fingerprint_sha256 !== explanation.trustExplanationFingerprintSha256 ||
      new Date(String(row.created_at)).toISOString() !== explanation.createdAt
    ) {
      throw new Error(
        'Persisted Trust Explanation normalized state conflicts with canonical record.'
      );
    }
    return structuredClone(explanation);
  }
}
