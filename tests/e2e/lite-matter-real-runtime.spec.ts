import { expect, test } from '@playwright/test';
const gateway = 'http://127.0.0.1:4400',
  lite = 'http://127.0.0.1:4471';
const workspaceId = '66666666-6666-4666-8666-666666666666',
  otherWorkspaceId = '77777777-7777-4777-8777-777777777777';
test.describe('TASK 023 real durable Lite Matter path', () => {
  test('uses real authenticated list/detail with URL recovery and no interception', async ({
    page
  }) => {
    // Deliberately observe requests only: this suite never registers page/context routing or fulfills a response.
    const matterRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/markreg/formal-matters')) matterRequests.push(r.url());
    });
    const auth = await page.request.post(`${gateway}/__test/auth/session`, {
      data: { fixture: 'task023' }
    });
    expect(auth.status()).toBe(201);
    await page.goto(`${lite}/?workspaceId=${workspaceId}#matters`);
    await expect(page.getByRole('heading', { name: 'Matters' })).toBeVisible();
    await expect(page.getByText('DURABLE ORBIT')).toBeVisible();
    await page.getByLabel('Search Matters').fill('Northstar');
    await page.getByLabel('Status').selectOption('OPEN');
    await page.getByLabel('Matter type').selectOption('TRADEMARK_REGISTRATION');
    await expect(page).toHaveURL(/search=Northstar/);
    const open = page.getByRole('button', { name: 'View Matter details' });
    const formalMatterId = await open.getAttribute('data-matter-id');
    expect(formalMatterId).toMatch(/^formal-matter_/);
    await open.click();
    await expect(page.getByText(formalMatterId!, { exact: true })).toBeVisible();
    await expect(page.getByText(/confirmation_task023 · v1/)).toBeVisible();
    await expect(page.getByText(/matter-draft_task023 · v1/)).toBeVisible();
    await expect(page.getByText(/quote_task023 · vquote-v23/)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/search=Northstar/);
    await expect(page.getByLabel('Status')).toHaveValue('OPEN');
    await expect(open).toBeFocused();
    await open.click();
    const detailUrl = page.url();
    await page.reload();
    await expect(page.getByText(formalMatterId!, { exact: true })).toBeVisible();
    const direct = await page.context().newPage();
    await direct.goto(detailUrl);
    await expect(direct.getByText(formalMatterId!, { exact: true })).toBeVisible();
    await direct.close();
    await page.evaluate((other) => {
      const q = new URLSearchParams(location.search);
      q.set('workspaceId', other);
      history.pushState(null, '', `${location.pathname}?${q}#matters`);
      dispatchEvent(new PopStateEvent('popstate'));
    }, otherWorkspaceId);
    await expect(page).not.toHaveURL(/formalMatterId=/);
    await expect(page.getByText('No Matters found')).toBeVisible();
    expect(matterRequests.length).toBeGreaterThanOrEqual(5);
    if (test.info().project.name.includes('mobile')) {
      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth
      }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
});
