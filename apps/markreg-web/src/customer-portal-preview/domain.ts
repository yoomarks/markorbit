export type Locale = 'zh-CN' | 'en-US';
export type Channel = 'web' | 'mini';
export type FixtureMode =
  'success' | 'loading' | 'empty' | 'error' | 'permission' | 'partial' | 'signed-out';

export type PortalSection =
  'home' | 'services' | 'progress' | 'trademarks' | 'messages' | 'profile';

export interface RelationshipBinding {
  relationshipId: string;
  workspaceId: string;
  workspaceName: string;
  customerId: string;
  customerName: string;
  kind: 'INDIVIDUAL' | 'ENTERPRISE';
  role: 'SELF' | 'LEGAL_REPRESENTATIVE' | 'AUTHORIZED_MEMBER';
  objectGrants: readonly string[];
  status: 'ACTIVE' | 'EXPIRED';
}

export interface DemoIdentity {
  accountId: string;
  displayName: string;
  maskedMobile: string;
  bindings: readonly RelationshipBinding[];
}

export interface BusinessItem {
  id: string;
  workspaceId: string;
  customerId: string;
  title: string;
  titleEn: string;
  kind: 'MATTER' | 'ORDER' | 'ASSET';
  status: string;
  statusEn: string;
  detail: string;
  detailEn: string;
  formalStage?: string;
  formalStageEn?: string;
  nextAction?: string;
  nextActionEn?: string;
}

export const quoteFixture = {
  id: 'quote-us-nova-318',
  businessId: 'order-us-nova-042',
  number: 'QT-2026-0318',
  title: 'NOVA 美国商标检索与申请',
  titleEn: 'NOVA US search and filing',
  currency: 'CNY',
  totalMinor: 1280000,
  validUntil: '2026-10-08',
  lines: [
    {
      label: '商标近似检索与分析',
      labelEn: 'Clearance search and analysis',
      amountMinor: 320000
    },
    {
      label: '申请准备与代理服务',
      labelEn: 'Application preparation and agency service',
      amountMinor: 560000
    },
    { label: '官方费用预估', labelEn: 'Estimated official fees', amountMinor: 400000 }
  ],
  scope: '含 1 件文字商标、1 个类别的检索、申请准备和递交协调；不含后续审查意见答复。',
  scopeEn:
    'Includes search, application preparation and filing coordination for one word mark in one class; later office-action responses are excluded.'
} as const;

export interface PortalState {
  locale: Locale;
  channel: Channel;
  identityId: string | null;
  relationshipId: string | null;
  section: PortalSection;
  documentSubmitted: boolean;
  taskConfirmed: boolean;
  unreadMessages: number;
  consultationReference: string | null;
  claimStatus: 'IDLE' | 'REJECTED';
  quoteStatus: 'PENDING' | 'CONFIRMED_DEMO' | 'QUESTION_SENT_DEMO';
}

export const identities: readonly DemoIdentity[] = [
  {
    accountId: 'acct-demo-mei',
    displayName: '陈玫 Mei Chen',
    maskedMobile: '+86 138 **** 6208',
    bindings: [
      {
        relationshipId: 'cr-atlas-mei-001',
        workspaceId: 'ws-atlas-001',
        workspaceName: '澄远知识产权 · Atlas IP',
        customerId: 'customer-mei-atlas',
        customerName: '陈玫',
        kind: 'INDIVIDUAL',
        role: 'SELF',
        objectGrants: ['matter-cn-nova-2026', 'order-us-nova-042', 'asset-nova-cn'],
        status: 'ACTIVE'
      },
      {
        relationshipId: 'cr-harbor-mei-004',
        workspaceId: 'ws-harbor-009',
        workspaceName: '海隅商标事务所 · Harbor Marks',
        customerId: 'customer-mei-harbor',
        customerName: '陈玫',
        kind: 'INDIVIDUAL',
        role: 'SELF',
        objectGrants: ['matter-harbor-luma-008'],
        status: 'ACTIVE'
      }
    ]
  },
  {
    accountId: 'acct-demo-liuya',
    displayName: '刘娅 Liu Ya',
    maskedMobile: '+86 186 **** 1140',
    bindings: [
      {
        relationshipId: 'cr-atlas-liuya-002',
        workspaceId: 'ws-atlas-001',
        workspaceName: '澄远知识产权 · Atlas IP',
        customerId: 'customer-liuya-atlas',
        customerName: '刘娅',
        kind: 'INDIVIDUAL',
        role: 'SELF',
        objectGrants: ['matter-atlas-pico-221'],
        status: 'ACTIVE'
      }
    ]
  },
  {
    accountId: 'acct-demo-zhaolin',
    displayName: '赵霖 Zhao Lin',
    maskedMobile: '+86 139 **** 7721',
    bindings: [
      {
        relationshipId: 'cr-atlas-nova-enterprise',
        workspaceId: 'ws-atlas-001',
        workspaceName: '澄远知识产权 · Atlas IP',
        customerId: 'enterprise-nova-labs',
        customerName: '诺瓦实验室（上海）有限公司',
        kind: 'ENTERPRISE',
        role: 'AUTHORIZED_MEMBER',
        objectGrants: ['matter-cn-nova-2026'],
        status: 'ACTIVE'
      }
    ]
  }
];

