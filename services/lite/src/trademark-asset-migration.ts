import type {
  TrademarkAssetBulkImportItemResult,
  TrademarkAssetBulkImportResult
} from '@markorbit/contracts/trademark-asset-portfolio';
import type { BulkImportTrademarkAssetsInput } from './trademark-asset-portfolio.js';

type BulkInput = BulkImportTrademarkAssetsInput;
type BulkResult = TrademarkAssetBulkImportResult;
type ChunkResult = Readonly<BulkResult>;
type MigrationErrorCode = 'INVALID_INPUT' | 'OWNER_RESULT_INVALID';
type BulkItemResultWithoutIndex = Omit<TrademarkAssetBulkImportItemResult, 'importIndex'>;

export const MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS = 50_000;
const TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE = 100;
const MAX_MIGRATION_KEY_LENGTH = 260;

export type TrademarkAssetMigrationAdmissionItem = BulkInput['items'][number];

export interface LargeTrademarkAssetMigrationInput {
  workspaceId: string;
  migrationKey: string;
  items: ReadonlyArray<TrademarkAssetMigrationAdmissionItem>;
}

type MigrationInput = Readonly<LargeTrademarkAssetMigrationInput>;

export interface LargeTrademarkAssetMigrationItemResult extends BulkItemResultWithoutIndex {
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

type MigrationResult = LargeTrademarkAssetMigrationResult;

export interface TrademarkAssetBulkImporter {
  bulkImport(input: Readonly<BulkInput>): Promise<BulkResult>;
}

export class TrademarkAssetMigrationOrchestrationError extends Error {
  constructor(
    readonly code: MigrationErrorCode,
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

function validateInput(input: MigrationInput): string {
  const tooFew = input.items.length < 1;
  const tooMany = input.items.length > MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS;
  if (tooFew || tooMany) {
    throw new TrademarkAssetMigrationOrchestrationError(
      'INVALID_INPUT',
      `large trademark asset migration requires between 1 and ${MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS} normalized assets.`
    );
  }
  return cleanMigrationKey(input.migrationKey);
}

function hasExpectedIndices(result: ChunkResult, total: number): boolean {
  const indices = new Set<number>();
  for (const item of result.items) {
    const index = item.importIndex;
    const validIndex = Number.isInteger(index) && index >= 0 && index < total;
    if (!validIndex) return false;
    indices.add(index);
  }
  return indices.size === total;
}

function assertChunkResult(result: ChunkResult, workspaceId: string, total: number): void {
  const counted = result.created + result.duplicates + result.rejected;
  const ownerMatches = result.workspaceId === workspaceId;
  const totalsMatch = result.total === total && result.items.length === total;
  const countedMatch = counted === total;
  const indicesMatch = hasExpectedIndices(result, total);
  const countsSafe = totalsMatch && countedMatch && indicesMatch;
  const officialTruthSafe = result.officialTruthVerifiedByLite === false;
  const matterSafe = result.matterCreatedAutomatically === false;
  const valid = ownerMatches && countsSafe && officialTruthSafe && matterSafe;

  if (!valid) {
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
  async migrate(input: MigrationInput): Promise<MigrationResult> {
    const migrationKey = validateInput(input);
    const items: LargeTrademarkAssetMigrationItemResult[] = [];
    let created = 0;
    let duplicates = 0;
    let rejected = 0;
    let chunkCount = 0;
    let startIndex = 0;

    while (startIndex < input.items.length) {
      const endIndex = startIndex + TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE;
      const chunk = input.items.slice(startIndex, endIndex);
      const chunkIndex = Math.floor(startIndex / TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE);
      const batchKey = `${migrationKey}:chunk:${chunkIndex}`;
      const result = await this.portfolio.bulkImport({
        workspaceId: input.workspaceId,
        batchKey,
        items: chunk
      });

      assertChunkResult(result, input.workspaceId, chunk.length);
      chunkCount += 1;
      created += result.created;
      duplicates += result.duplicates;
      rejected += result.rejected;
      for (const item of result.items) {
        items.push({ ...item, importIndex: startIndex + item.importIndex });
      }
      startIndex += TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE;
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
