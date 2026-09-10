import type { ProductLoopExactReference } from './product-loop.js';
import type { MarkOrbitId } from './index.js';
import type { ManagedAiRetryDisposition } from './managed-ai-execution.js';
import type { TradingShowcaseId, TradingShowcaseV1 } from './trading-brand-dna.js';
import type {
  TradingAiProfileId,
  TradingAiProfileV1,
  TradingBuyingPointId,
  TradingCommercialPersonaId,
  TradingCommercialScenarioId
} from './trading-ai-profile.js';
import type {
  TradingCommercialDirectionId,
  TradingCommercialDirectionVersionV1
} from './trading-commercial-direction.js';
import type {
  TradingDirectionSelectionId,
  TradingDirectionSelectionV1
} from './trading-direction-selection.js';
import {
  assertTradingAiProvenanceV1,
  type TradingAiProvenanceV1
} from './trading-ai-provenance.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TradingSourceAssetId = `source-asset_${string}`;
export type TradingListingAssetId = `listing-asset_${string}`;
export type TradingStudioVisualAssetId = `trading-ai-derived_visual-asset_${string}`;
export type TradingStudioVisualQualityReviewId = `trading-studio-visual-quality-review_${string}`;
export type TradingSourceMediaReference = `source-media_${string}`;
export type TradingListingMediaReference = `listing-media_${string}`;
export type TradingStudioMediaReference = `studio-media_${string}`;

export const tradingSourceAssetOrigins = ['USER_PROVIDED', 'EXISTING_REAL_BRAND_MATERIAL'] as const;
export type TradingSourceAssetOrigin = (typeof tradingSourceAssetOrigins)[number];

export const tradingListingAssetContentClasses = ['EXISTING_ASSET', 'AI_CONCEPT'] as const;
export type TradingListingAssetContentClass = (typeof tradingListingAssetContentClasses)[number];

export type TradingListingAssetAdmissionId = `trading-listing-asset-admission_${string}`;

export interface TradingListingAssetAdmissionSourceV1 {
  workspaceId: string;
  studioVisualAsset: Readonly<ProductLoopExactReference<TradingStudioVisualAssetId>>;
  qualityReview: Readonly<ProductLoopExactReference<TradingStudioVisualQualityReviewId>>;
  showcase: Readonly<ProductLoopExactReference<TradingShowcaseId>>;
  showcasePanelSlotId: string;
}

export interface TradingListingAssetPublicRepresentationApprovalV1 {
  method: 'EXPLICIT_HUMAN_ACTION';
  approvalReference: string;
  approvedAt: string;
}

export interface TradingListingAssetAdmissionV1 {
  schemaVersion: 1;
  admissionId: TradingListingAssetAdmissionId;
  source: Readonly<TradingListingAssetAdmissionSourceV1>;
  publicRepresentationApproval: Readonly<TradingListingAssetPublicRepresentationApprovalV1>;
}

export const tradingVisualCreativeRoles = [
  'HERO',
  'BRAND_WORLD',
  'PACKAGING',
  'PRODUCT_SCENE',
  'CHANNEL_ASSET'
] as const;
export type TradingVisualCreativeRole = (typeof tradingVisualCreativeRoles)[number];

export interface TradingAssetOwnerReferenceV1 {
  ownerReference: string;
  ownerVersion: number | string;
}

export const noTradingAssetClassificationAuthorityConsequencesV1 = Object.freeze({
  sourceAssetPublished: false,
  listingPublished: false,
  marketplacePublicationCreated: false,
  trademarkTruthMutated: false,
  ownershipOrAuthorityVerified: false
});
export type TradingAssetClassificationAuthorityConsequencesV1 =
  typeof noTradingAssetClassificationAuthorityConsequencesV1;

interface TradingAssetBaseV1 {
  schemaVersion: 1;
  version: number;
  trademarkAsset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  owner: Readonly<TradingAssetOwnerReferenceV1>;
  createdAt: string;
  authorityConsequences: TradingAssetClassificationAuthorityConsequencesV1;
}

