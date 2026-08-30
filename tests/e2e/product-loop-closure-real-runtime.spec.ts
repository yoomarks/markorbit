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
    const feedbackButton = mobile ? 'Published' : 'Used';
    const feedbackEvidence = mobile ? 'USER REPORTED PUBLISHED' : 'USER REPORTED USED';

    const auth = await page.request.post(`${gateway}/__test/auth/session`, {
      data: { fixture: 'wp07' }
    });
    expect(auth.status()).toBe(201);
    const sessionCookie = auth.headers()['set-cookie']?.match(/mo_session=([^;]+)/)?.[1];
    expect(sessionCookie).toBeTruthy();
    await page
      .context()
      .addCookies([{ name: 'mo_session', value: sessionCookie!, domain: '127.0.0.1', path: '/' }]);

    const workspaceResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/daily-workspace') &&
        response.request().method() === 'GET'
    );
    await page.goto(`${lite}/?workspaceId=${workspaceId}#today`);
    expect((await workspaceResponse).status()).toBe(200);

    await expect(page.getByRole('heading', { name: 'Good morning', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Today Actions', exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'What happened after preparation?', exact: true })
    ).toBeVisible();
    await expect(page.getByText(feedbackPackageTitle, { exact: true })).toBeVisible();
    await expect(page.getByText('Reporting is not publication', { exact: true })).toBeVisible();

    const primaryHeading = page.getByRole('heading', { name: primaryTitle, exact: true });
    await expect(primaryHeading).toBeVisible();
    const primaryCard = primaryHeading.locator('xpath=../../..');

    const prepareResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/prepared-actions') &&
        response.request().method() === 'POST' &&
        !response.url().endsWith('/confirm')
    );
    await primaryCard.getByRole('button', { name: 'Prepare content action' }).click();
    expect((await prepareResponse).status()).toBe(201);

    await expect(primaryCard.getByText('Prepared Action', { exact: true })).toBeVisible();
    await expect(primaryCard.getByText('Confirmation required', { exact: true })).toBeVisible();
    await expect(primaryCard.getByRole('note', { name: 'Confirmation effect' })).toBeVisible();
    await expect(primaryCard.getByRole('button', { name: 'Confirm and hand off' })).toBeEnabled();

    const confirmResponse = page.waitForResponse(
      (response) => response.url().endsWith('/confirm') && response.request().method() === 'POST'
    );
    await primaryCard.getByRole('button', { name: 'Confirm and hand off' }).click();
    expect((await confirmResponse).status()).toBe(200);
    await expect(primaryCard.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(primaryCard.getByText(/No automatic publication, customer outreach/)).toBeVisible();

    const feedbackResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/use-feedback') && response.request().method() === 'POST'
    );
    const feedbackRow = page.getByText(feedbackPackageTitle, { exact: true }).locator('xpath=../..');
    await feedbackRow.getByRole('button', { name: feedbackButton, exact: true }).click();
    expect((await feedbackResponse).status()).toBe(201);

    await expect(page.getByText(feedbackPackageTitle, { exact: true })).not.toBeVisible();
    await expect(page.getByText(/Recent user-reported outcomes \(1\)/)).toBeVisible();
    await expect(page.getByText(new RegExp(feedbackEvidence))).toBeVisible();
    await expect(
      page.getByText(/They do not publish or independently verify the result/)
    ).toBeVisible();

    const durableUrl = page.url();
    const reloadWorkspace = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/daily-workspace') &&
        response.request().method() === 'GET'
    );
    await page.reload();
    expect((await reloadWorkspace).status()).toBe(200);
    await expect(page.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(feedbackEvidence))).toBeVisible();
    await expect(page.getByText(feedbackPackageTitle, { exact: true })).not.toBeVisible();
    await expect(page).toHaveURL(durableUrl);

    const direct = await page.context().newPage();
    await direct.goto(durableUrl);
    await expect(direct.getByRole('heading', { name: primaryTitle, exact: true })).toBeVisible();
    await expect(direct.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(direct.getByText(new RegExp(feedbackEvidence))).toBeVisible();
    await direct.close();

    expect(
      productLoopRequests.some(
        ({ method, url }) => method === 'GET' && url.includes('/api/lite/daily-workspace')
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
