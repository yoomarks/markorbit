import type { Meta, StoryObj } from '@storybook/react';
import { SiteEntry, type PublicSiteClient } from './SiteEntry.js';
import { markRegReferenceSite, northstarPilotSite } from './site-fixtures.js';
import { AccountApiError, type MarkregAccountApi } from './account-api.js';

const resolve = (value: typeof markRegReferenceSite): PublicSiteClient => ({
  resolve: () => Promise.resolve(value)
});
const anonymousAccountApi: MarkregAccountApi = {
  session: () => Promise.reject(new AccountApiError(401, 'AUTHENTICATION_REQUIRED', 'Sign in.')),
  register: () => Promise.reject(new Error('Not used in this visual fixture.')),
  login: () => Promise.reject(new Error('Not used in this visual fixture.')),
  workspaces: () => Promise.resolve([]),
  createWorkspace: () => Promise.reject(new Error('Not used in this visual fixture.'))
};

const meta = {
  title: 'MarkReg/Public Site',
  component: SiteEntry,
  args: { accountApi: anonymousAccountApi },
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof SiteEntry>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MarkRegReference: Story = { args: { client: resolve(markRegReferenceSite) } };
export const WorkspaceBrandedPilot: Story = { args: { client: resolve(northstarPilotSite) } };
export const NoAvailableServices: Story = {
  args: { client: resolve({ ...northstarPilotSite, services: [] }) }
};
export const ContentPending: Story = {
  args: { client: resolve({ ...northstarPilotSite, contentSlots: [] }) }
};
export const Loading: Story = {
  args: { client: { resolve: () => new Promise(() => undefined) } }
};
export const HostResolutionDenied: Story = {
  args: { client: { resolve: () => Promise.reject(new Error('HOST_NOT_ACTIVE')) } }
};
export const Mobile390: Story = {
  args: { client: resolve(northstarPilotSite) },
  parameters: {
    viewport: {
      viewports: { mobile390: { name: 'Mobile 390', styles: { width: '390px', height: '844px' } } },
      defaultViewport: 'mobile390'
    }
  }
};
