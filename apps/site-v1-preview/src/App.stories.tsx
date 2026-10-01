import type { Meta, StoryObj } from '@storybook/react';
import { App } from './App.js';
import { demoStoragePrefix, siteStorageKey } from './store.js';
import { seedSite, seedWorkspace } from './domain.js';

const meta = {
  title: 'Site V1/Interactive preview',
  component: App,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AdminOverview: Story = { args: { initialPath: '/admin/atlas/overview' } };
export const MySites: Story = { args: { initialPath: '/admin/atlas/sites' } };
export const MiniProgramEditor: Story = {
  args: { initialPath: '/admin/site_atlas_mini_demo/editor' }
};
export const MiniProgramFront: Story = {
  args: { initialPath: '/site/site_atlas_mini_demo/zh-CN/' }
};
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
export const SiteAccessDenied: Story = {
  args: { initialPath: '/admin/site_atlas_mini_demo/overview' },
  decorators: [
    (Story) => {
      const state = seedSite('site_atlas_mini_demo');
      state.role = 'NONE';
      localStorage.setItem(siteStorageKey(state.siteId), JSON.stringify(state));
      return <Story />;
    }
  ]
};
export const CollectionSettings: Story = {
  args: { initialPath: '/admin/site_atlas_demo/settings/payment' }
};
export const CollectionSettingsViewer: Story = {
  args: { initialPath: '/admin/site_atlas_demo/settings/payment' },
  decorators: [
    (Story) => {
      const state = seedSite('site_atlas_demo');
      state.role = 'VIEWER';
      localStorage.setItem(siteStorageKey(state.siteId), JSON.stringify(state));
      return <Story />;
    }
  ]
};
export const CollectionSettingsEmpty: Story = {
  args: { initialPath: '/admin/site_atlas_mini_demo/settings/payment' },
  decorators: [
    (Story) => {
      const state = seedSite('site_atlas_mini_demo');
      state.collection.authorizedRelationships = [];
      localStorage.setItem(siteStorageKey(state.siteId), JSON.stringify(state));
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
