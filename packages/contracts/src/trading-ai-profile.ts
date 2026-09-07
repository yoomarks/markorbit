import type { ProductLoopExactReference } from './product-loop.js';
import {
  assertTradingAiProvenanceV1,
  type TradingAiProvenanceV1
} from './trading-ai-provenance.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TradingAiProfileId = `trading-ai-derived_ai-profile_${string}`;
export type TradingAiTagId = `trading-ai-tag_${string}`;

export const tradingAiTagCategories = [
  'INDUSTRY',
  'AUDIENCE',
  'POSITIONING',
  'PERSONALITY',
  'VISUAL_LANGUAGE',
  'CHANNEL_FIT',
  'MARKET_FIT',
  'BRAND_POTENTIAL'
] as const;
export type TradingAiTagCategory = (typeof tradingAiTagCategories)[number];

/** Structured AI inference for comparison and downstream creative work, never a legal fact. */
export interface TradingAiTagV1 {
  aiTagId: TradingAiTagId;
  category: TradingAiTagCategory;
  label: string;
  rationale: string;
}

/** Versioned Studio understanding of one exact Trademark Asset version. */
export interface TradingAiProfileV1 {
  schemaVersion: 1;
  aiProfileId: TradingAiProfileId;
  workspaceId: string;
  version: number;
  trademarkAsset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  summary: string;
  tags: readonly Readonly<TradingAiTagV1>[];
  provenance: Readonly<TradingAiProvenanceV1>;
  createdAt: string;
}

export class TradingAiProfileValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingAiProfileValidationError';
  }
}

function required(value: string, field: string): void {
  if (!value.trim()) throw new TradingAiProfileValidationError(`${field} is required.`);
}

function exactVersion(value: number | string, field: string): void {
  if (
    (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 1)) ||
    (typeof value === 'string' && !value.trim())
  )
    throw new TradingAiProfileValidationError(`${field} must identify a version.`);
}

/** Enforces identity/lineage consistency without creating AI output or canonical truth. */
export function assertTradingAiProfileV1(profile: Readonly<TradingAiProfileV1>): void {
  if (profile.schemaVersion !== 1)
    throw new TradingAiProfileValidationError('tradingAiProfile.schemaVersion must be 1.');
  if (!/^trading-ai-derived_ai-profile_[A-Za-z0-9_-]+$/u.test(profile.aiProfileId))
    throw new TradingAiProfileValidationError('tradingAiProfile.aiProfileId is invalid.');
  required(profile.workspaceId, 'tradingAiProfile.workspaceId');
  if (!Number.isSafeInteger(profile.version) || profile.version < 1)
    throw new TradingAiProfileValidationError(
      'tradingAiProfile.version must be a positive integer.'
    );
  if (!/^trademark-asset_[A-Za-z0-9_-]+$/u.test(profile.trademarkAsset.id))
    throw new TradingAiProfileValidationError(
      'tradingAiProfile.trademarkAsset.id must be a Trademark Asset id.'
    );
  exactVersion(profile.trademarkAsset.version, 'tradingAiProfile.trademarkAsset.version');
  required(profile.summary, 'tradingAiProfile.summary');
  const tagIds = new Set<string>();
  profile.tags.forEach((tag, index) => {
    if (!/^trading-ai-tag_[A-Za-z0-9_-]+$/u.test(tag.aiTagId))
      throw new TradingAiProfileValidationError(
        `tradingAiProfile.tags[${index}].aiTagId is invalid.`
      );
    if (tagIds.has(tag.aiTagId))
      throw new TradingAiProfileValidationError('tradingAiProfile.tags must not duplicate ids.');
    tagIds.add(tag.aiTagId);
    if (!tradingAiTagCategories.includes(tag.category))
      throw new TradingAiProfileValidationError(
        `tradingAiProfile.tags[${index}].category is invalid.`
      );
    required(tag.label, `tradingAiProfile.tags[${index}].label`);
    required(tag.rationale, `tradingAiProfile.tags[${index}].rationale`);
  });

  assertTradingAiProvenanceV1(profile.provenance);
  if (
    profile.provenance.derivedObject.id !== profile.aiProfileId ||
    profile.provenance.derivedObject.version !== profile.version
  )
    throw new TradingAiProfileValidationError(
      'tradingAiProfile.provenance must reference this exact profile version.'
    );
  if (
    profile.provenance.trademarkAsset.id !== profile.trademarkAsset.id ||
    profile.provenance.trademarkAsset.version !== profile.trademarkAsset.version
  )
    throw new TradingAiProfileValidationError(
      'tradingAiProfile.provenance must reference the same exact Trademark Asset version.'
    );
  if (profile.provenance.truthClass !== 'AI_INFERENCE')
    throw new TradingAiProfileValidationError(
      'tradingAiProfile must remain classified as AI_INFERENCE.'
    );
  if (profile.createdAt !== profile.provenance.createdAt)
    throw new TradingAiProfileValidationError(
      'tradingAiProfile.createdAt must match its provenance timestamp.'
    );
}
