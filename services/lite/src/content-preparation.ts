import { createHash, randomUUID } from 'node:crypto';
import type { MarkOrbitId } from '@markorbit/contracts';
import {
  contentReviewOutcomes,
  productLoopSourceKinds,
  productLoopSourceOwners,
  type ContentDraft,
  type ContentDraftId,
  type ContentOpportunity,
  type ContentOpportunityId,
  type ContentReviewDecision,
  type ContentReviewDecisionId,
  type ContentReviewOutcome,
  type ProductLoopSourceKind,
  type ProductLoopSourceOwner,
  type ProductLoopSourceReference,
  type PublishPackage,
  type PublishPackageId,
  type TodayRecommendation,
  type TodayRecommendationId
} from '@markorbit/contracts/product-loop';
import type { QueryClient, TransactionOptions } from '@markorbit/persistence';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const MARKORBIT_ID = /^[^_\s]+_.+$/;
export const MAX_CONTENT_DRAFT_VERSIONS = 25;

export type LiteContentPreparationErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'STALE_SOURCE'
  | 'SOURCE_VERSION_MISMATCH'
  | 'SOURCE_FINGERPRINT_MISMATCH'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'PERSISTENCE_UNAVAILABLE';

export class LiteContentPreparationError extends Error {
  constructor(
    readonly code: LiteContentPreparationErrorCode,
    message: string,
    readonly status = 409,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'LiteContentPreparationError';
  }
}

export interface LiteTransactionHost {
  transact<T>(
    callback: (client: QueryClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;
}

export interface ProductLoopSourceLocator {
  owner: ProductLoopSourceOwner;
  kind: ProductLoopSourceKind;
  sourceId: string;
}

/**
 * Upstream source authority. Product commands provide only a locator; the
 * authoritative boundary supplies exact version/fingerprint provenance.
 */
export interface ProductLoopSourceAuthority {
  resolve(
    workspaceId: string,
    locator: Readonly<ProductLoopSourceLocator>
  ): Promise<Readonly<ProductLoopSourceReference>>;
}

export interface CreateTodayRecommendationCommand {
  workspaceId: string;
  title: string;
  explanation: string;
  sources: ReadonlyArray<Readonly<ProductLoopSourceLocator>>;
  idempotencyKey: string;
}

export interface AcceptContentOpportunityCommand {
  workspaceId: string;
  recommendation: Readonly<{ id: TodayRecommendationId; version: number }>;
  expectedRecommendationFingerprintSha256: string;
  title: string;
  rationale: string;
  idempotencyKey: string;
}

export interface CreateContentDraftCommand {
  workspaceId: string;
  contentOpportunity: Readonly<{ id: ContentOpportunityId; version: number }>;
  expectedContentOpportunityFingerprintSha256: string;
  title: string;
  body: string;
  idempotencyKey: string;
}

export interface ReviseContentDraftCommand {
  workspaceId: string;
  contentDraftId: ContentDraftId;
  expectedVersion: number;
  expectedContentDraftFingerprintSha256: string;
  title: string;
  body: string;
  idempotencyKey: string;
}

export interface MarkContentDraftReadyForReviewCommand {
  workspaceId: string;
  contentDraftId: ContentDraftId;
  expectedVersion: number;
  expectedContentDraftFingerprintSha256: string;
  idempotencyKey: string;
}

export interface RecordContentReviewCommand {
  workspaceId: string;
  contentDraft: Readonly<{ id: ContentDraftId; version: number }>;
  expectedContentDraftFingerprintSha256: string;
  outcome: ContentReviewOutcome;
  reviewerPrincipalId: MarkOrbitId;
  rationale: string;
  idempotencyKey: string;
}

export interface PreparePublishPackageCommand {
  workspaceId: string;
  contentDraft: Readonly<{ id: ContentDraftId; version: number }>;
  expectedContentDraftFingerprintSha256: string;
  reviewDecision: Readonly<{ id: ContentReviewDecisionId; version: number }>;
  idempotencyKey: string;
}

type Row = Record<string, unknown>;

type CommandType =
  | 'CREATE_RECOMMENDATION'
  | 'ACCEPT_CONTENT_OPPORTUNITY'
  | 'CREATE_CONTENT_DRAFT'
  | 'REVISE_CONTENT_DRAFT'
  | 'MARK_CONTENT_DRAFT_READY_FOR_REVIEW'
  | 'RECORD_CONTENT_REVIEW'
  | 'PREPARE_PUBLISH_PACKAGE';

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new LiteContentPreparationError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned)
    throw new LiteContentPreparationError('INVALID_INPUT', `${field} is required.`, 422);
  if (cleaned.length > maximum)
    throw new LiteContentPreparationError(
      'INVALID_INPUT',
      `${field} exceeds the allowed length.`,
      422
    );
  return cleaned;
}

