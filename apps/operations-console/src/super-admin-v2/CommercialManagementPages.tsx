import { useEffect, useMemo, useState } from 'react';
import { useSuperAdminI18n } from './i18n.js';

export const COMMERCIAL_PAGE_IDS = [
  'revenue',
  'catalog',
  'plans',
  'promotions',
  'coupons',
  'agreements',
  'orders',
  'payments',
  'invoices',
  'usage',
  'reconciliation',
  'disputes',
  'audit'
] as const;

type CommercialPageId = (typeof COMMERCIAL_PAGE_IDS)[number];
type BilingualText = Readonly<{ zh: string; en: string }>;
type CommercialObject = Readonly<{
  id: string;
  name: BilingualText;
  kind: BilingualText;
  status: BilingualText;
  meta: BilingualText;
  owner: string;
  version: string;
  scope: BilingualText;
  fields: readonly Readonly<{ label: BilingualText; value: BilingualText }>[];
  trail: readonly BilingualText[];
}>;

interface CommercialManagementPagesProps {
  pageId: string;
  query: string;
  setQuery: (value: string) => void;
  onAction: (label: string, protectedAction?: boolean) => void;
}

const b = (zh: string, en: string): BilingualText => ({ zh, en });
const field = (zh: string, en: string, valueZh: string, valueEn = valueZh) => ({
  label: b(zh, en),
  value: b(valueZh, valueEn)
});
const object = (
  id: string,
  name: BilingualText,
  kind: BilingualText,
  status: BilingualText,
  meta: BilingualText,
  owner: string,
  version: string,
  scope: BilingualText,
  fields: CommercialObject['fields'],
  trail: CommercialObject['trail']
): CommercialObject => ({ id, name, kind, status, meta, owner, version, scope, fields, trail });

const products = [
  object(
    'PRD-LITE',
    b('Lite 专业工作台', 'Lite Professional Workspace'),
    b('MO 产品', 'MO product'),
    b('可配置', 'Configurable'),
    b('3 个用户 SKU · 1 个 Workspace SKU', '3 user SKUs · 1 Workspace SKU'),
    'Core commercial foundation',
    'product-definition candidate v3',
    b('MO 自有产品与权益', 'MO-owned product and entitlements'),
    [
      field('产品键', 'Product key', 'LITE'),
      field('主体范围', 'Subject scope', '用户 / Workspace', 'User / Workspace'),
      field(
        '服务价格边界',
        'Service-price boundary',
        '不包含机构专业服务报价',
        'Excludes institution service quotes'
      )
    ],
    [
      b('产品定义', 'Product definition'),
      b('SKU 映射', 'SKU mapping'),
      b('权益引用', 'Entitlement references')
    ]
  ),
  object(
    'PRD-SITE',
    b('Site 托管站点', 'Site Managed Presence'),
    b('MO 产品', 'MO product'),
    b('可配置', 'Configurable'),
    b('Workspace 年付附加项', 'Workspace annual add-on'),
    'Core commercial foundation',
    'product-definition candidate v2',
    b(
      'MO Site 产品；不拥有机构服务定价',
      'MO Site product; does not own institution service pricing'
    ),
    [
      field('产品键', 'Product key', 'SITE'),
      field('主体范围', 'Subject scope', 'Workspace'),
      field(
        '机构商户价格',
        'Institution merchant price',
        '由机构业务 Owner 决定',
        'Owned by the institution business owner'
      )
    ],
    [
      b('产品定义', 'Product definition'),
      b('托管权益', 'Managed-hosting entitlement'),
      b('Site 安装', 'Site installation')
    ]
  ),
  object(
    'PRD-MARKREG',
    b('MarkReg 商标服务', 'MarkReg Trademark Services'),
    b('Owner 专属服务目录', 'Owner-specific service catalog'),
    b('Owner 读取可用', 'Owner read available'),
    b('TrademarkFiling · MARKREG_DIRECT', 'TrademarkFiling · MARKREG_DIRECT'),
    'MarkReg',
    'CommercialProduct / CommercialPrice v1',
    b('MarkReg 服务与价格，不是通用套餐', 'MarkReg services and prices, not a universal plan'),
    [
      field('服务类型', 'Service type', 'TrademarkFiling'),
      field('渠道', 'Channel', 'MARKREG_DIRECT'),
      field('价格来源', 'Price source', 'MarkReg Owner'),
      field(
        '报价边界',
        'Quote boundary',
        '产品价不等于最终 Quote',
        'Product price is not the final Quote'
      )
    ],
    [
      b('MarkReg 产品', 'MarkReg product'),
      b('价格版本', 'Price version'),
      b('Quote 引用快照', 'Quote reference snapshot')
    ]
  )
] as const;

