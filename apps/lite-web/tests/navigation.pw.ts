import { expect, test } from '@playwright/test';
import { detailFixture, listFixture } from '../src/features/content-studio/fixtures.js';

test('every primary destination is explicit and truthful on desktop and mobile', async ({
  page
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#work-customers');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  for (const [label, hash, title, badge] of [
    ['Today', 'today', 'Select a Workspace', 'Workspace required'],
    ['Matters', 'matters', 'Select a Workspace', 'Workspace required'],
    ['Content', 'content', 'Select a Workspace', 'Workspace required'],
    ['Opportunities', 'opportunities', 'Opportunities', 'Not live data'],
    ['Trademarks', 'trademarks', 'Select a Workspace', 'Workspace required'],
    ['Work', 'work-customers', 'Customers', 'Not live data'],
    ['Capability', 'capability', 'Select a Workspace', 'Workspace required'],
    ['Guide', 'guide', 'Guide', 'Not yet promoted']
  ] as const) {
    const link = nav.getByRole('link', { name: label, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${hash}$`));
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('.mo-topbar')).toContainText(badge);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText(/Demonstration only/)).toHaveCount(
      badge === 'Not live data' ? 1 : 0
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    if (['Content', 'Guide', 'Work'].includes(label)) {
      await page.screenshot({ path: testInfo.outputPath(`${hash}.png`), fullPage: true });
    }
  }
  await nav.getByRole('link', { name: 'Content', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Select a Workspace', exact: true })
  ).toBeVisible();
  const focus = page.locator(':focus-visible');
  await expect(focus).toBeVisible();
  expect(await focus.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    'none'
  );
  expect(errors).toEqual([]);
});

test('Work navigation survives back, forward and reload while retaining review deep links', async ({
  page
}, testInfo) => {
  // Browser fixtures exercise the real API clients; they do not certify live backend behavior.
  const workspaceHeaders: (string | undefined)[] = [];
  await page.route('**/api/lite/professional-review-cases', async (route) => {
    workspaceHeaders.push(route.request().headers()['x-markorbit-workspace-id']);
    await route.fulfill({ json: { reviewCases: [] } });
  });
  await page.route('**/api/execution/execution-releases', (route) =>
    route.fulfill({ json: { executionReleases: [] } })
  );
  const query =
    '?workspaceId=workspace-browser&professionalReviewCaseId=review_1&professionalReviewCaseVersion=3';
  await page.goto(`/${query}#work-customers`);
  const work = page.getByRole('navigation', { name: 'Workspace view' });
  await work.getByRole('button', { name: 'Professional Review', exact: true }).click();
  await expect(page).toHaveURL(`${new URL(page.url()).origin}/${query}#work-professional-review`);
  await expect(page.getByRole('heading', { name: 'No professional review cases' })).toBeVisible();
  await expect(page.locator('.mo-topbar')).toHaveText('Workspace · workspace-browserAuthenticated');
  await expect(page.getByText(/Demonstration only/)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('professional-review.png'), fullPage: true });
  await work.getByRole('button', { name: 'Execution Release', exact: true }).click();
  await expect(page).toHaveURL(/#work-execution-release$/);
  await expect(page.locator('.mo-topbar')).toHaveText('Work · Execution APIAPI-backed');
  await page.goBack();
  await expect(
    work.getByRole('button', { name: 'Professional Review', exact: true })
  ).toHaveAttribute('aria-current', 'page');
  await page.goForward();
  await expect(
    work.getByRole('button', { name: 'Execution Release', exact: true })
  ).toHaveAttribute('aria-current', 'page');
  await page.reload();
  await expect(page.locator('.mo-topbar')).toContainText('API-backed');
  await expect(
    work.getByRole('button', { name: 'Execution Release', exact: true })
  ).toHaveAttribute('aria-current', 'page');
  await work.getByRole('button', { name: 'Customers', exact: true }).click();
  await expect(page).toHaveURL(/#work-customers$/);
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  expect(new URL(page.url()).search).toBe(query);
  expect(workspaceHeaders.length).toBeGreaterThan(0);
  expect(workspaceHeaders.every((value) => value === 'workspace-browser')).toBe(true);
});

test('Content Studio uses durable Gateway list/detail work and remains readable at narrow widths', async ({
  page
}, testInfo) => {
  const apiRequests: string[] = [];
  await page.route('**/api/lite/content-studio/works?*', (route) => {
    apiRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ json: listFixture() });
  });
  await page.route('**/api/lite/content-studio/works/content-opportunity_413', (route) => {
    apiRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ json: detailFixture() });
  });
  await page.goto('/?workspaceId=38383838-3838-4383-8383-383838383838#content');
  await expect(page.getByRole('heading', { name: 'Content Studio' })).toBeVisible();
  await expect(page.locator('.mo-topbar')).toContainText('Authenticated');
  await expect(page.getByText('content-opportunity_413')).toBeVisible();
  await expect(
    page.getByText(/Historical visual\/media lineage is not fully discoverable/)
  ).toBeVisible();
  await page.getByRole('button', { name: 'View lineage' }).click();
  await expect(page.getByRole('heading', { name: 'Version lineage' })).toBeVisible();
  await expect(page.getByText('USER_REPORTED_PUBLISHED')).toBeVisible();
  await expect(page.getByText(/independently verified by MarkOrbit: No/)).toBeVisible();
  await expect(page.getByText(/External publish executed by MarkOrbit:/)).toContainText('No');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({ path: testInfo.outputPath('content-studio-detail.png'), fullPage: true });
  expect(apiRequests).toEqual([
    '/api/lite/content-studio/works',
    '/api/lite/content-studio/works/content-opportunity_413'
  ]);
});

test('Content Studio keeps owner failure distinct from empty while Guide remains bounded', async ({
  page
}) => {
  await page.route('**/api/lite/content-studio/works?*', (route) =>
    route.fulfill({ status: 503, json: { code: 'PERSISTENCE_UNAVAILABLE', message: 'offline' } })
  );
  await page.goto('/?workspaceId=workspace-browser#content');
  await expect(page.getByRole('heading', { name: 'Content Studio unavailable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No content work yet' })).toHaveCount(0);
  await page.goto('/?workspaceId=workspace-browser#guide');
  await expect(page.getByRole('heading', { name: 'Guide', exact: true })).toBeVisible();
  await expect(page.locator('.mo-topbar')).toContainText('Not yet promoted');
});
