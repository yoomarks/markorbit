import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/reviewed-source-admission-preview.html');
});

test('records one exact internal admission without starting lifecycle handoff', async ({
  page
}) => {
  await expect(page.getByRole('heading', { name: 'Reviewed Source Admission' })).toBeVisible();
  await expect(page.getByText('evidence-review-decision_preview-51920')).toBeVisible();
  await page.getByLabel(/ATLAS · Madrid designation/).check();
  await page.getByLabel(/I confirm this exact decision/).check();
  await page.getByRole('button', { name: 'Record Reviewed Source Admission' }).click();

  await expect(page.getByRole('heading', { name: 'REVIEWED SOURCE ADMITTED' })).toBeVisible();
  await expect(page.getByText(/reviewed-source-admission_preview-51920/)).toBeVisible();
  await expect(page.getByText('Not started')).toBeVisible();
  await expect(page.getByText('Not created')).toBeVisible();
});

test('keeps correction-required and passive owner states distinct', async ({ page }) => {
  await page.goto('/reviewed-source-admission-preview.html?scenario=nonadmissible');
  await expect(page.getByText('Decision is not admissible')).toBeVisible();
  await expect(page.getByText('Admission controls are unavailable')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record Reviewed Source Admission' })).toHaveCount(
    0
  );

  await page.goto('/reviewed-source-admission-preview.html?scenario=unavailable');
  await expect(page.getByText('Admission context unavailable')).toBeVisible();
  await expect(page.getByText(/No target or admission result is inferred/)).toBeVisible();

  await page.goto('/reviewed-source-admission-preview.html?scenario=empty');
  await expect(page.getByText('No reviewed source is ready for admission')).toBeVisible();
});

test('fails closed for partial context, permission denial and source conflicts', async ({
  page
}) => {
  await page.goto('/reviewed-source-admission-preview.html?scenario=partial');
  await expect(page.getByText('Formal Matter context is partial')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Record Reviewed Source Admission' })
  ).toBeDisabled();

  await page.goto('/reviewed-source-admission-preview.html?scenario=permission');
  await page.getByLabel(/I confirm this exact decision/).check();
  await page.getByRole('button', { name: 'Record Reviewed Source Admission' }).click();
  await expect(page.getByRole('alert').getByText(/lacks review:perform/)).toBeVisible();

  await page.goto('/reviewed-source-admission-preview.html?scenario=decision-conflict');
  await page.getByLabel(/I confirm this exact decision/).check();
  await page.getByRole('button', { name: 'Record Reviewed Source Admission' }).click();
  await expect(page.getByRole('alert').getByText(/Decision changed/)).toBeVisible();

  await page.goto('/reviewed-source-admission-preview.html?scenario=matter-conflict');
  await page.getByLabel(/I confirm this exact decision/).check();
  await page.getByRole('button', { name: 'Record Reviewed Source Admission' }).click();
  await expect(page.getByRole('alert').getByText(/Formal Matter version changed/)).toBeVisible();
});

test('390px preserves source-before-command order without horizontal overflow', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  const source = page.getByRole('heading', { name: 'Decision source' });
  const command = page.getByRole('heading', { name: 'Admission command' });
  await expect(source).toBeVisible();
  await expect(command).toBeVisible();
  const positions = await Promise.all([
    source.evaluate((element) => element.getBoundingClientRect().top),
    command.evaluate((element) => element.getBoundingClientRect().top)
  ]);
  expect(positions[0]).toBeLessThan(positions[1]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
