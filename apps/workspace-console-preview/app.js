/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- This dependency-free review preview renders dynamic DOM fixtures directly; browser acceptance covers the interaction boundary. */
const params = new URLSearchParams(location.search);
const state = {
  lang: params.get('lang') === 'en' ? 'en' : 'zh',
  page: params.get('page') || 'overview',
  persona: params.get('persona') || 'owner',
  resourceTab: params.get('tab') || 'customers',
  dialog: null,
  notice: '',
  profileComplete: false,
  liteActive: true,
  newSite: false,
  invitationSent: false,
  grantRevoked: params.get('access') === 'revoked'
};

const zh = () => state.lang === 'zh';
const c = (cn, en) => (zh() ? cn : en);
const esc = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const icons = {
  overview:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/></svg>',
  resources:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H10l2 2h5.5A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-11Z"/></svg>',
  products:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 2.3L6.1 8.6 12 12l5.9-3.4L12 5.3Zm-6 5v5L11 18v-4.4l-5-3Zm7 7.7 5-2.7v-5l-5 3V18Z"/></svg>',
  team: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20a7 7 0 0 1 14 0H2Zm13.5-7a5.5 5.5 0 0 1 6.5 5.4V20h-4a8.9 8.9 0 0 0-2.5-7Z"/></svg>',
  billing:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18l-2.5-1.5L14 21l-2.5-1.5L9 21l-2.5-1.5L4 21V4a1 1 0 0 1 1-1Zm2 5v2h10V8H7Zm0 4v2h7v-2H7Z"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.7 2h2.6l.6 2.2 1.4.6 2-1.1 1.9 1.9-1.1 2 .6 1.4 2.3.6v2.7l-2.3.6-.6 1.4 1.1 2-1.9 1.9-2-1.1-1.4.6-.6 2.3h-2.6l-.6-2.3-1.4-.6-2 1.1-1.9-1.9 1.1-2-.6-1.4-2.3-.6V9.6L5.3 9l.6-1.4-1.1-2 1.9-1.9 2 1.1 1.4-.6.6-2.2ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6L9 5Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.2 16.6-4.4-4.4 1.4-1.4 3 3 8.6-8.6 1.4 1.4-10 10Z"/></svg>',
  warning:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 1 21h22L12 2Zm-1 7h2v6h-2V9Zm0 8h2v2h-2v-2Z"/></svg>'
};

const navItems = [
  ['overview', '首页', 'Overview'],
  ['resources', '资源', 'Resources'],
  ['products', '产品', 'Products'],
  ['team', '团队', 'Team'],
  ['billing', '费用', 'Billing'],
  ['settings', '机构设置', 'Organization']
];

function route(page, extra = {}) {
  const next = new URLSearchParams({ lang: state.lang, page, ...extra });
  return `?${next.toString()}`;
}

function status(label, tone = 'neutral', detail = '') {
  return `<span class="status status--${tone}"><span class="status__dot"></span>${esc(label)}${
    detail ? `<span class="sr-only">${esc(detail)}</span>` : ''
  }</span>`;
}

function button(label, action, variant = 'secondary', attrs = '') {
  return `<button class="button button--${variant}" type="button" data-action="${action}" ${attrs}>${esc(
    label
  )}</button>`;
}

