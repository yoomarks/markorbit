import { expect, test } from '@playwright/test';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  urls,
  watchPage
} from './helpers/page.js';

test('Lite Today provides its fixed semantic navigation and responsive workspace @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await page.goto(urls.lite);
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Primary' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link')).toHaveText([
    'Today',
    'Content',
    'Opportunities',
    'Trademarks',
    'Work',
    'Capability',
    'Guide'
  ]);
  await expect(page.getByRole('alert')).toContainText('Demonstration only');
  await expectNoHorizontalOverflow(page);
  await expectVisibleFocus(page);
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  await capture(page, `lite-today-${viewport}`);
  assertHealthy();
});

test('Lite filters survive customer detail and suggested actions do not execute', async ({
  page
}) => {
  const assertHealthy = watchPage(page);
  await page.goto(`${urls.lite}#work-customers`);
  await page.getByLabel('Search customers').fill('Northwind');
  await page.getByLabel('Customer status').selectOption('Active');
  await page.getByLabel('Country / region').selectOption('US');
  await page.getByRole('button', { name: 'View customer details' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Northwind Outdoor' })).toBeVisible();
  await expect(page.getByText('Customer Record ≠ Verified Legal Identity')).toBeVisible();
  await page.getByRole('button', { name: 'Back to customers' }).click();
  await expect(page.getByRole('button', { name: 'View customer details' })).toBeFocused();
  await expect(page.getByLabel('Search customers')).toHaveValue('Northwind');
  await expect(page.getByLabel('Customer status')).toHaveValue('Active');

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Opportunities' })
    .click();
  await page.getByLabel('Opportunity status').selectOption('REVIEWING');
  await page.getByRole('button', { name: 'View opportunity details' }).click();
  await expect(page.getByText('Opportunity ≠ Confirmed Demand')).toBeVisible();
  await page.getByRole('button', { name: 'Mark suggestion as reviewed' }).click();
  const reviewAcknowledgement = page
    .getByRole('status')
    .filter({ hasText: 'Review acknowledgement saved' });
  await expect(reviewAcknowledgement).toContainText('No contact, order, appointment, filing');
  await page.getByRole('button', { name: 'Back to opportunities' }).click();
  await expect(page.getByRole('button', { name: 'View opportunity details' })).toBeFocused();
  await expect(page.getByLabel('Opportunity status')).toHaveValue('REVIEWING');
  const reviewingStatus = page.locator('strong').filter({ hasText: /^REVIEWING$/ });
  await expect(reviewingStatus).toHaveCount(1);
  await expect(reviewingStatus).toBeVisible();
  assertHealthy();
});

test('Lite governed professional review preserves filters, focus, and authority boundaries @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await page.goto(`${urls.lite}#work-professional-review`);
  await page.getByLabel('Status').selectOption('QUEUED');
  await page.getByLabel('Jurisdiction').selectOption('EU');
  await page.getByRole('button', { name: 'Open professional review' }).click();
  await expect(page.getByRole('heading', { name: 'Exact Matter Draft snapshot' })).toBeVisible();
  await expect(page.getByText('2026-07-28T15:40:00.000Z')).toBeVisible();
  await page.getByRole('button', { name: 'Claim review' }).click();
  await expect(page.getByText(/UNKNOWN never counts as PASS/)).toBeVisible();
  await page.getByRole('button', { name: 'Request more information' }).click();
  await expect(page.getByText('Information request prepared — not sent')).toBeVisible();
  await expect(page.getByText(/customerMessageSent: false/)).toBeVisible();
  for (const select of await page.getByLabel('Review result').all())
    await select.selectOption('PASS');
  await page.getByRole('button', { name: 'Save checklist' }).click();
  await page.getByRole('button', { name: 'Mark reviewed and ready for next step' }).click();
  await expect(page.getByText(/orderCreated: false/)).toContainText('filingCreated: false');
  await expectNoHorizontalOverflow(page);
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  await capture(page, `lite-professional-review-${viewport}`);
  await page.getByRole('button', { name: 'Back to review queue' }).click();
  await expect(page.getByRole('button', { name: 'Open professional review' })).toBeFocused();
  await expect(page.getByLabel('Status')).toHaveValue('QUEUED');
  assertHealthy();
});
