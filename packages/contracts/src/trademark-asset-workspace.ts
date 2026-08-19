import type { ProductLoopExactReference } from './product-loop.js';

export type TrademarkAssetId = `trademark-asset_${string}`;
export type TrademarkAssetAttentionSignalId = `trademark-asset-attention_${string}`;
export type AiGuideSuggestionId = `ai-guide-suggestion_${string}`;

export const trademarkAssetSourceOwners = [
  'MARKREG',
  'EXECUTION',
  'KNOWLEDGE',
  'DATA_ENGINE',
  'MARKETPLACE',
  'WORKSPACE_USER'
] as const;
export type TrademarkAssetSourceOwner = (typeof trademarkAssetSourceOwners)[number];

export const trademarkAssetSourceKinds = [
  'MARKREG_MATTER',
  'MARKREG_LIFECYCLE_PROJECTION',
  'MARKREG_ORDER',
  'EXECUTION_EVIDENCE',
  'KNOWLEDGE_SOURCE',
  'DATA_ENGINE_TRADEMARK_RECORD',
  'MARKETPLACE_LISTING',
  'WORKSPACE_ADMISSION',
  'WORKSPACE_NOTE'
] as const;
export type TrademarkAssetSourceKind = (typeof trademarkAssetSourceKinds)[number];

export const trademarkAssetFreshnessStates = [
  'CURRENT',
  'STALE',
  'UNKNOWN',
  'CONFLICTING'
] as const;
export type TrademarkAssetFreshnessState = (typeof trademarkAssetFreshnessStates)[number];

/**
 * Human-recognisable identity hints only. These fields help render and find an Asset,
 * but they are not used to derive the durable internal Asset ID.
 */
export interface TrademarkAssetIdentity {
  jurisdiction: string;
  markText?: string;
  markImageReference?: string;
}

export const trademarkAssetIdentifierKinds = [
  'APPLICATION_NUMBER',
  'REGISTRATION_NUMBER',
  'MADRID_IR_NUMBER',
  'INTERNAL_REFERENCE'
] as const;
export type TrademarkAssetIdentifierKind = (typeof trademarkAssetIdentifierKinds)[number];

/**
 * External identifiers may be added as the trademark progresses without changing the
 * internal TrademarkAssetId. Presence in Lite is a reference, not official verification.
 */
export interface TrademarkAssetExternalIdentifier {
  kind: TrademarkAssetIdentifierKind;
  jurisdiction: string;
  value: string;
  sourceReference?: Readonly<TrademarkAssetSourceReference>;
  officialTruthVerifiedByLite: false;
}

/**
 * Exact source pointer used by Lite to explain where an Asset claim came from.
 * Source references are evidence/projection pointers; they do not promote Lite into
 * the owning registry, Matter, lifecycle, Execution, Knowledge, Marketplace or Data Engine domain.
 */
export interface TrademarkAssetSourceReference {
  owner: TrademarkAssetSourceOwner;
  kind: TrademarkAssetSourceKind;
  sourceId: string;
  sourceVersion: string;
  sourceFingerprintSha256?: string;
  observedAt: string;
  freshness: TrademarkAssetFreshnessState;
}

export const trademarkAssetWorkspaceRelationshipKinds = [
  'OWNED',
  'MANAGED',
  'REPRESENTED',
  'MARKETPLACE_ADDED'
] as const;
export type TrademarkAssetWorkspaceRelationshipKind =
  (typeof trademarkAssetWorkspaceRelationshipKinds)[number];

/**
 * Describes why an Asset is present in a workspace. A Marketplace Asset is referenced,
 * never copied into user ownership, and its source asset/listing remains read-only.
 */
export interface TrademarkAssetWorkspaceRelationship {
  kind: TrademarkAssetWorkspaceRelationshipKind;
  sourceAssetId?: string;
  sourceReference?: Readonly<TrademarkAssetSourceReference>;
  sourceAssetEditableByWorkspace: boolean;
}

export const trademarkAssetRelationKinds = [
  'MATTER',
  'ORDER',
  'LIFECYCLE_PROJECTION',
  'EXECUTION_EVIDENCE',
  'KNOWLEDGE_SOURCE',
  'DATA_RECORD',
  'MARKETPLACE_LISTING'
] as const;
export type TrademarkAssetRelationKind = (typeof trademarkAssetRelationKinds)[number];

export interface TrademarkAssetRelation {
  kind: TrademarkAssetRelationKind;
  owner: Exclude<TrademarkAssetSourceOwner, 'WORKSPACE_USER'>;
  referenceId: string;
  referenceVersion?: string;
}

/**
 * Durable workspace-private Asset Anchor. Lite owns only the user's private workspace context.
 * Current official facts such as status, lifecycle dates, owner and Nice classes are composed
 * from their owner domains rather than persisted here as canonical truth.
 */
export interface TrademarkAsset {
  schemaVersion: 1;
  trademarkAssetId: TrademarkAssetId;
  workspaceId: string;
  version: number;
  identity: Readonly<TrademarkAssetIdentity>;
  externalIdentifiers: ReadonlyArray<Readonly<TrademarkAssetExternalIdentifier>>;
  workspaceRelationships: ReadonlyArray<Readonly<TrademarkAssetWorkspaceRelationship>>;
  sourceReferences: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  relations: ReadonlyArray<Readonly<TrademarkAssetRelation>>;
  ownerOrClientReference?: string;
  workspaceTags: readonly string[];
  workspaceNotes: readonly string[];
  workspacePriority?: string;
  workspaceAlias?: string;
  officialTruthVerifiedByLite: false;
  filingExecutedByLite: false;
  createdAt: string;
  updatedAt: string;
}

