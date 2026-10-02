import { expect, test } from '@playwright/test';

test('direct preview supports the complete bounded creative journey', async ({ page }) => {
  await page.goto('/trading-studio-preview.html');

  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Orbit Studio 方向' })).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Focused operator · SVG 主视觉布局示意/ })
  ).toBeVisible();

  await page.getByRole('button', { name: '制作此方向' }).click();
  await expect(page.getByText('商标视觉美化工作台')).toBeVisible();
  await page
    .getByRole('textbox', { name: '待处理修改意见', exact: true })
    .fill('保留原图样，只调整展示背景');
  await page.getByLabel('使用场景').selectOption('WEB');
  await page.getByLabel('颜色气质').selectOption('WARM');
  await page.getByRole('button', { name: '应用结构化 Demo 调整' }).click();
  await expect(page.getByText('demo-visual@2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '版本对比' }).click();
  await expect(page.getByLabel('Demo 版本对比')).toBeVisible();
  await page.getByRole('button', { name: '保存 Demo 草稿' }).click();
  await expect(page.getByText(/个人 Demo 草稿/)).toBeVisible();
  await expect(page.getByText(/未调用模型/)).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: '制作此方向' }).click();
  await expect(page.getByText(/已恢复此 Workspace/)).toBeVisible();
  await expect(page.getByText('保留原图样，只调整展示背景').first()).toBeVisible();
});

test('direct preview can make an explicit fixture selection', async ({ page }) => {
  await page.goto('/trading-studio-preview.html?scenario=DIRECTIONS');
  await page.getByRole('button', { name: '选择 最佳匹配' }).click();
  await expect(page.getByText('已选方向', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '制作此方向' })).toBeVisible();
});

test('negative fixture states remain explicit and fail closed', async ({ page }) => {
  await page.goto('/trading-studio-preview.html?scenario=QA_FAILED');
  await page.getByRole('button', { name: '制作此方向' }).click();
  await expect(page.getByText('Demo 视觉质检 · 未通过')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存 Demo 草稿' })).toBeDisabled();

  await page.goto('/trading-studio-preview.html?scenario=STALE');
  await expect(page.getByText('来源版本已过期')).toBeVisible();
  await expect(page.getByRole('button', { name: '制作此方向' })).toBeDisabled();

  await page.goto('/trading-studio-preview.html?scenario=PERMISSION');
  await expect(page.getByRole('heading', { name: 'Studio 访问不可用' })).toBeVisible();

  await page.goto('/trading-studio-preview.html?scenario=STORAGE_FAILURE');
  await page.getByRole('button', { name: '制作此方向' }).click();
  await expect(page.getByText(/无法读取浏览器草稿/)).toBeVisible();
  await page.getByRole('button', { name: '保存 Demo 草稿' }).click();
  await expect(page.getByText(/浏览器存储不可用/)).toBeVisible();
});

test('390px preview remains single-column and free of horizontal overflow', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  await page.goto('/trading-studio-preview.html');
  await page.getByRole('button', { name: '制作此方向' }).click();
  await expect(page.getByText('商标视觉美化工作台')).toBeVisible();
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
});
