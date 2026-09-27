import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { GENERATED_EN_US, type GeneratedEnglishSource } from './en-US.generated.js';

export type SuperAdminLocale = 'zh-CN' | 'en-US';

export const SUPER_ADMIN_LOCALE_STORAGE_KEY = 'markorbit.super-admin-v2.locale';

const messages = {
  'language.label': { 'zh-CN': '界面语言', 'en-US': 'Interface language' },
  'language.chinese': { 'zh-CN': '简体中文', 'en-US': '简体中文' },
  'language.english': { 'zh-CN': 'English', 'en-US': 'English' },
  'language.changed': { 'zh-CN': '界面语言已切换', 'en-US': 'Interface language changed' }
} as const;

export type SuperAdminMessageKey = keyof typeof messages;

const ENGLISH_PHRASES: readonly (readonly [string, string])[] = [
  ['元数据', 'metadata'],
  ['摘要', 'summary'],
  ['管理', 'management'],
  ['创建跨 owner 调查', 'Create cross-owner investigation'],
  ['预演主要操作', 'Preview primary action'],
  ['待人工处理', 'Requires operator action'],
  ['未自动执行', 'Not executed automatically'],
  ['关联运行', 'Related runs'],
  ['需处理', 'Needs action'],
  ['进入真实只读', 'Enter real read-only'],
  [
    '当前 URL 未匹配已登记的 Super Admin 模块或页面，未回退显示其他业务内容。',
    'This URL does not match a registered Super Admin module or page. No unrelated content was shown.'
  ],
  [
    '这是证据供应审核，不是 Capability 验证或 canon mutation。',
    'This is an evidence-supply review, not Capability verification or a canon mutation.'
  ],
  [
    '逐条核对原文定位、转换结果和审核历史；批准不会自动改变 Capability 或平台 canon。',
    'Review the exact source locator, transformation result, and review history. Approval does not change a Capability or platform canon automatically.'
  ],
  [
    '真实只读 · 只会通过 Gateway、HttpOnly session 与精确 owner capability 读取',
    'Real read-only · reads only through Gateway, an HttpOnly session, and the exact owner capability'
  ],
  [
    '此详情来自明确标记的 Demo fixture。真实模式只能显示 owner 通过 Gateway 返回并通过权限检查的 projection。',
    'This detail comes from an explicitly labeled Demo fixture. Real mode can show only owner projections returned through Gateway after authorization.'
  ],
  [
    '状态模拟不代表 owner 的真实运行状态',
    'Simulated states do not represent the owner runtime state'
  ],
  [
    '当前工作区使用明确标记的评审 fixture。',
    'This workspace uses an explicitly labeled review fixture.'
  ],
  ['尚未得到结果，不推断为空或健康。', 'No result has arrived; empty or healthy is not inferred.'],
  [
    '请求已成功，调整筛选条件可查看其他对象。',
    'The request succeeded. Adjust the filters to inspect other objects.'
  ],
  [
    '可用对象仍显示；缺失来源不会被折叠为空。',
    'Available objects remain visible; missing sources are not collapsed into empty.'
  ],
  [
    '未显示缓存结果；可模拟恢复页面展示状态。',
    'No cached result is shown. The recovery presentation can be simulated.'
  ],
  [
    '当前主体不能查看该 owner 数据，页面未泄露对象详情。',
    'The current principal cannot read this owner data; object details are not disclosed.'
  ],
  ['已展示 Demo 步骤', 'Displayed Demo step'],
  [
    '未调用 owner API，也未产生生产变更。',
    'No owner API was called and no production change was made.'
  ],
  [
    '按司法辖区汇总覆盖、任务推进和质量风险；异常不会被平均值隐藏。',
    'Summarize coverage, task progress, and quality risk by jurisdiction without hiding exceptions behind averages.'
  ],
  [
    '从国家、对象类型和时间范围识别真实缺口，并保留每格的新鲜度来源。',
    'Identify real gaps by country, object type, and time range while retaining currentness provenance for every cell.'
  ],
  [
    '管理连接方式、抓取节奏和凭证存在性；密钥值永不在此页回显。',
    'Manage connection methods, acquisition cadence, and credential presence. Secret values are never revealed here.'
  ],
  [
    '以冻结计划、单次审批、检查点和可恢复日志管理 owner 任务；演示不会派发真实运行。',
    'Manage owner jobs with frozen plans, one-time approval, checkpoints, and recoverable logs. Demo actions never dispatch a real run.'
  ],
  [
    '从来源到 Ready Package 追踪产物、证据与交付，不把供应商回传当作正式真相。',
    'Track artifacts, evidence, and delivery from Source to Ready Package without treating provider returns as official truth.'
  ],
  [
    '按来源、辖区和当前性检索可引用知识，结果始终携带精确 locator。',
    'Search citable knowledge by source, jurisdiction, and currentness; every result retains an exact locator.'
  ],
  ['跨 owner 的平台运行态势与待处理事项', 'Cross-owner platform posture and pending attention'],
  [
    '组织、订阅、配额、产品与站点的全局管理',
    'Global management of organizations, subscriptions, quotas, products, and sites'
  ],
  [
    '账号、组织关系、角色授权与登录安全',
    'Accounts, organizational relationships, role grants, and sign-in security'
  ],
  [
    '产品、模块、权益与发布状态分层管理',
    'Layered management of products, modules, entitlements, and release states'
  ],
  [
    '全球数据覆盖、流水线、质量与受控恢复',
    'Global data coverage, pipelines, quality, and controlled recovery'
  ],
  [
    '来源到证据、审核与 Ready Package 的供应链',
    'Supply chain from Sources through Evidence review to Ready Packages'
  ],
  [
    '模型路由、智能编排、质量、延迟与成本',
    'Model routing, intelligent orchestration, quality, latency, and cost'
  ],
  [
    '稳定结果契约、版本谱系、实现与证据',
    'Stable Outcome Contracts, version lineage, implementations, and evidence'
  ],
  [
    '服务开关、授权、健康、限流与失败隔离',
    'Service controls, authorization, health, rate limits, and failure isolation'
  ],
  [
    'Owner 任务、执行、Worker、日志与受控恢复',
    'Owner jobs, runs, Workers, logs, and controlled recovery'
  ],
  [
    '订阅、订单、支付、发票与争议的 owner 视图',
    'Owner views for subscriptions, orders, payments, invoices, and disputes'
  ],
  [
    '安全态势、权限策略、审计与高风险操作',
    'Security posture, access policies, audit, and high-risk operations'
  ],
  ['不把供应商回传当作正式真相', 'Provider returns are not official truth'],
  ['不代表真实执行成功', 'Does not represent a successful real execution'],
  ['不代表 owner 的真实运行状态', 'Does not represent the owner runtime state'],
  ['未作正式批准', 'No formal approval'],
  ['未产生生产变更', 'No production change'],
  ['来源当前性', 'Source currentness'],
  ['业务事实有效性', 'Business-fact validity'],
  ['本次操作目标核对', 'Operation target verification'],
  ['所需权限', 'Required permission'],
  ['影响范围', 'Impact scope'],
  ['前置条件', 'Prerequisites'],
  ['不可逆风险', 'Irreversible risk'],
  ['执行理由', 'Execution reason'],
  ['演示理由', 'Demo reason'],
  ['来源与权威边界', 'Provenance and authority boundary'],
  ['数据已过期', 'Data is stale'],
  ['服务降级', 'Service degraded'],
  ['部分可用', 'Partially available'],
  ['不可用', 'Unavailable'],
  ['需要登录', 'Sign-in required'],
  ['无读取权限', 'Read permission denied'],
  ['读取超时', 'Read timed out'],
  ['返回数据不可信', 'Untrusted response'],
  ['暂未接入', 'Not integrated yet'],
  ['页面不存在', 'Page not found'],
  ['返回平台总览', 'Return to Platform Overview'],
  ['跳到主要内容', 'Skip to main content'],
  ['全局一级导航', 'Primary navigation'],
  ['二级导航', 'secondary navigation'],
  ['账户菜单', 'Account menu'],
  ['通知中心', 'Notification center'],
  ['通知', 'Notifications'],
  ['真实只读', 'Real read-only'],
  ['演示数据', 'Demo data'],
  ['返回 Demo 评审', 'Return to Demo review'],
  ['返回调查来源', 'Return to investigation source'],
  ['结束上下文', 'End context'],
  ['Demo 评审工具', 'Demo review tools'],
  ['展开评审工具', 'Expand review tools'],
  ['收起评审工具', 'Collapse review tools'],
  ['模拟页面状态', 'Simulated page state'],
  ['成功 fixture', 'Success fixture'],
  ['部分可用 fixture', 'Partial fixture'],
  ['加载中 fixture', 'Loading fixture'],
  ['无数据 fixture', 'Empty fixture'],
  ['连接失败 fixture', 'Connection-failure fixture'],
  ['无权限 fixture', 'Permission-denied fixture'],
  ['模拟刷新', 'Simulate refresh'],
  ['刷新当前 fixture 快照', 'Refresh current fixture snapshot'],
  ['平台总览', 'Platform Overview'],
  ['运行健康', 'Operational Health'],
  ['实时告警', 'Live Alerts'],
  ['使用情况', 'Usage'],
  ['待处理事项', 'Attention'],
  ['工作空间', 'Workspace'],
  ['用户与权限', 'Users & Access'],
  ['产品管理', 'Products'],
  ['数据引擎', 'Data Engine'],
  ['知识库', 'Knowledge'],
  ['AI 智能引擎', 'Brain'],
  ['能力管理', 'Capability'],
  ['外部 API 与集成', 'External APIs & Integrations'],
  ['外部 API', 'External APIs'],
  ['运行与任务', 'Operations'],
  ['商业与支付', 'Billing & Payments'],
  ['安全与审计', 'Security & Audit'],
  ['全部 Workspace', 'All Workspaces'],
  ['订阅与套餐', 'Subscriptions & Plans'],
  ['成员概况', 'Members'],
  ['资源配额', 'Resource Quotas'],
  ['产品启用', 'Product Enablement'],
  ['站点', 'Sites'],
  ['审计日志', 'Audit Log'],
  ['全部用户', 'All Users'],
  ['角色与权限', 'Roles & Permissions'],
  ['组织关系', 'Organization Relationships'],
  ['邀请', 'Invitations'],
  ['登录与安全', 'Sign-in & Security'],
  ['操作记录', 'Activity Log'],
  ['产品总览', 'Product Portfolio'],
  ['模块启停', 'Module Controls'],
  ['套餐与权益', 'Plans & Entitlements'],
  ['功能配置', 'Feature Configuration'],
  ['版本发布', 'Releases'],
  ['数据覆盖', 'Data Coverage'],
  ['数据源', 'Data Sources'],
  ['数据包', 'Data Packages'],
  ['任务与调度', 'Jobs & Scheduling'],
  ['数据查询', 'Data Query'],
  ['存储', 'Storage'],
  ['系统设置', 'System Settings'],
  ['来源管理', 'Source Management'],
  ['采集计划', 'Acquisition Plans'],
  ['执行任务', 'Runs'],
  ['原始文件', 'Raw Artifacts'],
  ['转换处理', 'Transforms'],
  ['证据审核', 'Evidence Review'],
  ['知识检索', 'Knowledge Search'],
  ['供应健康', 'Supply Health'],
  ['模型管理', 'Model Management'],
  ['智能编排', 'Orchestration'],
  ['路由策略', 'Routing Policies'],
  ['执行记录', 'Run History'],
  ['质量评估', 'Quality Evaluation'],
  ['成本分析', 'Cost Analysis'],
  ['能力目录', 'Capability Catalog'],
  ['工具集成', 'Tool Integrations'],
  ['测试与评估', 'Testing & Evaluation'],
  ['版本管理', 'Version Management'],
  ['权限配置', 'Permission Configuration'],
  ['全部集成', 'All Integrations'],
  ['API 开关', 'API Controls'],
  ['密钥与凭证', 'Keys & Credentials'],
  ['Workspace 授权', 'Workspace Authorization'],
  ['健康监测', 'Health Monitoring'],
  ['调用统计', 'Usage Analytics'],
  ['限流配置', 'Rate Limits'],
  ['失败记录', 'Failure Records'],
  ['任务总览', 'Job Overview'],
  ['任务队列', 'Job Queue'],
  ['调度计划', 'Schedules'],
  ['失败与恢复', 'Failures & Recovery'],
  ['系统日志', 'System Logs'],
  ['收入总览', 'Revenue Overview'],
  ['套餐管理', 'Plan Management'],
  ['订单管理', 'Order Management'],
  ['支付记录', 'Payment Records'],
  ['发票管理', 'Invoice Management'],
  ['使用统计', 'Usage Analytics'],
  ['退款与争议', 'Refunds & Disputes'],
  ['安全总览', 'Security Overview'],
  ['权限策略', 'Access Policies'],
  ['登录安全', 'Sign-in Security'],
  ['系统配置', 'System Configuration'],
  ['合规管理', 'Compliance'],
  ['风险操作', 'Risk Operations'],
  ['总览', 'Overview'],
  ['审计', 'Audit'],
  ['对象摘要', 'Object summary'],
  ['对象 ID', 'Object ID'],
  ['操作', 'Actions'],
  ['对象', 'Object'],
  ['状态', 'Status'],
  ['当前性', 'Currentness'],
  ['来源', 'Source'],
  ['详情', 'Details'],
  ['关闭详情', 'Close details'],
  ['复制对象 ID（本地）', 'Copy object ID locally'],
  ['进入受保护操作', 'Open protected action'],
  ['受保护操作', 'Protected action'],
  ['确认演示路径', 'Confirm Demo path'],
  ['取消', 'Cancel'],
  ['确认', 'Confirm'],
  ['关闭', 'Close'],
  ['重试', 'Retry'],
  ['重放', 'Replay'],
  ['恢复', 'Recover'],
  ['回滚', 'Rollback'],
  ['撤销授权', 'Revoke authorization'],
  ['暂停', 'Suspend'],
  ['删除', 'Delete'],
  ['归档', 'Archive'],
  ['启用', 'Enable'],
  ['停用', 'Disable'],
  ['已启用', 'Enabled'],
  ['已停用', 'Disabled'],
  ['已暂停', 'Suspended'],
  ['已归档', 'Archived'],
  ['活跃', 'Active'],
  ['正常', 'Healthy'],
  ['降级', 'Degraded'],
  ['失败', 'Failed'],
  ['阻断', 'Blocked'],
  ['运行中', 'Running'],
  ['等待审核', 'Pending review'],
  ['待审核', 'Pending review'],
  ['已批准', 'Approved'],
  ['已完成', 'Completed'],
  ['需关注', 'Needs attention'],
  ['高风险', 'High risk'],
  ['准确', 'Accurate'],
  ['需修正', 'Needs correction'],
  ['当前', 'Current'],
  ['已过期', 'Stale'],
  ['审核说明', 'Review note'],
  ['审核结论', 'Review decision'],
  ['定位准确性', 'Locator accuracy'],
  ['治理边界', 'Governance boundary'],
  ['批准证据', 'Approve evidence'],
  ['退回修订', 'Return for revision'],
  ['审核历史', 'Review history'],
  ['审核', 'Review'],
  ['需 owner 审阅', 'Owner review required'],
  ['转换完成', 'Transform completed'],
  ['校验通过', 'validation passed'],
  ['来源版本', 'Source version'],
  ['原文定位', 'Original locator'],
  ['来源摘要', 'Source digest'],
  ['本次审核意见', 'Review note'],
  ['本地确定性 fixture', 'Local deterministic fixture'],
  ['演示结果', 'Demo results'],
  ['Run参数', 'Run parameters'],
  ['参数', 'Parameters'],
  ['访问边界', 'Access boundary'],
  ['SLA 内', 'Within SLA'],
  ['即将过期', 'Expiring soon'],
  ['指南监测', 'Guidelines monitoring'],
  ['可转换', 'Transformable'],
  ['重复', 'Duplicate'],
  ['检索不会修改KnowledgeStatus', 'Search does not change Knowledge status'],
  ['检索不会修改', 'Search does not change '],
  ['执行', 'Execution'],
  ['原文', 'Original'],
  ['译文', 'Translation'],
  ['全部状态', 'All statuses'],
  ['全部类型', 'All types'],
  ['全球', 'Global'],
  ['文件投递', 'File delivery'],
  ['连接类型', 'Connection type'],
  ['司法辖区', 'Jurisdiction'],
  ['登记数据源', 'Register data source'],
  ['生成本地 Demo 缺口清单', 'Generate local Demo gap list'],
  ['时间范围', 'Time range'],
  ['个司法辖区', ' jurisdictions'],
  ['辖区', 'Jurisdiction'],
  ['案件', 'Cases'],
  ['事件', 'Events'],
  ['权利人', 'Rights holders'],
  ['图样', 'Representations'],
  ['分类', 'Classes'],
  ['已覆盖', 'Covered'],
  ['缺', 'Missing '],
  ['批次', ' batches'],
  ['需要处理', 'Needs attention'],
  ['司法辖区推进', 'Jurisdiction progress'],
  ['今日流水线', 'Today’s pipeline'],
  ['发现', 'Discover'],
  ['采集', 'Acquire'],
  ['规范化', 'Normalize'],
  ['校验', 'Validate'],
  ['发布', 'Publish'],
  ['搜索', 'Search'],
  ['筛选', 'Filter'],
  ['排序', 'Sort'],
  ['清除', 'Clear'],
  ['查看', 'View'],
  ['编辑', 'Edit'],
  ['新建', 'Create'],
  ['添加', 'Add'],
  ['保存', 'Save'],
  ['提交', 'Submit'],
  ['刷新', 'Refresh'],
  ['选择', 'Select'],
  ['全部', 'All'],
  ['名称', 'Name'],
  ['类型', 'Type'],
  ['地区', 'Region'],
  ['时间', 'Time'],
  ['创建时间', 'Created at'],
  ['更新时间', 'Updated at'],
  ['最近活动', 'Recent activity'],
  ['最近运行', 'Recent run'],
  ['成员', 'Members'],
  ['角色', 'Role'],
  ['权限', 'Permissions'],
  ['订阅', 'Subscription'],
  ['套餐', 'Plan'],
  ['配额', 'Quota'],
  ['产品', 'Product'],
  ['健康', 'Health'],
  ['可用性', 'Availability'],
  ['版本', 'Version'],
  ['用量', 'Usage'],
  ['金额', 'Amount'],
  ['订单', 'Order'],
  ['支付', 'Payment'],
  ['发票', 'Invoice'],
  ['退款', 'Refund'],
  ['争议', 'Dispute'],
  ['策略', 'Policy'],
  ['风险', 'Risk'],
  ['原因', 'Reason'],
  ['范围', 'Scope'],
  ['连接', 'Connection'],
  ['授权', 'Authorization'],
  ['凭证', 'Credential'],
  ['调用', 'Calls'],
  ['限流', 'Rate limit'],
  ['检查点', 'Checkpoint'],
  ['计划', 'Plan'],
  ['任务', 'Job'],
  ['运行', 'Run'],
  ['证据', 'Evidence'],
  ['数据', 'Data'],
  ['知识', 'Knowledge'],
  ['模型', 'Model'],
  ['成本', 'Cost'],
  ['质量', 'Quality'],
  ['延迟', 'Latency'],
  ['工具', 'Tool'],
  ['能力', 'Capability'],
  ['工作区', 'Workspace'],
  ['用户', 'User'],
  ['组织', 'Organization'],
  ['分钟', ' minutes'],
  ['小时', ' hours'],
  ['天前', ' days ago'],
  ['分钟前', ' minutes ago'],
  ['小时前', ' hours ago'],
  ['条', ''],
  ['个', ''],
  ['项', ''],
  ['次', ' times'],
  ['前', ' ago']
] as const;

