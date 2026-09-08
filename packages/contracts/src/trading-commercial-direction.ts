import type { ProductLoopExactReference } from './product-loop.js';
import type { MarkOrbitId } from './index.js';
import type { TradingBrandDnaId } from './trading-brand-dna.js';
import type {
  TradingAiProfileId,
  TradingAiProfileV1,
  TradingBuyingPointId,
  TradingCommercialAssumptionId,
  TradingCommercialEvidenceId,
  TradingCommercialPersonaId,
  TradingCommercialScenarioId,
  TradingSellingPointId
} from './trading-ai-profile.js';
import {
  assertTradingAiProvenanceV1,
  type TradingAiProvenanceV1
} from './trading-ai-provenance.js';
import type { TradingStandardStudioRunId } from './trading-studio-usage.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TradingCommercialDirectionId = `trading-ai-derived_commercial-direction_${string}`;
export type TradingCommercialDirectionSetId = `commercial-direction-set_${string}`;

export const tradingCommercialDirectionRoles = ['BEST_FIT', 'VALUE_UP', 'POSSIBILITY'] as const;
export type TradingCommercialDirectionRole = (typeof tradingCommercialDirectionRoles)[number];

export const noTradingDirectionAuthorityConsequencesV1 = Object.freeze({
  humanSelectionCreated: false,
  deepBuildStarted: false,
  listingCreated: false,
  trademarkTruthMutated: false
});
export type TradingDirectionAuthorityConsequencesV1 =
  typeof noTradingDirectionAuthorityConsequencesV1;

/** Immutable candidate version. Refinement creates a new version instead of overwriting this one. */
export interface TradingCommercialDirectionVersionV1 {
  schemaVersion: 1;
  commercialDirectionId: TradingCommercialDirectionId;
  version: number;
  previousVersion?: Readonly<ProductLoopExactReference<TradingCommercialDirectionId>>;
  role: TradingCommercialDirectionRole;
  studioRun: Readonly<ProductLoopExactReference<TradingStandardStudioRunId>>;
  brandDna: Readonly<ProductLoopExactReference<TradingBrandDnaId>>;
  aiProfile?: Readonly<ProductLoopExactReference<TradingAiProfileId>>;
  title: string;
  summary: string;
  rationale: string;
  thesis?: string;
  targetConsumerRefs?: readonly TradingCommercialPersonaId[];
  operatorPersonaRefs?: readonly TradingCommercialPersonaId[];
  trademarkBuyerPersonaRefs?: readonly TradingCommercialPersonaId[];
  sellingPointRefs?: readonly TradingSellingPointId[];
  buyingPointRefs?: readonly TradingBuyingPointId[];
  scenarioRefs?: readonly TradingCommercialScenarioId[];
  valueProposition?: string;
  channelFit?: readonly string[];
  evidenceRefs?: readonly TradingCommercialEvidenceId[];
  assumptionRefs?: readonly TradingCommercialAssumptionId[];
  riskNotes?: readonly string[];
  constraints: readonly string[];
  status: 'CANDIDATE';
  provenance: Readonly<TradingAiProvenanceV1>;
  authorityConsequences: TradingDirectionAuthorityConsequencesV1;
  createdAt: string;
}

/** One comparable Studio result containing exactly the three V1 semantic roles. */
export interface TradingCommercialDirectionSetV1 {
  schemaVersion: 1;
  commercialDirectionSetId: TradingCommercialDirectionSetId;
  workspaceId: string;
  version: number;
  studioRun: Readonly<ProductLoopExactReference<TradingStandardStudioRunId>>;
  trademarkAsset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  brandDna: Readonly<ProductLoopExactReference<TradingBrandDnaId>>;
  aiProfile?: Readonly<ProductLoopExactReference<TradingAiProfileId>>;
  directions: readonly [
    Readonly<TradingCommercialDirectionVersionV1>,
    Readonly<TradingCommercialDirectionVersionV1>,
    Readonly<TradingCommercialDirectionVersionV1>
  ];
  createdAt: string;
}

/** Trusted server context supplies Workspace and actor authority. */
export interface RefineTradingCommercialDirectionCommandV1 {
  schemaVersion: 1;
  directionSetId: TradingCommercialDirectionSetId;
  expectedDirectionSetVersion: number;
  commercialDirectionId: TradingCommercialDirectionId;
  expectedDirectionVersion: number;
  refinementBrief: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export class TradingCommercialDirectionValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingCommercialDirectionValidationError';
  }
}

function required(value: string, field: string): void {
  if (!value.trim()) throw new TradingCommercialDirectionValidationError(`${field} is required.`);
}

