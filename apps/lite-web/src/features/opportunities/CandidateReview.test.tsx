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
  dispositionedCandidateFixture,
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
    expect(screen.getByRole('heading', { name: 'Record human Qualification' })).toBeVisible();
  });

  it('requires an explicit outcome and non-empty rationale for the exact loaded Candidate', async () => {
    await openDetail(fixtureCandidateClient(null));
    const submit = screen.getByRole('button', { name: 'Record human Qualification' });
    expect(submit).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /Qualified for MarkReg/ }));
    expect(submit).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Human rationale' }), '  Exact evidence  ');
    expect(submit).toBeEnabled();
    expect(
      screen.getByText(/not a customer instruction or a Formal MarkReg Opportunity/)
    ).toBeVisible();
  });

  it.each(['QUALIFIED_FOR_MARKREG', 'REJECTED', 'DEFERRED'] as const)(
    'submits %s then reloads Candidate and Qualification durable truth',
    async (selectedOutcome) => {
      const durableDecision = qualificationFixture(selectedOutcome);
      const client = fixtureCandidateClient(null);
      const qualify = vi.fn().mockResolvedValue({
        decision: durableDecision,
        currentCandidate: dispositionedCandidateFixture
      });
      const load = vi
        .fn()
        .mockResolvedValueOnce(candidateFixture)
        .mockResolvedValueOnce(dispositionedCandidateFixture);
      const loadQualification = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(durableDecision);
      client.qualify = qualify;
      client.load = load;
      client.loadQualification = loadQualification;
      await openDetail(client);
      const user = userEvent.setup();
      const label = {
        QUALIFIED_FOR_MARKREG: /Qualified for MarkReg/,
        REJECTED: /Reject Candidate/,
        DEFERRED: /Defer Candidate/
      }[selectedOutcome];
      await user.click(screen.getByRole('radio', { name: label }));
      await user.type(
        screen.getByRole('textbox', { name: 'Human rationale' }),
        'Exact evidence supports this human decision.'
      );
      await user.click(screen.getByRole('button', { name: 'Record human Qualification' }));

      expect(qualify).toHaveBeenCalledWith(
        candidateFixture.opportunityCandidateId,
        {
          candidateVersion: candidateFixture.version,
          expectedCandidateFingerprintSha256:
            candidateFixture.opportunityCandidateFingerprintSha256,
          outcome: selectedOutcome,
          rationale: 'Exact evidence supports this human decision.'
        },
        expect.stringMatching(/^opportunity-qualification:/)
      );
      expect(await screen.findByText(`Qualification outcome: ${selectedOutcome}`)).toBeVisible();
      expect(screen.getByText('Candidate status: DISPOSITIONED')).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: 'Record human Qualification' })
      ).not.toBeInTheDocument();
      expect(load).toHaveBeenCalledTimes(2);
      expect(loadQualification).toHaveBeenCalledTimes(2);
    }
  );

  it.each([
    [401, /authenticated session is required/],
    [403, /denied by Workspace permission, Origin, or CSRF policy/],
    [404, /unavailable in the current Workspace/],
    [409, /conflicted with the current Candidate version/],
    [422, /outcome or rationale was not accepted/],
    [503, /temporarily unavailable/]
  ] as const)(
    'preserves loaded evidence and rationale after Qualification HTTP %s',
    async (status, expectedCopy) => {
      const client = fixtureCandidateClient(null);
      client.qualify = vi
        .fn()
        .mockRejectedValue(new OpportunityCandidateHttpError(status, `HTTP_${status}`, 'Failure'));
      await openDetail(client);
      const user = userEvent.setup();
      await user.click(screen.getByRole('radio', { name: /Defer Candidate/ }));
      const rationale = screen.getByRole('textbox', { name: 'Human rationale' });
      await user.type(rationale, 'Keep this rationale after failure.');
      await user.click(screen.getByRole('button', { name: 'Record human Qualification' }));

      expect(await screen.findByText('Qualification was not recorded')).toBeVisible();
      expect(screen.getByText(expectedCopy)).toBeVisible();
      expect(
        screen.getByText(candidateFixture.opportunityCandidateFingerprintSha256)
      ).toBeVisible();
      expect(rationale).toHaveValue('Keep this rationale after failure.');
      expect(screen.getByText('No Qualification Decision recorded')).toBeVisible();
    }
  );

  it('reuses one idempotency key for an unchanged failed submission and creates a new key after editing', async () => {
    const client = fixtureCandidateClient(null);
    const qualify = vi
      .fn()
      .mockRejectedValue(
        new OpportunityCandidateHttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'Failure')
      );
    client.qualify = qualify;
    await openDetail(client);
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /Defer Candidate/ }));
    const rationale = screen.getByRole('textbox', { name: 'Human rationale' });
    await user.type(rationale, 'Same logical submission.');
    await user.click(screen.getByRole('button', { name: 'Record human Qualification' }));
    await screen.findByText('Qualification was not recorded');
    await user.click(screen.getByRole('button', { name: 'Record human Qualification' }));
    await screen.findByText('Qualification was not recorded');
    await user.type(rationale, ' Updated.');
    await user.click(screen.getByRole('button', { name: 'Record human Qualification' }));
    await screen.findByText('Qualification was not recorded');

    expect(qualify).toHaveBeenCalledTimes(3);
    expect(qualify.mock.calls[0]?.[2]).toBe(qualify.mock.calls[1]?.[2]);
    expect(qualify.mock.calls[2]?.[2]).not.toBe(qualify.mock.calls[1]?.[2]);
  });

  it('keeps a successful submission locked through a resolved null reload until the durable Decision appears', async () => {
    const client = fixtureCandidateClient(null);
    const durableDecision = qualificationFixture('DEFERRED');
    const qualify = vi.fn().mockResolvedValue({
      decision: durableDecision,
      currentCandidate: dispositionedCandidateFixture
    });
    client.qualify = qualify;
    client.load = vi
      .fn()
      .mockResolvedValueOnce(candidateFixture)
      .mockRejectedValueOnce(new Error('reload failed'))
      .mockResolvedValueOnce(candidateFixture)
      .mockResolvedValueOnce(dispositionedCandidateFixture);
    client.loadQualification = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(durableDecision);
    await openDetail(client);
    const user = userEvent.setup();
    const deferred = screen.getByRole('radio', { name: /Defer Candidate/ });
    await user.click(deferred);
    const rationale = screen.getByRole('textbox', { name: 'Human rationale' });
    await user.type(rationale, 'Preserve this submitted context.');
    await user.click(screen.getByRole('button', { name: 'Record human Qualification' }));

    expect(await screen.findByText('Reload durable Qualification truth')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reload Candidate and Qualification' }));

    expect(await screen.findByText('Reload durable Qualification truth')).toBeVisible();
    expect(screen.getByText(candidateFixture.opportunityCandidateFingerprintSha256)).toBeVisible();
    expect(rationale).toHaveValue('Preserve this submitted context.');
    expect(rationale).toBeDisabled();
    expect(deferred).toBeChecked();
    expect(deferred).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Record human Qualification' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reload Candidate and Qualification' })
    ).toBeVisible();
    expect(qualify).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Reload Candidate and Qualification' }));

    expect(await screen.findByText('Qualification outcome: DEFERRED')).toBeVisible();
    expect(screen.getByText('Candidate status: DISPOSITIONED')).toBeVisible();
    expect(screen.queryByText('Reload durable Qualification truth')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Record human Qualification' })
    ).not.toBeInTheDocument();
    expect(qualify).toHaveBeenCalledTimes(1);
  });

  it('suppresses controls for an existing durable Decision and a DISPOSITIONED Candidate', async () => {
    await openDetail(fixtureCandidateClient(qualificationFixture('REJECTED')));
    expect(
      screen.queryByRole('heading', { name: 'Record human Qualification' })
    ).not.toBeInTheDocument();
    cleanup();
    const client = fixtureCandidateClient(null, [dispositionedCandidateFixture]);
    client.load = vi.fn().mockResolvedValue(dispositionedCandidateFixture);
    await openDetail(client);
    expect(
      screen.queryByRole('heading', { name: 'Record human Qualification' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Qualification unavailable')).toBeVisible();
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
      'create a Formal Opportunity, Intake, Order, Matter, Payment, or Filing'
    );
    expect(screen.getByText(/Human qualification considers/)).toBeVisible();
    expect(
      screen.queryByText(/Customer approved|Matter ready|Customer instructed filing/)
    ).not.toBeInTheDocument();
  });
});
