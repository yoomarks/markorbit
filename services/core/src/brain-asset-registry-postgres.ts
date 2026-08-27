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
import type { ManagedDatabase, QueryClient } from '@markorbit/persistence';
import { BrainAssetRegistryError, type BrainAssetResolutionQuery } from './brain-asset-registry.js';

const transitions: Readonly<Record<BrainAssetStatus, readonly BrainAssetStatus[]>> = {
  DRAFT: ['CANDIDATE', 'RETIRED'],
  CANDIDATE: ['VALIDATED', 'RETIRED'],
  VALIDATED: ['ACTIVE', 'DEGRADED', 'RETIRED'],
  ACTIVE: ['ACTIVE', 'DEGRADED', 'RETIRED'],
  DEGRADED: ['ACTIVE', 'DEGRADED', 'RETIRED'],
  RETIRED: []
};

type AssetRow = { asset_json: unknown };
type AdmissionRow = {
  brain_asset_id: string;
  produced_brain_asset_version_id: string;
  admitted_brain_asset_version_id: string;
  asset_json: unknown;
};

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

function pgCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function persistenceFailure(error: unknown): never {
  if (error instanceof BrainAssetRegistryError) throw error;
  if (pgCode(error) === '23505')
    throw new BrainAssetRegistryError('VERSION_CONFLICT', 'Brain registry version already exists.');
  throw new BrainAssetRegistryError(
    'PERSISTENCE_UNAVAILABLE',
    'Brain registry persistence is unavailable.'
  );
}

async function lock(client: QueryClient, key: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
}

function parseStored(row: AssetRow | undefined): BrainAssetVersion | undefined {
  return row ? parseBrainAssetVersion(row.asset_json) : undefined;
}

async function latestVersion(
  client: QueryClient,
  brainAssetId: BrainAssetId
): Promise<BrainAssetVersion | undefined> {
  const result = await client.query<AssetRow>(
    'SELECT asset_json FROM brain_asset_versions WHERE brain_asset_id=$1 ORDER BY version DESC LIMIT 1',
    [brainAssetId]
  );
  return parseStored(result.rows[0]);
}

async function insertAsset(
  client: QueryClient,
  asset: BrainAssetVersion,
  admittedBuildRunId?: BrainBuildRunId
): Promise<void> {
  await client.query(
    `INSERT INTO brain_asset_versions(
       brain_asset_version_id,brain_asset_id,version,asset_type,status,domain,jurisdiction,concept,
       effective_from,effective_to,asset_json,created_at,admitted_build_run_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)`,
    [
      asset.brainAssetVersionId,
      asset.brainAssetId,
      asset.version,
      asset.assetType,
      asset.status,
      asset.scope.domain,
      normalized(asset.scope.jurisdiction) ?? null,
      asset.scope.concept,
      asset.scope.effectiveFrom,
      asset.scope.effectiveTo ?? null,
      JSON.stringify(asset),
      asset.createdAt,
      admittedBuildRunId ?? null
    ]
  );
}

export class PostgresBrainAssetRegistry {
  constructor(private readonly database: ManagedDatabase) {}

  async register(value: unknown): Promise<Readonly<BrainAssetVersion>> {
    const asset = parseBrainAssetVersion(value);
    try {
      return await this.database.transact(async (client) => {
        await lock(client, `brain-asset:${asset.brainAssetId}`);
        const duplicate = await client.query(
          'SELECT 1 FROM brain_asset_versions WHERE brain_asset_version_id=$1 OR (brain_asset_id=$2 AND version=$3) LIMIT 1',
          [asset.brainAssetVersionId, asset.brainAssetId, asset.version]
        );
        if (duplicate.rowCount)
          throw new BrainAssetRegistryError(
            'VERSION_CONFLICT',
            'Brain asset version already exists.'
          );

        const previous = await latestVersion(client, asset.brainAssetId);
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
        await insertAsset(client, asset);
        return structuredClone(asset);
      });
    } catch (error) {
      persistenceFailure(error);
    }
  }

