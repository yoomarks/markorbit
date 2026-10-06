import type { Meta, StoryObj } from '@storybook/react';
import { ExecutionEvidenceReviewWorkspace } from './ExecutionEvidenceReviewWorkspace.js';
import {
  clientForScenario,
  itemsForScenario,
  previewItems
} from '../evidence-review-preview/fixtures.js';

const meta = {
  title: 'Operations/Evidence Review Workspace',
  component: ExecutionEvidenceReviewWorkspace,
  parameters: { layout: 'fullscreen' },
  args: { items: previewItems, client: clientForScenario('queue'), state: 'ready' }
} satisfies Meta<typeof ExecutionEvidenceReviewWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PendingQueue: Story = {};
export const PartialEvidence: Story = {
  args: { items: itemsForScenario('partial'), client: clientForScenario('partial') }
};
export const SuccessfulEmpty: Story = { args: { items: [], state: 'empty' } };
export const PermissionRequired: Story = { args: { state: 'unauthorized' } };
export const OwnerUnavailable: Story = { args: { state: 'unavailable' } };
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};
