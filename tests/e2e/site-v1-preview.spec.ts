import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('markorbit:site-v1-preview:admin-locale', 'en-US');
  });
});

test('Golden A: editor draft remains private until demo publication and survives direct navigation', async ({
  page
}, testInfo) => {
  await page.goto('/admin/atlas/editor');
  await expect(page.getByRole('heading', { name: 'Design' })).toBeVisible();
  await page.getByLabel('内容语言 / Content language').selectOption('en-US');
  const heading = page.getByLabel('Heading');
  await heading.fill('A portfolio-ready trademark strategy');
  await expect(page.getByText('Draft has unpublished changes')).toBeVisible();
  await page.getByRole('button', { name: 'Published v1' }).click();
  await expect(page.getByText('A portfolio-ready trademark strategy')).toHaveCount(0);
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  await page.getByRole('button', { name: 'Review & publish' }).click();
  await page.getByRole('button', { name: 'Publish demo v2' }).click();
  await page.goto('/site/atlas/en-US/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'A portfolio-ready trademark strategy' })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'A portfolio-ready trademark strategy' })
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('golden-a-published.png'), fullPage: true });
});

test('Golden B/C: content source becomes the exact demo lead and remains tenant isolated', async ({
  page
}, testInfo) => {
  await page.goto('/site/atlas/en-US/insights/filing-map-before-expansion');
  await page.getByRole('link', { name: 'Explore and inquire' }).click();
  await page.getByRole('link', { name: 'Ask about this service' }).click();
  await expect(page.getByText('Source preserved:')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Your name').fill('Maya Chen');
  await page.getByLabel('Organization').fill('Orbit Labs');
  await page.getByLabel('Work email').fill('maya@example.com');
  await page
    .getByLabel('What are you trying to decide?')
    .fill('We need a filing sequence for three markets.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/I understand/).check();
  await page.getByRole('button', { name: 'Submit demo inquiry' }).click();
  await expect(page.getByText('DEMO-LEAD-0001')).toBeVisible();
  await page.getByRole('link', { name: 'Find this lead in Site Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Maya Chen · Orbit Labs' })).toBeVisible();
  await expect(page.getByText('content-filing-map')).toBeVisible();
  await page.goto('/admin/foundry/leads');
  await expect(page.getByRole('heading', { name: 'No inquiries yet' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('golden-bc-isolation.png'), fullPage: true });
});

test('history, validation, version restore, and both templates work', async ({ page }) => {
  await page.goto('/site/atlas/en-US/contact');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Error: Enter your name.')).toBeVisible();
  await page.goto('/site/foundry/en-US/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'A better way to explore brand assets.' })
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Tell us what decision is ahead.' })
  ).toBeVisible();
  await page.goto('/admin/atlas/editor');
  await page.getByLabel('Heading').fill('Temporary draft');
  await page.getByRole('button', { name: 'Restore to draft' }).first().click();
  await expect(page.getByText('Version 1 restored into a new draft')).toBeVisible();
});

test('negative boundaries: consent, VIEWER mutation, hidden route, and Workspace isolation', async ({
  page
}) => {
  await page.goto('/site/atlas/en-US/contact');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Your name').fill('Boundary Test');
  await page.getByLabel('Work email').fill('boundary@example.com');
  await page
    .getByLabel('What are you trying to decide?')
    .fill('Confirm that consent is mandatory.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Submit demo inquiry' }).click();
  await expect(
    page.getByText('Error: Confirm the demo-only consent before submitting.')
  ).toBeVisible();
  await page.getByLabel(/I understand/).check();
  await page.getByRole('button', { name: 'Submit demo inquiry' }).click();
  await page.getByRole('link', { name: 'Find this lead in Site Admin' }).click();

  await page.evaluate(() => {
    const key = 'markorbit:site-v1-preview:site:site_atlas_demo';
    const state = JSON.parse(localStorage.getItem(key) ?? '{}');
    state.role = 'VIEWER';
    state.published.pages = state.published.pages.map((item: { id: string; visible: boolean }) =>
      item.id === 'services' ? { ...item, visible: false } : item
    );
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mark qualified' })).toBeDisabled();
  await page.goto('/site/atlas/en-US/services');
  await expect(
    page.getByRole('heading', { name: 'This page is outside the orbit.' })
  ).toBeVisible();
  await page.goto('/admin/foundry/leads');
  await expect(page.getByRole('heading', { name: 'No inquiries yet' })).toBeVisible();
});

test('one Workspace operates isolated Web and mini-program Sites', async ({ page }, testInfo) => {
  await page.goto('/admin/atlas/sites');
  await expect(page.getByRole('heading', { name: 'My Sites' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('my-sites-en.png'), fullPage: true });
  await page.getByRole('button', { name: '简体中文' }).click();
  await expect(page.getByRole('heading', { name: '我的 Site' })).toBeVisible();
  await expect(page.getByText('Atlas 官方网站')).toBeVisible();
  await expect(page.getByText('Atlas 微信小程序')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('my-sites-zh.png'), fullPage: true });

  await page.getByRole('link', { name: /管理 Atlas 官方网站/u }).click();
  await page.getByRole('link', { name: '装修首页', exact: true }).click();
  await page.getByLabel('内容语言 / Content language').selectOption('zh-CN');
  await page.getByLabel('标题').fill('只发布到官方网站的首页');
  await page.getByRole('button', { name: '检查并发布' }).click();
  await page.getByRole('button', { name: /发布演示 v2/u }).click();

  await page.getByLabel('当前 Site').selectOption('site_atlas_mini_demo');
  await expect(page.getByText('小程序触屏预览')).toBeVisible();
  await expect(page.getByRole('button', { name: '已发布 v1' })).toBeVisible();
  await expect(page.getByText('只发布到官方网站的首页')).toHaveCount(0);
  if (testInfo.project.name === 'site-v1-mobile-390') {
    const width = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
      canvas: document.querySelector('.editor-canvas')?.scrollWidth ?? 0
    }));
    expect(width.page).toBeLessThanOrEqual(width.viewport);
    expect(width.canvas).toBeLessThanOrEqual(width.viewport);
  }
  await page.screenshot({ path: testInfo.outputPath('mini-editor-zh.png'), fullPage: true });
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('Mini-program touch preview')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mini-editor-en.png'), fullPage: true });
  await page.getByRole('button', { name: '简体中文' }).click();

  await page.goto('/site/site_atlas_mini_demo/en-US/contact');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Your name').fill('Mini Channel Lead');
  await page.getByLabel('Work email').fill('mini@example.com');
  await page
    .getByLabel('What are you trying to decide?')
    .fill('Keep the mini-program inquiry source separate from the website.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/I understand/).check();
  await page.getByRole('button', { name: 'Submit demo inquiry' }).click();
  await page.getByRole('link', { name: 'Find this lead in Site Admin' }).click();
  await expect(page.getByText('site_atlas_mini_demo / atlas')).toBeVisible();
  await expect(page.getByText('微信小程序', { exact: true })).toBeVisible();
  await expect(page.getByText('尚未关联，仅为线索')).toBeVisible();

  await page.evaluate(() => {
    const key = 'markorbit:site-v1-preview:site:site_atlas_mini_demo';
    const state = JSON.parse(localStorage.getItem(key) ?? '{}');
    state.role = 'NONE';
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.goto('/admin/site_atlas_mini_demo/content/content-clearance');
  await expect(page.getByRole('heading', { name: '无权访问此 Site' })).toBeVisible();
  await expect(page.getByLabel('标题')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('site-access-denied-zh.png'), fullPage: true });
});

test('plain-language navigation reveals the expected Admin and visitor tasks', async ({
  page
}, testInfo) => {
  const openAdminPage = async (label: string) => {
    const menu = page.getByRole('button', { name: '打开导航' });
    if (await menu.isVisible()) await menu.click();
    await page
      .getByRole('navigation', { name: '站点后台导航' })
      .getByRole('link', { name: label, exact: true })
      .click();
  };
  const openWebsiteMenu = async () => {
    const menu = page.getByRole('button', { name: '菜单' });
    if (await menu.isVisible()) await menu.click();
  };

  await page.goto('/admin/atlas/overview');
  await page.getByRole('button', { name: '简体中文' }).click();
  await openAdminPage('装修');
  await expect(page.getByRole('heading', { name: '装修' })).toBeVisible();
  await openAdminPage('文章');
  await expect(page.getByRole('heading', { name: '文章' })).toBeVisible();
  await openAdminPage('咨询');
  await expect(page.getByRole('heading', { name: '咨询', exact: true })).toBeVisible();
  const adminMenu = page.getByRole('button', { name: '打开导航' });
  if (await adminMenu.isVisible()) {
    await adminMenu.click();
    await page.waitForTimeout(250);
  }
  await page.screenshot({
    path: testInfo.outputPath('plain-admin-navigation.png'),
    fullPage: true
  });

  await page.goto('/site/atlas/zh-CN/');
  await openWebsiteMenu();
  const atlasNavigation = page.getByRole('navigation', { name: '网站导航' });
  await expect(atlasNavigation.getByRole('link', { name: '服务', exact: true })).toBeVisible();
  await expect(atlasNavigation.getByRole('link', { name: '文章', exact: true })).toBeVisible();
  await expect(atlasNavigation.getByRole('link', { name: '联系我们', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('plain-front-navigation.png'),
    fullPage: true
  });
  await atlasNavigation.getByRole('link', { name: '我的', exact: true }).click();
  await expect(page.getByRole('heading', { name: '使用编号查询进度。' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('customer-center.png'), fullPage: true });

  await page.goto('/site/foundry/zh-CN/');
  await openWebsiteMenu();
  await expect(
    page
      .getByRole('navigation', { name: '网站导航' })
      .getByRole('link', { name: '商标展示', exact: true })
  ).toBeVisible();

  await page.goto('/site/atlas/en-US/');
  const englishMenu = page.getByRole('button', { name: 'Menu' });
  if (await englishMenu.isVisible()) await englishMenu.click();
  const englishNavigation = page.getByRole('navigation', { name: 'Website navigation' });
  await expect(englishNavigation.getByRole('link', { name: 'Articles' })).toBeVisible();
  await expect(englishNavigation.getByRole('link', { name: 'My account' })).toBeVisible();
});

for (const workspace of ['atlas', 'foundry'] as const) {
  for (const locale of ['zh-CN', 'en-US'] as const) {
    test(`${workspace} ${locale}: localized deep link and admin-to-front state remain independent`, async ({
      page
    }, testInfo) => {
      const localizedHeading = `${workspace}-${locale}-reviewed-home`;
      await page.goto(`/admin/${workspace}/editor`);
      await page.getByLabel('内容语言 / Content language').selectOption(locale);
      await page.getByLabel('Heading').fill(localizedHeading);
      await page.getByRole('button', { name: 'Review & publish' }).click();
      await page.getByRole('button', { name: /Publish demo v/u }).click();
      if (locale === 'zh-CN') await page.getByRole('button', { name: '简体中文' }).click();
      await page.screenshot({
        path: testInfo.outputPath(`${workspace}-${locale}-editor.png`),
        fullPage: true
      });
      await page.goto(`/site/${workspace}/${locale}/`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('heading', { level: 1, name: localizedHeading })).toBeVisible();
      await expect(page.locator('head link[hreflang]')).toHaveCount(1);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await page.screenshot({
        path: testInfo.outputPath(`${workspace}-${locale}-front.png`),
        fullPage: true
      });

      await page.goto(`/site/${workspace}/${locale}/contact`);
      const isChinese = locale === 'zh-CN';
      await page.getByRole('button', { name: isChinese ? '继续' : 'Continue' }).click();
      await page.getByLabel(isChinese ? '姓名' : 'Your name').fill('Locale Reviewer');
      await page
        .getByLabel(isChinese ? '工作邮箱' : 'Work email')
        .fill(`${workspace}-${locale}@example.com`);
      await page
        .getByLabel(isChinese ? '你希望解决什么问题？' : 'What are you trying to decide?')
        .fill('Verify localized publication and exact Workspace attribution.');
      await page.getByRole('button', { name: isChinese ? '继续' : 'Continue' }).click();
      await page.locator('input[type="checkbox"][required]').check();
      await page
        .getByRole('button', { name: isChinese ? '提交演示咨询' : 'Submit demo inquiry' })
        .click();
      await page
        .getByRole('link', {
          name: isChinese ? '在站点后台查看此线索' : 'Find this lead in Site Admin'
        })
        .click();
      await expect(
        page.getByText(
          `${workspace === 'atlas' ? 'site_atlas_demo' : 'site_foundry_demo'} / ${workspace}`
        )
      ).toBeVisible();
      if (locale === 'zh-CN') {
        await page.getByRole('button', { name: '简体中文' }).click();
        await expect(page.getByRole('heading', { name: '咨询' })).toBeVisible();
      }
      await page.screenshot({
        path: testInfo.outputPath(`${workspace}-${locale}-admin.png`),
        fullPage: true
      });
    });
  }
}
