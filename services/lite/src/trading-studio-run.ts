import { createHash } from 'node:crypto';
import {
  assertTradingStudioRunV1,
  type TradingStudioRunV1
} from '@markorbit/contracts/trading-studio-run';
import type { TradingStandardStudioRunId } from '@markorbit/contracts/trading-studio-usage';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TradingStudioRunPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class TradingStudioRunPersistenceError extends Error {
  constructor(
    readonly code: TradingStudioRunPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TradingStudioRunPersistenceError';
  }
}

export interface SaveTradingStudioRunCommand {
  run: Readonly<TradingStudioRunV1>;
  expectedVersion: number;
  idempotencyKey: string;
}

type Row = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);
const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function workspaceId(value: string): string {
  if (!UUID.test(value))
    throw new TradingStudioRunPersistenceError('INVALID_INPUT', 'workspaceId must be a UUID.', 400);
  return value.toLowerCase();
}

function runId(value: string): TradingStandardStudioRunId {
  if (!/^standard-studio-run_[A-Za-z0-9_-]+$/u.test(value))
    throw new TradingStudioRunPersistenceError('INVALID_INPUT', 'studioRunId is invalid.', 400);
  return value as TradingStandardStudioRunId;
}

function required(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 300)
    throw new TradingStudioRunPersistenceError(
      'INVALID_INPUT',
      `${field} must contain 1 to 300 characters.`,
      400
    );
  return cleaned;
}

export class PostgresTradingStudioRunStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async save(command: Readonly<SaveTradingStudioRunCommand>): Promise<TradingStudioRunV1> {
    let run = clone(command.run);
    try {
      assertTradingStudioRunV1(run);
    } catch (error) {
      throw new TradingStudioRunPersistenceError(
        'INVALID_INPUT',
        'Studio Run contract validation failed.',
        400,
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    const workspace = workspaceId(run.workspaceId);
    run = { ...run, workspaceId: workspace };
    const studioRunId = runId(run.studioRunId);
    const idempotencyKey = required(command.idempotencyKey, 'idempotencyKey');
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0)
      throw new TradingStudioRunPersistenceError(
        'INVALID_INPUT',
        'expectedVersion must be a non-negative integer.',
        400
      );
    if (run.version !== command.expectedVersion + 1)
      throw new TradingStudioRunPersistenceError(
        'VERSION_CONFLICT',
        'Studio Run version must immediately follow expectedVersion.'
      );
    const requestFingerprint = fingerprint({ run, expectedVersion: command.expectedVersion });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspace}:trading-studio-run:${studioRunId}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,document_json
             FROM lite_trading_studio_run_versions
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspace, idempotencyKey]
        );
        const replayRow = replay.rows[0] as Row | undefined;
        if (replayRow) {
          if (replayRow.request_fingerprint_sha256 !== requestFingerprint)
            throw new TradingStudioRunPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Studio Run mutation.'
            );
          return clone(replayRow.document_json as TradingStudioRunV1);
        }

        const latest = await client.query(
          `SELECT version FROM lite_trading_studio_run_versions
            WHERE workspace_id=$1 AND studio_run_id=$2
            ORDER BY version DESC LIMIT 1`,
          [workspace, studioRunId]
        );
        const actualVersion = latest.rows[0] ? Number((latest.rows[0] as Row).version) : 0;
        if (actualVersion !== command.expectedVersion)
          throw new TradingStudioRunPersistenceError(
            'VERSION_CONFLICT',
            `Expected Studio Run version ${command.expectedVersion}, found ${actualVersion}.`
          );

        const asset = await client.query(
          `SELECT version FROM lite_trademark_assets
            WHERE workspace_id=$1 AND trademark_asset_id=$2`,
          [workspace, run.trademarkAsset.id]
        );
        const assetRow = asset.rows[0] as Row | undefined;
        if (!assetRow)
          throw new TradingStudioRunPersistenceError(
            'NOT_FOUND',
            'Referenced Trademark Asset was not found.',
            404
          );
        const assetVersion = Number(assetRow.version);
        if (assetVersion !== run.trademarkAsset.version)
          throw new TradingStudioRunPersistenceError(
            'VERSION_CONFLICT',
            `Expected Trademark Asset version ${run.trademarkAsset.version}, found ${assetVersion}.`
          );

        await client.query(
          `INSERT INTO lite_trading_studio_run_versions(
             workspace_id,studio_run_id,version,trademark_asset_id,status,currentness,
             checkpoint,idempotency_key,request_fingerprint_sha256,document_json,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
          [
            workspace,
            studioRunId,
            run.version,
            run.trademarkAsset.id,
            run.status,
            run.currentness,
            run.checkpoint,
            idempotencyKey,
            requestFingerprint,
            JSON.stringify(run),
            new Date(this.now()).toISOString()
          ]
        );
        return clone(run);
      });
    } catch (error) {
      if (error instanceof TradingStudioRunPersistenceError) throw error;
      throw new TradingStudioRunPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Trading Studio Run persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async getLatest(
    workspaceIdValue: string,
    studioRunIdValue: TradingStandardStudioRunId
  ): Promise<TradingStudioRunV1> {
    const workspace = workspaceId(workspaceIdValue);
    const studioRunId = runId(studioRunIdValue);
    try {
      const result = await this.query.query(
        `SELECT document_json FROM lite_trading_studio_run_versions
          WHERE workspace_id=$1 AND studio_run_id=$2
          ORDER BY version DESC LIMIT 1`,
        [workspace, studioRunId]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row)
        throw new TradingStudioRunPersistenceError('NOT_FOUND', 'Studio Run was not found.', 404);
      const run = clone(row.document_json as TradingStudioRunV1);
      assertTradingStudioRunV1(run);
      return run;
    } catch (error) {
      if (error instanceof TradingStudioRunPersistenceError) throw error;
      throw new TradingStudioRunPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Trading Studio Run persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
