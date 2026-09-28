export type WorkspaceId = 'atlas' | 'foundry';
export type DemoSiteId = 'site_atlas_demo' | 'site_atlas_mini_demo' | 'site_foundry_demo';
export type SiteTerminal = 'WEB' | 'WECHAT_MINIPROGRAM';
export type TemplateId = 'counsel' | 'exchange';
export type Locale = 'zh-CN' | 'en-US';
export type TranslationStatus = 'DRAFT' | 'REVIEW_READY' | 'PUBLISHED';
export type AdminSection =
  | 'overview'
  | 'pages'
  | 'editor'
  | 'content'
  | 'services'
  | 'leads'
  | 'client-service'
  | 'analytics'
  | 'seo'
  | 'settings';

export interface Block {
  id: string;
  kind: 'hero' | 'proof' | 'services' | 'insights' | 'cta';
  label: string;
  title: string;
  body: string;
  visible: boolean;
}

export interface PageRecord {
  id: string;
  path: string;
  title: string;
  visible: boolean;
  status: 'DRAFT' | 'PUBLISHED';
}

export interface ServiceRecord {
  id: string;
  productRef: string;
  version: number;
  title: string;
  summary: string;
  markets: string[];
  feeNote: string;
  visible: boolean;
}

export interface ContentRecord {
  id: string;
  packageRef: string;
  version: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  relatedServiceId: string;
  status: 'DRAFT' | 'REVIEW_READY' | 'PUBLISHED';
  views: number;
}

export interface SiteConfig {
  template: TemplateId;
  brandName: string;
  tagline: string;
  primary: string;
  accent: string;
  locale: string;
  defaultLocale: Locale;
  enabledLocales: Locale[];
  localePublication: Record<Locale, TranslationStatus>;
  localized: Record<Locale, LocalizedSiteContent>;
  market: string;
  domain: string;
  modules: { assets: boolean; portal: boolean; insights: boolean };
  pages: PageRecord[];
  blocks: Block[];
  services: ServiceRecord[];
  content: ContentRecord[];
}

export interface LocalizedSiteContent {
  brandName: string;
  tagline: string;
  pageTitles: Record<string, string>;
  blocks: Record<string, { label: string; title: string; body: string }>;
  services: Record<string, { title: string; summary: string; feeNote: string }>;
  content: Record<
    string,
    {
      title: string;
      excerpt: string;
      body: string;
      status: TranslationStatus;
      version: number;
    }
  >;
  seo: { title: string; description: string };
  legal: {
    privacyTitle: string;
    privacyBody: string;
    termsTitle: string;
    termsBody: string;
  };
  authorName: string;
}

export interface PublishedVersion {
  version: number;
  publishedAt: string;
  label: string;
  config: SiteConfig;
}

export interface DemoLead {
  id: string;
  workspaceId: WorkspaceId;
  siteId: string;
  channel: SiteTerminal;
  createdAt: string;
  name: string;
  email: string;
  company: string;
  market: string;
  serviceId: string;
  message: string;
  sourcePath: string;
  sourceContentId?: string;
  sourceAssetId?: string;
  status: 'NEW' | 'QUALIFIED' | 'FOLLOW_UP';
}

export interface SiteState {
  workspaceId: WorkspaceId;
  workspaceName: string;
  siteId: DemoSiteId;
  siteName: string;
  terminal: SiteTerminal;
  role: 'OWNER' | 'VIEWER' | 'NONE';
  lifecycle: 'DRAFT' | 'ACTIVE';
  draft: SiteConfig;
  published: SiteConfig;
  versions: PublishedVersion[];
  leads: DemoLead[];
  savedAt: string;
  publishedAt: string;
  analyticsPartial: boolean;
  sharedSources: SiteSharedSourceGrant[];
}

/** @deprecated Compatibility alias for older preview tests and persisted fixtures. */
export type WorkspaceState = SiteState;

export interface DemoWorkspacePortfolio {
  workspaceId: WorkspaceId;
  workspaceName: string;
  siteIds: DemoSiteId[];
  defaultSiteId: DemoSiteId;
}

