import { createHash } from 'node:crypto';
import type {
  TrademarkAsset,
  TrademarkAssetId,
  TrademarkAssetIdentity,
  TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

export type TrademarkAssetPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'IDENTITY_CONFLICT'
  | 'NOT_FOUND'
  | 'PERSISTENCE_UNAVAILABLE';

export class TrademarkAssetPersistenceError extends Error {
  constructor(
    readonly code: TrademarkAssetPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TrademarkAssetPersistenceError';
  }
}

export interface AdmitTrademarkAssetCommand {
  workspaceId: string;
  identity: Readonly<TrademarkAssetIdentity>;
  niceClasses?: readonly string[];
  ownerOrClientReference?: string;
  applicationDate?: string;
  registrationDate?: string;
  renewalDate?: string;
  sourceObservedStatus?: string;
  sourceReferences: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  idempotencyKey: string;
}

export interface UpdateTrademarkAssetWorkspaceMetadataCommand {
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  expectedVersion: number;
  workspaceTags: readonly string[];
  workspaceNotes: readonly string[];
  idempotencyKey: string;
}

type Row = Record<string, unknown>;

const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const fingerprint = (value: unknown): string => hash(JSON.stringify(value));

function cleanText(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max)
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      `${field} must be a non-empty string of at most ${max} characters.`,
      400
    );
  return value.trim();
}

function optionalText(value: unknown, field: string, max = 500): string | undefined {
  if (value === undefined) return undefined;
  return cleanText(value, field, max);
}

function cleanWorkspaceId(value: string): string {
  if (!UUID.test(value))
    throw new TrademarkAssetPersistenceError('INVALID_INPUT', 'workspaceId must be a UUID.', 400);
  return value.toLowerCase();
}

function cleanDate(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  const normalized = cleanText(value, field, 40);
  const date = new Date(normalized);
  if (Number.isNaN(date.valueOf()))
    throw new TrademarkAssetPersistenceError('INVALID_INPUT', `${field} must be a valid date.`, 400);
  return normalized;
}

function cleanStringList(values: readonly string[] | undefined, field: string): string[] {
  if (!values) return [];
  if (!Array.isArray(values) || values.length > 100)
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      `${field} must contain at most 100 values.`,
      400
    );
  return [...new Set(values.map((value) => cleanText(value, field, 300)))].sort();
}

function cleanIdentity(identity: Readonly<TrademarkAssetIdentity>): TrademarkAssetIdentity {
  const jurisdiction = cleanText(identity.jurisdiction, 'identity.jurisdiction', 40).toUpperCase();
  const applicationNumber = optionalText(
    identity.applicationNumber,
    'identity.applicationNumber',
    120
  );
  const registrationNumber = optionalText(
    identity.registrationNumber,
    'identity.registrationNumber',
    120
  );
  if (!applicationNumber && !registrationNumber)
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'Trademark Asset identity requires an applicationNumber or registrationNumber.',
      400
    );
  const markText = optionalText(identity.markText, 'identity.markText', 500);
  const markImageReference = optionalText(
    identity.markImageReference,
    'identity.markImageReference',
    1000
  );
  return {
    jurisdiction,
    ...(applicationNumber ? { applicationNumber } : {}),
    ...(registrationNumber ? { registrationNumber } : {}),
    ...(markText ? { markText } : {}),
    ...(markImageReference ? { markImageReference } : {})
  };
}

function identityFingerprint(identity: Readonly<TrademarkAssetIdentity>): string {
  return fingerprint({
    jurisdiction: identity.jurisdiction,
    applicationNumber: identity.applicationNumber ?? null,
    registrationNumber: identity.registrationNumber ?? null
  });
}

function assetId(identityFingerprintSha256: string): TrademarkAssetId {
  return `trademark-asset_${identityFingerprintSha256.slice(0, 32)}`;
}

function cleanSourceReference(
  source: Readonly<TrademarkAssetSourceReference>
): TrademarkAssetSourceReference {
  const sourceId = cleanText(source.sourceId, 'sourceReference.sourceId', 500);
  const sourceVersion = cleanText(source.sourceVersion, 'sourceReference.sourceVersion', 300);
  if (source.sourceFingerprintSha256 && !SHA256.test(source.sourceFingerprintSha256))
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'sourceReference.sourceFingerprintSha256 must be lowercase SHA-256.',
      400
    );
  const observedAt = new Date(source.observedAt);
  if (Number.isNaN(observedAt.valueOf()))
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'sourceReference.observedAt must be a valid timestamp.',
      400
    );
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

