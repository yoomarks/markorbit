import type {
  ProductConversionRate,
  ProductLoopConversionAnalyticsSnapshot
} from '@markorbit/contracts/beta-readiness';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

type JsonRecord = Record<string, unknown>;

const noAuthorityKeys = [
  'businessAuthorityGranted',
  'protectedActionAuthorized',
  'productionDeploymentAuthorized',
  'betaReleased',
  'ownerReleaseAuthorized',
  'customerTruthCreated',
  'providerTruthCreated',
  'officialTruthCreated',
  'capabilityVerified',
  'capabilityCanonMutated'
] as const;

export class WorkspaceInsightsHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'WorkspaceInsightsHttpError';
  }
}

export interface WorkspaceInsightsClient {
  load(): Promise<ProductLoopConversionAnalyticsSnapshot>;
}

function malformed(message: string): never {
  throw new WorkspaceInsightsHttpError(503, 'MALFORMED_ANALYTICS_SNAPSHOT', message);
}

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return malformed(`${field} must be an object.`);
  return value as JsonRecord;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    return malformed(`${field} must be a non-negative integer.`);
  return Number(value);
}

function exactRate(
  value: unknown,
  expectedNumerator: number,
  expectedDenominator: number,
  field: string
): ProductConversionRate {
  const parsed = record(value, field);
  const numerator = nonNegativeInteger(parsed.numerator, `${field}.numerator`);
  const denominator = nonNegativeInteger(parsed.denominator, `${field}.denominator`);
  const expectedRate =
    expectedDenominator === 0
      ? null
      : Number((expectedNumerator / expectedDenominator).toFixed(6));
  if (numerator !== expectedNumerator || denominator !== expectedDenominator)
    return malformed(`${field} does not match its owner stage counts.`);
  if (expectedRate === null) {
    if (parsed.rate !== null) return malformed(`${field}.rate must be null without a denominator.`);
  } else if (parsed.rate !== expectedRate) {
    return malformed(`${field}.rate does not match the owner-provided stage ratio.`);
  }
  return { numerator, denominator, rate: expectedRate };
}

