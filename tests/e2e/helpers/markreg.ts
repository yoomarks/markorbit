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
      sessionStorage.setItem('markorbit-workspace-id', '11111111-1111-4111-8111-111111111111');
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
    updatedAt: '2026-07-29T12:00:00.000Z',
    version: 1
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
    updatedAt: '2026-07-29T12:00:00.000Z',
    version: 1
  });
  const formalMatter = {
    schemaVersion: 1,
    formalMatterId: 'formal-matter_e2e022',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    kind: 'TRADEMARK_REGISTRATION',
    status: 'OPEN',
    version: 1,
    sourceCustomerConfirmationId: confirmation.confirmationId,
    sourceCustomerConfirmationVersion: 1,
    sourceMatterDraftId: 'matter-draft_e2e',
    sourceMatterDraftVersion: 1,
    sourceQuoteId: 'quote_e2e',
    sourceQuoteVersion: 'quote-v1',
    sourceSnapshot: {},
    snapshotSchemaVersion: 1,
    snapshotSha256: 'a'.repeat(64),
    createdByUserId: 'user_e2e',
    createdAt: '2026-07-29T12:00:00.000Z',
    updatedAt: '2026-07-29T12:00:00.000Z'
  };
  await page.route('**/api/markreg/formal-matters', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ formalMatter, consequences })
    })
  );
  await page.route('**/api/markreg/formal-matters/formal-matter_e2e022', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ formalMatter, consequences })
    })
  );
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
  const at = '2026-09-04T08:00:00.000Z';
  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const review = {
    schemaVersion: 1,
    reviewCaseId: 'professional-review_e2e011',
    version: 11,
    completedAt: at,
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
      requirementKey: 'APPLICANT_IDENTITY_EVIDENCE',
      displayName: 'Applicant identity evidence',
      blocking: true
    }
  ];
  let version = 1;
  let status: 'DRAFT' | 'READY_FOR_PREPARATION_LOCK' = 'DRAFT';
  let documentItems: any[] = [];
  let instructionEntries: any[] = [];
  let canonicalEvidenceHash: string | undefined;
  let completedDecisionHash = '2'.repeat(64);
  let currentLock: any;

  const pkg = () => ({
    schemaVersion: 1,
    documentPackageId: 'document-package_e2e011',
    workspaceId,
    formalMatterId: 'formal-matter_e2e011',
    sourceFormalMatterVersion: 1,
    sourceFormalMatterHash: '1'.repeat(64),
    professionalReviewCaseId: review.reviewCaseId,
    sourceReviewVersion: review.version,
    sourceCompletedDecisionId: review.decision.decidedAt,
    sourceCompletedDecisionHash: completedDecisionHash,
    status,
    version,
    requirements,
    draft: review.source.preparation,
    documentItems,
    instructionEntries,
    createdBy: 'user_e2e011',
    updatedBy: 'user_e2e011',
    createdAt: at,
    updatedAt: at,
    ...(status === 'READY_FOR_PREPARATION_LOCK'
      ? { readyAt: at, readyBy: 'user_e2e011', canonicalEvidenceHash }
      : {})
  });

  const conflict = async (route: any, message: string) =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'VERSION_CONFLICT', message })
    });

  await page.route('**/api/lite/professional-review-cases/professional-review_e2e011', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reviewCase: review })
    })
  );

  await page.route('**/api/markreg/document-packages', async (route) => {
    const input = route.request().postDataJSON() as any;
    if (
      input.professionalReviewCaseId !== review.reviewCaseId ||
      input.expectedReviewVersion !== review.version ||
      input.expectedCompletedDecisionId !== review.decision.decidedAt ||
      typeof input.expectedCompletedDecisionHash !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(input.expectedCompletedDecisionHash)
    )
      return conflict(route, 'Completed Professional Review identity/version mismatch.');
    completedDecisionHash = input.expectedCompletedDecisionHash;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(pkg())
    });
  });

  await page.route('**/api/markreg/document-packages/document-package_e2e011', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pkg()) })
  );

  await page.route(
    '**/api/markreg/document-packages/document-package_e2e011/documents',
    async (route) => {
      const input = route.request().postDataJSON() as any;
      if (input.expectedVersion !== version)
        return conflict(route, 'Document Package version mismatch while recording evidence.');
      const evidence = input.evidence ?? {};
      if (
        evidence.requirementKey !== requirements[0].requirementKey ||
        evidence.verificationStatus !== 'RECORDED' ||
        typeof evidence.checksum !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(evidence.checksum)
      )
        return conflict(route, 'Evidence metadata does not satisfy the durable contract.');
      documentItems = [
        {
          ...evidence,
          documentItemId: 'document-item_e2e011',
          recordedAt: at,
          recordedBy: 'user_e2e011'
        }
      ];
      version += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pkg())
      });
    }
  );

  await page.route(
    '**/api/markreg/document-packages/document-package_e2e011/instructions',
    async (route) => {
      const input = route.request().postDataJSON() as any;
      if (input.expectedVersion !== version)
        return conflict(route, 'Document Package version mismatch while recording instruction.');
      if (
        input.instruction?.instructionType !== 'DOCUMENT_USE_AUTHORIZATION' ||
        input.instruction?.structuredPayload?.authorized !== true
      )
        return conflict(route, 'Preparation-only durable instruction is required.');
      instructionEntries = [
        {
          instructionEntryId: 'instruction-entry_e2e011',
          sequence: 1,
          instructionType: 'DOCUMENT_USE_AUTHORIZATION',
          structuredPayload: input.instruction.structuredPayload,
          canonicalFingerprint: '3'.repeat(64),
          createdAt: at,
          createdBy: 'user_e2e011'
        }
      ];
      version += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pkg())
      });
    }
  );

  await page.route(
    '**/api/markreg/document-packages/document-package_e2e011/mark-ready',
    async (route) => {
      const input = route.request().postDataJSON() as any;
      if (input.expectedVersion !== version)
        return conflict(route, 'Document Package version mismatch while marking ready.');
      if (documentItems.length !== 1 || instructionEntries.length !== 1)
        return conflict(route, 'Durable evidence and preparation instruction are required.');
      status = 'READY_FOR_PREPARATION_LOCK';
      version += 1;
      canonicalEvidenceHash = 'a'.repeat(64);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pkg())
      });
    }
  );

  await page.route('**/api/markreg/preparation-locks', async (route) => {
    const input = route.request().postDataJSON() as any;
    if (
      status !== 'READY_FOR_PREPARATION_LOCK' ||
      input.documentPackageId !== 'document-package_e2e011' ||
      input.expectedDocumentPackageVersion !== version ||
      input.expectedCanonicalEvidenceHash !== canonicalEvidenceHash
    )
      return conflict(route, 'Preparation Lock source version/hash mismatch.');
    currentLock = {
      schemaVersion: 1,
      preparationLockId: 'preparation-lock_e2e011',
      workspaceId,
      version: 1,
      source: {
        documentPackageId: 'document-package_e2e011',
        documentPackageVersion: version,
        canonicalEvidenceHash,
        formalMatterId: 'formal-matter_e2e011',
        formalMatterVersion: 1,
        formalMatterHash: '1'.repeat(64),
        professionalReviewCaseId: review.reviewCaseId,
        reviewVersion: review.version,
        completedDecisionId: review.decision.decidedAt,
        completedDecisionHash,
        instructionEntryCount: 1,
        instructionEntries: [
          {
            instructionEntryId: 'instruction-entry_e2e011',
            sequence: 1,
            canonicalFingerprint: '3'.repeat(64)
          }
        ],
        instructionSetHash: '4'.repeat(64)
      },
      lockPayloadHash: '5'.repeat(64),
      createdBy: 'user_e2e011',
      createdAt: at,
      authority: {
        filingAuthorizationCreated: false,
        executionReleaseCreated: false,
        externalFilingCreated: false,
        paymentCreated: false,
        providerContacted: false,
        officialTruthCreated: false
      }
    };
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(currentLock)
    });
  });

  await page.route('**/api/markreg/preparation-locks/preparation-lock_e2e011', (route) =>
    route.fulfill({
      status: currentLock ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(currentLock ?? { code: 'NOT_FOUND' })
    })
  );
  await page.route(
    '**/api/markreg/preparation-locks/preparation-lock_e2e011/validate-current',
    (route) =>
      route.fulfill({
        status: currentLock ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(currentLock ?? { code: 'NOT_FOUND' })
      })
  );

  return {
    getDocumentPackage: () => pkg(),
    getPreparationLock: () => currentLock
  };
}
