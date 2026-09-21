// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PreparedActionJourney } from '@markorbit/contracts/product-loop';
import {
  SeedContextualWorkbench,
  type SeedWorkbenchContextBrief
} from './SeedContextualWorkbench.js';

afterEach(cleanup);

const workspaceId = '30303030-3030-4030-8030-303030303030';

const context: SeedWorkbenchContextBrief = {
  contextId: 'seed-context_test',
  title: 'Northstar Robotics Ltd.',
  subtitle: 'Source-backed Seed context',
  currentness: 'Prepared context refreshed 18 minutes ago.',
  evidence: ['18 historically represented trademarks', 'One maintenance item worth review'],
  authorityNote:
    'Historical representation and conversation text do not establish a current Customer Relationship.'
};

const prepared = {
  schemaVersion: 1,
  preparedAction: {
    schemaVersion: 1,
    preparedActionId: 'prepared-action_workbench-test',
    workspaceId,
    version: 1,
    recommendation: { id: 'today-recommendation_workbench-test', version: 1 },
    recommendationFingerprintSha256: 'a'.repeat(64),
    kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    summary: 'Review one qualified trademark-service opportunity in MarkReg.',
    confirmationEffect:
      'Create one Formal Trademark Service Opportunity from the exact reviewed Candidate. No customer contact, order, matter, payment or filing will occur.',
    handoffTarget: 'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    sources: [],
    preparedActionFingerprintSha256: 'b'.repeat(64),
    confirmationRequired: true,
    executionAuthorized: false,
    createdAt: '2026-09-21T12:00:00.000Z',
    updatedAt: '2026-09-21T12:00:00.000Z'
  },
  handoffState: 'AWAITING_CONFIRMATION'
} as unknown as PreparedActionJourney;

const completed = {
  ...prepared,
  confirmation: {
    schemaVersion: 1,
    preparedAction: { id: prepared.preparedAction.preparedActionId, version: 1 },
    expectedPreparedActionFingerprintSha256:
      prepared.preparedAction.preparedActionFingerprintSha256,
    confirmedByPrincipalId: '11111111-1111-4111-8111-111111111111',
    confirmedAt: '2026-09-21T12:03:00.000Z',
    acknowledgedEffect: prepared.preparedAction.confirmationEffect,
    protectedActionAuthorized: false
  },
  handoffState: 'HANDOFF_COMPLETED',
  handoffResult: {
    schemaVersion: 1,
    preparedAction: { id: prepared.preparedAction.preparedActionId, version: 1 },
    target: 'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    owner: 'MARKREG',
    ownerRecord: { id: 'trademark-service-opportunity_workbench-test', version: 1 },
    completedAt: '2026-09-21T12:03:01.000Z',
    consequences: {
      externalPublishExecuted: false,
      customerContactedAutomatically: false,
      formalOpportunityCreatedAutomatically: false,
      orderCreatedAutomatically: false,
      matterCreatedAutomatically: false,
      paymentCreated: false,
      providerAppointed: false,
      filingSubmitted: false,
      officialTruthCreated: false
    }
  }
} as unknown as PreparedActionJourney;

