# OpenOutreach → MarkOrbit 具体应用研究与产品决策记录 r1

记录日期：2026-10-09（北京时间）
任务：MO-RESEARCH-OPENOUTREACH-20261009
状态：IN_REVIEW；产品方向已记录，完整规格未 APPROVED/FROZEN；runtime gate CLOSED。
基线：MO 新对话交接包（2026-10-08）、Product Master Spec v0.3、Draft PR #1490、D-025/D-030/D-032。
本文是规格审议补充，不替代 M01–M26，也不宣称任何新 Capability/Provider 已部署。

## 1. 沟通原文、结论身份与防遗忘

Owner 本轮指令：

> 我希望不只是表面上或者理念上的借鉴，而是细致到哪些内容应用到哪些具体的环节或功能中。不要范范而谈。按照我们之前定下的规矩，应该把沟通入库，避免谈了忘。
> 另外，我个人对客户画像ICP变成一个capability，以及它从哪些渠道购买联系人邮箱，转为MO的provider。然后其他的三总监看着取舍

上一问题：OpenOutreach 是否有借鉴意义、是否值得研究。

记录规则：

- OWNER_DIRECTION：ICP 作为 Capability 的需求；联系人邮箱供应渠道纳入 MO Provider 评估；必须保存具体映射及取舍。
- THREE_DIRECTOR_RECOMMENDATION：下文各角色的分析与联合建议。它们不是三个独立人员已签署的审批。
- SOURCE_VERIFIED：代码、测试文件或供应商文档可定位的事实。
- PROPOSED：MO 新对象、字段、状态、代码名称、预算和试验门槛；尚待规格审批。
- UNKNOWN：MO 当前 runtime 完成度、供应商实际覆盖/命中率/报价/许可，未经本轮生产验证。
- 上述 Owner 方向不等于模块批准，也不授权购买邮箱、发送邮件或安装运行整个 OpenOutreach。

## 2. 研究范围与固定证据

本轮读取源码及部分测试；未运行上游测试、未安装程序、未购买数据、未向联系人发信。
上游固定研究版本：

- OpenOutreach：2d6b8a063af6ecc68ecb47120be8aaf1390ba464。
- OpenOutFind：a7a2e08653bbc7757eb850a81db9c8db2e363c48。
- OpenOutSend：5614b8021f021f50ae70c5fe5e482f3271dc147c。

OpenOutreach 当前是编排层。pyproject.toml 固定依赖 openoutfind==0.1.24、openoutsend==0.1.36；子仓库 main 研究版本不应被假定与这些发行包逐行相同。采用实现前还须核对发行包对应版本。
主仓库 **main**.py 的 _run 把 find 的 JSON Lines 交给发送端 ingest，再调用 send。MO 借鉴公共交接合同，不照搬自动购买后立即发送的默认行为。

证据目录（路径均指以上固定版本）：

