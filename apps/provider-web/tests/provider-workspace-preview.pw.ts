import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/provider-workspace-preview.html');
});

test('accepts an exact Allocation and records a Provider Return claim', async ({ page }) => {
  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'My work' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Northstar IP/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.getByRole('heading', { name: 'Response required' }).first()).toBeVisible();

  await page
    .getByLabel('Acknowledgement')
    .fill('Capacity and scope reviewed against this exact Allocation.');
  await page.getByRole('button', { name: 'Accept allocation' }).click();
  await expect(page.getByText('Acceptance recorded.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Prepare your Return' })).toBeVisible();

  await page.getByLabel('Evidence references').fill('evidence://madrid-designation/51910');
  await page.getByRole('button', { name: 'Submit Provider Return' }).click();
  await expect(page.getByText('Provider Return recorded by MGSN', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Correct the current claim' })).toBeVisible();
  await expect(page.getByText(/not Official Truth/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /contact client/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /submit filing/i })).toHaveCount(0);
});

test('keeps decline terminal and never silently reallocates', async ({ page }) => {
  await page.getByLabel('Acknowledgement').fill('Current capacity cannot support this scope.');
  await page.getByRole('button', { name: 'Decline allocation' }).click();
  await expect(page.getByText('Decline recorded.', { exact: false })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No Provider action available' }).first()
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Provider Return' })).toHaveCount(0);
  await expect(page.getByText(/replacement Allocation was created/i)).toBeVisible();
});

test('preserves loading, empty, authorization, outage, partial and terminal states', async ({
  page
}) => {
  const passive = [
    ['loading', 'Loading authorized work'],
    ['empty', 'No provider work recorded'],
    ['unauthorized', 'Provider Workspace access required'],
    ['unavailable', 'Owner source temporarily unavailable']
  ] as const;
  for (const [scenario, label] of passive) {
    await page.goto(`/provider-workspace-preview.html?scenario=${scenario}`);
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  await page.goto('/provider-workspace-preview.html?scenario=partial');
  await expect(
    page.getByRole('heading', { name: 'Action lineage unavailable' }).first()
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept allocation' })).toHaveCount(0);

  await page.goto('/provider-workspace-preview.html?scenario=terminal');
  await expect(
    page.getByRole('heading', { name: 'No Provider action available' }).first()
  ).toBeVisible();
  await expect(page.getByText(/history remains readable/i).first()).toBeVisible();
});

test('surfaces permission and exact-version conflict without changing owner truth', async ({
  page
}) => {
  for (const [scenario, message] of [
    ['permission', 'Provider action permission denied'],
    ['conflict', 'Work changed before submission']
  ] as const) {
    await page.goto(`/provider-workspace-preview.html?scenario=${scenario}`);
    await page.getByLabel('Acknowledgement').fill('Explicit human acknowledgement.');
    await page.getByRole('button', { name: 'Accept allocation' }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Response required' }).first()).toBeVisible();
  }
});

test('390px keeps navigation, queue and action detail ordered without horizontal overflow', async ({
  page
}) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
  const queueTop = await page
    .getByRole('heading', { name: 'Work requiring attention' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const detailTop = await page
    .getByText('Governed work detail', { exact: true })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(queueTop).toBeLessThan(detailTop);
  await expect(page.getByRole('navigation', { name: 'Provider navigation' })).toBeVisible();
});
