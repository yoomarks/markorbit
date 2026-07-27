import { expect, test } from '@playwright/test';
import { intakeDraft, seedMarkreg } from './helpers/markreg.js';
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
