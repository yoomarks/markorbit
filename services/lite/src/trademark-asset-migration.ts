import type {
  TrademarkAssetBulkImportItemResult,
  TrademarkAssetBulkImportResult
} from '@markorbit/contracts/trademark-asset-portfolio';
import type { BulkImportTrademarkAssetsInput } from './trademark-asset-portfolio.js';

export const MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS = 50_000;
const TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE = 100;
const MAX_MIGRATION_KEY_LENGTH = 260;

export type TrademarkAssetMigrationAdmissionItem =
  BulkImportTrademarkAssetsInput['items'][number];

export interface LargeTrademarkAssetMigrationInput {
  workspaceId: string;
  migrationKey: string;
  items: ReadonlyArray<TrademarkAssetMigrationAdmissionItem>;
}

export interface LargeTrademarkAssetMigrationItemResult
  extends Omit<TrademarkAssetBulkImportItemResult, 'importIndex'> {
  /** Stable zero-based index in the caller's complete normalized migration input. */
  importIndex: number;
}

export interface LargeTrademarkAssetMigrationResult {
  schemaVersion: 1;
  workspaceId: string;
  migrationKey: string;
  total: number;
  created: number;
  duplicates: number;
  rejected: number;
  chunkCount: number;
  items: ReadonlyArray<Readonly<LargeTrademarkAssetMigrationItemResult>>;
  officialTruthVerifiedByLite: false;
  matterCreatedAutomatically: false;
}

export interface TrademarkAssetBulkImporter {
  bulkImport(
    input: Readonly<BulkImportTrademarkAssetsInput>
  ): Promise<TrademarkAssetBulkImportResult>;
}

export class TrademarkAssetMigrationOrchestrationError extends Error {
  constructor(
    readonly code: 'INVALID_INPUT' | 'OWNER_RESULT_INVALID',
    message: string
  ) {
    super(message);
    this.name = 'TrademarkAssetMigrationOrchestrationError';
  }
}

function cleanMigrationKey(value: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > MAX_MIGRATION_KEY_LENGTH) {
    throw new TrademarkAssetMigrationOrchestrationError(
      'INVALID_INPUT',
      `migrationKey must be a non-empty string of at most ${MAX_MIGRATION_KEY_LENGTH} characters.`
    );
  }
  return cleaned;
}

function validateInput(input: Readonly<LargeTrademarkAssetMigrationInput>): string {
  if (input.items.length < 1 || input.items.length > MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS) {
    throw new TrademarkAssetMigrationOrchestrationError(
      'INVALID_INPUT',
      `large trademark asset migration requires between 1 and ${MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS} normalized assets.`
    );
  }
  return cleanMigrationKey(input.migrationKey);
}

function assertChunkResult(
  result: Readonly<TrademarkAssetBulkImportResult>,
  expectedWorkspaceId: string,
  expectedTotal: number
): void {
  const counted = result.created + result.duplicates + result.rejected;
  const indices = new Set(result.items.map((item) => item.importIndex));
  const hasExpectedIndices =
    indices.size === expectedTotal &&
    result.items.every(
      (item) => Number.isInteger(item.importIndex) && item.importIndex >= 0 && item.importIndex < expectedTotal
    );

  if (
    result.workspaceId !== expectedWorkspaceId ||
    result.total !== expectedTotal ||
    result.items.length !== expectedTotal ||
    counted !== expectedTotal ||
    !hasExpectedIndices ||
    result.officialTruthVerifiedByLite !== false ||
    result.matterCreatedAutomatically !== false
  ) {
    throw new TrademarkAssetMigrationOrchestrationError(
      'OWNER_RESULT_INVALID',
      'Trademark Asset bulk-import owner returned an inconsistent chunk result.'
    );
  }
}

/**
 * Owner-local orchestration for large already-normalized Trademark Asset migrations.
 *
 * Every actual Asset admission remains owned by TrademarkAssetPortfolioService.bulkImport().
 * This layer only partitions, delegates and aggregates; it owns no durable Asset/Matter truth.
 */
export class TrademarkAssetMigrationOrchestrator {
  constructor(private readonly portfolio: TrademarkAssetBulkImporter) {}

  async migrate(
    input: Readonly<LargeTrademarkAssetMigrationInput>
  ): Promise<LargeTrademarkAssetMigrationResult> {
    const migrationKey = validateInput(input);
    const items: LargeTrademarkAssetMigrationItemResult[] = [];
    let created = 0;
    let duplicates = 0;
    let rejected = 0;
    let chunkCount = 0;

    for (
      let startIndex = 0;
      startIndex < input.items.length;
      startIndex += TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE
    ) {
      const chunk = input.items.slice(startIndex, startIndex + TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE);
      const chunkIndex = Math.floor(startIndex / TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE);
      const result = await this.portfolio.bulkImport({
        workspaceId: input.workspaceId,
        batchKey: `${migrationKey}:chunk:${chunkIndex}`,
        items: chunk
      });

      assertChunkResult(result, input.workspaceId, chunk.length);
      chunkCount += 1;
      created += result.created;
      duplicates += result.duplicates;
      rejected += result.rejected;
      items.push(
        ...result.items.map((item) => ({
          ...item,
          importIndex: startIndex + item.importIndex
        }))
      );
    }

    return {
      schemaVersion: 1,
      workspaceId: input.workspaceId,
      migrationKey,
      total: items.length,
      created,
      duplicates,
      rejected,
      chunkCount,
      items,
      officialTruthVerifiedByLite: false,
      matterCreatedAutomatically: false
    };
  }
}
