# MarkOrbit Customer Portal V1.2 — 四岗位联合审议记录

## 任务合同

- **Task ID:** SITE-V1.2-CUSTOMER-PORTAL-MATURE-UI
- **Repository / allowed directories:** `apps/markreg-web`, `tests/e2e`, `docs/product/site-v1.2-customer-portal`
- **Objective:** 在现有设计版内形成成熟、双语、可运行的 Web、H5 与微信小程序适配客户中心；普通客户能看懂业务、下一步和服务入口。
- **Canonical sources:** Site V1 Blueprint / Sites #1234、#1235、#1239、#1324；Customer Relationship、Customer Context、Directory、Gateway/Auth、MarkReg Quote/Order/Matter、Payment、Communication 的既有 Owner 边界；本目录 `BLUEPRINT.md`。
- **Contracts consumed:** 可信登录主体、Workspace-scoped Customer Relationship、enterprise membership / representation grant、per-object grant、MarkReg Quote/Order/Matter projection、document authorization、Communication projection。
- **Contracts changed:** 无。本设计版只增加表现层、fixture 与验收证据，不增加 Owner、共享类型或生产 API。
- **Events:** Preview 内只模拟 `document submitted`、`quote confirmed`、`quote question sent` 的本地界面状态；不对外发送、不收款、不推进正式状态。
- **Expected PR title:** `feat(site): add unified customer portal preview`

## 联合结论

四岗位一致通过“同一授权业务、多渠道表现”的方案。Web、H5 与小程序适配视图使用同一 fixture 对象 ID 与本地 Demo 状态；视觉和导航可因设备不同而变化，Customer、Quote、Order、Matter、Payment、文件、消息和商标事实的 Owner 不变。生产上线仍以前置 Owner 合同、服务端授权和受支持的身份交换为准。

## 产品总监审议

**用户与 JTBD。** 核心用户是偶发登录的个人客户、企业负责人、品牌/法务人员和受授权企业成员。他们需要在十秒内回答“在办什么、现在做什么、向谁求助”，不需要理解 Workspace、Matter 或 Customer Relationship。

**IA 决定。** 桌面保留 `首页｜我的业务｜我的商标｜消息｜我的`；H5 与小程序采用 `首页｜办业务｜进度｜消息｜我的`。报价、订单、资料不拆成后台式一级栏目，而是成为业务和待办的一部分。首页只突出真实待办、正在办理、常用服务与明确标注的 Demo 顾问/助手。

**业务真相。** 访客咨询只生成 Lead Demo 回执；已有客户认领必须经过可信验证；同一平台主体切换机构或企业身份后重新计算可见对象；付款、官方期限和办理结果不得推断。业务详情明确区分服务进展与正式程序，并在没有经核实期限时直接说明。

## 设计总监审议

**成熟度标准。** 采用成熟服务型小程序的品牌首屏、固定服务入口、任务 Hero、运营内容节奏、分组消息与分层账户中心；排除商城、积分、会员促销、虚假评价和没有依据的 Banner。

**跨端设计。** Web 使用高密度侧栏、机构上下文和宽屏业务列表；H5 与小程序使用触屏卡片、底部导航与 44px 以上操作区。三端共享色彩、字号、状态语义、图标/标记、按钮和卡片结构，但不追求像素级复制。

**双语与原文保护。** 中文是默认设计语言；英文覆盖登录、导航、表单、状态、消息、错误和辅助说明。人名、企业名、商标名、申请号、对象 ID、文件名与原始证据不翻译，切换语言也不重置草稿或业务状态。

## 技术总监审议

**授权顺序。** 每次读取均按 `trusted subject + Workspace + Customer Relationship + representation grant + object grant` 收敛。业务详情只能由已经过该过滤的列表对象打开；URL 中的 ID 不产生权限。登出后不渲染敏感 shell 或业务内容。

**渠道真相。** H5 使用 MO Web 登录语义；小程序 Preview 使用“已绑定 Demo 身份”语义。浏览器 `localStorage` 只用于演示同一浏览器中的连续操作，不证明跨设备会话、服务端持久化、微信 openid/unionid 绑定或生产客户合并。

