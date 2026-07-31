import type { ProfessionalReviewCase, ProfessionalReviewCaseId } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import {
  ProfessionalReviewError,
  type ProfessionalReviewRepository
} from './professional-review.js';

type Row = Record<string, unknown>;
export interface ReviewTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

/** Execution-owned durable adapter. All predicates include the Workspace boundary. */
export class PostgresProfessionalReviewRepository implements ProfessionalReviewRepository {
  constructor(
    private readonly database: ReviewTransactionHost,
    private readonly query: QueryClient,
    private readonly workspaceId: string
  ) {}

  async create(v: ProfessionalReviewCase, key: string, fingerprint: string): Promise<void> {
    this.assertScope(v);
    try {
      await this.database.transact(async (client) => {
        const replay = await client.query(
          'SELECT request_fingerprint FROM professional_review_commands WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE',
          [this.workspaceId, key]
        );
        if (replay.rowCount) {
          if ((replay.rows[0] as Row).request_fingerprint !== fingerprint)
            throw new ProfessionalReviewError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different payload.'
            );
          return;
        }
        await client.query(
          'INSERT INTO professional_review_cases (professional_review_case_id,workspace_id,formal_matter_id,source_formal_matter_version,source_snapshot_sha256,status,version,review_case,created_by,updated_by,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9,$10,$10)',
          [
            v.reviewCaseId,
            this.workspaceId,
            v.formalMatterId,
            v.sourceFormalMatterVersion,
            v.sourceSnapshotSha256,
            v.status,
            v.version ?? 1,
            JSON.stringify(v),
            v.requestedBy,
            v.createdAt
          ]
        );
        await client.query(
          "INSERT INTO professional_review_commands (workspace_id,idempotency_key,request_fingerprint,professional_review_case_id,command_type,response_version,created_at) VALUES ($1,$2,$3,$4,'CREATE_OR_OPEN',$5,$6)",
          [this.workspaceId, key, fingerprint, v.reviewCaseId, v.version ?? 1, v.createdAt]
        );
        await client.query(
          "INSERT INTO professional_review_audit (workspace_id,professional_review_case_id,action,review_version,actor_id,created_at) VALUES ($1,$2,'REVIEW_OPENED',$3,$4,$5)",
          [this.workspaceId, v.reviewCaseId, v.version ?? 1, v.requestedBy, v.createdAt]
        );
      });
    } catch (cause) {
      if (cause instanceof ProfessionalReviewError) throw cause;
      if ((cause as { code?: string }).code === '23505')
        throw new ProfessionalReviewError(
          'ACTIVE_REVIEW_CASE_EXISTS',
          'An active Review Case already exists for this Formal Matter.',
          409
        );
      throw new ProfessionalReviewError(
        'PERSISTENCE_UNAVAILABLE',
        'Professional Review persistence is unavailable.',
        503
      );
    }
  }

  async findById(id: ProfessionalReviewCaseId) {
    const result = await this.query.query(
      'SELECT review_case,version,status,completed_at,completed_by FROM professional_review_cases WHERE workspace_id=$1 AND professional_review_case_id=$2',
      [this.workspaceId, id]
    );
    return result.rowCount ? this.map(result.rows[0] as Row) : undefined;
  }
  async list() {
    const result = await this.query.query(
      'SELECT review_case,version,status,completed_at,completed_by FROM professional_review_cases WHERE workspace_id=$1 ORDER BY updated_at DESC',
      [this.workspaceId]
    );
    return result.rows.map((row) => this.map(row as Row));
  }
  async findByIdempotencyKey(key: string) {
    const result = await this.query.query(
      'SELECT request_fingerprint,professional_review_case_id FROM professional_review_commands WHERE workspace_id=$1 AND idempotency_key=$2',
      [this.workspaceId, key]
    );
    return result.rowCount
      ? {
          fingerprint: String((result.rows[0] as Row).request_fingerprint),
          reviewCaseId: String(
            (result.rows[0] as Row).professional_review_case_id
          ) as ProfessionalReviewCaseId
        }
      : undefined;
  }
  async findActiveByMatterDraftVersion(id: never, version: string) {
    const result = await this.query.query(
      "SELECT review_case,version,status,completed_at,completed_by FROM professional_review_cases WHERE workspace_id=$1 AND review_case->'source'->>'matterDraftId'=$2 AND review_case->'source'->>'matterDraftVersion'=$3 AND status NOT IN ('STALE','WITHDRAWN','REVIEWED_READY_FOR_NEXT_STEP') LIMIT 1",
      [this.workspaceId, id, version]
    );
    return result.rowCount ? this.map(result.rows[0] as Row) : undefined;
  }
  claim(v: ProfessionalReviewCase) {
    return this.save(v, 'REVIEW_DRAFT_UPDATED');
  }
  updateChecklist(v: ProfessionalReviewCase) {
    return this.save(v, 'REVIEW_DRAFT_UPDATED');
  }
  prepareInformationRequest(v: ProfessionalReviewCase) {
    return this.save(v, 'REVIEW_DRAFT_UPDATED');
  }
  markStale(v: ProfessionalReviewCase) {
    return this.save(v, 'REVIEW_DRAFT_UPDATED');
  }
  withdraw(v: ProfessionalReviewCase) {
    return this.save(v, 'REVIEW_DRAFT_UPDATED');
  }
  recordDecision(v: ProfessionalReviewCase) {
    return this.save(v, 'REVIEW_COMPLETED');
  }

  private async save(
    v: ProfessionalReviewCase,
    action: 'REVIEW_DRAFT_UPDATED' | 'REVIEW_COMPLETED'
  ) {
    this.assertScope(v);
    const expected = (v.version ?? 1) - 1;
    const result = await this.query.query(
      'UPDATE professional_review_cases SET status=$3,version=$4,review_case=$5::jsonb,updated_by=$6,updated_at=$7,completed_at=$8,completed_by=$9 WHERE workspace_id=$1 AND professional_review_case_id=$2 AND version=$10 AND completed_at IS NULL',
      [
        this.workspaceId,
        v.reviewCaseId,
        v.status,
        v.version,
        JSON.stringify(v),
        v.completedBy ?? v.assignment.claimedBy ?? v.requestedBy,
        v.updatedAt,
        v.completedAt ?? null,
        v.completedBy ?? null,
        expected
      ]
    );
    if (!result.rowCount)
      throw new ProfessionalReviewError(
        'STALE_PROFESSIONAL_REVIEW',
        'The Review Case changed; reload the exact latest version.',
        409
      );
    await this.query.query(
      'INSERT INTO professional_review_audit (workspace_id,professional_review_case_id,action,review_version,actor_id,created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [
        this.workspaceId,
        v.reviewCaseId,
        action,
        v.version,
        v.completedBy ?? v.assignment.claimedBy ?? v.requestedBy,
        v.updatedAt
      ]
    );
  }
  private assertScope(v: ProfessionalReviewCase) {
    if (v.workspaceId !== this.workspaceId)
      throw new ProfessionalReviewError(
        'WORKSPACE_MISMATCH',
        'Workspace-scoped Review Case was not found.',
        404
      );
    if (!v.formalMatterId || !v.sourceFormalMatterVersion || !v.sourceSnapshotSha256)
      throw new ProfessionalReviewError(
        'INVALID_SOURCE',
        'Exact Formal Matter identity, version, and hash are required.',
        422
      );
  }
  private map(row: Row): ProfessionalReviewCase {
    return {
      ...(row.review_case as ProfessionalReviewCase),
      version: Number(row.version),
      status: String(row.status) as ProfessionalReviewCase['status'],
      ...(row.completed_at
        ? {
            completedAt: new Date(row.completed_at as string).toISOString(),
            completedBy: String(row.completed_by) as never
          }
        : {})
    };
  }
}
