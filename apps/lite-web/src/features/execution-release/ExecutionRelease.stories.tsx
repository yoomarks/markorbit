import type { ExecutionRelease } from '@markorbit/contracts';
import type { Meta, StoryObj } from '@storybook/react';
import { ExecutionReleaseView } from './ExecutionRelease.js';

const at = '2026-09-04T12:00:00.000Z';
const workspaceId = 'workspace-story-695';
const blocked = {
  schemaVersion: 1,
  version: 4,
  executionReleaseId: 'execution-release_story695',
  filingAuthorizationId: 'filing-authorization_story695',
  filingAuthorizationVersion: 3,
  preparationLockId: 'preparation-lock_story695',
  preparationLockVersion: '3:4:locked',
  professionalReviewCaseId: 'professional-review_story695',
  professionalReviewVersion: 'review-v3',
  customerId: 'customer_story695',
  jurisdiction: 'GB',
  requestedExecutionChannel: 'OFFICE_PORTAL',
  checks: [
    {
      code: 'COMMERCIAL_SCOPE_UNCHANGED',
      status: 'UNKNOWN',
      blocking: true,
      explanation:
        'Current authenticated Workspace evidence still requires human confirmation before this internal release can become ready.',
      source: 'durable-owner',
      checkedAt: at
    }
  ],
  assignment: {},
  evidence: [],
  status: 'BLOCKED',
  createdAt: at,
  updatedAt: at
} satisfies ExecutionRelease;

const ready = {
  ...blocked,
  version: 5,
  checks: blocked.checks.map((check) => ({ ...check, status: 'PASS' })),
  status: 'READY_FOR_RELEASE'
} as ExecutionRelease;
const assigned = {
  ...ready,
  version: 6,
  assignment: { internalExecutorId: 'authenticated-user-story695', assignedAt: at }
} as ExecutionRelease;

export default {
  title: 'Products/Lite Execution Release',
  component: ExecutionReleaseView,
  parameters: { layout: 'fullscreen' },
  args: { workspaceId }
} satisfies Meta<typeof ExecutionReleaseView>;

type Story = StoryObj<typeof ExecutionReleaseView>;

export const QueueLoading: Story = {
  args: { state: 'RELEASE_QUEUE_LOADING', fixtureReleases: [] }
};
export const QueueEmpty: Story = {
  args: { state: 'RELEASE_QUEUE_EMPTY', fixtureReleases: [] }
};
export const Blocked: Story = { args: { fixtureReleases: [blocked] } };
export const BlockingUnknown: Story = { args: { fixtureReleases: [blocked] } };
export const Ready: Story = { args: { fixtureReleases: [ready] } };
export const Assigned: Story = { args: { fixtureReleases: [assigned] } };
export const ReleasedReceipt: Story = {
  args: {
    fixtureReleases: [
      { ...assigned, version: 7, status: 'RELEASED_FOR_EXECUTION' } as ExecutionRelease
    ]
  }
};
export const Stale: Story = {
  args: { fixtureReleases: [{ ...ready, version: 7, status: 'STALE' } as ExecutionRelease] }
};
export const Withdrawn: Story = {
  args: { fixtureReleases: [{ ...blocked, version: 7, status: 'WITHDRAWN' } as ExecutionRelease] }
};
export const LongContent: Story = { args: { fixtureReleases: [blocked] } };
export const RecoverableError: Story = {
  args: { state: 'RECOVERABLE_ERROR', fixtureReleases: [] }
};
export const Mobile390: Story = {
  args: { fixtureReleases: [blocked] },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px', styles: { width: '390px', height: '844px' } } }
    }
  }
};