const CHINESE_PHRASES: readonly (readonly [string, string])[] = [
  ['Ready Packages', 'Ready Packages'],
  ['GOVERNED OWNER READS', '受治理 Owner 读取'],
  ['Evidence Supply Health', '证据供应健康'],
  ['KNOWLEDGE OWNER', 'Knowledge Owner'],
  ['DATA OWNER', '数据 Owner'],
  ['PLATFORM CONTROL', '平台控制'],
  ['DOMAIN CONTROL PLANE', '数据域控制面'],
  ['COVERAGE MATRIX', '覆盖矩阵'],
  ['SOURCE CONNECTIONS', '来源连接'],
  ['DATA PACKAGES', '数据包'],
  ['JOB CONTROL', '任务控制'],
  ['QUERY WORKBENCH', '查询工作台'],
  ['STORAGE GOVERNANCE', '存储治理'],
  ['SYSTEM SETTINGS', '系统设置'],
  ['SUPPLY CHAIN', '供应链'],
  ['SOURCE REGISTRY', '来源登记'],
  ['ACQUISITION PLANS', '采集计划'],
  ['ACQUISITION RUNS', '采集运行'],
  ['WORKER FLEET', 'Worker 集群'],
  ['RAW ARTIFACTS', '原始产物'],
  ['TRANSFORMATION', '转换处理'],
  ['EVIDENCE REVIEW', '证据审核'],
  ['KNOWLEDGE SEARCH', '知识检索'],
  ['READY PACKAGES', 'Ready Packages'],
  ['SUPPLY HEALTH', '供应健康'],
  ['REVIEW QUEUE', '审核队列'],
  ['REVIEW DECISION', '审核结论'],
  ['EXACT LOCATOR', '精确定位'],
  ['OBJECT DETAIL', '对象详情'],
  ['Owner snapshot', 'Owner 快照'],
  ['operator required', '需人工处理'],
  ['active domains', '活跃数据域'],
  ['Observed at', '观测时间'],
  ['Freshness', '新鲜度'],
  ['operations', '操作'],
  ['attention', '待处理'],
  ['targets', '目标'],
  ['stale', '已过期'],
  ['DOMAIN PROGRESS', '辖区进度'],
  ['ATTENTION', '待处理'],
  ['PIPELINE', '流水线'],
  ['READ ONLY', '只读'],
  ['REAL READ ONLY', '真实只读'],
  ['DEMO REVIEW', '演示评审'],
  ['PARTIAL', '部分可用'],
  ['STALE', '数据已过期'],
  ['HEALTHY', '健康'],
  ['DEGRADED', '服务降级'],
  ['UNAVAILABLE', '不可用'],
  ['UNKNOWN', '未知'],
  ['BLOCKED', '阻断'],
  ['READY', '就绪'],
  ['FAILED', '失败'],
  ['RUNNING', '运行中'],
  ['PENDING', '待处理'],
  ['ENABLED', '已启用'],
  ['DISABLED', '已停用'],
  ['Active', '活跃'],
  ['Ready', '就绪'],
  ['Preparing', '准备中'],
  ['Delivering', '交付中'],
  ['Reconciled', '已对账'],
  ['Eligible', '可处理'],
  ['Queued', '已排队'],
  ['Converting', '转换中'],
  ['Review', '审核'],
  ['Failed', '失败'],
  ['Current', '当前'],
  ['Historical', '历史'],
  ['Source', '来源'],
  ['Evidence', '证据'],
  ['Status', '状态'],
  ['Actions', '操作'],
  ['Details', '详情'],
  ['Search', '搜索'],
  ['Filter', '筛选'],
  ['Refresh', '刷新'],
  ['Retry', '重试'],
  ['Replay', '重放'],
  ['Rollback', '回滚'],
  ['Cancel', '取消'],
  ['Confirm', '确认']
] as const;

