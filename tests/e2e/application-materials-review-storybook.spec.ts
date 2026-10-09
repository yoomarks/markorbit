import { expect, test } from '@playwright/test';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  watchPage
} from './helpers/page.js';

const story = (id: string) => `http://127.0.0.1:6019/iframe.html?id=${id}&viewMode=story`;

test('M21 exposes conflict provenance and prepares only unsent questions @visual', async ({
  page
}, testInfo) => {
  const assertClean = watchPage(page);
  await page.goto(story('markreg-m21-application-materials-review--partial-review-with-conflict'));

  await expect(page.getByRole('heading', { level: 1, name: '申请资料核对' })).toBeVisible();
  await expect(page.getByText('演示数据 · Fixture only')).toBeVisible();
  await expect(page.getByText('仅用于资料准备；未形成法律意见，未提交申请。')).toBeVisible();
  await expect(page.getByText('Orbit Atlas LLC')).toBeVisible();
  await expect(page.getByText('Orbit Atlas Inc.')).toBeVisible();
  await expect(page.getByText(/MO 不会自动选择/)).toBeVisible();

  await page.getByRole('button', { name: /生成待问清单/ }).click();
  await expect(page.getByRole('heading', { name: '待问清单（草稿，未发送）' })).toBeVisible();
  await expect(page.getByText('不会自动发送')).toBeVisible();
  await expect(page.getByText(/不会创建站内信、邮件、客户通知/)).toBeVisible();

  await expectVisibleFocus(page);
  await expectNoHorizontalOverflow(page);
  await capture(page, `m21-${testInfo.project.name}-partial-conflict`);
  assertClean();
});

test('M21 handler handoff remains an explicit non-filing preview @visual', async ({
  page
}, testInfo) => {
  const assertClean = watchPage(page);
  await page.goto(story('markreg-m21-application-materials-review--ready-for-handler-review'));

  const handoff = page.getByRole('button', { name: /提交经办复核/ });
  await expect(handoff).toBeEnabled();
  await handoff.click();
  await expect(page.getByRole('heading', { name: '确认提交经办复核？' })).toBeVisible();
  await expect(page.getByText(/这不是专业复核结论，不改变 Matter Draft，也不会报件/)).toBeVisible();
  await page.getByRole('button', { name: '确认提交经办复核（演示）' }).click();
  await expect(page.getByText('已记录经办复核请求（界面演示）')).toBeVisible();
  await expect(page.getByText(/未创建或推进 Professional Review owner 状态/)).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await capture(page, `m21-${testInfo.project.name}-handoff-preview`);
  assertClean();
});
