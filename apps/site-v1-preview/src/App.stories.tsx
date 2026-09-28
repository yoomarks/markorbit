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
      state.draft.localized['zh-CN'].blocks.hero!.title = '尚未发布的中文首页标题';
      state.draft.localePublication['zh-CN'] = 'DRAFT';
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
export const CounselTemplateChinese: Story = { args: { initialPath: '/site/atlas/zh-CN/' } };
export const CounselTemplateEnglish: Story = { args: { initialPath: '/site/atlas/en-US/' } };
export const ExchangeTemplateChinese: Story = { args: { initialPath: '/site/foundry/zh-CN/' } };
export const ExchangeTemplateEnglish: Story = { args: { initialPath: '/site/foundry/en-US/' } };
export const InquiryValidation: Story = { args: { initialPath: '/site/atlas/zh-CN/contact' } };
export const CustomerCenterChinese: Story = { args: { initialPath: '/site/atlas/zh-CN/portal' } };
export const CustomerCenterEnglish: Story = { args: { initialPath: '/site/atlas/en-US/portal' } };
