import type { Meta, StoryObj } from '@storybook/react';
import { CustomerPortalPreview } from './CustomerPortalPreview.js';

const meta = {
  title: 'Site V1.2/Customer Portal Preview',
  component: CustomerPortalPreview,
  parameters: { layout: 'fullscreen' },
  args: { persist: false }
} satisfies Meta<typeof CustomerPortalPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopSuccess: Story = { args: { fixtureMode: 'success', defaultChannel: 'web' } };
export const MiniProgramAdapted: Story = {
  args: { fixtureMode: 'success', defaultChannel: 'mini' },
  parameters: {
    viewport: {
      viewports: { mini390: { name: 'Mini 390', styles: { width: '390px', height: '844px' } } },
      defaultViewport: 'mini390'
    }
  }
};
export const SignedOut: Story = { args: { fixtureMode: 'signed-out' } };
export const LoadingAuthorization: Story = { args: { fixtureMode: 'loading' } };
export const EmptyRelationship: Story = { args: { fixtureMode: 'empty' } };
export const OwnerUnavailable: Story = { args: { fixtureMode: 'error' } };
export const PermissionDenied: Story = { args: { fixtureMode: 'permission' } };
export const PartialOfficialData: Story = { args: { fixtureMode: 'partial' } };
