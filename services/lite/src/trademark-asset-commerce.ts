import { createHash, randomUUID } from 'node:crypto';
import {
  trademarkAssetSaleIntents,
  trademarkAssetSellerRoles,
  type TrademarkAssetCommerceProfile,
  type TrademarkAssetCommerceProfileId,
  type UpsertTrademarkAssetCommerceProfileInput
} from '@markorbit/contracts/trademark-asset-commerce';
import type {
  TrademarkAsset,
  TrademarkAssetId
} from '@markorbit/contracts/trademark-asset-workspace';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY = /^[A-Z]{3}$/;

type Row = Record<string, unknown>;

export type TrademarkAssetCommerceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'ASSET_VERSION_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'READ_ONLY_SOURCE'
  | 'PERSISTENCE_UNAVAILABLE';

export class TrademarkAssetCommerceError extends Error {
  constructor(
    readonly code: TrademarkAssetCommerceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TrademarkAssetCommerceError';
  }
}

export interface TrademarkAssetCommerceAssetReader {
  get(workspaceId: string, trademarkAssetId: TrademarkAssetId): Promise<Readonly<TrademarkAsset>>;
}

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const fingerprint = (value: unknown): string => hash(JSON.stringify(value));
const clone = <T>(value: T): T => structuredClone(value);

function createCommerceProfileId(value: string): TrademarkAssetCommerceProfileId {
  return `trademark-asset-commerce_${value}`;
}