export function parseWorkspaceInsightsSnapshot(
  value: unknown,
  expectedWorkspaceId: string
): ProductLoopConversionAnalyticsSnapshot {
  const snapshot = record(value, 'snapshot');
  if (snapshot.schemaVersion !== 1) return malformed('Unsupported analytics schema version.');
  if (snapshot.workspaceId !== expectedWorkspaceId)
    return malformed('Analytics Workspace does not match the requested Workspace.');
  if (snapshot.owner !== 'LITE' || snapshot.scope !== 'WORKSPACE_ALL_TIME')
    return malformed('Analytics owner or scope is invalid.');
  if (typeof snapshot.generatedAt !== 'string' || Number.isNaN(Date.parse(snapshot.generatedAt)))
    return malformed('Analytics generatedAt is invalid.');
  if (!Array.isArray(snapshot.sourceFamilies) || snapshot.sourceFamilies.length === 0)
    return malformed('Analytics source families are required.');
  for (const [index, source] of snapshot.sourceFamilies.entries()) {
    const family = record(source, `sourceFamilies[${index}]`);
    if (
      family.schemaVersion !== 1 ||
      family.owner !== 'LITE' ||
      family.provenance !== 'DURABLE_OWNER_STATE' ||
      typeof family.kind !== 'string'
    )
      return malformed(`sourceFamilies[${index}] is invalid.`);
  }

  const content = record(snapshot.content, 'content');
  const contentOpportunities = nonNegativeInteger(
    content.contentOpportunities,
    'content.contentOpportunities'
  );
  const draftPrepared = nonNegativeInteger(content.draftPrepared, 'content.draftPrepared');
  const humanReviewRecorded = nonNegativeInteger(
    content.humanReviewRecorded,
    'content.humanReviewRecorded'
  );
  const publishPackagesPrepared = nonNegativeInteger(
    content.publishPackagesPrepared,
    'content.publishPackagesPrepared'
  );
  const userReportedUseFeedback = nonNegativeInteger(
    content.userReportedUseFeedback,
    'content.userReportedUseFeedback'
  );
  const contentRates = record(content.rates, 'content.rates');
  exactRate(
    contentRates.opportunityToDraft,
    draftPrepared,
    contentOpportunities,
    'content.rates.opportunityToDraft'
  );
  exactRate(
    contentRates.draftToHumanReview,
    humanReviewRecorded,
    draftPrepared,
    'content.rates.draftToHumanReview'
  );
  exactRate(
    contentRates.humanReviewToPublishPackage,
    publishPackagesPrepared,
    humanReviewRecorded,
    'content.rates.humanReviewToPublishPackage'
  );
  exactRate(
    contentRates.publishPackageToUseFeedback,
    userReportedUseFeedback,
    publishPackagesPrepared,
    'content.rates.publishPackageToUseFeedback'
  );

  const opportunity = record(snapshot.opportunity, 'opportunity');
  const opportunityCandidates = nonNegativeInteger(
    opportunity.opportunityCandidates,
    'opportunity.opportunityCandidates'
  );
  const qualificationDecisions = nonNegativeInteger(
    opportunity.qualificationDecisions,
    'opportunity.qualificationDecisions'
  );
  const qualifiedForMarkReg = nonNegativeInteger(
    opportunity.qualifiedForMarkReg,
    'opportunity.qualifiedForMarkReg'
  );
  const formalOpportunityHandoffResults = nonNegativeInteger(
    opportunity.formalOpportunityHandoffResults,
    'opportunity.formalOpportunityHandoffResults'
  );
  const opportunityRates = record(opportunity.rates, 'opportunity.rates');
  exactRate(
    opportunityRates.candidateToQualification,
    qualificationDecisions,
    opportunityCandidates,
    'opportunity.rates.candidateToQualification'
  );
  exactRate(
    opportunityRates.qualificationToQualified,
    qualifiedForMarkReg,
    qualificationDecisions,
    'opportunity.rates.qualificationToQualified'
  );
  exactRate(
    opportunityRates.qualifiedToFormalOpportunityHandoff,
    formalOpportunityHandoffResults,
    qualifiedForMarkReg,
    'opportunity.rates.qualifiedToFormalOpportunityHandoff'
  );

  const crossOwnerEvidence = record(snapshot.crossOwnerEvidence, 'crossOwnerEvidence');
  if (
    crossOwnerEvidence.evidenceOwner !== 'LITE' ||
    crossOwnerEvidence.downstreamOwner !== 'MARKREG' ||
    crossOwnerEvidence.sourceKind !== 'PREPARED_ACTION_HANDOFF_RESULT' ||
    crossOwnerEvidence.directMarkRegQueryPerformed !== false
  )
    return malformed('Cross-owner evidence boundary is invalid.');
  if (
    snapshot.observationalOnly !== true ||
    snapshot.mutatesBusinessState !== false ||
    snapshot.userReportedExternalUseVerified !== false
  )
    return malformed('Analytics authority boundary is invalid.');
  const authority = record(snapshot.authority, 'authority');
  if (noAuthorityKeys.some((key) => authority[key] !== false))
    return malformed('Analytics no-authority consequences are invalid.');

  return value as ProductLoopConversionAnalyticsSnapshot;
}

export function createWorkspaceInsightsClient(workspaceId: string): WorkspaceInsightsClient {
  return {
    load: async () => {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/lite/analytics/product-loop-conversions`, {
          credentials: 'include',
          headers: { 'x-markorbit-workspace-id': workspaceId }
        });
      } catch {
        throw new WorkspaceInsightsHttpError(
          503,
          'DOWNSTREAM_UNAVAILABLE',
          'Workspace Insights is temporarily unavailable.',
          true
        );
      }
      const parsed = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        const error =
          parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as JsonRecord)
            : {};
        throw new WorkspaceInsightsHttpError(
          response.status,
          typeof error.code === 'string' ? error.code : 'WORKSPACE_INSIGHTS_REQUEST_FAILED',
          typeof error.message === 'string' ? error.message : 'Workspace Insights request failed.',
          error.retryable === true || response.status >= 500
        );
      }
      return parseWorkspaceInsightsSnapshot(parsed, workspaceId);
    }
  };
}
