// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WorkspaceInsightsHttpError,
  type WorkspaceInsightsClient
} from '../../api/workspace-insights.js';
import { insightsWorkspaceId, workspaceInsightsFixture } from './fixtures.js';
import { WorkspaceInsights } from './WorkspaceInsights.js';

afterEach(cleanup);

function client(value = workspaceInsightsFixture()): WorkspaceInsightsClient {
  return { load: vi.fn(() => Promise.resolve(value)) };
}

describe('Workspace Insights reflection layer', () => {
  it('renders owner counts, contextual rates and explicit learning provenance', async () => {
    render(
      <WorkspaceInsights
        workspaceId={insightsWorkspaceId}
        preferenceSource="EXPLICIT"
        client={client()}
      />
    );

    expect(await screen.findByRole('heading', { name: 'Workspace Insights' })).toBeVisible();
    expect(screen.getByRole('heading', { name: /2 prepared Publish Packages/ })).toBeVisible();
    expect(screen.getByRole('heading', { name: /explicit preference evidence/ })).toBeVisible();
    expect(screen.getByText('Content Opportunities')).toBeVisible();
    expect(screen.getByText('Formal Opportunity handoff results')).toBeVisible();

    fireEvent.click(screen.getAllByText('Show conversion context')[0]!);
    expect(screen.getByText('6 / 8 · 75%')).toBeVisible();
    expect(screen.getAllByText(/do not score quality or performance/)).toHaveLength(2);
  });
  it('keeps unavailable preference evidence distinct from NONE', async () => {
    render(
      <WorkspaceInsights
        workspaceId={insightsWorkspaceId}
        preferenceSource={null}
        client={client()}
      />
    );

    expect(
      await screen.findByText(/Preference evidence is unavailable for this refresh/)
    ).toBeVisible();
    expect(screen.queryByText(/No preference evidence is currently shaping this view/)).toBeNull();
  });

  it('keeps permission failure distinct from empty analytics and offers no retry action', async () => {
    const denied: WorkspaceInsightsClient = {
      load: vi.fn(() =>
        Promise.reject(
          new WorkspaceInsightsHttpError(403, 'PERMISSION_DENIED', 'workspace:read is required.')
        )
      )
    };
    render(
      <WorkspaceInsights
        workspaceId={insightsWorkspaceId}
        preferenceSource="NONE"
        client={denied}
      />
    );

    expect(await screen.findByText('Insights access denied')).toBeVisible();
    expect(screen.getByText(/hidden rather than rendered as zero/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retry insights' })).toBeNull();
    expect(screen.queryByText('Content Opportunities')).toBeNull();
  });
  it('retries transient owner failure without manufacturing zero state', async () => {
    const load = vi
      .fn<WorkspaceInsightsClient['load']>()
      .mockRejectedValueOnce(
        new WorkspaceInsightsHttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'analytics offline', true)
      )
      .mockResolvedValueOnce(workspaceInsightsFixture());
    render(
      <WorkspaceInsights
        workspaceId={insightsWorkspaceId}
        preferenceSource="PRODUCT_FEEDBACK"
        client={{ load }}
      />
    );

    expect(await screen.findByText('Insights unavailable')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry insights' }));
    expect(await screen.findByRole('heading', { name: 'Workspace Insights' })).toBeVisible();
    expect(screen.getByRole('heading', { name: /product-use feedback/ })).toBeVisible();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
