import type {
  ProductConversionAnalyticsSourceKind,
  ProductConversionRate,
  ProductLoopConversionAnalyticsSnapshot
} from '@markorbit/contracts/beta-readiness';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

const sourceKinds = new Set<ProductConversionAnalyticsSourceKind>([
  'CONTENT_OPPORTUNITY',
  'CONTENT_DRAFT',
  'CONTENT_REVIEW_DECISION',
  'PUBLISH_PACKAGE',
  'CONTENT_USE_FEEDBACK',
  'OPPORTUNITY_CANDIDATE',
  'OPPORTUNITY_QUALIFICATION_DECISION',
  'PREPARED_ACTION_HANDOFF_RESULT'
]);

export class WorkspaceInsightsHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = status >= 500
  ) {
    super(message);
    this.name = 'WorkspaceInsightsHttpError';
  }
}

export interface WorkspaceInsightsClient {
  load(signal?: AbortSignal): Promise<ProductLoopConversionAnalyticsSnapshot>;
}
type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as JsonRecord;
}

function malformed(reason: string): never {
  throw new WorkspaceInsightsHttpError(
    502,
    'MALFORMED_ANALYTICS_SNAPSHOT',
    `Workspace Insights returned invalid owner data: ${reason}`,
    true
  );
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) malformed(`${field} is invalid.`);
  return Number(value);
}

function validTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value)))
    malformed(`${field} is invalid.`);
  return value;
}

function validateRate(value: unknown, field: string): asserts value is ProductConversionRate {
  const candidate = record(value);
  if (!candidate) malformed(`${field} is invalid.`);
  nonNegativeInteger(candidate['numerator'], `${field}.numerator`);
  const denominator = nonNegativeInteger(candidate['denominator'], `${field}.denominator`);
  const rate = candidate['rate'];
  if (denominator === 0) {
    if (rate !== null) malformed(`${field}.rate must be null when denominator is zero.`);
    return;
  }
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1)
    malformed(`${field}.rate is invalid.`);
}

function validateAuthority(value: unknown): void {
  const authority = record(value);
  if (!authority) malformed('authority is invalid.');
  for (const field of [
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
  ] as const) {
    if (authority[field] !== false) malformed(`authority.${field} must remain false.`);
  }
}
function validateSourceFamilies(value: unknown): void {
  if (!Array.isArray(value) || value.length === 0) malformed('sourceFamilies are invalid.');
  for (const [index, source] of value.entries()) {
    const candidate = record(source);
    if (!candidate) malformed(`sourceFamilies[${index}] is invalid.`);
    const kind = candidate['kind'];
    if (
      candidate['schemaVersion'] !== 1 ||
      candidate['owner'] !== 'LITE' ||
      candidate['provenance'] !== 'DURABLE_OWNER_STATE' ||
      typeof kind !== 'string' ||
      !sourceKinds.has(kind as ProductConversionAnalyticsSourceKind)
    )
      malformed(`sourceFamilies[${index}] is invalid.`);
    if (kind === 'PREPARED_ACTION_HANDOFF_RESULT') {
      if (candidate['downstreamOwner'] !== 'MARKREG')
        malformed(`sourceFamilies[${index}].downstreamOwner is invalid.`);
    } else if (candidate['downstreamOwner'] !== undefined) {
      malformed(`sourceFamilies[${index}].downstreamOwner is unexpected.`);
    }
  }
}

