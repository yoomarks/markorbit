import { createHash } from 'node:crypto';
import {
  assertTradingAssetClassificationV1,
  type TradingListingAssetId,
  type TradingListingAssetV1
} from '@markorbit/contracts/trading-asset-classification';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LISTING_ASSET_ID = /^listing-asset_[A-Za-z0-9_-]+$/u;

type Row = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);
const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const tradingListingAssetCurrentnessStatesV1 = [
  'CURRENT',
  'STALE',
  'NOT_FOUND',
  'UNKNOWN',
  'UNAVAILABLE'
] as const;
export type TradingListingAssetCurrentnessStateV1 =
  (typeof tradingListingAssetCurrentnessStatesV1)[number];

export interface TradingListingAssetCurrentnessV1 {
  schemaVersion: 1;
  workspaceId: string;
  listingAsset: Readonly<{ id: TradingListingAssetId; version: number }>;
  state: TradingListingAssetCurrentnessStateV1;
}

export type TradingListingAssetPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class TradingListingAssetPersistenceError extends Error {
  constructor(
    readonly code: TradingListingAssetPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TradingListingAssetPersistenceError';
  }
}

export interface SaveTradingListingAssetCommand {
  workspaceId: string;
  asset: Readonly<TradingListingAssetV1>;
  expectedVersion: number;
  idempotencyKey: string;
}

function workspaceId(value: string): string {
  if (!UUID.test(value))
    throw new TradingListingAssetPersistenceError(
      'INVALID_INPUT',
      'workspaceId must be a UUID.',
      400
    );
  return value.toLowerCase();
}

function listingAssetId(value: string): TradingListingAssetId {
  if (!LISTING_ASSET_ID.test(value))
    throw new TradingListingAssetPersistenceError(
      'INVALID_INPUT',
      'listingAssetId is invalid.',
      400
    );
  return value as TradingListingAssetId;
}

function required(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 300)
    throw new TradingListingAssetPersistenceError(
      'INVALID_INPUT',
      `${field} must contain 1 to 300 characters.`,
      400
    );
  return cleaned;
}

function nonNegativeVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TradingListingAssetPersistenceError(
      'INVALID_INPUT',
      'expectedVersion must be a non-negative integer.',
      400
    );
  return value;
}

function positiveVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new TradingListingAssetPersistenceError(
      'INVALID_INPUT',
      'version must be a positive integer.',
      400
    );
  return value;
}

