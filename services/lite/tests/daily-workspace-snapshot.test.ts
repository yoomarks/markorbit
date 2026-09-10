import { describe, expect, it, vi } from 'vitest';
import {
  noLiteWorkItemAuthorityConsequencesV1,
  type LiteWorkItemV1
} from '@markorbit/contracts/lite-work-item';
import type { DailyOrbitSnapshot } from '../src/daily-orbit.js';
import {
  DailyWorkspaceSnapshotService,
  type DailyWorkspaceSnapshotError,
  type DailyWorkspaceTodaySnapshot,
  type DailyWorkspaceWorkListOptions,
  type DailyWorkspaceWorkReader
} from '../src/daily-workspace-snapshot.js';

const workspaceId = '71717171-7171-4717-8717-717171717171';
const otherWorkspaceId = '72727272-7272-4727-8727-727272727272';
const userId = 'user_daily_workspace';
const generatedAt = '2026-08-24T00:00:00.000Z';

function orbit(overrides: Partial<DailyOrbitSnapshot> = {}): DailyOrbitSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    subjectUserId: userId,
    generatedAt,
    preferenceSource: 'NONE',
    savedOrbitItemIds: [],
    items: [],
    contentPicks: [],
    partial: false,
    warnings: [],
    executionAuthorized: false,
    legalTruthVerified: false,
    ...overrides
  };
}

function today(overrides: Partial<DailyWorkspaceTodaySnapshot> = {}): DailyWorkspaceTodaySnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    generatedAt,
    items: [],
    partial: false,
    warnings: [],
    recentFeedback: [],
    feedbackPendingPackages: [],
    ...overrides
  };
}

function workItem(id: string, overrides: Partial<LiteWorkItemV1> = {}): LiteWorkItemV1 {
  return {
    schemaVersion: 1,
    liteWorkItemId: `lite-work-item_${id}`,
    workspaceId,
    version: 1,
    taskType: 'GENERAL_FOLLOW_UP',
    title: `Work ${id}`,
    priority: 'NOTICE',
    status: 'OPEN',
    source: {
      sourceClass: 'MANUAL',
      recordedByPrincipalId: userId,
      recordedAt: generatedAt
    },
    relatedReferences: [],
    certifiedDeadlineReferences: [],
    observedDateCandidates: [],
    internalTiming: {
      timeClass: 'LITE_INTERNAL_OPERATIONAL',
      certifiedLegalDeadline: false
    },
    waitingSinceAt: null,
    completedAt: null,
    cancelledAt: null,
    archivedAt: null,
    archivedFrom: null,
    authorityConsequences: noLiteWorkItemAuthorityConsequencesV1,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    ...overrides
  };
}

function service(input: {
  orbit?: () => Promise<DailyOrbitSnapshot>;
  today?: () => Promise<DailyWorkspaceTodaySnapshot>;
  work?: DailyWorkspaceWorkReader['list'];
  withoutWork?: boolean;
}) {
  const reader = input.withoutWork
    ? undefined
    : {
        list: input.work ?? (() => Promise.resolve([]))
      };
  return new DailyWorkspaceSnapshotService(
    {
      snapshot: vi.fn(input.orbit ?? (() => Promise.resolve(orbit())))
    },
    {
      listToday: vi.fn(input.today ?? (() => Promise.resolve(today())))
    },
    () => generatedAt,
    reader
  );
}

