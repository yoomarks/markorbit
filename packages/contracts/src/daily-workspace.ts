import type {
  ContentDraftId,
  ContentOpportunityId,
  ProductLoopExactReference,
  ProductLoopSourceReference,
  PublishPackageId,
  TodayRecommendationId
} from './product-loop.js';

export type DailySignalId = `daily-signal_${string}`;
export type DailyOrbitItemId = `daily-orbit-item_${string}`;
export type ContentPickId = `content-pick_${string}`;
export type ContentKitId = `content-kit_${string}`;
export type CreatorPreferenceId = `creator-preference_${string}`;
export type VisualBriefId = `visual-brief_${string}`;
export type VisualOutputReferenceId = `visual-output_${string}`;
export type ProductPreferenceEventId = `product-preference-event_${string}`;

export const dailySignalChangeTypes = [
  'RULE_CHANGE',
  'FEE_CHANGE',
  'DEADLINE_CHANGE',
  'CASE_DECISION',
  'OFFICE_NOTICE',
  'INDUSTRY_NEWS',
  'MARKET_SIGNAL',
  'OTHER'
] as const;
export type DailySignalChangeType = (typeof dailySignalChangeTypes)[number];

export const dailySignalTimeSensitivity = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type DailySignalTimeSensitivity = (typeof dailySignalTimeSensitivity)[number];

/**
 * Lite-owned source-derived candidate input for Daily Orbit.
 * It carries governed provenance but does not assert legal/official truth.
 */
export interface DailySignal {
  schemaVersion: 1;
  dailySignalId: DailySignalId;
  workspaceId: string;
  version: number;
  source: Readonly<ProductLoopSourceReference>;
  title: string;
  summary: string;
  keyFacts: readonly string[];
  jurisdictions: readonly string[];
  institution?: string;
  topicTags: readonly string[];
  changeType: DailySignalChangeType;
  sourcePublishedAt?: string;
  observedAt: string;
  timeSensitivity: DailySignalTimeSensitivity;
  dailySignalFingerprintSha256: string;
  legalTruthVerified: false;
  recommendationCreatedAutomatically: false;
  createdAt: string;
}

export interface DailyOrbitScoreComponent {
  score: number;
  reason: string;
}

export interface DailyOrbitScore {
  importance: Readonly<DailyOrbitScoreComponent>;
  personalRelevance: Readonly<DailyOrbitScoreComponent>;
  timeSensitivity: Readonly<DailyOrbitScoreComponent>;
  contentPotential: Readonly<DailyOrbitScoreComponent>;
  total: number;
}

export const dailyOrbitSections = [
  'TODAYS_ORBIT',
  'FOR_YOU',
  'RISK',
  'OPPORTUNITY',
  'WORTH_REVISITING'
] as const;
export type DailyOrbitSection = (typeof dailyOrbitSections)[number];

/** Read/product projection. Ranking does not authorize work or create official truth. */
export interface DailyOrbitItem {
  schemaVersion: 1;
  dailyOrbitItemId: DailyOrbitItemId;
  workspaceId: string;
  version: number;
  signal: Readonly<ProductLoopExactReference<DailySignalId>>;
  recommendation?: Readonly<ProductLoopExactReference<TodayRecommendationId>>;
  section: DailyOrbitSection;
  score: Readonly<DailyOrbitScore>;
  whyThisMatters: string;
  source: Readonly<ProductLoopSourceReference>;
  rankedAt: string;
  executionAuthorized: false;
  legalTruthVerified: false;
}

export const contentPickPlatforms = [
  'WECHAT_MOMENTS',
  'XIAOHONGSHU',
  'WECHAT_OFFICIAL_ACCOUNT',
  'VIDEO_SCRIPT'
] as const;
export type ContentPickPlatform = (typeof contentPickPlatforms)[number];

/** Candidate editorial choice only. It is not a Content Draft or PublishPackage. */
export interface ContentPick {
  schemaVersion: 1;
  contentPickId: ContentPickId;
  workspaceId: string;
  version: number;
  orbitItem: Readonly<ProductLoopExactReference<DailyOrbitItemId>>;
  recommendation: Readonly<ProductLoopExactReference<TodayRecommendationId>>;
  title: string;
  whyPublish: string;
  suggestedAngles: readonly string[];
  recommendedPlatforms: readonly ContentPickPlatform[];
  contentOpportunity?: Readonly<ProductLoopExactReference<ContentOpportunityId>>;
  publishAuthorized: false;
  externalPublishExecuted: false;
  createdAt: string;
}

export interface ContentAngle {
  angleId: string;
  title: string;
  thesis: string;
  audience: string;
  evidenceNotes: readonly string[];
}

export const platformVariantKinds = [
  'WECHAT_MOMENTS_POST',
  'XIAOHONGSHU_POST',
  'WECHAT_OFFICIAL_ACCOUNT_OUTLINE',
  'WECHAT_OFFICIAL_ACCOUNT_DRAFT',
  'VIDEO_SCRIPT_30S',
  'VIDEO_SCRIPT_60S'
] as const;
export type PlatformVariantKind = (typeof platformVariantKinds)[number];

export interface PlatformVariant {
  variantId: string;
  kind: PlatformVariantKind;
  title: string;
  body: string;
  topicTags: readonly string[];
  draft?: Readonly<ProductLoopExactReference<ContentDraftId>>;
  humanReviewRequired: true;
  externalPublishExecuted: false;
}

/**
 * Product working projection around the existing Content Opportunity/Draft lifecycle.
 * It does not replace or own Content Draft review/publication transitions.
 */