const offers = [
  object(
    'OFFER-LITE-PRO',
    b('Lite Pro 月付', 'Lite Pro Monthly'),
    b('Commercial Offer Version', 'Commercial Offer Version'),
    b('已发布', 'Published'),
    b('LITE-PRO-CNY-M · ¥199 / 月', 'LITE-PRO-CNY-M · ¥199 / month'),
    'Core commercial foundation',
    'v4',
    b('中国大陆 · 用户主体', 'Mainland China · User subject'),
    [
      field('SKU', 'SKU', 'LITE-PRO-CNY-M'),
      field('币种', 'Currency', 'CNY'),
      field('计费周期', 'Billing interval', 'MONTH'),
      field('生效窗口', 'Effective window', '2026-09-01 → 开放', '2026-09-01 → open-ended'),
      field('权益引用', 'Entitlement refs', 'lite.ai.pro / lite.usage.pro')
    ],
    [
      b('草稿 v4', 'Draft v4'),
      b('双人审核通过', 'Dual review approved'),
      b('2026-09-01 发布', 'Published 2026-09-01')
    ]
  ),
  object(
    'OFFER-LITE-TEAM',
    b('Lite Team 月付', 'Lite Team Monthly'),
    b('Commercial Offer Version', 'Commercial Offer Version'),
    b('待审核', 'In review'),
    b('LITE-TEAM-CNY-M · ¥199 / 月', 'LITE-TEAM-CNY-M · ¥199 / month'),
    'Core commercial foundation',
    'v2 · DEMO CANDIDATE',
    b('中国大陆 · Workspace 主体', 'Mainland China · Workspace subject'),
    [
      field('SKU', 'SKU', 'LITE-TEAM-CNY-M'),
      field('币种', 'Currency', 'CNY'),
      field('计费周期', 'Billing interval', 'MONTH'),
      field('包含权益', 'Included benefit', '1 个可分配 Lite Pro', '1 assignable Lite Pro grant'),
      field('权限影响', 'Permission effect', '不改变成员角色', 'Does not change member roles')
    ],
    [
      b('草稿 v2', 'Draft v2'),
      b('产品审核通过', 'Product review approved'),
      b('财务审核待处理', 'Finance review pending')
    ]
  ),
  object(
    'OFFER-SITE-ANNUAL',
    b('Site 年付附加项', 'Site Annual Add-on'),
    b('Commercial Offer Version', 'Commercial Offer Version'),
    b('草稿', 'Draft'),
    b('SITE-CNY-Y · ¥2,999 / 年', 'SITE-CNY-Y · ¥2,999 / year'),
    'Core commercial foundation',
    'v1 · DEMO DRAFT',
    b('中国大陆 · Workspace 主体', 'Mainland China · Workspace subject'),
    [
      field('SKU', 'SKU', 'SITE-CNY-Y'),
      field('币种', 'Currency', 'CNY'),
      field('计费周期', 'Billing interval', 'YEAR'),
      field('托管权益', 'Hosting entitlement', 'site.hosting.managed'),
      field(
        '不包含',
        'Excludes',
        '机构专业服务价格与最终报价',
        'Institution service prices and final quotes'
      )
    ],
    [b('本地 Demo 草稿', 'Local Demo draft'), b('尚未提交 Owner', 'Not submitted to owner')]
  )
] as const;

const promotions = [
  object(
    'PROMO-Q4-LITE',
    b('Lite Q4 新客户活动', 'Lite Q4 New-customer Campaign'),
    b('待审议 Promotion Version', 'Proposed Promotion Version'),
    b('审核中', 'In review'),
    b('Lite Pro v4 · 首 3 个月减 ¥20', 'Lite Pro v4 · ¥20 off first 3 months'),
    'NOT_YET_MODELED',
    'proposal v1 · DEMO',
    b('中国大陆 · 新 Workspace · CNY', 'Mainland China · new Workspaces · CNY'),
    [
      field('适用版本', 'Applicable offer', 'OFFER-LITE-PRO v4'),
      field('有效期', 'Window', '2026-10-01 → 2026-12-31'),
      field('叠加', 'Stacking', '可与单张新客券叠加', 'May stack with one new-customer coupon'),
      field(
        '退款规则',
        'Refund rule',
        '按实际支付组成比例退回',
        'Refund by applied-price component proportion'
      )
    ],
    [
      b('草稿', 'Draft'),
      b('规则校验通过', 'Rule validation passed'),
      b('双人审核 1/2', 'Dual review 1/2')
    ]
  ),
  object(
    'PROMO-SITE-LAUNCH',
    b('Site 上线活动', 'Site Launch Campaign'),
    b('待审议 Promotion Version', 'Proposed Promotion Version'),
    b('已暂停', 'Paused'),
    b('SITE v1 · 固定减 ¥300', 'SITE v1 · ¥300 fixed discount'),
    'NOT_YET_MODELED',
    'proposal v2 · DEMO',
    b('新加坡 · Workspace · CNY 不适用', 'Singapore · Workspace · CNY ineligible'),
    [
      field('适用版本', 'Applicable offer', 'OFFER-SITE-ANNUAL v1'),
      field('有效期', 'Window', '2026-09-15 → 2026-10-15'),
      field(
        '暂停原因',
        'Pause reason',
        '市场与币种规则待复核',
        'Market/currency rule under review'
      ),
      field(
        '历史影响',
        'Historical effect',
        '不改写已确认快照',
        'Does not rewrite confirmed snapshots'
      )
    ],
    [
      b('发布', 'Published'),
      b('市场冲突告警', 'Market conflict alert'),
      b('暂停未来适用', 'Paused for future eligibility')
    ]
  ),
  object(
    'PROMO-EXPIRED',
    b('Lite 夏季活动', 'Lite Summer Campaign'),
    b('待审议 Promotion Version', 'Proposed Promotion Version'),
    b('已到期', 'Expired'),
    b('2026-08-31 23:59 到期', 'Expired 2026-08-31 23:59'),
    'NOT_YET_MODELED',
    'proposal v1 · DEMO',
    b('历史演示记录', 'Historical demo record'),
    [
      field('到期行为', 'Expiry behavior', '不再匹配新结算', 'No longer matches new checkout'),
      field(
        '已确认订单',
        'Confirmed orders',
        '保留活动版本快照',
        'Retain promotion-version snapshot'
      )
    ],
    [b('已发布', 'Published'), b('到期', 'Expired'), b('历史记录只读', 'History read-only')]
  )
] as const;

