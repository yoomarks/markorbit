import { expect, test } from '@playwright/test';

const gateway = 'http://127.0.0.1:4410';
const lite = 'http://127.0.0.1:4475';
const desktopWorkspaceId = '31313131-3131-4313-8313-313131313131';
const mobileWorkspaceId = '32323232-3232-4323-8323-323232323232';
const title = 'Prepare the reviewed trademark maintenance update';

test.describe('M9 WP06 real durable Daily Workspace', () => {
  test('runs SEE → CREATE → MOVE through authenticated real runtime without interception', async ({
    page
  }) => {
    const productLoopRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/lite/')) productLoopRequests.push(request.url());
    });

    const workspaceId = test.info().project.name.includes('mobile')
      ? mobileWorkspaceId
      : desktopWorkspaceId;

    const auth = await page.request.post(`${gateway}/__test/auth/session`, {
      data: { fixture: 'wp06' }
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
    const orbitResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/daily-orbit') && response.request().method() === 'GET'
    );
    await page.goto(`${lite}/?workspaceId=${workspaceId}#today`);
    expect((await todayResponse).status()).toBe(200);
    expect((await orbitResponse).status()).toBe(200);

    await expect(page.getByRole('heading', { name: 'Good morning', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: "Today's Orbit", exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content Picks', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quick Create', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Today Actions', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();

    const orbitCard = page.locator('#daily-orbit section.mo-card').filter({
      has: page.getByRole('heading', { name: title, exact: true })
    });
    await expect(orbitCard).toHaveCount(1);
    await expect(orbitCard.getByLabel(/^Orbit score \d+$/i)).toBeVisible();
    await expect(orbitCard.getByText(/Importance 90/)).toBeVisible();
    await orbitCard.getByText('Source & ranking reasons', { exact: true }).click();
    await expect(
      orbitCard.getByText(`rdp_wp06-browser-${workspaceId}`, { exact: false })
    ).toBeVisible();

    await expect(page.getByText('Prepare the content line first', { exact: true })).toBeVisible();
    await expect(page.getByText(/Content Pick is editorial guidance only/)).toBeVisible();

    const prepareResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/prepared-actions') &&
        response.request().method() === 'POST' &&
        !response.url().endsWith('/confirm')
    );
    await page.getByRole('button', { name: 'Prepare content action' }).click();
    expect((await prepareResponse).status()).toBe(201);

    await expect(page.getByText('Confirmation effect', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Create one Lite Content Opportunity from this exact Recommendation/)
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm and hand off' })).toBeEnabled();
    await expect(page).toHaveURL(/todayRecommendationId=today-recommendation_/);
    await expect(page).toHaveURL(/preparedActionId=prepared-action_/);

    const confirmResponse = page.waitForResponse(
      (response) => response.url().endsWith('/confirm') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Confirm and hand off' }).click();
    expect((await confirmResponse).status()).toBe(200);

    await expect(page.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(page.getByText(/content-opportunity_/)).toBeVisible();
    await expect(page.getByText(/No automatic publication, customer outreach/)).toBeVisible();
    await expect(page.getByText('CONTENT KIT', { exact: true })).toBeVisible();
    await expect(page.getByText('Native variants', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Human review required · external publish executed: No/)
    ).toBeVisible();

    const durableUrl = page.url();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Good morning', exact: true })).toBeVisible();
    await expect(page.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(page.getByText('CONTENT KIT', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(durableUrl);

    const direct = await page.context().newPage();
    await direct.goto(durableUrl);
    await expect(direct.getByRole('heading', { name: 'Good morning', exact: true })).toBeVisible();
    await expect(direct.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await direct.close();

    expect(productLoopRequests.some((url) => url.includes('/api/lite/today'))).toBe(true);
    expect(productLoopRequests.some((url) => url.includes('/api/lite/daily-orbit'))).toBe(true);
    expect(productLoopRequests.some((url) => url.includes('/api/lite/content-kits/'))).toBe(true);
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
