import { createHash } from 'node:crypto';
import {
  assertTradingCommercialDirectionSetV1,
  type TradingCommercialDirectionSetV1
} from '@markorbit/contracts/trading-commercial-direction';
import {
  assertTradingDirectionSelectionV1,
  type TradingDirectionSelectionId,
  type TradingDirectionSelectionV1
} from '@markorbit/contracts/trading-direction-selection';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;

export type TradingDirectionSelectionPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class TradingDirectionSelectionPersistenceError extends Error {
  constructor(
    readonly code: TradingDirectionSelectionPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TradingDirectionSelectionPersistenceError';
  }
}

export interface SaveTradingDirectionSelectionCommand {
  selection: Readonly<TradingDirectionSelectionV1>;
  expectedVersion: number;
  idempotencyKey: string;
}

const clone = <T>(value: T): T => structuredClone(value);
const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function workspaceId(value: string): string {
  if (!UUID.test(value))
    throw new TradingDirectionSelectionPersistenceError(
      'INVALID_INPUT',
      'workspaceId must be a UUID.',
      400
    );
  return value.toLowerCase();
}

function selectionId(value: string): TradingDirectionSelectionId {
  if (!/^trading-direction-selection_[A-Za-z0-9_-]+$/u.test(value))
    throw new TradingDirectionSelectionPersistenceError(
      'INVALID_INPUT',
      'directionSelectionId is invalid.',
      400
    );
  return value as TradingDirectionSelectionId;
}

function key(value: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 300)
    throw new TradingDirectionSelectionPersistenceError(
      'INVALID_INPUT',
      'idempotencyKey is invalid.',
      400
    );
  return cleaned;
}

export class PostgresTradingDirectionSelectionStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async save(
    command: Readonly<SaveTradingDirectionSelectionCommand>
  ): Promise<TradingDirectionSelectionV1> {
    let selection = clone(command.selection);
    const workspace = workspaceId(selection.workspaceId);
    selection = { ...selection, workspaceId: workspace };
    const id = selectionId(selection.directionSelectionId);
    const idempotencyKey = key(command.idempotencyKey);
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0)
      throw new TradingDirectionSelectionPersistenceError(
        'INVALID_INPUT',
        'expectedVersion is invalid.',
        400
      );
    if (selection.version !== command.expectedVersion + 1)
      throw new TradingDirectionSelectionPersistenceError(
        'VERSION_CONFLICT',
        'Selection version must immediately follow expectedVersion.'
      );
    const requestFingerprint = fingerprint({ selection, expectedVersion: command.expectedVersion });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspace}:trading-direction-selection:${id}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,document_json FROM lite_trading_direction_selection_versions
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspace, idempotencyKey]
        );
        const replayRow = replay.rows[0] as Row | undefined;
        if (replayRow) {
          if (replayRow.request_fingerprint_sha256 !== requestFingerprint)
            throw new TradingDirectionSelectionPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was reused.'
            );
          return clone(replayRow.document_json as TradingDirectionSelectionV1);
        }

        const latest = await client.query(
          `SELECT version FROM lite_trading_direction_selection_versions
            WHERE workspace_id=$1 AND direction_selection_id=$2 ORDER BY version DESC LIMIT 1`,
          [workspace, id]
        );
        const actualVersion = latest.rows[0] ? Number((latest.rows[0] as Row).version) : 0;
        if (actualVersion !== command.expectedVersion)
          throw new TradingDirectionSelectionPersistenceError(
            'VERSION_CONFLICT',
            `Expected version ${command.expectedVersion}, found ${actualVersion}.`
          );

        const setResult = await client.query(
          `SELECT document_json FROM lite_trading_direction_set_versions
            WHERE workspace_id=$1 AND direction_set_id=$2 AND version=$3`,
          [workspace, selection.directionSet.id, selection.directionSet.version]
        );
        const setRow = setResult.rows[0] as Row | undefined;
        if (!setRow)
          throw new TradingDirectionSelectionPersistenceError(
            'NOT_FOUND',
            'Referenced Direction Set was not found.',
            404
          );
        const directionSet = clone(setRow.document_json as TradingCommercialDirectionSetV1);
        try {
          assertTradingCommercialDirectionSetV1(directionSet);
          assertTradingDirectionSelectionV1(selection, directionSet);
        } catch (error) {
          throw new TradingDirectionSelectionPersistenceError(
            'INVALID_INPUT',
            'Selection validation failed.',
            400,
            false,
            {
              cause: error instanceof Error ? error : undefined
            }
          );
        }

        await client.query(
          `INSERT INTO lite_trading_direction_selection_versions(
             workspace_id,direction_selection_id,version,direction_set_id,direction_set_version,
             selected_direction_id,selected_direction_version,status,idempotency_key,
             request_fingerprint_sha256,document_json,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`,
          [
            workspace,
            id,
            selection.version,
            selection.directionSet.id,
            selection.directionSet.version,
            selection.selectedDirection.id,
            selection.selectedDirection.version,
            selection.status,
            idempotencyKey,
            requestFingerprint,
            JSON.stringify(selection),
            new Date(this.now()).toISOString()
          ]
        );
        return clone(selection);
      });
    } catch (error) {
      if (error instanceof TradingDirectionSelectionPersistenceError) throw error;
      throw new TradingDirectionSelectionPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Direction Selection persistence is unavailable.',
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
    selectionIdValue: TradingDirectionSelectionId
  ): Promise<TradingDirectionSelectionV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = selectionId(selectionIdValue);
    try {
      const result = await this.query.query(
        `SELECT selection.document_json AS selection_json,direction_set.document_json AS direction_set_json
           FROM lite_trading_direction_selection_versions selection
           JOIN lite_trading_direction_set_versions direction_set
             ON direction_set.workspace_id=selection.workspace_id
            AND direction_set.direction_set_id=selection.direction_set_id
            AND direction_set.version=selection.direction_set_version
          WHERE selection.workspace_id=$1 AND selection.direction_selection_id=$2
          ORDER BY selection.version DESC LIMIT 1`,
        [workspace, id]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row)
        throw new TradingDirectionSelectionPersistenceError(
          'NOT_FOUND',
          'Direction Selection was not found.',
          404
        );
      const selection = clone(row.selection_json as TradingDirectionSelectionV1);
      const directionSet = clone(row.direction_set_json as TradingCommercialDirectionSetV1);
      assertTradingCommercialDirectionSetV1(directionSet);
      assertTradingDirectionSelectionV1(selection, directionSet);
      return selection;
    } catch (error) {
      if (error instanceof TradingDirectionSelectionPersistenceError) throw error;
      throw new TradingDirectionSelectionPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Direction Selection persistence is unavailable.',
        503,
        true,
        {
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
}
