import type { Meta, StoryObj } from '@storybook/react';
import type { WorkspaceEntry } from '@markorbit/contracts';
import { AccountApiError, type MarkregAccountApi } from './account-api.js';
import { MarkregAccountEntry } from './AccountEntry.js';

const entry = (id: string, name: string): WorkspaceEntry => ({
  workspace: {
    workspaceId: id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z'
  },
  membership: {
    membershipId: `${id.slice(0, -1)}9`,
    workspaceId: id,
    userId: '018f0000-0000-7000-8000-000000000001',
    role: 'WORKSPACE_ADMIN',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z'
  }
});

const session = {
  authenticated: true as const,
  userId: '018f0000-0000-7000-8000-000000000001',
  sessionId: '018f0000-0000-7000-8000-000000000002',
  sessionExpiresAt: '2026-08-15T00:00:00.000Z',
  csrfToken: 'storybook-csrf'
};
const access = {
  ...session,
  account: {
    userId: session.userId,
    email: 'customer@example.com',
    displayName: 'Customer',
    accountType: 'CUSTOMER' as const
  }
};

const api = (workspaces: readonly WorkspaceEntry[]): MarkregAccountApi => ({
  session: () => Promise.resolve(session),
  register: () => Promise.resolve(access),
  login: () => Promise.resolve(access),
  workspaces: () => Promise.resolve(workspaces),
  createWorkspace: () => Promise.resolve(entry('018f0000-0000-7000-8000-000000000010', 'New Brand'))
});
const anonymous: MarkregAccountApi = {
  ...api([]),
  session: () => Promise.reject(new AccountApiError(401, 'AUTHENTICATION_REQUIRED', 'Sign in'))
};

const meta = {
  title: 'MarkReg/Account Entry',
  component: MarkregAccountEntry,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof MarkregAccountEntry>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = {
  args: { api: anonymous, renderProduct: () => <div>Product ready</div> }
};

export const FirstWorkspace: Story = {
  args: { api: api([]), renderProduct: () => <div>Product ready</div> }
};

export const ChooseWorkspace: Story = {
  args: {
    api: api([
      entry('018f0000-0000-7000-8000-000000000020', 'Global Brands'),
      entry('018f0000-0000-7000-8000-000000000030', 'China Filings')
    ]),
    renderProduct: () => <div>Product ready</div>
  }
};
