/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Browser route fixtures model public Gateway JSON. */
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

export async function installPreparationGatewayFixture(page: Page) {
  const at = '2026-07-29T12:00:00.000Z';
  const review = {
    schemaVersion: 1,
    reviewCaseId: 'professional-review_e2e011',
    source: {
      schemaVersion: 1,
      matterDraftId: 'matter-draft_e2e011',
      matterDraftVersion: 'matter-v11',
      confirmationId: 'confirmation_e2e011',
      customerId: 'customer_e2e011',
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      preparation: {
        applicantName: 'Northstar International Holdings',
        applicantAddress: '1 Orbit Way',
        trademark: 'NORTHSTAR ORBIT',
        targetJurisdiction: 'US',
        classes: [9, 42],
        goodsServices: `${intakeDraft.goodsServicesSummary} ${'long governed scope '.repeat(12)}`,
        filingBasis: 'INTENT_TO_USE',
        representativeRequired: false,
        documentReferences: [],
        commercialScopeUnchanged: true
      },
      readiness: { evaluatedAt: at, checks: [], readyForProfessionalReview: true },
      readinessTimestamp: at
    },
    status: 'REVIEWED_READY_FOR_NEXT_STEP',
    priority: 'NORMAL',
    requestedBy: 'customer_e2e011',
    createdAt: at,
    updatedAt: at,
    assignment: { status: 'CLAIMED', professionalAppointed: false },
    checklist: [],
    evidence: [],
    decision: {
      code: 'MARK_READY_FOR_NEXT_STEP',
      reviewerId: 'reviewer_e2e011',
      decidedAt: 'decision-v11',
      rationale: 'Ready',
      checklistSnapshot: [],
      evidenceReferences: [],
      sourceMatterDraftVersion: 'matter-v11',
      consequences: {
        orderCreated: false,
        paymentCreated: false,
        formalMatterCreated: false,
        providerAppointed: false,
        filingCreated: false,
        customerMessageSent: false
      }
    }
  };
  const requirements = [
    {
      code: 'APPLICANT_IDENTITY_EVIDENCE',
      name: 'Applicant identity evidence',
      reason: 'Illustrative non-production rule; not authoritative legal advice.',
      source: 'FIXTURE',
      blocking: true,
      fixtureOnly: true
    },
    {
      code: 'MARK_REPRESENTATION_FILE',
      name: 'Mark representation file',
      reason: 'Illustrative non-production rule; not authoritative legal advice.',
      source: 'FIXTURE',
      blocking: true,
      fixtureOnly: true
    }
  ];
  let items: any[] = [],
    evaluated = false,
    complete = false;
  const pkg = () => ({
    schemaVersion: 1,
    documentPackageId: 'document-package_e2e011',
    version: 1 + items.length + Number(evaluated) + Number(complete),
    professionalReviewCaseId: review.reviewCaseId,
    professionalReviewDecisionVersion: 'decision-v11',
    matterDraftId: review.source.matterDraftId,
    matterDraftVersion: 'matter-v11',
    customerConfirmationId: review.source.confirmationId,
    customerId: review.source.customerId,
    jurisdiction: 'US',
    trademarkReference: 'NORTHSTAR ORBIT',
    requirements,
    documentItems: items,
    validationChecks: !evaluated
      ? []
      : requirements.map((r, index) => ({
          code: 'LANGUAGE_IDENTIFIED',
          status: complete ? 'PASS' : 'UNKNOWN',
          blocking: true,
          explanation: complete ? 'Language recorded.' : 'Language metadata is unknown.',
          evidenceReference: items[index]?.documentItemId,
          checkedAt: at,
          source: 'FIXTURE'
        })),
    missingRequirements: items.length ? [] : requirements.map((x) => x.code),
    status: complete ? 'READY_FOR_CUSTOMER_CONFIRMATION' : 'NEEDS_DOCUMENTS',
    createdAt: at,
    updatedAt: at
  });
  let ledger: any;
  await page.route('**/api/lite/professional-review-cases/professional-review_e2e011', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reviewCase: review })
    })
  );
  await page.route('**/api/markreg/document-packages', async (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pkg()) })
  );
  await page.route('**/api/markreg/document-packages/document-package_e2e011', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pkg()) })
  );
  await page.route(
    '**/api/markreg/document-packages/document-package_e2e011/documents',
    async (r) => {
      const input = r.request().postDataJSON() as any;
      const item = {
        documentItemId: `document-item_${items.length + 1}`,
        documentPackageId: 'document-package_e2e011',
        documentType: input.documentType,
        requirementCode: input.requirementCode,
        version: 1,
        status: 'PROVIDED',
        documentReference: input.documentReference,
        suppliedBy: input.suppliedBy,
        suppliedAt: at,
        validationChecks: [],
        createdAt: at,
        updatedAt: at
      };
      items.push(item);
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(item) });
    }
  );
  await page.route(
    '**/api/markreg/document-packages/document-package_e2e011/documents/*',
    async (r) => {
      const id = r.request().url().split('/').pop();
      items = items.map((x) =>
        x.documentItemId === id
          ? {
              ...x,
              documentReference: {
                ...x.documentReference,
                ...(r.request().postDataJSON() as any).documentReference
              }
            }
          : x
      );
      complete = true;
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(items.find((x) => x.documentItemId === id))
      });
    }
  );
  await page.route(
    '**/api/markreg/document-packages/document-package_e2e011/evaluate',
    async (r) => {
      evaluated = true;
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pkg())
      });
    }
  );
  await page.route('**/api/markreg/instruction-ledgers', async (r) => {
    ledger = {
      schemaVersion: 1,
      instructionLedgerId: 'instruction-ledger_e2e011',
      version: 1,
      documentPackageId: 'document-package_e2e011',
      documentPackageVersion: pkg().version,
      customerId: review.source.customerId,
      matterDraftId: review.source.matterDraftId,
      matterDraftVersion: 'matter-v11',
      professionalReviewCaseId: review.reviewCaseId,
      professionalReviewDecisionVersion: 'decision-v11',
      entries: [],
      acknowledgements: [],
      status: 'DRAFT',
      currentEffectiveInstructionSet: {},
      createdAt: at,
      updatedAt: at
    };
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ledger) });
  });
  await page.route(
    '**/api/markreg/instruction-ledgers/instruction-ledger_e2e011/entries',
    async (r) => {
      const entry = {
        instructionEntryId: 'instruction-entry_e2e011',
        type: 'DOCUMENT_USE_AUTHORIZATION',
        structuredValue: { authorized: true },
        status: 'PROPOSED',
        createdAt: at,
        evidence: []
      };
      ledger.entries = [entry];
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(entry)
      });
    }
  );
  await page.route(
    '**/api/markreg/instruction-ledgers/instruction-ledger_e2e011/entries/instruction-entry_e2e011/confirm',
    async (r) => {
      ledger.entries[0] = { ...ledger.entries[0], status: 'CONFIRMED', confirmedAt: at };
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ledger)
      });
    }
  );
  await page.route(
    '**/api/markreg/instruction-ledgers/instruction-ledger_e2e011/confirm',
    async (r) => {
      ledger = {
        ...ledger,
        status: 'CONFIRMED',
        acknowledgements: (r.request().postDataJSON() as any).acknowledgements,
        confirmedAt: at
      };
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ instructionLedger: ledger, consequences: {} })
      });
    }
  );
  await page.route('**/api/markreg/preparation-locks', async (r) => {
    const consequences = {
      orderCreated: false,
      paymentCreated: false,
      formalMatterCreated: false,
      professionalAppointed: false,
      filingCreated: false,
      filingSubmitted: false,
      customerMessageSent: false,
      externalDocumentSent: false,
      trademarkOfficeContacted: false
    };
    await r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        schemaVersion: 1,
        preparationLockId: 'preparation-lock_e2e011',
        documentPackageId: 'document-package_e2e011',
        documentPackageVersion: pkg().version + 1,
        instructionLedgerId: ledger.instructionLedgerId,
        instructionLedgerVersion: ledger.version + 1,
        lockedAt: at,
        snapshot: {
          documentPackage: { ...pkg(), status: 'LOCKED_FOR_PREPARATION' },
          instructionLedger: { ...ledger, status: 'LOCKED_FOR_PREPARATION' },
          sourceReviewDecisionVersion: 'decision-v11',
          sourceMatterDraftVersion: 'matter-v11',
          commercialScopeUnchanged: true
        },
        nextPermittedAction: 'GOVERNED_FILING_AUTHORITY_REVIEW',
        consequences
      })
    });
  });
}
