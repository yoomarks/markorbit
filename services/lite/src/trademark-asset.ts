import { createHash, randomUUID } from 'node:crypto';
import {
  trademarkAssetFreshnessStates,
  trademarkAssetIdentifierKinds,
  trademarkAssetSourceKinds,
  trademarkAssetSourceOwners,
  trademarkAssetWorkspaceRelationshipKinds,
  type TrademarkAsset,
  type TrademarkAssetExternalIdentifier,
  type TrademarkAssetId,
  type TrademarkAssetIdentity,
  type TrademarkAssetSourceReference,
  type TrademarkAssetWorkspaceRelationship
} from '@markorbit/contracts/trademark-asset-workspace';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

export type TrademarkAssetPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'IDENTIFIER_CONFLICT'
  | 'READ_ONLY_SOURCE'
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
  externalIdentifiers?: ReadonlyArray<Readonly<TrademarkAssetExternalIdentifier>>;
  workspaceRelationships: ReadonlyArray<Readonly<TrademarkAssetWorkspaceRelationship>>;
  sourceReferences: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  ownerOrClientReference?: string;
  workspaceTags?: readonly string[];
  workspaceNotes?: readonly string[];
  workspacePriority?: string;
  workspaceAlias?: string;
  idempotencyKey: string;
}

export interface AddTrademarkAssetExternalIdentifierCommand {
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  expectedVersion: number;
  identifier: Readonly<TrademarkAssetExternalIdentifier>;
  idempotencyKey: string;
}

export interface UpdateTrademarkAssetWorkspaceMetadataCommand {
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  expectedVersion: number;
  workspaceTags: readonly string[];
  workspaceNotes: readonly string[];
  ownerOrClientReference?: string;
  workspacePriority?: string;
  workspaceAlias?: string;
  idempotencyKey: string;
}

type Row = Record<string, unknown>;

const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const fingerprint = (value: unknown): string => hash(JSON.stringify(value));

function cleanText(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      `${field} must be a non-empty string of at most ${max} characters.`,
      400
    );
  }
  return value.trim();
}

function optionalText(value: unknown, field: string, max = 500): string | undefined {
  if (value === undefined) return undefined;
  return cleanText(value, field, max);
}

function cleanWorkspaceId(value: string): string {
  if (!UUID.test(value)) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'workspaceId must be a UUID.',
      400
    );
  }
  return value.toLowerCase();
}

function cleanAssetId(value: TrademarkAssetId): TrademarkAssetId {
  const cleaned = cleanText(value, 'trademarkAssetId', 300);
  if (!cleaned.startsWith('trademark-asset_')) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'trademarkAssetId must use the trademark-asset_ prefix.',
      400
    );
  }
  return cleaned as TrademarkAssetId;
}

function cleanStringList(values: readonly string[] | undefined, field: string): string[] {
  if (!values) return [];
  if (!Array.isArray(values) || values.length > 100) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      `${field} must contain at most 100 values.`,
      400
    );
  }
  return [...new Set(values.map((value) => cleanText(value, field, 300)))].sort();
}

function cleanIdentity(identity: Readonly<TrademarkAssetIdentity>): TrademarkAssetIdentity {
  const jurisdiction = cleanText(
    identity.jurisdiction,
    'identity.jurisdiction',
    40
  ).toUpperCase();
  const markText = optionalText(identity.markText, 'identity.markText', 500);
  const markImageReference = optionalText(
    identity.markImageReference,
    'identity.markImageReference',
    1000
  );
  if (!markText && !markImageReference) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'Trademark Asset identity requires markText or markImageReference.',
      400
    );
  }
  return {
    jurisdiction,
    ...(markText ? { markText } : {}),
    ...(markImageReference ? { markImageReference } : {})
  };
}

function cleanSourceReference(
  source: Readonly<TrademarkAssetSourceReference>
): TrademarkAssetSourceReference {
  if (!trademarkAssetSourceOwners.includes(source.owner)) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'Unknown sourceReference.owner.',
      400
    );
  }
  if (!trademarkAssetSourceKinds.includes(source.kind)) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'Unknown sourceReference.kind.',
      400
    );
  }
  if (!trademarkAssetFreshnessStates.includes(source.freshness)) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'Unknown sourceReference.freshness.',
      400
    );
  }
  const sourceId = cleanText(source.sourceId, 'sourceReference.sourceId', 500);
  const sourceVersion = cleanText(source.sourceVersion, 'sourceReference.sourceVersion', 300);
  if (source.sourceFingerprintSha256 && !SHA256.test(source.sourceFingerprintSha256)) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'sourceReference.sourceFingerprintSha256 must be lowercase SHA-256.',
      400
    );
  }
  const observedAt = new Date(source.observedAt);
  if (Number.isNaN(observedAt.valueOf())) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'sourceReference.observedAt must be a valid timestamp.',
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