describe('Lite Daily Workspace snapshot', () => {
  it('composes SEE, CREATE, MOVE and empty active Work buckets into one authority-safe read model', async () => {
    const result = await service({}).snapshot(workspaceId, userId);

    expect(result).toEqual({
      schemaVersion: 1,
      workspaceId,
      subjectUserId: userId,
      generatedAt,
      see: { preferenceSource: 'NONE', savedOrbitItemIds: [], orbitItems: [] },
      create: { contentPicks: [] },
      move: {
        todayItems: [],
        recentFeedback: [],
        feedbackPendingPackages: [],
        work: { assignedToMe: [], unassigned: [] },
        calendar: []
      },
      partial: false,
      warnings: [],
      executionAuthorized: false,
      externalPublishExecuted: false,
      officialTruthCreated: false
    });
  });

  it('keeps the constructor backward compatible for legacy internal fixtures without Work projection', async () => {
    const result = await service({ withoutWork: true }).snapshot(workspaceId, userId);
    expect(result.partial).toBe(false);
    expect(result.move).not.toHaveProperty('work');
    expect(result.move).not.toHaveProperty('calendar');
  });

  it('queries exact active assigned/unassigned owner buckets and preserves owner ordering and WAITING', async () => {
    const assigned = workItem('assigned', {
      assigneePrincipalId: userId,
      status: 'WAITING_FOR_PROVIDER',
      waitingSinceAt: generatedAt,
      internalTiming: {
        timeClass: 'LITE_INTERNAL_OPERATIONAL',
        internalDueAt: '2026-09-12T09:00:00.000Z',
        certifiedLegalDeadline: false
      }
    });
    const unassigned = workItem('unassigned', {
      internalTiming: {
        timeClass: 'LITE_INTERNAL_OPERATIONAL',
        followUpAt: '2026-09-13T10:00:00.000Z',
        certifiedLegalDeadline: false
      }
    });
    const work = vi.fn(
      (_requestedWorkspaceId: string, options: Readonly<DailyWorkspaceWorkListOptions>) =>
        Promise.resolve(options.assigneePrincipalId === null ? [unassigned] : [assigned])
    );

    const result = await service({ work }).snapshot(workspaceId, userId);

    expect(work).toHaveBeenCalledTimes(2);
    expect(work).toHaveBeenNthCalledWith(1, workspaceId, {
      statuses: ['OPEN', 'WAITING_FOR_CLIENT', 'WAITING_FOR_PROVIDER'],
      assigneePrincipalId: userId,
      limit: 100
    });
    expect(work).toHaveBeenNthCalledWith(2, workspaceId, {
      statuses: ['OPEN', 'WAITING_FOR_CLIENT', 'WAITING_FOR_PROVIDER'],
      assigneePrincipalId: null,
      limit: 100
    });
    expect(result.move.work?.assignedToMe).toEqual([assigned]);
    expect(result.move.work?.unassigned).toEqual([unassigned]);
    expect(result.move.calendar).toEqual([
      expect.objectContaining({
        liteWorkItemId: assigned.liteWorkItemId,
        kind: 'INTERNAL_DUE',
        timestamp: '2026-09-12T09:00:00.000Z',
        certifiedLegalDeadline: false
      }),
      expect.objectContaining({
        liteWorkItemId: unassigned.liteWorkItemId,
        kind: 'FOLLOW_UP',
        timestamp: '2026-09-13T10:00:00.000Z',
        certifiedLegalDeadline: false
      })
    ]);
    expect(result.move.work?.assignedToMe[0]).toBe(assigned);
    expect(result.move.work?.assignedToMe[0]?.authorityConsequences).toEqual(
      noLiteWorkItemAuthorityConsequencesV1
    );
  });

  it('keeps MOVE usable when SEE/CREATE is temporarily unavailable without inventing preference provenance', async () => {
    const result = await service({
      orbit: () => Promise.reject(new Error('orbit unavailable'))
    }).snapshot(workspaceId, userId);

    expect(result.partial).toBe(true);
    expect(result.warnings).toEqual(['SEE_CREATE_UNAVAILABLE']);
    expect(result.see.preferenceSource).toBeNull();
    expect(result.see.savedOrbitItemIds).toEqual([]);
    expect(result.move.todayItems).toEqual([]);
    expect(result.move.recentFeedback).toEqual([]);
    expect(result.move.work).toEqual({ assignedToMe: [], unassigned: [] });
    expect(result.move.calendar).toEqual([]);
    expect(result.executionAuthorized).toBe(false);
  });

  it('keeps SEE/CREATE and Work usable when MOVE is temporarily unavailable', async () => {
    const result = await service({
      today: () => Promise.reject(new Error('today unavailable'))
    }).snapshot(workspaceId, userId);

    expect(result.partial).toBe(true);
    expect(result.warnings).toEqual(['MOVE_UNAVAILABLE']);
    expect(result.see.savedOrbitItemIds).toEqual([]);
    expect(result.see.orbitItems).toEqual([]);
    expect(result.create.contentPicks).toEqual([]);
    expect(result.move.recentFeedback).toEqual([]);
    expect(result.move.feedbackPendingPackages).toEqual([]);
    expect(result.move.work).toEqual({ assignedToMe: [], unassigned: [] });
    expect(result.move.calendar).toEqual([]);
  });

  it('preserves the successful Work bucket and reports aggregate plus bucket-specific outage warnings', async () => {
    const assigned = workItem('assigned', {
      assigneePrincipalId: userId,
      internalTiming: {
        timeClass: 'LITE_INTERNAL_OPERATIONAL',
        remindAt: '2026-09-11T08:00:00.000Z',
        certifiedLegalDeadline: false
      }
    });
    const result = await service({
      work: (_requestedWorkspaceId, options) =>
        options.assigneePrincipalId === null
          ? Promise.reject(new Error('unassigned unavailable'))
          : Promise.resolve([assigned])
    }).snapshot(workspaceId, userId);

    expect(result.partial).toBe(true);
    expect(result.warnings).toEqual([
      'WORK_ITEMS_UNAVAILABLE',
      'WORK_ITEMS_UNASSIGNED_UNAVAILABLE'
    ]);
    expect(result.move.work).toEqual({ assignedToMe: [assigned], unassigned: [] });
    expect(result.move.calendar).toEqual([
      expect.objectContaining({
        liteWorkItemId: assigned.liteWorkItemId,
        kind: 'REMINDER',
        timestamp: '2026-09-11T08:00:00.000Z'
      })
    ]);
  });

  it('does not represent both Work bucket failures as healthy empty Work', async () => {
    const result = await service({
      work: () => Promise.reject(new Error('work unavailable'))
    }).snapshot(workspaceId, userId);

    expect(result.partial).toBe(true);
    expect(result.warnings).toEqual([
      'WORK_ITEMS_UNAVAILABLE',
      'WORK_ITEMS_ASSIGNED_TO_ME_UNAVAILABLE',
      'WORK_ITEMS_UNASSIGNED_UNAVAILABLE'
    ]);
    expect(result.move.work).toEqual({ assignedToMe: [], unassigned: [] });
    expect(result.move.calendar).toEqual([]);
  });

  it('remains usable as a Work-centric partial snapshot when SEE/CREATE and MOVE both fail', async () => {
    const assigned = workItem('assigned', { assigneePrincipalId: userId });
    const result = await service({
      orbit: () => Promise.reject(new Error('orbit unavailable')),
      today: () => Promise.reject(new Error('today unavailable')),
      work: (_requestedWorkspaceId, options) =>
        options.assigneePrincipalId === null
          ? Promise.reject(new Error('unassigned unavailable'))
          : Promise.resolve([assigned])
    }).snapshot(workspaceId, userId);

    expect(result.partial).toBe(true);
    expect(result.warnings).toEqual([
      'SEE_CREATE_UNAVAILABLE',
      'MOVE_UNAVAILABLE',
      'WORK_ITEMS_UNAVAILABLE',
      'WORK_ITEMS_UNASSIGNED_UNAVAILABLE'
    ]);
    expect(result.move.work).toEqual({ assignedToMe: [assigned], unassigned: [] });
  });

  it('fails rather than manufacturing an empty workspace when every configured dependency fails', async () => {
    await expect(
      service({
        orbit: () => Promise.reject(new Error('orbit unavailable')),
        today: () => Promise.reject(new Error('today unavailable')),
        work: () => Promise.reject(new Error('work unavailable'))
      }).snapshot(workspaceId, userId)
    ).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      status: 503,
      retryable: true
    } satisfies Partial<DailyWorkspaceSnapshotError>);
  });

  it('fails closed on cross-workspace Today dependency data', async () => {
    await expect(
      service({
        today: () => Promise.resolve(today({ workspaceId: otherWorkspaceId }))
      }).snapshot(workspaceId, userId)
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH', status: 503 });
  });

  it('fails closed on cross-workspace Work data', async () => {
    await expect(
      service({
        work: (_requestedWorkspaceId, options) =>
          Promise.resolve(
            options.assigneePrincipalId === null
              ? []
              : [
                  workItem('foreign', {
                    workspaceId: otherWorkspaceId,
                    assigneePrincipalId: userId
                  })
                ]
          )
      }).snapshot(workspaceId, userId)
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH', status: 503 });
  });

  it.each([
    [
      'wrong assigned subject',
      workItem('wrong-subject', { assigneePrincipalId: 'user_other' }),
      false
    ],
    [
      'assigned item in unassigned bucket',
      workItem('unexpected-assignee', { assigneePrincipalId: userId }),
      true
    ],
    [
      'inactive completed item',
      workItem('completed', { status: 'COMPLETED', completedAt: generatedAt }),
      false
    ]
  ] as const)(
    'fails closed on Work dependency integrity: %s',
    async (_label, invalid, asUnassigned) => {
      await expect(
        service({
          work: (_requestedWorkspaceId, options) =>
            Promise.resolve(
              (options.assigneePrincipalId === null) === asUnassigned ? [invalid] : []
            )
        }).snapshot(workspaceId, userId)
      ).rejects.toMatchObject({ code: 'DEPENDENCY_INTEGRITY_FAILURE', status: 503 });
    }
  );

  it('fails closed if the same Work Item id appears in both personal buckets', async () => {
    const assigned = workItem('duplicate', { assigneePrincipalId: userId });
    const unassigned = workItem('duplicate');
    await expect(
      service({
        work: (_requestedWorkspaceId, options) =>
          Promise.resolve(options.assigneePrincipalId === null ? [unassigned] : [assigned])
      }).snapshot(workspaceId, userId)
    ).rejects.toMatchObject({ code: 'DEPENDENCY_INTEGRITY_FAILURE', status: 503 });
  });
});
