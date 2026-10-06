import type { Meta, StoryObj } from '@storybook/react';
import { RecommendedActionWorkspace } from './RecommendedActionWorkspace.js';
import { clientForScenario, previewMatter } from '../recommended-action-preview/fixtures.js';

const meta = {
  title: 'MarkReg/Recommended Action Workspace',
  component: RecommendedActionWorkspace,
  args: { matter: previewMatter, client: clientForScenario('open') },
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof RecommendedActionWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Acknowledged: Story = { args: { client: clientForScenario('acknowledged') } };
export const Dismissed: Story = { args: { client: clientForScenario('dismissed') } };
export const NoAction: Story = { args: { client: clientForScenario('no-action') } };
export const Empty: Story = { args: { client: clientForScenario('empty') } };
export const ReadOnly: Story = { args: { client: clientForScenario('read-only'), readOnly: true } };
export const Partial: Story = { args: { client: clientForScenario('partial'), partial: true } };
export const Unauthorized: Story = { args: { client: clientForScenario('unauthorized') } };
export const Unavailable: Story = { args: { client: clientForScenario('unavailable') } };
export const Mobile390: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
