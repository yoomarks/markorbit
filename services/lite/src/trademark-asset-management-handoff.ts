import { createHash } from 'node:crypto';
import type {
  TrademarkAssetManagementHandoff,
  TrademarkAssetManagementHandoffDestination,
  TrademarkAssetManagementHandoffId,
  TrademarkAssetManagementRecommendation,
  TrademarkAssetManagementSignal
} from '@markorbit/contracts/trademark-asset-management';
import type {
  TrademarkAssetRelation,
  TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';

function sourceKey(source: Readonly<TrademarkAssetSourceReference>): string {
  return `${source.owner}:${source.kind}:${source.sourceId}:${source.sourceVersion}`;
}

function uniqueEvidence(
  sources: readonly Readonly<TrademarkAssetSourceReference>[]
): TrademarkAssetSourceReference[] {
  const unique = new Map<string, TrademarkAssetSourceReference>();
  for (const source of sources) {
    const key = sourceKey(source);
    if (!unique.has(key)) unique.set(key, structuredClone(source));
  }
  return [...unique.values()].sort((a, b) => sourceKey(a).localeCompare(sourceKey(b)));
}

function hasMatterReference(relations: readonly Readonly<TrademarkAssetRelation>[]): boolean {
  return relations.some((relation) => relation.owner === 'MARKREG' && relation.kind === 'MATTER');
}

function defaultDestination(
  recommendation: Readonly<TrademarkAssetManagementRecommendation>
): TrademarkAssetManagementHandoffDestination {
  switch (recommendation.kind) {
    case 'PREPARE_OWNER_WORK_CANDIDATE':
    case 'REVIEW_LIFECYCLE_RECOMMENDATION':
      return hasMatterReference(recommendation.relatedOwnerReferences) ? 'MARKREG_MATTER' : 'WORK';
    case 'VERIFY_SOURCE_OR_DEADLINE':
    case 'GATHER_MISSING_INFORMATION':
    case 'PREPARE_TODAY_CANDIDATE':
    case 'PREPARE_CONTENT_CANDIDATE':
      return 'TODAY';
    case 'WATCH':
    case 'DEFER':
    case 'DISMISS':
      throw new Error(`${recommendation.kind} is a disposition candidate, not a governed handoff.`);
  }
}

function handoffId(input: {
  recommendation: Readonly<TrademarkAssetManagementRecommendation>;
  signal: Readonly<TrademarkAssetManagementSignal>;
  destination: TrademarkAssetManagementHandoffDestination;
  requestedByUserId: string;
}): TrademarkAssetManagementHandoffId {
  const digest = createHash('sha256')
    .update(
      `${input.recommendation.workspaceId}:${input.recommendation.asset.id}:${input.signal.managementSignalId}:${input.recommendation.recommendationId}:${input.destination}:${input.requestedByUserId}`
    )
    .digest('hex')
    .slice(0, 24);
  return `trademark-asset-management-handoff_${digest}`;
}

function assertExactLink(
  signal: Readonly<TrademarkAssetManagementSignal>,
  recommendation: Readonly<TrademarkAssetManagementRecommendation>
): void {
  if (
    signal.workspaceId !== recommendation.workspaceId ||
    signal.asset.id !== recommendation.asset.id ||
    signal.asset.version !== recommendation.asset.version
  ) {
    throw new Error('Signal and recommendation must belong to the same exact Workspace Asset.');
  }

  const linked = recommendation.signalReferences.some(
    (reference) =>
      reference.id === signal.managementSignalId && reference.version === signal.version
  );
  if (!linked) {
    throw new Error(
      'Recommendation must carry an exact reference to the selected Management Signal.'
    );
  }
}

/**
 * Create an exact bridge into an existing governed Product/owner surface after explicit user
 * confirmation. The bridge transports intent and evidence only. It never authorizes filing,
 * external contact, payment, publication, or any other protected consequence.
 */
export function prepareTrademarkAssetManagementHandoff(input: {
  signal: Readonly<TrademarkAssetManagementSignal>;
  recommendation: Readonly<TrademarkAssetManagementRecommendation>;
  requestedByUserId: string;
  userConfirmed: true;
  destination?: TrademarkAssetManagementHandoffDestination;
  requestedAt?: string;
}): TrademarkAssetManagementHandoff {
  assertExactLink(input.signal, input.recommendation);
  const requestedByUserId = input.requestedByUserId.trim();
  if (!requestedByUserId) throw new Error('requestedByUserId is required.');

  const requestedAt = input.requestedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(requestedAt))) {
    throw new Error('requestedAt must be a valid timestamp.');
  }

  const destination = input.destination ?? defaultDestination(input.recommendation);
  if (
    (input.recommendation.kind === 'WATCH' ||
      input.recommendation.kind === 'DEFER' ||
      input.recommendation.kind === 'DISMISS') &&
    input.destination
  ) {
    throw new Error(`${input.recommendation.kind} cannot be converted into a governed handoff.`);
  }

  return {
    schemaVersion: 1,
    handoffId: handoffId({
      recommendation: input.recommendation,
      signal: input.signal,
      destination,
      requestedByUserId
    }),
    workspaceId: input.recommendation.workspaceId,
    version: input.recommendation.version,
    asset: structuredClone(input.recommendation.asset),
    signal: {
      id: input.signal.managementSignalId,
      version: input.signal.version
    },
    recommendation: {
      id: input.recommendation.recommendationId,
      version: input.recommendation.version
    },
    destination,
    evidenceSnapshot: uniqueEvidence([...input.signal.evidence, ...input.recommendation.evidence]),
    requestedByUserId,
    requestedAt,
    userConfirmed: true,
    protectedActionAuthorized: false,
    filingAuthorized: false,
    externalContactAuthorized: false,
    paymentAuthorized: false,
    publicationAuthorized: false
  };
}

export const trademarkAssetManagementHandoffAuthority = {
  requiresExplicitUserConfirmation: true,
  carriesExactSignalReference: true,
  carriesExactRecommendationReference: true,
  carriesEvidenceSnapshot: true,
  reusesExistingGovernedDestinations: true,
  mayAuthorizeProtectedAction: false,
  mayAuthorizeFiling: false,
  mayAuthorizeExternalContact: false,
  mayAuthorizePayment: false,
  mayAuthorizePublication: false,
  mayBypassOwnerDomainValidation: false
} as const;
