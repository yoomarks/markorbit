import type { Meta, StoryObj } from '@storybook/react';
import { App } from './App.js';
import { demoStoragePrefix } from './store.js';
import { seedWorkspace } from './domain.js';

const meta = {
  title: 'Site V1/Interactive preview',
  component: App,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AdminOverview: Story = { args: { initialPath: '/admin/atlas/overview' } };
export const EditorUnpublishedDraft: Story = {
  args: { initialPath: '/admin/atlas/editor' },
  decorators: [
    (Story) => {
      const state = seedWorkspace('atlas');
      state.draft.blocks[0]!.title = 'A private draft headline';
      localStorage.setItem(`${demoStoragePrefix}atlas`, JSON.stringify(state));
      return <Story />;
    }
  ]
};
export const LeadsEmpty: Story = { args: { initialPath: '/admin/atlas/leads' } };
export const PermissionDenied: Story = {
  args: { initialPath: '/admin/atlas/settings' },
  decorators: [
    (Story) => {
      const state = seedWorkspace('atlas');
      state.role = 'VIEWER';
      localStorage.setItem(`${demoStoragePrefix}atlas`, JSON.stringify(state));
      return <Story />;
    }
  ]
};
export const AnalyticsPartial: Story = { args: { initialPath: '/admin/foundry/analytics' } };
export const CounselTemplate: Story = { args: { initialPath: '/site/atlas/' } };
export const ExchangeTemplate: Story = { args: { initialPath: '/site/foundry/' } };
export const InquiryValidation: Story = { args: { initialPath: '/site/atlas/contact' } };