function cleanSourceReferences(
  values: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>
): TrademarkAssetSourceReference[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 50)
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'sourceReferences must contain between 1 and 50 exact references.',
      400
    );
  const cleaned = values.map(cleanSourceReference);
  return cleaned.sort((a, b) =>
    `${a.owner}:${a.kind}:${a.sourceId}:${a.sourceVersion}`.localeCompare(
      `${b.owner}:${b.kind}:${b.sourceId}:${b.sourceVersion}`
    )
  );
}

function rowAsset(row: Row | undefined): TrademarkAsset | undefined {
  return row ? clone(row.document_json as TrademarkAsset) : undefined;
}

function requestIdentity(command: Readonly<AdmitTrademarkAssetCommand>) {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  const identity = cleanIdentity(command.identity);
  const sourceReferences = cleanSourceReferences(command.sourceReferences);
  const niceClasses = cleanStringList(command.niceClasses, 'niceClasses');
  return {
    workspaceId,
    identity,
    identityFingerprintSha256: identityFingerprint(identity),
    niceClasses,
    ownerOrClientReference: optionalText(
      command.ownerOrClientReference,
      'ownerOrClientReference',
      500
    ),
    applicationDate: cleanDate(command.applicationDate, 'applicationDate'),
    registrationDate: cleanDate(command.registrationDate, 'registrationDate'),
    renewalDate: cleanDate(command.renewalDate, 'renewalDate'),
    sourceObservedStatus: optionalText(command.sourceObservedStatus, 'sourceObservedStatus', 300),
    sourceReferences,
    idempotencyKey: cleanText(command.idempotencyKey, 'idempotencyKey', 300)
  };
}

export class PostgresLiteTrademarkAssetStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async admit(command: Readonly<AdmitTrademarkAssetCommand>): Promise<TrademarkAsset> {
    const request = requestIdentity(command);
    const requestFingerprintSha256 = fingerprint({
      workspaceId: request.workspaceId,
      identity: request.identity,
      niceClasses: request.niceClasses,
      ownerOrClientReference: request.ownerOrClientReference ?? null,
      applicationDate: request.applicationDate ?? null,
      registrationDate: request.registrationDate ?? null,
      renewalDate: request.renewalDate ?? null,
      sourceObservedStatus: request.sourceObservedStatus ?? null,
      sourceReferences: request.sourceReferences
    });
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${request.workspaceId}:trademark-asset:${request.identityFingerprintSha256}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,result_json
             FROM lite_trademark_asset_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [request.workspaceId, request.idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256)
            throw new TrademarkAssetPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Trademark Asset admission.',
              409
            );
          return clone(prior.result_json as TrademarkAsset);
        }

        const existing = await client.query(
          `SELECT document_json
             FROM lite_trademark_assets
            WHERE workspace_id=$1 AND identity_fingerprint_sha256=$2`,
          [request.workspaceId, request.identityFingerprintSha256]
        );
        let asset = rowAsset(existing.rows[0] as Row | undefined);
        if (asset) {
          if (fingerprint(asset.identity) !== fingerprint(request.identity))
            throw new TrademarkAssetPersistenceError(
              'IDENTITY_CONFLICT',
              'The canonical Trademark Asset identity conflicts with the stored identity.',
              409
            );
        } else {
          const timestamp = new Date(this.now()).toISOString();
          asset = {
            schemaVersion: 1,
            trademarkAssetId: assetId(request.identityFingerprintSha256),
            workspaceId: request.workspaceId,
            version: 1,
            identity: request.identity,
            niceClasses: request.niceClasses,
            ...(request.ownerOrClientReference
              ? { ownerOrClientReference: request.ownerOrClientReference }
              : {}),
            ...(request.applicationDate ? { applicationDate: request.applicationDate } : {}),
            ...(request.registrationDate ? { registrationDate: request.registrationDate } : {}),
            ...(request.renewalDate ? { renewalDate: request.renewalDate } : {}),
            ...(request.sourceObservedStatus
              ? { sourceObservedStatus: request.sourceObservedStatus }
              : {}),
            sourceReferences: request.sourceReferences,
            relations: [],
            workspaceTags: [],
            workspaceNotes: [],
            officialTruthVerifiedByLite: false,
            filingExecutedByLite: false,
            createdAt: timestamp,
            updatedAt: timestamp
          };
          await client.query(
            `INSERT INTO lite_trademark_assets(
              workspace_id,trademark_asset_id,version,identity_fingerprint_sha256,
              document_fingerprint_sha256,document_json,created_at,updated_at
            ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
            [
              request.workspaceId,
              asset.trademarkAssetId,
              asset.version,
              request.identityFingerprintSha256,
              fingerprint(asset),
              JSON.stringify(asset),
              asset.createdAt,
              asset.updatedAt
            ]
          );
        }
        await client.query(
          `INSERT INTO lite_trademark_asset_commands(
            workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
          ) VALUES($1,$2,'ADMIT_ASSET',$3,$4::jsonb,$5)`,
          [
            request.workspaceId,
            request.idempotencyKey,
            requestFingerprintSha256,
            JSON.stringify(asset),
            new Date(this.now()).toISOString()
          ]
        );
        return clone(asset);
      });
    } catch (error) {
      if (error instanceof TrademarkAssetPersistenceError) throw error;
      throw new TrademarkAssetPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Trademark Asset persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async updateWorkspaceMetadata(
    command: Readonly<UpdateTrademarkAssetWorkspaceMetadataCommand>
  ): Promise<TrademarkAsset> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const trademarkAssetId = cleanText(command.trademarkAssetId, 'trademarkAssetId', 300) as TrademarkAssetId;
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    if (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 1)
      throw new TrademarkAssetPersistenceError(
        'INVALID_INPUT',
        'expectedVersion must be a positive integer.',
        400
      );
    const workspaceTags = cleanStringList(command.workspaceTags, 'workspaceTags');
    const workspaceNotes = cleanStringList(command.workspaceNotes, 'workspaceNotes');
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      trademarkAssetId,
      expectedVersion: command.expectedVersion,
      workspaceTags,
      workspaceNotes
    });
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:trademark-asset-id:${trademarkAssetId}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,result_json
             FROM lite_trademark_asset_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256)
            throw new TrademarkAssetPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for different Trademark Asset metadata.',
              409
            );
          return clone(prior.result_json as TrademarkAsset);
        }
        const result = await client.query(
          `SELECT version,document_json
             FROM lite_trademark_assets
            WHERE workspace_id=$1 AND trademark_asset_id=$2
            FOR UPDATE`,
          [workspaceId, trademarkAssetId]
        );
        const current = rowAsset(result.rows[0] as Row | undefined);
        if (!current)
          throw new TrademarkAssetPersistenceError('NOT_FOUND', 'Trademark Asset not found.', 404);
        if (current.version !== command.expectedVersion)
          throw new TrademarkAssetPersistenceError(
            'VERSION_CONFLICT',
            'Trademark Asset changed since the requested version.',
            409
          );
        const updated: TrademarkAsset = {
          ...current,
          version: current.version + 1,
          workspaceTags,
          workspaceNotes,
          officialTruthVerifiedByLite: false,
          filingExecutedByLite: false,
          updatedAt: new Date(this.now()).toISOString()
        };
        await client.query(
          `UPDATE lite_trademark_assets
              SET version=$3,document_fingerprint_sha256=$4,document_json=$5::jsonb,updated_at=$6
            WHERE workspace_id=$1 AND trademark_asset_id=$2`,
          [
            workspaceId,
            trademarkAssetId,
            updated.version,
            fingerprint(updated),
            JSON.stringify(updated),
            updated.updatedAt
          ]
        );
        await client.query(
          `INSERT INTO lite_trademark_asset_commands(
            workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
          ) VALUES($1,$2,'UPDATE_WORKSPACE_METADATA',$3,$4::jsonb,$5)`,
          [
            workspaceId,
            idempotencyKey,
            requestFingerprintSha256,
            JSON.stringify(updated),
            updated.updatedAt
          ]
        );
        return clone(updated);
      });
    } catch (error) {
      if (error instanceof TrademarkAssetPersistenceError) throw error;
      throw new TrademarkAssetPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Trademark Asset persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async find(
    workspaceIdValue: string,
    trademarkAssetId: TrademarkAssetId
  ): Promise<TrademarkAsset | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      `SELECT document_json
         FROM lite_trademark_assets
        WHERE workspace_id=$1 AND trademark_asset_id=$2`,
      [workspaceId, trademarkAssetId]
    );
    return rowAsset(result.rows[0] as Row | undefined);
  }

  async list(workspaceIdValue: string): Promise<TrademarkAsset[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      `SELECT document_json
         FROM lite_trademark_assets
        WHERE workspace_id=$1
        ORDER BY updated_at DESC,trademark_asset_id ASC`,
      [workspaceId]
    );
    return result.rows.map((row) => clone((row as Row).document_json as TrademarkAsset));
  }
}