function assertAssetInput(
  workspace: string,
  asset: Readonly<TradingListingAssetV1>,
  errorCode: 'INVALID_INPUT' | 'INTEGRITY_FAILURE'
): void {
  try {
    assertTradingAssetClassificationV1(asset);
    if (asset.classification !== 'LISTING_ASSET') throw new Error('Asset must be LISTING_ASSET.');
    listingAssetId(asset.listingAssetId);
    positiveVersion(asset.version);
    if (asset.contentClass === 'AI_CONCEPT' && asset.admission?.source.workspaceId !== workspace)
      throw new Error('AI Concept admission Workspace does not match the durable owner Workspace.');
  } catch (error) {
    throw new TradingListingAssetPersistenceError(
      errorCode,
      errorCode === 'INVALID_INPUT'
        ? 'Listing Asset contract or Workspace validation failed.'
        : 'Persisted Listing Asset failed integrity validation.',
      errorCode === 'INVALID_INPUT' ? 400 : 500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function parseAsset(workspace: string, value: unknown): TradingListingAssetV1 {
  const asset = clone(value as TradingListingAssetV1);
  assertAssetInput(workspace, asset, 'INTEGRITY_FAILURE');
  return asset;
}

export class PostgresTradingListingAssetStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async saveAsset(
    command: Readonly<SaveTradingListingAssetCommand>
  ): Promise<TradingListingAssetV1> {
    const workspace = workspaceId(command.workspaceId);
    const asset = clone(command.asset);
    assertAssetInput(workspace, asset, 'INVALID_INPUT');
    const id = listingAssetId(asset.listingAssetId);
    const expected = nonNegativeVersion(command.expectedVersion);
    if (asset.version !== expected + 1)
      throw new TradingListingAssetPersistenceError(
        'VERSION_CONFLICT',
        'Listing Asset version must immediately follow expectedVersion.'
      );
    const idempotencyKey = required(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint({
      workspaceId: workspace,
      asset,
      expectedVersion: expected
    });

    return this.persist(async (client) => {
      await this.lock(client, workspace, id);
      const replay = await this.replay(client, workspace, idempotencyKey, requestFingerprint);
      if (replay) return replay;

      const actual = await this.latestVersion(client, workspace, id);
      if (actual !== expected)
        throw new TradingListingAssetPersistenceError(
          'VERSION_CONFLICT',
          `Expected Listing Asset version ${expected}, found ${actual}.`
        );

      await client.query(
        `INSERT INTO lite_trading_listing_asset_versions(
           workspace_id,listing_asset_id,version,idempotency_key,
           request_fingerprint_sha256,document_json,recorded_at
         ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [
          workspace,
          id,
          asset.version,
          idempotencyKey,
          requestFingerprint,
          JSON.stringify(asset),
          new Date(this.now()).toISOString()
        ]
      );
      return clone(asset);
    });
  }

  async getAssetVersion(
    workspaceIdValue: string,
    listingAssetIdValue: TradingListingAssetId,
    version: number
  ): Promise<TradingListingAssetV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = listingAssetId(listingAssetIdValue);
    positiveVersion(version);
    return this.readExact(
      workspace,
      `SELECT document_json FROM lite_trading_listing_asset_versions
        WHERE workspace_id=$1 AND listing_asset_id=$2 AND version=$3`,
      [workspace, id, version]
    );
  }

  async resolveCurrentness(
    workspaceIdValue: string,
    listingAssetIdValue: TradingListingAssetId,
    version: number
  ): Promise<TradingListingAssetCurrentnessV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = listingAssetId(listingAssetIdValue);
    positiveVersion(version);
    const result = (state: TradingListingAssetCurrentnessStateV1) => ({
      schemaVersion: 1 as const,
      workspaceId: workspace,
      listingAsset: { id, version },
      state
    });

    try {
      const queryResult = await this.query.query(
        `SELECT document_json,
                (SELECT max(version) FROM lite_trading_listing_asset_versions
                  WHERE workspace_id=$1 AND listing_asset_id=$2) AS latest_version
           FROM lite_trading_listing_asset_versions
          WHERE workspace_id=$1 AND listing_asset_id=$2 AND version=$3`,
        [workspace, id, version]
      );
      const row = queryResult.rows[0] as Row | undefined;
      if (!row) return result('NOT_FOUND');
      try {
        parseAsset(workspace, row.document_json);
      } catch (error) {
        if (
          error instanceof TradingListingAssetPersistenceError &&
          error.code === 'INTEGRITY_FAILURE'
        )
          return result('UNKNOWN');
        throw error;
      }
      const latest = Number(row.latest_version);
      if (!Number.isSafeInteger(latest) || latest < version) return result('UNKNOWN');
      return result(latest === version ? 'CURRENT' : 'STALE');
    } catch (error) {
      if (error instanceof TradingListingAssetPersistenceError && error.code === 'INVALID_INPUT')
        throw error;
      return result('UNAVAILABLE');
    }
  }

  private async replay(
    client: QueryClient,
    workspace: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<TradingListingAssetV1 | undefined> {
    const result = await client.query(
      `SELECT request_fingerprint_sha256,document_json
         FROM lite_trading_listing_asset_versions
        WHERE workspace_id=$1 AND idempotency_key=$2`,
      [workspace, idempotencyKey]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return undefined;
    if (row.request_fingerprint_sha256 !== requestFingerprint)
      throw new TradingListingAssetPersistenceError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used for a different Listing Asset mutation.'
      );
    return parseAsset(workspace, row.document_json);
  }

  private async latestVersion(
    client: QueryClient,
    workspace: string,
    id: TradingListingAssetId
  ): Promise<number> {
    const result = await client.query(
      `SELECT version FROM lite_trading_listing_asset_versions
        WHERE workspace_id=$1 AND listing_asset_id=$2 ORDER BY version DESC LIMIT 1`,
      [workspace, id]
    );
    return result.rows[0] ? Number((result.rows[0] as Row).version) : 0;
  }

  private async lock(
    client: QueryClient,
    workspace: string,
    id: TradingListingAssetId
  ): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `${workspace}:trading-listing-asset:${id}`
    ]);
  }

  private async readExact(
    workspace: string,
    sql: string,
    params: readonly unknown[]
  ): Promise<TradingListingAssetV1> {
    try {
      const result = await this.query.query(sql, [...params]);
      const row = result.rows[0] as Row | undefined;
      if (!row)
        throw new TradingListingAssetPersistenceError(
          'NOT_FOUND',
          'Listing Asset version was not found.',
          404
        );
      return parseAsset(workspace, row.document_json);
    } catch (error) {
      if (error instanceof TradingListingAssetPersistenceError) throw error;
      throw new TradingListingAssetPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Trading Listing Asset persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  private async persist<T>(operation: (client: QueryClient) => Promise<T>): Promise<T> {
    try {
      return await this.database.transact(operation);
    } catch (error) {
      if (error instanceof TradingListingAssetPersistenceError) throw error;
      throw new TradingListingAssetPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Trading Listing Asset persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
