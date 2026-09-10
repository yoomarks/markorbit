import { createHash } from 'node:crypto';
import type {
  TrademarkAssetBulkImportItemResult,
  TrademarkAssetBulkImportResult
} from '@markorbit/contracts/trademark-asset-portfolio';
import type { BulkImportTrademarkAssetsInput } from './trademark-asset-portfolio.js';

type BulkInput = BulkImportTrademarkAssetsInput;
type BulkResult = TrademarkAssetBulkImportResult;
type ChunkResult = Readonly<BulkResult>;
type MigrationErrorCode =
  | 'INVALID_INPUT'
  | 'OWNER_RESULT_INVALID'
  | 'PREVIEW_REQUIRED'
  | 'RUN_MISMATCH'
  | 'OWNER_INTERRUPTED';
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
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
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

export interface ReviewableTrademarkAssetMigrationRow {
  rowKey: string;
  item: TrademarkAssetMigrationAdmissionItem;
}

export interface ReviewableTrademarkAssetMigrationInput {
  workspaceId: string;
  migrationKey: string;
  rows: ReadonlyArray<Readonly<ReviewableTrademarkAssetMigrationRow>>;
}

export type TrademarkAssetMigrationRunStatus =
  'PREVIEWED' | 'COMMITTING' | 'INTERRUPTED' | 'COMPLETED';

export interface TrademarkAssetMigrationPreview {
  schemaVersion: 1;
  workspaceId: string;
  migrationKey: string;
  fingerprint: string;
  total: number;
  chunkCount: number;
  chunks: ReadonlyArray<
    Readonly<{
      chunkIndex: number;
      startIndex: number;
      endExclusive: number;
      rowKeys: readonly string[];
    }>
  >;
  rows: ReadonlyArray<Readonly<{ rowKey: string; importIndex: number }>>;
  officialTruthVerifiedByLite: false;
  matterCreatedAutomatically: false;
}

export interface ReviewableTrademarkAssetMigrationItemResult extends BulkItemResultWithoutIndex {
  rowKey: string;
  importIndex: number;
}

export interface ReviewableTrademarkAssetMigrationResult {
  schemaVersion: 1;
  workspaceId: string;
  migrationKey: string;
  fingerprint: string;
  total: number;
  created: number;
  duplicates: number;
  rejected: number;
  chunkCount: number;
  items: ReadonlyArray<Readonly<ReviewableTrademarkAssetMigrationItemResult>>;
  officialTruthVerifiedByLite: false;
  matterCreatedAutomatically: false;
}

export interface TrademarkAssetMigrationRunSnapshot extends ReviewableTrademarkAssetMigrationResult {
  status: TrademarkAssetMigrationRunStatus;
  nextChunkIndex: number;
  rowKeys: readonly string[];
  updatedAt: string;
}

export interface TrademarkAssetMigrationRunStore {
  load(
    workspaceId: string,
    migrationKey: string
  ): Promise<Readonly<TrademarkAssetMigrationRunSnapshot> | undefined>;
  save(snapshot: Readonly<TrademarkAssetMigrationRunSnapshot>): Promise<void>;
}

export class InMemoryTrademarkAssetMigrationRunStore implements TrademarkAssetMigrationRunStore {
  private readonly rows = new Map<string, TrademarkAssetMigrationRunSnapshot>();

  load(
    workspaceId: string,
    migrationKey: string
  ): Promise<Readonly<TrademarkAssetMigrationRunSnapshot> | undefined> {
    const snapshot = this.rows.get(`${workspaceId}\u0000${migrationKey}`);
    return Promise.resolve(snapshot ? structuredClone(snapshot) : undefined);
  }

  save(snapshot: Readonly<TrademarkAssetMigrationRunSnapshot>): Promise<void> {
    this.rows.set(
      `${snapshot.workspaceId}\u0000${snapshot.migrationKey}`,
      structuredClone(snapshot)
    );
    return Promise.resolve();
  }
}

