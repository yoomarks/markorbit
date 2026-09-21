// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceEntry } from '@markorbit/contracts';
import { LiteAccountApiError, type LiteAccountApi } from './account-api.js';
import { LiteAccountEntry } from './AccountEntry.js';

const workspace: WorkspaceEntry = {
  workspace: {
    workspaceId: '018f0000-0000-7000-8000-000000000501',
    name: 'Professional Practice',
    slug: 'professional-practice',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z'
  },
  membership: {
    membershipId: '018f0000-0000-7000-8000-000000000502',
    workspaceId: '018f0000-0000-7000-8000-000000000501',
    userId: '018f0000-0000-7000-8000-000000000503',
    role: 'WORKSPACE_ADMIN',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z'
  }
};
const access = {
  authenticated: true as const,
  userId: workspace.membership.userId,
  sessionId: '018f0000-0000-7000-8000-000000000504',
  sessionExpiresAt: '2026-08-15T00:00:00.000Z',
  csrfToken: 'lite-ui-csrf',
  account: {
    userId: workspace.membership.userId,
    email: 'professional@example.com',
    displayName: 'Professional',
    accountType: 'PROFESSIONAL' as const
  }
};

describe('Lite account entry', () => {
  it('takes a new professional from registration through first Workspace into Lite', async () => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    const register = vi.fn(() => Promise.resolve(access));
    const createWorkspace = vi.fn(() => Promise.resolve(workspace));
    const api: LiteAccountApi = {
      session: () =>
        Promise.reject(
          new LiteAccountApiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required')
        ),
      register,
      login: () => Promise.resolve(access),
      workspaces: () => Promise.resolve([]),
      createWorkspace,
      previewSeedInvitation: vi.fn() as never,
      claimSeedWorkspace: vi.fn() as never
    };
    const user = userEvent.setup();
    render(<LiteAccountEntry api={api} renderProduct={() => <div>Professional Lite ready</div>} />);

    await user.click(await screen.findByRole('button', { name: 'Create professional account' }));
    fireEvent.change(screen.getByLabelText('Your name'), {
      target: { value: 'Professional One' }
    });
    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'professional@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secure professional password' }
    });
    const submit = screen
      .getAllByRole('button', { name: 'Create professional account' })
      .find((button) => button.getAttribute('type') === 'submit');
    expect(submit).toBeDefined();
    await user.click(submit!);

    expect(
      await screen.findByRole('heading', { name: 'Create your professional workspace' })
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Workspace name'), {
      target: { value: 'Professional Practice' }
    });
    await user.click(screen.getByRole('button', { name: 'Create professional workspace' }));

    expect(await screen.findByText('Professional Lite ready')).toBeTruthy();
    expect(register).toHaveBeenCalledWith({
      displayName: 'Professional One',
      email: 'professional@example.com',
      password: 'secure professional password'
    });
    expect(createWorkspace).toHaveBeenCalledWith({ name: 'Professional Practice' }, 'lite-ui-csrf');
    await waitFor(() =>
      expect(sessionStorage.getItem('markorbit-workspace-id')).toBe(workspace.workspace.workspaceId)
    );
    expect(new URLSearchParams(window.location.search).get('workspaceId')).toBe(
      workspace.workspace.workspaceId
    );
  });

  it('shows a prepared Seed preview before account access and requires an explicit claim', async () => {
    sessionStorage.clear();
    window.history.replaceState(
      {},
      '',
      '/?seedPackageId=seed-workspace-package_agency-001&claimToken=opaque-claim-token'
    );
    const preview = {
      schemaVersion: 1 as const,
      seedWorkspacePackageId: 'seed-workspace-package_agency-001',
      target: { kind: 'AGENCY' as const, displayName: 'Example IP Agency' },
      counts: { representedApplicants: 23, relatedTrademarks: 87 },
      preparedAt: '2026-09-21T00:00:00.000Z',
      expiresAt: '2026-10-21T00:00:00.000Z'
    };
    const register = vi.fn(() => Promise.resolve(access));
    const createWorkspace = vi.fn(() => Promise.resolve(workspace));
    const previewSeedInvitation = vi.fn(() => Promise.resolve(preview));
    const claimSeedWorkspace = vi.fn(() => Promise.resolve({ claimed: true }));
    const api: LiteAccountApi = {
      session: () =>
        Promise.reject(
          new LiteAccountApiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required')
        ),
      register,
      login: () => Promise.resolve(access),
      workspaces: () => Promise.resolve([]),
      createWorkspace,
      previewSeedInvitation,
      claimSeedWorkspace
    };
    const user = userEvent.setup();

    render(<LiteAccountEntry api={api} renderProduct={() => <div>Prepared Lite ready</div>} />);

    expect(
      await screen.findByRole('heading', {
        name: 'We prepared a starting point for Example IP Agency.'
      })
    ).toBeTruthy();
    expect(screen.getByText(/23 represented applicant candidates/)).toBeTruthy();
    expect(previewSeedInvitation).toHaveBeenCalledWith({
      packageId: 'seed-workspace-package_agency-001',
      invitationClaimToken: 'opaque-claim-token'
    });

    await user.click(screen.getByRole('button', { name: 'Create professional account' }));
    fireEvent.change(screen.getByLabelText('Your name'), {
      target: { value: 'Professional One' }
    });
    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'professional@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secure professional password' }
    });
    const submit = screen
      .getAllByRole('button', { name: 'Create professional account' })
      .find((button) => button.getAttribute('type') === 'submit');
    await user.click(submit!);

    expect(
      await screen.findByRole('heading', { name: 'Create your professional workspace' })
    ).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Workspace name').value).toBe(
      'Example IP Agency'
    );
    await user.click(screen.getByRole('button', { name: 'Create professional workspace' }));

    expect(
      await screen.findByRole('heading', { name: 'Claim this prepared context' })
    ).toBeTruthy();
    expect(screen.queryByText('Prepared Lite ready')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Confirm and claim prepared context' }));

    expect(
      await screen.findByRole('heading', { name: 'Your prepared starting point is ready' })
    ).toBeTruthy();
    expect(screen.queryByText('Prepared Lite ready')).toBeNull();
    expect(claimSeedWorkspace).toHaveBeenCalledWith(
      {
        packageId: 'seed-workspace-package_agency-001',
        invitationClaimToken: 'opaque-claim-token'
      },
      workspace.workspace.workspaceId,
      'lite-ui-csrf',
      expect.stringMatching(/^seed-claim-/u)
    );
    expect(sessionStorage.getItem('markorbit-seed-package-id')).toBe(
      'seed-workspace-package_agency-001'
    );
    expect(window.location.search).toContain('seedPackageId=seed-workspace-package_agency-001');
    expect(window.location.search).not.toContain('claimToken=');

    await user.click(screen.getByRole('button', { name: 'Review what MO found' }));
    expect(window.location.hash).toBe('#seed-review');
    expect(await screen.findByText('Prepared Lite ready')).toBeTruthy();
  });
});