/** Private real material used as an input. Creating this record never approves publication. */
export interface TradingSourceAssetV1 extends TradingAssetBaseV1 {
  classification: 'SOURCE_ASSET';
  sourceAssetId: TradingSourceAssetId;
  workspaceId: string;
  mediaReference: TradingSourceMediaReference;
  origin: TradingSourceAssetOrigin;
  visibility: 'PRIVATE';
}

/**
 * A distinct, explicitly approved public representation for a future Listing. It is not the
 * Source Asset record and does not itself publish a Listing.
 */
export interface TradingListingAssetV1 extends TradingAssetBaseV1 {
  classification: 'LISTING_ASSET';
  listingAssetId: TradingListingAssetId;
  mediaReference: TradingListingMediaReference;
  contentClass: TradingListingAssetContentClass;
  provenanceReferences: readonly string[];
  publicationApprovalReference: string;
  admission?: Readonly<TradingListingAssetAdmissionV1>;
  visibility: 'LISTING_PUBLIC';
  aiConceptLabel: boolean;
  commercialDirection?: Readonly<ProductLoopExactReference<TradingCommercialDirectionId>>;
  aiProfile?: Readonly<ProductLoopExactReference<TradingAiProfileId>>;
  targetAudienceRefs?: readonly TradingCommercialPersonaId[];
  buyingPointRefs?: readonly TradingBuyingPointId[];
  scenarioRefs?: readonly TradingCommercialScenarioId[];
  creativeRole?: TradingVisualCreativeRole;
}

/** Private AI concept generated from one exact human-selected DirectionVersion. */
export interface TradingStudioVisualAssetV1 extends TradingAssetBaseV1 {
  classification: 'STUDIO_VISUAL_ASSET';
  studioVisualAssetId: TradingStudioVisualAssetId;
  workspaceId: string;
  mediaReference: TradingStudioMediaReference;
  directionSelection: Readonly<ProductLoopExactReference<TradingDirectionSelectionId>>;
  commercialDirection: Readonly<ProductLoopExactReference<TradingCommercialDirectionId>>;
  aiProfile: Readonly<ProductLoopExactReference<TradingAiProfileId>>;
  sourceAssets: readonly Readonly<ProductLoopExactReference<TradingSourceAssetId>>[];
  generationRecipeReference: string;
  provenance: Readonly<TradingAiProvenanceV1>;
  targetAudienceRefs?: readonly TradingCommercialPersonaId[];
  buyingPointRefs?: readonly TradingBuyingPointId[];
  scenarioRefs?: readonly TradingCommercialScenarioId[];
  creativeRole: TradingVisualCreativeRole;
  visibility: 'PRIVATE';
  publicationEligibility: 'NOT_ELIGIBLE';
  aiConceptLabel: true;
}

export const tradingStudioVisualQualityStatuses = ['PASS', 'PASS_WITH_WARNINGS', 'FAIL'] as const;
export type TradingStudioVisualQualityStatus = (typeof tradingStudioVisualQualityStatuses)[number];

export interface TradingStudioVisualQualityFindingV1 {
  code: string;
  message: string;
}

export const noTradingStudioVisualQualityAuthorityConsequencesV1 = Object.freeze({
  humanApprovalCreated: false,
  showcaseApproved: false,
  listingPublicationCreated: false,
  trademarkTruthMutated: false
});
export type TradingStudioVisualQualityAuthorityConsequencesV1 =
  typeof noTradingStudioVisualQualityAuthorityConsequencesV1;

/** Quality evidence for one exact Studio visual; it is not approval or execution authority. */
export interface TradingStudioVisualQualityReviewV1 {
  schemaVersion: 1;
  visualQualityReviewId: TradingStudioVisualQualityReviewId;
  workspaceId: string;
  version: number;
  studioVisualAsset: Readonly<ProductLoopExactReference<TradingStudioVisualAssetId>>;
  status: TradingStudioVisualQualityStatus;
  findings: readonly Readonly<TradingStudioVisualQualityFindingV1>[];
  retryDisposition: ManagedAiRetryDisposition;
  reviewedAt: string;
  authorityConsequences: TradingStudioVisualQualityAuthorityConsequencesV1;
}

