import type { ContentPick, DailyOrbitItem } from '@markorbit/contracts/daily-workspace';
import type {
  LiteTodaySnapshot,
  ProductLoopUseFeedback,
  PublishPackage
} from '@markorbit/contracts/product-loop';
import { DailyOrbitError, type DailyOrbitService, type DailyOrbitSnapshot } from './daily-orbit.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DailyWorkspaceSnapshotErrorCode =
  'INVALID_INPUT' | 'WORKSPACE_MISMATCH' | 'DEPENDENCY_UNAVAILABLE';

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

function orbitWarning(error: unknown): string {
  if (error instanceof DailyOrbitError && error.code === 'INVALID_INPUT') throw error;
  return 'SEE_CREATE_UNAVAILABLE';
}

export class DailyWorkspaceSnapshotService {
  constructor(
    private readonly orbit: Pick<DailyOrbitService, 'snapshot'>,
    private readonly today: DailyWorkspaceTodayReader,
    private readonly now: () => string = () => new Date().toISOString()
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

    const [orbitResult, todayResult] = await Promise.allSettled([
      this.orbit.snapshot(workspaceId, subjectUserId),
      this.today.listToday(workspaceId)
    ]);

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

    if (!orbit && !today) {
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
        feedbackPendingPackages: today?.feedbackPendingPackages ?? []
      },
      partial: warnings.length > 0,
      warnings,
      executionAuthorized: false,
      externalPublishExecuted: false,
      officialTruthCreated: false
    };
  }
}