function cleanSourceReferences(
  values: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>
): TrademarkAssetSourceReference[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 50) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'sourceReferences must contain between 1 and 50 exact references.',
      400
    );
  }
  const cleaned = values.map(cleanSourceReference);
  return cleaned.sort((a, b) =>
    `${a.owner}:${a.kind}:${a.sourceId}:${a.sourceVersion}`.localeCompare(
      `${b.owner}:${b.kind}:${b.sourceId}:${b.sourceVersion}`
    )
  );
}

function cleanIdentifier(
  input: Readonly<TrademarkAssetExternalIdentifier>
): TrademarkAssetExternalIdentifier {
  if (!trademarkAssetIdentifierKinds.includes(input.kind)) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'Unknown identifier kind.',
      400
    );
  }
  const jurisdiction = cleanText(
    input.jurisdiction,
    'identifier.jurisdiction',
    40
  ).toUpperCase();
  const value = cleanText(input.value, 'identifier.value', 160);
  const sourceReference = input.sourceReference
    ? cleanSourceReference(input.sourceReference)
    : undefined;
  return {
    kind: input.kind,
    jurisdiction,
    value,
    ...(sourceReference ? { sourceReference } : {}),
    officialTruthVerifiedByLite: false
  };
}

function identifierKey(identifier: Readonly<TrademarkAssetExternalIdentifier>): string {
  return `${identifier.jurisdiction}:${identifier.kind}:${identifier.value.trim().toUpperCase()}`;
}

function cleanIdentifiers(
  values: ReadonlyArray<Readonly<TrademarkAssetExternalIdentifier>> | undefined
): TrademarkAssetExternalIdentifier[] {
  if (!values) return [];
  if (!Array.isArray(values) || values.length > 100) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'externalIdentifiers must contain at most 100 values.',
      400
    );
  }
  const byKey = new Map<string, TrademarkAssetExternalIdentifier>();
  for (const value of values) {
    const cleaned = cleanIdentifier(value);
    byKey.set(identifierKey(cleaned), cleaned);
  }
  return [...byKey.values()].sort((a, b) => identifierKey(a).localeCompare(identifierKey(b)));
}

function cleanRelationship(
  input: Readonly<TrademarkAssetWorkspaceRelationship>
): TrademarkAssetWorkspaceRelationship {
  if (!trademarkAssetWorkspaceRelationshipKinds.includes(input.kind)) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'Unknown workspace relationship.',
      400
    );
  }
  const sourceAssetId = optionalText(input.sourceAssetId, 'relationship.sourceAssetId', 500);
  const sourceReference = input.sourceReference
    ? cleanSourceReference(input.sourceReference)
    : undefined;
  if (input.kind === 'MARKETPLACE_ADDED') {
    if (!sourceAssetId || !sourceReference || sourceReference.owner !== 'MARKETPLACE') {
      throw new TrademarkAssetPersistenceError(
        'INVALID_INPUT',
        'MARKETPLACE_ADDED requires a Marketplace sourceAssetId and sourceReference.',
        400
      );
    }
    if (input.sourceAssetEditableByWorkspace) {
      throw new TrademarkAssetPersistenceError(
        'READ_ONLY_SOURCE',
        'Marketplace source assets are read-only in a user workspace.',
        403
      );
    }
  }
  return {
    kind: input.kind,
    ...(sourceAssetId ? { sourceAssetId } : {}),
    ...(sourceReference ? { sourceReference } : {}),
    sourceAssetEditableByWorkspace:
      input.kind === 'MARKETPLACE_ADDED' ? false : Boolean(input.sourceAssetEditableByWorkspace)
  };
}

function cleanRelationships(
  values: ReadonlyArray<Readonly<TrademarkAssetWorkspaceRelationship>>
): TrademarkAssetWorkspaceRelationship[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 20) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'workspaceRelationships must contain between 1 and 20 values.',
      400
    );
  }
  return values.map(cleanRelationship).sort((a, b) =>
    `${a.kind}:${a.sourceAssetId ?? ''}`.localeCompare(`${b.kind}:${b.sourceAssetId ?? ''}`)
  );
}

function rowAsset(row: Row | undefined): TrademarkAsset | undefined {
  return row ? clone(row.document_json as TrademarkAsset) : undefined;
}