const sortedEnglishPhrases = [...ENGLISH_PHRASES].sort((a, b) => b[0].length - a[0].length);
const sortedChinesePhrases = [...CHINESE_PHRASES].sort((a, b) => b[0].length - a[0].length);
const manualEnglish = new Map<string, string>(ENGLISH_PHRASES);
const manualChinese = new Map<string, string>([
  ['Ready Packages', 'Ready Packages'],
  ['Evidence summary', '证据摘要']
]);

const originalText = new WeakMap<Text, string>();
const renderedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

function readInitialLocale(): SuperAdminLocale {
  if (typeof window === 'undefined') return 'zh-CN';
  const stored = window.localStorage.getItem(SUPER_ADMIN_LOCALE_STORAGE_KEY);
  return stored === 'en-US' || stored === 'zh-CN' ? stored : 'zh-CN';
}

export function translateSuperAdminText(value: string, locale: SuperAdminLocale): string {
  let translated = value;
  if (locale === 'en-US') {
    const exact =
      manualEnglish.get(value) ?? GENERATED_EN_US[value as GeneratedEnglishSource] ?? undefined;
    if (exact) translated = exact;
  } else {
    const exact = manualChinese.get(value);
    if (exact) return exact;
  }
  const phrases = locale === 'en-US' ? sortedEnglishPhrases : sortedChinesePhrases;
  for (const [source, target] of phrases) translated = translated.split(source).join(target);
  return translated;
}

