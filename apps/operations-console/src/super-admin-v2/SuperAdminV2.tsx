import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  adminModules,
  adminNavigationGroups,
  resolveRoute,
  routeFor,
  type AdminModule,
  type ReviewState
} from './catalog.js';
import { DEMO_FIXTURE_NOTICE, demoRecords, moduleMetrics, type DemoRecord } from './fixtures.js';
import { DataEnginePages } from './DataEnginePages.js';
import { KnowledgePages } from './KnowledgePages.js';
import { ControlPlanePages } from './ControlPlanePages.js';
import { OrganizationPages } from './OrganizationPages.js';
import { IntelligencePages } from './IntelligencePages.js';
import { TrustPages } from './TrustPages.js';
import { RealControlPlane } from './RealControlPlane.js';
import {
  LanguageSwitcher,
  SuperAdminI18nProvider,
  translateSuperAdminText,
  useSuperAdminI18n
} from './i18n.js';
import './styles.css';

const GLYPHS: Record<string, string> = {
  grid: '⌘',
  building: '▦',
  users: '◎',
  cube: '◇',
  database: '◉',
  book: '▤',
  brain: '✣',
  spark: '✦',
  link: '⌁',
  pulse: '⌇',
  card: '▰',
  shield: '⬡'
};

const COMMON_TASK_LINKS = [
  ['系统状态', '/super-admin-v2/overview/health'],
  ['查找工作空间', '/super-admin-v2/workspaces/directory'],
  ['查看用户权限', '/super-admin-v2/users/roles'],
  ['处理失败任务', '/super-admin-v2/operations/recovery'],
  ['检查数据源', '/super-admin-v2/data/sources'],
  ['管理产品', '/super-admin-v2/products/portfolio'],
  ['查看 API 状态', '/super-admin-v2/integrations/health'],
  ['查询审计日志', '/super-admin-v2/governance/audit']
] as const;

const stateCopy: Record<ReviewState, [string, string]> = {
  success: ['已载入演示数据', '当前工作区使用明确标记的评审 fixture。'],
  loading: ['正在请求 owner projection', '尚未得到结果，不推断为空或健康。'],
  empty: ['当前筛选没有对象', '请求已成功，调整筛选条件可查看其他对象。'],
  partial: ['部分来源不可用', '可用对象仍显示；缺失来源不会被折叠为空。'],
  error: ['Owner projection 连接失败 fixture', '未显示缓存结果；可模拟恢复页面展示状态。'],
  permission: ['缺少精确读取权限', '当前主体不能查看该 owner 数据，页面未泄露对象详情。']
};

export interface SuperAdminV2Props {
  initialPath?: string;
  initialState?: ReviewState;
  useBrowserHistory?: boolean;
}

interface DeepLinkContext {
  sourcePath: string;
  sourceId: string;
  targetPath: string;
  targetObjectId: string;
}

function contextFromAddress(address: string | undefined): DeepLinkContext | null {
  if (!address) return null;
  const url = new URL(address, 'http://super-admin.local');
  const params = url.searchParams;
  const sourceId = params.get('alert');
  const targetObjectId = params.get('focus');
  const sourcePath = params.get('return');
  if (!sourceId || !targetObjectId || !sourcePath) return null;
  return {
    sourcePath,
    sourceId,
    targetPath: `${url.pathname}${url.search}`,
    targetObjectId
  };
}

function isRealAddress(address: string): boolean {
  return new URL(address, 'http://super-admin.local').searchParams.get('mode') === 'real';
}

function addressForMode(address: string, real: boolean): string {
  const url = new URL(address, 'http://super-admin.local');
  if (real) url.searchParams.set('mode', 'real');
  else url.searchParams.delete('mode');
  return `${url.pathname}${url.search}`;
}

export function SuperAdminV2(props: SuperAdminV2Props) {
  return (
    <SuperAdminI18nProvider>
      <SuperAdminV2Content {...props} />
    </SuperAdminI18nProvider>
  );
}

