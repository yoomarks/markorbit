import type {
  EvidenceReviewDecisionId,
  EvidenceReviewSource,
  EvidenceReceiptId
} from '@markorbit/contracts/evidence-lifecycle';
import type { EvidenceHandoffId, ProviderReturnId } from '@markorbit/contracts/provider-execution';
import type { QueryClient } from '@markorbit/persistence';
import {
  EvidenceReviewError,
  type ExecutionEvidenceCorrectionRequest,
  type ExecutionEvidenceReviewDecisionRecord,
  type ExecutionEvidenceReviewReplay,
  type ExecutionEvidenceReviewRepository
} from './evidence-review.js';

type Row = Record<string, unknown>;

export interface EvidenceReviewTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

export class PostgresEvidenceReviewRepository implements ExecutionEvidenceReviewRepository {
  constructor(
    private readonly database: EvidenceReviewTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findSourceByReceiptId(evidenceReceiptId: EvidenceReceiptId) {
    try {
      const result = await this.query.query(
        'SELECT source_record FROM execution_evidence_review_sources WHERE evidence_receipt_id=$1',
        [evidenceReceiptId]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).source_record as EvidenceReviewSource)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findSourceByHandoffId(evidenceHandoffId: EvidenceHandoffId) {
    try {
      const result = await this.query.query(
        'SELECT source_record FROM execution_evidence_review_sources WHERE evidence_handoff_id=$1',
        [evidenceHandoffId]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).source_record as EvidenceReviewSource)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async captureSource(source: EvidenceReviewSource, actorId: `${string}_${string}`) {
    try {
      return await this.database.transact(async (client) => {
        const raw = await client.query(
          `SELECT workspace_id::text,provider_return_id,provider_return_version,
                  provider_return_fingerprint_sha256,provider_id,correlation_id
             FROM execution_provider_return_evidence_receipts
            WHERE evidence_handoff_id=$1
            FOR UPDATE`,
          [source.evidenceHandoffId]
        );
        if (!raw.rowCount)
          throw new EvidenceReviewError(
            'STALE_SOURCE',
            'Execution evidence receipt disappeared before review capture.',
            409
          );
        const rawRow = raw.rows[0] as Row;
        if (
          String(rawRow.workspace_id) !== source.workspaceId ||
          String(rawRow.provider_return_id) !== source.providerReturn.id ||
          Number(rawRow.provider_return_version) !== Number(source.providerReturn.version) ||
          String(rawRow.provider_return_fingerprint_sha256) !==
            source.providerReturnFingerprintSha256 ||
          String(rawRow.provider_id) !== source.providerId ||
          String(rawRow.correlation_id) !== source.correlationId
        )
          throw new EvidenceReviewError(
            'SOURCE_VERSION_MISMATCH',
            'Execution evidence receipt lineage changed before review capture.',
            409
          );

        const existing = await client.query(
          `SELECT source_record,evidence_receipt_fingerprint_sha256
             FROM execution_evidence_review_sources
            WHERE evidence_handoff_id=$1
            FOR UPDATE`,
          [source.evidenceHandoffId]
        );
        if (existing.rowCount) {
          const row = existing.rows[0] as Row;
          const captured = row.source_record as EvidenceReviewSource;
          if (
            String(row.evidence_receipt_fingerprint_sha256) !==
            source.evidenceReceiptFingerprintSha256
          )
            throw new EvidenceReviewError(
              'SOURCE_FINGERPRINT_MISMATCH',
              'Captured evidence receipt already has a different fingerprint.',
              409
            );
          return captured;
        }

        await client.query(
          `INSERT INTO execution_evidence_review_sources(
             evidence_receipt_id,workspace_id,evidence_handoff_id,version,
             evidence_receipt_fingerprint_sha256,provider_return_id,provider_return_version,
             provider_return_fingerprint_sha256,provider_id,correlation_id,source_record,captured_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`,
          [
            source.evidenceReceipt.id,
            source.workspaceId,
            source.evidenceHandoffId,
            Number(source.evidenceReceipt.version),
            source.evidenceReceiptFingerprintSha256,
            source.providerReturn.id,
            Number(source.providerReturn.version),
            source.providerReturnFingerprintSha256,
            source.providerId,
            source.correlationId,
            JSON.stringify(source),
            source.capturedAt
          ]
        );
        await client.query(
          `INSERT INTO execution_evidence_review_audit(
             workspace_id,target_type,target_id,action,actor_id,source_fingerprint,details,created_at
           ) VALUES($1,'EVIDENCE_RECEIPT',$2,'EVIDENCE_RECEIPT_SOURCE_CAPTURED',$3,$4,$5::jsonb,$6)`,
          [
            source.workspaceId,
            source.evidenceReceipt.id,
            actorId,
            source.evidenceReceiptFingerprintSha256,
            JSON.stringify({
              evidenceHandoffId: source.evidenceHandoffId,
              providerReturn: source.providerReturn
            }),
            source.capturedAt
          ]
        );
        return source;
      });
    } catch (cause) {
      if (cause instanceof EvidenceReviewError) throw cause;
      if ((cause as { code?: string }).code === '23505') {
        const existing = await this.findSourceByHandoffId(source.evidenceHandoffId);
        if (
          existing &&
          existing.evidenceReceiptFingerprintSha256 === source.evidenceReceiptFingerprintSha256
        )
          return existing;
        throw new EvidenceReviewError(
          'VERSION_CONFLICT',
          'Evidence receipt review source changed concurrently.',
          409
        );
      }
      throw this.unavailable(cause);
    }
  }

  async hasNewerReceipt(providerReturnId: ProviderReturnId, providerReturnVersion: number) {
    try {
      const result = await this.query.query(
        `SELECT 1
           FROM execution_provider_return_evidence_receipts
          WHERE provider_return_id=$1 AND provider_return_version>$2
          LIMIT 1`,
        [providerReturnId, providerReturnVersion]
      );
      return Boolean(result.rowCount);
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findReplay(workspaceId: string, idempotencyKey: string) {
    try {
      const result = await this.query.query(
        `SELECT request_fingerprint,response_record
           FROM execution_evidence_review_commands
          WHERE workspace_id=$1 AND idempotency_key=$2`,
        [workspaceId, idempotencyKey]
      );
      return result.rowCount ? this.mapReplay(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findDecisionByReceipt(evidenceReceiptId: EvidenceReceiptId) {
    try {
      const result = await this.query.query(
        `SELECT decision_record
           FROM execution_evidence_review_decisions
          WHERE evidence_receipt_id=$1`,
        [evidenceReceiptId]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).decision_record as ExecutionEvidenceReviewDecisionRecord)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findDecisionById(evidenceReviewDecisionId: EvidenceReviewDecisionId) {
    try {
      const result = await this.query.query(
        `SELECT decision_record
           FROM execution_evidence_review_decisions
          WHERE evidence_review_decision_id=$1`,
        [evidenceReviewDecisionId]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).decision_record as ExecutionEvidenceReviewDecisionRecord)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findCorrectionRequestForDecision(evidenceReviewDecisionId: EvidenceReviewDecisionId) {
    try {
      const result = await this.query.query(
        `SELECT request_record
           FROM execution_evidence_correction_requests
          WHERE evidence_review_decision_id=$1`,
        [evidenceReviewDecisionId]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).request_record as ExecutionEvidenceCorrectionRequest)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async recordDecision(
    decision: ExecutionEvidenceReviewDecisionRecord,
    correctionRequest: ExecutionEvidenceCorrectionRequest | undefined,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const sourceLock = await client.query(
          `SELECT source_record,evidence_receipt_fingerprint_sha256,provider_return_id,provider_return_version
             FROM execution_evidence_review_sources
            WHERE workspace_id=$1 AND evidence_receipt_id=$2
            FOR UPDATE`,
          [decision.workspaceId, decision.source.evidenceReceipt.id]
        );
        if (!sourceLock.rowCount)
          throw new EvidenceReviewError(
            'STALE_SOURCE',
            'Evidence review source was not found.',
            409
          );
        const sourceRow = sourceLock.rows[0] as Row;
        const storedSource = sourceRow.source_record as EvidenceReviewSource;
        if (
          Number(storedSource.evidenceReceipt.version) !==
            Number(decision.source.evidenceReceipt.version) ||
          String(sourceRow.evidence_receipt_fingerprint_sha256) !==
            decision.source.evidenceReceiptFingerprintSha256
        )
          throw new EvidenceReviewError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Evidence review source changed before the decision was recorded.',
            409
          );

        const replay = await client.query(
          `SELECT request_fingerprint,response_record
             FROM execution_evidence_review_commands
            WHERE workspace_id=$1 AND idempotency_key=$2
            FOR UPDATE`,
          [decision.workspaceId, idempotencyKey]
        );
        if (replay.rowCount) {
          const value = this.mapReplay(replay.rows[0] as Row);
          if (value.requestFingerprint !== requestFingerprint)
            throw new EvidenceReviewError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different Evidence Review Decision payload.',
              409
            );
          return value.decision;
        }

        const newer = await client.query(
          `SELECT 1
             FROM execution_provider_return_evidence_receipts
            WHERE provider_return_id=$1 AND provider_return_version>$2
            LIMIT 1`,
          [String(sourceRow.provider_return_id), Number(sourceRow.provider_return_version)]
        );
        if (newer.rowCount)
          throw new EvidenceReviewError(
            'STALE_SOURCE',
            'A newer Provider Return evidence receipt supersedes this review source.',
            409
          );

        const existing = await client.query(
          `SELECT evidence_review_decision_id
             FROM execution_evidence_review_decisions
            WHERE evidence_receipt_id=$1
            FOR UPDATE`,
          [decision.source.evidenceReceipt.id]
        );
        if (existing.rowCount)
          throw new EvidenceReviewError(
            'VERSION_CONFLICT',
            'An authoritative review decision already exists for this exact evidence receipt.',
            409
          );

        await client.query(
          `INSERT INTO execution_evidence_review_decisions(
             evidence_review_decision_id,workspace_id,evidence_receipt_id,evidence_receipt_version,
             evidence_receipt_fingerprint_sha256,version,outcome,reviewer_principal_id,rationale,
             correction_reasons,decision_fingerprint_sha256,decision_record,reviewed_at,correlation_id
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13,$14)`,
          [
            decision.evidenceReviewDecisionId,
            decision.workspaceId,
            decision.source.evidenceReceipt.id,
            Number(decision.source.evidenceReceipt.version),
            decision.source.evidenceReceiptFingerprintSha256,
            decision.version,
            decision.outcome,
            decision.reviewerPrincipalId,
            decision.rationale,
            JSON.stringify(decision.correctionReasons),
            decision.decisionFingerprintSha256,
            JSON.stringify(decision),
            decision.reviewedAt,
            decision.correlationId
          ]
        );
        await client.query(
          `INSERT INTO execution_evidence_review_audit(
             workspace_id,target_type,target_id,action,actor_id,source_fingerprint,details,created_at
           ) VALUES($1,'EVIDENCE_REVIEW_DECISION',$2,'EVIDENCE_REVIEW_DECISION_RECORDED',$3,$4,$5::jsonb,$6)`,
          [
            decision.workspaceId,
            decision.evidenceReviewDecisionId,
            decision.reviewerPrincipalId,
            decision.source.evidenceReceiptFingerprintSha256,
            JSON.stringify({
              evidenceReceipt: decision.source.evidenceReceipt,
              outcome: decision.outcome,
              decisionFingerprintSha256: decision.decisionFingerprintSha256
            }),
            decision.reviewedAt
          ]
        );

        if (correctionRequest) {
          await client.query(
            `INSERT INTO execution_evidence_correction_requests(
               correction_request_id,workspace_id,evidence_review_decision_id,evidence_receipt_id,
               provider_return_id,provider_return_version,reasons,requested_by,status,request_record,created_at
             ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11)`,
            [
              correctionRequest.correctionRequestId,
              correctionRequest.workspaceId,
              correctionRequest.evidenceReviewDecisionId,
              correctionRequest.evidenceReceipt.id,
              correctionRequest.providerReturn.id,
              Number(correctionRequest.providerReturn.version),
              JSON.stringify(correctionRequest.reasons),
              correctionRequest.requestedBy,
              correctionRequest.status,
              JSON.stringify(correctionRequest),
              correctionRequest.createdAt
            ]
          );
          await client.query(
            `INSERT INTO execution_evidence_review_audit(
               workspace_id,target_type,target_id,action,actor_id,source_fingerprint,details,created_at
             ) VALUES($1,'CORRECTION_REQUEST',$2,'CORRECTION_REQUEST_CREATED',$3,$4,$5::jsonb,$6)`,
            [
              correctionRequest.workspaceId,
              correctionRequest.correctionRequestId,
              correctionRequest.requestedBy,
              decision.source.evidenceReceiptFingerprintSha256,
              JSON.stringify({
                evidenceReviewDecisionId: correctionRequest.evidenceReviewDecisionId,
                providerReturn: correctionRequest.providerReturn
              }),
              correctionRequest.createdAt
            ]
          );
        }

        await client.query(
          `INSERT INTO execution_evidence_review_commands(
             workspace_id,idempotency_key,request_fingerprint,evidence_review_decision_id,response_record,created_at
           ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
          [
            decision.workspaceId,
            idempotencyKey,
            requestFingerprint,
            decision.evidenceReviewDecisionId,
            JSON.stringify(decision),
            decision.reviewedAt
          ]
        );
        return decision;
      });
    } catch (cause) {
      if (cause instanceof EvidenceReviewError) throw cause;
      if ((cause as { code?: string }).code === '23505')
        throw new EvidenceReviewError(
          'VERSION_CONFLICT',
          'Evidence Review Decision changed concurrently.',
          409
        );
      throw this.unavailable(cause);
    }
  }

  private mapReplay(row: Row): ExecutionEvidenceReviewReplay {
    return {
      requestFingerprint: String(row.request_fingerprint),
      decision: row.response_record as ExecutionEvidenceReviewDecisionRecord
    };
  }

  private unavailable(cause: unknown) {
    if (cause instanceof EvidenceReviewError) return cause;
    return new EvidenceReviewError(
      'PERSISTENCE_UNAVAILABLE',
      'Execution Evidence Review persistence is unavailable.',
      503,
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }
}