function shell(content) {
  const pageLabel = navItems.find(([key]) => key === state.page);
  document.documentElement.lang = zh() ? 'zh-CN' : 'en';
  document.title = `${pageLabel ? c(pageLabel[1], pageLabel[2]) : 'Workspace'} · MarkOrbit`;
  return `
    <div class="preview-banner" role="note">
      <span class="preview-banner__mark">PREVIEW</span>
      <span>${c(
        '独立评审原型 · 所有数据为具名示例，不执行支付或 Core 持久化',
        'Independent review prototype · Named fixtures only; no payment or Core persistence'
      )}</span>
      <a href="${route('states')}">${c('查看状态矩阵', 'View state matrix')}</a>
    </div>
    <div class="app-shell">
      <aside class="sidebar" aria-label="${c('主导航', 'Primary navigation')}">
        <div class="brand"><span class="brand__orbit"></span><span>MarkOrbit</span></div>
        <div class="workspace-switcher">
          <span class="eyebrow">${c('当前空间', 'CURRENT WORKSPACE')}</span>
          <button type="button" class="workspace-switcher__button" data-action="workspace-menu" aria-label="${c(
            '切换机构空间',
            'Switch workspace'
          )}">
            <span class="workspace-avatar">澄</span>
            <span><strong>${c('上海澄明知识产权', 'ClearMark IP Shanghai')}</strong><small>${c(
              '机构空间',
              'Organization workspace'
            )}</small></span>
            <span class="chevron">⌄</span>
          </button>
        </div>
        <nav class="nav-list">
          ${navItems
            .map(
              ([key, cn, en]) => `<a href="${route(key)}" class="nav-item ${
                state.page === key ? 'is-active' : ''
              }" ${state.page === key ? 'aria-current="page"' : ''}>
                ${icons[key]}<span>${c(cn, en)}</span>
              </a>`
            )
            .join('')}
        </nav>
        <div class="sidebar__foot">
          <button class="support-link" data-action="switch-persona" type="button">
            <span class="avatar avatar--small">${state.persona === 'owner' ? '林' : '周'}</span>
            <span><strong>${state.persona === 'owner' ? c('林岚', 'Lan Lin') : c('周予安', 'Yuan Zhou')}</strong><small>${
              state.persona === 'owner'
                ? c('负责人视角', 'Owner view')
                : c('员工视角', 'Employee view')
            }</small></span>
          </button>
        </div>
      </aside>
      <div class="main-column">
        <header class="topbar">
          <div class="mobile-brand"><span class="brand__orbit"></span><strong>MarkOrbit</strong></div>
          <div class="acting-context"><span>${c('当前身份', 'Acting as')}</span><strong>${c(
            '澄明知识产权 · 机构负责人',
            'ClearMark IP · Workspace owner'
          )}</strong></div>
          <div class="topbar__actions">
            <button type="button" class="icon-button" aria-label="${c('搜索', 'Search')}" data-action="search">⌕</button>
            <button type="button" class="language-switch" data-action="language" aria-label="${c(
              'Switch to English',
              '切换至中文'
            )}">${zh() ? 'EN' : '中文'}</button>
            <span class="avatar">林</span>
          </div>
        </header>
        <main id="main" class="page" tabindex="-1">${content}</main>
      </div>
      <nav class="mobile-nav" aria-label="${c('移动端主导航', 'Mobile primary navigation')}">
        ${navItems
          .slice(0, 5)
          .map(
            ([key, cn, en]) =>
              `<a href="${route(key)}" class="mobile-nav__item ${
                state.page === key ? 'is-active' : ''
              }">${icons[key]}<span>${c(cn, en)}</span></a>`
          )
          .join('')}
      </nav>
      ${state.dialog ? dialog(state.dialog) : ''}
      <div class="toast-region" aria-live="polite">${state.notice ? `<div class="toast">${icons.check}<span>${esc(state.notice)}</span></div>` : ''}</div>
    </div>`;
}

function pageHeader(kicker, title, description, actions = '') {
  return `<header class="page-header"><div><p class="eyebrow">${esc(kicker)}</p><h1>${esc(
    title
  )}</h1><p>${esc(description)}</p></div>${actions ? `<div class="page-header__actions">${actions}</div>` : ''}</header>`;
}

function overview() {
  return `
    ${pageHeader(
      c('2026 年 9 月 28 日 · 星期一', 'Monday, 28 September 2026'),
      c('林岚，上午好', 'Good morning, Lan'),
      c(
        '先确认机构身份，再处理需要你决定的事项。',
        'Confirm the organization context, then handle decisions that need you.'
      ),
      button(c('完善机构资料', 'Complete profile'), 'profile', 'primary')
    )}
    <section class="identity-panel" aria-labelledby="identity-title">
      <div class="identity-panel__main">
        <span class="workspace-avatar workspace-avatar--large">澄</span>
        <div><div class="section-label">${c('当前机构空间', 'CURRENT ORGANIZATION')}</div><h2 id="identity-title">${c(
          '上海澄明知识产权',
          'ClearMark IP Shanghai'
        )}</h2><div class="identity-meta">${status(c('机构资料待完善', 'Profile incomplete'), 'warning')}<span>${c(
          '法律主体：上海澄明企业管理咨询有限公司',
          'Legal entity: ClearMark Business Consulting (Shanghai) Co., Ltd.'
        )}</span></div></div>
      </div>
      <div class="identity-panel__agency"><span>${c('代理机构名称', 'Agency names')}</span><strong>2</strong><small>${c(
        '1 个已核验 · 1 个待补充证明',
        '1 verified · 1 needs evidence'
      )}</small></div>
    </section>
    <div class="overview-grid">
      <section class="panel responsibility-panel" aria-labelledby="responsibility-title">
        <div class="panel__heading"><div><span class="section-label">${c('负责人事项', 'OWNER DECISIONS')}</span><h2 id="responsibility-title">${c(
          '需要你处理',
          'Needs your attention'
        )}</h2></div><span class="count-badge">4</span></div>
        <div class="decision-list">
          ${decisionItem('profile', c('补全机构资料', 'Complete organization profile'), c('产品开通前需确认主体类型与联系信息', 'Confirm entity type and contact details before activation'), c('今天', 'Today'), 'warning')}
          ${decisionItem('team', c('确认员工资源范围', 'Confirm employee resource scope'), c('周予安 · 2 个客户 · 3 件商标', 'Yuan Zhou · 2 customers · 3 trademarks'), c('待确认', 'Pending'), 'info')}
          ${decisionItem('team', c('外部协作将在 2 天后到期', 'External access expires in 2 days'), c('城际品牌项目 · 陈默', 'Intercity Brand project · Mo Chen'), c('30 日到期', 'Expires 30 Sep'), 'warning')}
          ${decisionItem('products', c('微信小程序 Site 待核验', 'Mini Program Site awaiting verification'), c('已保存配置，尚未对外可用', 'Configuration saved; not publicly available'), c('继续设置', 'Continue'), 'neutral')}
        </div>
      </section>
      <aside class="panel product-summary" aria-labelledby="product-title">
        <div class="panel__heading"><div><span class="section-label">${c('产品状态', 'PRODUCT STATUS')}</span><h2 id="product-title">${c(
          '已开通与待处理',
          'Availability and next steps'
        )}</h2></div><a href="${route('products')}">${c('全部产品', 'All products')}</a></div>
        ${productRow('L', 'Lite', c('团队空间', 'Team workspace'), status(c('可使用', 'Available'), 'success'), c('5 名成员 · 1 个 Pro 席位已分配', '5 members · 1 Pro seat assigned'))}
        ${productRow('S', 'Site', c('2 个站点', '2 Sites'), status(c('部分就绪', 'Partially ready'), 'warning'), c('官网已启用 · 小程序待核验', 'Website active · Mini Program pending'))}
        <div class="product-summary__note"><strong>${c('商业状态与使用权限分开显示', 'Commercial and access status are separate')}</strong><p>${c(
          '开通产品不会自动授予团队成员访问权。',
          'Installing a product does not automatically grant team access.'
        )}</p></div>
      </aside>
    </div>
    <section class="panel resource-snapshot" aria-labelledby="resource-title">
      <div class="panel__heading"><div><span class="section-label">${c('资源概况', 'RESOURCE DIRECTORY')}</span><h2 id="resource-title">${c(
        '机构可访问的资源',
        'Resources available to this Workspace'
      )}</h2></div><a href="${route('resources')}">${c('打开资源目录', 'Open resources')}</a></div>
      <div class="resource-cards">
        ${resourceCard(c('客户', 'Customers'), '18', c('来自客户关系 Owner', 'From Customer Relationship owner'), 'customers')}
        ${resourceCard(c('商标资产', 'Trademark assets'), '126', c('96 管理 · 30 关注', '96 managed · 30 watched'), 'trademarks')}
        ${resourceCard(c('商机', 'Opportunities'), '7', c('3 项待负责人确认', '3 need owner review'), 'opportunities')}
        ${resourceCard(c('知识', 'Knowledge'), '42', c('已获授权的参考资料', 'Authorized reference material'), 'knowledge')}
      </div>
      <p class="source-note">${c(
        '数据观察于 09:42。资源仍由各业务 Owner 管理；这里不复制客户、商标、商机或知识数据库。',
        'Observed at 09:42. Each business owner remains authoritative; this view does not copy customer, trademark, opportunity or knowledge databases.'
      )}</p>
    </section>
    <section class="panel activity-panel" aria-labelledby="activity-title">
      <div class="panel__heading"><div><span class="section-label">${c('协作记录', 'COLLABORATION')}</span><h2 id="activity-title">${c(
        '最近的访问变更',
        'Recent access changes'
      )}</h2></div></div>
      <ol class="timeline">
        <li><span class="timeline__mark"></span><div><strong>${c('周予安获得“远海科技”客户的工作访问权', 'Yuan Zhou received work access to FarSea Technology')}</strong><p>${c('可查看客户、3 件商标并处理分配工作 · 林岚', 'Can view the customer, 3 trademarks and assigned work · Lan Lin')}</p></div><time>${c('18 分钟前', '18 min ago')}</time></li>
        <li><span class="timeline__mark"></span><div><strong>${c('“城际品牌项目”外部访问期限已调整', 'Intercity Brand external-access expiry changed')}</strong><p>${c('仅该项目，可查看与评论 · 9 月 30 日失效', 'This project only, view and comment · expires 30 Sep')}</p></div><time>${c('昨天', 'Yesterday')}</time></li>
      </ol>
    </section>`;
}

function decisionItem(page, title, detail, meta, tone) {
  return `<a class="decision-item" href="${route(page)}"><span class="decision-item__icon decision-item__icon--${tone}">${
    tone === 'warning' ? icons.warning : icons.check
  }</span><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span><span class="decision-item__meta">${esc(
    meta
  )}${icons.arrow}</span></a>`;
}

function productRow(monogram, title, subtitle, badge, detail) {
  return `<div class="product-row"><span class="product-logo">${monogram}</span><div><strong>${title}</strong><small>${subtitle}</small></div><div class="product-row__status">${badge}<small>${detail}</small></div></div>`;
}

function resourceCard(title, number, detail, tab) {
  return `<a class="resource-card" href="${route('resources', { tab })}"><span>${esc(
    title
  )}</span><strong>${esc(number)}</strong><small>${esc(detail)}</small>${icons.arrow}</a>`;
}

const resourcesData = {
  customers: [
    [
      c('远海科技（上海）有限公司', 'FarSea Technology (Shanghai) Co., Ltd.'),
      c('直接客户', 'Direct customer'),
      c('3 件商标 · 2 项工作', '3 trademarks · 2 work items'),
      c('周予安', 'Yuan Zhou')
    ],
    [
      c('北辰消费品有限公司', 'Northstar Consumer Products Co., Ltd.'),
      c('共同交付', 'Co-delivery'),
      c('12 件商标 · 1 项工作', '12 trademarks · 1 work item'),
      c('林岚', 'Lan Lin')
    ],
    [
      c('澄光生物科技有限公司', 'ClearRay Biotech Co., Ltd.'),
      c('直接客户', 'Direct customer'),
      c('6 件商标', '6 trademarks'),
      c('蒋宁', 'Ning Jiang')
    ]
  ],
  trademarks: [
    [
      'MORNING TIDE',
      c('第 9 类 · 申请中', 'Class 9 · Pending'),
      'CN 2026 1038 221',
      c('远海科技', 'FarSea Technology')
    ],
    [
      c('北辰山野', 'NORTHSTAR FIELD'),
      c('第 30 类 · 已注册', 'Class 30 · Registered'),
      'CN 78219344',
      c('北辰消费品', 'Northstar Consumer')
    ],
    [
      c('澄光序列', 'CLEARRAY SEQUENCE'),
      c('第 5 类 · 待补充资料', 'Class 5 · Info required'),
      c('内部编号 CM-0251', 'Internal ref CM-0251'),
      c('澄光生物', 'ClearRay Biotech')
    ]
  ],
  opportunities: [
    [
      c('东南亚品牌保护咨询', 'Southeast Asia brand protection'),
      c('待负责人确认', 'Owner review'),
      c('来源：官网 Site', 'Source: Website Site'),
      c('林岚', 'Lan Lin')
    ],
    [
      c('餐饮连锁商标组合', 'Restaurant chain trademark portfolio'),
      c('信息收集中', 'Gathering information'),
      c('来源：员工录入', 'Source: Team entry'),
      c('周予安', 'Yuan Zhou')
    ]
  ],
  knowledge: [
    [
      c('中国商标申请材料核对清单', 'China trademark filing checklist'),
      c('机构工作方法', 'Organization method'),
      c('更新于 9 月 25 日', 'Updated 25 Sep'),
      c('团队可用', 'Team')
    ],
    [
      c('海外委托资料交接说明', 'Overseas instruction handoff'),
      c('获授权参考', 'Authorized reference'),
      c('来源可追溯', 'Source traceable'),
      c('指定项目', 'Selected projects')
    ]
  ]
};

function resources() {
  const tabs = [
    ['customers', '客户', 'Customers'],
    ['trademarks', '商标资产', 'Trademark assets'],
    ['opportunities', '商机', 'Opportunities'],
    ['knowledge', '知识', 'Knowledge']
  ];
  const rows = resourcesData[state.resourceTab] ?? resourcesData.customers;
  return `
    ${pageHeader(
      c('资源目录', 'RESOURCE DIRECTORY'),
      c('资源', 'Resources'),
      c(
        '统一查找机构获授权的资源，数据与操作仍由各业务 Owner 管理。',
        'Find authorized organization resources in one place; data and actions remain with each business owner.'
      ),
      button(c('共享资源', 'Share resources'), 'share-resource', 'primary')
    )}
    <section class="panel resource-directory">
      <div class="tabs" role="tablist" aria-label="${c('资源类型', 'Resource type')}">
        ${tabs
          .map(
            ([key, cn, en]) =>
              `<button role="tab" type="button" data-action="resource-tab" data-tab="${key}" aria-selected="${
                state.resourceTab === key
              }" class="tab ${state.resourceTab === key ? 'is-active' : ''}">${c(cn, en)}<span>${resourcesData[key].length}</span></button>`
          )
          .join('')}
      </div>
      <div class="directory-toolbar"><label class="search-field"><span class="sr-only">${c(
        '搜索资源',
        'Search resources'
      )}</span><span>⌕</span><input type="search" placeholder="${c('搜索名称、编号或负责人', 'Search name, reference or owner')}" /></label><button class="filter-button" type="button">${c(
        '筛选',
        'Filter'
      )} <span>2</span></button></div>
      <div class="resource-table" role="table" aria-label="${c('资源列表', 'Resource list')}">
        <div class="resource-table__head" role="row"><span role="columnheader">${c('名称', 'Name')}</span><span role="columnheader">${c(
          '状态 / 类型',
          'Status / type'
        )}</span><span role="columnheader">${c('关联信息', 'Related')}</span><span role="columnheader">${c('负责人 / 范围', 'Owner / scope')}</span><span></span></div>
        ${rows
          .map(
            (row, index) =>
              `<div class="resource-table__row" role="row"><div role="cell"><span class="resource-type-icon">${
                state.resourceTab === 'customers'
                  ? '客'
                  : state.resourceTab === 'trademarks'
                    ? '商'
                    : state.resourceTab === 'opportunities'
                      ? '机'
                      : '知'
              }</span><strong>${esc(row[0])}</strong></div><span role="cell">${esc(row[1])}</span><span role="cell">${esc(
                row[2]
              )}</span><span role="cell">${esc(row[3])}</span><div role="cell" class="row-actions">${button(
                c('共享', 'Share'),
                'share-resource',
                'ghost',
                `data-resource="${index}"`
              )}<button class="more-button" aria-label="${c('更多操作', 'More actions')}">•••</button></div></div>`
          )
          .join('')}
      </div>
      <div class="table-foot"><span>${c(`显示 ${rows.length} 项具名评审数据`, `${rows.length} named review fixtures`)}</span><span>${c(
        '观察于 09:42 · 来源状态正常',
        'Observed 09:42 · owner sources available'
      )}</span></div>
    </section>
    <aside class="boundary-card"><span class="boundary-card__icon">i</span><div><strong>${c(
      '资源目录不是新的数据库',
      'The resource directory is not a new database'
    )}</strong><p>${c(
      '客户来自 MarkReg 客户关系，商标资产和商机来自 Lite，知识来自 Knowledge Owner。共享仅授予引用范围内的访问。',
      'Customers come from MarkReg Customer Relationships; trademark assets and opportunities from Lite; knowledge from the Knowledge owner. Sharing grants access only to referenced resources.'
    )}</p></div></aside>`;
}

function products() {
  return `
    ${pageHeader(
      c('产品与站点', 'PRODUCTS & SITES'),
      c('产品', 'Products'),
      c(
        '查看真实安装、权益与运行状态；每一项状态都有独立来源。',
        'Review installation, entitlement and runtime status; each status keeps its own source.'
      ),
      button(c('浏览可开通产品', 'Browse products'), 'activate-lite', 'secondary')
    )}
    <section class="product-grid" aria-label="${c('产品状态', 'Product status')}">
      <article class="product-card product-card--featured"><div class="product-card__top"><span class="product-logo product-logo--large">L</span>${status(c('可使用', 'Available'), 'success')}</div><h2>Lite</h2><p>${c(
        '个人工作台与机构团队协作空间。员工进入自己的 Lite，只看到获授权的工作和资料。',
        'Personal workbench and organization collaboration. Employees see only authorized work and related material in their own Lite.'
      )}</p><dl class="status-lines"><div><dt>${c('机构安装', 'Workspace installation')}</dt><dd>${c('已启用', 'Active')}</dd></div><div><dt>${c(
        '机构权益',
        'Workspace entitlement'
      )}</dt><dd>Lite Team · ${c('有效', 'Current')}</dd></div><div><dt>${c('你的个人权益', 'Your personal entitlement')}</dt><dd>Lite Pro · ${c(
        '由团队席位分配',
        'Assigned team seat'
      )}</dd></div></dl><div class="card-actions"><a class="button button--primary" href="${route('lite', { persona: 'employee' })}">${c(
        '进入 Lite',
        'Open Lite'
      )}</a><button class="button button--ghost" type="button">${c('管理成员使用权', 'Manage member access')}</button></div></article>
      <article class="product-card"><div class="product-card__top"><span class="product-logo product-logo--large product-logo--site">S</span>${status(
        c('部分就绪', 'Partially ready'),
        'warning'
      )}</div><h2>Site</h2><p>${c(
        '机构面向客户的品牌与服务入口。每个 Site 独立管理品牌、渠道与发布状态。',
        'Branded customer-facing service entry. Each Site manages its own brand, channel and publication state.'
      )}</p><dl class="status-lines"><div><dt>${c('机构安装', 'Workspace installation')}</dt><dd>${c('已启用', 'Active')}</dd></div><div><dt>${c(
        '站点额度',
        'Site allowance'
      )}</dt><dd>${c('2 个中的 2 个', '2 of 2')}</dd></div><div><dt>${c('托管服务', 'Managed hosting')}</dt><dd>${c('包含 · 由权益提供', 'Included · entitlement-backed')}</dd></div></dl>${button(
        c('创建 Site', 'Create Site'),
        'create-site',
        'primary'
      )}</article>
    </section>
    <section class="panel sites-panel"><div class="panel__heading"><div><span class="section-label">${c(
      '我的 SITE',
      'MY SITES'
    )}</span><h2>${c('全部 Site', 'All Sites')}</h2></div>${button(c('新建', 'New'), 'create-site', 'secondary')}</div>
      <div class="site-list">
        ${siteRow(c('澄明知识产权官网', 'ClearMark IP Website'), c('官方网站', 'Website'), 'www.clearmark-ip.cn', c('已启用', 'Active'), 'success')}
        ${siteRow(c('澄明服务小程序', 'ClearMark Services Mini Program'), c('微信小程序', 'WeChat Mini Program'), c('应用标识待核验', 'App identity pending verification'), c('待核验', 'Pending verification'), 'warning')}
        ${state.newSite ? siteRow(c('国际业务入口', 'International Services'), c('官方网站', 'Website'), c('尚未绑定域名', 'No domain yet'), c('草稿', 'Draft'), 'neutral') : ''}
      </div>
    </section>
    <aside class="boundary-card boundary-card--warning">${icons.warning}<div><strong>${c(
      '评审原型不会执行真实开通',
      'This review prototype does not perform activation'
    )}</strong><p>${c(
      '此页不创建商业协议、不发起支付，也不写入 Core 或 Site。生产实现必须分别读取安装、权益、支付与 Site Owner 状态。',
      'This page creates no commercial agreement, starts no payment and writes neither Core nor Site. Production must read installation, entitlement, payment and Site owner state separately.'
    )}</p></div></aside>`;
}

function siteRow(name, kind, endpoint, label, tone) {
  return `<article class="site-row"><div class="site-thumb"><span></span><strong>MO</strong></div><div class="site-row__main"><span class="site-kind">${esc(
    kind
  )}</span><strong>${esc(name)}</strong><small>${esc(endpoint)}</small></div><div class="site-row__status">${status(
    label,
    tone
  )}<small>${c('Site Owner 状态', 'Site owner state')}</small></div><button class="button button--secondary" type="button" data-action="open-site">${c(
    '进入管理',
    'Open admin'
  )}${icons.arrow}</button></article>`;
}

function team() {
  return `
    ${pageHeader(
      c('成员与访问', 'PEOPLE & ACCESS'),
      c('团队', 'Team'),
      c(
        '清楚说明每个人能看什么、能做什么，以及授权何时失效。',
        'Make it clear what each person can see, what they can do and when access ends.'
      ),
      button(c('邀请成员', 'Invite member'), 'invite', 'primary')
    )}
    <section class="access-summary">
      <div><span>${c('正式成员', 'Members')}</span><strong>5</strong><small>${c('4 名在职 · 1 名暂停', '4 active · 1 suspended')}</small></div>
      <div><span>${c('待接受邀请', 'Pending invitations')}</span><strong>${state.invitationSent ? '2' : '1'}</strong><small>${c('7 天后自动失效', 'Auto-expires in 7 days')}</small></div>
      <div><span>${c('外部访问', 'External access')}</span><strong>1</strong><small>${c('2 天内到期', 'Expires in 2 days')}</small></div>
    </section>
    <section class="panel team-panel"><div class="tabs" role="tablist"><button role="tab" class="tab is-active" aria-selected="true">${c(
      '成员',
      'Members'
    )}<span>5</span></button><button role="tab" class="tab">${c('待邀请', 'Invitations')}<span>${state.invitationSent ? '2' : '1'}</span></button><button role="tab" class="tab">${c(
      '外部协作',
      'External access'
    )}<span>1</span></button></div>
      <div class="member-list">
        ${memberRow('林', c('林岚', 'Lan Lin'), 'lin.lan@example.cn', c('负责人', 'Owner'), c('全部机构资源（仍受 Owner 权限约束）', 'All Workspace resources, still owner-authorized'), c('持续有效', 'Ongoing'), false)}
        ${memberRow('周', c('周予安', 'Yuan Zhou'), 'yuan.zhou@example.cn', c('专业人员', 'Professional'), c('2 个客户 · 3 件商标 · 4 项工作', '2 customers · 3 trademarks · 4 work items'), c('在职期间', 'While active'), false)}
        ${memberRow('蒋', c('蒋宁', 'Ning Jiang'), 'ning.jiang@example.cn', c('复核人员', 'Reviewer'), c('指定复核工作与关联资料', 'Assigned reviews and related material'), c('在职期间', 'While active'), false)}
        ${memberRow('陈', c('陈默（外部）', 'Mo Chen (External)'), 'mo.chen@partner.cn', c('外部协作', 'External'), c('仅“城际品牌项目” · 查看与评论', 'Intercity Brand only · view and comment'), c('9 月 30 日 18:00', '30 Sep, 18:00'), true)}
      </div>
    </section>
    <section class="panel permission-panel"><div class="panel__heading"><div><span class="section-label">${c(
      '访问规则',
      'ACCESS RULES'
    )}</span><h2>${c('成员角色不是全部权限', 'A role is not the whole permission')}</h2></div></div><div class="formula"><span>${c(
      '当前成员身份',
      'Current membership'
    )}</span><b>+</b><span>${c('资源范围', 'Resource scope')}</span><b>+</b><span>${c('允许的操作', 'Allowed actions')}</span><b>+</b><span>${c(
      '有效期限',
      'Validity window'
    )}</span><b>→</b><strong>${c('本次有效访问', 'Effective access')}</strong></div><p>${c(
      '涉及对外提交、发送、支付或委托的操作，仍需具体流程中的复核与批准。',
      'External filing, sending, payment or appointment still requires workflow-specific review and approval.'
    )}</p></section>`;
}

function memberRow(initial, name, email, role, scope, expiry, external) {
  return `<article class="member-row"><span class="avatar ${external ? 'avatar--external' : ''}">${initial}</span><div class="member-row__identity"><strong>${esc(
    name
  )}</strong><small>${esc(email)}</small></div><div><span class="mobile-label">${c('角色', 'Role')}</span>${status(
    role,
    external ? 'info' : 'neutral'
  )}</div><div><span class="mobile-label">${c('可访问资源', 'Resources')}</span><strong class="scope-text">${esc(
    scope
  )}</strong></div><div><span class="mobile-label">${c('授权失效', 'Access ends')}</span><span>${esc(
    expiry
  )}</span></div><button class="more-button" type="button" data-action="${external ? 'revoke' : 'member-detail'}" aria-label="${
    external ? c('撤销外部访问', 'Revoke external access') : c('查看成员访问', 'View member access')
  }">•••</button></article>`;
}

