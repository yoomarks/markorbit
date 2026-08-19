import type {
  AiGuideSuggestion,
  AiGuideSuggestionKind,
  TrademarkAssetId,
  TrademarkAssetSourceReference
} from './trademark-asset-workspace.js';

export const trademarkAssetAiGuideContextKinds = [
  'ASSET_COMPOSITION',
  'COMMERCE_PROFILE',
  'MARKETPLACE_OVERLAY',
  'WORKSPACE_CONTEXT'
] as const;
export type TrademarkAssetAiGuideContextKind = (typeof trademarkAssetAiGuideContextKinds)[number];

export interface TrademarkAssetAiGuideContextReference {
  kind: TrademarkAssetAiGuideContextKind;
  referenceId: string;
  referenceVersion: string;
  fingerprintSha256?: string;
}

export interface PrepareTrademarkAssetAiGuideInput {
  workspaceId: string;
  subjectUserId: string;
  trademarkAssetId: TrademarkAssetId;
  expectedTrademarkAssetVersion: number;
  requestedKinds: readonly AiGuideSuggestionKind[];
  contextReferences: readonly TrademarkAssetAiGuideContextReference[];
  idempotencyKey: string;
}

export interface TrademarkAssetAiGuidePreparedResult {
  schemaVersion: 1;
  workspaceId: string;
  subjectUserId: string;
  trademarkAssetId: TrademarkAssetId;
  trademarkAssetVersion: number;
  contextReferences: readonly TrademarkAssetAiGuideContextReference[];
  evidence: readonly TrademarkAssetSourceReference[];
  suggestions: readonly AiGuideSuggestion[];
  staleOrConflictingEvidencePresent: boolean;
  officialTruthCreatedByGuide: false;
  officialStatusVerifiedByGuide: false;
  deadlineCertifiedByGuide: false;
  externalActionAuthorizedByGuide: false;
  customerOrProviderContactAuthorizedByGuide: false;
  paidExecutionAuthorizedByGuide: false;
  generatedAt: string;
}

export const trademarkAssetAiGuidePreparationAuthority = {
  mayConsumeComposedAssetFacts: true,
  mayConsumeAdvisoryContextSignals: true,
  mayConsumeWorkspacePrivateCommerceContext: true,
  mayConsumeWorkspacePrivateMarketplaceOverlay: true,
  mayExplainEvidence: true,
  mayIdentifyMissingContext: true,
  mayPrepareChecklist: true,
  mayPrepareContentCandidate: true,
  mayPrepareOwnerActionCandidate: true,
  mayPromoteAiTextToOfficialFact: false,
  mayResolveSourceConflictSilently: false,
  mayCertifyDeadline: false,
  mayVerifyOfficialStatus: false,
  mayMutateTrademarkAssetSourceTruth: false,
  mayMutateMarketplaceSourceListing: false,
  mayFileExternally: false,
  mayContactCustomerOrProvider: false,
  mayAuthorizePaidExecution: false
} as const;
