import { expect, test } from '@playwright/test';
import { applicationUrl } from './applications.js';

test('Provider Workspace shell loads through the real vanilla app @visual', async ({ page }) => {
  await page.goto(applicationUrl('provider'));

  await expect(page).toHaveTitle('MarkOrbit Provider Workspace');
  await expect(page.locator('#app')).toHaveAttribute('data-runtime', 'provider-workspace-own-work');
  await expect(page.getByRole('heading', { level: 1, name: 'Provider Workspace' })).toBeVisible();
  await expect(page.getByLabel('Core Workspace ID')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load own work' })).toBeVisible();
  await expect(page.getByText(/Queue visibility is read-only context/)).toBeVisible();
});
