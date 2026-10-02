import { expect, test } from '@playwright/test';

test('direct preview supports the complete morning triage journey', async ({ page }) => {
  await page.goto('/agency-workspace-preview.html');

  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs your attention' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '3 emails need attention' })).toBeVisible();

  await page.getByRole('button', { name: 'Review in Inbox' }).click();
  await expect(
    page.getByRole('heading', { name: /USPTO status and specimen question/ })
  ).toBeVisible();
  await expect(page.getByText('AI suggestion')).toBeVisible();

  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(page.getByText('US Section 8 maintenance')).toBeVisible();
  await page.getByRole('button', { name: 'Create follow-up' }).click();
  await expect(page.getByText(/Follow-up created/)).toBeVisible();
  await page.getByRole('button', { name: 'Prepare client update' }).click();
  await expect(
    page.getByText('This is a draft. Nothing has been sent to the client or outside counsel.')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Today' }).first().click();
  await page.getByRole('button', { name: 'Review change' }).click();
  await expect(page.getByRole('heading', { name: 'NORTHSTAR status change' })).toBeVisible();
  await expect(page.getByText('United States Patent and Trademark Office')).toBeVisible();
  await page.getByRole('button', { name: 'Prepare client update' }).click();
  await expect(
    page.getByText('This is a draft. Nothing has been sent to the client or outside counsel.')
  ).toBeVisible();
});

test('case approval remains visibly separate from filing', async ({ page }) => {
  await page.goto('/agency-workspace-preview.html?surface=cases');
  await page.getByRole('button', { name: 'NORTHSTAR' }).click();

  await expect(page.getByRole('heading', { name: 'Review evidence of use' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ready to file' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve draft' }).click();
  await expect(page.getByText(/It has not been filed/)).toBeVisible();
});

test('queryable negative states stay explicit and fail closed', async ({ page }) => {
  await page.goto('/agency-workspace-preview.html?state=partial');
  await expect(page.getByText('Available records are shown below.')).toBeVisible();

  await page.goto('/agency-workspace-preview.html?state=stale');
  await expect(page.getByRole('status').filter({ hasText: 'Needs refresh' })).toBeVisible();

  await page.goto('/agency-workspace-preview.html?state=permission');
  await expect(
    page.getByRole('heading', { name: 'You do not have access to this view' })
  ).toBeVisible();

  await page.goto('/agency-workspace-preview.html?state=unavailable');
  await expect(
    page.getByRole('heading', { name: 'Some information is unavailable' })
  ).toBeVisible();
});

test('390px preview stays navigable without horizontal page overflow', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  await page.goto('/agency-workspace-preview.html?mobile=1');

  await expect(page.getByRole('navigation', { name: 'Mobile primary navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Inbox', exact: true }).last().click();
  await expect(
    page.getByRole('heading', { name: /USPTO status and specimen question/ })
  ).toBeVisible();
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
});
