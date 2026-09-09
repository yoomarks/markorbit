import type { ProductLoopExactReference } from './product-loop.js';
import type { TradingAiProfileId } from './trading-ai-profile.js';
import {
  assertTradingAiProvenanceV1,
  type TradingAiProvenanceV1
} from './trading-ai-provenance.js';
import type { TradingStandardStudioRunId } from './trading-studio-usage.js';
import type {
  TradingCommercialDirectionId,
  TradingCommercialDirectionVersionV1
} from './trading-commercial-direction.js';
import type {
  TradingDirectionSelectionId,
  TradingDirectionSelectionV1
} from './trading-direction-selection.js';
import {
  assertTradingStudioVisualQualityReviewV1,
  type TradingStudioVisualAssetId,
  type TradingStudioVisualAssetV1,
  type TradingStudioVisualQualityReviewId,
  type TradingStudioVisualQualityReviewV1,
  type TradingVisualCreativeRole
} from './trading-asset-classification.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TradingBrandDnaId = `trading-ai-derived_brand-dna_${string}`;
export type TradingBrandBibleId = `trading-ai-derived_brand-bible_${string}`;

export interface TradingBrandIpPotentialV1 {
  summary: string;
  rationale: string;
}

/** Creative generation baseline for one Studio run/version; never legal Trademark Truth. */
export interface TradingBrandDnaV1 {
  schemaVersion: 1;
  brandDnaId: TradingBrandDnaId;
  workspaceId: string;
  version: number;
  studioRun: Readonly<ProductLoopExactReference<TradingStandardStudioRunId>>;
  trademarkAsset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  aiProfile: Readonly<ProductLoopExactReference<TradingAiProfileId>>;
  personality: readonly string[];
  targetAudience: readonly string[];
  positioning: readonly string[];
  industry: readonly string[];
  visualDirection: readonly string[];
  brandPromise: string;
  emotionalTone: readonly string[];
  colorTendencies: readonly string[];
  typographyTendencies: readonly string[];
  visualLanguage: readonly string[];
  channelStrategy: readonly string[];
  ipPotential: Readonly<TradingBrandIpPotentialV1>;
  benchmarkCapabilities: readonly string[];
  constraints: readonly string[];
  provenance: Readonly<TradingAiProvenanceV1>;
  createdAt: string;
}

export interface TradingBrandBibleVisualInputV1 {
  studioVisualAsset: Readonly<ProductLoopExactReference<TradingStudioVisualAssetId>>;
  qualityReview: Readonly<ProductLoopExactReference<TradingStudioVisualQualityReviewId>>;
  creativeRole: TradingVisualCreativeRole;
}

/** Durable private creative guidance from one exact selected direction and reviewed visual set. */
export interface TradingBrandBibleV1 {
  schemaVersion: 1;
  brandBibleId: TradingBrandBibleId;
  workspaceId: string;
  version: number;
  trademarkAsset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  aiProfile: Readonly<ProductLoopExactReference<TradingAiProfileId>>;
  brandDna: Readonly<ProductLoopExactReference<TradingBrandDnaId>>;
  directionSelection: Readonly<ProductLoopExactReference<TradingDirectionSelectionId>>;
  commercialDirection: Readonly<ProductLoopExactReference<TradingCommercialDirectionId>>;
  visualInputs: readonly Readonly<TradingBrandBibleVisualInputV1>[];
  markUsageRules: readonly string[];
  visualSystem: readonly string[];
  colorSystem: readonly string[];
  typographySystem: readonly string[];
  imageryGuidance: readonly string[];
  prohibitedRepresentations: readonly string[];
  provenance: Readonly<TradingAiProvenanceV1>;
  visibility: 'PRIVATE';
  publicationEligibility: 'NOT_ELIGIBLE';
  aiConceptLabel: true;
  createdAt: string;
}

export class TradingBrandDnaValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingBrandDnaValidationError';
  }
}

function required(value: string, field: string): void {
  if (!value.trim()) throw new TradingBrandDnaValidationError(`${field} is required.`);
}

function exactVersion(value: number | string, field: string): void {
  if (
    (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 1)) ||
    (typeof value === 'string' && !value.trim())
  )
    throw new TradingBrandDnaValidationError(`${field} must identify a version.`);
}

function contentList(value: readonly string[], field: string): void {
  if (!value.length || value.some((item) => !item.trim()))
    throw new TradingBrandDnaValidationError(`${field} must contain non-empty values.`);
}

function hasExactSource(
  provenance: Readonly<TradingAiProvenanceV1>,
  reference: Readonly<ProductLoopExactReference>
): boolean {
  return provenance.sourceReferences.some(
    (source) => source.sourceId === reference.id && source.sourceVersion === reference.version
  );
}

