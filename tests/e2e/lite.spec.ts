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
