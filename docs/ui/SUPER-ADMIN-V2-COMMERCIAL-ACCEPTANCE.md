# Super Admin V2 商业管理验收记录

任务：`MO-SUPER-ADMIN-V2-COMMERCIAL-001`

基线：`origin/main@e44470ea8` + 现有 Super Admin V2 设计分支

日期：2026-09-28

## 交付范围

现有一级入口「账单」升级为「商业 / Commercial」，保留稳定的 `/super-admin-v2/billing/*` 路由与原 Shell。商业工作区覆盖：

- 产品与 SKU；
- 套餐与版本化价格；
- 待审议的营销活动与优惠券 Demo；
- Agreement 与 Entitlement；
- 订单及不可变价格快照；
- Payment Owner 只读聚合、发票 Owner 缺口、用量、对账、退款与争议；
- 商业审批与审计链。

未接入生产 API，未执行真实支付、退款、提现、划拨或发布命令。Promotion、Coupon 与 Redemption 没有获批 Owner/Contract，因此只以 `PROPOSED DOMAIN · DEMO` 展示，并在页面与结果中持续标识。

## Owner 与边界验收

| 对象                                                             | 真实 Owner / 当前能力                 | 本轮表现                                   |
| ---------------------------------------------------------------- | ------------------------------------- | ------------------------------------------ |
| Commercial Offer Version / Agreement / Entitlement / Rate Policy | Core commercial foundation            | 展示已存在合同语义；Demo 草稿不提交 Owner  |
| MarkReg Product / Price / Quote / Order                          | MarkReg                               | 仅引用边界与概念，不复制 MarkReg 业务真相  |
| Payment / Attempt / Provider Event / Refund / Reconciliation     | Payment                               | 精确标识只读边界；不提供资金命令           |
| Promotion / Coupon / Redemption                                  | 尚无获批 Owner/Contract               | 显式 proposed Demo；不得被解释为已上线能力 |
| 机构 Site 专业服务价格                                           | Workspace / Site / MarkReg 对应 owner | 不受 MO 套餐编辑影响                       |

完整 Decision Record、对象关系与权限矩阵见 [SUPER-ADMIN-V2-COMMERCIAL-DECISION.md](./SUPER-ADMIN-V2-COMMERCIAL-DECISION.md)。

## 关键旅程

1. 套餐版本：创建结构化本地草稿，填写币种、周期、金额、市场和生效日期；切换语言后草稿保持；请求 Demo 双人审核进入受保护确认，不产生网络写请求。
2. 活动资格：`WSP-ACME` 命中市场、Offer 与新 Workspace 条件；`WSP-SUNRISE` 返回 `MARKET_NOT_APPLICABLE` 与 `SUBJECT_NOT_NEW`，且不生成折扣或核销记录。
3. 优惠券负向路径：分别验证到期、重复使用、额度耗尽与无权限，保留原始原因码。
4. 订单追溯：订单快照同时固定 `OFFER-LITE-PRO v4`、`PROMO-Q4-LITE v1`、`COUPON-WELCOME-100 v1` 和最终 `¥169 CNY`；后续调价不追溯修改。
5. 支付边界：失败支付保留订单和 Provider 失败证据；Payment 成功不等于履约、权威、接受或完成。

## UI 状态

- 加载：沿用统一 Shell 与 owner 页面加载边界。
- 空数据：筛选为零时清空详情与对象操作。
- 错误 / 部分可用：不得用零值或成功状态替代 owner 缺口。
- 无权限：优惠券演示返回 `COMMERCIAL_PERMISSION_DENIED`；真实动作仍要求后端权限。
- 成功：只显示“本地 Demo”反馈，不声称生产变更。
- 高风险：对象、影响、权限、原因与确认都通过既有 Protected Action Dialog 展示。

## 浏览器证据

- 1440 × 900 中文活动资格：`playwright-screenshots/super-admin-v2-commercial-promotions-zh-1440.png`
- 1440 × 900 英文活动资格：`playwright-screenshots/super-admin-v2-commercial-promotions-en-1440.png`
- 1366 × 768 英文订单快照：`playwright-screenshots/super-admin-v2-commercial-order-en-1366.png`
- 390px 中文活动资格：`playwright-screenshots/super-admin-v2-commercial-promotions-zh-390.png`
- 390px 英文活动资格：`playwright-screenshots/super-admin-v2-commercial-promotions-en-390.png`

视觉检查确认：中文与英文无页面级横向溢出；复杂对象在窄屏转为顺序卡片；触控操作保持 44px 目标；技术 ID、版本、金额和原因码保持原文。

## 自动化结果

- Operations Console：lint、typecheck、91 个单元测试、production build 通过。
- Playwright 商业管理：桌面 6/6、移动 4/4 通过。
- 所有注册地址：单 H1、Heading 层级、二级导航和直接 URL 验收通过。
- 所有注册地址英文缺失翻译扫描通过。
- 负向旅程覆盖：不符合资格、优惠券到期、重复使用、额度耗尽、无权限、支付失败、筛选为空、受保护操作取消。

## 仍需独立决策的依赖

Promotion、Coupon、Redemption 的 Owner、Contract、生命周期、叠加算法、退款语义、审计事件和持久化尚未获批。正式实现前必须独立完成 Product / Technical Decision Record；本轮 UI 不应作为生产能力存在的证据。

Stripe sandbox 的外部接入证据仍是独立门禁，不在本任务中扩大权限或以 Demo 替代。