function billing() {
  return `
    ${pageHeader(
      c('协议与账单', 'AGREEMENTS & BILLING'),
      c('费用', 'Billing'),
      c(
        '只展示商业 Owner 返回的协议与付款状态，不用产品状态推断付款。',
        'Show commercial-owner agreement and payment state without inferring payment from product status.'
      )
    )}
    <section class="billing-grid"><article class="panel agreement-card"><span class="section-label">${c(
      '当前机构协议',
      'CURRENT WORKSPACE AGREEMENT'
    )}</span><div class="agreement-card__title"><div><h2>Lite Team</h2><p>${c('机构范围 · 按月', 'Workspace scope · Monthly')}</p></div>${status(c('有效', 'Active'), 'success')}</div><dl class="detail-list"><div><dt>${c(
      '当前周期',
      'Current period'
    )}</dt><dd>2026-09-15 — 2026-10-14</dd></div><div><dt>${c('包含权益', 'Included benefit')}</dt><dd>${c('1 个可分配 Lite Pro 席位', '1 assignable Lite Pro seat')}</dd></div><div><dt>${c(
      '协议来源',
      'Agreement source'
    )}</dt><dd>Commercial Agreement v3</dd></div></dl></article>
    <article class="panel agreement-card"><span class="section-label">${c('SITE 附加项', 'SITE ADD-ON')}</span><div class="agreement-card__title"><div><h2>Site</h2><p>${c(
      '机构范围 · 按年',
      'Workspace scope · Annual'
    )}</p></div>${status(c('有效', 'Active'), 'success')}</div><dl class="detail-list"><div><dt>${c('当前周期', 'Current period')}</dt><dd>2026-09-20 — 2027-09-19</dd></div><div><dt>${c(
      '包含权益',
      'Included entitlement'
    )}</dt><dd>${c('2 个 Site · 托管服务', '2 Sites · managed hosting')}</dd></div><div><dt>${c('付款状态', 'Payment status')}</dt><dd>${c('由 Payment Owner 确认', 'Confirmed by Payment owner')}</dd></div></dl></article></section>
    <section class="panel invoice-panel"><div class="panel__heading"><div><span class="section-label">${c('账单记录', 'INVOICES')}</span><h2>${c(
      '最近账单',
      'Recent invoices'
    )}</h2></div><button class="button button--secondary">${c('下载明细', 'Download details')}</button></div><div class="invoice-row"><span>#MO-2026-0920</span><strong>Site · 2026–2027</strong><span>¥ 2,999.00</span>${status(c('已支付', 'Paid'), 'success')}<time>2026-09-20</time></div><div class="invoice-row"><span>#MO-2026-0915</span><strong>Lite Team · 9 月</strong><span>¥ 199.00</span>${status(c('已支付', 'Paid'), 'success')}<time>2026-09-15</time></div></section>
    <aside class="boundary-card"><span class="boundary-card__icon">i</span><div><strong>${c(
      '产品可使用不等于付款成功',
      'Product availability does not prove payment'
    )}</strong><p>${c(
      '产品安装、商业权益、协议与付款分别由各自 Owner 提供。此评审数据不代表真实交易。',
      'Product installation, entitlement, agreement and payment come from separate owners. Review fixtures do not represent real transactions.'
    )}</p></div></aside>`;
}

