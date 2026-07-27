import type { Meta, StoryObj } from '@storybook/react';
import { LiteApp } from './App.js';
export default {
  title: 'Products/Lite Workspace',
  component: LiteApp,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof LiteApp>;
type Story = StoryObj<typeof LiteApp>;
export const CustomerList: Story = {};
export const CustomerDetail: Story = { args: { initialItemId: 'c-aurora' } };
export const OpportunityList: Story = { args: { initialSurface: 'opportunities' } };
export const OpportunityDetail: Story = {
  args: { initialSurface: 'opportunities', initialItemId: 'o-eu' }
};
export const Empty: Story = { args: { fixtureState: 'empty' } };
export const Stale: Story = { args: { fixtureState: 'stale' } };
export const Error: Story = { args: { fixtureState: 'error' } };
export const Loading: Story = { args: { fixtureState: 'loading' } };
export const LongText: Story = {
  args: { initialSurface: 'opportunities', initialItemId: 'o-eu', longText: true }
};
export const Mobile390: Story = {
  args: { initialSurface: 'opportunities' },
  parameters: { viewport: { defaultViewport: 'mobile1' }, chromatic: { viewports: [390] } }
};