/** Trusted server context supplies Workspace and actor authority. */
export interface RequestTradingStudioVisualRetryCommandV1 {
  schemaVersion: 1;
  studioVisualAssetId: TradingStudioVisualAssetId;
  expectedAssetVersion: number;
  visualQualityReviewId: TradingStudioVisualQualityReviewId;
  expectedReviewVersion: number;
  attemptNumber: 1 | 2 | 3;
  reason: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export type TradingAssetReferenceV1 =
  TradingSourceAssetV1 | TradingStudioVisualAssetV1 | TradingListingAssetV1;

export class TradingAssetClassificationValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingAssetClassificationValidationError';
  }
}

function required(value: string, field: string): void {
  if (!value.trim()) throw new TradingAssetClassificationValidationError(`${field} is required.`);
}

function positiveVersion(value: number | string, field: string): void {
  if (
    (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 1)) ||
    (typeof value === 'string' && !value.trim())
  )
    throw new TradingAssetClassificationValidationError(`${field} must identify a version.`);
}

function assertNoAuthority(consequences: TradingAssetClassificationAuthorityConsequencesV1): void {
  for (const [key, value] of Object.entries(consequences)) {
    if (value !== false)
      throw new TradingAssetClassificationValidationError(
        `tradingAsset.authorityConsequences.${key} must be false.`
      );
  }
}

function sameReference(
  left: Readonly<ProductLoopExactReference>,
  right: Readonly<ProductLoopExactReference>
): boolean {
  return left.id === right.id && left.version === right.version;
}

function assertDistinctReferences(values: readonly string[] | undefined, field: string): void {
  if (values?.some((value) => !value.trim()) || (values && new Set(values).size !== values.length))
    throw new TradingAssetClassificationValidationError(
      `${field} must contain distinct non-empty references.`
    );
}

function timestamp(value: string, field: string): void {
  if (!value.trim() || Number.isNaN(Date.parse(value)))
    throw new TradingAssetClassificationValidationError(`${field} must be an ISO timestamp.`);
}

function assertListingAssetAdmissionShape(
  admission: Readonly<TradingListingAssetAdmissionV1>,
  publicationApprovalReference: string
): void {
  if (admission.schemaVersion !== 1)
    throw new TradingAssetClassificationValidationError(
      'tradingAsset.admission.schemaVersion must be 1.'
    );
  if (!/^trading-listing-asset-admission_[A-Za-z0-9_-]+$/u.test(admission.admissionId))
    throw new TradingAssetClassificationValidationError(
      'tradingAsset.admission.admissionId is invalid.'
    );
  required(admission.source.workspaceId, 'tradingAsset.admission.source.workspaceId');
  if (
    !/^trading-ai-derived_visual-asset_[A-Za-z0-9_-]+$/u.test(admission.source.studioVisualAsset.id)
  )
    throw new TradingAssetClassificationValidationError(
      'tradingAsset.admission.source.studioVisualAsset must identify a Studio Visual Asset.'
    );
  positiveVersion(
    admission.source.studioVisualAsset.version,
    'tradingAsset.admission.source.studioVisualAsset.version'
  );
  if (
    !/^trading-studio-visual-quality-review_[A-Za-z0-9_-]+$/u.test(
      admission.source.qualityReview.id
    )
  )
    throw new TradingAssetClassificationValidationError(
      'tradingAsset.admission.source.qualityReview must identify a Visual Quality Review.'
    );
  positiveVersion(
    admission.source.qualityReview.version,
    'tradingAsset.admission.source.qualityReview.version'
  );
  if (!/^trading-showcase_[A-Za-z0-9_-]+$/u.test(admission.source.showcase.id))
    throw new TradingAssetClassificationValidationError(
      'tradingAsset.admission.source.showcase must identify a Showcase.'
    );
  positiveVersion(
    admission.source.showcase.version,
    'tradingAsset.admission.source.showcase.version'
  );
  required(
    admission.source.showcasePanelSlotId,
    'tradingAsset.admission.source.showcasePanelSlotId'
  );
  if (admission.publicRepresentationApproval.method !== 'EXPLICIT_HUMAN_ACTION')
    throw new TradingAssetClassificationValidationError(
      'Listing Asset public representation requires explicit human approval.'
    );
  required(
    admission.publicRepresentationApproval.approvalReference,
    'tradingAsset.admission.publicRepresentationApproval.approvalReference'
  );
  timestamp(
    admission.publicRepresentationApproval.approvedAt,
    'tradingAsset.admission.publicRepresentationApproval.approvedAt'
  );
  if (admission.publicRepresentationApproval.approvalReference !== publicationApprovalReference)
    throw new TradingAssetClassificationValidationError(
      'Listing Asset admission approval must match publicationApprovalReference.'
    );
}

