import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/today-workspace-preview.html');
});

test('shows the complete governed Daily Workspace hierarchy', async ({ page }) => {
  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Good morning' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today at a glance' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today Actions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Today's Orbit" })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Worth Revisiting' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Content Picks' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quick Create' })).toBeVisible();
  await expect(page.getByText('external publish executed: No').first()).toBeVisible();
});

test('requires explicit confirmation before completing the bounded owner handoff', async ({
  page
}) => {
  await expect(page.getByRole('note', { name: 'Confirmation effect' })).toContainText(
    'No external publication'
  );
  await page.getByRole('button', { name: 'Confirm and hand off' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Owner handoff completed' })
  ).toBeVisible();
  await expect(page.getByText(/No automatic publication, customer outreach/)).toBeVisible();
  await expect(page.getByText(/Official Truth was created by this handoff/)).toBeVisible();
});

test('records preference and prepares a reuse-first visual brief in memory', async ({ page }) => {
  const save = page.getByRole('button', { name: 'Save' }).first();
  await save.click();
  await expect(page.getByRole('button', { name: 'Saved' }).first()).toBeDisabled();

  await page.getByRole('button', { name: 'Use this angle' }).first().click();
  await expect(page.getByRole('button', { name: 'Selected angle' })).toBeDisabled();
  await page.getByLabel('Governed IP package').fill('MOKI');
  await page.getByRole('button', { name: 'Create Visual Brief' }).click();
  await expect(page.getByText('visual-brief_preview', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Reuse first: Yes · Paid execution authorized by Lite: No/)
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request reuse-first visual' })).toBeVisible();
});

test('keeps loading, empty, partial, auth, permission and error states distinct', async ({
  page
}) => {
  await page.goto('/today-workspace-preview.html?scenario=loading');
  await expect(page.getByText('Loading your Daily Workspace', { exact: true })).toBeVisible();

  await page.goto('/today-workspace-preview.html?scenario=empty');
  await expect(page.getByRole('heading', { name: 'No Today Actions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your Orbit is clear' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No Content Picks yet' })).toBeVisible();

  await page.goto('/today-workspace-preview.html?scenario=partial');
  await expect(
    page.getByRole('status').filter({ hasText: 'Partial or stale context' })
  ).toBeVisible();
  await expect(page.getByText(/exact stored provenance is shown/)).toBeVisible();

  await page.goto('/today-workspace-preview.html?scenario=unauthorized');
  await expect(page.getByRole('heading', { name: 'Daily Workspace access denied' })).toBeVisible();
  await expect(page.getByText('Sign in to open this Daily Workspace.')).toBeVisible();

  await page.goto('/today-workspace-preview.html?scenario=permission');
  await expect(page.getByRole('heading', { name: 'Daily Workspace access denied' })).toBeVisible();
  await expect(page.getByText(/workspace:read permission is required/)).toBeVisible();

  await page.goto('/today-workspace-preview.html?scenario=error');
  await expect(page.getByRole('heading', { name: 'Daily Workspace unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Good morning' })).toBeVisible();
});

test('390px workspace remains ordered and free of horizontal overflow', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');

  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
  const moveTop = await page
    .getByRole('heading', { name: 'Today Actions' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const seeTop = await page
    .getByRole('heading', { name: "Today's Orbit" })
    .evaluate((element) => element.getBoundingClientRect().top);
  const createTop = await page
    .getByRole('heading', { name: 'Content Picks' })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(moveTop).toBeLessThan(seeTop);
  expect(seeTop).toBeLessThan(createTop);
});
