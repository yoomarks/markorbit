import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/content-studio-preview.html');
});

test('triages fixture work without inflating its authority', async ({ page }) => {
  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Content Studio' })).toBeVisible();
  await expect(page.locator('.mo-badge').getByText('Ready for human review')).toBeVisible();
  await expect(page.getByText('Showing 1 of 1 loaded work items.')).toBeVisible();

  await page.getByLabel('Search loaded content work').fill('missing fixture');
  await expect(
    page.getByRole('heading', { name: 'No loaded content work matches this view' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset to needs attention' }).click();
  await expect(page.getByRole('button', { name: 'Open current work' })).toBeVisible();
});

test('moves through review, package preparation and user feedback in memory', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Open current work' });
  await opener.click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Explain evidence-first trademark preparation' })
  ).toBeVisible();
  await expect(page.getByText('Human review is required.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Visual / Media lineage' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Version lineage' })).toBeVisible();

  await page.getByLabel('Review rationale').fill('Fixture review rationale');
  await page.getByRole('button', { name: 'Record Human Review' }).click();
  await expect(page.getByRole('button', { name: 'Prepare PublishPackage' })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare PublishPackage' }).click();
  await expect(page.getByRole('button', { name: 'Used', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Used', exact: true }).click();
  await expect(page.getByText('USER_REPORTED_USED')).toBeVisible();
  await expect(page.getByText(/independently verified by MarkOrbit: No/)).toBeVisible();

  await page.getByRole('button', { name: '← Back to Content Studio' }).click();
  await expect(opener).toBeFocused();
});

test('keeps loading, empty, partial, auth, permission and error states distinct', async ({
  page
}) => {
  await page.goto('/content-studio-preview.html?scenario=loading');
  await expect(page.getByText('Loading Content Studio', { exact: true })).toBeVisible();

  await page.goto('/content-studio-preview.html?scenario=empty');
  await expect(page.getByRole('heading', { name: 'No content work yet' })).toBeVisible();

  await page.goto('/content-studio-preview.html?scenario=partial&view=detail');
  await expect(page.getByText('Visual and media history is partially discoverable')).toBeVisible();
  await expect(page.getByText(/does not mean that no visual work exists/)).toBeVisible();

  await page.goto('/content-studio-preview.html?scenario=unauthorized');
  await expect(page.getByRole('heading', { name: 'Sign in required' })).toBeVisible();

  await page.goto('/content-studio-preview.html?scenario=permission');
  await expect(
    page.getByRole('heading', { name: 'Content Studio permission required' })
  ).toBeVisible();

  await page.goto('/content-studio-preview.html?scenario=error');
  await expect(page.getByRole('heading', { name: 'Content Studio unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Content Studio' })).toBeVisible();
});

test('390px detail remains ordered and free of horizontal overflow', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  await page.goto('/content-studio-preview.html?view=detail');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Explain evidence-first trademark preparation' })
  ).toBeVisible();
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );

  const opportunityTop = await page
    .getByRole('heading', { name: 'Content Opportunity', exact: true })
    .evaluate((element) => element.getBoundingClientRect().top);
  const actionTop = await page
    .getByRole('heading', { name: 'Current owner-permitted action' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const visualTop = await page
    .getByRole('heading', { name: 'Visual / Media lineage' })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(opportunityTop).toBeLessThan(actionTop);
  expect(actionTop).toBeLessThan(visualTop);
});
