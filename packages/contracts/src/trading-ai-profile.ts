import type { ProductLoopExactReference } from './product-loop.js';
import {
  assertTradingAiProvenanceV1,
  type TradingAiProvenanceV1
} from './trading-ai-provenance.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TradingAiProfileId = `trading-ai-derived_ai-profile_${string}`;
export type TradingAiTagId = `trading-ai-tag_${string}`;
export type TradingCommercialPersonaId = `trading-commercial-persona_${string}`;
export type TradingSellingPointId = `trading-selling-point_${string}`;
export type TradingBuyingPointId = `trading-buying-point_${string}`;
export type TradingCommercialScenarioId = `trading-commercial-scenario_${string}`;
export type TradingCommercialEvidenceId = `trading-commercial-evidence_${string}`;
export type TradingCommercialAssumptionId = `trading-commercial-assumption_${string}`;

export const tradingCommercialPersonaKinds = [
  'END_CONSUMER',
  'BUSINESS_OPERATOR',
  'TRADEMARK_BUYER'
] as const;
export type TradingCommercialPersonaKind = (typeof tradingCommercialPersonaKinds)[number];

export const tradingEvidenceCoverageLevels = ['LIMITED', 'MODERATE', 'STRONG'] as const;
export type TradingEvidenceCoverage = (typeof tradingEvidenceCoverageLevels)[number];

export const tradingSellingPointBasisTypes = [
  'TRUTH_DERIVED',
  'EVIDENCE_DERIVED',
  'AI_INFERENCE'
] as const;
export type TradingSellingPointBasisType = (typeof tradingSellingPointBasisTypes)[number];

export const tradingCommercialScenarioKinds = [
  'USE',
  'LAUNCH',
  'CHANNEL',
  'BUSINESS',
  'TRANSACTION_TRIGGER'
] as const;
export type TradingCommercialScenarioKind = (typeof tradingCommercialScenarioKinds)[number];

export const tradingCommercialAssumptionRisks = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type TradingCommercialAssumptionRisk = (typeof tradingCommercialAssumptionRisks)[number];

export interface TradingCommercialPersonaV1 {
  commercialPersonaId: TradingCommercialPersonaId;
  kind: TradingCommercialPersonaKind;
  label: string;
  summary: string;
  jobs?: readonly string[];
  pains?: readonly string[];
  desiredOutcomes?: readonly string[];
  evidenceRefs?: readonly TradingCommercialEvidenceId[];
  assumptionRefs?: readonly TradingCommercialAssumptionId[];
}

export interface TradingSellingPointV1 {
  sellingPointId: TradingSellingPointId;
  label: string;
  description: string;
  category?: string;
  basisType: TradingSellingPointBasisType;
  sourceRefs?: readonly string[];
  evidenceRefs?: readonly TradingCommercialEvidenceId[];
  assumptionRefs?: readonly TradingCommercialAssumptionId[];
}

export interface TradingBuyingPointV1 {
  buyingPointId: TradingBuyingPointId;
  label: string;
  description: string;
  sellingPointRefs: readonly TradingSellingPointId[];
  personaRefs: readonly TradingCommercialPersonaId[];
  scenarioRefs?: readonly TradingCommercialScenarioId[];
  evidenceRefs?: readonly TradingCommercialEvidenceId[];
  assumptionRefs?: readonly TradingCommercialAssumptionId[];
}

export interface TradingCommercialScenarioV1 {
  commercialScenarioId: TradingCommercialScenarioId;
  label: string;
  description: string;
  kind?: TradingCommercialScenarioKind;
  personaRefs?: readonly TradingCommercialPersonaId[];
  buyingPointRefs?: readonly TradingBuyingPointId[];
  evidenceRefs?: readonly TradingCommercialEvidenceId[];
  assumptionRefs?: readonly TradingCommercialAssumptionId[];
}

export interface TradingCommercialEvidenceBasisV1 {
  commercialEvidenceId: TradingCommercialEvidenceId;
  label: string;
  sourceRef?: string;
  sourceType: string;
  description?: string;
  observedAt?: string;
}

export interface TradingCommercialAssumptionV1 {
  commercialAssumptionId: TradingCommercialAssumptionId;
  label: string;
  description: string;
  risk?: TradingCommercialAssumptionRisk;
}

