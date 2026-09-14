import type { TrademarkAssetBulkImportItemResult } from '@markorbit/contracts/trademark-asset-portfolio';
import type {
  TrademarkAssetExternalIdentifier,
  TrademarkAssetIdentity,
  TrademarkAssetSourceReference,
  TrademarkAssetWorkspaceRelationship,
  TrademarkAssetWorkspaceRelationshipKind
} from '@markorbit/contracts/trademark-asset-workspace';
import { TrademarkAssetHttpError } from './trademark-assets.js';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export type HistoricalTrademarkAssetImportRelationshipKind = Exclude<
  TrademarkAssetWorkspaceRelationshipKind,
  'MARKETPLACE_ADDED'
>;

export interface TrademarkAssetMigrationAdmissionDraft {
  readonly identity: Readonly<TrademarkAssetIdentity>;
  readonly externalIdentifiers?: ReadonlyArray<Readonly<TrademarkAssetExternalIdentifier>>;
  readonly workspaceRelationships: ReadonlyArray<Readonly<TrademarkAssetWorkspaceRelationship>>;
  readonly sourceReferences: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  readonly ownerOrClientReference?: string;
  readonly workspaceTags?: readonly string[];
  readonly workspaceNotes?: readonly string[];
  readonly workspacePriority?: string;
  readonly workspaceAlias?: string;
}

export interface ReviewableTrademarkAssetMigrationRow {
  readonly rowKey: string;
  readonly item: Readonly<TrademarkAssetMigrationAdmissionDraft>;
}

export interface ReviewableTrademarkAssetMigrationRequest {
  readonly migrationKey: string;
  readonly sourceFingerprintSha256?: string;
  readonly rows: ReadonlyArray<Readonly<ReviewableTrademarkAssetMigrationRow>>;
}

export interface HistoricalTrademarkAssetTabularColumnMapping {
  readonly jurisdiction: string;
  readonly markText: string;
  readonly applicationNumber?: string;
  readonly registrationNumber?: string;
  readonly madridIrNumber?: string;
  readonly internalReference?: string;
}

export interface HistoricalTrademarkAssetTabularSourceRow {
  readonly rowKey: string;
  readonly cells: readonly string[];
}

export interface HistoricalTrademarkAssetTabularPreparationRequest {
  readonly migrationKey: string;
  readonly sourceFingerprintSha256?: string;
  readonly sourceArtifactId: string;
  readonly sourceArtifactVersion: string;
  readonly observedAt: string;
  readonly relationshipKind: HistoricalTrademarkAssetImportRelationshipKind;
  readonly headers: readonly string[];
  readonly columns: Readonly<HistoricalTrademarkAssetTabularColumnMapping>;
  readonly rows: ReadonlyArray<Readonly<HistoricalTrademarkAssetTabularSourceRow>>;
}

export interface HistoricalTrademarkAssetPreparedRow {
  readonly rowKey: string;
  readonly sourceIndex: number;
  readonly item: Readonly<TrademarkAssetMigrationAdmissionDraft>;
}

export interface HistoricalTrademarkAssetUnresolvedRow {
  readonly rowKey: string;
  readonly sourceIndex: number;
  readonly reason: string;
}

export interface HistoricalTrademarkAssetPreparationReceipt {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly migrationKey: string;
  readonly sourceFingerprintSha256?: string;
  readonly manifestFingerprintSha256: string;
  readonly total: number;
  readonly ready: number;
  readonly unresolved: number;
  readonly readyRows: ReadonlyArray<Readonly<HistoricalTrademarkAssetPreparedRow>>;
  readonly unresolvedRows: ReadonlyArray<Readonly<HistoricalTrademarkAssetUnresolvedRow>>;
  readonly migrationInput?: Readonly<ReviewableTrademarkAssetMigrationRequest> & {
    readonly workspaceId: string;
  };
  readonly officialTruthVerifiedByLite: false;
  readonly assetsCreatedAutomatically: false;
  readonly matterCreatedAutomatically: false;
}

export interface TrademarkAssetMigrationPreview {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly migrationKey: string;
  readonly sourceFingerprintSha256?: string;
  readonly fingerprint: string;
  readonly total: number;
  readonly chunkCount: number;
  readonly chunks: ReadonlyArray<
    Readonly<{
      chunkIndex: number;
      startIndex: number;
      endExclusive: number;
      rowKeys: readonly string[];
    }>
  >;
  readonly rows: ReadonlyArray<Readonly<{ rowKey: string; importIndex: number }>>;
  readonly officialTruthVerifiedByLite: false;
  readonly matterCreatedAutomatically: false;
}

