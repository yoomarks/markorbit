import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { SiteEntry } from '../src/SiteEntry.js';
import { markRegReferenceSite, northstarPilotSite } from '../src/site-fixtures.js';
import { AccountApiError, type MarkregAccountApi } from '../src/account-api.js';

const anonymousAccountApi: MarkregAccountApi = {
  session: () => Promise.reject(new AccountApiError(401, 'AUTHENTICATION_REQUIRED', 'Sign in.')),
  register: () => Promise.reject(new Error('not used')),
  login: () => Promise.reject(new Error('not used')),
  workspaces: () => Promise.resolve([]),
  createWorkspace: () => Promise.reject(new Error('not used'))
};

describe('public Workspace Site entry', () => {
  it('renders two isolated brands through the same Site renderer', async () => {
    const first = render(
      <SiteEntry client={{ resolve: () => Promise.resolve(markRegReferenceSite) }} />
    );
    expect(
      await screen.findByRole('heading', { name: 'Protect the name you are building.' })
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'MarkReg home' })).toBeVisible();
    first.unmount();

    render(<SiteEntry client={{ resolve: () => Promise.resolve(northstarPilotSite) }} />);
    expect(
      await screen.findByRole('heading', { name: 'Trademark guidance for growing brands.' })
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Northstar Brand Desk home' })).toBeVisible();
    expect(screen.queryByText('Protect the name you are building.')).not.toBeInTheDocument();
  });

  it('fails closed without substituting a default brand', async () => {
    render(<SiteEntry client={{ resolve: () => Promise.reject(new Error('HOST_NOT_ACTIVE')) }} />);
    expect(await screen.findByText('This service site is unavailable')).toBeVisible();
    expect(screen.queryByText('MarkReg')).not.toBeInTheDocument();
  });

  it('shows an explicit empty state and disables consultation when no service is public', async () => {
    render(
      <SiteEntry
        client={{ resolve: () => Promise.resolve({ ...northstarPilotSite, services: [] }) }}
      />
    );
    expect(await screen.findByText('Services are not currently available')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start a consultation' })).toBeDisabled();
  });

  it('has no automated accessibility violations in the reference state', async () => {
    const { container } = render(
      <SiteEntry client={{ resolve: () => Promise.resolve(markRegReferenceSite) }} />
    );
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeVisible());
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps anonymous visitors outside a Workspace until account entry', async () => {
    render(
      <SiteEntry
        client={{ resolve: () => Promise.resolve(northstarPilotSite) }}
        accountApi={anonymousAccountApi}
      />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Start a consultation' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(screen.getByText(/Site owner does not become a member/)).toBeVisible();
  });
});
