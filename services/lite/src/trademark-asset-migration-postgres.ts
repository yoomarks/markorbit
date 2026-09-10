import type { QueryClient } from '@markorbit/persistence';
import type {
  TrademarkAssetMigrationRunSnapshot,
  TrademarkAssetMigrationRunStatus,
  TrademarkAssetMigrationRunStore
} from './trademark-asset-migration.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT = /^[0-9a-f]{64}$/;
const CHUNK_SIZE = 100;
const STATUSES: readonly TrademarkAssetMigrationRunStatus[] = [
  'PREVIEWED',
  'COMMITTING',
  'INTERRUPTED',
  'COMPLETED'
];
const ITEM_STATUSES = ['CREATED', 'DUPLICATE', 'REJECTED'] as const;
type Row = Record<string, unknown>;

export type TrademarkAssetMigrationRunPersistenceErrorCode =
  'INVALID_INPUT' | 'PERSISTENCE_CONFLICT' | 'CORRUPT_STATE' | 'PERSISTENCE_UNAVAILABLE';

export class TrademarkAssetMigrationRunPersistenceError extends Error {
  constructor(
    readonly code: TrademarkAssetMigrationRunPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TrademarkAssetMigrationRunPersistenceError';
  }
}

const clone = <T>(value: T): T => structuredClone(value);

function persistenceError(
  code: TrademarkAssetMigrationRunPersistenceErrorCode,
  message: string,
  status = 409,
  retryable = false,
  cause?: unknown
): TrademarkAssetMigrationRunPersistenceError {
  return new TrademarkAssetMigrationRunPersistenceError(code, message, status, retryable, {
    cause: cause instanceof Error ? cause : undefined
  });
}

function cleanWorkspaceId(value: string): string {
  if (!UUID.test(value)) {
    throw persistenceError('INVALID_INPUT', 'workspaceId must be a UUID.', 400);
  }
  return value.toLowerCase();
}

function cleanMigrationKey(value: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 260) {
    throw persistenceError(
      'INVALID_INPUT',
      'migrationKey must contain between 1 and 260 characters.',
      400
    );
  }
  return cleaned;
}

function integer(value: unknown, minimum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum;
}

function corrupt(message: string): TrademarkAssetMigrationRunPersistenceError {
  return persistenceError('CORRUPT_STATE', message, 500);
}

function assertSnapshotItems(
  row: Row,
  total: number,
  nextChunkIndex: number,
  rowKeys: readonly unknown[]
): void {
  const items = row.items;
  if (!Array.isArray(items)) throw corrupt('migration run items must be an array.');
  const expectedCompleted = Math.min(nextChunkIndex * CHUNK_SIZE, total);
  if (items.length !== expectedCompleted) {
    throw corrupt('migration run completed item count does not match chunk progress.');
  }
  const seen = new Set<number>();
  const allowedItemKeys = new Set([
    'rowKey',
    'importIndex',
    'status',
    'trademarkAssetId',
    'reason'
  ]);
  const statusCounts = { CREATED: 0, DUPLICATE: 0, REJECTED: 0 };
  for (const [position, value] of items.entries()) {
    if (!value || typeof value !== 'object') throw corrupt('migration run item is invalid.');
    const item = value as Row;
    const importIndex = item.importIndex;
    const rowKey = item.rowKey;
    const status = item.status;
    if (
      !integer(importIndex, 0) ||
      importIndex >= total ||
      seen.has(importIndex) ||
      importIndex !== position
    ) {
      throw corrupt('migration run item importIndex is invalid, duplicated or out of order.');
    }
    if (Object.keys(item).some((key) => !allowedItemKeys.has(key))) {
      throw corrupt('migration run item contains unsupported fields.');
    }
    if (
      item.trademarkAssetId !== undefined &&
      (typeof item.trademarkAssetId !== 'string' || !item.trademarkAssetId)
    ) {
      throw corrupt('migration run item trademarkAssetId is invalid.');
    }
    if (item.reason !== undefined && (typeof item.reason !== 'string' || !item.reason)) {
      throw corrupt('migration run item reason is invalid.');
    }
    if (typeof rowKey !== 'string' || rowKeys[importIndex] !== rowKey) {
      throw corrupt('migration run item rowKey does not match reviewed row ordering.');
    }
    if (
      typeof status !== 'string' ||
      !ITEM_STATUSES.includes(status as (typeof ITEM_STATUSES)[number])
    ) {
      throw corrupt('migration run item status is invalid.');
    }
    seen.add(importIndex);
    statusCounts[status as keyof typeof statusCounts] += 1;
  }
  for (let index = 0; index < expectedCompleted; index += 1) {
    if (!seen.has(index))
      throw corrupt('migration run completed items must form a contiguous prefix.');
  }
  if (
    statusCounts.CREATED !== Number(row.created) ||
    statusCounts.DUPLICATE !== Number(row.duplicates) ||
    statusCounts.REJECTED !== Number(row.rejected)
  ) {
    throw corrupt('migration run item statuses do not match aggregate counters.');
  }
}

