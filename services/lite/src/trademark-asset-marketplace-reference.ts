import { createHash, randomUUID } from 'node:crypto';
import {
  type TrademarkAssetMarketplaceOverlay,
  type TrademarkAssetMarketplaceOverlayId,
  type UpsertTrademarkAssetMarketplaceOverlayInput
} from '@markorbit/contracts/trademark-asset-marketplace-reference';
import type {
  TrademarkAsset,
  TrademarkAssetId
} from '@markorbit/contracts/trademark-asset-workspace';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
type Row = Record<string, unknown>;

export type TrademarkAssetMarketplaceReferenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'ASSET_VERSION_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RELATIONSHIP_CONFLICT'
  | 'SOURCE_REFERENCE_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class TrademarkAssetMarketplaceReferenceError extends Error {
  constructor(
    readonly code: TrademarkAssetMarketplaceReferenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TrademarkAssetMarketplaceReferenceError';
  }
}

export interface TrademarkAssetMarketplaceReferenceAssetReader {
  get(workspaceId: string, trademarkAssetId: TrademarkAssetId): Promise<Readonly<TrademarkAsset>>;
}

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const fingerprint = (value: unknown): string => hash(JSON.stringify(value));
const clone = <T>(value: T): T => structuredClone(value);

function overlayId(value: string): TrademarkAssetMarketplaceOverlayId {
  return `trademark-asset-marketplace-overlay_${value}`;
}

function text(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new TrademarkAssetMarketplaceReferenceError(
      'INVALID_INPUT',
      `${field} must be a non-empty string of at most ${max} characters.`,
      400
    );
  }
  return value.trim();
}

function optionalText(value: unknown, field: string, max = 500): string | undefined {
  return value === undefined ? undefined : text(value, field, max);
}

function list(values: readonly string[] | undefined, field: string, maxItems = 100): string[] {
  if (!values) return [];
  if (!Array.isArray(values) || values.length > maxItems) {
    throw new TrademarkAssetMarketplaceReferenceError(
      'INVALID_INPUT',
      `${field} must contain at most ${maxItems} values.`,
      400
    );
  }
  return [...new Set(values.map((value) => text(value, field, 500)))].sort();
}

function normalize(input: Readonly<UpsertTrademarkAssetMarketplaceOverlayInput>) {
  if (!UUID.test(input.workspaceId)) {
    throw new TrademarkAssetMarketplaceReferenceError('INVALID_INPUT', 'workspaceId must be a UUID.', 400);
  }
  if (!input.trademarkAssetId.startsWith('trademark-asset_')) {
    throw new TrademarkAssetMarketplaceReferenceError('INVALID_INPUT', 'Invalid trademarkAssetId.', 400);
  }
  if (!Number.isInteger(input.expectedTrademarkAssetVersion) || input.expectedTrademarkAssetVersion < 1) {
    throw new TrademarkAssetMarketplaceReferenceError(
      'INVALID_INPUT',
      'expectedTrademarkAssetVersion must be a positive integer.',
      400
    );
  }
  if (
    input.expectedOverlayVersion !== undefined &&
    (!Number.isInteger(input.expectedOverlayVersion) || input.expectedOverlayVersion < 1)
  ) {
    throw new TrademarkAssetMarketplaceReferenceError(
      'INVALID_INPUT',
      'expectedOverlayVersion must be a positive integer when provided.',
      400
    );
  }
  const sourceReference = input.source.sourceReference;
  if (sourceReference.owner !== 'MARKETPLACE' || sourceReference.kind !== 'MARKETPLACE_LISTING') {
    throw new TrademarkAssetMarketplaceReferenceError(
      'INVALID_INPUT',
      'Marketplace overlay sourceReference must be a MARKETPLACE / MARKETPLACE_LISTING reference.',
      400
    );
  }
  const sourceListingFingerprintSha256 = input.source.sourceListingFingerprintSha256;
  if (sourceListingFingerprintSha256 && !SHA256.test(sourceListingFingerprintSha256)) {
    throw new TrademarkAssetMarketplaceReferenceError(
      'INVALID_INPUT',
      'sourceListingFingerprintSha256 must be lowercase SHA-256 when provided.',
      400
    );
  }
  return {
    workspaceId: input.workspaceId.toLowerCase(),
    trademarkAssetId: input.trademarkAssetId,
    expectedTrademarkAssetVersion: input.expectedTrademarkAssetVersion,
    ...(input.expectedOverlayVersion !== undefined ? { expectedOverlayVersion: input.expectedOverlayVersion } : {}),
    source: {
      sourceAssetId: text(input.source.sourceAssetId, 'source.sourceAssetId'),
      sourceListingId: text(input.source.sourceListingId, 'source.sourceListingId'),
      sourceListingVersion: text(input.source.sourceListingVersion, 'source.sourceListingVersion'),
      ...(sourceListingFingerprintSha256 ? { sourceListingFingerprintSha256 } : {}),
      sourceReference: clone(sourceReference),
      observedAt: new Date(text(input.source.observedAt, 'source.observedAt')).toISOString()
    },
    privateTags: list(input.privateTags, 'privateTags', 100),
    privateNotes: list(input.privateNotes, 'privateNotes', 100),
    favorite: input.favorite ?? false,
    ...(optionalText(input.headline, 'headline', 300) ? { headline: optionalText(input.headline, 'headline', 300) } : {}),
    sellingPoints: list(input.sellingPoints, 'sellingPoints', 20),
    aiTags: list(input.aiTags, 'aiTags', 50),
    ...(optionalText(input.showcaseTemplateReference, 'showcaseTemplateReference')
      ? { showcaseTemplateReference: optionalText(input.showcaseTemplateReference, 'showcaseTemplateReference') }
      : {}),
    mediaAssetReferences: list(input.mediaAssetReferences, 'mediaAssetReferences', 50),
    customerRecommendationReferences: list(
      input.customerRecommendationReferences,
      'customerRecommendationReferences',
      100
    ),
    ...(optionalText(input.sharePreparationReference, 'sharePreparationReference')
      ? { sharePreparationReference: optionalText(input.sharePreparationReference, 'sharePreparationReference') }
      : {}),
    idempotencyKey: text(input.idempotencyKey, 'idempotencyKey', 300)
  } as const;
}

