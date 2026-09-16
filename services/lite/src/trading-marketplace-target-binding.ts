import { createHash } from 'node:crypto';
import {
  parseTradingMarketplaceTargetBindingV1,
  type TradingMarketplaceTargetBindingId,
  type TradingMarketplaceTargetBindingV1
} from '@markorbit/contracts/trading-marketplace-target-binding';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TARGET_ID = /^trading-marketplace-target-binding_[A-Za-z0-9_-]+$/u;
type Row = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);
const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const tradingMarketplaceTargetCurrentnessStatesV1 = [
  'CURRENT',
  'STALE',
  'REVOKED',
  'UNKNOWN',
  'UNAVAILABLE'
] as const;
export type TradingMarketplaceTargetCurrentnessStateV1 =
  (typeof tradingMarketplaceTargetCurrentnessStatesV1)[number];
export interface TradingMarketplaceTargetCurrentnessV1 {
  schemaVersion: 1;
  workspaceId: string;
  targetBinding: Readonly<{ id: TradingMarketplaceTargetBindingId; version: number }>;
  state: TradingMarketplaceTargetCurrentnessStateV1;
}
export type TradingMarketplaceTargetPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';
export class TradingMarketplaceTargetPersistenceError extends Error {
  constructor(
    readonly code: TradingMarketplaceTargetPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TradingMarketplaceTargetPersistenceError';
  }
}
export interface SaveTradingMarketplaceTargetBindingCommand {
  workspaceId: string;
  binding: Readonly<TradingMarketplaceTargetBindingV1>;
  expectedVersion: number;
  idempotencyKey: string;
}
function workspaceId(value: string): string {
  if (!UUID.test(value))
    throw new TradingMarketplaceTargetPersistenceError(
      'INVALID_INPUT',
      'workspaceId must be a UUID.',
      400
    );
  return value.toLowerCase();
}
function targetId(value: string): TradingMarketplaceTargetBindingId {
  if (!TARGET_ID.test(value))
    throw new TradingMarketplaceTargetPersistenceError(
      'INVALID_INPUT',
      'targetBindingId is invalid.',
      400
    );
  return value as TradingMarketplaceTargetBindingId;
}
function positiveVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new TradingMarketplaceTargetPersistenceError(
      'INVALID_INPUT',
      'version must be a positive integer.',
      400
    );
  return value;
}
function nonNegativeVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TradingMarketplaceTargetPersistenceError(
      'INVALID_INPUT',
      'expectedVersion must be a non-negative integer.',
      400
    );
  return value;
}
function required(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 300)
    throw new TradingMarketplaceTargetPersistenceError(
      'INVALID_INPUT',
      `${field} must contain 1 to 300 characters.`,
      400
    );
  return cleaned;
}
function parseBinding(
  workspace: string,
  value: unknown,
  code: 'INVALID_INPUT' | 'INTEGRITY_FAILURE'
): TradingMarketplaceTargetBindingV1 {
  try {
    const binding = parseTradingMarketplaceTargetBindingV1(clone(value));
    if (workspaceId(binding.workspaceId) !== workspace)
      throw new Error('Target binding Workspace does not match durable owner Workspace.');
    targetId(binding.tradingMarketplaceTargetBindingId);
    return binding;
  } catch (error) {
    throw new TradingMarketplaceTargetPersistenceError(
      code,
      code === 'INVALID_INPUT'
        ? 'Marketplace target binding validation failed.'
        : 'Persisted marketplace target binding failed integrity validation.',
      code === 'INVALID_INPUT' ? 400 : 500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

export class PostgresTradingMarketplaceTargetBindingStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async saveBinding(
    command: Readonly<SaveTradingMarketplaceTargetBindingCommand>
  ): Promise<TradingMarketplaceTargetBindingV1> {
    const workspace = workspaceId(command.workspaceId);
    const binding = parseBinding(workspace, command.binding, 'INVALID_INPUT');
    const id = targetId(binding.tradingMarketplaceTargetBindingId);
    const expected = nonNegativeVersion(command.expectedVersion);
    if (binding.version !== expected + 1)
      throw new TradingMarketplaceTargetPersistenceError(
        'VERSION_CONFLICT',
        'Target binding version must immediately follow expectedVersion.'
      );
    const idempotencyKey = required(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint({
      workspaceId: workspace,
      binding,
      expectedVersion: expected
    });
    return this.persist(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${workspace}:trading-marketplace-target:${id}`
      ]);
      const replay = await this.replay(client, workspace, idempotencyKey, requestFingerprint);
      if (replay) return replay;
      const actual = await this.latestVersion(client, workspace, id);
      if (actual !== expected)
        throw new TradingMarketplaceTargetPersistenceError(
          'VERSION_CONFLICT',
          `Expected target binding version ${expected}, found ${actual}.`
        );
      await client.query(
        `INSERT INTO lite_trading_marketplace_target_binding_versions(
           workspace_id,target_binding_id,version,idempotency_key,request_fingerprint_sha256,document_json,recorded_at
         ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [
          workspace,
          id,
          binding.version,
          idempotencyKey,
          requestFingerprint,
          JSON.stringify(binding),
          new Date(this.now()).toISOString()
        ]
      );
      return clone(binding);
    });
  }

  async getBindingVersion(
    workspaceIdValue: string,
    bindingIdValue: TradingMarketplaceTargetBindingId,
    version: number
  ): Promise<TradingMarketplaceTargetBindingV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = targetId(bindingIdValue);
    positiveVersion(version);
    return this.readExact(
      workspace,
      `SELECT document_json FROM lite_trading_marketplace_target_binding_versions
       WHERE workspace_id=$1 AND target_binding_id=$2 AND version=$3`,
      [workspace, id, version]
    );
  }

  async resolveCurrentness(
    workspaceIdValue: string,
    bindingIdValue: TradingMarketplaceTargetBindingId,
    version: number
  ): Promise<TradingMarketplaceTargetCurrentnessV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = targetId(bindingIdValue);
    positiveVersion(version);
    const result = (state: TradingMarketplaceTargetCurrentnessStateV1) => ({
      schemaVersion: 1 as const,
      workspaceId: workspace,
      targetBinding: { id, version },
      state
    });
    try {
      const queryResult = await this.query.query(
        `SELECT
           (SELECT document_json FROM lite_trading_marketplace_target_binding_versions
             WHERE workspace_id=$1 AND target_binding_id=$2 AND version=$3) AS document_json,
           (SELECT max(version) FROM lite_trading_marketplace_target_binding_versions
             WHERE workspace_id=$1 AND target_binding_id=$2) AS latest_version`,
        [workspace, id, version]
      );
      const row = queryResult.rows[0] as Row | undefined;
      if (!row) return result('UNKNOWN');
      const latestRaw = row.latest_version;
      if (latestRaw === null || latestRaw === undefined) return result('UNKNOWN');
      const latest = Number(latestRaw);
      if (!Number.isSafeInteger(latest) || latest < 1) return result('UNKNOWN');
      if (row.document_json === null || row.document_json === undefined) return result('UNKNOWN');
      if (latest > version) return result('STALE');
      if (latest < version) return result('UNKNOWN');
      let binding: TradingMarketplaceTargetBindingV1;
      try {
        binding = parseBinding(workspace, row.document_json, 'INTEGRITY_FAILURE');
      } catch (error) {
        if (
          error instanceof TradingMarketplaceTargetPersistenceError &&
          error.code === 'INTEGRITY_FAILURE'
        )
          return result('UNKNOWN');
        throw error;
      }
      if (binding.lifecycle === 'STALE') return result('STALE');
      if (binding.lifecycle === 'REVOKED') return result('REVOKED');
      return result('CURRENT');
    } catch (error) {
      if (
        error instanceof TradingMarketplaceTargetPersistenceError &&
        error.code === 'INVALID_INPUT'
      )
        throw error;
      return result('UNAVAILABLE');
    }
  }

  private async replay(
    client: QueryClient,
    workspace: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<TradingMarketplaceTargetBindingV1 | undefined> {
    const result = await client.query(
      `SELECT request_fingerprint_sha256,document_json FROM lite_trading_marketplace_target_binding_versions
       WHERE workspace_id=$1 AND idempotency_key=$2`,
      [workspace, idempotencyKey]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return undefined;
    if (row.request_fingerprint_sha256 !== requestFingerprint)
      throw new TradingMarketplaceTargetPersistenceError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used for a different target binding mutation.'
      );
    return parseBinding(workspace, row.document_json, 'INTEGRITY_FAILURE');
  }
  private async latestVersion(
    client: QueryClient,
    workspace: string,
    id: TradingMarketplaceTargetBindingId
  ): Promise<number> {
    const result = await client.query(
      `SELECT version FROM lite_trading_marketplace_target_binding_versions
       WHERE workspace_id=$1 AND target_binding_id=$2 ORDER BY version DESC LIMIT 1`,
      [workspace, id]
    );
    return result.rows[0] ? Number((result.rows[0] as Row).version) : 0;
  }
  private async readExact(
    workspace: string,
    sql: string,
    params: readonly unknown[]
  ): Promise<TradingMarketplaceTargetBindingV1> {
    try {
      const result = await this.query.query(sql, [...params]);
      const row = result.rows[0] as Row | undefined;
      if (!row)
        throw new TradingMarketplaceTargetPersistenceError(
          'NOT_FOUND',
          'Marketplace target binding version was not found.',
          404
        );
      return parseBinding(workspace, row.document_json, 'INTEGRITY_FAILURE');
    } catch (error) {
      if (error instanceof TradingMarketplaceTargetPersistenceError) throw error;
      throw new TradingMarketplaceTargetPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Marketplace target persistence is unavailable.',
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
      if (error instanceof TradingMarketplaceTargetPersistenceError) throw error;
      throw new TradingMarketplaceTargetPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Marketplace target persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