| 证据                                                                          | 实际职责                                                                     | MO 消费点                                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| OpenOutFind/core/pipeline/icp.py（完整路径 openoutfind/core/pipeline/icp.py） | ICPSpec、generate_seed、_seed_keywords；由产品说明和目标市场生成搜索词及条件 | M17 目标客群定义，M22 Capability outcome |
| OpenOutFind/openoutfind/core/pipeline/qualify.py                              | run_qualification、QualifyPending、PendingQualification、理由持久化          | 商机匹配解释与人工审核恢复               |
| OpenOutFind/openoutfind/core/agent_qualify.py                                 | 调用方提供 ICP/判断答案的入口                                                | MO 对话工作台与可恢复审核                |
| OpenOutFind/openoutfind/discovery.py                                          | Lead Finder 查询、person/company 映射、company_key_for                       | 企业/联系人发现，不能替代商标主体解析    |
| OpenOutFind/openoutfind/core/company_cap.py                                   | 每企业候选数量限制                                                           | 同一代理/企业触达额度                    |
| OpenOutFind/openoutfind/enrichment/provider.py                                | Lookup：同步 outcome 或异步 request_id；按原 provider 轮询                   | M23 联系人数据供应适配                   |
| OpenOutFind/openoutfind/enrichment/bettercontact.py                           | BetterContact 提交/余额/轮询/结果状态解析                                    | 第一供应商研究候选                       |
| OpenOutFind/openoutfind/enrichment/lookup.py                                  | 已有邮箱→Hub 缓存→付费查询；保留查询任务                                     | MO 自有缓存→受控付费查询；不采用外部 Hub |
| OpenOutFind/openoutfind/contacts/service.py                                   | 外部 Hub resolve/contribute/share_profiles                                   | 数据外发风险审查；不采用共享回传         |
| OpenOutSend/cold_outreach/leads/ingest.py                                     | lead_id 幂等更新；导入不发送；不重置已开始/结束的会话                        | M09 商机入库与 M15 触达交接              |
| OpenOutSend/cold_outreach/leads/suppression.py                                | 导入和发送前检查退订；规范化地址                                             | M09 ContactPolicy/M15 send-time gate     |
| OpenOutSend/cold_outreach/emails/sender.py                                    | 先记录发送，再记录接收/拒绝事件；thread/message/prompt lineage               | M15 通信证据与 M24 执行回执              |
| OpenOutSend/cold_outreach/emails/delivery_policy.py                           | 区分认证失败、额度、信誉拦截、临时失败、死地址                               | Provider/邮箱降级及联系人状态            |
| OpenOutSend/cold_outreach/core/sending_window.py                              | 发送时间窗；按操作员国家近似时区                                             | 借鉴时间窗机制，MO 显式配置 IANA 时区    |
| OpenOutSend/cold_outreach/emails/steps/follow_up.py                           | 有限跟进；无回复结束追踪                                                     | M15/M17 跟进草稿、停止条件               |
| tests/test_lookup.py、tests/test_provider.py                                  | 查询保留、Provider seam 等测试设计                                           | MO 适配合同验收参考，未执行这些测试      |

源码入口：https://github.com/eracle/OpenOutFind/tree/a7a2e08653bbc7757eb850a81db9c8db2e363c48
发送源码：https://github.com/eracle/OpenOutSend/tree/5614b8021f021f50ae70c5fe5e482f3271dc147c

## 3. 三总监分别审查

### 产品总监

支持 ICP Capability。MO 首先有“商标/申请人/代理/具体服务机会”，而上游主要从一般产品说明寻找 B2B 人员。因此主线应是商标业务事件→机构/申请人候选→客群匹配→正确联系人，不能直接从随机职位人群开始。
优先支持两条 Golden Flow：代理机构开发；有授权来源和可服务路线的续展/维护商机。待售商标潜在买家匹配先研究，其购买意愿不能仅凭行业推定。
借鉴：先发现与解释，再对审核后的高价值候选购买邮箱；“为什么合适”必须可见。
挑战：LLM 的匹配置信度不是成交概率；人多/商标多并不当然等于可成交；付费联系人不是已同意营销的客户。
取舍：已有客户服务、外所业务邮件与陌生开发分开。ICP 不能自动把联系人变成 Customer，也不能自动为代理预创建带权限的 Workspace。
经济指标：每个有效联系人成本、每个正向回复成本、每个有效商机/成交成本；不以邮箱数量为成功指标。

### UI/体验设计总监

普通用户看到“目标客群”“匹配原因”“查找联系人”“预计费用”“触达草稿”，不显示 ICP Capability 或 BetterContact 等平台术语。
入口：Customers 下的商机列表/详情；Work 对话工作台承载编辑画像、审核、费用批准及触达准备；Messages 承载通信。Today 可以提醒待审，不增加新的一级导航。
画像编辑采用对话+结构卡片；人工更改必须生成新画像版本，不在后台静默修改全部历史判断。
商机卡片至少回答：业务机会是什么、为什么现在联系、建议联系谁、证据来自哪里、还缺什么、要花多少钱。
“无法查询”“未找到”“岗位待确认”“邮箱过期”“被抑制”“等待供应商”“费用待核对”是不同状态。中文默认，英文功能一致。
挑战：不给用户伪精确的 93% 成交概率；不要一个“自动营销”按钮合并画像、采购与发送。

