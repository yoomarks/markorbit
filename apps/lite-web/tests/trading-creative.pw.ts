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
  await expect(
    page.getByRole('img', { name: /Focused operator PACKAGING Demo version 1/ })
  ).toBeVisible();

  await page.getByRole('button', { name: '生成 Demo 调整版' }).click();
  await expect(page.getByText('demo-visual@2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '版本对比' }).click();
  await expect(page.getByLabel('Demo version comparison')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Demo version 1' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Demo version 2' })).toBeVisible();

  await page.getByRole('button', { name: '保存 Demo 草稿' }).click();
  await expect(page.getByText(/Demo 草稿已保存在此浏览器/)).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('trademark-asset_story@4', { exact: true })).toBeVisible();
  await expect(page.getByText('demo-visual@2', { exact: true })).toBeVisible();
  await expect(page.getByText('No model call · No charge', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(/已恢复此 Workspace/)).toBeVisible();
  await expect(page.getByText('demo-visual@2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publication not enabled' })).toBeDisabled();

  await page.screenshot({
    path: path.join(evidence, `after-workbench-${testInfo.project.name}.png`),
    fullPage: true
  });
});

test('direction comparison exposes three distinct hero and board images', async ({ page }) => {
  await page.goto(story('products-lite-orbit-trading-studio--creative-directions-with-visuals'));
  await expect(page.getByRole('img', { name: /Focused operator Demo hero visual/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Premium system Demo hero visual/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Category creator Demo hero visual/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Demo asset board/ })).toHaveCount(3);
});

test('negative states remain explicit and do not claim payment, generation, or publication', async ({
  page
}) => {
  await page.goto(story('products-lite-orbit-trading-studio--creative-qa-failed'));
  await expect(page.getByText('Demo Visual QA · failed')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存 Demo 草稿' })).toBeDisabled();
  await expect(page.getByText(/未调用模型/)).toBeVisible();

  await page.goto(story('products-lite-orbit-trading-studio--permission-denied'));
  await expect(page.getByText('Studio access unavailable')).toBeVisible();

  await page.goto(story('products-lite-orbit-trading-studio--stale'));
  await expect(page.getByText('Source version is stale')).toBeVisible();
  await expect(page.getByRole('button', { name: /Choose/ }).first()).toBeDisabled();
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
