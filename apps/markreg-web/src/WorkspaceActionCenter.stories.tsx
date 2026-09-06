import type { Meta, StoryObj } from '@storybook/react';
import './markreg.css';
import { MarkregApiError } from './api/errors.js';
import type {
  WorkspaceActionCenterView,
  WorkspaceActionClient,
  WorkspaceActionItemView
} from './api/workspace-action.js';
import { WorkspaceActionCenter } from './WorkspaceActionCenter.js';

const item = (
  matterId: string,
  trademark: string,
  overrides: Partial<WorkspaceActionItemView> = {}
): WorkspaceActionItemView => ({
  matterId,
  matterVersion: 2,
  trademark,
  applicant: 'Example Holdings LLC',
  jurisdiction: 'US',
  currentnessLabel: 'Current owner projection',
  lifecycleLabel: 'Professional review in progress',
  lifecycleSummary: 'MarkReg is reviewing the current Matter evidence.',
  lastChangedAt: '2026-09-05T12:00:00.000Z',
  ...overrides
});

const populated: WorkspaceActionCenterView = {
  workspaceId: '018f0000-0000-7000-8000-000000000899',
  generatedAt: '2026-09-06T00:00:00.000Z',
  truncated: false,
  needsAttention: [
    item('formal-matter-needs', 'ORBIT MARK', {
      actionTitle: 'Review goods description',
      actionExplanation: 'Confirm the customer-supplied wording before the next protected step.'
    })
  ],
  waitingOrInProgress: [
    item('formal-matter-waiting', 'NORTH STAR', {
      currentnessLabel: 'Lifecycle view not established'
    })
  ],
  recentlyChanged: [
    item('formal-matter-recent', 'MOTION LAB', {
      examinationLabel: 'Customer review needed',
      examinationSummary: 'The internal Examination view records a customer review state.',
      lastChangedAt: '2026-09-05T13:00:00.000Z'
    })
  ]
};

const empty: WorkspaceActionCenterView = {
  ...populated,
  needsAttention: [],
  waitingOrInProgress: [],
  recentlyChanged: []
};

const client = (get: WorkspaceActionClient['get']): WorkspaceActionClient => ({ get });

const meta = {
  title: 'MarkReg/Workspace Action Center',
  component: WorkspaceActionCenter,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="markreg-workspace-home">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof WorkspaceActionCenter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    workspaceKey: populated.workspaceId,
    client: client(() => Promise.resolve(populated))
  }
};

export const Empty: Story = {
  args: {
    workspaceKey: empty.workspaceId,
    client: client(() => Promise.resolve(empty))
  }
};

export const Truncated: Story = {
  args: {
    workspaceKey: populated.workspaceId,
    client: client(() => Promise.resolve({ ...populated, truncated: true }))
  }
};

export const Unavailable: Story = {
  args: {
    workspaceKey: populated.workspaceId,
    client: client(() =>
      Promise.reject(
        new MarkregApiError(
          'recoverable',
          'owner unavailable',
          undefined,
          'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
          503
        )
      )
    )
  }
};

export const Loading: Story = {
  args: {
    workspaceKey: populated.workspaceId,
    client: client(() => new Promise<WorkspaceActionCenterView>(() => undefined))
  }
};
