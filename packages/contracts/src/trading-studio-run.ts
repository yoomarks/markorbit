import type { ProductLoopExactReference } from './product-loop.js';
import type { TradingAiProfileId } from './trading-ai-profile.js';
import type { TradingBrandDnaId } from './trading-brand-dna.js';
import type { TradingCommercialDirectionSetId } from './trading-commercial-direction.js';
import type { TradingStandardStudioRunId } from './trading-studio-usage.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export const tradingStudioRunStatuses = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'] as const;
export type TradingStudioRunStatus = (typeof tradingStudioRunStatuses)[number];

export const tradingStudioRunCheckpoints = [
  'NONE',
  'AI_PROFILE',
  'BRAND_DNA',
  'COMMERCIAL_DIRECTIONS'
] as const;
export type TradingStudioRunCheckpoint = (typeof tradingStudioRunCheckpoints)[number];
export type TradingStudioRunCurrentness = 'CURRENT' | 'STALE';

export const noTradingStudioRunAuthorityConsequencesV1 = Object.freeze({
  humanSelectionCreated: false,
  deepBuildStarted: false,
  listingCreated: false,
  trademarkTruthMutated: false
});
export type TradingStudioRunAuthorityConsequencesV1 =
  typeof noTradingStudioRunAuthorityConsequencesV1;

export interface TradingStudioRunFailureV1 {
  code: string;
  message: string;
  retryable: boolean;
}

/** Durable workflow snapshot. Generated objects remain owned by their individual contracts. */
export interface TradingStudioRunV1 {
  schemaVersion: 1;
  studioRunId: TradingStandardStudioRunId;
  workspaceId: string;
  version: number;
  status: TradingStudioRunStatus;
  currentness: TradingStudioRunCurrentness;
  checkpoint: TradingStudioRunCheckpoint;
  trademarkAsset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  aiProfile?: Readonly<ProductLoopExactReference<TradingAiProfileId>>;
  brandDna?: Readonly<ProductLoopExactReference<TradingBrandDnaId>>;
  directionSet?: Readonly<ProductLoopExactReference<TradingCommercialDirectionSetId>>;
  failure?: Readonly<TradingStudioRunFailureV1>;
  canResume: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  authorityConsequences: TradingStudioRunAuthorityConsequencesV1;
}

export class TradingStudioRunValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingStudioRunValidationError';
  }
}

function required(value: string, field: string): void {
  if (!value.trim()) throw new TradingStudioRunValidationError(`${field} is required.`);
}

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!value.trim() || Number.isNaN(parsed))
    throw new TradingStudioRunValidationError(`${field} must be an ISO timestamp.`);
  return parsed;
}

function assertReference(
  reference: Readonly<ProductLoopExactReference> | undefined,
  pattern: RegExp,
  field: string
): void {
  if (
    !reference ||
    !pattern.test(reference.id) ||
    typeof reference.version !== 'number' ||
    !Number.isSafeInteger(reference.version) ||
    reference.version < 1
  )
    throw new TradingStudioRunValidationError(`${field} must be an exact versioned reference.`);
}

export function assertTradingStudioRunV1(run: Readonly<TradingStudioRunV1>): void {
  if (run.schemaVersion !== 1)
    throw new TradingStudioRunValidationError('tradingStudioRun.schemaVersion must be 1.');
  if (!/^standard-studio-run_[A-Za-z0-9_-]+$/u.test(run.studioRunId))
    throw new TradingStudioRunValidationError('tradingStudioRun.studioRunId is invalid.');
  required(run.workspaceId, 'tradingStudioRun.workspaceId');
  if (!Number.isSafeInteger(run.version) || run.version < 1)
    throw new TradingStudioRunValidationError('tradingStudioRun.version must be positive.');
  if (!tradingStudioRunStatuses.includes(run.status))
    throw new TradingStudioRunValidationError('tradingStudioRun.status is invalid.');
  if (run.currentness !== 'CURRENT' && run.currentness !== 'STALE')
    throw new TradingStudioRunValidationError('tradingStudioRun.currentness is invalid.');
  if (!tradingStudioRunCheckpoints.includes(run.checkpoint))
    throw new TradingStudioRunValidationError('tradingStudioRun.checkpoint is invalid.');
  assertReference(
    run.trademarkAsset,
    /^trademark-asset_[A-Za-z0-9_-]+$/u,
    'tradingStudioRun.trademarkAsset'
  );

  const checkpointIndex = tradingStudioRunCheckpoints.indexOf(run.checkpoint);
  const artifacts = [run.aiProfile, run.brandDna, run.directionSet];
  if (artifacts.some((artifact, index) => index < checkpointIndex !== (artifact !== undefined)))
    throw new TradingStudioRunValidationError(
      'Studio Run artifacts must exactly match the sequential durable checkpoint.'
    );
  if (run.aiProfile)
    assertReference(
      run.aiProfile,
      /^trading-ai-derived_ai-profile_[A-Za-z0-9_-]+$/u,
      'tradingStudioRun.aiProfile'
    );
  if (run.brandDna)
    assertReference(
      run.brandDna,
      /^trading-ai-derived_brand-dna_[A-Za-z0-9_-]+$/u,
      'tradingStudioRun.brandDna'
    );
  if (run.directionSet)
    assertReference(
      run.directionSet,
      /^commercial-direction-set_[A-Za-z0-9_-]+$/u,
      'tradingStudioRun.directionSet'
    );

  const completed = run.status === 'COMPLETED';
  if (completed !== (run.checkpoint === 'COMMERCIAL_DIRECTIONS'))
    throw new TradingStudioRunValidationError(
      'Only a Studio Run with all commercial directions may be COMPLETED.'
    );
  if ((run.status === 'FAILED') !== (run.failure !== undefined))
    throw new TradingStudioRunValidationError(
      'Only a FAILED Studio Run may contain failure details.'
    );
  if (run.failure) {
    required(run.failure.code, 'tradingStudioRun.failure.code');
    required(run.failure.message, 'tradingStudioRun.failure.message');
  }
  const expectedCanResume = !completed && run.currentness === 'CURRENT';
  if (run.canResume !== expectedCanResume)
    throw new TradingStudioRunValidationError(
      'Studio Run canResume must be false after completion or when source state is stale.'
    );

  const createdAt = timestamp(run.createdAt, 'tradingStudioRun.createdAt');
  const updatedAt = timestamp(run.updatedAt, 'tradingStudioRun.updatedAt');
  if (updatedAt < createdAt)
    throw new TradingStudioRunValidationError(
      'tradingStudioRun.updatedAt cannot precede createdAt.'
    );
  if (completed !== (run.completedAt !== undefined))
    throw new TradingStudioRunValidationError('Only a COMPLETED Studio Run may have completedAt.');
  if (run.completedAt && timestamp(run.completedAt, 'tradingStudioRun.completedAt') < createdAt)
    throw new TradingStudioRunValidationError(
      'tradingStudioRun.completedAt cannot precede createdAt.'
    );
  for (const [key, value] of Object.entries(run.authorityConsequences)) {
    if (value !== false)
      throw new TradingStudioRunValidationError(
        `tradingStudioRun.authorityConsequences.${key} must be false.`
      );
  }
}
