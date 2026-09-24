import { useEffect, useMemo, useState } from 'react';
import type { ModuleId } from './catalog.js';

export const BATCH_B_PAGE_IDS = {
  workspaces: ['directory', 'plans', 'members', 'quotas', 'products', 'sites', 'audit'],
  users: ['directory', 'roles', 'relationships', 'invitations', 'security', 'activity'],
  products: ['portfolio', 'switches', 'entitlements', 'usage', 'features', 'releases']
} as const;

type BatchBModule = Extract<ModuleId, 'workspaces' | 'users' | 'products'>;
type OrgVariant =
  | 'org-directory'
  | 'subscription'
  | 'people'
  | 'quota'
  | 'enablement'
  | 'sites'
  | 'audit'
  | 'identity'
  | 'roles'
  | 'relationships'
  | 'invitations'
  | 'security'
  | 'activity'
  | 'portfolio'
  | 'availability'
  | 'entitlements'
  | 'usage'
  | 'features'
  | 'releases';

interface OrgObject {
  id: string;
  name: string;
  kind: string;
  status: string;
  meta: string;
  fields: readonly (readonly [string, string])[];
  related: readonly string[];
}

interface OrgPage {
  eyebrow: string;
  title: string;
  description: string;
  objectLabel: string;
  variant: OrgVariant;
  facts: readonly (readonly [string, string, string])[];
  action: string;
  protected?: boolean;
  objects: readonly OrgObject[];
}

interface OrganizationPagesProps {
  moduleId: BatchBModule;
  pageId: string;
  query: string;
  setQuery: (value: string) => void;
  onAction: (label: string, protectedAction?: boolean) => void;
}

const o = (
  id: string,
  name: string,
  kind: string,
  status: string,
  meta: string,
  fields: readonly (readonly [string, string])[],
  related: readonly string[]
): OrgObject => ({ id, name, kind, status, meta, fields, related });

