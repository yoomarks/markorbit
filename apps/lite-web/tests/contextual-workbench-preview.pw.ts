import { expect, test } from '@playwright/test';

test('opportunity conversation stays separate from Prepare and Confirm', async ({ page }) => {
  await page.goto('/contextual-workbench-preview.html');

  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Waiting for one bounded answer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm this action' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Review service need' }).click();
  await expect(page.getByRole('heading', { name: 'Working proposal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm this action' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Prepare reviewable opportunity action' }).click();
  await expect(page.getByText('Confirmation effect')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm this action' })).toBeVisible();
  await expect(page.getByText('Committed result')).toHaveCount(0);

  await page.getByRole('button', { name: 'Confirm this action' }).click();
  await expect(page.getByText('Committed result').first()).toBeVisible();
  await expect(page.getByText(/trademark-service-opportunity_workbench/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open result receipt' })).toBeVisible();
});

test('changing the proposal invalidates a prepared result', async ({ page }) => {
  await page.goto('/contextual-workbench-preview.html');
  await page.getByRole('button', { name: 'Review service need' }).click();
  await page.getByRole('button', { name: 'Prepare reviewable opportunity action' }).click();
  await expect(page.getByRole('button', { name: 'Confirm this action' })).toBeVisible();

  await page.getByRole('button', { name: 'Need more evidence' }).click();
  await expect(page.getByRole('button', { name: 'Confirm this action' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Prepare reviewable opportunity action' })
  ).toBeVisible();
});

test('customer review remains a proposal and client action remains a draft', async ({ page }) => {
  await page.goto('/contextual-workbench-preview.html?task=customer');
  await page.getByRole('button', { name: 'Current client' }).click();
  await expect(page.getByText(/not committed here/i)).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Continue in structured customer review' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm this action' })).toHaveCount(0);

  await page.goto('/contextual-workbench-preview.html?task=client');
  await page.getByRole('button', { name: 'Status change and next step' }).click();
  await page.getByRole('button', { name: 'Prepare reviewable client action' }).click();
  await expect(page.getByText(/Nothing will be sent, published or filed/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm this action' }).click();
  await expect(page.getByText(/content-opportunity_workbench/)).toBeVisible();
});

test('query scenarios expose negative and lifecycle states explicitly', async ({ page }) => {
  await page.goto('/contextual-workbench-preview.html?scenario=loading');
  await expect(page.getByText('Loading work context…', { exact: true })).toBeVisible();

  await page.goto('/contextual-workbench-preview.html?scenario=empty');
  await expect(page.getByText('No work context is available')).toBeVisible();

  await page.goto('/contextual-workbench-preview.html?scenario=partial');
  await expect(
    page.getByRole('status').filter({ hasText: 'Some context is unavailable' })
  ).toBeVisible();

  await page.goto('/contextual-workbench-preview.html?scenario=permission');
  await expect(page.getByText('You do not have access to this context')).toBeVisible();

  await page.goto('/contextual-workbench-preview.html?scenario=error');
  await expect(page.getByText('This work context could not be loaded')).toBeVisible();

  await page.goto('/contextual-workbench-preview.html?scenario=prepared');
  await expect(page.getByRole('button', { name: 'Confirm this action' })).toBeVisible();

  await page.goto('/contextual-workbench-preview.html?scenario=pending');
  await expect(page.getByRole('button', { name: 'Retry structured confirmation' })).toBeVisible();

  await page.goto('/contextual-workbench-preview.html?scenario=committed');
  await expect(page.getByRole('heading', { name: 'Committed structured result' })).toBeVisible();
});

test('fixture dependency failures preserve working context and fail closed', async ({ page }) => {
  await page.goto('/contextual-workbench-preview.html?scenario=prepare-error');
  await page.getByRole('button', { name: 'Review service need' }).click();
  await page.getByRole('button', { name: 'Prepare reviewable opportunity action' }).click();
  await expect(page.getByText('Preview preparation dependency is unavailable.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm this action' })).toHaveCount(0);

  await page.goto('/contextual-workbench-preview.html?scenario=confirm-error');
  await page.getByRole('button', { name: 'Review service need' }).click();
  await page.getByRole('button', { name: 'Prepare reviewable opportunity action' }).click();
  await page.getByRole('button', { name: 'Confirm this action' }).click();
  await expect(page.getByText('Preview confirmation dependency is unavailable.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm this action' })).toBeVisible();
});

test('390px preserves Context, Conversation, Working State order without overflow', async ({
  page
}) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  await page.goto('/contextual-workbench-preview.html?task=client');

  const contextTop = await page
    .getByRole('complementary', { name: 'Context brief' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const conversationTop = await page
    .locator('.seed-contextual-workbench__conversation')
    .evaluate((element) => element.getBoundingClientRect().top);
  const workingTop = await page
    .getByRole('complementary', { name: 'Current working state' })
    .evaluate((element) => element.getBoundingClientRect().top);

  expect(contextTop).toBeLessThan(conversationTop);
  expect(conversationTop).toBeLessThan(workingTop);
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
});