function parseOverlay(value: unknown): TrademarkAssetMarketplaceOverlay {
  if (!value || typeof value !== 'object') {
    throw new TrademarkAssetMarketplaceReferenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Stored Marketplace overlay is invalid.',
      500,
      true
    );
  }
  return clone(value as TrademarkAssetMarketplaceOverlay);
}

export class PostgresTrademarkAssetMarketplaceReferenceStore {
  constructor(
    private readonly transactionHost: LiteTransactionHost,
    private readonly queryClient: QueryClient,
    private readonly assetReader: TrademarkAssetMarketplaceReferenceAssetReader,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = randomUUID
  ) {}

  async get(
    workspaceId: string,
    trademarkAssetId: TrademarkAssetId
  ): Promise<Readonly<TrademarkAssetMarketplaceOverlay> | undefined> {
    const result = await this.queryClient.query(
      `SELECT document_json FROM lite_trademark_asset_marketplace_overlays
       WHERE workspace_id=$1 AND trademark_asset_id=$2`,
      [workspaceId.toLowerCase(), trademarkAssetId]
    );
    const row = (result.rows as Row[])[0];
    return row ? parseOverlay(row.document_json) : undefined;
  }

  async upsert(
    input: Readonly<UpsertTrademarkAssetMarketplaceOverlayInput>
  ): Promise<Readonly<TrademarkAssetMarketplaceOverlay>> {
    const command = normalize(input);
    const requestFingerprint = fingerprint(command);
    const asset = await this.assetReader.get(command.workspaceId, command.trademarkAssetId);
    if (asset.version !== command.expectedTrademarkAssetVersion) {
      throw new TrademarkAssetMarketplaceReferenceError(
        'ASSET_VERSION_CONFLICT',
        'Trademark Asset changed; refresh before editing its Marketplace overlay.'
      );
    }
    const marketplaceRelationship = asset.workspaceRelationships.find(
      (relationship) => relationship.kind === 'MARKETPLACE_ADDED'
    );
    if (!marketplaceRelationship || marketplaceRelationship.sourceAssetEditableByWorkspace) {
      throw new TrademarkAssetMarketplaceReferenceError(
        'RELATIONSHIP_CONFLICT',
        'Marketplace overlay requires a read-only MARKETPLACE_ADDED relationship.',
        403
      );
    }
    if (
      marketplaceRelationship.sourceAssetId &&
      marketplaceRelationship.sourceAssetId !== command.source.sourceAssetId
    ) {
      throw new TrademarkAssetMarketplaceReferenceError(
        'SOURCE_REFERENCE_CONFLICT',
        'Source asset does not match the Marketplace relationship.'
      );
    }

    return this.transactionHost.transact(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
        command.workspaceId,
        `marketplace-overlay:${command.trademarkAssetId}`
      ]);
      const replay = await client.query(
        `SELECT request_fingerprint_sha256,result_json
         FROM lite_trademark_asset_marketplace_commands
         WHERE workspace_id=$1 AND idempotency_key=$2`,
        [command.workspaceId, command.idempotencyKey]
      );
      const replayRow = (replay.rows as Row[])[0];
      if (replayRow) {
        if (replayRow.request_fingerprint_sha256 !== requestFingerprint) {
          throw new TrademarkAssetMarketplaceReferenceError(
            'IDEMPOTENCY_CONFLICT',
            'idempotencyKey was already used with a different Marketplace overlay request.'
          );
        }
        return parseOverlay(replayRow.result_json);
      }

