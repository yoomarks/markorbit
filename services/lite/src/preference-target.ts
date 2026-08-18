import type {
  ContentKit,
  ContentPick,
  ContentPickPlatform,
  DailyOrbitItem,
  DailySignal,
  PlatformVariant,
  ProductPreferenceEvent,
  ProductPreferenceEventKind,
  VisualBriefId,
  VisualOutputKind,
  VisualOutputReferenceId
} from '@markorbit/contracts/daily-workspace';
import type { ProductLoopExactReference } from '@markorbit/contracts/product-loop';
import type {
  DailyOrbitSnapshot,
  DailyOrbitSnapshot as OrbitSnapshot,
  DailySignalReader
} from './daily-orbit.js';
import type { ContentKitError, ContentKitService } from './content-kit.js';
import type {
  PostgresProductPreferenceStore,
  ProductPreferenceContext,
  RecordProductPreferenceEventResult
} from './preference-feedback.js';
import type { PostgresVisualBridgeStore, VisualBriefRecord } from './visual-bridge.js';

export type ProductPreferenceTargetErrorCode =
  | 'INVALID_TARGET'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_CONTEXT_UNAVAILABLE';

export class ProductPreferenceTargetError extends Error {
  constructor(
    readonly code: ProductPreferenceTargetErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductPreferenceTargetError';
  }
}

export interface ProductPreferenceTargetReference {
  targetType: ProductPreferenceEvent['targetType'];
  targetId: string;
  targetVersion: number | string;
}

export interface RecordProductPreferenceEventCommand extends ProductPreferenceTargetReference {
  workspaceId: string;
  subjectUserId: string;
  kind: ProductPreferenceEventKind;
  idempotencyKey: string;
}

export interface DailyOrbitSnapshotReader {
  snapshot(workspaceId: string, subjectUserId: string): Promise<DailyOrbitSnapshot>;
}

function cloneContext(context: Readonly<ProductPreferenceContext>): ProductPreferenceContext {
  return {
    jurisdictions: [...context.jurisdictions],
    topics: [...context.topics],
    platforms: [...context.platforms]
  };
}

function exactVersion(left: number | string, right: number | string): boolean {
  return String(left) === String(right);
}

function contextFromSignal(
  signal: Readonly<DailySignal>,
  platforms: readonly ContentPickPlatform[] = []
): ProductPreferenceContext {
  return {
    jurisdictions: [...signal.jurisdictions],
    topics: [...signal.topicTags],
    platforms: [...new Set(platforms)]
  };
}

function platformForVariant(kind: PlatformVariant['kind']): ContentPickPlatform {
  if (kind === 'WECHAT_MOMENTS_POST') return 'WECHAT_MOMENTS';
  if (kind === 'XIAOHONGSHU_POST') return 'XIAOHONGSHU';
  if (kind === 'WECHAT_OFFICIAL_ACCOUNT_OUTLINE' || kind === 'WECHAT_OFFICIAL_ACCOUNT_DRAFT')
    return 'WECHAT_OFFICIAL_ACCOUNT';
  return 'VIDEO_SCRIPT';
}

function platformForVisual(kind: VisualOutputKind): ContentPickPlatform {
  if (kind === 'XIAOHONGSHU_COVER') return 'XIAOHONGSHU';
  if (kind === 'WECHAT_OFFICIAL_ACCOUNT_COVER') return 'WECHAT_OFFICIAL_ACCOUNT';
  if (kind === 'MOMENTS_SOCIAL_CARD') return 'WECHAT_MOMENTS';
  return 'VIDEO_SCRIPT';
}

function numericVersion(value: number | string, field: string): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number) || number < 1)
    throw new ProductPreferenceTargetError(
      'INVALID_TARGET',
      `${field} must be a positive integer.`,
      422
    );
  return number;
}

function contentKitMiss(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as Partial<ContentKitError>).code;
  return code === 'CONTENT_OPPORTUNITY_REQUIRED' || code === 'CONTENT_PICK_NOT_FOUND';
}

