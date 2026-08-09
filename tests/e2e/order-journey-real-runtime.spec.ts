import { expect, test } from '@playwright/test';

const gateway = 'http://127.0.0.1:4400';
const markreg = 'http://127.0.0.1:4474';
const scenarios = {
  'order-journey-desktop': {
    fixture: 'm3Wp06Desktop',
    workspaceId: '61616161-6161-4616-8616-616161616161',
    otherWorkspaceId: '62626262-6262-4626-8626-626262626262',
    confirmationId: 'confirmation_wp06-desktop'
  },
  'order-journey-mobile-390': {
    fixture: 'm3Wp06Mobile',
    workspaceId: '63636363-6363-4636-8636-636363636363',
    otherWorkspaceId: '64646464-6464-4646-8646-646464646464',
    confirmationId: 'confirmation_wp06-mobile'
  }
} as const;

test.describe('M3-WP-06 real durable Order journey', () => {
  test('creates and recovers the exact Order-to-Matter path without route interception', async ({
    page,
    context
  }) => {
    const scenario = scenarios[test.info().project.name as keyof typeof scenarios];
    const auth = await page.request.post(`${gateway}/__test/auth/session`, {
      data: { fixture: scenario.fixture }
    });
    expect(auth.status()).toBe(201);
    const session = (await auth.json()) as { csrfToken: string };
    const sessionCookie = auth.headers()['set-cookie']?.match(/mo_session=([^;]+)/)?.[1];
    expect(sessionCookie).toBeTruthy();
    await context.addCookies([
      { name: 'mo_session', value: sessionCookie!, domain: '127.0.0.1', path: '/' }
    ]);
    await context.addInitScript(
      ({ workspaceId, csrfToken }) => {
        sessionStorage.setItem('markorbit-workspace-id', workspaceId);
        sessionStorage.setItem('markorbit-csrf-token', csrfToken);
      },
      { workspaceId: scenario.workspaceId, csrfToken: session.csrfToken }
    );

    const observedOrderRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/markreg/orders')) observedOrderRequests.push(request.url());
    });

    await page.goto(
      `${markreg}/?view=customer-confirmation&confirmationId=${scenario.confirmationId}&confirmationVersion=3`
    );
    await expect(page.getByRole('heading', { name: 'Create service Order' })).toBeVisible();
    await expect(page.getByText('Payment', { exact: true })).toBeVisible();
    await expect(page.getByText('Filing', { exact: true })).toBeVisible();

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/markreg/orders') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Create Order' }).click();
    expect((await createResponse).status()).toBe(201);
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    expect(page.url()).toContain('view=order');
    const orderUrlV1 = page.url();
    const orderId = new URL(orderUrlV1).searchParams.get('orderId');
    expect(orderId).toMatch(/^order_/);

    const pendingResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/markreg/orders/${orderId}/request-confirmation`) &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Request Order Confirmation' }).click();
    expect((await pendingResponse).status()).toBe(200);
    await expect(page.getByText('PendingConfirmation', { exact: true })).toBeVisible();

    const confirmResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/markreg/orders/${orderId}/confirm`) &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Confirm Order' }).click();
    expect((await confirmResponse).status()).toBe(200);
    await expect(page.getByText('Confirmed', { exact: true })).toBeVisible();

    const readyResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/markreg/orders/${orderId}/evaluate-readiness`) &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Validate Ready for Matter' }).click();
    expect((await readyResponse).status()).toBe(200);
    await expect(page.getByText('ReadyForMatter', { exact: true })).toBeVisible();

    const matterResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/markreg/orders/${orderId}/create-matter`) &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Create Formal Matter' }).click();
    expect((await matterResponse).status()).toBe(200);
    await expect(page.getByText('Formal Matter linked')).toBeVisible();
    await expect(page.getByText(/No external filing has been submitted/)).toBeVisible();
    const durableOrderUrl = page.url();
    expect(durableOrderUrl).toContain('orderVersion=5');

    await page.reload();
    await expect(page.getByText('MatterCreated', { exact: true })).toBeVisible();
    await expect(page.getByText('Formal Matter linked')).toBeVisible();

    const directOrder = await context.newPage();
    await directOrder.goto(durableOrderUrl);
    await expect(directOrder.getByText('MatterCreated', { exact: true })).toBeVisible();
    await directOrder.close();

    const matterLink = page.getByRole('link', { name: 'Open Formal Matter' });
    const matterHref = await matterLink.getAttribute('href');
    expect(matterHref).toContain('view=formal-matter');
    await matterLink.click();
    await expect(page.getByRole('heading', { name: 'formal-matter', exact: true })).toBeVisible();
    await expect(page.getByText(/does not create a payment, invoice/)).toBeVisible();
    const matterUrl = page.url();

    const directMatter = await context.newPage();
    await directMatter.goto(matterUrl);
    await expect(
      directMatter.getByRole('heading', { name: 'formal-matter', exact: true })
    ).toBeVisible();
    await directMatter.close();

    await page.goBack();
    await expect(page.getByText('MatterCreated', { exact: true })).toBeVisible();

    await page.evaluate((otherWorkspaceId) => {
      sessionStorage.setItem('markorbit-workspace-id', otherWorkspaceId);
      dispatchEvent(new PopStateEvent('popstate'));
    }, scenario.otherWorkspaceId);
    await expect(
      page.getByRole('heading', { name: 'No eligible commercial source' })
    ).toBeVisible();
    expect(new URL(page.url()).search).toBe('');

    expect(observedOrderRequests.length).toBeGreaterThanOrEqual(6);
    if (test.info().project.name.includes('mobile')) {
      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth
      }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
});
