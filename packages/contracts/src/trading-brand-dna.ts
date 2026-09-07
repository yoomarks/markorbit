import type { ProductLoopExactReference } from './product-loop.js';
import type { TradingAiProfileId } from './trading-ai-profile.js';
import {
  assertTradingAiProvenanceV1,
  type TradingAiProvenanceV1
} from './trading-ai-provenance.js';
import type { TradingStandardStudioRunId } from './trading-studio-usage.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TradingBrandDnaId = `trading-ai-derived_brand-dna_${string}`;

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
