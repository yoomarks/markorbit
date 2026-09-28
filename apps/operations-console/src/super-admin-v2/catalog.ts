export type ModuleId =
  | 'overview'
  | 'workspaces'
  | 'users'
  | 'products'
  | 'data'
  | 'knowledge'
  | 'brain'
  | 'capabilities'
  | 'integrations'
  | 'operations'
  | 'billing'
  | 'governance';

export type ReviewState = 'success' | 'loading' | 'empty' | 'partial' | 'error' | 'permission';

export interface SecondaryPage {
  id: string;
  label: string;
}

export interface AdminModule {
  id: ModuleId;
  number: string;
  label: string;
  shortLabel: string;
  description: string;
  accent: string;
  icon: string;
  pages: readonly SecondaryPage[];
}

export interface AdminNavigationGroup {
  id: 'workspace' | 'business' | 'data-intelligence' | 'ai-capability' | 'platform-ops';
  label: string;
  moduleIds: readonly ModuleId[];
}

const page = (id: string, label: string): SecondaryPage => ({ id, label });

export const adminModules: readonly AdminModule[] = [
  {
    id: 'overview',
    number: '01',
    label: '总览',
    shortLabel: '总览',
    description: '跨 owner 的平台运行态势与待处理事项',
    accent: '#3977f6',
    icon: 'grid',
    pages: [
      page('platform', '运营总览'),
      page('health', '系统状态'),
      page('alerts', '告警'),
      page('usage', '平台用量'),
      page('attention', '待办')
    ]
  },
  {
    id: 'workspaces',
    number: '02',
    label: '工作空间',
    shortLabel: '工作空间',
    description: '组织、订阅、配额、产品与站点的全局管理',
    accent: '#2e68d9',
    icon: 'building',
    pages: [
      page('directory', '工作空间'),
      page('plans', '订阅'),
      page('members', '成员'),
      page('quotas', '配额'),
      page('products', '产品启用'),
      page('sites', '站点'),
      page('audit', '变更记录')
    ]
  },
  {
    id: 'users',
    number: '03',
    label: '用户与权限',
    shortLabel: '用户与权限',
    description: '账号、组织关系、角色授权与登录安全',
    accent: '#147d62',
    icon: 'users',
    pages: [
      page('directory', '用户'),
      page('roles', '角色与权限'),
      page('relationships', '工作空间关系'),
      page('invitations', '邀请'),
      page('security', '登录安全'),
      page('activity', '用户操作')
    ]
  },
  {
    id: 'products',
    number: '04',
    label: '产品',
    shortLabel: '产品',
    description: '产品、模块、权益与发布状态分层管理',
    accent: '#7a55d9',
    icon: 'cube',
    pages: [
      page('portfolio', '产品'),
      page('switches', '全局可用性'),
      page('entitlements', '套餐权益'),
      page('usage', '产品用量'),
      page('features', '功能配置'),
      page('releases', '版本发布')
    ]
  },
  {
    id: 'data',
    number: '05',
    label: '数据',
    shortLabel: '数据',
    description: 'Data Engine 的全球覆盖、流水线、质量与受控恢复',
    accent: '#0786a7',
    icon: 'database',
    pages: [
      page('overview', '数据概览'),
      page('coverage', '数据覆盖'),
      page('sources', '数据源'),
      page('packages', '数据包'),
      page('jobs', '采集任务'),
      page('query', '数据查询'),
      page('storage', '存储管理'),
      page('settings', '数据设置')
    ]
  },
  {
    id: 'knowledge',
    number: '06',
    label: '知识',
    shortLabel: '知识',
    description: '来源到证据、审核与 Ready Package 的供应链',
    accent: '#d46824',
    icon: 'book',
    pages: [
      page('overview', '知识概览'),
      page('sources', '来源'),
      page('plans', '采集计划'),
      page('runs', '采集运行'),
      page('workers', 'Workers'),
      page('raw-files', '原始产物'),
      page('transforms', '转换'),
      page('evidence', '证据审核'),
      page('search', '检索'),
      page('packages', 'Ready Packages'),
      page('supply-health', '供应状态')
    ]
  },
  {
    id: 'brain',
    number: '07',
    label: 'AI 编排',
    shortLabel: 'AI 编排',
    description: '模型路由、智能编排、质量、延迟与成本',
    accent: '#7653df',
    icon: 'brain',
    pages: [
      page('overview', 'AI 概览'),
      page('models', '模型'),
      page('orchestration', '编排'),
      page('routing', '模型路由'),
      page('prompts', 'Prompt'),
      page('runs', '执行记录'),
      page('quality', '质量'),
      page('cost', '成本'),
      page('settings', 'AI 设置')
    ]
  },
  {
    id: 'capabilities',
    number: '08',
    label: '能力目录',
    shortLabel: '能力目录',
    description: '稳定结果契约、版本谱系、实现与证据',
    accent: '#7450d5',
    icon: 'spark',
    pages: [
      page('overview', '能力概览'),
      page('catalog', '能力目录'),
      page('skills', 'Skills'),
      page('agents', 'Agents'),
      page('tools', '工具'),
      page('evaluation', '测试与评估'),
      page('runs', '调用记录'),
      page('versions', '版本'),
      page('permissions', '调用权限')
    ]
  },
  {
    id: 'integrations',
    number: '09',
    label: '集成',
    shortLabel: '集成',
    description: '服务开关、授权、健康、限流与失败隔离',
    accent: '#256cc9',
    icon: 'link',
    pages: [
      page('directory', '集成目录'),
      page('switches', '服务开关'),
      page('credentials', '凭证'),
      page('authorizations', 'Workspace 授权'),
      page('health', '运行状态'),
      page('usage', '调用量'),
      page('limits', '限流'),
      page('failures', '失败记录')
    ]
  },
  {
    id: 'operations',
    number: '10',
    label: '运行',
    shortLabel: '运行',
    description: 'Owner 任务、执行、Worker、日志与受控恢复',
    accent: '#e05b35',
    icon: 'pulse',
    pages: [
      page('overview', '运行概览'),
      page('queue', '任务队列'),
      page('runs', '执行记录'),
      page('workers', 'Workers'),
      page('schedules', '调度'),
      page('recovery', '失败与恢复'),
      page('logs', '日志')
    ]
  },
  {
    id: 'billing',
    number: '11',
    label: '账单',
    shortLabel: '账单',
    description: '订阅、订单、支付、发票与争议的 owner 视图',
    accent: '#c96f23',
    icon: 'card',
    pages: [
      page('revenue', '收入总览'),
      page('plans', '套餐'),
      page('orders', '订单'),
      page('payments', '支付'),
      page('invoices', '发票'),
      page('usage', '用量'),
      page('disputes', '退款与争议')
    ]
  },
  {
    id: 'governance',
    number: '12',
    label: '安全与审计',
    shortLabel: '安全与审计',
    description: '安全态势、权限策略、审计与高风险操作',
    accent: '#bd3f65',
    icon: 'shield',
    pages: [
      page('overview', '安全概览'),
      page('audit', '审计日志'),
      page('policies', '权限策略'),
      page('login', '登录安全'),
      page('configuration', '安全配置'),
      page('compliance', '合规'),
      page('risk', '风险操作')
    ]
  }
] as const;

