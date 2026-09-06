// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  WorkspaceInsightsHttpError,
  type WorkspaceInsightsClient
} from '../../api/workspace-insights.js';
import {
  insightsFixtureWorkspaceId,
  workspaceInsightsFixture,
  workspaceInsightsFixtureClient
} from './WorkspaceInsights.fixtures.js';
import { WorkspaceInsights } from './WorkspaceInsights.js';

afterEach(cleanup);

describe('Workspace Insights', () => {
  it('renders action-first workflow observations and keeps every rate tied to numerator/denominator context', async () => {
    render(
      <WorkspaceInsights
        workspaceId={insightsFixtureWorkspaceId}
        preferenceSource="EXPLICIT"
        client={workspaceInsightsFixtureClient()}
      />
    );

    expect(await screen.findByRole('heading', { name: 'Workspace Insights' })).toBeVisible();
    expect(screen.getByText("Today's ranking is using explicit preference evidence.")).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Outcome feedback can close a visible loop' })).toBeVisible();
    expect(screen.getByText(/1 packaged content opportunity does not yet have/)).toBeVisible();
    expect(screen.getByText('Content Opportunities').nextElementSibling).toHaveTextContent('6');
    expect(screen.getByText('Opportunity Candidates').nextElementSibling).toHaveTextContent('8');

    const user = userEvent.setup();
    const details = screen.getAllByText('Show conversion context');
    await user.click(details[0]!);
    expect(screen.getByText('83% · 5 of 6')).toBeVisible();
    expect(screen.getByText('67% · 2 of 3')).toBeVisible();
    expect(screen.getByText(/MarkOrbit did not execute or independently verify/)).toBeVisible();
  });

  it.each([
    ['PRODUCT_FEEDBACK', "Today's ranking is using product-use feedback as preference evidence."],
    ['NONE', 'No preference evidence is currently shaping this view.'],
    [null, 'The current preference evidence source is unavailable. This is not treated as no preference evidence.']
  ] as const)('renders exact preference-source truth for %s', async (preferenceSource, copy) => {
    render(
      <WorkspaceInsights
        workspaceId={insightsFixtureWorkspaceId}
        preferenceSource={preferenceSource}
        client={workspaceInsightsFixtureClient()}
      />
    );
    expect(await screen.findByText(copy)).toBeVisible();
  });

  it('renders zero denominators as unavailable rates rather than false percentages', async () => {
    const base = workspaceInsightsFixture();
    const empty = {
      ...base,
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
    };
    render(
      <WorkspaceInsights
        workspaceId={insightsFixtureWorkspaceId}
        preferenceSource="NONE"
        client={workspaceInsightsFixtureClient(empty)}
      />
    );
    const user = userEvent.setup();
    await user.click((await screen.findAllByText('Show conversion context'))[0]!);
    expect(screen.getAllByText('No rate yet · 0 of 0').length).toBeGreaterThan(0);
    expect(screen.queryByText(/0% · 0 of 0/)).not.toBeInTheDocument();
  });

  it('keeps owner failure distinct from a zero-metric snapshot', async () => {
    const client: WorkspaceInsightsClient = {
      load: () =>
        Promise.reject(
          new WorkspaceInsightsHttpError(
            503,
            'PERSISTENCE_UNAVAILABLE',
            'Conversion analytics persistence is unavailable.',
            true
          )
        )
    };
    render(
      <WorkspaceInsights
        workspaceId={insightsFixtureWorkspaceId}
        preferenceSource={null}
        client={client}
      />
    );

    expect(await screen.findByText('Workspace Insights unavailable')).toBeVisible();
    expect(screen.getByText(/No analytics counts are shown as zero/)).toBeVisible();
    expect(screen.queryByText('Content Opportunities')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry Insights' })).toBeVisible();
  });
});
