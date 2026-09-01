import { expect, test } from '@playwright/test';

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`;

test('Commerce Profile edit uses the returned fixture truth on desktop and mobile', async ({
  page
}) => {
  await page.goto(story('lite-trademark-asset-sell-side-workspace--existing-commerce-profile'));
  await expect(page.getByRole('heading', { name: 'Commerce Profile' })).toBeVisible();
  await expect(page.getByText(/seller-provided, non-binding context/i)).toBeVisible();

  await page.getByRole('button', { name: 'Edit sale context' }).click();
  const headline = page.getByRole('textbox', { name: 'Headline' });
  await headline.fill('Unsaved browser draft');
  await page.getByRole('button', { name: 'Save sale context' }).click();

  await expect(page.getByText(/saved from server-returned state/i)).toBeVisible();
  await expect(page.getByText('Established NORTH STAR brand context')).toBeVisible();
  await expect(page.getByText('Unsaved browser draft')).toHaveCount(0);
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
});

test('Marketplace-added Commerce Profile is visibly read-only', async ({ page }) => {
  await page.goto(story('lite-trademark-asset-sell-side-workspace--marketplace-added-read-only'));

  await expect(page.getByRole('note')).toContainText('cannot be changed here');
  await expect(page.getByText(/remain owned by Marketplace/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /sale context/i })).toHaveCount(0);
});

test('no-profile state does not imply a Marketplace or transaction outcome', async ({ page }) => {
  await page.goto(story('lite-trademark-asset-sell-side-workspace--no-commerce-profile'));

  await expect(page.getByText('No sell-side profile has been set up.')).toBeVisible();
  await expect(page.getByText(/does not determine whether/i)).toBeVisible();
  await expect(page.getByText('Listed', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Published', { exact: true })).toHaveCount(0);
});
