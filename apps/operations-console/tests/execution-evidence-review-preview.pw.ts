import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/execution-evidence-review-preview.html');
});

test('captures an exact receipt and records an admitted-for-internal-use decision', async ({
  page
}) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Evidence review' })).toBeVisible();
  await expect(page.getByRole('button', { name: /WORK COMPLETED/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.getByRole('button', { name: 'Capture exact review source' }).click();
  await expect(page.getByRole('status').getByText(/evidence-receipt_preview-51910/)).toBeVisible();
  await page
    .getByLabel('Reviewer rationale')
    .fill('The exact receipt and supplied references support bounded internal use.');
  await page.getByRole('button', { name: 'Record immutable review decision' }).click();

  await expect(page.getByText('Decision recorded', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ADMITTED FOR INTERNAL USE' })).toBeVisible();
  await expect(page.getByText('Not created', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /admit reviewed source/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /submit filing/i })).toHaveCount(0);
});

test('creates a separate correction request without mutating the Provider Return', async ({
  page
}) => {
  await page.getByRole('button', { name: /CORRECTION PREPARED/ }).click();
  await page.getByLabel('Request correction').check();
  await page.getByLabel('Reviewer rationale').fill('The evidence needs one bounded correction.');
  await page
    .getByRole('textbox', { name: 'Correction request' })
    .fill('Provide the missing provider receipt reference for this exact Return version.');
  await page.getByRole('button', { name: 'Record immutable review decision' }).click();

  await expect(page.getByRole('heading', { name: 'CORRECTION REQUIRED' })).toBeVisible();
  await expect(page.getByText(/correction-request_preview-51911/)).toBeVisible();
  await expect(page.getByText(/separate governed step/i)).toBeVisible();
});

test('keeps owner passive and partial states distinct', async ({ page }) => {
  const passive = [
    ['loading', 'Loading review queue'],
    ['empty', 'No evidence awaiting review'],
    ['unauthorized', 'Review authority required'],
    ['unavailable', 'Execution evidence source unavailable'],
    ['error', 'Review queue could not be displayed']
  ] as const;
  for (const [scenario, title] of passive) {
    await page.goto(`/execution-evidence-review-preview.html?scenario=${scenario}`);
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  }

  await page.goto('/execution-evidence-review-preview.html?scenario=partial');
  await expect(page.getByText('Evidence projection incomplete', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Capture exact review source' })).toBeDisabled();
});

test('surfaces permission and exact-source conflict without recording a decision', async ({
  page
}) => {
  for (const [scenario, message] of [
    ['permission', 'Review decision permission denied'],
    ['conflict', 'Evidence receipt changed before decision']
  ] as const) {
    await page.goto(`/execution-evidence-review-preview.html?scenario=${scenario}`);
    await page.getByRole('button', { name: 'Capture exact review source' }).click();
    await page.getByLabel('Reviewer rationale').fill('Explicit human review rationale.');
    await page.getByRole('button', { name: 'Record immutable review decision' }).click();
    await expect(page.getByText(new RegExp(message))).toBeVisible();
    await expect(page.getByText('Decision recorded', { exact: true })).toHaveCount(0);
  }
});

test('390px preserves queue-before-detail order without horizontal overflow', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
  const queueTop = await page
    .getByRole('heading', { name: 'Awaiting review' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const detailTop = await page
    .getByRole('heading', { name: 'WORK COMPLETED' })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(queueTop).toBeLessThan(detailTop);
  await expect(page.getByRole('navigation', { name: 'Operations navigation' })).toBeVisible();
});
