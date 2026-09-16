import type {
  BusinessAttributionLinkIdV1,
  BusinessAttributionLinkV1,
  BusinessAttributionReferenceV1
} from '@markorbit/contracts/business-attribution';
import type {
  ContentDraft,
  ContentOpportunity,
  ContentReviewDecision,
  ProductLoopSourceReference,
  ProductLoopUseFeedback,
  PublishPackage,
  PublishPackageId
} from '@markorbit/contracts/product-loop';
import type { QueryClient } from '@markorbit/persistence';
import type { CreateBusinessAttributionLinkCommand } from './business-attribution.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
type Row = Record<string, unknown>;

export type ContentLedDemandErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'LINEAGE_MISMATCH'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class ContentLedDemandError extends Error {
  constructor(
    readonly code: ContentLedDemandErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ContentLedDemandError';
  }
}

export interface ContentLedDemandLineage {
  opportunity: Readonly<ContentOpportunity>;
  draft: Readonly<ContentDraft>;
  review: Readonly<ContentReviewDecision>;
  publishPackage: Readonly<PublishPackage>;
}

export interface ContentLedDemandLineageReader {
  find(
    workspaceId: string,
    publishPackageId: PublishPackageId,
    version: number
  ): Promise<ContentLedDemandLineage | undefined>;
}

export interface ContentLedDemandFeedbackReader {
  findByPackage(
    workspaceId: string,
    publishPackageId: PublishPackageId,
    version: number
  ): Promise<ProductLoopUseFeedback | undefined>;
  sourceReference(
    workspaceId: string,
    feedbackId: ProductLoopUseFeedback['productLoopFeedbackId']
  ): Promise<ProductLoopSourceReference | undefined>;
}

export interface ContentLedDemandAttributionStore {
  find(
    workspaceId: string,
    linkId: BusinessAttributionLinkIdV1
  ): Promise<BusinessAttributionLinkV1 | undefined>;
  create(
    command: Readonly<CreateBusinessAttributionLinkCommand>
  ): Promise<BusinessAttributionLinkV1>;
}

export interface RecordContentLedDemandAttributionCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  publishPackage: Readonly<{
    id: PublishPackageId;
    version: number;
    fingerprintSha256: string;
  }>;
  useFeedback: Readonly<{
    id: ProductLoopUseFeedback['productLoopFeedbackId'];
    version: number;
  }>;
  siteInboundAttribution: Readonly<{
    id: BusinessAttributionLinkIdV1;
    version: number;
    fingerprintSha256: string;
  }>;
}

function workspace(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID.test(normalized)) {
    throw new ContentLedDemandError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  }
  return normalized;
}

function text(value: string, field: string, maximum = 300): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new ContentLedDemandError('INVALID_INPUT', `${field} is invalid.`, 422);
  }
  return normalized;
}

function version(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ContentLedDemandError('INVALID_INPUT', `${field} is invalid.`, 422);
  }
  return value;
}

function fingerprint(value: string, field: string): string {
  const normalized = value.trim();
  if (!SHA256.test(normalized)) {
    throw new ContentLedDemandError('INVALID_INPUT', `${field} must be lowercase SHA-256.`, 422);
  }
  return normalized;
}

function sameVersion(left: number | string, right: number | string): boolean {
  return String(left) === String(right);
}

function attributionReference(
  source: Readonly<ProductLoopSourceReference>
): BusinessAttributionReferenceV1 {
  return {
    owner: source.owner,
    kind: source.kind,
    id: source.sourceId,
    version: source.sourceVersion,
    fingerprintSha256: source.sourceFingerprintSha256,
    observedAt: source.observedAt
  };
}

