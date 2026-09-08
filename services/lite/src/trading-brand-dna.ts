import { createHash } from 'node:crypto';
import {
  assertTradingBrandDnaV1,
  type TradingBrandDnaId,
  type TradingBrandDnaV1
} from '@markorbit/contracts/trading-brand-dna';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type TradingBrandDnaPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class TradingBrandDnaPersistenceError extends Error {
  constructor(
    readonly code: TradingBrandDnaPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TradingBrandDnaPersistenceError';
  }
}

export interface SaveTradingBrandDnaCommand {
  brandDna: Readonly<TradingBrandDnaV1>;
  expectedVersion: number;
  idempotencyKey: string;
}

const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same = (
  left: { id: string; version: string | number },
  right: { id: string; version: string | number }
) => left.id === right.id && left.version === right.version;

function workspace(value: string): string {
  if (!UUID.test(value))
    throw new TradingBrandDnaPersistenceError('INVALID_INPUT', 'workspaceId must be a UUID.', 400);
  return value.toLowerCase();
}

function dnaId(value: string): TradingBrandDnaId {
  if (!/^trading-ai-derived_brand-dna_[A-Za-z0-9_-]+$/u.test(value))
    throw new TradingBrandDnaPersistenceError('INVALID_INPUT', 'brandDnaId is invalid.', 400);
  return value as TradingBrandDnaId;
}

export class PostgresTradingBrandDnaStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async save(command: Readonly<SaveTradingBrandDnaCommand>): Promise<TradingBrandDnaV1> {
    let value = clone(command.brandDna);
    try {
      assertTradingBrandDnaV1(value);
    } catch (error) {
      throw new TradingBrandDnaPersistenceError(
        'INVALID_INPUT',
        'BrandDNA contract validation failed.',
        400,
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    const workspaceId = workspace(value.workspaceId);
    value = { ...value, workspaceId };
    const id = dnaId(value.brandDnaId);
    const key = command.idempotencyKey.trim();
    if (!key || key.length > 300)
      throw new TradingBrandDnaPersistenceError('INVALID_INPUT', 'idempotencyKey is invalid.', 400);
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0)
      throw new TradingBrandDnaPersistenceError(
        'INVALID_INPUT',
        'expectedVersion is invalid.',
        400
      );
    if (value.version !== command.expectedVersion + 1)
      throw new TradingBrandDnaPersistenceError(
        'VERSION_CONFLICT',
        'BrandDNA version must immediately follow expectedVersion.'
      );
    const fingerprint = hash({ brandDna: value, expectedVersion: command.expectedVersion });
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:trading-brand-dna:${id}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,document_json FROM lite_trading_brand_dna_versions WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, key]
        );
        const replayRow = replay.rows[0] as Row | undefined;
        if (replayRow) {
          if (replayRow.request_fingerprint_sha256 !== fingerprint)
            throw new TradingBrandDnaPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was reused.'
            );
          return clone(replayRow.document_json as TradingBrandDnaV1);
        }
        const latest = await client.query(
          `SELECT version FROM lite_trading_brand_dna_versions WHERE workspace_id=$1 AND brand_dna_id=$2 ORDER BY version DESC LIMIT 1`,
          [workspaceId, id]
        );
        const actual = latest.rows[0] ? Number((latest.rows[0] as Row).version) : 0;
        if (actual !== command.expectedVersion)
          throw new TradingBrandDnaPersistenceError(
            'VERSION_CONFLICT',
            `Expected BrandDNA version ${command.expectedVersion}, found ${actual}.`
          );
        const sources = await client.query(
          `SELECT a.version AS asset_version,p.document_json AS profile_json,r.document_json AS run_json
             FROM lite_trademark_assets a
             LEFT JOIN lite_trading_ai_profile_versions p ON p.workspace_id=a.workspace_id AND p.ai_profile_id=$3 AND p.version=$4
             LEFT JOIN lite_trading_studio_run_versions r ON r.workspace_id=a.workspace_id AND r.studio_run_id=$5 AND r.version=$6
            WHERE a.workspace_id=$1 AND a.trademark_asset_id=$2`,
          [
            workspaceId,
            value.trademarkAsset.id,
            value.aiProfile.id,
            value.aiProfile.version,
            value.studioRun.id,
            value.studioRun.version
          ]
        );
        const source = sources.rows[0] as Row | undefined;
        if (!source?.profile_json || !source.run_json)
          throw new TradingBrandDnaPersistenceError(
            'NOT_FOUND',
            'Exact BrandDNA source was not found.',
            404
          );
        const profile = source.profile_json as TradingBrandDnaV1;
        const run = source.run_json as {
          trademarkAsset: TradingBrandDnaV1['trademarkAsset'];
          aiProfile?: TradingBrandDnaV1['aiProfile'];
        };
        if (
          Number(source.asset_version) !== Number(value.trademarkAsset.version) ||
          !same(profile.trademarkAsset, value.trademarkAsset) ||
          !same(run.trademarkAsset, value.trademarkAsset) ||
          !run.aiProfile ||
          !same(run.aiProfile, value.aiProfile)
        )
          throw new TradingBrandDnaPersistenceError(
            'VERSION_CONFLICT',
            'BrandDNA source versions are not mutually current and exact.'
          );
        await client.query(
          `INSERT INTO lite_trading_brand_dna_versions(workspace_id,brand_dna_id,version,studio_run_id,studio_run_version,trademark_asset_id,trademark_asset_version,ai_profile_id,ai_profile_version,idempotency_key,request_fingerprint_sha256,document_json,recorded_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)`,
          [
            workspaceId,
            id,
            value.version,
            value.studioRun.id,
            value.studioRun.version,
            value.trademarkAsset.id,
            value.trademarkAsset.version,
            value.aiProfile.id,
            value.aiProfile.version,
            key,
            fingerprint,
            JSON.stringify(value),
            new Date(this.now()).toISOString()
          ]
        );
        return clone(value);
      });
    } catch (error) {
      if (error instanceof TradingBrandDnaPersistenceError) throw error;
      throw new TradingBrandDnaPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'BrandDNA persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async getExact(
    workspaceValue: string,
    idValue: TradingBrandDnaId,
    version: number
  ): Promise<TradingBrandDnaV1> {
    const workspaceId = workspace(workspaceValue);
    const id = dnaId(idValue);
    if (!Number.isSafeInteger(version) || version < 1)
      throw new TradingBrandDnaPersistenceError('INVALID_INPUT', 'version is invalid.', 400);
    try {
      const result = await this.query.query(
        `SELECT document_json FROM lite_trading_brand_dna_versions WHERE workspace_id=$1 AND brand_dna_id=$2 AND version=$3`,
        [workspaceId, id, version]
      );
      if (!result.rows[0])
        throw new TradingBrandDnaPersistenceError(
          'NOT_FOUND',
          'BrandDNA version was not found.',
          404
        );
      const value = clone((result.rows[0] as Row).document_json as TradingBrandDnaV1);
      assertTradingBrandDnaV1(value);
      return value;
    } catch (error) {
      if (error instanceof TradingBrandDnaPersistenceError) throw error;
      throw new TradingBrandDnaPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'BrandDNA persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