/** Enforces the classification boundary without creating, approving or publishing either asset. */
export function assertTradingAssetClassificationV1(asset: Readonly<TradingAssetReferenceV1>): void {
  if (asset.schemaVersion !== 1)
    throw new TradingAssetClassificationValidationError('tradingAsset.schemaVersion must be 1.');
  if (!Number.isSafeInteger(asset.version) || asset.version < 1)
    throw new TradingAssetClassificationValidationError(
      'tradingAsset.version must be a positive integer.'
    );
  if (!/^trademark-asset_[A-Za-z0-9_-]+$/u.test(asset.trademarkAsset.id))
    throw new TradingAssetClassificationValidationError(
      'tradingAsset.trademarkAsset.id must be a Trademark Asset id.'
    );
  positiveVersion(asset.trademarkAsset.version, 'tradingAsset.trademarkAsset.version');
  required(asset.owner.ownerReference, 'tradingAsset.owner.ownerReference');
  positiveVersion(asset.owner.ownerVersion, 'tradingAsset.owner.ownerVersion');
  if (Number.isNaN(Date.parse(asset.createdAt)))
    throw new TradingAssetClassificationValidationError(
      'tradingAsset.createdAt must be an ISO timestamp.'
    );
  assertNoAuthority(asset.authorityConsequences);

  if (asset.classification === 'SOURCE_ASSET') {
    if (!/^source-asset_[A-Za-z0-9_-]+$/u.test(asset.sourceAssetId))
      throw new TradingAssetClassificationValidationError('Source Asset id is invalid.');
    if (!/^source-media_[A-Za-z0-9_-]+$/u.test(asset.mediaReference))
      throw new TradingAssetClassificationValidationError(
        'Source Assets must use a private Source Media reference.'
      );
    if (asset.visibility !== 'PRIVATE')
      throw new TradingAssetClassificationValidationError('Source Assets must remain PRIVATE.');
    return;
  }

  if (asset.classification === 'STUDIO_VISUAL_ASSET') {
    if (!/^trading-ai-derived_visual-asset_[A-Za-z0-9_-]+$/u.test(asset.studioVisualAssetId))
      throw new TradingAssetClassificationValidationError('Studio Visual Asset id is invalid.');
    required(asset.workspaceId, 'tradingAsset.workspaceId');
    if (!/^studio-media_[A-Za-z0-9_-]+$/u.test(asset.mediaReference))
      throw new TradingAssetClassificationValidationError(
        'Studio Visual Assets must use a private Studio Media reference.'
      );
    if (asset.visibility !== 'PRIVATE' || asset.publicationEligibility !== 'NOT_ELIGIBLE')
      throw new TradingAssetClassificationValidationError(
        'Studio Visual Assets must remain private and publication-ineligible.'
      );
    if (asset.aiConceptLabel !== true)
      throw new TradingAssetClassificationValidationError(
        'Studio Visual Assets must retain an explicit AI concept label.'
      );
    if (!tradingVisualCreativeRoles.includes(asset.creativeRole))
      throw new TradingAssetClassificationValidationError('tradingAsset.creativeRole is invalid.');
    required(asset.generationRecipeReference, 'tradingAsset.generationRecipeReference');
    asset.sourceAssets.forEach((source, index) => {
      if (!/^source-asset_[A-Za-z0-9_-]+$/u.test(source.id))
        throw new TradingAssetClassificationValidationError(
          `tradingAsset.sourceAssets[${index}].id must be a Source Asset id.`
        );
      positiveVersion(source.version, `tradingAsset.sourceAssets[${index}].version`);
    });
    assertDistinctReferences(
      asset.sourceAssets.map((source) => `${source.id}@${source.version}`),
      'tradingAsset.sourceAssets'
    );
    assertDistinctReferences(asset.targetAudienceRefs, 'tradingAsset.targetAudienceRefs');
    assertDistinctReferences(asset.buyingPointRefs, 'tradingAsset.buyingPointRefs');
    assertDistinctReferences(asset.scenarioRefs, 'tradingAsset.scenarioRefs');
    assertTradingAiProvenanceV1(asset.provenance);
    if (
      asset.provenance.derivedObject.id !== asset.studioVisualAssetId ||
      asset.provenance.derivedObject.version !== asset.version ||
      asset.provenance.truthClass !== 'AI_CONCEPT' ||
      !sameReference(asset.provenance.trademarkAsset, asset.trademarkAsset) ||
      asset.provenance.createdAt !== asset.createdAt
    )
      throw new TradingAssetClassificationValidationError(
        'Studio Visual Asset provenance must identify this exact AI Concept asset.'
      );
    return;
  }

  if (!/^listing-asset_[A-Za-z0-9_-]+$/u.test(asset.listingAssetId))
    throw new TradingAssetClassificationValidationError('Listing Asset id is invalid.');
  if (!/^listing-media_[A-Za-z0-9_-]+$/u.test(asset.mediaReference))
    throw new TradingAssetClassificationValidationError(
      'Listing Assets must use a distinct public Listing Media reference.'
    );
  if (asset.visibility !== 'LISTING_PUBLIC')
    throw new TradingAssetClassificationValidationError(
      'Listing Assets must use LISTING_PUBLIC visibility.'
    );
  if (!asset.provenanceReferences.length || asset.provenanceReferences.some((item) => !item.trim()))
    throw new TradingAssetClassificationValidationError(
      'Listing Assets require provenanceReferences.'
    );
  required(asset.publicationApprovalReference, 'tradingAsset.publicationApprovalReference');
  if (asset.contentClass === 'AI_CONCEPT') {
    if (!asset.admission)
      throw new TradingAssetClassificationValidationError(
        'AI Concept Listing Assets require exact Studio/Showcase admission.'
      );
    assertListingAssetAdmissionShape(asset.admission, asset.publicationApprovalReference);
  }
  if (asset.aiConceptLabel !== (asset.contentClass === 'AI_CONCEPT'))
    throw new TradingAssetClassificationValidationError(
      'AI Concept Listing Assets must retain an explicit AI concept label.'
    );
  assertDistinctReferences(asset.targetAudienceRefs, 'tradingAsset.targetAudienceRefs');
  assertDistinctReferences(asset.buyingPointRefs, 'tradingAsset.buyingPointRefs');
  assertDistinctReferences(asset.scenarioRefs, 'tradingAsset.scenarioRefs');
  if (asset.creativeRole !== undefined && !tradingVisualCreativeRoles.includes(asset.creativeRole))
    throw new TradingAssetClassificationValidationError('tradingAsset.creativeRole is invalid.');
}