export interface ContentKit {
  schemaVersion: 1;
  contentKitId: ContentKitId;
  workspaceId: string;
  version: number;
  contentPick: Readonly<ProductLoopExactReference<ContentPickId>>;
  contentOpportunity: Readonly<ProductLoopExactReference<ContentOpportunityId>>;
  sources: ReadonlyArray<Readonly<ProductLoopSourceReference>>;
  whyItMatters: string;
  whyPublish: string;
  angles: readonly Readonly<ContentAngle>[];
  audience: string;
  platformVariants: readonly Readonly<PlatformVariant>[];
  draftReferences: ReadonlyArray<Readonly<ProductLoopExactReference<ContentDraftId>>>;
  publishPackageReferences: ReadonlyArray<Readonly<ProductLoopExactReference<PublishPackageId>>>;
  visualBriefReferences: ReadonlyArray<Readonly<ProductLoopExactReference<VisualBriefId>>>;
  externalPublishExecuted: false;
  createdAt: string;
  updatedAt: string;
}

export const creatorPreferenceSources = ['EXPLICIT', 'PRODUCT_FEEDBACK'] as const;
export type CreatorPreferenceSource = (typeof creatorPreferenceSources)[number];

export interface CreatorPreference {
  schemaVersion: 1;
  creatorPreferenceId: CreatorPreferenceId;
  workspaceId: string;
  subjectUserId: string;
  version: number;
  source: CreatorPreferenceSource;
  professionalRole?: string;
  organizationType?: string;
  primaryJurisdictions: readonly string[];
  professionalTopics: readonly string[];
  targetAudiences: readonly string[];
  preferredPlatforms: readonly ContentPickPlatform[];
  tonePreferences: readonly string[];
  capabilityVerified: false;
  updatedAt: string;
}

export const visualOutputKinds = [
  'XIAOHONGSHU_COVER',
  'WECHAT_OFFICIAL_ACCOUNT_COVER',
  'MOMENTS_SOCIAL_CARD',
  'VIDEO_COVER'
] as const;
export type VisualOutputKind = (typeof visualOutputKinds)[number];

/** Consumer-safe request. Provider/model/payment/QC override controls are intentionally absent. */
export interface VisualBrief {
  schemaVersion: 1;
  visualBriefId: VisualBriefId;
  workspaceId: string;
  version: number;
  contentKit: Readonly<ProductLoopExactReference<ContentKitId>>;
  title: string;
  keyMessage: string;
  audience: string;
  outputKind: VisualOutputKind;
  aspectRatio: string;
  styleIntent: string;
  requestedIpPackage?: string;
  sceneIntent: string;
  reuseFirstRequired: true;
  paidExecutionAuthorized: false;
  createdAt: string;
}

export const visualOutputStatuses = [
  'REUSED_CERTIFIED_ASSET',
  'READY',
  'PLANNING_REQUIRED',
  'FAILED'
] as const;
export type VisualOutputStatus = (typeof visualOutputStatuses)[number];

export interface VisualOutputReference {
  schemaVersion: 1;
  visualOutputReferenceId: VisualOutputReferenceId;
  workspaceId: string;
  version: number;
  visualBrief: Readonly<ProductLoopExactReference<VisualBriefId>>;
  owner: 'VISUAL_ENGINE';
  requestReference: string;
  outputReference?: string;
  status: VisualOutputStatus;
  qcStatus?: 'PASS' | 'PASS_WITH_WARNINGS';
  providerExecutionAuthorizedByLite: false;
  paidExecutionAuthorizedByLite: false;
  createdAt: string;
}

export const productPreferenceEventKinds = [
  'SHOWN',
  'OPENED',
  'DISMISSED',
  'SAVED',
  'CONTENT_STARTED',
  'ANGLE_SELECTED',
  'PLATFORM_VARIANT_GENERATED',
  'DRAFT_EDITED',
  'VISUAL_REQUESTED',
  'VISUAL_GENERATED',
  'VISUAL_SELECTED',
  'COPIED',
  'EXPORTED',
  'USER_REPORTED_PUBLISHED',
  'USER_REPORTED_USED',
  'NOT_USED'
] as const;
export type ProductPreferenceEventKind = (typeof productPreferenceEventKinds)[number];

export interface ProductPreferenceEvent {
  schemaVersion: 1;
  productPreferenceEventId: ProductPreferenceEventId;
  workspaceId: string;
  subjectUserId: string;
  kind: ProductPreferenceEventKind;
  targetType:
    | 'DAILY_ORBIT_ITEM'
    | 'CONTENT_PICK'
    | 'CONTENT_KIT'
    | 'PLATFORM_VARIANT'
    | 'VISUAL_OUTPUT';
  targetId: string;
  targetVersion: number | string;
  recordedAt: string;
  externalActionExecutedByMarkOrbit: false;
  externalOutcomeVerifiedByMarkOrbit: false;
  capabilityVerified: false;
}

export const dailyWorkspaceAiAuthority = Object.freeze({
  mayRankDailySignals: true,
  mayExplainRelevance: true,
  maySuggestContentPicks: true,
  maySuggestAngles: true,
  mayDraftPlatformVariants: true,
  mayPrepareVisualBrief: true,
  mayConfirmForUser: false,
  mayApproveContent: false,
  mayPublishExternally: false,
  mayContactCustomer: false,
  mayQualifyFormalOpportunity: false,
  mayCreateOrderOrMatter: false,
  mayAuthorizePaidVisualExecution: false,
  mayVerifyProfessionalCapability: false,
  mayCreateOfficialTruth: false
} as const);

export const noAutomaticDailyWorkspaceConsequences = Object.freeze({
  externalPublishExecuted: false,
  customerContacted: false,
  formalOpportunityCreated: false,
  orderCreated: false,
  matterCreated: false,
  paymentCreated: false,
  providerExecutionAuthorized: false,
  professionalCapabilityVerified: false,
  officialTruthCreated: false
} as const);