### 技术总监

复用 M09/M15/M17/M20/M22/M23/M24；不移植一套 Django/SQLite CRM、队列和邮箱系统。
稳定业务能力和供应商适配分离；输入需要 Workspace、用途、授权数据范围、画像版本和身份解析证据。
Provider 接口借鉴 sync/async 区分、原 Provider handle 绑定、typed errors 和恢复；增加预算预留、实际扣费核对、未知提交状态及数据许可字段。
上游 contacts/service.py 会对外解析/共享联系人；MO 不采用此路径，私人资料不因“共享节约费用”流入第三方或 MarkReg。
挑战：上游只接一个 email finder，不足以证明 MO 多供应商路由已完成；上游 GP 和 synthetic anchors 不构成 MO 的质量证明；Provider verified 不是法律许可、岗位确认或官方商标事实。

联合建议：接受需求，形成 MR-1.5 详细规格；普通 Workspace 的 WS-2.0 开放沿用既有 I-018，需真实验证，不能新增 WS-1.0 发版阻塞。

## 4. 能力边界：ICP 如何成为 Capability

建议新增 DEFINE_ICP（名称暂定），复用已有规格中的 SCORE_OPPORTUNITY、ENRICH_CONTACT、PREPARE_EMAIL。是否复用 runtime 实现需另行代码盘点，不宣称本轮已证明可直接接线。

| 操作                                   | 稳定 outcome                                      | 持久化 Owner                                            | 不应混入                                 |
| -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| DEFINE_ICP                             | 产生有版本、可审核的目标客群候选及匹配标准        | M17 保存已确认的 ICPDefinition；M22 管能力定义/实现版本 | 邮箱采购、发信、真实人员数据凭空生成     |
| SCORE_OPPORTUNITY（增加 ICP-fit 需求） | 候选是否匹配、证据、反证、缺失字段和优先级解释    | M09 保存商机评估引用；M17 持有本次 campaign/context     | 仅用 LLM confidence 宣称商业价值         |
| ENRICH_CONTACT                         | 正确主体下的联系人/联系方式候选及来源、状态、费用 | M09 接纳 ContactEvidence；M23 持有供应依赖/账号         | 自动认定合法可营销、自动建立客户关系     |
| PREPARE_EMAIL                          | 基于已核查业务事实产生可审核的触达草稿            | M15 草稿；M24 准备/审批/执行                            | 编造案件、期限、代理关系和已经发生的对话 |

DEFINE_ICP 输入（PROPOSED）：
workspaceId、objective、targetType（agency/applicant/trading-buyer）、serviceOfferingRefs、jurisdiction/dataset/permitted-use DataGrants、允许读取的自有资产/客户或 Knowledge、已知正反案例（可选）、语言、预算约束。
输出：
icpCandidateId、version、targetType、includeCriteria、excludeCriteria、desiredContactRoles、geographies、industry/companyScale（可选）、trademarkPortfolioCriteria、businessTriggers、evidenceRefs、unknowns、searchPlanCandidate、recommendedVerification、definitionConfidence。
“行业/规模”可以缺失；不因上游有 headcount 字段而强迫商标用户填写。

画像状态（PROPOSED）：DRAFT → IN_REVIEW → ACTIVE → SUPERSEDED/PAUSED。
AI 输出只是 DRAFT。Owner 发布形成 ACTIVE 版本；改动后重新评估受影响未发送候选，旧结果仍保留版本，已经发送的记录不被重写。