/** Enforces a complete creative baseline and exact upstream lineage without creating legal truth. */
export function assertTradingBrandDnaV1(brandDna: Readonly<TradingBrandDnaV1>): void {
  if (brandDna.schemaVersion !== 1)
    throw new TradingBrandDnaValidationError('tradingBrandDna.schemaVersion must be 1.');
  if (!/^trading-ai-derived_brand-dna_[A-Za-z0-9_-]+$/u.test(brandDna.brandDnaId))
    throw new TradingBrandDnaValidationError('tradingBrandDna.brandDnaId is invalid.');
  required(brandDna.workspaceId, 'tradingBrandDna.workspaceId');
  if (!Number.isSafeInteger(brandDna.version) || brandDna.version < 1)
    throw new TradingBrandDnaValidationError('tradingBrandDna.version must be a positive integer.');
  if (!/^standard-studio-run_[A-Za-z0-9_-]+$/u.test(brandDna.studioRun.id))
    throw new TradingBrandDnaValidationError('tradingBrandDna.studioRun.id is invalid.');
  exactVersion(brandDna.studioRun.version, 'tradingBrandDna.studioRun.version');
  if (!/^trademark-asset_[A-Za-z0-9_-]+$/u.test(brandDna.trademarkAsset.id))
    throw new TradingBrandDnaValidationError(
      'tradingBrandDna.trademarkAsset.id must be a Trademark Asset id.'
    );
  exactVersion(brandDna.trademarkAsset.version, 'tradingBrandDna.trademarkAsset.version');
  if (!/^trading-ai-derived_ai-profile_[A-Za-z0-9_-]+$/u.test(brandDna.aiProfile.id))
    throw new TradingBrandDnaValidationError('tradingBrandDna.aiProfile.id is invalid.');
  exactVersion(brandDna.aiProfile.version, 'tradingBrandDna.aiProfile.version');

  for (const field of [
    'personality',
    'targetAudience',
    'positioning',
    'industry',
    'visualDirection',
    'emotionalTone',
    'colorTendencies',
    'typographyTendencies',
    'visualLanguage',
    'channelStrategy',
    'benchmarkCapabilities',
    'constraints'
  ] as const)
    contentList(brandDna[field], `tradingBrandDna.${field}`);
  required(brandDna.brandPromise, 'tradingBrandDna.brandPromise');
  required(brandDna.ipPotential.summary, 'tradingBrandDna.ipPotential.summary');
  required(brandDna.ipPotential.rationale, 'tradingBrandDna.ipPotential.rationale');

  assertTradingAiProvenanceV1(brandDna.provenance);
  if (
    brandDna.provenance.derivedObject.id !== brandDna.brandDnaId ||
    brandDna.provenance.derivedObject.version !== brandDna.version
  )
    throw new TradingBrandDnaValidationError(
      'tradingBrandDna.provenance must reference this exact BrandDNA version.'
    );
  if (
    brandDna.provenance.trademarkAsset.id !== brandDna.trademarkAsset.id ||
    brandDna.provenance.trademarkAsset.version !== brandDna.trademarkAsset.version
  )
    throw new TradingBrandDnaValidationError(
      'tradingBrandDna.provenance must reference the same exact Trademark Asset version.'
    );
  if (!hasExactSource(brandDna.provenance, brandDna.aiProfile))
    throw new TradingBrandDnaValidationError(
      'tradingBrandDna.provenance must include the exact AIProfile source.'
    );
  if (!hasExactSource(brandDna.provenance, brandDna.studioRun))
    throw new TradingBrandDnaValidationError(
      'tradingBrandDna.provenance must include the exact Studio run source.'
    );
  if (brandDna.provenance.truthClass !== 'AI_INFERENCE')
    throw new TradingBrandDnaValidationError(
      'tradingBrandDna must remain classified as AI_INFERENCE.'
    );
  if (brandDna.createdAt !== brandDna.provenance.createdAt)
    throw new TradingBrandDnaValidationError(
      'tradingBrandDna.createdAt must match its provenance timestamp.'
    );
}

function sameReference(
  left: Readonly<ProductLoopExactReference>,
  right: Readonly<ProductLoopExactReference>
): boolean {
  return left.id === right.id && left.version === right.version;
}

export interface TradingBrandBibleResolvedVisualInputV1 {
  asset: Readonly<TradingStudioVisualAssetV1>;
  qualityReview: Readonly<TradingStudioVisualQualityReviewV1>;
}

