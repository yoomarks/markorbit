// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OpportunityCandidateClient } from '../../api/opportunity-candidates.js';
import { OpportunityCandidateHttpError } from '../../api/opportunity-candidates.js';
import { CandidateReview } from './CandidateReview.js';
import {
  candidateFixture,
  fixtureCandidateClient,
  qualificationFixture
} from './candidate-review-fixtures.js';

afterEach(cleanup);

async function openDetail(client: OpportunityCandidateClient) {
  const user = userEvent.setup();
  render(<CandidateReview workspaceId="workspace-test" client={client} />);
  await user.click(await screen.findByRole('button', { name: 'Review Candidate details' }));
  await screen.findByRole('heading', { name: candidateFixture.title });
}

describe('Candidate Review', () => {
  it('renders live Candidate truth while keeping status, qualification, and opaque customer reference separate', async () => {
    render(<CandidateReview workspaceId="workspace-test" client={fixtureCandidateClient(null)} />);
    expect(await screen.findByText('Candidate status: UNDER_REVIEW')).toBeVisible();
    expect(screen.getByText('Open detail to review decision')).toBeVisible();
    expect(screen.getByText('customer_opaque-414')).toBeVisible();
    expect(screen.queryByText(/customer name|company|email|region/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fixture workspace|Demonstration only/i)).not.toBeInTheDocument();
  });

  it('treats JSON null as no decision, never rejection', async () => {
    await openDetail(fixtureCandidateClient(null));
    expect(screen.getByText('No Qualification Decision recorded')).toBeVisible();
    expect(screen.queryByText('Qualification outcome: REJECTED')).not.toBeInTheDocument();
  });

  it.each(['QUALIFIED_FOR_MARKREG', 'REJECTED', 'DEFERRED'] as const)(
    'shows exact %s Qualification owner truth without replacing Candidate status',
    async (outcome) => {
      await openDetail(fixtureCandidateClient(qualificationFixture(outcome)));
      expect(screen.getByText(`Qualification outcome: ${outcome}`)).toBeVisible();
      expect(screen.getByText('Candidate status: UNDER_REVIEW')).toBeVisible();
      expect(screen.getByText('principal_reviewer-414')).toBeVisible();
      expect(screen.getAllByText('No', { selector: 'dd' })).toHaveLength(2);
    }
  );

  it('makes historical reviewed version lineage explicit', async () => {
    await openDetail(fixtureCandidateClient(qualificationFixture('DEFERRED', 2)));
    expect(
      screen.getByText('Qualification covers Candidate v2. Current Candidate is v3.')
    ).toBeVisible();
    const qualification = screen.getByRole('heading', {
      name: 'Qualification Decision'
    }).parentElement!;
    expect(within(qualification).getByText('2')).toBeVisible();
    expect(within(qualification).getByText('c'.repeat(64))).toBeVisible();
  });

  it.each([
    [401, 'Sign in required'],
    [403, 'Candidate Review unavailable'],
    [404, 'Candidate not found'],
    [503, 'Candidate Review temporarily unavailable']
  ] as const)('preserves list HTTP %s as a distinct error state', async (status, title) => {
    const client = fixtureCandidateClient();
    client.list = vi
      .fn()
      .mockRejectedValue(
        new OpportunityCandidateHttpError(status, `HTTP_${status}`, 'Owner failure')
      );
    render(<CandidateReview workspaceId="workspace-test" client={client} />);
    expect(await screen.findByRole('heading', { name: title })).toBeVisible();
    expect(screen.queryByText('No Opportunity Candidates')).not.toBeInTheDocument();
  });

  it('uses the same non-disclosing 404 detail state for unavailable Candidates', async () => {
    const client = fixtureCandidateClient();
    client.load = vi
      .fn()
      .mockRejectedValue(
        new OpportunityCandidateHttpError(404, 'OPPORTUNITY_CANDIDATE_NOT_FOUND', 'Not found')
      );
    render(
      <CandidateReview
        workspaceId="workspace-test"
        initialSelected="opportunity-candidate_unknown"
        client={client}
      />
    );
    expect(await screen.findByRole('heading', { name: 'Candidate not found' })).toBeVisible();
    expect(
      screen.getByText('This Candidate is unavailable in the current Workspace.')
    ).toBeVisible();
    expect(screen.queryByText(/other Workspace|exists/i)).not.toBeInTheDocument();
  });

  it('renders an empty Workspace without substituting demo Candidates', async () => {
    render(
      <CandidateReview workspaceId="workspace-test" client={fixtureCandidateClient(null, [])} />
    );
    expect(await screen.findByRole('heading', { name: 'No Opportunity Candidates' })).toBeVisible();
    expect(screen.getByText(/No demo or fixture Candidates were substituted/)).toBeVisible();
  });

  it('uses the returned cursor, deduplicates Candidates, and retains loaded rows on pagination failure', async () => {
    const second = {
      ...candidateFixture,
      opportunityCandidateId: 'opportunity-candidate_fixture-415' as const,
      title: 'Second Candidate'
    };
    const list = vi
      .fn<OpportunityCandidateClient['list']>()
      .mockResolvedValueOnce({
        items: [candidateFixture],
        nextCursor: candidateFixture.opportunityCandidateId
      })
      .mockResolvedValueOnce({
        items: [candidateFixture, second],
        nextCursor: second.opportunityCandidateId
      })
      .mockRejectedValueOnce(new Error('page unavailable'));
    const client = { ...fixtureCandidateClient(), list };
    const user = userEvent.setup();
    render(<CandidateReview workspaceId="workspace-test" client={client} />);

    await user.click(await screen.findByRole('button', { name: 'Load more Candidates' }));
    expect(await screen.findByRole('heading', { name: 'Second Candidate' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Review Candidate details' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Load more Candidates' }));
    expect(
      await screen.findByText(
        'Already loaded Candidates remain available. Try loading the next Gateway cursor again.'
      )
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: candidateFixture.title })).toBeVisible();
    expect(list).toHaveBeenNthCalledWith(2, {
      cursor: candidateFixture.opportunityCandidateId,
      limit: 25
    });
    expect(list).toHaveBeenNthCalledWith(3, {
      cursor: second.opportunityCandidateId,
      limit: 25
    });
  });

  it('states the complete read-only authority boundary on detail', async () => {
    await openDetail(fixtureCandidateClient(qualificationFixture('QUALIFIED_FOR_MARKREG')));
    expect(screen.getByText(/does not contact a customer/)).toHaveTextContent(
      'create a Formal Opportunity, Intake, Order, or Matter'
    );
    expect(screen.getByText(/Human qualification considers/)).toBeVisible();
    expect(
      screen.queryByText(/Customer approved|Matter ready|Customer instructed filing/)
    ).not.toBeInTheDocument();
  });
});
