import type { Page } from '@playwright/test';

export const intakeDraft = {
  applicantType: 'Company',
  applicantName: 'Northstar International Holdings with an intentionally long applicant name',
  applicantCountry: 'GB',
  trademarkType: 'Word mark',
  trademarkText: 'NORTHSTAR ORBIT',
  targetCountries: ['US', 'GB', 'EU'],
  goodsServicesSummary:
    'Software, professional services, education, and a long description used to validate responsive wrapping without breaking the page layout.',
  businessContext: 'An established company preparing a cautious international launch.',
  filingGoal: 'Compare practical protection scopes before seeking professional review.'
};

export const recommendation = {
  intake: {
    intakeId: 'intake_e2e',
    channel: 'MARKREG_DIRECT',
    relationshipModel: 'DIRECT',
    status: 'RECOMMENDATION_READY',
    customerIntent: {
      brandName: intakeDraft.trademarkText,
      applicantCountry: intakeDraft.applicantCountry,
      targetJurisdictions: intakeDraft.targetCountries,
      goodsServicesDescription: intakeDraft.goodsServicesSummary
    },
    createdAt: '2026-07-27T00:00:00.000Z',
    correlationId: 'correlation_e2e'
  },
  recommendation: {
    recommendationId: 'recommendation_e2e',
    intakeId: 'intake_e2e',
    status: 'FIXTURE_ONLY',
    options: [
      { tier: 'A', name: 'Essential Protection', description: 'A focused starting point.' },
      { tier: 'B', name: 'Recommended Protection', description: 'Balanced coverage.' },
      { tier: 'C', name: 'Extended Protection', description: 'Broader planning coverage.' }
    ],
    rationale: 'Compares scope against the supplied markets and goal.',
    assumptions: ['The supplied applicant details are accurate.'],
    limitations: ['No clearance search or professional review has been performed.'],
    provenance: ['execution_e2e'],
    generatedAt: '2026-07-27T00:00:00.000Z'
  },
  trace: {
    correlationId: 'correlation_e2e',
    capabilityRequestId: 'capability_e2e',
    executionId: 'execution_e2e',
    provenanceRefs: ['execution_e2e']
  }
};
export const quote = {
  planSelection: {
    planSelectionId: 'plan_e2e',
    intakeId: 'intake_e2e',
    recommendationId: 'recommendation_e2e',
    selectedOptionCode: 'B',
    selectedAt: '2026-07-29T00:00:00.000Z'
  },
  quote: {
    quoteId: 'quote_e2e',
    intakeId: 'intake_e2e',
    recommendationId: 'recommendation_e2e',
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
    validUntil: '2026-08-29T00:00:00.000Z',
    fixtureOnly: true,
    createdAt: '2026-07-29T00:00:00.000Z'
  }
};

export async function seedMarkreg(page: Page, state: 'applicant' | 'review' | 'recommendation') {
  await page.addInitScript(
    ({ draft, result, target }) => {
      if (target !== 'applicant')
        sessionStorage.setItem('markreg-guided-intake-v1', JSON.stringify(draft));
      if (target === 'recommendation')
        sessionStorage.setItem('markreg-recommendation-v1', JSON.stringify(result));
    },
    { draft: intakeDraft, result: recommendation, target: state }
  );
}

export async function installMatterGatewayFixture(page: Page) {
  let preparation: Record<string, unknown> = { classes: [], documentReferences: [] };
  const confirmation = {
    schemaVersion: 1,
    confirmationId: 'confirmation_e2e',
    customerId: 'customer_markreg',
    quoteSnapshot: {
      quoteId: 'quote_e2e',
      quoteVersion: 'quote-v1',
      planId: 'plan_e2e',
      planVersion: 'plan-v1',
      currency: 'USD',
      totalMinor: 90000,
      lineItems: quote.quote.lines
    },
    confirmedBy: 'actor_markreg',
    confirmedAt: '2026-07-29T12:00:00.000Z',
    termsVersion: 'terms-v1',
    acknowledgements: [
      'NO_FILING',
      'NO_PROFESSIONAL_APPOINTMENT',
      'REVIEW_MAY_BE_REQUIRED',
      'SCOPE_CHANGE_REQUOTE'
    ].map((code) => ({ code, acknowledged: true, acknowledgedAt: '2026-07-29T12:00:00.000Z' })),
    status: 'CONFIRMED',
    createdAt: '2026-07-29T12:00:00.000Z',
    updatedAt: '2026-07-29T12:00:00.000Z'
  };
  const consequences = {
    orderCreated: false,
    paymentCreated: false,
    professionalAppointed: false,
    filingCreated: false
  };
  const checks = (ready: boolean) =>
    [
      'CUSTOMER_CONFIRMATION_VALID',
      'APPLICANT_IDENTITY_PRESENT',
      'APPLICANT_ADDRESS_PRESENT',
      'MARK_REPRESENTATION_PRESENT',
      'JURISDICTION_SELECTED',
      'CLASS_SELECTION_PRESENT',
      'GOODS_SERVICES_PRESENT',
      'FILING_BASIS_PRESENT_OR_NOT_REQUIRED',
      'REPRESENTATIVE_REQUIREMENT_EVALUATED',
      'REQUIRED_DOCUMENTS_PRESENT',
      'COMMERCIAL_SCOPE_UNCHANGED'
    ].map((code) => ({
      code,
      status: ready
        ? 'PASS'
        : code.includes('FILING_BASIS') || code.includes('REPRESENTATIVE')
          ? 'UNKNOWN'
          : 'FAIL',
      explanation: `${code} requires explicit evidence.`,
      blocking: true
    }));
  const draft = (ready = false) => ({
    schemaVersion: 1,
    matterDraftId: 'matter-draft_e2e',
    confirmationId: confirmation.confirmationId,
    customerId: confirmation.customerId,
    preparation,
    instructionCompleteness: ready ? 'COMPLETE' : 'INCOMPLETE',
    documentReadiness: ready ? 'READY' : 'MISSING',
    readiness: {
      evaluatedAt: '2026-07-29T12:00:00.000Z',
      checks: checks(ready),
      readyForProfessionalReview: ready
    },
    missingInformation: ready
      ? []
      : checks(false)
          .filter((x) => x.status !== 'PASS')
          .map((x) => x.code),
    status: ready ? 'READY_FOR_PROFESSIONAL_REVIEW' : 'NEEDS_INFORMATION',
    createdAt: '2026-07-29T12:00:00.000Z',
    updatedAt: '2026-07-29T12:00:00.000Z'
  });
  await page.route('**/v1/markreg/quotes', (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(quote) })
  );
  await page.route('**/api/markreg/customer-confirmations', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ confirmation, nextAction: 'PREPARE_MATTER_DRAFT', consequences })
    })
  );
  await page.route('**/api/markreg/matter-drafts', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ matterDraft: draft(), consequences })
    })
  );
  await page.route('**/api/markreg/matter-drafts/matter-draft_e2e', async (route) => {
    if (route.request().method() === 'PATCH')
      preparation = { ...preparation, ...(route.request().postDataJSON() as object) };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ matterDraft: draft(), consequences })
    });
  });
  await page.route('**/api/markreg/matter-drafts/matter-draft_e2e/evaluate-readiness', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ matterDraft: draft(true), consequences })
    })
  );
}
