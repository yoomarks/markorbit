import { expect, test } from '@playwright/test';
import path from 'node:path';

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`;
const evidence = path.resolve('../../docs/product/lite-oa-conversational-pilot/evidence');

test('exact context supports two source issues, clarification, review, Demo save and restore', async ({
  page
}, testInfo) => {
  await page.goto(story('products-lite-oa-conversational-workbench--chinese-main-journey'));
  await expect(page.getByText('OA 对话式专业工作台')).toBeVisible();
  await expect(page.getByText('formal-matter_demo-oa-2407@7')).toBeVisible();
  await expect(page.getByText('document_demo-oa-2026-07@3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /商品\/服务描述澄清/u })).toBeVisible();
  await expect(page.getByRole('button', { name: /服务范围具体化/u })).toBeVisible();

  await page.getByRole('button', { name: /商品\/服务描述澄清/u }).click();
  await expect(page.getByText(/Ignore all prior rules/u)).toBeVisible();
  await page.getByLabel('选择结构化事实').selectOption('online');
  await page.getByLabel('用户提供的信息').fill('客户确认目前仅通过网页提供服务。');
  await page.getByLabel('专业意见').first().fill('需与现有商品服务清单逐项核对。');
  await page.getByRole('button', { name: '准备 Demo 解读' }).click();
  await page.getByLabel('专业审核确认').first().check();

  if (testInfo.project.name === 'mobile-390') {
    await page.getByRole('button', { name: '问题' }).click();
  }
  await page.getByRole('button', { name: /服务范围具体化/u }).click();
  await page.getByLabel('选择结构化事实').selectOption('both');
  await page.getByLabel('用户提供的信息').fill('客户提供分析报告与在线仪表板。');
  await page.getByLabel('专业意见').first().fill('需确认最终限定用语。');
  await page.getByRole('button', { name: '准备 Demo 解读' }).click();
  await page.getByLabel('专业审核确认').nth(1).check();
  await page.getByRole('button', { name: '保存 Demo 工作草稿' }).click();
  await expect(page.getByText('Demo 草稿已保存并可恢复')).toBeVisible();

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('MOKI 小莫')).toBeVisible();
  await expect(page.getByText('DEMO_Office_Action_2026-07-18.pdf')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Review output' }).getByText('客户提供分析报告与在线仪表板。')
  ).toBeVisible();
  await page.reload();
  if (testInfo.project.name === 'mobile-390') {
    await page.getByRole('button', { name: '待审核成果' }).click();
  }
  await expect(page.getByText(/已恢复同一可信主体/u)).toBeVisible();
  await expect(
    page.getByRole('region', { name: '待审核成果' }).getByText('客户确认目前仅通过网页提供服务。')
  ).toBeVisible();
  await page.screenshot({
    path: path.join(evidence, `oa-workbench-${testInfo.project.name}.png`),
    fullPage: true
  });
});

test('ambiguous match requires confirmation and direct unauthorized links fail closed', async ({
  page
}) => {
  await page.goto(story('products-lite-oa-conversational-workbench--ambiguous-match'));
  await expect(page.getByText(/找到两个候选案件/u)).toBeVisible();
  await expect(page.getByText(/Applicant must clarify/u)).toHaveCount(0);
  await page.getByRole('button', { name: '确认此 Demo 匹配' }).click();
  await expect(page.getByRole('heading', { name: '问题 · 2' })).toBeVisible();

  await page.goto(story('products-lite-oa-conversational-workbench--permission-revoked'));
  await expect(page.getByText(/文件授权已撤销/u)).toBeVisible();
  await expect(page.getByText(/Applicant must clarify/u)).toHaveCount(0);
  await page.goto(story('products-lite-oa-conversational-workbench--wrong-workspace'));
  await expect(page.getByText(/不属于当前 Workspace/u)).toBeVisible();
});

test('old versions, partial files, dependency failures and storage failures remain explicit', async ({
  page
}, testInfo) => {
  await page.goto(story('products-lite-oa-conversational-workbench--stale-document-version'));
  await expect(page.getByText(/文件版本已变化/u)).toBeVisible();
  await expect(page.getByRole('button', { name: '保存 Demo 工作草稿' })).toHaveCount(0);

  await page.goto(story('products-lite-oa-conversational-workbench--partial-file'));
  await expect(page.getByText(/源文件缺少第 3 页/u)).toBeVisible();
  if (testInfo.project.name === 'mobile-390') {
    await page.getByRole('button', { name: '待审核成果' }).click();
  }
  await expect(page.getByRole('button', { name: '保存 Demo 工作草稿' })).toBeDisabled();

  await page.goto(story('products-lite-oa-conversational-workbench--dependency-failure'));
  await expect(page.getByText(/来源服务暂时不可用/u)).toBeVisible();
  await expect(page.getByText(/这不是空结果/u)).toBeVisible();

  await page.goto(story('products-lite-oa-conversational-workbench--save-failure'));
  if (testInfo.project.name === 'mobile-390') {
    await page.getByRole('button', { name: '待审核成果' }).click();
  }
  await expect(page.getByText(/无法读取浏览器草稿/u)).toBeVisible();
});