function validateContent(value: unknown): void {
  const content = record(value);
  if (!content) malformed('content is invalid.');
  for (const field of [
    'contentOpportunities',
    'draftPrepared',
    'humanReviewRecorded',
    'publishPackagesPrepared',
    'userReportedUseFeedback'
  ] as const)
    nonNegativeInteger(content[field], `content.${field}`);
  const rates = record(content['rates']);
  if (!rates) malformed('content.rates are invalid.');
  for (const field of [
    'opportunityToDraft',
    'draftToHumanReview',
    'humanReviewToPublishPackage',
    'publishPackageToUseFeedback'
  ] as const)
    validateRate(rates[field], `content.rates.${field}`);
}
function validateOpportunity(value: unknown): void {
  const opportunity = record(value);
  if (!opportunity) malformed('opportunity is invalid.');
  for (const field of [
    'opportunityCandidates',
    'qualificationDecisions',
    'qualifiedForMarkReg',
    'formalOpportunityHandoffResults'
  ] as const)
    nonNegativeInteger(opportunity[field], `opportunity.${field}`);
  const rates = record(opportunity['rates']);
  if (!rates) malformed('opportunity.rates are invalid.');
  for (const field of [
    'candidateToQualification',
    'qualificationToQualified',
    'qualifiedToFormalOpportunityHandoff'
  ] as const)
    validateRate(rates[field], `opportunity.rates.${field}`);
}

function validateSnapshot(
  value: unknown,
  workspaceId: string
): ProductLoopConversionAnalyticsSnapshot {
  const snapshot = record(value);
  if (!snapshot) malformed('snapshot is invalid.');
  if (snapshot['schemaVersion'] !== 1) malformed('schemaVersion is invalid.');
  if (snapshot['owner'] !== 'LITE') malformed('owner is invalid.');
  if (snapshot['scope'] !== 'WORKSPACE_ALL_TIME') malformed('scope is invalid.');
  if (
    typeof snapshot['workspaceId'] !== 'string' ||
    snapshot['workspaceId'].toLowerCase() !== workspaceId.toLowerCase()
  )
    malformed('workspaceId does not match the requested Workspace.');
  validTimestamp(snapshot['generatedAt'], 'generatedAt');
  validateSourceFamilies(snapshot['sourceFamilies']);
  validateContent(snapshot['content']);
  validateOpportunity(snapshot['opportunity']);
  const crossOwner = record(snapshot['crossOwnerEvidence']);
  if (
    !crossOwner ||
    crossOwner['evidenceOwner'] !== 'LITE' ||
    crossOwner['downstreamOwner'] !== 'MARKREG' ||
    crossOwner['sourceKind'] !== 'PREPARED_ACTION_HANDOFF_RESULT' ||
    crossOwner['directMarkRegQueryPerformed'] !== false
  )
    malformed('crossOwnerEvidence is invalid.');
  if (snapshot['observationalOnly'] !== true) malformed('observationalOnly must remain true.');
  if (snapshot['mutatesBusinessState'] !== false)
    malformed('mutatesBusinessState must remain false.');
  if (snapshot['userReportedExternalUseVerified'] !== false)
    malformed('userReportedExternalUseVerified must remain false.');
  validateAuthority(snapshot['authority']);
  return snapshot as unknown as ProductLoopConversionAnalyticsSnapshot;
}

async function loadSnapshot(
  workspaceId: string,
  signal?: AbortSignal
): Promise<ProductLoopConversionAnalyticsSnapshot> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/lite/analytics/product-loop-conversions`, {
      credentials: 'include',
      headers: { 'x-markorbit-workspace-id': workspaceId },
      ...(signal ? { signal } : {})
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new WorkspaceInsightsHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Workspace Insights are temporarily unavailable.',
      true
    );
  }
  const parsed = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    const body = record(parsed);
    throw new WorkspaceInsightsHttpError(
      response.status,
      typeof body?.['code'] === 'string' ? body['code'] : 'WORKSPACE_INSIGHTS_REQUEST_FAILED',
      typeof body?.['message'] === 'string'
        ? body['message']
        : 'Workspace Insights are unavailable.',
      response.status >= 500
    );
  }
  return validateSnapshot(parsed, workspaceId);
}

export function createWorkspaceInsightsClient(workspaceId: string): WorkspaceInsightsClient {
  return { load: (signal) => loadSnapshot(workspaceId, signal) };
}
