import { expect, test } from '@playwright/test';
import path from 'node:path';

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`;
const evidence = path.resolve('../../docs/product/lite-trading-creative-pilot/evidence');

test('exact source journey supports visible revision, comparison, locale stability and Demo restore', async ({
  page
}, testInfo) => {
  await page.goto(story('products-lite-orbit-trading-studio--seller-validation-prototype'));
  await expect(page.getByText('商标视觉美化工作台')).toBeVisible();
  await expect(page.getByText('trademark-asset_story@4', { exact: true })).toBeVisible();
  await expect(page.getByText('demo-visual@1', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Focused operator · SVG 布局示意/ })).toBeVisible();

  await page
    .getByRole('textbox', { name: '待处理修改意见', exact: true })
    .fill('让图形旋转并加入动画');
  await page.getByLabel('使用场景').selectOption('WEB');
  await page.getByLabel('颜色气质').selectOption('WARM');
  await page.getByRole('button', { name: '应用结构化 Demo 调整' }).click();
  await expect(page.getByText('demo-visual@2', { exact: true })).toBeVisible();
  await expect(page.getByText(/修改意见已作为待处理文本保存/)).toBeVisible();
  await page.getByRole('button', { name: '版本对比' }).click();
  await expect(page.getByLabel('Demo 版本对比')).toBeVisible();
  await expect(page.getByRole('img', { name: 'SVG 布局示意 Demo 版本 1' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'SVG 布局示意 Demo 版本 2' })).toBeVisible();

  await page.getByRole('button', { name: '保存 Demo 草稿' }).click();
  await expect(page.getByText(/个人 Demo 草稿/)).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('trademark-asset_story@4', { exact: true })).toBeVisible();
  await expect(page.getByText('demo-visual@2', { exact: true })).toBeVisible();
  await expect(page.getByText('No model call · No charge', { exact: true })).toBeVisible();
  await expect(page.getByText('让图形旋转并加入动画').first()).toBeVisible();
  await expect(page.getByText('Commercial Value Map')).toBeVisible();
  await page.getByRole('button', { name: 'Commercial story' }).click();
  await expect(page.getByText('Workspace facts')).toBeVisible();
  await expect(page.getByText('Not published', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Release boundary' }).click();
  await expect(page.getByText('Needs attention — no destination is connected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publication not enabled' })).toBeDisabled();

  await page.reload();
  await expect(page.getByText(/已恢复此 Workspace/)).toBeVisible();
  await expect(page.getByText('demo-visual@2', { exact: true })).toBeVisible();
  await expect(page.getByText('让图形旋转并加入动画').first()).toBeVisible();

  await page.screenshot({
    path: path.join(evidence, `after-workbench-${testInfo.project.name}.png`),
    fullPage: true
  });
});

test('direction comparison exposes three distinct hero and board images', async ({ page }) => {
  await page.goto(story('products-lite-orbit-trading-studio--creative-directions-with-visuals'));
  await expect(
    page.getByRole('img', { name: /Focused operator · SVG 主视觉布局示意/ })
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Premium system · SVG 主视觉布局示意/ })
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Category creator · SVG 主视觉布局示意/ })
  ).toBeVisible();
  await expect(page.getByRole('img', { name: /SVG 资产拼图布局示意/ })).toHaveCount(3);
  await expect(page.getByText(/^确定性 SVG 布局示意 · 未渲染原始商标/)).toHaveCount(3);
});

test('negative states remain explicit and do not claim payment, generation, or publication', async ({
  page
}) => {
  await page.goto(story('products-lite-orbit-trading-studio--creative-qa-failed'));
  await expect(page.getByText('Demo 视觉质检 · 未通过')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存 Demo 草稿' })).toBeDisabled();
  await expect(page.getByText(/未调用模型/)).toBeVisible();

  await page.goto(story('products-lite-orbit-trading-studio--permission-denied'));
  await expect(page.getByText('Studio access unavailable')).toBeVisible();

  await page.goto(story('products-lite-orbit-trading-studio--stale'));
  await expect(page.getByText('Source version is stale')).toBeVisible();
  await expect(page.getByRole('button', { name: /Choose/ }).first()).toBeDisabled();
});

test("trusted users do not restore each other's browser draft and storage failure stays usable", async ({
  page
}) => {
  await page.goto(story('products-lite-orbit-trading-studio--creative-user-a'));
  await page
    .getByRole('textbox', { name: '待处理修改意见', exact: true })
    .fill('仅属于浏览器用户 A');
  await page.getByRole('button', { name: '保存 Demo 草稿' }).click();
  await page.goto(story('products-lite-orbit-trading-studio--creative-user-b'));
  await expect(page.getByText('仅属于浏览器用户 A')).toHaveCount(0);
  await page.goto(story('products-lite-orbit-trading-studio--creative-user-a'));
  await expect(page.getByText('仅属于浏览器用户 A').first()).toBeVisible();

  await page.goto(story('products-lite-orbit-trading-studio--creative-storage-unavailable'));
  await expect(page.getByText(/无法读取浏览器草稿/)).toBeVisible();
  await page.getByLabel('颜色气质').selectOption('WARM');
  await page.getByRole('button', { name: '保存 Demo 草稿' }).click();
  await expect(page.getByText(/浏览器存储不可用/)).toBeVisible();
  await expect(page.getByText('demo-visual@2', { exact: true })).toBeVisible();
});

test('captures the implementation baseline before the creative Preview', async ({
  page
}, testInfo) => {
  await page.goto(story('products-lite-orbit-trading-studio--ready-to-choose'));
  await expect(page.getByText('Orbit Studio directions')).toBeVisible();
  await page.screenshot({
    path: path.join(evidence, `before-direction-cards-${testInfo.project.name}.png`),
    fullPage: true
  });
});
