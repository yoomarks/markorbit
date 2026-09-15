import { expect, test } from '@playwright/test';

const story = (id: string) => `http://127.0.0.1:6016/iframe.html?id=${id}&viewMode=story`;

test('MarkReg reference Site renders the governed consultation entry @visual', async ({ page }) => {
  await page.goto(story('markreg-public-site--mark-reg-reference'));
  await expect(page.getByRole('link', { name: 'MarkReg home' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Protect the name you are building.' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start a consultation' })).toBeEnabled();
  await expect(page.getByText('No order, payment, filing, or legal approval')).toBeVisible();
  await page.getByRole('button', { name: 'Start a consultation' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('The Site owner does not become a member')).toBeVisible();
});

test('the pilot host uses a distinct brand through the same Site renderer @visual', async ({
  page
}) => {
  await page.goto(story('markreg-public-site--workspace-branded-pilot'));
  await expect(page.getByRole('link', { name: 'Northstar Brand Desk home' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Trademark guidance for growing brands.' })
  ).toBeVisible();
  await expect(page.getByText('site_northstar_pilot')).toBeVisible();
  await expect(page.getByText('Protect the name you are building.')).toHaveCount(0);
});
