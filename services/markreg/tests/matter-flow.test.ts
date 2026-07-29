import { describe, expect, it } from 'vitest';
import type { Quote } from '@markorbit/contracts';
import {
  InMemoryMatterFlowRepository,
  MatterFlowError,
  MatterFlowService
} from '../src/matter-flow.js';

const now = '2026-07-29T12:00:00.000Z';
const quote: Quote = {
  quoteId: 'quote_fixture',
  intakeId: 'intake_fixture',
  recommendationId: 'recommendation_fixture',
  selectedOptionCode: 'B',
  pricingRuleVersion: 'quote-v1',
  status: 'READY',
  currency: 'USD',
  lines: [
    {
      code: 'SERVICE',
      description: 'Service',
      category: 'SERVICE_FEE',
      amount: { amountMinor: 90000, currency: 'USD' }
    }
  ],
  subtotal: { amountMinor: 90000, currency: 'USD' },
  estimatedOfficialFees: { amountMinor: 0, currency: 'USD' },
  estimatedServiceFees: { amountMinor: 90000, currency: 'USD' },
  estimatedDisbursements: { amountMinor: 0, currency: 'USD' },
  estimatedTaxes: { amountMinor: 0, currency: 'USD' },
  total: { amountMinor: 90000, currency: 'USD' },
  assumptions: [],
  limitations: [],
  validUntil: '2026-08-20T00:00:00.000Z',
  fixtureOnly: true,
  createdAt: now
};
const acknowledgements = (
  [
    'NO_FILING',
    'NO_PROFESSIONAL_APPOINTMENT',
    'REVIEW_MAY_BE_REQUIRED',
    'SCOPE_CHANGE_REQUOTE'
  ] as const
).map((code) => ({ code, acknowledged: true as const, acknowledgedAt: now }));
const command = {
  quoteId: quote.quoteId,
  quoteVersion: 'quote-v1',
  planId: 'plan_fixture' as const,
  planVersion: 'plan-v1',
  customerId: 'customer_fixture' as const,
  termsVersion: 'terms-v1',
  acknowledgements,
  actor: {
    actorId: 'actor_fixture' as const,
    workplaceId: 'workplace_fixture' as const,
    product: 'MARKREG_COM' as const,
    purpose: 'confirm commercial scope'
  },
  idempotencyKey: 'key-1'
};
function setup() {
  const repository = new InMemoryMatterFlowRepository();
  return {
    repository,
    service: new MatterFlowService(
      repository,
      async () => structuredClone(quote),
      () => now
    )
  };
}

describe('customer confirmation and Matter Draft domain', () => {
  it('preserves immutable quote values and returns no automatic consequences', async () => {
    const { service } = setup();
    const first = await service.confirm(command);
    quote.total.amountMinor = 1;
    expect(first.confirmation.quoteSnapshot.totalMinor).toBe(90000);
    quote.total.amountMinor = 90000;
    expect(first.consequences).toEqual({
      orderCreated: false,
      paymentCreated: false,
      professionalAppointed: false,
      filingCreated: false
    });
  });
  it('returns the same confirmation for an idempotent duplicate and rejects a conflict', async () => {
    const { service } = setup();
    const first = await service.confirm(command);
    const duplicate = await service.confirm(command);
    expect(duplicate.confirmation.confirmationId).toBe(first.confirmation.confirmationId);
    await expect(service.confirm({ ...command, termsVersion: 'different' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    });
  });
  it('rejects a quote-version mismatch and an invalid Quote status', async () => {
    const { service } = setup();
    await expect(service.confirm({ ...command, quoteVersion: 'v2' })).rejects.toMatchObject({
      code: 'QUOTE_VERSION_MISMATCH'
    });
    const invalid = new MatterFlowService(
      new InMemoryMatterFlowRepository(),
      async () => ({ ...quote, status: 'SUPERSEDED' }),
      () => now
    );
    await expect(invalid.confirm(command)).rejects.toBeInstanceOf(MatterFlowError);
  });
  it('prevents a withdrawn confirmation from preparing a draft', async () => {
    const { service, repository } = setup();
    const confirmed = await service.confirm(command);
    await repository.withdrawConfirmation(confirmed.confirmation.confirmationId, now);
    await expect(service.createDraft(confirmed.confirmation.confirmationId)).rejects.toMatchObject({
      code: 'CONFIRMATION_WITHDRAWN'
    });
  });
  it('treats missing and UNKNOWN blocking evidence as not ready', async () => {
    const { service } = setup();
    const confirmed = await service.confirm(command);
    const draft = await service.createDraft(confirmed.confirmation.confirmationId);
    expect(draft.matterDraft.status).toBe('NEEDS_INFORMATION');
    expect(
      draft.matterDraft.readiness.checks.find(
        (x) => x.code === 'FILING_BASIS_PRESENT_OR_NOT_REQUIRED'
      )?.status
    ).toBe('UNKNOWN');
    expect(draft.matterDraft.readiness.readyForProfessionalReview).toBe(false);
  });
  it('becomes ready only with every blocking evidence item, without authority side effects', async () => {
    const { service } = setup();
    const confirmed = await service.confirm(command);
    const created = await service.createDraft(confirmed.confirmation.confirmationId);
    await service.updateDraft(created.matterDraft.matterDraftId, {
      applicantName: 'Orbit Ltd',
      applicantAddress: '1 Orbit Way',
      trademark: 'ORBIT',
      targetJurisdiction: 'US',
      classes: [9],
      goodsServices: 'Software',
      filingBasis: 'INTENT_TO_USE',
      representativeRequired: true,
      documentReferences: ['document_fixture'],
      commercialScopeUnchanged: true
    });
    const ready = await service.evaluateReadiness(created.matterDraft.matterDraftId);
    expect(ready.matterDraft.status).toBe('READY_FOR_PROFESSIONAL_REVIEW');
    expect(ready.nextAction).toBe('PROFESSIONAL_REVIEW');
    expect(ready.consequences.filingCreated).toBe(false);
  });
});
