import type { Meta, StoryObj } from '@storybook/react';
import type { WorkspaceEntry } from '@markorbit/contracts';
import { LiteAccountApiError, type LiteAccountApi } from './account-api.js';
import { LiteAccountEntry } from './AccountEntry.js';

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
    userId: '018f0000-0000-7000-8000-000000000101',
    role: 'WORKSPACE_ADMIN',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z'
  }
});

const session = {
  authenticated: true as const,
  userId: '018f0000-0000-7000-8000-000000000101',
  sessionId: '018f0000-0000-7000-8000-000000000102',
  sessionExpiresAt: '2026-08-15T00:00:00.000Z',
  csrfToken: 'storybook-lite-csrf'
};
const access = {
  ...session,
  account: {
    userId: session.userId,
    email: 'professional@example.com',
    displayName: 'Professional',
    accountType: 'PROFESSIONAL' as const
  }
};
const api = (workspaces: readonly WorkspaceEntry[]): LiteAccountApi => ({
  session: () => Promise.resolve(session),
  register: () => Promise.resolve(access),
  login: () => Promise.resolve(access),
  workspaces: () => Promise.resolve(workspaces),
  createWorkspace: () =>
    Promise.resolve(entry('018f0000-0000-7000-8000-000000000110', 'IP Practice'))
});
const anonymous: LiteAccountApi = {
  ...api([]),
  session: () => Promise.reject(new LiteAccountApiError(401, 'AUTHENTICATION_REQUIRED', 'Sign in'))
};

const meta = {
  title: 'Lite/Account Entry',
  component: LiteAccountEntry,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof LiteAccountEntry>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = {
  args: { api: anonymous, renderProduct: () => <div>Lite ready</div> }
};

export const FirstProfessionalWorkspace: Story = {
  args: { api: api([]), renderProduct: () => <div>Lite ready</div> }
};

export const ChooseProfessionalWorkspace: Story = {
  args: {
    api: api([
      entry('018f0000-0000-7000-8000-000000000120', 'Taichu IP'),
      entry('018f0000-0000-7000-8000-000000000130', 'International Team')
    ]),
    renderProduct: () => <div>Lite ready</div>
  }
};
