import type { Meta, StoryObj } from '@storybook/react';
import { LiteApp } from './App.js';
export default {
  title: 'Products/Lite workspace',
  component: LiteApp,
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof LiteApp>;
type Story = StoryObj<typeof LiteApp>;
export const CustomerList: Story = { args: { initialSurface: 'customers' } };
export const CustomerDetail: Story = {
  args: { initialSurface: 'customers', initialCustomerId: 'cus-northwind' }
};
export const OpportunityList: Story = { args: { initialSurface: 'opportunities' } };
export const OpportunityDetail: Story = {
  args: { initialSurface: 'opportunities', initialOpportunityId: 'opp-repair' }
};
export const Empty: Story = { args: { initialSurface: 'customers', initialState: 'empty' } };
export const Stale: Story = { args: { initialSurface: 'opportunities', initialState: 'stale' } };
export const Error: Story = { args: { initialSurface: 'customers', initialState: 'error' } };
export const Loading: Story = {
  args: { initialSurface: 'opportunities', initialState: 'loading' }
};
export const LongText: Story = {
  args: { initialSurface: 'opportunities', initialOpportunityId: 'opp-renewal' }
};
export const Mobile390: Story = {
  args: { initialSurface: 'opportunities' },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
