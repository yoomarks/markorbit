import { expect, test, type Page } from '@playwright/test';
import { intakeDraft, installMatterGatewayFixture, seedMarkreg } from './helpers/markreg.js';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  urls,
  watchPage
} from './helpers/page.js';

async function installDurablePreparationBrowserFixture(page: Page) {
  const at = '2026-07-29T12:00:00.000Z';
  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const formalMatterId = 'formal-matter_e2e011';
  const documentPackageId = 'document-package_e2e011';
  const preparationLockId = 'preparation-lock_e2e011';
  const review = {
    schemaVersion: 1,
    reviewCaseId: 'professional-review_e2e011',
    workspaceId,
    formalMatterId,
    sourceFormalMatterVersion: 11,
    sourceSnapshotSha256: 'b'.repeat(64),
    version: 11,
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
    },
    completedAt: at,
    completedBy: 'reviewer_e2e011'
  };
  const requirements = [
    {
      requirementKey: 'APPLICANT_IDENTITY_EVIDENCE',
      displayName: 'Applicant identity evidence',
      blocking: true
    },
    {
      requirementKey: 'MARK_REPRESENTATION_FILE',
      displayName: 'Mark representation file',
      blocking: true
    }
  ];
  let version = 1;
  let status: 'DRAFT' | 'READY_FOR_PREPARATION_LOCK' = 'DRAFT';
  let documentItems: Record<string, unknown>[] = [];
  let instructionEntries: Record<string, unknown>[] = [];
  let canonicalEvidenceHash: string | undefined;

  const packageView = () => ({
    documentPackageId,
    workspaceId,
    formalMatterId,
    sourceFormalMatterVersion: 11,
    sourceFormalMatterHash: 'b'.repeat(64),
    professionalReviewCaseId: review.reviewCaseId,
    sourceReviewVersion: review.version,
    sourceCompletedDecisionId: review.decision.decidedAt,
    sourceCompletedDecisionHash: 'd'.repeat(64),
    status,
    version,
    schemaVersion: 1,
    requirements,
    draft: review.source.preparation,
    documentItems,
    instructionEntries,
    createdBy: 'user_e2e',
    updatedBy: 'user_e2e',
    createdAt: at,
    updatedAt: at,
    ...(status === 'READY_FOR_PREPARATION_LOCK'
      ? { readyAt: at, readyBy: 'user_e2e', canonicalEvidenceHash }
      : {})
  });

  const lockView = () => ({
    schemaVersion: 1,
    preparationLockId,
    workspaceId,
    version: 1,
    source: {
      documentPackageId,
      documentPackageVersion: version,
      canonicalEvidenceHash: canonicalEvidenceHash ?? 'c'.repeat(64),
      formalMatterId,
      formalMatterVersion: 11,
      formalMatterHash: 'b'.repeat(64),
      professionalReviewCaseId: review.reviewCaseId,
      reviewVersion: review.version,
      completedDecisionId: review.decision.decidedAt,
      completedDecisionHash: 'd'.repeat(64),
      instructionEntryCount: instructionEntries.length,
      instructionEntries: instructionEntries.map((entry, index) => ({
        instructionEntryId: String(entry.instructionEntryId),
        sequence: index + 1,
        canonicalFingerprint: String(entry.canonicalFingerprint)
      })),
      instructionSetHash: 'f'.repeat(64)
    },
    lockPayloadHash: 'a'.repeat(64),
    createdBy: 'user_e2e',
    createdAt: at,
    authority: {
      filingAuthorizationCreated: false,
      executionReleaseCreated: false,
      externalFilingCreated: false,
      paymentCreated: false,
      providerContacted: false,
      officialTruthCreated: false
    }
  });

  await page.route('**/api/lite/professional-review-cases/professional-review_e2e011', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reviewCase: review })
    })
  );
  await page.route('**/api/markreg/document-packages', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(packageView())
    })
  );
  await page.route(`**/api/markreg/document-packages/${documentPackageId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(packageView())
    })
  );
  await page.route(
    `**/api/markreg/document-packages/${documentPackageId}/documents`,
    async (route) => {
      const input = route.request().postDataJSON() as {
        expectedVersion: number;
        evidence: {
          requirementKey: string;
          documentType: string;
          displayName: string;
          evidenceType: string;
          checksum: string;
          verificationStatus: string;
        };
      };
      expect(input.expectedVersion).toBe(version);
      documentItems = [
        ...documentItems.filter((item) => item.requirementKey !== input.evidence.requirementKey),
        {
          documentItemId: `document-item_${input.evidence.requirementKey.toLowerCase()}`,
          requirementKey: input.evidence.requirementKey,
          documentType: input.evidence.documentType,
          displayName: input.evidence.displayName,
          evidenceType: input.evidence.evidenceType,
          checksum: input.evidence.checksum,
          verificationStatus: input.evidence.verificationStatus
        }
      ];
      version += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(packageView())
      });
    }
  );
  await page.route(
    `**/api/markreg/document-packages/${documentPackageId}/instructions`,
    async (route) => {
      const input = route.request().postDataJSON() as {
        expectedVersion: number;
        instruction: { instructionType: string; structuredPayload: Record<string, unknown> };
      };
      expect(input.expectedVersion).toBe(version);
      instructionEntries = [
        {
          instructionEntryId: 'instruction-entry_e2e011',
          sequence: 1,
          instructionType: input.instruction.instructionType,
          structuredPayload: input.instruction.structuredPayload,
          canonicalFingerprint: 'e'.repeat(64)
        }
      ];
      version += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(packageView())
      });
    }
  );
  await page.route(
    `**/api/markreg/document-packages/${documentPackageId}/mark-ready`,
    async (route) => {
      const input = route.request().postDataJSON() as { expectedVersion: number };
      expect(input.expectedVersion).toBe(version);
      expect(documentItems).toHaveLength(requirements.length);
      expect(instructionEntries).toHaveLength(1);
      version += 1;
      status = 'READY_FOR_PREPARATION_LOCK';
      canonicalEvidenceHash = 'c'.repeat(64);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(packageView())
      });
    }
  );
  await page.route('**/api/markreg/preparation-locks', async (route) => {
    const input = route.request().postDataJSON() as {
      documentPackageId: string;
      expectedDocumentPackageVersion: number;
      expectedCanonicalEvidenceHash: string;
    };
    expect(input.documentPackageId).toBe(documentPackageId);
    expect(input.expectedDocumentPackageVersion).toBe(version);
    expect(input.expectedCanonicalEvidenceHash).toBe(canonicalEvidenceHash);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lockView())
    });
  });
  await page.route(
    `**/api/markreg/preparation-locks/${preparationLockId}/validate-current`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(lockView())
      })
  );
}

test('Consultation start and Applicant fields are usable @visual', async ({ page }, testInfo) => {
  const assertHealthy = watchPage(page);
  await page.goto(urls.markreg);
  await expect(
    page.getByRole('heading', { name: 'Plan your international trademark protection' })
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('not legal advice');
  await expect(page.getByRole('button', { name: 'Start consultation' })).toBeVisible();
  if (testInfo.project.name.startsWith('desktop')) {
    await capture(page, 'markreg-consultation-desktop');
  }
  await page.getByRole('button', { name: 'Start consultation' }).click();
  await expect(
    page.getByRole('list', { name: 'Progress' }).locator('[aria-current="step"]')
  ).toContainText('Applicant');
  await page.getByLabel('Applicant type').selectOption({ label: 'Company' });
  await page.getByLabel('Applicant name').fill(intakeDraft.applicantName);
  await page.getByLabel('Applicant country').selectOption('GB');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectVisibleFocus(page);
  assertHealthy();
});

test('Review keeps long fixture data within the viewport', async ({ page }) => {
  const assertHealthy = watchPage(page);
  await seedMarkreg(page, 'review');
  await page.goto(urls.markreg);
  for (let step = 0; step < 5; step++) await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Review your intake' })).toBeVisible();
  await expect(page.getByText(intakeDraft.applicantName, { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit intake' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertHealthy();
});

test('Recommendation exposes A/B/C, warnings and mobile-safe actions @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await seedMarkreg(page, 'recommendation');
  await page.goto(urls.markreg);
  await expect(
    page.getByRole('heading', { name: 'Compare your protection options' })
  ).toBeVisible();
  for (const option of ['A', 'B', 'C'])
    await expect(page.getByText(option, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('FIXTURE_ONLY')).toBeVisible();
  await expect(page.getByText(/not legal advice/i).first()).toBeVisible();
  const choose = page.getByRole('button', { name: 'Choose this option' }).first();
  await expect(choose).toBeVisible();
  await choose.click();
  await expect(page.getByRole('button', { name: 'Select plan A' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  await capture(page, `markreg-recommendation-${viewport}`);
  assertHealthy();
});

test('Recoverable and blocking errors render safe states', async ({ page }) => {
  const assertHealthy = watchPage(page, { expectedHttpErrors: true });
  await seedMarkreg(page, 'review');
  await page.route('**/v1/markreg/intakes', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Please try again.', retryable: true })
    });
  });
  await page.goto(urls.markreg);
  for (let step = 0; step < 5; step++) await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Submit intake' }).click();
  await expect(page.getByRole('heading', { name: 'Your answers are safe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

  await page.route('**/v1/markreg/intakes', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Request cannot continue.' })
    });
  });
  await page.getByRole('button', { name: 'Review information' }).click();
  await page.getByRole('button', { name: 'Submit intake' }).click();
  await expect(page.getByRole('heading', { name: 'Consultation cannot continue' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertHealthy();
});

test('Customer Confirmation to ready Matter Draft remains preparatory @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await seedMarkreg(page, 'recommendation');
  await installMatterGatewayFixture(page);
  await page.goto(urls.markreg);
  await page.getByRole('button', { name: 'Choose this option' }).nth(1).click();
  await page.getByRole('button', { name: 'Select plan B and request quote' }).click();
  await expect(page.getByRole('heading', { name: 'Customer Confirmation' })).toBeVisible();
  await expect(page.getByText('quote_e2e', { exact: true })).toBeVisible();
  const confirmations = page
    .getByRole('group', { name: 'Required acknowledgements' })
    .getByRole('checkbox');
  await expect(confirmations).toHaveCount(4);
  for (const checkbox of await confirmations.all()) await expect(checkbox).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Confirm selected Quote' })).toBeDisabled();
  await confirmations.first().focus();
  for (const checkbox of await confirmations.all()) await checkbox.check();
  await expect(page.getByRole('button', { name: 'Confirm selected Quote' })).toBeEnabled();
  await expectVisibleFocus(page);
  if (testInfo.project.name.startsWith('desktop'))
    await capture(page, 'markreg-confirmation-acknowledgements');
  await page.getByRole('button', { name: 'Confirm selected Quote' }).click();
  const confirmationReceipt = page.getByRole('region', { name: 'Confirmation receipt' });
  await expect(confirmationReceipt).toBeVisible();
  for (const label of [
    'Order created',
    'Payment created',
    'Professional appointed',
    'Filing created'
  ]) {
    const consequence = confirmationReceipt.getByRole('listitem').filter({ hasText: label });
    await expect(consequence).toHaveCount(1);
    await expect(consequence.getByText('No', { exact: true })).toBeVisible();
  }
  await capture(page, `markreg-confirmation-receipt-${testInfo.project.name}`);
  await page.getByRole('button', { name: 'Prepare Matter Draft' }).click();
  await expect(
    page.getByRole('heading', { name: 'Matter Draft preparation workspace' })
  ).toBeVisible();
  await expect(page.getByText('APPLICANT_IDENTITY_PRESENT', { exact: true }).first()).toBeVisible();
  if (testInfo.project.name.startsWith('desktop'))
    await capture(page, 'markreg-matter-draft-incomplete');
  await page.getByLabel('Applicant / Owner').fill('Northstar Ltd');
  await page.getByLabel('Applicant address').fill('1 Orbit Way');
  await page.getByLabel('Trademark representation').fill('NORTHSTAR ORBIT');
  await page.getByLabel('Target jurisdiction').selectOption('US');
  await page.getByLabel('Classes').fill('9, 42');
  await page
    .getByLabel('Goods / services')
    .fill(`${intakeDraft.goodsServicesSummary} ${'Long governed description '.repeat(15)}`);
  await page.getByLabel('Filing basis').fill('INTENT_TO_USE');
  await page.getByLabel('Representative requirement').selectOption('true');
  await page.getByLabel('Required documents').fill('document_e2e');
  await page.getByLabel('Commercial scope remains unchanged').check();
  const readinessRegion = page.getByRole('region', { name: 'Readiness checks' });
  const prepareButton = page.getByRole('button', { name: 'Prepare for professional review' });
  await expect(prepareButton).toBeVisible();
  await prepareButton.scrollIntoViewIfNeeded();
  await expect(prepareButton).toBeInViewport();
  const readinessBox = await readinessRegion.boundingBox();
  const actionBox = await prepareButton.boundingBox();
  if (readinessBox === null || actionBox === null)
    throw new Error('Readiness or action layout is unavailable.');
  expect(actionBox.y).toBeGreaterThanOrEqual(readinessBox.y + readinessBox.height);
  await prepareButton.click();
  await expect(page.getByText('Ready for professional review', { exact: true })).toBeVisible();
  await expect(page.getByText(/Readiness is not approval/)).toBeVisible();
  const createFormalMatter = page.getByRole('button', { name: 'Create Formal Matter' });
  await expect(createFormalMatter).toBeVisible();
  await createFormalMatter.click();
  const formalReceipt = page.getByRole('region', { name: 'Formal Matter receipt' });
  await expect(formalReceipt).toBeVisible();
  await expect(formalReceipt.getByText('formal-matter_e2e022', { exact: true })).toBeVisible();
  await expect(formalReceipt.getByText(/matter-draft_e2e · version 1/)).toBeVisible();
  await expect(formalReceipt.getByText(/confirmation_e2e · version 1/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Formal Matter receipt' })).toContainText(
    'formal-matter_e2e022'
  );
  await expect(page.getByRole('region', { name: 'Formal Matter receipt' })).toContainText(
    'matter-draft_e2e · version 1'
  );
  await expectNoHorizontalOverflow(page);
  await capture(page, `markreg-formal-matter-receipt-${testInfo.project.name}`);
  assertHealthy();
});

test('Completed Professional Review reaches an immutable Preparation Lock @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await installDurablePreparationBrowserFixture(page);
  await page.goto(`${urls.markreg}?professionalReviewCaseId=professional-review_e2e011`);
  await expect(page.getByRole('heading', { name: 'Professional Review complete' })).toBeVisible();
  await expect(page.getByText('decision-v11')).toBeVisible();
  await expect(page.getByText('matter-v11')).toBeVisible();
  await page.getByRole('button', { name: 'Open Documents and Instructions' }).click();
  await expect(page.getByRole('heading', { name: 'Documents and Instructions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Document Package' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create durable Document Package' }).click();
  await expect(page.getByText(/Applicant identity evidence.*Missing.*blocking/)).toBeVisible();
  await capture(page, `markreg-documents-missing-${testInfo.project.name}`);

  for (const evidence of [
    {
      requirementKey: 'APPLICANT_IDENTITY_EVIDENCE',
      displayName: 'Applicant identity evidence — durable fixture',
      checksum: '1'.repeat(64)
    },
    {
      requirementKey: 'MARK_REPRESENTATION_FILE',
      displayName: 'Mark representation file — durable fixture',
      checksum: '2'.repeat(64)
    }
  ]) {
    await page.getByLabel('Requirement').selectOption(evidence.requirementKey);
    await page.getByLabel('Evidence display name').fill(evidence.displayName);
    await page.getByLabel('SHA-256 checksum').fill(evidence.checksum);
    await page.getByRole('button', { name: 'Record evidence metadata' }).click();
    await expect(
      page.getByText(`${evidence.displayName} · RECORDED`, { exact: false })
    ).toBeVisible();
  }

  await page
    .getByRole('button', { name: 'Authorize recorded documents for preparation only' })
    .click();
  await expect(page.getByText(/Current durable instruction entries:/)).toContainText('1');
  const ready = page.getByRole('button', { name: 'Mark package ready for Preparation Lock' });
  await expect(ready).toBeEnabled();
  await ready.click();
  await expect(page.getByText('READY_FOR_PREPARATION_LOCK', { exact: true })).toBeVisible();
  await expect(page.getByText('c'.repeat(64), { exact: true })).toBeVisible();
  await capture(page, `markreg-durable-preparation-ready-${testInfo.project.name}`);

  await page.getByRole('button', { name: 'Lock exact package for preparation' }).click();
  await expect(
    page.getByRole('heading', { name: 'Locked for preparation — not submitted' })
  ).toBeVisible();
  await expect(page.getByText('preparation-lock_e2e011', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Filing Authorization remains a separate authority step', { exact: true })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review Filing Authorization' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, `markreg-preparation-lock-${testInfo.project.name}`);
  if (testInfo.project.name.startsWith('mobile'))
    await capture(page, 'markreg-preparation-lock-mobile');
  assertHealthy();
});
