import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/customers-preview.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('filters fixture customers and persists the selected presentation', async ({ page }) => {
  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Customers' })).toBeVisible();

  await page.getByLabel('Search customers').fill('Northwind');
  await page.getByLabel('Customer status').selectOption('Active');
  await page.getByLabel('Country / region').selectOption('US');
  await expect(page.getByText('1 matching fixture customers')).toBeVisible();
  await expect(page).toHaveURL(/customerSearch=Northwind/);
  await expect(page).toHaveURL(/customerStatus=Active/);
  await expect(page).toHaveURL(/customerRegion=US/);

  await page.getByRole('button', { name: 'Cards' }).click();
  await expect(page.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('lite-customers-view')))
    .toBe('cards');
});

test('opens a dedicated detail and browser Back restores filters and focus', async ({ page }) => {
  await page.getByLabel('Search customers').fill('Northwind');
  const opener = page.getByRole('button', { name: 'View customer preview' });
  await opener.click();

  await expect(page.getByRole('heading', { level: 1, name: 'Northwind Outdoor' })).toBeVisible();
  await expect(page).toHaveURL(/customerId=cus-northwind/);
  await expect(page.getByText(/Customer Record ≠ Verified Legal Identity/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Related opportunities' })).toBeVisible();

  await page.goBack();
  await expect(page.getByLabel('Search customers')).toHaveValue('Northwind');
  await expect(opener).toBeFocused();
});

test('query scenarios expose loading, empty, stale and recoverable error truthfully', async ({
  page
}) => {
  await page.goto('/customers-preview.html?scenario=loading');
  await expect(page.getByText('Loading fixture customers…', { exact: true })).toBeVisible();

  await page.goto('/customers-preview.html?scenario=empty');
  await expect(page.getByRole('heading', { name: 'No fixture customers found' })).toBeVisible();

  await page.goto('/customers-preview.html?scenario=stale');
  await expect(page.getByRole('status').filter({ hasText: 'Stale fixture data' })).toBeVisible();
  await expect(page.getByText(/protected actions remain unavailable/)).toBeVisible();

  await page.goto('/customers-preview.html?scenario=error');
  await expect(page.getByRole('heading', { name: 'Fixture customers unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Customers' })).toBeVisible();
});

test('partial fixture record keeps unavailable context explicit', async ({ page }) => {
  await page.goto('/customers-preview.html?customerId=cus-studio');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Studio Very Long Customer Name/
    })
  ).toBeVisible();
  await expect(page.getByText('Fixture contact unavailable')).toBeVisible();
  await expect(page.getByText('No customer activity in this fixture.')).toBeVisible();
  await expect(page.getByText('No related fixture records.')).toHaveCount(2);
});

test('390px stacks controls and detail content without horizontal overflow', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  await page.goto('/customers-preview.html?customerId=cus-studio');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Studio Very Long Customer Name/
    })
  ).toBeVisible();
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );

  const overviewTop = await page
    .getByRole('heading', { name: 'Customer overview' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const activityTop = await page
    .getByRole('heading', { name: 'Customer activity' })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(overviewTop).toBeLessThan(activityTop);
});
