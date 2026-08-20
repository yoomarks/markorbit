import { createHash } from 'node:crypto';
import type {
  TrademarkAssetManagementRecommendation,
  TrademarkAssetManagementRecommendationId,
  TrademarkAssetManagementRecommendationKind,
  TrademarkAssetManagementSignal
} from '@markorbit/contracts/trademark-asset-management';
import type {
  AiGuideSuggestion,
  TrademarkAssetRelation,
  TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';

function recommendationId(
  signal: Readonly<TrademarkAssetManagementSignal>,
  kind: TrademarkAssetManagementRecommendationKind
): TrademarkAssetManagementRecommendationId {
  const digest = createHash('sha256')
    .update(`${signal.workspaceId}:${signal.asset.id}:${signal.managementSignalId}:${kind}`)
    .digest('hex')
    .slice(0, 24);
  return `trademark-asset-management-recommendation_${digest}`;
}

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

function relationKey(relation: Readonly<TrademarkAssetRelation>): string {
  return `${relation.owner}:${relation.kind}:${relation.referenceId}:${relation.referenceVersion ?? ''}`;
}

function uniqueRelations(
  relations: readonly Readonly<TrademarkAssetRelation>[]
): TrademarkAssetRelation[] {
  const unique = new Map<string, TrademarkAssetRelation>();
  for (const relation of relations) {
    const key = relationKey(relation);
    if (!unique.has(key)) unique.set(key, structuredClone(relation));
  }
  return [...unique.values()].sort((a, b) => relationKey(a).localeCompare(relationKey(b)));
}

function selectKind(
  signal: Readonly<TrademarkAssetManagementSignal>,
  aiGuideSuggestions: readonly Readonly<AiGuideSuggestion>[]
): TrademarkAssetManagementRecommendationKind {
  switch (signal.dimension) {
    case 'OBSERVED_DATE_PROXIMITY':
    case 'SOURCE_FRESHNESS':
    case 'SOURCE_CONFLICT':
      return 'VERIFY_SOURCE_OR_DEADLINE';
    case 'MISSING_CONSEQUENTIAL_CONTEXT':
      return 'GATHER_MISSING_INFORMATION';
    case 'LIFECYCLE_RELEVANCE':
      return aiGuideSuggestions.some(
        (suggestion) => suggestion.kind === 'PREPARE_OWNER_ACTION_CANDIDATE'
      )
        ? 'PREPARE_OWNER_WORK_CANDIDATE'
        : 'REVIEW_LIFECYCLE_RECOMMENDATION';
    case 'KNOWLEDGE_CHANGE_RELEVANCE':
      return aiGuideSuggestions.some((suggestion) => suggestion.kind === 'PREPARE_CONTENT_CANDIDATE')
        ? 'PREPARE_CONTENT_CANDIDATE'
        : 'PREPARE_TODAY_CANDIDATE';
    case 'USER_PRIORITY':
      return 'PREPARE_TODAY_CANDIDATE';
    case 'PORTFOLIO_PATTERN':
      return 'WATCH';
  }
}

function titleFor(kind: TrademarkAssetManagementRecommendationKind): string {
  switch (kind) {
    case 'VERIFY_SOURCE_OR_DEADLINE':
      return 'Verify the source before acting';
    case 'GATHER_MISSING_INFORMATION':
      return 'Gather missing Asset context';
    case 'REVIEW_LIFECYCLE_RECOMMENDATION':
      return 'Review the owner-domain lifecycle recommendation';
    case 'PREPARE_OWNER_WORK_CANDIDATE':
      return 'Prepare owner-domain work for review';
    case 'PREPARE_TODAY_CANDIDATE':
      return 'Prepare a Today review candidate';
    case 'PREPARE_CONTENT_CANDIDATE':
      return 'Prepare a Content candidate for review';
    case 'WATCH':
      return 'Keep this Asset under watch';
    case 'DEFER':
      return 'Defer this recommendation';
    case 'DISMISS':
      return 'Dismiss this recommendation';
  }
}

function explanationFor(
  signal: Readonly<TrademarkAssetManagementSignal>,
  kind: TrademarkAssetManagementRecommendationKind
): string {
  const boundary =
    'This is a reviewable Product recommendation only; it does not verify official truth, certify a legal deadline, resolve a conflict, or authorize any protected action.';
  switch (kind) {
    case 'VERIFY_SOURCE_OR_DEADLINE':
      return `${signal.reason} Verify the underlying owner/source context before any legal or operational reliance. ${boundary}`;
    case 'GATHER_MISSING_INFORMATION':
      return `${signal.reason} Gather the missing source-owned information before preparing a consequential next step. ${boundary}`;
    case 'REVIEW_LIFECYCLE_RECOMMENDATION':
      return `${signal.reason} Review the existing owner-domain recommendation and its evidence before deciding whether work should be prepared. ${boundary}`;
    case 'PREPARE_OWNER_WORK_CANDIDATE':
      return `${signal.reason} Existing AI Guide context supports preparing a bounded owner-work candidate for user review; owner validation remains mandatory. ${boundary}`;
    case 'PREPARE_TODAY_CANDIDATE':
      return `${signal.reason} Put this condition into the user's private Today review queue without treating the signal as official truth. ${boundary}`;
    case 'PREPARE_CONTENT_CANDIDATE':
      return `${signal.reason} Existing AI Guide context supports preparing a Content candidate for review; nothing is published automatically. ${boundary}`;
    case 'WATCH':
      return `${signal.reason} Keep the repeated condition visible and reassess after future source refreshes. ${boundary}`;
    case 'DEFER':
      return `Defer review of this signal without changing source-owned truth. ${boundary}`;
    case 'DISMISS':
      return `Dismiss this Product recommendation without changing source-owned truth. ${boundary}`;
  }
}

/**
 * Convert explainable Management Signals into deterministic, user-reviewable next-step candidates.
 * The preparer may use already-bounded AI Guide suggestions as context, but never inherits or creates
 * official truth, filing authority, contact authority, payment authority, publication authority, or
 * owner-domain validation authority.
 */
export function prepareTrademarkAssetManagementRecommendations(input: {
  signals: readonly Readonly<TrademarkAssetManagementSignal>[];
  relatedOwnerReferences?: readonly Readonly<TrademarkAssetRelation>[];
  aiGuideSuggestions?: readonly Readonly<AiGuideSuggestion>[];
  createdAt?: string;
}): readonly TrademarkAssetManagementRecommendation[] {
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('createdAt must be a valid timestamp.');
  if (input.signals.length === 0) return [];

  const first = input.signals[0];
  if (!first) return [];
  for (const signal of input.signals) {
    if (signal.workspaceId !== first.workspaceId || signal.asset.id !== first.asset.id) {
      throw new Error('Management recommendation input must belong to one Workspace Trademark Asset.');
    }
  }

  const aiGuideSuggestions = (input.aiGuideSuggestions ?? []).filter(
    (suggestion) =>
      suggestion.workspaceId === first.workspaceId && suggestion.asset.id === first.asset.id
  );
  const relatedOwnerReferences = uniqueRelations(input.relatedOwnerReferences ?? []);

  return input.signals.map((signal) => {
    const relevantAi = aiGuideSuggestions.filter((suggestion) =>
      suggestion.evidence.some((candidate) =>
        signal.evidence.some((source) => sourceKey(source) === sourceKey(candidate))
      )
    );
    const kind = selectKind(signal, relevantAi);
    const evidence = uniqueEvidence([
      ...signal.evidence,
      ...relevantAi.flatMap((suggestion) => suggestion.evidence)
    ]);
    return {
      schemaVersion: 1,
      recommendationId: recommendationId(signal, kind),
      workspaceId: signal.workspaceId,
      version: signal.version,
      asset: structuredClone(signal.asset),
      signalReferences: [{ id: signal.managementSignalId, version: signal.version }],
      kind,
      title: titleFor(kind),
      explanation: explanationFor(signal, kind),
      evidence,
      relatedOwnerReferences,
      staleOrConflictingEvidencePresent:
        signal.freshness !== 'CURRENT' || signal.dimension === 'SOURCE_CONFLICT',
      userConfirmationRequired: true,
      officialTruthVerified: false,
      legalDeadlineCertified: false,
      filingAuthorized: false,
      customerOrProviderContactAuthorized: false,
      externalPublicationAuthorized: false,
      paidExecutionAuthorized: false,
      capabilityVerified: false,
      createdAt
    } satisfies TrademarkAssetManagementRecommendation;
  });
}

export const trademarkAssetManagementRecommendationAuthority = {
  productOwnedPreparationOnly: true,
  mayUseManagementSignals: true,
  mayUseBoundedAiGuideContext: true,
  mayPrepareOwnerWorkCandidate: true,
  mayPrepareTodayCandidate: true,
  mayPrepareContentCandidate: true,
  userConfirmationRequiredForConsequence: true,
  mayVerifyOfficialTruth: false,
  mayCertifyLegalDeadline: false,
  mayResolveConflict: false,
  mayAuthorizeFiling: false,
  mayAuthorizeExternalContact: false,
  mayAuthorizePayment: false,
  mayAuthorizePublication: false,
  mayVerifyCapability: false,
  mayBypassOwnerDomainValidation: false
} as const;