ICP-fit 输出（PROPOSED）：
FIT / NO_FIT / INSUFFICIENT_EVIDENCE；criteriaResults；supportingEvidenceRefs；contradictingEvidenceRefs；missingFacts；observedAt；subjectResolutionRef；icpVersion；implementationVersion；reason。
业务时机、可服务性、潜在价值、联系人岗位匹配和匹配置信度分别显示。若后续需数字优先级评分，应发布版本化规则并保留分项；不把原始模型置信度作为成交概率。

能力组合仍是 exactly one Primary，0–3 Supporting，0–1 Critic。ICP 定义、匹配、补全、草稿、发送是不同 invocation/阶段；不能为了完整流程让五项都成为一条 invocation 的 Supporting。
画像数据是业务对象；生成/匹配是能力；上游供应是 Provider；可发布派生方法才可能进入 M21，不把每次 AI 画像直接变成平台 Brain truth。

## 5. 哪些代码应用到 MO 哪个环节

| 上游机制                            | MO 具体落点与动作                            | 必要改造                                                         | 验收                                                       | 建议 horizon                       |
| ----------------------------------- | -------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| ICPSpec / generate_seed             | M17 Work：“制定目标客群”→确认条件卡片        | 加商标组合、服务可交付性、排除条件、画像版本和证据               | 同一画像可用于代理开发和续展，两者不共用错误的业务条件     | MR-1.5                             |
| 逐候选 verdict+reason               | M09 商机详情：“解释匹配/不匹配”              | FIT/NO_FIT/证据不足；反证和未知分开                              | 每个结论可回溯具体证据，缺资料不当负样本                   | MR-1.5                             |
| PendingQualification                | M17/M24 Work：“待确认”→改条件/采纳/拒绝→继续 | 绑定 candidateVersion/icpVersion；改画像使过期审核失效           | 重启仍问同一个候选；新版本不能复用旧批准                   | MR-1.5                             |
| Lead Finder filter/paging           | M23 人员发现→M09 candidate intake            | Data Engine 已给目标企业时优先精确查该企业；先主体解析           | 同名企业/旧岗位不能直接进入邮箱采购                        | MR-1.5 接入规格；供应覆盖 RESEARCH |
| company cap / exclude               | M17 活动配置：“每机构最多 N 位联系人”        | 按解析后的机构，Workspace/campaign 额度和渠道冷却共同约束        | 同一企业多个商标不会触发多封重复营销                       | MR-1.5                             |
| 已有邮箱→缓存→采购                  | M09/M23 “查找联系人”                         | 只查授权自有缓存、检查时效和用途，再预算批准                     | 已有有效邮箱不重复购买；无邮箱仍保留合格商机               | MR-1.5                             |
| sync/async Lookup                   | M23 submit/poll 与 M24 receipt               | 显式 RUNNING/ON_HOLD/UNKNOWN；绑定 credentialRef/providerAccount | 切换 Provider 后旧任务仍由原 Provider 处理                 | MR-1.5                             |
| lead_id upsert / partial success    | M09 ingestion/handoff                        | Workspace+来源+外部ID 幂等；保留版本冲突和部分失败回执           | 导入重试不会重建触达会话、重发或清空已知字段               | MR-1.5                             |
| 导入/发送前 suppression             | M09 联系策略；M15 最后一刻发信 gate          | purpose/channel/scoped permission，抑制优先                      | 草稿生成后退订仍阻止发信；营销退订不误禁法定/案件通知      | MR-1.5（复用已需的基础控制）       |
| sending window / cap / pacing       | M15 审核队列→定时受控发送                    | 显式 IANA 时区；收件方已知时区策略；未知时区明确显示             | Pause/额度不足/窗口外不发送；不因重试突破上限              | MR-1.5                             |
| delivery taxonomy                   | M15 邮箱健康与 M01 集成执行                  | 认证/封禁暂停邮箱；死地址停联系；临时故障可恢复                  | 5.7.x 不把真实联系人永久删掉；SMTP accepted 不显示“已送达” | MR-1.5                             |
| prompt line/version、reply feedback | M17 实验结果；M15 可核对回复链               | 模板/策略版本→Message→Reply→Opportunity/Order                    | 重放不重复计数；不得把外所案件回复当营销转化               | MR-1.5                             |
| GP/BALD/embedding acquisition       | M21 候选选取优化实验                         | 与规则+人工基线比较；隔离合成数据                                | 证明真实有效商机增量与成本收益后再讨论 promotion           | RESEARCH                           |
| 外部 Hub contribute/share_profiles  | 不接入                                       | MO 默认无外部共享；不传私人资料                                  | 所有采购/发现数据目的地可审计，无共享回传                  | REJECTED                           |
| 一键 run→买邮箱→send                | 不作为产品行为                               | 拆开采购批准与发送批准                                           | 定义画像不花采购费，采购完成不自动发信                     | REJECTED                           |

