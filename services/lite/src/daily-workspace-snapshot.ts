import type { ContentPick, DailyOrbitItem } from '@markorbit/contracts/daily-workspace';
import type { LiteWorkItemStatus, LiteWorkItemV1 } from '@markorbit/contracts/lite-work-item';
import type {
  LiteTodaySnapshot,
  ProductLoopUseFeedback,
  PublishPackage
} from '@markorbit/contracts/product-loop';
import { DailyOrbitError, type DailyOrbitService, type DailyOrbitSnapshot } from './daily-orbit.js';
import {
  projectLiteWorkItemsToCalendarV1,
  type LiteWorkItemCalendarEntryV1
} from './work-item-calendar.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_WORK_ITEM_STATUSES = [
  'OPEN',
  'WAITING_FOR_CLIENT',
  'WAITING_FOR_PROVIDER'
] as const satisfies readonly LiteWorkItemStatus[];
const ACTIVE_WORK_ITEM_STATUS_SET: ReadonlySet<LiteWorkItemStatus> = new Set(
  ACTIVE_WORK_ITEM_STATUSES
);
const WORK_ITEM_BUCKET_LIMIT = 100;

export type DailyWorkspaceSnapshotErrorCode =
  | 'INVALID_INPUT'
  | 'WORKSPACE_MISMATCH'
  | 'DEPENDENCY_INTEGRITY_FAILURE'
  | 'DEPENDENCY_UNAVAILABLE';

export class DailyWorkspaceSnapshotError extends Error {
  constructor(
    readonly code: DailyWorkspaceSnapshotErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'DailyWorkspaceSnapshotError';
  }
}

export interface DailyWorkspaceTodaySnapshot extends LiteTodaySnapshot {
  recentFeedback: ReadonlyArray<Readonly<ProductLoopUseFeedback>>;
  feedbackPendingPackages: ReadonlyArray<Readonly<PublishPackage>>;
}

export interface DailyWorkspaceTodayReader {
  listToday(workspaceId: string): Promise<DailyWorkspaceTodaySnapshot>;
}

export interface DailyWorkspaceWorkListOptions {
  statuses: readonly LiteWorkItemStatus[];
  assigneePrincipalId: string | null;
  limit: number;
}

export interface DailyWorkspaceWorkReader {
  list(
    workspaceId: string,
    options: Readonly<DailyWorkspaceWorkListOptions>
  ): Promise<readonly LiteWorkItemV1[]>;
}

export interface DailyWorkspaceSnapshot {
  schemaVersion: 1;
  workspaceId: string;
  subjectUserId: string;
  generatedAt: string;
  see: {
    preferenceSource: DailyOrbitSnapshot['preferenceSource'] | null;
    savedOrbitItemIds: readonly string[];
    orbitItems: ReadonlyArray<Readonly<DailyOrbitItem>>;
  };
  create: {
    contentPicks: ReadonlyArray<Readonly<ContentPick>>;
  };
  move: {
    todayItems: LiteTodaySnapshot['items'];
    recentFeedback: ReadonlyArray<Readonly<ProductLoopUseFeedback>>;
    feedbackPendingPackages: ReadonlyArray<Readonly<PublishPackage>>;
    work?: {
      assignedToMe: ReadonlyArray<Readonly<LiteWorkItemV1>>;
      unassigned: ReadonlyArray<Readonly<LiteWorkItemV1>>;
    };
    calendar?: ReadonlyArray<Readonly<LiteWorkItemCalendarEntryV1>>;
  };
  partial: boolean;
  warnings: readonly string[];
  executionAuthorized: false;
  externalPublishExecuted: false;
  officialTruthCreated: false;
}

function cleanWorkspaceId(value: string): string {
  const workspaceId = value.trim().toLowerCase();
  if (!UUID.test(workspaceId)) {
    throw new DailyWorkspaceSnapshotError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  }
  return workspaceId;
}

function cleanUserId(value: string): string {
  const userId = value.trim();
  if (!userId) {
    throw new DailyWorkspaceSnapshotError('INVALID_INPUT', 'subjectUserId is required.', 422);
  }
  return userId;
}

function ensureWorkspace(expected: string, actual: string, dependency: string): void {
  if (actual.toLowerCase() !== expected) {
    throw new DailyWorkspaceSnapshotError(
      'WORKSPACE_MISMATCH',
      `${dependency} returned data for a different Workspace.`,
      503,
      false
    );
  }
}

function dependencyIntegrity(message: string): never {
  throw new DailyWorkspaceSnapshotError('DEPENDENCY_INTEGRITY_FAILURE', message, 503, false);
}

function ensureWorkBucket(
  workspaceId: string,
  subjectUserId: string,
  bucket: 'ASSIGNED_TO_ME' | 'UNASSIGNED',
  items: readonly LiteWorkItemV1[]
): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    ensureWorkspace(workspaceId, item.workspaceId, `Work ${bucket}`);
    if (!ACTIVE_WORK_ITEM_STATUS_SET.has(item.status)) {
      dependencyIntegrity(`Work ${bucket} returned an inactive Work Item.`);
    }
    if (bucket === 'ASSIGNED_TO_ME' && item.assigneePrincipalId !== subjectUserId) {
      dependencyIntegrity('Assigned Work returned an item for a different subject user.');
    }
    if (bucket === 'UNASSIGNED' && item.assigneePrincipalId !== undefined) {
      dependencyIntegrity('Unassigned Work returned an assigned item.');
    }
    if (ids.has(item.liteWorkItemId)) {
      dependencyIntegrity(`Work ${bucket} returned a duplicate Work Item.`);
    }
    ids.add(item.liteWorkItemId);
  }
  return ids;
}

