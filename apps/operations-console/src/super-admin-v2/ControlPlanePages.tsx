import { useEffect, useMemo, useState } from 'react';
import type { ModuleId } from './catalog.js';

export const BATCH_A_PAGE_IDS = {
  overview: ['platform', 'health', 'alerts', 'usage', 'attention'],
  operations: ['overview', 'queue', 'runs', 'workers', 'schedules', 'recovery', 'logs'],
  integrations: [
    'directory',
    'switches',
    'credentials',
    'authorizations',
    'health',
    'usage',
    'limits',
    'failures'
  ]
} as const;

type BatchAModule = Extract<ModuleId, 'overview' | 'operations' | 'integrations'>;
type Variant =
  | 'command'
  | 'topology'
  | 'incident'
  | 'bars'
  | 'queue'
  | 'timeline'
  | 'fleet'
  | 'calendar'
  | 'recovery'
  | 'logs'
  | 'catalog'
  | 'layers'
  | 'vault'
  | 'scope'
  | 'policy';

interface ControlObject {
  id: string;
  name: string;
  owner: string;
  status: string;
  meta: string;
  impact: string;
  chain: readonly string[];
}

interface PageDefinition {
  eyebrow: string;
  title: string;
  description: string;
  objectLabel: string;
  variant: Variant;
  facts: readonly (readonly [string, string, string])[];
  action: string;
  actionProtected?: boolean;
  objects: readonly ControlObject[];
}

interface ControlPlanePagesProps {
  moduleId: BatchAModule;
  pageId: string;
  query: string;
  setQuery: (value: string) => void;
  onAction: (label: string, protectedAction?: boolean) => void;
  onDeepLink?: (targetPath: string, sourceId: string, targetObjectId: string) => void;
  focusObjectId?: string | undefined;
}

const object = (
  id: string,
  name: string,
  owner: string,
  status: string,
  meta: string,
  impact: string,
  chain: readonly string[]
): ControlObject => ({ id, name, owner, status, meta, impact, chain });

