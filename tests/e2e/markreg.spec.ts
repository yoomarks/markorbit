import { expect, test } from '@playwright/test';
import {
  intakeDraft,
  installMatterGatewayFixture,
  installPreparationGatewayFixture,
  seedMarkreg
} from './helpers/markreg.js';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  urls,
  watchPage
} from './helpers/page.js';

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
  await expectNoHorizontalOverflow(page);
  await capture(page, `markreg-matter-draft-ready-${testInfo.project.name}`);
  assertHealthy();
});

test('Completed Professional Review reaches an immutable Preparation Lock @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await installPreparationGatewayFixture(page);
  await page.goto(`${urls.markreg}?professionalReviewCaseId=professional-review_e2e011`);
  await expect(page.getByRole('heading', { name: 'Professional Review complete' })).toBeVisible();
  await expect(page.getByText('decision-v11')).toBeVisible();
  await expect(page.getByText('matter-v11')).toBeVisible();
  await page.getByRole('button', { name: 'Open Documents and Instructions' }).click();
  await expect(page.getByRole('heading', { name: 'Documents and Instructions' })).toBeVisible();
  await page.getByRole('button', { name: 'Create Document Package' }).click();
  await expect(page.getByText('Required · Missing').first()).toBeVisible();
  await capture(page, `markreg-documents-missing-${testInfo.project.name}`);
  await page.getByRole('button', { name: 'Record fixture document metadata' }).click();
  await expect(page.getByText(/long-governed-filename/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Evaluate documents' }).click();
  await expect(page.getByText(/UNKNOWN — blocking/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Complete required metadata and reevaluate' }).click();
  await page.getByRole('button', { name: 'Review customer instructions' }).click();
  await expect(page.getByRole('heading', { name: 'Customer Instruction Ledger' })).toBeVisible();
  await expect(page.getByText(/DOCUMENT_USE_AUTHORIZATION · CONFIRMED/)).toBeVisible();
  const acknowledgements = page
    .getByRole('group', { name: 'Confirm the exact preparation instructions' })
    .getByRole('checkbox');
  await expect(acknowledgements).toHaveCount(6);
  for (const checkbox of await acknowledgements.all()) await expect(checkbox).not.toBeChecked();
  const confirm = page.getByRole('button', { name: 'Confirm customer instructions' });
  await expect(confirm).toBeDisabled();
  await acknowledgements.first().focus();
  await expectVisibleFocus(page);
  for (const checkbox of await acknowledgements.all()) await checkbox.click();
  await expect(confirm).toBeEnabled();
  await capture(page, `markreg-instruction-confirmation-${testInfo.project.name}`);
  await confirm.click();
  await page.getByRole('button', { name: 'Lock package for preparation' }).click();
  const receipt = page.getByRole('region', { name: 'Locked for preparation — not submitted' });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByText('preparation-lock_e2e011')).toBeVisible();
  for (const key of [
    'orderCreated',
    'paymentCreated',
    'formalMatterCreated',
    'professionalAppointed',
    'filingCreated',
    'filingSubmitted',
    'customerMessageSent',
    'externalDocumentSent',
    'trademarkOfficeContacted'
  ])
    await expect(receipt.getByText(`${key}:`, { exact: false })).toContainText('false');
  await expectNoHorizontalOverflow(page);
  await capture(page, `markreg-preparation-lock-${testInfo.project.name}`);
  if (testInfo.project.name.startsWith('mobile'))
    await capture(page, 'markreg-preparation-lock-mobile');
  assertHealthy();
});
