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
  await page.getByRole('button', { name: '继续办理', exact: true }).click();
  await page.getByRole('button', { name: /确认资料用途并提交 Demo/ }).click();
  await expect(page.getByText('当前没有待办')).toBeVisible();

  await page.getByRole('button', { name: /切换到小程序视图/ }).click();
  await expect(page.locator('.cp-app')).toHaveAttribute('data-channel', 'mini');
  await expect(page.getByText('matter-cn-nova-2026').first()).toBeVisible();
  await expect(page.getByText('当前没有待办')).toBeVisible();
  await testInfo.attach('mini-continuity', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });

  await page.getByRole('button', { name: /返回网站视图/ }).click();
  await expect(page.locator('.cp-app')).toHaveAttribute('data-channel', 'web');
  await expect(page.getByText('当前没有待办')).toBeVisible();
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
  await page.getByRole('button', { name: /刘娅 · other customer/ }).click();
  await expect(page.getByText('PICO 文字商标 · 中国申请')).toBeVisible();
  await expect(page.getByText('NOVA 美国商标检索与申请')).toHaveCount(0);

  await page.getByRole('button', { name: /澄远知识产权/ }).click();
  await page.getByRole('button', { name: /赵霖 · enterprise grant/ }).click();
  await expect(page.getByText('NOVA 图形商标 · 中国申请').first()).toBeVisible();
  await expect(page.getByText('NOVA 美国商标检索与申请')).toHaveCount(0);
});

test('lead-only consultation, rejected claim, locale stability and logout protection', async ({
  page
}) => {
  await page.getByRole('button', { name: /先提交咨询/ }).click();
  await page.getByRole('button', { name: /提交 Demo 咨询/ }).click();
  await expect(page.getByText('线索状态 · 尚未建立客户关系')).toBeVisible();
  await expect(page.getByText('NOVA 图形商标 · 中国申请')).toHaveCount(0);

  await page.getByRole('button', { name: '关联已有客户关系' }).click();
  await page.getByRole('button', { name: '验证并关联' }).click();
  await expect(page.getByRole('alert')).toContainText('未披露任何客户或业务是否存在');

  await page.getByRole('button', { name: '使用 MO 账号登录' }).click();
  await expect(page.getByText('matter-cn-nova-2026').first()).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('matter-cn-nova-2026').first()).toBeVisible();
  await page
    .getByRole('button', { name: /Account & company/ })
    .first()
    .click();
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