export interface SiteSharedSourceGrant {
  kind: 'BRAND' | 'CONTENT' | 'SERVICE';
  sourceRef: string;
  access: 'READ';
  updateMode: 'EXPLICIT_IMPORT';
}

const services: ServiceRecord[] = [
  {
    id: 'svc-us-filing',
    productRef: 'markreg:product_trademark',
    version: 7,
    title: 'US trademark filing',
    summary: 'A review-led path from scope and classes to a filing-ready instruction set.',
    markets: ['United States'],
    feeNote: 'Professional fee illustration from $680; official fees and final Quote are separate.',
    visible: true
  },
  {
    id: 'svc-global-strategy',
    productRef: 'markreg:product_strategy',
    version: 3,
    title: 'International portfolio strategy',
    summary: 'Prioritise markets, ownership evidence, and filing sequence with a specialist.',
    markets: ['United States', 'European Union', 'United Kingdom', 'China'],
    feeNote: 'Scope and fees are confirmed only in a governed Quote.',
    visible: true
  },
  {
    id: 'svc-asset-review',
    productRef: 'markreg:product_asset_review',
    version: 2,
    title: 'Trademark asset review',
    summary: 'A structured review for teams evaluating brand assets and transaction readiness.',
    markets: ['Global'],
    feeNote: 'Inquiry only; no asset right, ownership, valuation, or availability is implied.',
    visible: true
  }
];

const content: ContentRecord[] = [
  {
    id: 'content-filing-map',
    packageRef: 'lite:publish_filing_map',
    version: 2,
    slug: 'filing-map-before-expansion',
    title: 'Build a filing map before your next market launch',
    excerpt: 'A practical framework for connecting commercial expansion to trademark priorities.',
    body: 'Market expansion creates pressure to move quickly, but a clear filing map starts with business intent. Separate the markets where you trade now, the markets where you will launch next, and the markets that matter because of manufacturing or enforcement risk. Then review ownership, classes, evidence, and dependencies with a qualified professional before any formal action.',
    relatedServiceId: 'svc-global-strategy',
    status: 'PUBLISHED',
    views: 842
  },
  {
    id: 'content-clearance',
    packageRef: 'lite:publish_clearance',
    version: 1,
    slug: 'what-clearance-can-tell-you',
    title: 'What a clearance review can—and cannot—tell you',
    excerpt: 'How to read risk signals without mistaking a search result for legal certainty.',
    body: 'A search result is evidence for review, not an automatic decision. The quality of a clearance process depends on the mark, goods and services, geography, data coverage, similarity analysis, and professional judgment. Record assumptions and unresolved questions so the decision remains explainable.',
    relatedServiceId: 'svc-us-filing',
    status: 'REVIEW_READY',
    views: 318
  }
];

