import { createHash } from 'node:crypto';
import type { BrainBuildResult } from '@markorbit/contracts/brain-build';
import {
  parseBrainAssetVersion,
  type BrainAssetId,
  type BrainAssetStatus,
  type BrainAssetVersion,
  type BrainAssetVersionId,
  type BrainBuildRunId
} from '@markorbit/contracts/brain';

export type BrainAssetRegistryErrorCode =
  | 'INVALID_TRANSITION'
  | 'VERSION_CONFLICT'
  | 'VERSION_NOT_FOUND'
  | 'AMBIGUOUS_ACTIVE_ASSET'
  | 'NO_ACTIVE_ASSET'
  | 'BUILD_NOT_ADMISSIBLE'
  | 'BUILD_IDENTITY_CONFLICT';

export class BrainAssetRegistryError extends Error {
  constructor(
    readonly code: BrainAssetRegistryErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'BrainAssetRegistryError';
  }
}

export interface BrainAssetResolutionQuery {
  domain: string;
  concept: string;
  jurisdiction?: string;
  asOf: string;
}

interface BrainBuildAdmissionRecord {
  brainAssetId: BrainAssetId;
  producedBrainAssetVersionId: BrainAssetVersionId;
  admittedBrainAssetVersionId: BrainAssetVersionId;
}