## 6. 实际供应渠道与 MO Provider 取舍

### 源码实证

当前 enrichment/provider.py 的 _providers() 只返回 bettercontact；Hunter/Dropcontact 在注释中作为扩展示例，不是已接入供应商。
BetterContact 的两个用途应分别建供应能力：

- CONTACT_DISCOVERY：/api/v2/lead_finder/async，发现公司中的人员候选；
- WORK_EMAIL_ENRICHMENT：/api/v2/async，以 LinkedIn URL 或姓名+公司域名补全工作邮箱；
- ACCOUNT_BALANCE：/api/v2/account，余额和账单核对。
  目前 OpenOutFind 的 start 使用 profile URL；MO 商标数据多数只有申请人/代理名称，必须先核对企业与目标岗位，不能只传中文姓名碰运气。

OpenOutreach Hub 是另一种联系人交换渠道，不是 BetterContact 的邮箱采购 Provider。实际源码存在 resolve、contribute、share_profiles。它的限制不能证明 MO 有权共享私人数据，故本方案不采用。

### 供应层级

| 来源                     | 已证实什么                                                                                               | MO 决定                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| BetterContact            | 上游唯一邮箱 adapter；官方有发现和工作邮箱 enrichment API                                                | 第一供应商候选，RESEARCH/未启用；通过覆盖、费用、许可和合同验收后才能成为 MR-1.5 implementation |
| BetterContact 下游供应商 | 官方公开列表含 Hunter、RocketReach、PeopleDataLabs、Snov、Datagma、Icypeas、AnymailFinder、UseBouncer 等 | 记录 subprovider/supply-chain 名单；不直接当作 MO 已集成 Provider，不预先接入全部               |
| 自有 Workspace 联系资料  | MO 可有客户/历史通信中联系方式，仍须权限、用途和时效核对                                                 | M09 自有证据；不是虚构的第三方 Provider，不对其他 Workspace 开放                                |
| OpenOutreach Hub         | 上游跨安装查询和资料回传机制                                                                             | REJECTED：不接入，不作为 MO 共享联系人库                                                        |
| 第二家直接供应商         | 本轮没有验证直接 API/报价/许可                                                                           | RESEARCH，等首家对目标区域实测后按缺口挑一家                                                    |

BetterContact 官方 trusted-data-providers 页面（2026-09-20 更新）提供公开名单，并称可以为特定账号排除部分供应商。名单不证明每条联系人都会来自该供应商，真实返回若没有 subprovider 字段须标 UNKNOWN，不能编造来源。

### M23 Provider contract（PROPOSED）

配置：providerCode、implementationVersion、supportedOperations、supportedIdentityInputs、coverageEvidence、accountRef、credentialRef、billingMode、regionPolicy、purposePolicy、retentionPolicy、statusMapping、unitPriceVersion、budgetPolicy、routingPriority、killSwitch。
请求：workspaceId、purpose、candidateRef、subjectResolutionRef、approvedBudgetRef、idempotencyKey（MO 内部）、operation、inputEvidenceRefs。
回执：providerRequestId、provider/account/version、submittedAt、status、email candidate、vendorVerificationStatus、observedAt、creditsConsumed、creditsLeft、currency/actualCost（若可核对）、provenance、许可引用、rawResponseRef、errorCategory。
MO 内部 idempotencyKey 不能让没有幂等能力的供应商 POST 自动幂等；未知提交必须进入 REVIEW_REQUIRED/费用核对，不能盲重提。