function newAssetId(): TrademarkAssetId {
  return `trademark-asset_${randomUUID()}`;
}

function ensureExpectedVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'expectedVersion must be a positive integer.',
      400
    );
  }
}

export class PostgresLiteTrademarkAssetStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async admit(command: Readonly<AdmitTrademarkAssetCommand>): Promise<TrademarkAsset> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const identity = cleanIdentity(command.identity);
    const externalIdentifiers = cleanIdentifiers(command.externalIdentifiers);
    const workspaceRelationships = cleanRelationships(command.workspaceRelationships);
    const sourceReferences = cleanSourceReferences(command.sourceReferences);
    const ownerOrClientReference = optionalText(
      command.ownerOrClientReference,
      'ownerOrClientReference',
      500
    );
    const workspaceTags = cleanStringList(command.workspaceTags, 'workspaceTags');
    const workspaceNotes = cleanStringList(command.workspaceNotes, 'workspaceNotes');
    const workspacePriority = optionalText(command.workspacePriority, 'workspacePriority', 100);
    const workspaceAlias = optionalText(command.workspaceAlias, 'workspaceAlias', 300);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      identity,
      externalIdentifiers,
      workspaceRelationships,
      sourceReferences,
      ownerOrClientReference: ownerOrClientReference ?? null,
      workspaceTags,
      workspaceNotes,
      workspacePriority: workspacePriority ?? null,
      workspaceAlias: workspaceAlias ?? null
    });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:trademark-asset-admit:${idempotencyKey}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,result_json
             FROM lite_trademark_asset_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256) {
            throw new TrademarkAssetPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Trademark Asset admission.',
              409
            );
          }
          return clone(prior.result_json as TrademarkAsset);
        }

        for (const identifier of externalIdentifiers) {
          const collision = await client.query(
            `SELECT trademark_asset_id
               FROM lite_trademark_asset_identifiers
              WHERE workspace_id=$1 AND jurisdiction=$2 AND identifier_kind=$3 AND normalized_value=$4`,
            [workspaceId, identifier.jurisdiction, identifier.kind, identifier.value.toUpperCase()]
          );
          if (collision.rows[0]) {
            throw new TrademarkAssetPersistenceError(
              'IDENTIFIER_CONFLICT',
              'An external identifier already belongs to another Trademark Asset in this workspace.',
              409
            );
          }
        }

        const timestamp = new Date(this.now()).toISOString();
        const asset: TrademarkAsset = {
          schemaVersion: 1,
          trademarkAssetId: newAssetId(),
          workspaceId,
          version: 1,
          identity,
          externalIdentifiers,
          workspaceRelationships,
          sourceReferences,
          relations: [],
          ...(ownerOrClientReference ? { ownerOrClientReference } : {}),
          workspaceTags,
          workspaceNotes,
          ...(workspacePriority ? { workspacePriority } : {}),
          ...(workspaceAlias ? { workspaceAlias } : {}),
          officialTruthVerifiedByLite: false,
          filingExecutedByLite: false,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        await client.query(
          `INSERT INTO lite_trademark_assets(
            workspace_id,trademark_asset_id,version,document_fingerprint_sha256,
            document_json,created_at,updated_at
          ) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)`,
          [
            workspaceId,
            asset.trademarkAssetId,
            asset.version,
            fingerprint(asset),
            JSON.stringify(asset),
            timestamp,
            timestamp
          ]
        );
        for (const identifier of externalIdentifiers) {
          await client.query(
            `INSERT INTO lite_trademark_asset_identifiers(
              workspace_id,trademark_asset_id,jurisdiction,identifier_kind,normalized_value,
              source_reference_json,created_at
            ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
            [
              workspaceId,
              asset.trademarkAssetId,
              identifier.jurisdiction,
              identifier.kind,
              identifier.value.toUpperCase(),
              identifier.sourceReference ? JSON.stringify(identifier.sourceReference) : null,
              timestamp
            ]
          );
        }
        await client.query(
          `INSERT INTO lite_trademark_asset_commands(
            workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
          ) VALUES($1,$2,'ADMIT_ASSET',$3,$4::jsonb,$5)`,
          [workspaceId, idempotencyKey, requestFingerprintSha256, JSON.stringify(asset), timestamp]
        );
        return clone(asset);
      });
    } catch (error) {
      if (error instanceof TrademarkAssetPersistenceError) throw error;
      throw this.persistenceUnavailable(error);
    }
  }

  async addExternalIdentifier(
    command: Readonly<AddTrademarkAssetExternalIdentifierCommand>
  ): Promise<TrademarkAsset> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const trademarkAssetId = cleanAssetId(command.trademarkAssetId);
    ensureExpectedVersion(command.expectedVersion);
    const identifier = cleanIdentifier(command.identifier);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      trademarkAssetId,
      expectedVersion: command.expectedVersion,
      identifier
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
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256) {
            throw new TrademarkAssetPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different identifier mutation.',
              409
            );
          }
          return clone(prior.result_json as TrademarkAsset);
        }

        const result = await client.query(
          `SELECT document_json
             FROM lite_trademark_assets
            WHERE workspace_id=$1 AND trademark_asset_id=$2
            FOR UPDATE`,
          [workspaceId, trademarkAssetId]
        );
        const current = rowAsset(result.rows[0] as Row | undefined);
        if (!current) {
          throw new TrademarkAssetPersistenceError(
            'NOT_FOUND',
            'Trademark Asset not found.',
            404
          );
        }
        if (current.version !== command.expectedVersion) {
          throw new TrademarkAssetPersistenceError(
            'VERSION_CONFLICT',
            'Trademark Asset changed since the requested version.',
            409
          );
        }

        const existingIdentifier = await client.query(
          `SELECT trademark_asset_id
             FROM lite_trademark_asset_identifiers
            WHERE workspace_id=$1 AND jurisdiction=$2 AND identifier_kind=$3 AND normalized_value=$4`,
          [workspaceId, identifier.jurisdiction, identifier.kind, identifier.value.toUpperCase()]
        );
        const owner = existingIdentifier.rows[0] as Row | undefined;
        if (owner && String(owner.trademark_asset_id) !== trademarkAssetId) {
          throw new TrademarkAssetPersistenceError(
            'IDENTIFIER_CONFLICT',
            'External identifier already belongs to another Trademark Asset.',
            409
          );
        }
        if (owner) return clone(current);

        const timestamp = new Date(this.now()).toISOString();
        const externalIdentifiers = [...current.externalIdentifiers, identifier].sort((a, b) =>
          identifierKey(a).localeCompare(identifierKey(b))
        );
        const updated: TrademarkAsset = {
          ...current,
          version: current.version + 1,
          externalIdentifiers,
          officialTruthVerifiedByLite: false,
          filingExecutedByLite: false,
          updatedAt: timestamp
        };
        await client.query(
          `INSERT INTO lite_trademark_asset_identifiers(
            workspace_id,trademark_asset_id,jurisdiction,identifier_kind,normalized_value,
            source_reference_json,created_at
          ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
          [
            workspaceId,
            trademarkAssetId,
            identifier.jurisdiction,
            identifier.kind,
            identifier.value.toUpperCase(),
            identifier.sourceReference ? JSON.stringify(identifier.sourceReference) : null,
            timestamp
          ]
        );
        await this.persistUpdatedAsset(client, updated);
        await client.query(
          `INSERT INTO lite_trademark_asset_commands(
            workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
          ) VALUES($1,$2,'ADD_EXTERNAL_IDENTIFIER',$3,$4::jsonb,$5)`,
          [
            workspaceId,
            idempotencyKey,
            requestFingerprintSha256,
            JSON.stringify(updated),
            timestamp
          ]
        );
        return clone(updated);
      });
    } catch (error) {
      if (error instanceof TrademarkAssetPersistenceError) throw error;
      throw this.persistenceUnavailable(error);
    }
  }

  async updateWorkspaceMetadata(
    command: Readonly<UpdateTrademarkAssetWorkspaceMetadataCommand>
  ): Promise<TrademarkAsset> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const trademarkAssetId = cleanAssetId(command.trademarkAssetId);
    ensureExpectedVersion(command.expectedVersion);
    const workspaceTags = cleanStringList(command.workspaceTags, 'workspaceTags');
    const workspaceNotes = cleanStringList(command.workspaceNotes, 'workspaceNotes');
    const ownerOrClientReference = optionalText(
      command.ownerOrClientReference,
      'ownerOrClientReference',
      500
    );
    const workspacePriority = optionalText(command.workspacePriority, 'workspacePriority', 100);
    const workspaceAlias = optionalText(command.workspaceAlias, 'workspaceAlias', 300);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      trademarkAssetId,
      expectedVersion: command.expectedVersion,
      workspaceTags,
      workspaceNotes,
      ownerOrClientReference: ownerOrClientReference ?? null,
      workspacePriority: workspacePriority ?? null,
      workspaceAlias: workspaceAlias ?? null
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
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256) {
            throw new TrademarkAssetPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for different Trademark Asset metadata.',
              409
            );
          }
          return clone(prior.result_json as TrademarkAsset);
        }

        const result = await client.query(
          `SELECT document_json
             FROM lite_trademark_assets
            WHERE workspace_id=$1 AND trademark_asset_id=$2
            FOR UPDATE`,
          [workspaceId, trademarkAssetId]
        );
        const current = rowAsset(result.rows[0] as Row | undefined);
        if (!current) {
          throw new TrademarkAssetPersistenceError(
            'NOT_FOUND',
            'Trademark Asset not found.',
            404
          );
        }
        if (current.version !== command.expectedVersion) {
          throw new TrademarkAssetPersistenceError(
            'VERSION_CONFLICT',
            'Trademark Asset changed since the requested version.',
            409
          );
        }

        const timestamp = new Date(this.now()).toISOString();
        const updated: TrademarkAsset = {
          ...current,
          version: current.version + 1,
          workspaceTags,
          workspaceNotes,
          ...(ownerOrClientReference ? { ownerOrClientReference } : {}),
          ...(workspacePriority ? { workspacePriority } : {}),
          ...(workspaceAlias ? { workspaceAlias } : {}),
          officialTruthVerifiedByLite: false,
          filingExecutedByLite: false,
          updatedAt: timestamp
        };
        if (!ownerOrClientReference) {
          delete (updated as { ownerOrClientReference?: string }).ownerOrClientReference;
        }
        if (!workspacePriority) {
          delete (updated as { workspacePriority?: string }).workspacePriority;
        }
        if (!workspaceAlias) {
          delete (updated as { workspaceAlias?: string }).workspaceAlias;
        }
        await this.persistUpdatedAsset(client, updated);
        await client.query(
          `INSERT INTO lite_trademark_asset_commands(
            workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
          ) VALUES($1,$2,'UPDATE_WORKSPACE_METADATA',$3,$4::jsonb,$5)`,
          [
            workspaceId,
            idempotencyKey,
            requestFingerprintSha256,
            JSON.stringify(updated),
            timestamp
          ]
        );
        return clone(updated);
      });
    } catch (error) {
      if (error instanceof TrademarkAssetPersistenceError) throw error;
      throw this.persistenceUnavailable(error);
    }
  }

  async get(
    workspaceIdInput: string,
    trademarkAssetIdInput: TrademarkAssetId
  ): Promise<TrademarkAsset> {
    const workspaceId = cleanWorkspaceId(workspaceIdInput);
    const trademarkAssetId = cleanAssetId(trademarkAssetIdInput);
    try {
      const result = await this.query.query(
        `SELECT document_json
           FROM lite_trademark_assets
          WHERE workspace_id=$1 AND trademark_asset_id=$2`,
        [workspaceId, trademarkAssetId]
      );
      const asset = rowAsset(result.rows[0] as Row | undefined);
      if (!asset) {
        throw new TrademarkAssetPersistenceError(
          'NOT_FOUND',
          'Trademark Asset not found.',
          404
        );
      }
      return asset;
    } catch (error) {
      if (error instanceof TrademarkAssetPersistenceError) throw error;
      throw this.persistenceUnavailable(error);
    }
  }

  async list(workspaceIdInput: string, limit = 100): Promise<TrademarkAsset[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdInput);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new TrademarkAssetPersistenceError(
        'INVALID_INPUT',
        'limit must be an integer between 1 and 500.',
        400
      );
    }
    try {
      const result = await this.query.query(
        `SELECT document_json
           FROM lite_trademark_assets
          WHERE workspace_id=$1
          ORDER BY updated_at DESC,trademark_asset_id ASC
          LIMIT $2`,
        [workspaceId, limit]
      );
      return result.rows.map((row) => clone((row as Row).document_json as TrademarkAsset));
    } catch (error) {
      throw this.persistenceUnavailable(error);
    }
  }

  private async persistUpdatedAsset(
    client: { query: QueryClient['query'] },
    asset: Readonly<TrademarkAsset>
  ): Promise<void> {
    await client.query(
      `UPDATE lite_trademark_assets
          SET version=$3,document_fingerprint_sha256=$4,document_json=$5::jsonb,updated_at=$6
        WHERE workspace_id=$1 AND trademark_asset_id=$2`,
      [
        asset.workspaceId,
        asset.trademarkAssetId,
        asset.version,
        fingerprint(asset),
        JSON.stringify(asset),
        asset.updatedAt
      ]
    );
  }

  private persistenceUnavailable(error: unknown): TrademarkAssetPersistenceError {
    return new TrademarkAssetPersistenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Lite Trademark Asset persistence is unavailable.',
      503,
      true,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
