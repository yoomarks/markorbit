import { createHash, randomUUID } from 'node:crypto';
import {
  trademarkAssetManagementChangeKinds,
  type TrademarkAssetManagementChangeReference
} from '@markorbit/contracts/trademark-asset-management';
import {
  trademarkAssetFreshnessStates,
  trademarkAssetSourceKinds,
  trademarkAssetSourceOwners,
  type TrademarkAssetId,
  type TrademarkAssetSourceOwner,
  type TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

export type TrademarkAssetRefreshRunId = `trademark-asset-refresh_${string}`;

export interface RefreshTrademarkAssetCommand {
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  sourceOwnerScope: readonly TrademarkAssetSourceOwner[];
  observations: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  idempotencyKey: string;
}

export interface TrademarkAssetRefreshRun {
  schemaVersion: 1;
  refreshRunId: TrademarkAssetRefreshRunId;
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  sourceOwnerScope: readonly TrademarkAssetSourceOwner[];
  observations: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  changes: ReadonlyArray<Readonly<TrademarkAssetManagementChangeReference>>;
  refreshedAt: string;
  officialTruthVerifiedByLite: false;
  legalDeadlineCertified: false;
  conflictResolvedByLite: false;
  executionAuthorized: false;
}

export type TrademarkAssetRefreshErrorCode =
  'INVALID_INPUT' | 'IDEMPOTENCY_CONFLICT' | 'NOT_FOUND' | 'PERSISTENCE_UNAVAILABLE';

export class TrademarkAssetRefreshError extends Error {
  constructor(
    readonly code: TrademarkAssetRefreshErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TrademarkAssetRefreshError';
  }
}

type Row = Record<string, unknown>;

const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const fingerprint = (value: unknown): string => hash(JSON.stringify(value));

function cleanText(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) {
    throw new TrademarkAssetRefreshError(
      'INVALID_INPUT',
      `${field} must be a non-empty string of at most ${max} characters.`,
      400
    );
  }
  return value.trim();
}

function cleanWorkspaceId(value: string): string {
  if (!UUID.test(value)) {
    throw new TrademarkAssetRefreshError('INVALID_INPUT', 'workspaceId must be a UUID.', 400);
  }
  return value.toLowerCase();
}

function cleanAssetId(value: TrademarkAssetId): TrademarkAssetId {
  const cleaned = cleanText(value, 'trademarkAssetId', 300);
  if (!cleaned.startsWith('trademark-asset_')) {
    throw new TrademarkAssetRefreshError(
      'INVALID_INPUT',
      'trademarkAssetId must use the trademark-asset_ prefix.',
      400
    );
  }
  return cleaned as TrademarkAssetId;
}

function cleanScope(values: readonly TrademarkAssetSourceOwner[]): TrademarkAssetSourceOwner[] {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > trademarkAssetSourceOwners.length
  ) {
    throw new TrademarkAssetRefreshError(
      'INVALID_INPUT',
      'sourceOwnerScope must contain at least one recognised source owner.',
      400
    );
  }
  const unique = [...new Set(values)];
  for (const owner of unique) {
    if (!trademarkAssetSourceOwners.includes(owner)) {
      throw new TrademarkAssetRefreshError(
        'INVALID_INPUT',
        'Unknown source owner in refresh scope.',
        400
      );
    }
  }
  return unique.sort();
}