function localized(template: TemplateId): Record<Locale, LocalizedSiteContent> {
  const exchange = template === 'exchange';
  const english: LocalizedSiteContent = {
    brandName: exchange ? 'Foundry Brand Exchange' : 'Atlas IP Counsel',
    tagline: exchange
      ? 'Explore brand assets with context, evidence, and a governed next step.'
      : 'Trademark counsel for brands moving across markets.',
    pageTitles: {
      home: 'Home',
      services: 'Services',
      insights: 'Articles',
      assets: 'Trademark showcase',
      contact: 'Contact us'
    },
    blocks: {
      hero: {
        label: 'Hero',
        title: exchange
          ? 'A better way to explore brand assets.'
          : 'Protect the brand you are building.',
        body: exchange
          ? 'Curated demonstrations with provenance, review points, and specialist support.'
          : 'Plan across markets, understand the evidence, and stay in control of every formal step.'
      },
      proof: {
        label: 'Trust note',
        title: exchange ? 'Context before claims' : 'Clarity before action',
        body: exchange
          ? 'Demo listings distinguish presentation material from trademark rights and transaction facts.'
          : 'Every recommendation, quote, and formal step remains reviewable and explicitly approved.'
      },
      services: {
        label: 'Services',
        title: exchange ? 'Advisory around every asset' : 'Ways we can help',
        body: 'Owner-backed service references, explained in plain language.'
      },
      insights: {
        label: 'Insights',
        title: exchange ? 'Market notes for brand builders' : 'Ideas for the decisions ahead',
        body: 'Reviewed guidance connected to the service it supports.'
      },
      cta: {
        label: 'Contact call-to-action',
        title: exchange ? 'Review an asset with context.' : 'Bring us the next question.',
        body: 'Tell us the market, service, and timing. We will return with a reviewable next step.'
      }
    },
    services: {
      'svc-us-filing': {
        title: 'US trademark filing',
        summary: 'A review-led path from scope and classes to a filing-ready instruction set.',
        feeNote:
          'Professional fee illustration from $680; official fees and final Quote are separate.'
      },
      'svc-global-strategy': {
        title: 'International portfolio strategy',
        summary: 'Prioritise markets, ownership evidence, and filing sequence with a specialist.',
        feeNote: 'Scope and fees are confirmed only in a governed Quote.'
      },
      'svc-asset-review': {
        title: 'Trademark asset review',
        summary: exchange
          ? 'Review a selected demo asset without implying ownership, availability, or transaction authority.'
          : 'A structured review for teams evaluating brand assets and transaction readiness.',
        feeNote: 'Inquiry only; no asset right, ownership, valuation, or availability is implied.'
      }
    },
    content: {
      'content-filing-map': {
        title: exchange
          ? 'Map brand assets before entering a new market'
          : 'Build a filing map before your next market launch',
        excerpt: exchange
          ? 'Connect asset provenance and market intent before a governed review.'
          : 'A practical framework for connecting commercial expansion to trademark priorities.',
        body: exchange
          ? 'A brand asset catalogue is a starting point, not proof of rights or transaction readiness. Preserve the source record, identify the relevant markets, and request a governed professional review before relying on any listing.'
          : 'Market expansion creates pressure to move quickly, but a clear filing map starts with business intent. Separate the markets where you trade now, the markets where you will launch next, and the markets that matter because of manufacturing or enforcement risk. Then review ownership, classes, evidence, and dependencies with a qualified professional before any formal action.',
        status: 'PUBLISHED',
        version: 2
      },
      'content-clearance': {
        title: exchange
          ? 'What an asset review can—and cannot—confirm'
          : 'What a clearance review can—and cannot—tell you',
        excerpt: exchange
          ? 'Separate presentation, provenance, rights evidence, and transaction authority.'
          : 'How to read risk signals without mistaking a search result for legal certainty.',
        body: 'A search result or asset listing is evidence for review, not an automatic decision. Record the source, assumptions, coverage, and unresolved questions so the next decision remains explainable.',
        status: 'REVIEW_READY',
        version: 1
      }
    },
    seo: {
      title: exchange
        ? 'Foundry Brand Exchange · Demo asset review'
        : 'Atlas IP Counsel · Trademark services',
      description: exchange
        ? 'Fictional brand assets with explicit evidence and authority boundaries.'
        : 'Review-led trademark strategy and filing support across markets.'
    },
    legal: {
      privacyTitle: 'Privacy notice',
      privacyBody:
        'This preview stores demo changes and inquiries only in this browser. It does not transmit production personal data.',
      termsTitle: 'Service terms',
      termsBody:
        'This fictional Site does not create a Quote, Order, Payment, Matter, appointment, filing, ownership claim, or legal advice.'
    },
    authorName: exchange ? 'Foundry editorial desk' : 'Atlas editorial team'
  };
  const chinese: LocalizedSiteContent = {
    brandName: exchange ? 'Foundry 品牌资产平台' : 'Atlas 商标顾问',
    tagline: exchange
      ? '在清晰的来源、证据与审核边界下探索品牌资产。'
      : '为跨市场发展的品牌提供商标专业支持。',
    pageTitles: {
      home: '首页',
      services: '服务',
      insights: '文章',
      assets: '商标展示',
      contact: '联系我们'
    },
    blocks: {
      hero: {
        label: '首屏',
        title: exchange ? '用更可靠的方式探索品牌资产。' : '守护你正在建立的品牌。',
        body: exchange
          ? '每项演示资产都保留来源、审核要点与专业支持入口。'
          : '从市场规划到证据判断，让每一项正式行动都保持清晰、可审核、可授权。'
      },
      proof: {
        label: '信任说明',
        title: exchange ? '先看背景，再谈主张' : '先厘清，再行动',
        body: exchange
          ? '演示信息明确区分展示材料、商标权利、所有权与交易事实。'
          : '建议、报价与正式步骤均需经过明确审核和授权。'
      },
      services: {
        label: '服务',
        title: exchange ? '围绕品牌资产的专业支持' : '我们可以如何协助',
        body: '以权威来源为依据，用清晰语言说明服务范围与边界。'
      },
      insights: {
        label: '洞察',
        title: exchange ? '给品牌建设者的市场笔记' : '为下一步决策提供参考',
        body: '经过审核的专业内容，并连接到相应服务。'
      },
      cta: {
        label: '咨询行动',
        title: exchange ? '带着背景信息审核一项资产。' : '把你的下一个问题交给我们。',
        body: '告诉我们目标市场、关注服务与时间安排，我们会提供可审核的下一步建议。'
      }
    },
    services: {
      'svc-us-filing': {
        title: '美国商标申请',
        summary: '从需求范围、商品服务类别到申请指示，由专业人员逐步审核。',
        feeNote: '专业服务费演示价自 680 美元起；官方费用及最终 Quote 另行确认。'
      },
      'svc-global-strategy': {
        title: '国际商标组合策略',
        summary: '结合业务计划，与专业人员共同确定市场优先级、权利基础和申请顺序。',
        feeNote: '服务范围与费用仅以经过治理的 Quote 为准。'
      },
      'svc-asset-review': {
        title: '商标资产审核',
        summary: exchange
          ? '围绕所选演示资产核对来源与证据，不暗示权利、可用性或交易授权。'
          : '帮助团队结构化评估品牌资产及其交易准备度。',
        feeNote: '仅供咨询演示，不代表任何资产权利、所有权、估值或可用性。'
      }
    },
    content: {
      'content-filing-map': {
        title: exchange ? '进入新市场前，先梳理品牌资产' : '进入新市场前，先建立商标申请地图',
        excerpt: exchange
          ? '在正式审核前，把资产来源与市场计划连接起来。'
          : '把业务扩张计划转化为清晰的商标优先级。',
        body: exchange
          ? '品牌资产目录只是起点，并不证明商标权利或交易准备度。请保留来源记录、确认相关市场，并在依赖任何展示信息前申请受治理的专业审核。'
          : '业务扩张往往要求快速行动，但可靠的申请地图应从真实商业意图出发。区分当前经营、下一步计划进入，以及因生产或维权风险而重要的市场，再由合格专业人员审核权利主体、类别、使用证据和依赖关系。',
        status: 'PUBLISHED',
        version: 2
      },
      'content-clearance': {
        title: exchange
          ? '资产审核能够确认什么，又不能确认什么'
          : '商标检索能够说明什么，又不能说明什么',
        excerpt: exchange
          ? '明确区分展示、来源、权利证据与交易授权。'
          : '理解风险信号，但不要把检索结果误认为法律确定性。',
        body: '检索结果或资产展示只是供审核的证据，并不会自动形成结论。应记录来源、假设、覆盖范围及未决问题，使后续决策保持可解释。',
        status: 'REVIEW_READY',
        version: 1
      }
    },
    seo: {
      title: exchange ? 'Foundry 品牌资产平台 · 演示审核' : 'Atlas 商标顾问 · 商标专业服务',
      description: exchange
        ? '在明确的证据与权限边界下展示虚构品牌资产。'
        : '面向跨市场业务的审核式商标策略与申请支持。'
    },
    legal: {
      privacyTitle: '隐私说明',
      privacyBody: '本预览仅在当前浏览器保存演示变更与咨询，不会传输生产环境个人数据。',
      termsTitle: '服务条款',
      termsBody:
        '本虚构站点不会创建 Quote、Order、Payment、Matter、委托、申请、所有权主张或法律意见。'
    },
    authorName: exchange ? 'Foundry 编辑团队' : 'Atlas 专业编辑团队'
  };
  return { 'zh-CN': chinese, 'en-US': english };
}