function settings() {
  return `
    ${pageHeader(
      c('身份与偏好', 'IDENTITY & PREFERENCES'),
      c('机构设置', 'Organization'),
      c(
        '品牌名称、代理机构名称与法律主体分开维护，不自动共享资格或授权。',
        'Maintain brand, agency names and legal entities separately; qualifications and authority never merge automatically.'
      ),
      button(c('编辑基本资料', 'Edit profile'), 'profile', 'primary')
    )}
    <div class="settings-grid">
      <section class="panel settings-card"><div class="settings-card__head"><div><span class="section-label">${c(
        '基本资料',
        'PROFILE'
      )}</span><h2>${c('机构空间', 'Workspace')}</h2></div>${status(c('待完善', 'Incomplete'), 'warning')}</div><dl class="detail-list"><div><dt>${c(
        '空间名称',
        'Workspace name'
      )}</dt><dd>${c('上海澄明知识产权', 'ClearMark IP Shanghai')}</dd></div><div><dt>${c('主体类型', 'Entity type')}</dt><dd>${c(
        '机构',
        'Organization'
      )}</dd></div><div><dt>${c('联系邮箱', 'Contact email')}</dt><dd>admin@clearmark-ip.cn</dd></div></dl>${button(c('完善资料', 'Complete profile'), 'profile', 'secondary')}</section>
      <section class="panel settings-card"><div class="settings-card__head"><div><span class="section-label">${c(
        '法律主体',
        'LEGAL ENTITY'
      )}</span><h2>${c('合同与资格归属', 'Contract and qualification owner')}</h2></div>${status(c('1 个主体', '1 entity'), 'neutral')}</div><div class="entity-block"><strong>${c(
        '上海澄明企业管理咨询有限公司',
        'ClearMark Business Consulting (Shanghai) Co., Ltd.'
      )}</strong><p>${c('统一社会信用代码 · 已隐藏部分字符', 'Unified social credit identifier · partially masked')}</p><span>${c(
        '资格、合同、客户与业务授权不会与其他主体自动混同。',
        'Qualifications, contracts, customers and authority do not automatically merge with another entity.'
      )}</span></div><button class="button button--ghost">${c('查看主体详情', 'View entity details')}</button></section>
      <section class="panel settings-card settings-card--wide"><div class="settings-card__head"><div><span class="section-label">${c(
        '代理机构身份',
        'AGENCY IDENTITIES'
      )}</span><h2>${c('用于业务展示与身份引用', 'Names used for business display and identity references')}</h2></div>${button(c('绑定名称', 'Bind name'), 'agency', 'secondary')}</div>
        <div class="agency-row"><span class="agency-seal">澄</span><div><strong>${c('上海澄明知识产权代理事务所', 'Shanghai ClearMark IP Agency')}</strong><small>${c('代理机构名称 · CN-AGENCY-02176', 'Agency name · CN-AGENCY-02176')}</small></div>${status(c('已核验', 'Verified'), 'success')}<button class="more-button">•••</button></div>
        <div class="agency-row"><span class="agency-seal agency-seal--outline">CM</span><div><strong>ClearMark IP</strong><small>${c('业务使用名称 · 尚未关联核验身份', 'Business-use name · no verified identity linked')}</small></div>${status(c('待补充证明', 'Evidence needed'), 'warning')}<button class="more-button">•••</button></div>
      </section>
      <section class="panel settings-card settings-card--wide"><div class="settings-card__head"><div><span class="section-label">${c(
        '品牌与工作方式',
        'BRAND & WORKING STYLE'
      )}</span><h2>${c('机构偏好', 'Organization preferences')}</h2></div>${status(c('仅作为偏好', 'Preference only'), 'info')}</div><p>${c(
        '品牌展示由具体 Site 管理。未来可在 AI 对话和工作流程中使用机构偏好；本轮不新增 Cordis 管理后台。',
        'Brand presentation is managed by each Site. Organization preferences may inform future AI conversations and workflows; this V1 adds no Cordis admin console.'
      )}</p><div class="preference-tags"><span>${c('默认中文沟通', 'Chinese-first communication')}</span><span>${c('重大事项需负责人复核', 'Owner review for material actions')}</span><span>${c('客户资料按项目共享', 'Project-scoped customer sharing')}</span></div></section>
    </div>`;
}