/** Structured commercial interpretation within one exact AI Profile version. */
export interface TradingCommercialInsightsV1 {
  schemaVersion: 1;
  evidenceCoverage: TradingEvidenceCoverage;
  personas: readonly TradingCommercialPersonaV1[];
  sellingPoints: readonly TradingSellingPointV1[];
  buyingPoints: readonly TradingBuyingPointV1[];
  scenarios: readonly TradingCommercialScenarioV1[];
  evidenceBasis: readonly TradingCommercialEvidenceBasisV1[];
  assumptions: readonly TradingCommercialAssumptionV1[];
  limits?: readonly string[];
}

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
  commercialInsights?: Readonly<TradingCommercialInsightsV1>;
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

function contentList(value: readonly string[] | undefined, field: string): void {
  if (value?.some((item) => !item.trim()))
    throw new TradingAiProfileValidationError(`${field} must contain non-empty values.`);
}

function uniqueIds<T>(
  values: readonly T[],
  idFor: (value: T) => string,
  pattern: RegExp,
  field: string
): Set<string> {
  const ids = new Set<string>();
  values.forEach((value, index) => {
    const id = idFor(value);
    if (!pattern.test(id))
      throw new TradingAiProfileValidationError(`${field}[${index}] has an invalid id.`);
    if (ids.has(id)) throw new TradingAiProfileValidationError(`${field} must not duplicate ids.`);
    ids.add(id);
  });
  return ids;
}

function assertReferences(
  references: readonly string[] | undefined,
  known: ReadonlySet<string>,
  field: string,
  requiredReferences = false
): void {
  if (requiredReferences && !references?.length)
    throw new TradingAiProfileValidationError(`${field} must contain at least one reference.`);
  if (references?.some((reference) => !known.has(reference)))
    throw new TradingAiProfileValidationError(`${field} contains an unknown reference.`);
  if (references && new Set(references).size !== references.length)
    throw new TradingAiProfileValidationError(`${field} must not duplicate references.`);
}

