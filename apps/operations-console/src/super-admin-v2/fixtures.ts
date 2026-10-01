import type { ModuleId } from './catalog.js';

export const DEMO_FIXTURE_NOTICE =
  '演示数据 · 仅供产品评审，不连接生产写操作，不代表实时运行或 Official Truth';

export interface DemoRecord {
  id: string;
  name: string;
  detail: string;
  owner: string;
  status: '正常' | '需关注' | '降级' | '待审核' | '不可用';
  freshness: string;
  meta: readonly [string, string][];
}

const shared = (module: ModuleId): readonly DemoRecord[] => {
  const records: Record<ModuleId, readonly DemoRecord[]> = {
    overview: [
      {
        id: 'ALR-2048',
        name: 'Knowledge 来源新鲜度下降',
        detail: 'EUIPO 公告源延迟超过演示阈值',
        owner: 'Knowledge',
        status: '需关注',
        freshness: '8 分钟前',
        meta: [
          ['影响', '2 个 Ready Package'],
          ['下一步', '检查来源任务']
        ]
      },
      {
        id: 'RUN-8821',
        name: 'CNIPA 数据包重放待审核',
        detail: '检查点已保留，尚未执行恢复',
        owner: 'Data Engine',
        status: '待审核',
        freshness: '12 分钟前',
        meta: [
          ['范围', 'CN / Gazette'],
          ['状态', '等待受控恢复']
        ]
      },
      {
        id: 'SEC-1093',
        name: '异常登录已阻断',
        detail: '策略命中后会话被撤销',
        owner: 'Core',
        status: '正常',
        freshness: '26 分钟前',
        meta: [
          ['主体', 'Internal Operator'],
          ['策略', 'LOGIN-RISK-04']
        ]
      }
    ],
    workspaces: [
      {
        id: 'WSP-ACME',
        name: 'Acme IP',
        detail: '专业商标代理机构 · Singapore',
        owner: 'Core',
        status: '正常',
        freshness: '刚刚',
        meta: [
          ['套餐', 'Scale'],
          ['成员', '186'],
          ['产品', 'Lite · Site · MarkReg']
        ]
      },
      {
        id: 'WSP-SUNRISE',
        name: 'Sunrise Trading',
        detail: '品牌方 · United States',
        owner: 'Core',
        status: '正常',
        freshness: '3 分钟前',
        meta: [
          ['套餐', 'Pro'],
          ['成员', '26'],
          ['产品', 'Lite · Trading']
        ]
      },
      {
        id: 'WSP-GLOBAL',
        name: 'Global Brand LLC',
        detail: '代理机构 · United Kingdom',
        owner: 'Core',
        status: '需关注',
        freshness: '17 分钟前',
        meta: [
          ['套餐', 'Scale'],
          ['配额', '92%'],
          ['产品', 'Lite · Site']
        ]
      },
      {
        id: 'WSP-PURE',
        name: 'Pure Gold',
        detail: '企业法务 · China',
        owner: 'Core',
        status: '待审核',
        freshness: '1 小时前',
        meta: [
          ['套餐', 'Starter'],
          ['成员', '8'],
          ['产品', 'Lite']
        ]
      }
    ],
    users: [
      {
        id: 'USR-1008',
        name: 'Sarah Chen',
        detail: 'sarah@acmeip.com',
        owner: 'Core',
        status: '正常',
        freshness: '在线',
        meta: [
          ['关系', 'Acme IP · Owner'],
          ['MFA', '已启用'],
          ['最近登录', '2 分钟前']
        ]
      },
      {
        id: 'USR-1021',
        name: 'Mike Wang',
        detail: 'mike@acmeip.com',
        owner: 'Core',
        status: '正常',
        freshness: '12 分钟前',
        meta: [
          ['关系', 'Acme IP · Admin'],
          ['MFA', '已启用'],
          ['会话', '2']
        ]
      },
      {
        id: 'USR-1142',
        name: 'Lisa Zhang',
        detail: 'lisa@sunrise.com',
        owner: 'Core',
        status: '需关注',
        freshness: '1 小时前',
        meta: [
          ['关系', 'Sunrise · Lite User'],
          ['MFA', '未启用'],
          ['风险', '低']
        ]
      }
    ],
    products: [
      {
        id: 'PRD-LITE',
        name: 'MarkOrbit Lite',
        detail: '专业人士 AI 工作台',
        owner: 'Lite',
        status: '正常',
        freshness: 'v2.8.0',
        meta: [
          ['全局开关', '开启'],
          ['健康', 'Owner 正常'],
          ['启用 Workspace', '96']
        ]
      },
      {
        id: 'PRD-SITE',
        name: 'Site',
        detail: '获客与服务入口',
        owner: 'Workspace',
        status: '正常',
        freshness: 'v1.9.2',
        meta: [
          ['全局开关', '开启'],
          ['健康', 'Owner 正常'],
          ['站点', '246']
        ]
      },
      {
        id: 'PRD-MARKREG',
        name: 'MarkReg',
        detail: '商标申请与生命周期',
        owner: 'MarkReg',
        status: '正常',
        freshness: 'v3.2.1',
        meta: [
          ['全局开关', '开启'],
          ['健康', 'Owner 正常'],
          ['订单', '1,236']
        ]
      },
      {
        id: 'PRD-TRADING',
        name: 'Trading',
        detail: '闲置商标交易',
        owner: 'Trading',
        status: '降级',
        freshness: 'v0.8 preview',
        meta: [
          ['全局开关', '开启'],
          ['健康', '部分可用'],
          ['上架', '328']
        ]
      }
    ],
    data: [
      {
        id: 'DATA-CNIPA',
        name: 'CNIPA Gazette',
        detail: 'CN · 公告与状态数据包',
        owner: 'Data Engine',
        status: '需关注',
        freshness: '延迟 42 分钟',
        meta: [
          ['覆盖', '2012–至今'],
          ['质量', '98.7%'],
          ['检查点', 'CP-88421']
        ]
      },
      {
        id: 'DATA-USPTO',
        name: 'USPTO TSDR',
        detail: 'US · 商标档案与事件',
        owner: 'Data Engine',
        status: '正常',
        freshness: '6 分钟前',
        meta: [
          ['覆盖', '完整'],
          ['质量', '99.6%'],
          ['检查点', 'CP-99104']
        ]
      },
      {
        id: 'DATA-EUIPO',
        name: 'EUIPO Open Data',
        detail: 'EU · 商标与异议数据',
        owner: 'Data Engine',
        status: '正常',
        freshness: '11 分钟前',
        meta: [
          ['覆盖', '完整'],
          ['质量', '99.1%'],
          ['检查点', 'CP-77120']
        ]
      },
      {
        id: 'DATA-WIPO',
        name: 'WIPO Madrid',
        detail: 'Global · 国际注册',
        owner: 'Data Engine',
        status: '降级',
        freshness: '2 小时前',
        meta: [
          ['覆盖', '部分'],
          ['质量', '96.4%'],
          ['检查点', 'CP-55318']
        ]
      }
    ],
    knowledge: [
      {
        id: 'KN-EUIPO',
        name: 'EUIPO Guidelines',
        detail: 'Source → Raw → Transform → Evidence',
        owner: 'Knowledge',
        status: '正常',
        freshness: '今天 08:40',
        meta: [
          ['文件', '2,481'],
          ['证据审核', '96%'],
          ['Ready Packages', '42']
        ]
      },
      {
        id: 'KN-CNIPA',
        name: 'CNIPA Gazette',
        detail: 'Source → Raw → Transform → Evidence',
        owner: 'Knowledge',
        status: '需关注',
        freshness: '昨天 23:20',
        meta: [
          ['文件', '10,842'],
          ['待审核', '18'],
          ['Ready Packages', '63']
        ]
      },
      {
        id: 'KN-USPTO',
        name: 'USPTO Manual',
        detail: 'Source → Raw → Transform → Evidence',
        owner: 'Knowledge',
        status: '正常',
        freshness: '今天 06:15',
        meta: [
          ['文件', '1,203'],
          ['证据审核', '98%'],
          ['Ready Packages', '27']
        ]
      }
    ],
    brain: [
      {
        id: 'MDL-GPT',
        name: 'GPT-4o route',
        detail: '通用分析 · 多模态',
        owner: 'Core / Brain',
        status: '正常',
        freshness: '策略 v24',
        meta: [
          ['成功率', '98.6%'],
          ['P95 延迟', '2.4s'],
          ['本月调用', '468K']
        ]
      },
      {
        id: 'MDL-CLAUDE',
        name: 'Claude route',
        detail: '长文本与证据分析',
        owner: 'Core / Brain',
        status: '正常',
        freshness: '策略 v18',
        meta: [
          ['成功率', '99.1%'],
          ['P95 延迟', '3.1s'],
          ['本月调用', '284K']
        ]
      },
      {
        id: 'MDL-GEMINI',
        name: 'Gemini route',
        detail: '快速提取与分类',
        owner: 'Core / Brain',
        status: '降级',
        freshness: '策略 v12',
        meta: [
          ['成功率', '94.8%'],
          ['P95 延迟', '4.8s'],
          ['降级', '备用路由']
        ]
      }
    ],
    capabilities: [
      {
        id: 'CAP-RENEWAL',
        name: '商标续展与监控',
        detail: 'Domain → Capability → Skill → Action',
        owner: 'Capability Engine',
        status: '正常',
        freshness: 'v2.3',
        meta: [
          ['实现', '3'],
          ['证据', '18'],
          ['风险上限', 'Medium']
        ]
      },
      {
        id: 'CAP-OA',
        name: 'OA 分析与答复',
        detail: 'Domain → Capability → Skill → Action',
        owner: 'Capability Engine',
        status: '正常',
        freshness: 'v1.8',
        meta: [
          ['实现', '2'],
          ['评估', '通过'],
          ['审批', '必需']
        ]
      },
      {
        id: 'CAP-VALUATION',
        name: '商标价值评估',
        detail: 'Domain → Capability → Skill → Action',
        owner: 'Capability Engine',
        status: '待审核',
        freshness: 'v1.2 candidate',
        meta: [
          ['实现', '1'],
          ['评估', '待审核'],
          ['风险上限', 'Low']
        ]
      }
    ],
    integrations: [
      {
        id: 'INT-OPENAI',
        name: 'OpenAI',
        detail: 'AI 模型服务',
        owner: 'Brain',
        status: '正常',
        freshness: '1 分钟前',
        meta: [
          ['范围', '全局 / 12 Workspace'],
          ['可用率', '99.98%'],
          ['凭证', '已配置 · 不可见']
        ]
      },
      {
        id: 'INT-MICROSOFT',
        name: 'Microsoft Graph',
        detail: '邮件与协作',
        owner: 'Core',
        status: '正常',
        freshness: '4 分钟前',
        meta: [
          ['范围', '8 Workspace'],
          ['可用率', '99.92%'],
          ['凭证', '已配置 · 不可见']
        ]
      },
      {
        id: 'INT-STRIPE',
        name: 'Stripe',
        detail: '支付状态同步',
        owner: 'Payment',
        status: '降级',
        freshness: '9 分钟前',
        meta: [
          ['范围', 'Payment'],
          ['影响', 'Webhook 延迟'],
          ['凭证', '已配置 · 不可见']
        ]
      },
      {
        id: 'INT-TWILIO',
        name: 'Twilio',
        detail: '短信通知',
        owner: 'Core',
        status: '不可用',
        freshness: '18 分钟前',
        meta: [
          ['范围', '通知'],
          ['隔离', '其他模块正常'],
          ['恢复', 'Owner 检查中']
        ]
      }
    ],
    operations: [
      {
        id: 'JOB-8821',
        name: 'CNIPA 数据包重放',
        detail: 'Data Engine · replay package',
        owner: 'Data Engine',
        status: '待审核',
        freshness: '运行 18m 42s',
        meta: [
          ['进度', '72%'],
          ['Worker', 'data-03'],
          ['检查点', 'CP-88421']
        ]
      },
      {
        id: 'JOB-8819',
        name: 'USPTO OA 索引',
        detail: 'Knowledge · transform and index',
        owner: 'Knowledge',
        status: '正常',
        freshness: '运行 7m 12s',
        meta: [
          ['进度', '45%'],
          ['Worker', 'know-07'],
          ['Run', 'RUN-11829']
        ]
      },
      {
        id: 'JOB-8816',
        name: 'Ready Package 生成',
        detail: 'Knowledge · governed packaging',
        owner: 'Knowledge',
        status: '降级',
        freshness: '失败于 09:36',
        meta: [
          ['原因', '上游版本不一致'],
          ['重试', '未执行'],
          ['Run', 'RUN-11818']
        ]
      }
    ],
    billing: [
      {
        id: 'PAY-9281',
        name: 'Acme IP · Scale 月度订阅',
        detail: 'Stripe payment projection',
        owner: 'Payment',
        status: '正常',
        freshness: '今天 09:42',
        meta: [
          ['金额', '$12,480'],
          ['订单', 'ORD-77281'],
          ['发票', 'INV-2026-0924']
        ]
      },
      {
        id: 'PAY-9274',
        name: 'Global Brand · MarkReg 服务',
        detail: 'MarkReg order / Payment status',
        owner: 'MarkReg / Payment',
        status: '待审核',
        freshness: '今天 08:15',
        meta: [
          ['金额', '$2,860'],
          ['状态', 'Payment pending'],
          ['履约', '不由付款推断']
        ]
      },
      {
        id: 'DSP-106',
        name: 'Sunrise Trading · 争议',
        detail: 'Payment dispute projection',
        owner: 'Payment',
        status: '需关注',
        freshness: '昨天 16:30',
        meta: [
          ['金额', '$680'],
          ['响应期限', '3 天'],
          ['证据', '待补充']
        ]
      }
    ],
    governance: [
      {
        id: 'AUD-44281',
        name: 'API 限流策略更新',
        detail: 'Sarah Chen · Internal Operator',
        owner: 'Integration owner',
        status: '正常',
        freshness: '今天 10:24',
        meta: [
          ['策略', 'RATE-LIMIT-12'],
          ['结果', 'Owner accepted'],
          ['来源', '192.0.2.14']
        ]
      },
      {
        id: 'AUD-44276',
        name: '高风险登录已阻断',
        detail: 'Unknown principal · revoked session',
        owner: 'Core',
        status: '需关注',
        freshness: '今天 09:18',
        meta: [
          ['策略', 'LOGIN-RISK-04'],
          ['结果', 'Blocked'],
          ['来源', '198.51.100.7']
        ]
      },
      {
        id: 'AUD-44264',
        name: 'Knowledge 读取授权检查',
        detail: 'Mike Wang · Workspace Admin',
        owner: 'Core / Knowledge',
        status: '正常',
        freshness: '今天 08:45',
        meta: [
          ['能力', 'knowledge:read'],
          ['结果', 'Allowed'],
          ['Workspace', 'WSP-ACME']
        ]
      }
    ]
  };
  return records[module];
};

