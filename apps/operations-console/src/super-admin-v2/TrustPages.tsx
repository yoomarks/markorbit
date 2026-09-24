import { useEffect, useMemo, useState } from 'react';
import type { ModuleId } from './catalog.js';

export const BATCH_D_PAGE_IDS = {
  billing: ['revenue', 'plans', 'orders', 'payments', 'invoices', 'usage', 'disputes'],
  governance: ['overview', 'audit', 'policies', 'login', 'configuration', 'compliance', 'risk']
} as const;

type BatchDModule = Extract<ModuleId, 'billing' | 'governance'>;
type TrustVariant =
  | 'revenue'
  | 'plans'
  | 'orders'
  | 'payments'
  | 'invoices'
  | 'usage'
  | 'disputes'
  | 'security'
  | 'audit'
  | 'policies'
  | 'login'
  | 'configuration'
  | 'compliance'
  | 'risk';
interface TrustObject {
  id: string;
  name: string;
  kind: string;
  status: string;
  meta: string;
  fields: readonly (readonly [string, string])[];
  trail: readonly string[];
  impact: string;
  permission: string;
}
interface TrustPage {
  eyebrow: string;
  title: string;
  description: string;
  objectLabel: string;
  variant: TrustVariant;
  facts: readonly (readonly [string, string, string])[];
  action: string;
  protected?: boolean;
  objects: readonly TrustObject[];
}
interface TrustPagesProps {
  moduleId: BatchDModule;
  pageId: string;
  query: string;
  setQuery: (value: string) => void;
  onAction: (label: string, protectedAction?: boolean) => void;
}
const t = (
  id: string,
  name: string,
  kind: string,
  status: string,
  meta: string,
  fields: readonly (readonly [string, string])[],
  trail: readonly string[],
  impact: string,
  permission: string
): TrustObject => ({ id, name, kind, status, meta, fields, trail, impact, permission });

