import type { Meta, StoryObj } from '@storybook/react';
import { FilingAuthorizationView } from './FilingAuthorization.js';
export default {
  title: 'Products/markreg Filing Authorization',
  component: FilingAuthorizationView,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof FilingAuthorizationView>;
type Story = StoryObj<typeof FilingAuthorizationView>;
export const SourceLoading: Story = { args: { initialState: 'AUTHORIZATION_SOURCE_LOADING' } };
export const Draft: Story = {};
export const AcknowledgementsIncomplete: Story = {};
export const AcknowledgementsComplete: Story = {};
export const Confirming: Story = { args: { initialState: 'AUTHORIZATION_CONFIRMING' } };
export const AuthorizedReceipt: Story = { args: { initialState: 'AUTHORIZED' } };
export const Stale: Story = { args: { initialState: 'AUTHORIZATION_STALE' } };
export const Withdrawn: Story = { args: { initialState: 'AUTHORIZATION_WITHDRAWN' } };
export const LongScope: Story = { args: { long: true } };
export const RecoverableError: Story = { args: { initialState: 'RECOVERABLE_ERROR' } };
export const Mobile390: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px', styles: { width: '390px', height: '844px' } } }
    }
  }
};