关键状态：
PREPARED → BUDGET_APPROVAL_REQUIRED → RESERVED → SUBMITTED → RUNNING → RESOLVED/NOT_FOUND；
额外出口：ON_HOLD、AUTH_FAILED、RATE_LIMITED、PROVIDER_UNAVAILABLE、SUBMISSION_UNKNOWN、CANCELLED、REVIEW_REQUIRED。
“on_hold”保留原任务，补充余额后观察原任务；429 根据 Retry-After；API 故障不是 NOT_FOUND。
邮箱状态与营销政策分别存：供应商 verified / 岗位身份已核对 / 营销政策允许是三个不同事实。

## 7. 当前官方 API 与上游代码的差异：不可直接搬运

官方 Quickstart：运行中 GET 可以返回 202 空 body，只有 status=terminated 表明完成；可采用 webhook；enrichment 单批最多 100。
本轮读取的 bettercontact.py poll_once 直接 .json()，把所有非 terminated 当 running；没有显式 ON_HOLD 类型。MO 需补 202 空 body、on_hold 和未知状态处理。
官方 Credits：提交 POST 不幂等，重试已成功提交可能双扣；余额耗尽运行中 on_hold，原请求不应重提。
源码对 429 的运输层重试包含 POST。MO 应按供应商明确保证和错误阶段设计重试，不能泛化所有 POST 自动安全。
代码可用 email 状态包含 valid、deliverable、catch_all_safe；MO 保留原状态，不把 catch_all_safe 显示为无风险或默认允许发送。
以上是静态合同差异/风险分析，未声称已复现线上 bug。

供应商材料：

- https://doc.bettercontact.rocks/quickstart
- https://doc.bettercontact.rocks/api-reference/credits
- https://bettercontact.rocks/trusted-data-providers/
- https://bettercontact.rocks/pricing/
  阅读日期：2026-10-09；这些材料会更新，生产准入须再确认。

## 8. 成本控制、批准和经济验收

官方当前说明：Lead Finder 单独搜索不消耗 enrichment credits，启用邮箱/电话 enrichment 才消耗；Company Finder 每公司 0.1 credit；人员 profile 查询每命中 0.1 credit；企业 profile enrichment 免费；余额是组织共享。
这不表示所有商机研究免费：LLM、数据服务套餐、主体解析、人工审核、存储和通信均有成本。Credit 不是固定美元价格，不能用上游“1 credit/有效邮箱”直接推导 MO 报价。

建议流程：已有可用联系方式→有权使用的本 Workspace 缓存→画像匹配和身份核对→人工确认购买范围/预算→费用预留→提交→原任务恢复→实际扣费核对。
禁止发现查询顺手开启 enrich_email_address 绕过采购批准。
预算维度：Workspace、campaign、daily、providerAccount、单候选上限；并发要共享 reservation，不凭一次余额查询放行无限任务。
可用采购授权可按批次批准，不强迫每封/每联系人反复弹窗；批准范围明确人数、费用、画像版本、数据范围、有效期。

试验计划（PROPOSED，具体数值未冻结）：

- 代理开发与续展两场景各抽取一组真实、已获准处理的目标；覆盖 CN 名称、海外英文名称和同名冲突。
- 人工核对企业和岗位作为标注基线；禁止把模型自己判定“合适”当真值。
- 比较“规则筛选+人工”与“ICP+解释”，衡量审核耗时、匹配准确、证据不足和错误主体率。
- 只对通过审核且有采购授权的小批量查询邮箱；记录命中、单位成本、错误岗位、陈旧联系方式、失败恢复。
- 另获触达批准再观察正向回复、退订/投诉、有效需求、报价、订单/毛利；无发送许可只做前半段评估。
- 供应商通过不代表 GA：先 INTERNAL→MARKREG_DOGFOOD；普通 Workspace 开放另验收。