const coupons = [
  object(
    'COUPON-WELCOME-100',
    b('WELCOME100 新客券', 'WELCOME100 Welcome Coupon'),
    b('待审议 Coupon Version', 'Proposed Coupon Version'),
    b('可核销', 'Redeemable'),
    b('固定减 ¥100 · 总量 500', '¥100 fixed discount · capacity 500'),
    'NOT_YET_MODELED',
    'proposal v1 · DEMO',
    b('Lite Pro v4 · 新 Workspace · 每主体 1 次', 'Lite Pro v4 · new Workspace · once per subject'),
    [
      field('币种', 'Currency', 'CNY'),
      field('已用 / 额度', 'Used / capacity', '184 / 500'),
      field('叠加规则', 'Stacking', '仅与 PROMO-Q4-LITE', 'Only with PROMO-Q4-LITE'),
      field('退款后', 'After refund', '不自动恢复额度', 'Capacity is not automatically restored')
    ],
    [
      b('签发规则', 'Issuance rule'),
      b('184 条 Demo 核销', '184 Demo redemptions'),
      b('无生产记录', 'No production records')
    ]
  ),
  object(
    'COUPON-SITE-300',
    b('SITE300 定向券', 'SITE300 Targeted Coupon'),
    b('待审议 Coupon Version', 'Proposed Coupon Version'),
    b('额度耗尽', 'Exhausted'),
    b('固定减 ¥300 · 50 / 50', '¥300 fixed discount · 50 / 50'),
    'NOT_YET_MODELED',
    'proposal v2 · DEMO',
    b('指定 Workspace 名单 · Site v1', 'Allowlisted Workspaces · Site v1'),
    [
      field('总额度', 'Capacity', '50'),
      field('剩余', 'Remaining', '0'),
      field(
        '新核销',
        'New redemption',
        '拒绝：COUPON_CAPACITY_EXHAUSTED',
        'Rejected: COUPON_CAPACITY_EXHAUSTED'
      )
    ],
    [
      b('50 次核销', '50 redemptions'),
      b('额度归零', 'Capacity reached zero'),
      b('后续请求拒绝', 'Subsequent request rejected')
    ]
  ),
  object(
    'COUPON-OLD-LITE',
    b('LITE50 历史券', 'LITE50 Historical Coupon'),
    b('待审议 Coupon Version', 'Proposed Coupon Version'),
    b('已失效', 'Expired'),
    b('2026-08-31 到期', 'Expired 2026-08-31'),
    'NOT_YET_MODELED',
    'proposal v1 · DEMO',
    b('历史只读', 'Historical read-only'),
    [
      field('新核销', 'New redemption', '拒绝：COUPON_EXPIRED', 'Rejected: COUPON_EXPIRED'),
      field('历史核销', 'Historical redemptions', '保留版本与金额', 'Version and amount retained')
    ],
    [b('发布', 'Published'), b('到期', 'Expired'), b('禁止新核销', 'New redemption denied')]
  )
] as const;

const agreements = [
  object(
    'AGR-ACME-LITE',
    b('Acme IP · Lite Team', 'Acme IP · Lite Team'),
    b('Commercial Agreement', 'Commercial Agreement'),
    b('生效', 'Active'),
    b('OFFER-LITE-TEAM v1 · Workspace', 'OFFER-LITE-TEAM v1 · Workspace'),
    'Core commercial foundation',
    'agreement v6',
    b('WSP-ACME', 'WSP-ACME'),
    [
      field('主体', 'Subject', 'WORKSPACE · WSP-ACME'),
      field('Offer 快照', 'Offer snapshot', 'OFFER-LITE-TEAM v1'),
      field('权益', 'Entitlements', 'Team + 1 个可分配 Pro', 'Team + 1 assignable Pro'),
      field('成员权限', 'Member permissions', '独立检查', 'Checked independently')
    ],
    [
      b('Agreement 生效', 'Agreement activated'),
      b('Grant 创建', 'Grant created'),
      b('成员分配独立记录', 'Member assignment recorded separately')
    ]
  ),
  object(
    'AGR-SUN-LITE',
    b('Sunrise · Lite Pro', 'Sunrise · Lite Pro'),
    b('Commercial Agreement', 'Commercial Agreement'),
    b('暂停', 'Suspended'),
    b('OFFER-LITE-PRO v3 · 用户', 'OFFER-LITE-PRO v3 · User'),
    'Core commercial foundation',
    'agreement v3',
    b('USER · USR-SUN-18', 'USER · USR-SUN-18'),
    [
      field('主体', 'Subject', 'USER · USR-SUN-18'),
      field(
        '暂停影响',
        'Suspension impact',
        '权益状态需 Owner 解析',
        'Entitlement state requires owner resolution'
      ),
      field('支付推断', 'Payment inference', '禁止', 'Forbidden')
    ],
    [
      b('Agreement 生效', 'Agreement activated'),
      b('暂停记录', 'Suspension recorded'),
      b('等待 Owner 处理', 'Awaiting owner action')
    ]
  )
] as const;