export function formatSuperAdminDateTime(value: string | Date, locale: SuperAdminLocale): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatSuperAdminNumber(
  value: number,
  locale: SuperAdminLocale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatSuperAdminCurrency(
  value: number,
  currency: string,
  locale: SuperAdminLocale
): string {
  return formatSuperAdminNumber(value, locale, { style: 'currency', currency });
}

function isPreserved(element: Element | null): boolean {
  return Boolean(
    element?.closest('[data-i18n-preserve], code, pre, textarea, script, style, .sa2-console-log')
  );
}

function localizeTextNode(node: Text, locale: SuperAdminLocale) {
  if (isPreserved(node.parentElement)) return;
  const current = node.nodeValue ?? '';
  if (!current.trim()) return;
  if (!originalText.has(node) || (renderedText.has(node) && renderedText.get(node) !== current)) {
    originalText.set(node, current);
  }
  const source = originalText.get(node) ?? current;
  if (node.parentElement?.tagName === 'OPTION' && !node.parentElement.hasAttribute('value')) {
    node.parentElement.setAttribute('value', source.trim());
  }
  const next = translateSuperAdminText(source, locale);
  if (current !== next) node.nodeValue = next;
  renderedText.set(node, next);
}

const LOCALIZED_ATTRIBUTES = ['aria-label', 'placeholder', 'title'] as const;

function localizeElementAttributes(element: Element, locale: SuperAdminLocale) {
  if (isPreserved(element)) return;
  let sources = originalAttributes.get(element);
  if (!sources) {
    sources = new Map<string, string>();
    originalAttributes.set(element, sources);
  }
  for (const name of LOCALIZED_ATTRIBUTES) {
    const current = element.getAttribute(name);
    if (current === null) continue;
    const previousSource = sources.get(name);
    const previousRendered = previousSource
      ? translateSuperAdminText(previousSource, locale === 'en-US' ? 'zh-CN' : 'en-US')
      : undefined;
    if (
      !previousSource ||
      (current !== translateSuperAdminText(previousSource, locale) && current !== previousRendered)
    ) {
      sources.set(name, current);
    }
    const source = sources.get(name) ?? current;
    const next = translateSuperAdminText(source, locale);
    if (current !== next) element.setAttribute(name, next);
  }
}

function localizeTree(root: HTMLElement, locale: SuperAdminLocale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current: Node | null = root;
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) localizeTextNode(current as Text, locale);
    else localizeElementAttributes(current as Element, locale);
    current = walker.nextNode();
  }
}