function cleanSourceReference(
  source: Readonly<TrademarkAssetSourceReference>
): TrademarkAssetSourceReference {
  if (!trademarkAssetSourceOwners.includes(source.owner)) {
    throw new TrademarkAssetRefreshError('INVALID_INPUT', 'Unknown observation owner.', 400);
  }
  if (!trademarkAssetSourceKinds.includes(source.kind)) {
    throw new TrademarkAssetRefreshError('INVALID_INPUT', 'Unknown observation kind.', 400);
  }
  if (!trademarkAssetFreshnessStates.includes(source.freshness)) {
    throw new TrademarkAssetRefreshError('INVALID_INPUT', 'Unknown observation freshness.', 400);
  }
  const sourceId = cleanText(source.sourceId, 'observation.sourceId', 500);
  const sourceVersion = cleanText(source.sourceVersion, 'observation.sourceVersion', 300);
  if (source.sourceFingerprintSha256 && !SHA256.test(source.sourceFingerprintSha256)) {
    throw new TrademarkAssetRefreshError(
      'INVALID_INPUT',
      'observation.sourceFingerprintSha256 must be lowercase SHA-256.',
      400
    );
  }
  const observedAt = new Date(source.observedAt);
  if (Number.isNaN(observedAt.valueOf())) {
    throw new TrademarkAssetRefreshError(
      'INVALID_INPUT',
      'observation.observedAt must be a valid timestamp.',
      400
    );
  }
  return {
    owner: source.owner,
    kind: source.kind,
    sourceId,
    sourceVersion,
    ...(source.sourceFingerprintSha256
      ? { sourceFingerprintSha256: source.sourceFingerprintSha256 }
      : {}),
    observedAt: observedAt.toISOString(),
    freshness: source.freshness
  };
}

function sourceKey(source: Readonly<TrademarkAssetSourceReference>): string {
  return `${source.owner}:${source.kind}:${source.sourceId}`;
}

function comparisonFingerprint(source: Readonly<TrademarkAssetSourceReference>): string {
  return fingerprint({
    owner: source.owner,
    kind: source.kind,
    sourceId: source.sourceId,
    sourceVersion: source.sourceVersion,
    sourceFingerprintSha256: source.sourceFingerprintSha256 ?? null,
    freshness: source.freshness
  });
}

function cleanObservations(
  values: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>,
  scope: readonly TrademarkAssetSourceOwner[]
): TrademarkAssetSourceReference[] {
  if (!Array.isArray(values) || values.length > 200) {
    throw new TrademarkAssetRefreshError(
      'INVALID_INPUT',
      'observations must contain at most 200 exact source references.',
      400
    );
  }
  const byKey = new Map<string, TrademarkAssetSourceReference>();
  for (const raw of values) {
    const cleaned = cleanSourceReference(raw);
    if (!scope.includes(cleaned.owner)) {
      throw new TrademarkAssetRefreshError(
        'INVALID_INPUT',
        'Every observation owner must be included in sourceOwnerScope.',
        400
      );
    }
    const key = sourceKey(cleaned);
    if (byKey.has(key)) {
      throw new TrademarkAssetRefreshError(
        'INVALID_INPUT',
        `Refresh contains more than one current observation for ${key}.`,
        400
      );
    }
    byKey.set(key, cleaned);
  }
  return [...byKey.values()].sort((a, b) => sourceKey(a).localeCompare(sourceKey(b)));
}

function rowSource(row: Row): TrademarkAssetSourceReference {
  return clone(row.source_reference_json as TrademarkAssetSourceReference);
}

function detectChanges(
  previous: ReadonlyMap<string, Readonly<TrademarkAssetSourceReference>>,
  current: ReadonlyMap<string, Readonly<TrademarkAssetSourceReference>>,
  detectedAt: string
): TrademarkAssetManagementChangeReference[] {
  const keys = [...new Set([...previous.keys(), ...current.keys()])].sort();
  const changes: TrademarkAssetManagementChangeReference[] = [];
  for (const key of keys) {
    const before = previous.get(key);
    const after = current.get(key);
    if (!before && after) {
      changes.push({
        kind: 'OBSERVATION_ADDED',
        sourceReferences: [after],
        currentSourceVersion: after.sourceVersion,
        observedAt: detectedAt,
        freshness: after.freshness
      });
      continue;
    }
    if (before && !after) {
      changes.push({
        kind: 'OBSERVATION_REMOVED',
        sourceReferences: [before],
        previousSourceVersion: before.sourceVersion,
        observedAt: detectedAt,
        freshness: before.freshness
      });
      continue;
    }
    if (!before || !after) continue;
    const substantiveBefore = fingerprint({
      sourceVersion: before.sourceVersion,
      sourceFingerprintSha256: before.sourceFingerprintSha256 ?? null
    });
    const substantiveAfter = fingerprint({
      sourceVersion: after.sourceVersion,
      sourceFingerprintSha256: after.sourceFingerprintSha256 ?? null
    });
    if (substantiveBefore !== substantiveAfter) {
      changes.push({
        kind: 'OBSERVATION_CHANGED',
        sourceReferences: [before, after],
        previousSourceVersion: before.sourceVersion,
        currentSourceVersion: after.sourceVersion,
        observedAt: detectedAt,
        freshness: after.freshness
      });
    } else if (before.freshness !== after.freshness) {
      changes.push({
        kind: 'FRESHNESS_CHANGED',
        sourceReferences: [before, after],
        previousSourceVersion: before.sourceVersion,
        currentSourceVersion: after.sourceVersion,
        observedAt: detectedAt,
        freshness: after.freshness
      });
    }
  }
  return changes;
}

