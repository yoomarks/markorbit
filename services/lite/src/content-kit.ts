import { createHash } from 'node:crypto';
import type {
  ContentAngle,
  ContentKit,
  ContentPick,
  ContentPickPlatform,
  CreatorPreference,
  DailyOrbitItem,
  PlatformVariant,
  PlatformVariantKind
} from '@markorbit/contracts/daily-workspace';
import type {
  ContentDraft,
  ContentOpportunity,
  ProductLoopExactReference,
  PublishPackage,
  TodayRecommendationId
} from '@markorbit/contracts/product-loop';
import type { QueryClient } from '@markorbit/persistence';
import type {
  DailyOrbitPreferenceProvider,
  DailyOrbitSnapshot,
  NoCreatorPreferenceProvider
} from './daily-orbit.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ContentKitErrorCode =
  | 'INVALID_INPUT'
  | 'CONTENT_PICK_NOT_FOUND'
  | 'CONTENT_OPPORTUNITY_REQUIRED'
  | 'PERSISTENCE_UNAVAILABLE';

export class ContentKitError extends Error {
  constructor(
    readonly code: ContentKitErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ContentKitError';
  }
}

export interface DailyOrbitSnapshotReader {
  snapshot(workspaceId: string, subjectUserId: string): Promise<DailyOrbitSnapshot>;
}

export interface ContentKitLifecycleSnapshot {
  opportunity: Readonly<ContentOpportunity>;
  drafts: readonly Readonly<ContentDraft>[];
  publishPackages: readonly Readonly<PublishPackage>[];
}

export interface ContentKitLifecycleReader {
  resolve(
    workspaceId: string,
    recommendation: Readonly<ProductLoopExactReference<TodayRecommendationId>>
  ): Promise<ContentKitLifecycleSnapshot | undefined>;
}

type Row = Record<string, unknown>;

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new ContentKitError('INVALID_INPUT', 'workspaceId must be a Core Workspace UUID.', 422);
  return cleaned;
}

function cleanUserId(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new ContentKitError('INVALID_INPUT', 'subjectUserId is required.', 422);
  return cleaned;
}