function hasExactSource(
  provenance: Readonly<TradingAiProvenanceV1>,
  reference: Readonly<ProductLoopExactReference>
): boolean {
  return provenance.sourceReferences.some(
    (source) => source.sourceId === reference.id && source.sourceVersion === reference.version
  );
}

/** Proves that generation used the exact current human selection and its T1 owner snapshots. */
export function assertTradingStudioVisualAssetV1(
  asset: Readonly<TradingStudioVisualAssetV1>,
  selection: Readonly<TradingDirectionSelectionV1>,
  direction: Readonly<TradingCommercialDirectionVersionV1>,
  profile: Readonly<TradingAiProfileV1>
): void {
  assertTradingAssetClassificationV1(asset);
  if (
    selection.status !== 'CURRENT' ||
    selection.workspaceId !== asset.workspaceId ||
    asset.directionSelection.id !== selection.directionSelectionId ||
    asset.directionSelection.version !== selection.version ||
    !sameReference(asset.commercialDirection, selection.selectedDirection) ||
    asset.commercialDirection.id !== direction.commercialDirectionId ||
    asset.commercialDirection.version !== direction.version
  )
    throw new TradingAssetClassificationValidationError(
      'Studio Visual Assets must use the exact current human-selected DirectionVersion.'
    );
  if (
    !direction.aiProfile ||
    !sameReference(asset.aiProfile, direction.aiProfile) ||
    asset.aiProfile.id !== profile.aiProfileId ||
    asset.aiProfile.version !== profile.version ||
    !sameReference(asset.trademarkAsset, profile.trademarkAsset)
  )
    throw new TradingAssetClassificationValidationError(
      'Studio Visual Assets must reference the exact AI Profile and Trademark Asset.'
    );
  for (const reference of [
    asset.directionSelection,
    asset.commercialDirection,
    asset.aiProfile,
    ...asset.sourceAssets
  ]) {
    if (!hasExactSource(asset.provenance, reference))
      throw new TradingAssetClassificationValidationError(
        'Studio Visual Asset provenance must include every exact generation input.'
      );
  }
  const allowed = {
    targetAudienceRefs: new Set([
      ...(direction.targetConsumerRefs ?? []),
      ...(direction.operatorPersonaRefs ?? []),
      ...(direction.trademarkBuyerPersonaRefs ?? [])
    ]),
    buyingPointRefs: new Set(direction.buyingPointRefs ?? []),
    scenarioRefs: new Set(direction.scenarioRefs ?? [])
  };
  for (const field of Object.keys(allowed) as (keyof typeof allowed)[]) {
    const references = asset[field];
    if (references?.some((reference) => !allowed[field].has(reference as never)))
      throw new TradingAssetClassificationValidationError(
        `tradingAsset.${field} must be present on the exact DirectionVersion.`
      );
  }
}