export function collectMissingSuperAdminTranslations(
  root: HTMLElement,
  locale: SuperAdminLocale
): string[] {
  if (locale !== 'en-US') return [];
  const missing = new Set<string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const value = node.nodeValue?.trim() ?? '';
    if (
      value &&
      /[\u3400-\u9fff]/u.test(value.replaceAll('简体中文', '')) &&
      !isPreserved(node.parentElement)
    ) {
      missing.add(value);
    }
    current = walker.nextNode();
  }
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    if (isPreserved(element)) continue;
    for (const name of LOCALIZED_ATTRIBUTES) {
      const value = element.getAttribute(name)?.trim() ?? '';
      if (value && /[\u3400-\u9fff]/u.test(value.replaceAll('简体中文', ''))) {
        missing.add(`${name}: ${value}`);
      }
    }
  }
  return [...missing].sort();
}

interface SuperAdminI18nValue {
  locale: SuperAdminLocale;
  setLocale: (locale: SuperAdminLocale) => void;
  t: (key: SuperAdminMessageKey) => string;
}

const SuperAdminI18nContext = createContext<SuperAdminI18nValue | null>(null);

export function useSuperAdminI18n(): SuperAdminI18nValue {
  const value = useContext(SuperAdminI18nContext);
  if (!value) throw new Error('Super Admin i18n context is unavailable.');
  return value;
}

