import { parseBrainAssetVersion, type BrainAssetVersion } from '@markorbit/contracts/brain';
import type { ManagedDatabase } from '@markorbit/persistence';
import { BrainAssetRegistryError } from './brain-asset-registry.js';
import {
  BrainCognitiveReadServiceV1,
  type BrainAssetCurrentReadAuthority
} from './brain-cognitive-read.js';
import { PostgresBrainGapRegistry } from './brain-gap-registry-postgres.js';

type AssetRow = { asset_json: unknown };

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
): BrainCognitiveReadServiceV1 {
  return new BrainCognitiveReadServiceV1(
    new PostgresBrainAssetCurrentReadAuthority(database),
    new PostgresBrainGapRegistry(database),
    clock
  );
}
