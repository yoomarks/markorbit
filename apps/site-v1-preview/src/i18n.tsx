import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from './domain.js';

const preferenceKey = 'markorbit:site-v1-preview:admin-locale';

const zh = {
  Overview: '概况',
  Pages: '页面',
  Design: '装修',
  Articles: '文章',
  Inquiries: '咨询',
  Data: '数据',
  'Customer progress': '客户进度',
  'Domain & search': '域名与搜索',
  'Site Admin navigation': '站点后台导航',
  'Open navigation': '打开导航',
  'Site management': '站点管理',
  'My Sites': '我的 Site',
  'Workspace Site products': 'Workspace 的 Site 产品',
  'Choose one Site to manage. Drafts, publication and inquiries remain independent.':
    '选择一个 Site 进入管理。各 Site 的草稿、发布和咨询彼此独立。',
  'Back to My Sites': '返回我的 Site',
  'Current Site': '当前 Site',
  Website: '官方网站',
  'WeChat mini-program': '微信小程序',
  'Mini-program touch preview': '小程序触屏预览',
  'Unpublished changes': '未发布更改',
  'Pending inquiries': '待处理咨询',
  'Needs review': '需要检查',
  'Up to date': '已同步',
  Manage: '管理',
  'Enter Site Admin': '进入管理',
  'Workspace-owned work': '由 Workspace 管理的事项',
  'Members, billing, the complete customer resource library and all-Site governance stay in the Workspace.':
    '成员、账单、完整客户资源库和全部 Site 的统一管理仍在 Workspace 中完成。',
  'Current Site identity': '当前 Site 身份',
  Terminal: '终端类型',
  'Channel configuration': '渠道配置',
  Channel: '来源渠道',
  'Customer relationship': '客户关系',
  'Not linked — lead only': '尚未关联，仅为线索',
  'Qualifying this demo lead does not create or merge a Customer Relationship, Quote, Order, Payment, Matter, provider selection, or protected action.':
    '确认此演示线索不会创建或合并客户关系，也不会创建 Quote、Order、Payment、Matter、选择服务方或执行受保护操作。',
  'Demo AppID not configured': '演示 AppID 未配置',
  'Independent publication boundary': '独立发布边界',
  'Authorized shared sources': '已授权共享来源',
  'References this Site may use': '当前 Site 可使用的来源引用',
  'Import is explicit. A source update never changes this Site draft or publishes it automatically.':
    '引用必须明确导入；来源更新不会自动修改当前 Site 草稿，也不会触发发布。',
  'Read-only references': '只读引用',
  'No access to this Site': '无权访问此 Site',
  'Your Workspace membership does not grant access to this Site. Direct links cannot reveal drafts, inquiries or settings.':
    '你的 Workspace 成员身份未获得此 Site 的访问权限；即使知道直达链接，也不能查看草稿、咨询或设置。',
  'Drafts and publication versions belong only to this siteId. Shared Workspace sources do not publish another Site.':
    '草稿和发布版本只属于当前 siteId；引用 Workspace 共享来源不会发布另一个 Site。',
  Site: '站点',
  Active: '已启用',
  'Workspace / Site': '工作空间 / 站点',
  'Inquiry views': '咨询相关页面',
  'Settings pages': '设置相关页面',
  'Pages & navigation': '页面与导航',
  'Visual editor': '可视化编辑',
  Content: '内容管理',
  Services: '服务',
  Insights: '专业洞察',
  Contact: '联系我们',
  'Leads & inquiries': '咨询与线索',
  'Client service': '客户服务',
  Analytics: '访问分析',
  'Domain & SEO/GEO': '域名与 SEO/GEO',
  Settings: '设置',
  Collection: '收款',
  'Collection settings': '收款设置',
  'Site collection configuration': '当前 Site 收款配置',
  'Active demo configuration': '当前演示配置',
  'Current relationship': '当前收款关系',
  'Authorized options': '已授权选项',
  'Select a collection relationship': '选择收款关系',
  'Authorized collection relationship': '授权收款关系',
  'Merchant owner': '商户主体 Owner',
  'Payment channel': '支付渠道',
  'Service fulfiller': '服务履行者',
  'Contract relationship': '合同与转介关系',
  'No payment status is created': '不会创建支付状态',
  'This browser-local configuration does not create checkout, payment success, settlement, refund, or provider credentials.':
    '此浏览器本地配置不会创建结账、支付成功、到账、结算、退款或支付渠道凭证。',
  'Choose only a merchant relationship authorized by Workspace and Payment. Site never stores credentials.':
    '只能选择 Workspace 与 Payment 已授权的商户关系；Site 不保存敏感凭证。',
  'Unauthorized reference': '未授权引用',
  'Authorization required': '需要重新授权',
  'The current configuration references an unauthorized relationship and cannot be activated.':
    '当前配置引用未获授权，不能启用。',
  'Demo channel only — no real provider connection': '仅演示渠道，未连接真实支付服务',
  'Authorized reference — owner verification still required at runtime':
    '已授权引用，运行时仍需由权威 Owner 校验',
  'No authorized collection relationship': '暂无已授权收款关系',
  'Ask a Workspace payment administrator to authorize a merchant relationship. Site cannot create one.':
    '请由 Workspace 收款管理员授权商户关系；Site 不能自行创建。',
  'Review and activate': '检查并启用',
  'Structured confirmation': '结构化确认',
  'Activate for this Site only?': '仅为当前 Site 启用？',
  'I confirm this configuration applies only to the current Site and does not prove a payment or settlement.':
    '我确认此配置只用于当前 Site，且不代表已经付款、到账或结算。',
  'Activate demo collection configuration': '启用演示收款配置',
  'Demo collection configuration': '演示收款配置',
  Activated: '已启用',
  'Operations assistant': '运营助手',
  'Close assistant': '关闭运营助手',
  'Draft preparation only': '仅用于准备草稿',
  'The assistant can prepare a reviewable draft. Publishing, collection changes and customer messages always use structured confirmation.':
    '助手只能准备可审核草稿；发布、修改收款配置和发送客户消息始终需要结构化确认。',
  'Suggested tasks': '建议任务',
  'Prepare homepage copy': '准备首页文案',
  'Organize service content': '整理服务内容',
  'Draft a campaign brief': '制作活动简报',
  'What would you like to prepare?': '这次想准备什么？',
  'Generate draft proposal': '生成草稿建议',
  'Proposal pending review': '待审核提案',
  'Apply to current Site draft': '应用到当前 Site 草稿',
  'Applied to draft': '已应用到草稿',
  'Open visual editor to review': '进入可视化编辑器审核',
  'Owner-backed commerce evidence': '权威来源经营证据',
  'Attributed orders': '来源订单',
  'Orders and payments remain managed by their authoritative owners.':
    '订单与支付由其权威 Owner 管理',
  'Read-only evidence': '只读证据',
  'No attributed order evidence': '暂无来源订单证据',
  'No owner order reference is attributed to this Site fixture.':
    '当前 Site 演示数据暂无权威订单引用。',
  'Price authority boundaries': '价格权威边界',
  'MO product plans': 'MO 产品套餐',
  'Managed outside Site Admin and never editable here.':
    '由 Site Admin 之外的产品 Owner 管理，此处不可修改。',
  'Site display price': 'Site 展示价',
  'Localized guidance for visitors; not a binding Quote.':
    '面向访客的本地化说明，不是有约束力的 Quote。',
  'Final Quote or Order': '正式 Quote / Order',
  'Owned by the governed commercial workflow and exact versions.':
    '由受治理商业流程及准确版本管理。',
  Promotions: '优惠活动',
  'Only authorized rule references may be displayed.': '只能展示已获授权的规则引用。',
  'Authorized promotion': '已授权活动',
  'No authorized promotion': '暂无已授权活动',
  'Site overview': '站点总览',
  'See what needs attention before you publish.': '查看发布前需要处理的事项。',
  'Choose which pages visitors can find and the order they appear in.':
    '设置访客可以找到的页面及其显示顺序。',
  'Update the homepage, preview the draft, and publish when it is ready.':
    '修改首页、预览草稿，并在准备完成后发布。',
  'Write, review, preview, and publish customer-facing articles.':
    '撰写、审核、预览并发布面向客户的文章。',
  'Update the services visitors can see and understand.': '修改访客可查看的服务介绍。',
  'Read visitor questions and see exactly where each one came from.':
    '查看访客提交的问题及其准确来源。',
  'Preview the customer progress entry without creating another order or matter record.':
    '预览客户进度入口，但不创建另一套订单或案件记录。',
  'See which pages and articles led to real browser-local inquiries.':
    '查看哪些页面和文章带来了当前浏览器中的真实演示咨询。',
  'Check the domain and search preview without changing DNS or submitting to search engines.':
    '检查域名与搜索预览，但不修改 DNS，也不向搜索引擎提交。',
  'Manage Site features, languages, and access for this Workspace.':
    '管理此工作空间的站点功能、语言与访问权限。',
  'Readiness, reach, and the work that needs attention.':
    '优先查看发布准备度、未发布变更与待处理线索。',
  'Manage the routes, visibility, and hierarchy of this Site projection.':
    '管理站点页面、可见性与导航顺序。',
  'Shape a bounded page from blocks and compare the draft with the published demo.':
    '编辑页面区块，并对照草稿与已发布演示。',
  'Prepare reviewed knowledge for an explicit Site demo publication.':
    '管理经过审核、可明确发布到演示站点的内容。',
  'Services & offers': '服务与展示',
  'Choose which owner-backed service references are visible on the Site.':
    '选择站点可展示的权威来源服务引用。',
  'Trace every demo inquiry back to its page, content, and service source.':
    '将每条演示咨询追溯到页面、内容和服务来源。',
  'Preview request and progress information without creating a second order or matter truth.':
    '展示请求与进度，但不创建第二套订单或 Matter 真相。',
  'Operations & analytics': '运营与访问分析',
  'Connect Site attention to demo inquiries and the content that influenced them.':
    '连接站点关注、演示咨询及其内容归因。',
  'Review projection metadata and readiness without executing DNS or search submissions.':
    '检查站点元数据与准备度，不执行 DNS 或搜索提交。',
  'Site settings': '站点设置',
  'Control demo modules, locale, and access without duplicating Workspace billing or identity.':
    '管理演示模块、语言与访问权限，不复制 Workspace 账单或身份。',
  Workspace: '工作空间',
  'View Site': '查看站点',
  'Edit Site': '装修站点',
  'Design homepage': '装修首页',
  'Unpublished draft': '有未发布更改',
  'View-only access': '仅查看权限',
  'Draft differs from the customer-facing demo': '草稿与客户可见版本不同',
  Draft: '草稿',
  Desktop: '桌面',
  'Save draft': '保存草稿',
  'Review & publish': '检查并发布',
  'Site map': '站点地图',
  'Add page unavailable in preview': '此预览暂不支持新增页面',
  'Preview draft': '预览草稿',
  'Content library': '内容库',
  'Search content': '搜索内容',
  'Filter by status': '按状态筛选',
  'All statuses': '全部状态',
  'No matching content': '没有符合条件的内容',
  'New content': '新建内容',
  'Edit content': '编辑内容',
  Title: '标题',
  Excerpt: '摘要',
  Body: '正文',
  'Related service': '关联服务',
  'Prepare demo publication': '准备演示发布',
  'Publish content demo': '发布内容演示',
  'No demo leads yet': '暂无演示线索',
  Inbox: '线索收件箱',
  'Mark qualified': '标记为已确认',
  'Prepare follow-up': '准备跟进',
  Modules: '功能模块',
  'Workspace & access': '工作空间与访问',
  'Demo permission': '演示权限',
  Locale: '站点语言',
  'Reset this demo Workspace': '重置此演示工作空间',
  'Reset this demo Site': '重置此演示 Site',
  'Reset demo access and fixtures': '重置演示权限与数据',
  'Demo fixtures only': '仅浏览器本地演示数据',
  'INTERACTIVE PRODUCT PREVIEW': '交互式产品预览',
  'No production data, publication, payment, email, or domain action':
    '不使用生产数据，也不会执行真实发布、付款、邮件或域名操作',
  'Demo published': '演示已发布',
  'This role can view the Site and customer experience, but cannot change or publish it.':
    '当前角色可以查看站点和客户体验，但不能修改或发布。',
  'Changes stay private until you review and publish them.':
    '更改会保持私有，直到你完成检查并发布。',
  'No inquiries yet': '暂无咨询',
  'When a visitor submits the Site form, the inquiry will appear here with its reference and exact source.':
    '访客提交网站表单后，咨询会连同编号和准确来源显示在这里。',
  'Open inquiry form': '打开咨询表单',
  'Published version': '已发布版本',
  'Publication readiness': '发布准备度',
  'Pending leads': '待处理线索',
  'Latest content': '最新内容',
  'Latest inquiry': '最新咨询',
  'Authority boundary': '权限边界',
  'Illustrative visitors': '示意访客数',
  'Inquiry rate': '咨询转化率',
  'Content-assisted leads': '内容辅助线索',
  'Top market': '主要市场',
  Unavailable: '不可计算',
  Visible: '显示',
  'Site health': '发布准备度',
  'One action before launch': '发布前还有一项待处理',
  'Published demo': '已发布演示',
  'Safe preview': '安全预览',
  'No demo inquiries yet': '暂无演示咨询',
  'Projection, not business truth': '仅为投影，不是业务真相',
  Page: '页面',
  Path: '路径',
  Status: '状态',
  Actions: '操作',
  Home: '首页',
  Properties: '属性',
  'Block label': '区块名称',
  Heading: '标题',
  'Supporting copy': '辅助文案',
  'Show this block': '显示此区块',
  'Brand name': '品牌名称',
  'Publish this snapshot?': '发布此内容快照？',
  'Demo publication checklist': '演示发布检查',
  'The customer Site will switch to the next exact version. No domain, email, search, payment, or production data action will run.':
    '客户可见 Site 将切换到下一个准确版本；不会执行域名、邮件、搜索、付款或生产数据操作。',
  'Brand is configured': '品牌信息已配置',
  'Hero is visible': '首屏区块已显示',
  'At least one service is visible': '至少一项服务已显示',
  'Contact route is visible': '联系页面已显示',
  'Keep editing': '继续编辑',
  'Publish demo': '发布演示',
  'Version history': '版本历史',
  'Restore to draft': '恢复为草稿',
  'Publication boundary': '发布边界',
  Markets: '市场',
  'Fee display': '费用展示',
  Summary: '简介',
  'Service display management': '服务展示管理',
  'Services visible on this Site': '当前 Site 展示的服务',
  'These are Site-specific display records linked to owner-backed product references.':
    '这些是当前 Site 独立维护的展示记录，并保留业务 Owner 的产品引用。',
  'Search services': '搜索服务',
  'Language status': '语言状态',
  'Preview service': '预览服务',
  'No matching services': '没有符合条件的服务',
  Authority: '权限边界',
  'Visitor message': '访客原始消息',
  'Attribution lineage': '归因链路',
  'Handoff boundary': '交接边界',
  'Projection only': '仅供投影演示',
  'Customer requests': '客户请求',
  Reference: '编号',
  Request: '请求',
  Stage: '阶段',
  'Last update': '最近更新',
  'Partial demo analytics': '部分演示分析数据',
  'Conversion path': '转化路径',
  'Content to demand': '内容与需求',
  'Demo domain': '演示域名',
  'Verification not executed': '尚未执行验证',
  'Proposed hostname': '建议主机名',
  'Search preview': '搜索结果预览',
  'Workspace-owned settings': 'Workspace 管理的设置',
  'Demo access recovery': 'Demo 权限恢复',
  Published: '已发布',
  Hidden: '隐藏',
  'Add block': '添加区块',
  'Start an inquiry': '预约咨询',
  'Move up': '上移',
  'Move down': '下移',
  Primary: '主色',
  Accent: '强调色',
  'Draft has unpublished changes': '草稿有未发布更改',
  'Draft matches published demo': '草稿与已发布演示一致',
  'Draft saved locally': '草稿已保存到当前浏览器',
  'Demo published as version': '演示已发布为版本',
  'Restore creates a new draft. Historical demo snapshots remain unchanged.':
    '恢复操作会创建新草稿，历史演示快照保持不变。',
  English: 'English',
  'Simplified Chinese': '简体中文'
} as const;

export type AdminMessage = keyof typeof zh;

interface AdminI18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (message: string) => string;
  formatDate: (value: string) => string;
  formatNumber: (value: number) => string;
}

const Context = createContext<AdminI18n | undefined>(undefined);

export function AdminLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setValue] = useState<Locale>(() =>
    localStorage.getItem(preferenceKey) === 'en-US' ? 'en-US' : 'zh-CN'
  );
  const value = useMemo<AdminI18n>(
    () => ({
      locale,
      setLocale(next) {
        localStorage.setItem(preferenceKey, next);
        setValue(next);
      },
      t(message) {
        return locale === 'zh-CN' ? (zh[message as AdminMessage] ?? message) : message;
      },
      formatDate(value) {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
      },
      formatNumber(value) {
        return new Intl.NumberFormat(locale).format(value);
      }
    }),
    [locale]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAdminI18n(): AdminI18n {
  const value = useContext(Context);
  if (!value) throw new Error('AdminLocaleProvider is required.');
  return value;
}

export const adminLocaleStorageKey = preferenceKey;