const pages: Record<BatchBModule, Record<string, OrgPage>> = {
  workspaces: {
    directory: {
      eyebrow: 'ORGANIZATION DIRECTORY',
      title: 'Workspace 目录',
      description: '按组织类型、地区、订阅和生命周期管理 Workspace，并进入统一组织档案。',
      objectLabel: 'Workspace',
      variant: 'org-directory',
      action: '创建 Workspace 草案',
      protected: true,
      facts: [
        ['Workspace', '128', 'Core owner'],
        ['活跃', '119', '93%'],
        ['待审核', '4', '需内部处理'],
        ['已归档', '5', '保留审计']
      ],
      objects: [
        o(
          'WSP-ACME',
          'Acme IP',
          'IP Agency',
          '活跃',
          'Singapore · Scale',
          [
            ['法人名称', 'Acme IP Pte. Ltd.'],
            ['成员', '186'],
            ['站点', '3'],
            ['最近活动', '2 分钟前']
          ],
          ['Subscription SUB-ACME', '186 memberships', '3 sites']
        ),
        o(
          'WSP-SUNRISE',
          'Sunrise Trading',
          'Brand owner',
          '活跃',
          'United States · Pro',
          [
            ['法人名称', 'Sunrise Trading LLC'],
            ['成员', '26'],
            ['站点', '1'],
            ['最近活动', '12 分钟前']
          ],
          ['Subscription SUB-SUN', '26 memberships', '1 site']
        ),
        o(
          'WSP-GLOBAL',
          'Global Brand LLC',
          'IP Agency',
          '需关注',
          'United Kingdom · Scale',
          [
            ['法人名称', 'Global Brand LLC'],
            ['成员', '58'],
            ['站点', '4'],
            ['配额', '92%']
          ],
          ['Subscription SUB-GB', '58 memberships', '4 sites']
        )
      ]
    },
    plans: {
      eyebrow: 'SUBSCRIPTION LIFECYCLE',
      title: '订阅与套餐',
      description:
        '查看订阅 owner 状态、续订窗口、套餐权益和变更历史；不在 UI 建立第二份订阅账本。',
      objectLabel: '订阅',
      variant: 'subscription',
      action: '发起套餐变更',
      protected: true,
      facts: [
        ['有效订阅', '126', 'Billing owner'],
        ['续订窗口', '8', '30 天内'],
        ['逾期', '2', '不自动停权'],
        ['变更待生效', '3', '有版本']
      ],
      objects: [
        o(
          'SUB-ACME',
          'Acme IP · Scale',
          'Annual',
          '有效',
          '2026-12-01 renew',
          [
            ['套餐', 'Scale'],
            ['周期', '$48,320 / year'],
            ['支付状态', '由 Payment owner 提供'],
            ['版本', 'v8']
          ],
          ['Workspace WSP-ACME', 'Entitlement set ENT-SCALE', 'Order ORD-8821']
        ),
        o(
          'SUB-SUN',
          'Sunrise · Pro',
          'Monthly',
          '续订窗口',
          '2026-10-02 renew',
          [
            ['套餐', 'Pro'],
            ['周期', '$2,480 / month'],
            ['使用上限', '72%'],
            ['版本', 'v4']
          ],
          ['Workspace WSP-SUNRISE', 'Entitlement set ENT-PRO', 'Order ORD-9012']
        ),
        o(
          'SUB-GB',
          'Global Brand · Scale',
          'Annual',
          '付款待确认',
          'Owner projection delayed',
          [
            ['套餐', 'Scale'],
            ['到期', '2026-09-30'],
            ['财务状态', '不可由 Core 推断'],
            ['版本', 'v6']
          ],
          ['Workspace WSP-GLOBAL', 'Payment owner projection', 'No automatic suspension']
        )
      ]
    },
    members: {
      eyebrow: 'WORKSPACE MEMBERSHIP',
      title: '成员概况',
      description:
        '成员关系由 Core 持有；同一身份可属于多个 Workspace，但每条 Membership 独立授权。',
      objectLabel: '成员关系',
      variant: 'people',
      action: '邀请 Workspace 成员',
      protected: true,
      facts: [
        ['成员关系', '3,218', '非用户副本'],
        ['活跃', '3,104', '96%'],
        ['待接受', '86', 'Invitation'],
        ['暂停', '28', '保留关系']
      ],
      objects: [
        o(
          'MEM-ACME-SC',
          'Sarah Chen',
          'Owner',
          '活跃',
          'Acme IP · since 2024',
          [
            ['用户', 'USR-1008'],
            ['Workspace', 'WSP-ACME'],
            ['角色', 'Owner'],
            ['MFA', '已启用']
          ],
          ['Identity USR-1008', 'Workspace WSP-ACME', 'Role assignment RA-118']
        ),
        o(
          'MEM-ACME-MW',
          'Mike Wang',
          'Admin',
          '活跃',
          'Acme IP · since 2025',
          [
            ['用户', 'USR-1021'],
            ['Workspace', 'WSP-ACME'],
            ['角色', 'Admin'],
            ['MFA', '已启用']
          ],
          ['Identity USR-1021', 'Workspace WSP-ACME', 'Role assignment RA-126']
        ),
        o(
          'MEM-SUN-LZ',
          'Lisa Zhang',
          'Member',
          '需关注',
          'Sunrise · MFA missing',
          [
            ['用户', 'USR-1142'],
            ['Workspace', 'WSP-SUNRISE'],
            ['角色', 'Lite User'],
            ['MFA', '未启用']
          ],
          ['Identity USR-1142', 'Workspace WSP-SUNRISE', 'Security finding SEC-221']
        )
      ]
    },
    quotas: {
      eyebrow: 'RESOURCE ENVELOPES',
      title: '资源配额',
      description: '分别展示套餐上限、Workspace 分配、已使用和保留量；调整需要版本检查。',
      objectLabel: '配额',
      variant: 'quota',
      action: '提交配额调整',
      protected: true,
      facts: [
        ['配额对象', '512', '4 类资源'],
        ['接近阈值', '12', '> 80%'],
        ['超额保护', '3', '写入已限制'],
        ['待调整', '6', 'Owner review']
      ],
      objects: [
        o(
          'QUO-GB-STO',
          'Global Brand storage',
          'Storage',
          '92%',
          '9.2 / 10 TB',
          [
            ['套餐上限', '10 TB'],
            ['Workspace 分配', '10 TB'],
            ['已使用', '9.2 TB'],
            ['保留', '0.4 TB']
          ],
          ['Plan Scale', 'Workspace allocation', 'Storage meter']
        ),
        o(
          'QUO-ACME-AI',
          'Acme AI tokens',
          'Brain tokens',
          '68%',
          '68M / 100M',
          [
            ['套餐上限', '100M'],
            ['Workspace 分配', '100M'],
            ['已使用', '68M'],
            ['重置', '2026-10-01']
          ],
          ['Plan Scale', 'Brain entitlement', 'Usage meter']
        ),
        o(
          'QUO-SUN-API',
          'Sunrise API calls',
          'API calls',
          '74%',
          '740K / 1M',
          [
            ['套餐上限', '1M'],
            ['Workspace 分配', '1M'],
            ['已使用', '740K'],
            ['保留', '20K']
          ],
          ['Plan Pro', 'Integration entitlement', 'Gateway meter']
        )
      ]
    },
    products: {
      eyebrow: 'WORKSPACE PRODUCT ENABLEMENT',
      title: '产品启用',
      description: '展示 Workspace 对产品的权益、配置与健康；不替代产品全局发布状态。',
      objectLabel: '产品启用关系',
      variant: 'enablement',
      action: '审阅产品启用变更',
      protected: true,
      facts: [
        ['启用关系', '384', 'Workspace scoped'],
        ['有权益', '402', 'Plan entitlement'],
        ['已配置', '376', 'Local config'],
        ['运行降级', '4', 'Product owner']
      ],
      objects: [
        o(
          'WPE-ACME-LITE',
          'Acme IP · Lite',
          'Product enablement',
          '运行正常',
          'Entitled + enabled',
          [
            ['全局发布', 'GA'],
            ['套餐权益', '包含'],
            ['Workspace 配置', '启用'],
            ['实际健康', '正常']
          ],
          ['Product Lite', 'Entitlement ENT-SCALE-LITE', 'Workspace WSP-ACME']
        ),
        o(
          'WPE-GB-SITE',
          'Global Brand · Site',
          'Product enablement',
          '运行降级',
          'Entitled + enabled',
          [
            ['全局发布', 'GA'],
            ['套餐权益', '包含'],
            ['Workspace 配置', '启用'],
            ['实际健康', '部分可用']
          ],
          ['Product Site', 'Entitlement ENT-SCALE-SITE', 'Site owner health']
        ),
        o(
          'WPE-SUN-BRAIN',
          'Sunrise · Brain Pro',
          'Product enablement',
          '未启用',
          'Entitled, config off',
          [
            ['全局发布', 'GA'],
            ['套餐权益', '包含'],
            ['Workspace 配置', '关闭'],
            ['实际健康', '未探测']
          ],
          ['Product Brain', 'Entitlement ENT-PRO-BRAIN', 'Workspace WSP-SUNRISE']
        )
      ]
    },
    sites: {
      eyebrow: 'WORKSPACE SITE ESTATE',
      title: '站点',
      description: '管理 Workspace 拥有的站点关系、域名、发布状态和内容 owner 健康。',
      objectLabel: '站点',
      variant: 'sites',
      action: '创建站点草案',
      protected: true,
      facts: [
        ['站点', '246', '96 Workspace'],
        ['已发布', '224', 'Site owner'],
        ['草稿', '18', '未公开'],
        ['域名异常', '4', '需处理']
      ],
      objects: [
        o(
          'SITE-ACME-COM',
          'acmeip.com',
          'Brand site',
          '已发布',
          'Acme IP · en/zh',
          [
            ['Workspace', 'WSP-ACME'],
            ['域名', 'acmeip.com'],
            ['SSL', '有效至 2027-02'],
            ['最近发布', '3 小时前']
          ],
          ['Workspace WSP-ACME', 'Site project SP-118', 'Domain binding DOM-88']
        ),
        o(
          'SITE-SUN-COM',
          'sunrisetrading.com',
          'Corporate site',
          '域名异常',
          'Sunrise · en',
          [
            ['Workspace', 'WSP-SUNRISE'],
            ['域名', 'sunrisetrading.com'],
            ['SSL', '7 天后到期'],
            ['最近发布', '2 天前']
          ],
          ['Workspace WSP-SUNRISE', 'Site project SP-201', 'Domain binding DOM-94']
        ),
        o(
          'SITE-GB-CN',
          'cn.globalbrand.com',
          'Regional site',
          '草稿',
          'Global Brand · zh-CN',
          [
            ['Workspace', 'WSP-GLOBAL'],
            ['域名', '未绑定'],
            ['内容', '42 pages'],
            ['发布', '从未']
          ],
          ['Workspace WSP-GLOBAL', 'Site project SP-244', 'No domain binding']
        )
      ]
    },
    audit: {
      eyebrow: 'WORKSPACE AUDIT TRAIL',
      title: 'Workspace 审计',
      description: '关联组织、成员、套餐、资源和产品变更，记录 actor、原因和版本。',
      objectLabel: 'Workspace 审计事件',
      variant: 'audit',
      action: '导出演示审计片段',
      facts: [
        ['事件', '8,542', '90 天'],
        ['高风险', '12', '已复核 9'],
        ['成员变更', '328', '最多'],
        ['保留', '365d', 'Core policy']
      ],
      objects: [
        o(
          'AUD-W-8821',
          'Role changed: Mike Wang',
          'Membership',
          '高风险',
          '10:24 · Sarah Chen',
          [
            ['Workspace', 'WSP-ACME'],
            ['变更', 'Member → Admin'],
            ['原因', 'Operations lead'],
            ['版本', 'membership v12']
          ],
          ['Actor USR-1008', 'Membership MEM-ACME-MW', 'Role RA-126']
        ),
        o(
          'AUD-W-8818',
          'Quota change requested',
          'Resource',
          '待审核',
          '09:42 · James Kim',
          [
            ['Workspace', 'WSP-GLOBAL'],
            ['资源', 'Storage'],
            ['变更', '10 TB → 14 TB'],
            ['状态', '未执行']
          ],
          ['Actor USR-1208', 'Quota QUO-GB-STO', 'Approval request APR-18']
        ),
        o(
          'AUD-W-8811',
          'Site published',
          'Site',
          '正常',
          '08:18 · Lisa Zhou',
          [
            ['Workspace', 'WSP-ACME'],
            ['站点', 'SITE-ACME-COM'],
            ['版本', 'release 184'],
            ['结果', 'Owner receipt']
          ],
          ['Actor USR-1148', 'Site release 184', 'Receipt rcpt-991']
        )
      ]
    }
  },
  users: {
    directory: {
      eyebrow: 'IDENTITY DIRECTORY',
      title: '全部用户',
      description:
        '以全局身份为入口查看 Workspace Membership、角色和安全状态，不复制 Workspace 真相。',
      objectLabel: '身份',
      variant: 'identity',
      action: '创建内部用户邀请',
      protected: true,
      facts: [
        ['身份', '8,542', 'Core owner'],
        ['活跃', '8,118', '95%'],
        ['MFA 已启用', '7,804', '91%'],
        ['风险会话', '3', '已隔离']
      ],
      objects: [
        o(
          'USR-1008',
          'Sarah Chen',
          'Human identity',
          '正常',
          'sarah@acmeip.com',
          [
            ['身份状态', 'Active'],
            ['Workspace', '2'],
            ['Membership', '3'],
            ['MFA', 'WebAuthn + TOTP']
          ],
          ['WSP-ACME · Owner', 'WSP-LABS · Reviewer', 'Internal Operator']
        ),
        o(
          'USR-1021',
          'Mike Wang',
          'Human identity',
          '正常',
          'mike@acmeip.com',
          [
            ['身份状态', 'Active'],
            ['Workspace', '1'],
            ['Membership', '1'],
            ['MFA', 'TOTP']
          ],
          ['WSP-ACME · Admin', 'Role RA-126', '2 active sessions']
        ),
        o(
          'USR-1142',
          'Lisa Zhang',
          'Human identity',
          '需关注',
          'lisa@sunrise.com',
          [
            ['身份状态', 'Active'],
            ['Workspace', '2'],
            ['Membership', '2'],
            ['MFA', '未启用']
          ],
          ['WSP-SUNRISE · Lite User', 'WSP-COMMUNITY · Viewer', 'Security finding SEC-221']
        )
      ]
    },
    roles: {
      eyebrow: 'ROLE AND PERMISSION SETS',
      title: '角色与权限',
      description: '查看角色定义、授权范围和使用关系；权限来自 owner policy，不从 UI 名称推断。',
      objectLabel: '角色',
      variant: 'roles',
      action: '创建角色草案',
      protected: true,
      facts: [
        ['角色', '126', '含系统角色'],
        ['自定义', '82', 'Workspace scoped'],
        ['高权限', '8', '季度复核'],
        ['孤立角色', '3', '无成员']
      ],
      objects: [
        o(
          'ROLE-OWNER',
          'Workspace Owner',
          'System role',
          '受保护',
          '126 assignments',
          [
            ['范围', 'Single Workspace'],
            ['权限', '28 capabilities'],
            ['可委派', 'Admin, Member'],
            ['复核', '2026-10-01']
          ],
          ['Membership assignments', 'Permission set PS-OWNER', 'Audit policy']
        ),
        o(
          'ROLE-IP-ADMIN',
          'IP Operations Admin',
          'Custom role',
          '活跃',
          'Acme IP · 8 assignments',
          [
            ['范围', 'WSP-ACME'],
            ['权限', '12 capabilities'],
            ['创建者', 'Sarah Chen'],
            ['版本', 'v6']
          ],
          ['Workspace WSP-ACME', 'Permission set PS-IP-OPS', '8 assignments']
        ),
        o(
          'ROLE-BILLING',
          'Billing Manager',
          'System role',
          '高权限',
          '18 assignments',
          [
            ['范围', 'Workspace billing'],
            ['权限', 'billing.read, invoice.manage'],
            ['支付权限', '不含 ledger mutation'],
            ['复核', '待 2 人']
          ],
          ['Permission set PS-BILL', '18 assignments', 'Quarterly review']
        )
      ]
    },
    relationships: {
      eyebrow: 'IDENTITY RELATIONSHIP GRAPH',
      title: '组织关系',
      description: '将身份、Workspace、Membership 和角色作为独立对象展示其关系。',
      objectLabel: '关系边',
      variant: 'relationships',
      action: '审阅关系变更',
      protected: true,
      facts: [
        ['Membership', '3,218', 'Core durable'],
        ['多 Workspace 用户', '428', '关系独立'],
        ['暂停关系', '28', '身份仍存在'],
        ['冲突候选', '6', '待复核']
      ],
      objects: [
        o(
          'REL-1008-ACME',
          'Sarah Chen → Acme IP',
          'Owner membership',
          '活跃',
          'since 2024-06',
          [
            ['Identity', 'USR-1008'],
            ['Workspace', 'WSP-ACME'],
            ['Membership', 'MEM-ACME-SC'],
            ['Role', 'ROLE-OWNER']
          ],
          ['USR-1008', 'MEM-ACME-SC', 'WSP-ACME', 'ROLE-OWNER']
        ),
        o(
          'REL-1008-LABS',
          'Sarah Chen → MO Labs',
          'Reviewer membership',
          '活跃',
          'expires 2026-12',
          [
            ['Identity', 'USR-1008'],
            ['Workspace', 'WSP-LABS'],
            ['Membership', 'MEM-LABS-SC'],
            ['Role', 'Reviewer']
          ],
          ['USR-1008', 'MEM-LABS-SC', 'WSP-LABS', 'ROLE-REVIEWER']
        ),
        o(
          'REL-1142-SUN',
          'Lisa Zhang → Sunrise',
          'Lite membership',
          '需关注',
          'MFA policy mismatch',
          [
            ['Identity', 'USR-1142'],
            ['Workspace', 'WSP-SUNRISE'],
            ['Membership', 'MEM-SUN-LZ'],
            ['Role', 'Lite User']
          ],
          ['USR-1142', 'MEM-SUN-LZ', 'WSP-SUNRISE', 'SEC-221']
        )
      ]
    },
    invitations: {
      eyebrow: 'INVITATION LIFECYCLE',
      title: '邀请',
      description:
        '追踪邀请目标、Workspace、预期角色、有效期和接受结果，避免提前创建正式 Membership。',
      objectLabel: '邀请',
      variant: 'invitations',
      action: '创建邀请',
      protected: true,
      facts: [
        ['待接受', '86', '不等于成员'],
        ['即将过期', '12', '48 小时内'],
        ['已接受', '418', '本月'],
        ['已撤销', '8', '保留审计']
      ],
      objects: [
        o(
          'INV-8821',
          'anna@acmeip.com',
          'Workspace invite',
          '待接受',
          'WSP-ACME · Member',
          [
            ['邀请人', 'Sarah Chen'],
            ['预期角色', 'Member'],
            ['有效期', '2026-09-28'],
            ['Membership', '尚未创建']
          ],
          ['Workspace WSP-ACME', 'Role intent Member', 'Email delivery receipt']
        ),
        o(
          'INV-8814',
          'tom@globalbrand.com',
          'Workspace invite',
          '即将过期',
          'WSP-GLOBAL · Admin',
          [
            ['邀请人', 'James Kim'],
            ['预期角色', 'Admin'],
            ['有效期', '18 小时'],
            ['Membership', '尚未创建']
          ],
          ['Workspace WSP-GLOBAL', 'Role intent Admin', 'Reminder sent']
        ),
        o(
          'INV-8798',
          'legal@sunrise.com',
          'Workspace invite',
          '已接受',
          'WSP-SUNRISE · Viewer',
          [
            ['邀请人', 'Mike Wang'],
            ['接受时间', '2026-09-21'],
            ['Membership', 'MEM-SUN-LEGAL'],
            ['版本', 'v1']
          ],
          ['Invitation receipt', 'Identity USR-1288', 'Membership MEM-SUN-LEGAL']
        )
      ]
    },
    security: {
      eyebrow: 'IDENTITY SECURITY',
      title: '登录与安全',
      description: '从身份进入 MFA、会话、设备和风险事件；风险动作必须精确授权。',
      objectLabel: '安全主体',
      variant: 'security',
      action: '发起会话撤销',
      protected: true,
      facts: [
        ['活跃会话', '4,981', 'Core sessions'],
        ['MFA 缺失', '738', '按策略'],
        ['风险会话', '3', '已隔离'],
        ['受信设备', '6,214', '90 天']
      ],
      objects: [
        o(
          'SEC-USR-1142',
          'Lisa Zhang',
          'MFA policy',
          '需关注',
          'No MFA · 2 sessions',
          [
            ['身份', 'USR-1142'],
            ['MFA', '未配置'],
            ['会话', '2 active'],
            ['最近登录', '1 小时前']
          ],
          ['Identity USR-1142', 'Sessions SES-88/89', 'Policy MFA-WSP-02']
        ),
        o(
          'SEC-USR-1301',
          'Unknown travel event',
          'Session risk',
          '已隔离',
          'Singapore → Frankfurt 18m',
          [
            ['身份', 'USR-1301'],
            ['会话', 'SES-2201'],
            ['策略', 'LOGIN-RISK-04'],
            ['处置', 'Session revoked']
          ],
          ['Identity USR-1301', 'Session SES-2201', 'Risk event RSK-1093']
        ),
        o(
          'SEC-USR-1008',
          'Sarah Chen',
          'Strong auth',
          '正常',
          'WebAuthn · 3 devices',
          [
            ['身份', 'USR-1008'],
            ['MFA', 'WebAuthn + TOTP'],
            ['会话', '1 active'],
            ['恢复码', '8 remaining']
          ],
          ['Identity USR-1008', 'Device keys 3', 'Session SES-1008']
        )
      ]
    },
    activity: {
      eyebrow: 'IDENTITY ACTIVITY TRAIL',
      title: '操作记录',
      description: '按用户聚合其跨 Workspace 操作，但事件仍保留对象 owner 与 Workspace 上下文。',
      objectLabel: '用户活动',
      variant: 'activity',
      action: '导出脱敏活动记录',
      facts: [
        ['今日事件', '12,842', '跨 8 owner'],
        ['高风险', '18', '需复核'],
        ['跨 Workspace', '428', '保持上下文'],
        ['保留', '365d', 'Policy']
      ],
      objects: [
        o(
          'ACT-9912',
          'Sarah Chen approved plan',
          'Protected action',
          '已记录',
          '10:42 · WSP-ACME',
          [
            ['Actor', 'USR-1008'],
            ['对象', 'RUN-CN-8821'],
            ['Owner', 'Data Engine'],
            ['结果', 'Demo 中未执行']
          ],
          ['Identity USR-1008', 'Workspace WSP-ACME', 'Audit AUD-9912']
        ),
        o(
          'ACT-9908',
          'Mike Wang changed role',
          'Permission change',
          '高风险',
          '10:24 · WSP-ACME',
          [
            ['Actor', 'USR-1021'],
            ['对象', 'MEM-ACME-LZ'],
            ['Owner', 'Core'],
            ['版本', 'v8 → v9']
          ],
          ['Identity USR-1021', 'Membership MEM-ACME-LZ', 'Audit AUD-9908']
        ),
        o(
          'ACT-9891',
          'Lisa Zhang published site',
          'Site action',
          '成功',
          '09:18 · WSP-SUNRISE',
          [
            ['Actor', 'USR-1142'],
            ['对象', 'SITE-SUN-COM'],
            ['Owner', 'Site'],
            ['Receipt', 'rcpt-118']
          ],
          ['Identity USR-1142', 'Site SITE-SUN-COM', 'Owner receipt rcpt-118']
        )
      ]
    }
  },
  products: {
    portfolio: {
      eyebrow: 'PRODUCT PORTFOLIO',
      title: '产品总览',
      description: '分别呈现发布状态、全局可用性、权益覆盖、Workspace 启用和 owner 健康。',
      objectLabel: '产品',
      variant: 'portfolio',
      action: '创建产品发布草案',
      protected: true,
      facts: [
        ['产品', '6', 'Product owners'],
        ['GA', '4', '正式发布'],
        ['Preview', '2', '受限开放'],
        ['健康异常', '1', 'Trading']
      ],
      objects: [
        o(
          'PRD-LITE',
          'MarkOrbit Lite',
          'AI workbench',
          'GA',
          'v2.8 · 96 Workspace',
          [
            ['发布状态', 'GA v2.8'],
            ['全局可用', 'Allowed'],
            ['权益覆盖', '96 Workspace'],
            ['Owner 健康', '正常']
          ],
          ['Release REL-LITE-280', 'Entitlement matrix ENT-LITE', 'Lite owner health']
        ),
        o(
          'PRD-SITE',
          'Site',
          'Client-facing sites',
          'GA',
          'v1.9 · 86 Workspace',
          [
            ['发布状态', 'GA v1.9'],
            ['全局可用', 'Allowed'],
            ['权益覆盖', '86 Workspace'],
            ['Owner 健康', '正常']
          ],
          ['Release REL-SITE-192', 'Entitlement matrix ENT-SITE', 'Site owner health']
        ),
        o(
          'PRD-TRADING',
          'Trading',
          'Trademark marketplace',
          'Preview',
          'v0.8 · 12 Workspace',
          [
            ['发布状态', 'Preview v0.8'],
            ['全局可用', 'Allowlist'],
            ['权益覆盖', '12 Workspace'],
            ['Owner 健康', '降级']
          ],
          ['Release REL-TRD-080', 'Allowlist AL-TRD', 'Trading owner health']
        )
      ]
    },
    switches: {
      eyebrow: 'GLOBAL AVAILABILITY POLICY',
      title: '模块启停',
      description: '这里只管理产品级全局可用策略，不替代套餐权益、Workspace 配置或运行健康。',
      objectLabel: '全局可用策略',
      variant: 'availability',
      action: '审阅全局策略变更',
      protected: true,
      facts: [
        ['Allowed', '4', '全局策略'],
        ['Allowlist', '2', 'Preview'],
        ['Blocked', '0', '无紧急停用'],
        ['待变更', '1', '双人复核']
      ],
      objects: [
        o(
          'AVL-LITE',
          'Lite global availability',
          'Global policy',
          'Allowed',
          'v12 · since 2026-08',
          [
            ['发布', 'GA'],
            ['策略', 'Allowed'],
            ['套餐权益', '不在此对象'],
            ['健康', '不在此对象']
          ],
          ['Product PRD-LITE', 'Policy version v12', 'Audit trail']
        ),
        o(
          'AVL-TRADING',
          'Trading global availability',
          'Global policy',
          'Allowlist',
          '12 Workspace',
          [
            ['发布', 'Preview'],
            ['策略', 'Allowlist'],
            ['允许列表', 'AL-TRD'],
            ['健康', '由 Trading owner']
          ],
          ['Product PRD-TRADING', 'Allowlist AL-TRD', 'Policy version v4']
        ),
        o(
          'AVL-BRAIN-PRO',
          'Brain Pro availability',
          'Global policy',
          'Allowed',
          'v6 · region limited',
          [
            ['发布', 'GA'],
            ['策略', 'Allowed in 8 regions'],
            ['限制', 'Export controls'],
            ['健康', '由 Brain owner']
          ],
          ['Product PRD-BRAIN', 'Region policy RP-08', 'Policy version v6']
        )
      ]
    },
    entitlements: {
      eyebrow: 'PLAN ENTITLEMENT MATRIX',
      title: '套餐与权益',
      description: '套餐声明可获得的产品与功能范围；实际启用仍由 Workspace 配置决定。',
      objectLabel: '权益规则',
      variant: 'entitlements',
      action: '创建权益版本草案',
      protected: true,
      facts: [
        ['权益规则', '48', '版本化'],
        ['套餐', '4', 'Billing catalog'],
        ['产品', '6', 'Product IDs'],
        ['待生效版本', '2', '未来日期']
      ],
      objects: [
        o(
          'ENT-SCALE-LITE',
          'Scale → Lite Pro',
          'Product entitlement',
          'Included',
          'v8 · effective now',
          [
            ['套餐', 'Scale'],
            ['产品', 'Lite'],
            ['级别', 'Pro'],
            ['Workspace 启用', '另行配置']
          ],
          ['Plan PLAN-SCALE', 'Product PRD-LITE', 'Feature set FS-LITE-PRO']
        ),
        o(
          'ENT-PRO-SITE',
          'Pro → Site',
          'Product entitlement',
          'Included',
          'v4 · limits 3 sites',
          [
            ['套餐', 'Pro'],
            ['产品', 'Site'],
            ['限制', '3 sites'],
            ['Workspace 启用', '另行配置']
          ],
          ['Plan PLAN-PRO', 'Product PRD-SITE', 'Quota SITE=3']
        ),
        o(
          'ENT-START-BRAIN',
          'Starter → Brain',
          'Product entitlement',
          'Not included',
          'upgrade required',
          [
            ['套餐', 'Starter'],
            ['产品', 'Brain Pro'],
            ['状态', 'Excluded'],
            ['替代', 'Lite AI basic']
          ],
          ['Plan PLAN-STARTER', 'Product PRD-BRAIN', 'Alternative FS-LITE-AI']
        )
      ]
    },
    usage: {
      eyebrow: 'PRODUCT USAGE',
      title: '使用情况',
      description: '按产品展示 owner 计量和 Workspace 分布，不从用量推断支付或合同状态。',
      objectLabel: '产品用量',
      variant: 'usage',
      action: '导出演示产品用量',
      facts: [
        ['活跃产品关系', '384', 'Workspace enabled'],
        ['月活用户', '8,542', '去重身份'],
        ['调用', '1.2M', 'Owner metering'],
        ['财务状态', '—', '不推断']
      ],
      objects: [
        o(
          'USE-LITE',
          'Lite monthly usage',
          'Product meter',
          '68%',
          '96 Workspace',
          [
            ['月活用户', '7,862'],
            ['AI 调用', '842K'],
            ['配额使用', '68%'],
            ['账单', '由 Billing owner']
          ],
          ['Product PRD-LITE', 'Workspace usage aggregates', 'Lite meter receipts']
        ),
        o(
          'USE-SITE',
          'Site monthly usage',
          'Product meter',
          '42%',
          '86 Workspace',
          [
            ['站点', '246'],
            ['表单', '18,420'],
            ['带宽', '12.8 TB'],
            ['账单', '由 Billing owner']
          ],
          ['Product PRD-SITE', 'Site meter receipts', 'Workspace allocations']
        ),
        o(
          'USE-BRAIN',
          'Brain Pro usage',
          'Product meter',
          '74%',
          '42 Workspace',
          [
            ['Tokens', '84M'],
            ['Runs', '128K'],
            ['预算', '74%'],
            ['成本', '$6,420 estimate']
          ],
          ['Product PRD-BRAIN', 'Brain usage owner', 'Not financial ledger']
        )
      ]
    },
    features: {
      eyebrow: 'FEATURE CONFIGURATION',
      title: '功能配置',
      description: '功能定义、发布阶段和允许配置分层；Workspace 值保留 owner 和版本。',
      objectLabel: '功能',
      variant: 'features',
      action: '创建功能配置草案',
      protected: true,
      facts: [
        ['功能', '86', '6 个产品'],
        ['GA', '68', '稳定'],
        ['Beta', '12', '受限'],
        ['Deprecated', '6', '有迁移路径']
      ],
      objects: [
        o(
          'FEAT-LITE-AI',
          'AI Assistant',
          'Lite feature',
          'GA',
          'v18 · configurable',
          [
            ['产品', 'Lite'],
            ['发布阶段', 'GA'],
            ['默认', 'Enabled'],
            ['Workspace override', 'Allowed']
          ],
          ['Product PRD-LITE', 'Feature version v18', 'Workspace overrides 18']
        ),
        o(
          'FEAT-SITE-FORM',
          'Advanced forms',
          'Site feature',
          'Beta',
          'v4 · allowlist',
          [
            ['产品', 'Site'],
            ['发布阶段', 'Beta'],
            ['默认', 'Disabled'],
            ['Workspace override', 'Allowlist only']
          ],
          ['Product PRD-SITE', 'Feature version v4', 'Allowlist 12']
        ),
        o(
          'FEAT-TRD-MATCH',
          'Buyer matching',
          'Trading feature',
          'Deprecated',
          'sunset 2026-12',
          [
            ['产品', 'Trading'],
            ['发布阶段', 'Deprecated'],
            ['替代', 'Opportunity matching v2'],
            ['迁移', '68%']
          ],
          ['Product PRD-TRADING', 'Migration MIG-18', 'Replacement FEAT-TRD-OPP']
        )
      ]
    },
    releases: {
      eyebrow: 'RELEASE LINEAGE',
      title: '版本发布',
      description: '查看产品版本、阶段、变更、回滚条件和 owner 部署证据。',
      objectLabel: '发布版本',
      variant: 'releases',
      action: '创建发布候选',
      protected: true,
      facts: [
        ['当前 GA', '4', 'Product lines'],
        ['候选版本', '3', '验证中'],
        ['分批发布', '2', '按 Workspace'],
        ['回滚就绪', '4', '证据存在']
      ],
      objects: [
        o(
          'REL-LITE-280',
          'Lite 2.8.0',
          'GA release',
          '已发布',
          '2026-09-18 · 100%',
          [
            ['产品', 'PRD-LITE'],
            ['阶段', 'GA'],
            ['覆盖', '96 Workspace'],
            ['回滚点', 'REL-LITE-279']
          ],
          ['Commit 8ae…118', 'Test suite TS-LITE-280', 'Deployment receipt DR-118']
        ),
        o(
          'REL-SITE-200RC',
          'Site 2.0 RC',
          'Release candidate',
          '验证中',
          '12 Workspace canary',
          [
            ['产品', 'PRD-SITE'],
            ['阶段', 'RC'],
            ['覆盖', '12 canary'],
            ['阻断', '2 visual diffs']
          ],
          ['Commit 72b…981', 'Test suite TS-SITE-200', 'Canary group CG-12']
        ),
        o(
          'REL-TRD-081',
          'Trading 0.8.1',
          'Preview release',
          '暂停扩展',
          'health degraded',
          [
            ['产品', 'PRD-TRADING'],
            ['阶段', 'Preview'],
            ['覆盖', '12 allowlist'],
            ['条件', 'owner health recovery']
          ],
          ['Commit 91c…442', 'Test suite TS-TRD-081', 'Health gate HG-TRD']
        )
      ]
    }
  }
};

