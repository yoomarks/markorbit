import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  assertTradingListingDraftV1,
  assertTradingPublishedListingV1,
  tradingListingReviewStates,
  type TradingListingDraftId,
  type TradingListingDraftV1,
  type TradingListingPublishReviewV1,
  type TradingPublishedListingV1
} from '@markorbit/contracts';
import type { ProductLoopExactReference } from '@markorbit/contracts/product-loop';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DRAFT_ID = /^trading-listing-draft_[A-Za-z0-9_-]+$/u;
const REVIEW_ID = /^trading-listing-review_[A-Za-z0-9_-]+$/u;
const LISTING_ID = /^trading-listing_[A-Za-z0-9_-]+$/u;

export type TradingListingReviewId = `trading-listing-review_${string}`;

export interface TradingListingReviewRecordV1 {
  schemaVersion: 1;
  listingReviewId: TradingListingReviewId;
  workspaceId: string;
  version: number;
  reviewedDraft: Readonly<ProductLoopExactReference<TradingListingDraftId>>;
  review: Readonly<TradingListingPublishReviewV1>;
}

export type TradingListingPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class TradingListingPersistenceError extends Error {
  constructor(
    readonly code: TradingListingPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TradingListingPersistenceError';
  }
}

export interface SaveTradingListingDraftCommand {
  draft: Readonly<TradingListingDraftV1>;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface SaveTradingListingReviewCommand {
  reviewRecord: Readonly<TradingListingReviewRecordV1>;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface SaveTradingPublishedListingCommand {
  listing: Readonly<TradingPublishedListingV1>;
  review: Readonly<ProductLoopExactReference<TradingListingReviewId>>;
  expectedVersion: number;
  idempotencyKey: string;
}

type Row = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);
const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function workspaceId(value: string): string {
  if (!UUID.test(value))
    throw new TradingListingPersistenceError('INVALID_INPUT', 'workspaceId must be a UUID.', 400);
  return value.toLowerCase();
}

function required(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 300)
    throw new TradingListingPersistenceError(
      'INVALID_INPUT',
      `${field} must contain 1 to 300 characters.`,
      400
    );
  return cleaned;
}

function expectedVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TradingListingPersistenceError(
      'INVALID_INPUT',
      'expectedVersion must be a non-negative integer.',
      400
    );
  return value;
}

function positiveVersion(value: number, field = 'version'): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new TradingListingPersistenceError(
      'INVALID_INPUT',
      `${field} must be a positive integer.`,
      400
    );
  return value;
}

function draftId(value: string): TradingListingDraftId {
  if (!DRAFT_ID.test(value))
    throw new TradingListingPersistenceError('INVALID_INPUT', 'listingDraftId is invalid.', 400);
  return value as TradingListingDraftId;
}

function reviewId(value: string): TradingListingReviewId {
  if (!REVIEW_ID.test(value))
    throw new TradingListingPersistenceError('INVALID_INPUT', 'listingReviewId is invalid.', 400);
  return value as TradingListingReviewId;
}

function listingId(value: string): string {
  if (!LISTING_ID.test(value) || DRAFT_ID.test(value))
    throw new TradingListingPersistenceError('INVALID_INPUT', 'listingId is invalid.', 400);
  return value;
}

function exactReference(
  reference: Readonly<ProductLoopExactReference> | undefined,
  field: string
): void {
  if (!reference) {
    throw new TradingListingPersistenceError('INVALID_INPUT', `${field} is required.`, 400);
  }
  required(reference.id, `${field}.id`);
  if (
    (typeof reference.version === 'number' &&
      (!Number.isSafeInteger(reference.version) || reference.version < 1)) ||
    (typeof reference.version === 'string' && !reference.version.trim())
  ) {
    throw new TradingListingPersistenceError(
      'INVALID_INPUT',
      `${field}.version must identify an exact version.`,
      400
    );
  }
}