export const trademarkAssetAttentionDimensions = [
  'TIME_SENSITIVITY',
  'SOURCE_FRESHNESS',
  'MISSING_CONTEXT',
  'LIFECYCLE_RECOMMENDATION',
  'KNOWLEDGE_CHANGE_RELEVANCE',
  'USER_PRIORITY'
] as const;
export type TrademarkAssetAttentionDimension = (typeof trademarkAssetAttentionDimensions)[number];

export const trademarkAssetAttentionSeverities = ['INFO', 'NOTICE', 'IMPORTANT', 'URGENT'] as const;
export type TrademarkAssetAttentionSeverity = (typeof trademarkAssetAttentionSeverities)[number];

export interface TrademarkAssetAttentionSignal {
  schemaVersion: 1;
  attentionSignalId: TrademarkAssetAttentionSignalId;
  workspaceId: string;
  version: number;
  asset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  dimension: TrademarkAssetAttentionDimension;
  severity: TrademarkAssetAttentionSeverity;
  reason: string;
  evidence: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  generatedAt: string;
  legalDeadlineCertified: false;
  officialStatusVerifiedByLite: false;
  executionAuthorized: false;
}

export const aiGuideSuggestionKinds = [
  'EXPLAIN_ASSET',
  'SUMMARIZE_OWNER_CONTEXT',
  'IDENTIFY_MISSING_INFORMATION',
  'EXPLAIN_SOURCE_CHANGE',
  'COMPARE_ASSETS',
  'PREPARE_CHECKLIST',
  'PREPARE_TODAY_CANDIDATE',
  'PREPARE_CONTENT_CANDIDATE',
  'PREPARE_OWNER_ACTION_CANDIDATE'
] as const;
export type AiGuideSuggestionKind = (typeof aiGuideSuggestionKinds)[number];

export interface AiGuideContext {
  schemaVersion: 1;
  workspaceId: string;
  subjectUserId: string;
  asset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  sourceReferences: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  relatedOwnerReferences: ReadonlyArray<Readonly<TrademarkAssetRelation>>;
  freshness: TrademarkAssetFreshnessState;
  compiledAt: string;
  permissionScopeVerified: true;
}

/**
 * Assistive Product output only. Suggestions may prepare bounded candidates, but they
 * never perform, approve or verify a protected or external action by themselves.
 */
export interface AiGuideSuggestion {
  schemaVersion: 1;
  aiGuideSuggestionId: AiGuideSuggestionId;
  workspaceId: string;
  version: number;
  asset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  kind: AiGuideSuggestionKind;
  title: string;
  explanation: string;
  evidence: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  staleOrConflictingEvidencePresent: boolean;
  userConfirmationRequiredForAnyConsequence: true;
  externalActionAuthorized: false;
  filingAuthorized: false;
  customerOrProviderContactAuthorized: false;
  paidExecutionAuthorized: false;
  officialTruthVerified: false;
  capabilityVerified: false;
  createdAt: string;
}

export const trademarkAssetAiGuideAuthority = {
  mayExplainAsset: true,
  maySummarizeOwnerContext: true,
  mayIdentifyMissingInformation: true,
  mayExplainRelevantSourceChange: true,
  mayCompareAccessibleAssets: true,
  mayPrepareChecklist: true,
  mayPrepareTodayCandidate: true,
  mayPrepareContentCandidate: true,
  mayPrepareOwnerActionCandidate: true,
  mayCertifyDeadline: false,
  mayVerifyOfficialStatus: false,
  mayFileExternally: false,
  mayContactCustomerOrProvider: false,
  mayApproveProfessionalReview: false,
  mayCreateVerifiedCapability: false,
  mayAuthorizePaidExecution: false,
  mayBypassOwnerDomainValidation: false
} as const;

export const trademarkAssetAuthorityBoundary = {
  assetIsWorkspacePrivateProjection: true,
  assetIdIsStableAndIndependentOfExternalIdentifiers: true,
  externalIdentifiersMayAccumulateWithoutChangingAssetId: true,
  marketplaceAssetsAreReferencedNotCopied: true,
  marketplaceSourceAssetEditableByWorkspace: false,
  exactSourceAndFreshnessRequiredForConsequentialClaims: true,
  markRegRemainsMatterAndLifecycleOwner: true,
  executionRemainsProtectedActionOwner: true,
  dataEngineConsumptionReadOnlyAndContractBound: true,
  knowledgeRemainsAcquisitionAndProvenanceOwner: true,
  marketplaceRemainsListingSourceOwner: true,
  crossServiceSqlAllowed: false,
  assetCreatesOfficialTruth: false,
  assetCreatesMatterAutomatically: false,
  attentionCertifiesDeadline: false,
  aiGuideExecutesProtectedAction: false,
  aiGuideVerifiesCapability: false
} as const;

export const noAutomaticTrademarkAssetConsequences = [
  'OFFICIAL_STATUS_VERIFICATION',
  'DEADLINE_CERTIFICATION',
  'FILING_SUBMISSION',
  'CUSTOMER_OR_PROVIDER_CONTACT',
  'ORDER_OR_MATTER_CREATION',
  'PROFESSIONAL_REVIEW_APPROVAL',
  'PAID_EXECUTION',
  'CAPABILITY_VERIFICATION',
  'OFFICIAL_TRUTH_CREATION',
  'MARKETPLACE_SOURCE_MUTATION'
] as const;
