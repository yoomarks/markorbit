import { expect, test } from '@playwright/test';

const gateway = 'http://127.0.0.1:4490';
const lite = 'http://127.0.0.1:4495';
const desktopWorkspaceId = '43434343-4343-4434-8434-434343434343';
const mobileWorkspaceId = '44444444-4444-4444-8444-444444444444';
const primaryTitle = 'Prepare the reviewed trademark maintenance update';
const feedbackPackageTitle = 'WP07 reviewed manual-use package';

test.describe('PLC-WP-07 real Product-loop browser matrix', () => {
  test('closes Today handoff and manual feedback through real runtime without interception', async ({
    page
  }) => {
    // Observe only. This acceptance suite must never intercept, fulfill or synthesize Product-loop HTTP.
    const productLoopRequests: Array<{ method: string; url: string }> = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/lite/'))
        productLoopRequests.push({ method: request.method(), url: request.url() });
    });

    const mobile = test.info().project.name.includes('mobile');
    const workspaceId = mobile ? mobileWorkspaceId : desktopWorkspaceId;
    const feedbackButton = mobile ? 'Delivered' : 'Used';
    const feedbackEvidence = mobile ? 'Reported delivered' : 'Reported used';

    const auth = await page.request.post(`${gateway}/__test/auth/session`, {
      data: { fixture: 'wp07' }
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
    await expect(page.getByRole('heading', { name: 'Outcome feedback needed' })).toBeVisible();
    await expect(page.getByText(feedbackPackageTitle, { exact: true })).toBeVisible();
    await expect(
      page.getByText('Reporting does not publish anything', { exact: true })
    ).toBeVisible();

    const recommendationList = page.getByRole('list', { name: 'Today recommendations' });
    const primaryRecommendation = recommendationList
      .getByRole('listitem')
      .filter({ hasText: primaryTitle });
    await expect(primaryRecommendation).toBeVisible();
    await primaryRecommendation.click();
    await expect(page.getByRole('heading', { name: primaryTitle, exact: true })).toBeVisible();
    await expect(
      page.getByText(`rdp_wp07-browser-primary-${workspaceId}`, { exact: true })
    ).toBeVisible();
    await expect(page.getByText('Execution authorized', { exact: true })).toBeVisible();
    await expect(page.getByText('No', { exact: true })).toBeVisible();

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
    await expect(page.getByRole('button', { name: 'Confirm and hand off' })).toBeEnabled();

    const confirmResponse = page.waitForResponse(
      (response) => response.url().endsWith('/confirm') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Confirm and hand off' }).click();
    expect((await confirmResponse).status()).toBe(200);
    await expect(page.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(page.getByText(/No automatic publication, customer outreach/)).toBeVisible();

    const feedbackResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/use-feedback') && response.request().method() === 'POST'
    );
    const feedbackGroup = page.getByLabel(`Report outcome for ${feedbackPackageTitle}`);
    await feedbackGroup.getByRole('button', { name: feedbackButton, exact: true }).click();
    expect((await feedbackResponse).status()).toBe(201);

    await expect(page.getByText(feedbackPackageTitle, { exact: true })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Product-loop evidence' })).toBeVisible();
    await expect(page.getByText(feedbackEvidence, { exact: true })).toBeVisible();
    await expect(page.getByText('User-reported evidence', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/MarkOrbit did not execute or independently verify the external action/)
    ).toBeVisible();
    await expect(page.getByText(/not Capability verification/)).toBeVisible();

    const durableUrl = page.url();
    const reloadToday = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/today') && response.request().method() === 'GET'
    );
    await page.reload();
    expect((await reloadToday).status()).toBe(200);
    await expect(page.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(page.getByText(feedbackEvidence, { exact: true })).toBeVisible();
    await expect(page.getByText(feedbackPackageTitle, { exact: true })).not.toBeVisible();
    await expect(page).toHaveURL(durableUrl);

    const direct = await page.context().newPage();
    await direct.goto(durableUrl);
    await expect(direct.getByRole('heading', { name: primaryTitle, exact: true })).toBeVisible();
    await expect(direct.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(direct.getByText(feedbackEvidence, { exact: true })).toBeVisible();
    await direct.close();

    expect(
      productLoopRequests.some(
        ({ method, url }) => method === 'GET' && url.includes('/api/lite/today')
      )
    ).toBe(true);
    expect(
      productLoopRequests.some(
        ({ method, url }) => method === 'POST' && url.includes('/prepared-actions')
      )
    ).toBe(true);
    expect(
      productLoopRequests.some(
        ({ method, url }) => method === 'POST' && url.includes('/use-feedback')
      )
    ).toBe(true);

    if (mobile) {
      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth
      }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
});
