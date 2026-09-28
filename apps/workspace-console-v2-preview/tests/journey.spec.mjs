import { test, expect } from '@playwright/test';

test('owner buys Site, creates two instances, assigns access, inspects bill and enters Site Admin', async ({
  page
}) => {
  await page.goto('/?page=products');
  await page.getByRole('button', { name: '开通 Site' }).click();
  await expect(page.getByText('不适用：已有 Lite 团队协议')).toBeVisible();
  await page.getByRole('button', { name: '确认评审开通' }).click();
  await expect(page.getByText('Commercial Agreement')).toBeVisible();
  for (const name of ['澄知官方网站', '澄知微信小程序']) {
    await page.getByRole('button', { name: '创建 Site' }).first().click();
    await page.locator('#siteName').fill(name);
    await page.getByRole('button', { name: '创建评审 Site' }).click();
  }
  await expect(page.getByText('2/3').first()).toBeVisible();
  await page.getByRole('button', { name: '分配管理员' }).first().click();
  await page.getByRole('button', { name: '确认分配' }).click();
  await expect(page.getByText('已分配', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '财务' }).click();
  await page.getByRole('button', { name: '详情' }).click();
  await expect(page.getByText('资金记录详情')).toBeVisible();
  await page.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '产品' }).click();
  await page.getByRole('button', { name: '进入管理' }).first().click();
  await expect(page.locator('#live')).toContainText('Site Admin');
});

test('negative states fail closed and do not invent payment authority', async ({ page }) => {
  await page.goto('/?page=products&purchased=1');
  for (const [button, result] of [
    ['支付失败', 'FAILED'],
    ['续费到期', 'EXPIRED'],
    ['成员无权限', 'PERMISSION_DENIED']
  ]) {
    await page.getByRole('button', { name: button }).click();
    await expect(page.getByText(result)).toBeVisible();
    await page.getByRole('button', { name: '关闭' }).click();
  }
  await page.getByRole('button', { name: '财务' }).click();
  await page.getByRole('button', { name: '收款配置' }).click();
  await page.getByRole('button', { name: '查看不匹配错误' }).click();
  await expect(page.getByText('已阻止保存')).toBeVisible();
  await expect(page.getByText(/显示名称不会取得|显示品牌/)).toBeVisible();
});

test('English is complete and mobile has no horizontal page overflow', async ({
  page
}, testInfo) => {
  await page.goto('/?lang=en&page=finance&tab=collection&purchased=1');
  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();
  await expect(page.getByText('One place to inspect, never one available balance.')).toBeVisible();
  if (testInfo.project.name === 'mobile-390') {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  }
});
