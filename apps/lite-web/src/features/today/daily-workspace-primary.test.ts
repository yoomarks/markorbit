import { describe, expect, it } from 'vitest';
import type { DailyWorkspaceSnapshot } from '../../api/daily-workspace.js';
import { projectDailyWorkspacePrimary } from './daily-workspace-primary.js';

const workspaceId = '81818181-8181-4818-8818-818181818181';

function snapshot(overrides: Partial<DailyWorkspaceSnapshot> = {}): DailyWorkspaceSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    subjectUserId: 'user_primary_workspace',
    generatedAt: '2026-08-24T00:00:00.000Z',
    see: { preferenceSource: 'PRODUCT_FEEDBACK', orbitItems: [] },
    create: { contentPicks: [] },
    move: { todayItems: [], recentFeedback: [], feedbackPendingPackages: [] },
    partial: false,
    warnings: [],
    executionAuthorized: false,
    externalPublishExecuted: false,
    officialTruthCreated: false,
    ...overrides
  };
}

describe('Daily Workspace primary projection', () => {
  it('projects the aggregate into existing SEE/CREATE and MOVE view models', () => {
    const result = projectDailyWorkspacePrimary(snapshot());

    expect(result.orbit).toMatchObject({
      workspaceId,
      subjectUserId: 'user_primary_workspace',
      preferenceSource: 'PRODUCT_FEEDBACK',
      partial: false,
      executionAuthorized: false,
      legalTruthVerified: false
    });
    expect(result.today).toMatchObject({
      workspaceId,
      partial: false,
      recentFeedback: [],
      feedbackPendingPackages: []
    });
  });

  it('keeps SEE/CREATE and MOVE degradation independent', () => {
    const result = projectDailyWorkspacePrimary(
      snapshot({
        partial: true,
        warnings: ['SEE_CREATE:Knowledge refresh is stale.', 'MOVE_UNAVAILABLE']
      })
    );

    expect(result.orbit.partial).toBe(true);
    expect(result.orbit.warnings).toEqual(['Knowledge refresh is stale.']);
    expect(result.today.partial).toBe(true);
    expect(result.today.warnings).toEqual(['MOVE_UNAVAILABLE']);
  });

  it('uses NONE only as a compatibility view when SEE provenance is unavailable', () => {
    const result = projectDailyWorkspacePrimary(
      snapshot({
        see: { preferenceSource: null, orbitItems: [] },
        partial: true,
        warnings: ['SEE_CREATE_UNAVAILABLE']
      })
    );

    expect(result.orbit.preferenceSource).toBe('NONE');
    expect(result.orbit.partial).toBe(true);
    expect(result.orbit.warnings).toEqual(['SEE_CREATE_UNAVAILABLE']);
  });
});
