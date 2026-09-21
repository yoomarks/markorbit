import type { RelationshipModel } from '@markorbit/contracts';
import type {
  LiteTodaySnapshot,
  OpportunityCandidate,
  OpportunityCandidateId,
  OpportunityQualificationDecision,
  PreparedActionJourney,
  ProductLoopFeedbackOutcome,
  ProductLoopSourceReference,
  ProductLoopUseFeedback,
  PublishPackage,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export type TodayProductLoopSnapshot = LiteTodaySnapshot & {
  recentFeedback: ReadonlyArray<Readonly<ProductLoopUseFeedback>>;
  feedbackPendingPackages: ReadonlyArray<Readonly<PublishPackage>>;
};

export class TodayHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'TodayHttpError';
  }
}

export interface QualifiedOpportunityReviewEvidence {
  readonly source: Readonly<ProductLoopSourceReference>;
  readonly candidate: Readonly<OpportunityCandidate>;
  readonly qualificationDecision: Readonly<OpportunityQualificationDecision>;
}

export interface TodayClient {
  loadToday(): Promise<TodayProductLoopSnapshot>;
  loadPreparedAction(preparedActionId: string): Promise<PreparedActionJourney>;
  loadQualifiedOpportunityReview(
    recommendation: Readonly<TodayRecommendation>
  ): Promise<QualifiedOpportunityReviewEvidence>;
  prepareContent(recommendation: Readonly<TodayRecommendation>): Promise<PreparedActionJourney>;
  prepareQualifiedOpportunity(
    recommendation: Readonly<TodayRecommendation>,
    evidence: Readonly<QualifiedOpportunityReviewEvidence>,
    relationshipModel: RelationshipModel
  ): Promise<PreparedActionJourney>;
  confirm(journey: Readonly<PreparedActionJourney>): Promise<PreparedActionJourney>;
  recordUseFeedback(
    publishPackage: Readonly<PublishPackage>,
    outcome: ProductLoopFeedbackOutcome
  ): Promise<ProductLoopUseFeedback>;
}

async function csrfToken(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  const value = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !value.csrfToken)
    throw new TodayHttpError(
      response.status || 503,
      value.code ?? 'AUTHENTICATION_REQUIRED',
      value.message ?? 'An authenticated session is required.'
    );
  return value.csrfToken;
}

async function request<T>(
  path: string,
  workspaceId: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  idempotencyKey?: string
): Promise<T> {
  const csrf = method === 'GET' ? '' : await csrfToken();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-workspace-id': workspaceId,
        ...(csrf ? { 'x-markorbit-csrf-token': csrf } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
      },
      ...(method === 'GET'
        ? {}
        : { body: JSON.stringify({ workspaceId, ...(body as Record<string, unknown>) }) })
    });
  } catch (cause) {
    throw new TodayHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Lite Today is temporarily unavailable.',
      {
        cause: cause instanceof Error ? cause.message : 'network failure'
      }
    );
  }
  const parsed: unknown = await response.json().catch(() => ({}));
  const value = parsed as T & {
    code?: string;
    message?: string;
    details?: Readonly<Record<string, unknown>>;
  };
  if (!response.ok)
    throw new TodayHttpError(
      response.status,
      value.code ?? 'TODAY_REQUEST_FAILED',
      value.message ?? 'Lite Today request failed.',
      value.details
    );
  return value;
}

function exactOpportunityCandidateSource(
  recommendation: Readonly<TodayRecommendation>
): Readonly<ProductLoopSourceReference> {
  const sources = recommendation.sources.filter(
    (source) => source.owner === 'LITE' && source.kind === 'OPPORTUNITY_CANDIDATE'
  );
  if (sources.length !== 1)
    throw new TodayHttpError(
      422,
      'OPPORTUNITY_CANDIDATE_SOURCE_REQUIRED',
      'Opportunity Review requires exactly one Lite-owned Opportunity Candidate source.'
    );
  const source = sources[0]!;
  const version = Number(source.sourceVersion);
  if (!Number.isInteger(version) || version < 1)
    throw new TodayHttpError(
      422,
      'INVALID_OPPORTUNITY_CANDIDATE_SOURCE',
      'Opportunity Candidate source version is invalid.'
    );
  return source;
}

