# Site Admin V2：单 Site 经营与收款配置审议

状态：**三总监批准进入 fixture-only Preview 实现**  
Task ID：`MO-SITE-ADMIN-V2-COMMERCE-PREVIEW`  
预期 PR：`feat(site): add site commerce and payment configuration preview`

## 1. 范围与产品真相

允许修改：`apps/site-v1-preview`、`docs/product/site-v1-preview`、Site Preview Playwright。
本任务不修改生产 Site、Workspace、Commercial、Order、Payment、渠道 renderer、数据库或 API。

用户是获得当前 Site 管理权限的机构经营人员。核心任务是：决定当前 Site 展示哪些已授权服务、
如何解释展示价格、选择哪个已授权收款关系，并用对话准备草稿后进入结构化页面审核。

现有合同审计结论：

- `SiteInstallationV1` 是稳定 Site 身份；`SiteConfigurationVersionV1` 按 `siteId` 记录品牌、
  本地化、角色引用、服务和内容版本。
- `SiteRoleReferencesV1` 已分别保留 surface、customer relationship、offer、merchant 和
  fulfillment Owner。Site 所属 Workspace 不自动拥有全部商业角色。
- `SiteServiceAvailabilityV1.pricingPolicyRefs` 是价格政策引用，不是 Site 可任意改写的最终报价。
- `WechatMiniProgramSiteProjectionV1` 仍是 `ResolvedPublicSiteV1` 的 renderer projection；
  不拥有 Site、Customer、Quote、Order、Payment 或 Workspace 权限。
- `CommercialPrice` 是产品、渠道和关系模型下的版本化价格；正式 Checkout 固定 product 与
  price 版本。Site 展示说明不能替代该价格或正式 Quote。
- `Payment` 绑定 Workspace、Checkout、Order、产品和价格版本。支付成功必须来自经过验证的
  provider event；前端回调或成功页不能直接写成成功或结算。

因此 Preview 只增加 Site 级投影 fixture：授权服务展示、营销规则引用、授权收款关系选择及
来源订单只读证据。它不会模拟真实扣款、到账、结算、退款或凭证管理。

## 2. 对象与权威边界

```text
Workspace
|- entitlement -> many independent Site installations
|- authorized merchant relationships (Workspace / Payment owned)
|- customer relationships (Workspace owned)
`- professional service and content sources (owning Product owned)

