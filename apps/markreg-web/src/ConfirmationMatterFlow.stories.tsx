import type { Meta, StoryObj } from '@storybook/react';
import type { CustomerConfirmation, MatterDraft, PlanQuoteResponse } from '@markorbit/contracts';
import { ConfirmationMatterFlow, type MatterViewState } from './ConfirmationMatterFlow.js';
import type { MarkregClient } from './api/markreg.js';
const now = '2026-07-29T12:00:00.000Z';
const quote: PlanQuoteResponse = {
  planSelection: {
    planSelectionId: 'plan_story',
    intakeId: 'intake_story',
    recommendationId: 'recommendation_story',
    selectedOptionCode: 'B',
    selectedAt: now
  },
  quote: {
    quoteId: 'quote_story',
    intakeId: 'intake_story',
    recommendationId: 'recommendation_story',
    selectedOptionCode: 'B',
    pricingRuleVersion: 'quote-v1',
    status: 'READY',
    currency: 'USD',
    lines: [
      {
        code: 'SERVICE',
        description: 'Professional service estimate',
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
    validUntil: '2026-08-30T00:00:00.000Z',
    fixtureOnly: true,
    createdAt: now
  }
};
const acknowledgements = (
  [
    'NO_FILING',
    'NO_PROFESSIONAL_APPOINTMENT',
    'REVIEW_MAY_BE_REQUIRED',
    'SCOPE_CHANGE_REQUOTE'
  ] as const
).map((code) => ({ code, acknowledged: true as const, acknowledgedAt: now }));
const confirmation: CustomerConfirmation = {
  schemaVersion: 1,
  confirmationId: 'confirmation_story',
  customerId: 'customer_story',
  quoteSnapshot: {
    quoteId: 'quote_story',
    quoteVersion: 'quote-v1',
    planId: 'plan_story',
    planVersion: 'plan-v1',
    currency: 'USD',
    totalMinor: 90000,
    lineItems: quote.quote.lines
  },
  confirmedBy: 'actor_story',
  confirmedAt: now,
  termsVersion: 'terms-v1',
  acknowledgements,
  status: 'CONFIRMED',
  createdAt: now,
  updatedAt: now
};
const check = (
  code: MatterDraft['readiness']['checks'][number]['code'],
  status: 'PASS' | 'FAIL' | 'UNKNOWN'
) => ({ code, status, explanation: `${code} evidence result.`, blocking: true });
const draft: MatterDraft = {
  schemaVersion: 1,
  matterDraftId: 'matter-draft_story',
  confirmationId: confirmation.confirmationId,
  customerId: 'customer_story',
  preparation: { classes: [], documentReferences: [] },
  instructionCompleteness: 'INCOMPLETE',
  documentReadiness: 'MISSING',
  readiness: {
    evaluatedAt: now,
    readyForProfessionalReview: false,
    checks: [
      check('APPLICANT_IDENTITY_PRESENT', 'FAIL'),
      check('FILING_BASIS_PRESENT_OR_NOT_REQUIRED', 'UNKNOWN')
    ]
  },
  missingInformation: ['APPLICANT_IDENTITY_PRESENT', 'FILING_BASIS_PRESENT_OR_NOT_REQUIRED'],
  status: 'NEEDS_INFORMATION',
  createdAt: now,
  updatedAt: now
};
const ready: MatterDraft = {
  ...draft,
  preparation: {
    applicantName: 'Orbit Ltd',
    applicantAddress: '1 Orbit Way',
    trademark: 'ORBIT',
    targetJurisdiction: 'US',
    classes: [9],
    goodsServices: 'Software services',
    filingBasis: 'INTENT_TO_USE',
    representativeRequired: true,
    documentReferences: ['document_story'],
    commercialScopeUnchanged: true
  },
  instructionCompleteness: 'COMPLETE',
  documentReadiness: 'READY',
  readiness: {
    evaluatedAt: now,
    readyForProfessionalReview: true,
    checks: [check('APPLICANT_IDENTITY_PRESENT', 'PASS')]
  },
  missingInformation: [],
  status: 'READY_FOR_PROFESSIONAL_REVIEW'
};
const client: MarkregClient = {
  createIntake: () => Promise.reject(new Error()),
  createCustomerConfirmation: () =>
    Promise.resolve({
      confirmation,
      nextAction: 'PREPARE_MATTER_DRAFT',
      consequences: {
        orderCreated: false,
        paymentCreated: false,
        professionalAppointed: false,
        filingCreated: false
      }
    }),
  createMatterDraft: () =>
    Promise.resolve({
      matterDraft: draft,
      consequences: {
        orderCreated: false,
        paymentCreated: false,
        professionalAppointed: false,
        filingCreated: false
      }
    }),
  updateMatterDraft: () =>
    Promise.resolve({
      matterDraft: ready,
      consequences: {
        orderCreated: false,
        paymentCreated: false,
        professionalAppointed: false,
        filingCreated: false
      }
    }),
  evaluateMatterDraft: () =>
    Promise.resolve({
      matterDraft: ready,
      consequences: {
        orderCreated: false,
        paymentCreated: false,
        professionalAppointed: false,
        filingCreated: false
      }
    })
};
export default {
  title: 'Products/MarkReg/Customer confirmation and Matter Draft',
  component: ConfirmationMatterFlow,
  args: { quote, client },
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof ConfirmationMatterFlow>;
type Story = StoryObj<typeof ConfirmationMatterFlow>;
const fixture = (state: MatterViewState, value: MatterDraft = draft): Story => ({
  args: { fixture: { state, confirmation, draft: value } }
});
export const QuoteReadyForConfirmation: Story = fixture('QUOTE_REVIEW');
export const AcknowledgementsIncomplete: Story = fixture('QUOTE_REVIEW');
export const AcknowledgementsComplete: Story = fixture('QUOTE_REVIEW');
export const ConfirmationSubmitting: Story = fixture('CONFIRMING');
export const ConfirmationReceipt: Story = fixture('CONFIRMATION_RECEIPT');
export const WithdrawnConfirmation: Story = fixture('WITHDRAWN');
export const MatterDraftLoading: Story = fixture('MATTER_DRAFT_LOADING');
export const MatterDraftIncomplete: Story = fixture('MATTER_DRAFT_NEEDS_INFORMATION');
export const BlockingFail: Story = fixture('MATTER_DRAFT_NEEDS_INFORMATION');
export const BlockingUnknown: Story = fixture('MATTER_DRAFT_NEEDS_INFORMATION');
export const ReadyForProfessionalReview: Story = fixture('READY_FOR_PROFESSIONAL_REVIEW', ready);
export const StaleState: Story = fixture('MATTER_DRAFT_EDITING');
export const RecoverableError: Story = {
  args: {
    fixture: { state: 'RECOVERABLE_ERROR', message: 'The Gateway is temporarily unavailable.' }
  }
};
export const LongGoodsServices: Story = fixture('MATTER_DRAFT_EDITING', {
  ...draft,
  preparation: {
    ...draft.preparation,
    goodsServices: 'Software and professional services '.repeat(40)
  }
});
export const Mobile390: Story = {
  ...fixture('MATTER_DRAFT_NEEDS_INFORMATION'),
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};
