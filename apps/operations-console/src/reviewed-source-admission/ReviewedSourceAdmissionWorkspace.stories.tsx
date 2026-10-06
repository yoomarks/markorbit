import type { Meta, StoryObj } from '@storybook/react';
import { ReviewedSourceAdmissionWorkspace } from './ReviewedSourceAdmissionWorkspace.js';
import {
  clientForScenario,
  decisionForScenario,
  previewTargets,
  stateForScenario
} from '../reviewed-source-admission-preview/fixtures.js';

const meta = {
  title: 'Operations/Reviewed Source Admission',
  component: ReviewedSourceAdmissionWorkspace,
  args: {
    decision: decisionForScenario('ready'),
    targets: previewTargets,
    client: clientForScenario('ready')
  }
} satisfies Meta<typeof ReviewedSourceAdmissionWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const PartialTarget: Story = { args: { state: stateForScenario('partial') } };
export const NonAdmissible: Story = {
  args: { decision: decisionForScenario('nonadmissible') }
};
export const Empty: Story = { args: { decision: undefined, state: stateForScenario('empty') } };
export const PermissionRequired: Story = { args: { state: stateForScenario('unauthorized') } };
export const OwnerUnavailable: Story = { args: { state: stateForScenario('unavailable') } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
