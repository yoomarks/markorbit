import type { Meta, StoryObj } from '@storybook/react';
import {
  blockedRelease,
  clientForScenario,
  previewConsequences,
  previewTask,
  previewWorkspaceId,
  readyRelease,
  releasedRelease,
  releasesForScenario
} from '../../execution-release-preview/fixtures.js';
import '../../execution-release-preview/execution-release-preview.css';
import { ExecutionReleaseWorkspace } from './ExecutionReleaseWorkspace.js';

const meta = {
  title: 'Lite/Execution Release Workspace',
  component: ExecutionReleaseWorkspace,
  parameters: { layout: 'fullscreen' },
  args: {
    workspaceId: previewWorkspaceId,
    client: clientForScenario('queue')
  }
} satisfies Meta<typeof ExecutionReleaseWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Queue: Story = { args: { initialReleases: releasesForScenario('queue') ?? [] } };
export const Loading: Story = {
  args: { client: clientForScenario('loading') }
};
export const Empty: Story = { args: { initialReleases: [] } };
export const BlockedDetail: Story = {
  args: { initialReleases: [blockedRelease], initialSelectedRelease: blockedRelease }
};
export const ReadyDetail: Story = {
  args: { initialReleases: [readyRelease], initialSelectedRelease: readyRelease }
};
export const ReleasedReceipt: Story = {
  args: {
    initialReleases: [releasedRelease],
    initialSelectedRelease: releasedRelease,
    initialTask: previewTask,
    initialConsequences: previewConsequences
  }
};
export const PartialEvidence: Story = {
  args: {
    initialReleases: [{ ...blockedRelease, evidence: [] }],
    initialSelectedRelease: { ...blockedRelease, evidence: [] }
  }
};
export const Stale: Story = {
  args: {
    initialReleases: [{ ...readyRelease, version: 5, status: 'STALE' }],
    initialSelectedRelease: { ...readyRelease, version: 5, status: 'STALE' }
  }
};
export const Withdrawn: Story = {
  args: {
    initialReleases: [{ ...blockedRelease, version: 2, status: 'WITHDRAWN' }],
    initialSelectedRelease: { ...blockedRelease, version: 2, status: 'WITHDRAWN' }
  }
};
export const Unauthorized: Story = {
  args: { client: clientForScenario('unauthorized') }
};
export const PermissionDenied: Story = {
  args: {
    initialReleases: [blockedRelease],
    initialSelectedRelease: blockedRelease,
    client: clientForScenario('permission')
  }
};
export const Missing: Story = {
  args: { client: clientForScenario('missing') }
};
export const Unavailable: Story = {
  args: { client: clientForScenario('unavailable') }
};
export const Mobile390: Story = {
  args: { initialReleases: [blockedRelease], initialSelectedRelease: blockedRelease },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px', styles: { width: '390px', height: '844px' } } }
    }
  }
};
