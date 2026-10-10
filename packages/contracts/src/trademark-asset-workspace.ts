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
  'MANAGED_COMMUNICATION',
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
  'MANAGED_COMMUNICATION_MESSAGE',
  'WORKSPACE_ADMISSION',
  'WORKSPACE_NOTE',
  'WORKSPACE_CONFIRMATION'
] as const;
export type TrademarkAssetSourceKind = (typeof trademarkAssetSourceKinds)[number];
export const trademarkAssetSourceKindsByOwner = {
  MARKREG: ['MARKREG_MATTER', 'MARKREG_LIFECYCLE_PROJECTION', 'MARKREG_ORDER'],
  EXECUTION: ['EXECUTION_EVIDENCE'],
  KNOWLEDGE: ['KNOWLEDGE_SOURCE'],
  DATA_ENGINE: ['DATA_ENGINE_TRADEMARK_RECORD'],
  MARKETPLACE: ['MARKETPLACE_LISTING'],
  MANAGED_COMMUNICATION: ['MANAGED_COMMUNICATION_MESSAGE'],
  WORKSPACE_USER: ['WORKSPACE_ADMISSION', 'WORKSPACE_NOTE', 'WORKSPACE_CONFIRMATION']
} as const satisfies Readonly<
  Record<TrademarkAssetSourceOwner, readonly TrademarkAssetSourceKind[]>
>;

/** Fail closed when a source kind is attached to the wrong source owner. */
export function isTrademarkAssetSourceOwnerKindPair(owner: string, kind: string): boolean {
  if (!trademarkAssetSourceOwners.includes(owner as TrademarkAssetSourceOwner)) return false;
  if (!trademarkAssetSourceKinds.includes(kind as TrademarkAssetSourceKind)) return false;
  return (
    trademarkAssetSourceKindsByOwner[owner as TrademarkAssetSourceOwner] as readonly string[]
  ).includes(kind);
}
export function parseTrademarkAssetSourceOwnerKind(
  owner: unknown,
  kind: unknown
): { owner: TrademarkAssetSourceOwner; kind: TrademarkAssetSourceKind } {
  if (
    typeof owner !== 'string' ||
    typeof kind !== 'string' ||
    !isTrademarkAssetSourceOwnerKindPair(owner, kind)
  ) {
    throw new TypeError('Invalid Trademark Asset source owner/kind pair.');
  }
  return {
    owner: owner as TrademarkAssetSourceOwner,
    kind: kind as TrademarkAssetSourceKind
  };
}

export const trademarkAssetFreshnessStates = [
  'CURRENT',
  'STALE',
  'UNKNOWN',
  'CONFLICTING'
] as const;
export type TrademarkAssetFreshnessState = (typeof trademarkAssetFreshnessStates)[number];

export const trademarkAssetSourceReadStates = [
  'OBSERVED',
  'EMPTY',
  'NOT_OBSERVED',
  'NOT_COVERED',
  'UNAVAILABLE'
] as const;
export type TrademarkAssetSourceReadState = (typeof trademarkAssetSourceReadStates)[number];

export interface TrademarkAssetSourceScopeReadV1 {
  owner: TrademarkAssetSourceOwner;
  state: TrademarkAssetSourceReadState;
}

function trademarkAssetRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertTrademarkAssetExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  field: string
): void {
  if (Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) {
    throw new TypeError(`${field} must contain exactly the V1 fields.`);
  }
}

function trademarkAssetText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new TypeError(`${field} must be a non-empty string of at most ${maximum} characters.`);
  }
  return value.trim();
}

