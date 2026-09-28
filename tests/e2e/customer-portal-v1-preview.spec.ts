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

  await page.getByRole('button', { name: /澄远知识产权/ }).click();
  await page.getByRole('button', { name: /周岚 · 已撤销企业成员/ }).click();
  await expect(page.getByRole('heading', { name: '你没有权限查看这项业务' })).toBeVisible();
  await expect(page.getByText('NOVA 图形商标 · 中国申请')).toHaveCount(0);
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

test('authorized business detail explains service progress and preserves source truth', async ({
  page
}) => {
  await page.getByRole('button', { name: '使用 MO 账号登录' }).click();
  await page.getByRole('button', { name: '去处理: matter-cn-nova-2026' }).click();
  const detail = page.getByRole('dialog', { name: '业务详情' });
  await expect(detail).toContainText('matter-cn-nova-2026');
  await expect(detail).toContainText('正式程序：申请准备 · 资料收集');
  await expect(detail).toContainText('暂无经核实的官方期限');
  await detail.getByRole('button', { name: '提交资料' }).click();
  await expect(page.getByRole('dialog', { name: '补充 NOVA 首次使用说明' })).toContainText(
    'matter-cn-nova-2026'
  );
});

test('H5 has a distinct entry, five touch destinations and no URL-ID authority', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${path}?channel=h5&businessId=matter-atlas-pico-221`);
  await expect(page.getByRole('heading', { name: '继续办理你的商标业务' })).toBeVisible();
  await expect(page.getByText('PICO 文字商标 · 中国申请')).toHaveCount(0);

  await page.getByRole('button', { name: '使用 MO 账号登录' }).click();
  await expect(page.locator('.cp-app')).toHaveAttribute('data-channel', 'h5');
  const navigation = page.getByRole('navigation', { name: '移动端主导航' });
  await expect(navigation.getByRole('button')).toHaveCount(5);
  await testInfo.attach('h5-390-home-zh', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
  if (testInfo.project.name === 'customer-portal-desktop') {
    await page.screenshot({
      path: 'docs/product/site-v1.2-customer-portal/evidence/h5-390-home-zh.png',
      fullPage: true
    });
  }

  await navigation.getByRole('button', { name: '进度' }).click();
  await page.getByRole('button', { name: /NOVA 图形商标 · 中国申请 查看详情/ }).click();
  await expect(page.getByRole('dialog', { name: '业务详情' })).toContainText('matter-cn-nova-2026');
  await testInfo.attach('h5-390-business-detail-zh', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
  if (testInfo.project.name === 'customer-portal-desktop') {
    await page.screenshot({
      path: 'docs/product/site-v1.2-customer-portal/evidence/h5-390-business-detail-zh.png',
      fullPage: true
    });
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false
  );
});

test('captures desktop and mini product review evidence', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '使用 MO 账号登录' }).click();
  await testInfo.attach('web-desktop-home-zh', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
  if (testInfo.project.name === 'customer-portal-desktop') {
    await page.screenshot({
      path: 'docs/product/site-v1.2-customer-portal/evidence/web-desktop-home-zh.png',
      fullPage: true
    });
  }

  await page.goto(`${path}?channel=mini`);
  await page.setViewportSize({ width: 390, height: 844 });
  const navigation = page.getByRole('navigation', { name: '小程序主导航' });
  await navigation.getByRole('button', { name: '消息' }).click();
  await testInfo.attach('mini-390-messages-zh', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
  if (testInfo.project.name === 'customer-portal-desktop') {
    await page.screenshot({
      path: 'docs/product/site-v1.2-customer-portal/evidence/mini-390-messages-zh.png',
      fullPage: true
    });
  }
  await navigation.getByRole('button', { name: '我的' }).click();
  await testInfo.attach('mini-390-profile-zh', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
  if (testInfo.project.name === 'customer-portal-desktop') {
    await page.screenshot({
      path: 'docs/product/site-v1.2-customer-portal/evidence/mini-390-profile-zh.png',
      fullPage: true
    });
  }
});

test('guided registration explains identity boundaries before structured Demo verification', async ({
  page
}) => {
  await page.getByRole('button', { name: /对话式注册引导/ }).click();
  const registration = page.getByRole('dialog', { name: '对话式注册引导' });
  await expect(registration).toContainText('聊天不会核发账号或自动认领已有业务');
  await registration.getByRole('button', { name: '继续' }).click();
  await expect(registration).toContainText('企业主体证明 + 有效授权');
  await registration.getByRole('button', { name: '进入账号设置' }).click();
  await expect(registration).toContainText('不会发送短信、保存密码或绑定微信身份');
  await registration.getByRole('checkbox').check();
  await registration.getByRole('button', { name: '完成 Demo 验证' }).click();
  await expect(page.getByText('matter-cn-nova-2026').first()).toBeVisible();
});

test('conversational filing validates offers, fails safely, produces a Demo receipt and continues cross-channel', async ({
  page
}, testInfo) => {
  await page.goto(`${path}?channel=mini`);
  await page.getByRole('button', { name: '使用已绑定 Demo 身份继续' }).click();
  const navigation = page.getByRole('navigation', { name: '小程序主导航' });
  await navigation.getByRole('button', { name: '办业务' }).click();
  await page
    .getByRole('button', { name: /发起申请/ })
    .first()
    .click();
  const journey = page.getByRole('dialog', { name: '申请办理' });
  await expect(journey).toContainText('聊天文本直接通过');
  await journey.getByLabel('商标名称').fill('NOVA PRIME');
  await journey.getByRole('button', { name: /继续准备资料/ }).click();
  await journey.getByRole('button', { name: /选择 Demo 资料包/ }).click();
  await journey.getByRole('button', { name: /提取并核对/ }).click();
  await journey.getByRole('checkbox').check();
  await journey.getByRole('button', { name: /选择国家与类别/ }).click();
  await journey.getByRole('button', { name: /检查缺失信息/ }).click();
  await expect(journey).toContainText('仍需专业审核');
  await journey.getByRole('button', { name: /生成申请草稿/ }).click();
  await expect(journey).toContainText('draft-us-nova-042');
  await journey.getByRole('button', { name: /查看报价/ }).click();
  await expect(journey).toContainText('澄远知识产权服务（上海）有限公司');
  await expect(journey).toContainText('CNY');

  for (const [code, reason] of [
    ['EXPIRED', '已过期'],
    ['USED', '已经使用'],
    ['CNONLY', '只适用于中国申请'],
    ['STACK2', '不能与当前活动叠加']
  ] as const) {
    await journey.getByLabel('优惠券').fill(code);
    await journey.getByRole('button', { name: '验证' }).click();
    await expect(journey).toContainText(reason);
  }

  await journey.getByLabel('优惠券').fill('SAVE600');
  await journey.getByRole('button', { name: '验证' }).click();
  await expect(journey).toContainText('¥12,200.00');
  await testInfo.attach('portal-v2-quote-coupon-mini-390', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
  if (testInfo.project.name === 'customer-portal-mini-390') {
    await page.screenshot({
      path: 'docs/product/site-v1.2-customer-portal/evidence/v2-mini-390-quote-offer.png',
      fullPage: false
    });
  }
  await journey.getByRole('button', { name: /明确确认并进入付款/ }).click();
  await expect(journey).toContainText('不可手工输入其他商户');
  await journey.getByRole('button', { name: '演示支付失败' }).click();
  await expect(journey.getByRole('alert')).toContainText('未收到款项');
  await journey.getByRole('button', { name: '生成 Demo 支付回执' }).click();
  await expect(journey).toContainText('RCPT-DEMO-2026-0042');
  await expect(journey.getByRole('button', { name: /不可重复付款/ })).toBeDisabled();
  await testInfo.attach('portal-v2-payment-receipt-mini-390', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
  if (testInfo.project.name === 'customer-portal-mini-390') {
    await page.screenshot({
      path: 'docs/product/site-v1.2-customer-portal/evidence/v2-mini-390-payment-receipt.png',
      fullPage: false
    });
  }
  await journey.getByRole('button', { name: '查看同一业务进度' }).click();
  await expect(page.getByText('Demo 回执已生成 · 等待机构专业审核')).toBeVisible();

  await page.goto(`${path}?channel=web&locale=en-US&journey=open&journeyStep=7`);
  const englishJourney = page.getByRole('dialog', { name: 'Application journey' });
  await expect(englishJourney).toContainText('RCPT-DEMO-2026-0042');
  await expect(englishJourney).toContainText('CNY');
  await expect(englishJourney).toContainText('NOVA PRIME');
});

test('expired quote cannot be confirmed or enter payment', async ({ page }) => {
  await page.goto(`${path}?fixture=quote-expired&journey=open&journeyStep=6`);
  await page.getByRole('button', { name: '使用 MO 账号登录' }).click();
  const journey = page.getByRole('dialog', { name: '申请办理' });
  await expect(journey.getByRole('alert')).toContainText('报价已过有效期');
  await expect(journey.getByRole('button', { name: /明确确认并进入付款/ })).toBeDisabled();
});

test('captures the V2 guided quote workbench at each acceptance viewport', async ({
  page
}, testInfo) => {
  await page.goto(`${path}?journey=open&journeyStep=6`);
  await page.getByRole('button', { name: '使用 MO 账号登录' }).click();
  const journey = page.getByRole('dialog', { name: '申请办理' });
  if (testInfo.project.name === 'customer-portal-desktop') {
    await journey.getByLabel('优惠券').fill('SAVE600');
    await journey.getByRole('button', { name: '验证' }).click();
  }
  await page.screenshot({
    path:
      testInfo.project.name === 'customer-portal-desktop'
        ? 'docs/product/site-v1.2-customer-portal/evidence/v2-web-desktop-quote-workbench.png'
        : 'docs/product/site-v1.2-customer-portal/evidence/v2-mini-390-quote-start.png',
    fullPage: false
  });
});