export class PostgresTrademarkAssetRefreshLedger {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async refresh(
    command: Readonly<RefreshTrademarkAssetCommand>
  ): Promise<TrademarkAssetRefreshRun> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const trademarkAssetId = cleanAssetId(command.trademarkAssetId);
    const sourceOwnerScope = cleanScope(command.sourceOwnerScope);
    const observations = cleanObservations(command.observations, sourceOwnerScope);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      trademarkAssetId,
      sourceOwnerScope,
      observations
    });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:trademark-asset-refresh:${trademarkAssetId}`
        ]);

        const replay = await client.query(
          `SELECT request_fingerprint_sha256,result_json
             FROM lite_trademark_asset_refresh_runs
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const priorReplay = replay.rows[0] as Row | undefined;
        if (priorReplay) {
          if (String(priorReplay.request_fingerprint_sha256) !== requestFingerprintSha256) {
            throw new TrademarkAssetRefreshError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Trademark Asset refresh.',
              409
            );
          }
          return clone(priorReplay.result_json as TrademarkAssetRefreshRun);
        }

        const asset = await client.query(
          `SELECT 1 FROM lite_trademark_assets
            WHERE workspace_id=$1 AND trademark_asset_id=$2`,
          [workspaceId, trademarkAssetId]
        );
        if (!asset.rows[0]) {
          throw new TrademarkAssetRefreshError('NOT_FOUND', 'Trademark Asset was not found.', 404);
        }

        const priorRun = await client.query(
          `SELECT refresh_run_id
             FROM lite_trademark_asset_refresh_runs
            WHERE workspace_id=$1
              AND trademark_asset_id=$2
              AND source_owner_scope @> $3::jsonb
            ORDER BY refreshed_at DESC, refresh_run_id DESC
            LIMIT 1`,
          [workspaceId, trademarkAssetId, JSON.stringify(sourceOwnerScope)]
        );
        const previousRunId = priorRun.rows[0]?.refresh_run_id as string | undefined;
        const previousRows = previousRunId
          ? await client.query(
              `SELECT source_reference_json
                 FROM lite_trademark_asset_refresh_observations
                WHERE workspace_id=$1 AND refresh_run_id=$2
                  AND source_owner = ANY($3::text[])
                ORDER BY source_key ASC`,
              [workspaceId, previousRunId, sourceOwnerScope]
            )
          : { rows: [] as Row[] };

        const previous = new Map<string, TrademarkAssetSourceReference>();
        for (const row of previousRows.rows as Row[]) {
          const source = rowSource(row);
          previous.set(sourceKey(source), source);
        }
        const current = new Map(observations.map((source) => [sourceKey(source), source] as const));
        const refreshedAt = new Date(this.now()).toISOString();
        const changes = detectChanges(previous, current, refreshedAt);
        const refreshRunId =
          `trademark-asset-refresh_${randomUUID()}` as TrademarkAssetRefreshRunId;
        const result: TrademarkAssetRefreshRun = {
          schemaVersion: 1,
          refreshRunId,
          workspaceId,
          trademarkAssetId,
          sourceOwnerScope,
          observations,
          changes,
          refreshedAt,
          officialTruthVerifiedByLite: false,
          legalDeadlineCertified: false,
          conflictResolvedByLite: false,
          executionAuthorized: false
        };

        await client.query(
          `INSERT INTO lite_trademark_asset_refresh_runs(
             workspace_id,refresh_run_id,trademark_asset_id,idempotency_key,
             request_fingerprint_sha256,source_owner_scope,observation_count,change_count,
             result_json,refreshed_at
           ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10)`,
          [
            workspaceId,
            refreshRunId,
            trademarkAssetId,
            idempotencyKey,
            requestFingerprintSha256,
            JSON.stringify(sourceOwnerScope),
            observations.length,
            changes.length,
            JSON.stringify(result),
            refreshedAt
          ]
        );

        for (const source of observations) {
          await client.query(
            `INSERT INTO lite_trademark_asset_refresh_observations(
               workspace_id,refresh_run_id,trademark_asset_id,source_key,source_owner,
               source_kind,source_id,source_version,source_fingerprint_sha256,freshness,
               observed_at,observation_fingerprint_sha256,source_reference_json,recorded_at
             ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)`,
            [
              workspaceId,
              refreshRunId,
              trademarkAssetId,
              sourceKey(source),
              source.owner,
              source.kind,
              source.sourceId,
              source.sourceVersion,
              source.sourceFingerprintSha256 ?? null,
              source.freshness,
              source.observedAt,
              comparisonFingerprint(source),
              JSON.stringify(source),
              refreshedAt
            ]
          );
        }

        for (let index = 0; index < changes.length; index += 1) {
          const change = changes[index]!;
          if (!trademarkAssetManagementChangeKinds.includes(change.kind)) {
            throw new TrademarkAssetRefreshError(
              'INVALID_INPUT',
              'Unknown detected change kind.',
              400
            );
          }
          const key = sourceKey(change.sourceReferences[change.sourceReferences.length - 1]!);
          const changeId = `trademark-asset-change_${hash(`${refreshRunId}:${index}:${key}:${change.kind}`).slice(0, 32)}`;
          await client.query(
            `INSERT INTO lite_trademark_asset_refresh_changes(
               workspace_id,refresh_run_id,trademark_asset_id,change_id,change_kind,
               source_key,change_json,detected_at
             ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
            [
              workspaceId,
              refreshRunId,
              trademarkAssetId,
              changeId,
              change.kind,
              key,
              JSON.stringify(change),
              refreshedAt
            ]
          );
        }

        return clone(result);
      });
    } catch (error) {
      if (error instanceof TrademarkAssetRefreshError) throw error;
      throw new TrademarkAssetRefreshError(
        'PERSISTENCE_UNAVAILABLE',
        'Trademark Asset refresh ledger is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async listRecent(
    workspaceIdValue: string,
    trademarkAssetIdValue: TrademarkAssetId,
    limit = 20
  ): Promise<TrademarkAssetRefreshRun[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const trademarkAssetId = cleanAssetId(trademarkAssetIdValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new TrademarkAssetRefreshError(
        'INVALID_INPUT',
        'limit must be between 1 and 100.',
        400
      );
    }
    try {
      const rows = await this.query.query(
        `SELECT result_json
           FROM lite_trademark_asset_refresh_runs
          WHERE workspace_id=$1 AND trademark_asset_id=$2
          ORDER BY refreshed_at DESC, refresh_run_id DESC
          LIMIT $3`,
        [workspaceId, trademarkAssetId, limit]
      );
      return rows.rows.map((row) => clone((row as Row).result_json as TrademarkAssetRefreshRun));
    } catch (error) {
      if (error instanceof TrademarkAssetRefreshError) throw error;
      throw new TrademarkAssetRefreshError(
        'PERSISTENCE_UNAVAILABLE',
        'Trademark Asset refresh ledger is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