function stateLab() {
  const states = [
    [
      c('加载中', 'Loading'),
      c(
        '保持页面结构，禁用操作并向辅助技术播报。',
        'Keep hierarchy, disable actions and announce progress.'
      ),
      'loading'
    ],
    [
      c('空状态', 'Empty'),
      c(
        '说明缺少什么、由谁创建，以及安全的下一步。',
        'Explain what is absent, who creates it and the safe next step.'
      ),
      'empty'
    ],
    [
      c('来源错误', 'Source error'),
      c(
        '不伪装为空；保留输入并提供重试。',
        'Never collapse into empty; preserve input and offer retry.'
      ),
      'error'
    ],
    [
      c('无权限', 'Permission denied'),
      c(
        '不泄露隐藏资源名称，提供安全返回路径。',
        'Do not leak hidden resource names; provide a safe return.'
      ),
      'permission'
    ],
    [
      c('部分数据', 'Partial data'),
      c(
        '显示可用 Owner，同时标明不可用来源和观察时间。',
        'Render available owners and identify unavailable sources and observed time.'
      ),
      'partial'
    ],
    [
      c('成功', 'Success'),
      c(
        '持续显示受影响范围与“仅评审模拟”来源。',
        'Persist affected scope and review-simulation provenance.'
      ),
      'success'
    ]
  ];
  return `${pageHeader(
    c('设计验证', 'DESIGN VALIDATION'),
    c('完整状态矩阵', 'Complete state matrix'),
    c(
      '这些状态使用与主流程相同的组件和语言，不把错误、无权限或部分数据折叠为空。',
      'These states use the same components and language as the primary journeys; error, permission and partial data remain distinct.'
    )
  )}<div class="state-grid">${states
    .map(
      ([title, desc, kind]) =>
        `<article class="state-card"><span class="state-card__sample state-card__sample--${kind}">${
          kind === 'loading'
            ? '<i></i><i></i><i></i>'
            : kind === 'success'
              ? icons.check
              : kind === 'error' || kind === 'permission'
                ? '!'
                : kind === 'partial'
                  ? '½'
                  : '○'
        }</span><h2>${esc(title)}</h2><p>${esc(desc)}</p>${button(
          c('查看示例', 'View example'),
          `state-${kind}`,
          'secondary'
        )}</article>`
    )
    .join(
      ''
    )}</div><a class="back-link" href="${route('overview')}">← ${c('返回首页', 'Back to overview')}</a>`;
}