export class TrademarkAssetMigrationInterruptedError extends TrademarkAssetMigrationOrchestrationError {
  constructor(
    readonly progress: Readonly<TrademarkAssetMigrationRunSnapshot>,
    readonly retryable: boolean,
    options?: ErrorOptions
  ) {
    super(
      'OWNER_INTERRUPTED',
      'Trademark Asset migration was interrupted before all reviewed rows were admitted.',
      options
    );
    this.name = 'TrademarkAssetMigrationInterruptedError';
  }
}

type NormalizedReviewInput = Readonly<{
  workspaceId: string;
  migrationKey: string;
  rows: ReadonlyArray<Readonly<ReviewableTrademarkAssetMigrationRow>>;
  fingerprint: string;
  chunkCount: number;
}>;

const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MIGRATION_ROW_KEY_LENGTH = 500;

function migrationChunkCount(total: number): number {
  return Math.ceil(total / TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE);
}

function canonicalFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalFingerprintValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalFingerprintValue(item)])
    );
  }
  return value;
}

function reviewFingerprint(
  workspaceId: string,
  migrationKey: string,
  rows: ReadonlyArray<Readonly<ReviewableTrademarkAssetMigrationRow>>
): string {
  const payload = canonicalFingerprintValue({
    workspaceId,
    migrationKey,
    rows: rows.map((row) => ({ rowKey: row.rowKey, item: row.item }))
  });
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function validateReviewInput(
  input: Readonly<ReviewableTrademarkAssetMigrationInput>
): NormalizedReviewInput {
  if (!WORKSPACE_UUID.test(input.workspaceId)) {
    throw new TrademarkAssetMigrationOrchestrationError(
      'INVALID_INPUT',
      'workspaceId must be a UUID.'
    );
  }
  if (input.rows.length < 1 || input.rows.length > MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS) {
    throw new TrademarkAssetMigrationOrchestrationError(
      'INVALID_INPUT',
      `reviewable trademark asset migration requires between 1 and ${MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS} normalized rows.`
    );
  }
  const migrationKey = cleanMigrationKey(input.migrationKey);
  const seen = new Set<string>();
  const rows = input.rows.map((row) => {
    const rowKey = row.rowKey.trim();
    if (!rowKey || rowKey.length > MAX_MIGRATION_ROW_KEY_LENGTH || seen.has(rowKey)) {
      throw new TrademarkAssetMigrationOrchestrationError(
        'INVALID_INPUT',
        `rowKey must be unique and contain 1 to ${MAX_MIGRATION_ROW_KEY_LENGTH} characters.`
      );
    }
    seen.add(rowKey);
    return Object.freeze({ rowKey, item: row.item });
  });
  const workspaceId = input.workspaceId.toLowerCase();
  return Object.freeze({
    workspaceId,
    migrationKey,
    rows: Object.freeze(rows),
    fingerprint: reviewFingerprint(workspaceId, migrationKey, rows),
    chunkCount: migrationChunkCount(rows.length)
  });
}

function canonicalRunTimestamp(now: () => string): string {
  const value = new Date(now());
  if (Number.isNaN(value.getTime())) {
    throw new TrademarkAssetMigrationOrchestrationError(
      'INVALID_INPUT',
      'migration run clock must return a valid timestamp.'
    );
  }
  return value.toISOString();
}

function assertMatchingRun(
  current: Readonly<TrademarkAssetMigrationRunSnapshot>,
  input: NormalizedReviewInput
): void {
  const matches =
    current.workspaceId === input.workspaceId &&
    current.migrationKey === input.migrationKey &&
    current.fingerprint === input.fingerprint &&
    current.total === input.rows.length &&
    current.chunkCount === input.chunkCount &&
    current.rowKeys.length === input.rows.length &&
    current.rowKeys.every((rowKey, index) => rowKey === input.rows[index]?.rowKey);
  if (!matches) {
    throw new TrademarkAssetMigrationOrchestrationError(
      'RUN_MISMATCH',
      'migrationKey is already bound to a different reviewed row set or ordering.'
    );
  }
}

function previewFrom(input: NormalizedReviewInput): Readonly<TrademarkAssetMigrationPreview> {
  return Object.freeze({
    schemaVersion: 1,
    workspaceId: input.workspaceId,
    migrationKey: input.migrationKey,
    fingerprint: input.fingerprint,
    total: input.rows.length,
    chunkCount: input.chunkCount,
    chunks: Object.freeze(
      Array.from({ length: input.chunkCount }, (_, chunkIndex) => {
        const startIndex = chunkIndex * TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE;
        const endExclusive = Math.min(
          startIndex + TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE,
          input.rows.length
        );
        return Object.freeze({
          chunkIndex,
          startIndex,
          endExclusive,
          rowKeys: Object.freeze(
            input.rows.slice(startIndex, endExclusive).map((row) => row.rowKey)
          )
        });
      })
    ),
    rows: Object.freeze(
      input.rows.map((row, importIndex) => Object.freeze({ rowKey: row.rowKey, importIndex }))
    ),
    officialTruthVerifiedByLite: false,
    matterCreatedAutomatically: false
  });
}

function emptyRunSnapshot(
  input: NormalizedReviewInput,
  updatedAt: string
): Readonly<TrademarkAssetMigrationRunSnapshot> {
  return Object.freeze({
    schemaVersion: 1,
    workspaceId: input.workspaceId,
    migrationKey: input.migrationKey,
    fingerprint: input.fingerprint,
    status: 'PREVIEWED',
    total: input.rows.length,
    created: 0,
    duplicates: 0,
    rejected: 0,
    chunkCount: input.chunkCount,
    nextChunkIndex: 0,
    rowKeys: Object.freeze(input.rows.map((row) => row.rowKey)),
    items: Object.freeze([]),
    officialTruthVerifiedByLite: false,
    matterCreatedAutomatically: false,
    updatedAt
  });
}

function reviewResult(
  snapshot: Readonly<TrademarkAssetMigrationRunSnapshot>
): Readonly<ReviewableTrademarkAssetMigrationResult> {
  return Object.freeze({
    schemaVersion: 1,
    workspaceId: snapshot.workspaceId,
    migrationKey: snapshot.migrationKey,
    fingerprint: snapshot.fingerprint,
    total: snapshot.total,
    created: snapshot.created,
    duplicates: snapshot.duplicates,
    rejected: snapshot.rejected,
    chunkCount: snapshot.chunkCount,
    items: Object.freeze(snapshot.items.map((item) => Object.freeze({ ...item }))),
    officialTruthVerifiedByLite: false,
    matterCreatedAutomatically: false
  });
}

function ownerFailureRetryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { retryable?: unknown; status?: unknown };
  return (
    value.retryable === true ||
    (typeof value.status === 'number' && value.status >= 500 && value.status <= 599)
  );
}

