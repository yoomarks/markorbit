import type { Meta, StoryObj } from '@storybook/react';
import {
  lockClientForScenario,
  packageClientForScenario,
  previewLock,
  previewPackage,
  previewPackageId,
  previewWorkspaceId
} from '../../preparation-lock-preview/fixtures.js';
import { PreparationLockWorkspace } from './PreparationLockWorkspace.js';

const meta = {
  title: 'Lite/Preparation Lock Workspace',
  component: PreparationLockWorkspace,
  parameters: { layout: 'fullscreen' },
  args: {
    workspaceId: previewWorkspaceId,
    packageId: previewPackageId,
    packageClient: packageClientForScenario('ready'),
    preparationClient: lockClientForScenario('ready')
  }
} satisfies Meta<typeof PreparationLockWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyToLock: Story = {};
export const Loading: Story = {
  args: { packageClient: packageClientForScenario('loading') }
};
export const PartialSource: Story = {
  args: { packageClient: packageClientForScenario('partial') }
};
export const Unauthorized: Story = {
  args: { packageClient: packageClientForScenario('unauthorized') }
};
export const PermissionDenied: Story = {
  args: { preparationClient: lockClientForScenario('permission') }
};
export const NotFound: Story = {
  args: { packageClient: packageClientForScenario('missing') }
};
export const SourceConflict: Story = {
  args: { preparationClient: lockClientForScenario('conflict') }
};
export const ValidationBlocked: Story = {
  args: { preparationClient: lockClientForScenario('validation') }
};
export const ServiceUnavailable: Story = {
  args: { packageClient: packageClientForScenario('unavailable') }
};
export const LockedReceipt: Story = {
  args: { initialPackage: previewPackage, initialLock: previewLock }
};
export const Mobile390: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px', styles: { width: '390px', height: '844px' } } }
    }
  }
};
