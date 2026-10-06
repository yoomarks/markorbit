import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/reviewed-source-handoff-preview.html');
});

async function confirmAndDeliver(page: import('@playwright/test').Page) {
  await page.getByLabel(/I confirm this exact admission/).check();
  await page.getByRole('button', { name: 'Deliver to MarkReg lifecycle' }).click();
}

test('records one internal lifecycle event and current view without official truth', async ({
  page
}) => {
  await expect(page.getByRole('heading', { name: 'Reviewed Source Handoff' })).toBeVisible();
  await expect(page.getByText(/reviewed-source-admission_preview-51930/)).toBeVisible();
  await confirmAndDeliver(page);
  await expect(page.getByRole('heading', { name: 'LIFECYCLE PROJECTION RECORDED' })).toBeVisible();
  await expect(page.getByText('lifecycle-event_preview-51930')).toBeVisible();
  await expect(page.getByText('lifecycle-view_preview-51930')).toBeVisible();
  await expect(page.getByText('Not created or executed')).toBeVisible();
  await expect(page.locator('.rsh-result-grid').getByText('false')).toHaveCount(2);
});

test('persists PENDING then retries the same logical handoff to delivery', async ({ page }) => {
  await page.goto('/reviewed-source-handoff-preview.html?scenario=dependency-unavailable');
  await confirmAndDeliver(page);
  await expect(page.getByText('PENDING · RETRY SAFE')).toBeVisible();
  await expect(page.getByText('DEPENDENCY_UNAVAILABLE')).toBeVisible();
  await expect(
    page.getByText('No lifecycle event or Current Lifecycle View was created.')
  ).toBeVisible();
  const stableKey = await page.locator('.rsh-pending dd').nth(2).getAttribute('title');
  await page.getByRole('button', { name: 'Retry same handoff' }).click();
  await expect(page.getByRole('heading', { name: 'LIFECYCLE PROJECTION RECORDED' })).toBeVisible();
  await expect(page.locator('.rsh-delivery-meta').getByText('2', { exact: true })).toBeVisible();
  await expect(page.locator('.rsh-delivery-meta dd').nth(1)).toHaveAttribute(
    'title',
    stableKey ?? ''
  );
});

test('keeps passive owner states distinct and fails partial source closed', async ({ page }) => {
  await page.goto('/reviewed-source-handoff-preview.html?scenario=unavailable');
  await expect(page.getByText('Handoff context unavailable')).toBeVisible();
  await expect(
    page.getByText(/No source, delivery status or lifecycle projection is inferred/)
  ).toBeVisible();
  await page.goto('/reviewed-source-handoff-preview.html?scenario=empty');
  await expect(page.getByText('No reviewed source is ready for handoff')).toBeVisible();
  await page.goto('/reviewed-source-handoff-preview.html?scenario=partial');
  await expect(page.getByText('Source provenance is partial')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deliver to MarkReg lifecycle' })).toBeDisabled();
});

test('fails closed for permission, stale admission and idempotency conflicts', async ({ page }) => {
  await page.goto('/reviewed-source-handoff-preview.html?scenario=permission');
  await confirmAndDeliver(page);
  await expect(page.getByRole('alert').getByText(/lacks review:perform/)).toBeVisible();
  await page.goto('/reviewed-source-handoff-preview.html?scenario=stale-admission');
  await confirmAndDeliver(page);
  await expect(page.getByRole('alert').getByText(/Admission changed/)).toBeVisible();
  await page.goto('/reviewed-source-handoff-preview.html?scenario=idempotency-conflict');
  await confirmAndDeliver(page);
  await expect(page.getByRole('alert').getByText(/Idempotency conflict/)).toBeVisible();
});

test('390px keeps admitted source before command without horizontal overflow', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  const source = page.getByRole('heading', { name: 'Admitted source' });
  const command = page.getByRole('heading', { name: 'Lifecycle projection command' });
  await expect(source).toBeVisible();
  await expect(command).toBeVisible();
  const positions = await Promise.all([
    source.evaluate((element) => element.getBoundingClientRect().top),
    command.evaluate((element) => element.getBoundingClientRect().top)
  ]);
  expect(positions[0]).toBeLessThan(positions[1]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
});