export const demoRecords = shared;

export const moduleMetrics: Record<ModuleId, readonly [string, string, string][]> = {
  overview: [
    ['已连接 owner', '8', '2 个部分可用'],
    ['待处理事项', '12', '3 个高优先级'],
    ['今日执行', '1,286', '99.2% owner 成功'],
    ['安全事件', '3', '全部已隔离']
  ],
  workspaces: [
    ['Workspace', '128', '+12 本月'],
    ['活跃成员', '8,542', '跨 11 个地区'],
    ['配额预警', '7', '2 个需处理'],
    ['启用站点', '246', '98.7% 可用']
  ],
  users: [
    ['总用户', '8,542', 'Owner projection'],
    ['Internal Operator', '6', '全部 MFA'],
    ['跨组织关系', '428', '明确关系'],
    ['登录风险', '12', '3 个待审核']
  ],
  products: [
    ['产品面', '5', '独立 owner'],
    ['全局模块', '28', '24 已开启'],
    ['版本候选', '3', '等待评审'],
    ['健康异常', '1', 'Trading 部分可用']
  ],
  data: [
    ['国家 / 地区', '38', 'Owner coverage'],
    ['数据源', '48', '43 正常'],
    ['运行任务', '156', '12 需关注'],
    ['数据新鲜度', '99.2%', '不含不可用源']
  ],
  knowledge: [
    ['来源', '48', '6 个需刷新'],
    ['今日证据', '12,842', 'Owner supplied'],
    ['审核队列', '18', '4 个高优先级'],
    ['Ready Package', '132', '96% 新鲜']
  ],
  brain: [
    ['模型路由', '6', '1 条降级'],
    ['编排策略', '24', '3 个候选'],
    ['本月调用', '1.2M', '98.6% 成功'],
    ['演示成本', '$86.4K', '非账单事实']
  ],
  capabilities: [
    ['能力契约', '36', '28 已接纳'],
    ['Skills', '28', '4 个评估中'],
    ['实现 Profiles', '42', '3 个需复核'],
    ['执行成功', '98.6%', 'Owner observations']
  ],
  integrations: [
    ['外部服务', '12', '8 个 owner'],
    ['API 连接', '48', '2 个降级'],
    ['全局可用', '99.8%', '按影响隔离'],
    ['失败记录', '26', '过去 24h']
  ],
  operations: [
    ['运行任务', '36', '12 进行中'],
    ['队列', '8', '最长 4m'],
    ['Workers', '12', '3 个繁忙'],
    ['失败执行', '3', '尚未自动恢复']
  ],
  billing: [
    ['演示月收入', '$48,320', '非真实账本'],
    ['订单', '328', 'Owner projection'],
    ['待支付', '12', '不代表履约'],
    ['支付成功', '98%', '按 Payment 状态']
  ],
  governance: [
    ['今日审计', '428', 'Owner events'],
    ['安全告警', '3', '全部已隔离'],
    ['高风险操作', '2', '等待复核'],
    ['合规检查', '100%', '演示状态']
  ]
};
