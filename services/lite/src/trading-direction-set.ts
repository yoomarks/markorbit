import { createHash } from 'node:crypto';
import {
  assertTradingCommercialDirectionRefinementV1,
  assertTradingCommercialDirectionSetV1,
  type RefineTradingCommercialDirectionCommandV1,
  type TradingCommercialDirectionSetId,
  type TradingCommercialDirectionSetV1
} from '@markorbit/contracts/trading-commercial-direction';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;

export type TradingDirectionSetPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class TradingDirectionSetPersistenceError extends Error {
  constructor(
    readonly code: TradingDirectionSetPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TradingDirectionSetPersistenceError';
  }
}

export interface SaveTradingDirectionSetCommand {
  directionSet: Readonly<TradingCommercialDirectionSetV1>;
  expectedVersion: number;
  idempotencyKey: string;
}

const clone = <T>(value: T): T => structuredClone(value);
const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function workspaceId(value: string): string {
  if (!UUID.test(value))
    throw new TradingDirectionSetPersistenceError(
      'INVALID_INPUT',
      'workspaceId must be a UUID.',
      400
    );
  return value.toLowerCase();
}

function directionSetId(value: string): TradingCommercialDirectionSetId {
  if (!/^commercial-direction-set_[A-Za-z0-9_-]+$/u.test(value))
    throw new TradingDirectionSetPersistenceError(
      'INVALID_INPUT',
      'directionSetId is invalid.',
      400
    );
  return value as TradingCommercialDirectionSetId;
}

function key(value: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 300)
    throw new TradingDirectionSetPersistenceError(
      'INVALID_INPUT',
      'idempotencyKey is invalid.',
      400
    );
  return cleaned;
}

export class PostgresTradingDirectionSetStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async refine(
    command: Readonly<RefineTradingCommercialDirectionCommandV1>,
    refinedSet: Readonly<TradingCommercialDirectionSetV1>
  ): Promise<TradingCommercialDirectionSetV1> {
    let previousSet: TradingCommercialDirectionSetV1;
    try {
      previousSet = await this.getLatest(refinedSet.workspaceId, command.directionSetId);
      assertTradingCommercialDirectionRefinementV1(command, previousSet, refinedSet);
    } catch (error) {
      if (error instanceof TradingDirectionSetPersistenceError) throw error;
      throw new TradingDirectionSetPersistenceError(
        'INVALID_INPUT',
        'Direction refinement validation failed.',
        400,
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    return this.save({
      directionSet: refinedSet,
      expectedVersion: command.expectedDirectionSetVersion,
      idempotencyKey: command.idempotencyKey
    });
  }

  async save(
    command: Readonly<SaveTradingDirectionSetCommand>
  ): Promise<TradingCommercialDirectionSetV1> {
    let set = clone(command.directionSet);
    try {
      assertTradingCommercialDirectionSetV1(set);
    } catch (error) {
      throw new TradingDirectionSetPersistenceError(
        'INVALID_INPUT',
        'Direction Set validation failed.',
        400,
        false,
        {
          cause: error instanceof Error ? error : undefined
        }
      );
    }
    const workspace = workspaceId(set.workspaceId);
    set = { ...set, workspaceId: workspace };
    const setId = directionSetId(set.commercialDirectionSetId);
    const idempotencyKey = key(command.idempotencyKey);
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0)
      throw new TradingDirectionSetPersistenceError(
        'INVALID_INPUT',
        'expectedVersion is invalid.',
        400
      );
    if (set.version !== command.expectedVersion + 1)
      throw new TradingDirectionSetPersistenceError(
        'VERSION_CONFLICT',
        'Direction Set version must immediately follow expectedVersion.'
      );
    const requestFingerprint = fingerprint({ set, expectedVersion: command.expectedVersion });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspace}:trading-direction-set:${setId}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,document_json FROM lite_trading_direction_set_versions
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspace, idempotencyKey]
        );
        const replayRow = replay.rows[0] as Row | undefined;
        if (replayRow) {
          if (replayRow.request_fingerprint_sha256 !== requestFingerprint)
            throw new TradingDirectionSetPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was reused.'
            );
          return clone(replayRow.document_json as TradingCommercialDirectionSetV1);
        }

        const latest = await client.query(
          `SELECT version FROM lite_trading_direction_set_versions
            WHERE workspace_id=$1 AND direction_set_id=$2 ORDER BY version DESC LIMIT 1`,
          [workspace, setId]
        );
        const actualVersion = latest.rows[0] ? Number((latest.rows[0] as Row).version) : 0;
        if (actualVersion !== command.expectedVersion)
          throw new TradingDirectionSetPersistenceError(
            'VERSION_CONFLICT',
            `Expected version ${command.expectedVersion}, found ${actualVersion}.`
          );

        const run = await client.query(
          `SELECT trademark_asset_id,document_json FROM lite_trading_studio_run_versions
            WHERE workspace_id=$1 AND studio_run_id=$2 AND version=$3`,
          [workspace, set.studioRun.id, set.studioRun.version]
        );
        const runRow = run.rows[0] as Row | undefined;
        if (!runRow)
          throw new TradingDirectionSetPersistenceError(
            'NOT_FOUND',
            'Referenced Studio Run was not found.',
            404
          );
        const runDocument = runRow.document_json as {
          trademarkAsset?: { id?: string; version?: number };
        };
        if (
          runRow.trademark_asset_id !== set.trademarkAsset.id ||
          runDocument.trademarkAsset?.version !== set.trademarkAsset.version
        )
          throw new TradingDirectionSetPersistenceError(
            'VERSION_CONFLICT',
            'Studio Run Trademark Asset reference is stale.'
          );

        const asset = await client.query(
          'SELECT version FROM lite_trademark_assets WHERE workspace_id=$1 AND trademark_asset_id=$2',
          [workspace, set.trademarkAsset.id]
        );
        const assetVersion = asset.rows[0] ? Number((asset.rows[0] as Row).version) : undefined;
        if (assetVersion === undefined)
          throw new TradingDirectionSetPersistenceError(
            'NOT_FOUND',
            'Referenced Trademark Asset was not found.',
            404
          );
        if (assetVersion !== set.trademarkAsset.version)
          throw new TradingDirectionSetPersistenceError(
            'VERSION_CONFLICT',
            `Expected Trademark Asset version ${set.trademarkAsset.version}, found ${assetVersion}.`
          );

        await client.query(
          `INSERT INTO lite_trading_direction_set_versions(
             workspace_id,direction_set_id,version,studio_run_id,studio_run_version,
             trademark_asset_id,trademark_asset_version,idempotency_key,request_fingerprint_sha256,document_json,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
          [
            workspace,
            setId,
            set.version,
            set.studioRun.id,
            set.studioRun.version,
            set.trademarkAsset.id,
            set.trademarkAsset.version,
            idempotencyKey,
            requestFingerprint,
            JSON.stringify(set),
            new Date(this.now()).toISOString()
          ]
        );
        return clone(set);
      });
    } catch (error) {
      if (error instanceof TradingDirectionSetPersistenceError) throw error;
      throw new TradingDirectionSetPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Direction Set persistence is unavailable.',
        503,
        true,
        {
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }

  async getLatest(
    workspaceIdValue: string,
    directionSetIdValue: TradingCommercialDirectionSetId
  ): Promise<TradingCommercialDirectionSetV1> {
    const workspace = workspaceId(workspaceIdValue);
    const setId = directionSetId(directionSetIdValue);
    try {
      const result = await this.query.query(
        `SELECT document_json FROM lite_trading_direction_set_versions
          WHERE workspace_id=$1 AND direction_set_id=$2 ORDER BY version DESC LIMIT 1`,
        [workspace, setId]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row)
        throw new TradingDirectionSetPersistenceError(
          'NOT_FOUND',
          'Direction Set was not found.',
          404
        );
      const set = clone(row.document_json as TradingCommercialDirectionSetV1);
      assertTradingCommercialDirectionSetV1(set);
      return set;
    } catch (error) {
      if (error instanceof TradingDirectionSetPersistenceError) throw error;
      throw new TradingDirectionSetPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Direction Set persistence is unavailable.',
        503,
        true,
        {
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }

  async getExact(
    workspaceIdValue: string,
    directionSetIdValue: TradingCommercialDirectionSetId,
    version: number
  ): Promise<TradingCommercialDirectionSetV1> {
    const workspace = workspaceId(workspaceIdValue);
    const setId = directionSetId(directionSetIdValue);
    if (!Number.isSafeInteger(version) || version < 1)
      throw new TradingDirectionSetPersistenceError(
        'INVALID_INPUT',
        'Direction Set version must be a positive integer.',
        400
      );
    try {
      const result = await this.query.query(
        `SELECT document_json FROM lite_trading_direction_set_versions
          WHERE workspace_id=$1 AND direction_set_id=$2 AND version=$3`,
        [workspace, setId, version]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row)
        throw new TradingDirectionSetPersistenceError(
          'NOT_FOUND',
          'Direction Set version was not found.',
          404
        );
      const set = clone(row.document_json as TradingCommercialDirectionSetV1);
      assertTradingCommercialDirectionSetV1(set);
      return set;
    } catch (error) {
      if (error instanceof TradingDirectionSetPersistenceError) throw error;
      throw new TradingDirectionSetPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Direction Set persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
