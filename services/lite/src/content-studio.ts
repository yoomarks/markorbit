import {
  visualOutputStatuses,
  type VisualOutputReference
} from '@markorbit/contracts/daily-workspace';
import {
  contentDraftStatuses,
  contentOpportunityStatuses,
  contentReviewOutcomes,
  productLoopFeedbackOutcomes,
  type ContentDraft,
  type ContentOpportunity,
  type ContentReviewDecision,
  type ProductLoopUseFeedback,
  type PublishPackage
} from '@markorbit/contracts/product-loop';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';
import type { VisualBriefRecord } from './visual-bridge.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORK_ID = /^content-opportunity_[^\s]{1,280}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

/** Lite-local transport only. No Studio state is persisted. */
export interface ContentStudioWorkDetail {
  schemaVersion: 1;
  workspaceId: string;
  opportunity: ContentOpportunity;
  drafts: ContentDraft[];
  /** Exact historical versions reviewed, even if a newer draft version exists. */
  reviewedDrafts: ContentDraft[];
  reviews: ContentReviewDecision[];
  publishPackages: PublishPackage[];
  feedback: ProductLoopUseFeedback[];
  visualBriefs: VisualBriefRecord[];
  visualOutputs: VisualOutputReference[];
  partial: boolean;
  warnings: readonly ContentStudioWarning[];
}

export type ContentStudioWarning = 'VISUAL_HISTORY_NOT_DISCOVERABLE';

export interface ContentStudioWorkSummary {
  contentOpportunity: { id: ContentOpportunity['contentOpportunityId']; version: number };
  title: string;
  rationale: string;
  sources: ContentOpportunity['sources'];
  createdAt: string;
  updatedAt: string;
  latestDraft: Pick<
    ContentDraft,
    'contentDraftId' | 'version' | 'status' | 'title' | 'updatedAt'
  > | null;
  /** Only a decision covering latestDraft's exact version, never an inferred status. */
  latestDraftReview: ContentReviewDecision | null;
  latestPublishPackage: Omit<PublishPackage, 'body'> | null;
  latestPackageFeedback: ProductLoopUseFeedback | null;
  visualBriefCount: number;
  visualOutputCount: number;
}

export interface ContentStudioWorkList {
  schemaVersion: 1;
  workspaceId: string;
  items: ContentStudioWorkSummary[];
  nextAfter: string | null;
  partial: boolean;
  warnings: readonly ContentStudioWarning[];
}

export class ContentStudioError extends Error {
  constructor(
    readonly code:
      | 'INVALID_INPUT'
      | 'CONTENT_WORK_NOT_FOUND'
      | 'CONTENT_STUDIO_LINEAGE_INVALID'
      | 'PERSISTENCE_UNAVAILABLE',
    message: string,
    readonly status: number,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ContentStudioError';
  }
}

type Row = Record<string, unknown>;
type Document = { schemaVersion: 1; workspaceId: string; version: number };
const visualCoverage = (partial: boolean) => ({
  partial,
  warnings: partial ? (['VISUAL_HISTORY_NOT_DISCOVERABLE'] as const) : []
});

function valid(condition: unknown): asserts condition {
  if (!condition)
    throw new ContentStudioError(
      'CONTENT_STUDIO_LINEAGE_INVALID',
      'Stored Content Studio lineage is invalid.',
      503
    );
}

function workspace(value: string): string {
  const id = value.trim().toLowerCase();
  if (!UUID.test(id))
    throw new ContentStudioError('INVALID_INPUT', 'A Core Workspace UUID is required.', 422);
  return id;
}

function workId(value: string): string {
  if (!WORK_ID.test(value))
    throw new ContentStudioError('INVALID_INPUT', 'contentOpportunityId is invalid.', 422);
  return value;
}

function exact(id: string, version: number | string): string {
  return JSON.stringify([id, Number(version)]);
}

