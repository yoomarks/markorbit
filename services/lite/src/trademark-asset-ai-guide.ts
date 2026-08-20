import { randomUUID } from 'node:crypto';
import type { TrademarkAssetAiGuidePreparedResult } from '@markorbit/contracts/trademark-asset-ai-guide';
import type { TrademarkAssetCommerceProfile } from '@markorbit/contracts/trademark-asset-commerce';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import type { TrademarkAssetMarketplaceOverlay } from '@markorbit/contracts/trademark-asset-marketplace-reference';
import type {
  AiGuideSuggestion,
  AiGuideSuggestionKind,
  TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';

export interface TrademarkAssetAiGuidePrepareRequest {
  workspaceId: string;
  subjectUserId: string;
  view: Readonly<TrademarkAssetView>;
  commerceProfile?: Readonly<TrademarkAssetCommerceProfile>;
  marketplaceOverlay?: Readonly<TrademarkAssetMarketplaceOverlay>;
  requestedKinds: readonly AiGuideSuggestionKind[];
}

const supportedKinds: readonly AiGuideSuggestionKind[] = [
  'EXPLAIN_ASSET',
  'SUMMARIZE_OWNER_CONTEXT',
  'IDENTIFY_MISSING_INFORMATION',
  'EXPLAIN_SOURCE_CHANGE',
  'COMPARE_ASSETS',
  'PREPARE_CHECKLIST',
  'PREPARE_TODAY_CANDIDATE',
  'PREPARE_CONTENT_CANDIDATE',
  'PREPARE_OWNER_ACTION_CANDIDATE'
];

const uniqueEvidence = (
  references: readonly Readonly<TrademarkAssetSourceReference>[]
): TrademarkAssetSourceReference[] => {
  const seen = new Set<string>();
  const result: TrademarkAssetSourceReference[] = [];
  for (const reference of references) {
    const key = `${reference.owner}:${reference.kind}:${reference.sourceId}:${reference.sourceVersion}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(structuredClone(reference));
    }
  }
  return result;
};

const valueText = (value: string | number | boolean | readonly string[]): string =>
  Array.isArray(value) ? value.join(', ') : String(value);

export class TrademarkAssetAiGuidePreparer {
  constructor(
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = randomUUID
  ) {}

  prepare(
    request: Readonly<TrademarkAssetAiGuidePrepareRequest>
  ): TrademarkAssetAiGuidePreparedResult {
    const { view, commerceProfile, marketplaceOverlay } = request;
    if (request.workspaceId !== view.workspaceId) {
      throw new Error('AI Guide workspace must match the composed Trademark Asset view.');
    }
    if (!request.subjectUserId.trim()) {
      throw new Error('subjectUserId is required.');
    }

    for (const context of [commerceProfile, marketplaceOverlay]) {
      if (!context) continue;
      if (
        context.workspaceId !== view.workspaceId ||
        context.trademarkAssetId !== view.trademarkAssetId
      ) {
        throw new Error('AI Guide context must belong to the same workspace and Trademark Asset.');
      }
      if (context.trademarkAssetVersion !== view.anchorVersion) {
        throw new Error('AI Guide context must match the composed Trademark Asset version.');
      }
    }

    const requestedKinds = [...new Set(request.requestedKinds)];
    if (
      requestedKinds.length === 0 ||
      requestedKinds.some((kind) => !supportedKinds.includes(kind))
    ) {
      throw new Error('At least one supported AI Guide suggestion kind is required.');
    }

    const generatedAt = new Date(this.now()).toISOString();
    const marketplaceSource = marketplaceOverlay?.source.sourceReference;
    const evidence = uniqueEvidence([
      ...view.sourceReferences,
      ...(marketplaceSource ? [marketplaceSource] : [])
    ]);
    const staleOrConflictingEvidencePresent =
      view.freshness !== 'CURRENT' ||
      view.conflicts.length > 0 ||
      view.sourceReferences.some((reference) => reference.freshness !== 'CURRENT') ||
      Boolean(marketplaceSource && marketplaceSource.freshness !== 'CURRENT');

    const factMap = new Map(view.observedFacts.map((fact) => [fact.kind, fact]));
    const recommendedActions = view.contextSignals
      .filter((signal) => signal.kind === 'RECOMMENDED_ACTION')
      .map((signal) => signal.value);
    const knowledgeChanges = view.contextSignals
      .filter((signal) => signal.kind === 'KNOWLEDGE_RELEVANCE')
      .map((signal) => signal.value);
    const commercialAngles = [
      commerceProfile?.headline,
      ...(commerceProfile?.sellingPoints ?? []),
      marketplaceOverlay?.headline,
      ...(marketplaceOverlay?.sellingPoints ?? [])
    ].filter((value): value is string => Boolean(value?.trim()));

    const suggestion = (
      kind: AiGuideSuggestionKind,
      title: string,
      explanation: string,
      suggestionEvidence: readonly TrademarkAssetSourceReference[] = evidence
    ): AiGuideSuggestion => ({
      schemaVersion: 1,
      aiGuideSuggestionId: `ai-guide-suggestion_${this.newId()}`,
      workspaceId: view.workspaceId,
      version: 1,
      asset: {
        id: view.trademarkAssetId,
        version: view.anchorVersion
      },
      kind,
      title,
      explanation,
      evidence: uniqueEvidence(suggestionEvidence),
      staleOrConflictingEvidencePresent,
      userConfirmationRequiredForAnyConsequence: true,
      externalActionAuthorized: false,
      filingAuthorized: false,
      customerOrProviderContactAuthorized: false,
      paidExecutionAuthorized: false,
      officialTruthVerified: false,
      capabilityVerified: false,
      createdAt: generatedAt
    });

    const suggestions = requestedKinds.map((kind): AiGuideSuggestion => {
      switch (kind) {
        case 'EXPLAIN_ASSET': {
          const facts = view.observedFacts.map((fact) => `${fact.kind}: ${valueText(fact.value)}`);
          return suggestion(
            kind,
            'Asset context summary',
            facts.length > 0
              ? `Observed source-owned facts: ${facts.join('; ')}. These observations are not official verification.`
              : 'No source-owned factual observations are currently available for this asset.'
          );
        }
        case 'SUMMARIZE_OWNER_CONTEXT': {
          const owner = factMap.get('OWNER_NAME');
          return suggestion(
            kind,
            'Owner context',
            owner
              ? `Observed owner context: ${valueText(owner.value)}. This is a source observation, not ownership verification by Lite.`
              : 'Owner context is missing from the currently composed source observations.'
          );
        }
        case 'IDENTIFY_MISSING_INFORMATION': {
          const required = ['APPLICATION_STATUS', 'OWNER_NAME', 'NICE_CLASSES'] as const;
          const missing = required.filter((factKind) => !factMap.has(factKind));
          return suggestion(
            kind,
            'Missing asset information',
            missing.length > 0
              ? `Missing or unavailable context: ${missing.join(', ')}.`
              : 'No baseline information gaps were detected in the currently composed view.'
          );
        }
        case 'EXPLAIN_SOURCE_CHANGE':
          return suggestion(
            kind,
            'Relevant source changes',
            knowledgeChanges.length > 0
              ? `Relevant Knowledge signals: ${knowledgeChanges.join('; ')}. These are relevance signals, not trademark facts.`
              : 'No Knowledge relevance signal is currently attached to this asset.'
          );
        case 'COMPARE_ASSETS':
          return suggestion(
            kind,
            'Comparison preparation',
            'This asset is prepared for comparison using source-owned facts and workspace context. Cross-asset comparison requires another accessible Trademark Asset view and must preserve conflicts.'
          );
        case 'PREPARE_CHECKLIST': {
          const items = [
            ...(factMap.has('APPLICATION_STATUS')
              ? []
              : ['confirm current application status from an owner source']),
            ...(factMap.has('OWNER_NAME')
              ? []
              : ['confirm current owner context from an owner source']),
            ...(factMap.has('NICE_CLASSES') ? [] : ['confirm Nice classes from an owner source']),
            ...(view.conflicts.length > 0
              ? ['review unresolved conflicting observations before consequential use']
              : []),
            ...(marketplaceSource && marketplaceSource.freshness !== 'CURRENT'
              ? ['refresh the Marketplace source listing before customer-facing use']
              : [])
          ];
          return suggestion(
            kind,
            'Review checklist',
            items.length > 0
              ? items.join('; ')
              : 'Review the current source references before taking any consequential action.'
          );
        }
        case 'PREPARE_TODAY_CANDIDATE':
          return suggestion(
            kind,
            'Today candidate',
            recommendedActions.length > 0
              ? `Candidate attention item based on advisory source signals: ${recommendedActions.join('; ')}.`
              : 'No owner-domain recommended action is currently available to prepare as a Today candidate.'
          );
        case 'PREPARE_CONTENT_CANDIDATE': {
          const angles = knowledgeChanges.length > 0 ? knowledgeChanges : commercialAngles;
          return suggestion(
            kind,
            'Content candidate',
            angles.length > 0
              ? `Potential content angle from bounded workspace/source context: ${angles.join('; ')}. Review source evidence and permissions before publishing.`
              : 'No grounded Knowledge change or workspace-private commercial angle is currently available.'
          );
        }
        case 'PREPARE_OWNER_ACTION_CANDIDATE':
          return suggestion(
            kind,
            'Owner action candidate',
            recommendedActions.length > 0
              ? `Prepared from advisory owner-domain signals: ${recommendedActions.join('; ')}. User confirmation and owner-domain validation remain required.`
              : 'No owner-domain recommended action is currently available.'
          );
      }
    });

    return {
      schemaVersion: 1,
      workspaceId: view.workspaceId,
      subjectUserId: request.subjectUserId.trim(),
      trademarkAssetId: view.trademarkAssetId,
      trademarkAssetVersion: view.anchorVersion,
      contextReferences: [
        {
          kind: 'ASSET_COMPOSITION',
          referenceId: view.trademarkAssetId,
          referenceVersion: String(view.anchorVersion)
        },
        ...(commerceProfile
          ? [
              {
                kind: 'COMMERCE_PROFILE' as const,
                referenceId: commerceProfile.commerceProfileId,
                referenceVersion: String(commerceProfile.version)
              }
            ]
          : []),
        ...(marketplaceOverlay
          ? [
              {
                kind: 'MARKETPLACE_OVERLAY' as const,
                referenceId: marketplaceOverlay.marketplaceOverlayId,
                referenceVersion: String(marketplaceOverlay.version)
              }
            ]
          : [])
      ],
      evidence,
      suggestions,
      staleOrConflictingEvidencePresent,
      officialTruthCreatedByGuide: false,
      officialStatusVerifiedByGuide: false,
      deadlineCertifiedByGuide: false,
      externalActionAuthorizedByGuide: false,
      customerOrProviderContactAuthorizedByGuide: false,
      paidExecutionAuthorizedByGuide: false,
      generatedAt
    };
  }
}
