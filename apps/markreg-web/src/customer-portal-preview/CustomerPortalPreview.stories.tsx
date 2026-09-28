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
const miniParameters = {
  viewport: {
    viewports: { mini390: { name: 'Mini 390', styles: { width: '390px', height: '844px' } } },
    defaultViewport: 'mini390'
  }
};

export const DesktopSuccess: Story = { args: { fixtureMode: 'success', defaultChannel: 'web' } };
export const DesktopEnglish: Story = {
  args: { fixtureMode: 'success', defaultChannel: 'web', defaultLocale: 'en-US' }
};
export const H5Chinese: Story = {
  args: { fixtureMode: 'success', defaultChannel: 'h5', defaultSection: 'home' },
  parameters: miniParameters
};
export const H5English: Story = {
  args: {
    fixtureMode: 'success',
    defaultChannel: 'h5',
    defaultSection: 'home',
    defaultLocale: 'en-US'
  },
  parameters: miniParameters
};
export const MiniProgramAdapted: Story = {
  args: { fixtureMode: 'success', defaultChannel: 'mini', defaultSection: 'home' },
  parameters: miniParameters
};
export const MiniServices: Story = {
  args: { fixtureMode: 'success', defaultChannel: 'mini', defaultSection: 'services' },
  parameters: miniParameters
};
export const MiniProgress: Story = {
  args: { fixtureMode: 'success', defaultChannel: 'mini', defaultSection: 'progress' },
  parameters: miniParameters
};
export const MiniMessages: Story = {
  args: { fixtureMode: 'success', defaultChannel: 'mini', defaultSection: 'messages' },
  parameters: miniParameters
};
export const MiniProfile: Story = {
  args: { fixtureMode: 'success', defaultChannel: 'mini', defaultSection: 'profile' },
  parameters: miniParameters
};
export const MiniProgramEnglish: Story = {
  args: { fixtureMode: 'success', defaultChannel: 'mini', defaultLocale: 'en-US' },
  parameters: miniParameters
};
export const SignedOut: Story = { args: { fixtureMode: 'signed-out' } };
export const LoadingAuthorization: Story = { args: { fixtureMode: 'loading' } };
export const EmptyRelationship: Story = { args: { fixtureMode: 'empty' } };
export const OwnerUnavailable: Story = { args: { fixtureMode: 'error' } };
export const PermissionDenied: Story = { args: { fixtureMode: 'permission' } };
export const PartialOfficialData: Story = { args: { fixtureMode: 'partial' } };
