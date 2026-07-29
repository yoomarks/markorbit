import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  urls,
  watchPage
} from './helpers/page.js';

async function clickCenteredPointer(page: Page, target: Locator) {
  await target.evaluate((element) => {
    element.scrollIntoView({
      block: 'center',
      inline: 'nearest'
    });
  });

  await expect(target).toBeVisible();
  await expect(target).toBeInViewport();

  await expect
    .poll(async () =>
      target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hitTarget = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );

        return hitTarget === element || (hitTarget !== null && element.contains(hitTarget));
      })
    )
    .toBe(true);

  const box = await target.boundingBox();

  if (box === null) {
    throw new Error('Target has no clickable bounding box.');
  }

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

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
  const customerDetailsButton = page.getByRole('button', { name: 'View customer details' });
  await clickCenteredPointer(page, customerDetailsButton);
  await expect(page.getByRole('heading', { level: 1, name: 'Northwind Outdoor' })).toBeVisible();
  await expect(page.getByText('Customer Record ≠ Verified Legal Identity')).toBeVisible();
  await page.getByRole('button', { name: 'Back to customers' }).click();
  await expect(page.getByLabel('Search customers')).toHaveValue('Northwind');
  await expect(page.getByLabel('Customer status')).toHaveValue('Active');

  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  await page.getByLabel('Opportunity status').selectOption('REVIEWING');
  const opportunityDetailsButton = page.getByRole('button', {
    name: 'View opportunity details'
  });
  await clickCenteredPointer(page, opportunityDetailsButton);
  await expect(page.getByText('Opportunity ≠ Confirmed Demand')).toBeVisible();
  await page.getByRole('button', { name: 'Mark suggestion as reviewed' }).click();
  const reviewAcknowledgement = page
    .getByRole('status')
    .filter({ hasText: 'Review acknowledgement saved' });
  await expect(reviewAcknowledgement).toContainText('No contact, order, appointment, filing');
  await page.getByRole('button', { name: 'Back to opportunities' }).click();
  await expect(page.getByLabel('Opportunity status')).toHaveValue('REVIEWING');
  const reviewingStatus = page.locator('strong').filter({ hasText: /^REVIEWING$/ });
  await expect(reviewingStatus).toHaveCount(1);
  await expect(reviewingStatus).toBeVisible();
  assertHealthy();
});
