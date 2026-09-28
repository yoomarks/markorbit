import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const evidence = resolve(process.cwd(), 'docs/ui/workspace-console-v1/evidence');

test('Chinese owner overview presents institution context without invented metrics', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/?lang=zh&page=overview');
  await expect(page.getByRole('heading', { name: '林岚，上午好' })).toBeVisible();
  await expect(page.getByText('当前机构空间')).toBeVisible();
  await expect(page.getByText('客户', { exact: true })).toBeVisible();
  await expect(page.getByText(/交易额|系统健康|营收/)).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/workspace-overview-zh-desktop.png`, fullPage: true });
});

test('English owner overview is complete and review boundaries stay visible', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/?lang=en&page=overview');
  await expect(page.getByRole('heading', { name: 'Good morning, Lan' })).toBeVisible();
  await expect(page.getByText('Independent review prototype')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Products', exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidence}/workspace-overview-en-desktop.png`, fullPage: true });
});

test('mobile 390 layout exposes bottom navigation and keeps owner decisions readable', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await page.goto('/?lang=zh&page=overview');
  await expect(page.getByLabel('移动端主导航')).toBeVisible();
  await expect(page.getByText('需要你处理')).toBeVisible();
  await expect(page.locator('.sidebar')).toBeHidden();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: `${evidence}/workspace-overview-zh-mobile-390.png`,
    fullPage: true
  });
  await page.goto('/?lang=zh&page=products');
  await expect(page.getByRole('heading', { name: '产品' })).toBeVisible();
  await page.screenshot({
    path: `${evidence}/workspace-products-zh-mobile-390.png`,
    fullPage: true
  });
});

test('resource, product and team IA render as distinct owner-facing workspaces', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/?lang=zh&page=resources');
  await expect(page.getByText('资源目录不是新的数据库')).toBeVisible();
  await page.screenshot({ path: `${evidence}/workspace-resources-zh-desktop.png`, fullPage: true });
  await page.goto('/?lang=zh&page=products');
  await expect(page.getByText('全部 Site')).toBeVisible();
  await page.screenshot({ path: `${evidence}/workspace-products-zh-desktop.png`, fullPage: true });
  await page.goto('/?lang=zh&page=team');
  await expect(page.getByText('成员角色不是全部权限')).toBeVisible();
  await page.screenshot({ path: `${evidence}/workspace-team-zh-desktop.png`, fullPage: true });
});

test('profile, invitation and Site flows disclose preview-only state', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/?lang=zh&page=overview');
  await page.getByRole('button', { name: '完善机构资料' }).click();
  await expect(page.getByRole('dialog')).toContainText('个人执业者无需填写虚构公司');
  await page.getByRole('button', { name: '保存评审结果' }).click();
  await expect(page.locator('.toast')).toContainText('未写入 Core');

  await page.goto('/?lang=zh&page=team');
  await page.getByRole('button', { name: '邀请成员' }).click();
  await expect(page.getByRole('dialog')).toContainText('邀请接受后才形成成员关系');
  await page.getByLabel('邮箱').fill('new.member@example.cn');
  await page.getByRole('button', { name: '发送模拟邀请' }).click();
  await expect(page.locator('.toast')).toContainText('尚未形成正式成员关系');

  await page.goto('/?lang=zh&page=products');
  await page.getByRole('button', { name: '创建 Site' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('不写入 Site Owner');
  await page.getByRole('button', { name: '创建模拟 Site' }).click();
  await expect(page.getByText('国际业务入口')).toBeVisible();
});

test('employee Lite view contains only explicitly assigned customer context', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/?lang=zh&page=lite&persona=employee');
  await expect(page.getByText('权限已筛选')).toBeVisible();
  await expect(page.getByText('远海科技（上海）有限公司')).toBeVisible();
  await expect(page.getByText('北辰消费品有限公司')).toHaveCount(0);
  await expect(page.getByText('澄光生物科技有限公司')).toHaveCount(0);
});

test('revoked external link fails closed and leaks no other resource names', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/?lang=zh&page=shared&access=revoked');
  await expect(page.getByRole('heading', { name: '此访问链接已失效' })).toBeVisible();
  await expect(page.getByText('链接本身不构成访问权限')).toBeVisible();
  await expect(page.getByText('远海科技（上海）有限公司')).toHaveCount(0);
  await expect(page.getByText('北辰消费品有限公司')).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/workspace-revoked-link-zh.png`, fullPage: true });
});