export function projectLocale(config: SiteConfig, locale: Locale): SiteConfig {
  const copy = config.localized[locale];
  return {
    ...structuredClone(config),
    brandName: copy.brandName,
    tagline: copy.tagline,
    locale,
    pages: config.pages.map((page) => ({ ...page, title: copy.pageTitles[page.id] ?? page.title })),
    blocks: config.blocks.map((block) => ({ ...block, ...(copy.blocks[block.id] ?? {}) })),
    services: config.services.map((service) => ({
      ...service,
      ...(copy.services[service.id] ?? {})
    })),
    content: config.content.map((item) => ({ ...item, ...(copy.content[item.id] ?? {}) }))
  };
}

function config(template: TemplateId): SiteConfig {
  const exchange = template === 'exchange';
  return {
    template,
    brandName: exchange ? 'Foundry Brand Exchange' : 'Atlas IP Counsel',
    tagline: exchange
      ? 'Discover brand assets with context, evidence, and a clear next step.'
      : 'Trademark counsel for brands moving across markets.',
    primary: exchange ? '#181617' : '#173f35',
    accent: exchange ? '#ff5c35' : '#d9a441',
    locale: 'zh-CN',
    defaultLocale: 'zh-CN',
    enabledLocales: ['zh-CN', 'en-US'],
    localePublication: { 'zh-CN': 'PUBLISHED', 'en-US': 'PUBLISHED' },
    localized: localized(template),
    market: exchange ? 'Global' : 'United States',
    domain: exchange ? 'brands.foundry.demo' : 'trademarks.atlas.demo',
    modules: { assets: exchange, portal: true, insights: true },
    pages: [
      { id: 'home', path: '/', title: 'Home', visible: true, status: 'PUBLISHED' },
      { id: 'services', path: '/services', title: 'Services', visible: true, status: 'PUBLISHED' },
      { id: 'insights', path: '/insights', title: 'Insights', visible: true, status: 'PUBLISHED' },
      {
        id: 'assets',
        path: '/assets',
        title: 'Brand assets',
        visible: exchange,
        status: 'PUBLISHED'
      },
      { id: 'contact', path: '/contact', title: 'Contact', visible: true, status: 'PUBLISHED' }
    ],
    blocks: [
      {
        id: 'hero',
        kind: 'hero',
        label: 'Hero',
        title: exchange
          ? 'A better way to explore brand assets.'
          : 'Protect the brand you are building.',
        body: exchange
          ? 'Curated demonstrations with provenance, review points, and specialist support.'
          : 'Plan across markets, understand the evidence, and stay in control of every formal step.',
        visible: true
      },
      {
        id: 'proof',
        kind: 'proof',
        label: 'Trust note',
        title: exchange ? 'Context before claims' : 'Clarity before action',
        body: exchange
          ? 'Demo listings distinguish presentation material from trademark rights and transaction facts.'
          : 'Every recommendation, quote, and formal step remains reviewable and explicitly approved.',
        visible: true
      },
      {
        id: 'services',
        kind: 'services',
        label: 'Services',
        title: 'Ways we can help',
        body: 'Owner-backed service references, explained in plain language.',
        visible: true
      },
      {
        id: 'insights',
        kind: 'insights',
        label: 'Insights',
        title: 'Ideas for the decisions ahead',
        body: 'Reviewed guidance connected to the service it supports.',
        visible: true
      },
      {
        id: 'cta',
        kind: 'cta',
        label: 'Contact call-to-action',
        title: 'Bring us the next question.',
        body: 'Tell us the market, service, and timing. We will return with a reviewable next step.',
        visible: true
      }
    ],
    services: structuredClone(services),
    content: structuredClone(content)
  };
}

