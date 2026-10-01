const copy = {
  zh: {
    nav: ['首页', '资源', '产品', '团队', '财务', '机构设置'],
    pages: ['overview', 'resources', 'products', 'team', 'finance', 'settings'],
    preview: '独立评审预览',
    locale: 'EN',
    assistant: '对话引导',
    fixture:
      '评审夹具：所有金额、订单和状态仅用于验证界面，不代表真实付款、冻结资金、Core 持久化或生产开通。'
  },
  en: {
    nav: ['Overview', 'Resources', 'Products', 'Team', 'Finance', 'Organization'],
    pages: ['overview', 'resources', 'products', 'team', 'finance', 'settings'],
    preview: 'Independent review preview',
    locale: '中文',
    assistant: 'Guided assistant',
    fixture:
      'Review fixture: amounts, orders and statuses validate the interface only. They are not real payment, held funds, Core persistence or production activation.'
  }
};
const state = {
  lang: 'zh',
  page: 'overview',
  modal: null,
  chat: false,
  purchased: false,
  sites: [],
  manager: false,
  financeTab: 'mo',
  scenario: null
};
const query = new URLSearchParams(location.search.replaceAll(';', '&'));
if (query.get('lang') === 'en') state.lang = 'en';
if (copy.zh.pages.includes(query.get('page'))) state.page = query.get('page');
if (query.get('purchased') === '1') state.purchased = true;
if (query.get('sites') === '2')
  state.sites =
    state.lang === 'zh'
      ? [
          { name: '澄知官方网站', channel: '官方网站' },
          { name: '澄知微信小程序', channel: '微信小程序' }
        ]
      : [
          { name: 'ClearMark Official Website', channel: 'Official Website' },
          { name: 'ClearMark WeChat Mini Program', channel: 'WeChat Mini Program' }
        ];
if (query.get('manager') === '1') state.manager = true;
if (['mo', 'receivable', 'payable', 'commission', 'docs', 'collection'].includes(query.get('tab')))
  state.financeTab = query.get('tab');
if (
  [
    'mismatch',
    'scenario-payment',
    'scenario-renewal',
    'scenario-permission',
    'transaction'
  ].includes(query.get('modal'))
)
  state.modal = query.get('modal');
const el = (id) => document.getElementById(id);
const t = (z, e) => (state.lang === 'zh' ? z : e);
const announce = (msg) => {
  el('live').textContent = msg;
};
const badge = (label, kind = '') => `<span class="status ${kind}">${label}</span>`;
const btn = (label, action, kind = '') =>
  `<button class="btn ${kind}" data-action="${action}">${label}</button>`;
