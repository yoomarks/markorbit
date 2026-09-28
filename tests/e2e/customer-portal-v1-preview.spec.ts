import { expect, test } from '@playwright/test';

const path = '/customer-portal-preview.html';

test.beforeEach(async ({ page }) => {
  await page.goto(path);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test('Web → mini → Web keeps exact object IDs and completed task state', async ({
  page
}, testInfo) => {
  await page.getByRole('button', { name: '使用 MO 账号登录' }).click();
  await expect(page.getByText('matter-cn-nova-2026').first()).toBeVisible();
  await page.getByRole('button', { name: '去处理', exact: true }).first().click();
  await page.getByRole('button', { name: /确认并提交 Demo 资料/ }).click();
  await page.getByRole('button', { name: '去处理', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '确认报价' })).toContainText('quote-us-nova-318');
  await expect(page.getByRole('dialog', { name: '确认报价' })).toContainText('¥12,800.00');
  await page.getByRole('button', { name: '确认此 Demo 报价' }).click();
  await expect(page.getByText('当前无需操作')).toBeVisible();

  await page.getByRole('button', { name: /切换到小程序视图/ }).click();
  await expect(page.locator('.cp-app')).toHaveAttribute('data-channel', 'mini');
  await expect(page.getByText('matter-cn-nova-2026').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '当前无需操作' })).toBeVisible();
  await testInfo.attach('mini-continuity', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });

  await page.getByRole('button', { name: /返回网站视图/ }).click();
  await expect(page.locator('.cp-app')).toHaveAttribute('data-channel', 'web');
  await expect(page.getByText('当前无需操作')).toBeVisible();
});

test('same person has isolated relationships in two Workspaces', async ({ page }) => {
  await page.getByRole('button', { name: '使用 MO 账号登录' }).click();
  await page.getByRole('button', { name: /澄远知识产权/ }).click();
  await page.getByRole('button', { name: /陈玫.*海隅商标事务所/ }).click();
  await expect(page.getByText('LUMA 马德里国际注册')).toBeVisible();
  await expect(page.getByText('NOVA 图形商标 · 中国申请')).toHaveCount(0);
});

test('same-Workspace customers and enterprise object grants fail closed', async ({ page }) => {
  await page.getByRole('button', { name: '使用 MO 账号登录' }).click();
  await page.getByRole('button', { name: /澄远知识产权/ }).click();
  await page.getByRole('button', { name: /刘娅 · 另一位客户/ }).click();
  await expect(page.getByText('PICO 文字商标 · 中国申请')).toBeVisible();
  await expect(page.getByText('NOVA 美国商标检索与申请')).toHaveCount(0);

  await page.getByRole('button', { name: /澄远知识产权/ }).click();
  await page.getByRole('button', { name: /赵霖 · 企业成员/ }).click();
  await expect(page.getByText('NOVA 图形商标 · 中国申请').first()).toBeVisible();
  await expect(page.getByText('NOVA 美国商标检索与申请')).toHaveCount(0);
});

test('lead-only consultation, rejected claim, locale stability and logout protection', async ({
  page
}) => {
  await page.getByRole('button', { name: /先咨询一下/ }).click();
  await page.getByRole('button', { name: /提交 Demo 咨询/ }).click();
  await expect(page.getByText(/尚未建立正式客户关系/)).toBeVisible();
  await expect(page.getByText('NOVA 图形商标 · 中国申请')).toHaveCount(0);

  await page.getByRole('button', { name: '我是已有客户' }).click();
  await page.getByRole('button', { name: '验证并关联' }).click();
  await expect(page.getByRole('alert')).toContainText('未披露任何客户或业务是否存在');

  await page.getByRole('button', { name: '使用 MO 账号登录' }).click();
  await expect(page.getByText('matter-cn-nova-2026').first()).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('matter-cn-nova-2026').first()).toBeVisible();
  await page.locator('.cp-user-button').click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Continue your trademark work' })).toBeVisible();
  await expect(page.getByText('MO-CN-2026-0184')).toHaveCount(0);
});

test('desktop and phone layouts do not overflow', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '使用 MO 账号登录' }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
  await testInfo.attach(`portal-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
});

test('mature mini-program navigation exposes five complete service pages', async ({ page }) => {
  await page.goto(`${path}?channel=mini`);
  await page.getByRole('button', { name: '使用已绑定 Demo 身份继续' }).click();
  const navigation = page.getByRole('navigation', { name: '小程序主导航' });

  await expect(page.getByRole('heading', { name: '常用服务' })).toBeVisible();
  await expect(page.getByText('林顾问正在为你服务')).toBeVisible();
  await navigation.getByRole('button', { name: '办业务' }).click();
  await expect(page.getByRole('heading', { name: '热门服务' })).toBeVisible();
  await navigation.getByRole('button', { name: '进度' }).click();
  await expect(page.getByText(/正式法律程序和官方期限/)).toBeVisible();
  await navigation.getByRole('button', { name: '消息' }).click();
  await expect(page.getByRole('button', { name: /顾 顾问消息/ })).toBeVisible();
  await navigation.getByRole('button', { name: '我的' }).click();
  await expect(page.getByText('我的业务与资料')).toBeVisible();
  await expect(page.getByText('账户与服务')).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false
  );
});