describe('SeedContextualWorkbench', () => {
  it('keeps Seed customer review as a working proposal until the structured review owns the change', async () => {
    const onPrepare = vi.fn();
    const onConfirm = vi.fn();
    render(
      <SeedContextualWorkbench
        task="SEED_CUSTOMER_REVIEW"
        context={context}
        structuredReviewHref="/seed-review?packageId=test"
        onPrepare={onPrepare}
        onConfirm={onConfirm}
      />
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Current client' }));

    expect(screen.getByRole('heading', { name: 'Working proposal' })).toBeVisible();
    expect(screen.getAllByText('Current client').length).toBeGreaterThan(0);
    expect(screen.getByText(/not committed here/i)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Continue in structured customer review' })
    ).toHaveAttribute('href', '/seed-review?packageId=test');
    expect(onPrepare).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Confirm this action' })).not.toBeInTheDocument();
  });

  it('delegates preparation and confirmation to the existing structured journey seam', async () => {
    const onPrepare = vi.fn().mockResolvedValue(prepared);
    const onConfirm = vi.fn().mockResolvedValue(completed);
    render(
      <SeedContextualWorkbench
        task="OPPORTUNITY_REVIEW"
        context={context}
        onPrepare={onPrepare}
        onConfirm={onConfirm}
        receiptHref="/receipts/opportunity-test"
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Review service need' }));
    expect(onPrepare).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Prepare reviewable opportunity action' }));
    expect(onPrepare).toHaveBeenCalledWith({
      task: 'OPPORTUNITY_REVIEW',
      contextId: context.contextId,
      answer: 'Review service need'
    });
    expect(await screen.findByText(prepared.preparedAction.summary)).toBeVisible();
    expect(screen.getByText(prepared.preparedAction.confirmationEffect)).toBeVisible();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm this action' }));
    expect(onConfirm).toHaveBeenCalledWith(prepared);
    expect(await screen.findByText('Committed result')).toBeVisible();
    expect(screen.getByText(/trademark-service-opportunity_workbench-test/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open result receipt' })).toHaveAttribute(
      'href',
      '/receipts/opportunity-test'
    );
  });

  it('invalidates a prepared result when the working proposal changes', async () => {
    const onPrepare = vi.fn().mockResolvedValue(prepared);
    const onConfirm = vi.fn().mockResolvedValue(completed);
    render(
      <SeedContextualWorkbench
        task="OPPORTUNITY_REVIEW"
        context={context}
        onPrepare={onPrepare}
        onConfirm={onConfirm}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Review service need' }));
    await user.click(screen.getByRole('button', { name: 'Prepare reviewable opportunity action' }));
    expect(await screen.findByText(prepared.preparedAction.summary)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirm this action' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Need more evidence' }));

    expect(screen.queryByText(prepared.preparedAction.summary)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm this action' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Need more evidence').length).toBeGreaterThan(0);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('resets conversational working state when the structured context changes', async () => {
    const otherContext: SeedWorkbenchContextBrief = {
      ...context,
      contextId: 'seed-context_other',
      title: 'Second Organization Ltd.'
    };
    const { rerender } = render(
      <SeedContextualWorkbench task="OPPORTUNITY_REVIEW" context={context} />
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Review service need' }));
    expect(screen.getByText('3 turns')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Working proposal' })).toBeVisible();

    rerender(<SeedContextualWorkbench task="OPPORTUNITY_REVIEW" context={otherContext} />);

    expect(screen.getByRole('heading', { name: 'Second Organization Ltd.' })).toBeVisible();
    expect(screen.getByText('1 turns')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Waiting for one bounded answer' })).toBeVisible();
  });

  it('retains free text as working context without mutating until Prepare is explicit', async () => {
    const onPrepare = vi.fn().mockResolvedValue(prepared);
    render(
      <SeedContextualWorkbench task="CLIENT_ACTION_DRAFT" context={context} onPrepare={onPrepare} />
    );

    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('Add context in your own words'),
      'Mention the upcoming deadline and ask for confirmation.'
    );
    await user.click(screen.getByRole('button', { name: 'Add to working context' }));

    expect(
      screen.getAllByText('Mention the upcoming deadline and ask for confirmation.').length
    ).toBeGreaterThan(0);
    expect(onPrepare).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Prepare reviewable client action' }));
    expect(onPrepare).toHaveBeenCalledTimes(1);
  });

  it('describes an owner-backed committed result without claiming that nothing changed', () => {
    render(
      <SeedContextualWorkbench
        task="OPPORTUNITY_REVIEW"
        context={context}
        initialJourney={completed}
        receiptHref="/receipts/opportunity-test"
      />
    );

    expect(screen.getByRole('heading', { name: 'Committed structured result' })).toBeVisible();
    expect(screen.getByText(/existing owner returned a committed result/i)).toBeVisible();
    expect(
      screen.queryByText(/No customer, opportunity, message or filing state has changed/i)
    ).not.toBeInTheDocument();
  });

  it('does not expose work actions when permission is unavailable', () => {
    render(
      <SeedContextualWorkbench task="OPPORTUNITY_REVIEW" context={context} state="permission" />
    );

    expect(screen.getByText('You do not have access to this context')).toBeVisible();
    expect(screen.queryByText('Work on this')).not.toBeInTheDocument();
  });
});