const definitions: Record<BatchAModule, Record<string, PageDefinition>> = {
  overview: {
    platform: {
      eyebrow: 'CROSS-OWNER COMMAND',
      title: '平台运行控制室',
      description: '从 owner 告警进入服务、依赖和任务证据；聚合层只编排调查，不重写 owner 状态。',
      objectLabel: '平台事件',
      variant: 'command',
      facts: [
        ['Owner 投影', '8 / 10', '2 个未建模'],
        ['开放事件', '6', '2 个高影响'],
        ['关联运行', '14', '跨 4 个 owner'],
        ['待人工处理', '3', '未自动执行']
      ],
      action: '创建跨 owner 调查',
      objects: [
        object(
          'INC-2048',
          'Knowledge 来源新鲜度下降',
          'Knowledge',
          '需处理',
          '8 分钟前 · EUIPO',
          '2 个 Ready Package 等待新版本',
          ['Knowledge source', 'Collection run RUN-9821', 'Ready Package RPK-4164']
        ),
        object(
          'INC-2051',
          'Data Engine CN 批次等待批准',
          'Data Engine',
          '等待审核',
          '12 分钟前 · CN',
          '后续发布阶段未开始',
          ['Data package PKG-CN-2409', 'Run RUN-CN-8821', 'Checkpoint CP-88421']
        ),
        object(
          'INC-2054',
          'OpenAI 路由进入降级链',
          'Brain',
          '降级',
          '18 分钟前 · Global',
          '32 次调用改用备用模型',
          ['Provider OpenAI', 'Route BR-12', 'Capability CAP-ANALYZE']
        )
      ]
    },
    health: {
      eyebrow: 'SERVICE DEPENDENCY MAP',
      title: '运行健康与依赖',
      description: '健康来自 owner 投影；未连接、无权限和无数据分别显示。',
      objectLabel: '服务节点',
      variant: 'topology',
      facts: [
        ['健康节点', '18', 'Owner reported'],
        ['降级节点', '2', '依赖受限'],
        ['未知节点', '3', '未建模'],
        ['SLO 风险', '1', '过去 30 分钟']
      ],
      action: '模拟刷新依赖快照',
      objects: [
        object(
          'SVC-KNW',
          'Knowledge ingestion',
          'Knowledge',
          '降级',
          'P95 8m 42s',
          'EUIPO 新鲜度低于目标',
          ['Gateway', 'Knowledge API', 'worker-web-03']
        ),
        object(
          'SVC-DATA',
          'Data package builder',
          'Data Engine',
          '正常',
          'P95 4m 18s',
          '无当前影响',
          ['Gateway', 'Data admin read', 'package-builder']
        ),
        object(
          'SVC-PAY',
          'Payment ledger projection',
          'Payment',
          '未知',
          'NOT_YET_MODELED',
          '不纳入健康率',
          ['Gateway', 'Owner projection missing']
        )
      ]
    },
    alerts: {
      eyebrow: 'ACTIONABLE ALERTS',
      title: '实时告警调查',
      description: '按影响和可处理性归并告警，保留源事件、抑制规则与关联对象。',
      objectLabel: '告警',
      variant: 'incident',
      facts: [
        ['未确认', '7', '2 个高优先级'],
        ['已确认', '12', '今天'],
        ['被抑制', '31', '规则可追溯'],
        ['误报候选', '2', '等待评审']
      ],
      action: '确认所选告警',
      actionProtected: true,
      objects: [
        object(
          'ALT-7718',
          'WIPO 转换连续失败',
          'Knowledge',
          '高',
          '5 分钟前 · 3 次',
          '供应链暂停在转换阶段',
          ['Source WIPO', 'CONV-9813', 'worker-convert-04']
        ),
        object(
          'ALT-7720',
          'Stripe webhook 延迟',
          'Payment',
          '中',
          '11 分钟前',
          '订单状态仍以 owner 账本为准',
          ['Stripe', 'Payment webhook', 'Order projection']
        ),
        object(
          'ALT-7724',
          'Workspace 配额接近上限',
          'Core',
          '低',
          '18 分钟前',
          'Acme IP 已使用 92%',
          ['Workspace WSP-ACME', 'Quota storage', 'Plan Scale']
        )
      ]
    },
    usage: {
      eyebrow: 'PLATFORM CONSUMPTION',
      title: '跨产品使用情况',
      description: '区分计量值、套餐权益和 owner 账单口径，不从调用量推断商业状态。',
      objectLabel: '使用量流',
      variant: 'bars',
      facts: [
        ['API 调用', '1.2M', '过去 24h'],
        ['活跃 Workspace', '96', 'Core projection'],
        ['AI Tokens', '84M', 'Brain metering'],
        ['计费确认', '—', '由 Payment owner 提供']
      ],
      action: '导出演示使用快照',
      objects: [
        object('USE-BRAIN', 'Brain inference', 'Brain', '74%', '84M tokens', '预算阈值剩余 26%', [
          'Workspace metering',
          'Model route',
          'Provider usage'
        ]),
        object(
          'USE-DATA',
          'Data queries',
          'Data Engine',
          '52%',
          '1.2M requests',
          '峰值低于容量阈值',
          ['Gateway', 'Query service', 'ClickHouse']
        ),
        object(
          'USE-KNW',
          'Knowledge retrieval',
          'Knowledge',
          '68%',
          '682K searches',
          '当前性过滤 96%',
          ['Workspace', 'Retrieval', 'Evidence locator']
        )
      ]
    },
    attention: {
      eyebrow: 'OPERATOR INBOX',
      title: '待处理事项',
      description: '只收集需要 Super Admin 判断的事项，按权限、截止时间和阻断影响排序。',
      objectLabel: '处理事项',
      variant: 'queue',
      facts: [
        ['待我处理', '9', '3 个今日到期'],
        ['等待 owner', '6', '不可越权推进'],
        ['等待审批', '3', '精确权限检查'],
        ['已升级', '2', '有调查记录']
      ],
      action: '分派所选事项',
      actionProtected: true,
      objects: [
        object(
          'ATT-109',
          '审核 CNIPA 冻结计划',
          'Data Engine',
          '今日到期',
          '需要 data-admin:approve',
          '阻断 CN 发布阶段',
          ['RUN-CN-8821', 'Plan SHA-256', 'Operator approval']
        ),
        object(
          'ATT-112',
          '复核证据高风险定位',
          'Knowledge',
          '4 小时内',
          '需要 knowledge-review:approve',
          '18 条证据等待审核',
          ['EVD-11838', 'Exact locator', 'Review history']
        ),
        object(
          'ATT-118',
          '确认异常登录调查范围',
          'Core',
          '明日',
          '需要 security-investigation:read',
          '1 个 Workspace 受影响',
          ['User session', 'Risk policy', 'Audit events']
        )
      ]
    }
  },
  operations: {
    overview: {
      eyebrow: 'OWNER EXECUTION CONTROL',
      title: '任务运行总览',
      description: '跨 owner 查看 durable run、租约、检查点和需要人工决策的执行。',
      objectLabel: '任务运行',
      variant: 'command',
      action: '模拟刷新运行投影',
      facts: [
        ['运行中', '36', '7 个 owner'],
        ['排队', '84', '按 owner 隔离'],
        ['失败隔离', '3', '未自动跳过'],
        ['可恢复', '12', '满足检查点条件']
      ],
      objects: [
        object(
          'RUN-8821',
          'CNIPA 数据包构建',
          'Data Engine',
          '等待审核',
          '72% · CP-88421',
          '发布阶段未执行',
          ['Fetch', 'Normalize', 'Validate', 'Publish']
        ),
        object(
          'RUN-9821',
          'EUIPO 指南采集',
          'Knowledge',
          '运行中',
          '14 / 18 artifacts',
          '4 个 URL 等待',
          ['Plan snapshot', 'Worker lease', 'Raw receipt']
        ),
        object('RUN-5412', '批量商标监测', 'Execution', '运行中', '46% · 18 matters', '无阻断', [
          'Task plan',
          'Capability calls',
          'Result receipts'
        ])
      ]
    },
    queue: {
      eyebrow: 'OWNER QUEUES',
      title: '任务队列',
      description: '按 owner、任务类型、优先级和等待原因查看队列，不跨 owner 重排内部任务。',
      objectLabel: '队列项',
      variant: 'queue',
      action: '提交优先级变更申请',
      actionProtected: true,
      facts: [
        ['队列项', '84', '6 个队列'],
        ['最长等待', '18m', 'Knowledge convert'],
        ['受配额限制', '8', '显式原因'],
        ['待人工批准', '2', '不会自动出队']
      ],
      objects: [
        object(
          'Q-4412',
          'Knowledge PDF conversion',
          'Knowledge',
          '等待 Worker',
          '18 分钟',
          '需要 pdf-evidence-v3 能力',
          ['Queue knowledge.convert', 'Profile v3', 'Compatible worker']
        ),
        object(
          'Q-4419',
          'Data CN publish',
          'Data Engine',
          '等待批准',
          '12 分钟',
          '冻结计划待确认',
          ['Queue data.publish', 'RUN-CN-8821', 'Approval gate']
        ),
        object(
          'Q-4426',
          'Brain evaluation batch',
          'Brain',
          '受配额限制',
          '7 分钟',
          'Provider rate limit',
          ['Queue brain.eval', 'Route BR-18', 'Provider quota']
        )
      ]
    },
    runs: {
      eyebrow: 'EXECUTION CHAIN',
      title: '执行记录',
      description: '检查一次执行的计划、阶段、Capability 调用、日志和最终 receipt。',
      objectLabel: '执行记录',
      variant: 'timeline',
      action: '导出所选运行证据',
      facts: [
        ['今日运行', '328', 'Owner receipts'],
        ['完成', '309', '不等于业务接受'],
        ['失败', '7', '按阶段隔离'],
        ['P95', '6m 18s', '过去 24h']
      ],
      objects: [
        object(
          'EXE-77218',
          '海外供应商匹配',
          'Execution',
          '已完成',
          '6m 12s · 8 calls',
          '结果等待 Workplace 接受',
          ['Plan frozen', 'CAP-SUPPLY-MATCH', 'Provider calls', 'Result receipt']
        ),
        object('EXE-77211', '证据摘要生成', 'Brain', '失败', '2m 48s · stage 3', '模型路由超时', [
          'Prompt version',
          'Route chain',
          'Timeout evidence'
        ]),
        object(
          'EXE-77192',
          '数据包质量校验',
          'Data Engine',
          '已完成',
          '4m 01s · 28 rejected',
          '质量问题未自动接受',
          ['Manifest', 'Validator', 'Quality report']
        )
      ]
    },
    workers: {
      eyebrow: 'EXECUTION WORKER FLEET',
      title: 'Workers',
      description: '展示 worker 能力、心跳、并发和租约，不由聚合后台伪造可用性。',
      objectLabel: 'Worker',
      variant: 'fleet',
      action: '申请隔离 Worker',
      actionProtected: true,
      facts: [
        ['Workers', '12', '4 个能力池'],
        ['健康', '10', '心跳有效'],
        ['繁忙', '1', '并发已满'],
        ['失联', '1', '停止派发']
      ],
      objects: [
        object(
          'WRK-EXEC-03',
          'execution-general-03',
          'Execution',
          '健康',
          '3 / 4 slots · 8s',
          '3 个有效租约',
          ['task.execute', 'capability.invoke', 'receipt.write']
        ),
        object(
          'WRK-KNW-07',
          'knowledge-convert-07',
          'Knowledge',
          '繁忙',
          '4 / 4 slots · 9s',
          '转换队列等待',
          ['html.clean', 'pdf.extract', 'evidence.locate']
        ),
        object(
          'WRK-DATA-02',
          'data-normalize-02',
          'Data Engine',
          '失联',
          '0 / 2 · 6m',
          '新任务已停止派发',
          ['cn.normalize', 'manifest.validate']
        )
      ]
    },
    schedules: {
      eyebrow: 'SCHEDULE INTENT',
      title: '调度计划',
      description: '查看 owner 声明的节奏、下一次窗口和错过运行；这里只提交变更申请。',
      objectLabel: '调度',
      variant: 'calendar',
      action: '创建调度变更申请',
      actionProtected: true,
      facts: [
        ['启用计划', '28', 'Owner managed'],
        ['今日窗口', '42', '跨时区'],
        ['错过运行', '2', '需调查'],
        ['暂停', '3', '有原因']
      ],
      objects: [
        object(
          'SCH-CN-08',
          'CNIPA Gazette weekdays',
          'Data Engine',
          '启用',
          '工作日 10:00 CST',
          '下次 20 小时后',
          ['Schedule intent', 'Source window', 'Domain task']
        ),
        object(
          'SCH-EU-12',
          'EUIPO guidelines monitor',
          'Knowledge',
          '启用',
          '每 6 小时',
          '下次 2 小时后',
          ['Collection plan', 'Diff policy', 'Worker queue']
        ),
        object(
          'SCH-EVAL-04',
          'Brain quality evaluation',
          'Brain',
          '错过',
          '每日 01:00 UTC',
          'Provider quota 阻断',
          ['Evaluation set', 'Route policy', 'Budget gate']
        )
      ]
    },
    recovery: {
      eyebrow: 'CONTROLLED RECOVERY',
      title: '失败与恢复',
      description: '恢复必须满足冻结计划、检查点、幂等和精确权限条件，不能只提供 Retry 按钮。',
      objectLabel: '恢复候选',
      variant: 'recovery',
      action: '审阅恢复条件',
      actionProtected: true,
      facts: [
        ['失败隔离', '7', '保留部分状态'],
        ['可恢复', '3', '条件满足'],
        ['需人工修复', '2', '不可重试'],
        ['等待权限', '2', '精确 capability']
      ],
      objects: [
        object(
          'RCV-8821',
          'CN publish from checkpoint',
          'Data Engine',
          '可恢复',
          'CP-88421 · plan 63c7…a884',
          '需要一次批准',
          ['Checkpoint exists', 'Plan hash matches', 'No active lease', 'data-admin:resume']
        ),
        object(
          'RCV-9813',
          'WIPO conversion replay',
          'Knowledge',
          '阻断',
          'Missing compatible profile',
          '先修复转换 profile',
          ['Raw artifact immutable', 'Profile unavailable', 'No dispatch']
        ),
        object(
          'RCV-7711',
          'Provider call compensation',
          'Execution',
          '人工处理',
          'External side effect unknown',
          '必须核对外部回执',
          ['Invocation receipt', 'Provider return', 'Compensation review']
        )
      ]
    },
    logs: {
      eyebrow: 'CORRELATED LOG EXPLORER',
      title: '系统日志',
      description: '按 trace、owner、级别和时间查询脱敏日志，并关联到任务和检查点。',
      objectLabel: '日志流',
      variant: 'logs',
      action: '导出脱敏日志片段',
      facts: [
        ['事件', '18.4K', '过去 1 小时'],
        ['Error', '28', '7 个 trace'],
        ['脱敏字段', '146', '策略执行'],
        ['保留', '30d', 'Owner policies']
      ],
      objects: [
        object(
          'TRC-a82f',
          'RUN-CN-8821 validation',
          'Data Engine',
          'WARN',
          '10:42:19 · 6 events',
          '28 records rejected',
          ['gateway.request', 'validator.batch', 'checkpoint.persist']
        ),
        object(
          'TRC-b118',
          'Knowledge conversion lease',
          'Knowledge',
          'ERROR',
          '10:38:42 · 9 events',
          'lease expired',
          ['queue.claim', 'worker.heartbeat', 'lease.expired']
        ),
        object(
          'TRC-c901',
          'Brain provider fallback',
          'Brain',
          'INFO',
          '10:31:09 · 12 events',
          '32 calls rerouted',
          ['route.select', 'provider.timeout', 'fallback.complete']
        )
      ]
    }
  },
  integrations: {
    directory: {
      eyebrow: 'SERVICE CATALOG',
      title: '集成服务目录',
      description: '区分服务定义、产品用途、owner 和实际连接实例。',
      objectLabel: '集成服务',
      variant: 'catalog',
      action: '登记服务申请',
      actionProtected: true,
      facts: [
        ['服务定义', '12', '6 个 owner'],
        ['连接实例', '48', 'Workspace scoped'],
        ['健康', '44', 'Owner probe'],
        ['降级', '2', '有降级路径']
      ],
      objects: [
        object(
          'INT-OPENAI',
          'OpenAI',
          'Brain',
          '正常',
          'AI models · 12 connections',
          '无当前影响',
          ['Service definition', 'Brain route', 'Workspace authorization']
        ),
        object(
          'INT-STRIPE',
          'Stripe',
          'Payment',
          '降级',
          'Payments · 3 accounts',
          'Webhook 延迟 11 分钟',
          ['Service definition', 'Payment account', 'Webhook health']
        ),
        object('INT-TWILIO', 'Twilio', 'Core', '正常', 'SMS · 8 connections', '无当前影响', [
          'Service definition',
          'Workspace grant',
          'Credential reference'
        ])
      ]
    },
    switches: {
      eyebrow: 'FOUR-LAYER AVAILABILITY',
      title: 'API 启停策略',
      description: '全局策略、产品权益、Workspace 配置和连接健康分层展示，任何一层都不等于其他层。',
      objectLabel: '可用性策略',
      variant: 'layers',
      action: '审阅策略变更',
      actionProtected: true,
      facts: [
        ['全局允许', '10 / 12', 'Platform policy'],
        ['有产品权益', '86', 'Entitlement'],
        ['Workspace 启用', '72', 'Local config'],
        ['实际健康', '68', 'Runtime probe']
      ],
      objects: [
        object(
          'AVL-OPENAI',
          'OpenAI · Acme IP',
          'Brain',
          '可用',
          '4 / 4 layers pass',
          'Route 正常',
          ['Global allowed', 'Plan entitled', 'Workspace enabled', 'Connection healthy']
        ),
        object(
          'AVL-STRIPE',
          'Stripe · Global Brand',
          'Payment',
          '降级',
          '3 / 4 layers pass',
          '连接健康失败',
          ['Global allowed', 'Plan entitled', 'Workspace enabled', 'Connection degraded']
        ),
        object(
          'AVL-TWILIO',
          'Twilio · Sunrise',
          'Core',
          '不可用',
          '2 / 4 layers pass',
          'Workspace 未启用',
          ['Global allowed', 'Plan entitled', 'Workspace disabled', 'Not probed']
        )
      ]
    },
    credentials: {
      eyebrow: 'CREDENTIAL REFERENCES',
      title: '密钥与凭证',
      description: '仅展示凭证引用、轮换和作用域，不回显 secret 值。',
      objectLabel: '凭证引用',
      variant: 'vault',
      action: '发起凭证轮换',
      actionProtected: true,
      facts: [
        ['凭证引用', '48', '0 个值可见'],
        ['30 天内到期', '3', '已通知 owner'],
        ['轮换中', '2', '双版本窗口'],
        ['访问违规', '0', '过去 30 天']
      ],
      objects: [
        object(
          'CRED-OAI-18',
          'OpenAI production reference',
          'Brain',
          '有效',
          '到期 2026-12-18',
          '12 个模型路由引用',
          ['Vault ref vrn:oai:18', 'Scope brain.invoke', 'Rotation policy 90d']
        ),
        object(
          'CRED-STR-04',
          'Stripe webhook signing',
          'Payment',
          '将到期',
          '剩余 18 天',
          '3 个 webhook endpoints',
          ['Vault ref vrn:str:04', 'Scope webhook.verify', 'Rotation pending']
        ),
        object(
          'CRED-TWI-11',
          'Twilio messaging',
          'Core',
          '轮换中',
          'v11 + v12 overlap',
          '8 个 Workspace 连接',
          ['Vault ref vrn:twi:11', 'Scope sms.send', 'Overlap ends 09-28']
        )
      ]
    },
    authorizations: {
      eyebrow: 'WORKSPACE GRANTS',
      title: 'Workspace 授权',
      description: '查看 Workspace 对服务的精确 scope、授予人、到期和产品依据。',
      objectLabel: '授权',
      variant: 'scope',
      action: '发起授权复核',
      actionProtected: true,
      facts: [
        ['有效授权', '126', 'Workspace scoped'],
        ['即将到期', '8', '30 天内'],
        ['超出权益', '2', '已阻断'],
        ['待复核', '6', 'Owner approval']
      ],
      objects: [
        object(
          'GRANT-ACME-OAI',
          'Acme IP → OpenAI',
          'Core',
          '有效',
          'brain.invoke · 2027-01-01',
          'Plan Scale 提供权益',
          ['Workspace WSP-ACME', 'Product entitlement Brain Pro', 'Scope brain.invoke']
        ),
        object(
          'GRANT-SUN-TWI',
          'Sunrise → Twilio',
          'Core',
          '待复核',
          'sms.send · 2026-10-01',
          '用途说明已更新',
          ['Workspace WSP-SUNRISE', 'Core notification', 'Scope sms.send']
        ),
        object(
          'GRANT-GB-STR',
          'Global Brand → Stripe',
          'Payment',
          '阻断',
          'payments.refund requested',
          '当前套餐无退款管理权益',
          ['Workspace WSP-GLOBAL', 'Payment entitlement missing', 'Scope denied']
        )
      ]
    },
    health: {
      eyebrow: 'CONNECTION HEALTH',
      title: '健康监测',
      description: '运行探针与业务成功率分开呈现，并标明故障影响和已配置降级路径。',
      objectLabel: '连接健康',
      variant: 'topology',
      action: '模拟运行健康探针',
      facts: [
        ['健康连接', '44', '最近 5 分钟'],
        ['降级', '2', '仍可部分服务'],
        ['不可用', '1', '隔离'],
        ['未探测', '1', 'Workspace disabled']
      ],
      objects: [
        object('HLT-OAI', 'OpenAI primary', 'Brain', '健康', 'P95 1.8s · 99.8%', '无当前影响', [
          'DNS/TLS',
          'Auth',
          'Model list',
          'Inference probe'
        ]),
        object(
          'HLT-STR',
          'Stripe webhook',
          'Payment',
          '降级',
          'P95 18m · 94.2%',
          '订单投影延迟，不改变账本',
          ['TLS', 'Signature verify', 'Webhook receipt', 'Projection lag']
        ),
        object(
          'HLT-TWI',
          'Twilio SMS',
          'Core',
          '不可用',
          '401 · credential expired',
          '通知改走 Email',
          ['Auth failed', 'Circuit open', 'Fallback Email']
        )
      ]
    },
    usage: {
      eyebrow: 'INTEGRATION METERING',
      title: '调用统计',
      description: '按服务、Workspace、scope 和结果查看调用；用量不推断付款或授权。',
      objectLabel: '调用流',
      variant: 'bars',
      action: '导出演示调用快照',
      facts: [
        ['今日调用', '1.2M', '48 个连接'],
        ['成功率', '99.1%', 'Provider returns'],
        ['被限流', '3,218', '按策略'],
        ['估算成本', '$8,420', '非财务账本']
      ],
      objects: [
        object(
          'MTR-OAI',
          'OpenAI inference',
          'Brain',
          '68%',
          '842K calls · $6,420 est.',
          '32 次 fallback',
          ['Workspace meter', 'Route/model', 'Provider usage']
        ),
        object(
          'MTR-GGL',
          'Google search',
          'Knowledge',
          '21%',
          '262K calls · $1,120 est.',
          '1,228 次 rate limited',
          ['Workspace meter', 'search.read', 'Provider response']
        ),
        object('MTR-TWI', 'Twilio SMS', 'Core', '11%', '96K calls · $880 est.', '成功率 97.8%', [
          'Notification event',
          'sms.send',
          'Delivery receipt'
        ])
      ]
    },
    limits: {
      eyebrow: 'RATE-LIMIT POLICY',
      title: '限流配置',
      description: '区分全局保护、服务策略、Workspace 配额和 provider 限制。',
      objectLabel: '限流策略',
      variant: 'policy',
      action: '提交限流变更申请',
      actionProtected: true,
      facts: [
        ['策略', '18', '4 个层级'],
        ['接近阈值', '3', '> 80%'],
        ['熔断', '1', 'Twilio auth'],
        ['自动放宽', '0', '明确禁止']
      ],
      objects: [
        object(
          'LIM-OAI-G',
          'OpenAI global guard',
          'Brain',
          '68%',
          '12,000 rpm / burst 2,000',
          '保护 provider 与预算',
          ['Global safety 15k', 'Service policy 12k', 'Workspace quota 2k', 'Provider 20k']
        ),
        object(
          'LIM-GGL-ACME',
          'Google · Acme IP',
          'Knowledge',
          '84%',
          '840 / 1,000 rpm',
          '接近 Workspace 配额',
          ['Global allowed', 'Service 5k', 'Workspace 1k', 'Provider 10k']
        ),
        object(
          'LIM-TWI',
          'Twilio messaging',
          'Core',
          '熔断',
          '0 / 500 rpm',
          '凭证失败，限流非根因',
          ['Circuit open', 'Credential expired', 'Fallback active']
        )
      ]
    },
    failures: {
      eyebrow: 'FAILURE ISOLATION',
      title: '失败记录',
      description: '按连接实例聚合失败、影响、降级与恢复证据，不将 provider 返回视为正式结论。',
      objectLabel: '失败组',
      variant: 'incident',
      action: '创建集成故障调查',
      facts: [
        ['开放故障', '4', '2 个有降级'],
        ['影响 Workspace', '12', '去重后'],
        ['隔离连接', '1', 'Twilio'],
        ['待 owner 处理', '3', '聚合层不修账']
      ],
      objects: [
        object(
          'FAIL-1182',
          'Stripe webhook delivery lag',
          'Payment',
          '降级',
          '218 delayed · 11m',
          '订单投影延迟',
          ['Provider webhook', 'Signature valid', 'Owner receipt delayed', 'No ledger mutation']
        ),
        object(
          'FAIL-1188',
          'Twilio authentication failure',
          'Core',
          '隔离',
          '401 · 8 connections',
          'SMS 改走 Email',
          ['Credential ref', 'Auth failure', 'Circuit open', 'Fallback email']
        ),
        object(
          'FAIL-1191',
          'Google search throttling',
          'Knowledge',
          '恢复中',
          '1,228 × 429',
          '采集速度降低',
          ['Workspace quota', 'Backoff policy', 'Checkpoint retained']
        )
      ]
    }
  }
};

