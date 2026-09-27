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
  await expect(page.getByRole('heading', { name: 'Visual editor' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'No demo leads yet' })).toBeVisible();
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
    const key = 'markorbit:site-v1-preview:atlas';
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
  await expect(page.getByRole('heading', { name: 'No demo leads yet' })).toBeVisible();
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
        await expect(page.getByRole('heading', { name: '咨询与线索' })).toBeVisible();
      }
      await page.screenshot({
        path: testInfo.outputPath(`${workspace}-${locale}-admin.png`),
        fullPage: true
      });
    });
  }
}
