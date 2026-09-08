import { createHash } from 'node:crypto';
import {
  assertTradingAiProfileV1,
  type TradingAiProfileId,
  type TradingAiProfileV1
} from '@markorbit/contracts/trading-ai-profile';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;

export type TradingAiProfilePersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class TradingAiProfilePersistenceError extends Error {
  constructor(
    readonly code: TradingAiProfilePersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TradingAiProfilePersistenceError';
  }
}

export interface SaveTradingAiProfileCommand {
  profile: Readonly<TradingAiProfileV1>;
  expectedVersion: number;
  idempotencyKey: string;
}

const clone = <T>(value: T): T => structuredClone(value);
const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function workspaceId(value: string): string {
  if (!UUID.test(value))
    throw new TradingAiProfilePersistenceError('INVALID_INPUT', 'workspaceId must be a UUID.', 400);
  return value.toLowerCase();
}

function profileId(value: string): TradingAiProfileId {
  if (!/^trading-ai-derived_ai-profile_[A-Za-z0-9_-]+$/u.test(value))
    throw new TradingAiProfilePersistenceError('INVALID_INPUT', 'aiProfileId is invalid.', 400);
  return value as TradingAiProfileId;
}

function key(value: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 300)
    throw new TradingAiProfilePersistenceError('INVALID_INPUT', 'idempotencyKey is invalid.', 400);
  return cleaned;
}

export class PostgresTradingAiProfileStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async save(command: Readonly<SaveTradingAiProfileCommand>): Promise<TradingAiProfileV1> {
    let profile = clone(command.profile);
    try {
      assertTradingAiProfileV1(profile);
    } catch (error) {
      throw new TradingAiProfilePersistenceError(
        'INVALID_INPUT',
        'AI Profile contract validation failed.',
        400,
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    const workspace = workspaceId(profile.workspaceId);
    profile = { ...profile, workspaceId: workspace };
    const id = profileId(profile.aiProfileId);
    const idempotencyKey = key(command.idempotencyKey);
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0)
      throw new TradingAiProfilePersistenceError(
        'INVALID_INPUT',
        'expectedVersion must be a non-negative integer.',
        400
      );
    if (profile.version !== command.expectedVersion + 1)
      throw new TradingAiProfilePersistenceError(
        'VERSION_CONFLICT',
        'AI Profile version must immediately follow expectedVersion.'
      );
    const requestFingerprint = fingerprint({ profile, expectedVersion: command.expectedVersion });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspace}:trading-ai-profile:${id}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,document_json
             FROM lite_trading_ai_profile_versions
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspace, idempotencyKey]
        );
        const replayRow = replay.rows[0] as Row | undefined;
        if (replayRow) {
          if (replayRow.request_fingerprint_sha256 !== requestFingerprint)
            throw new TradingAiProfilePersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was reused.'
            );
          return clone(replayRow.document_json as TradingAiProfileV1);
        }
        const latest = await client.query(
          `SELECT version FROM lite_trading_ai_profile_versions
            WHERE workspace_id=$1 AND ai_profile_id=$2 ORDER BY version DESC LIMIT 1`,
          [workspace, id]
        );
        const actualVersion = latest.rows[0] ? Number((latest.rows[0] as Row).version) : 0;
        if (actualVersion !== command.expectedVersion)
          throw new TradingAiProfilePersistenceError(
            'VERSION_CONFLICT',
            `Expected AI Profile version ${command.expectedVersion}, found ${actualVersion}.`
          );
        const asset = await client.query(
          'SELECT version FROM lite_trademark_assets WHERE workspace_id=$1 AND trademark_asset_id=$2',
          [workspace, profile.trademarkAsset.id]
        );
        const assetVersion = asset.rows[0] ? Number((asset.rows[0] as Row).version) : undefined;
        if (assetVersion === undefined)
          throw new TradingAiProfilePersistenceError(
            'NOT_FOUND',
            'Referenced Trademark Asset was not found.',
            404
          );
        if (assetVersion !== profile.trademarkAsset.version)
          throw new TradingAiProfilePersistenceError(
            'VERSION_CONFLICT',
            `Expected Trademark Asset version ${profile.trademarkAsset.version}, found ${assetVersion}.`
          );
        await client.query(
          `INSERT INTO lite_trading_ai_profile_versions(
             workspace_id,ai_profile_id,version,trademark_asset_id,trademark_asset_version,
             idempotency_key,request_fingerprint_sha256,document_json,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
          [
            workspace,
            id,
            profile.version,
            profile.trademarkAsset.id,
            profile.trademarkAsset.version,
            idempotencyKey,
            requestFingerprint,
            JSON.stringify(profile),
            new Date(this.now()).toISOString()
          ]
        );
        return clone(profile);
      });
    } catch (error) {
      if (error instanceof TradingAiProfilePersistenceError) throw error;
      throw new TradingAiProfilePersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'AI Profile persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async getExact(
    workspaceIdValue: string,
    aiProfileIdValue: TradingAiProfileId,
    version: number
  ): Promise<TradingAiProfileV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = profileId(aiProfileIdValue);
    if (!Number.isSafeInteger(version) || version < 1)
      throw new TradingAiProfilePersistenceError(
        'INVALID_INPUT',
        'AI Profile version must be positive.',
        400
      );
    try {
      const result = await this.query.query(
        `SELECT document_json FROM lite_trading_ai_profile_versions
          WHERE workspace_id=$1 AND ai_profile_id=$2 AND version=$3`,
        [workspace, id, version]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row)
        throw new TradingAiProfilePersistenceError(
          'NOT_FOUND',
          'AI Profile version was not found.',
          404
        );
      const profile = clone(row.document_json as TradingAiProfileV1);
      assertTradingAiProfileV1(profile);
      return profile;
    } catch (error) {
      if (error instanceof TradingAiProfilePersistenceError) throw error;
      throw new TradingAiProfilePersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'AI Profile persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
