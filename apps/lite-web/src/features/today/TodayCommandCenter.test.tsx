// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { DailyOrbitItem } from '@markorbit/contracts/daily-workspace';
import type { PreparedActionJourney, TodayRecommendation } from '@markorbit/contracts/product-loop';
import { afterEach, describe, expect, it } from 'vitest';
import type { DailyOrbitSnapshot } from '../../api/daily-workspace.js';
import type { TodayProductLoopSnapshot } from '../../api/product-loop.js';
import { TodayCommandCenter } from './TodayCommandCenter.js';

afterEach(cleanup);

const workspaceId = '25252525-2525-4252-8252-252525252525';
const recommendation = {
  todayRecommendationId: 'today-recommendation_846',
  kind: 'CONTENT_PREPARATION',
  title: 'Prepare governed content',
  status: 'OPEN'
} as unknown as TodayRecommendation;
const waiting = {
  handoffState: 'AWAITING_CONFIRMATION'
} as unknown as PreparedActionJourney;

function today(preparedActions: readonly PreparedActionJourney[]): TodayProductLoopSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    generatedAt: '2026-09-06T00:00:00.000Z',
    items: [{ recommendation, preparedActions }],
    partial: false,
    warnings: [],
    recentFeedback: [],
    feedbackPendingPackages: []
  };
}

function orbit(count = 2): DailyOrbitSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    subjectUserId: '11111111-1111-4111-8111-111111111111',
    generatedAt: '2026-09-06T00:00:00.000Z',
    preferenceSource: 'NONE',
    savedOrbitItemIds: [],
    items: Array.from({ length: count }, (_, index) => ({
      dailyOrbitItemId: `orbit_${index + 1}`
    })) as unknown as DailyOrbitItem[],
    contentPicks: [],
    partial: false,
    warnings: [],
    executionAuthorized: false,
    legalTruthVerified: false
  };
}

describe('Today command center', () => {
  it('shows exact currently actionable Today state before the section catalog', () => {
    render(
      <TodayCommandCenter
        today={today([waiting])}
        orbit={orbit()}
        explicitSelection={{
          recommendationId: 'today-recommendation_846',
          preparedActionId: 'prepared-action_846',
          contentPickId: ''
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Today at a glance' })).toBeVisible();
    expect(screen.getByText('1')).toBeVisible();
    expect(screen.getByText('Action available')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Prepared action selected' })).toBeVisible();
  });

  it('does not infer continuity from browser history when no exact deep-link reference exists', () => {
    render(
      <TodayCommandCenter
        today={today([])}
        orbit={orbit(0)}
        explicitSelection={{ recommendationId: '', preparedActionId: '', contentPickId: '' }}
      />
    );

    expect(screen.getByRole('heading', { name: 'No pinned work' })).toBeVisible();
    expect(screen.getByText(/Nothing is being inferred from browser history/)).toBeVisible();
  });

  it('states that since-last-visit change truth is unavailable instead of inventing a delta', () => {
    render(
      <TodayCommandCenter
        today={today([])}
        orbit={orbit(3)}
        explicitSelection={{ recommendationId: '', preparedActionId: '', contentPickId: '' }}
      />
    );

    expect(screen.getByRole('heading', { name: '3 current ranked signals' })).toBeVisible();
    expect(screen.getByText(/does not produce a since-last-visit delta/)).toBeVisible();
    expect(screen.getByText(/does not infer that a signal is new or changed/)).toBeVisible();
  });
});