function documentOf<T extends Document>(
  row: Row,
  workspaceId: string,
  field: keyof T,
  column: string
): T {
  const doc = row.document_json as T | undefined;
  valid(doc && typeof doc === 'object' && !Array.isArray(doc));
  valid(
    doc.schemaVersion === 1 && doc.workspaceId === workspaceId && row.workspace_id === workspaceId
  );
  valid(Number.isInteger(doc.version) && doc.version > 0 && doc.version === row.version);
  valid(typeof doc[field] === 'string' && doc[field] === row[column]);
  return structuredClone(doc);
}

function timestamp(value: unknown): number {
  valid(typeof value === 'string' && Number.isFinite(Date.parse(value)));
  return Date.parse(value);
}

function opportunityOf(row: Row, workspaceId: string): ContentOpportunity {
  const doc = documentOf<ContentOpportunity>(
    row,
    workspaceId,
    'contentOpportunityId',
    'content_opportunity_id'
  );
  valid(WORK_ID.test(doc.contentOpportunityId));
  valid(
    doc.sourceRecommendation?.id === row.source_recommendation_id &&
      Number(doc.sourceRecommendation.version) === row.source_recommendation_version
  );
  valid(
    SHA256.test(doc.contentOpportunityFingerprintSha256) &&
      doc.contentOpportunityFingerprintSha256 === row.content_opportunity_fingerprint_sha256
  );
  valid(
    contentOpportunityStatuses.includes(doc.status) &&
      doc.publishAuthorized === false &&
      doc.formalBusinessOpportunityCreated === false
  );
  valid(
    typeof doc.title === 'string' &&
      typeof doc.rationale === 'string' &&
      Array.isArray(doc.sources) &&
      doc.sources.length > 0
  );
  timestamp(doc.createdAt);
  timestamp(doc.updatedAt);
  return doc;
}

function visualBriefOf(row: Row, workspaceId: string): VisualBriefRecord {
  const record = row.document_json as VisualBriefRecord | undefined;
  valid(record && typeof record === 'object' && !Array.isArray(record));
  const brief = record.brief;
  valid(
    brief?.schemaVersion === 1 &&
      brief.workspaceId === workspaceId &&
      row.workspace_id === workspaceId &&
      brief.visualBriefId === row.visual_brief_id &&
      brief.version === row.version
  );
  valid(
    brief.contentKit?.id === row.content_kit_id &&
      Number(brief.contentKit.version) === row.content_kit_version
  );
  valid(
    SHA256.test(record.visualBriefFingerprintSha256) &&
      record.visualBriefFingerprintSha256 === row.visual_brief_fingerprint_sha256
  );
  valid(
    typeof record.consumerIdentity?.ipId === 'string' &&
      typeof record.consumerIdentity.styleId === 'string' &&
      brief.paidExecutionAuthorized === false
  );
  timestamp(brief.createdAt);
  return structuredClone(record);
}

function visualOutputOf(row: Row, workspaceId: string): VisualOutputReference {
  const doc = row.document_json as VisualOutputReference | undefined;
  valid(doc && typeof doc === 'object' && !Array.isArray(doc));
  valid(
    doc.schemaVersion === 1 &&
      doc.workspaceId === workspaceId &&
      row.workspace_id === workspaceId &&
      doc.visualOutputReferenceId === row.visual_output_reference_id &&
      doc.version === row.version
  );
  valid(
    doc.visualBrief?.id === row.visual_brief_id &&
      Number(doc.visualBrief.version) === row.visual_brief_version
  );
  valid(
    doc.owner === 'VISUAL_ENGINE' &&
      doc.requestReference === row.request_reference &&
      (doc.outputReference ?? null) === row.output_reference &&
      doc.status === row.status &&
      visualOutputStatuses.includes(doc.status) &&
      (doc.qcStatus ?? null) === row.qc_status
  );
  valid(
    doc.providerExecutionAuthorizedByLite === false && doc.paidExecutionAuthorizedByLite === false
  );
  timestamp(doc.createdAt);
  return structuredClone(doc);
}

const compareId = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

