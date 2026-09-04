import { expect, test } from '@playwright/test';
import { installDurablePreparationGatewayFixture } from './helpers/durable-preparation.js';
import { intakeDraft, installMatterGatewayFixture, seedMarkreg } from './helpers/markreg.js';
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
  await installDurablePreparationGatewayFixture(page);
  await page.goto(`${urls.markreg}?professionalReviewCaseId=professional-review_e2e011`);
  await expect(page.getByRole('heading', { name: 'Professional Review complete' })).toBeVisible();
  await expect(page.getByText('decision-v11')).toBeVisible();
  await expect(page.getByText('matter-v11')).toBeVisible();
  await page.getByRole('button', { name: 'Open Documents and Instructions' }).click();
  await expect(page.getByRole('heading', { name: 'Documents and Instructions' })).toBeVisible();

  await page.getByRole('button', { name: 'Create durable Document Package' }).click();
  await expect(page.getByText(/Applicant identity evidence.*Missing.*blocking/)).toBeVisible();
  await capture(page, `markreg-documents-missing-${testInfo.project.name}`);

  await page.getByLabel('Requirement').selectOption('APPLICANT_IDENTITY_EVIDENCE');
  await page.getByLabel('Evidence display name').fill('Passport evidence');
  await page.getByLabel('SHA-256 checksum').fill('b'.repeat(64));
  await page.getByLabel('External storage/reference (optional)').fill('vault://passport-e2e011');
  await page.getByRole('button', { name: 'Record evidence metadata' }).click();
  await expect(page.getByText(/Passport evidence.*RECORDED/)).toBeVisible();

  await page.getByRole('button', { name: 'Authorize recorded documents for preparation only' }).click();
  await expect(page.getByText(/Current durable instruction entries:/)).toContainText('1');
  await expect(page.getByText(/does not authorize filing, payment, or external submission/)).toBeVisible();

  const ready = page.getByRole('button', { name: 'Mark package ready for Preparation Lock' });
  await expect(ready).toBeEnabled();
  await ready.click();
  await expect(page.getByText('a'.repeat(64), { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Lock exact package for preparation' }).click();
  await expect(page.getByRole('heading', { name: 'Locked for preparation — not submitted' })).toBeVisible();
  await expect(page.getByText('preparation-lock_e2e011', { exact: true })).toBeVisible();
  await expect(page.getByText('Filing Authorization remains a separate authority step')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review Filing Authorization' })).toBeVisible();
  await expect(page.getByRole('button', { name: /submit/i })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await capture(page, `markreg-preparation-lock-${testInfo.project.name}`);
  if (testInfo.project.name.startsWith('mobile'))
    await capture(page, 'markreg-preparation-lock-mobile');
  assertHealthy();
});