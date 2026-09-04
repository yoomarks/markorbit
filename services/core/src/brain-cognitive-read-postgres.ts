import { parseBrainAssetVersion, type BrainAssetVersion } from '@markorbit/contracts/brain';
import type { ManagedDatabase } from '@markorbit/persistence';
import { BrainAssetRegistryError } from './brain-asset-registry.js';
import {
  BrainCognitiveReadError,
  BrainCognitiveReadServiceV1,
  type BrainAssetCurrentReadAuthority,
  type BrainCognitiveReadProjectionV1
} from './brain-cognitive-read.js';
import { PostgresBrainGapRegistry } from './brain-gap-registry-postgres.js';
import {
  MethodImprovementCognitiveReadError,
  MethodImprovementCognitiveReadServiceV1,
  type MethodImprovementCognitiveReadProjectionV1
} from './method-improvement-cognitive-read.js';
import { PostgresMethodImprovementCognitiveReadSourceV1 } from './method-improvement-cognitive-read-postgres.js';

type AssetRow = { asset_json: unknown };

export interface CoreCognitiveReadProjectionV1
  extends Omit<BrainCognitiveReadProjectionV1, 'summary'> {
  methodImprovements: MethodImprovementCognitiveReadProjectionV1['methodImprovements'];
  brainBuildRuns: MethodImprovementCognitiveReadProjectionV1['brainBuildRuns'];
  summary: Readonly<
    BrainCognitiveReadProjectionV1['summary'] & MethodImprovementCognitiveReadProjectionV1['summary']
  >;
}

export interface CoreCognitiveReadServiceV1 {
  read(): Promise<Readonly<CoreCognitiveReadProjectionV1>>;
}

function pgCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

/**
 * Read-only owner authority for the current Brain Asset inventory.
 *
 * It intentionally reads the existing Brain registry tables without adding a new
 * persistence model or mutation surface. Every stored document is re-parsed through
 * the canonical Brain contract before it can enter an operator projection.
 */
export class PostgresBrainAssetCurrentReadAuthority implements BrainAssetCurrentReadAuthority {
  constructor(private readonly database: ManagedDatabase) {}

  async listCurrent(): Promise<readonly Readonly<BrainAssetVersion>[]> {
    try {
      const result = await this.database.getPool().query<AssetRow>(
        `SELECT DISTINCT ON (brain_asset_id) asset_json
           FROM brain_asset_versions
          ORDER BY brain_asset_id ASC, version DESC`
      );
      return result.rows.map((row) => parseBrainAssetVersion(row.asset_json));
    } catch (error) {
      if (error instanceof BrainAssetRegistryError) throw error;
      throw new BrainAssetRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Brain registry current read is unavailable.',
        pgCode(error) ? { postgresCode: pgCode(error) } : undefined
      );
    }
  }
}

export function createPostgresBrainCognitiveReadServiceV1(
  database: ManagedDatabase,
  clock?: () => Date
): CoreCognitiveReadServiceV1 {
  const brain = new BrainCognitiveReadServiceV1(
    new PostgresBrainAssetCurrentReadAuthority(database),
    new PostgresBrainGapRegistry(database),
    clock
  );
  const methodImprovements = new MethodImprovementCognitiveReadServiceV1(
    new PostgresMethodImprovementCognitiveReadSourceV1(database),
    clock ? () => clock().toISOString() : undefined
  );

  return Object.freeze({
    async read(): Promise<Readonly<CoreCognitiveReadProjectionV1>> {
      try {
        const [brainProjection, improvementProjection] = await Promise.all([
          brain.read(),
          methodImprovements.read()
        ]);
        return Object.freeze({
          ...brainProjection,
          methodImprovements: improvementProjection.methodImprovements,
          brainBuildRuns: improvementProjection.brainBuildRuns,
          summary: Object.freeze({
            ...brainProjection.summary,
            ...improvementProjection.summary
          })
        });
      } catch (error) {
        if (error instanceof MethodImprovementCognitiveReadError)
          throw new BrainCognitiveReadError(
            'SOURCE_UNAVAILABLE',
            'Core Method Improvement cognitive source is unavailable.'
          );
        throw error;
      }
    }
  });
}
