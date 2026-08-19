import type {
  TrademarkAssetBulkImportResult,
  TrademarkAssetBulkTagResult,
  TrademarkAssetPortfolioFilter,
  TrademarkAssetPortfolioPage
} from '@markorbit/contracts/trademark-asset-portfolio';
import type {
  TrademarkAsset,
  TrademarkAssetId,
  TrademarkAssetWorkspaceRelationshipKind
} from '@markorbit/contracts/trademark-asset-workspace';
import type { QueryClient } from '@markorbit/persistence';
import {
  PostgresLiteTrademarkAssetStore,
  TrademarkAssetPersistenceError,
  type AdmitTrademarkAssetCommand
} from './trademark-asset.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PortfolioCursorPayload {
  updatedAt: string;
  trademarkAssetId: TrademarkAssetId;
}

export interface SearchTrademarkAssetPortfolioInput {
  workspaceId: string;
  filter?: Readonly<TrademarkAssetPortfolioFilter>;
  cursor?: string;
  limit?: number;
}

export interface BulkImportTrademarkAssetsInput {
  workspaceId: string;
  batchKey: string;
  items: ReadonlyArray<Omit<AdmitTrademarkAssetCommand, 'workspaceId' | 'idempotencyKey'>>;
}

export interface BulkTagTrademarkAssetsInput {
  workspaceId: string;
  batchKey: string;
  trademarkAssetIds: readonly TrademarkAssetId[];
  addTags?: readonly string[];
  removeTags?: readonly string[];
}

type Row = Record<string, unknown>;

function cleanWorkspaceId(value: string): string {
  if (!UUID.test(value)) {
    throw new TrademarkAssetPersistenceError('INVALID_INPUT', 'workspaceId must be a UUID.', 400);
  }
  return value.toLowerCase();
}

function cleanText(value: string | undefined, field: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      `${field} must be a non-empty string of at most ${max} characters.`,
      400
    );
  }
  return cleaned;
}

function cleanList(values: readonly string[] | undefined, field: string, maxItems = 100): string[] {
  if (!values) return [];
  if (!Array.isArray(values) || values.length > maxItems) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      `${field} must contain at most ${maxItems} values.`,
      400
    );
  }
  const cleaned = values.map((value) => cleanText(value, field, 300));
  return [...new Set(cleaned.filter((value): value is string => Boolean(value)))].sort();
}

function encodeCursor(cursor: PortfolioCursorPayload): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string | undefined): PortfolioCursorPayload | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<PortfolioCursorPayload>;
    if (
      typeof parsed.updatedAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.updatedAt)) ||
      typeof parsed.trademarkAssetId !== 'string' ||
      !parsed.trademarkAssetId.startsWith('trademark-asset_')
    ) {
      throw new Error('invalid cursor');
    }
    return {
      updatedAt: new Date(parsed.updatedAt).toISOString(),
      trademarkAssetId: parsed.trademarkAssetId as TrademarkAssetId
    };
  } catch {
    throw new TrademarkAssetPersistenceError('INVALID_INPUT', 'cursor is invalid.', 400);
  }
}

function cleanRelationshipKinds(
  values: readonly TrademarkAssetWorkspaceRelationshipKind[] | undefined
): TrademarkAssetWorkspaceRelationshipKind[] {
  if (!values) return [];
  const allowed: readonly TrademarkAssetWorkspaceRelationshipKind[] = [
    'OWNED',
    'MANAGED',
    'REPRESENTED',
    'MARKETPLACE_ADDED'
  ];
  const cleaned = [...new Set(values)];
  if (cleaned.some((value) => !allowed.includes(value))) {
    throw new TrademarkAssetPersistenceError(
      'INVALID_INPUT',
      'relationshipKinds contains an unsupported value.',
      400
    );
  }
  return cleaned.sort();
}

function rowAsset(row: Row): TrademarkAsset {
  return structuredClone(row.document_json as TrademarkAsset);
}

