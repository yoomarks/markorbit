import type { ProductLoopExactReference } from './product-loop.js';
import type { MarkOrbitId } from './index.js';
import type { TradingBrandDnaId } from './trading-brand-dna.js';
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
  title: string;
  summary: string;
  rationale: string;
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