function summary(detail: ContentStudioWorkDetail): ContentStudioWorkSummary {
  const { opportunity, drafts, reviews, publishPackages, feedback, visualBriefs, visualOutputs } =
    detail;
  const latestDraft = [...drafts].sort(
    (a, b) =>
      timestamp(b.updatedAt) - timestamp(a.updatedAt) ||
      compareId(a.contentDraftId, b.contentDraftId)
  )[0];
  const latestPackage = publishPackages.at(-1);
  return {
    contentOpportunity: { id: opportunity.contentOpportunityId, version: opportunity.version },
    title: opportunity.title,
    rationale: opportunity.rationale,
    sources: opportunity.sources,
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
    latestDraft: latestDraft
      ? {
          contentDraftId: latestDraft.contentDraftId,
          version: latestDraft.version,
          status: latestDraft.status,
          title: latestDraft.title,
          updatedAt: latestDraft.updatedAt
        }
      : null,
    latestDraftReview: latestDraft
      ? (reviews.find(
          (review) =>
            exact(review.contentDraft.id, review.contentDraft.version) ===
            exact(latestDraft.contentDraftId, latestDraft.version)
        ) ?? null)
      : null,
    latestPublishPackage: latestPackage
      ? {
          schemaVersion: latestPackage.schemaVersion,
          workspaceId: latestPackage.workspaceId,
          publishPackageId: latestPackage.publishPackageId,
          version: latestPackage.version,
          contentDraft: latestPackage.contentDraft,
          contentDraftFingerprintSha256: latestPackage.contentDraftFingerprintSha256,
          reviewDecision: latestPackage.reviewDecision,
          title: latestPackage.title,
          publishPackageFingerprintSha256: latestPackage.publishPackageFingerprintSha256,
          status: latestPackage.status,
          externalPublishExecuted: latestPackage.externalPublishExecuted,
          createdAt: latestPackage.createdAt
        }
      : null,
    latestPackageFeedback: latestPackage
      ? (feedback.find(
          (entry) =>
            exact(entry.publishPackage.id, entry.publishPackage.version) ===
            exact(latestPackage.publishPackageId, latestPackage.version)
        ) ?? null)
      : null,
    visualBriefCount: visualBriefs.length,
    visualOutputCount: visualOutputs.length
  };
}

export class PostgresContentStudioReader {
  constructor(private readonly database: LiteTransactionHost) {}

  async list(
    workspaceIdValue: string,
    options: Readonly<{ limit?: number; after?: string }> = {}
  ): Promise<ContentStudioWorkList> {
    const workspaceId = workspace(workspaceIdValue);
    const limit = options.limit ?? 20;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
      throw new ContentStudioError('INVALID_INPUT', 'limit must be between 1 and 50.', 422);
    const after = options.after === undefined ? '' : workId(options.after);
    return this.read(async (client) => {
      // Filter AFTER version dedupe. Unknown statuses reach validation instead of disappearing.
      const result = await client.query<Row>(
        `SELECT * FROM (
           SELECT DISTINCT ON (content_opportunity_id) * FROM lite_content_opportunities
           WHERE workspace_id=$1 ORDER BY content_opportunity_id,version DESC
         ) current_work
         WHERE COALESCE(document_json->>'status','') NOT IN ('CANDIDATE','REJECTED','DEFERRED')
           AND content_opportunity_id COLLATE "C" > $2::text COLLATE "C"
         ORDER BY content_opportunity_id COLLATE "C" LIMIT $3`,
        [workspaceId, after, limit + 1]
      );
      const opportunities = result.rows
        .slice(0, limit)
        .map((row) => opportunityOf(row, workspaceId));
      const lifecycle = await this.lifecycle(client, workspaceId, opportunities);
      return {
        schemaVersion: 1,
        workspaceId,
        items: lifecycle.details.map(summary),
        nextAfter: result.rows.length > limit ? opportunities.at(-1)!.contentOpportunityId : null,
        ...visualCoverage(lifecycle.visualHistoryPartial)
      };
    });
  }