export const businessItems: readonly BusinessItem[] = [
  {
    id: 'matter-cn-nova-2026',
    workspaceId: 'ws-atlas-001',
    customerId: 'customer-mei-atlas',
    title: 'NOVA 图形商标 · 中国申请',
    titleEn: 'NOVA device mark · China filing',
    kind: 'MATTER',
    status: '等待你补充资料',
    statusEn: 'Waiting for your documents',
    detail: '第 9、42 类 · 案件 MO-CN-2026-0184',
    detailEn: 'Classes 9 & 42 · Matter MO-CN-2026-0184',
    formalStage: '正式程序：申请准备 · 资料收集',
    formalStageEn: 'Formal stage: application preparation · evidence collection',
    nextAction: '上传首次使用说明',
    nextActionEn: 'Upload first-use statement'
  },
  {
    id: 'order-us-nova-042',
    workspaceId: 'ws-atlas-001',
    customerId: 'customer-mei-atlas',
    title: 'NOVA 美国商标检索与申请',
    titleEn: 'NOVA US search and filing',
    kind: 'ORDER',
    status: '报价待确认 · 尚未付款',
    statusEn: 'Quote awaiting review · not paid',
    detail: '订单 OR-2026-0042 · 报价 QT-2026-0318',
    detailEn: 'Order OR-2026-0042 · Quote QT-2026-0318'
  },
  {
    id: 'asset-nova-cn',
    workspaceId: 'ws-atlas-001',
    customerId: 'customer-mei-atlas',
    title: 'NOVA / 诺瓦',
    titleEn: 'NOVA / 诺瓦',
    kind: 'ASSET',
    status: '已注册 · 官方信息待刷新',
    statusEn: 'Registered · official data refresh due',
    detail: '中国 · 注册号 7062••19 · 第 9 类',
    detailEn: 'China · Reg. no. 7062••19 · Class 9'
  },
  {
    id: 'matter-harbor-luma-008',
    workspaceId: 'ws-harbor-009',
    customerId: 'customer-mei-harbor',
    title: 'LUMA 马德里国际注册',
    titleEn: 'LUMA Madrid international registration',
    kind: 'MATTER',
    status: '等待机构复核',
    statusEn: 'Awaiting firm review',
    detail: '案件 HB-INT-0008 · 欧盟、日本',
    detailEn: 'Matter HB-INT-0008 · EU and Japan'
  },
  {
    id: 'matter-atlas-pico-221',
    workspaceId: 'ws-atlas-001',
    customerId: 'customer-liuya-atlas',
    title: 'PICO 文字商标 · 中国申请',
    titleEn: 'PICO word mark · China filing',
    kind: 'MATTER',
    status: '初审公告',
    statusEn: 'Published for opposition',
    detail: '案件 MO-CN-2025-0221 · 第 35 类',
    detailEn: 'Matter MO-CN-2025-0221 · Class 35'
  }
];

export const defaultState: PortalState = {
  locale: 'zh-CN',
  channel: 'web',
  identityId: null,
  relationshipId: null,
  section: 'home',
  documentSubmitted: false,
  taskConfirmed: false,
  unreadMessages: 2,
  consultationReference: null,
  claimStatus: 'IDLE',
  quoteStatus: 'PENDING'
};

export function identityFor(state: PortalState): DemoIdentity | undefined {
  return identities.find((identity) => identity.accountId === state.identityId);
}

export function relationshipFor(state: PortalState): RelationshipBinding | undefined {
  return identityFor(state)?.bindings.find(
    (binding) => binding.relationshipId === state.relationshipId
  );
}

export function authorizedItems(state: PortalState): readonly BusinessItem[] {
  const binding = relationshipFor(state);
  if (!binding || binding.status !== 'ACTIVE') return [];
  return businessItems.filter(
    (item) =>
      binding.objectGrants.includes(item.id) &&
      item.workspaceId === binding.workspaceId &&
      (item.customerId === binding.customerId || item.id === 'matter-cn-nova-2026')
  );
}

export function readStoredState(storageKey: string): PortalState {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return defaultState;
    const parsed = JSON.parse(stored) as Partial<PortalState> & { section?: string };
    const legacySections: Record<string, PortalSection> = {
      overview: 'home',
      business: 'progress',
      assets: 'trademarks',
      orders: 'progress',
      files: 'progress',
      account: 'profile'
    };
    const candidateSection = parsed.section
      ? (legacySections[parsed.section] ?? parsed.section)
      : defaultState.section;
    const section = isPortalSection(candidateSection) ? candidateSection : defaultState.section;
    return { ...defaultState, ...parsed, section };
  } catch {
    return defaultState;
  }
}

function isPortalSection(value: string): value is PortalSection {
  return ['home', 'services', 'progress', 'trademarks', 'messages', 'profile'].includes(value);
}