function assertDraftInput(draft: Readonly<TradingListingDraftV1>): void {
  try {
    assertTradingListingDraftV1(draft);
  } catch (error) {
    throw new TradingListingPersistenceError(
      'INVALID_INPUT',
      'Listing Draft contract validation failed.',
      400,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function assertReviewInput(record: Readonly<TradingListingReviewRecordV1>): void {
  if (record.schemaVersion !== 1)
    throw new TradingListingPersistenceError(
      'INVALID_INPUT',
      'review schemaVersion must be 1.',
      400
    );
  reviewId(record.listingReviewId);
  workspaceId(record.workspaceId);
  positiveVersion(record.version, 'review.version');
  exactReference(record.reviewedDraft, 'reviewedDraft');
  draftId(record.reviewedDraft.id);
  if (typeof record.reviewedDraft.version !== 'number')
    throw new TradingListingPersistenceError(
      'INVALID_INPUT',
      'reviewedDraft.version must be numeric.',
      400
    );
  positiveVersion(record.reviewedDraft.version, 'reviewedDraft.version');
  exactReference(record.review.reviewedTrademarkAsset, 'review.reviewedTrademarkAsset');
  exactReference(record.review.reviewedCommercialDirection, 'review.reviewedCommercialDirection');
  exactReference(record.review.reviewedShowcase, 'review.reviewedShowcase');
  if (!tradingListingReviewStates.includes(record.review.reviewState))
    throw new TradingListingPersistenceError(
      'INVALID_INPUT',
      'review.reviewState is invalid.',
      400
    );
  required(record.review.reviewedAt, 'review.reviewedAt');
  if (
    record.review.humanApprovalReference !== undefined &&
    !record.review.humanApprovalReference.trim()
  )
    throw new TradingListingPersistenceError(
      'INVALID_INPUT',
      'review.humanApprovalReference cannot be blank.',
      400
    );
}

function assertPublishedInput(listing: Readonly<TradingPublishedListingV1>): void {
  try {
    assertTradingPublishedListingV1(listing);
  } catch (error) {
    throw new TradingListingPersistenceError(
      'INVALID_INPUT',
      'Published Listing contract validation failed.',
      400,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function parseDraft(value: unknown): TradingListingDraftV1 {
  try {
    const draft = clone(value as TradingListingDraftV1);
    assertTradingListingDraftV1(draft);
    workspaceId(draft.workspaceId);
    draftId(draft.listingDraftId);
    return draft;
  } catch (error) {
    if (error instanceof TradingListingPersistenceError && error.code === 'INTEGRITY_FAILURE')
      throw error;
    throw new TradingListingPersistenceError(
      'INTEGRITY_FAILURE',
      'Persisted Listing Draft failed integrity validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function parseReview(value: unknown): TradingListingReviewRecordV1 {
  try {
    const record = clone(value as TradingListingReviewRecordV1);
    assertReviewInput(record);
    return record;
  } catch (error) {
    throw new TradingListingPersistenceError(
      'INTEGRITY_FAILURE',
      'Persisted Listing Review failed integrity validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function parsePublished(value: unknown): TradingPublishedListingV1 {
  try {
    const listing = clone(value as TradingPublishedListingV1);
    assertTradingPublishedListingV1(listing);
    workspaceId(listing.publishedDraftSnapshot.workspaceId);
    listingId(listing.listingId);
    return listing;
  } catch (error) {
    throw new TradingListingPersistenceError(
      'INTEGRITY_FAILURE',
      'Persisted Published Listing failed integrity validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function matchesReviewToDraft(
  review: Readonly<TradingListingPublishReviewV1>,
  draft: Readonly<TradingListingDraftV1>
): boolean {
  return (
    review.reviewedTrademarkAsset.id === draft.trademarkAsset.id &&
    review.reviewedTrademarkAsset.version === draft.trademarkAsset.version &&
    review.reviewedCommercialDirection.id === draft.commercialDirection.id &&
    review.reviewedCommercialDirection.version === draft.commercialDirection.version &&
    review.reviewedShowcase.id === draft.showcase.id &&
    review.reviewedShowcase.version === draft.showcase.version
  );
}

export class PostgresTradingListingStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async saveDraft(
    command: Readonly<SaveTradingListingDraftCommand>
  ): Promise<TradingListingDraftV1> {
    let draft = clone(command.draft);
    assertDraftInput(draft);
    const workspace = workspaceId(draft.workspaceId);
    draft = { ...draft, workspaceId: workspace };
    const id = draftId(draft.listingDraftId);
    const expected = expectedVersion(command.expectedVersion);
    if (draft.version !== expected + 1)
      throw new TradingListingPersistenceError(
        'VERSION_CONFLICT',
        'Listing Draft version must immediately follow expectedVersion.'
      );
    const idempotencyKey = required(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint({ draft, expectedVersion: expected });

    return this.persist(async (client) => {
      await this.lock(client, workspace, 'draft', id);
      const replay = await this.replay<TradingListingDraftV1>(
        client,
        'lite_trading_listing_draft_versions',
        workspace,
        idempotencyKey,
        requestFingerprint,
        parseDraft
      );
      if (replay) return replay;
      const actual = await this.latestVersion(
        client,
        'lite_trading_listing_draft_versions',
        'listing_draft_id',
        workspace,
        id
      );
      if (actual !== expected)
        throw new TradingListingPersistenceError(
          'VERSION_CONFLICT',
          `Expected Listing Draft version ${expected}, found ${actual}.`
        );
      await client.query(
        `INSERT INTO lite_trading_listing_draft_versions(
           workspace_id,listing_draft_id,version,idempotency_key,
           request_fingerprint_sha256,document_json,recorded_at
         ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [
          workspace,
          id,
          draft.version,
          idempotencyKey,
          requestFingerprint,
          JSON.stringify(draft),
          new Date(this.now()).toISOString()
        ]
      );
      return clone(draft);
    });
  }

  async getDraftVersion(
    workspaceIdValue: string,
    listingDraftIdValue: TradingListingDraftId,
    version: number
  ): Promise<TradingListingDraftV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = draftId(listingDraftIdValue);
    positiveVersion(version);
    return this.readExact(
      `SELECT document_json FROM lite_trading_listing_draft_versions
        WHERE workspace_id=$1 AND listing_draft_id=$2 AND version=$3`,
      [workspace, id, version],
      'Listing Draft version was not found.',
      parseDraft
    );
  }

  async getLatestDraft(
    workspaceIdValue: string,
    listingDraftIdValue: TradingListingDraftId
  ): Promise<TradingListingDraftV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = draftId(listingDraftIdValue);
    return this.readExact(
      `SELECT document_json FROM lite_trading_listing_draft_versions
        WHERE workspace_id=$1 AND listing_draft_id=$2 ORDER BY version DESC LIMIT 1`,
      [workspace, id],
      'Listing Draft was not found.',
      parseDraft
    );
  }

  async saveReview(
    command: Readonly<SaveTradingListingReviewCommand>
  ): Promise<TradingListingReviewRecordV1> {
    let record = clone(command.reviewRecord);
    assertReviewInput(record);
    const workspace = workspaceId(record.workspaceId);
    record = { ...record, workspaceId: workspace };
    const id = reviewId(record.listingReviewId);
    const expected = expectedVersion(command.expectedVersion);
    if (record.version !== expected + 1)
      throw new TradingListingPersistenceError(
        'VERSION_CONFLICT',
        'Listing Review version must immediately follow expectedVersion.'
      );
    const idempotencyKey = required(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint({ reviewRecord: record, expectedVersion: expected });

    return this.persist(async (client) => {
      await this.lock(client, workspace, 'review', id);
      const replay = await this.replay<TradingListingReviewRecordV1>(
        client,
        'lite_trading_listing_review_versions',
        workspace,
        idempotencyKey,
        requestFingerprint,
        parseReview
      );
      if (replay) return replay;
      const actual = await this.latestVersion(
        client,
        'lite_trading_listing_review_versions',
        'listing_review_id',
        workspace,
        id
      );
      if (actual !== expected)
        throw new TradingListingPersistenceError(
          'VERSION_CONFLICT',
          `Expected Listing Review version ${expected}, found ${actual}.`
        );

      const draft = await this.readDraftWithClient(
        client,
        workspace,
        record.reviewedDraft.id,
        Number(record.reviewedDraft.version)
      );
      if (!matchesReviewToDraft(record.review, draft))
        throw new TradingListingPersistenceError(
          'VERSION_CONFLICT',
          'Listing Review must bind the exact persisted Draft truth, direction and Showcase versions.'
        );

      await client.query(
        `INSERT INTO lite_trading_listing_review_versions(
           workspace_id,listing_review_id,version,listing_draft_id,listing_draft_version,
           review_state,idempotency_key,request_fingerprint_sha256,document_json,recorded_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
        [
          workspace,
          id,
          record.version,
          record.reviewedDraft.id,
          record.reviewedDraft.version,
          record.review.reviewState,
          idempotencyKey,
          requestFingerprint,
          JSON.stringify(record),
          new Date(this.now()).toISOString()
        ]
      );
      return clone(record);
    });
  }

  async getReviewVersion(
    workspaceIdValue: string,
    listingReviewIdValue: TradingListingReviewId,
    version: number
  ): Promise<TradingListingReviewRecordV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = reviewId(listingReviewIdValue);
    positiveVersion(version);
    return this.readExact(
      `SELECT document_json FROM lite_trading_listing_review_versions
        WHERE workspace_id=$1 AND listing_review_id=$2 AND version=$3`,
      [workspace, id, version],
      'Listing Review version was not found.',
      parseReview
    );
  }

  async getLatestReview(
    workspaceIdValue: string,
    listingReviewIdValue: TradingListingReviewId
  ): Promise<TradingListingReviewRecordV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = reviewId(listingReviewIdValue);
    return this.readExact(
      `SELECT document_json FROM lite_trading_listing_review_versions
        WHERE workspace_id=$1 AND listing_review_id=$2 ORDER BY version DESC LIMIT 1`,
      [workspace, id],
      'Listing Review was not found.',
      parseReview
    );
  }

  async savePublishedListing(
    command: Readonly<SaveTradingPublishedListingCommand>
  ): Promise<TradingPublishedListingV1> {
    const listing = clone(command.listing);
    assertPublishedInput(listing);
    const workspace = workspaceId(listing.publishedDraftSnapshot.workspaceId);
    const id = listingId(listing.listingId);
    const expected = expectedVersion(command.expectedVersion);
    if (listing.version !== expected + 1)
      throw new TradingListingPersistenceError(
        'VERSION_CONFLICT',
        'Published Listing version must immediately follow expectedVersion.'
      );
    exactReference(command.review, 'review');
    const exactReviewId = reviewId(command.review.id);
    if (typeof command.review.version !== 'number')
      throw new TradingListingPersistenceError(
        'INVALID_INPUT',
        'review.version must be numeric.',
        400
      );
    const exactReviewVersion = positiveVersion(command.review.version, 'review.version');
    const idempotencyKey = required(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint({
      listing,
      review: { id: exactReviewId, version: exactReviewVersion },
      expectedVersion: expected
    });

    return this.persist(async (client) => {
      await this.lock(client, workspace, 'published', id);
      const replay = await this.replay<TradingPublishedListingV1>(
        client,
        'lite_trading_published_listing_versions',
        workspace,
        idempotencyKey,
        requestFingerprint,
        parsePublished
      );
      if (replay) return replay;
      const actual = await this.latestVersion(
        client,
        'lite_trading_published_listing_versions',
        'listing_id',
        workspace,
        id
      );
      if (actual !== expected)
        throw new TradingListingPersistenceError(
          'VERSION_CONFLICT',
          `Expected Published Listing version ${expected}, found ${actual}.`
        );

      const draftVersion =
        typeof listing.draft.version === 'number'
          ? positiveVersion(listing.draft.version, 'listing.draft.version')
          : NaN;
      if (!Number.isFinite(draftVersion))
        throw new TradingListingPersistenceError(
          'INVALID_INPUT',
          'listing.draft.version must be numeric.',
          400
        );
      const draft = await this.readDraftWithClient(
        client,
        workspace,
        draftId(listing.draft.id),
        draftVersion
      );
      if (!isDeepStrictEqual(draft, listing.publishedDraftSnapshot))
        throw new TradingListingPersistenceError(
          'VERSION_CONFLICT',
          'Published Listing snapshot must equal the exact persisted Draft version.'
        );

      const reviewRecord = await this.readReviewWithClient(
        client,
        workspace,
        exactReviewId,
        exactReviewVersion
      );
      if (
        reviewRecord.reviewedDraft.id !== listing.draft.id ||
        reviewRecord.reviewedDraft.version !== listing.draft.version ||
        !isDeepStrictEqual(reviewRecord.review, listing.publishReview)
      )
        throw new TradingListingPersistenceError(
          'VERSION_CONFLICT',
          'Published Listing must bind the exact persisted Listing Review and Draft.'
        );

      await client.query(
        `INSERT INTO lite_trading_published_listing_versions(
           workspace_id,listing_id,version,listing_draft_id,listing_draft_version,
           listing_review_id,listing_review_version,idempotency_key,
           request_fingerprint_sha256,document_json,recorded_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [
          workspace,
          id,
          listing.version,
          listing.draft.id,
          listing.draft.version,
          exactReviewId,
          exactReviewVersion,
          idempotencyKey,
          requestFingerprint,
          JSON.stringify(listing),
          new Date(this.now()).toISOString()
        ]
      );
      return clone(listing);
    });
  }

  async getPublishedListingVersion(
    workspaceIdValue: string,
    listingIdValue: string,
    version: number
  ): Promise<TradingPublishedListingV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = listingId(listingIdValue);
    positiveVersion(version);
    return this.readExact(
      `SELECT document_json FROM lite_trading_published_listing_versions
        WHERE workspace_id=$1 AND listing_id=$2 AND version=$3`,
      [workspace, id, version],
      'Published Listing version was not found.',
      parsePublished
    );
  }

  async getLatestPublishedListing(
    workspaceIdValue: string,
    listingIdValue: string
  ): Promise<TradingPublishedListingV1> {
    const workspace = workspaceId(workspaceIdValue);
    const id = listingId(listingIdValue);
    return this.readExact(
      `SELECT document_json FROM lite_trading_published_listing_versions
        WHERE workspace_id=$1 AND listing_id=$2 ORDER BY version DESC LIMIT 1`,
      [workspace, id],
      'Published Listing was not found.',
      parsePublished
    );
  }

  private async readDraftWithClient(
    client: QueryClient,
    workspace: string,
    id: TradingListingDraftId,
    version: number
  ): Promise<TradingListingDraftV1> {
    const result = await client.query(
      `SELECT document_json FROM lite_trading_listing_draft_versions
        WHERE workspace_id=$1 AND listing_draft_id=$2 AND version=$3`,
      [workspace, id, version]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row)
      throw new TradingListingPersistenceError(
        'NOT_FOUND',
        'Referenced Listing Draft version was not found.',
        404
      );
    return parseDraft(row.document_json);
  }

  private async readReviewWithClient(
    client: QueryClient,
    workspace: string,
    id: TradingListingReviewId,
    version: number
  ): Promise<TradingListingReviewRecordV1> {
    const result = await client.query(
      `SELECT document_json FROM lite_trading_listing_review_versions
        WHERE workspace_id=$1 AND listing_review_id=$2 AND version=$3`,
      [workspace, id, version]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row)
      throw new TradingListingPersistenceError(
        'NOT_FOUND',
        'Referenced Listing Review version was not found.',
        404
      );
    return parseReview(row.document_json);
  }

  private async replay<T>(
    client: QueryClient,
    table: string,
    workspace: string,
    idempotencyKey: string,
    requestFingerprint: string,
    parser: (value: unknown) => T
  ): Promise<T | undefined> {
    const result = await client.query(
      `SELECT request_fingerprint_sha256,document_json FROM ${table}
        WHERE workspace_id=$1 AND idempotency_key=$2`,
      [workspace, idempotencyKey]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return undefined;
    if (row.request_fingerprint_sha256 !== requestFingerprint)
      throw new TradingListingPersistenceError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used for a different Listing mutation.'
      );
    return parser(row.document_json);
  }

  private async latestVersion(
    client: QueryClient,
    table: string,
    idColumn: string,
    workspace: string,
    id: string
  ): Promise<number> {
    const result = await client.query(
      `SELECT version FROM ${table}
        WHERE workspace_id=$1 AND ${idColumn}=$2 ORDER BY version DESC LIMIT 1`,
      [workspace, id]
    );
    return result.rows[0] ? Number((result.rows[0] as Row).version) : 0;
  }

  private async lock(
    client: QueryClient,
    workspace: string,
    kind: string,
    id: string
  ): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `${workspace}:trading-listing:${kind}:${id}`
    ]);
  }

  private async readExact<T>(
    sql: string,
    params: readonly unknown[],
    notFoundMessage: string,
    parser: (value: unknown) => T
  ): Promise<T> {
    try {
      const result = await this.query.query(sql, [...params]);
      const row = result.rows[0] as Row | undefined;
      if (!row) throw new TradingListingPersistenceError('NOT_FOUND', notFoundMessage, 404);
      return parser(row.document_json);
    } catch (error) {
      if (error instanceof TradingListingPersistenceError) throw error;
      throw new TradingListingPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Trading Listing persistence is unavailable.',
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
      if (error instanceof TradingListingPersistenceError) throw error;
      throw new TradingListingPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Trading Listing persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