export class DailyWorkspacePreferenceTargetResolver {
  constructor(
    private readonly orbit: DailyOrbitSnapshotReader,
    private readonly signals: DailySignalReader,
    private readonly contentKits: ContentKitService,
    private readonly visuals: PostgresVisualBridgeStore
  ) {}

  private async current(
    workspaceId: string,
    subjectUserId: string
  ): Promise<Readonly<OrbitSnapshot>> {
    return this.orbit.snapshot(workspaceId, subjectUserId);
  }

  private async signalForItem(
    workspaceId: string,
    item: Readonly<DailyOrbitItem>
  ): Promise<Readonly<DailySignal>> {
    const signals = await this.signals.listRecent(workspaceId, 250);
    const signal = signals.find(
      (candidate) =>
        candidate.dailySignalId === item.signal.id && candidate.version === item.signal.version
    );
    if (!signal)
      throw new ProductPreferenceTargetError(
        'TARGET_CONTEXT_UNAVAILABLE',
        'The exact Daily Signal behind this Product target is unavailable.',
        409
      );
    return signal;
  }

  private itemForPick(
    snapshot: Readonly<DailyOrbitSnapshot>,
    pick: Readonly<ContentPick>
  ): Readonly<DailyOrbitItem> {
    const item = snapshot.items.find(
      (candidate) =>
        candidate.dailyOrbitItemId === pick.orbitItem.id && candidate.version === pick.orbitItem.version
    );
    if (!item)
      throw new ProductPreferenceTargetError(
        'TARGET_CONTEXT_UNAVAILABLE',
        'The exact Daily Orbit Item behind this Content Pick is unavailable.',
        409
      );
    return item;
  }

  private async contextForPick(
    workspaceId: string,
    snapshot: Readonly<DailyOrbitSnapshot>,
    pick: Readonly<ContentPick>,
    platforms: readonly ContentPickPlatform[] = pick.recommendedPlatforms
  ): Promise<ProductPreferenceContext> {
    const item = this.itemForPick(snapshot, pick);
    return contextFromSignal(await this.signalForItem(workspaceId, item), platforms);
  }

  private async currentKits(
    workspaceId: string,
    subjectUserId: string,
    snapshot: Readonly<DailyOrbitSnapshot>
  ): Promise<ReadonlyArray<Readonly<{ pick: ContentPick; kit: ContentKit }>>> {
    const kits: Array<Readonly<{ pick: ContentPick; kit: ContentKit }>> = [];
    for (const pick of snapshot.contentPicks) {
      try {
        const kit = await this.contentKits.find(workspaceId, subjectUserId, pick.contentPickId);
        kits.push({ pick, kit });
      } catch (error) {
        if (!contentKitMiss(error)) throw error;
      }
    }
    return kits;
  }

  private async kitForReference(
    workspaceId: string,
    subjectUserId: string,
    snapshot: Readonly<DailyOrbitSnapshot>,
    reference: Readonly<ProductLoopExactReference<ContentKit['contentKitId']>>
  ): Promise<Readonly<{ pick: ContentPick; kit: ContentKit }>> {
    const found = (await this.currentKits(workspaceId, subjectUserId, snapshot)).find(
      ({ kit }) => kit.contentKitId === reference.id && kit.version === reference.version
    );
    if (!found)
      throw new ProductPreferenceTargetError(
        'TARGET_NOT_FOUND',
        'The exact Content Kit target was not found in this Workspace.',
        404
      );
    return found;
  }

  private async contextForVisualBrief(
    workspaceId: string,
    subjectUserId: string,
    snapshot: Readonly<DailyOrbitSnapshot>,
    brief: Readonly<VisualBriefRecord>
  ): Promise<ProductPreferenceContext> {
    const { pick } = await this.kitForReference(
      workspaceId,
      subjectUserId,
      snapshot,
      brief.brief.contentKit
    );
    return this.contextForPick(workspaceId, snapshot, pick, [platformForVisual(brief.brief.outputKind)]);
  }

