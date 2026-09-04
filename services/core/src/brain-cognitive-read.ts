import type {
  BrainAssetStatus,
  BrainAssetVersion,
  BrainAssetVersionId
} from '@markorbit/contracts/brain';
import type {
  BrainGapRegistryQuery,
  BrainGapRegistryRecord,
  BrainGapStatus
} from '@markorbit/contracts/brain-gap';
import { BrainAssetRegistryError } from './brain-asset-registry.js';
import { BrainGapRegistryError } from './brain-gap-registry.js';

export type BrainCognitiveReadErrorCode = 'SOURCE_UNAVAILABLE';

export class BrainCognitiveReadError extends Error {
  constructor(
    readonly code: BrainCognitiveReadErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'BrainCognitiveReadError';
  }
}

export interface BrainAssetCurrentReadAuthority {
  listCurrent():
    | readonly Readonly<BrainAssetVersion>[]
    | Promise<readonly Readonly<BrainAssetVersion>[]>;
}

export interface BrainGapReadAuthority {
  query(
    query?: Readonly<BrainGapRegistryQuery>
  ):
    | readonly Readonly<BrainGapRegistryRecord>[]
    | Promise<readonly Readonly<BrainGapRegistryRecord>[]>;
}

export interface BrainAssetCognitiveReadItemV1 {
  brainAssetId: BrainAssetVersion['brainAssetId'];
  brainAssetVersionId: BrainAssetVersionId;
  version: number;
  assetType: BrainAssetVersion['assetType'];
  status: BrainAssetStatus;
  scope: Readonly<BrainAssetVersion['scope']>;
  confidence: Readonly<Pick<BrainAssetVersion['confidence'], 'score' | 'band'>>;
  evidenceSources: readonly Readonly<BrainAssetVersion['evidenceRefs'][number]>[];
  derivedFromBrainAssetVersionIds: readonly BrainAssetVersionId[];
  createdAt: string;
  validatedAt?: string;
}

export interface BrainGapCognitiveReadItemV1 {
  brainGapRegistryKey: BrainGapRegistryRecord['brainGapRegistryKey'];
  identityFingerprintSha256: string;
  status: BrainGapStatus;
  gapType: BrainGapRegistryRecord['latestGap']['gapType'];
  severity: BrainGapRegistryRecord['latestGap']['severity'];
  businessImpact: BrainGapRegistryRecord['latestGap']['businessImpact'];
  detectionSource: BrainGapRegistryRecord['latestGap']['detectionSource'];
  targetModule: BrainGapRegistryRecord['latestGap']['targetModule'];
  scope: Readonly<BrainGapRegistryRecord['latestGap']['scope']>;
  reasonCode: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  occurrenceCount: number;
  relatedBrainBuildRunId?: BrainGapRegistryRecord['latestGap']['relatedBrainBuildRunId'];
  relatedBrainAssetVersionId?: BrainGapRegistryRecord['latestGap']['relatedBrainAssetVersionId'];
  latestDisposition?: Readonly<{
    status: BrainGapStatus;
    occurredAt: string;
    source: BrainGapRegistryRecord['latestDisposition'] extends infer T
      ? T extends { source: infer S }
        ? S
        : never
      : never;
  }>;
}

export interface BrainCognitiveReadProjectionV1 {
  schemaVersion: 1;
  generatedAt: string;
  source: Readonly<{
    domain: 'CORE';
    authority: 'BRAIN_REGISTRIES';
    availability: 'AVAILABLE';
  }>;
  brainAssets: readonly Readonly<BrainAssetCognitiveReadItemV1>[];
  brainGaps: readonly Readonly<BrainGapCognitiveReadItemV1>[];
  summary: Readonly<{
    brainAssetCount: number;
    brainGapCount: number;
    openBrainGapCount: number;
  }>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function projectAsset(asset: Readonly<BrainAssetVersion>): BrainAssetCognitiveReadItemV1 {
  return {
    brainAssetId: asset.brainAssetId,
    brainAssetVersionId: asset.brainAssetVersionId,
    version: asset.version,
    assetType: asset.assetType,
    status: asset.status,
    scope: clone(asset.scope),
    confidence: {
      score: asset.confidence.score,
      band: asset.confidence.band
    },
    evidenceSources: asset.evidenceRefs.map((reference) => clone(reference)),
    derivedFromBrainAssetVersionIds: [...asset.derivedFromBrainAssetVersionIds],
    createdAt: asset.createdAt,
    ...(asset.validatedAt ? { validatedAt: asset.validatedAt } : {})
  };
}

function projectGap(record: Readonly<BrainGapRegistryRecord>): BrainGapCognitiveReadItemV1 {
  const gap = record.latestGap;
  return {
    brainGapRegistryKey: record.brainGapRegistryKey,
    identityFingerprintSha256: record.identityFingerprintSha256,
    status: record.status,
    gapType: gap.gapType,
    severity: gap.severity,
    businessImpact: gap.businessImpact,
    detectionSource: gap.detectionSource,
    targetModule: gap.targetModule,
    scope: clone(gap.scope),
    reasonCode: gap.reasonCode,
    firstDetectedAt: record.firstDetectedAt,
    lastDetectedAt: record.lastDetectedAt,
    occurrenceCount: record.occurrenceCount,
    ...(gap.relatedBrainBuildRunId
      ? { relatedBrainBuildRunId: gap.relatedBrainBuildRunId }
      : {}),
    ...(gap.relatedBrainAssetVersionId
      ? { relatedBrainAssetVersionId: gap.relatedBrainAssetVersionId }
      : {}),
    ...(record.latestDisposition
      ? {
          latestDisposition: {
            status: record.latestDisposition.status,
            occurredAt: record.latestDisposition.occurredAt,
            source: record.latestDisposition.source
          }
        }
      : {})
  };
}

function unavailable(error: unknown): never {
  if (
    (error instanceof BrainAssetRegistryError && error.code === 'PERSISTENCE_UNAVAILABLE') ||
    (error instanceof BrainGapRegistryError && error.code === 'PERSISTENCE_UNAVAILABLE')
  ) {
    throw new BrainCognitiveReadError(
      'SOURCE_UNAVAILABLE',
      'Core cognitive registry source is unavailable.'
    );
  }
  throw error;
}

export class BrainCognitiveReadServiceV1 {
  constructor(
    private readonly assets: BrainAssetCurrentReadAuthority,
    private readonly gaps: BrainGapReadAuthority,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async read(): Promise<Readonly<BrainCognitiveReadProjectionV1>> {
    try {
      const [assets, gaps] = await Promise.all([this.assets.listCurrent(), this.gaps.query({})]);
      const brainAssets = [...assets]
        .sort((left, right) => left.brainAssetId.localeCompare(right.brainAssetId))
        .map(projectAsset);
      const brainGaps = [...gaps]
        .sort((left, right) => left.brainGapRegistryKey.localeCompare(right.brainGapRegistryKey))
        .map(projectGap);
      return {
        schemaVersion: 1,
        generatedAt: this.clock().toISOString(),
        source: {
          domain: 'CORE',
          authority: 'BRAIN_REGISTRIES',
          availability: 'AVAILABLE'
        },
        brainAssets,
        brainGaps,
        summary: {
          brainAssetCount: brainAssets.length,
          brainGapCount: brainGaps.length,
          openBrainGapCount: brainGaps.filter((gap) => gap.status === 'OPEN').length
        }
      };
    } catch (error) {
      unavailable(error);
    }
  }
}