  async find(
    workspaceIdValue: string,
    contentOpportunityId: string
  ): Promise<ContentStudioWorkDetail> {
    const workspaceId = workspace(workspaceIdValue);
    const id = workId(contentOpportunityId);
    return this.read(async (client) => {
      const result = await client.query<Row>(
        'SELECT * FROM lite_content_opportunities WHERE workspace_id=$1 AND content_opportunity_id=$2 ORDER BY version DESC LIMIT 1',
        [workspaceId, id]
      );
      if (!result.rows[0])
        throw new ContentStudioError('CONTENT_WORK_NOT_FOUND', 'Content work was not found.', 404);
      const opportunity = opportunityOf(result.rows[0], workspaceId);
      return (await this.lifecycle(client, workspaceId, [opportunity])).details[0]!;
    });
  }

  private async read<T>(operation: (client: QueryClient) => Promise<T>): Promise<T> {
    try {
      return await this.database.transact(operation, {
        isolation: 'REPEATABLE READ',
        readOnly: true
      });
    } catch (error) {
      if (error instanceof ContentStudioError) throw error;
      throw new ContentStudioError(
        'PERSISTENCE_UNAVAILABLE',
        'Content Studio persistence is unavailable.',
        503,
        { cause: error }
      );
    }
  }

  private async lifecycle(
    client: QueryClient,
    workspaceId: string,
    opportunities: ContentOpportunity[]
  ): Promise<Readonly<{ details: ContentStudioWorkDetail[]; visualHistoryPartial: boolean }>> {
    const coverageRows = await client.query<Row>(
      `SELECT EXISTS(
         SELECT 1 FROM lite_visual_briefs
         WHERE workspace_id=$1
           AND (content_opportunity_id IS NULL OR content_opportunity_version IS NULL)
       ) AS has_legacy`,
      [workspaceId]
    );
    const visualHistoryPartial = coverageRows.rows[0]?.has_legacy === true;
    if (!opportunities.length) return { details: [], visualHistoryPartial };
    // Batch the whole page in one read-only snapshot; never query per work or consult Daily Orbit.
    const opportunityMap = new Map(
      opportunities.map((doc) => [exact(doc.contentOpportunityId, doc.version), doc])
    );
    const draftRows = await client.query<Row>(
      `SELECT d.* FROM lite_content_drafts d
       JOIN unnest($2::text[],$3::integer[]) AS o(id,version)
         ON d.content_opportunity_id=o.id AND d.content_opportunity_version=o.version
       WHERE d.workspace_id=$1 ORDER BY d.content_draft_id COLLATE "C",d.version`,
      [
        workspaceId,
        opportunities.map((doc) => doc.contentOpportunityId),
        opportunities.map((doc) => doc.version)
      ]
    );
    const drafts = draftRows.rows.map((row) => {
      const doc = documentOf<ContentDraft>(row, workspaceId, 'contentDraftId', 'content_draft_id');
      valid(
        doc.contentOpportunity?.id === row.content_opportunity_id &&
          Number(doc.contentOpportunity.version) === row.content_opportunity_version
      );
      valid(opportunityMap.has(exact(doc.contentOpportunity.id, doc.contentOpportunity.version)));
      valid(
        SHA256.test(doc.contentDraftFingerprintSha256) &&
          doc.contentDraftFingerprintSha256 === row.content_draft_fingerprint_sha256
      );
      valid(doc.status === row.status && contentDraftStatuses.includes(doc.status));
      valid(
        doc.humanReviewRequired === true &&
          doc.published === false &&
          typeof doc.title === 'string' &&
          typeof doc.body === 'string'
      );
      timestamp(doc.createdAt);
      timestamp(doc.updatedAt);
      return doc;
    });
    const draftMap = new Map(drafts.map((doc) => [exact(doc.contentDraftId, doc.version), doc]));
    const draftIds = [...new Set(drafts.map((doc) => doc.contentDraftId))];
    const reviewRows = await client.query<Row>(
      'SELECT * FROM lite_content_review_decisions WHERE workspace_id=$1 AND content_draft_id=ANY($2::text[]) ORDER BY reviewed_at,content_review_decision_id COLLATE "C",version',
      [workspaceId, draftIds]
    );
    const reviews = reviewRows.rows.map((row) => {
      const doc = documentOf<ContentReviewDecision>(
        row,
        workspaceId,
        'contentReviewDecisionId',
        'content_review_decision_id'
      );
      valid(
        doc.contentDraft?.id === row.content_draft_id &&
          Number(doc.contentDraft.version) === row.content_draft_version
      );
      const draft = draftMap.get(exact(doc.contentDraft.id, doc.contentDraft.version));
      valid(
        draft && draft.contentDraftFingerprintSha256 === doc.expectedContentDraftFingerprintSha256
      );
      valid(
        doc.outcome === row.outcome &&
          contentReviewOutcomes.includes(doc.outcome) &&
          doc.publishesExternally === false
      );
      timestamp(doc.reviewedAt);
      return doc;
    });
    const reviewMap = new Map(
      reviews.map((doc) => [exact(doc.contentReviewDecisionId, doc.version), doc])
    );
    const packageRows = await client.query<Row>(
      `SELECT * FROM lite_publish_packages WHERE workspace_id=$1
       AND (content_draft_id=ANY($2::text[]) OR content_review_decision_id=ANY($3::text[]))
       ORDER BY created_at,publish_package_id COLLATE "C",version`,
      [workspaceId, draftIds, reviews.map((doc) => doc.contentReviewDecisionId)]
    );
    const publishPackages = packageRows.rows.map((row) => {
      const doc = documentOf<PublishPackage>(
        row,
        workspaceId,
        'publishPackageId',
        'publish_package_id'
      );
      valid(
        doc.contentDraft?.id === row.content_draft_id &&
          Number(doc.contentDraft.version) === row.content_draft_version
      );
      valid(
        doc.reviewDecision?.id === row.content_review_decision_id &&
          Number(doc.reviewDecision.version) === row.content_review_decision_version
      );
      const draft = draftMap.get(exact(doc.contentDraft.id, doc.contentDraft.version));
      const review = reviewMap.get(exact(doc.reviewDecision.id, doc.reviewDecision.version));
      valid(draft && review && review.outcome === 'APPROVED_FOR_PUBLISH_PACKAGE');
      valid(
        exact(review.contentDraft.id, review.contentDraft.version) ===
          exact(doc.contentDraft.id, doc.contentDraft.version)
      );
      valid(doc.contentDraftFingerprintSha256 === draft.contentDraftFingerprintSha256);
      valid(
        SHA256.test(doc.publishPackageFingerprintSha256) &&
          doc.publishPackageFingerprintSha256 === row.publish_package_fingerprint_sha256
      );
      valid(doc.status === 'PREPARED' && doc.externalPublishExecuted === false);
      timestamp(doc.createdAt);
      return doc;
    });
    const packageMap = new Map(
      publishPackages.map((doc) => [exact(doc.publishPackageId, doc.version), doc])
    );
    const feedbackRows = await client.query<Row>(
      'SELECT * FROM lite_product_loop_use_feedback WHERE workspace_id=$1 AND publish_package_id=ANY($2::text[]) ORDER BY recorded_at,product_loop_feedback_id COLLATE "C",version',
      [workspaceId, publishPackages.map((doc) => doc.publishPackageId)]
    );
    const feedback = feedbackRows.rows.map((row) => {
      const doc = documentOf<ProductLoopUseFeedback>(
        row,
        workspaceId,
        'productLoopFeedbackId',
        'product_loop_feedback_id'
      );
      valid(
        doc.publishPackage?.id === row.publish_package_id &&
          Number(doc.publishPackage.version) === row.publish_package_version
      );
      const pkg = packageMap.get(exact(doc.publishPackage.id, doc.publishPackage.version));
      valid(
        pkg &&
          pkg.publishPackageFingerprintSha256 === row.expected_publish_package_fingerprint_sha256
      );
      valid(doc.outcome === row.outcome && productLoopFeedbackOutcomes.includes(doc.outcome));
      valid(
        doc.externalActionExecutedByMarkOrbit === false &&
          doc.externalOutcomeVerifiedByMarkOrbit === false
      );
      timestamp(doc.recordedAt);
      return doc;
    });
    const visualBriefRows = await client.query<Row>(
      `SELECT b.* FROM lite_visual_briefs b
       JOIN unnest($2::text[],$3::integer[]) AS o(id,version)
         ON b.content_opportunity_id=o.id AND b.content_opportunity_version=o.version
       WHERE b.workspace_id=$1
       ORDER BY b.created_at,b.visual_brief_id COLLATE "C",b.version`,
      [
        workspaceId,
        opportunities.map((doc) => doc.contentOpportunityId),
        opportunities.map((doc) => doc.version)
      ]
    );
    const visualBriefOpportunityMap = new Map<string, string>();
    const visualBriefs = visualBriefRows.rows.map((row) => {
      const opportunityKey = exact(
        String(row.content_opportunity_id),
        Number(row.content_opportunity_version)
      );
      valid(opportunityMap.has(opportunityKey));
      const record = visualBriefOf(row, workspaceId);
      visualBriefOpportunityMap.set(
        exact(record.brief.visualBriefId, record.brief.version),
        opportunityKey
      );
      return record;
    });
    const visualBriefMap = new Map(
      visualBriefs.map((record) => [
        exact(record.brief.visualBriefId, record.brief.version),
        record
      ])
    );
    const visualOutputRows = await client.query<Row>(
      `SELECT o.* FROM lite_visual_output_references o
       JOIN unnest($2::text[],$3::integer[]) AS b(id,version)
         ON o.visual_brief_id=b.id AND o.visual_brief_version=b.version
       WHERE o.workspace_id=$1
       ORDER BY o.created_at,o.visual_output_reference_id COLLATE "C",o.version`,
      [
        workspaceId,
        visualBriefs.map((record) => record.brief.visualBriefId),
        visualBriefs.map((record) => record.brief.version)
      ]
    );
    const visualOutputs = visualOutputRows.rows.map((row) => {
      const doc = visualOutputOf(row, workspaceId);
      valid(visualBriefMap.has(exact(doc.visualBrief.id, doc.visualBrief.version)));
      return doc;
    });
    const details: ContentStudioWorkDetail[] = opportunities.map((opportunity) => {
      const workDrafts = drafts.filter(
        (doc) =>
          exact(doc.contentOpportunity.id, doc.contentOpportunity.version) ===
          exact(opportunity.contentOpportunityId, opportunity.version)
      );
      const workDraftKeys = new Set(
        workDrafts.map((doc) => exact(doc.contentDraftId, doc.version))
      );
      const latest = new Map<string, ContentDraft>();
      for (const draft of workDrafts) latest.set(draft.contentDraftId, draft);
      const workReviews = reviews.filter((doc) =>
        workDraftKeys.has(exact(doc.contentDraft.id, doc.contentDraft.version))
      );
      const reviewedKeys = new Set(
        workReviews.map((doc) => exact(doc.contentDraft.id, doc.contentDraft.version))
      );
      const workPackages = publishPackages.filter((doc) =>
        workDraftKeys.has(exact(doc.contentDraft.id, doc.contentDraft.version))
      );
      const packageKeys = new Set(
        workPackages.map((doc) => exact(doc.publishPackageId, doc.version))
      );
      const workVisualBriefs = visualBriefs.filter(
        (record) =>
          visualBriefOpportunityMap.get(exact(record.brief.visualBriefId, record.brief.version)) ===
          exact(opportunity.contentOpportunityId, opportunity.version)
      );
      const workVisualBriefKeys = new Set(
        workVisualBriefs.map((record) => exact(record.brief.visualBriefId, record.brief.version))
      );
      return {
        schemaVersion: 1,
        workspaceId,
        opportunity,
        drafts: [...latest.values()],
        reviewedDrafts: workDrafts.filter((doc) =>
          reviewedKeys.has(exact(doc.contentDraftId, doc.version))
        ),
        reviews: workReviews,
        publishPackages: workPackages,
        feedback: feedback.filter((doc) =>
          packageKeys.has(exact(doc.publishPackage.id, doc.publishPackage.version))
        ),
        visualBriefs: workVisualBriefs,
        visualOutputs: visualOutputs.filter((doc) =>
          workVisualBriefKeys.has(exact(doc.visualBrief.id, doc.visualBrief.version))
        ),
        ...visualCoverage(visualHistoryPartial)
      };
    });
    return { details, visualHistoryPartial };
  }
}
