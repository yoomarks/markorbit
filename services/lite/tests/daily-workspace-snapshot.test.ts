import { describe, expect, it, vi } from 'vitest';
import type { DailyOrbitSnapshot } from '../src/daily-orbit.js';
import {
  DailyWorkspaceSnapshotService,
  type DailyWorkspaceSnapshotError,
  type DailyWorkspaceTodaySnapshot
} from '../src/daily-workspace-snapshot.js';

const workspaceId = '71717171-7171-4717-8717-717171717171';
const userId = 'user_daily_workspace';
const generatedAt = '2026-08-24T00:00:00.000Z';

function orbit(overrides: Partial<DailyOrbitSnapshot> = {}): DailyOrbitSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    subjectUserId: userId,
    generatedAt,
    preferenceSource: 'NONE',
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

function service(input: {
  orbit?: () => Promise<DailyOrbitSnapshot>;
  today?: () => Promise<DailyWorkspaceTodaySnapshot>;
}) {
  return new DailyWorkspaceSnapshotService(
    {
      snapshot: vi.fn(input.orbit ?? (() => Promise.resolve(orbit())))
    },
    {
      listToday: vi.fn(input.today ?? (() => Promise.resolve(today())))
    },
    () => generatedAt
  );
}

describe('Lite Daily Workspace snapshot', () => {
  it('composes SEE, CREATE and MOVE into one authority-safe read model', async () => {
    const result = await service({}).snapshot(workspaceId, userId);

    expect(result).toEqual({
      schemaVersion: 1,
      workspaceId,
      subjectUserId: userId,
      generatedAt,
      see: { preferenceSource: 'NONE', orbitItems: [] },
      create: { contentPicks: [] },
      move: { todayItems: [], recentFeedback: [], feedbackPendingPackages: [] },
      partial: false,
      warnings: [],
      executionAuthorized: false,
      externalPublishExecuted: false,
      officialTruthCreated: false
    });
  });

  it('keeps MOVE usable when SEE/CREATE is temporarily unavailable without inventing preference provenance', async () => {
    const result = await service({
      orbit: () => Promise.reject(new Error('orbit unavailable'))
    }).snapshot(workspaceId, userId);

    expect(result.partial).toBe(true);
    expect(result.warnings).toEqual(['SEE_CREATE_UNAVAILABLE']);
    expect(result.see.preferenceSource).toBeNull();
    expect(result.move.todayItems).toEqual([]);
    expect(result.move.recentFeedback).toEqual([]);
    expect(result.executionAuthorized).toBe(false);
  });

  it('keeps SEE/CREATE usable when MOVE is temporarily unavailable', async () => {
    const result = await service({
      today: () => Promise.reject(new Error('today unavailable'))
    }).snapshot(workspaceId, userId);

    expect(result.partial).toBe(true);
    expect(result.warnings).toEqual(['MOVE_UNAVAILABLE']);
    expect(result.see.orbitItems).toEqual([]);
    expect(result.create.contentPicks).toEqual([]);
    expect(result.move.recentFeedback).toEqual([]);
    expect(result.move.feedbackPendingPackages).toEqual([]);
  });

  it('fails rather than manufacturing an empty workspace when both dependencies fail', async () => {
    await expect(
      service({
        orbit: () => Promise.reject(new Error('orbit unavailable')),
        today: () => Promise.reject(new Error('today unavailable'))
      }).snapshot(workspaceId, userId)
    ).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      status: 503,
      retryable: true
    } satisfies Partial<DailyWorkspaceSnapshotError>);
  });

  it('fails closed on cross-workspace dependency data', async () => {
    await expect(
      service({
        today: () => Promise.resolve(today({ workspaceId: '72727272-7272-4727-8727-727272727272' }))
      }).snapshot(workspaceId, userId)
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH', status: 503 });
  });
});