export const adminNavigationGroups: readonly AdminNavigationGroup[] = [
  { id: 'workspace', label: '工作台', moduleIds: ['overview'] },
  {
    id: 'business',
    label: '业务管理',
    moduleIds: ['workspaces', 'users', 'products', 'billing']
  },
  { id: 'data-intelligence', label: '数据与智能', moduleIds: ['data', 'knowledge'] },
  { id: 'ai-capability', label: 'AI 与能力', moduleIds: ['brain', 'capabilities'] },
  {
    id: 'platform-ops',
    label: '平台运维',
    moduleIds: ['integrations', 'operations', 'governance']
  }
] as const;

export const DEFAULT_ROUTE = '/super-admin-v2/overview/platform';
const fallbackModule = adminModules[0] as AdminModule;
const fallbackPage = fallbackModule.pages[0] as SecondaryPage;

export function resolveRoute(pathname: string): {
  module: AdminModule;
  page: SecondaryPage;
  isValid: boolean;
} {
  const pathOnly = pathname.split('?')[0] ?? pathname;
  const [, root, moduleId, pageId, extra] = pathOnly.split('/');
  const module =
    root === 'super-admin-v2'
      ? adminModules.find((candidate) => candidate.id === moduleId)
      : undefined;
  const resolvedModule = module ?? fallbackModule;
  const resolvedPage =
    resolvedModule.pages.find((candidate) => candidate.id === pageId) ??
    resolvedModule.pages[0] ??
    fallbackPage;
  const isValid =
    root === 'super-admin-v2' &&
    module !== undefined &&
    resolvedModule.pages.some((candidate) => candidate.id === pageId) &&
    extra === undefined;
  return { module: resolvedModule, page: resolvedPage, isValid };
}

export function routeFor(module: AdminModule, page?: SecondaryPage) {
  const resolvedPage = page ?? module.pages[0] ?? fallbackPage;
  return `/super-admin-v2/${module.id}/${resolvedPage.id}`;
}
