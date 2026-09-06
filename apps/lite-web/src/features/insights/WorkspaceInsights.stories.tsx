import type { Meta, StoryObj } from '@storybook/react';
import { WorkspaceInsightsHttpError } from '../../api/workspace-insights.js';
import {
  insightsFixtureWorkspaceId,
  workspaceInsightsFixture,
  workspaceInsightsFixtureClient
} from './WorkspaceInsights.fixtures.js';
import { WorkspaceInsights } from './WorkspaceInsights.js';

export default {
  title: 'Products/Lite/Workspace Insights',
  component: WorkspaceInsights,
  parameters: { layout: 'padded', a11y: { disable: false } }
} satisfies Meta<typeof WorkspaceInsights>;

type Story = StoryObj<typeof WorkspaceInsights>;

export const ExplicitLearning: Story = {
  args: {
    workspaceId: insightsFixtureWorkspaceId,
    preferenceSource: 'EXPLICIT',
    client: workspaceInsightsFixtureClient()
  }
};

export const PreferenceUnavailable: Story = {
  args: {
    workspaceId: insightsFixtureWorkspaceId,
    preferenceSource: null,
    client: workspaceInsightsFixtureClient()
  }
};

export const ZeroDenominatorsMobile390: Story = {
  args: {
    workspaceId: insightsFixtureWorkspaceId,
    preferenceSource: 'NONE',
    client: workspaceInsightsFixtureClient({
      ...workspaceInsightsFixture(),
      content: {
        contentOpportunities: 0,
        draftPrepared: 0,
        humanReviewRecorded: 0,
        publishPackagesPrepared: 0,
        userReportedUseFeedback: 0,
        rates: {
          opportunityToDraft: { numerator: 0, denominator: 0, rate: null },
          draftToHumanReview: { numerator: 0, denominator: 0, rate: null },
          humanReviewToPublishPackage: { numerator: 0, denominator: 0, rate: null },
          publishPackageToUseFeedback: { numerator: 0, denominator: 0, rate: null }
        }
      },
      opportunity: {
        opportunityCandidates: 0,
        qualificationDecisions: 0,
        qualifiedForMarkReg: 0,
        formalOpportunityHandoffResults: 0,
        rates: {
          candidateToQualification: { numerator: 0, denominator: 0, rate: null },
          qualificationToQualified: { numerator: 0, denominator: 0, rate: null },
          qualifiedToFormalOpportunityHandoff: { numerator: 0, denominator: 0, rate: null }
        }
      }
    })
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};

export const OwnerUnavailable: Story = {
  args: {
    workspaceId: insightsFixtureWorkspaceId,
    preferenceSource: null,
    client: {
      load: () =>
        Promise.reject(
          new WorkspaceInsightsHttpError(
            503,
            'PERSISTENCE_UNAVAILABLE',
            'Conversion analytics persistence is unavailable.',
            true
          )
        )
    }
  }
};