      const assetVersionResult = await client.query(
        `SELECT version FROM lite_trademark_assets
         WHERE workspace_id=$1 AND trademark_asset_id=$2
         FOR SHARE`,
        [command.workspaceId, command.trademarkAssetId]
      );
      const assetVersionRow = (assetVersionResult.rows as Row[])[0];
      if (!assetVersionRow) {
        throw new TrademarkAssetMarketplaceReferenceError('NOT_FOUND', 'Trademark Asset was not found.', 404);
      }
      const exactAssetVersion = Number(assetVersionRow.version);
      if (exactAssetVersion !== command.expectedTrademarkAssetVersion) {
        throw new TrademarkAssetMarketplaceReferenceError(
          'ASSET_VERSION_CONFLICT',
          'Trademark Asset changed while saving its Marketplace overlay.'
        );
      }

      const currentResult = await client.query(
        `SELECT version,document_json,created_at
         FROM lite_trademark_asset_marketplace_overlays
         WHERE workspace_id=$1 AND trademark_asset_id=$2
         FOR UPDATE`,
        [command.workspaceId, command.trademarkAssetId]
      );
      const currentRow = (currentResult.rows as Row[])[0];
      const currentVersion = currentRow ? Number(currentRow.version) : undefined;
      if (currentVersion === undefined && command.expectedOverlayVersion !== undefined) {
        throw new TrademarkAssetMarketplaceReferenceError('VERSION_CONFLICT', 'Marketplace overlay does not exist yet.');
      }
      if (currentVersion !== undefined && command.expectedOverlayVersion !== currentVersion) {
        throw new TrademarkAssetMarketplaceReferenceError(
          'VERSION_CONFLICT',
          'Marketplace overlay changed; refresh before saving.'
        );
      }

      const timestamp = new Date(this.now()).toISOString();
      const marketplaceOverlayId = currentRow
        ? parseOverlay(currentRow.document_json).marketplaceOverlayId
        : overlayId(this.newId());
      const result: TrademarkAssetMarketplaceOverlay = {
        schemaVersion: 1,
        marketplaceOverlayId,
        workspaceId: command.workspaceId,
        trademarkAssetId: command.trademarkAssetId,
        trademarkAssetVersion: exactAssetVersion,
        version: (currentVersion ?? 0) + 1,
        source: command.source,
        privateTags: command.privateTags,
        privateNotes: command.privateNotes,
        favorite: command.favorite,
        ...(command.headline ? { headline: command.headline } : {}),
        sellingPoints: command.sellingPoints,
        aiTags: command.aiTags,
        ...(command.showcaseTemplateReference
          ? { showcaseTemplateReference: command.showcaseTemplateReference }
          : {}),
        mediaAssetReferences: command.mediaAssetReferences,
        customerRecommendationReferences: command.customerRecommendationReferences,
        ...(command.sharePreparationReference
          ? { sharePreparationReference: command.sharePreparationReference }
          : {}),
        localPriceOverrideAllowed: false,
        sourceListingMutableByWorkspace: false,
        sourceTrademarkFactsMutableByWorkspace: false,
        ownershipClaimCreatedByLite: false,
        marketplacePublicationCreatedByLite: false,
        transactionAuthorizedByLite: false,
        createdAt: currentRow ? new Date(String(currentRow.created_at)).toISOString() : timestamp,
        updatedAt: timestamp
      };
      await client.query(
        `INSERT INTO lite_trademark_asset_marketplace_overlays
          (workspace_id,trademark_asset_id,marketplace_overlay_id,version,source_asset_id,source_listing_id,source_listing_version,source_listing_fingerprint_sha256,document_fingerprint_sha256,document_json,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$11)
         ON CONFLICT (workspace_id,trademark_asset_id) DO UPDATE SET
          marketplace_overlay_id=EXCLUDED.marketplace_overlay_id,
          version=EXCLUDED.version,
          source_asset_id=EXCLUDED.source_asset_id,
          source_listing_id=EXCLUDED.source_listing_id,
          source_listing_version=EXCLUDED.source_listing_version,
          source_listing_fingerprint_sha256=EXCLUDED.source_listing_fingerprint_sha256,
          document_fingerprint_sha256=EXCLUDED.document_fingerprint_sha256,
          document_json=EXCLUDED.document_json,
          updated_at=EXCLUDED.updated_at`,
        [
          result.workspaceId,
          result.trademarkAssetId,
          result.marketplaceOverlayId,
          result.version,
          result.source.sourceAssetId,
          result.source.sourceListingId,
          result.source.sourceListingVersion,
          result.source.sourceListingFingerprintSha256 ?? null,
          fingerprint(result),
          JSON.stringify(result),
          timestamp
        ]
      );
      await client.query(
        `INSERT INTO lite_trademark_asset_marketplace_commands
          (workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at)
         VALUES ($1,$2,'UPSERT_MARKETPLACE_OVERLAY',$3,$4::jsonb,$5)`,
        [result.workspaceId, command.idempotencyKey, requestFingerprint, JSON.stringify(result), timestamp]
      );
      return clone(result);
    });
  }
}