export function SuperAdminI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SuperAdminLocale>(readInitialLocale);
  const rootRef = useRef<HTMLDivElement>(null);

  const setLocale = (next: SuperAdminLocale) => {
    window.localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, next);
    setLocaleState(next);
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    document.documentElement.lang = locale;
    let applying = false;
    const apply = () => {
      if (applying) return;
      applying = true;
      observer.disconnect();
      localizeTree(root, locale);
      const missing = collectMissingSuperAdminTranslations(root, locale);
      root.dataset.i18nMissingCount = String(missing.length);
      root.dataset.i18nMissing = missing.join(' || ');
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true
      });
      applying = false;
    };
    const observer = new MutationObserver(apply);
    apply();
    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo<SuperAdminI18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => messages[key][locale]
    }),
    [locale]
  );

  return (
    <SuperAdminI18nContext.Provider value={value}>
      <div ref={rootRef} className="sa2-i18n-root" data-locale={locale}>
        {children}
      </div>
    </SuperAdminI18nContext.Provider>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useSuperAdminI18n();
  return (
    <div className="sa2-language-switcher" role="group" aria-label={t('language.label')}>
      <button type="button" aria-pressed={locale === 'zh-CN'} onClick={() => setLocale('zh-CN')}>
        {t('language.chinese')}
      </button>
      <button type="button" aria-pressed={locale === 'en-US'} onClick={() => setLocale('en-US')}>
        {t('language.english')}
      </button>
    </div>
  );
}