function liteEmployee() {
  return `<div class="lite-surface"><header class="lite-header"><div><span class="brand__orbit"></span><strong>MarkOrbit Lite</strong></div><div>${status(
    c('员工视角 · 权限已筛选', 'Employee view · access filtered'),
    'info'
  )}<span class="avatar">周</span></div></header><main class="lite-main"><a class="back-link" href="${route('products')}">← ${c(
    '返回机构空间',
    'Back to Workspace'
  )}</a><div class="lite-welcome"><p class="eyebrow">${c('你的工作台', 'YOUR WORKBENCH')}</p><h1>${c(
    '周予安，今天有 4 项获授权工作',
    'Yuan, you have 4 authorized work items today'
  )}</h1><p>${c('只显示与你获授权客户和商标相关的工作。', 'Only work related to customers and trademarks you are authorized to access is shown.')}</p></div><div class="lite-grid"><section class="panel"><div class="panel__heading"><h2>${c(
    '今日工作',
    'Today'
  )}</h2><span>4</span></div>${liteTask(c('确认 MORNING TIDE 商品项目', 'Confirm goods/services for MORNING TIDE'), c('远海科技 · 商标 CM-0258', 'FarSea Technology · Trademark CM-0258'), c('今天 16:00', 'Today 16:00'))}${liteTask(c('准备客户进度说明', 'Prepare customer progress update'), c('远海科技 · 需要负责人复核后发送', 'FarSea Technology · owner review required before send'), c('明天', 'Tomorrow'))}</section><aside class="panel"><div class="panel__heading"><h2>${c('关联资料', 'Related material')}</h2></div><div class="authorized-resource"><strong>${c(
    '远海科技（上海）有限公司',
    'FarSea Technology (Shanghai) Co., Ltd.'
  )}</strong><span>${c('3 件商标 · 查看与处理工作', '3 trademarks · view and handle work')}</span></div><div class="denied-note"><span>i</span><p>${c(
    '其他机构客户与商标不会出现在搜索、列表或旧链接中。',
    'Other Workspace customers and trademarks do not appear in search, lists or old links.'
  )}</p></div></aside></div></main></div>`;
}

function liteTask(title, detail, due) {
  return `<article class="lite-task"><span class="task-check"></span><div><strong>${esc(title)}</strong><small>${esc(
    detail
  )}</small></div><time>${esc(due)}</time></article>`;
}

function sharedAccess() {
  const revoked = state.grantRevoked;
  return `<div class="shared-page"><div class="shared-brand"><span class="brand__orbit"></span><strong>MarkOrbit</strong></div><main class="shared-card ${
    revoked ? 'shared-card--denied' : ''
  }"><span class="shared-card__icon">${revoked ? '×' : icons.check}</span><p class="eyebrow">${c(
    '外部协作访问',
    'EXTERNAL COLLABORATION ACCESS'
  )}</p><h1>${revoked ? c('此访问链接已失效', 'This access link is no longer valid') : c('城际品牌项目', 'Intercity Brand project')}</h1><p>${
    revoked
      ? c(
          '该项目的访问权已由机构负责人撤销。链接本身不构成访问权限。',
          'The Workspace owner revoked access to this project. Possessing the link does not grant authority.'
        )
      : c(
          '你只能查看这个项目及明确列出的关联资料。',
          'You can access only this project and the explicitly listed related material.'
        )
  }</p>${
    revoked
      ? `<div class="denial-meta"><span>${c('撤销时间', 'Revoked')}</span><strong>2026-09-28 10:18 CST</strong><span>${c(
          '访问范围',
          'Prior scope'
        )}</span><strong>${c('城际品牌项目（仅此项目）', 'Intercity Brand project only')}</strong></div><a class="button button--primary" href="mailto:admin@clearmark-ip.cn">${c(
          '联系机构负责人',
          'Contact Workspace owner'
        )}</a>`
      : `<div class="shared-scope"><strong>${c('允许的操作', 'Allowed actions')}</strong><span>${c(
          '查看项目 · 评论 · 上传项目资料',
          'View project · Comment · Upload project files'
        )}</span><strong>${c('到期时间', 'Expires')}</strong><span>2026-09-30 18:00 CST</span></div>${button(
          c('退出项目', 'Leave project'),
          'revoke-self',
          'secondary'
        )}`
  }<small class="shared-card__foot">${c(
    '为保护机构数据，此页面不会显示其他客户、商标或团队成员。',
    'To protect Workspace data, this page never reveals other customers, trademarks or team members.'
  )}</small></main></div>`;
}

function dialog(kind) {
  const map = {
    profile: profileDialog,
    'activate-lite': activateDialog,
    invite: inviteDialog,
    'create-site': createSiteDialog,
    'share-resource': shareDialog,
    agency: agencyDialog,
    revoke: revokeDialog
  };
  const content = (map[kind] ?? genericDialog)();
  return `<div class="dialog-backdrop" data-action="close-dialog"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" data-dialog-panel>${content}</section></div>`;
}

function dialogHead(kicker, title, description) {
  return `<header class="dialog__head"><div><p class="eyebrow">${esc(kicker)}</p><h2 id="dialog-title">${esc(
    title
  )}</h2><p>${esc(description)}</p></div><button class="icon-button" type="button" data-action="close-dialog" aria-label="${c(
    '关闭',
    'Close'
  )}">×</button></header>`;
}

function field(label, input, help = '') {
  return `<label class="field"><span>${esc(label)}</span>${input}${help ? `<small>${esc(help)}</small>` : ''}</label>`;
}

function dialogFoot(action, label, note = '') {
  return `<footer class="dialog__foot">${note ? `<p>${esc(note)}</p>` : '<span></span>'}<div>${button(
    c('取消', 'Cancel'),
    'close-dialog',
    'ghost'
  )}<button class="button button--primary" type="submit" data-submit="${action}">${esc(label)}</button></div></footer>`;
}