/**
 * Owner-local orchestration for large already-normalized Trademark Asset migrations.
 *
 * Every actual Asset admission remains owned by TrademarkAssetPortfolioService.bulkImport().
 * This layer only partitions, delegates and aggregates; it owns no durable Asset/Matter truth.
 */
export class TrademarkAssetMigrationOrchestrator {
  constructor(
    private readonly portfolio: TrademarkAssetBulkImporter,
    private readonly runStore: TrademarkAssetMigrationRunStore = new InMemoryTrademarkAssetMigrationRunStore(),
    private readonly now: () => string = () => new Date().toISOString()
  ) {}
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

  async preview(
    input: Readonly<ReviewableTrademarkAssetMigrationInput>
  ): Promise<Readonly<TrademarkAssetMigrationPreview>> {
    const normalized = validateReviewInput(input);
    const current = await this.runStore.load(normalized.workspaceId, normalized.migrationKey);
    if (current) {
      assertMatchingRun(current, normalized);
      return previewFrom(normalized);
    }
    await this.runStore.save(emptyRunSnapshot(normalized, canonicalRunTimestamp(this.now)));
    return previewFrom(normalized);
  }

  async progress(
    workspaceId: string,
    migrationKey: string
  ): Promise<Readonly<TrademarkAssetMigrationRunSnapshot> | undefined> {
    const key = cleanMigrationKey(migrationKey);
    const normalizedWorkspaceId = workspaceId.toLowerCase();
    if (!WORKSPACE_UUID.test(normalizedWorkspaceId)) {
      throw new TrademarkAssetMigrationOrchestrationError(
        'INVALID_INPUT',
        'workspaceId must be a UUID.'
      );
    }
    return this.runStore.load(normalizedWorkspaceId, key);
  }

