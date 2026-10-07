import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/capability-reflection-preview.html');
});

test('reviews exact evidence and accepts one private reflection', async ({ page }) => {
  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Private practice insights' })
  ).toBeVisible();
  await expect(page.getByText('A reflection, not a rating')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Trademark Clearance Reasoning' }).first()
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Why this appeared' })).toBeVisible();
  await expect(
    page.getByLabel('Why this appeared').getByText('Specialist assessment')
  ).toBeVisible();
  await expect(
    page.getByLabel('Why this appeared').getByText('Reviewed trademark matter')
  ).toBeVisible();

  await page.getByText('View exact lineage').click();
  await expect(page.getByText('private-reflection-policy-v1.2')).toBeVisible();
  await page.getByRole('button', { name: 'Add to my private picture' }).click();

  await expect(page.getByText('Reflection added to your private picture.')).toBeVisible();
  await expect(page.getByText('You are up to date')).toBeVisible();
  await expect(page.getByText('0 open')).toBeVisible();
  await expect(
    page.getByText(
      'I can turn complex clearance evidence into a focused, decision-ready risk view without overstating what the evidence proves.'
    )
  ).toBeVisible();
});

test('keeps empty, partial, permission, service and stale states distinct', async ({ page }) => {
  await page.goto('/capability-reflection-preview.html?scenario=empty');
  await expect(page.getByText('Your private picture will grow here')).toBeVisible();

  await page.goto('/capability-reflection-preview.html?scenario=partial');
  await expect(page.getByText('Your private picture is still taking shape')).toBeVisible();
  await expect(
    page.getByText('No private practice picture is available. Nothing is inferred.')
  ).toBeVisible();

  await page.goto('/capability-reflection-preview.html?scenario=permission');
  await expect(page.getByText('Private insights permission required')).toBeVisible();
  await expect(page.getByText('Your private picture will grow here')).toHaveCount(0);

  await page.goto('/capability-reflection-preview.html?scenario=error');
  await expect(page.getByText('Private insights unavailable')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

  await page.goto('/capability-reflection-preview.html?scenario=stale');
  await page.getByRole('button', { name: 'Add to my private picture' }).click();
  await expect(page.getByText('This reflection has changed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload latest' })).toBeVisible();
});

test('supports defer and dismiss without claiming capability verification', async ({ page }) => {
  await page.getByRole('button', { name: 'Decide later' }).click();
  await expect(page.getByText('Reflection saved for later review.')).toBeVisible();
  await expect(page.getByText('You are up to date')).toBeVisible();
  await expect(page.getByText(/do not verify, certify or rank your capability/i)).toBeVisible();

  await page.goto('/capability-reflection-preview.html');
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(
    page.getByText('Reflection dismissed. Your private picture was not changed.')
  ).toBeVisible();
});

test('390px preserves decision, private picture and evidence order without overflow', async ({
  page
}) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
  const top = async (name: string) =>
    page.getByRole('heading', { name }).evaluate((element) => element.getBoundingClientRect().top);
  const decisionTop = await top('Reflections ready for you');
  const pictureTop = await top('Your practice picture');
  const evidenceTop = await top('Evidence trail');
  expect(decisionTop).toBeLessThan(pictureTop);
  expect(pictureTop).toBeLessThan(evidenceTop);
  await expect(page.getByRole('button', { name: 'Add to my private picture' })).toHaveCSS(
    'min-height',
    '44px'
  );
});
