import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App.js';
import { seedSite, seedWorkspace } from './domain.js';
import { adminLocaleStorageKey } from './i18n.js';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(adminLocaleStorageKey, 'en-US');
  window.history.replaceState({}, '', '/');
});

describe('Site V1 interactive preview', () => {
  it('keeps a draft private until explicit demo publication', async () => {
    const user = userEvent.setup();
    render(<App initialPath="/admin/atlas/editor" />);
    const heading = screen.getByLabelText('Heading');
    await user.clear(heading);
    await user.type(heading, 'A newly governed brand headline');
    expect(screen.getByText('Draft has unpublished changes')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Published v1' }));
    expect(screen.queryByText('A newly governed brand headline')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Draft$/u }));
    expect(screen.getByText('A newly governed brand headline')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Review & publish' }));
    await user.click(screen.getByRole('button', { name: 'Publish demo v2' }));
    expect(screen.getByText('Demo published as version 2')).toBeVisible();
  });

  it('creates one attributable lead and reads it back in the same Workspace', async () => {
    const user = userEvent.setup();
    render(
      <App initialPath="/site/atlas/en-US/contact/source/content-filing-map/service/svc-global-strategy" />
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Your name'), 'Maya Chen');
    await user.type(screen.getByLabelText('Organization'), 'Orbit Labs');
    await user.type(screen.getByLabelText('Work email'), 'maya@example.com');
    await user.type(
      screen.getByLabelText('What are you trying to decide?'),
      'We need a filing sequence for three markets.'
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByLabelText(/I understand/));
    await user.click(screen.getByRole('button', { name: 'Submit demo inquiry' }));
    expect(screen.getByText('DEMO-LEAD-0001')).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Find this lead in Site Admin' }));
    expect(screen.getByRole('heading', { name: 'Maya Chen · Orbit Labs' })).toBeVisible();
    expect(screen.getByText('content-filing-map')).toBeVisible();
    expect(screen.getByText('site_atlas_demo / atlas')).toBeVisible();
  });

  it('does not leak a lead into the second Workspace', () => {
    const atlas = seedWorkspace('atlas');
    atlas.leads.push({
      id: 'DEMO-LEAD-0001',
      workspaceId: 'atlas',
      siteId: atlas.siteId,
      channel: 'WEB',
      createdAt: new Date().toISOString(),
      name: 'Atlas lead',
      email: 'atlas@example.com',
      company: 'Atlas',
      market: 'US',
      serviceId: 'svc-us-filing',
      message: 'Atlas-only demo lead',
      sourcePath: '/contact',
      status: 'NEW'
    });
    localStorage.setItem('markorbit:site-v1-preview:atlas', JSON.stringify(atlas));
    render(<App initialPath="/admin/foundry/leads" />);
    expect(screen.getByRole('heading', { name: 'No inquiries yet' })).toBeVisible();
  });

  it('shows field-level validation and retains user input', async () => {
    const user = userEvent.setup();
    render(<App initialPath="/site/atlas/en-US/contact" />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Error: Enter your name.')).toBeVisible();
    expect(screen.getByText('Error: Enter a valid email address.')).toBeVisible();
    await user.type(screen.getByLabelText('Your name'), 'Maya');
    expect(screen.getByLabelText('Your name')).toHaveValue('Maya');
  });

  it('renders read-only permission state with disabled mutations', () => {
    const state = seedWorkspace('atlas');
    state.role = 'VIEWER';
    localStorage.setItem('markorbit:site-v1-preview:atlas', JSON.stringify(state));
    render(<App initialPath="/admin/atlas/settings" />);
    expect(screen.getByText(/View-only access/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reset this demo Site' })).toBeDisabled();
    expect(screen.getByLabelText('站点默认语言 / Site default language')).toBeDisabled();
  });

  it('publishes the exact edited content snapshot once', async () => {
    const user = userEvent.setup();
    render(<App initialPath="/admin/atlas/content/content-clearance" />);
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'The exact reviewed snapshot');
    await user.click(screen.getByRole('button', { name: 'Publish content demo' }));

    const persisted = JSON.parse(
      localStorage.getItem('markorbit:site-v1-preview:atlas') ?? '{}'
    ) as ReturnType<typeof seedWorkspace>;
    const published = persisted.published.content.find((item) => item.id === 'content-clearance');
    expect(published).toMatchObject({
      title: 'The exact reviewed snapshot',
      status: 'PUBLISHED',
      version: 2
    });
    expect(persisted.versions).toHaveLength(2);
  });

  it('prevents a deep-linked viewer from mutating a lead', () => {
    const state = seedWorkspace('atlas');
    state.role = 'VIEWER';
    state.leads.push({
      id: 'DEMO-LEAD-0001',
      workspaceId: 'atlas',
      siteId: state.siteId,
      channel: 'WEB',
      createdAt: new Date().toISOString(),
      name: 'Read only',
      email: 'viewer@example.com',
      company: 'Viewer Co',
      market: 'China',
      serviceId: 'svc-us-filing',
      message: 'This lead must remain read only.',
      sourcePath: '/contact',
      status: 'NEW'
    });
    localStorage.setItem('markorbit:site-v1-preview:atlas', JSON.stringify(state));
    render(<App initialPath="/admin/atlas/leads/DEMO-LEAD-0001" />);
    expect(screen.getByRole('button', { name: 'Mark qualified' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prepare follow-up' })).toBeDisabled();
  });

  it('rejects an inquiry without explicit consent and prevents duplicates', async () => {
    const user = userEvent.setup();
    render(<App initialPath="/site/atlas/en-US/contact" />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Your name'), 'Maya Chen');
    await user.type(screen.getByLabelText('Work email'), 'maya@example.com');
    await user.type(
      screen.getByLabelText('What are you trying to decide?'),
      'We need a filing sequence for three markets.'
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Submit demo inquiry' }));
    expect(
      screen.getByText('Error: Confirm the demo-only consent before submitting.')
    ).toBeVisible();
    const persisted = localStorage.getItem('markorbit:site-v1-preview:atlas');
    const leads = persisted
      ? (JSON.parse(persisted) as ReturnType<typeof seedWorkspace>).leads
      : [];
    expect(leads).toHaveLength(0);
  });

  it('blocks direct access to a hidden published page', () => {
    const state = seedWorkspace('atlas');
    state.published.pages = state.published.pages.map((page) =>
      page.id === 'services' ? { ...page, visible: false } : page
    );
    localStorage.setItem('markorbit:site-v1-preview:atlas', JSON.stringify(state));
    render(<App initialPath="/site/atlas/en-US/services" />);
    expect(screen.getByRole('heading', { name: 'This page is outside the orbit.' })).toBeVisible();
  });

  it('uses the published block order on the real front', () => {
    const state = seedWorkspace('atlas');
    const services = state.published.blocks.find((block) => block.kind === 'services')!;
    const proof = state.published.blocks.find((block) => block.kind === 'proof')!;
    state.published.blocks = [
      state.published.blocks.find((block) => block.kind === 'hero')!,
      services,
      proof,
      ...state.published.blocks.filter(
        (block) => !['hero', 'services', 'proof'].includes(block.kind)
      )
    ];
    localStorage.setItem('markorbit:site-v1-preview:atlas', JSON.stringify(state));
    const { container } = render(<App initialPath="/site/atlas/en-US/" />);
    const text = container.querySelector('#site-main')?.textContent ?? '';
    expect(text.indexOf(services.title)).toBeLessThan(text.indexOf(proof.title));
  });

  it('defaults Site Admin to Chinese and keeps editor state when UI language changes', async () => {
    localStorage.removeItem(adminLocaleStorageKey);
    const user = userEvent.setup();
    render(<App initialPath="/admin/atlas/editor" />);
    expect(screen.getByRole('heading', { name: '装修' })).toBeVisible();
    const heading = screen.getByLabelText('标题');
    await user.clear(heading);
    await user.type(heading, '保留中的中文草稿');
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading', { name: 'Design' })).toBeVisible();
    expect(screen.getByLabelText('Heading')).toHaveValue('保留中的中文草稿');
    expect(window.location.pathname).toBe('/');
    expect(localStorage.getItem(adminLocaleStorageKey)).toBe('en-US');
  });

  it('restores visitor locale from a stable URL without changing Site configuration', () => {
    const state = seedWorkspace('atlas');
    localStorage.setItem('markorbit:site-v1-preview:atlas', JSON.stringify(state));
    const { unmount } = render(<App initialPath="/site/atlas/zh-CN/" />);
    expect(screen.getByRole('heading', { name: '守护你正在建立的品牌。' })).toBeVisible();
    expect(document.documentElement.lang).toBe('zh-CN');
    unmount();
    render(<App initialPath="/site/atlas/en-US/" />);
    expect(
      screen.getByRole('heading', { name: 'Protect the brand you are building.' })
    ).toBeVisible();
    const persisted = JSON.parse(
      localStorage.getItem('markorbit:site-v1-preview:atlas') ?? '{}'
    ) as ReturnType<typeof seedWorkspace>;
    expect(persisted.published.defaultLocale).toBe('zh-CN');
  });

  it('does not expose a locale whose publication status is draft', () => {
    const state = seedWorkspace('atlas');
    state.published.localePublication['en-US'] = 'DRAFT';
    localStorage.setItem('markorbit:site-v1-preview:atlas', JSON.stringify(state));
    render(<App initialPath="/site/atlas/en-US/" />);
    expect(screen.getByText('This locale has not been reviewed and published.')).toBeVisible();
  });

  it('keeps Foundry authorship and selected asset context in its own Workspace', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <App initialPath="/site/foundry/en-US/insights/filing-map-before-expansion" />
    );
    expect(screen.getByText('Foundry editorial desk')).toBeVisible();
    expect(screen.queryByText('Atlas editorial team')).not.toBeInTheDocument();
    unmount();

    render(<App initialPath="/site/foundry/en-US/assets" />);
    await user.click(screen.getAllByRole('link', { name: 'Request a governed review →' })[0]!);
    expect(screen.getByText('asset-vera-north')).toBeVisible();
    expect(screen.getByLabelText('Service')).toHaveValue('svc-asset-review');
  });

  it('uses task-led Admin navigation while secondary pages keep stable routes', () => {
    localStorage.removeItem(adminLocaleStorageKey);
    const { unmount } = render(<App initialPath="/admin/atlas/overview" />);
    const navigation = screen.getByRole('navigation', { name: '站点后台导航' });
    for (const label of ['概况', '页面', '装修', '文章', '服务', '咨询', '数据', '设置']) {
      expect(within(navigation).getByRole('link', { name: label })).toBeVisible();
    }
    expect(within(navigation).queryByRole('link', { name: '客户进度' })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: '域名与搜索' })).not.toBeInTheDocument();
    unmount();

    render(<App initialPath="/admin/atlas/seo" />);
    expect(screen.getByRole('heading', { name: '域名与搜索' })).toBeVisible();
  });

  it('builds plain-language Front navigation from published Workspace modules', () => {
    const { unmount } = render(<App initialPath="/site/atlas/zh-CN/" />);
    const atlasNavigation = screen.getByRole('navigation', { name: '网站导航' });
    for (const label of ['服务', '文章', '联系我们', '我的']) {
      expect(within(atlasNavigation).getByRole('link', { name: label })).toBeVisible();
    }
    expect(
      within(atlasNavigation).queryByRole('link', { name: '商标展示' })
    ).not.toBeInTheDocument();
    unmount();

    const englishView = render(<App initialPath="/site/atlas/en-US/" />);
    const englishNavigation = screen.getByRole('navigation', { name: 'Website navigation' });
    for (const label of ['Services', 'Articles', 'Contact us', 'My account']) {
      expect(within(englishNavigation).getByRole('link', { name: label })).toBeVisible();
    }
    englishView.unmount();

    const foundry = seedWorkspace('foundry');
    foundry.published.modules.insights = false;
    foundry.published.modules.portal = false;
    localStorage.setItem('markorbit:site-v1-preview:foundry', JSON.stringify(foundry));
    render(<App initialPath="/site/foundry/zh-CN/" />);
    const foundryNavigation = screen.getByRole('navigation', { name: '网站导航' });
    expect(within(foundryNavigation).getByRole('link', { name: '商标展示' })).toBeVisible();
    expect(within(foundryNavigation).queryByRole('link', { name: '文章' })).not.toBeInTheDocument();
    expect(within(foundryNavigation).queryByRole('link', { name: '我的' })).not.toBeInTheDocument();
  });

  it('opens My Sites before entering one independently identified Site Admin', () => {
    localStorage.removeItem(adminLocaleStorageKey);
    render(<App initialPath="/admin/atlas/sites" />);

    expect(screen.getByRole('heading', { name: '我的 Site' })).toBeVisible();
    expect(screen.getByText('Atlas 官方网站')).toBeVisible();
    expect(screen.getByText('Atlas 微信小程序')).toBeVisible();
    expect(screen.getByText('site_atlas_demo')).toBeVisible();
    expect(screen.getByText('site_atlas_mini_demo')).toBeVisible();
    expect(screen.getByRole('link', { name: /管理 Atlas 微信小程序/u })).toHaveAttribute(
      'href',
      '/admin/site_atlas_mini_demo/overview'
    );
  });

  it('keeps website and mini-program drafts and publication versions isolated by siteId', async () => {
    localStorage.removeItem(adminLocaleStorageKey);
    const user = userEvent.setup();
    const website = render(<App initialPath="/admin/site_atlas_demo/editor" />);
    const heading = screen.getByLabelText('标题');
    await user.clear(heading);
    await user.type(heading, '只属于官网的草稿标题');
    await user.click(screen.getByRole('button', { name: '检查并发布' }));
    await user.click(screen.getByRole('button', { name: '发布演示 v2' }));
    website.unmount();

    render(<App initialPath="/admin/site_atlas_mini_demo/editor" />);
    expect(screen.getAllByText('Atlas 微信小程序').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '已发布 v1' })).toBeVisible();
    expect(screen.queryByText('只属于官网的草稿标题')).not.toBeInTheDocument();

    const webState = JSON.parse(
      localStorage.getItem('markorbit:site-v1-preview:site:site_atlas_demo') ?? '{}'
    ) as ReturnType<typeof seedWorkspace>;
    const miniState = JSON.parse(
      localStorage.getItem('markorbit:site-v1-preview:site:site_atlas_mini_demo') ?? '{}'
    ) as ReturnType<typeof seedWorkspace>;
    expect(webState.versions).toHaveLength(2);
    expect(miniState.versions).toHaveLength(1);
  });

  it('blocks an employee without current-Site permission on a direct Admin URL', () => {
    localStorage.removeItem(adminLocaleStorageKey);
    const state = seedWorkspace('atlas');
    state.role = 'NONE';
    localStorage.setItem('markorbit:site-v1-preview:site:site_atlas_demo', JSON.stringify(state));

    render(<App initialPath="/admin/site_atlas_demo/content/content-clearance" />);
    expect(screen.getByRole('heading', { name: '无权访问此 Site' })).toBeVisible();
    expect(screen.queryByLabelText('标题')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '发布内容演示' })).not.toBeInTheDocument();
  });

  it('activates only an authorized merchant relationship for the current Site', async () => {
    localStorage.removeItem(adminLocaleStorageKey);
    const user = userEvent.setup();
    render(<App initialPath="/admin/site_atlas_demo/settings/payment" />);

    expect(screen.getByRole('heading', { name: '收款设置' })).toBeVisible();
    expect(screen.queryByLabelText('商户账号')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('授权收款关系'), 'merchant_atlas_cn_wechat');
    await user.click(screen.getByRole('button', { name: '检查并启用' }));
    await user.click(screen.getByLabelText(/确认此配置只用于当前 Site/u));
    await user.click(screen.getByRole('button', { name: '启用演示收款配置' }));

    const website = JSON.parse(
      localStorage.getItem('markorbit:site-v1-preview:site:site_atlas_demo') ?? '{}'
    ) as { collection: { active: { merchantRelationshipId: string }; version: number } };
    const mini = JSON.parse(
      localStorage.getItem('markorbit:site-v1-preview:site:site_atlas_mini_demo') ?? '{}'
    ) as { collection: { active: { merchantRelationshipId: string }; version: number } };
    expect(website.collection.active.merchantRelationshipId).toBe('merchant_atlas_cn_wechat');
    expect(website.collection.version).toBe(2);
    expect(mini.collection.active.merchantRelationshipId).not.toBe(
      website.collection.active.merchantRelationshipId
    );
    expect(
      screen
        .getAllByRole('status')
        .some((element) => element.textContent?.includes('演示收款配置 v2 已启用'))
    ).toBe(true);
    expect(screen.queryByText('支付成功')).not.toBeInTheDocument();
    expect(screen.queryByText('资金已结算')).not.toBeInTheDocument();
  });

  it('rejects an ungranted merchant reference and disables collection mutations for viewers', () => {
    localStorage.removeItem(adminLocaleStorageKey);
    const state = seedSite('site_atlas_demo') as unknown as Record<string, unknown>;
    state.collection = {
      authorizedRelationships: [],
      draft: {
        merchantRelationshipId: 'merchant_external_untrusted',
        provider: 'UNTRUSTED'
      },
      active: null,
      version: 1
    };
    state.role = 'VIEWER';
    localStorage.setItem('markorbit:site-v1-preview:site:site_atlas_demo', JSON.stringify(state));

    render(<App initialPath="/admin/site_atlas_demo/settings/payment" />);
    expect(screen.getByText('当前配置引用未获授权，不能启用。')).toBeVisible();
    expect(screen.getByRole('button', { name: '检查并启用' })).toBeDisabled();
  });

  it('applies a conversational proposal to the current draft without publishing it', async () => {
    localStorage.removeItem(adminLocaleStorageKey);
    const user = userEvent.setup();
    render(<App initialPath="/admin/site_atlas_mini_demo/overview" />);

    await user.click(screen.getByRole('button', { name: '运营助手' }));
    await user.type(
      screen.getByLabelText('这次想准备什么？'),
      '为小程序首页准备一段强调进度查询的介绍'
    );
    await user.click(screen.getByRole('button', { name: '生成草稿建议' }));
    expect(screen.getByText('待审核提案')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '应用到当前 Site 草稿' }));

    const persisted = JSON.parse(
      localStorage.getItem('markorbit:site-v1-preview:site:site_atlas_mini_demo') ?? '{}'
    ) as ReturnType<typeof seedSite>;
    expect(persisted.draft.localized['zh-CN'].blocks.hero?.body).toContain('进度');
    expect(persisted.published.localized['zh-CN'].blocks.hero?.body).not.toContain(
      '对话提案已加入草稿'
    );
    expect(persisted.versions).toHaveLength(1);
  });

  it('shows attributed order evidence without treating the Site as the order or payment owner', () => {
    localStorage.removeItem(adminLocaleStorageKey);
    render(<App initialPath="/admin/site_atlas_demo/analytics" />);
    expect(screen.getByText('order_demo_atlas_001')).toBeVisible();
    expect(screen.getByText('merchant_atlas_us_referral')).toBeVisible();
    expect(screen.getByText('site_atlas_demo · WEB · /services/us-filing')).toBeVisible();
    expect(screen.getByText('订单与支付由其权威 Owner 管理')).toBeVisible();
  });
});