function text(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new TrademarkAssetCommerceError(
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

function stringList(
  values: readonly string[] | undefined,
  field: string,
  maxItems = 100
): string[] {
  if (!values) return [];
  if (!Array.isArray(values) || values.length > maxItems) {
    throw new TrademarkAssetCommerceError(
      'INVALID_INPUT',
      `${field} must contain at most ${maxItems} values.`,
      400
    );
  }
  return [...new Set(values.map((value) => text(value, field, 300)))].sort();
}

function normalize(input: Readonly<UpsertTrademarkAssetCommerceProfileInput>) {
  if (!UUID.test(input.workspaceId)) {
    throw new TrademarkAssetCommerceError('INVALID_INPUT', 'workspaceId must be a UUID.', 400);
  }
  if (!input.trademarkAssetId.startsWith('trademark-asset_')) {
    throw new TrademarkAssetCommerceError('INVALID_INPUT', 'Invalid trademarkAssetId.', 400);
  }
  if (
    !Number.isInteger(input.expectedTrademarkAssetVersion) ||
    input.expectedTrademarkAssetVersion < 1
  ) {
    throw new TrademarkAssetCommerceError(
      'INVALID_INPUT',
      'expectedTrademarkAssetVersion must be a positive integer.',
      400
    );
  }
  if (
    input.expectedCommerceProfileVersion !== undefined &&
    (!Number.isInteger(input.expectedCommerceProfileVersion) ||
      input.expectedCommerceProfileVersion < 1)
  ) {
    throw new TrademarkAssetCommerceError(
      'INVALID_INPUT',
      'expectedCommerceProfileVersion must be a positive integer when provided.',
      400
    );
  }
  if (!trademarkAssetSaleIntents.includes(input.saleIntent)) {
    throw new TrademarkAssetCommerceError('INVALID_INPUT', 'Unknown saleIntent.', 400);
  }
  if (!trademarkAssetSellerRoles.includes(input.sellerRole)) {
    throw new TrademarkAssetCommerceError('INVALID_INPUT', 'Unknown sellerRole.', 400);
  }
  const askingPrice = input.askingPrice
    ? {
        amountMinor: input.askingPrice.amountMinor,
        currency: text(input.askingPrice.currency, 'askingPrice.currency', 3).toUpperCase()
      }
    : undefined;
  if (askingPrice) {
    if (!Number.isSafeInteger(askingPrice.amountMinor) || askingPrice.amountMinor < 0) {
      throw new TrademarkAssetCommerceError(
        'INVALID_INPUT',
        'askingPrice.amountMinor must be a non-negative safe integer.',
        400
      );
    }
    if (!CURRENCY.test(askingPrice.currency)) {
      throw new TrademarkAssetCommerceError(
        'INVALID_INPUT',
        'askingPrice.currency must be a three-letter currency code.',
        400
      );
    }
  }
  if (input.saleIntent === 'NOT_FOR_SALE' && askingPrice) {
    throw new TrademarkAssetCommerceError(
      'INVALID_INPUT',
      'askingPrice is not allowed while saleIntent is NOT_FOR_SALE.',
      400
    );
  }
  const headline = optionalText(input.headline, 'headline', 300);
  const showcaseTemplateReference = optionalText(
    input.showcaseTemplateReference,
    'showcaseTemplateReference',
    500
  );
  return {
    workspaceId: input.workspaceId.toLowerCase(),
    trademarkAssetId: input.trademarkAssetId,
    expectedTrademarkAssetVersion: input.expectedTrademarkAssetVersion,
    ...(input.expectedCommerceProfileVersion !== undefined
      ? { expectedCommerceProfileVersion: input.expectedCommerceProfileVersion }
      : {}),
    saleIntent: input.saleIntent,
    ...(askingPrice ? { askingPrice } : {}),
    negotiable: input.negotiable ?? false,
    saleTerritories: stringList(input.saleTerritories, 'saleTerritories').map((value) =>
      value.toUpperCase()
    ),
    sellerRole: input.sellerRole,
    ...(headline ? { headline } : {}),
    sellingPoints: stringList(input.sellingPoints, 'sellingPoints', 20),
    aiTags: stringList(input.aiTags, 'aiTags', 50),
    ...(showcaseTemplateReference ? { showcaseTemplateReference } : {}),
    mediaAssetReferences: stringList(input.mediaAssetReferences, 'mediaAssetReferences', 50),
    idempotencyKey: text(input.idempotencyKey, 'idempotencyKey', 300)
  } as const;
}

function parseProfile(value: unknown): TrademarkAssetCommerceProfile {
  if (!value || typeof value !== 'object') {
    throw new TrademarkAssetCommerceError(
      'PERSISTENCE_UNAVAILABLE',
      'Stored Commerce Profile is invalid.',
      500,
      true
    );
  }
  return clone(value as TrademarkAssetCommerceProfile);
}

export class PostgresTrademarkAssetCommerceStore {
  constructor(
    private readonly transactionHost: LiteTransactionHost,
    private readonly queryClient: QueryClient,
    private readonly assetReader: TrademarkAssetCommerceAssetReader,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = randomUUID
  ) {}

  async get(
    workspaceId: string,
    trademarkAssetId: TrademarkAssetId
  ): Promise<Readonly<TrademarkAssetCommerceProfile> | undefined> {
    const result = await this.queryClient.query(
      `SELECT document_json FROM lite_trademark_asset_commerce_profiles
       WHERE workspace_id=$1 AND trademark_asset_id=$2`,
      [workspaceId.toLowerCase(), trademarkAssetId]
    );
    const row = (result.rows as Row[])[0];
    return row ? parseProfile(row.document_json) : undefined;
  }

  async upsert(
    input: Readonly<UpsertTrademarkAssetCommerceProfileInput>
  ): Promise<Readonly<TrademarkAssetCommerceProfile>> {
    const command = normalize(input);
    const requestFingerprint = fingerprint(command);
    const asset = await this.assetReader.get(command.workspaceId, command.trademarkAssetId);
    if (asset.version !== command.expectedTrademarkAssetVersion) {
      throw new TrademarkAssetCommerceError(
        'ASSET_VERSION_CONFLICT',
        'Trademark Asset changed; refresh before editing its Commerce Profile.'
      );
    }
    const editableRelationship = asset.workspaceRelationships.some((relationship) =>
      ['OWNED', 'MANAGED', 'REPRESENTED'].includes(relationship.kind)
    );
    if (!editableRelationship) {
      throw new TrademarkAssetCommerceError(
        'READ_ONLY_SOURCE',
        'Marketplace-added Assets require the WP06 reseller overlay and cannot receive a source Commerce Profile here.',
        403
      );
    }

    return this.transactionHost.transact(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
        command.workspaceId,
        `commerce:${command.trademarkAssetId}`
      ]);
      const replay = await client.query(
        `SELECT request_fingerprint_sha256,result_json
         FROM lite_trademark_asset_commerce_commands
         WHERE workspace_id=$1 AND idempotency_key=$2`,
        [command.workspaceId, command.idempotencyKey]
      );
      const replayRow = (replay.rows as Row[])[0];
      if (replayRow) {
        if (replayRow.request_fingerprint_sha256 !== requestFingerprint) {
          throw new TrademarkAssetCommerceError(
            'IDEMPOTENCY_CONFLICT',
            'idempotencyKey was already used with a different Commerce Profile request.'
          );
        }
        return parseProfile(replayRow.result_json);
      }

      const assetVersionResult = await client.query(
        `SELECT version FROM lite_trademark_assets
         WHERE workspace_id=$1 AND trademark_asset_id=$2
         FOR SHARE`,
        [command.workspaceId, command.trademarkAssetId]
      );
      const assetVersionRow = (assetVersionResult.rows as Row[])[0];
      if (!assetVersionRow) {
        throw new TrademarkAssetCommerceError('NOT_FOUND', 'Trademark Asset was not found.', 404);
      }
      const exactAssetVersion = Number(assetVersionRow.version);
      if (exactAssetVersion !== command.expectedTrademarkAssetVersion) {
        throw new TrademarkAssetCommerceError(
          'ASSET_VERSION_CONFLICT',
          'Trademark Asset changed while saving its Commerce Profile; refresh and retry.'
        );
      }

      const currentResult = await client.query(
        `SELECT version,document_json,created_at
         FROM lite_trademark_asset_commerce_profiles
         WHERE workspace_id=$1 AND trademark_asset_id=$2
         FOR UPDATE`,
        [command.workspaceId, command.trademarkAssetId]
      );
      const currentRow = (currentResult.rows as Row[])[0];
      const currentVersion = currentRow ? Number(currentRow.version) : undefined;
      if (currentVersion === undefined && command.expectedCommerceProfileVersion !== undefined) {
        throw new TrademarkAssetCommerceError(
          'VERSION_CONFLICT',
          'Commerce Profile does not exist yet.'
        );
      }
      if (
        currentVersion !== undefined &&
        command.expectedCommerceProfileVersion !== currentVersion
      ) {
        throw new TrademarkAssetCommerceError(
          'VERSION_CONFLICT',
          'Commerce Profile changed; refresh before saving.'
        );
      }

      const timestamp = new Date(this.now()).toISOString();
      const commerceProfileId = currentRow
        ? parseProfile(currentRow.document_json).commerceProfileId
        : createCommerceProfileId(this.newId());
      const profile: TrademarkAssetCommerceProfile = {
        schemaVersion: 1,
        commerceProfileId,
        workspaceId: command.workspaceId,
        trademarkAssetId: command.trademarkAssetId,
        trademarkAssetVersion: exactAssetVersion,
        version: (currentVersion ?? 0) + 1,
        saleIntent: command.saleIntent,
        ...(command.askingPrice ? { askingPrice: command.askingPrice } : {}),
        negotiable: command.negotiable,
        saleTerritories: command.saleTerritories,
        sellerRole: command.sellerRole,
        ...(command.headline ? { headline: command.headline } : {}),
        sellingPoints: command.sellingPoints,
        aiTags: command.aiTags,
        ...(command.showcaseTemplateReference
          ? { showcaseTemplateReference: command.showcaseTemplateReference }
          : {}),
        mediaAssetReferences: command.mediaAssetReferences,
        marketplaceListingCreatedByLite: false,
        sourceTrademarkFactsMutatedByLite: false,
        createdAt: currentRow ? new Date(String(currentRow.created_at)).toISOString() : timestamp,
        updatedAt: timestamp
      };
      const documentFingerprint = fingerprint(profile);
      await client.query(
        `INSERT INTO lite_trademark_asset_commerce_profiles
          (workspace_id,trademark_asset_id,commerce_profile_id,version,document_fingerprint_sha256,document_json,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)
         ON CONFLICT (workspace_id,trademark_asset_id) DO UPDATE SET
          commerce_profile_id=EXCLUDED.commerce_profile_id,
          version=EXCLUDED.version,
          document_fingerprint_sha256=EXCLUDED.document_fingerprint_sha256,
          document_json=EXCLUDED.document_json,
          updated_at=EXCLUDED.updated_at`,
        [
          profile.workspaceId,
          profile.trademarkAssetId,
          profile.commerceProfileId,
          profile.version,
          documentFingerprint,
          JSON.stringify(profile),
          timestamp
        ]
      );
      await client.query(
        `INSERT INTO lite_trademark_asset_commerce_commands
          (workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at)
         VALUES ($1,$2,'UPSERT_COMMERCE_PROFILE',$3,$4::jsonb,$5)`,
        [
          profile.workspaceId,
          command.idempotencyKey,
          requestFingerprint,
          JSON.stringify(profile),
          timestamp
        ]
      );
      return clone(profile);
    });
  }
}
