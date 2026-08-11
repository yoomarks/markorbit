import { expect, test } from '@playwright/test';

const gateway = 'http://127.0.0.1:4410';
const lite = 'http://127.0.0.1:4475';
const desktopWorkspaceId = '31313131-3131-4313-8313-313131313131';
const mobileWorkspaceId = '32323232-3232-4323-8323-323232323232';
const title = 'Prepare the reviewed trademark maintenance update';

test.describe('PLC-WP-05 real durable Lite Today path', () => {
  test('prepares, confirms, hands off and reloads without interception', async ({ page }) => {
    // Deliberately observe requests only: this suite never registers page/context routing or fulfills a response.
    const productLoopRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/lite/')) productLoopRequests.push(request.url());
    });

    const workspaceId = test.info().project.name.includes('mobile')
      ? mobileWorkspaceId
      : desktopWorkspaceId;

    const auth = await page.request.post(`${gateway}/__test/auth/session`, {
      data: { fixture: 'wp05' }
    });
    expect(auth.status()).toBe(201);
    const sessionCookie = auth.headers()['set-cookie']?.match(/mo_session=([^;]+)/)?.[1];
    expect(sessionCookie).toBeTruthy();
    await page
      .context()
      .addCookies([{ name: 'mo_session', value: sessionCookie!, domain: '127.0.0.1', path: '/' }]);

    const todayResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/today') && response.request().method() === 'GET'
    );
    await page.goto(`${lite}/?workspaceId=${workspaceId}#today`);
    expect((await todayResponse).status()).toBe(200);

    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByText(`rdp_wp05-browser-${workspaceId}`, { exact: true })).toBeVisible();
    await expect(page.getByText('Execution authorized', { exact: true })).not.toBeVisible();

    const prepareResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/prepared-actions') &&
        response.request().method() === 'POST' &&
        !response.url().endsWith('/confirm')
    );
    await page.getByRole('button', { name: 'Prepare content action' }).click();
    expect((await prepareResponse).status()).toBe(201);

    await expect(page.getByRole('heading', { name: 'Prepared Action', exact: true })).toBeVisible();
    await expect(page.getByText('Confirmation effect', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Create one Lite Content Opportunity from this exact Recommendation/)
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm and hand off' })).toBeEnabled();
    await expect(page).toHaveURL(/todayRecommendationId=today-recommendation_/);
    await expect(page).toHaveURL(/preparedActionId=prepared-action_/);

    const confirmResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/confirm') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Confirm and hand off' }).click();
    expect((await confirmResponse).status()).toBe(200);

    await expect(page.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(page.getByText(/content-opportunity_/)).toBeVisible();
    await expect(page.getByText(/No automatic publication, customer outreach/)).toBeVisible();

    const durableUrl = page.url();
    await page.reload();
    await expect(page.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(durableUrl);

    const direct = await page.context().newPage();
    await direct.goto(durableUrl);
    await expect(direct.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(direct.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await direct.close();

    expect(productLoopRequests.some((url) => url.includes('/api/lite/today'))).toBe(true);
    expect(productLoopRequests.some((url) => url.includes('/prepared-actions'))).toBe(true);

    if (test.info().project.name.includes('mobile')) {
      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth
      }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
});
