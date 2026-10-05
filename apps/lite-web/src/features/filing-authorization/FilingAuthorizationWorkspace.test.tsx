// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authorizedAuthorization,
  clientForScenario,
  previewAuthorization,
  previewAuthorizationId,
  previewConsequences,
  previewWorkspaceId
} from '../../filing-authorization-preview/fixtures.js';
import type { FilingAuthorizationClient } from '../../api/filing-authorization.js';
import {
  FilingAuthorizationWorkspace,
  filingAuthorizationAcknowledgements
} from './FilingAuthorizationWorkspace.js';

afterEach(cleanup);

describe('FilingAuthorizationWorkspace', () => {
  it('requires all nine active confirmations and records one bounded authorization', async () => {
    const confirm = vi.fn().mockResolvedValue({
      filingAuthorization: authorizedAuthorization,
      consequences: previewConsequences
    });
    const client = { ...clientForScenario('ready'), confirm } satisfies FilingAuthorizationClient;
    render(
      <FilingAuthorizationWorkspace
        workspaceId={previewWorkspaceId}
        initialAuthorization={previewAuthorization}
        initialConsequences={previewConsequences}
        client={client}
      />
    );

    const checks = screen.getAllByRole('checkbox');
    expect(checks).toHaveLength(9);
    checks.forEach((check) => expect(check).not.toBeChecked());
    const action = screen.getByRole('button', { name: 'Authorize internal execution review' });
    expect(action).toBeDisabled();
    for (const check of checks) await userEvent.click(check);
    expect(action).toBeEnabled();
    await userEvent.click(action);

    expect(confirm).toHaveBeenCalledWith(
      previewAuthorizationId,
      filingAuthorizationAcknowledgements.map(({ code }) => code)
    );
    expect(
      await screen.findByText('Authorized for internal execution review — not submitted')
    ).toBeVisible();
    expect(screen.getByText('Separate internal release review')).toBeVisible();
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  });

  it('keeps a stale conflict blocking and reloads current durable truth', async () => {
    render(
      <FilingAuthorizationWorkspace
        workspaceId={previewWorkspaceId}
        initialAuthorization={previewAuthorization}
        client={clientForScenario('conflict')}
      />
    );
    for (const check of screen.getAllByRole('checkbox')) await userEvent.click(check);
    await userEvent.click(
      screen.getByRole('button', { name: 'Authorize internal execution review' })
    );
    expect(await screen.findByText('Authorization source changed')).toBeVisible();
    expect(
      screen.getByText(/exact Preparation Lock or authorization version changed/)
    ).toBeVisible();
  });

  it('loads exact owner truth and has no detectable accessibility violations', async () => {
    const { container } = render(
      <FilingAuthorizationWorkspace
        workspaceId={previewWorkspaceId}
        filingAuthorizationId={previewAuthorizationId}
        client={clientForScenario('ready')}
      />
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Filing Authorization' })
    ).toBeVisible();
    expect(screen.getByText('preparation-lock_fixture-1478')).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });
});
