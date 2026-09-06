import type { Meta, StoryObj } from '@storybook/react';
import {
  WorkspaceInsightsHttpError,
  type WorkspaceInsightsClient
} from '../../api/workspace-insights.js';
import { insightsWorkspaceId, workspaceInsightsFixture } from './fixtures.js';
import { WorkspaceInsights } from './WorkspaceInsights.js';

const successClient: WorkspaceInsightsClient = {
  load: () => Promise.resolve(workspaceInsightsFixture())
};
const loadingClient: WorkspaceInsightsClient = {
  load: () => new Promise(() => undefined)
};
const deniedClient: WorkspaceInsightsClient = {
  load: () =>
    Promise.reject(
      new WorkspaceInsightsHttpError(403, 'PERMISSION_DENIED', 'workspace:read is required.')
    )
};
const unavailableClient: WorkspaceInsightsClient = {
  load: () =>
    Promise.reject(
      new WorkspaceInsightsHttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'Analytics owner is offline.',
        true
      )
    )
};

export default {
  title: 'Products/Lite/Today/Workspace Insights',
  component: WorkspaceInsights,
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof WorkspaceInsights>;

type Story = StoryObj<typeof WorkspaceInsights>;
export const ExplicitPreference: Story = {
  args: { workspaceId: insightsWorkspaceId, preferenceSource: 'EXPLICIT', client: successClient }
};

export const ProductFeedbackPreference: Story = {
  args: {
    workspaceId: insightsWorkspaceId,
    preferenceSource: 'PRODUCT_FEEDBACK',
    client: successClient
  }
};

export const NoPreferenceEvidence: Story = {
  args: { workspaceId: insightsWorkspaceId, preferenceSource: 'NONE', client: successClient }
};

export const PreferenceReadUnavailable: Story = {
  args: { workspaceId: insightsWorkspaceId, preferenceSource: null, client: successClient }
};

export const Loading: Story = {
  args: { workspaceId: insightsWorkspaceId, preferenceSource: undefined, client: loadingClient }
};
export const PermissionDenied: Story = {
  args: { workspaceId: insightsWorkspaceId, preferenceSource: 'NONE', client: deniedClient }
};

export const OwnerUnavailable: Story = {
  args: { workspaceId: insightsWorkspaceId, preferenceSource: 'NONE', client: unavailableClient }
};

export const Mobile390: Story = {
  args: {
    workspaceId: insightsWorkspaceId,
    preferenceSource: 'PRODUCT_FEEDBACK',
    client: successClient
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