const orders = [
  object(
    'ORDER-DEMO-2401',
    b('Lite Pro 新购演示', 'Lite Pro Demo Purchase'),
    b('不可变价格快照', 'Immutable price snapshot'),
    b('已确认', 'Confirmed'),
    b('¥199 → ¥179 → ¥169 → ¥169', '¥199 → ¥179 → ¥169 → ¥169'),
    'Demo price receipt · MarkReg concepts referenced',
    'snapshot v1 · DEMO',
    b('WSP-ACME · CNY · 中国大陆', 'WSP-ACME · CNY · Mainland China'),
    [
      field('套餐版本', 'Offer version', 'OFFER-LITE-PRO v4'),
      field('活动版本', 'Promotion version', 'PROMO-Q4-LITE v1'),
      field('优惠券版本', 'Coupon version', 'COUPON-WELCOME-100 v1'),
      field('最终价格', 'Final price', '¥169'),
      field('支付结果', 'Payment result', '未执行生产支付', 'No production payment executed')
    ],
    [
      b('资格匹配', 'Eligibility matched'),
      b('价格快照冻结', 'Price snapshot frozen'),
      b('演示购买完成', 'Demo purchase completed')
    ]
  ),
  object(
    'ORDER-DEMO-FAILED',
    b('Site 支付失败演示', 'Site Failed-payment Demo'),
    b('不可变价格快照', 'Immutable price snapshot'),
    b('支付失败', 'Payment failed'),
    b('¥2,999 · 快照保留', '¥2,999 · snapshot retained'),
    'Demo price receipt · Payment boundary',
    'snapshot v1 · DEMO',
    b('WSP-SUNRISE · CNY', 'WSP-SUNRISE · CNY'),
    [
      field('套餐版本', 'Offer version', 'OFFER-SITE-ANNUAL v1'),
      field('价格快照', 'Price snapshot', '¥2,999'),
      field('Payment', 'Payment', 'FAILED · Demo'),
      field('权益结果', 'Entitlement result', '未创建', 'Not created')
    ],
    [
      b('价格快照冻结', 'Price snapshot frozen'),
      b('支付失败', 'Payment failed'),
      b('订单与失败证据保留', 'Order and failure evidence retained')
    ]
  )
] as const;

const payments = [
  object(
    'payment_demo_succeeded',
    b('Lite Pro 演示支付', 'Lite Pro Demo Payment'),
    b('Payment Owner Aggregate', 'Payment Owner Aggregate'),
    b('成功', 'Succeeded'),
    b('¥169 · STRIPE_TEST · Demo', '¥169 · STRIPE_TEST · Demo'),
    'Payment',
    'payment v4 · DEMO FIXTURE',
    b('WSP-ACME', 'WSP-ACME'),
    [
      field('Checkout', 'Checkout', 'checkout_demo_2401'),
      field('Order', 'Order', 'ORDER-DEMO-2401'),
      field('尝试', 'Attempts', '1'),
      field('退款', 'Refunds', '0'),
      field('对账', 'Reconciliation', 'MATCH · Demo')
    ],
    [
      b('Intent 创建', 'Intent created'),
      b('Provider 事件验证', 'Provider event verified'),
      b('Payment 成功', 'Payment succeeded'),
      b('对账匹配', 'Reconciliation matched')
    ]
  ),
  object(
    'payment_demo_failed',
    b('Site 演示支付', 'Site Demo Payment'),
    b('Payment Owner Aggregate', 'Payment Owner Aggregate'),
    b('失败', 'Failed'),
    b('¥2,999 · STRIPE_TEST · Demo', '¥2,999 · STRIPE_TEST · Demo'),
    'Payment',
    'payment v2 · DEMO FIXTURE',
    b('WSP-SUNRISE', 'WSP-SUNRISE'),
    [
      field('Checkout', 'Checkout', 'checkout_demo_site'),
      field('Order', 'Order', 'ORDER-DEMO-FAILED'),
      field('失败原因', 'Failure reason', 'provider_declined · Demo'),
      field('权益结果', 'Entitlement result', '未创建', 'Not created')
    ],
    [
      b('Intent 创建', 'Intent created'),
      b('Provider 拒绝', 'Provider declined'),
      b('失败证据保留', 'Failure evidence retained')
    ]
  )
] as const;

const audits = [
  object(
    'AUD-COM-2409',
    b('Lite Team v2 价格审核', 'Lite Team v2 Price Review'),
    b('商业审批记录', 'Commercial approval record'),
    b('待财务审核', 'Finance review pending'),
    b('提交者与审核者必须不同', 'Submitter and reviewer must differ'),
    'Proposed commercial governance',
    'review v1 · DEMO',
    b('OFFER-LITE-TEAM v2', 'OFFER-LITE-TEAM v2'),
    [
      field('创建者', 'Creator', 'USR-PRODUCT-14'),
      field('产品审核', 'Product review', 'APPROVED · USR-PRODUCT-08'),
      field('财务审核', 'Finance review', 'PENDING'),
      field(
        '发布权限',
        'Publish authority',
        'commercial-offer:publish · 尚未存在',
        'commercial-offer:publish · not yet defined'
      )
    ],
    [
      b('草稿保存', 'Draft saved'),
      b('产品审核通过', 'Product review approved'),
      b('财务审核待处理', 'Finance review pending')
    ]
  )
] as const;

const generic = [
  object(
    'NOT-CONNECTED',
    b('Owner 投影暂未接入', 'Owner projection not connected'),
    b('可用性说明', 'Availability statement'),
    b('暂未接入', 'Not connected'),
    b('不以 Demo 金额替代真实结果', 'Demo amounts do not replace owner truth'),
    'UNAVAILABLE',
    'n/a',
    b('当前页面', 'Current page'),
    [
      field(
        '真实数据',
        'Real data',
        '需要新的受治理读取投影',
        'Requires a new governed read projection'
      )
    ],
    [b('Owner Map 已确认', 'Owner map confirmed'), b('等待读取合同', 'Awaiting read contract')]
  )
] as const;

const pageObjects: Record<CommercialPageId, readonly CommercialObject[]> = {
  revenue: [...products, ...offers],
  catalog: products,
  plans: offers,
  promotions,
  coupons,
  agreements,
  orders,
  payments,
  invoices: generic,
  usage: agreements,
  reconciliation: payments,
  disputes: payments,
  audit: audits
};