const commercial = {
  subscriptions: [
    t(
      'SUB-ACME',
      'Acme IP · Scale annual',
      'Subscription',
      'Active',
      'renews 2026-12-01',
      [
        ['Workspace', 'WSP-ACME'],
        ['Plan', 'Scale'],
        ['Amount', '$48,320 / year'],
        ['Owner version', 'v8']
      ],
      ['Order ORD-8821', 'Payment PAY-4482', 'Subscription active'],
      '96 users retain current entitlements',
      'billing.subscription:manage'
    ),
    t(
      'SUB-SUN',
      'Sunrise · Pro monthly',
      'Subscription',
      'Renewal window',
      'renews 2026-10-02',
      [
        ['Workspace', 'WSP-SUNRISE'],
        ['Plan', 'Pro'],
        ['Amount', '$2,480 / month'],
        ['Owner version', 'v4']
      ],
      ['Order ORD-9012', 'Payment method PM-18', 'Renewal pending'],
      '26 users; no automatic downgrade',
      'billing.subscription:manage'
    ),
    t(
      'SUB-GB',
      'Global Brand · Scale',
      'Subscription',
      'Payment pending',
      'owner projection delayed',
      [
        ['Workspace', 'WSP-GLOBAL'],
        ['Plan', 'Scale'],
        ['Amount', '$42,000 / year'],
        ['Owner status', 'Pending']
      ],
      ['Order ORD-9188', 'Payment owner pending', 'No Core inference'],
      '58 users; access unchanged until owner command',
      'billing.subscription:read'
    )
  ],
  orders: [
    t(
      'ORD-9188',
      'Global Brand renewal',
      'Order',
      'Payment pending',
      '$42,000 · annual',
      [
        ['Workspace', 'WSP-GLOBAL'],
        ['Type', 'Renewal'],
        ['Created', '2026-09-22'],
        ['Version', 'v3']
      ],
      ['Quote Q-881', 'Order created', 'Payment requested'],
      'Subscription remains owner-defined',
      'billing.order:read'
    ),
    t(
      'ORD-9012',
      'Sunrise Pro renewal',
      'Order',
      'Authorized',
      '$2,480 · monthly',
      [
        ['Workspace', 'WSP-SUNRISE'],
        ['Type', 'Renewal'],
        ['Created', '2026-09-20'],
        ['Version', 'v2']
      ],
      ['Order created', 'Payment authorized', 'Capture scheduled'],
      'No entitlement change before completion',
      'billing.order:manage'
    ),
    t(
      'ORD-8821',
      'Acme Scale renewal',
      'Order',
      'Completed',
      '$48,320 · annual',
      [
        ['Workspace', 'WSP-ACME'],
        ['Type', 'Renewal'],
        ['Completed', '2026-09-01'],
        ['Version', 'v6']
      ],
      ['Order created', 'Payment captured', 'Invoice issued', 'Subscription renewed'],
      'Owner receipts reconciled',
      'billing.order:read'
    )
  ],
  payments: [
    t(
      'PAY-4482',
      'Acme annual payment',
      'Payment owner record',
      'Succeeded',
      '$48,320 · Stripe',
      [
        ['Order', 'ORD-8821'],
        ['Provider ref', 'pi_8a…118'],
        ['Captured', '2026-09-01'],
        ['Ledger owner', 'Payment']
      ],
      ['Intent created', 'Authorized', 'Captured', 'Ledger posted'],
      'Funds captured per owner; not performance acceptance',
      'payment.record:read'
    ),
    t(
      'PAY-4518',
      'Global Brand renewal',
      'Payment owner record',
      'Pending',
      '$42,000 · bank transfer',
      [
        ['Order', 'ORD-9188'],
        ['Provider ref', 'bt_92…441'],
        ['Created', '2026-09-22'],
        ['Ledger owner', 'Payment']
      ],
      ['Instruction issued', 'Awaiting bank receipt'],
      'No subscription mutation inferred',
      'payment.record:read'
    ),
    t(
      'PAY-4521',
      'Sunrise renewal auth',
      'Payment owner record',
      'Authorized',
      '$2,480 · Stripe',
      [
        ['Order', 'ORD-9012'],
        ['Provider ref', 'pi_92…881'],
        ['Authorized', '2026-09-23'],
        ['Capture', 'Scheduled']
      ],
      ['Intent created', 'Authorized', 'Capture pending'],
      'Payment authorization is not completion',
      'payment.record:read'
    )
  ]
};
const security = [
  t(
    'RSK-1093',
    'Impossible travel login',
    'Security event',
    'Contained',
    'Singapore → Frankfurt · 18m',
    [
      ['Actor', 'USR-1301'],
      ['Session', 'SES-2201'],
      ['Policy', 'LOGIN-RISK-04'],
      ['Observed', '2026-09-24 09:15']
    ],
    ['Signal received', 'Risk policy matched', 'Session revoked', 'Investigation opened'],
    '1 identity, 1 Workspace; active session revoked',
    'security.investigation:read'
  ),
  t(
    'RSK-1108',
    'Billing role escalation',
    'Risk operation',
    'Needs review',
    'Member → Billing Manager',
    [
      ['Actor', 'USR-1021'],
      ['Target', 'USR-1142'],
      ['Workspace', 'WSP-ACME'],
      ['Policy', 'PRIV-ESC-02']
    ],
    ['Change requested', 'Exact permission check', 'Approval pending'],
    'Would grant invoice management to 1 user',
    'governance.risk:approve'
  ),
  t(
    'RSK-1112',
    'Integration credential export attempt',
    'Security event',
    'Blocked',
    'CRED-STR-04 · secret read',
    [
      ['Actor', 'USR-1420'],
      ['Credential', 'CRED-STR-04'],
      ['Result', 'Denied'],
      ['Policy', 'SECRET-NO-EXPORT']
    ],
    ['Request received', 'Policy denied', 'Audit sealed'],
    'No secret disclosed; 1 account under review',
    'security.investigation:read'
  )
];