export function OrganizationPages({
  moduleId,
  pageId,
  query,
  setQuery,
  onAction
}: OrganizationPagesProps) {
  const modulePages = pages[moduleId];
  const page = modulePages[pageId] ?? modulePages[Object.keys(modulePages)[0]!]!;
  const [selectedId, setSelectedId] = useState(page.objects[0]?.id ?? '');
  const [localStatus, setLocalStatus] = useState('全部状态');
  useEffect(() => {
    setSelectedId(page.objects[0]?.id ?? '');
    setLocalStatus('全部状态');
  }, [page]);
  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    return page.objects.filter(
      (item) =>
        (localStatus === '全部状态' || item.status === localStatus) &&
        (!value ||
          `${item.id} ${item.name} ${item.kind} ${item.status}`.toLowerCase().includes(value))
    );
  }, [localStatus, page, query]);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);
  return (
    <section
      className={`sa2-depth sa2-org-page sa2-org-page--${page.variant}`}
      data-testid={`${moduleId}-page-${pageId}`}
    >
      <header className="sa2-depth-head">
        <div>
          <span>{page.eyebrow}</span>
          <h3>{page.title}</h3>
          <p>{page.description}</p>
        </div>
        <button className="sa2-button" onClick={() => onAction(page.action, page.protected)}>
          ＋ {page.action}
        </button>
      </header>
      <div className="sa2-page-facts">
        {page.facts.map((fact) => (
          <article key={fact[0]}>
            <span>{fact[0]}</span>
            <strong>{fact[1]}</strong>
            <small>{fact[2]}</small>
          </article>
        ))}
      </div>
      <OrgCanvas
        variant={page.variant}
        objects={page.objects}
        selectedId={selected?.id}
        onSelect={setSelectedId}
      />
      <div className="sa2-operator-workspace">
        <article className="sa2-depth-card sa2-object-browser">
          <header>
            <div>
              <span>{page.objectLabel.toUpperCase()}</span>
              <h4>{page.objectLabel}列表</h4>
            </div>
            <b>{visible.length} DEMO</b>
          </header>
          <div className="sa2-inline-search">
            <input
              aria-label={`搜索${page.objectLabel}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`搜索 ${page.objectLabel} ID 或名称`}
            />
            <select
              aria-label="状态筛选"
              value={localStatus}
              onChange={(event) => setLocalStatus(event.target.value)}
            >
              <option>全部状态</option>
              {[...new Set(page.objects.map((item) => item.status))].map((status) => (
                <option key={status}>{status}</option>
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
              <u>{item.kind}</u>
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
                <span>SELECTED {page.objectLabel.toUpperCase()}</span>
                <h4>{selected.name}</h4>
              </div>
              <b>{selected.status}</b>
            </header>
            <dl>
              <div>
                <dt>对象 ID</dt>
                <dd>{selected.id}</dd>
              </div>
              {selected.fields.map((field) => (
                <div key={field[0]}>
                  <dt>{field[0]}</dt>
                  <dd>{field[1]}</dd>
                </div>
              ))}
            </dl>
            <h5>真实关系与来源</h5>
            <ol>
              {selected.related.map((relation, index) => (
                <li key={relation}>
                  <span>{index + 1}</span>
                  <b>{relation}</b>
                  {index < selected.related.length - 1 && <i>→</i>}
                </li>
              ))}
            </ol>
            <div className="sa2-callout">
              <b>Owner boundary</b>
              <span>
                此处为 Demo fixture；身份、Workspace、产品、订阅和支付状态仍由各自 owner 持有。
              </span>
            </div>
            <div className="sa2-action-row">
              <button
                className="sa2-button sa2-button--secondary"
                onClick={() => onAction(`查看 ${selected.id} 的 Demo 关系`)}
              >
                查看关系
              </button>
              <button
                className="sa2-button"
                onClick={() => onAction(`${page.action}：${selected.id}`, page.protected)}
              >
                预演主要操作
              </button>
            </div>
          </article>
        ) : (
          <article className="sa2-depth-card sa2-inline-empty">
            <h4>没有匹配的演示对象</h4>
            <p>当前筛选返回 0 条结果；详情和对象操作已清空。</p>
          </article>
        )}
      </div>
    </section>
  );
}

function OrgCanvas({
  variant,
  objects,
  selectedId,
  onSelect
}: {
  variant: OrgVariant;
  objects: readonly OrgObject[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (variant === 'relationships')
    return (
      <article className="sa2-depth-card sa2-org-graph">
        {objects.map((item) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            {item.related.map((node, index) => (
              <span key={node}>
                <i>{index + 1}</i>
                <b>{node}</b>
                {index < item.related.length - 1 && <em>→</em>}
              </span>
            ))}
          </button>
        ))}
      </article>
    );
  if (variant === 'quota' || variant === 'usage')
    return (
      <article className="sa2-depth-card sa2-org-meter">
        {objects.map((item, index) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <span>
              <strong>{item.name}</strong>
              <small>{item.meta}</small>
            </span>
            <i>
              <em style={{ width: `${[92, 68, 74][index]}%` }} />
            </i>
            <b>{item.status}</b>
          </button>
        ))}
      </article>
    );
  if (variant === 'enablement' || variant === 'availability' || variant === 'entitlements')
    return (
      <article className="sa2-depth-card sa2-org-matrix">
        <header>
          <b>对象</b>
          {objects[0]?.fields.map((field) => (
            <b key={field[0]}>{field[0]}</b>
          ))}
        </header>
        {objects.map((item) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <strong>{item.name}</strong>
            {item.fields.map((field) => (
              <span key={field[0]}>{field[1]}</span>
            ))}
          </button>
        ))}
      </article>
    );
  if (variant === 'audit' || variant === 'activity' || variant === 'releases')
    return (
      <article className="sa2-depth-card sa2-org-timeline">
        {objects.map((item, index) => (
          <button
            className={item.id === selectedId ? 'is-active' : ''}
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <time>{['10:42', '10:24', '09:18'][index]}</time>
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
  if (variant === 'roles' || variant === 'security' || variant === 'subscription')
    return (
      <div className="sa2-org-cards">
        {objects.map((item) => (
          <button
            className={item.id === selectedId ? 'is-active' : ''}
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <header>
              <span>{item.kind}</span>
              <u>{item.status}</u>
            </header>
            <strong>{item.name}</strong>
            <small>{item.meta}</small>
            <dl>
              {item.fields.slice(0, 3).map((field) => (
                <div key={field[0]}>
                  <dt>{field[0]}</dt>
                  <dd>{field[1]}</dd>
                </div>
              ))}
            </dl>
          </button>
        ))}
      </div>
    );
  if (variant === 'sites' || variant === 'portfolio' || variant === 'features')
    return (
      <div className="sa2-org-showcase">
        {objects.map((item, index) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <div className={`visual v${index}`}>
              <span>{item.kind.slice(0, 2).toUpperCase()}</span>
            </div>
            <strong>{item.name}</strong>
            <small>{item.meta}</small>
            <u>{item.status}</u>
          </button>
        ))}
      </div>
    );
  if (variant === 'invitations')
    return (
      <article className="sa2-depth-card sa2-org-invites">
        {objects.map((item) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <span>✉</span>
            <div>
              <strong>{item.name}</strong>
              <small>{item.meta}</small>
            </div>
            <time>{item.fields.find((field) => field[0] === '有效期')?.[1] ?? item.status}</time>
            <u>{item.status}</u>
          </button>
        ))}
      </article>
    );
  return (
    <article className="sa2-depth-card sa2-org-directory">
      {objects.map((item, index) => (
        <button
          className={item.id === selectedId ? 'is-active' : ''}
          key={item.id}
          onClick={() => onSelect(item.id)}
        >
          <span>
            {item.name
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)}
          </span>
          <div>
            <strong>{item.name}</strong>
            <small>
              {item.id} · {item.kind}
            </small>
          </div>
          <b>{item.meta}</b>
          <u>{item.status}</u>
          <i style={{ width: `${76 - index * 12}%` }} />
        </button>
      ))}
    </article>
  );
}