/** Validates quality evidence against the exact immutable Studio Visual Asset version. */
export function assertTradingStudioVisualQualityReviewV1(
  review: Readonly<TradingStudioVisualQualityReviewV1>,
  asset: Readonly<TradingStudioVisualAssetV1>
): void {
  if (review.schemaVersion !== 1)
    throw new TradingAssetClassificationValidationError(
      'visualQualityReview.schemaVersion must be 1.'
    );
  if (!/^trading-studio-visual-quality-review_[A-Za-z0-9_-]+$/u.test(review.visualQualityReviewId))
    throw new TradingAssetClassificationValidationError('visualQualityReview.id is invalid.');
  required(review.workspaceId, 'visualQualityReview.workspaceId');
  positiveVersion(review.version, 'visualQualityReview.version');
  if (
    review.workspaceId !== asset.workspaceId ||
    review.studioVisualAsset.id !== asset.studioVisualAssetId ||
    review.studioVisualAsset.version !== asset.version
  )
    throw new TradingAssetClassificationValidationError(
      'Visual quality review must reference the exact Studio Visual Asset in the same Workspace.'
    );
  if (!tradingStudioVisualQualityStatuses.includes(review.status))
    throw new TradingAssetClassificationValidationError('visualQualityReview.status is invalid.');
  review.findings.forEach((finding, index) => {
    required(finding.code, `visualQualityReview.findings[${index}].code`);
    required(finding.message, `visualQualityReview.findings[${index}].message`);
  });
  if (review.status === 'PASS' && review.findings.length)
    throw new TradingAssetClassificationValidationError(
      'PASS quality review cannot contain findings.'
    );
  if (review.status !== 'PASS' && !review.findings.length)
    throw new TradingAssetClassificationValidationError(
      'Warning and failed quality reviews require findings.'
    );
  if (review.status !== 'FAIL' && review.retryDisposition !== 'RETRY_FORBIDDEN')
    throw new TradingAssetClassificationValidationError(
      'Only a failed quality review may allow retry.'
    );
  if (review.retryDisposition === 'RECONCILIATION_REQUIRED')
    throw new TradingAssetClassificationValidationError(
      'Delivery reconciliation belongs to Managed AI execution, not visual QA.'
    );
  timestamp(review.reviewedAt, 'visualQualityReview.reviewedAt');
  for (const [key, value] of Object.entries(review.authorityConsequences)) {
    if (value !== false)
      throw new TradingAssetClassificationValidationError(
        `visualQualityReview.authorityConsequences.${key} must be false.`
      );
  }
}