function assertSnapshot(value: unknown): asserts value is TrademarkAssetMigrationRunSnapshot {
  if (!value || typeof value !== 'object')
    throw corrupt('migration run document must be an object.');
  const row = value as Row;
  const total = row.total;
  const chunkCount = row.chunkCount;
  const nextChunkIndex = row.nextChunkIndex;
  const created = row.created;
  const duplicates = row.duplicates;
  const rejected = row.rejected;
  const status = row.status;
  const rowKeys = row.rowKeys;
  if (!integer(total, 1) || total > 50_000) throw corrupt('migration run total is invalid.');
  if (!integer(chunkCount, 1) || chunkCount !== Math.ceil(total / CHUNK_SIZE)) {
    throw corrupt('migration run chunkCount is invalid.');
  }
  if (!integer(nextChunkIndex, 0) || nextChunkIndex > chunkCount) {
    throw corrupt('migration run nextChunkIndex is invalid.');
  }
  if (!integer(created, 0) || !integer(duplicates, 0) || !integer(rejected, 0)) {
    throw corrupt('migration run counters are invalid.');
  }
  if (created + duplicates + rejected !== Math.min(nextChunkIndex * CHUNK_SIZE, total)) {
    throw corrupt('migration run counters do not match completed chunk progress.');
  }
  if (!Array.isArray(rowKeys) || rowKeys.length !== total) {
    throw corrupt('migration run rowKeys are invalid.');
  }
  if (
    rowKeys.some((key) => typeof key !== 'string' || key.length < 1 || key.length > 500) ||
    new Set(rowKeys).size !== rowKeys.length
  ) {
    throw corrupt('migration run rowKeys must be unique non-empty strings.');
  }
  if (row.schemaVersion !== 1) throw corrupt('migration run schemaVersion is invalid.');
  if (typeof row.workspaceId !== 'string' || !UUID.test(row.workspaceId)) {
    throw corrupt('migration run workspaceId is invalid.');
  }
  if (
    typeof row.migrationKey !== 'string' ||
    row.migrationKey.trim() !== row.migrationKey ||
    row.migrationKey.length < 1 ||
    row.migrationKey.length > 260
  ) {
    throw corrupt('migration run migrationKey is invalid.');
  }
  if (typeof row.fingerprint !== 'string' || !FINGERPRINT.test(row.fingerprint)) {
    throw corrupt('migration run fingerprint is invalid.');
  }
  if (
    typeof status !== 'string' ||
    !STATUSES.includes(status as TrademarkAssetMigrationRunStatus)
  ) {
    throw corrupt('migration run status is invalid.');
  }
  if ((status === 'COMPLETED') !== (nextChunkIndex === chunkCount)) {
    throw corrupt('migration run completion status is inconsistent.');
  }
  if (status === 'PREVIEWED' && nextChunkIndex !== 0) {
    throw corrupt('previewed migration run cannot contain completed chunks.');
  }
  if (row.officialTruthVerifiedByLite !== false || row.matterCreatedAutomatically !== false) {
    throw corrupt('migration run authority flags are invalid.');
  }
  if (typeof row.updatedAt !== 'string' || Number.isNaN(Date.parse(row.updatedAt))) {
    throw corrupt('migration run updatedAt is invalid.');
  }
  assertSnapshotItems(row, total, nextChunkIndex, rowKeys);
}

function sameInstant(left: string, right: unknown): boolean {
  const rightDate = right instanceof Date ? right : new Date(String(right));
  return !Number.isNaN(rightDate.getTime()) && new Date(left).getTime() === rightDate.getTime();
}

function assertRowMatchesDocument(row: Row, snapshot: TrademarkAssetMigrationRunSnapshot): void {
  const matches =
    row.fingerprint_sha256 === snapshot.fingerprint &&
    row.status === snapshot.status &&
    Number(row.total) === snapshot.total &&
    Number(row.chunk_count) === snapshot.chunkCount &&
    Number(row.next_chunk_index) === snapshot.nextChunkIndex &&
    Number(row.created) === snapshot.created &&
    Number(row.duplicates) === snapshot.duplicates &&
    Number(row.rejected) === snapshot.rejected &&
    sameInstant(snapshot.updatedAt, row.updated_at);
  if (!matches) throw corrupt('migration run columns do not match document_json.');
}

function wrapPersistenceFailure(error: unknown): never {
  if (error instanceof TrademarkAssetMigrationRunPersistenceError) throw error;
  throw persistenceError(
    'PERSISTENCE_UNAVAILABLE',
    'Trademark Asset migration run persistence is unavailable.',
    503,
    true,
    error
  );
}

