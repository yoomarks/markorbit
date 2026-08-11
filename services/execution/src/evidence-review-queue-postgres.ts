import type { EvidenceReviewSource } from '@markorbit/contracts/evidence-lifecycle';
import type { QueryClient } from '@markorbit/persistence';
import { EvidenceReviewError } from './evidence-review.js';
import type { ExecutionProviderReturnEvidenceReceipt } from './provider-return-evidence.js';

type Row = Record<string, unknown>;

export interface EvidenceReviewQueueItem {
  receipt: ExecutionProviderReturnEvidenceReceipt;
  source?: EvidenceReviewSource;
}

export interface EvidenceReviewQueueReader {
  list(workspaceId: string, limit?: number): Promise<readonly EvidenceReviewQueueItem[]>;
}

export class PostgresEvidenceReviewQueueReader implements EvidenceReviewQueueReader {
  constructor(private readonly query: QueryClient) {}

  async list(workspaceId: string, limit = 100): Promise<readonly EvidenceReviewQueueItem[]> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    try {
      const result = await this.query.query(
        `SELECT r.receipt_record,s.source_record
           FROM execution_provider_return_evidence_receipts r
           LEFT JOIN execution_evidence_review_sources s
             ON s.workspace_id=r.workspace_id
            AND s.evidence_handoff_id=r.evidence_handoff_id
           LEFT JOIN execution_evidence_review_decisions d
             ON d.workspace_id=r.workspace_id
            AND d.evidence_receipt_id=s.evidence_receipt_id
          WHERE r.workspace_id=$1
            AND r.review_status='PENDING_REVIEW'
            AND d.evidence_review_decision_id IS NULL
          ORDER BY r.received_at ASC,r.evidence_handoff_id ASC
          LIMIT $2`,
        [workspaceId, boundedLimit]
      );
      return result.rows.map((row) => {
        const value = row as Row;
        const source = value.source_record as EvidenceReviewSource | null | undefined;
        return {
          receipt: structuredClone(value.receipt_record as ExecutionProviderReturnEvidenceReceipt),
          ...(source ? { source: structuredClone(source) } : {})
        };
      });
    } catch (cause) {
      throw new EvidenceReviewError(
        'PERSISTENCE_UNAVAILABLE',
        'Execution evidence review queue persistence is unavailable.',
        503,
        { cause: cause instanceof Error ? cause.message : String(cause) }
      );
    }
  }
}