  async resolve(
    workspaceId: string,
    subjectUserId: string,
    target: Readonly<ProductPreferenceTargetReference>
  ): Promise<ProductPreferenceContext> {
    const snapshot = await this.current(workspaceId, subjectUserId);

    if (target.targetType === 'DAILY_ORBIT_ITEM') {
      const version = numericVersion(target.targetVersion, 'targetVersion');
      const item = snapshot.items.find(
        (candidate) =>
          candidate.dailyOrbitItemId === target.targetId && candidate.version === version
      );
      if (!item)
        throw new ProductPreferenceTargetError(
          'TARGET_NOT_FOUND',
          'The exact Daily Orbit Item target was not found in this Workspace.',
          404
        );
      return contextFromSignal(await this.signalForItem(workspaceId, item));
    }

    if (target.targetType === 'CONTENT_PICK') {
      const version = numericVersion(target.targetVersion, 'targetVersion');
      const pick = snapshot.contentPicks.find(
        (candidate) => candidate.contentPickId === target.targetId && candidate.version === version
      );
      if (!pick)
        throw new ProductPreferenceTargetError(
          'TARGET_NOT_FOUND',
          'The exact Content Pick target was not found in this Workspace.',
          404
        );
      return this.contextForPick(workspaceId, snapshot, pick);
    }

    if (target.targetType === 'CONTENT_KIT') {
      const version = numericVersion(target.targetVersion, 'targetVersion');
      const { pick } = await this.kitForReference(workspaceId, subjectUserId, snapshot, {
        id: target.targetId as ContentKit['contentKitId'],
        version
      });
      return this.contextForPick(workspaceId, snapshot, pick);
    }

    if (target.targetType === 'PLATFORM_VARIANT') {
      const kitVersion = numericVersion(target.targetVersion, 'targetVersion');
      const found = (await this.currentKits(workspaceId, subjectUserId, snapshot)).find(
        ({ kit }) =>
          kit.version === kitVersion &&
          kit.platformVariants.some((variant) => variant.variantId === target.targetId)
      );
      if (!found)
        throw new ProductPreferenceTargetError(
          'TARGET_NOT_FOUND',
          'The exact Platform Variant target was not found in this Workspace.',
          404
        );
      const variant = found.kit.platformVariants.find(
        (candidate) => candidate.variantId === target.targetId
      )!;
      return this.contextForPick(workspaceId, snapshot, found.pick, [platformForVariant(variant.kind)]);
    }

    if (!target.targetId.startsWith('visual-output_'))
      throw new ProductPreferenceTargetError('INVALID_TARGET', 'Visual Output target id is invalid.', 422);
    const outputVersion = numericVersion(target.targetVersion, 'targetVersion');
    const output = await this.visuals.findOutput(workspaceId, {
      id: target.targetId as VisualOutputReferenceId,
      version: outputVersion
    });
    if (!output)
      throw new ProductPreferenceTargetError(
        'TARGET_NOT_FOUND',
        'The exact Visual Output target was not found in this Workspace.',
        404
      );
    const brief = await this.visuals.findBrief(workspaceId, output.visualBrief);
    if (!brief)
      throw new ProductPreferenceTargetError(
        'TARGET_CONTEXT_UNAVAILABLE',
        'The Visual Brief behind this output is unavailable.',
        409
      );
    return cloneContext(
      await this.contextForVisualBrief(workspaceId, subjectUserId, snapshot, brief)
    );
  }
}

export class ProductPreferenceService {
  constructor(
    private readonly store: PostgresProductPreferenceStore,
    private readonly targets: DailyWorkspacePreferenceTargetResolver
  ) {}

  async record(
    command: Readonly<RecordProductPreferenceEventCommand>
  ): Promise<RecordProductPreferenceEventResult> {
    const context = await this.targets.resolve(command.workspaceId, command.subjectUserId, command);
    return this.store.recordCanonicalEvent({
      workspaceId: command.workspaceId,
      subjectUserId: command.subjectUserId,
      kind: command.kind,
      targetType: command.targetType,
      targetId: command.targetId,
      targetVersion: command.targetVersion,
      context,
      idempotencyKey: command.idempotencyKey
    });
  }
}
