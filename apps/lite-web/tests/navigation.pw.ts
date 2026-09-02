import { expect, test } from '@playwright/test';
import {
  detailFixture,
  draft,
  feedback,
  listFixture,
  opportunity,
  publishPackage
} from '../src/features/content-studio/fixtures.js';

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
    ['Opportunities', 'opportunities', 'Select a Workspace', 'Workspace required'],
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
  await expect(page.getByText('Governed preparation', { exact: true })).toBeVisible();
  await expect(page.getByText('Reviewed draft ready for package')).toBeVisible();
  await expect(page.getByText('Latest Draft Review')).toBeVisible();
  await expect(page.getByText('Latest Publish Package · work-level history')).toBeVisible();
  await expect(page.getByText('Durable Visual Briefs')).toBeVisible();
  await expect(page.getByText('Durable Visual Outputs')).toBeVisible();
  await expect(
    page.getByText(/Historical visual\/media lineage is not fully discoverable/)
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('content-studio-list.png'), fullPage: true });
  await page.getByRole('button', { name: 'View lineage' }).click();
  await expect(page.getByRole('heading', { name: 'Visual / Media lineage' })).toBeVisible();
  await expect(page.getByText('visual-brief_413')).toBeVisible();
  await expect(page.getByText('visual-output_413')).toBeVisible();
  await expect(page.getByText('PASS_WITH_WARNINGS')).toBeVisible();
  await expect(page.getByText('library://visual-output-413')).not.toHaveAttribute('href');
  await expect(page.getByText('Provider execution authorized by Lite')).toBeVisible();
  await expect(page.getByText('Paid execution authorized by Lite')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /generate|request visual|approve qc|publish/i })
  ).toHaveCount(0);
  await expect(page.getByRole('link', { name: /download|artifact/i })).toHaveCount(0);
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

test('Content Studio creates a governed Draft and renders only refreshed owner truth', async ({
  page
}, testInfo) => {
  let created = false;
  let detailReads = 0;
  let mutationRequest:
    { headers: Record<string, string>; body: Record<string, unknown>; method: string } | undefined;
  const noDraft = detailFixture({
    drafts: [],
    reviewedDrafts: [],
    reviews: [],
    packages: [],
    feedback: []
  });
  const ownerDraft = {
    ...draft,
    version: 1,
    status: 'DRAFT' as const,
    title: 'Durable owner title',
    body: 'Durable owner body'
  };
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-browser' } })
  );
  await page.route('**/api/lite/content-studio/works/content-opportunity_413', (route) => {
    detailReads += 1;
    return route.fulfill({
      json: created
        ? detailFixture({
            drafts: [ownerDraft],
            reviewedDrafts: [],
            reviews: [],
            packages: [],
            feedback: []
          })
        : noDraft
    });
  });
  await page.route(
    '**/api/lite/content-studio/works/content-opportunity_413/drafts',
    async (route) => {
      mutationRequest = {
        headers: route.request().headers(),
        body: route.request().postDataJSON() as Record<string, unknown>,
        method: route.request().method()
      };
      created = true;
      return route.fulfill({ status: 201, json: ownerDraft });
    }
  );

  await page.goto(
    '/?workspaceId=38383838-3838-4383-8383-383838383838&contentOpportunityId=content-opportunity_413#content'
  );
  await page.getByLabel('Draft title').fill('Browser proposed title');
  await page.getByLabel('Draft body').fill('Browser proposed body');
  await page.screenshot({
    path: testInfo.outputPath('content-studio-create-draft.png'),
    fullPage: true
  });
  await page.getByRole('button', { name: 'Create Draft' }).click();

  await expect(page.getByRole('heading', { name: 'Revise Draft' })).toBeVisible();
  await expect(page.getByLabel('Draft title')).toHaveValue('Durable owner title');
  await expect(page.getByLabel('Draft body')).toHaveValue('Durable owner body');
  expect(detailReads).toBe(2);
  expect(mutationRequest).toMatchObject({
    method: 'POST',
    body: {
      contentOpportunityVersion: opportunity.version,
      expectedContentOpportunityFingerprintSha256: opportunity.contentOpportunityFingerprintSha256,
      title: 'Browser proposed title',
      body: 'Browser proposed body'
    }
  });
  expect(mutationRequest?.body).not.toHaveProperty('reviewerPrincipalId');
  expect(mutationRequest?.headers['x-markorbit-workspace-id']).toBe(opportunity.workspaceId);
  expect(mutationRequest?.headers['x-markorbit-csrf-token']).toBe('csrf-browser');
  expect(mutationRequest?.headers['idempotency-key']).toMatch(/^content-studio:create:/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Ready for Human Review' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: testInfo.outputPath('content-studio-created-mobile.png'),
    fullPage: true
  });
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

test('Content Studio records governed package feedback and refreshes durable detail', async ({
  page
}, testInfo) => {
  let feedbackRecorded = false;
  let detailReads = 0;
  let mutationRequest:
    { headers: Record<string, string>; body: Record<string, unknown>; method: string } | undefined;
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-browser' } })
  );
  await page.route('**/api/lite/content-studio/works/content-opportunity_413', (route) => {
    detailReads += 1;
    return route.fulfill({
      json: detailFixture({
        feedback: feedbackRecorded ? [{ ...feedback, outcome: 'USER_REPORTED_USED' }] : []
      })
    });
  });
  await page.route(
    '**/api/lite/publish-packages/publish-package_413/use-feedback',
    async (route) => {
      mutationRequest = {
        headers: route.request().headers(),
        body: route.request().postDataJSON() as Record<string, unknown>,
        method: route.request().method()
      };
      feedbackRecorded = true;
      return route.fulfill({ json: { ...feedback, outcome: 'USER_REPORTED_USED' } });
    }
  );

  await page.goto(
    '/?workspaceId=38383838-3838-4383-8383-383838383838&contentOpportunityId=content-opportunity_413#content'
  );
  await expect(page.getByRole('button', { name: 'Used', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('content-studio-feedback-available.png'),
    fullPage: true
  });
  await page.getByRole('button', { name: 'Used', exact: true }).click();

  await expect(page.getByText('USER_REPORTED_USED')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Published' })).toHaveCount(0);
  expect(detailReads).toBe(2);
  expect(mutationRequest).toMatchObject({
    method: 'POST',
    body: {
      workspaceId: '38383838-3838-4383-8383-383838383838',
      publishPackageVersion: publishPackage.version,
      expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
      outcome: 'USER_REPORTED_USED'
    }
  });
  expect(mutationRequest?.headers['x-markorbit-workspace-id']).toBe(
    '38383838-3838-4383-8383-383838383838'
  );
  expect(mutationRequest?.headers['x-markorbit-csrf-token']).toBe('csrf-browser');
  expect(mutationRequest?.headers['idempotency-key']).toBe('feedback:publish-package_413:1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: testInfo.outputPath('content-studio-feedback.png'),
    fullPage: true
  });
});