const pageCopy: Record<
  CommercialPageId,
  Readonly<{ eyebrow: string; title: BilingualText; description: BilingualText }>
> = {
  revenue: {
    eyebrow: 'COMMERCIAL CONTROL',
    title: b('商业概览', 'Commercial Overview'),
    description: b(
      '查看产品、Offer、协议与支付 Owner 的可用边界；未知与未接入不会显示为零。',
      'Review availability across product, offer, agreement, and payment owners; unknown and unconnected data are never shown as zero.'
    )
  },
  catalog: {
    eyebrow: 'PRODUCT & SKU',
    title: b('产品与 SKU', 'Products & SKUs'),
    description: b(
      '管理 MO 自有产品的商业标识与 SKU 映射，不覆盖机构通过 Site 销售的专业服务价格。',
      'Manage MO-owned commercial product identities and SKU mappings without overriding professional-service prices sold by institutions through Site.'
    )
  },
  plans: {
    eyebrow: 'VERSIONED OFFER',
    title: b('套餐与价格', 'Plans & Pricing'),
    description: b(
      '以结构化字段管理币种、计费周期、市场、有效期和权益引用；历史版本不可改写。',
      'Manage currency, billing cycle, market, window, and entitlement references with structured fields; historical versions remain immutable.'
    )
  },
  promotions: {
    eyebrow: 'PROPOSED DOMAIN · DEMO',
    title: b('营销活动', 'Promotions'),
    description: b(
      'Promotion 尚无已批准 Owner。本页只验证草稿、审核、发布、暂停和到期的产品流程。',
      'Promotion has no approved owner yet. This page validates the proposed draft, review, publish, pause, and expiry workflow only.'
    )
  },
  coupons: {
    eyebrow: 'PROPOSED DOMAIN · DEMO',
    title: b('优惠券与核销', 'Coupons & Redemptions'),
    description: b(
      'Coupon 与 Redemption 尚未建模；演示资格、额度、重复核销、失效和退款策略。',
      'Coupon and Redemption are not yet modeled; this demo covers eligibility, capacity, duplicate use, expiry, and refund policy.'
    )
  },
  agreements: {
    eyebrow: 'AGREEMENT & ENTITLEMENT',
    title: b('套餐与权益', 'Agreements & Entitlements'),
    description: b(
      '分别查看主体、Offer 版本、Agreement 和 Entitlement；权益不等于成员权限。',
      'Inspect subject, offer version, Agreement, and Entitlement separately; entitlement is not member permission.'
    )
  },
  orders: {
    eyebrow: 'IMMUTABLE PRICE SNAPSHOT',
    title: b('订单与价格快照', 'Orders & Price Snapshots'),
    description: b(
      '追溯套餐、活动、优惠券、税费和最终价格的确切版本，不因后续调价改写历史。',
      'Trace exact offer, promotion, coupon, fee, and final-price versions without rewriting history after later price changes.'
    )
  },
  payments: {
    eyebrow: 'PAYMENT OWNER',
    title: b('支付管理', 'Payment Management'),
    description: b(
      '读取 Payment Owner 的支付、尝试和 Provider 事件；支付成功不等于履约、接受或完成。',
      'Read Payment-owned payments, attempts, and provider events; payment success is not performance, acceptance, or completion.'
    )
  },
  invoices: {
    eyebrow: 'OWNER GAP',
    title: b('发票与税务', 'Invoices & Tax'),
    description: b(
      '当前没有已批准的发票与税务 Owner 投影，不使用订单金额伪造发票状态。',
      'No approved invoice or tax owner projection exists; order amounts are not used to fabricate invoice state.'
    )
  },
  usage: {
    eyebrow: 'ENTITLEMENT USAGE',
    title: b('用量与额度', 'Usage & Allowances'),
    description: b(
      '区分权益额度、实际计量和应收结果；没有 Owner receipt 的估算不会成为账单。',
      'Keep entitlement allowance, observed usage, and receivable outcome separate; estimates without owner receipts do not become bills.'
    )
  },
  reconciliation: {
    eyebrow: 'PAYMENT RECONCILIATION',
    title: b('支付对账', 'Payment Reconciliation'),
    description: b(
      '对照本地支付快照与 Provider 观察，保留 MATCH/MISMATCH 和处置状态。',
      'Compare local payment snapshots with provider observations while preserving MATCH/MISMATCH and disposition states.'
    )
  },
  disputes: {
    eyebrow: 'REFUND & DISPUTE',
    title: b('退款与争议', 'Refunds & Disputes'),
    description: b(
      '退款状态来自 Payment Owner；退款不改写原订单价格快照，也不证明服务结果。',
      'Refund status comes from Payment; refunds do not rewrite the original order price snapshot or prove service outcome.'
    )
  },
  audit: {
    eyebrow: 'COMMERCIAL GOVERNANCE',
    title: b('商业审批与审计', 'Commercial Approval & Audit'),
    description: b(
      '查看创建者、审核者、版本差异、影响范围与发布依据；创建不等于批准。',
      'Inspect creator, reviewer, version differences, impact, and publish basis; creation is not approval.'
    )
  }
};