function assertCommercialInsights(
  insights: Readonly<TradingCommercialInsightsV1>,
  provenance: Readonly<TradingAiProvenanceV1>
): void {
  if (insights.schemaVersion !== 1)
    throw new TradingAiProfileValidationError(
      'tradingAiProfile.commercialInsights.schemaVersion must be 1.'
    );
  if (!tradingEvidenceCoverageLevels.includes(insights.evidenceCoverage))
    throw new TradingAiProfileValidationError(
      'tradingAiProfile.commercialInsights.evidenceCoverage is invalid.'
    );

  const personaIds = uniqueIds(
    insights.personas,
    (item) => item.commercialPersonaId,
    /^trading-commercial-persona_[A-Za-z0-9_-]+$/u,
    'tradingAiProfile.commercialInsights.personas'
  );
  const sellingPointIds = uniqueIds(
    insights.sellingPoints,
    (item) => item.sellingPointId,
    /^trading-selling-point_[A-Za-z0-9_-]+$/u,
    'tradingAiProfile.commercialInsights.sellingPoints'
  );
  const buyingPointIds = uniqueIds(
    insights.buyingPoints,
    (item) => item.buyingPointId,
    /^trading-buying-point_[A-Za-z0-9_-]+$/u,
    'tradingAiProfile.commercialInsights.buyingPoints'
  );
  const scenarioIds = uniqueIds(
    insights.scenarios,
    (item) => item.commercialScenarioId,
    /^trading-commercial-scenario_[A-Za-z0-9_-]+$/u,
    'tradingAiProfile.commercialInsights.scenarios'
  );
  const evidenceIds = uniqueIds(
    insights.evidenceBasis,
    (item) => item.commercialEvidenceId,
    /^trading-commercial-evidence_[A-Za-z0-9_-]+$/u,
    'tradingAiProfile.commercialInsights.evidenceBasis'
  );
  const assumptionIds = uniqueIds(
    insights.assumptions,
    (item) => item.commercialAssumptionId,
    /^trading-commercial-assumption_[A-Za-z0-9_-]+$/u,
    'tradingAiProfile.commercialInsights.assumptions'
  );
  const sourceIds = new Set(provenance.sourceReferences.map((source) => source.sourceId));

  const personaKinds = new Set<TradingCommercialPersonaKind>();
  insights.personas.forEach((persona, index) => {
    if (!tradingCommercialPersonaKinds.includes(persona.kind))
      throw new TradingAiProfileValidationError(
        `tradingAiProfile.commercialInsights.personas[${index}].kind is invalid.`
      );
    personaKinds.add(persona.kind);
    required(persona.label, `tradingAiProfile.commercialInsights.personas[${index}].label`);
    required(persona.summary, `tradingAiProfile.commercialInsights.personas[${index}].summary`);
    contentList(persona.jobs, `tradingAiProfile.commercialInsights.personas[${index}].jobs`);
    contentList(persona.pains, `tradingAiProfile.commercialInsights.personas[${index}].pains`);
    contentList(
      persona.desiredOutcomes,
      `tradingAiProfile.commercialInsights.personas[${index}].desiredOutcomes`
    );
    assertReferences(persona.evidenceRefs, evidenceIds, `personas[${index}].evidenceRefs`);
    assertReferences(persona.assumptionRefs, assumptionIds, `personas[${index}].assumptionRefs`);
  });
  if (personaKinds.size !== tradingCommercialPersonaKinds.length)
    throw new TradingAiProfileValidationError(
      'tradingAiProfile.commercialInsights must represent all three persona kinds.'
    );

  insights.evidenceBasis.forEach((evidence, index) => {
    required(evidence.label, `evidenceBasis[${index}].label`);
    required(evidence.sourceType, `evidenceBasis[${index}].sourceType`);
    if (evidence.sourceRef !== undefined)
      assertReferences([evidence.sourceRef], sourceIds, `evidenceBasis[${index}].sourceRef`);
    if (evidence.description !== undefined)
      required(evidence.description, `evidenceBasis[${index}].description`);
    if (evidence.observedAt !== undefined && Number.isNaN(Date.parse(evidence.observedAt)))
      throw new TradingAiProfileValidationError(
        `tradingAiProfile.commercialInsights.evidenceBasis[${index}].observedAt must be an ISO timestamp.`
      );
  });
  insights.assumptions.forEach((assumption, index) => {
    required(assumption.label, `assumptions[${index}].label`);
    required(assumption.description, `assumptions[${index}].description`);
    if (
      assumption.risk !== undefined &&
      !tradingCommercialAssumptionRisks.includes(assumption.risk)
    )
      throw new TradingAiProfileValidationError(`assumptions[${index}].risk is invalid.`);
  });
  insights.sellingPoints.forEach((point, index) => {
    required(point.label, `sellingPoints[${index}].label`);
    required(point.description, `sellingPoints[${index}].description`);
    if (!tradingSellingPointBasisTypes.includes(point.basisType))
      throw new TradingAiProfileValidationError(`sellingPoints[${index}].basisType is invalid.`);
    if (point.category !== undefined) required(point.category, `sellingPoints[${index}].category`);
    assertReferences(point.sourceRefs, sourceIds, `sellingPoints[${index}].sourceRefs`);
    assertReferences(point.evidenceRefs, evidenceIds, `sellingPoints[${index}].evidenceRefs`);
    assertReferences(point.assumptionRefs, assumptionIds, `sellingPoints[${index}].assumptionRefs`);
  });
  insights.buyingPoints.forEach((point, index) => {
    required(point.label, `buyingPoints[${index}].label`);
    required(point.description, `buyingPoints[${index}].description`);
    assertReferences(
      point.sellingPointRefs,
      sellingPointIds,
      `buyingPoints[${index}].sellingPointRefs`,
      true
    );
    assertReferences(point.personaRefs, personaIds, `buyingPoints[${index}].personaRefs`, true);
    assertReferences(point.scenarioRefs, scenarioIds, `buyingPoints[${index}].scenarioRefs`);
    assertReferences(point.evidenceRefs, evidenceIds, `buyingPoints[${index}].evidenceRefs`);
    assertReferences(point.assumptionRefs, assumptionIds, `buyingPoints[${index}].assumptionRefs`);
  });
  insights.scenarios.forEach((scenario, index) => {
    required(scenario.label, `scenarios[${index}].label`);
    required(scenario.description, `scenarios[${index}].description`);
    if (scenario.kind !== undefined && !tradingCommercialScenarioKinds.includes(scenario.kind))
      throw new TradingAiProfileValidationError(`scenarios[${index}].kind is invalid.`);
    assertReferences(scenario.personaRefs, personaIds, `scenarios[${index}].personaRefs`);
    assertReferences(
      scenario.buyingPointRefs,
      buyingPointIds,
      `scenarios[${index}].buyingPointRefs`
    );
    assertReferences(scenario.evidenceRefs, evidenceIds, `scenarios[${index}].evidenceRefs`);
    assertReferences(scenario.assumptionRefs, assumptionIds, `scenarios[${index}].assumptionRefs`);
  });
  contentList(insights.limits, 'tradingAiProfile.commercialInsights.limits');
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
  if (profile.commercialInsights)
    assertCommercialInsights(profile.commercialInsights, profile.provenance);

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
