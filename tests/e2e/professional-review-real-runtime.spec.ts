import { expect, test } from '@playwright/test';

const gateway = 'http://127.0.0.1:4400';
const lite = 'http://127.0.0.1:4471';
const workspaceId = '66666666-6666-4666-8666-666666666666';
const otherWorkspaceId = '77777777-7777-4777-8777-777777777777';

test.describe('TASK 024 real durable Professional Review path', () => {
  test('persists exact Review evidence through refresh, direct URL and governed completion', async ({
    page
  }) => {
    // Requests are observed only. This dedicated suite never intercepts or fulfills application data.
    const observed: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/professional-review-cases')) observed.push(request.url());
    });
    const auth = await page.request.post(`${gateway}/__test/auth/session`, {
      data: { fixture: 'task023' }
    });
    expect(auth.status()).toBe(201);
    await page.goto(`${lite}/?workspaceId=${workspaceId}#matters`);
    await expect(page.getByRole('heading', { name: 'Matters' })).toBeVisible();
    await page.getByRole('button', { name: 'View Matter details' }).click();
    await expect(
      page.getByRole('button', { name: 'Start or Resume Professional Review' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Start or Resume Professional Review' }).click();
    await expect(page.getByRole('heading', { name: 'DURABLE ORBIT' })).toBeVisible();
    const reviewId = (await page
      .getByText(/^Professional Review Case professional-review_/)
      .textContent())!.replace('Professional Review Case ', '');
    expect(reviewId).toMatch(/^professional-review_/);

    if (test.info().project.name.includes('desktop')) {
      await expect(page.getByText('Review version', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Claim review' }).click();
      await page.getByRole('button', { name: 'Save Review Draft' }).click();
      await expect(page.getByText('Review version', { exact: true })).toBeVisible();
      const versionText = await page
        .locator('dt', { hasText: 'Review version' })
        .locator('xpath=following-sibling::dd[1]')
        .textContent();
      const detailUrl = page.url();
      await page.reload();
      await expect(page.getByText(reviewId, { exact: false })).toBeVisible();
      await expect(
        page.locator('dt', { hasText: 'Review version' }).locator('xpath=following-sibling::dd[1]')
      ).toHaveText(versionText!);
      await expect(
        page.getByText('Exact source evidence reviewed.', { exact: false }).first()
      ).toBeVisible();
      const direct = await page.context().newPage();
      await direct.goto(detailUrl);
      await expect(direct.getByText(reviewId, { exact: false })).toBeVisible();
      await direct.close();
      await page.getByLabel('Review decision rationale').fill('Ready for the next governed step.');
      await page.getByRole('button', { name: 'Mark reviewed and ready for next step' }).click();
      await expect(
        page.getByText('Reviewed ready for next step — no action executed')
      ).toBeVisible();
      await expect(page.getByText(/filingCreated: false/)).toBeVisible();
      await page.reload();
      await expect(
        page.getByText('Reviewed ready for next step — no action executed')
      ).toBeVisible();
      await page.goBack();
      await expect(page.getByText('Formal Matter · immutable creation lineage')).toBeVisible();
    } else {
      await expect(
        page.getByText('Reviewed ready for next step — no action executed')
      ).toBeVisible();
      await expect(page.getByText(reviewId, { exact: false })).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth
      }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    }

    await page.goto(
      `${lite}/?workspaceId=${workspaceId}&professionalReviewCaseId=${reviewId}#work-professional-review`
    );
    await expect(page.getByText(reviewId, { exact: false })).toBeVisible();
    await page.evaluate((workspace) => {
      const query = new URLSearchParams(location.search);
      query.set('workspaceId', workspace);
      history.pushState(null, '', `${location.pathname}?${query}${location.hash}`);
      dispatchEvent(new PopStateEvent('popstate'));
    }, otherWorkspaceId);
    await expect(page).not.toHaveURL(/professionalReviewCaseId=/);
    await expect(page.getByText('No professional review cases')).toBeVisible();
    expect(observed.length).toBeGreaterThanOrEqual(4);
  });
});