function profileDialog() {
  return `${dialogHead(c('机构身份', 'ORGANIZATION IDENTITY'), c('完善机构资料', 'Complete organization profile'), c('这些信息描述当前 Workspace，不会自动建立资格、合同或客户授权。', 'These details describe this Workspace; they do not establish qualifications, contracts or customer authority.'))}<form class="dialog__body form-stack" data-form="profile">${field(
    c('主体类型', 'Entity type'),
    `<div class="segmented"><label><input type="radio" name="entity" value="organization" checked /><span>${c(
      '机构',
      'Organization'
    )}</span></label><label><input type="radio" name="entity" value="individual" /><span>${c('个人执业', 'Solo practitioner')}</span></label></div>`,
    c('个人执业者无需填写虚构公司。', 'Solo practitioners never need to invent a company.')
  )}${field(c('Workspace 名称', 'Workspace name'), `<input name="name" required value="${c('上海澄明知识产权', 'ClearMark IP Shanghai')}" />`)}${field(
    c('法律主体名称', 'Legal entity name'),
    `<input name="legal" required value="${c('上海澄明企业管理咨询有限公司', 'ClearMark Business Consulting (Shanghai) Co., Ltd.')}" />`,
    c('法律主体与品牌、代理机构名称分开。', 'Legal entity is distinct from brand and agency names.')
  )}${field(c('机构联系邮箱', 'Organization contact email'), '<input name="email" type="email" required value="admin@clearmark-ip.cn" />')}${field(
    c('所在地区', 'Location'),
    `<select name="region"><option>${c('中国大陆 · 上海', 'Mainland China · Shanghai')}</option></select>`
  )}${dialogFoot('profile', c('保存评审结果', 'Save review result'), c('仅更新本地评审数据，不写入 Core。', 'Updates local review data only; no Core write.'))}</form>`;
}

function activateDialog() {
  return `${dialogHead(c('产品开通', 'PRODUCT ACTIVATION'), c('确认开通 Lite Team', 'Confirm Lite Team activation'), c('先核对产品、机构范围和权益。开通不等于付款成功或成员获得数据权限。', 'Review product, Workspace scope and entitlements. Activation does not prove payment or grant member data access.'))}<form class="dialog__body form-stack"><div class="confirmation-summary"><div><span>Lite Team</span><strong>¥199 / ${c('月', 'month')}</strong></div><dl><div><dt>${c('归属', 'Subject')}</dt><dd>${c('上海澄明知识产权 · 机构', 'ClearMark IP Shanghai · Workspace')}</dd></div><div><dt>${c(
    '包含',
    'Includes'
  )}</dt><dd>${c('团队空间 + 1 个可分配 Lite Pro 席位', 'Team workspace + 1 assignable Lite Pro seat')}</dd></div><div><dt>${c(
    '成员权限',
    'Member access'
  )}</dt><dd>${c('开通后仍需单独邀请和分配资源', 'Invite and assign resources separately after activation')}</dd></div></dl></div><label class="check-line"><input type="checkbox" required /><span>${c(
    '我理解这是评审模拟，不会创建真实协议、付款或 Core 安装记录。',
    'I understand this is a review simulation and creates no real agreement, payment or Core installation.'
  )}</span></label>${dialogFoot('activate', c('确认模拟开通', 'Confirm simulated activation'))}</form>`;
}

function inviteDialog() {
  return `${dialogHead(c('团队访问', 'TEAM ACCESS'), c('邀请成员并分配资源', 'Invite a member and assign resources'), c('邀请接受后才形成成员关系；资源范围、允许操作和失效时间分别确认。', 'Membership starts only after acceptance; review resources, actions and expiry separately.'))}<form class="dialog__body form-stack">${field(c('成员类型', 'Member type'), `<select name="type"><option>${c('员工', 'Employee')}</option><option>${c('外部协作者', 'External collaborator')}</option></select>`)}${field(c('邮箱', 'Email'), '<input type="email" required placeholder="name@example.com" />')}${field(c('职责', 'Responsibility'), `<select><option>${c('专业人员', 'Professional')}</option><option>${c('复核人员', 'Reviewer')}</option><option>${c('只读成员', 'Viewer')}</option></select>`, c('职责是权限默认值，不替代具体资源授权。', 'Responsibility is a permission default, not a resource grant.'))}<fieldset class="choice-group"><legend>${c('客户范围', 'Customer scope')}</legend><label><input type="checkbox" checked />${c('远海科技（上海）有限公司', 'FarSea Technology (Shanghai) Co., Ltd.')}</label><label><input type="checkbox" checked />${c('北辰消费品有限公司', 'Northstar Consumer Products Co., Ltd.')}</label></fieldset><fieldset class="choice-group"><legend>${c('允许的操作', 'Allowed actions')}</legend><label><input type="checkbox" checked />${c('查看关联资料', 'View related material')}</label><label><input type="checkbox" checked />${c('处理分配工作', 'Handle assigned work')}</label><label><input type="checkbox" />${c('共享给他人', 'Share with others')}</label></fieldset>${field(c('授权失效', 'Access ends'), `<select><option>${c('成员暂停或离职时', 'When membership is suspended or ends')}</option><option>${c('指定日期', 'On a specific date')}</option></select>`)}<div class="review-box"><strong>${c('邀请摘要', 'Invitation summary')}</strong><p>${c('专业人员 · 2 个客户及其 3 件指定商标 · 查看与处理工作 · 不含对外提交权限', 'Professional · 2 customers and 3 selected trademarks · view and handle work · no external submission authority')}</p></div>${dialogFoot('invite', c('发送模拟邀请', 'Send simulated invitation'), c('生产实现需邀请 Owner 合同与资源访问授权。', 'Production requires invitation and resource-access owners.'))}</form>`;
}

function createSiteDialog() {
  return `${dialogHead(c('SITE', 'SITE'), c('创建 Site', 'Create a Site'), c('Site 创建后仍需在具体 Site Admin 完成品牌、域名或渠道核验。', 'After creation, complete brand, domain or channel verification in that Site Admin.'))}<form class="dialog__body form-stack">${field(c('Site 类型', 'Site type'), `<div class="segmented segmented--cards"><label><input type="radio" name="site-type" value="web" checked /><span><strong>${c('官方网站', 'Website')}</strong><small>${c('Web 品牌与服务入口', 'Web brand and service entry')}</small></span></label><label><input type="radio" name="site-type" value="mini" /><span><strong>${c('微信小程序', 'WeChat Mini Program')}</strong><small>${c('渠道身份需另行核验', 'Channel identity requires verification')}</small></span></label></div>`)}${field(c('显示名称', 'Display name'), `<input required value="${c('国际业务入口', 'International Services')}" />`)}${field(c('默认语言', 'Default language'), `<select><option>${c('简体中文', 'Simplified Chinese')}</option><option>English</option></select>`)}<div class="review-box"><strong>${c('创建后的状态', 'State after creation')}</strong><p>${c('草稿。不会自动发布、绑定域名、创建客户关系或授权付款。', 'Draft. It will not auto-publish, bind a domain, create a customer relationship or authorize payment.')}</p></div>${dialogFoot('site', c('创建模拟 Site', 'Create simulated Site'), c('本操作不写入 Site Owner。', 'No Site owner write is performed.'))}</form>`;
}

function shareDialog() {
  return `${dialogHead(c('资源共享', 'RESOURCE SHARING'), c('共享指定资源', 'Share selected resources'), c('授权只覆盖明确列出的资源与操作，不会扩展到同一机构的其他客户。', 'Access covers only listed resources and actions; it never expands to other customers in the Workspace.'))}<form class="dialog__body form-stack">${field(c('共享给', 'Share with'), `<select><option>${c('周予安 · 员工', 'Yuan Zhou · Employee')}</option><option>${c('陈默 · 外部协作', 'Mo Chen · External')}</option></select>`)}<div class="resource-selection"><span class="resource-type-icon">客</span><div><strong>${c('远海科技（上海）有限公司', 'FarSea Technology (Shanghai) Co., Ltd.')}</strong><small>${c('包含 3 件明确关联商标', 'Includes 3 explicitly related trademarks')}</small></div></div><fieldset class="choice-group"><legend>${c('允许的操作', 'Allowed actions')}</legend><label><input type="checkbox" checked />${c('查看客户与关联资料', 'View customer and related material')}</label><label><input type="checkbox" checked />${c('处理分配工作', 'Handle assigned work')}</label><label><input type="checkbox" />${c('管理客户关系', 'Manage customer relationship')}</label></fieldset>${field(c('失效时间', 'Expiry'), '<input type="datetime-local" value="2026-10-31T18:00" />')}<div class="review-box"><strong>${c('不会授予', 'Not granted')}</strong><p>${c('其他客户、未列出的商标、付款、对外发送、提交或委托权限。', 'Other customers, unlisted trademarks, payment, external send, filing or appointment authority.')}</p></div>${dialogFoot('share', c('确认模拟共享', 'Confirm simulated sharing'))}</form>`;
}