function assertStoredLineage(workspaceId: string, value: Readonly<ContentLedDemandLineage>): void {
  if (
    value.opportunity.workspaceId.toLowerCase() !== workspaceId ||
    value.draft.workspaceId.toLowerCase() !== workspaceId ||
    value.publishPackage.workspaceId.toLowerCase() !== workspaceId ||
    value.publishPackage.contentDraft.id !== value.draft.contentDraftId ||
    !sameVersion(value.publishPackage.contentDraft.version, value.draft.version) ||
    value.publishPackage.contentDraftFingerprintSha256 !==
      value.draft.contentDraftFingerprintSha256 ||
    value.draft.contentOpportunity.id !== value.opportunity.contentOpportunityId ||
    !sameVersion(value.draft.contentOpportunity.version, value.opportunity.version) ||
    value.review.workspaceId.toLowerCase() !== workspaceId ||
    value.review.contentDraft.id !== value.draft.contentDraftId ||
    !sameVersion(value.review.contentDraft.version, value.draft.version) ||
    value.review.expectedContentDraftFingerprintSha256 !==
      value.draft.contentDraftFingerprintSha256 ||
    value.review.outcome !== 'APPROVED_FOR_PUBLISH_PACKAGE' ||
    value.publishPackage.reviewDecision.id !== value.review.contentReviewDecisionId ||
    !sameVersion(value.publishPackage.reviewDecision.version, value.review.version) ||
    value.opportunity.status !== 'ACCEPTED_FOR_PREPARATION' ||
    value.draft.status !== 'READY_FOR_HUMAN_REVIEW' ||
    value.publishPackage.status !== 'PREPARED' ||
    value.publishPackage.externalPublishExecuted !== false
  ) {
    throw new ContentLedDemandError(
      'INTEGRITY_FAILURE',
      'Stored content lineage violates exact owner relationships.',
      500
    );
  }
}

export class PostgresContentLedDemandLineageReader implements ContentLedDemandLineageReader {
  constructor(private readonly query: QueryClient) {}

