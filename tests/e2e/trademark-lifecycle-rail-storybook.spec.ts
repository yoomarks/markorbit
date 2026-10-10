import { expect, test } from '@playwright/test';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  watchPage
} from './helpers/page.js';

const story = (id: string) => `http://127.0.0.1:6020/iframe.html?id=${id}&viewMode=story`;
const usLifecycleStory = story(
  'lite-trademark-asset-lifecycle-rail--us-registered-maintenance-action'
);
const euLifecycleStory = story(
  'lite-trademark-asset-lifecycle-rail--eu-opposition-with-prediction'
);

test('lifecycle rail answers current, next, time class, source, and governed handoff @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await page.goto(usLifecycleStory);

  await expect(page.getByRole('heading', { level: 1, name: 'NORTH STAR' })).toBeVisible();
  await expect(page.getByText('注册后维持')).toBeVisible();
  await expect(page.getByRole('heading', { name: '准备 §8 使用材料（演示建议）' })).toBeVisible();
  await expect(page.getByText('规则计算窗口').first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: '§8 使用宣誓准备' })).toHaveCount(0);
  const currentStage = page.getByRole('button', { name: /第 5 阶段，维持/ });
  await expect(currentStage).toHaveAttribute('aria-current', 'step');
  await capture(page, `trademark-lifecycle-us-overview-${testInfo.project.name}`);
  await page.getByRole('button', { name: '查看要求' }).click();
  await expect(page.getByRole('heading', { level: 3, name: '§8 使用宣誓准备' })).toBeFocused();
  await expect(page.getByText('美国商标记录快照（演示）')).toBeVisible();

  const startingUrl = page.url();
  const startAction = page.getByRole('button', { name: '开始准备（演示）' }).first();
  await startAction.click();
  await expect(page.getByRole('heading', { name: '准备进入受控工作台' })).toBeFocused();
  await expect(page.getByText(/不会自动创建工作、案件、订单、付款或报件/)).toBeVisible();
  await page.getByRole('button', { name: '生成演示交接回执' }).click();
  await expect(page.getByText('已生成演示交接回执')).toBeVisible();
  await expect(page.getByText(/未创建 Work、Matter、Order/)).toBeVisible();
  expect(page.url()).toBe(startingUrl);
  await expect(currentStage).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: '返回资产' }).click();
  await expect(startAction).toBeFocused();

  await expectNoHorizontalOverflow(page);
  await capture(page, `trademark-lifecycle-us-${testInfo.project.name}`);
  assertHealthy();
});

test('390px turns both rails into ordered vertical paths without page overflow @visual', async ({
  page
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile-390'), 'mobile geometry assertion');
  const assertHealthy = watchPage(page);
  await page.goto(usLifecycleStory);

  const activeNavigation = page.getByRole('link', { name: '商标 Trademarks' });
  const activeNavigationBox = await activeNavigation.boundingBox();
  expect(activeNavigationBox).not.toBeNull();
  expect(activeNavigationBox!.x).toBeGreaterThanOrEqual(0);
  expect(activeNavigationBox!.x + activeNavigationBox!.width).toBeLessThanOrEqual(390);

  for (const locator of [
    page.getByRole('heading', { name: '准备 §8 使用材料（演示建议）' }),
    page.getByText('规则计算窗口').first(),
    page.getByText(/2026年11月18日起/).first(),
    page.getByRole('button', { name: '开始准备（演示）' }).first()
  ]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(
      box!.y + box!.height,
      'current and next matter must fit in the 390px first fold'
    ).toBeLessThan(844);
  }

  const stageItems = page.getByRole('list', { name: '商标生命周期阶段' }).getByRole('listitem');
  await expect(stageItems).toHaveCount(5);
  const first = await stageItems.nth(0).boundingBox();
  const second = await stageItems.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height / 2);
  expect(Math.abs(second!.x - first!.x)).toBeLessThan(2);

  await expectNoHorizontalOverflow(page);
  await expectVisibleFocus(page);
  await capture(page, 'trademark-lifecycle-us-mobile-390');
  assertHealthy();
});

test('EU partial data keeps recorded dates separate from prediction and never invents zero', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await page.goto(euLifecycleStory);

  await expect(page.getByText(/当前无法确认异议数量/)).toBeVisible();
  await page.getByRole('button', { name: /第 2 个节点，异议期/ }).click();
  await expect(page.getByText('来源记录结束日期（Lite 未核验）').first()).toBeVisible();
  await page.getByRole('button', { name: /第 4 阶段，注册/ }).click();
  await page.getByRole('button', { name: /第 1 个节点，预计注册/ }).click();
  await expect(page.getByText('MO 预测').first()).toBeVisible();
  await expect(page.getByText('预计 2026年12月').first()).toBeVisible();
  await expect(page.getByText(/不是 EUIPO 承诺、期限或官方日期/)).toBeVisible();
  await expect(page.getByText(/0 oppositions/i)).toHaveCount(0);
  await expect(page.getByText(/0 个异议/)).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
  await capture(page, `trademark-lifecycle-eu-${testInfo.project.name}`);
  assertHealthy();
});
