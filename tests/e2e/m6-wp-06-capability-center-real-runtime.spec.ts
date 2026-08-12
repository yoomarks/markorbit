import { expect, test } from '@playwright/test';

const gateway = 'http://127.0.0.1:4420';
const lite = 'http://127.0.0.1:4485';
const desktopWorkspaceId = '41414141-4141-4414-8414-414141414141';
const mobileWorkspaceId = '42424242-4242-4424-8424-424242424242';

function acceptedPrivateReflection(page: import('@playwright/test').Page) {
  return page
    .getByRole('heading', { name: 'Current private Profiles' })
    .locator('..')
    .getByText(/My private Capability Ledger contains 1 governed work outcome/);
}

test.describe('M6-WP-06 private Capability Center real runtime', () => {
  test('loads, accepts exact candidate and reloads durable private projection without interception', async ({
    page
  }) => {
    // Observation only: no page.route/context.route/route.fulfill is registered in this suite.
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/lite/capability-center')) requests.push(request.url());
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

    const loadResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/lite/capability-center') &&
        response.request().method() === 'GET'
    );
    await page.goto(`${lite}/?workspaceId=${workspaceId}#capability`);
    expect((await loadResponse).status()).toBe(200);

    await expect(
      page.getByRole('heading', { name: 'Capability Center', exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(/does not create certification, ranking, canonical truth/)
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept private reflection' })).toBeEnabled();
    await expect(page.getByText(/evidence-review-decision_wp06-/)).toBeVisible();

    const decision = page.waitForResponse(
      (response) =>
        response.url().includes('/reflection-candidates/') &&
        response.url().endsWith('/disposition') &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Accept private reflection' }).click();
    expect([200, 201]).toContain((await decision).status());

    await expect(page.getByText('No pending private Reflection Candidate.')).toBeVisible();
    await expect(acceptedPrivateReflection(page)).toBeVisible();
    await expect(page.getByText('Autonomous execution authority')).toBeVisible();

    const durableUrl = page.url();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Capability Center', exact: true })
    ).toBeVisible();
    await expect(page.getByText('No pending private Reflection Candidate.')).toBeVisible();
    await expect(acceptedPrivateReflection(page)).toBeVisible();

    const direct = await page.context().newPage();
    await direct.goto(durableUrl);
    await expect(
      direct.getByRole('heading', { name: 'Capability Center', exact: true })
    ).toBeVisible();
    await expect(acceptedPrivateReflection(direct)).toBeVisible();
    await direct.close();

    expect(requests.some((url) => url.endsWith('/api/lite/capability-center'))).toBe(true);
    expect(requests.some((url) => url.includes('/reflection-candidates/'))).toBe(true);

    if (test.info().project.name.includes('mobile')) {
      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth
      }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
});
