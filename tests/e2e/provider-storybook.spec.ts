import { expect, test } from '@playwright/test';

const storyUrl =
  'http://127.0.0.1:6015/iframe.html?id=provider-web-infrastructure--shell-registration&viewMode=story';

test('Provider Web approved story path renders the actual vanilla shell @visual', async ({
  page
}) => {
  await page.goto(storyUrl);

  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-storybook-provider-registration', 'true');
  await expect(app).toHaveAttribute('data-runtime', 'provider-workspace-own-work');
  await expect(page.getByRole('heading', { level: 1, name: 'Provider Workspace' })).toBeVisible();
  await expect(page.getByLabel('Core Workspace ID')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load own work' })).toBeVisible();
});