export function CommercialManagementPages({
  pageId,
  query,
  setQuery,
  onAction
}: CommercialManagementPagesProps) {
  const { locale } = useSuperAdminI18n();
  const english = locale === 'en-US';
  const text = (value: BilingualText) => (english ? value.en : value.zh);
  const resolvedPage = COMMERCIAL_PAGE_IDS.includes(pageId as CommercialPageId)
    ? (pageId as CommercialPageId)
    : 'revenue';
  const copy = pageCopy[resolvedPage];
  const objects = pageObjects[resolvedPage];
  const [status, setStatus] = useState('ALL');
  const [selectedId, setSelectedId] = useState(objects[0]?.id ?? '');
  const [workspace, setWorkspace] = useState('WSP-ACME');
  const [couponScenario, setCouponScenario] = useState('ELIGIBLE');
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftName, setDraftName] = useState('Lite Pro 2027');
  const [draftCurrency, setDraftCurrency] = useState('CNY');
  const [draftCycle, setDraftCycle] = useState('MONTH');
  const [draftAmount, setDraftAmount] = useState('199');

  useEffect(() => {
    setSelectedId(objects[0]?.id ?? '');
    setStatus('ALL');
    setDraftOpen(false);
  }, [objects, resolvedPage]);

  const statuses = useMemo(
    () => [...new Set(objects.map((item) => text(item.status)))],
    [objects, locale]
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return objects.filter((item) => {
      const localizedStatus = text(item.status);
      return (
        (status === 'ALL' || status === localizedStatus) &&
        (!needle ||
          `${item.id} ${text(item.name)} ${text(item.kind)} ${localizedStatus}`
            .toLowerCase()
            .includes(needle))
      );
    });
  }, [locale, objects, query, status]);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
    if (!selected && selectedId) setSelectedId('');
  }, [selected, selectedId]);

  const eligibility = workspace === 'WSP-ACME';
  const couponResult: Record<string, BilingualText> = {
    ELIGIBLE: b(
      '可核销：将创建本地 Demo 价格收据',
      'Eligible: a local Demo price receipt will be created'
    ),
    EXPIRED: b('拒绝：COUPON_EXPIRED', 'Rejected: COUPON_EXPIRED'),
    DUPLICATE: b('拒绝：COUPON_ALREADY_REDEEMED', 'Rejected: COUPON_ALREADY_REDEEMED'),
    EXHAUSTED: b('拒绝：COUPON_CAPACITY_EXHAUSTED', 'Rejected: COUPON_CAPACITY_EXHAUSTED'),
    PERMISSION: b('拒绝：COMMERCIAL_PERMISSION_DENIED', 'Rejected: COMMERCIAL_PERMISSION_DENIED')
  };

  return (
    <section
      className="sa2-depth sa2-commerce"
      data-testid={`billing-page-${resolvedPage}`}
      data-i18n-preserve
    >
      <header className="sa2-depth-head">
        <div>
          <span>{copy.eyebrow}</span>
          <h1>{text(copy.title)}</h1>
          <p>{text(copy.description)}</p>
        </div>
        {resolvedPage === 'plans' ? (
          <button className="sa2-button" onClick={() => setDraftOpen((open) => !open)}>
            {draftOpen
              ? text(b('关闭草稿', 'Close draft'))
              : text(b('新建版本草稿', 'New version draft'))}
          </button>
        ) : (
          <button
            className="sa2-button sa2-button--secondary"
            onClick={() =>
              onAction(text(b('已在本地刷新商业 Demo', 'Commercial Demo refreshed locally')))
            }
          >
            {text(b('刷新本地演示', 'Refresh local demo'))}
          </button>
        )}
      </header>

      <div className="sa2-commerce-boundaries" role="note">
        <span>
          <b>{text(b('演示设计', 'Demo design'))}</b>
          {text(b('不调用生产写接口', 'No production write API'))}
        </span>
        <span>
          <b>{text(b('真实 Owner', 'Real owners'))}</b>Core / MarkReg / Payment
        </span>
        <span>
          <b>Promotion / Coupon</b>
          {text(b('待 Product / Technical 审议', 'Awaiting Product / Technical approval'))}
        </span>
      </div>

      {draftOpen && resolvedPage === 'plans' && (
        <form
          className="sa2-depth-card sa2-commerce-draft"
          data-testid="commercial-offer-draft"
          onSubmit={(event) => {
            event.preventDefault();
            onAction(
              text(
                b(
                  `已在本地保存 Demo 草稿：${draftName} · ${draftCurrency} ${draftAmount} / ${draftCycle}`,
                  `Local Demo draft saved: ${draftName} · ${draftCurrency} ${draftAmount} / ${draftCycle}`
                )
              )
            );
          }}
        >
          <header>
            <div>
              <span>LOCAL DEMO DRAFT</span>
              <h2>{text(b('套餐版本草稿', 'Offer-version draft'))}</h2>
            </div>
            <b>{text(b('未提交 Owner', 'Not submitted to owner'))}</b>
          </header>
          <div className="sa2-commerce-form-grid">
            <label>
              <span>{text(b('显示名称', 'Display name'))}</span>
              <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
            </label>
            <label>
              <span>{text(b('币种', 'Currency'))}</span>
              <select
                value={draftCurrency}
                onChange={(event) => setDraftCurrency(event.target.value)}
              >
                <option>CNY</option>
                <option>USD</option>
                <option>SGD</option>
              </select>
            </label>
            <label>
              <span>{text(b('计费周期', 'Billing interval'))}</span>
              <select value={draftCycle} onChange={(event) => setDraftCycle(event.target.value)}>
                <option value="MONTH">MONTH</option>
                <option value="YEAR">YEAR</option>
                <option value="NONE">NONE</option>
              </select>
            </label>
            <label>
              <span>{text(b('金额（主单位）', 'Amount (major units)'))}</span>
              <input
                inputMode="decimal"
                value={draftAmount}
                onChange={(event) => setDraftAmount(event.target.value)}
              />
            </label>
            <label>
              <span>{text(b('市场范围', 'Market scope'))}</span>
              <select>
                <option>{text(b('中国大陆', 'Mainland China'))}</option>
                <option>{text(b('全球（需税务 Owner）', 'Global (tax owner required)'))}</option>
              </select>
            </label>
            <label>
              <span>{text(b('生效日期', 'Effective from'))}</span>
              <input type="date" defaultValue="2027-01-01" />
            </label>
          </div>
          <aside>
            {text(
              b(
                '金额将以最小货币单位保存；权益引用、市场和有效期必须在发布前完成当前性校验。',
                'Amounts are stored in minor units; entitlement references, market, and window require currentness validation before publish.'
              )
            )}
          </aside>
          <footer>
            <button type="submit" className="sa2-button sa2-button--secondary">
              {text(b('仅保存本地草稿', 'Save local draft only'))}
            </button>
            <button
              type="button"
              className="sa2-button"
              onClick={() =>
                onAction(
                  text(
                    b(
                      `提交 ${draftName} 的 Demo 双人审核`,
                      `Submit ${draftName} for Demo dual review`
                    )
                  ),
                  true
                )
              }
            >
              {text(b('请求 Demo 审核', 'Request Demo review'))}
            </button>
          </footer>
        </form>
      )}

      <div className="sa2-commerce-workbench">
        <article className="sa2-depth-card sa2-commerce-browser">
          <header>
            <div>
              <span>{copy.eyebrow}</span>
              <h2>{text(b('管理对象', 'Managed objects'))}</h2>
            </div>
            <b>{visible.length} DEMO</b>
          </header>
          <div className="sa2-commerce-filters">
            <input
              aria-label={text(b('搜索商业对象', 'Search commercial objects'))}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text(b('搜索名称、ID 或类型', 'Search name, ID, or type'))}
            />
            <select
              aria-label={text(b('商业状态筛选', 'Commercial status filter'))}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">{text(b('全部状态', 'All statuses'))}</option>
              {statuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="sa2-commerce-object-list">
            {visible.map((item) => (
              <button
                key={item.id}
                className={item.id === selected?.id ? 'is-active' : ''}
                onClick={() => setSelectedId(item.id)}
              >
                <span>
                  <strong>{text(item.name)}</strong>
                  <small>
                    {item.id} · {text(item.kind)}
                  </small>
                </span>
                <b>{text(item.status)}</b>
                <small>{text(item.meta)}</small>
              </button>
            ))}
          </div>
          {visible.length === 0 && (
            <div className="sa2-commerce-empty">
              <h3>{text(b('没有匹配对象', 'No matching objects'))}</h3>
              <p>
                {text(
                  b(
                    '当前筛选返回有效的 0 条结果，详情与操作已清空。',
                    'The current filter returned a valid zero result; detail and actions are cleared.'
                  )
                )}
              </p>
            </div>
          )}
        </article>

        {selected && (
          <article
            className="sa2-depth-card sa2-commerce-detail"
            data-testid="commercial-object-detail"
          >
            <header>
              <div>
                <span>{text(selected.kind).toUpperCase()}</span>
                <h2>{text(selected.name)}</h2>
                <code>{selected.id}</code>
              </div>
              <b>{text(selected.status)}</b>
            </header>
            <div className="sa2-commerce-owner">
              <span>{text(b('Owner / 可用性', 'Owner / availability'))}</span>
              <strong>{selected.owner}</strong>
              <small>{selected.version}</small>
            </div>
            <dl>
              {selected.fields.map((item) => (
                <div key={item.label.zh}>
                  <dt>{text(item.label)}</dt>
                  <dd>{text(item.value)}</dd>
                </div>
              ))}
            </dl>
            <section>
              <h3>{text(b('适用范围与边界', 'Scope & boundary'))}</h3>
              <p>{text(selected.scope)}</p>
            </section>

            {resolvedPage === 'promotions' && (
              <EligibilityPanel
                english={english}
                workspace={workspace}
                setWorkspace={setWorkspace}
                eligible={eligibility}
              />
            )}
            {resolvedPage === 'coupons' && (
              <CouponPanel
                english={english}
                scenario={couponScenario}
                setScenario={setCouponScenario}
                result={text(couponResult[couponScenario]!)}
              />
            )}
            {resolvedPage === 'orders' && <PriceSnapshot english={english} />}
            {(resolvedPage === 'payments' ||
              resolvedPage === 'reconciliation' ||
              resolvedPage === 'disputes') && <PaymentBoundary english={english} />}

            <section className="sa2-commerce-lineage">
              <h3>{text(b('版本与审计链', 'Version & audit lineage'))}</h3>
              <ol>
                {selected.trail.map((step, index) => (
                  <li key={step.zh}>
                    <span>{index + 1}</span>
                    <b>{text(step)}</b>
                  </li>
                ))}
              </ol>
            </section>
            <footer>
              <button
                className="sa2-button sa2-button--secondary"
                onClick={() =>
                  onAction(
                    text(
                      b(
                        `已在本地打开 ${selected.id} 的 Demo 版本差异`,
                        `Opened local Demo version diff for ${selected.id}`
                      )
                    )
                  )
                }
              >
                {text(b('查看版本差异', 'View version diff'))}
              </button>
              <button
                className="sa2-button"
                onClick={() =>
                  onAction(
                    text(
                      b(
                        `审阅 ${selected.id} 的 Demo 受保护流程`,
                        `Review protected Demo flow for ${selected.id}`
                      )
                    ),
                    true
                  )
                }
              >
                {text(b('进入受保护审核', 'Open protected review'))}
              </button>
            </footer>
          </article>
        )}
      </div>
    </section>
  );
}