export function seedSite(siteId: DemoSiteId): SiteState {
  const foundry = siteId === 'site_foundry_demo';
  const miniProgram = siteId === 'site_atlas_mini_demo';
  const workspaceId: WorkspaceId = foundry ? 'foundry' : 'atlas';
  const initial = config(foundry ? 'exchange' : 'counsel');
  if (miniProgram) {
    initial.brandName = 'Atlas 微信服务';
    initial.domain = '微信小程序 · 演示 AppID 未配置';
    initial.modules.assets = false;
    initial.localized['zh-CN'].brandName = 'Atlas 微信服务';
    initial.localized['zh-CN'].tagline = '随时查看服务、进度与消息。';
    initial.localized['zh-CN'].blocks.hero = {
      label: '首页欢迎区',
      title: '商标服务，随时办理。',
      body: '在一个入口查看服务说明、提交咨询，并进入获授权的客户进度。'
    };
    initial.localized['en-US'].brandName = 'Atlas WeChat Service';
    initial.localized['en-US'].tagline = 'Services, progress, and messages in one place.';
    initial.localized['en-US'].blocks.hero = {
      label: 'Home welcome',
      title: 'Trademark support, within reach.',
      body: 'Explore services, send an inquiry, and enter authorized customer progress.'
    };
  }
  const date = foundry ? '2026-09-24T09:10:00.000Z' : '2026-09-25T08:30:00.000Z';
  return {
    workspaceId,
    workspaceName: foundry ? 'Foundry Exchange Workspace' : 'Atlas Counsel Workspace',
    siteId,
    siteName: foundry ? 'Foundry 品牌展示站' : miniProgram ? 'Atlas 微信小程序' : 'Atlas 官方网站',
    terminal: miniProgram ? 'WECHAT_MINIPROGRAM' : 'WEB',
    role: 'OWNER',
    lifecycle: 'ACTIVE',
    draft: structuredClone(initial),
    published: structuredClone(initial),
    versions: [
      {
        version: 1,
        publishedAt: date,
        label: 'Initial demo release',
        config: structuredClone(initial)
      }
    ],
    leads: [],
    savedAt: date,
    publishedAt: date,
    analyticsPartial: foundry,
    sharedSources: [
      {
        kind: 'BRAND',
        sourceRef: `workspace:${workspaceId}:brand-profile:v3`,
        access: 'READ',
        updateMode: 'EXPLICIT_IMPORT'
      },
      {
        kind: 'CONTENT',
        sourceRef: `lite:${workspaceId}:reviewed-packages`,
        access: 'READ',
        updateMode: 'EXPLICIT_IMPORT'
      },
      {
        kind: 'SERVICE',
        sourceRef: 'markreg:published-products',
        access: 'READ',
        updateMode: 'EXPLICIT_IMPORT'
      }
    ]
  };
}

export function seedWorkspace(id: WorkspaceId): SiteState {
  return seedSite(id === 'foundry' ? 'site_foundry_demo' : 'site_atlas_demo');
}

export const workspaceIds: WorkspaceId[] = ['atlas', 'foundry'];
export const siteIds: DemoSiteId[] = [
  'site_atlas_demo',
  'site_atlas_mini_demo',
  'site_foundry_demo'
];

export const workspacePortfolios: Record<WorkspaceId, DemoWorkspacePortfolio> = {
  atlas: {
    workspaceId: 'atlas',
    workspaceName: 'Atlas Counsel Workspace',
    siteIds: ['site_atlas_demo', 'site_atlas_mini_demo'],
    defaultSiteId: 'site_atlas_demo'
  },
  foundry: {
    workspaceId: 'foundry',
    workspaceName: 'Foundry Exchange Workspace',
    siteIds: ['site_foundry_demo'],
    defaultSiteId: 'site_foundry_demo'
  }
};

export function defaultSiteId(id: WorkspaceId): DemoSiteId {
  return workspacePortfolios[id].defaultSiteId;
}

export function nextLeadId(existing: number): string {
  return `DEMO-LEAD-${String(existing + 1).padStart(4, '0')}`;
}