function timestamp(value: string, field: string): void {
  if (!value.trim() || Number.isNaN(Date.parse(value)))
    throw new TradingCommercialDirectionValidationError(`${field} must be an ISO timestamp.`);
}

function sameReference(
  left: Readonly<ProductLoopExactReference>,
  right: Readonly<ProductLoopExactReference>
): boolean {
  return left.id === right.id && left.version === right.version;
}

function hasExactSource(
  provenance: Readonly<TradingAiProvenanceV1>,
  reference: Readonly<ProductLoopExactReference>
): boolean {
  return provenance.sourceReferences.some(
    (source) => source.sourceId === reference.id && source.sourceVersion === reference.version
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function assertNoAuthority(consequences: TradingDirectionAuthorityConsequencesV1): void {
  for (const [key, value] of Object.entries(consequences)) {
    if (value !== false)
      throw new TradingCommercialDirectionValidationError(
        `tradingCommercialDirection.authorityConsequences.${key} must be false.`
      );
  }
}

function assertDirectionVersion(
  direction: Readonly<TradingCommercialDirectionVersionV1>,
  set: Readonly<TradingCommercialDirectionSetV1>
): void {
  if (direction.schemaVersion !== 1)
    throw new TradingCommercialDirectionValidationError(
      'tradingCommercialDirection.schemaVersion must be 1.'
    );
  if (
    !/^trading-ai-derived_commercial-direction_[A-Za-z0-9_-]+$/u.test(
      direction.commercialDirectionId
    )
  )
    throw new TradingCommercialDirectionValidationError(
      'tradingCommercialDirection.commercialDirectionId is invalid.'
    );
  if (!Number.isSafeInteger(direction.version) || direction.version < 1)
    throw new TradingCommercialDirectionValidationError(
      'tradingCommercialDirection.version must be a positive integer.'
    );
  if (direction.version === 1 && direction.previousVersion !== undefined)
    throw new TradingCommercialDirectionValidationError(
      'The first DirectionVersion cannot supersede a previous version.'
    );
  if (
    direction.version > 1 &&
    (direction.previousVersion?.id !== direction.commercialDirectionId ||
      direction.previousVersion.version !== direction.version - 1)
  )
    throw new TradingCommercialDirectionValidationError(
      'A refined DirectionVersion must reference its immediately previous version.'
    );
  if (!tradingCommercialDirectionRoles.includes(direction.role))
    throw new TradingCommercialDirectionValidationError(
      'tradingCommercialDirection.role is invalid.'
    );
  if (
    !sameReference(direction.studioRun, set.studioRun) ||
    !sameReference(direction.brandDna, set.brandDna)
  )
    throw new TradingCommercialDirectionValidationError(
      "Every direction must reference the set's exact Studio run and BrandDNA."
    );
  required(direction.title, 'tradingCommercialDirection.title');
  required(direction.summary, 'tradingCommercialDirection.summary');
  required(direction.rationale, 'tradingCommercialDirection.rationale');
  for (const [field, value] of [
    ['thesis', direction.thesis],
    ['valueProposition', direction.valueProposition]
  ] as const)
    if (value !== undefined) required(value, `tradingCommercialDirection.${field}`);
  for (const [field, values] of [
    ['targetConsumerRefs', direction.targetConsumerRefs],
    ['operatorPersonaRefs', direction.operatorPersonaRefs],
    ['trademarkBuyerPersonaRefs', direction.trademarkBuyerPersonaRefs],
    ['sellingPointRefs', direction.sellingPointRefs],
    ['buyingPointRefs', direction.buyingPointRefs],
    ['scenarioRefs', direction.scenarioRefs],
    ['channelFit', direction.channelFit],
    ['evidenceRefs', direction.evidenceRefs],
    ['assumptionRefs', direction.assumptionRefs],
    ['riskNotes', direction.riskNotes]
  ] as const)
    if (
      values !== undefined &&
      (values.some((value) => !value.trim()) || new Set(values).size !== values.length)
    )
      throw new TradingCommercialDirectionValidationError(
        `tradingCommercialDirection.${field} must contain distinct non-empty values.`
      );
  if (!direction.constraints.length || direction.constraints.some((item) => !item.trim()))
    throw new TradingCommercialDirectionValidationError(
      'tradingCommercialDirection.constraints must contain non-empty values.'
    );
  if (direction.status !== 'CANDIDATE')
    throw new TradingCommercialDirectionValidationError(
      'Generated directions must remain CANDIDATE until explicit human selection.'
    );

  assertTradingAiProvenanceV1(direction.provenance);
  if (
    direction.provenance.derivedObject.id !== direction.commercialDirectionId ||
    direction.provenance.derivedObject.version !== direction.version
  )
    throw new TradingCommercialDirectionValidationError(
      'Direction provenance must reference this exact DirectionVersion.'
    );
  if (!sameReference(direction.provenance.trademarkAsset, set.trademarkAsset))
    throw new TradingCommercialDirectionValidationError(
      "Direction provenance must reference the set's exact Trademark Asset."
    );
  if (!hasExactSource(direction.provenance, direction.brandDna))
    throw new TradingCommercialDirectionValidationError(
      'Direction provenance must include the exact BrandDNA source.'
    );
  if (!hasExactSource(direction.provenance, direction.studioRun))
    throw new TradingCommercialDirectionValidationError(
      'Direction provenance must include the exact Studio run source.'
    );
  if (direction.provenance.truthClass !== 'AI_CONCEPT')
    throw new TradingCommercialDirectionValidationError(
      'Commercial directions must remain classified as AI_CONCEPT.'
    );
  if (direction.createdAt !== direction.provenance.createdAt)
    throw new TradingCommercialDirectionValidationError(
      'Direction createdAt must match its provenance timestamp.'
    );
  assertNoAuthority(direction.authorityConsequences);
}

const hasCommercialReferences = (direction: Readonly<TradingCommercialDirectionVersionV1>) =>
  direction.thesis !== undefined ||
  direction.targetConsumerRefs !== undefined ||
  direction.operatorPersonaRefs !== undefined ||
  direction.trademarkBuyerPersonaRefs !== undefined ||
  direction.sellingPointRefs !== undefined ||
  direction.buyingPointRefs !== undefined ||
  direction.scenarioRefs !== undefined ||
  direction.valueProposition !== undefined ||
  direction.channelFit !== undefined ||
  direction.evidenceRefs !== undefined ||
  direction.assumptionRefs !== undefined ||
  direction.riskNotes !== undefined;

/** Validates enriched direction references against one exact AI Profile snapshot. */
export function assertTradingDirectionCommercialReferencesV1(
  set: Readonly<TradingCommercialDirectionSetV1>,
  profile: Readonly<TradingAiProfileV1>
): void {
  const profileRef = set.aiProfile;
  if (
    !profileRef ||
    profileRef.id !== profile.aiProfileId ||
    profileRef.version !== profile.version ||
    profile.workspaceId !== set.workspaceId ||
    !sameReference(profile.trademarkAsset, set.trademarkAsset)
  )
    throw new TradingCommercialDirectionValidationError(
      'Enriched directions must reference the exact AI Profile for this Direction Set.'
    );
  const insights = profile.commercialInsights;
  if (!insights)
    throw new TradingCommercialDirectionValidationError(
      'Enriched directions require Commercial Value Map insights.'
    );
  const byKind = (kind: string) =>
    new Set(
      insights.personas
        .filter((persona) => persona.kind === kind)
        .map((persona) => persona.commercialPersonaId)
    );
  const known = {
    targetConsumerRefs: byKind('END_CONSUMER'),
    operatorPersonaRefs: byKind('BUSINESS_OPERATOR'),
    trademarkBuyerPersonaRefs: byKind('TRADEMARK_BUYER'),
    sellingPointRefs: new Set(insights.sellingPoints.map((item) => item.sellingPointId)),
    buyingPointRefs: new Set(insights.buyingPoints.map((item) => item.buyingPointId)),
    scenarioRefs: new Set(insights.scenarios.map((item) => item.commercialScenarioId)),
    evidenceRefs: new Set(insights.evidenceBasis.map((item) => item.commercialEvidenceId)),
    assumptionRefs: new Set(insights.assumptions.map((item) => item.commercialAssumptionId))
  };
  for (const direction of set.directions) {
    if (!hasCommercialReferences(direction)) continue;
    if (!direction.aiProfile || !sameReference(direction.aiProfile, profileRef))
      throw new TradingCommercialDirectionValidationError(
        'Each enriched direction must reference the exact AI Profile.'
      );
    for (const field of Object.keys(known) as (keyof typeof known)[]) {
      const references = direction[field];
      if (references?.some((reference) => !known[field].has(reference as never)))
        throw new TradingCommercialDirectionValidationError(
          `tradingCommercialDirection.${field} contains an unknown or wrong-kind reference.`
        );
    }
  }
}

/** Validates comparable candidates without choosing one or starting Deep Build. */
export function assertTradingCommercialDirectionSetV1(
  set: Readonly<TradingCommercialDirectionSetV1>
): void {
  if (set.schemaVersion !== 1)
    throw new TradingCommercialDirectionValidationError(
      'tradingCommercialDirectionSet.schemaVersion must be 1.'
    );
  if (!/^commercial-direction-set_[A-Za-z0-9_-]+$/u.test(set.commercialDirectionSetId))
    throw new TradingCommercialDirectionValidationError(
      'tradingCommercialDirectionSet.commercialDirectionSetId is invalid.'
    );
  required(set.workspaceId, 'tradingCommercialDirectionSet.workspaceId');
  if (!Number.isSafeInteger(set.version) || set.version < 1)
    throw new TradingCommercialDirectionValidationError(
      'tradingCommercialDirectionSet.version must be a positive integer.'
    );
  if (set.directions.length !== 3)
    throw new TradingCommercialDirectionValidationError(
      'A direction set must contain exactly three candidates.'
    );
  set.directions.forEach((direction) => assertDirectionVersion(direction, set));
  if (set.directions.some(hasCommercialReferences) && !set.aiProfile)
    throw new TradingCommercialDirectionValidationError(
      'An enriched Direction Set must reference an exact AI Profile.'
    );
  if (new Set(set.directions.map((direction) => direction.commercialDirectionId)).size !== 3)
    throw new TradingCommercialDirectionValidationError(
      'A direction set must contain three distinct direction identities.'
    );
  const roles = new Set(set.directions.map((direction) => direction.role));
  if (tradingCommercialDirectionRoles.some((role) => !roles.has(role)))
    throw new TradingCommercialDirectionValidationError(
      'A direction set must contain Best Fit, Value Up and Possibility exactly once.'
    );
  timestamp(set.createdAt, 'tradingCommercialDirectionSet.createdAt');
}

/** Validates a single-candidate refinement without overwriting history or selecting a winner. */
export function assertTradingCommercialDirectionRefinementV1(
  command: Readonly<RefineTradingCommercialDirectionCommandV1>,
  previousSet: Readonly<TradingCommercialDirectionSetV1>,
  refinedSet: Readonly<TradingCommercialDirectionSetV1>
): void {
  if (command.schemaVersion !== 1)
    throw new TradingCommercialDirectionValidationError(
      'refinementCommand.schemaVersion must be 1.'
    );
  required(command.refinementBrief, 'refinementCommand.refinementBrief');
  required(command.idempotencyKey, 'refinementCommand.idempotencyKey');
  required(command.correlationId, 'refinementCommand.correlationId');
  if (
    command.directionSetId !== previousSet.commercialDirectionSetId ||
    command.expectedDirectionSetVersion !== previousSet.version
  )
    throw new TradingCommercialDirectionValidationError(
      'Refinement must target the exact current DirectionSet version.'
    );
  const previousDirection = previousSet.directions.find(
    (direction) =>
      direction.commercialDirectionId === command.commercialDirectionId &&
      direction.version === command.expectedDirectionVersion
  );
  if (!previousDirection)
    throw new TradingCommercialDirectionValidationError(
      'Refinement must target one exact DirectionVersion in the current set.'
    );

  assertTradingCommercialDirectionSetV1(previousSet);
  assertTradingCommercialDirectionSetV1(refinedSet);
  if (
    refinedSet.commercialDirectionSetId !== previousSet.commercialDirectionSetId ||
    refinedSet.version !== previousSet.version + 1 ||
    refinedSet.workspaceId !== previousSet.workspaceId ||
    !sameReference(refinedSet.studioRun, previousSet.studioRun) ||
    !sameReference(refinedSet.trademarkAsset, previousSet.trademarkAsset) ||
    !sameReference(refinedSet.brandDna, previousSet.brandDna)
  )
    throw new TradingCommercialDirectionValidationError(
      'Refinement must create the next DirectionSet version with unchanged source lineage.'
    );

  for (const before of previousSet.directions) {
    const after = refinedSet.directions.find(
      (direction) => direction.commercialDirectionId === before.commercialDirectionId
    );
    if (!after)
      throw new TradingCommercialDirectionValidationError(
        'Refinement must preserve all three direction identities.'
      );
    if (before.commercialDirectionId === command.commercialDirectionId) {
      if (
        after.version !== before.version + 1 ||
        after.previousVersion?.id !== before.commercialDirectionId ||
        after.previousVersion.version !== before.version ||
        after.role !== before.role
      )
        throw new TradingCommercialDirectionValidationError(
          'The refined candidate must be the immediate next version with the same semantic role.'
        );
    } else if (canonicalJson(after) !== canonicalJson(before)) {
      throw new TradingCommercialDirectionValidationError(
        'A refinement may change only the explicitly targeted candidate.'
      );
    }
  }
}
