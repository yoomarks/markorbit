import {
  betaReadinessNoAuthorityConsequences,
  productConversionAnalyticsSourceFamilies,
  type ProductConversionRate,
  type ProductLoopConversionAnalyticsSnapshot
} from '@markorbit/contracts/beta-readiness';
import type { QueryClient } from '@markorbit/persistence';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

export type ProductConversionAnalyticsErrorCode = 'INVALID_INPUT' | 'PERSISTENCE_UNAVAILABLE';

export class ProductConversionAnalyticsError extends Error {
  constructor(
    readonly code: ProductConversionAnalyticsErrorCode,
    message: string,
    readonly status = 409,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductConversionAnalyticsError';
  }
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new ProductConversionAnalyticsError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function exactTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new ProductConversionAnalyticsError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  return parsed.toISOString();
}

function count(row: Row, field: string): number {
  const value = Number(row[field] ?? 0);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ProductConversionAnalyticsError(
      'PERSISTENCE_UNAVAILABLE',
      `Conversion analytics count ${field} is invalid.`,
      503
    );
  return value;
}

export function productConversionRate(
  numerator: number,
  denominator: number
): ProductConversionRate {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : Number((numerator / denominator).toFixed(6))
  };
}

export class PostgresProductConversionAnalyticsStore {
  constructor(
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async snapshot(workspaceIdValue: string): Promise<ProductLoopConversionAnalyticsSnapshot> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    try {
      const result = await this.query.query(
        `WITH
         content_opportunities AS (
           SELECT DISTINCT content_opportunity_id
           FROM lite_content_opportunities
           WHERE workspace_id=$1
         ),
         drafted_opportunities AS (
           SELECT DISTINCT content_opportunity_id
           FROM lite_content_drafts
           WHERE workspace_id=$1
         ),
         reviewed_opportunities AS (
           SELECT DISTINCT d.content_opportunity_id
           FROM lite_content_review_decisions r
           JOIN lite_content_drafts d
             ON d.workspace_id=r.workspace_id
            AND d.content_draft_id=r.content_draft_id
            AND d.version=r.content_draft_version
           WHERE r.workspace_id=$1
         ),
         packaged_opportunities AS (
           SELECT DISTINCT d.content_opportunity_id
           FROM lite_publish_packages p
           JOIN lite_content_drafts d
             ON d.workspace_id=p.workspace_id
            AND d.content_draft_id=p.content_draft_id
            AND d.version=p.content_draft_version
           WHERE p.workspace_id=$1
         ),
         feedback_opportunities AS (
           SELECT DISTINCT d.content_opportunity_id
           FROM lite_product_loop_use_feedback f
           JOIN lite_publish_packages p
             ON p.workspace_id=f.workspace_id
            AND p.publish_package_id=f.publish_package_id
            AND p.version=f.publish_package_version
           JOIN lite_content_drafts d
             ON d.workspace_id=p.workspace_id
            AND d.content_draft_id=p.content_draft_id
            AND d.version=p.content_draft_version
           WHERE f.workspace_id=$1
         ),
         opportunity_candidates AS (
           SELECT DISTINCT opportunity_candidate_id
           FROM lite_opportunity_candidates
           WHERE workspace_id=$1
         ),
         qualification_decisions AS (
           SELECT DISTINCT opportunity_candidate_id
           FROM lite_opportunity_qualification_decisions
           WHERE workspace_id=$1
         ),
         qualified_candidates AS (
           SELECT DISTINCT opportunity_candidate_id
           FROM lite_opportunity_qualification_decisions
           WHERE workspace_id=$1 AND outcome='QUALIFIED_FOR_MARKREG'
         ),
         formal_handoffs AS (
           SELECT DISTINCT q.opportunity_candidate_id
           FROM lite_prepared_action_handoff_results h
           JOIN lite_prepared_actions a
             ON a.workspace_id=h.workspace_id
            AND a.prepared_action_id=h.prepared_action_id
            AND a.version=h.prepared_action_version
           JOIN lite_opportunity_qualification_decisions q
             ON q.workspace_id=a.workspace_id
            AND q.opportunity_candidate_id=(a.plan_json->'candidate'->>'id')
            AND q.opportunity_qualification_decision_id=(a.plan_json->'qualificationDecision'->>'id')
            AND q.version::text=(a.plan_json->'qualificationDecision'->>'version')
           WHERE h.workspace_id=$1
             AND h.handoff_target='MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY'
             AND h.owner='MARKREG'
             AND a.kind='CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY'
             AND q.outcome='QUALIFIED_FOR_MARKREG'
         )
         SELECT
           (SELECT count(*) FROM content_opportunities)::int AS content_opportunities,
           (SELECT count(*) FROM drafted_opportunities)::int AS draft_prepared,
           (SELECT count(*) FROM reviewed_opportunities)::int AS human_review_recorded,
           (SELECT count(*) FROM packaged_opportunities)::int AS publish_packages_prepared,
           (SELECT count(*) FROM feedback_opportunities)::int AS user_reported_use_feedback,
           (SELECT count(*) FROM opportunity_candidates)::int AS opportunity_candidates,
           (SELECT count(*) FROM qualification_decisions)::int AS qualification_decisions,
           (SELECT count(*) FROM qualified_candidates)::int AS qualified_for_markreg,
           (SELECT count(*) FROM formal_handoffs)::int AS formal_opportunity_handoff_results`,
        [workspaceId]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row)
        throw new ProductConversionAnalyticsError(
          'PERSISTENCE_UNAVAILABLE',
          'Conversion analytics query returned no snapshot row.',
          503
        );

      const contentOpportunities = count(row, 'content_opportunities');
      const draftPrepared = count(row, 'draft_prepared');
      const humanReviewRecorded = count(row, 'human_review_recorded');
      const publishPackagesPrepared = count(row, 'publish_packages_prepared');
      const userReportedUseFeedback = count(row, 'user_reported_use_feedback');
      const opportunityCandidates = count(row, 'opportunity_candidates');
      const qualificationDecisions = count(row, 'qualification_decisions');
      const qualifiedForMarkReg = count(row, 'qualified_for_markreg');
      const formalOpportunityHandoffResults = count(row, 'formal_opportunity_handoff_results');

      return {
        schemaVersion: 1,
        workspaceId,
        owner: 'LITE',
        scope: 'WORKSPACE_ALL_TIME',
        generatedAt: exactTimestamp(this.now(), 'now'),
        sourceFamilies: productConversionAnalyticsSourceFamilies,
        content: {
          contentOpportunities,
          draftPrepared,
          humanReviewRecorded,
          publishPackagesPrepared,
          userReportedUseFeedback,
          rates: {
            opportunityToDraft: productConversionRate(draftPrepared, contentOpportunities),
            draftToHumanReview: productConversionRate(humanReviewRecorded, draftPrepared),
            humanReviewToPublishPackage: productConversionRate(
              publishPackagesPrepared,
              humanReviewRecorded
            ),
            publishPackageToUseFeedback: productConversionRate(
              userReportedUseFeedback,
              publishPackagesPrepared
            )
          }
        },
        opportunity: {
          opportunityCandidates,
          qualificationDecisions,
          qualifiedForMarkReg,
          formalOpportunityHandoffResults,
          rates: {
            candidateToQualification: productConversionRate(
              qualificationDecisions,
              opportunityCandidates
            ),
            qualificationToQualified: productConversionRate(
              qualifiedForMarkReg,
              qualificationDecisions
            ),
            qualifiedToFormalOpportunityHandoff: productConversionRate(
              formalOpportunityHandoffResults,
              qualifiedForMarkReg
            )
          }
        },
        crossOwnerEvidence: {
          evidenceOwner: 'LITE',
          downstreamOwner: 'MARKREG',
          sourceKind: 'PREPARED_ACTION_HANDOFF_RESULT',
          directMarkRegQueryPerformed: false
        },
        observationalOnly: true,
        mutatesBusinessState: false,
        userReportedExternalUseVerified: false,
        authority: betaReadinessNoAuthorityConsequences
      };
    } catch (error) {
      if (error instanceof ProductConversionAnalyticsError) throw error;
      throw new ProductConversionAnalyticsError(
        'PERSISTENCE_UNAVAILABLE',
        'Product conversion analytics persistence is unavailable.',
        503,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