const p = (
  eyebrow: string,
  title: string,
  description: string,
  objectLabel: string,
  variant: TrustVariant,
  facts: readonly (readonly [string, string, string])[],
  action: string,
  objects: readonly TrustObject[],
  protectedAction = false
): TrustPage => ({
  eyebrow,
  title,
  description,
  objectLabel,
  variant,
  facts,
  action,
  objects,
  protected: protectedAction
});
const definitions: Record<BatchDModule, Record<string, TrustPage>> = {
  billing: {
    revenue: p(
      'OWNER REVENUE PROJECTION',
      '收入总览',
      '汇总 Payment/Billing owner 的收入投影、对账与未确认项；不是第二套财务账本。',
      '收入流',
      'revenue',
      [
        ['本月确认', '$48,320', 'Owner posted'],
        ['待确认', '$44,480', 'Not revenue yet'],
        ['对账差异', '2', 'Owner resolution'],
        ['估算用量', '$8,420', '非账本']
      ],
      '导出演示收入投影',
      commercial.payments
    ),
    plans: p(
      'COMMERCIAL CATALOG',
      '套餐管理',
      '管理套餐商业定义、价格版本和权益引用；权益内容由 Product owner 版本化。',
      '套餐',
      'plans',
      [
        ['套餐', '4', 'Billing catalog'],
        ['当前价格', '4', 'Versioned'],
        ['未来版本', '2', 'Effective date'],
        ['Workspace', '128', 'Subscriptions']
      ],
      '创建套餐版本草案',
      [
        t(
          'PLAN-SCALE',
          'Scale',
          'Plan',
          'Active v8',
          '$48,320 / year',
          [
            ['Price', '$48,320'],
            ['Cycle', 'Annual'],
            ['Entitlements', 'ENT-SCALE v8'],
            ['Effective', '2026-08-01']
          ],
          ['Plan version v8', 'Entitlement refs', '126 subscriptions'],
          'Changing price affects future orders only',
          'billing.plan:publish'
        ),
        t(
          'PLAN-PRO',
          'Pro',
          'Plan',
          'Active v4',
          '$2,480 / month',
          [
            ['Price', '$2,480'],
            ['Cycle', 'Monthly'],
            ['Entitlements', 'ENT-PRO v4'],
            ['Effective', '2026-07-01']
          ],
          ['Plan version v4', 'Entitlement refs', '84 subscriptions'],
          'Existing subscriptions follow owner terms',
          'billing.plan:publish'
        ),
        t(
          'PLAN-STARTER',
          'Starter',
          'Plan',
          'Active v6',
          '$299 / month',
          [
            ['Price', '$299'],
            ['Cycle', 'Monthly'],
            ['Entitlements', 'ENT-STARTER v6'],
            ['Effective', '2026-06-01']
          ],
          ['Plan version v6', 'Entitlement refs', '18 subscriptions'],
          'No automatic upgrade',
          'billing.plan:publish'
        )
      ],
      true
    ),
    orders: p(
      'ORDER LIFECYCLE',
      '订单管理',
      '按订单类型、Workspace、状态和时间查看商业意图、支付关联及完成 receipt。',
      '订单',
      'orders',
      [
        ['订单', '328', 'This month'],
        ['Pending', '12', 'No entitlement change'],
        ['Completed', '304', 'Owner receipts'],
        ['Cancelled', '12', 'Audited']
      ],
      '创建订单调整申请',
      commercial.orders,
      true
    ),
    payments: p(
      'PAYMENT OWNER RECORDS',
      '支付记录',
      '只读查看 owner 支付状态、provider reference 与 ledger receipt；支付不等于履约或接受。',
      '支付记录',
      'payments',
      [
        ['记录', '342', 'Payment owner'],
        ['Succeeded', '318', 'Ledger posted'],
        ['Pending', '18', 'No inference'],
        ['Failed', '6', 'Isolated']
      ],
      '发起支付调查',
      commercial.payments
    ),
    invoices: p(
      'INVOICE WORKSPACE',
      '发票管理',
      '管理发票请求、签发、交付和作废链路，金额来自 owner 订单与税务上下文。',
      '发票',
      'invoices',
      [
        ['已签发', '296', 'This year'],
        ['待签发', '8', 'Tax info review'],
        ['逾期', '4', 'Owner status'],
        ['作废', '3', 'Audit retained']
      ],
      '创建发票申请',
      commercial.orders.map((o, i) => ({
        ...o,
        id: `INV-${[8821, 9012, 9188][i]}`,
        name: `Invoice · ${o.name}`,
        kind: 'Invoice',
        status: ['Issued', 'Draft', 'Tax review'][i]!,
        meta: ['$48,320 · INV-2026-8821', '$2,480 · draft', '$42,000 · missing tax ID'][i]!,
        permission: 'billing.invoice:manage'
      })),
      true
    ),
    usage: p(
      'BILLABLE USAGE',
      '使用统计',
      '对照 owner 计量、套餐包含量和超额候选；不从估算直接生成应收。',
      '计量周期',
      'usage',
      [
        ['计量周期', '128', 'Workspace-month'],
        ['已封账', '96', 'Owner receipt'],
        ['待确认', '28', 'Late events'],
        ['超额候选', '4', 'Not invoiced']
      ],
      '审阅计量周期',
      commercial.subscriptions.map((s, i) => ({
        ...s,
        id: `MTR-${s.id}`,
        name: `${s.name} usage period`,
        kind: 'Usage period',
        status: ['Closed', 'Open', 'Reconcile'][i]!,
        meta: `2026-09 · ${[68, 74, 92][i]}%`,
        permission: 'billing.usage:review'
      })),
      true
    ),
    disputes: p(
      'REFUND AND DISPUTE CASES',
      '退款与争议',
      '按原支付、原因、证据、影响和 owner 决策管理退款/争议，不直接改写支付账本。',
      '争议案件',
      'disputes',
      [
        ['开放案件', '12', 'Payment owner'],
        ['需回应', '3', 'Deadline < 48h'],
        ['调查中', '6', 'Evidence collecting'],
        ['已解决', '42', 'This year']
      ],
      '创建争议响应草案',
      [
        t(
          'DSP-118',
          'Duplicate charge claim',
          'Payment dispute',
          'Needs response',
          'PAY-4482 · $48,320',
          [
            ['Payment', 'PAY-4482'],
            ['Reason', 'Duplicate'],
            ['Deadline', '2026-09-26'],
            ['Provider', 'Stripe']
          ],
          ['Dispute opened', 'Evidence requested', 'Response pending'],
          'Potential $48,320 reversal; subscription unchanged',
          'payment.dispute:respond'
        ),
        t(
          'REF-221',
          'Partial refund request',
          'Refund request',
          'Under review',
          'PAY-4521 · $620',
          [
            ['Payment', 'PAY-4521'],
            ['Reason', 'Plan adjustment'],
            ['Requested', '$620'],
            ['Decision', 'Not made']
          ],
          ['Request received', 'Order checked', 'Approval pending'],
          'Would affect payment ledger only after owner command',
          'payment.refund:approve'
        ),
        t(
          'DSP-109',
          'Service quality dispute',
          'Commercial dispute',
          'Evidence collecting',
          'ORD-9012 · $2,480',
          [
            ['Order', 'ORD-9012'],
            ['Reason', 'Service quality'],
            ['Payment', 'Authorized only'],
            ['Decision', 'Not made']
          ],
          ['Claim received', 'Product evidence requested', 'No financial mutation'],
          'Payment is not performance; product evidence separate',
          'payment.dispute:read'
        )
      ],
      true
    )
  },
  governance: {
    overview: p(
      'SECURITY POSTURE',
      '安全总览',
      '汇总安全事件、策略覆盖、权限变更与调查；未知状态不会显示为健康。',
      '安全事件',
      'security',
      [
        ['开放事件', '12', '3 high risk'],
        ['已控制', '8', 'Owner actions'],
        ['未知来源', '2', 'Not healthy'],
        ['策略覆盖', '96%', '4 gaps']
      ],
      '创建安全调查',
      security
    ),
    audit: p(
      'IMMUTABLE AUDIT TRAIL',
      '审计日志',
      '按 actor、对象、owner、Workspace 和 trace 查看不可变事件及版本差异。',
      '审计事件',
      'audit',
      [
        ['事件', '1.28M', '365 days'],
        ['高风险', '42', 'Quarter'],
        ['跨 owner', '8,542', 'Correlated'],
        ['完整性', '100%', 'Digest chain']
      ],
      '导出演示审计片段',
      security.map((s, i) => ({
        ...s,
        id: `AUD-${[9912, 9908, 9891][i]}`,
        name: `Audit · ${s.name}`,
        kind: 'Audit event',
        status: 'Sealed',
        meta: `trace tr-${[82, 74, 61][i]}`,
        permission: 'audit.read'
      }))
    ),
    policies: p(
      'POLICY MANAGEMENT',
      '权限策略',
      '管理精确权限、条件、影响范围和版本；策略名不能替代权限检查结果。',
      '策略',
      'policies',
      [
        ['策略', '126', 'Versioned'],
        ['生效', '118', 'Current'],
        ['Candidate', '6', 'Not active'],
        ['冲突', '2', 'Blocked']
      ],
      '创建策略 candidate',
      [
        t(
          'POL-LOGIN-04',
          'Impossible travel policy',
          'Risk policy',
          'Effective v12',
          'Login sessions',
          [
            ['Condition', 'Geo velocity > 900km/15m'],
            ['Effect', 'Revoke session'],
            ['Scope', 'All internal operators'],
            ['Version', 'v12']
          ],
          ['Policy candidate', 'Test cases 84', 'Approval 2/2', 'Effective'],
          'Can revoke active internal sessions',
          'governance.policy:publish'
        ),
        t(
          'POL-PRIV-02',
          'Privilege escalation policy',
          'Access policy',
          'Effective v8',
          'High privilege roles',
          [
            ['Condition', 'Role risk = high'],
            ['Effect', 'Require dual approval'],
            ['Scope', 'Billing/Security roles'],
            ['Version', 'v8']
          ],
          ['Policy v8', 'Role registry', 'Approval workflow'],
          'Blocks role change until 2 approvals',
          'governance.policy:publish'
        ),
        t(
          'POL-SECRET',
          'Secret no-export policy',
          'Data policy',
          'Effective v6',
          'All credential refs',
          [
            ['Condition', 'Secret value read'],
            ['Effect', 'Deny + alert'],
            ['Scope', 'All environments'],
            ['Version', 'v6']
          ],
          ['Policy v6', 'Vault controls', 'Audit alert'],
          'Prevents secret disclosure',
          'governance.policy:publish'
        )
      ],
      true
    ),
    login: p(
      'LOGIN INVESTIGATION',
      '登录安全',
      '关联身份、会话、设备、地理信号、策略命中和处置 receipt。',
      '登录事件',
      'login',
      [
        ['今日登录', '4,981', 'Core sessions'],
        ['风险命中', '18', 'Policy evaluated'],
        ['已阻断', '12', 'Receipt present'],
        ['待调查', '3', 'No conclusion']
      ],
      '发起会话处置',
      security,
      true
    ),
    configuration: p(
      'GOVERNED CONFIGURATION',
      '系统配置',
      '查看跨平台安全配置、版本和 owner；变更必须经过精确权限与影响审阅。',
      '配置项',
      'configuration',
      [
        ['配置项', '84', 'Owner scoped'],
        ['生效版本', '18', 'Config bundle'],
        ['待变更', '4', 'Not applied'],
        ['漂移', '2', 'Investigate']
      ],
      '提交配置变更',
      security.map((s, i) => ({
        ...s,
        id: `CFG-SEC-${i + 1}`,
        name: ['Session retention', 'Audit export policy', 'Credential rotation baseline'][i]!,
        kind: 'Governed config',
        status: ['Effective', 'Drift', 'Effective'][i]!,
        meta: `bundle v${18 - i}`,
        permission: 'governance.config:change'
      })),
      true
    ),
    compliance: p(
      'CONTROL EVIDENCE',
      '合规管理',
      '以控制项、适用范围、证据、缺口和复核周期管理合规，不用徽章替代证据。',
      '控制项',
      'compliance',
      [
        ['控制项', '42', '4 frameworks'],
        ['证据当前', '36', 'Within review window'],
        ['缺口', '4', 'Remediation'],
        ['不适用', '2', 'Rationale recorded']
      ],
      '创建整改计划',
      [
        t(
          'CTL-SOC2-CC6',
          'Logical access controls',
          'SOC 2',
          'Evidence current',
          'review 2026-10-01',
          [
            ['Scope', 'Production access'],
            ['Evidence', '18 artifacts'],
            ['Owner', 'Security'],
            ['Reviewer', 'Internal Audit']
          ],
          ['Control definition', 'Evidence set EVS-118', 'Review receipt'],
          'Covers 126 privileged assignments',
          'compliance.control:review'
        ),
        t(
          'CTL-GDPR-32',
          'Security of processing',
          'GDPR',
          'Gap open',
          '2 missing evidence items',
          [
            ['Scope', 'EU personal data'],
            ['Evidence', '24 / 26'],
            ['Owner', 'Governance'],
            ['Due', '2026-10-15']
          ],
          ['Control definition', 'Evidence set EVS-122', 'Remediation REM-18'],
          '2 systems lack current restore evidence',
          'compliance.remediation:manage'
        ),
        t(
          'CTL-ISO-A8',
          'Information asset handling',
          'ISO 27001',
          'Review due',
          'due in 7 days',
          [
            ['Scope', 'Data/Knowledge artifacts'],
            ['Evidence', '42 artifacts'],
            ['Owner', 'Governance'],
            ['Reviewer', 'Internal Audit']
          ],
          ['Control definition', 'Evidence set EVS-126', 'Review scheduled'],
          'No current production impact',
          'compliance.control:review'
        )
      ],
      true
    ),
    risk: p(
      'PROTECTED RISK OPERATIONS',
      '风险操作',
      '危险操作必须展示精确权限、影响范围、版本/当前性检查和受保护确认。',
      '风险操作',
      'risk',
      [
        ['待批准', '3', 'Dual approval'],
        ['已阻断', '8', 'Policy denied'],
        ['今日执行', '2', 'Owner receipts'],
        ['无证据', '0', 'Fail closed']
      ],
      '审阅风险操作',
      security,
      true
    )
  }
};

