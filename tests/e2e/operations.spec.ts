import { expect, test } from '@playwright/test';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  urls,
  watchPage
} from './helpers/page.js';

test('Operations overview exposes internal triage summaries @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await page.goto(urls.operations);
  await expect(page.getByText('Internal only')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  for (const heading of ['Service health', 'Failed operations', 'Manual review', 'Event summary'])
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectVisibleFocus(page);
  if (testInfo.project.name.startsWith('desktop')) {
    await capture(page, 'operations-console-desktop');
  }
  assertHealthy();
});