export function ControlPlanePages({
  moduleId,
  pageId,
  query,
  setQuery,
  onAction,
  onDeepLink,
  focusObjectId
}: ControlPlanePagesProps) {
  const moduleDefinitions = definitions[moduleId];
  const definition =
    moduleDefinitions[pageId] ?? moduleDefinitions[Object.keys(moduleDefinitions)[0]!]!;
  const [selectedId, setSelectedId] = useState(definition.objects[0]?.id ?? '');
  const [ownerFilter, setOwnerFilter] = useState('全部 Owner');
  useEffect(() => {
    setSelectedId(focusObjectId ?? definition.objects[0]?.id ?? '');
    setOwnerFilter('全部 Owner');
  }, [definition, focusObjectId]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return definition.objects.filter(
      (item) =>
        (ownerFilter === '全部 Owner' || item.owner === ownerFilter) &&
        (!normalized ||
          `${item.id} ${item.name} ${item.owner} ${item.status}`.toLowerCase().includes(normalized))
    );
  }, [definition, ownerFilter, query]);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  return (
    <section
      className={`sa2-depth sa2-control-page sa2-control-page--${definition.variant}`}
      data-testid={`${moduleId}-page-${pageId}`}
    >
      <header className="sa2-depth-head">
        <div>
          <span>{definition.eyebrow}</span>
          <h3>{definition.title}</h3>
          <p>{definition.description}</p>
        </div>
        <button
          className="sa2-button"
          onClick={() => onAction(definition.action, definition.actionProtected)}
        >
          ＋ {definition.action}
        </button>
      </header>
      <div className="sa2-page-facts">
        {definition.facts.map((fact) => (
          <article key={fact[0]}>
            <span>{fact[0]}</span>
            <strong>{fact[1]}</strong>
            <small>{fact[2]}</small>
          </article>
        ))}
      </div>
      <VariantCanvas
        variant={definition.variant}
        objects={definition.objects}
        selectedId={selected?.id}
        onSelect={setSelectedId}
      />
      <div className="sa2-operator-workspace">
        <article className="sa2-depth-card sa2-object-browser">
          <header>
            <div>
              <span>{definition.objectLabel.toUpperCase()}</span>
              <h4>{definition.objectLabel}列表</h4>
            </div>
            <b>{visible.length} DEMO</b>
          </header>
          <div className="sa2-inline-search">
            <input
              aria-label={`搜索${definition.objectLabel}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`搜索 ${definition.objectLabel} ID、名称或 owner`}
            />
            <select
              aria-label="Owner 筛选"
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
            >
              <option>全部 Owner</option>
              {[...new Set(definition.objects.map((item) => item.owner))].map((owner) => (
                <option key={owner}>{owner}</option>
              ))}
            </select>
          </div>
          {visible.map((item) => (
            <button
              className={item.id === selected?.id ? 'is-active' : ''}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <i />
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.id} · {item.meta}
                </small>
              </span>
              <u>{item.owner}</u>
              <b>{item.status}</b>
            </button>
          ))}
        </article>
        {selected ? (
          <article
            className="sa2-depth-card sa2-object-detail"
            data-testid={`${moduleId}-${pageId}-detail`}
          >
            <header>
              <div>
                <span>SELECTED {definition.objectLabel.toUpperCase()}</span>
                <h4>{selected.name}</h4>
              </div>
              <b>{selected.status}</b>
            </header>
            <dl>
              <div>
                <dt>ID</dt>
                <dd>{selected.id}</dd>
              </div>
              <div>
                <dt>Durable owner</dt>
                <dd>{selected.owner}</dd>
              </div>
              <div>
                <dt>当前影响</dt>
                <dd>{selected.impact}</dd>
              </div>
              <div>
                <dt>来源说明</dt>
                <dd>Demo fixture · 不代表实时 owner truth</dd>
              </div>
            </dl>
            <h5>关联链路</h5>
            <ol>
              {selected.chain.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  <b>{step}</b>
                  {index < selected.chain.length - 1 && <i>→</i>}
                </li>
              ))}
            </ol>
            <div className="sa2-action-row">
              {moduleId === 'overview' && pageId === 'alerts' && selected.id === 'ALT-7718' && (
                <button
                  className="sa2-button"
                  onClick={() =>
                    onDeepLink?.('/super-admin-v2/knowledge/transforms', selected.id, 'CONV-9813')
                  }
                >
                  打开关联处理页面
                </button>
              )}
              <button
                className="sa2-button sa2-button--secondary"
                onClick={() => onAction(`查看 ${selected.id} 的 Demo 证据`)}
              >
                查看演示证据
              </button>
              <button
                className="sa2-button"
                onClick={() =>
                  onAction(`${definition.action}：${selected.id}`, definition.actionProtected)
                }
              >
                预演主要操作
              </button>
            </div>
          </article>
        ) : (
          <article className="sa2-depth-card sa2-inline-empty">
            <h4>没有匹配的演示对象</h4>
            <p>调整搜索词查看其他 fixture。</p>
          </article>
        )}
      </div>
    </section>
  );
}

function VariantCanvas({
  variant,
  objects,
  selectedId,
  onSelect
}: {
  variant: Variant;
  objects: readonly ControlObject[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (variant === 'topology' || variant === 'command')
    return (
      <article className="sa2-depth-card sa2-control-topology">
        <header>
          <span>{variant === 'command' ? 'CONTROL ROOM SIGNALS' : 'DEPENDENCY GRAPH'}</span>
          <b>DEMO OWNER PROJECTIONS</b>
        </header>
        <div>
          {objects.map((item, index) => (
            <button
              className={item.id === selectedId ? 'is-active' : ''}
              key={item.id}
              onClick={() => onSelect(item.id)}
            >
              <i>{index + 1}</i>
              <strong>{item.owner}</strong>
              <span>{item.name}</span>
              <u>{item.status}</u>
            </button>
          ))}
        </div>
      </article>
    );
  if (
    variant === 'timeline' ||
    variant === 'incident' ||
    variant === 'recovery' ||
    variant === 'logs'
  )
    return (
      <article className={`sa2-depth-card sa2-control-timeline is-${variant}`}>
        <header>
          <span>{variant.toUpperCase()} EVIDENCE</span>
          <b>按时间和执行阶段关联</b>
        </header>
        {objects.map((item, index) => (
          <button
            className={item.id === selectedId ? 'is-active' : ''}
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <time>{['10:42', '10:31', '09:58'][index]}</time>
            <i />
            <span>
              <strong>{item.name}</strong>
              <small>{item.meta}</small>
            </span>
            <u>{item.status}</u>
          </button>
        ))}
      </article>
    );
  if (variant === 'calendar')
    return (
      <article className="sa2-depth-card sa2-control-calendar">
        <header>
          {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
            <b key={day}>{day}</b>
          ))}
        </header>
        <div>
          {Array.from({ length: 7 }, (_, day) => (
            <section key={day}>
              <span>{21 + day}</span>
              {day < 5 &&
                objects.slice(0, day === 2 ? 3 : 2).map((item) => (
                  <button key={item.id} onClick={() => onSelect(item.id)}>
                    {item.name}
                  </button>
                ))}
            </section>
          ))}
        </div>
      </article>
    );
  if (variant === 'layers')
    return (
      <article className="sa2-depth-card sa2-control-layers">
        <header>
          <span>GLOBAL POLICY</span>
          <span>PRODUCT ENTITLEMENT</span>
          <span>WORKSPACE CONFIG</span>
          <span>CONNECTION HEALTH</span>
        </header>
        {objects.map((item, row) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            {item.chain.map((step, index) => (
              <span className={index < 4 - row ? 'pass' : 'fail'} key={step}>
                <i>{index < 4 - row ? '✓' : '!'}</i>
                <b>{step}</b>
              </span>
            ))}
          </button>
        ))}
      </article>
    );
  if (variant === 'fleet')
    return (
      <div className="sa2-control-fleet">
        {objects.map((item, index) => (
          <button
            className={item.id === selectedId ? 'is-active' : ''}
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <header>
              <i />
              <span>
                <strong>{item.name}</strong>
                <small>{item.owner}</small>
              </span>
              <u>{item.status}</u>
            </header>
            <div>
              <b>{item.meta}</b>
              <i>
                <em style={{ width: `${[75, 100, 4][index]}%` }} />
              </i>
            </div>
            <p>{item.impact}</p>
          </button>
        ))}
      </div>
    );
  if (variant === 'bars')
    return (
      <article className="sa2-depth-card sa2-control-bars">
        {objects.map((item, index) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <span>
              <strong>{item.name}</strong>
              <small>{item.meta}</small>
            </span>
            <i>
              <em style={{ width: `${[76, 58, 36][index]}%` }} />
            </i>
            <b>{item.status}</b>
          </button>
        ))}
      </article>
    );
  if (variant === 'vault')
    return (
      <div className="sa2-control-vault">
        {objects.map((item) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <span>▣</span>
            <strong>{item.name}</strong>
            <code>{item.id}</code>
            <small>Secret value never displayed</small>
            <u>{item.status}</u>
          </button>
        ))}
      </div>
    );
  if (variant === 'policy' || variant === 'scope')
    return (
      <article className="sa2-depth-card sa2-control-policy">
        {objects.map((item) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <span>
              <strong>{item.name}</strong>
              <small>{item.id}</small>
            </span>
            {item.chain.map((step) => (
              <i key={step}>{step}</i>
            ))}
            <u>{item.status}</u>
          </button>
        ))}
      </article>
    );
  return (
    <div className="sa2-control-catalog">
      {objects.map((item) => (
        <button key={item.id} onClick={() => onSelect(item.id)}>
          <span>{item.name.slice(0, 2).toUpperCase()}</span>
          <strong>{item.name}</strong>
          <small>
            {item.owner} · {item.meta}
          </small>
          <u>{item.status}</u>
          <p>{item.impact}</p>
        </button>
      ))}
    </div>
  );
}