export interface ReviewableTrademarkAssetMigrationItemResult extends Omit<
  TrademarkAssetBulkImportItemResult,
  'importIndex'
> {
  readonly rowKey: string;
  readonly importIndex: number;
}

export interface ReviewableTrademarkAssetMigrationResult {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly migrationKey: string;
  readonly sourceFingerprintSha256?: string;
  readonly fingerprint: string;
  readonly total: number;
  readonly created: number;
  readonly duplicates: number;
  readonly rejected: number;
  readonly chunkCount: number;
  readonly items: ReadonlyArray<Readonly<ReviewableTrademarkAssetMigrationItemResult>>;
  readonly officialTruthVerifiedByLite: false;
  readonly matterCreatedAutomatically: false;
}

export interface TrademarkAssetMigrationRunSnapshot extends ReviewableTrademarkAssetMigrationResult {
  readonly status: 'PREVIEWED' | 'COMMITTING' | 'INTERRUPTED' | 'COMPLETED';
  readonly nextChunkIndex: number;
  readonly rowKeys: readonly string[];
  readonly updatedAt: string;
}

export interface TrademarkAssetMigrationClient {
  prepareTabular(
    input: Readonly<HistoricalTrademarkAssetTabularPreparationRequest>
  ): Promise<Readonly<HistoricalTrademarkAssetPreparationReceipt>>;
  preview(
    input: Readonly<ReviewableTrademarkAssetMigrationRequest>,
    idempotencyKey: string
  ): Promise<Readonly<TrademarkAssetMigrationPreview>>;
  progress(migrationKey: string): Promise<Readonly<TrademarkAssetMigrationRunSnapshot>>;
  commit(
    migrationKey: string,
    input: Readonly<ReviewableTrademarkAssetMigrationRequest>,
    idempotencyKey: string
  ): Promise<Readonly<ReviewableTrademarkAssetMigrationResult>>;
}

async function csrfToken(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  const payload = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !payload.csrfToken)
    throw new TrademarkAssetHttpError(
      response.status || 401,
      payload.code ?? 'AUTHENTICATION_REQUIRED',
      payload.message ?? 'An authenticated session is required.',
      false
    );
  return payload.csrfToken;
}

async function parse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
  if (!response.ok)
    throw new TrademarkAssetHttpError(
      response.status,
      payload.code ?? 'TRADEMARK_ASSET_MIGRATION_REQUEST_FAILED',
      payload.message ?? 'Trademark Asset migration request failed.',
      payload.retryable ?? response.status >= 500
    );
  return payload;
}

async function post<T>(
  workspaceId: string,
  path: string,
  body: unknown,
  idempotencyKey?: string
): Promise<T> {
  const csrf = await csrfToken();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrf,
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new TrademarkAssetHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Trademark Asset migration is temporarily unavailable.',
      true
    );
  }
  return parse<T>(response);
}

async function get<T>(workspaceId: string, path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-workspace-id': workspaceId
      }
    });
  } catch {
    throw new TrademarkAssetHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Trademark Asset migration is temporarily unavailable.',
      true
    );
  }
  return parse<T>(response);
}

export function createTrademarkAssetMigrationClient(
  workspaceId: string
): TrademarkAssetMigrationClient {
  return {
    prepareTabular: (input) =>
      post<HistoricalTrademarkAssetPreparationReceipt>(
        workspaceId,
        '/api/lite/trademark-asset-migrations/prepare-tabular',
        input
      ),
    preview: (input, idempotencyKey) =>
      post<TrademarkAssetMigrationPreview>(
        workspaceId,
        '/api/lite/trademark-asset-migrations/preview',
        input,
        idempotencyKey
      ),
    progress: (migrationKey) =>
      get<TrademarkAssetMigrationRunSnapshot>(
        workspaceId,
        `/api/lite/trademark-asset-migrations/${encodeURIComponent(migrationKey)}`
      ),
    commit: (migrationKey, input, idempotencyKey) =>
      post<ReviewableTrademarkAssetMigrationResult>(
        workspaceId,
        `/api/lite/trademark-asset-migrations/${encodeURIComponent(migrationKey)}/commit`,
        input,
        idempotencyKey
      )
  };
}
