// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  blockedRelease,
  clientForScenario,
  previewReleaseId,
  previewWorkspaceId,
  releasesForScenario
} from '../../execution-release-preview/fixtures.js';
import { ExecutionReleaseWorkspace } from './ExecutionReleaseWorkspace.js';

afterEach(cleanup);

describe('ExecutionReleaseWorkspace', () => {
  it('triages durable releases and restores focus with retained filters', async () => {
    const user = userEvent.setup();
    render(
      <ExecutionReleaseWorkspace
        workspaceId={previewWorkspaceId}
        client={clientForScenario('queue')}
        initialReleases={releasesForScenario('queue') ?? []}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Release review' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Review exact evidence' })).toHaveLength(3);
    await user.selectOptions(screen.getByLabelText('Status'), 'BLOCKED');
    const open = screen.getByRole('button', { name: 'Review exact evidence' });
    await user.click(open);
    expect(await screen.findByText('Governed lineage')).toBeVisible();
    expect(
      screen.getByText('Current commercial-scope evidence requires a fresh evaluation.')
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Release for internal execution' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Back to release queue/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Review exact evidence' })).toHaveFocus()
    );
    expect(screen.getByLabelText('Status')).toHaveValue('BLOCKED');
  });

  it('evaluates, assigns and records one internal task without external consequences', async () => {
    const user = userEvent.setup();
    const client = clientForScenario('blocked');
    const evaluateRelease = vi.spyOn(client, 'evaluateRelease');
    const updateAssignment = vi.spyOn(client, 'updateAssignment');
    const release = vi.spyOn(client, 'release');
    render(
      <ExecutionReleaseWorkspace
        workspaceId={previewWorkspaceId}
        client={client}
        initialReleases={[blockedRelease]}
        initialSelectedRelease={blockedRelease}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Evaluate current evidence' }));
    expect(evaluateRelease).toHaveBeenCalledWith(previewReleaseId);
    expect(await screen.findByText('8 / 8')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Assign to me' }));
    expect(updateAssignment).toHaveBeenCalledWith(previewReleaseId, { expectedVersion: 2 });
    expect(await screen.findByText('user_fixture-riley-operator')).toBeVisible();

    const releaseAction = screen.getByRole('button', { name: 'Release for internal execution' });
    expect(releaseAction).toBeDisabled();
    await user.type(
      screen.getByLabelText('Internal release rationale'),
      'All blocking owner evidence passes.'
    );
    expect(releaseAction).toBeEnabled();
    await user.click(releaseAction);

    expect(release).toHaveBeenCalledWith(previewReleaseId, {
      rationale: 'All blocking owner evidence passes.',
      idempotencyKey: `release:${previewReleaseId}:3`
    });
    expect(
      await screen.findByText('Released for execution — no external filing performed')
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Filing Execution Task Draft' })).toBeVisible();
    expect(screen.getByText('filing-task-draft_fixture-1480')).toBeVisible();
    expect(
      within(screen.getByLabelText('External actions not performed')).getAllByText('No')
    ).toHaveLength(13);
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  });

  it('keeps a stale conflict visible and blocks another protected action', async () => {
    const user = userEvent.setup();
    render(
      <ExecutionReleaseWorkspace
        workspaceId={previewWorkspaceId}
        client={clientForScenario('conflict')}
        initialReleases={[blockedRelease]}
        initialSelectedRelease={blockedRelease}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Evaluate current evidence' }));
    expect(await screen.findByText('Release evidence changed')).toBeVisible();
    expect(screen.getByText(/latest recorded evidence was reloaded/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Release for internal execution' })
    ).not.toBeInTheDocument();
  });

  it('renders the queue with no detectable accessibility violations', async () => {
    const { container } = render(
      <ExecutionReleaseWorkspace
        workspaceId={previewWorkspaceId}
        client={clientForScenario('queue')}
        initialReleases={releasesForScenario('queue') ?? []}
      />
    );
    expect(screen.getByText('Release queue')).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });
});