export class PostgresTrademarkAssetMigrationRunStore implements TrademarkAssetMigrationRunStore {
  constructor(private readonly query: QueryClient) {}
  async load(
    workspaceIdValue: string,
    migrationKeyValue: string
  ): Promise<Readonly<TrademarkAssetMigrationRunSnapshot> | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const migrationKey = cleanMigrationKey(migrationKeyValue);
    try {
      const result = await this.query.query(
        `SELECT fingerprint_sha256,status,total,chunk_count,next_chunk_index,
                created,duplicates,rejected,document_json,updated_at
           FROM lite_trademark_asset_migration_runs
          WHERE workspace_id=$1 AND migration_key=$2`,
        [workspaceId, migrationKey]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row) return undefined;
      const snapshot = clone(row.document_json);
      assertSnapshot(snapshot);
      if (snapshot.workspaceId !== workspaceId || snapshot.migrationKey !== migrationKey) {
        throw corrupt('migration run document key does not match persisted primary key.');
      }
      assertRowMatchesDocument(row, snapshot);
      return clone(snapshot);
    } catch (error) {
      wrapPersistenceFailure(error);
    }
  }

  async save(snapshotValue: Readonly<TrademarkAssetMigrationRunSnapshot>): Promise<void> {
    const snapshot = clone(snapshotValue);
    try {
      assertSnapshot(snapshot);
    } catch (error) {
      if (
        error instanceof TrademarkAssetMigrationRunPersistenceError &&
        error.code === 'CORRUPT_STATE'
      ) {
        throw persistenceError('INVALID_INPUT', error.message, 400, false, error);
      }
      throw error;
    }
    const workspaceId = cleanWorkspaceId(snapshot.workspaceId);
    const migrationKey = cleanMigrationKey(snapshot.migrationKey);
    if (snapshot.workspaceId !== workspaceId || snapshot.migrationKey !== migrationKey) {
      throw persistenceError(
        'INVALID_INPUT',
        'migration snapshot keys must already be normalized.',
        400
      );
    }

    try {
      const result = await this.query.query(
        `INSERT INTO lite_trademark_asset_migration_runs(
           workspace_id,migration_key,fingerprint_sha256,status,total,chunk_count,
           next_chunk_index,created,duplicates,rejected,document_json,updated_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
         ON CONFLICT (workspace_id,migration_key) DO UPDATE SET
           fingerprint_sha256=EXCLUDED.fingerprint_sha256,
           status=EXCLUDED.status,
           total=EXCLUDED.total,
           chunk_count=EXCLUDED.chunk_count,
           next_chunk_index=EXCLUDED.next_chunk_index,
           created=EXCLUDED.created,
           duplicates=EXCLUDED.duplicates,
           rejected=EXCLUDED.rejected,
           document_json=EXCLUDED.document_json,
           updated_at=EXCLUDED.updated_at
         WHERE lite_trademark_asset_migration_runs.fingerprint_sha256=EXCLUDED.fingerprint_sha256
           AND lite_trademark_asset_migration_runs.total=EXCLUDED.total
           AND lite_trademark_asset_migration_runs.chunk_count=EXCLUDED.chunk_count
           AND (lite_trademark_asset_migration_runs.document_json->'rowKeys')=(EXCLUDED.document_json->'rowKeys')
           AND EXCLUDED.updated_at>=lite_trademark_asset_migration_runs.updated_at
           AND EXCLUDED.next_chunk_index<=lite_trademark_asset_migration_runs.next_chunk_index+1
           AND (
             (
               lite_trademark_asset_migration_runs.next_chunk_index<EXCLUDED.next_chunk_index
               AND (EXCLUDED.document_json->'items') @> (lite_trademark_asset_migration_runs.document_json->'items')
             )
             OR (
               lite_trademark_asset_migration_runs.next_chunk_index=EXCLUDED.next_chunk_index
               AND lite_trademark_asset_migration_runs.created=EXCLUDED.created
               AND lite_trademark_asset_migration_runs.duplicates=EXCLUDED.duplicates
               AND lite_trademark_asset_migration_runs.rejected=EXCLUDED.rejected
               AND (lite_trademark_asset_migration_runs.document_json->'items')=(EXCLUDED.document_json->'items')
             )
           )
         RETURNING workspace_id`,
        [
          workspaceId,
          migrationKey,
          snapshot.fingerprint,
          snapshot.status,
          snapshot.total,
          snapshot.chunkCount,
          snapshot.nextChunkIndex,
          snapshot.created,
          snapshot.duplicates,
          snapshot.rejected,
          JSON.stringify(snapshot),
          snapshot.updatedAt
        ]
      );
      if (result.rowCount !== 1) {
        throw persistenceError(
          'PERSISTENCE_CONFLICT',
          'Migration run checkpoint conflicts with existing reviewed input or newer progress.'
        );
      }
    } catch (error) {
      wrapPersistenceFailure(error);
    }
  }
}