/** Validates a bounded retry request without executing generation or replacing any asset. */
export function assertRequestTradingStudioVisualRetryCommandV1(
  command: Readonly<RequestTradingStudioVisualRetryCommandV1>,
  review: Readonly<TradingStudioVisualQualityReviewV1>,
  asset: Readonly<TradingStudioVisualAssetV1>
): void {
  if (command.schemaVersion !== 1)
    throw new TradingAssetClassificationValidationError(
      'visualRetryCommand.schemaVersion must be 1.'
    );
  if (
    command.studioVisualAssetId !== asset.studioVisualAssetId ||
    command.expectedAssetVersion !== asset.version ||
    command.visualQualityReviewId !== review.visualQualityReviewId ||
    command.expectedReviewVersion !== review.version ||
    review.studioVisualAsset.id !== asset.studioVisualAssetId ||
    review.studioVisualAsset.version !== asset.version
  )
    throw new TradingAssetClassificationValidationError(
      'Visual retry must target the exact failed asset and quality review versions.'
    );
  if (review.status !== 'FAIL' || review.retryDisposition !== 'RETRY_ALLOWED')
    throw new TradingAssetClassificationValidationError(
      'Visual retry requires a failed quality review with RETRY_ALLOWED disposition.'
    );
  if (![1, 2, 3].includes(command.attemptNumber))
    throw new TradingAssetClassificationValidationError(
      'visualRetryCommand.attemptNumber must be between 1 and 3.'
    );
  required(command.reason, 'visualRetryCommand.reason');
  required(command.idempotencyKey, 'visualRetryCommand.idempotencyKey');
  required(command.correlationId, 'visualRetryCommand.correlationId');
}

/** Validates optional commercial-intent provenance against exact T1 owner snapshots. */
export function assertTradingListingAssetCommercialIntentV1(
  asset: Readonly<TradingListingAssetV1>,
  direction: Readonly<TradingCommercialDirectionVersionV1>,
  profile: Readonly<TradingAiProfileV1>
): void {
  if (
    !asset.commercialDirection ||
    asset.commercialDirection.id !== direction.commercialDirectionId ||
    asset.commercialDirection.version !== direction.version
  )
    throw new TradingAssetClassificationValidationError(
      'Commercial-intent Listing Assets must reference the exact DirectionVersion.'
    );
  if (
    !asset.aiProfile ||
    asset.aiProfile.id !== profile.aiProfileId ||
    asset.aiProfile.version !== profile.version ||
    !direction.aiProfile ||
    !sameReference(direction.aiProfile, asset.aiProfile) ||
    !sameReference(asset.trademarkAsset, profile.trademarkAsset)
  )
    throw new TradingAssetClassificationValidationError(
      'Commercial-intent Listing Assets must reference the exact AI Profile and Trademark Asset.'
    );
  const allowed = {
    targetAudienceRefs: new Set([
      ...(direction.targetConsumerRefs ?? []),
      ...(direction.operatorPersonaRefs ?? []),
      ...(direction.trademarkBuyerPersonaRefs ?? [])
    ]),
    buyingPointRefs: new Set(direction.buyingPointRefs ?? []),
    scenarioRefs: new Set(direction.scenarioRefs ?? [])
  };
  for (const field of Object.keys(allowed) as (keyof typeof allowed)[]) {
    const references = asset[field];
    if (references?.some((reference) => !allowed[field].has(reference as never)))
      throw new TradingAssetClassificationValidationError(
        `tradingAsset.${field} must be present on the exact DirectionVersion.`
      );
  }
  if (
    !asset.creativeRole &&
    !asset.targetAudienceRefs?.length &&
    !asset.buyingPointRefs?.length &&
    !asset.scenarioRefs?.length
  )
    throw new TradingAssetClassificationValidationError(
      'Commercial-intent Listing Assets require at least one commercial-intent semantic.'
    );
}