function EligibilityPanel({
  english,
  workspace,
  setWorkspace,
  eligible
}: {
  english: boolean;
  workspace: string;
  setWorkspace: (value: string) => void;
  eligible: boolean;
}) {
  const l = (zh: string, en: string) => (english ? en : zh);
  return (
    <section className="sa2-commerce-evaluator" data-testid="promotion-eligibility">
      <header>
        <div>
          <span>ELIGIBILITY EXPLAINER</span>
          <h3>{l('Workspace 适用性', 'Workspace eligibility')}</h3>
        </div>
        <b className={eligible ? 'is-ok' : 'is-denied'}>
          {eligible ? l('符合条件', 'Eligible') : l('不符合条件', 'Ineligible')}
        </b>
      </header>
      <label>
        <span>{l('评估 Workspace', 'Evaluate Workspace')}</span>
        <select value={workspace} onChange={(event) => setWorkspace(event.target.value)}>
          <option value="WSP-ACME">WSP-ACME · CN · New</option>
          <option value="WSP-SUNRISE">WSP-SUNRISE · SG · Existing</option>
        </select>
      </label>
      <ul>
        {eligible ? (
          <>
            <li>{l('市场：CN 匹配', 'Market: CN matches')}</li>
            <li>{l('Offer：Lite Pro v4 匹配', 'Offer: Lite Pro v4 matches')}</li>
            <li>{l('主体：新 Workspace 匹配', 'Subject: new Workspace matches')}</li>
          </>
        ) : (
          <>
            <li>{l('拒绝：MARKET_NOT_APPLICABLE', 'Rejected: MARKET_NOT_APPLICABLE')}</li>
            <li>{l('拒绝：SUBJECT_NOT_NEW', 'Rejected: SUBJECT_NOT_NEW')}</li>
            <li>{l('不会生成折扣或核销记录', 'No discount or redemption record is created')}</li>
          </>
        )}
      </ul>
    </section>
  );
}

