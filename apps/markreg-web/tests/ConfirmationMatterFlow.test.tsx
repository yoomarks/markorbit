import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CustomerConfirmation, MatterDraft, PlanQuoteResponse } from '@markorbit/contracts';
import { ConfirmationMatterFlow } from '../src/ConfirmationMatterFlow.js';

const now = '2026-07-29T12:00:00.000Z';
const quote: PlanQuoteResponse = {
  planSelection: {
    planSelectionId: 'plan_test',
    intakeId: 'intake_test',
    recommendationId: 'recommendation_test',
    selectedOptionCode: 'B',
    selectedAt: now
  },
  quote: {
    quoteId: 'quote_test',
    intakeId: 'intake_test',
    recommendationId: 'recommendation_test',
    selectedOptionCode: 'B',
    pricingRuleVersion: 'quote-v1',
    status: 'READY',
    currency: 'USD',
    lines: [],
    subtotal: { amountMinor: 0, currency: 'USD' },
    estimatedOfficialFees: { amountMinor: 0, currency: 'USD' },
    estimatedServiceFees: { amountMinor: 0, currency: 'USD' },
    estimatedDisbursements: { amountMinor: 0, currency: 'USD' },
    estimatedTaxes: { amountMinor: 0, currency: 'USD' },
    total: { amountMinor: 0, currency: 'USD' },
    assumptions: [],
    limitations: [],
    validUntil: '2026-08-29T00:00:00.000Z',
    fixtureOnly: true,
    createdAt: now
  }
};
const confirmation: CustomerConfirmation = {
  schemaVersion: 1,
  confirmationId: 'confirmation_test',
  customerId: 'customer_test',
  quoteSnapshot: {
    quoteId: 'quote_test',
    quoteVersion: 'quote-v1',
    planId: 'plan_test',
    planVersion: 'plan-v1',
    currency: 'USD',
    totalMinor: 0,
    lineItems: []
  },
  confirmedBy: 'actor_test',
  confirmedAt: now,
  termsVersion: 'terms-v1',
  acknowledgements: [],
  status: 'CONFIRMED',
  createdAt: now,
  updatedAt: now
};
const matter: MatterDraft & { version: number } = {
  schemaVersion: 1,
  matterDraftId: 'matter-draft_test',
  confirmationId: confirmation.confirmationId,
  customerId: 'customer_test',
  preparation: { classes: [], documentReferences: [] },
  instructionCompleteness: 'INCOMPLETE',
  documentReadiness: 'MISSING',
  readiness: { evaluatedAt: now, readyForProfessionalReview: false, checks: [] },
  missingInformation: ['APPLICANT_IDENTITY_PRESENT'],
  status: 'NEEDS_INFORMATION',
  version: 1,
  createdAt: now,
  updatedAt: now
};

describe('Confirmation receipt authority boundary', () => {
  it('renders each prohibited automatic consequence exactly once with a visible No value', () => {
    render(
      <ConfirmationMatterFlow
        quote={quote}
        client={{ createIntake: () => Promise.reject(new Error('unused')) }}
        fixture={{ state: 'CONFIRMATION_RECEIPT', confirmation }}
      />
    );
    const receipt = screen.getByRole('region', { name: 'Confirmation receipt' });
    for (const label of [
      'Order created',
      'Payment created',
      'Professional appointed',
      'Filing created'
    ]) {
      const items = within(receipt)
        .getAllByRole('listitem')
        .filter((item) => item.textContent?.includes(label));
      expect(items).toHaveLength(1);
      expect(within(items[0]!).getByText('No', { exact: true })).toBeVisible();
    }
  });
  it('saves using the displayed optimistic version and reports the winning version', async () => {
    const updateMatterDraft = vi
      .fn()
      .mockResolvedValue({ matterDraft: { ...matter, version: 2 }, consequences: {} });
    render(
      <ConfirmationMatterFlow
        quote={quote}
        client={{ createIntake: vi.fn(), updateMatterDraft }}
        fixture={{ state: 'MATTER_DRAFT_EDITING', confirmation, draft: matter }}
      />
    );
    fireEvent.change(screen.getByLabelText('Applicant / Owner'), {
      target: { value: 'Orbit Ltd' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Matter Draft' }));
    await screen.findByText('Saved version 2');
    expect(updateMatterDraft).toHaveBeenCalledWith(
      'matter-draft_test',
      expect.objectContaining({ applicantName: 'Orbit Ltd' }),
      1,
      undefined
    );
  });
  it('reloads the persisted Draft identity after browser refresh', async () => {
    sessionStorage.setItem(`markreg-matter-draft:${quote.quote.quoteId}`, matter.matterDraftId);
    const getMatterDraft = vi.fn().mockResolvedValue({ matterDraft: matter, consequences: {} });
    render(
      <ConfirmationMatterFlow quote={quote} client={{ createIntake: vi.fn(), getMatterDraft }} />
    );
    await waitFor(() => expect(getMatterDraft).toHaveBeenCalledWith(matter.matterDraftId));
    expect(
      await screen.findByRole('heading', { name: 'Matter Draft preparation workspace' })
    ).toBeVisible();
    expect(screen.getByText('matter-draft_test')).toBeVisible();
  });
});