  async find(
    workspaceIdValue: string,
    publishPackageId: PublishPackageId,
    packageVersion: number
  ): Promise<ContentLedDemandLineage | undefined> {
    const workspaceId = workspace(workspaceIdValue);
    try {
      const result = await this.query.query(
        `SELECT p.document_json AS publish_package,
                d.document_json AS draft,
                r.document_json AS review,
                o.document_json AS opportunity
         FROM lite_publish_packages p
         JOIN lite_content_drafts d
           ON d.workspace_id=p.workspace_id
          AND d.content_draft_id=p.content_draft_id
          AND d.version=p.content_draft_version
         JOIN lite_content_opportunities o
           ON o.workspace_id=d.workspace_id
          AND o.content_opportunity_id=d.content_opportunity_id
          AND o.version=d.content_opportunity_version
         JOIN lite_content_review_decisions r
           ON r.workspace_id=p.workspace_id
          AND r.content_review_decision_id=p.content_review_decision_id
          AND r.version=p.content_review_decision_version
         WHERE p.workspace_id=$1 AND p.publish_package_id=$2 AND p.version=$3`,
        [workspaceId, publishPackageId, packageVersion]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row) return undefined;
      const value = {
        opportunity: structuredClone(row.opportunity as ContentOpportunity),
        draft: structuredClone(row.draft as ContentDraft),
        review: structuredClone(row.review as ContentReviewDecision),
        publishPackage: structuredClone(row.publish_package as PublishPackage)
      };
      assertStoredLineage(workspaceId, value);
      return value;
    } catch (error) {
      if (error instanceof ContentLedDemandError) throw error;
      throw new ContentLedDemandError(
        'PERSISTENCE_UNAVAILABLE',
        'Content lineage persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export class ContentLedDemandAttributionService {
  constructor(
    private readonly lineage: ContentLedDemandLineageReader,
    private readonly feedback: ContentLedDemandFeedbackReader,
    private readonly attribution: ContentLedDemandAttributionStore
  ) {}

  async record(
    command: Readonly<RecordContentLedDemandAttributionCommand>
  ): Promise<BusinessAttributionLinkV1> {
    const workspaceId = workspace(command.workspaceId);
    const actorPrincipalId = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey');
    const packageId = text(command.publishPackage.id, 'publishPackage.id') as PublishPackageId;
    const packageVersion = version(command.publishPackage.version, 'publishPackage.version');
    const packageFingerprint = fingerprint(
      command.publishPackage.fingerprintSha256,
      'publishPackage.fingerprintSha256'
    );
    const feedbackId = text(
      command.useFeedback.id,
      'useFeedback.id'
    ) as ProductLoopUseFeedback['productLoopFeedbackId'];
    const feedbackVersion = version(command.useFeedback.version, 'useFeedback.version');
    const siteLinkId = text(
      command.siteInboundAttribution.id,
      'siteInboundAttribution.id'
    ) as BusinessAttributionLinkIdV1;
    const siteLinkVersion = version(
      command.siteInboundAttribution.version,
      'siteInboundAttribution.version'
    );
    const siteLinkFingerprint = fingerprint(
      command.siteInboundAttribution.fingerprintSha256,
      'siteInboundAttribution.fingerprintSha256'
    );

    const [lineage, feedback, siteLink] = await Promise.all([
      this.lineage.find(workspaceId, packageId, packageVersion),
      this.feedback.findByPackage(workspaceId, packageId, packageVersion),
      this.attribution.find(workspaceId, siteLinkId)
    ]);
    if (!lineage || !feedback || !siteLink) {
      throw new ContentLedDemandError(
        'NOT_FOUND',
        'Exact content-led demand lineage was not found.',
        404
      );
    }
    assertStoredLineage(workspaceId, lineage);
    if (lineage.publishPackage.publishPackageFingerprintSha256 !== packageFingerprint) {
      throw new ContentLedDemandError(
        'LINEAGE_MISMATCH',
        'PublishPackage fingerprint no longer matches.',
        409
      );
    }
    if (
      feedback.productLoopFeedbackId !== feedbackId ||
      feedback.workspaceId.toLowerCase() !== workspaceId ||
      feedback.version !== feedbackVersion ||
      feedback.publishPackage.id !== packageId ||
      !sameVersion(feedback.publishPackage.version, packageVersion) ||
      feedback.outcome === 'NOT_USED' ||
      feedback.externalActionExecutedByMarkOrbit !== false ||
      feedback.externalOutcomeVerifiedByMarkOrbit !== false
    ) {
      throw new ContentLedDemandError(
        'LINEAGE_MISMATCH',
        'Manual distribution feedback does not match the exact PublishPackage.',
        409
      );
    }
    if (
      siteLink.version !== siteLinkVersion ||
      siteLink.workspaceId.toLowerCase() !== workspaceId ||
      siteLink.businessAttributionFingerprintSha256 !== siteLinkFingerprint ||
      siteLink.motionKind !== 'SITE_INBOUND' ||
      !siteLink.downstreamRef ||
      siteLink.downstreamRef.owner !== 'MARKREG' ||
      !['PRODUCTION_INTAKE', 'FORMAL_MATTER'].includes(siteLink.downstreamRef.kind) ||
      !siteLink.sourceRefs.some(
        (ref) =>
          ref.owner === 'LITE' &&
          ref.kind === 'PUBLISH_PACKAGE' &&
          ref.id === packageId &&
          sameVersion(ref.version, packageVersion) &&
          ref.fingerprintSha256 === packageFingerprint
      )
    ) {
      throw new ContentLedDemandError(
        'LINEAGE_MISMATCH',
        'Site inbound attribution does not preserve the exact PublishPackage lineage.',
        409
      );
    }
    const feedbackReference = await this.feedback.sourceReference(workspaceId, feedbackId);
    if (!feedbackReference) {
      throw new ContentLedDemandError(
        'NOT_FOUND',
        'Manual distribution feedback was not found.',
        404
      );
    }

    return this.attribution.create({
      workspaceId,
      actorPrincipalId,
      idempotencyKey,
      motionKind: 'CONTENT_LED_DEMAND',
      sourceRefs: [
        ...lineage.opportunity.sources.map(attributionReference),
        {
          owner: 'LITE',
          kind: 'PUBLISH_PACKAGE',
          id: packageId,
          version: packageVersion,
          fingerprintSha256: packageFingerprint,
          observedAt: lineage.publishPackage.createdAt
        }
      ],
      touchpointRefs: [
        {
          owner: 'LITE',
          kind: 'CONTENT_OPPORTUNITY',
          id: lineage.opportunity.contentOpportunityId,
          version: lineage.opportunity.version,
          fingerprintSha256: lineage.opportunity.contentOpportunityFingerprintSha256,
          observedAt: lineage.opportunity.updatedAt
        },
        attributionReference(feedbackReference),
        {
          owner: 'LITE',
          kind: 'SITE_INBOUND_ATTRIBUTION',
          id: siteLink.businessAttributionLinkId,
          version: siteLink.version,
          fingerprintSha256: siteLink.businessAttributionFingerprintSha256,
          observedAt: siteLink.evaluatedAt
        }
      ],
      downstreamRef: siteLink.downstreamRef,
      attributionState: siteLink.attributionState,
      evidenceBasis: 'EXACT_LINEAGE',
      evaluatedAt: siteLink.evaluatedAt
    });
  }
}
