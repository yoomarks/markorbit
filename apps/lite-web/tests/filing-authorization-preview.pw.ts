import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/filing-authorization-preview.html');
});

test('reviews exact locked scope and issues a durable non-submission receipt', async ({ page }) => {
  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Filing Authorization' })).toBeVisible();
  await expect(page.getByText('preparation-lock_fixture-1478')).toBeVisible();
  await expect(page.getByText('Northstar Goods Ltd')).toBeVisible();
  await expect(page.getByText('Avery Chen')).toBeVisible();
  await expect(page.getByLabel('Actions not performed').getByText('No')).toHaveCount(6);

  const checks = page.getByRole('checkbox');
  await expect(checks).toHaveCount(9);
  const action = page.getByRole('button', { name: 'Authorize internal execution review' });
  await expect(action).toBeDisabled();
  for (let index = 0; index < 9; index += 1) await checks.nth(index).check();
  await expect(page.getByText('9 / 9')).toBeVisible();
  await expect(action).toBeEnabled();
  await action.click();

  await expect(
    page.getByText('Authorized for internal execution review — not submitted')
  ).toBeVisible();
  await expect(page.getByText('filing-authorization_fixture-1479')).toBeVisible();
  await expect(page.getByText('Separate internal release review', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /submit application/i })).toHaveCount(0);
  await expect(page).toHaveURL(/scenario=authorized/);
});

test('keeps owner errors and governed terminal states distinct', async ({ page }) => {
  const passive = [
    ['loading', 'Loading exact authorization scope'],
    ['unauthorized', 'Sign in required'],
    ['missing', 'Filing Authorization not found'],
    ['unavailable', 'Filing Authorization service unavailable'],
    ['error', 'Filing Authorization unavailable']
  ] as const;
  for (const [scenario, expected] of passive) {
    await page.goto(`/filing-authorization-preview.html?scenario=${scenario}`);
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
  }

  const active = [
    ['permission', 'Filing Authorization permission denied'],
    ['conflict', 'Authorization source changed'],
    ['validation', 'Authorization is incomplete']
  ] as const;
  for (const [scenario, expected] of active) {
    await page.goto(`/filing-authorization-preview.html?scenario=${scenario}`);
    const checks = page.getByRole('checkbox');
    for (let index = 0; index < 9; index += 1) await checks.nth(index).check();
    await page.getByRole('button', { name: 'Authorize internal execution review' }).click();
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
  }

  for (const scenario of ['stale', 'expired', 'withdrawn'] as const) {
    await page.goto(`/filing-authorization-preview.html?scenario=${scenario}`);
    await expect(page.getByText(/no further action permitted/i)).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(0);
  }
  await page.goto('/filing-authorization-preview.html?scenario=partial');
  await expect(page.getByText('None')).toBeVisible();
});

test('390px preserves source, scope, authority, confirmation and action order', async ({
  page
}) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
  const top = async (name: string) =>
    page.getByRole('heading', { name }).evaluate((element) => element.getBoundingClientRect().top);
  const sourceTop = await top('Preparation Lock');
  const scopeTop = await top('Filing subject');
  const authorityTop = await top('Who may authorize what');
  const confirmationsTop = await top('Required confirmations');
  const actionTop = await page
    .getByRole('button', { name: 'Authorize internal execution review' })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(sourceTop).toBeLessThan(scopeTop);
  expect(scopeTop).toBeLessThan(authorityTop);
  expect(authorityTop).toBeLessThan(confirmationsTop);
  expect(confirmationsTop).toBeLessThan(actionTop);
});