基础 acceptance：
无越权查询/资料回传、无未授权采购/发送、无已知重复扣费/发信；
超时未知不重复提交；供应商失效不影响商机列表、画像编辑、已有通信；
所有结果有主体/画像/实现/证据/费用 lineage。
质量/经济数值门槛由基线实测后进入审批，不在本报告伪造已经达到的百分比。

## 9. 三条 MO 实际业务旅程

### A. 代理机构开发（MR-1.5 优先）

1. M20 授权数据识别一个机构及其申请量/服务国家；代理名歧义进入主体核对。
2. M17 定义客群：“有海外交件需求，MO 存在可交付服务与价格的代理”。申请量少但商标交易活跃可有独立条件，不能自动排除。
3. M09 创建 Opportunity Candidate，显示数据截止时间、支持和反证；不自动成为 Customer。
4. ICP-fit 匹配；联系人岗位建议负责人/国际业务，而不是随机员工。
5. M23 按确认机构寻找联系人、预算批准后补工作邮箱；M09 保存岗位/来源/时间/政策。
6. M15 准备基于真实可交付服务的开发信；M24 单独批准受控发送；反馈回 M17。
7. 有有效需求后由 M09 正式转 Customer/Opportunity，M11 报价。获得邮箱不预建带权限 Workspace。

### B. 续展/维护商机（MR-1.5 优先）

1. M20 提供可追溯注册/日期/status 数据；正式期限应由经准入规则计算和核查，不能仅从模型推断。
2. M17 标记潜在业务事件；画像筛选服务范围、目标申请人、现有客户排除与联系人来源。
3. M09 显示“来源记录提示维护需求，待核对”；未知当前状态不能写“您的商标即将失效”。
4. 授权自有联系方式优先；外部查找须匹配权利人/岗位及预算。
5. 草稿不冒充现任代理，不提供未经核实的法律结论。review→approve→send 分阶段。
6. 正向回复进入专业业务 Work/Matter；营销活动状态不能修改商标官方事实。

### C. 待售商标潜在买家（RESEARCH）

M18 已有商标风格/类别/用途标签可以支持目标客群；DEFINE_ICP 生成买家类型候选，ICP-fit 评估企业适配原因。标签匹配只能说明“可能适用”，不证明愿买/需要这个商标。
跨 Workspace 只读获准共享的公开资产，不把卖家私有客户知识与其他企业联系人混合出售。
先做无采购的匹配质量研究；付费联系人和外发需独立规格。该切片不阻塞 WS-1.0 待售单页/询价。

## 10. M01–M26 的明确规格变更点

以下是下轮 16-section 规格的插入点，不伪称 v0.3 已含全部新增内容。

| 模块    | 章节                        | 要增加的内容                                                                                                  |
| ------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| M09     | .04/.05/.06/.08/.12/.14     | ContactEvidence、身份/岗位/来源/时效、用途授权与抑制；幂等候选；人工接纳；复用已有 Opportunity/Contact owner  |
| M15     | .06/.07/.08/.11/.12/.14     | 草稿/批准/等待/发送未知/SMTP接受/退信；退订最后检查；业务邮件与营销隔离；有限跟进                             |
| M17     | .01/.03/.04/.07/.13/.14/.16 | 目标客群→商机审核→采购准备→触达；ICPDefinition/version、逐项解释、真实结果/成本；复用 Growth/Seed/Opportunity |
| M18     | .15/.16                     | 待售商标 ICP 买家匹配研究；不改变 WS-1.0 交易范围                                                             |
| M20     | .08/.09/.10                 | permittedUse=opportunity discovery；字段对外提交范围；授权撤回终止未执行任务                                  |
| M21     | .04/.12/.13/.16             | 人工纠正和回复只是候选学习证据；GP 研究与真实业务真值隔离                                                     |
| M22     | .04/.07/.10/.14/.16         | DEFINE_ICP requirement；SCORE_OPPORTUNITY/ENRICH_CONTACT/PREPARE_EMAIL 复用评估；稳定 outcome 和版本          |
| M23     | .04/.05/.06/.09/.11/.12/.14 | 人员发现/邮箱补全 supply；余额/预算、异步、on_hold、unknown、来源/许可、切换                                  |
| M24     | .06/.07/.08/.12/.14         | 采购和外发是不同授权；版本/人数/费用/有效期绑定；未知提交人工核对                                             |
| M01/M25 | .07/.11/.12/.13/.14         | Provider pause/kill、采购任务核对、campaign 停止、审计和隔离故障                                              |