function SuperAdminV2Content({
  initialPath,
  initialState = 'success',
  useBrowserHistory = true
}: SuperAdminV2Props) {
  const { locale } = useSuperAdminI18n();
  const browserPath =
    typeof window === 'undefined'
      ? undefined
      : `${window.location.pathname}${window.location.search}`;
  const [path, setPath] = useState(
    initialPath ?? browserPath ?? '/super-admin-v2/overview/platform'
  );
  const [reviewState, setReviewState] = useState<ReviewState>(initialState);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部状态');
  const [selected, setSelected] = useState<DemoRecord | null>(null);
  const [dialog, setDialog] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [reviewToolsOpen, setReviewToolsOpen] = useState(false);
  const [deepLinkContext, setDeepLinkContext] = useState<DeepLinkContext | null>(() =>
    contextFromAddress(initialPath ?? browserPath)
  );
  const dialogReturnFocus = useRef<HTMLElement | null>(null);
  const inspectorReturnFocus = useRef<HTMLElement | null>(null);
  const hadDialog = useRef(false);
  const route = resolveRoute(path);
  const isRealMode = isRealAddress(path);
  const isModuleOverview = route.page.id === route.module.pages[0]?.id;
  const showMetricStrip =
    (route.module.id === 'data' && ['overview', 'coverage', 'storage'].includes(route.page.id)) ||
    (route.module.id === 'knowledge' && ['overview', 'supply-health'].includes(route.page.id));

  useEffect(() => {
    if (!useBrowserHistory || typeof window === 'undefined') return undefined;
    const onPopState = () => {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      setPath(nextPath);
      setDeepLinkContext(
        (current) =>
          contextFromAddress(nextPath) ??
          (current && nextPath === current.sourcePath ? current : null)
      );
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [useBrowserHistory]);

  useEffect(() => {
    setSelected(null);
    setQuery('');
    setStatusFilter('全部状态');
    setMobileNav(false);
    document.title = translateSuperAdminText(
      route.isValid
        ? `${route.page.label} · ${route.module.label} · Super Admin V2`
        : '页面不存在 · Super Admin V2',
      locale
    );
  }, [locale, path, route.isValid, route.module.label, route.page.label]);

  useEffect(() => {
    if (dialog) {
      hadDialog.current = true;
      return;
    }
    if (hadDialog.current) {
      dialogReturnFocus.current?.focus();
      dialogReturnFocus.current = null;
      hadDialog.current = false;
    }
  }, [dialog]);

  const navigate = (nextPath: string) => {
    setPath(nextPath);
    if (useBrowserHistory && typeof window !== 'undefined') {
      window.history.pushState({}, '', nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navigateRoute = (nextPath: string) => navigate(addressForMode(nextPath, isRealMode));

  const records = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return demoRecords(route.module.id).filter(
      (record) =>
        (statusFilter === '全部状态' || record.status === statusFilter) &&
        (!normalized ||
          `${record.name} ${record.id} ${record.detail} ${record.owner}`
            .toLowerCase()
            .includes(normalized))
    );
  }, [query, route.module.id, statusFilter]);

  const action = (label: string, protectedAction = false) => {
    if (protectedAction) {
      dialogReturnFocus.current = document.activeElement as HTMLElement | null;
      setDialog(label);
    } else {
      setNotice(`已展示 Demo 步骤“${label}”；未调用 owner API，也未产生生产变更。`);
      window.setTimeout(() => setNotice(null), 3200);
    }
  };

  const openDeepLink = (targetPath: string, sourceId: string, targetObjectId: string) => {
    const params = new URLSearchParams({
      focus: targetObjectId,
      alert: sourceId,
      return: path.split('?')[0] ?? path
    });
    const addressableTarget = `${targetPath}?${params.toString()}`;
    setDeepLinkContext({
      sourcePath: path,
      sourceId,
      targetPath: addressableTarget,
      targetObjectId
    });
    navigate(addressableTarget);
  };

  const openInspector = (record: DemoRecord) => {
    inspectorReturnFocus.current = document.activeElement as HTMLElement | null;
    setSelected(record);
  };

  const closeInspector = () => {
    const returnTarget = inspectorReturnFocus.current;
    setSelected(null);
    inspectorReturnFocus.current = null;
    window.setTimeout(() => returnTarget?.focus(), 0);
  };

  if (!route.isValid) {
    return (
      <main className="sa2-not-found">
        <span>404 · SUPER ADMIN V2</span>
        <h1>页面不存在</h1>
        <p>当前 URL 未匹配已登记的 Super Admin 模块或页面，未回退显示其他业务内容。</p>
        <a href="/super-admin-v2/overview/platform">返回平台总览</a>
      </main>
    );
  }

  return (
    <div
      className={`sa2 sa2--${route.module.id}-${route.page.id}${isModuleOverview ? ' sa2--module-overview' : ''}${isRealMode ? ' sa2--real-mode' : ''}`}
      style={{ '--module-accent': route.module.accent } as CSSProperties}
    >
      <a className="sa2-skip" href="#sa2-main">
        跳到主要内容
      </a>
      <aside className={mobileNav ? 'sa2-sidebar is-open' : 'sa2-sidebar'}>
        <div className="sa2-brand">
          <span className="sa2-logo" aria-hidden="true">
            <i />M
          </span>
          <div className="sa2-review-tools-copy">
            <strong>MarkOrbit</strong>
            <small>SUPER ADMIN · V2</small>
          </div>
          <button
            className="sa2-close-nav"
            aria-label="关闭导航"
            onClick={() => setMobileNav(false)}
          >
            ×
          </button>
        </div>
        <div className="sa2-demo-pill">
          <span /> {isRealMode ? 'REAL READ ONLY' : 'DEMO REVIEW'}
        </div>
        <details className="sa2-task-menu">
          <summary>
            <span>常用任务</span>
            <small>{COMMON_TASK_LINKS.length}</small>
          </summary>
          <nav aria-label="常用任务">
            {COMMON_TASK_LINKS.map(([label, target]) => (
              <a
                key={target}
                href={addressForMode(target, isRealMode)}
                onClick={(event) => {
                  event.preventDefault();
                  navigateRoute(target);
                }}
              >
                {label}
              </a>
            ))}
          </nav>
        </details>
        <nav aria-label="全局一级导航" className="sa2-primary-nav">
          {adminNavigationGroups.map((group) => (
            <section
              key={group.id}
              className="sa2-nav-group"
              aria-labelledby={`sa2-nav-group-${group.id}`}
              data-active={group.moduleIds.includes(route.module.id) ? 'true' : undefined}
            >
              <p id={`sa2-nav-group-${group.id}`}>{group.label}</p>
              {group.moduleIds.map((moduleId) => {
                const module = adminModules.find((candidate) => candidate.id === moduleId);
                if (!module) return null;
                return (
                  <a
                    key={module.id}
                    href={addressForMode(routeFor(module), isRealMode)}
                    aria-current={route.module.id === module.id ? 'page' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      navigateRoute(routeFor(module));
                    }}
                  >
                    <span className="sa2-nav-icon" aria-hidden="true">
                      {GLYPHS[module.icon]}
                    </span>
                    <span>{module.shortLabel}</span>
                  </a>
                );
              })}
            </section>
          ))}
        </nav>
        <div className="sa2-operator">
          <span className="sa2-avatar">{isRealMode ? 'IO' : 'SC'}</span>
          <div>
            <strong>{isRealMode ? 'Internal Operator' : 'Sarah Chen'}</strong>
            <small>{isRealMode ? 'Gateway-governed reads' : 'Internal Operator · Demo'}</small>
          </div>
          <button aria-label="账户菜单" onClick={() => action('账户菜单')}>
            •••
          </button>
        </div>
      </aside>

      <div className="sa2-body">
        <header className="sa2-topbar">
          <button
            className="sa2-menu"
            aria-label="打开导航"
            aria-expanded={mobileNav}
            onClick={() => setMobileNav(true)}
          >
            ☰
          </button>
          <div className="sa2-global-search">
            <span aria-hidden="true">⌕</span>
            <label className="sa2-sr-only" htmlFor="global-search">
              搜索当前模块
            </label>
            <input
              data-i18n-preserve="localized-attribute"
              id="global-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={locale === 'en-US' ? 'Search current module' : '搜索当前模块'}
              placeholder={
                locale === 'en-US'
                  ? `Search ${translateSuperAdminText(route.module.shortLabel, locale)} by name or ID…`
                  : `搜索 ${route.module.shortLabel} 中的名称或 ID…`
              }
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="sa2-top-actions">
            <LanguageSwitcher />
            <button aria-label="帮助" onClick={() => action('帮助中心')}>
              ?
            </button>
            <button aria-label="通知" onClick={() => action('通知中心')}>
              ♢<span className="sa2-dot" />
            </button>
            <button
              className="sa2-source sa2-mode-switch"
              onClick={() => navigate(addressForMode(path, !isRealMode))}
            >
              <i /> {isRealMode ? '真实只读' : '演示数据'}
            </button>
          </div>
        </header>

        {isRealMode ? (
          <div className="sa2-real-banner" role="note">
            <span>REAL READ ONLY</span>
            <p>真实只读 · 只会通过 Gateway、HttpOnly session 与精确 owner capability 读取</p>
            <button onClick={() => navigate(addressForMode(path, false))}>返回 Demo 评审</button>
          </div>
        ) : (
          <div className="sa2-demo-banner" role="note">
            <span>DEMO</span>
            <p>{DEMO_FIXTURE_NOTICE}</p>
            <button
              className="sa2-banner-mode-action"
              onClick={() => navigate(addressForMode(path, true))}
            >
              进入真实只读
            </button>
            <a
              href="/"
              onClick={(event) => {
                event.preventDefault();
                window.location.assign('/');
              }}
            >
              返回当前真实控制台
            </a>
          </div>
        )}

        <section className="sa2-module-head">
          <div className="sa2-title-row">
            <span className="sa2-title-icon" aria-hidden="true">
              {GLYPHS[route.module.icon]}
            </span>
            <div>
              <p>{route.module.number} · PLATFORM CONTROL</p>
              <strong className="sa2-module-name">{route.module.label}</strong>
              <span>{route.module.description}</span>
            </div>
          </div>
          {!isRealMode && (
            <button
              className="sa2-button sa2-button--secondary"
              onClick={() => action('刷新当前 fixture 快照')}
            >
              ↻ 模拟刷新
            </button>
          )}
        </section>

        <nav
          className="sa2-secondary-nav"
          aria-label={
            locale === 'en-US'
              ? `${translateSuperAdminText(route.module.label, locale)} secondary navigation`
              : `${route.module.label} 二级导航`
          }
        >
          {route.module.pages.map((page) => (
            <a
              key={page.id}
              href={addressForMode(routeFor(route.module, page), isRealMode)}
              aria-current={page.id === route.page.id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigateRoute(routeFor(route.module, page));
              }}
            >
              {page.label}
            </a>
          ))}
        </nav>

        {!isRealMode && (
          <aside className="sa2-review-tools" aria-label="Demo 评审工具">
            <div className="sa2-review-tools-summary">
              <strong>Demo 评审工具</strong>
              <small>状态模拟不代表 owner 的真实运行状态</small>
            </div>
            <button
              className="sa2-review-tools-toggle"
              aria-expanded={reviewToolsOpen}
              onClick={() => setReviewToolsOpen((current) => !current)}
            >
              {reviewToolsOpen ? '收起评审工具' : '展开评审工具'}
            </button>
            <div
              className={
                reviewToolsOpen ? 'sa2-review-tools-controls is-open' : 'sa2-review-tools-controls'
              }
            >
              <label htmlFor="review-state">模拟页面状态</label>
              <select
                id="review-state"
                value={reviewState}
                onChange={(event) => setReviewState(event.target.value as ReviewState)}
              >
                <option value="success">成功 fixture</option>
                <option value="partial">部分可用 fixture</option>
                <option value="loading">加载中 fixture</option>
                <option value="empty">无数据 fixture</option>
                <option value="error">连接失败 fixture</option>
                <option value="permission">无权限 fixture</option>
              </select>
            </div>
          </aside>
        )}

        <main id="sa2-main" tabIndex={-1}>
          {deepLinkContext && path === deepLinkContext.targetPath && (
            <aside className="sa2-context-route" aria-label="告警调查上下文">
              <span>来自告警 {deepLinkContext.sourceId}</span>
              <strong>已进入关联 owner 处理页面，未执行任何生产操作。</strong>
              <button onClick={() => navigate(deepLinkContext.sourcePath)}>返回告警调查</button>
            </aside>
          )}
          {deepLinkContext && path === deepLinkContext.sourcePath && (
            <aside className="sa2-context-route is-restored" aria-label="已恢复的告警调查上下文">
              <strong>已恢复告警 {deepLinkContext.sourceId} 的调查上下文</strong>
              <button onClick={() => setDeepLinkContext(null)}>结束上下文</button>
            </aside>
          )}
          {isRealMode ? (
            <RealControlPlane
              moduleId={route.module.id}
              pageId={route.page.id}
              pageLabel={route.page.label}
              navigate={navigate}
            />
          ) : (
            <StateBoundary
              state={reviewState}
              pageTitle={route.page.label}
              onRetry={() => setReviewState('success')}
            >
              {reviewState === 'partial' && (
                <div className="sa2-partial" role="status">
                  <strong>部分数据不可用</strong>
                  <span>演示：一个 owner projection 已过期；其余数据保持可见并带来源。</span>
                </div>
              )}
              {showMetricStrip && <MetricStrip module={route.module} pageId={route.page.id} />}
              <ModuleWorkbench
                module={route.module}
                pageId={route.page.id}
                pageLabel={route.page.label}
                records={records}
                query={query}
                setQuery={setQuery}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                onSelect={openInspector}
                onAction={action}
                onDeepLink={openDeepLink}
                focusObjectId={
                  deepLinkContext && path === deepLinkContext.targetPath
                    ? deepLinkContext.targetObjectId
                    : deepLinkContext && path === deepLinkContext.sourcePath
                      ? deepLinkContext.sourceId
                      : undefined
                }
              />
            </StateBoundary>
          )}
        </main>
      </div>

      {selected && (
        <Inspector
          record={selected}
          module={route.module}
          onClose={closeInspector}
          onAction={action}
        />
      )}
      {dialog && (
        <ProtectedDialog
          action={dialog}
          onClose={() => setDialog(null)}
          onDemoConfirm={() => {
            setDialog(null);
            setNotice('已展示受保护操作的 Demo 确认；未调用 owner API，也未产生生产变更。');
          }}
        />
      )}
      {notice && (
        <div className="sa2-toast" role="status">
          <div>
            <strong>Demo 反馈</strong>
            <span>{notice}</span>
          </div>
          <button aria-label="关闭 Demo 反馈" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      {mobileNav && (
        <button
          className="sa2-backdrop"
          aria-label="关闭导航"
          onClick={() => setMobileNav(false)}
        />
      )}
    </div>
  );
}

function StateBoundary({
  state,
  pageTitle,
  onRetry,
  children
}: {
  state: ReviewState;
  pageTitle: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (state === 'success' || state === 'partial') return <>{children}</>;
  const [title, description] = stateCopy[state];
  if (state === 'loading')
    return (
      <div className="sa2-state">
        <div className="sa2-skeleton wide" />
        <div className="sa2-skeleton" />
        <div className="sa2-skeleton cards" />
        <h1>{pageTitle}</h1>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    );
  return (
    <section
      className={`sa2-state sa2-state--${state}`}
      role={state === 'error' ? 'alert' : 'status'}
    >
      <span aria-hidden="true">{state === 'permission' ? '⌾' : state === 'error' ? '!' : '○'}</span>
      <h1>{pageTitle}</h1>
      <h2>{title}</h2>
      <p>{description}</p>
      {state === 'error' && (
        <button className="sa2-button" onClick={onRetry}>
          模拟恢复页面状态
        </button>
      )}
    </section>
  );
}

const pageMetrics: Record<string, readonly (readonly [string, string, string])[]> = {
  'data:overview': [
    ['已连接辖区', '38', '3 个需关注'],
    ['今日批次', '156', '12 个运行中'],
    ['记录通过率', '99.2%', 'Owner 校验'],
    ['待审批计划', '2', '尚未执行']
  ],
  'data:coverage': [
    ['覆盖辖区', '38', '4 个核心域'],
    ['对象类型', '24', '矩阵维度'],
    ['覆盖缺口', '7', '未折叠为空'],
    ['最旧来源', '2h', 'WIPO']
  ],
  'data:sources': [
    ['连接配置', '48', 'Owner 管理'],
    ['健康连接', '44', '最近握手'],
    ['凭证将到期', '1', '仅显示状态'],
    ['暂停来源', '3', '不参与采集']
  ],
  'data:packages': [
    ['数据包', '1,286', 'Manifest 可追溯'],
    ['Ready', '1,248', '不等于 Official Truth'],
    ['质量问题', '28', '待 owner 处理'],
    ['可恢复阶段', '6', '有检查点']
  ],
  'data:jobs': [
    ['运行中', '12', '持有有效 lease'],
    ['等待审批', '2', '冻结计划'],
    ['失败隔离', '3', '未自动重试'],
    ['检查点', '84', '可恢复']
  ],
  'data:query': [
    ['可查辖区', '4', 'CN / US / EU / WO'],
    ['查询字段', '18', 'Owner source-fact'],
    ['P95 延迟', '186ms', '演示快照'],
    ['写操作', '0', '严格只读']
  ],
  'data:storage': [
    ['Operational', '412 GB', 'PostgreSQL'],
    ['Analytics', '8.9 TB', 'ClickHouse'],
    ['Raw inventory', '24.6 TB', '不可变对象'],
    ['容量预警', '1', '不执行删除']
  ],
  'data:settings': [
    ['组件', '12', '4 个核心服务'],
    ['版本偏差', '1', 'Package builder'],
    ['待变更申请', '2', 'Owner 审批'],
    ['直接保存', '0', '治理锁定']
  ],
  'knowledge:overview': [
    ['来源', '48', '4 个待关注'],
    ['原始文件', '12,842', '不可变库存'],
    ['待审核证据', '18', '未正式批准'],
    ['Ready Packages', '326', '4 个待交付']
  ],
  'knowledge:sources': [
    ['来源', '48', '跨 4 个辖区'],
    ['已批准', '42', '有批准记录'],
    ['待审核', '4', '不参与供应'],
    ['已归档', '2', '保留谱系']
  ],
  'knowledge:plans': [
    ['启用计划', '24', 'Owner 调度'],
    ['本周运行', '168', '按策略派发'],
    ['暂停', '3', '显式状态'],
    ['计划冲突', '1', '待审核']
  ],
  'knowledge:runs': [
    ['运行中', '8', '有 Worker lease'],
    ['今日完成', '136', '有 receipt'],
    ['失败隔离', '3', '按阶段重试'],
    ['P95 时长', '8m 42s', '过去 24h']
  ],
  'knowledge:workers': [
    ['Workers', '12', '3 类能力'],
    ['健康', '10', '心跳有效'],
    ['繁忙', '1', '并发已满'],
    ['失联', '1', '不接收任务']
  ],
  'knowledge:raw-files': [
    ['原始文件', '12,842', '不可变'],
    ['可转换', '8,421', '通过资格检查'],
    ['重复项', '326', '保留关系'],
    ['缺 locator', '18', '不可进入审核']
  ],
  'knowledge:transforms': [
    ['等待转换', '36', '兼容 profile'],
    ['处理中', '12', '有效 lease'],
    ['待审核', '18', '有 locator'],
    ['失败隔离', '3', '无自动批准']
  ],
  'knowledge:evidence': [
    ['待审核', '18', '逐条决策'],
    ['高风险', '3', '需要资深审核'],
    ['今日批准', '42', '有审计记录'],
    ['Canon mutation', '0', '明确禁止']
  ],
  'knowledge:search': [
    ['可检索文档', '1,284,532', '带版本'],
    ['来源', '48', '精确 locator'],
    ['当前性', '96%', '过期单列'],
    ['P95', '142ms', '带引用检索']
  ],
  'knowledge:packages': [
    ['Preparing', '8', 'Manifest 未冻结'],
    ['Ready', '18', '等待交付'],
    ['Delivering', '3', '等待 receipt'],
    ['Reconciled', '297', '已对账']
  ],
  'knowledge:supply-health': [
    ['SLA 内', '92%', '不含未建模'],
    ['异常来源', '3', '失败隔离'],
    ['未建模', '2', '不计为零'],
    ['最旧来源', '2d', 'WIPO']
  ]
};

function MetricStrip({ module, pageId }: { module: AdminModule; pageId: string }) {
  const { locale } = useSuperAdminI18n();
  const metrics = pageMetrics[`${module.id}:${pageId}`] ?? moduleMetrics[module.id];
  return (
    <section
      className="sa2-metrics"
      aria-label={
        locale === 'en-US'
          ? `${translateSuperAdminText(module.label, locale)} summary`
          : `${module.label} 摘要`
      }
    >
      {metrics.map(([label, value, note], index) => (
        <article key={label}>
          <div>
            <span>{label}</span>
            <small>0{index + 1}</small>
          </div>
          <strong>{value}</strong>
          <p>{note}</p>
        </article>
      ))}
    </section>
  );
}

interface WorkbenchProps {
  module: AdminModule;
  pageId: string;
  pageLabel: string;
  records: readonly DemoRecord[];
  query: string;
  setQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  onSelect: (record: DemoRecord) => void;
  onAction: (label: string, protectedAction?: boolean) => void;
  onDeepLink: (targetPath: string, sourceId: string, targetObjectId: string) => void;
  focusObjectId?: string | undefined;
}

function ModuleWorkbench(props: WorkbenchProps) {
  if (props.module.id === 'billing' || props.module.id === 'governance') {
    return (
      <TrustPages
        moduleId={props.module.id}
        pageId={props.pageId}
        query={props.query}
        setQuery={props.setQuery}
        onAction={props.onAction}
      />
    );
  }
  if (props.module.id === 'brain' || props.module.id === 'capabilities') {
    return (
      <IntelligencePages
        moduleId={props.module.id}
        pageId={props.pageId}
        query={props.query}
        setQuery={props.setQuery}
        onAction={props.onAction}
      />
    );
  }
  if (
    props.module.id === 'workspaces' ||
    props.module.id === 'users' ||
    props.module.id === 'products'
  ) {
    return (
      <OrganizationPages
        moduleId={props.module.id}
        pageId={props.pageId}
        query={props.query}
        setQuery={props.setQuery}
        onAction={props.onAction}
      />
    );
  }
  if (
    props.module.id === 'overview' ||
    props.module.id === 'operations' ||
    props.module.id === 'integrations'
  ) {
    return (
      <ControlPlanePages
        moduleId={props.module.id}
        pageId={props.pageId}
        query={props.query}
        setQuery={props.setQuery}
        onAction={props.onAction}
        onDeepLink={props.onDeepLink}
        focusObjectId={props.focusObjectId}
      />
    );
  }
  if (props.module.id === 'data') {
    return <DataEnginePages {...props} />;
  }
  if (props.module.id === 'knowledge') {
    return <KnowledgePages {...props} />;
  }
  return (
    <div className="sa2-workbench">
      <ModuleVisual
        module={props.module}
        records={props.records}
        onSelect={props.onSelect}
        onAction={props.onAction}
      />
      <section className="sa2-panel sa2-records">
        <header className="sa2-panel-head">
          <div>
            <span>OWNER OBJECTS</span>
            <h3>{props.pageLabel} · 演示对象</h3>
          </div>
          <button
            className="sa2-button"
            onClick={() => props.onAction(`新建 ${props.pageLabel}`, true)}
          >
            ＋ 受保护操作
          </button>
        </header>
        <div className="sa2-filters">
          <label>
            <span>筛选当前列表</span>
            <input
              value={props.query}
              onChange={(event) => props.setQuery(event.target.value)}
              placeholder="名称、ID 或 owner"
            />
          </label>
          <label>
            <span>状态</span>
            <select
              value={props.statusFilter}
              onChange={(event) => props.setStatusFilter(event.target.value)}
            >
              <option>全部状态</option>
              <option>正常</option>
              <option>需关注</option>
              <option>降级</option>
              <option>待审核</option>
              <option>不可用</option>
            </select>
          </label>
          <button
            className="sa2-button sa2-button--secondary"
            onClick={() => {
              props.setQuery('');
              props.setStatusFilter('全部状态');
            }}
          >
            重置
          </button>
        </div>
        {props.records.length === 0 ? (
          <div className="sa2-inline-empty">
            <span>⌕</span>
            <h4>没有匹配的演示对象</h4>
            <p>调整搜索词或状态筛选。</p>
          </div>
        ) : (
          <RecordTable records={props.records} onSelect={props.onSelect} />
        )}
      </section>
    </div>
  );
}

function ModuleVisual({
  module,
  records,
  onSelect,
  onAction
}: {
  module: AdminModule;
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
  onAction: (label: string, protectedAction?: boolean) => void;
}) {
  if (module.id === 'data') return <DataCoverage records={records} onSelect={onSelect} />;
  if (module.id === 'knowledge') return <KnowledgeFlow records={records} onSelect={onSelect} />;
  if (module.id === 'brain') return <BrainRoutes records={records} onSelect={onSelect} />;
  if (module.id === 'capabilities') return <CapabilityMap records={records} onSelect={onSelect} />;
  if (module.id === 'billing') return <RevenueView onAction={onAction} />;
  if (module.id === 'governance') return <AuditView records={records} onSelect={onSelect} />;
  if (module.id === 'overview') return <CommandCenter records={records} onSelect={onSelect} />;
  if (module.id === 'products')
    return <ProductPortfolio records={records} onSelect={onSelect} onAction={onAction} />;
  if (module.id === 'operations') return <JobLanes records={records} onSelect={onSelect} />;
  if (module.id === 'integrations')
    return <IntegrationHealth records={records} onSelect={onSelect} />;
  return <DirectorySpotlight module={module} records={records} onSelect={onSelect} />;
}

function CommandCenter({
  records,
  onSelect
}: {
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
}) {
  return (
    <section className="sa2-panel sa2-command">
      <header className="sa2-panel-head">
        <div>
          <span>PLATFORM PULSE</span>
          <h3>运行控制室</h3>
        </div>
        <span className="sa2-live">
          <i /> DEMO LIVE
        </span>
      </header>
      <div className="sa2-command-grid">
        <div className="sa2-radar">
          <div className="sa2-radar-ring r1" />
          <div className="sa2-radar-ring r2" />
          <div className="sa2-radar-sweep" />
          <b>8</b>
          <span>已连接 owner</span>
          <i className="p1" />
          <i className="p2" />
          <i className="p3" />
        </div>
        <div className="sa2-service-stack">
          {['Core Platform', 'Knowledge', 'Data Engine', 'Capability', 'Execution'].map(
            (service, index) => (
              <div key={service}>
                <span>{service}</span>
                <i>
                  <b style={{ width: `${96 - index * 3}%` }} />
                </i>
                <em>{index === 2 ? '部分' : '正常'}</em>
              </div>
            )
          )}
        </div>
        <div className="sa2-attention-list">
          {records.map((record) => (
            <button key={record.id} onClick={() => onSelect(record)}>
              <Status status={record.status} />
              <span>
                <strong>{record.name}</strong>
                <small>
                  {record.freshness} · {record.owner}
                </small>
              </span>
              <b>›</b>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function DirectorySpotlight({
  module,
  records,
  onSelect
}: {
  module: AdminModule;
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
}) {
  return (
    <section className="sa2-panel">
      <header className="sa2-panel-head">
        <div>
          <span>DIRECTORY SNAPSHOT</span>
          <h3>{module.id === 'users' ? '身份与关系概览' : '组织管理概览'}</h3>
        </div>
        <span className="sa2-owner-chip">Owner · Core</span>
      </header>
      <div className="sa2-profile-grid">
        {records.slice(0, 4).map((record, index) => (
          <button key={record.id} onClick={() => onSelect(record)}>
            <span className="sa2-profile-mark">{record.name.slice(0, 2)}</span>
            <div>
              <strong>{record.name}</strong>
              <small>{record.detail}</small>
            </div>
            <Status status={record.status} />
            <em>
              {index * 12 + 8} {module.id === 'users' ? '关系' : '成员'}
            </em>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProductPortfolio({
  records,
  onSelect,
  onAction
}: {
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
  onAction: (label: string, protectedAction?: boolean) => void;
}) {
  return (
    <section className="sa2-panel">
      <header className="sa2-panel-head">
        <div>
          <span>PRODUCT LAYERS</span>
          <h3>可用性不是一个开关</h3>
        </div>
        <span className="sa2-owner-chip">Global ≠ Entitlement ≠ Enabled ≠ Healthy</span>
      </header>
      <div className="sa2-product-grid">
        {records.map((record, index) => (
          <article key={record.id}>
            <div
              className="sa2-product-symbol"
              style={{
                background: `color-mix(in srgb, var(--module-accent), white ${72 + index * 4}%)`
              }}
            >
              {record.name[0]}
            </div>
            <div>
              <h4>{record.name}</h4>
              <p>{record.detail}</p>
            </div>
            <dl>
              <div>
                <dt>全局</dt>
                <dd>
                  <button
                    className="sa2-switch is-on"
                    aria-label={`切换 ${record.name} 全局状态`}
                    onClick={() => onAction(`${record.name} 全局开关`, true)}
                  >
                    <i />
                  </button>
                </dd>
              </div>
              <div>
                <dt>权益</dt>
                <dd>3 套餐</dd>
              </div>
              <div>
                <dt>健康</dt>
                <dd>
                  <Status status={record.status} />
                </dd>
              </div>
            </dl>
            <button className="sa2-text-button" onClick={() => onSelect(record)}>
              查看分层详情 →
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function DataCoverage({
  records,
  onSelect
}: {
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
}) {
  const countries = [
    'US',
    'CA',
    'BR',
    'GB',
    'DE',
    'FR',
    'ES',
    'CN',
    'JP',
    'KR',
    'SG',
    'AU',
    'IN',
    'ZA',
    'AE',
    'MX',
    'AR',
    'SE'
  ];
  return (
    <section className="sa2-panel">
      <header className="sa2-panel-head">
        <div>
          <span>GLOBAL COVERAGE</span>
          <h3>数据覆盖与新鲜度</h3>
        </div>
        <span className="sa2-owner-chip">Owner · Data Engine</span>
      </header>
      <div className="sa2-data-layout">
        <div className="sa2-map">
          <div className="sa2-map-orbit" />
          <div className="sa2-country-grid">
            {countries.map((country, index) => (
              <span
                key={country}
                className={
                  index % 7 === 0 ? 'is-warning' : index % 5 === 0 ? 'is-partial' : 'is-current'
                }
                title={`${country} 演示覆盖`}
              >
                {country}
              </span>
            ))}
          </div>
          <div className="sa2-map-legend">
            <i className="current" />
            已更新 <i className="partial" />
            部分覆盖 <i className="warning" />
            延迟
          </div>
        </div>
        <div className="sa2-pipeline">
          {records.map((record, index) => (
            <button key={record.id} onClick={() => onSelect(record)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{record.name}</strong>
                <small>{record.freshness}</small>
                <i>
                  <b style={{ width: `${92 - index * 9}%` }} />
                </i>
              </div>
              <Status status={record.status} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function KnowledgeFlow({
  records,
  onSelect
}: {
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
}) {
  const stages: readonly (readonly [string, string, string])[] = [
    ['01', 'Source', '48'],
    ['02', 'Collect', '12'],
    ['03', 'Transform', '8'],
    ['04', 'Evidence', '18'],
    ['05', 'Review', '6'],
    ['06', 'Ready', '132']
  ];
  return (
    <section className="sa2-panel">
      <header className="sa2-panel-head">
        <div>
          <span>EVIDENCE SUPPLY CHAIN</span>
          <h3>来源到 Ready Package</h3>
        </div>
        <span className="sa2-owner-chip">Owner · Knowledge</span>
      </header>
      <div className="sa2-flow">
        {stages.map(([number, label, count], index) => (
          <div key={label}>
            <span>{number}</span>
            <i className={index === 3 ? 'is-attention' : ''}>{label.charAt(0)}</i>
            <strong>{label}</strong>
            <small>{count} 项</small>
            {index < stages.length - 1 && <b>→</b>}
          </div>
        ))}
      </div>
      <div className="sa2-source-cards">
        {records.map((record) => (
          <button key={record.id} onClick={() => onSelect(record)}>
            <span className="sa2-doc-icon">▤</span>
            <div>
              <strong>{record.name}</strong>
              <small>{record.detail}</small>
              <em>{record.freshness}</em>
            </div>
            <Status status={record.status} />
          </button>
        ))}
      </div>
    </section>
  );
}

function BrainRoutes({
  records,
  onSelect
}: {
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
}) {
  return (
    <section className="sa2-panel">
      <header className="sa2-panel-head">
        <div>
          <span>ROUTING GRAPH</span>
          <h3>模型编排与降级路径</h3>
        </div>
        <span className="sa2-owner-chip">Reachable ≠ Correct</span>
      </header>
      <div className="sa2-brain-layout">
        <div className="sa2-route-graph">
          <div className="sa2-node input">
            Request<small>bounded context</small>
          </div>
          <div className="sa2-route-line l1" />
          <div className="sa2-node router">
            Policy<small>route v24</small>
          </div>
          <div className="sa2-route-line l2" />
          <div className="sa2-route-line l3" />
          <div className="sa2-node model m1">
            Primary<small>98.6%</small>
          </div>
          <div className="sa2-node model m2">
            Fallback<small>94.8%</small>
          </div>
          <div className="sa2-node output">
            Result<small>with evidence</small>
          </div>
        </div>
        <div className="sa2-model-list">
          {records.map((record) => (
            <button key={record.id} onClick={() => onSelect(record)}>
              <span className="sa2-model-logo">✣</span>
              <div>
                <strong>{record.name}</strong>
                <small>{record.detail}</small>
              </div>
              <Status status={record.status} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function CapabilityMap({
  records,
  onSelect
}: {
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
}) {
  return (
    <section className="sa2-panel">
      <header className="sa2-panel-head">
        <div>
          <span>OUTCOME CONTRACTS</span>
          <h3>能力谱系与实现证据</h3>
        </div>
        <span className="sa2-owner-chip">Owner · Capability Engine</span>
      </header>
      <div className="sa2-capability-grid">
        {records.map((record, index) => (
          <button key={record.id} onClick={() => onSelect(record)}>
            <header>
              <span>CAP {String(index + 1).padStart(2, '0')}</span>
              <Status status={record.status} />
            </header>
            <div className="sa2-cap-icon">✦</div>
            <h4>{record.name}</h4>
            <p>{record.detail}</p>
            <div className="sa2-cap-chain">
              <span>Contract</span>
              <b>›</b>
              <span>Skill</span>
              <b>›</b>
              <span>Action</span>
            </div>
            <footer>
              {record.freshness}
              <span>查看谱系 →</span>
            </footer>
          </button>
        ))}
      </div>
    </section>
  );
}

function IntegrationHealth({
  records,
  onSelect
}: {
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
}) {
  return (
    <section className="sa2-panel">
      <header className="sa2-panel-head">
        <div>
          <span>FAILURE ISOLATION</span>
          <h3>集成健康与影响范围</h3>
        </div>
        <span className="sa2-owner-chip">Secrets never visible</span>
      </header>
      <div className="sa2-integration-grid">
        {records.map((record, index) => (
          <button key={record.id} onClick={() => onSelect(record)}>
            <span className="sa2-integration-logo">{record.name[0]}</span>
            <div>
              <strong>{record.name}</strong>
              <small>{record.detail}</small>
            </div>
            <div className="sa2-sparkline">
              {[3, 6, 4, 8, 7, 10, 9, 12].map((n, i) => (
                <i key={i} style={{ height: `${n * 2 + index}px` }} />
              ))}
            </div>
            <Status status={record.status} />
            <em>{record.meta[0]?.[1]}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function JobLanes({
  records,
  onSelect
}: {
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
}) {
  const lanes = ['运行中', '等待复核', '失败 / 已隔离'];
  return (
    <section className="sa2-panel">
      <header className="sa2-panel-head">
        <div>
          <span>OWNER RUNS</span>
          <h3>任务流水与检查点</h3>
        </div>
        <span className="sa2-owner-chip">No inferred success</span>
      </header>
      <div className="sa2-job-board">
        {lanes.map((lane, index) => (
          <div key={lane}>
            <header>
              <strong>{lane}</strong>
              <span>{index === 0 ? 12 : index === 1 ? 4 : 3}</span>
            </header>
            {records
              .filter((_, recordIndex) => recordIndex % lanes.length === index)
              .map((record) => (
                <button key={record.id} onClick={() => onSelect(record)}>
                  <small>{record.id}</small>
                  <strong>{record.name}</strong>
                  <span>{record.owner}</span>
                  <i>
                    <b
                      style={{
                        width:
                          record.status === '正常'
                            ? '72%'
                            : record.status === '待审核'
                              ? '48%'
                              : '24%'
                      }}
                    />
                  </i>
                  <footer>
                    <Status status={record.status} />
                    <em>{record.freshness}</em>
                  </footer>
                </button>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function RevenueView({
  onAction
}: {
  onAction: (label: string, protectedAction?: boolean) => void;
}) {
  const bars = [32, 44, 40, 58, 63, 72, 68, 86, 92, 82, 100, 106];
  return (
    <section className="sa2-panel">
      <header className="sa2-panel-head">
        <div>
          <span>OWNER-ROUTED COMMERCIAL VIEW</span>
          <h3>收入趋势与构成</h3>
        </div>
        <span className="sa2-owner-chip">Demo · not a ledger</span>
      </header>
      <div className="sa2-revenue-layout">
        <div className="sa2-chart">
          <div className="sa2-chart-y">
            <span>$50K</span>
            <span>$25K</span>
            <span>$0</span>
          </div>
          <div className="sa2-bars">
            {bars.map((bar, index) => (
              <i key={index} style={{ height: `${bar}px` }}>
                <b>{index + 1}月</b>
              </i>
            ))}
          </div>
        </div>
        <div className="sa2-donut">
          <div>
            <strong>$48.3K</strong>
            <span>演示月收入</span>
          </div>
          <ul>
            <li>
              <i />
              Lite <b>45%</b>
            </li>
            <li>
              <i />
              Site <b>28%</b>
            </li>
            <li>
              <i />
              MarkReg <b>19%</b>
            </li>
            <li>
              <i />
              其他 <b>8%</b>
            </li>
          </ul>
          <button
            className="sa2-button sa2-button--secondary"
            onClick={() => onAction('导出商业视图')}
          >
            导出演示报表
          </button>
        </div>
      </div>
    </section>
  );
}

function AuditView({
  records,
  onSelect
}: {
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
}) {
  return (
    <section className="sa2-panel">
      <header className="sa2-panel-head">
        <div>
          <span>APPEND-ONLY VIEW</span>
          <h3>安全事件与审计轨迹</h3>
        </div>
        <span className="sa2-owner-chip">Actor · object · policy · result</span>
      </header>
      <div className="sa2-audit-layout">
        <div className="sa2-shield-score">
          <div>
            94<small>/100</small>
          </div>
          <strong>演示安全态势</strong>
          <span>3 项需要人工复核</span>
        </div>
        <ol className="sa2-timeline">
          {records.map((record) => (
            <li key={record.id}>
              <i />
              <button onClick={() => onSelect(record)}>
                <span>{record.freshness}</span>
                <strong>{record.name}</strong>
                <small>{record.detail}</small>
                <Status status={record.status} />
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function RecordTable({
  records,
  onSelect
}: {
  records: readonly DemoRecord[];
  onSelect: (record: DemoRecord) => void;
}) {
  return (
    <div className="sa2-table-wrap">
      <table>
        <thead>
          <tr>
            <th>对象</th>
            <th>Owner / 来源</th>
            <th>状态</th>
            <th>当前性</th>
            <th>
              <span className="sa2-sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                <button className="sa2-object-link" onClick={() => onSelect(record)}>
                  <strong>{record.name}</strong>
                  <small>
                    {record.id} · {record.detail}
                  </small>
                </button>
              </td>
              <td>{record.owner}</td>
              <td>
                <Status status={record.status} />
              </td>
              <td>{record.freshness}</td>
              <td>
                <button
                  className="sa2-row-action"
                  aria-label={`查看 ${record.name}`}
                  onClick={() => onSelect(record)}
                >
                  •••
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Status({ status }: { status: DemoRecord['status'] }) {
  return (
    <span className={`sa2-status sa2-status--${status}`}>
      <i />
      {status}
    </span>
  );
}

function Inspector({
  record,
  module,
  onClose,
  onAction
}: {
  record: DemoRecord;
  module: AdminModule;
  onClose: () => void;
  onAction: (label: string, protectedAction?: boolean) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('.sa2-dialog')) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(record.id);
      onAction(`已在本地剪贴板复制 Demo 对象 ID ${record.id}`);
    } catch {
      onAction(`本地剪贴板不可用；未复制 Demo 对象 ID ${record.id}`);
    }
  };
  return (
    <aside className="sa2-inspector" role="complementary" aria-labelledby="inspector-title">
      <header>
        <div>
          <span>{module.shortLabel} · OBJECT DETAIL</span>
          <h2 id="inspector-title">{record.name}</h2>
        </div>
        <button ref={closeRef} aria-label="关闭详情" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="sa2-inspector-status">
        <Status status={record.status} />
        <span>{record.freshness}</span>
      </div>
      <section>
        <h3>对象摘要</h3>
        <p>{record.detail}</p>
        <dl>
          <div>
            <dt>对象 ID</dt>
            <dd>{record.id}</dd>
          </div>
          <div>
            <dt>Durable owner</dt>
            <dd>{record.owner}</dd>
          </div>
          {record.meta.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="sa2-provenance">
        <h3>来源与权威边界</h3>
        <p>
          此详情来自明确标记的 Demo fixture。真实模式只能显示 owner 通过 Gateway
          返回并通过权限检查的 projection。
        </p>
        <span>DEMO FIXTURE · NOT OFFICIAL TRUTH</span>
      </section>
      <footer>
        <button className="sa2-button sa2-button--secondary" onClick={() => void copyId()}>
          复制对象 ID（本地）
        </button>
        <button className="sa2-button" onClick={() => onAction(`处理 ${record.name}`, true)}>
          进入受保护操作
        </button>
      </footer>
    </aside>
  );
}

function ProtectedDialog({
  action,
  onClose,
  onDemoConfirm
}: {
  action: string;
  onClose: () => void;
  onDemoConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [actionTitle, ...actionContext] = action.split(' |CTX| ');

  useEffect(() => {
    const background = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.sa2 > .sa2-body, .sa2 > .sa2-sidebar, .sa2 > .sa2-inspector'
      )
    );
    background.forEach((element) => {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    });
    reasonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]'
        )
      );
      if (!controls.length) return;
      const first = controls[0]!;
      const last = controls[controls.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      background.forEach((element) => {
        element.removeAttribute('inert');
        element.removeAttribute('aria-hidden');
      });
    };
  }, [onClose]);

  return (
    <div className="sa2-dialog-layer" role="presentation">
      <section
        ref={dialogRef}
        className="sa2-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="protected-title"
      >
        <header>
          <span className="sa2-lock">⌾</span>
          <div>
            <span>PROTECTED ACTION · DEMO</span>
            <h2 id="protected-title">{actionTitle}</h2>
          </div>
          <LanguageSwitcher />
        </header>
        {actionContext.length > 0 && (
          <ul className="sa2-dialog-context" aria-label="本次操作目标核对">
            {actionContext.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <div className="sa2-dialog-warning">
          <strong>此预览不会执行生产操作</strong>
          <p>
            真实操作需要 exact owner command、权限、版本/当前性检查、原因、审批、幂等键与审计记录。
          </p>
        </div>
        <label>
          <span>演示理由</span>
          <textarea ref={reasonRef} defaultValue="产品评审：检查受保护操作的确认路径" />
        </label>
        <ul>
          <li>不会写入任何服务或数据库</li>
          <li>不会改变正式状态、付款、能力验证或 Official Truth</li>
          <li>确认后只显示本地演示反馈</li>
        </ul>
        <footer>
          <button className="sa2-button sa2-button--secondary" onClick={onClose}>
            取消
          </button>
          <button className="sa2-button" onClick={onDemoConfirm}>
            确认演示路径
          </button>
        </footer>
      </section>
    </div>
  );
}
