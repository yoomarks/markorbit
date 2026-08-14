// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
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
      createWorkspace
    };
    const user = userEvent.setup();
    render(<LiteAccountEntry api={api} renderProduct={() => <div>Professional Lite ready</div>} />);

    await user.click(await screen.findByRole('button', { name: 'Create professional account' }));
    await user.type(screen.getByLabelText('Your name'), 'Professional One');
    await user.type(screen.getByLabelText('Work email'), 'professional@example.com');
    await user.type(screen.getByLabelText('Password'), 'secure professional password');
    await user.click(screen.getByRole('button', { name: 'Create professional account' }));

    expect(
      await screen.findByRole('heading', { name: 'Create your professional workspace' })
    ).toBeTruthy();
    await user.type(screen.getByLabelText('Workspace name'), 'Professional Practice');
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
  });
});