  async commit(
    input: Readonly<ReviewableTrademarkAssetMigrationInput>
  ): Promise<Readonly<ReviewableTrademarkAssetMigrationResult>> {
    const normalized = validateReviewInput(input);
    let current: Readonly<TrademarkAssetMigrationRunSnapshot> | undefined =
      await this.runStore.load(normalized.workspaceId, normalized.migrationKey);
    if (!current) {
      throw new TrademarkAssetMigrationOrchestrationError(
        'PREVIEW_REQUIRED',
        'migration must be previewed before commit.'
      );
    }
    assertMatchingRun(current, normalized);
    if (current.status === 'COMPLETED') return reviewResult(current);

    current = Object.freeze({
      ...current,
      status: 'COMMITTING' as const,
      updatedAt: canonicalRunTimestamp(this.now)
    });
    await this.runStore.save(current);

    while (current.nextChunkIndex < current.chunkCount) {
      const chunkIndex: number = current.nextChunkIndex;
      const startIndex: number = chunkIndex * TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE;
      const rows = normalized.rows.slice(
        startIndex,
        startIndex + TRADEMARK_ASSET_MIGRATION_CHUNK_SIZE
      );
      try {
        const result = await this.portfolio.bulkImport({
          workspaceId: normalized.workspaceId,
          batchKey: `${normalized.migrationKey}:chunk:${chunkIndex}`,
          items: rows.map((row) => row.item)
        });
        assertChunkResult(result, normalized.workspaceId, rows.length);

        const imported: Readonly<ReviewableTrademarkAssetMigrationItemResult>[] = result.items.map(
          (item): Readonly<ReviewableTrademarkAssetMigrationItemResult> => {
            const globalIndex = startIndex + item.importIndex;
            const rowKey = normalized.rows[globalIndex]?.rowKey;
            if (!rowKey) {
              throw new TrademarkAssetMigrationOrchestrationError(
                'OWNER_RESULT_INVALID',
                'Trademark Asset bulk-import owner returned an unmappable item index.'
              );
            }
            return Object.freeze({ ...item, rowKey, importIndex: globalIndex });
          }
        );
        const nextChunkIndex: number = chunkIndex + 1;
        const status: TrademarkAssetMigrationRunStatus =
          nextChunkIndex === normalized.chunkCount ? 'COMPLETED' : 'COMMITTING';
        current = Object.freeze({
          ...current,
          status,
          nextChunkIndex,
          created: current.created + result.created,
          duplicates: current.duplicates + result.duplicates,
          rejected: current.rejected + result.rejected,
          items: Object.freeze([...current.items, ...imported]),
          updatedAt: canonicalRunTimestamp(this.now)
        });
        await this.runStore.save(current);
      } catch (error) {
        const interrupted = Object.freeze({
          ...current,
          status: 'INTERRUPTED' as const,
          updatedAt: canonicalRunTimestamp(this.now)
        });
        await this.runStore.save(interrupted);
        if (error instanceof TrademarkAssetMigrationOrchestrationError) throw error;
        throw new TrademarkAssetMigrationInterruptedError(
          interrupted,
          ownerFailureRetryable(error),
          { cause: error }
        );
      }
    }
    return reviewResult(current);
  }
}
