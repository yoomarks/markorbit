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
      page('platform', '平台总览'),
      page('health', '运行健康'),
      page('alerts', '实时告警'),
      page('usage', '使用情况'),
      page('attention', '待处理事项')
    ]
  },
  {
    id: 'workspaces',
    number: '02',
    label: 'Workspace 管理',
    shortLabel: 'Workspace',
    description: '组织、订阅、配额、产品与站点的全局管理',
    accent: '#2e68d9',
    icon: 'building',
    pages: [
      page('directory', '全部 Workspace'),
      page('plans', '订阅与套餐'),
      page('members', '成员概况'),
      page('quotas', '资源配额'),
      page('products', '产品启用'),
      page('sites', '站点'),
      page('audit', '审计')
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
      page('directory', '全部用户'),
      page('roles', '角色与权限'),
      page('relationships', '组织关系'),
      page('invitations', '邀请'),
      page('security', '登录与安全'),
      page('activity', '操作记录')
    ]
  },
  {
    id: 'products',
    number: '04',
    label: '产品管理',
    shortLabel: '产品管理',
    description: '产品、模块、权益与发布状态分层管理',
    accent: '#7a55d9',
    icon: 'cube',
    pages: [
      page('portfolio', '产品总览'),
      page('switches', '模块启停'),
      page('entitlements', '套餐与权益'),
      page('usage', '使用情况'),
      page('features', '功能配置'),
      page('releases', '版本发布')
    ]
  },
  {
    id: 'data',
    number: '05',
    label: 'Data Engine',
    shortLabel: 'Data Engine',
    description: '全球数据覆盖、流水线、质量与受控恢复',
    accent: '#0786a7',
    icon: 'database',
    pages: [
      page('overview', '总览'),
      page('coverage', '数据覆盖'),
      page('sources', '数据源'),
      page('packages', '数据包'),
      page('jobs', '任务与调度'),
      page('query', '数据查询'),
      page('storage', '存储'),
      page('settings', '系统设置')
    ]
  },
  {
    id: 'knowledge',
    number: '06',
    label: 'Knowledge',
    shortLabel: 'Knowledge',
    description: '来源到证据、审核与 Ready Package 的供应链',
    accent: '#d46824',
    icon: 'book',
    pages: [
      page('overview', '总览'),
      page('sources', '来源管理'),
      page('plans', '采集计划'),
      page('runs', '执行任务'),
      page('workers', 'Workers'),
      page('raw-files', '原始文件'),
      page('transforms', '转换处理'),
      page('evidence', '证据审核'),
      page('search', '知识检索'),
      page('packages', 'Ready Packages'),
      page('supply-health', '供应健康')
    ]
  },
  {
    id: 'brain',
    number: '07',
    label: 'Brain',
    shortLabel: 'Brain',
    description: '模型路由、智能编排、质量、延迟与成本',
    accent: '#7653df',
    icon: 'brain',
    pages: [
      page('overview', '总览'),
      page('models', '模型管理'),
      page('orchestration', '智能编排'),
      page('routing', '路由策略'),
      page('prompts', 'Prompt'),
      page('runs', '执行记录'),
      page('quality', '质量评估'),
      page('cost', '成本分析'),
      page('settings', '系统设置')
    ]
  },
  {
    id: 'capabilities',
    number: '08',
    label: 'Capability',
    shortLabel: 'Capability',
    description: '稳定结果契约、版本谱系、实现与证据',
    accent: '#7450d5',
    icon: 'spark',
    pages: [
      page('overview', '总览'),
      page('catalog', '能力目录'),
      page('skills', 'Skills'),
      page('agents', 'Agents'),
      page('tools', '工具集成'),
      page('evaluation', '测试与评估'),
      page('runs', '执行记录'),
      page('versions', '版本管理'),
      page('permissions', '权限配置')
    ]
  },
  {
    id: 'integrations',
    number: '09',
    label: '外部 API 与集成',
    shortLabel: '外部 API',
    description: '服务开关、授权、健康、限流与失败隔离',
    accent: '#256cc9',
    icon: 'link',
    pages: [
      page('directory', '全部集成'),
      page('switches', 'API 开关'),
      page('credentials', '密钥与凭证'),
      page('authorizations', 'Workspace 授权'),
      page('health', '健康监测'),
      page('usage', '调用统计'),
      page('limits', '限流配置'),
      page('failures', '失败记录')
    ]
  },
  {
    id: 'operations',
    number: '10',
    label: '运行与任务',
    shortLabel: '运行与任务',
    description: 'Owner 任务、执行、Worker、日志与受控恢复',
    accent: '#e05b35',
    icon: 'pulse',
    pages: [
      page('overview', '任务总览'),
      page('queue', '任务队列'),
      page('runs', '执行记录'),
      page('workers', 'Workers'),
      page('schedules', '调度计划'),
      page('recovery', '失败与恢复'),
      page('logs', '系统日志')
    ]
  },
  {
    id: 'billing',
    number: '11',
    label: '商业与支付',
    shortLabel: '商业与支付',
    description: '订阅、订单、支付、发票与争议的 owner 视图',
    accent: '#c96f23',
    icon: 'card',
    pages: [
      page('revenue', '收入总览'),
      page('plans', '套餐管理'),
      page('orders', '订单管理'),
      page('payments', '支付记录'),
      page('invoices', '发票管理'),
      page('usage', '使用统计'),
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
      page('overview', '安全总览'),
      page('audit', '审计日志'),
      page('policies', '权限策略'),
      page('login', '登录安全'),
      page('configuration', '系统配置'),
      page('compliance', '合规管理'),
      page('risk', '风险操作')
    ]
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
