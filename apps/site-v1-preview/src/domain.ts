export type WorkspaceId = 'atlas' | 'foundry';
export type TemplateId = 'counsel' | 'exchange';
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
  market: string;
  domain: string;
  modules: { assets: boolean; portal: boolean; insights: boolean };
  pages: PageRecord[];
  blocks: Block[];
  services: ServiceRecord[];
  content: ContentRecord[];
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

export interface WorkspaceState {
  workspaceId: WorkspaceId;
  workspaceName: string;
  siteId: string;
  role: 'OWNER' | 'VIEWER';
  lifecycle: 'DRAFT' | 'ACTIVE';
  draft: SiteConfig;
  published: SiteConfig;
  versions: PublishedVersion[];
  leads: DemoLead[];
  savedAt: string;
  publishedAt: string;
  analyticsPartial: boolean;
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
    locale: 'en-US',
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

export function seedWorkspace(id: WorkspaceId): WorkspaceState {
  const initial = config(id === 'foundry' ? 'exchange' : 'counsel');
  const date = id === 'foundry' ? '2026-09-24T09:10:00.000Z' : '2026-09-25T08:30:00.000Z';
  return {
    workspaceId: id,
    workspaceName: id === 'foundry' ? 'Foundry Exchange Workspace' : 'Atlas Counsel Workspace',
    siteId: id === 'foundry' ? 'site_foundry_demo' : 'site_atlas_demo',
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
    analyticsPartial: id === 'foundry'
  };
}

export const workspaceIds: WorkspaceId[] = ['atlas', 'foundry'];

export function nextLeadId(existing: number): string {
  return `DEMO-LEAD-${String(existing + 1).padStart(4, '0')}`;
}