function shell(content) {
  const c = copy[state.lang];
  return `<div class="shell"><aside class="rail"><div class="brand">MarkOrbit<small>${c.preview}</small></div><div class="workspace-switch"><b>${t('澄知知识产权', 'ClearMark IP')}</b><span>${t('机构 Workspace · Owner', 'Organization Workspace · Owner')}</span></div><nav class="nav" aria-label="${t('主导航', 'Primary')}">${c.nav.map((n, i) => `<button data-page="${c.pages[i]}" class="${state.page === c.pages[i] ? 'active' : ''}"${state.page === c.pages[i] ? ' aria-current="page"' : ''}>${n}</button>`).join('')}</nav><div class="rail-foot">${t('当前行事主体', 'Acting entity')}<br><b>${t('上海澄知知识产权代理有限公司', 'Shanghai ClearMark IP Agency Co., Ltd.')}</b></div></aside><main class="main"><header class="topbar"><span class="mobile-title">${c.nav[c.pages.indexOf(state.page)]}</span><button class="btn" data-action="locale">${c.locale}</button></header><div id="content" class="content" tabindex="-1">${content}</div></main></div><div class="assistant"><button data-action="chat">${c.assistant}</button>${state.chat ? chat() : ''}</div>${state.modal ? modal() : ''}`;
}
const head = (ey, title, desc, actions = '') =>
  `<div class="headline"><div><div class="eyebrow">${ey}</div><h1>${title}</h1><p>${desc}</p></div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
function overview() {
  return `${head(t('机构经营台', 'Organization operations'), t('今天需要你决定什么', 'What needs your decision today'), t('先确认当前机构身份，再处理产品、授权与资金记录。这里不是个人待办看板。', 'Confirm the acting organization, then handle products, access and money records. This is not a personal task board.'), btn(t('开通产品', 'Get a product'), 'go-products', 'primary'))}<div class="notice">${copy[state.lang].fixture}</div><div class="grid three"><section class="card"><div class="kicker">${t('当前机构身份', 'Current identity')}</div><h2>${t('澄知知识产权', 'ClearMark IP')}</h2><p>${t('显示品牌：澄知 · 代理机构名称 2 个 · 法律主体分别核验', 'Display brand: ClearMark · 2 agency names · legal entities verified separately')}</p>${badge(t('资料待补 1 项', '1 profile item due'), 'warn')}</section><section class="card"><div class="kicker">${t('产品可用性', 'Product availability')}</div><div class="metric">${state.purchased ? t('Lite + Site', 'Lite + Site') : t('仅 Lite', 'Lite only')}</div><p>${t('付费、权益、安装与成员授权分别判断', 'Payment, entitlement, installation and member access are evaluated separately')}</p></section><section class="card"><div class="kicker">${t('负责人事项', 'Owner decisions')}</div><div class="metric">3</div><p>${t('续费确认、收款主体核对、外部访问到期', 'Renewal, collecting entity match and expiring external access')}</p></section></div><div class="grid two" style="margin-top:16px"><section class="card"><div class="split-title"><h2>${t('资金视图', 'Money views')}</h2>${badge(t('不合并为余额', 'No combined balance'), 'info')}</div><div class="stack"><div class="lane"><strong>${t('向 MO 支付', 'Payments to MO')}</strong><span>${t('订阅订单与退款 · Payment / Core Commercial', 'Subscription orders and refunds · Payment / Core Commercial')}</span></div><div class="lane"><strong>${t('客户业务收款', 'Client receipts')}</strong><span>${t('代理费应收与实收 · 业务 Owner', 'Agency receivables and receipts · business owner')}</span></div><div class="lane"><strong>${t('合作方付款', 'Partner payables')}</strong><span>${t('服务商款项 · 对应业务 Owner', 'Provider payments · relevant business owner')}</span></div><div class="lane"><strong>${t('佣金与结算', 'Commission and settlement')}</strong><span>${t('当前只有资格与费率证据，不能声称已结算', 'Current evidence covers eligibility/rate only; no settlement claim')}</span></div><div class="lane"><strong>${t('票据与对账', 'Documents and reconciliation')}</strong><span>${t('付款凭证、退款、发票与差异处理', 'Payment evidence, refunds, invoices and exceptions')}</span></div></div></section><section class="card"><h2>${t('状态不等价', 'States are not equivalent')}</h2><div class="timeline"><div class="timeline-item"><div><strong>${t('支付成功', 'Payment succeeded')}</strong><span>${t('只证明支付 Owner 的结果', 'Only proves the Payment owner result')}</span></div></div><div class="timeline-item"><div><strong>${t('协议与权益生效', 'Agreement and entitlement active')}</strong><span>${t('由 Core Commercial 独立确认', 'Confirmed independently by Core Commercial')}</span></div></div><div class="timeline-item"><div><strong>${t('产品安装可用', 'Installation active')}</strong><span>${t('不能从付款自动推断', 'Never inferred from payment')}</span></div></div><div class="timeline-item"><div><strong>${t('成员获授权', 'Member assigned')}</strong><span>${t('席位也不等于业务资源权限', 'A seat is not business-resource access')}</span></div></div></div></section></div>`;
}
function resources() {
  return `${head(t('业务 Owner 的资源目录', 'Owner-backed resource directory'), t('资源', 'Resources'), t('统一查找，不复制客户、商标、商机或知识数据库。', 'Find owner-backed resources without copying customer, trademark, opportunity or knowledge stores.'))}<div class="grid two">${[
    ['客户', 'Customer', 'MarkReg Customer Context'],
    ['商标资产', 'Trademark assets', 'Lite Trademark Asset'],
    ['商机与工作', 'Opportunities & work', 'Lite'],
    ['知识', 'Knowledge', 'Knowledge / Core delivery']
  ]
    .map(
      (x) =>
        `<section class="card"><div class="kicker">${x[2]}</div><h2>${t(x[0], x[1])}</h2><p>${t('显示精确 Owner 引用、更新时间与授权范围。', 'Shows exact owner reference, observed time and access scope.')}</p>${btn(t('查看目录', 'Open directory'), 'toast')}</section>`
    )
    .join('')}</div>`;
}
function products() {
  const purchased = state.purchased;
  return `${head(t('购买与管理', 'Purchase & management'), t('产品', 'Products'), t('套餐价格来自已发布商业目录；购买、权益、安装和席位保持独立。', 'Prices come from the published commercial catalog; purchase, entitlement, installation and seats stay distinct.'), purchased ? btn(t('创建 Site', 'Create Site'), 'create-site', 'primary') : btn(t('开通 Site', 'Get Site'), 'buy-site', 'primary'))}<div class="notice">${copy[state.lang].fixture}</div><section class="card"><div class="split-title"><div><div class="kicker">${t('套餐比较 · 评审示例', 'Plan comparison · review example')}</div><h2>${t('选择适合机构的产品', 'Choose a product for the organization')}</h2></div>${badge(t('价格以商业目录为准', 'Catalog-priced'), 'info')}</div><table class="compare"><thead><tr><th>${t('产品', 'Product')}</th><th>${t('付款主体', 'Payer')}</th><th>${t('权益', 'Entitlements')}</th><th>${t('席位 / 用量', 'Seats / usage')}</th><th>${t('续费', 'Renewal')}</th><th></th></tr></thead><tbody><tr><td><b>Lite ${t('团队版', 'Team')}</b><br><small>${t('成员的个人工作台', 'Personal workbench for members')}</small></td><td>${t('机构', 'Organization')}</td><td>${t('工作台 + 指定资源', 'Workbench + assigned resources')}</td><td>5 ${t('席位', 'seats')}</td><td>2027-09-28</td><td>${badge(t('已开通', 'Active'), 'good')}</td></tr><tr><td><b>Site ${t('成长版', 'Growth')}</b><br><small>${t('多 Site 机构入口', 'Multi-Site organization presence')}</small></td><td>${t('机构', 'Organization')}</td><td>${t('最多 3 个 Site', 'Up to 3 Sites')}</td><td>${state.sites.length}/3 Site</td><td>${purchased ? '2027-09-28' : '—'}</td><td>${purchased ? badge(t('已开通', 'Active'), 'good') : btn(t('选择', 'Select'), 'buy-site')}</td></tr><tr><td><b>Lite ${t('个人版', 'Individual')}</b></td><td>${t('员工个人', 'Employee personally')}</td><td>${t('仅本人；不占机构团队席位', 'User only; no organization seat')}</td><td>1</td><td>${t('由员工管理', 'Employee-managed')}</td><td>${badge(t('责任分开', 'Separate'), 'info')}</td></tr></tbody></table></section>${purchased ? productState() : ''}${purchased ? sites() : ''}`;
}
function productState() {
  return `<section class="card" style="margin-top:16px"><h2>${t('Site 开通链路', 'Site activation chain')}</h2><div class="steps"><div class="step done">${t('支付成功', 'Paid')}</div><div class="step done">${t('协议生效', 'Agreement')}</div><div class="step done">${t('权益生效', 'Entitlement')}</div><div class="step done">${t('安装可用', 'Installation')}</div><div class="step ${state.manager ? 'done' : ''}">${t('成员授权', 'Member access')}</div></div><div class="grid two"><div class="summary"><div><span>Payment</span>${badge('SUCCEEDED', 'good')}</div><div><span>Commercial Agreement</span>${badge('ACTIVE', 'good')}</div><div><span>Entitlement site.capacity</span><b>3</b></div></div><div class="summary"><div><span>Installation</span>${badge('ACTIVE', 'good')}</div><div><span>${t('已建 Site', 'Sites created')}</span><b>${state.sites.length}/3</b></div><div><span>${t('管理员分配', 'Manager assignment')}</span>${state.manager ? badge(t('已分配', 'Assigned'), 'good') : badge(t('待分配', 'Pending'), 'warn')}</div></div></div></section><section class="card" style="margin-top:16px"><div class="split-title"><div><div class="kicker">${t('负向验收', 'Negative acceptance')}</div><h2>${t('异常状态实验室', 'Exception state lab')}</h2></div>${badge(t('不会修改真实状态', 'No real mutation'), 'info')}</div><div class="actions">${btn(t('支付失败', 'Payment failed'), 'scenario-payment')}${btn(t('续费到期', 'Renewal expired'), 'scenario-renewal')}${btn(t('成员无权限', 'Member denied'), 'scenario-permission')}</div></section>`;
}
function sites() {
  return `<section class="card" style="margin-top:16px"><div class="split-title"><h2>${t('我的 Site', 'My Sites')}</h2>${state.sites.length < 2 ? btn(t('创建 Site', 'Create Site'), 'create-site', 'primary') : ''}</div>${state.sites.length ? `<div class="rows"><div class="row row-head"><span>Site</span><span>${t('渠道', 'Channel')}</span><span>${t('收款主体', 'Collecting entity')}</span><span>${t('管理员', 'Manager')}</span><span></span></div>${state.sites.map((s, i) => `<div class="row"><div><b>${s.name}</b><small>site_review_${i + 1} · DRAFT</small></div><span>${s.channel}</span><span>${t('上海澄知知识产权代理有限公司', 'Shanghai ClearMark IP Agency Co., Ltd.')}</span><span>${state.manager ? t('林宁', 'Nina Lin') : t('未分配', 'Unassigned')}</span><div class="actions">${!state.manager ? btn(t('分配管理员', 'Assign manager'), 'assign-manager') : ''}${btn(t('进入管理', 'Open Admin'), 'open-admin')}</div></div>`).join('')}</div>` : `<div class="denied"><h3>${t('还没有 Site', 'No Sites yet')}</h3><p>${t('权益已生效后，才能创建实例。', 'Instances can be created only after entitlement is active.')}</p></div>`}</section>`;
}
function team() {
  return `${head(t('成员、席位与资源授权', 'Members, seats & resource grants'), t('团队', 'Team'), t('成员身份、产品席位、Site 管理权限和业务资源授权是不同层次。', 'Membership, product seats, Site admin access and business-resource grants are separate layers.'))}<section class="card"><div class="row row-head"><span>${t('成员', 'Member')}</span><span>${t('身份', 'Membership')}</span><span>${t('产品席位', 'Product seat')}</span><span>${t('资源 / 操作 / 到期', 'Resource / actions / expiry')}</span><span></span></div><div class="row"><div><b>${t('林宁', 'Nina Lin')}</b><small>lin@example.test</small></div>${badge(t('员工 · 有效', 'Employee · active'), 'good')}<span>Lite 1/1<br>${state.manager ? 'Site Admin' : '—'}</span><span>${t('客户：远岚；商标：MOKI · 查看/编辑 · 任职有效期内', 'Customer: FarPeak; mark: MOKI · view/edit · while employed')}</span>${btn(t('管理权限', 'Manage access'), 'assign-manager')}</div><div class="row"><div><b>${t('顾问项目组', 'Consulting project')}</b><small>external_review_1</small></div>${badge(t('外部 · 限时', 'External · timed'), 'warn')}<span>—</span><span>${t('仅项目 PX-24 · 查看 · 2026-10-15 失效', 'Project PX-24 only · view · expires 2026-10-15')}</span>${btn(t('撤销', 'Revoke'), 'toast', 'danger')}</div></section>`;
}
function finance() {
  const tabs = [
    ['mo', t('MO 订阅', 'MO subscriptions')],
    ['receivable', t('业务收款', 'Client receipts')],
    ['payable', t('合作方付款', 'Partner payments')],
    ['commission', t('佣金结算', 'Commission')],
    ['docs', t('对账与票据', 'Reconciliation')],
    ['collection', t('收款配置', 'Collection config')]
  ];
  return `${head(t('证据化资金视图', 'Evidence-based money views'), t('财务', 'Finance'), t('统一查看，不形成一个“可用余额”。每笔记录保留订单、业务、双方主体、币种、渠道、状态与证据来源。', 'One place to inspect, never one available balance. Every row keeps order, business, entities, currency, channel, status and evidence source.'))}<div class="notice warn">${t('本轮不提供充值、转账或提现。Stripe 的 requires_capture 当前被映射为 PROCESSING，不能在界面声称“已预授权/已冻结”。', 'No top-up, transfer or withdrawal in this release. Stripe requires_capture currently maps to PROCESSING, so the UI cannot claim “preauthorized/held”.')}</div><div class="tabs">${tabs.map((x) => `<button data-finance="${x[0]}" class="${state.financeTab === x[0] ? 'active' : ''}" aria-pressed="${state.financeTab === x[0]}">${x[1]}</button>`).join('')}</div>${financeBody()}`;
}
function financeBody() {
  if (state.financeTab === 'collection') return collection();
  if (state.financeTab === 'commission')
    return `<section class="card"><h2>${t('佣金与待结算', 'Commission and pending settlement')}</h2><div class="notice warn">${t('当前 Lite 只生成“佣金审核资格候选”，合同明确 commissionAmountCalculated / settlementClaimed / payoutCompleted 均为 false。', 'Lite currently produces only a commission-review eligibility candidate; the contract explicitly keeps commissionAmountCalculated, settlementClaimed and payoutCompleted false.')}</div><div class="row"><div><b>${t('引荐资格候选', 'Referral eligibility candidate')}</b><small>partner-commission-eligibility_review</small></div>${badge(t('待审核', 'Review required'), 'warn')}<span>${t('金额不可用', 'Amount unavailable')}</span><span>Core Rate Policy + Lite evidence</span>${btn(t('查看证据', 'View evidence'), 'transaction')}</div></section>`;
  const data =
    {
      mo: [
        t('Site 成长版订阅', 'Site Growth subscription'),
        'MO-ORD-2026-0928',
        t('澄知 → MarkOrbit', 'ClearMark → MarkOrbit'),
        'CNY · Stripe',
        state.purchased ? t('已支付', 'Paid') : t('待支付', 'Pending'),
        state.purchased ? 'Payment SUCCEEDED' : 'Checkout draft'
      ],
      receivable: [
        t('远岚商标代理费', 'FarPeak agency fee'),
        'MR-ORDER-1842',
        t('远岚 → 澄知', 'FarPeak → ClearMark'),
        'CNY · 银行转账',
        t('已支付', 'Paid'),
        t('业务 Owner 付款凭证', 'Business owner receipt evidence')
      ],
      payable: [
        t('检索服务商费用', 'Search provider fee'),
        'PO-REVIEW-08',
        t('澄知 → 云检服务', 'ClearMark → CloudSearch'),
        'CNY · 银行转账',
        t('待支付', 'Pending'),
        t('服务交付 Owner', 'Delivery owner')
      ],
      docs: [
        t('订阅付款对账', 'Subscription reconciliation'),
        'MO-ORD-2026-0928',
        t('澄知 ↔ MarkOrbit', 'ClearMark ↔ MarkOrbit'),
        'CNY · Stripe',
        t('匹配', 'Match'),
        'Payment reconciliation observation'
      ]
    }[state.financeTab] || [];
  return `<section class="card"><div class="row row-head"><span>${t('订单 / 业务', 'Order / business')}</span><span>${t('收付款主体', 'Entities')}</span><span>${t('币种 / 渠道', 'Currency / channel')}</span><span>${t('状态 / 证据', 'Status / evidence')}</span><span></span></div><div class="row"><div><b>${data[0]}</b><small>${data[1]}</small></div><span>${data[2]}</span><span>${data[3]}</span><span>${badge(data[4], data[4].includes('失败') ? 'bad' : 'good')}<small>${data[5]}</small></span>${btn(t('详情', 'Details'), 'transaction')}</div></section>`;
}
function collection() {
  return `<div class="grid two"><section class="card"><div class="split-title"><h2>${t('上海澄知知识产权代理有限公司', 'Shanghai ClearMark IP Agency Co., Ltd.')}</h2>${badge(t('已核验', 'Verified'), 'good')}</div><p>${t('法律主体 · 统一社会信用代码结尾 8K2P', 'Legal entity · registration ID ending 8K2P')}</p><div class="summary"><div><span>${t('代理机构名称', 'Agency name')}</span><b>${t('澄知知识产权', 'ClearMark IP')}</b></div><div><span>${t('商户账户引用', 'Merchant account ref')}</span><b>stripe_acct_••8392</b></div><div><span>${t('渠道 / 币种', 'Channel / currency')}</span><b>Stripe · CNY</b></div></div></section><section class="card"><div class="split-title"><h2>${t('北京远桥商标代理事务所', 'Beijing FarBridge Trademark Agency')}</h2>${badge(t('待核验', 'Verification due'), 'warn')}</div><p>${t('独立法律主体；不能继承澄知的收款资格。', 'Separate legal entity; cannot inherit ClearMark collection authority.')}</p><div class="summary"><div><span>${t('代理机构名称', 'Agency name')}</span><b>${t('远桥商标', 'FarBridge Marks')}</b></div><div><span>${t('商户账户引用', 'Merchant account ref')}</span><b>—</b></div><div><span>${t('Site 绑定', 'Site binding')}</span><b>${t('不可用', 'Unavailable')}</b></div></div>${btn(t('查看不匹配错误', 'See mismatch error'), 'mismatch')}</section></div>`;
}
function settings() {
  return `${head(t('机构身份与对话式引导', 'Identity & guided operations'), t('机构设置', 'Organization'), t('品牌、代理机构名称与法律主体分别管理。对话帮助补齐信息，最终由结构化确认控件执行。', 'Manage brand, agency names and legal entities separately. Conversation gathers context; trusted structured controls perform the action.'), btn(t('开始资料引导', 'Start guided setup'), 'chat', 'primary'))}<div class="grid two"><section class="card"><h2>${t('机构资料', 'Organization profile')}</h2><div class="summary"><div><span>${t('Workspace 名称', 'Workspace name')}</span><b>${t('澄知知识产权', 'ClearMark IP')}</b></div><div><span>${t('机构类型', 'Entity type')}</span><b>${t('机构', 'Organization')}</b></div><div><span>${t('显示品牌', 'Display brand')}</span><b>${t('澄知', 'ClearMark')}</b></div></div></section><section class="card"><h2>${t('已绑定代理机构名称', 'Bound agency names')}</h2><p><b>${t('澄知知识产权', 'ClearMark IP')}</b> · ${badge(t('主体已核验', 'Entity verified'), 'good')}</p><p><b>${t('远桥商标', 'FarBridge Marks')}</b> · ${badge(t('主体待核验', 'Entity pending'), 'warn')}</p></section></div>`;
}
function scenarios() {
  return '';
}
function chat() {
  return `<section class="chat" aria-label="${t('对话式引导', 'Guided assistant')}"><div class="split-title"><b>${t('开通 Site 引导', 'Site setup guide')}</b><button class="btn" data-action="chat">×</button></div><div class="bubble">${t('我会沿用你正在查看的 Workspace、套餐和法律主体。先补充信息，再生成确认卡。', 'I will use the Workspace, plan and legal entity already in context. I will gather details, then build a confirmation card.')}</div><div class="confirm-card"><b>${t('结构化确认卡', 'Structured confirmation card')}</b><p>${t('Site 成长版 · 机构付款 · 最多 3 个 Site', 'Site Growth · organization payer · up to 3 Sites')}</p><small>${t('支付确认必须在可信支付控件完成；聊天文本不能授权付款。', 'Payment confirmation must use a trusted payment control; chat text cannot authorize it.')}</small></div></section>`;
}
function modal() {
  if (state.modal?.startsWith('scenario-')) return scenarioModal(state.modal);
  if (state.modal === 'buy')
    return `<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true"><div class="eyebrow">${t('结构化确认', 'Structured confirmation')}</div><h2>${t('开通 Site 成长版', 'Get Site Growth')}</h2><div class="form"><div class="field"><label>${t('购买主体', 'Purchasing entity')}</label><select><option>${t('上海澄知知识产权代理有限公司', 'Shanghai ClearMark IP Agency Co., Ltd.')}</option></select><small>${t('显示品牌不能改变付款或收款主体。', 'Display brand cannot change payer or payee authority.')}</small></div><div class="field"><label>${t('优惠资格', 'Discount eligibility')}</label><div class="summary"><div><span>${t('机构首购优惠', 'New organization offer')}</span>${badge(t('不适用：已有 Lite 团队协议', 'Not applicable: existing Lite Team agreement'), 'warn')}</div></div></div><div class="summary"><div><span>${t('套餐', 'Plan')}</span><b>Site ${t('成长版', 'Growth')}</b></div><div><span>${t('评审示例价', 'Review example price')}</span><b>¥2,999 / ${t('年', 'year')}</b></div><div><span>${t('支付确认', 'Payment confirmation')}</span><b>${t('可信支付控件', 'Trusted payment control')}</b></div></div><div class="notice warn">${t('点击仅生成本地评审结果，不会发起真实支付或写入 Core。', 'This button creates a local review result only; it will not start real payment or write Core.')}</div></div><div class="dialog-foot">${btn(t('取消', 'Cancel'), 'close')}${btn(t('确认评审开通', 'Confirm review activation'), 'confirm-buy', 'primary')}</div></section></div>`;
  if (state.modal === 'site')
    return `<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true"><h2>${t('创建 Site', 'Create Site')}</h2><div class="form"><div class="field"><label>${t('Site 名称', 'Site name')}</label><input id="siteName" value="${state.sites.length ? t('澄知微信小程序', 'ClearMark WeChat Mini Program') : t('澄知官方网站', 'ClearMark Official Website')}" /></div><div class="field"><label>${t('渠道', 'Channel')}</label><select id="siteChannel"><option>${state.sites.length ? t('微信小程序', 'WeChat Mini Program') : t('官方网站', 'Official Website')}</option></select></div><div class="field"><label>${t('收款配置', 'Collection configuration')}</label><select><option>${t('上海澄知知识产权代理有限公司 · 已核验', 'Shanghai ClearMark IP Agency Co., Ltd. · verified')}</option></select><small>${t('Site 的 merchantOwnerRef 必须匹配已核验主体。', 'The Site merchantOwnerRef must match a verified entity.')}</small></div></div><div class="dialog-foot">${btn(t('取消', 'Cancel'), 'close')}${btn(t('创建评审 Site', 'Create review Site'), 'confirm-site', 'primary')}</div></section></div>`;
  if (state.modal === 'transaction')
    return `<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true"><h2>${t('资金记录详情', 'Money record detail')}</h2><div class="summary"><div><span>${t('订单', 'Order')}</span><b>MO-ORD-2026-0928</b></div><div><span>${t('业务', 'Business')}</span><b>Site Growth subscription</b></div><div><span>${t('付款主体', 'Payer')}</span><b>${t('上海澄知知识产权代理有限公司', 'Shanghai ClearMark IP Agency Co., Ltd.')}</b></div><div><span>${t('收款主体', 'Payee')}</span><b>MarkOrbit</b></div><div><span>${t('币种 / 渠道', 'Currency / channel')}</span><b>CNY · Stripe</b></div><div><span>${t('状态', 'Status')}</span><b>${state.purchased ? 'SUCCEEDED' : 'PENDING'}</b></div><div><span>${t('凭证来源', 'Evidence source')}</span><b>${state.purchased ? 'Payment webhook receipt' : 'Checkout fixture'}</b></div></div><div class="notice">${t('支付成功不会自动证明协议、权益、安装或成员授权。', 'Payment success does not automatically prove agreement, entitlement, installation or member access.')}</div><div class="dialog-foot">${btn(t('关闭', 'Close'), 'close')}</div></section></div>`;
  if (state.modal === 'mismatch')
    return `<div class="dialog-backdrop"><section class="dialog" role="alertdialog" aria-modal="true"><h2>${t('收款主体不匹配', 'Collecting entity mismatch')}</h2>${badge(t('已阻止保存', 'Save blocked'), 'bad')}<p>${t('“远桥商标”属于独立法律主体，当前没有已核验商户账户。更改 Site 显示名称不会取得“澄知”的收款权。', '“FarBridge Marks” belongs to a separate legal entity and has no verified merchant account. Changing the Site display name cannot obtain ClearMark collection authority.')}</p><div class="dialog-foot">${btn(t('返回配置', 'Back to configuration'), 'close')}</div></section></div>`;
  if (state.modal === 'permission')
    return `<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true"><h2>${t('分配 Site 管理权限', 'Assign Site admin access')}</h2><div class="field"><label>${t('成员', 'Member')}</label><select><option>${t('林宁 · 有效员工', 'Nina Lin · active employee')}</option></select></div><div class="summary"><div><span>${t('可访问', 'Can access')}</span><b>${state.sites.map((s) => s.name).join('、') || 'Site'}</b></div><div><span>${t('可执行', 'Can perform')}</span><b>${t('查看、编辑、发布前提交复核', 'View, edit, submit for review before publish')}</b></div><div><span>${t('有效期', 'Validity')}</span><b>${t('任职有效期内', 'While membership remains active')}</b></div></div><div class="dialog-foot">${btn(t('取消', 'Cancel'), 'close')}${btn(t('确认分配', 'Confirm assignment'), 'confirm-manager', 'primary')}</div></section></div>`;
  return '';
}
function scenarioModal(kind) {
  const content =
    kind === 'scenario-payment'
      ? [
          t('支付失败', 'Payment failed'),
          'FAILED',
          t(
            '支付 Owner 返回失败。商业协议、权益和安装均未被标记为生效；可在确认付款主体后重新发起新的支付尝试。',
            'The Payment owner returned FAILED. Agreement, entitlement and installation remain unclaimed; a new attempt can be started after reconfirming the payer.'
          )
        ]
      : kind === 'scenario-renewal'
        ? [
            t('续费已到期', 'Renewal expired'),
            'EXPIRED',
            t(
              '协议与权益到期分别显示。新的使用会失败关闭，既有 Site 与记录不会被静默删除。',
              'Agreement and entitlement expiry are shown separately. New use fails closed; existing Sites and records are not silently deleted.'
            )
          ]
        : [
            t('成员无权限', 'Member has no permission'),
            'PERMISSION_DENIED',
            t(
              '该成员没有当前 Site 的管理授权。响应不披露其他客户或 Site 数据，旧链接同样被拒绝。',
              'The member has no current admin grant for this Site. The response reveals no other customer or Site data, and old links are also denied.'
            )
          ];
  return `<div class="dialog-backdrop"><section class="dialog" role="alertdialog" aria-modal="true"><h2>${content[0]}</h2>${badge(content[1], 'bad')}<p>${content[2]}</p><div class="dialog-foot">${btn(t('关闭', 'Close'), 'close')}</div></section></div>`;
}
function render() {
  const pages = { overview, resources, products, team, finance, settings };
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  el('app').innerHTML = shell(pages[state.page]());
  bind();
}
function syncRoute(mode = 'push') {
  const params = new URLSearchParams(location.search.replaceAll(';', '&'));
  params.set('page', state.page);
  state.lang === 'en' ? params.set('lang', 'en') : params.delete('lang');
  state.page === 'finance' && state.financeTab !== 'mo'
    ? params.set('tab', state.financeTab)
    : params.delete('tab');
  params.delete('modal');
  history[`${mode}State`]({}, '', `${location.pathname}?${params.toString()}`);
}
function bind() {
  document.querySelectorAll('[data-page]').forEach(
    (x) =>
      (x.onclick = () => {
        state.page = x.dataset.page;
        syncRoute();
        render();
      })
  );
  document.querySelectorAll('[data-finance]').forEach(
    (x) =>
      (x.onclick = () => {
        state.financeTab = x.dataset.finance;
        syncRoute();
        render();
      })
  );
  document
    .querySelectorAll('[data-action]')
    .forEach((x) => (x.onclick = () => action(x.dataset.action)));
}
function action(a) {
  if (a === 'locale') {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    syncRoute('replace');
  } else if (a === 'chat') {
    state.chat = !state.chat;
  } else if (a === 'go-products') {
    state.page = 'products';
    syncRoute();
  } else if (a === 'buy-site') {
    state.modal = 'buy';
  } else if (a === 'confirm-buy') {
    state.purchased = true;
    state.modal = null;
    announce(t('评审开通链路已生成', 'Review activation chain created'));
  } else if (a === 'create-site') {
    state.modal = 'site';
  } else if (a === 'confirm-site') {
    state.sites.push({ name: el('siteName').value, channel: el('siteChannel').value });
    state.modal = null;
    announce(t('Site 已添加到评审夹具', 'Site added to review fixture'));
  } else if (a === 'assign-manager') {
    state.modal = 'permission';
  } else if (a === 'confirm-manager') {
    state.manager = true;
    state.modal = null;
    announce(t('Site 管理权限已分配', 'Site admin access assigned'));
  } else if (a === 'transaction') {
    state.modal = 'transaction';
  } else if (a === 'mismatch') {
    state.modal = 'mismatch';
  } else if (a.startsWith('scenario-')) {
    state.modal = a;
  } else if (a === 'open-admin') {
    announce(
      t(
        '已验证进入指定 Site Admin 的交接；预览不打开生产入口',
        'Validated handoff to the selected Site Admin; preview does not open a production route'
      )
    );
  } else if (a === 'close') {
    state.modal = null;
  } else if (a === 'toast') {
    announce(t('这是 Owner 深链的评审反馈', 'This is review feedback for an owner deep link'));
  }
  render();
}
addEventListener('popstate', () => {
  const params = new URLSearchParams(location.search.replaceAll(';', '&'));
  state.lang = params.get('lang') === 'en' ? 'en' : 'zh';
  state.page = copy.zh.pages.includes(params.get('page')) ? params.get('page') : 'overview';
  state.financeTab = ['mo', 'receivable', 'payable', 'commission', 'docs', 'collection'].includes(
    params.get('tab')
  )
    ? params.get('tab')
    : 'mo';
  state.modal = null;
  state.chat = false;
  render();
});
render();