**生产依赖。** 上线需要 Gateway/Auth 的域/渠道会话交换、经审核的微信官方身份适配与账号关联、关系 Owner 的邀请/认领合同、对象授权投影、企业授权撤销时效、审计文件上传和 Communication 发送合同。当前实现不触碰这些生产边界。

## UI 设计师审议

**首页。** 品牌与身份上下文、唯一主待办、五个常用入口、在办业务、Demo 顾问、服务指南和边界明确的 MO 助手形成完整服务首页；无装饰性访问量 KPI。

**五个主页面。** 办业务用适用场景解释服务；进度卡同时给出状态、更新时间、下一步和来源提示；消息按业务进展/资料/顾问分层且回到准确对象；我的按身份、服务、业务资料、账户安全分组；退出登录为显式操作。

**详情与动作。** 业务详情包含稳定对象 ID、通俗状态、正式程序、时间线、来源与期限声明。资料提交与报价确认保留 exact Matter / Quote 引用、服务范围、费用明细、Demo 成功回执；Loading、Empty、Owner error、Permission denied、Partial data、Signed out 由 Storybook fixture 覆盖。

## 状态转换与负向规则

```text
VISITOR -> LEAD_ONLY (咨询，不升级客户)
VERIFIED_SUBJECT -> ACTIVE_RELATIONSHIP -> AUTHORIZED_OBJECTS
ACTIVE_RELATIONSHIP -> SWITCH_RELATIONSHIP -> RECOMPUTE_AUTHORIZED_OBJECTS
DOCUMENT_PENDING -> SUBMITTED_DEMO -> SAME_OBJECT_UPDATED
QUOTE_PENDING -> CONFIRMED_DEMO | QUESTION_SENT_DEMO
ACTIVE_SESSION -> SIGNED_OUT -> NO_SENSITIVE_PROJECTION
EXPIRED/REVOKED_GRANT -> DENY + HIDE_PROTECTED_OBJECTS
```

直接旧链接、未验证手机号、同名同号线索、另一客户 ID、另一 Workspace ID 或未授权业务 ID 均不能绕过上述序列。

## 验收与验证

- 中文、英文的 Web、H5、mini 六个入口可独立打开。
- 五个移动主页面、业务详情、资料提交、报价确认、登录/身份选择、空态、错误态、权限态、部分数据态和退出态均可复核。
- Web → mini → Web 保持 exact Matter / Quote / Order ID 与 Demo 完成状态；明确这只是同浏览器 fixture 连续性。
- 同一自然人的两个 Workspace、同一 Workspace 的两个客户、企业成员的对象 grant 均 fail closed。
- 390 × 844 无横向溢出，操作区、文字换行、首屏顺序和底部导航完成浏览器验收。

验证命令：

```bash
pnpm --filter @markorbit/markreg-web lint
pnpm --filter @markorbit/markreg-web typecheck
pnpm --filter @markorbit/markreg-web test
pnpm --filter @markorbit/markreg-web build
pnpm --filter @markorbit/markreg-web build-storybook
pnpm exec playwright test --config playwright.customer-portal-v1-preview.config.ts
```

## 非目标

不重构生产 Auth，不实现原生微信登录，不创建第二套 Customer/Order/Matter/Payment/Trademark truth，不接真实支付、生产客户数据或真实对外消息，不把 Demo 顾问、AI、响应时间或本地持久化描述为已上线能力，不修改 PR #1440 的既有边界。

## 浏览器验收证据

以下 PNG 由 Customer Portal Playwright 验收在真实 Chromium 页面中生成，不是设计工具静态拼图：

- `evidence/web-desktop-home-zh.png` — 桌面网站中文首页
- `evidence/h5-390-home-zh.png` — 390 × 844 H5 中文首页
- `evidence/h5-390-business-detail-zh.png` — 390 × 844 业务详情与来源/期限说明
- `evidence/mini-390-messages-zh.png` — 390 × 844 小程序消息中心
- `evidence/mini-390-profile-zh.png` — 390 × 844 小程序“我的”

自动化同时验证 390px 无横向溢出、五个底部触控入口、对象级详情访问、错误 URL ID 不产生权限，以及 revoked 企业成员不显示受保护业务。