function cleanIdempotencyKey(value: string): string {
  return cleanText(value, 'idempotencyKey', 300);
}

function cleanMarkOrbitId(value: MarkOrbitId, field: string): MarkOrbitId {
  const cleaned = value.trim() as MarkOrbitId;
  if (!MARKORBIT_ID.test(cleaned))
    throw new LiteContentPreparationError('INVALID_INPUT', `${field} is invalid.`, 422);
  return cleaned;
}

function exactVersion(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1)
    throw new LiteContentPreparationError(
      'INVALID_INPUT',
      `${field} must be a positive integer.`,
      422
    );
  return value;
}

function exactSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!SHA256.test(cleaned))
    throw new LiteContentPreparationError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function exactTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new LiteContentPreparationError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  return parsed.toISOString();
}

function nextId<T extends string>(prefix: string): T {
  return `${prefix}_${randomUUID().replaceAll('-', '')}` as T;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function rowDocument<T>(row: Row | undefined, field = 'document_json'): T | undefined {
  return row ? clone(row[field] as T) : undefined;
}

function recommendationWithFingerprint(
  value: Omit<TodayRecommendation, 'recommendationFingerprintSha256'>
): TodayRecommendation {
  return { ...value, recommendationFingerprintSha256: fingerprint(value) };
}

function opportunityWithFingerprint(
  value: Omit<ContentOpportunity, 'contentOpportunityFingerprintSha256'>
): ContentOpportunity {
  return { ...value, contentOpportunityFingerprintSha256: fingerprint(value) };
}

function draftWithFingerprint(
  value: Omit<ContentDraft, 'contentDraftFingerprintSha256'>
): ContentDraft {
  return { ...value, contentDraftFingerprintSha256: fingerprint(value) };
}

function packageWithFingerprint(
  value: Omit<PublishPackage, 'publishPackageFingerprintSha256'>
): PublishPackage {
  return { ...value, publishPackageFingerprintSha256: fingerprint(value) };
}

function normalizeSource(
  locator: Readonly<ProductLoopSourceLocator>,
  value: Readonly<ProductLoopSourceReference>
): ProductLoopSourceReference {
  if (
    !productLoopSourceOwners.includes(value.owner) ||
    !productLoopSourceKinds.includes(value.kind)
  )
    throw new LiteContentPreparationError(
      'STALE_SOURCE',
      'The source authority returned an unsupported Product-loop source.'
    );
  if (
    value.owner !== locator.owner ||
    value.kind !== locator.kind ||
    value.sourceId !== locator.sourceId
  )
    throw new LiteContentPreparationError(
      'STALE_SOURCE',
      'The source authority returned a different source than requested.'
    );
  const sourceId = cleanText(value.sourceId, 'sourceId', 500);
  const sourceVersion =
    typeof value.sourceVersion === 'number'
      ? exactVersion(value.sourceVersion, 'sourceVersion')
      : cleanText(String(value.sourceVersion), 'sourceVersion', 300);
  return {
    schemaVersion: 1,
    owner: value.owner,
    kind: value.kind,
    sourceId,
    sourceVersion,
    sourceFingerprintSha256: exactSha256(value.sourceFingerprintSha256, 'sourceFingerprintSha256'),
    observedAt: exactTimestamp(value.observedAt, 'observedAt'),
    ...(value.correlationId
      ? { correlationId: cleanMarkOrbitId(value.correlationId, 'correlationId') }
      : {})
  };
}

export class PostgresLiteContentPreparationStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly sourceAuthority: ProductLoopSourceAuthority,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly ids: Readonly<{
      recommendation: () => TodayRecommendationId;
      opportunity: () => ContentOpportunityId;
      draft: () => ContentDraftId;
      review: () => ContentReviewDecisionId;
      publishPackage: () => PublishPackageId;
    }> = {
      recommendation: () => nextId<TodayRecommendationId>('today-recommendation'),
      opportunity: () => nextId<ContentOpportunityId>('content-opportunity'),
      draft: () => nextId<ContentDraftId>('content-draft'),
      review: () => nextId<ContentReviewDecisionId>('content-review-decision'),
      publishPackage: () => nextId<PublishPackageId>('publish-package')
    }
  ) {}

  async createRecommendation(
    command: Readonly<CreateTodayRecommendationCommand>
  ): Promise<TodayRecommendation> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const title = cleanText(command.title, 'title', 500);
    const explanation = cleanText(command.explanation, 'explanation', 4000);
    const idempotencyKey = cleanIdempotencyKey(command.idempotencyKey);
    if (!command.sources.length || command.sources.length > 8)
      throw new LiteContentPreparationError(
        'INVALID_INPUT',
        'A recommendation requires between one and eight exact sources.',
        422
      );
    const sources = await Promise.all(
      command.sources.map(async (locator) => {
        const normalizedLocator: ProductLoopSourceLocator = {
          owner: locator.owner,
          kind: locator.kind,
          sourceId: cleanText(locator.sourceId, 'sourceId', 500)
        };
        return normalizeSource(
          normalizedLocator,
          await this.sourceAuthority.resolve(workspaceId, normalizedLocator)
        );
      })
    );
    const requestFingerprint = fingerprint({ workspaceId, title, explanation, sources });
    const createdAt = exactTimestamp(this.now(), 'now');
    const recommendation = recommendationWithFingerprint({
      schemaVersion: 1,
      todayRecommendationId: this.ids.recommendation(),
      workspaceId,
      version: 1,
      kind: 'CONTENT_PREPARATION',
      title,
      explanation,
      sources,
      status: 'OPEN',
      executionAuthorized: false,
      createdAt,
      updatedAt: createdAt
    });

    return this.command<TodayRecommendation>(
      workspaceId,
      idempotencyKey,
      'CREATE_RECOMMENDATION',
      requestFingerprint,
      async (client) => {
        await client.query(
          'INSERT INTO lite_today_recommendations (workspace_id,today_recommendation_id,version,recommendation_fingerprint_sha256,document_json,created_at,updated_at) VALUES ($1,$2,1,$3,$4::jsonb,$5,$5)',
          [
            workspaceId,
            recommendation.todayRecommendationId,
            recommendation.recommendationFingerprintSha256,
            JSON.stringify(recommendation),
            createdAt
          ]
        );
        return recommendation;
      }
    );
  }

  async acceptContentOpportunity(
    command: Readonly<AcceptContentOpportunityCommand>
  ): Promise<ContentOpportunity> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const recommendationId = cleanText(
      command.recommendation.id,
      'recommendation.id',
      300
    ) as TodayRecommendationId;
    const recommendationVersion = exactVersion(
      command.recommendation.version,
      'recommendation.version'
    );
    const expectedFingerprint = exactSha256(
      command.expectedRecommendationFingerprintSha256,
      'expectedRecommendationFingerprintSha256'
    );
    const title = cleanText(command.title, 'title', 500);
    const rationale = cleanText(command.rationale, 'rationale', 4000);
    const idempotencyKey = cleanIdempotencyKey(command.idempotencyKey);
    const requestFingerprint = fingerprint({
      workspaceId,
      recommendationId,
      recommendationVersion,
      expectedFingerprint,
      title,
      rationale
    });
    const createdAt = exactTimestamp(this.now(), 'now');

    return this.command<ContentOpportunity>(
      workspaceId,
      idempotencyKey,
      'ACCEPT_CONTENT_OPPORTUNITY',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(
          client,
          `${workspaceId}:${recommendationId}:${recommendationVersion}:content-opportunity`
        );
        const recommendation = await this.recommendation(
          client,
          workspaceId,
          recommendationId,
          recommendationVersion
        );
        if (recommendation.recommendationFingerprintSha256 !== expectedFingerprint)
          throw new LiteContentPreparationError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Today Recommendation fingerprint no longer matches the prepared Content Opportunity.'
          );
        const existing = await client.query(
          'SELECT document_json FROM lite_content_opportunities WHERE workspace_id=$1 AND source_recommendation_id=$2 AND source_recommendation_version=$3 ORDER BY version DESC LIMIT 1',
          [workspaceId, recommendationId, recommendationVersion]
        );
        if (existing.rowCount)
          throw new LiteContentPreparationError(
            'INVALID_TRANSITION',
            'This Recommendation already has a Content Opportunity preparation line.'
          );
        const opportunity = opportunityWithFingerprint({
          schemaVersion: 1,
          contentOpportunityId: this.ids.opportunity(),
          workspaceId,
          version: 1,
          sourceRecommendation: { id: recommendationId, version: recommendationVersion },
          sources: recommendation.sources,
          title,
          rationale,
          status: 'ACCEPTED_FOR_PREPARATION',
          publishAuthorized: false,
          formalBusinessOpportunityCreated: false,
          createdAt,
          updatedAt: createdAt
        });
        await client.query(
          'INSERT INTO lite_content_opportunities (workspace_id,content_opportunity_id,version,source_recommendation_id,source_recommendation_version,content_opportunity_fingerprint_sha256,document_json,created_at,updated_at) VALUES ($1,$2,1,$3,$4,$5,$6::jsonb,$7,$7)',
          [
            workspaceId,
            opportunity.contentOpportunityId,
            recommendationId,
            recommendationVersion,
            opportunity.contentOpportunityFingerprintSha256,
            JSON.stringify(opportunity),
            createdAt
          ]
        );
        return opportunity;
      }
    );
  }

  async createDraft(command: Readonly<CreateContentDraftCommand>): Promise<ContentDraft> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const opportunityId = cleanText(
      command.contentOpportunity.id,
      'contentOpportunity.id',
      300
    ) as ContentOpportunityId;
    const opportunityVersion = exactVersion(
      command.contentOpportunity.version,
      'contentOpportunity.version'
    );
    const expectedFingerprint = exactSha256(
      command.expectedContentOpportunityFingerprintSha256,
      'expectedContentOpportunityFingerprintSha256'
    );
    const title = cleanText(command.title, 'title', 500);
    const body = cleanText(command.body, 'body', 100_000);
    const idempotencyKey = cleanIdempotencyKey(command.idempotencyKey);
    const requestFingerprint = fingerprint({
      workspaceId,
      opportunityId,
      opportunityVersion,
      expectedFingerprint,
      title,
      body
    });
    const createdAt = exactTimestamp(this.now(), 'now');

    return this.command<ContentDraft>(
      workspaceId,
      idempotencyKey,
      'CREATE_CONTENT_DRAFT',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(
          client,
          `${workspaceId}:${opportunityId}:${opportunityVersion}:draft-root`
        );
        const opportunity = await this.opportunity(
          client,
          workspaceId,
          opportunityId,
          opportunityVersion
        );
        if (opportunity.contentOpportunityFingerprintSha256 !== expectedFingerprint)
          throw new LiteContentPreparationError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Content Opportunity fingerprint no longer matches this draft request.'
          );
        if (opportunity.status !== 'ACCEPTED_FOR_PREPARATION')
          throw new LiteContentPreparationError(
            'INVALID_TRANSITION',
            'Only an accepted Content Opportunity can start a draft.'
          );
        const existing = await client.query(
          'SELECT 1 FROM lite_content_drafts WHERE workspace_id=$1 AND content_opportunity_id=$2 AND content_opportunity_version=$3 LIMIT 1',
          [workspaceId, opportunityId, opportunityVersion]
        );
        if (existing.rowCount)
          throw new LiteContentPreparationError(
            'INVALID_TRANSITION',
            'This Content Opportunity already has a bounded draft line.'
          );
        const draft = draftWithFingerprint({
          schemaVersion: 1,
          contentDraftId: this.ids.draft(),
          workspaceId,
          version: 1,
          contentOpportunity: { id: opportunityId, version: opportunityVersion },
          sources: opportunity.sources,
          title,
          body,
          status: 'DRAFT',
          humanReviewRequired: true,
          published: false,
          createdAt,
          updatedAt: createdAt
        });
        await this.insertDraft(client, draft);
        return draft;
      }
    );
  }

  async reviseDraft(command: Readonly<ReviseContentDraftCommand>): Promise<ContentDraft> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const draftId = cleanText(command.contentDraftId, 'contentDraftId', 300) as ContentDraftId;
    const expectedVersion = exactVersion(command.expectedVersion, 'expectedVersion');
    const expectedFingerprint = exactSha256(
      command.expectedContentDraftFingerprintSha256,
      'expectedContentDraftFingerprintSha256'
    );
    const title = cleanText(command.title, 'title', 500);
    const body = cleanText(command.body, 'body', 100_000);
    const idempotencyKey = cleanIdempotencyKey(command.idempotencyKey);
    const requestFingerprint = fingerprint({
      workspaceId,
      draftId,
      expectedVersion,
      expectedFingerprint,
      title,
      body
    });
    return this.nextDraftVersion(
      workspaceId,
      draftId,
      expectedVersion,
      expectedFingerprint,
      idempotencyKey,
      'REVISE_CONTENT_DRAFT',
      requestFingerprint,
      { title, body, status: 'DRAFT' }
    );
  }

  async markDraftReadyForReview(
    command: Readonly<MarkContentDraftReadyForReviewCommand>
  ): Promise<ContentDraft> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const draftId = cleanText(command.contentDraftId, 'contentDraftId', 300) as ContentDraftId;
    const expectedVersion = exactVersion(command.expectedVersion, 'expectedVersion');
    const expectedFingerprint = exactSha256(
      command.expectedContentDraftFingerprintSha256,
      'expectedContentDraftFingerprintSha256'
    );
    const idempotencyKey = cleanIdempotencyKey(command.idempotencyKey);
    const requestFingerprint = fingerprint({
      workspaceId,
      draftId,
      expectedVersion,
      expectedFingerprint
    });
    return this.nextDraftVersion(
      workspaceId,
      draftId,
      expectedVersion,
      expectedFingerprint,
      idempotencyKey,
      'MARK_CONTENT_DRAFT_READY_FOR_REVIEW',
      requestFingerprint,
      { status: 'READY_FOR_HUMAN_REVIEW' }
    );
  }

  async recordReview(
    command: Readonly<RecordContentReviewCommand>
  ): Promise<ContentReviewDecision> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const draftId = cleanText(command.contentDraft.id, 'contentDraft.id', 300) as ContentDraftId;
    const draftVersion = exactVersion(command.contentDraft.version, 'contentDraft.version');
    const expectedFingerprint = exactSha256(
      command.expectedContentDraftFingerprintSha256,
      'expectedContentDraftFingerprintSha256'
    );
    if (!contentReviewOutcomes.includes(command.outcome))
      throw new LiteContentPreparationError('INVALID_INPUT', 'Review outcome is invalid.', 422);
    const reviewerPrincipalId = cleanMarkOrbitId(
      command.reviewerPrincipalId,
      'reviewerPrincipalId'
    );
    const rationale = cleanText(command.rationale, 'rationale', 4000);
    const idempotencyKey = cleanIdempotencyKey(command.idempotencyKey);
    const requestFingerprint = fingerprint({
      workspaceId,
      draftId,
      draftVersion,
      expectedFingerprint,
      outcome: command.outcome,
      reviewerPrincipalId,
      rationale
    });
    const reviewedAt = exactTimestamp(this.now(), 'now');

    return this.command<ContentReviewDecision>(
      workspaceId,
      idempotencyKey,
      'RECORD_CONTENT_REVIEW',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:${draftId}:${draftVersion}:review`);
        const draft = await this.draft(client, workspaceId, draftId, draftVersion);
        if (draft.contentDraftFingerprintSha256 !== expectedFingerprint)
          throw new LiteContentPreparationError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Content Draft fingerprint no longer matches this Human Review request.'
          );
        if (draft.status !== 'READY_FOR_HUMAN_REVIEW')
          throw new LiteContentPreparationError(
            'INVALID_TRANSITION',
            'Human Review can be recorded only for a draft explicitly ready for review.'
          );
        const existing = await client.query(
          'SELECT 1 FROM lite_content_review_decisions WHERE workspace_id=$1 AND content_draft_id=$2 AND content_draft_version=$3 LIMIT 1',
          [workspaceId, draftId, draftVersion]
        );
        if (existing.rowCount)
          throw new LiteContentPreparationError(
            'VERSION_CONFLICT',
            'This exact Content Draft version already has a Human Review Decision.'
          );
        const decision: ContentReviewDecision = {
          schemaVersion: 1,
          contentReviewDecisionId: this.ids.review(),
          workspaceId,
          version: 1,
          contentDraft: { id: draftId, version: draftVersion },
          expectedContentDraftFingerprintSha256: expectedFingerprint,
          outcome: command.outcome,
          reviewerPrincipalId,
          rationale,
          reviewedAt,
          publishesExternally: false
        };
        await client.query(
          'INSERT INTO lite_content_review_decisions (workspace_id,content_review_decision_id,version,content_draft_id,content_draft_version,outcome,document_json,reviewed_at) VALUES ($1,$2,1,$3,$4,$5,$6::jsonb,$7)',
          [
            workspaceId,
            decision.contentReviewDecisionId,
            draftId,
            draftVersion,
            decision.outcome,
            JSON.stringify(decision),
            reviewedAt
          ]
        );
        return decision;
      }
    );
  }

  async preparePublishPackage(
    command: Readonly<PreparePublishPackageCommand>
  ): Promise<PublishPackage> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const draftId = cleanText(command.contentDraft.id, 'contentDraft.id', 300) as ContentDraftId;
    const draftVersion = exactVersion(command.contentDraft.version, 'contentDraft.version');
    const expectedFingerprint = exactSha256(
      command.expectedContentDraftFingerprintSha256,
      'expectedContentDraftFingerprintSha256'
    );
    const reviewDecisionId = cleanText(
      command.reviewDecision.id,
      'reviewDecision.id',
      300
    ) as ContentReviewDecisionId;
    const reviewDecisionVersion = exactVersion(
      command.reviewDecision.version,
      'reviewDecision.version'
    );
    const idempotencyKey = cleanIdempotencyKey(command.idempotencyKey);
    const requestFingerprint = fingerprint({
      workspaceId,
      draftId,
      draftVersion,
      expectedFingerprint,
      reviewDecisionId,
      reviewDecisionVersion
    });
    const createdAt = exactTimestamp(this.now(), 'now');

    return this.command<PublishPackage>(
      workspaceId,
      idempotencyKey,
      'PREPARE_PUBLISH_PACKAGE',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(
          client,
          `${workspaceId}:${reviewDecisionId}:${reviewDecisionVersion}:publish-package`
        );
        const draft = await this.draft(client, workspaceId, draftId, draftVersion);
        if (draft.contentDraftFingerprintSha256 !== expectedFingerprint)
          throw new LiteContentPreparationError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Content Draft fingerprint no longer matches this PublishPackage request.'
          );
        const review = await this.review(
          client,
          workspaceId,
          reviewDecisionId,
          reviewDecisionVersion
        );
        if (
          review.contentDraft.id !== draftId ||
          Number(review.contentDraft.version) !== draftVersion ||
          review.expectedContentDraftFingerprintSha256 !== expectedFingerprint
        )
          throw new LiteContentPreparationError(
            'SOURCE_VERSION_MISMATCH',
            'Human Review Decision does not cover the exact Content Draft requested.'
          );
        if (review.outcome !== 'APPROVED_FOR_PUBLISH_PACKAGE')
          throw new LiteContentPreparationError(
            'HUMAN_REVIEW_REQUIRED',
            'An approved Human Review Decision is required before preparing a PublishPackage.'
          );
        const existing = await client.query(
          'SELECT 1 FROM lite_publish_packages WHERE workspace_id=$1 AND content_review_decision_id=$2 AND content_review_decision_version=$3 LIMIT 1',
          [workspaceId, reviewDecisionId, reviewDecisionVersion]
        );
        if (existing.rowCount)
          throw new LiteContentPreparationError(
            'VERSION_CONFLICT',
            'This Human Review Decision already has a prepared PublishPackage.'
          );
        const publishPackage = packageWithFingerprint({
          schemaVersion: 1,
          publishPackageId: this.ids.publishPackage(),
          workspaceId,
          version: 1,
          contentDraft: { id: draftId, version: draftVersion },
          contentDraftFingerprintSha256: expectedFingerprint,
          reviewDecision: { id: reviewDecisionId, version: reviewDecisionVersion },
          title: draft.title,
          body: draft.body,
          status: 'PREPARED',
          externalPublishExecuted: false,
          createdAt
        });
        await client.query(
          'INSERT INTO lite_publish_packages (workspace_id,publish_package_id,version,content_draft_id,content_draft_version,content_review_decision_id,content_review_decision_version,publish_package_fingerprint_sha256,document_json,created_at) VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8::jsonb,$9)',
          [
            workspaceId,
            publishPackage.publishPackageId,
            draftId,
            draftVersion,
            reviewDecisionId,
            reviewDecisionVersion,
            publishPackage.publishPackageFingerprintSha256,
            JSON.stringify(publishPackage),
            createdAt
          ]
        );
        return publishPackage;
      }
    );
  }

  async findRecommendation(
    workspaceIdValue: string,
    recommendationId: TodayRecommendationId,
    version: number
  ): Promise<TodayRecommendation | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM lite_today_recommendations WHERE workspace_id=$1 AND today_recommendation_id=$2 AND version=$3',
      [workspaceId, recommendationId, exactVersion(version, 'version')]
    );
    return rowDocument<TodayRecommendation>(result.rows[0] as Row | undefined);
  }

  async findLatestDraft(
    workspaceIdValue: string,
    draftId: ContentDraftId
  ): Promise<ContentDraft | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM lite_content_drafts WHERE workspace_id=$1 AND content_draft_id=$2 ORDER BY version DESC LIMIT 1',
      [workspaceId, draftId]
    );
    return rowDocument<ContentDraft>(result.rows[0] as Row | undefined);
  }

  async findPublishPackage(
    workspaceIdValue: string,
    publishPackageId: PublishPackageId,
    version = 1
  ): Promise<PublishPackage | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM lite_publish_packages WHERE workspace_id=$1 AND publish_package_id=$2 AND version=$3',
      [workspaceId, publishPackageId, exactVersion(version, 'version')]
    );
    return rowDocument<PublishPackage>(result.rows[0] as Row | undefined);
  }

  private async nextDraftVersion(
    workspaceId: string,
    draftId: ContentDraftId,
    expectedVersion: number,
    expectedFingerprint: string,
    idempotencyKey: string,
    commandType: 'REVISE_CONTENT_DRAFT' | 'MARK_CONTENT_DRAFT_READY_FOR_REVIEW',
    requestFingerprint: string,
    update: Readonly<{ title?: string; body?: string; status: ContentDraft['status'] }>
  ): Promise<ContentDraft> {
    return this.command<ContentDraft>(
      workspaceId,
      idempotencyKey,
      commandType,
      requestFingerprint,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:${draftId}:version-line`);
        const latest = await this.latestDraft(client, workspaceId, draftId);
        if (latest.version !== expectedVersion)
          throw new LiteContentPreparationError(
            'VERSION_CONFLICT',
            `Content Draft is at version ${latest.version}, not ${expectedVersion}.`
          );
        if (latest.contentDraftFingerprintSha256 !== expectedFingerprint)
          throw new LiteContentPreparationError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Content Draft fingerprint no longer matches the expected version.'
          );
        if (latest.version >= MAX_CONTENT_DRAFT_VERSIONS)
          throw new LiteContentPreparationError(
            'VERSION_CONFLICT',
            `Content Draft reached the bounded ${MAX_CONTENT_DRAFT_VERSIONS}-version limit.`
          );
        if (commandType === 'MARK_CONTENT_DRAFT_READY_FOR_REVIEW' && latest.status !== 'DRAFT')
          throw new LiteContentPreparationError(
            'INVALID_TRANSITION',
            'Only a DRAFT version can be marked ready for Human Review.'
          );
        const updatedAt = exactTimestamp(this.now(), 'now');
        const next = draftWithFingerprint({
          schemaVersion: 1,
          contentDraftId: draftId,
          workspaceId,
          version: latest.version + 1,
          contentOpportunity: latest.contentOpportunity,
          sources: latest.sources,
          title: update.title ?? latest.title,
          body: update.body ?? latest.body,
          status: update.status,
          humanReviewRequired: true,
          published: false,
          createdAt: latest.createdAt,
          updatedAt
        });
        await this.insertDraft(client, next);
        return next;
      }
    );
  }

  private async command<T>(
    workspaceId: string,
    idempotencyKey: string,
    commandType: CommandType,
    requestFingerprint: string,
    write: (client: QueryClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(client, `${workspaceId}:idempotency:${idempotencyKey}`);
        const replay = await client.query(
          'SELECT command_type,request_fingerprint_sha256,result_json FROM lite_content_preparation_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new LiteContentPreparationError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Product preparation command.'
            );
          return rowDocument<T>(prior, 'result_json') as T;
        }
        const result = await write(client);
        await client.query(
          'INSERT INTO lite_content_preparation_commands (workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6)',
          [
            workspaceId,
            idempotencyKey,
            commandType,
            requestFingerprint,
            JSON.stringify(result),
            exactTimestamp(this.now(), 'now')
          ]
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof LiteContentPreparationError) throw error;
      throw new LiteContentPreparationError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Content preparation persistence is unavailable.',
        503,
        undefined,
        { cause: error }
      );
    }
  }

  private async resourceLock(client: QueryClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }

  private async recommendation(
    client: QueryClient,
    workspaceId: string,
    recommendationId: TodayRecommendationId,
    version: number
  ): Promise<TodayRecommendation> {
    const result = await client.query(
      'SELECT document_json FROM lite_today_recommendations WHERE workspace_id=$1 AND today_recommendation_id=$2 AND version=$3',
      [workspaceId, recommendationId, version]
    );
    const value = rowDocument<TodayRecommendation>(result.rows[0] as Row | undefined);
    if (!value)
      throw new LiteContentPreparationError(
        'NOT_FOUND',
        'Today Recommendation was not found.',
        404
      );
    return value;
  }

  private async opportunity(
    client: QueryClient,
    workspaceId: string,
    opportunityId: ContentOpportunityId,
    version: number
  ): Promise<ContentOpportunity> {
    const result = await client.query(
      'SELECT document_json FROM lite_content_opportunities WHERE workspace_id=$1 AND content_opportunity_id=$2 AND version=$3',
      [workspaceId, opportunityId, version]
    );
    const value = rowDocument<ContentOpportunity>(result.rows[0] as Row | undefined);
    if (!value)
      throw new LiteContentPreparationError('NOT_FOUND', 'Content Opportunity was not found.', 404);
    return value;
  }

  private async draft(
    client: QueryClient,
    workspaceId: string,
    draftId: ContentDraftId,
    version: number
  ): Promise<ContentDraft> {
    const result = await client.query(
      'SELECT document_json FROM lite_content_drafts WHERE workspace_id=$1 AND content_draft_id=$2 AND version=$3',
      [workspaceId, draftId, version]
    );
    const value = rowDocument<ContentDraft>(result.rows[0] as Row | undefined);
    if (!value)
      throw new LiteContentPreparationError('NOT_FOUND', 'Content Draft was not found.', 404);
    return value;
  }

  private async latestDraft(
    client: QueryClient,
    workspaceId: string,
    draftId: ContentDraftId
  ): Promise<ContentDraft> {
    const result = await client.query(
      'SELECT document_json FROM lite_content_drafts WHERE workspace_id=$1 AND content_draft_id=$2 ORDER BY version DESC LIMIT 1',
      [workspaceId, draftId]
    );
    const value = rowDocument<ContentDraft>(result.rows[0] as Row | undefined);
    if (!value)
      throw new LiteContentPreparationError('NOT_FOUND', 'Content Draft was not found.', 404);
    return value;
  }

  private async review(
    client: QueryClient,
    workspaceId: string,
    reviewDecisionId: ContentReviewDecisionId,
    version: number
  ): Promise<ContentReviewDecision> {
    const result = await client.query(
      'SELECT document_json FROM lite_content_review_decisions WHERE workspace_id=$1 AND content_review_decision_id=$2 AND version=$3',
      [workspaceId, reviewDecisionId, version]
    );
    const value = rowDocument<ContentReviewDecision>(result.rows[0] as Row | undefined);
    if (!value)
      throw new LiteContentPreparationError(
        'NOT_FOUND',
        'Content Human Review Decision was not found.',
        404
      );
    return value;
  }

  private async insertDraft(client: QueryClient, draft: ContentDraft): Promise<void> {
    await client.query(
      'INSERT INTO lite_content_drafts (workspace_id,content_draft_id,version,content_opportunity_id,content_opportunity_version,status,content_draft_fingerprint_sha256,document_json,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)',
      [
        draft.workspaceId,
        draft.contentDraftId,
        draft.version,
        draft.contentOpportunity.id,
        draft.contentOpportunity.version,
        draft.status,
        draft.contentDraftFingerprintSha256,
        JSON.stringify(draft),
        draft.createdAt,
        draft.updatedAt
      ]
    );
  }
}