function orbitWarning(error: unknown): string {
  if (error instanceof DailyOrbitError && error.code === 'INVALID_INPUT') throw error;
  return 'SEE_CREATE_UNAVAILABLE';
}

export class DailyWorkspaceSnapshotService {
  constructor(
    private readonly orbit: Pick<DailyOrbitService, 'snapshot'>,
    private readonly today: DailyWorkspaceTodayReader,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly work?: DailyWorkspaceWorkReader
  ) {}

  async snapshot(
    workspaceIdValue: string,
    subjectUserIdValue: string
  ): Promise<DailyWorkspaceSnapshot> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const subjectUserId = cleanUserId(subjectUserIdValue);
    const generatedAt = new Date(this.now()).toISOString();
    const warnings: string[] = [];

    let orbit: DailyOrbitSnapshot | undefined;
    let today: DailyWorkspaceTodaySnapshot | undefined;
    let assignedWork: readonly LiteWorkItemV1[] | undefined;
    let unassignedWork: readonly LiteWorkItemV1[] | undefined;

    const [orbitResult, todayResult, assignedWorkResult, unassignedWorkResult] =
      await Promise.allSettled([
        this.orbit.snapshot(workspaceId, subjectUserId),
        this.today.listToday(workspaceId),
        this.work
          ? this.work.list(workspaceId, {
              statuses: ACTIVE_WORK_ITEM_STATUSES,
              assigneePrincipalId: subjectUserId,
              limit: WORK_ITEM_BUCKET_LIMIT
            })
          : Promise.resolve(undefined),
        this.work
          ? this.work.list(workspaceId, {
              statuses: ACTIVE_WORK_ITEM_STATUSES,
              assigneePrincipalId: null,
              limit: WORK_ITEM_BUCKET_LIMIT
            })
          : Promise.resolve(undefined)
      ] as const);

    if (orbitResult.status === 'fulfilled') {
      orbit = orbitResult.value;
      ensureWorkspace(workspaceId, orbit.workspaceId, 'Daily Orbit');
      if (orbit.subjectUserId !== subjectUserId) {
        throw new DailyWorkspaceSnapshotError(
          'WORKSPACE_MISMATCH',
          'Daily Orbit returned data for a different subject user.',
          503
        );
      }
      if (orbit.partial) warnings.push(...orbit.warnings.map((warning) => `SEE_CREATE:${warning}`));
    } else {
      warnings.push(orbitWarning(orbitResult.reason));
    }

    if (todayResult.status === 'fulfilled') {
      today = todayResult.value;
      ensureWorkspace(workspaceId, today.workspaceId, 'Today');
      if (today.partial) warnings.push(...today.warnings.map((warning) => `MOVE:${warning}`));
    } else {
      warnings.push('MOVE_UNAVAILABLE');
    }

    if (this.work) {
      const workWarnings: string[] = [];
      if (assignedWorkResult.status === 'fulfilled' && assignedWorkResult.value !== undefined) {
        assignedWork = assignedWorkResult.value;
        ensureWorkBucket(workspaceId, subjectUserId, 'ASSIGNED_TO_ME', assignedWork);
      } else {
        workWarnings.push('WORK_ITEMS_ASSIGNED_TO_ME_UNAVAILABLE');
      }

      if (unassignedWorkResult.status === 'fulfilled' && unassignedWorkResult.value !== undefined) {
        unassignedWork = unassignedWorkResult.value;
        const unassignedIds = ensureWorkBucket(
          workspaceId,
          subjectUserId,
          'UNASSIGNED',
          unassignedWork
        );
        if (assignedWork) {
          for (const item of assignedWork) {
            if (unassignedIds.has(item.liteWorkItemId)) {
              dependencyIntegrity('A Work Item appeared in both personal Work buckets.');
            }
          }
        }
      } else {
        workWarnings.push('WORK_ITEMS_UNASSIGNED_UNAVAILABLE');
      }

      if (workWarnings.length > 0) warnings.push('WORK_ITEMS_UNAVAILABLE', ...workWarnings);
    }

    const workAvailable = assignedWork !== undefined || unassignedWork !== undefined;
    const calendar = this.work
      ? projectLiteWorkItemsToCalendarV1([...(assignedWork ?? []), ...(unassignedWork ?? [])])
      : undefined;
    if (!orbit && !today && !workAvailable) {
      throw new DailyWorkspaceSnapshotError(
        'DEPENDENCY_UNAVAILABLE',
        'Lite Daily Workspace dependencies are unavailable.',
        503,
        true
      );
    }

    return {
      schemaVersion: 1,
      workspaceId,
      subjectUserId,
      generatedAt,
      see: {
        preferenceSource: orbit?.preferenceSource ?? null,
        savedOrbitItemIds: orbit?.savedOrbitItemIds ?? [],
        orbitItems: orbit?.items ?? []
      },
      create: { contentPicks: orbit?.contentPicks ?? [] },
      move: {
        todayItems: today?.items ?? [],
        recentFeedback: today?.recentFeedback ?? [],
        feedbackPendingPackages: today?.feedbackPendingPackages ?? [],
        ...(this.work
          ? {
              work: {
                assignedToMe: assignedWork ?? [],
                unassigned: unassignedWork ?? []
              },
              calendar: calendar ?? []
            }
          : {})
      },
      partial: warnings.length > 0,
      warnings,
      executionAuthorized: false,
      externalPublishExecuted: false,
      officialTruthCreated: false
    };
  }
}
