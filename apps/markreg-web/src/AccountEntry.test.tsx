// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceEntry } from '@markorbit/contracts';
import { AccountApiError, type MarkregAccountApi } from './account-api.js';
import { MarkregAccountEntry } from './AccountEntry.js';

const workspace: WorkspaceEntry = {
  workspace: {
    workspaceId: '018f0000-0000-7000-8000-000000000401',
    name: 'Customer Team',
    slug: 'customer-team',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z'
  },
  membership: {
    membershipId: '018f0000-0000-7000-8000-000000000402',
    workspaceId: '018f0000-0000-7000-8000-000000000401',
    userId: '018f0000-0000-7000-8000-000000000403',
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
  sessionId: '018f0000-0000-7000-8000-000000000404',
  sessionExpiresAt: '2026-08-15T00:00:00.000Z',
  csrfToken: 'markreg-ui-csrf',
  account: {
    userId: workspace.membership.userId,
    email: 'customer@example.com',
    displayName: 'Customer',
    accountType: 'CUSTOMER' as const
  }
};

describe('MarkReg account entry', () => {
  it('takes a new customer from registration through first Workspace into the product', async () => {
    sessionStorage.clear();
    const register = vi.fn(() => Promise.resolve(access));
    const createWorkspace = vi.fn(() => Promise.resolve(workspace));
    const api: MarkregAccountApi = {
      session: () =>
        Promise.reject(
          new AccountApiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required')
        ),
      register,
      login: () => Promise.resolve(access),
      workspaces: () => Promise.resolve([]),
      createWorkspace
    };
    const user = userEvent.setup();
    render(
      <MarkregAccountEntry api={api} renderProduct={() => <div>Customer product ready</div>} />
    );

    await user.click(await screen.findByRole('button', { name: 'Create account' }));
    fireEvent.change(screen.getByLabelText('Your name'), {
      target: { value: 'Customer One' }
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'customer@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secure customer password' }
    });
    const submit = screen
      .getAllByRole('button', { name: 'Create account' })
      .find((button) => button.getAttribute('type') === 'submit');
    expect(submit).toBeDefined();
    await user.click(submit!);

    expect(
      await screen.findByRole('heading', { name: 'Set up your trademark workspace' })
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Workspace name'), {
      target: { value: 'Customer Team' }
    });
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(await screen.findByText('Customer product ready')).toBeTruthy();
    expect(register).toHaveBeenCalledWith({
      displayName: 'Customer One',
      email: 'customer@example.com',
      password: 'secure customer password'
    });
    expect(createWorkspace).toHaveBeenCalledWith({ name: 'Customer Team' }, 'markreg-ui-csrf');
    await waitFor(() =>
      expect(sessionStorage.getItem('markorbit-workspace-id')).toBe(workspace.workspace.workspaceId)
    );
  });
});