const transitions: Readonly<Record<BrainAssetStatus, readonly BrainAssetStatus[]>> = {
  DRAFT: ['CANDIDATE', 'RETIRED'],
  CANDIDATE: ['VALIDATED', 'RETIRED'],
  VALIDATED: ['ACTIVE', 'DEGRADED', 'RETIRED'],
  ACTIVE: ['ACTIVE', 'DEGRADED', 'RETIRED'],
  DEGRADED: ['ACTIVE', 'DEGRADED', 'RETIRED'],
  RETIRED: []
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalized(value: string | undefined): string | undefined {
  return value?.trim().toUpperCase();
}

function sameScope(left: BrainAssetVersion, right: BrainAssetVersion): boolean {
  return (
    left.scope.domain === right.scope.domain &&
    normalized(left.scope.jurisdiction) === normalized(right.scope.jurisdiction) &&
    left.scope.concept === right.scope.concept
  );
}

function effectiveAt(asset: BrainAssetVersion, asOf: number): boolean {
  const from = Date.parse(asset.scope.effectiveFrom);
  const to = asset.scope.effectiveTo
    ? Date.parse(asset.scope.effectiveTo)
    : Number.POSITIVE_INFINITY;
  return from <= asOf && asOf < to;
}

function admittedVersionId(
  brainBuildRunId: BrainBuildRunId,
  producedBrainAssetVersionId: BrainAssetVersionId,
  version: number
): BrainAssetVersionId {
  const fingerprint = createHash('sha256')
    .update(`${brainBuildRunId}:${producedBrainAssetVersionId}:${version}`)
    .digest('hex');
  return `brain-asset-version_${fingerprint}`;
}

export class InMemoryBrainAssetRegistry {
  private readonly byVersionId = new Map<BrainAssetVersionId, BrainAssetVersion>();
  private readonly byAssetId = new Map<BrainAssetId, BrainAssetVersion[]>();
  private readonly byBuildRunId = new Map<BrainBuildRunId, BrainBuildAdmissionRecord>();

  register(value: unknown): Readonly<BrainAssetVersion> {
    const asset = parseBrainAssetVersion(value);
    if (this.byVersionId.has(asset.brainAssetVersionId))
      throw new BrainAssetRegistryError(
        'VERSION_CONFLICT',
        'brainAssetVersionId is already registered.',
        { brainAssetVersionId: asset.brainAssetVersionId }
      );

    const versions = this.byAssetId.get(asset.brainAssetId) ?? [];
    const duplicateVersion = versions.find((candidate) => candidate.version === asset.version);
    if (duplicateVersion)
      throw new BrainAssetRegistryError(
        'VERSION_CONFLICT',
        'Brain asset version is already registered.',
        {
          brainAssetId: asset.brainAssetId,
          version: asset.version
        }
      );

    const previous = versions.at(-1);
    if (!previous) {
      if (asset.version !== 1 || asset.status !== 'DRAFT')
        throw new BrainAssetRegistryError(
          'INVALID_TRANSITION',
          'The first Brain asset version must be version 1 in DRAFT status.'
        );
    } else {
      if (asset.version !== previous.version + 1)
        throw new BrainAssetRegistryError(
          'VERSION_CONFLICT',
          'Brain asset versions must be contiguous and monotonically increasing.',
          { expectedVersion: previous.version + 1, receivedVersion: asset.version }
        );
      if (!sameScope(previous, asset))
        throw new BrainAssetRegistryError(
          'INVALID_TRANSITION',
          'A Brain asset identity cannot change domain, jurisdiction, or concept across versions.'
        );
      if (!transitions[previous.status].includes(asset.status))
        throw new BrainAssetRegistryError(
          'INVALID_TRANSITION',
          `Brain asset status cannot transition from ${previous.status} to ${asset.status}.`
        );
    }

    return this.store(asset);
  }

  admitBuildResult(result: Readonly<BrainBuildResult>): Readonly<BrainAssetVersion> {
    const { run } = result;
    const produced = run.producedAssetVersion;
    if (
      !produced ||
      (run.status !== 'CANDIDATE_READY' && run.status !== 'VALIDATED_READY')
    ) {
      throw new BrainAssetRegistryError(
        'BUILD_NOT_ADMISSIBLE',
        'Only successful CANDIDATE_READY or VALIDATED_READY Brain BuildRuns may be admitted.',
        { brainBuildRunId: run.brainBuildRunId, buildStatus: run.status }
      );
    }

    const parsedProduced = parseBrainAssetVersion(produced);
    const expectedStatus = run.status === 'VALIDATED_READY' ? 'VALIDATED' : 'CANDIDATE';
    if (parsedProduced.status !== expectedStatus) {
      throw new BrainAssetRegistryError(
        'BUILD_NOT_ADMISSIBLE',
        'Brain BuildRun status does not match its produced asset status.',
        {
          brainBuildRunId: run.brainBuildRunId,
          buildStatus: run.status,
          producedStatus: parsedProduced.status
        }
      );
    }

    const previousAdmission = this.byBuildRunId.get(run.brainBuildRunId);
    if (previousAdmission) {
      if (
        previousAdmission.brainAssetId !== parsedProduced.brainAssetId ||
        previousAdmission.producedBrainAssetVersionId !== parsedProduced.brainAssetVersionId
      ) {
        throw new BrainAssetRegistryError(
          'BUILD_IDENTITY_CONFLICT',
          'A Brain BuildRun id cannot be replayed with a different produced asset identity.',
          { brainBuildRunId: run.brainBuildRunId }
        );
      }
      return this.getVersion(previousAdmission.admittedBrainAssetVersionId);
    }

    const versions = this.byAssetId.get(parsedProduced.brainAssetId) ?? [];
    const previous = versions.at(-1);
    if (previous?.status === 'RETIRED') {
      throw new BrainAssetRegistryError(
        'INVALID_TRANSITION',
        'A RETIRED Brain asset identity cannot receive a new build admission.',
        { brainAssetId: parsedProduced.brainAssetId }
      );
    }
    if (previous && !sameScope(previous, parsedProduced)) {
      throw new BrainAssetRegistryError(
        'INVALID_TRANSITION',
        'A Brain asset identity cannot change domain, jurisdiction, or concept across build admissions.'
      );
    }

    const version = (previous?.version ?? 0) + 1;
    const admitted = parseBrainAssetVersion({
      ...parsedProduced,
      version,
      brainAssetVersionId: admittedVersionId(
        run.brainBuildRunId,
        parsedProduced.brainAssetVersionId,
        version
      )
    });
    const stored = this.store(admitted);
    this.byBuildRunId.set(run.brainBuildRunId, {
      brainAssetId: admitted.brainAssetId,
      producedBrainAssetVersionId: parsedProduced.brainAssetVersionId,
      admittedBrainAssetVersionId: admitted.brainAssetVersionId
    });
    return stored;
  }

  getVersion(brainAssetVersionId: BrainAssetVersionId): Readonly<BrainAssetVersion> {
    const asset = this.byVersionId.get(brainAssetVersionId);
    if (!asset)
      throw new BrainAssetRegistryError('VERSION_NOT_FOUND', 'Brain asset version was not found.', {
        brainAssetVersionId
      });
    return clone(asset);
  }

  listVersions(brainAssetId: BrainAssetId): readonly Readonly<BrainAssetVersion>[] {
    return (this.byAssetId.get(brainAssetId) ?? []).map(clone);
  }

  resolveActive(query: BrainAssetResolutionQuery): Readonly<BrainAssetVersion> {
    const asOf = Date.parse(query.asOf);
    if (Number.isNaN(asOf))
      throw new BrainAssetRegistryError('NO_ACTIVE_ASSET', 'asOf must be an ISO date/time.');
    const jurisdiction = normalized(query.jurisdiction);
    const latestActiveByAsset = new Map<BrainAssetId, BrainAssetVersion>();

    for (const versions of this.byAssetId.values()) {
      const matching = versions.filter(
        (asset) =>
          asset.status === 'ACTIVE' &&
          asset.scope.domain === query.domain &&
          asset.scope.concept === query.concept &&
          normalized(asset.scope.jurisdiction) === jurisdiction &&
          effectiveAt(asset, asOf)
      );
      const latest = matching.at(-1);
      if (latest) latestActiveByAsset.set(latest.brainAssetId, latest);
    }

    const active = [...latestActiveByAsset.values()];
    if (!active.length)
      throw new BrainAssetRegistryError(
        'NO_ACTIVE_ASSET',
        'No ACTIVE Brain asset matches the query.',
        {
          domain: query.domain,
          jurisdiction,
          concept: query.concept,
          asOf: query.asOf
        }
      );
    if (active.length > 1)
      throw new BrainAssetRegistryError(
        'AMBIGUOUS_ACTIVE_ASSET',
        'Multiple ACTIVE Brain assets match the same governed scope.',
        { brainAssetVersionIds: active.map((asset) => asset.brainAssetVersionId) }
      );
    return clone(active[0]!);
  }

  private store(asset: BrainAssetVersion): Readonly<BrainAssetVersion> {
    if (this.byVersionId.has(asset.brainAssetVersionId))
      throw new BrainAssetRegistryError(
        'VERSION_CONFLICT',
        'brainAssetVersionId is already registered.',
        { brainAssetVersionId: asset.brainAssetVersionId }
      );
    const versions = this.byAssetId.get(asset.brainAssetId) ?? [];
    if (versions.some((candidate) => candidate.version === asset.version))
      throw new BrainAssetRegistryError(
        'VERSION_CONFLICT',
        'Brain asset version is already registered.',
        { brainAssetId: asset.brainAssetId, version: asset.version }
      );
    const stored = clone(asset);
    this.byVersionId.set(stored.brainAssetVersionId, stored);
    this.byAssetId.set(stored.brainAssetId, [...versions, stored]);
    return clone(stored);
  }
}