export function TrustPages({ moduleId, pageId, query, setQuery, onAction }: TrustPagesProps) {
  const modulePages = definitions[moduleId];
  const page = modulePages[pageId] ?? modulePages[Object.keys(modulePages)[0]!]!;
  const [selectedId, setSelectedId] = useState(page.objects[0]?.id ?? '');
  const [localStatus, setLocalStatus] = useState('全部状态');
  useEffect(() => {
    setSelectedId(page.objects[0]?.id ?? '');
    setLocalStatus('全部状态');
  }, [page]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return page.objects.filter(
      (item) =>
        (localStatus === '全部状态' || item.status === localStatus) &&
        (!q || `${item.id} ${item.name} ${item.kind} ${item.status}`.toLowerCase().includes(q))
    );
  }, [localStatus, page, query]);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);
  return (
    <section
      className={`sa2-depth sa2-trust-page sa2-trust-page--${page.variant}`}
      data-testid={`${moduleId}-page-${pageId}`}
    >
      <header className="sa2-depth-head">
        <div>
          <span>{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <button
          className={page.protected ? 'sa2-button sa2-button--danger' : 'sa2-button'}
          onClick={() => onAction(page.action, page.protected)}
        >
          ＋ {page.action}
        </button>
      </header>
      <div className="sa2-page-facts">
        {page.facts.map((f) => (
          <article key={f[0]}>
            <span>{f[0]}</span>
            <strong>{f[1]}</strong>
            <small>{f[2]}</small>
          </article>
        ))}
      </div>
      <div className="sa2-operator-workspace">
        <article className="sa2-depth-card sa2-object-browser">
          <header>
            <div>
              <span>{page.objectLabel.toUpperCase()}</span>
              <h2>{page.objectLabel}列表</h2>
            </div>
            <b>{visible.length} DEMO</b>
          </header>
          <div className="sa2-inline-search">
            <input
              aria-label={`搜索${page.objectLabel}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
            className="sa2-depth-card sa2-object-detail sa2-trust-detail"
            data-testid={`${moduleId}-${pageId}-detail`}
          >
            <header>
              <div>
                <span>SELECTED {page.objectLabel.toUpperCase()}</span>
                <h2>{selected.name}</h2>
              </div>
              <b>{selected.status}</b>
            </header>
            <dl>
              <div>
                <dt>对象 ID</dt>
                <dd>{selected.id}</dd>
              </div>
              {selected.fields.map((f) => (
                <div key={f[0]}>
                  <dt>{f[0]}</dt>
                  <dd>{f[1]}</dd>
                </div>
              ))}
            </dl>
            <div className="sa2-impact-box">
              <span>影响范围</span>
              <strong>{selected.impact}</strong>
              <span>执行权限</span>
              <code>{selected.permission}</code>
            </div>
            <h3>{moduleId === 'billing' ? 'Owner lifecycle' : '调查时间线'}</h3>
            <ol>
              {selected.trail.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  <b>{step}</b>
                  {index < selected.trail.length - 1 && <i>→</i>}
                </li>
              ))}
            </ol>
            <div className="sa2-callout warning">
              <b>
                {moduleId === 'billing' ? 'Financial owner boundary' : 'Protected action boundary'}
              </b>
              <span>
                {moduleId === 'billing'
                  ? '财务状态只来自对应 owner；Payment 不是履约、权威、接受或完成。'
                  : '真实危险操作必须再次检查精确权限、对象版本、影响范围、理由、审批与审计。'}
              </span>
            </div>
            <div className="sa2-action-row">
              <button
                className="sa2-button sa2-button--secondary"
                onClick={() => onAction(`查看 ${selected.id} 的 Demo 证据`)}
              >
                查看调查证据
              </button>
              <button
                className={page.protected ? 'sa2-button sa2-button--danger' : 'sa2-button'}
                onClick={() => onAction(`${page.action}：${selected.id}`, page.protected)}
              >
                预演主要操作
              </button>
            </div>
          </article>
        ) : (
          <article className="sa2-depth-card sa2-inline-empty">
            <h2>没有匹配的演示对象</h2>
            <p>当前筛选返回 0 条结果；详情和对象操作已清空。</p>
          </article>
        )}
      </div>
      <TrustCanvas
        variant={page.variant}
        objects={page.objects}
        selectedId={selected?.id}
        onSelect={setSelectedId}
      />
    </section>
  );
}

function TrustCanvas({
  variant,
  objects,
  selectedId,
  onSelect
}: {
  variant: TrustVariant;
  objects: readonly TrustObject[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (variant === 'revenue' || variant === 'usage')
    return (
      <article className="sa2-depth-card sa2-trust-chart">
        <div className="axis">
          $50K
          <br />
          $25K
          <br />
          $0
        </div>
        {objects.map((item, index) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <i style={{ height: `${[128, 88, 62][index]}px` }} />
            <strong>{item.name}</strong>
            <small>{item.meta}</small>
          </button>
        ))}
      </article>
    );
  if (['payments', 'orders', 'invoices'].includes(variant))
    return (
      <article className="sa2-depth-card sa2-trust-ledger">
        {objects.map((item) => (
          <button
            className={item.id === selectedId ? 'is-active' : ''}
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <code>{item.id}</code>
            <span>
              <strong>{item.name}</strong>
              <small>{item.kind}</small>
            </span>
            <b>{item.meta}</b>
            <u>{item.status}</u>
          </button>
        ))}
      </article>
    );
  if (variant === 'plans')
    return (
      <div className="sa2-trust-plans">
        {objects.map((item) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <span>{item.name}</span>
            <strong>{item.meta.split(' · ')[0]}</strong>
            <small>
              {item.fields[1]?.[1]} · {item.fields[2]?.[1]}
            </small>
            <u>{item.status}</u>
          </button>
        ))}
      </div>
    );
  if (variant === 'disputes' || variant === 'risk')
    return (
      <div className="sa2-trust-risk">
        {objects.map((item) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <header>
              <span>!</span>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.id} · {item.meta}
                </small>
              </div>
              <u>{item.status}</u>
            </header>
            <p>{item.impact}</p>
            <code>{item.permission}</code>
          </button>
        ))}
      </div>
    );
  if (variant === 'security' || variant === 'login' || variant === 'audit')
    return (
      <article className="sa2-depth-card sa2-trust-timeline">
        {objects.map((item, index) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <time>{['10:24', '09:15', '08:42'][index]}</time>
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
  if (variant === 'compliance')
    return (
      <div className="sa2-trust-compliance">
        {objects.map((item, index) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <div>
              <strong>{item.id}</strong>
              <span>{item.name}</span>
            </div>
            <i>
              <em style={{ width: `${[100, 78, 88][index]}%` }} />
            </i>
            <b>{item.fields[1]?.[1]}</b>
            <u>{item.status}</u>
          </button>
        ))}
      </div>
    );
  return (
    <article className="sa2-depth-card sa2-trust-policy">
      {objects.map((item) => (
        <button key={item.id} onClick={() => onSelect(item.id)}>
          <span>
            <strong>{item.name}</strong>
            <small>{item.id}</small>
          </span>
          {item.fields.map((f) => (
            <i key={f[0]}>
              <b>{f[0]}</b>
              {f[1]}
            </i>
          ))}
          <u>{item.status}</u>
        </button>
      ))}
    </article>
  );
}