function cleanContentPickId(value: string): ContentPick['contentPickId'] {
  const cleaned = value.trim();
  if (!cleaned.startsWith('content-pick_'))
    throw new ContentKitError('INVALID_INPUT', 'contentPickId is invalid.', 422);
  return cleaned as ContentPick['contentPickId'];
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sourceNote(opportunity: Readonly<ContentOpportunity>): readonly string[] {
  return opportunity.sources.map(
    (source) =>
      `${source.owner}/${source.kind}/${source.sourceId}@${String(source.sourceVersion)}#${source.sourceFingerprintSha256}`
  );
}

function audienceOf(preference: Readonly<CreatorPreference> | undefined): string {
  const configured = preference?.targetAudiences.map((value) => value.trim()).find(Boolean);
  return configured ?? 'Audience not explicitly configured';
}

function anglesFor(
  pick: Readonly<ContentPick>,
  opportunity: Readonly<ContentOpportunity>,
  audience: string
): readonly ContentAngle[] {
  const notes = sourceNote(opportunity);
  return pick.suggestedAngles.map((angle, index) => ({
    angleId: `angle_${digest(`${pick.contentPickId}:${index}:${angle}`).slice(0, 24)}`,
    title: angle,
    thesis: angle,
    audience,
    evidenceNotes: [...notes]
  }));
}

function variantKind(platform: ContentPickPlatform, hasDraft: boolean): PlatformVariantKind {
  if (platform === 'WECHAT_MOMENTS') return 'WECHAT_MOMENTS_POST';
  if (platform === 'XIAOHONGSHU') return 'XIAOHONGSHU_POST';
  if (platform === 'WECHAT_OFFICIAL_ACCOUNT')
    return hasDraft ? 'WECHAT_OFFICIAL_ACCOUNT_DRAFT' : 'WECHAT_OFFICIAL_ACCOUNT_OUTLINE';
  return 'VIDEO_SCRIPT_60S';
}

function starterBody(pick: Readonly<ContentPick>): string {
  if (!pick.suggestedAngles.length) return pick.whyPublish;
  return pick.suggestedAngles.map((angle, index) => `${index + 1}. ${angle}`).join('\n');
}

function latestDraft(
  drafts: readonly Readonly<ContentDraft>[]
): Readonly<ContentDraft> | undefined {
  return [...drafts].sort(
    (left, right) =>
      right.version - left.version || left.contentDraftId.localeCompare(right.contentDraftId)
  )[0];
}

function variantsFor(
  pick: Readonly<ContentPick>,
  drafts: readonly Readonly<ContentDraft>[]
): readonly PlatformVariant[] {
  const latest = latestDraft(drafts);
  return pick.recommendedPlatforms.map((platform) => ({
    variantId: `platform-variant_${digest(`${pick.contentPickId}:${platform}`).slice(0, 24)}`,
    kind: variantKind(platform, Boolean(latest)),
    title: latest?.title ?? pick.title,
    body: latest?.body ?? starterBody(pick),
    topicTags: [],
    ...(latest
      ? {
          draft: {
            id: latest.contentDraftId,
            version: latest.version
          }
        }
      : {}),
    humanReviewRequired: true,
    externalPublishExecuted: false
  }));
}

function latestTimestamp(values: readonly string[]): string {
  return new Date(Math.max(...values.map((value) => Date.parse(value)))).toISOString();
}

function projectionVersion(
  drafts: readonly Readonly<ContentDraft>[],
  packages: readonly Readonly<PublishPackage>[]
): number {
  const draftVersion = drafts.reduce((maximum, draft) => Math.max(maximum, draft.version), 0);
  return 1 + draftVersion + packages.length;
}

function assertWorkspaceDocuments(
  workspaceId: string,
  lifecycle: Readonly<ContentKitLifecycleSnapshot>
): void {
  if (lifecycle.opportunity.workspaceId.toLowerCase() !== workspaceId)
    throw new ContentKitError(
      'PERSISTENCE_UNAVAILABLE',
      'Stored Content Opportunity violates Workspace isolation.',
      503,
      true
    );
  for (const draft of lifecycle.drafts) {
    if (
      draft.workspaceId.toLowerCase() !== workspaceId ||
      draft.contentOpportunity.id !== lifecycle.opportunity.contentOpportunityId ||
      Number(draft.contentOpportunity.version) !== lifecycle.opportunity.version
    )
      throw new ContentKitError(
        'PERSISTENCE_UNAVAILABLE',
        'Stored Content Draft violates Content Kit ownership.',
        503,
        true
      );
  }
  for (const publishPackage of lifecycle.publishPackages) {
    if (
      publishPackage.workspaceId.toLowerCase() !== workspaceId ||
      publishPackage.externalPublishExecuted !== false
    )
      throw new ContentKitError(
        'PERSISTENCE_UNAVAILABLE',
        'Stored PublishPackage violates Content Kit safety semantics.',
        503,
        true
      );
  }
}

export function projectContentKit(
  input: Readonly<{
    pick: ContentPick;
    orbitItem: DailyOrbitItem;
    lifecycle: ContentKitLifecycleSnapshot;
    preference?: CreatorPreference;
  }>
): ContentKit {
  const workspaceId = cleanWorkspaceId(input.pick.workspaceId);
  if (input.orbitItem.workspaceId.toLowerCase() !== workspaceId)
    throw new ContentKitError(
      'INVALID_INPUT',
      'Daily Orbit Item belongs to a different Workspace.',
      422
    );
  if (input.orbitItem.dailyOrbitItemId !== input.pick.orbitItem.id)
    throw new ContentKitError(
      'INVALID_INPUT',
      'Content Pick does not match the Daily Orbit Item.',
      422
    );
  if (
    input.lifecycle.opportunity.sourceRecommendation.id !== input.pick.recommendation.id ||
    Number(input.lifecycle.opportunity.sourceRecommendation.version) !==
      input.pick.recommendation.version
  )
    throw new ContentKitError(
      'INVALID_INPUT',
      'Content Opportunity does not match the exact Content Pick Recommendation.',
      422
    );
  if (input.preference) {
    if (input.preference.workspaceId.toLowerCase() !== workspaceId)
      throw new ContentKitError(
        'INVALID_INPUT',
        'Creator Preference belongs to a different Workspace.',
        422
      );
  }
  assertWorkspaceDocuments(workspaceId, input.lifecycle);

  const audience = audienceOf(input.preference);
  const kitIdentity = digest(
    `${input.pick.contentPickId}:${input.lifecycle.opportunity.contentOpportunityId}:${input.lifecycle.opportunity.version}`
  );
  const draftReferences = input.lifecycle.drafts.map((draft) => ({
    id: draft.contentDraftId,
    version: draft.version
  }));
  const publishPackageReferences = input.lifecycle.publishPackages.map((publishPackage) => ({
    id: publishPackage.publishPackageId,
    version: publishPackage.version
  }));
  const updatedCandidates = [
    input.lifecycle.opportunity.updatedAt,
    ...input.lifecycle.drafts.map((draft) => draft.updatedAt),
    ...input.lifecycle.publishPackages.map((publishPackage) => publishPackage.createdAt)
  ];

  return {
    schemaVersion: 1,
    contentKitId: `content-kit_${kitIdentity.slice(0, 32)}`,
    workspaceId,
    version: projectionVersion(input.lifecycle.drafts, input.lifecycle.publishPackages),
    contentPick: { id: input.pick.contentPickId, version: input.pick.version },
    contentOpportunity: {
      id: input.lifecycle.opportunity.contentOpportunityId,
      version: input.lifecycle.opportunity.version
    },
    sources: input.lifecycle.opportunity.sources.map(clone),
    whyItMatters: input.orbitItem.whyThisMatters,
    whyPublish: input.pick.whyPublish,
    angles: anglesFor(input.pick, input.lifecycle.opportunity, audience),
    audience,
    platformVariants: variantsFor(input.pick, input.lifecycle.drafts),
    draftReferences,
    publishPackageReferences,
    visualBriefReferences: [],
    externalPublishExecuted: false,
    createdAt: input.lifecycle.opportunity.createdAt,
    updatedAt: latestTimestamp(updatedCandidates)
  };
}

export class PostgresContentKitLifecycleReader implements ContentKitLifecycleReader {
  constructor(private readonly query: QueryClient) {}

  async resolve(
    workspaceIdValue: string,
    recommendation: Readonly<ProductLoopExactReference<TodayRecommendationId>>
  ): Promise<ContentKitLifecycleSnapshot | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    try {
      const opportunityResult = await this.query.query(
        'SELECT document_json FROM lite_content_opportunities WHERE workspace_id=$1 AND source_recommendation_id=$2 AND source_recommendation_version=$3 ORDER BY version DESC LIMIT 1',
        [workspaceId, recommendation.id, recommendation.version]
      );
      const opportunityRow = opportunityResult.rows[0] as Row | undefined;
      if (!opportunityRow) return undefined;
      const opportunity = clone(opportunityRow.document_json as ContentOpportunity);

      const draftResult = await this.query.query(
        'SELECT DISTINCT ON (content_draft_id) document_json FROM lite_content_drafts WHERE workspace_id=$1 AND content_opportunity_id=$2 AND content_opportunity_version=$3 ORDER BY content_draft_id,version DESC',
        [workspaceId, opportunity.contentOpportunityId, opportunity.version]
      );
      const drafts = draftResult.rows.map((row) =>
        clone((row as Row).document_json as ContentDraft)
      );

      const publishResult = await this.query.query(
        'SELECT p.document_json FROM lite_publish_packages p JOIN lite_content_drafts d ON d.workspace_id=p.workspace_id AND d.content_draft_id=p.content_draft_id AND d.version=p.content_draft_version WHERE p.workspace_id=$1 AND d.content_opportunity_id=$2 AND d.content_opportunity_version=$3 ORDER BY p.created_at,p.publish_package_id,p.version',
        [workspaceId, opportunity.contentOpportunityId, opportunity.version]
      );
      const publishPackages = publishResult.rows.map((row) =>
        clone((row as Row).document_json as PublishPackage)
      );
      const result = { opportunity, drafts, publishPackages };
      assertWorkspaceDocuments(workspaceId, result);
      return result;
    } catch (error) {
      if (error instanceof ContentKitError) throw error;
      throw new ContentKitError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Content Kit lifecycle persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export class ContentKitService {
  constructor(
    private readonly orbit: DailyOrbitSnapshotReader,
    private readonly lifecycle: ContentKitLifecycleReader,
    private readonly preferences?: DailyOrbitPreferenceProvider | NoCreatorPreferenceProvider
  ) {}

  async find(
    workspaceIdValue: string,
    subjectUserIdValue: string,
    contentPickIdValue: string
  ): Promise<ContentKit> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const subjectUserId = cleanUserId(subjectUserIdValue);
    const contentPickId = cleanContentPickId(contentPickIdValue);
    const orbit = await this.orbit.snapshot(workspaceId, subjectUserId);
    const pick = orbit.contentPicks.find((candidate) => candidate.contentPickId === contentPickId);
    if (!pick)
      throw new ContentKitError(
        'CONTENT_PICK_NOT_FOUND',
        'The current Workspace Daily Orbit does not contain this Content Pick.',
        404
      );
    const orbitItem = orbit.items.find(
      (candidate) =>
        candidate.dailyOrbitItemId === pick.orbitItem.id &&
        candidate.version === pick.orbitItem.version
    );
    if (!orbitItem)
      throw new ContentKitError(
        'CONTENT_PICK_NOT_FOUND',
        'The Content Pick no longer has its exact Daily Orbit Item.',
        404
      );
    const lifecycle = await this.lifecycle.resolve(workspaceId, pick.recommendation);
    if (!lifecycle)
      throw new ContentKitError(
        'CONTENT_OPPORTUNITY_REQUIRED',
        'Accept the existing Content Recommendation before opening a Content Kit.',
        409
      );

    let preference: CreatorPreference | undefined;
    if (this.preferences) {
      try {
        preference = await this.preferences.resolve(workspaceId, subjectUserId);
      } catch {
        preference = undefined;
      }
    }
    if (preference?.subjectUserId !== subjectUserId) preference = undefined;

    return projectContentKit({ pick, orbitItem, lifecycle, ...(preference ? { preference } : {}) });
  }
}
