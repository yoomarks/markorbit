import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/preparation-lock-preview.html');
});

test('reviews exact source before creating a current immutable receipt', async ({ page }) => {
  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Preparation Lock' })).toBeVisible();
  await expect(page.getByText('Review before locking')).toBeVisible();
  await expect(page.getByText('document-package_fixture-documents-1476')).toBeVisible();
  await expect(page.getByText('document records', { exact: true })).toBeVisible();
  await expect(page.getByText('instruction entries', { exact: true })).toBeVisible();

  const action = page.getByRole('button', { name: 'Create Preparation Lock' });
  await expect(action).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(action).toBeEnabled();
  await action.click();

  await expect(page.getByText('Locked for preparation — not submitted')).toBeVisible();
  await expect(page.getByText('preparation-lock_fixture-1478')).toBeVisible();
  await expect(page.getByText('Governed Filing Authorization review')).toBeVisible();
  await expect(page.getByLabel('Authority consequences').getByText('No')).toHaveCount(6);
  await expect(page).toHaveURL(/preparationLockId=preparation-lock_fixture-1478/);
});

test('keeps authentication, permission, absence, conflict, validation and outages distinct', async ({
  page
}) => {
  const passive = [
    ['loading', 'Loading exact preparation source'],
    ['unauthorized', 'Sign in required'],
    ['missing', 'Preparation source not found'],
    ['unavailable', 'Preparation Lock service unavailable'],
    ['error', 'Preparation Lock unavailable']
  ] as const;
  for (const [scenario, expected] of passive) {
    await page.goto(`/preparation-lock-preview.html?scenario=${scenario}`);
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
  }

  const active = [
    ['permission', 'Preparation Lock permission denied'],
    ['conflict', 'Preparation source changed'],
    ['validation', 'Package is not ready to lock'],
    ['stale', 'Preparation source changed']
  ] as const;
  for (const [scenario, expected] of active) {
    await page.goto(`/preparation-lock-preview.html?scenario=${scenario}`);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create Preparation Lock' }).click();
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
  }

  await page.goto('/preparation-lock-preview.html?scenario=partial');
  await expect(page.getByText('Unavailable — verify before continuing')).toBeVisible();
  await page.goto('/preparation-lock-preview.html?scenario=locked');
  await expect(page.getByText('Locked for preparation — not submitted')).toBeVisible();
});

test('390px preserves source, boundary, confirmation and action order without overflow', async ({
  page
}) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
  const sourceTop = await page
    .getByRole('heading', { name: 'Exact ready Package' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const freezeTop = await page
    .getByRole('heading', { name: 'What will be frozen' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const boundaryTop = await page
    .getByRole('heading', { name: 'This lock does not' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const confirmationTop = await page
    .getByRole('checkbox')
    .evaluate((element) => element.getBoundingClientRect().top);
  const actionTop = await page
    .getByRole('button', { name: 'Create Preparation Lock' })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(sourceTop).toBeLessThan(freezeTop);
  expect(freezeTop).toBeLessThan(boundaryTop);
  expect(boundaryTop).toBeLessThan(confirmationTop);
  expect(confirmationTop).toBeLessThan(actionTop);
});