function CouponPanel({
  english,
  scenario,
  setScenario,
  result
}: {
  english: boolean;
  scenario: string;
  setScenario: (value: string) => void;
  result: string;
}) {
  const l = (zh: string, en: string) => (english ? en : zh);
  return (
    <section className="sa2-commerce-evaluator" data-testid="coupon-outcome">
      <header>
        <div>
          <span>NEGATIVE PATH</span>
          <h3>{l('核销结果模拟', 'Redemption outcome simulation')}</h3>
        </div>
      </header>
      <label>
        <span>{l('演示场景', 'Demo scenario')}</span>
        <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
          <option value="ELIGIBLE">{l('符合条件', 'Eligible')}</option>
          <option value="EXPIRED">{l('已到期', 'Expired')}</option>
          <option value="DUPLICATE">{l('重复使用', 'Duplicate use')}</option>
          <option value="EXHAUSTED">{l('额度耗尽', 'Capacity exhausted')}</option>
          <option value="PERMISSION">{l('无权限', 'Permission denied')}</option>
        </select>
      </label>
      <output data-i18n-preserve className={scenario === 'ELIGIBLE' ? 'is-ok' : 'is-denied'}>
        {result}
      </output>
      <p>
        {l(
          '这是确定性的本地演示结果，不创建 Coupon Redemption。',
          'This is a deterministic local Demo result and creates no Coupon Redemption.'
        )}
      </p>
    </section>
  );
}

function PriceSnapshot({ english }: { english: boolean }) {
  const l = (zh: string, en: string) => (english ? en : zh);
  return (
    <section className="sa2-commerce-price" data-testid="commercial-price-snapshot">
      <header>
        <div>
          <span>PRICE SNAPSHOT · DEMO</span>
          <h3>{l('最终价格组成', 'Final price composition')}</h3>
        </div>
        <b>snapshot v1</b>
      </header>
      <ol>
        <li>
          <span>{l('标准价 · OFFER-LITE-PRO v4', 'Standard · OFFER-LITE-PRO v4')}</span>
          <strong>¥199</strong>
        </li>
        <li>
          <span>{l('活动 · PROMO-Q4-LITE v1', 'Promotion · PROMO-Q4-LITE v1')}</span>
          <strong>− ¥20</strong>
        </li>
        <li>
          <span>{l('优惠券 · COUPON-WELCOME-100 v1', 'Coupon · COUPON-WELCOME-100 v1')}</span>
          <strong>− ¥10</strong>
        </li>
        <li>
          <span>{l('税费 · Demo jurisdiction result', 'Tax · Demo jurisdiction result')}</span>
          <strong>¥0</strong>
        </li>
        <li className="total">
          <span>{l('最终确认价格', 'Final confirmed price')}</span>
          <strong>¥169 CNY</strong>
        </li>
      </ol>
      <p>
        {l(
          '所有版本与金额随订单快照冻结；后续调价不会追溯修改。',
          'All versions and amounts are frozen with the order snapshot; later price changes do not apply retroactively.'
        )}
      </p>
    </section>
  );
}

function PaymentBoundary({ english }: { english: boolean }) {
  const l = (zh: string, en: string) => (english ? en : zh);
  return (
    <aside className="sa2-commerce-payment-boundary" role="note">
      <strong>{l('Payment Owner 边界', 'Payment owner boundary')}</strong>
      <p>
        {l(
          'Real 读取必须提供精确 Workspace ID 与 Payment ID。当前页面不执行收款、退款、提现、资金划拨或对账处置。',
          'A Real read requires the exact Workspace ID and Payment ID. This page does not capture, refund, withdraw, transfer funds, or resolve reconciliation.'
        )}
      </p>
      <code>commercial-admin:read · READ ONLY</code>
    </aside>
  );
}