Canonical planning 的本轮追加：

- Decision Log：D-033（本报告的 Owner 方向、三方建议、未审批边界）。
- Idea Register：I-035（ICP定义/匹配），I-036（联系人 Provider 评估），I-037（主动学习优化），I-038（待售买家匹配），I-039（外部 Hub 拒绝）。
- Roadmap：细化已有 MR-1.5 Growth，不扩大 WS-1.0、不使 WS-2.0 提前 GA。
- Constitution/1.0 Acceptance：现有 provider-neutral、Workspace isolation、controlled execution 规则已覆盖，无本轮新增 1.0 门槛。
  上述编号须在写入时对目标分支末尾核对，冲突时不得覆盖他人记录。

## 11. 版本与开发 Gate

| 切片                                                 | 当前 horizon           | 当前准入                               |
| ---------------------------------------------------- | ---------------------- | -------------------------------------- |
| DEFINE_ICP + ICP-fit explanation + review            | MR-1.5                 | IN_REVIEW，完整规格待批准              |
| 受控联系人补全/采购/恢复（provider-neutral）         | MR-1.5                 | IN_REVIEW，复用评估和供应验证待完成    |
| BetterContact vendor/account/terms/区域质量/费用验证 | RESEARCH               | 未采购、未启用、未承诺 vendor          |
| 草稿/审核/受控发送/有限跟进                          | MR-1.5                 | 依现有 M15/M17，仍需规格批准及通信证据 |
| 普通 Workspace Growth                                | WS-2.0（沿既有 I-018） | MarkReg 证明后另行批准，不由此报告开放 |
| GP/BALD、合成 anchors、搜索词自动优化                | RESEARCH               | 不进 release-critical path             |
| 待售商标买家 ICP 匹配                                | RESEARCH               | 不改变现有 M18 首发范围                |
| 外部 Hub 回传/私有共享与一键自动采购发送             | REJECTED               | 不采用                                 |

现在应完成 M09/M15/M17/M22/M23/M24 涉及小节的完整审批规格。后续实施必须引用实际批准的 Section IDs、owner contracts、acceptance，不依据聊天兴趣直接开 runtime 任务。

## 12. 后续研究应回答的有限问题

1. MO 已有 ICP/评分/Contact/Seed/邮件策略的具体代码 inventory 是否足以复用；逐路径核查后标 PRODUCTIZE/REWIRE/BUILD/DEFER。
2. BetterContact 对中国代理与申请人、海外代理、中文/拼音/别名同名的企业和岗位识别质量怎样？
3. 实际套餐/credit/unit cost、数据保留和许可用途、subprovider 可见性及禁用、资料跨区域处理是否支持 MO 的受控使用？
4. 邮箱 deliverable/catch_all_safe 的来源时效与岗位正确率怎样，遇到 202/on_hold/POST未知如何恢复？
5. ICP 相比规则+人工到底节省多少审核时间、获得多少有效需求；没有商业效果就不扩复杂学习算法。

研究不是无限扩展采购平台。先把一条真实商机从数据证据走到审核、联系人和合法可用的受控通信，证明质量与成本。