/**
 * Proves that one AI Concept Listing Asset was admitted from the exact quality-passed private
 * Studio visual selected in one exact private Showcase panel. The human approval admits only this
 * public representation; it does not publish a Listing or mutate Trademark Truth.
 */
export function assertTradingListingAssetAdmissionV1(
  asset: Readonly<TradingListingAssetV1>,
  studioVisual: Readonly<TradingStudioVisualAssetV1>,
  qualityReview: Readonly<TradingStudioVisualQualityReviewV1>,
  showcase: Readonly<TradingShowcaseV1>
): void {
  assertTradingAssetClassificationV1(asset);
  if (asset.contentClass !== 'AI_CONCEPT' || !asset.admission)
    throw new TradingAssetClassificationValidationError(
      'Studio/Showcase admission applies only to AI Concept Listing Assets.'
    );
  assertTradingAssetClassificationV1(studioVisual);
  assertTradingStudioVisualQualityReviewV1(qualityReview, studioVisual);

  const { source, publicRepresentationApproval } = asset.admission;
  if (
    source.workspaceId !== studioVisual.workspaceId ||
    showcase.workspaceId !== studioVisual.workspaceId ||
    !sameReference(source.studioVisualAsset, {
      id: studioVisual.studioVisualAssetId,
      version: studioVisual.version
    }) ||
    !sameReference(source.qualityReview, {
      id: qualityReview.visualQualityReviewId,
      version: qualityReview.version
    }) ||
    !sameReference(source.showcase, { id: showcase.showcaseId, version: showcase.version }) ||
    !sameReference(asset.trademarkAsset, studioVisual.trademarkAsset)
  )
    throw new TradingAssetClassificationValidationError(
      'Listing Asset admission must bind the exact Studio visual, quality review, Showcase and Trademark Asset.'
    );

  if (qualityReview.status === 'FAIL')
    throw new TradingAssetClassificationValidationError(
      'Listing Asset admission requires a quality-passed Studio Visual Asset.'
    );

  const panel = showcase.panels.find(
    (candidate) => candidate.slotId === source.showcasePanelSlotId
  );
  if (
    !panel ||
    !sameReference(panel.studioVisualAsset, source.studioVisualAsset) ||
    !sameReference(panel.qualityReview, source.qualityReview) ||
    panel.selectionMethod !== 'EXPLICIT_HUMAN_ACTION' ||
    panel.aiConceptLabel !== true
  )
    throw new TradingAssetClassificationValidationError(
      'Listing Asset admission source must be the exact explicitly selected Showcase panel.'
    );

  if (
    showcase.visibility !== 'PRIVATE' ||
    showcase.publicationEligibility !== 'NOT_ELIGIBLE' ||
    Object.values(showcase.authorityConsequences).some((value) => value !== false)
  )
    throw new TradingAssetClassificationValidationError(
      'Showcase selection remains private and cannot create publication authority.'
    );

  if (
    Date.parse(publicRepresentationApproval.approvedAt) < Date.parse(qualityReview.reviewedAt) ||
    Date.parse(publicRepresentationApproval.approvedAt) < Date.parse(showcase.createdAt)
  )
    throw new TradingAssetClassificationValidationError(
      'Public representation approval must follow the exact QA and Showcase evidence it approves.'
    );
}