function assertQualifiedOpportunityReview(
  recommendation: Readonly<TodayRecommendation>,
  evidence: Readonly<QualifiedOpportunityReviewEvidence>
): void {
  const source = exactOpportunityCandidateSource(recommendation);
  const reviewedVersion = Number(source.sourceVersion);
  const { candidate, qualificationDecision } = evidence;
  if (
    candidate.opportunityCandidateId !== source.sourceId ||
    candidate.workspaceId !== recommendation.workspaceId ||
    qualificationDecision.workspaceId !== recommendation.workspaceId ||
    qualificationDecision.outcome !== 'QUALIFIED_FOR_MARKREG' ||
    qualificationDecision.candidate.id !== source.sourceId ||
    qualificationDecision.candidate.version !== reviewedVersion ||
    qualificationDecision.expectedCandidateFingerprintSha256 !== source.sourceFingerprintSha256
  )
    throw new TodayHttpError(
      409,
      'STALE_OPPORTUNITY_REVIEW',
      'The current Candidate or Qualification Decision no longer matches this Opportunity Review.'
    );
}

export function createTodayClient(workspaceId: string): TodayClient {
  return {
    loadToday: () => request<TodayProductLoopSnapshot>('/api/lite/today', workspaceId),
    loadPreparedAction: (preparedActionId) =>
      request<PreparedActionJourney>(
        `/api/lite/prepared-actions/${encodeURIComponent(preparedActionId)}`,
        workspaceId
      ),
    loadQualifiedOpportunityReview: async (recommendation) => {
      if (recommendation.kind !== 'OPPORTUNITY_REVIEW')
        throw new TodayHttpError(
          422,
          'INVALID_RECOMMENDATION_KIND',
          'Only an Opportunity Review can load qualified Candidate evidence.'
        );
      const source = exactOpportunityCandidateSource(recommendation);
      const candidateId = source.sourceId as OpportunityCandidateId;
      const [candidate, qualificationDecision] = await Promise.all([
        request<OpportunityCandidate>(
          `/api/lite/opportunity-candidates/${encodeURIComponent(candidateId)}`,
          workspaceId
        ),
        request<OpportunityQualificationDecision | null>(
          `/api/lite/opportunity-candidates/${encodeURIComponent(candidateId)}/qualification`,
          workspaceId
        )
      ]);
      if (!qualificationDecision)
        throw new TodayHttpError(
          409,
          'QUALIFICATION_REQUIRED',
          'The Opportunity Candidate has no current human Qualification Decision.'
        );
      const evidence = { source, candidate, qualificationDecision };
      assertQualifiedOpportunityReview(recommendation, evidence);
      return evidence;
    },
    prepareContent: (recommendation) =>
      request<PreparedActionJourney>(
        `/api/lite/today/${encodeURIComponent(recommendation.todayRecommendationId)}/prepared-actions`,
        workspaceId,
        'POST',
        {
          recommendationVersion: recommendation.version,
          expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
          plan: {
            kind: 'PREPARE_CONTENT',
            title: recommendation.title,
            rationale: recommendation.explanation
          }
        },
        `prepare:${recommendation.todayRecommendationId}:${recommendation.version}`
      ),
    prepareQualifiedOpportunity: (recommendation, evidence, relationshipModel) => {
      assertQualifiedOpportunityReview(recommendation, evidence);
      return request<PreparedActionJourney>(
        `/api/lite/today/${encodeURIComponent(recommendation.todayRecommendationId)}/prepared-actions`,
        workspaceId,
        'POST',
        {
          recommendationVersion: recommendation.version,
          expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
          plan: {
            kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
            candidate: {
              id: evidence.qualificationDecision.candidate.id,
              version: evidence.qualificationDecision.candidate.version
            },
            expectedCandidateFingerprintSha256:
              evidence.qualificationDecision.expectedCandidateFingerprintSha256,
            qualificationDecision: {
              id: evidence.qualificationDecision.opportunityQualificationDecisionId,
              version: evidence.qualificationDecision.version
            },
            relationshipModel
          }
        },
        `prepare-opportunity:${recommendation.todayRecommendationId}:${recommendation.version}`
      );
    },
    confirm: (journey) =>
      request<PreparedActionJourney>(
        `/api/lite/prepared-actions/${encodeURIComponent(journey.preparedAction.preparedActionId)}/confirm`,
        workspaceId,
        'POST',
        {
          preparedActionVersion: journey.preparedAction.version,
          expectedPreparedActionFingerprintSha256:
            journey.preparedAction.preparedActionFingerprintSha256,
          acknowledgedEffect: journey.preparedAction.confirmationEffect
        },
        `confirm:${journey.preparedAction.preparedActionId}:${journey.preparedAction.version}`
      ),
    recordUseFeedback: (publishPackage, outcome) =>
      request<ProductLoopUseFeedback>(
        `/api/lite/publish-packages/${encodeURIComponent(publishPackage.publishPackageId)}/use-feedback`,
        workspaceId,
        'POST',
        {
          publishPackageVersion: publishPackage.version,
          expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
          outcome
        },
        `feedback:${publishPackage.publishPackageId}:${publishPackage.version}`
      )
  };
}