function trademarkAssetTimestamp(value: unknown, field: string): string {
  const timestamp = trademarkAssetText(value, field, 100);
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/u.exec(
      timestamp
    );
  if (!match) {
    throw new TypeError(`${field} must be an ISO timestamp.`);
  }
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    ,
    offsetHour,
    offsetMinute
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const daysInMonth =
    month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (
    day < 1 ||
    day > daysInMonth ||
    Number(hourText) > 23 ||
    Number(minuteText) > 59 ||
    Number(secondText) > 59 ||
    (offsetHour !== undefined && Number(offsetHour) > 23) ||
    (offsetMinute !== undefined && Number(offsetMinute) > 59)
  ) {
    throw new TypeError(`${field} must be an ISO timestamp.`);
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`${field} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

export function parseTrademarkAssetSourceReadState(value: unknown): TrademarkAssetSourceReadState {
  if (
    typeof value !== 'string' ||
    !trademarkAssetSourceReadStates.includes(value as TrademarkAssetSourceReadState)
  ) {
    throw new TypeError('Trademark Asset source read state is invalid.');
  }
  return value as TrademarkAssetSourceReadState;
}

export function isCompleteTrademarkAssetSourceReadState(
  state: TrademarkAssetSourceReadState
): boolean {
  return state === 'OBSERVED' || state === 'EMPTY';
}

export function parseTrademarkAssetSourceScopeReadV1(
  value: unknown
): TrademarkAssetSourceScopeReadV1 {
  const input = trademarkAssetRecord(value, 'TrademarkAssetSourceScopeReadV1');
  assertTrademarkAssetExactKeys(input, ['owner', 'state'], 'TrademarkAssetSourceScopeReadV1');
  if (
    typeof input.owner !== 'string' ||
    !trademarkAssetSourceOwners.includes(input.owner as TrademarkAssetSourceOwner)
  ) {
    throw new TypeError('TrademarkAssetSourceScopeReadV1.owner is invalid.');
  }
  return {
    owner: input.owner as TrademarkAssetSourceOwner,
    state: parseTrademarkAssetSourceReadState(input.state)
  };
}

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
 * the owning registry, Matter, lifecycle, Execution, Knowledge, Marketplace, Data Engine or Managed Communication domain.
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

/** Strictly parses an exact owner-backed source reference without creating source authority. */
export function parseTrademarkAssetSourceReference(value: unknown): TrademarkAssetSourceReference {
  const input = trademarkAssetRecord(value, 'TrademarkAssetSourceReference');
  assertTrademarkAssetExactKeys(
    input,
    [
      'owner',
      'kind',
      'sourceId',
      'sourceVersion',
      ...(input.sourceFingerprintSha256 === undefined ? [] : ['sourceFingerprintSha256']),
      'observedAt',
      'freshness'
    ],
    'TrademarkAssetSourceReference'
  );
  const { owner, kind } = parseTrademarkAssetSourceOwnerKind(input.owner, input.kind);
  const sourceFingerprintSha256 = input.sourceFingerprintSha256;
  if (
    sourceFingerprintSha256 !== undefined &&
    (typeof sourceFingerprintSha256 !== 'string' ||
      !/^[0-9a-f]{64}$/u.test(sourceFingerprintSha256))
  ) {
    throw new TypeError(
      'TrademarkAssetSourceReference.sourceFingerprintSha256 must be lowercase SHA-256.'
    );
  }
  const freshness =
    typeof input.freshness === 'string'
      ? trademarkAssetFreshnessStates.find((candidate) => candidate === input.freshness)
      : undefined;
  if (!freshness) {
    throw new TypeError('TrademarkAssetSourceReference.freshness is invalid.');
  }
  return {
    owner,
    kind,
    sourceId: trademarkAssetText(input.sourceId, 'TrademarkAssetSourceReference.sourceId', 500),
    sourceVersion: trademarkAssetText(
      input.sourceVersion,
      'TrademarkAssetSourceReference.sourceVersion',
      300
    ),
    ...(sourceFingerprintSha256 === undefined ? {} : { sourceFingerprintSha256 }),
    observedAt: trademarkAssetTimestamp(
      input.observedAt,
      'TrademarkAssetSourceReference.observedAt'
    ),
    freshness
  };
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
  owner: Exclude<TrademarkAssetSourceOwner, 'WORKSPACE_USER' | 'MANAGED_COMMUNICATION'>;
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
