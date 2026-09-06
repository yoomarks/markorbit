// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarkregApiError } from './api/errors.js';
import type {
  WorkspaceActionCenterView,
  WorkspaceActionClient,
  WorkspaceActionItemView
} from './api/workspace-action.js';
import { WorkspaceActionCenter } from './WorkspaceActionCenter.js';

const actionItem = (
  matterId: string,
  trademark: string,
  overrides: Partial<WorkspaceActionItemView> = {}
): WorkspaceActionItemView => ({
  matterId,
  matterVersion: 2,
  trademark,
  applicant: 'Example Holdings LLC',
  jurisdiction: 'US',
  currentnessLabel: 'Current owner projection',
  lifecycleLabel: 'Professional review in progress',
  lifecycleSummary: 'MarkReg is reviewing the current Matter evidence.',
  lastChangedAt: '2026-09-05T12:00:00.000Z',
  ...overrides
});

const needs = actionItem('formal-matter-needs', 'NEEDS MARK', {
  actionTitle: 'Review goods description',
  actionExplanation: 'Confirm the customer-supplied wording before the next protected step.'
});
const waiting = actionItem('formal-matter-waiting', 'WAITING MARK', {
  currentnessLabel: 'Lifecycle view not established'
});
const recent = actionItem('formal-matter-recent', 'RECENT MARK', {
  examinationLabel: 'Customer review needed',
  examinationSummary: 'The internal Examination view records a customer review state.',
  lastChangedAt: '2026-09-05T13:00:00.000Z'
});

const populated: WorkspaceActionCenterView = {
  workspaceId: 'workspace-1',
  generatedAt: '2026-09-06T00:00:00.000Z',
  truncated: false,
  needsAttention: [needs],
  waitingOrInProgress: [waiting],
  recentlyChanged: [recent]
};

const empty: WorkspaceActionCenterView = {
  ...populated,
  needsAttention: [],
  waitingOrInProgress: [],
  recentlyChanged: []
};

const client = (get: WorkspaceActionClient['get']): WorkspaceActionClient => ({ get });

describe('Workspace Action Center', () => {
  it('renders the three owner-projected groups in task-first order without regrouping items', async () => {
    const get = vi.fn(() => Promise.resolve(populated));
    render(<WorkspaceActionCenter workspaceKey="workspace-1" client={client(get)} />);

    expect(await screen.findByRole('heading', { name: 'What needs your attention' })).toBeTruthy();
    await screen.findByText('NEEDS MARK');

    const groupHeadings = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(groupHeadings).toEqual([
      'Needs attention',
      'Waiting or in progress',
      'Recently changed'
    ]);

    const needsSection = screen
      .getByRole('heading', { name: 'Needs attention' })
      .closest('section');
    const waitingSection = screen
      .getByRole('heading', { name: 'Waiting or in progress' })
      .closest('section');
    const recentSection = screen
      .getByRole('heading', { name: 'Recently changed' })
      .closest('section');
    expect(needsSection).not.toBeNull();
    expect(waitingSection).not.toBeNull();
    expect(recentSection).not.toBeNull();
    expect(within(needsSection!).getByText('NEEDS MARK')).toBeTruthy();
    expect(within(waitingSection!).getByText('WAITING MARK')).toBeTruthy();
    expect(within(recentSection!).getByText('RECENT MARK')).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(1);

    expect(screen.getAllByRole('link', { name: 'Open Matter' })[0]?.getAttribute('href')).toContain(
      'formal-matter-needs'
    );
    expect(screen.getByText(/Recommendations guide review only/)).toBeTruthy();
    expect(screen.getByText(/Recency does not mean urgency/)).toBeTruthy();
  });

  it('distinguishes a successful empty owner projection from dependency failure', async () => {
    render(
      <WorkspaceActionCenter
        workspaceKey="workspace-1"
        client={client(() => Promise.resolve(empty))}
      />
    );

    expect(
      await screen.findByRole('heading', { name: 'No current Action Center items' })
    ).toBeTruthy();
    expect(screen.getByText(/successful empty Workspace Action projection/)).toBeTruthy();
    expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
  });

  it('keeps dependency failure explicit and retries only when the failure is retryable', async () => {
    const user = userEvent.setup();
    const get = vi
      .fn<WorkspaceActionClient['get']>()
      .mockRejectedValueOnce(
        new MarkregApiError(
          'recoverable',
          'owner unavailable',
          undefined,
          'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
          503
        )
      )
      .mockResolvedValueOnce(empty);
    render(<WorkspaceActionCenter workspaceKey="workspace-1" client={client(get)} />);

    expect(
      await screen.findByRole('heading', { name: 'Action Center temporarily unavailable' })
    ).toBeTruthy();
    expect(screen.getByText(/not being treated as empty truth/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(
      await screen.findByRole('heading', { name: 'No current Action Center items' })
    ).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('shows permission failure without presenting it as an empty result', async () => {
    render(
      <WorkspaceActionCenter
        workspaceKey="workspace-1"
        client={client(() =>
          Promise.reject(
            new MarkregApiError('blocking', 'forbidden', undefined, 'PERMISSION_DENIED', 403)
          )
        )}
      />
    );

    expect(
      await screen.findByRole('heading', { name: 'Workspace permission required' })
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'No current Action Center items' })).toBeNull();
  });

  it('reloads once when the authenticated Workspace key changes', async () => {
    const get = vi.fn(() => Promise.resolve(empty));
    const stableClient = client(get);
    const { rerender } = render(
      <WorkspaceActionCenter workspaceKey="workspace-1" client={stableClient} />
    );
    await screen.findByRole('heading', { name: 'No current Action Center items' });
    expect(get).toHaveBeenCalledTimes(1);

    rerender(<WorkspaceActionCenter workspaceKey="workspace-2" client={stableClient} />);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it('keeps a dedicated loading state while the owner projection is unresolved', () => {
    render(
      <WorkspaceActionCenter
        workspaceKey="workspace-1"
        client={client(() => new Promise<WorkspaceActionCenterView>(() => undefined))}
      />
    );

    expect(screen.getByText('Loading current Workspace Action Center')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'No current Action Center items' })).toBeNull();
  });
});