  async admitBuildResult(result: Readonly<BrainBuildResult>): Promise<Readonly<BrainAssetVersion>> {
    const { run } = result;
    const produced = run.producedAssetVersion;
    if (!produced || (run.status !== 'CANDIDATE_READY' && run.status !== 'VALIDATED_READY'))
      throw new BrainAssetRegistryError(
        'BUILD_NOT_ADMISSIBLE',
        'Only successful CANDIDATE_READY or VALIDATED_READY Brain BuildRuns may be admitted.',
        { brainBuildRunId: run.brainBuildRunId, buildStatus: run.status }
      );

    const parsedProduced = parseBrainAssetVersion(produced);
    const expectedStatus = run.status === 'VALIDATED_READY' ? 'VALIDATED' : 'CANDIDATE';
    if (parsedProduced.status !== expectedStatus)
      throw new BrainAssetRegistryError(
        'BUILD_NOT_ADMISSIBLE',
        'Brain BuildRun status does not match its produced asset status.',
        {
          brainBuildRunId: run.brainBuildRunId,
          buildStatus: run.status,
          producedStatus: parsedProduced.status
        }
      );

    try {
      return await this.database.transact(async (client) => {
        await lock(client, `brain-build:${run.brainBuildRunId}`);
        const existing = await client.query<AdmissionRow>(
          `SELECT a.brain_asset_id,a.produced_brain_asset_version_id,a.admitted_brain_asset_version_id,
                  v.asset_json
             FROM brain_build_admissions a
             JOIN brain_asset_versions v
               ON v.brain_asset_version_id=a.admitted_brain_asset_version_id
            WHERE a.brain_build_run_id=$1`,
          [run.brainBuildRunId]
        );
        const admission = existing.rows[0];
        if (admission) {
          if (
            admission.brain_asset_id !== parsedProduced.brainAssetId ||
            admission.produced_brain_asset_version_id !== parsedProduced.brainAssetVersionId
          )
            throw new BrainAssetRegistryError(
              'BUILD_IDENTITY_CONFLICT',
              'A Brain BuildRun id cannot be replayed with a different produced asset identity.',
              { brainBuildRunId: run.brainBuildRunId }
            );
          return parseBrainAssetVersion(admission.asset_json);
        }

        await lock(client, `brain-asset:${parsedProduced.brainAssetId}`);
        const previous = await latestVersion(client, parsedProduced.brainAssetId);
        if (previous?.status === 'RETIRED')
          throw new BrainAssetRegistryError(
            'INVALID_TRANSITION',
            'A RETIRED Brain asset identity cannot receive a new build admission.',
            { brainAssetId: parsedProduced.brainAssetId }
          );
        if (previous && !sameScope(previous, parsedProduced))
          throw new BrainAssetRegistryError(
            'INVALID_TRANSITION',
            'A Brain asset identity cannot change domain, jurisdiction, or concept across build admissions.'
          );

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
        await insertAsset(client, admitted, run.brainBuildRunId);
        await client.query(
          `INSERT INTO brain_build_admissions(
             brain_build_run_id,brain_asset_id,produced_brain_asset_version_id,admitted_brain_asset_version_id
           ) VALUES($1,$2,$3,$4)`,
          [
            run.brainBuildRunId,
            admitted.brainAssetId,
            parsedProduced.brainAssetVersionId,
            admitted.brainAssetVersionId
          ]
        );
        return structuredClone(admitted);
      });
    } catch (error) {
      persistenceFailure(error);
    }
  }

  async getVersion(brainAssetVersionId: BrainAssetVersionId): Promise<Readonly<BrainAssetVersion>> {
    try {
      const result = await this.database
        .getPool()
        .query<AssetRow>(
          'SELECT asset_json FROM brain_asset_versions WHERE brain_asset_version_id=$1',
          [brainAssetVersionId]
        );
      const asset = parseStored(result.rows[0]);
      if (!asset)
        throw new BrainAssetRegistryError(
          'VERSION_NOT_FOUND',
          'Brain asset version was not found.',
          {
            brainAssetVersionId
          }
        );
      return structuredClone(asset);
    } catch (error) {
      persistenceFailure(error);
    }
  }

  async listVersions(brainAssetId: BrainAssetId): Promise<readonly Readonly<BrainAssetVersion>[]> {
    try {
      const result = await this.database
        .getPool()
        .query<AssetRow>(
          'SELECT asset_json FROM brain_asset_versions WHERE brain_asset_id=$1 ORDER BY version',
          [brainAssetId]
        );
      return result.rows.map((row) => parseBrainAssetVersion(row.asset_json));
    } catch (error) {
      persistenceFailure(error);
    }
  }

  async resolveActive(query: BrainAssetResolutionQuery): Promise<Readonly<BrainAssetVersion>> {
    const asOf = Date.parse(query.asOf);
    if (Number.isNaN(asOf))
      throw new BrainAssetRegistryError('NO_ACTIVE_ASSET', 'asOf must be an ISO date/time.');
    try {
      const result = await this.database.getPool().query<AssetRow>(
        `SELECT DISTINCT ON (brain_asset_id) asset_json
           FROM brain_asset_versions
          WHERE status='ACTIVE'
            AND domain=$1
            AND concept=$2
            AND jurisdiction IS NOT DISTINCT FROM $3
            AND effective_from <= $4
            AND (effective_to IS NULL OR $4 < effective_to)
          ORDER BY brain_asset_id,version DESC`,
        [query.domain, query.concept, normalized(query.jurisdiction) ?? null, query.asOf]
      );
      const active = result.rows.map((row) => parseBrainAssetVersion(row.asset_json));
      if (!active.length)
        throw new BrainAssetRegistryError(
          'NO_ACTIVE_ASSET',
          'No ACTIVE Brain asset matches the query.',
          {
            domain: query.domain,
            jurisdiction: normalized(query.jurisdiction),
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
      return structuredClone(active[0]!);
    } catch (error) {
      persistenceFailure(error);
    }
  }
}