function sameTags(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export class TrademarkAssetPortfolioService {
  constructor(
    private readonly query: QueryClient,
    private readonly assets: PostgresLiteTrademarkAssetStore
  ) {}

  async search(
    input: Readonly<SearchTrademarkAssetPortfolioInput>
  ): Promise<TrademarkAssetPortfolioPage> {
    const workspaceId = cleanWorkspaceId(input.workspaceId);
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new TrademarkAssetPersistenceError(
        'INVALID_INPUT',
        'limit must be an integer between 1 and 100.',
        400
      );
    }

    const queryText = cleanText(input.filter?.query, 'filter.query', 300)?.toLowerCase();
    const jurisdictions = cleanList(input.filter?.jurisdictions, 'filter.jurisdictions', 50).map(
      (value) => value.toUpperCase()
    );
    const relationshipKinds = cleanRelationshipKinds(input.filter?.relationshipKinds);
    const workspaceTags = cleanList(input.filter?.workspaceTags, 'filter.workspaceTags', 50);
    const ownerOrClientReference = cleanText(
      input.filter?.ownerOrClientReference,
      'filter.ownerOrClientReference',
      500
    );
    const cursor = decodeCursor(input.cursor);

    const params: unknown[] = [workspaceId];
    const conditions = ['workspace_id=$1'];
    const addParam = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    if (queryText) {
      const parameter = addParam(`%${queryText}%`);
      conditions.push(`(
        lower(coalesce(document_json->'identity'->>'markText','')) LIKE ${parameter}
        OR lower(coalesce(document_json->>'workspaceAlias','')) LIKE ${parameter}
        OR lower(coalesce(document_json->>'ownerOrClientReference','')) LIKE ${parameter}
        OR lower(coalesce(document_json->'externalIdentifiers','[]'::jsonb)::text) LIKE ${parameter}
      )`);
    }
    if (jurisdictions.length > 0) {
      const parameter = addParam(jurisdictions);
      conditions.push(`upper(document_json->'identity'->>'jurisdiction') = ANY(${parameter}::text[])`);
    }
    if (relationshipKinds.length > 0) {
      const parameter = addParam(relationshipKinds);
      conditions.push(`EXISTS (
        SELECT 1
          FROM jsonb_array_elements(coalesce(document_json->'workspaceRelationships','[]'::jsonb)) relation
         WHERE relation->>'kind' = ANY(${parameter}::text[])
      )`);
    }
    if (workspaceTags.length > 0) {
      const parameter = addParam(workspaceTags);
      conditions.push(`coalesce(document_json->'workspaceTags','[]'::jsonb) ?| ${parameter}::text[]`);
    }
    if (ownerOrClientReference) {
      const parameter = addParam(ownerOrClientReference.toLowerCase());
      conditions.push(`lower(coalesce(document_json->>'ownerOrClientReference','')) = ${parameter}`);
    }
    if (cursor) {
      const updatedAt = addParam(cursor.updatedAt);
      const assetId = addParam(cursor.trademarkAssetId);
      conditions.push(`(updated_at,trademark_asset_id) < (${updatedAt}::timestamptz,${assetId})`);
    }

    const fetchLimit = addParam(limit + 1);
    try {
      const result = await this.query.query(
        `SELECT document_json,updated_at,trademark_asset_id
           FROM lite_trademark_assets
          WHERE ${conditions.join(' AND ')}
          ORDER BY updated_at DESC,trademark_asset_id DESC
          LIMIT ${fetchLimit}`,
        params
      );
      const rows = result.rows as Row[];
      const hasMore = rows.length > limit;
      const visible = rows.slice(0, limit);
      const assets = visible.map(rowAsset);
      const last = visible.at(-1);
      return {
        schemaVersion: 1,
        workspaceId,
        assets,
        ...(hasMore && last
          ? {
              nextCursor: encodeCursor({
                updatedAt: new Date(String(last.updated_at)).toISOString(),
                trademarkAssetId: String(last.trademark_asset_id) as TrademarkAssetId
              })
            }
          : {}),
        hasMore,
        officialTruthVerifiedByLite: false
      };
    } catch (error) {
      if (error instanceof TrademarkAssetPersistenceError) throw error;
      throw new TrademarkAssetPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Trademark Asset Portfolio search is unavailable.',
        503,
        true,
        { cause: error }
      );
    }
  }

  async bulkImport(
    input: Readonly<BulkImportTrademarkAssetsInput>
  ): Promise<TrademarkAssetBulkImportResult> {
    const workspaceId = cleanWorkspaceId(input.workspaceId);
    const batchKey = cleanText(input.batchKey, 'batchKey', 300);
    if (!batchKey) {
      throw new TrademarkAssetPersistenceError('INVALID_INPUT', 'batchKey is required.', 400);
    }
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) {
      throw new TrademarkAssetPersistenceError(
        'INVALID_INPUT',
        'bulk import requires between 1 and 100 assets.',
        400
      );
    }

    const items: TrademarkAssetBulkImportResult['items'][number][] = [];
    for (const [index, item] of input.items.entries()) {
      try {
        const asset = await this.assets.admit({
          ...item,
          workspaceId,
          idempotencyKey: `${batchKey}:import:${index}`
        });
        items.push({ importIndex: index, status: 'CREATED', trademarkAssetId: asset.trademarkAssetId });
      } catch (error) {
        if (error instanceof TrademarkAssetPersistenceError && error.code === 'IDENTIFIER_CONFLICT') {
          items.push({ importIndex: index, status: 'DUPLICATE', reason: error.message });
          continue;
        }
        if (error instanceof TrademarkAssetPersistenceError && error.status < 500) {
          items.push({ importIndex: index, status: 'REJECTED', reason: error.message });
          continue;
        }
        throw error;
      }
    }

    return {
      schemaVersion: 1,
      workspaceId,
      total: items.length,
      created: items.filter((item) => item.status === 'CREATED').length,
      duplicates: items.filter((item) => item.status === 'DUPLICATE').length,
      rejected: items.filter((item) => item.status === 'REJECTED').length,
      items,
      officialTruthVerifiedByLite: false,
      matterCreatedAutomatically: false
    };
  }

  async bulkTag(input: Readonly<BulkTagTrademarkAssetsInput>): Promise<TrademarkAssetBulkTagResult> {
    const workspaceId = cleanWorkspaceId(input.workspaceId);
    const batchKey = cleanText(input.batchKey, 'batchKey', 300);
    if (!batchKey) {
      throw new TrademarkAssetPersistenceError('INVALID_INPUT', 'batchKey is required.', 400);
    }
    const assetIds = [...new Set(input.trademarkAssetIds)];
    if (assetIds.length < 1 || assetIds.length > 100) {
      throw new TrademarkAssetPersistenceError(
        'INVALID_INPUT',
        'bulk tag requires between 1 and 100 Trademark Assets.',
        400
      );
    }
    const addTags = cleanList(input.addTags, 'addTags', 50);
    const removeTags = new Set(cleanList(input.removeTags, 'removeTags', 50));
    if (addTags.length === 0 && removeTags.size === 0) {
      throw new TrademarkAssetPersistenceError(
        'INVALID_INPUT',
        'bulk tag requires at least one tag to add or remove.',
        400
      );
    }

    const items: TrademarkAssetBulkTagResult['items'][number][] = [];
    for (const trademarkAssetId of assetIds) {
      try {
        const current = await this.assets.get(workspaceId, trademarkAssetId);
        const nextTags = [...new Set([...current.workspaceTags.filter((tag) => !removeTags.has(tag)), ...addTags])].sort();
        if (sameTags(current.workspaceTags, nextTags)) {
          items.push({ trademarkAssetId, status: 'UPDATED', version: current.version });
          continue;
        }
        const updated = await this.assets.updateWorkspaceMetadata({
          workspaceId,
          trademarkAssetId,
          expectedVersion: current.version,
          workspaceTags: nextTags,
          workspaceNotes: current.workspaceNotes,
          ...(current.ownerOrClientReference
            ? { ownerOrClientReference: current.ownerOrClientReference }
            : {}),
          ...(current.workspacePriority ? { workspacePriority: current.workspacePriority } : {}),
          ...(current.workspaceAlias ? { workspaceAlias: current.workspaceAlias } : {}),
          idempotencyKey: `${batchKey}:tag:${trademarkAssetId}:${current.version}`
        });
        items.push({ trademarkAssetId, status: 'UPDATED', version: updated.version });
      } catch (error) {
        if (error instanceof TrademarkAssetPersistenceError) {
          const status =
            error.code === 'NOT_FOUND'
              ? 'NOT_FOUND'
              : error.code === 'VERSION_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT'
                ? 'CONFLICT'
                : error.status < 500
                  ? 'REJECTED'
                  : undefined;
          if (status) {
            items.push({ trademarkAssetId, status, reason: error.message });
            continue;
          }
        }
        throw error;
      }
    }

    return {
      schemaVersion: 1,
      workspaceId,
      requested: assetIds.length,
      updated: items.filter((item) => item.status === 'UPDATED').length,
      items,
      marketplaceSourceMutated: false,
      officialTruthVerifiedByLite: false
    };
  }
}
