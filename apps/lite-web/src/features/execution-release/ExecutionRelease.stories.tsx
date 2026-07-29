import type { Meta, StoryObj } from '@storybook/react';
import { ExecutionReleaseView } from './ExecutionRelease.js';
export default {
  title: 'Products/Lite Execution Release',
  component: ExecutionReleaseView,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof ExecutionReleaseView>;
type Story = StoryObj<typeof ExecutionReleaseView>;
export const QueueLoading: Story = { args: { state: 'RELEASE_QUEUE_LOADING' } };
export const QueueEmpty: Story = { args: { state: 'RELEASE_QUEUE_EMPTY' } };
export const Blocked: Story = { args: { state: 'RELEASE_BLOCKED' } };
export const BlockingUnknown: Story = { args: { state: 'RELEASE_BLOCKED' } };
export const Ready: Story = { args: { state: 'RELEASE_READY' } };
export const Assigned: Story = { args: { state: 'RELEASE_READY' } };
export const ReleasedReceipt: Story = { args: { state: 'RELEASED_FOR_EXECUTION' } };
export const Stale: Story = { args: { state: 'RELEASE_STALE' } };
export const Withdrawn: Story = { args: { state: 'RELEASE_WITHDRAWN' } };
export const LongContent: Story = { args: { long: true } };
export const RecoverableError: Story = { args: { state: 'RECOVERABLE_ERROR' } };
export const Mobile390: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px', styles: { width: '390px', height: '844px' } } }
    }
  }
};
