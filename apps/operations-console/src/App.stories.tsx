import type { Meta, StoryObj } from '@storybook/react';
import { OperationsApp } from './App.js';
import { SuperAdminV2 } from './super-admin-v2/SuperAdminV2.js';
export default {
  title: 'Products/Operations Console',
  component: OperationsApp,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof OperationsApp>;
export const Overview: StoryObj<typeof OperationsApp> = {};
export const SmallScreen: StoryObj<typeof OperationsApp> = {
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};

export const SuperAdminV2Overview = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/overview/platform" useBrowserHistory={false} />
);

export const SuperAdminV2DataPartial = () => (
  <SuperAdminV2
    initialPath="/super-admin-v2/data/coverage"
    initialState="partial"
    useBrowserHistory={false}
  />
);

export const SuperAdminV2Permission = () => (
  <SuperAdminV2
    initialPath="/super-admin-v2/governance/risk"
    initialState="permission"
    useBrowserHistory={false}
  />
);

export const SuperAdminV2Narrow = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/knowledge/evidence" useBrowserHistory={false} />
);
SuperAdminV2Narrow.parameters = { viewport: { defaultViewport: 'mobile1' } };
