import type { Meta, StoryObj } from '@storybook/react';
import { ReviewedSourceHandoffWorkspace } from './ReviewedSourceHandoffWorkspace.js';
import {
  clientForScenario,
  deliveredOutcome,
  pendingOutcome,
  previewSource
} from '../reviewed-source-handoff-preview/fixtures.js';

const meta = {
  title: 'Operations/Reviewed Source Handoff',
  component: ReviewedSourceHandoffWorkspace,
  args: { source: previewSource, client: clientForScenario('ready') }
} satisfies Meta<typeof ReviewedSourceHandoffWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const PendingRetry: Story = { args: { initialOutcome: pendingOutcome } };
export const DeliveredAfterRetry: Story = { args: { initialOutcome: deliveredOutcome(2) } };
export const PartialSource: Story = { args: { state: 'partial' } };
export const Empty: Story = { args: { source: undefined, state: 'empty' } };
export const PermissionRequired: Story = { args: { state: 'unauthorized' } };
export const OwnerUnavailable: Story = { args: { state: 'unavailable' } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