function agencyDialog() {
  return `${dialogHead(c('代理机构身份', 'AGENCY IDENTITY'), c('绑定代理机构名称', 'Bind an agency name'), c('名称用于展示与引用；只有核验 Owner 返回的身份才能显示为已核验。', 'Names support display and references; only an identity returned by a verification owner may be marked verified.'))}<form class="dialog__body form-stack">${field(c('代理机构名称', 'Agency name'), `<input required placeholder="${c('输入登记或业务使用名称', 'Enter registered or business-use name')}" />`)}${field(c('名称类型', 'Name type'), `<select><option>${c('登记代理机构名称', 'Registered agency name')}</option><option>${c('业务使用名称', 'Business-use name')}</option></select>`)}${field(c('核验身份引用（可选）', 'Verified identity reference (optional)'), '<input placeholder="CN-AGENCY-…" />', c('留空时显示“待核验”，不会推断资质。', 'If empty, status remains “Unverified”; no qualification is inferred.'))}${field(c('关联法律主体', 'Related legal entity'), `<select><option>${c('上海澄明企业管理咨询有限公司', 'ClearMark Business Consulting (Shanghai) Co., Ltd.')}</option></select>`)}${dialogFoot('agency', c('保存评审绑定', 'Save review binding'), c('仅本地模拟；未执行真实身份核验。', 'Local simulation only; no real verification is performed.'))}</form>`;
}

function revokeDialog() {
  return `${dialogHead(c('撤销访问', 'REVOKE ACCESS'), c('撤销陈默的外部访问？', 'Revoke Mo Chen’s external access?'), c('撤销后，旧链接会重新校验授权并立即拒绝访问。', 'After revocation, old links re-check authority and immediately deny access.'))}<form class="dialog__body form-stack"><div class="confirmation-summary confirmation-summary--danger"><dl><div><dt>${c('人员', 'Person')}</dt><dd>${c('陈默 · 外部协作者', 'Mo Chen · External collaborator')}</dd></div><div><dt>${c('当前范围', 'Current scope')}</dt><dd>${c('仅“城际品牌项目”', 'Intercity Brand project only')}</dd></div><div><dt>${c('当前到期', 'Current expiry')}</dt><dd>2026-09-30 18:00 CST</dd></div></dl></div><label class="check-line"><input type="checkbox" required /><span>${c('同时使已发出的旧链接失效', 'Invalidate previously issued links')}</span></label>${dialogFoot('revoke', c('确认撤销', 'Confirm revocation'))}</form>`;
}

function genericDialog() {
  return `${dialogHead(c('评审状态', 'REVIEW STATE'), c('状态示例', 'State example'), c('这是状态矩阵中的评审示例。', 'This is a review example from the state matrix.'))}<div class="dialog__body"><div class="empty-state"><span>○</span><h3>${c('暂无可显示内容', 'Nothing to show yet')}</h3><p>${c('这里会说明来源与下一步，而不是只显示空白。', 'This state explains source and next step instead of showing a blank area.')}</p></div></div>${dialogFoot('generic', c('完成', 'Done'))}`;
}

function render() {
  const pages = {
    overview,
    resources,
    products,
    team,
    billing,
    settings,
    states: stateLab,
    lite: liteEmployee,
    shared: sharedAccess
  };
  const standalone = state.page === 'lite' || state.page === 'shared';
  const content = (pages[state.page] ?? overview)();
  document.querySelector('#app').innerHTML = standalone ? content : shell(content);
  requestAnimationFrame(() =>
    document.querySelector('[data-dialog-panel] input, [data-dialog-panel] button')?.focus()
  );
}

function announce(message) {
  state.notice = message;
  document.querySelector('#announcer').textContent = message;
  render();
  setTimeout(() => {
    state.notice = '';
    render();
  }, 3400);
}

function updateQuery(extra = {}) {
  const next = new URL(location.href);
  next.searchParams.set('lang', state.lang);
  next.searchParams.set('page', state.page);
  Object.entries(extra).forEach(([key, value]) => next.searchParams.set(key, value));
  history.replaceState({}, '', next);
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'close-dialog' && event.target !== target) return;
  if (
    [
      'profile',
      'activate-lite',
      'invite',
      'create-site',
      'share-resource',
      'agency',
      'revoke'
    ].includes(action)
  ) {
    state.dialog = action;
    render();
    return;
  }
  if (action === 'close-dialog') {
    state.dialog = null;
    render();
    return;
  }
  if (action === 'language') {
    state.lang = zh() ? 'en' : 'zh';
    updateQuery();
    render();
    return;
  }
  if (action === 'resource-tab') {
    state.resourceTab = target.dataset.tab;
    updateQuery({ tab: state.resourceTab });
    render();
    return;
  }
  if (action === 'switch-persona') {
    state.persona = state.persona === 'owner' ? 'employee' : 'owner';
    announce(
      state.persona === 'owner'
        ? c('已切换到负责人视角', 'Switched to owner view')
        : c(
            '已切换到员工视角；当前页面仍为评审预览',
            'Switched to employee view; this page remains a review preview'
          )
    );
    return;
  }
  if (action === 'open-site') {
    announce(
      c(
        '将进入所选 Site Admin；评审原型未打开正式产品入口',
        'Would open the selected Site Admin; the review prototype does not open a production route'
      )
    );
    return;
  }
  if (action === 'revoke-self') {
    state.grantRevoked = true;
    updateQuery({ access: 'revoked' });
    render();
    return;
  }
  if (action?.startsWith('state-')) {
    state.dialog = 'generic';
    render();
  }
});

document.addEventListener('submit', (event) => {
  const submit = event.submitter?.dataset.submit;
  if (!submit) return;
  event.preventDefault();
  if (!event.target.reportValidity()) return;
  state.dialog = null;
  if (submit === 'profile') state.profileComplete = true;
  if (submit === 'site') state.newSite = true;
  if (submit === 'invite') state.invitationSent = true;
  if (submit === 'revoke') {
    state.grantRevoked = true;
    state.page = 'shared';
    updateQuery({ access: 'revoked' });
    render();
    return;
  }
  const messages = {
    profile: c(
      '机构资料已在评审原型中保存；未写入 Core',
      'Profile saved in the review prototype; Core was not updated'
    ),
    activate: c(
      'Lite 模拟开通完成；未创建付款或安装记录',
      'Lite simulated activation completed; no payment or installation record was created'
    ),
    invite: c(
      '模拟邀请已发送；尚未形成正式成员关系',
      'Simulated invitation sent; no active membership exists yet'
    ),
    site: c(
      '模拟 Site 已创建为草稿；未写入 Site Owner',
      'Simulated Site created as Draft; the Site owner was not updated'
    ),
    share: c(
      '模拟资源授权已保存；生产 Resource Access Grant 尚未建立',
      'Simulated resource access saved; no production Resource Access Grant exists'
    ),
    agency: c(
      '代理机构名称已在评审原型中绑定；未执行真实核验',
      'Agency name bound in the review prototype; no real verification was performed'
    ),
    generic: c('状态示例已关闭', 'State example closed')
  };
  announce(messages[submit] ?? c('评审操作已完成', 'Review action completed'));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.dialog) {
    state.dialog = null;
    render();
  }
});

render();
