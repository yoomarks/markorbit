import type { Meta, StoryObj } from '@storybook/react';
import { OaWorkbench } from './OaWorkbench.js';

export default {
  title: 'Products/Lite/OA Conversational Workbench',
  component: OaWorkbench,
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof OaWorkbench>;

type Story = StoryObj<typeof OaWorkbench>;
export const ChineseMainJourney: Story = {
  args: { scenario: 'READY', initialLocale: 'zh', trustedPrincipalId: 'storybook-oa-professional' }
};
export const EnglishMainJourney: Story = {
  args: {
    scenario: 'READY',
    initialLocale: 'en',
    trustedPrincipalId: 'storybook-oa-professional-en'
  }
};
export const TwoSourceLinkedIssues: Story = {
  args: { scenario: 'READY', trustedPrincipalId: 'storybook-two-issues' }
};
export const AmbiguousMatch: Story = {
  args: { scenario: 'AMBIGUOUS_MATCH', trustedPrincipalId: 'storybook-ambiguous' }
};
export const PartialFile: Story = {
  args: { scenario: 'PARTIAL_FILE', trustedPrincipalId: 'storybook-partial' }
};
export const DeadlineUnknown: Story = {
  args: { scenario: 'DEADLINE_UNKNOWN', trustedPrincipalId: 'storybook-deadline' }
};
export const StaleDocumentVersion: Story = { args: { scenario: 'STALE_SOURCE' } };
export const PermissionRevoked: Story = { args: { scenario: 'PERMISSION' } };
export const WrongWorkspace: Story = { args: { scenario: 'WRONG_WORKSPACE' } };
export const DependencyFailure: Story = { args: { scenario: 'SOURCE_UNAVAILABLE' } };
export const ConflictedEvidence: Story = {
  args: { scenario: 'CONFLICTED_EVIDENCE', trustedPrincipalId: 'storybook-conflict' }
};
export const EmptySource: Story = { args: { scenario: 'EMPTY' } };
export const Loading: Story = { args: { scenario: 'LOADING' } };
export const Preparing: Story = { args: { scenario: 'PREPARING' } };
export const Prepared: Story = {
  args: { scenario: 'PREPARED', trustedPrincipalId: 'storybook-prepared' }
};
export const ReviewPending: Story = {
  args: { scenario: 'REVIEW_PENDING', trustedPrincipalId: 'storybook-review-pending' }
};
export const SavedDemo: Story = {
  args: { scenario: 'SAVED_DEMO', trustedPrincipalId: 'storybook-saved' }
};

const unavailableStorage = {
  getItem(): string | null {
    throw new Error('Demo storage unavailable');
  },
  setItem(): void {
    throw new Error('Demo storage unavailable');
  }
};
export const SaveFailure: Story = {
  args: {
    scenario: 'READY',
    trustedPrincipalId: 'storybook-save-failure',
    storage: unavailableStorage
  }
};
export const SessionOnlyDraft: Story = { args: { scenario: 'READY', trustedPrincipalId: '' } };
export const Mobile390: Story = {
  args: { scenario: 'READY', trustedPrincipalId: 'storybook-mobile' },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
