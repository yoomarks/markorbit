import { expect, test } from '@playwright/test';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  urls,
  watchPage
} from './helpers/page.js';

async function openHealthy(page: Parameters<typeof watchPage>[0]) {
  const assertHealthy = watchPage(page);
  await page.goto(urls.lite);
  await expect(page.getByRole('heading', { level: 1, name: 'Customers' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Demonstration only');
  await expectNoHorizontalOverflow(page);
  return assertHealthy;
}
test('Lite Customers list is healthy on desktop @visual', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'), 'desktop evidence');
  const assertHealthy = await openHealthy(page);
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link')).toHaveText([
    'Today',
    'Content',
    'Opportunities',
    'Trademarks',
    'Work',
    'Capability',
    'Guide'
  ]);
  await expectVisibleFocus(page);
  await capture(page, 'lite-customers-list-desktop');
  assertHealthy();
});
test('Lite Customer detail is healthy on mobile @visual', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile evidence');
  const assertHealthy = await openHealthy(page);
  await page.getByRole('button', { name: /Aurora Foods/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Aurora Foods Ltd' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, 'lite-customer-detail-mobile');
  assertHealthy();
});
test('Lite Opportunities list is healthy on desktop @visual', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'), 'desktop evidence');
  const assertHealthy = await openHealthy(page);
  await page.getByRole('link', { name: 'Opportunities' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Opportunities' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, 'lite-opportunities-list-desktop');
  assertHealthy();
});
test('Lite Opportunity detail is safe on mobile @visual', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile evidence');
  const assertHealthy = await openHealthy(page);
  await page.getByRole('link', { name: 'Opportunities' }).click();
  await page.getByRole('button', { name: /Canada expansion/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Review and approve/ })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
  await capture(page, 'lite-opportunity-detail-mobile');
  assertHealthy();
});
test('Lite retains opportunity filters after detail return', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'), 'single browser acceptance path');
  const assertHealthy = await openHealthy(page);
  await page.getByRole('link', { name: 'Opportunities' }).click();
  await page.getByLabel('Search').fill('Canada');
  await page.getByLabel('Country / region').selectOption('Canada');
  await page.getByLabel('Status').selectOption('NEW');
  const originatingRow = page.getByRole('button', { name: /Canada expansion/ });
  await originatingRow.focus();
  await page.keyboard.press('Enter');
  const backButton = page.getByRole('button', { name: /Back to opportunities/ });
  await backButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Search')).toHaveValue('Canada');
  await expect(page.getByLabel('Country / region')).toHaveValue('Canada');
  await expect(page.getByLabel('Status')).toHaveValue('NEW');
  await expect(originatingRow).toBeFocused();
  await expect(originatingRow.locator(':scope:focus-visible')).toBeVisible();
  expect(
    await originatingRow.evaluate((element) => getComputedStyle(element).outlineStyle)
  ).not.toBe('none');
  assertHealthy();
});
