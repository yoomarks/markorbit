import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('Golden A: editor draft remains private until demo publication and survives direct navigation', async ({
  page
}, testInfo) => {
  await page.goto('/admin/atlas/editor');
  await expect(page.getByRole('heading', { name: 'Visual editor' })).toBeVisible();
  const heading = page.getByLabel('Heading');
  await heading.fill('A portfolio-ready trademark strategy');
  await expect(page.getByText('Draft has unpublished changes')).toBeVisible();
  await page.getByRole('button', { name: 'Published v1' }).click();
  await expect(page.getByText('A portfolio-ready trademark strategy')).toHaveCount(0);
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  await page.getByRole('button', { name: 'Review & publish' }).click();
  await page.getByRole('button', { name: 'Publish demo v2' }).click();
  await page.goto('/site/atlas/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'A portfolio-ready trademark strategy' })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'A portfolio-ready trademark strategy' })
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('golden-a-published.png'), fullPage: true });
});

test('Golden B/C: content source becomes the exact demo lead and remains tenant isolated', async ({
  page
}, testInfo) => {
  await page.goto('/site/atlas/insights/filing-map-before-expansion');
  await page.getByRole('link', { name: 'Explore and inquire' }).click();
  await page.getByRole('link', { name: 'Ask about this service' }).click();
  await expect(page.getByText('Source preserved:')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Your name').fill('Maya Chen');
  await page.getByLabel('Organization').fill('Orbit Labs');
  await page.getByLabel('Work email').fill('maya@example.com');
  await page
    .getByLabel('What are you trying to decide?')
    .fill('We need a filing sequence for three markets.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/I understand/).check();
  await page.getByRole('button', { name: 'Submit demo inquiry' }).click();
  await expect(page.getByText('DEMO-LEAD-0001')).toBeVisible();
  await page.getByRole('link', { name: 'Find this lead in Site Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Maya Chen · Orbit Labs' })).toBeVisible();
  await expect(page.getByText('content-filing-map')).toBeVisible();
  await page.goto('/admin/foundry/leads');
  await expect(page.getByRole('heading', { name: 'No demo leads yet' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('golden-bc-isolation.png'), fullPage: true });
});

test('history, validation, version restore, and both templates work', async ({ page }) => {
  await page.goto('/site/atlas/contact');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Error: Enter your name.')).toBeVisible();
  await page.goto('/site/foundry/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'A better way to explore brand assets.' })
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Tell us what decision is ahead.' })
  ).toBeVisible();
  await page.goto('/admin/atlas/editor');
  await page.getByLabel('Heading').fill('Temporary draft');
  await page.getByRole('button', { name: 'Restore to draft' }).first().click();
  await expect(page.getByText('Version 1 restored into a new draft')).toBeVisible();
});
