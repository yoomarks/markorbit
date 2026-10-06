import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/recommended-action-preview.html');
});

test('shows governed guidance and never offers execution authority', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'ATLAS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review required action' })).toBeVisible();
  await expect(page.getByText('Execution authority: FALSE')).toBeVisible();
  await expect(page.getByText(/no deadline or urgency has been inferred/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /file|pay|submit|contact/i })).toHaveCount(0);
});

test('acknowledges the exact version without executing an external action', async ({ page }) => {
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(page.getByText('Acknowledged', { exact: true })).toBeVisible();
  await expect(page.getByText('Execution authority: FALSE')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acknowledge' })).toHaveCount(0);
});

test('dismisses only the advisory state', async ({ page }) => {
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText('Dismissed', { exact: true })).toBeVisible();
  await expect(page.getByText(/changes only your advisory state/i)).toBeVisible();
});

test('keeps no-action, empty, unauthorized and unavailable states distinct', async ({ page }) => {
  await page.goto('/recommended-action-preview.html?scenario=no-action');
  await expect(page.getByText('No customer action is currently recommended.')).toBeVisible();
  await page.goto('/recommended-action-preview.html?scenario=empty');
  await expect(page.getByText('No current recommendation is available.')).toBeVisible();
  await expect(page.getByText('No governed lifecycle view has been recorded')).toBeVisible();
  await page.goto('/recommended-action-preview.html?scenario=unauthorized');
  await expect(page.getByText('Access required')).toBeVisible();
  await page.goto('/recommended-action-preview.html?scenario=unavailable');
  await expect(page.getByText('Lifecycle unavailable')).toBeVisible();
});

test('fails stale version closed while preserving current guidance', async ({ page }) => {
  await page.goto('/recommended-action-preview.html?scenario=stale-version');
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(page.getByText('Recommendation not updated')).toBeVisible();
  await expect(page.getByText(/changed in another session/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review required action' })).toBeVisible();
});

test('read-only relationship exposes no enabled transition', async ({ page }) => {
  await page.goto('/recommended-action-preview.html?scenario=read-only');
  await expect(page.getByText(/Read only — this customer relationship/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acknowledge' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
});

test('390px keeps recommendation before lifecycle without horizontal overflow', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  const recommendation = page.getByRole('heading', { name: 'Current recommended action' });
  const lifecycle = page.getByRole('heading', { name: 'Current lifecycle' });
  const positions = await Promise.all([
    recommendation.evaluate((element) => element.getBoundingClientRect().top),
    lifecycle.evaluate((element) => element.getBoundingClientRect().top)
  ]);
  expect(positions[0]).toBeLessThan(positions[1]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
});