Site
|- siteId + terminal + independent draft/published versions
|- display service selection and localized display price explanation
|- promotion policy reference granted by its rule owner
|- selected authorized merchant/payment route reference
`- attribution: siteId + channel + page + campaign + source

Quote / Order / Payment
`- remain authoritative owner records; Site only displays exact references
```

MO 自售 Lite/Site 套餐、机构面向直客的专业服务、正式 Quote/Order 价格、优惠活动/优惠券
是四个不同对象。Site Admin 不能编辑 MO 套餐价格，也不能把展示价改写成最终可执行报价。

## 3. 三总监审议

### 产品总监

- “我的 Site”仍是 Workspace 级入口；Site Admin 始终限定当前 `siteId`。
- “服务”管理展示选择、双语说明和参考价格文案，并持续展示产品 Owner 与正式报价边界。
- “设置 > 收款”选择当前 Site 已获授权的 Merchant 与 Provider 引用；禁止自由输入账号。
- 转介/品牌展示 Site 明示真实 Merchant 与履约者，并保留 referral contract 引用。
- 咨询仍是 Lead；订单只读 fixture 必须携带 Site、渠道、页面、活动、Merchant 和 Owner 来源。

### 设计总监

- 概况按“发布与经营准备 → 待处理事项 → 来源经营证据 → 常用操作”组织。
- 服务页面使用来源、展示价、最终价格边界、活动引用四层结构，避免大面积无功能卡片。
- 收款工作台使用设置导航、当前配置、可选授权关系、确认摘要和风险说明。
- 对话式运营是跨页面侧边工作台：保存当前 Site 与页面上下文，产出建议草稿；“应用到草稿”
  与“发布”保持两个明确步骤。
- 桌面保持高信息密度；390px 将配置摘要、选择项和确认操作纵向排列，表格降级为可读卡片。

### 技术总监

- Preview storage 继续按 `siteId` 隔离。服务草稿、收款草稿、启用版本和对话提案不能跨 Site 写入。
- 所有管理 mutation 复用集中 OWNER 校验；VIEWER 与 NONE 直达路径均不可写。
- Merchant 使用授权枚举引用，不接受自由文本或未知 ID；敏感凭证永不进入 Preview fixture。
- 激活收款配置必须明确确认，并只产生 browser-local 配置版本，不产生 Payment 或资金状态。
- AI 提案只能写入 Site draft；不得调用 publish、激活收款、发送消息或公开机构资料。

## 4. 信息架构

| 入口        | 主要问题                             | 主要动作                             | 只读权威信息                              |
| ----------- | ------------------------------------ | ------------------------------------ | ----------------------------------------- |
| 概况        | 当前 Site 能否经营与发布？           | 去装修、服务、收款或咨询             | siteId、版本、待处理事项、归因订单        |
| 服务        | 当前 Site 展示什么及如何解释价格？   | 编辑双语展示草稿、选择授权活动       | 产品 Owner、版本、正式 Quote 边界         |
| 设置 > 收款 | 当前 Site 可使用哪个收款关系？       | 选择授权关系并确认激活               | Merchant Owner、Provider、合同/转介引用   |
| 运营助手    | 如何准备页面、品牌、服务或营销草稿？ | 生成提案、应用到草稿、进入编辑器审核 | 当前 Site/页面/语言上下文                 |
| 数据        | 订单和咨询从哪里来？                 | 查看来源                             | siteId、渠道、页面、活动、Merchant、Owner |

## 5. 状态矩阵

| 状态           | 服务                   | 收款                               | 对话运营                    |
| -------------- | ---------------------- | ---------------------------------- | --------------------------- |
| loading        | 骨架/禁用动作          | 配置读取中                         | 提案准备中                  |
| empty          | 没有授权服务           | 没有授权收款关系，仅展示不可用说明 | 尚无提案，提供任务入口      |
| error          | Owner 引用不可用       | 授权来源不可用，不降级为可编辑账号 | 生成失败保留输入，可重试    |
| permission     | VIEWER 只读；NONE 403  | 不显示确认 mutation                | 可查看历史提案但不能应用    |
| partial        | 部分语言/价格说明缺失  | Merchant 可用但真实渠道未接入      | 提案缺少来源时标注待补充    |
| success        | 草稿保存，发布仍需审核 | 配置版本激活，不代表已收款         | 仅应用到草稿并链接编辑器    |
| stale/conflict | 显示版本差异           | 授权关系撤销时阻止激活             | Site/语言变化后要求重新生成 |

## 6. 状态转换与事件

```text
authorized service reference -> Site display draft -> reviewed Site publication
authorized merchant relation -> Site collection draft -> explicit confirmation -> active demo config
conversation context -> proposal -> explicit apply -> Site draft -> visual review -> publication
visitor source -> Lead or owner Order reference -> attributed read model (never automatic Customer merge)
```

Preview 仅消费/记录本地 `SITE_DRAFT_UPDATED`、`SITE_COLLECTION_CONFIG_ACTIVATED`、
`SITE_OPERATIONS_PROPOSAL_APPLIED` 的等价 fixture 状态；不发生产事件。

## 7. 验收与验证

- 同一 Workspace 的网站与小程序分别修改服务展示、内容草稿和收款配置，互不覆盖。
- 未授权 Merchant ID 无法选择或激活；VIEWER/NONE 无法绕过直达 URL。
- 收款确认只显示“演示配置已激活”，不显示支付成功、到账或结算。
- 订单来源 fixture 保留 Site、渠道、页面、活动、Merchant 和订单 Owner。
- 对话提案只改变当前 Site draft；不改变 published snapshot、收款配置或客户消息。
- 中文默认、英文完整；管理员语言切换不改 Site 内容语言与客户原始业务数据。
- Storybook 覆盖成功、空、部分、只读和错误状态；Playwright 覆盖桌面与 390px 正负路径。

验证命令：focused test/lint/typecheck/build/Storybook、Site Preview Playwright、format、workspace
boundary、scope detector、`task:prepush` 与托管 CI。

## 8. 非目标

不接入真实支付渠道、商户开户、敏感凭证、真实微信登录、生产发布、优惠券引擎、Quote/Order
创建、客户合并、退款或结算。Browser-local fixtures 不能表述为服务端持久化或真实商业状态。