/** Validates Deep Build inputs and guidance without executing generation or approving a Showcase. */
export function assertTradingBrandBibleV1(
  bible: Readonly<TradingBrandBibleV1>,
  selection: Readonly<TradingDirectionSelectionV1>,
  direction: Readonly<TradingCommercialDirectionVersionV1>,
  brandDna: Readonly<TradingBrandDnaV1>,
  resolvedVisualInputs: readonly Readonly<TradingBrandBibleResolvedVisualInputV1>[]
): void {
  if (bible.schemaVersion !== 1)
    throw new TradingBrandDnaValidationError('tradingBrandBible.schemaVersion must be 1.');
  if (!/^trading-ai-derived_brand-bible_[A-Za-z0-9_-]+$/u.test(bible.brandBibleId))
    throw new TradingBrandDnaValidationError('tradingBrandBible.brandBibleId is invalid.');
  required(bible.workspaceId, 'tradingBrandBible.workspaceId');
  exactVersion(bible.version, 'tradingBrandBible.version');
  if (
    selection.status !== 'CURRENT' ||
    selection.workspaceId !== bible.workspaceId ||
    !sameReference(bible.directionSelection, {
      id: selection.directionSelectionId,
      version: selection.version
    }) ||
    !sameReference(bible.commercialDirection, selection.selectedDirection) ||
    bible.commercialDirection.id !== direction.commercialDirectionId ||
    bible.commercialDirection.version !== direction.version
  )
    throw new TradingBrandDnaValidationError(
      'Brand Bible must reference the exact current human-selected DirectionVersion.'
    );
  if (
    brandDna.workspaceId !== bible.workspaceId ||
    !sameReference(bible.brandDna, { id: brandDna.brandDnaId, version: brandDna.version }) ||
    !sameReference(bible.trademarkAsset, brandDna.trademarkAsset) ||
    !sameReference(bible.aiProfile, brandDna.aiProfile) ||
    !direction.aiProfile ||
    !sameReference(bible.aiProfile, direction.aiProfile)
  )
    throw new TradingBrandDnaValidationError(
      'Brand Bible must reference the exact BrandDNA, AI Profile and Trademark Asset.'
    );
  if (!bible.visualInputs.length || bible.visualInputs.length !== resolvedVisualInputs.length)
    throw new TradingBrandDnaValidationError(
      'Brand Bible requires its complete quality-reviewed visual input set.'
    );
  bible.visualInputs.forEach((input, index) => {
    const resolved = resolvedVisualInputs[index];
    if (
      !resolved ||
      !sameReference(input.studioVisualAsset, {
        id: resolved.asset.studioVisualAssetId,
        version: resolved.asset.version
      }) ||
      !sameReference(input.qualityReview, {
        id: resolved.qualityReview.visualQualityReviewId,
        version: resolved.qualityReview.version
      }) ||
      input.creativeRole !== resolved.asset.creativeRole
    )
      throw new TradingBrandDnaValidationError(
        'Brand Bible visual inputs must resolve to their exact asset, review and creative role.'
      );
    assertTradingStudioVisualQualityReviewV1(resolved.qualityReview, resolved.asset);
    if (
      resolved.asset.workspaceId !== bible.workspaceId ||
      !sameReference(resolved.asset.commercialDirection, bible.commercialDirection) ||
      resolved.qualityReview.status === 'FAIL'
    )
      throw new TradingBrandDnaValidationError(
        'Brand Bible visual inputs must be quality-passed assets from the selected direction.'
      );
  });
  if (!bible.visualInputs.some((input) => input.creativeRole === 'HERO'))
    throw new TradingBrandDnaValidationError('Brand Bible requires a quality-passed HERO visual.');
  for (const field of [
    'markUsageRules',
    'visualSystem',
    'colorSystem',
    'typographySystem',
    'imageryGuidance',
    'prohibitedRepresentations'
  ] as const)
    contentList(bible[field], `tradingBrandBible.${field}`);
  assertTradingAiProvenanceV1(bible.provenance);
  if (
    bible.provenance.derivedObject.id !== bible.brandBibleId ||
    bible.provenance.derivedObject.version !== bible.version ||
    bible.provenance.truthClass !== 'AI_CONCEPT' ||
    !sameReference(bible.provenance.trademarkAsset, bible.trademarkAsset) ||
    bible.createdAt !== bible.provenance.createdAt
  )
    throw new TradingBrandDnaValidationError(
      'Brand Bible provenance must identify this exact private AI Concept.'
    );
  for (const reference of [
    bible.brandDna,
    bible.directionSelection,
    bible.commercialDirection,
    ...bible.visualInputs.flatMap((input) => [input.studioVisualAsset, input.qualityReview])
  ]) {
    if (!hasExactSource(bible.provenance, reference))
      throw new TradingBrandDnaValidationError(
        'Brand Bible provenance must include every exact Deep Build input.'
      );
  }
  if (
    bible.visibility !== 'PRIVATE' ||
    bible.publicationEligibility !== 'NOT_ELIGIBLE' ||
    bible.aiConceptLabel !== true
  )
    throw new TradingBrandDnaValidationError(
      'Brand Bible must remain a private, publication-ineligible AI Concept.'
    );
}
