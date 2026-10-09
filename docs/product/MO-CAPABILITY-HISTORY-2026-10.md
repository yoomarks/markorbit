# MO Capabilities 历史讨论、设想与设计汇编 — 2026-10-09

记录日期：2026-10-09（Asia/Shanghai）
性质：历史恢复与来源核对；本文件不新建 Capability Canon、不改现有实现，不替代具体业务规格。
代码核对基线：yoomarks/markorbit@86715f76d4a5b33839f431e4996a8a00b21c7918。
关联：Brain 历史与三总监规划 Draft #1495；Lite Creator 规划 Draft #1494；ICP / 联系人 Provider 研究 Draft #1491；产品评审记录 Draft #1490。

此前 Capability 讨论同时包含：人的专业/经营能力成长、可供产品复用的稳定业务能力、受治理的运行时、Skill 与实现选择、专业贡献网络，以及从真实工作到方法/能力升级的反馈。只恢复 Runtime 或列几个 AI 功能，会遗漏大半原始构想。

本次保留原始设想及后来限制它们的决策。目录中“历史设想”“已经合并的限定实现”“Owner 实际批准”“规格/供应仍待审”分别有来源，不相互替代。

## 1. 本次找回的范围与明确缺口

| 来源范围             | 本次结果                                                                        | 读取/核对方式                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 历史原文件           | 57 份不同文本；其中 28 份沿用上一轮 Brain 已读来源，新增 29 份                  | 新取回 31 个文件副本的所有续页；2 组同内容副本合并，副本身份保留在索引。逐块连续行数核验通过                                  |
| 项目文件目录         | /有标国际商标平台 170 个文档条目；/MO 开发 之 136 个文档条目，均到末页          | 检索 Capability、能力、Skill、Provider、ICP、Capability Canon、Capability Twin，以及相关章节/标题；目录中无关文件不进入资料包 |
| GitHub 讨论发现      | 去重后 346 个 Issue、343 个 PR                                                  | Capability 单词查询分别 326/333，4 页到末页；补搜 capabilities、Skill、ICP、能力。每次检索 incomplete_results=false           |
| 有评论的 GitHub 线程 | 161 个 Issue、42 个 PR，共 203 个线程；558 条评论/审查记录                      | 对本次命中集合里所有有评论的线程取回完整评论；主文重读关键决策，全文和索引一起归档                                            |
| 仓库文件             | 13 份 Capability 架构/规划/界面/生产检查点文件，另核对 AGENTS 与 #1490 评审索引 | 固定 main SHA；旧文档里的状态按其日期解释。#1490 为独立 Draft，另固定其 head                                                  |
| 当前反馈             | v0.3、v0.4 实际勾选、2026-10-08 handoff、ICP 研究、Brain/Creator 最新汇编       | 用于识别已批准原则与尚未同步的规格，不反向覆盖历史原文                                                                        |
| ChatGPT 跨会话原文   | 本轮检索两次均返回 conversation search error，没有恢复到旧聊天全文              | 将此列为缺口。当前会话可见原文可直接记录；历史文件不冒充聊天逐字稿                                                            |

这里的“找回”表示上述可访问资料及检索命中集合已取回，不表示所有过去的 ChatGPT 会话、删除的文件、未命中关键词的讨论都已穷尽。GitHub 命中包含相邻产品/工程讨论，不能把 346 个 Issue 或 343 个 PR 当作能力数量。558 条包含 PR review 记录；7 个关键 Issue 另取原始带日期评论，作为日期补证，不重复计数。

资料包中的 PDF 为已取回的提取文本，文档为当前取回的文本；它们不是原 PDF 的二进制复制，也不保证字节等同最初保存版本。源文件建立/修改时间是文件时间，不自动等于讨论或批准时间。未知历史版本号保持未知。

## 2. 最值得重新读的原始文件

| 来源                                                         | 恢复了哪些具体讨论                                                                                                               | 阅读重点                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| C03 — MarkOrbit_Capability_OS_Strategy_Summary.md            | Capability、Skill、Reflection、Case、Principle、Ledger、Master Skill/Twin、Session Receipt、Context Compiler、模型路由、外部入口 | 最完整的早期能力飞轮；后来的边界修订不能让这些功能价值消失                    |
| C07 — 04_CAPABILITY_FRAMEWORK.md                             | 12 个专业能力域、L1–L5、M0–M5、模拟/影子/监督生产、三层资格、贡献网络、美化审核链                                                | 包含人的专业能力培养，不只是机器执行；“约 300 项”是旧规划数量                 |
| C08 / C30 — Business Capability Map v1.0 / v2.0              | 10 个经营能力域、Founder、Master Capability、经营 Twin                                                                           | v1.0 是 498 行详细稿；v2.0 是 28 行概要。不能因文件名 v2.0 就丢掉 v1.0 的细节 |
| C29 — MO_Capability_Engine_Whitepaper.md                     | Collect → Reflect → Evaluate → Merge → Verify → Version → Release                                                                | 34 行提纲，不能用它替代详细合同                                               |
| C06 — MO_Dual_Track_Capability_Distillation_Strategy.md      | 完整保留一个来源思想体系；另从真实业务问题横向综合；作者原论与 MO 评论分离                                                       | 来源型 Source Model/Skill/Atoms 是研究表达，不自动生成运行时 ID               |
| C31 — B04-CH-15_Capability_Discovery_and_Skill_Selection.md  | Capability/Skill 区别、逻辑目录、发现/匹配/资格/选择/调用、成本/数据路线/质量/本地 Skill/替代路线                                | 2,032 行；组织偏好只能排序合格实现，不能把不合格实现变合格                    |
| C38–C41 — B04 CH16–CH19                                      | Assistant/Guide/Agent；Value Candidate/NBA；Prepared Action；人工审核及 Owner handoff                                            | 防止把一句“建议”、一个 Agent 或一次调用当作正式业务执行                       |
| C32 / C33 — AI Capability Migration Guide / MainRepo Handoff | Knowledge 通用 AI/邮件基础能力如何转入共享 Capability；领域语义留在 Knowledge                                                    | 逐条迁移、并行校验、保留回退；不是一次性搬空 Knowledge                        |
| C34 — Social Runtime Capability Harvest Plan                 | 账号/浏览器隔离、平台 Adapter、AUTH/RISK/WRITE_UNCERTAIN、发布证据与恢复                                                         | 以具体行为吸收参考程序；未知提交不自动重试；许可证限制保留                    |
| C35 / C36 — Foundation/TSDR 交接                             | 当前事实与文件证据进入方法/能力的路径、Discovery 层级、生产启用证据                                                              | 交接稿未合并项是当时状态，需要后续 PR/当前 main 校正                          |
| C42 / C43 / C48 — Lite 定位与案例中心/轻量 Workplace         | Today、Work、真实任务、案例、私人能力积累、产品入口                                                                              | 历史定位几次变化都保留，不只留下最新一句产品口号                              |
| C45 / C46 / C50 / C51                                        | 泰国商标 Skill；MOKI 审计和交接                                                                                                  | 具体 Skill/程序案例，不能仅凭文件包/版本名宣称已成为共享生产 Capability       |
| C52–C56                                                      | Founder OS；Resource/Need Profile；贡献协作；旧决策/风险；Value Factory；Crawl                                                   | 商业能力、人与机构资源、联系人来源、信息理解/价值/行动之间的原始分工          |

完整 57 份清单在附录 A，原文本和来源索引在资料包内。

## 3. 历史变化链：保留过程，不把旧状态当今天

| 阶段/依据                                                                  | 当时讨论或实施了什么                                                                                                                                | 今天应如何理解                                                                            |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Round 2.1–6、Canonical Context Map、Book03/04 草稿（C02、C12、C22–C28 等） | 独立产品/Workplace、共享基础、能力与 Skill/Agent/Workflow、私有主权与正式 Execution                                                                 | 文件记录的是当时工作基线；各章 Draft 不自动等于现行发布合同                               |
| 7 月战略文件（文件时间见附录 A）                                           | Capability OS、经营能力地图、12 专业域、模拟实训、案例原则、能力贡献网络                                                                            | 恢复长期愿景和功能候选；旧分数/认证/所有权表述另见第 5 节校正                             |
| 2026-08-12～13（上海时间；PR #84/#86–90 创建于 UTC 08-11～12）             | M6 六包：合同/权威、durable registry、Observation/Ledger、私有 Reflection Candidate、显式 disposition/Profile/Twin、authenticated Capability Center | 已有学习基础不能被“Capability 尚不存在”这种判断抹掉。PR 创建时间不是验收时间              |
| 2026-08-25，PR #197 / #198；C32/C33                                        | Foundation 规划及 V2 最小调用合同；AI/邮件作为通用结果能力，SDK/Hub 为实现                                                                          | gap 是共享绑定与调用，不是从零再造一个能力体系                                            |
| 2026-08-26，PR #245                                                        | Runtime 从 fixture 演进；closeout 为 SINGLE_CONSUMER_PROVEN                                                                                         | 这是当时快照，FOUNDATION_REUSABLE 尚须独立消费者证据；不能把旧标签永久当当前状态          |
| 2026-08-27，#276 / PR #284                                                 | Brain 研究与编译方法，Capability 执行，产品持有业务结果；Knowledge/DE 源所有权                                                                      | 用这次接纳的分工纠正早期“Core 包办/Brain 包办”的图，不删原始研究诉求                      |
| 2026-08-30（上海时间；UTC 08-29），#307 最终验收                           | Resolver、Analytical、Scoring/Interpretation、Discovery 四类限定试点完成                                                                            | 每类仅证明相应试点；并不证明全行业预测、法律判断、商机发现都完成                          |
| 2026-09-01～05，#392                                                       | 来源成熟度、精确输出指纹、政策/时效、consumer admission、实时通信/运行可达性；后来改为需求与证据驱动                                                | 健康目录、Replay、source-admission、产品适用性、真实消费者完成度是不同证据                |
| 2026-09-09，#1074 / PR #1090                                               | 同一能力按 Workspace 选不同已批准 Implementation Profile；#1071/#1078 为解析/持久化先行                                                             | 已证明限定 Workspace 路由；该任务明确未扩展模型选择器、BYOK、本地模型部署、继承或市场     |
| 2026-09-09，#1075 / PR #1091                                               | Capability Tree/Wall，从 HOLD → ACTIVE PLANNING；发现缺逐槽映射后撤回，再补 80 行 ledger                                                            | HOLD 是排序，不是永久否定；最终产物仍 PLANNING_ONLY / NON_CANONICAL                       |
| 2026-09-09，#1092 / PR #1097                                               | Workspace-local Trademark Change Interpretation 的产品限定复用验证                                                                                  | owner/reuse audit 为 REUSE_SUFFICIENT / NO_DEPENDENCY_REQUIRED；不是新造全域商标能力      |
| 2026-09-15，WIF #1249/#1272                                                | 私有方法/知识绑定、currentness/revocation 相关边界                                                                                                  | 有 binding 不自动证明知识 CURRENT，需独立时效权威及权限检查                               |
| 2026-09-19 上海时间，PR #1353、C35                                         | Discovery 层级对齐；TSDR/文书源链路交接                                                                                                             | domain opportunity family 是设计分支，不是另一个 Canon 层级；交接中的 open PR 要后来核实  |
| 2026-10-07～08，PR #1487、当前 main                                        | 可运行的私有复盘 preview，证据→决定→实践画像→轨迹，含旧版冲突/手机/无障碍                                                                           | Preview/browser fixture 证明界面行为，不能称生产认证或真实业务结果                        |
| 本次 v0.4 审阅稿核对                                                       | M22、M23 实际 Owner Approval 勾选 APPROVED；M21 勾选 CHANGE REQUESTED                                                                               | 保留真实批准与修改意见；不要只看页眉 IN_REVIEW，也不要据此给新 ICP 字段/供应/动作全面授权 |

日期补证保留原 UTC，主文按上海日期理解。#307 的最终评论为 2026-08-29T16:55:42Z；#1075 四条关键评论为 2026-09-09T12:35:43Z～15:13:03Z。

## 4. 当前应保留的核心语义

### 4.1 一个定义、四层关系、三条生命周期

现有 AGENTS 与已接纳 Canon 固定：

Capability = Stable Outcome Contract + Governed Implementation + Evidence Base + Version Lineage + Controlled Evolution。

层级为 Domain → Capability → Skill → Action / Invocation。一次 composition 恰好 1 个 Primary、0–3 个 Supporting、0–1 个 Critic。

| 生命周期 | 历史/当前表达                                                                                                                              | 功能意义                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 生产     | Source → Distillation → Source Capability                                                                                                  | 从来源思想、规则和实践形成候选，再评估/接纳；不把刚提取的 Prompt 直接发布 |
| 运行     | Request → Eligibility → Composition → Context Compilation → Implementation Binding → Execution → Review → Outcome → Return/Session Receipt | 在当前 Workspace、用途、数据、权限、预算和审核条件下交付一次结果          |
| 演化     | Outcome → Reflection Candidate → Evaluation → Change Proposal → Version → Release                                                          | 结果成为待核对证据，再产生受控版本改变，不自动改 Canon                    |

“实现成熟度”“模块需求审批”“来源成熟度”“Method 生命周期”“Capability Canon 生命周期”不能合为一个总状态。

### 4.2 各层真正负责什么

| 对象/层                        | 具体职责                                                                       | 消费/落点                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Knowledge                      | 可引用文献、原始来源、标准化内容、版本与来源链                                 | 提供研究/私有授权上下文；不以知识获取自动决定业务结论                          |
| Data Engine                    | 官方/外部事实、历史、bounded query、可复现数据集                               | 给研究提供样本，给运行提供当前事实；不持有 MO 私有商机运营池                   |
| Brain                          | 研究、评估、编译可复用方法及研究产物                                           | ordinary request 执行已接纳方法；不在每次业务请求重跑全套研究                  |
| Capability Engine              | 稳定定义投影、资格、组合、Context、实现绑定、调用、结果/回执、现有私有学习循环 | 被 Lite/MarkReg/Sites 等通过合同消费                                           |
| Skill / Implementation Profile | 可替换、版本化、可测试的具体实现及其数据/质量/成本/失败路线                    | parser、模型、工具、人工或混合路线；两者表达有关联但不能简单按字段一一强制等同 |
| Provider / Adapter             | 实际供应者、账号、凭据、协议、价格/配额/状态、供应返回                         | 被批准的实现使用；名字不成为业务 Capability ID                                 |
| Agent                          | 在身份、Agent Contract、权限和目的下运行的角色，可使用多个 Skill               | 一个 Agent 不是所有能力和数据的通行证                                          |
| Workflow / Execution           | durable 多步协调、review/approval、受保护动作、幂等和证据 handoff              | Skill 不能通过隐藏副作用私自变成完整工作流                                     |
| Product / Domain Owner         | 客户、商机、草稿、Quote、Matter、Order 等正式业务状态与界面                    | 接纳候选、保存引用、运营和验收；不复制供应基础设施                             |

Resolver/Analytical/Scoring/Discovery 分类描述执行方式；Business Map 的经营域、专业地图的任务域、M22 的管理分类是其他观察维度，不另外改变四层 Canon。

### 4.3 Domain Pack、外部暴露与媒体能力也曾分别讨论

| 设计                            | 恢复的具体内容                                                                                                                                                                                                                                                                                                                                                                          | 已有证据与限制                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain Pack V1                  | versioned manifest 引用 ontology、来源/真相、Knowledge、规则、Workflow、Capability、Provider、Evidence、benchmark 和产品 presentation；引用含 owner/id/version                                                                                                                                                                                                                          | PR #1060 与固定 main 设计。是声明式域映射，不能安装任意代码、注入导航或创建第二套 owner；接受 pack 不改变被引用对象状态                                                           |
| External Capability Exposure V1 | 对外能力默认 NOT_EXPOSED；READ/PREPARE/EXECUTE 只是映射现有授权与 Execution 边界的展示类别；另核对 consumer scope、输入/输出、权限、数据/预算                                                                                                                                                                                                                                           | PR #1063 与固定 main policy。合同没有直接启用公开 MCP server、SDK/API、Provider、路由或计费；不能从“支持 MCP/API”推导全部能力对外开放、任意调用和写回                             |
| Voice / Avatar                  | PR #1056：voice.synthesize@1.0.0 将文字/内容 Owner 输入转为 AudioArtifact，绑定 VoiceProfile、MediaRightsBinding、调用与结果引用；clone 为 GATED_UNAVAILABLE，STT/transcription 不在范围。PR #1057：avatar.renderSpeech@1.0.0 从精确音频引用生成 ClipArtifact；avatar.renderExpression@1.0.0 接收限定表达意图；avatar.stream 为 FUTURE_UNAVAILABLE；最终 renderVideo 留给内容组合 Owner | 该阶段是合同基础。合同与 fixture 不能证明真实声音/数字人 provider、人物权利或生成质量已验收；不能从这些操作推导 Provider adapter、生产 API/UI 已启用。创作产品细节见 Creator 汇编 |
| M22 六类管理视角                | Understand/Extract、Search/Analyze、Generate/Transform、Score/Recommend、Communicate/Present、Fulfill/Handoff                                                                                                                                                                                                                                                                           | v0.4 M22 的库存管理分类；没有新增普通用户导航，也不把 Payment/Matter/Customer 等 owner 并入 Capability                                                                            |

这些设计与经营/专业地图并存；下一轮不能把 Domain Pack 当新插件市场，把 Voice/Avatar Provider 当用户专业能力，也不能因没有完整产品旅程就否定其已有合同基础。

## 5. 不能丢掉，也不能原样当已完成的旧设想

| 旧设想                                      | 原来细节                                                                       | 本轮恢复的处理方式/变化依据                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Capability OS 而非 Prompt 收藏站            | 记录使用、修改、业务结果、复盘、案例、原则、版本原因（C03）                    | 保留价值目标。当前正式定义仍五组成 Canon；不把“OS”作为新增技术子系统                              |
| Capability Twin / Founder Twin              | 用户能力、偏好、案例、原则、历史；经营者四阶段（C03/C08/C30/C52）              | 保留私有实践画像。M6 Beta 禁止公共排名、专业分数、验证徽章、自治身份/执行权                       |
| Skill XP / Capability Level                 | 曾建议首次调用、复盘、外部结果、验证案例不同 XP（C03）；L1–L5（C07）           | 明确保留为历史培养设计。现有私有 Profile/Twin 合同不启用专业数字分；不能把 XP 示例当已批机制      |
| Master Skill / Master Capability            | 复杂目标动态组合，而不是超长 Prompt（C03/C08）                                 | 保留编排价值；“一个完整业务流程”不能塞进一次 composition，仍受 1+0–3+0–1 和各阶段审批约束         |
| Source 纵向精馏 + 问题横向综合              | 保留作者完整模型；多个框架为真实问题综合（C06）                                | 两条线都保留。Source Model/Skill/Atoms 为研究候选，落地须映射已有 Method/Capability 合同          |
| 从真实结果改善能力                          | 收集用户修改、采取方案、结果、反例；Case/Principle（C03/C29）                  | 保留。草稿被采用、收到回复、完成订单、官方受理是不同事实；Reflection 接受不等于专业验证           |
| 12 个专业域、约 300 单元                    | C07 的能力培养/协作地图                                                        | 保留研究范围；M22 改为批准旅程产生需求，不先铸造 300 个 Canon ID                                  |
| 人类专业贡献网络                            | 核验、分析、视觉/品牌/内容审核、知识、实训、MarkReg、专家、MGSN（C07/C53）     | 不因纯软件 Runtime 完成而删除。具体个人任务准入、收益/责任和产能安排仍须独立规格                  |
| 三层资格                                    | Certification、Production Authorization、Professional Qualification（C07/C54） | 严格分别核对；不能用付费、管理员标签或 AI 结论生成法定资格                                        |
| Simulation → Shadow → Supervised Production | 动态客户分支、证据不合格、费用异议、主体冲突，8 类考核维度（C07）              | 保留长期训练路径；模拟效果是否预测真实能力仍是 C54 明列的待验证假设                               |
| 私人/本地 Skill                             | 私人定价、机构起草、客户校验、本地检索和数据库分析（C31）                      | 保留；可以只共享元信息、版本、可调用性，不能强迫上传私有内部实现                                  |
| 受控 Resource/Need/Capability 投射          | 人/机构能力、客户、知识、审核、产能；推荐、白标、共同交付、专家审核（C53）     | 保留；投射不转让客户关系，不从匹配分自动任命服务商                                                |
| “授权能力不按次收费”                        | C07/C54 提出培训/评审/真实人工收费，并列 AI 高成本开放问题                     | 不概括成无限免费。保留订阅/合理使用/队列/高成本确认，与 M23 usage/billing 分层研究                |
| DeepSeek 基础、高级模型按需                 | 简单提取/分类/复盘与复杂 OA/多国策略区分（C03）                                | 保留替代路线的成本论证，历史的低价/访问判断不当本轮现价事实；用当前实测质量/成本准入              |
| ChatGPT/Claude/MCP/国内平台入口             | 用户在熟悉入口调用 Skill/Case/Principle，Session Receipt 回写（C03）           | 保留 external-consumer 方向；外部平台账号不当然免 API 费，回写也不能自动加 XP/改 Canon            |
| Skill/Capability 更新惠及产品               | 版本从真实失误/过期规则演进（C03/C29）                                         | 保留受控升级；版本接纳、兼容、旧结果保留、回退都要明确，不能一发布强制更新高风险路线              |
| Value Factory 保存统一 Value Object         | 信息→Knowledge/Insight/Opportunity/Risk/Task/Content/Trigger（C55）            | 保留跨任务价值发现；“Brain 保存一切 Value”被后来 owner 分工收紧，候选生命周期由产品持有           |
| Crawl 的机构能力证据                        | 采集外所服务范围、团队、新闻、FAQ、案例（C56）                                 | 保留为来源 evidence；网站声称不直接形成最终能力评分，Crawl4AI 是 acquisition Provider             |
| 商标 AI 美化多专业审核                      | 元素识别→候选→视觉→商标连续性/风险→品牌商业化→客户选择→正式/概念版（C07）      | 保留完整打法。一般美图效果不能证明适合商标，更不能改变官方图样或登记真相                          |
| Capability 大多对用户隐形                   | Outcome、证据、下一步呈现在产品工作中（当前架构/M22）                          | 本轮不删既有 Center/Reflection 功能；新工作应嵌入用户任务，专业/运维 inventory 与普通导航分别设计 |

## 6. 三份能力地图各自包含什么

### 6.1 经营能力地图：十域（C08/C30/C52）

| 域        | 原讨论的具体内容                                                                 |
| --------- | -------------------------------------------------------------------------------- |
| Vision    | 方向、愿景、使命、价值观、战略、创业机会、长期规划                               |
| Brand     | 定位、人格、故事、商标布局、品牌资产、一致性、护城河                             |
| Product   | 需求、定位、MVP、设计、矩阵、生命周期、定价、迭代                                |
| Market    | 市场分析、用户画像、渠道、内容、广告、增长、竞争                                 |
| Sales     | 销售、报价、谈判、成交、CRM、复购、转介绍                                        |
| Operation | 流程、SOP、项目、OKR、效率、风险、执行                                           |
| Finance   | 现金流、成本、利润、预算、融资、税务、风险                                       |
| People    | 招聘、培养、激励、文化、管理、领导力、梯队                                       |
| Expansion | 全球化、知识产权、授权、投资、第二增长曲线、国际化                               |
| Founder   | 决策、学习、时间、表达、情绪、思维模型、领导力、影响力、健康；四阶段调用不同能力 |

这是长程经营范围，不是 Lite 首发必须完成的十模块。

### 6.2 专业能力培养地图：十二域（C07）

客户与业务开发；商标检索与数据分析；品牌命名与策略；商品服务分类；申请准备与提交；审查/异议/争议；注册后维护；国际方案/报价；商标交易/资产运营；营销内容/商业化；运营/质量治理；全球协作/专业网络。

每域原来同时考虑熟练程度 L1–L5、协作模式 M0–M5、人工深度 A0–A4、知识/数据/工具依赖、考核和证据。它不是当前 Runtime 四层 Canon 的替换层级。

### 6.3 商标专业任务树：十域八项（#1075 / #1091）

下面 80 项是 V0 规划槽位原文语义的中文转述；TM-PRO-* 是 slot ID，不是正式 Capability ID。V0 ledger 的 Canonical 列 80 行均 EMPTY；它另有 CURRENT_PARTIAL / ROADMAP_ONLY / EMPTY 覆盖状态。二者不能混淆：没有 Canon 映射不等于产品里完全没有支持代码。

后来的变更、WIF、渠道/文档/生产消费实现可能改善覆盖，V0 文件不构成 2026-10-09 全部实时状态审计。完整 80 行逐项记录当前 MO Base、Brain、Knowledge/Data、Skill/Execution、产品、Cordis、置信和缺口的原文固定链接见附录 B。

| V0 任务域                     | 槽位          | 具体功能                             |
| ----------------------------- | ------------- | ------------------------------------ |
| A. Intake / 组合上下文        | TM-PRO-INT-01 | 建立 Workspace 商标资产锚点          |
| A. Intake / 组合上下文        | TM-PRO-INT-02 | 捕获申请人、权利人、客户身份上下文   |
| A. Intake / 组合上下文        | TM-PRO-INT-03 | 目标国家/地区和申请/服务目标         |
| A. Intake / 组合上下文        | TM-PRO-INT-04 | 图样及原始商品服务描述               |
| A. Intake / 组合上下文        | TM-PRO-INT-05 | 批量资产导入与去重                   |
| A. Intake / 组合上下文        | TM-PRO-INT-06 | 来源时效、冲突和缺项                 |
| A. Intake / 组合上下文        | TM-PRO-INT-07 | 补充信息/证据清单                    |
| A. Intake / 组合上下文        | TM-PRO-INT-08 | 与来源官方事实对照，供人工核对       |
| B. Search / 检索与排障        | TM-PRO-CLR-01 | 注册库相同/近似相同排障检索          |
| B. Search / 检索与排障        | TM-PRO-CLR-02 | 视觉、读音、概念近似检索             |
| B. Search / 检索与排障        | TM-PRO-CLR-03 | 商品服务及类别交叉分析               |
| B. Search / 检索与排障        | TM-PRO-CLR-04 | 权利人、关联主体、申请模式审阅       |
| B. Search / 检索与排障        | TM-PRO-CLR-05 | 未注册使用、网页、市场等外部证据研究 |
| B. Search / 检索与排障        | TM-PRO-CLR-06 | 有证据的 clearance 风险综合          |
| B. Search / 检索与排障        | TM-PRO-CLR-07 | 检索报告和方案准备                   |
| B. Search / 检索与排障        | TM-PRO-CLR-08 | 专业复核及继续/修改/停止选项准备     |
| C. Filing / 申请策略和准备    | TM-PRO-FIL-01 | 新申请的国家/路线策略                |
| C. Filing / 申请策略和准备    | TM-PRO-FIL-02 | 图样/mark representation 策略        |
| C. Filing / 申请策略和准备    | TM-PRO-FIL-03 | 申请基础/申请资格事实审阅            |
| C. Filing / 申请策略和准备    | TM-PRO-FIL-04 | Nice 类别及商品服务规格策略          |
| C. Filing / 申请策略和准备    | TM-PRO-FIL-05 | 官费及申请成本事实准备               |
| C. Filing / 申请策略和准备    | TM-PRO-FIL-06 | 要求和支持文件清单                   |
| C. Filing / 申请策略和准备    | TM-PRO-FIL-07 | Provider、服务包、报价准备           |
| C. Filing / 申请策略和准备    | TM-PRO-FIL-08 | 申请包就绪性及受保护 filing handoff  |
| D. Prosecution / 审查答复     | TM-PRO-PRO-01 | OA/审查通知入库和源核验              |
| D. Prosecution / 审查答复     | TM-PRO-PRO-02 | 异议/驳回理由分类                    |
| D. Prosecution / 审查答复     | TM-PRO-PRO-03 | 答复证据及缺失事实收集               |
| D. Prosecution / 审查答复     | TM-PRO-PRO-04 | 答复策略和选项综合                   |
| D. Prosecution / 审查答复     | TM-PRO-PRO-05 | 修改、限定或删除选项准备             |
| D. Prosecution / 审查答复     | TM-PRO-PRO-06 | 答复草稿/指令包准备                  |
| D. Prosecution / 审查答复     | TM-PRO-PRO-07 | 期限、延期的专业确认准备             |
| D. Prosecution / 审查答复     | TM-PRO-PRO-08 | 答复交件和回执核对                   |
| E. Recordal / 注册与权利变更  | TM-PRO-REC-01 | 注册/证书证据入库及对照              |
| E. Recordal / 注册与权利变更  | TM-PRO-REC-02 | 证书补发/替换准备                    |
| E. Recordal / 注册与权利变更  | TM-PRO-REC-03 | 转让登记准备                         |
| E. Recordal / 注册与权利变更  | TM-PRO-REC-04 | 权利人名称/地址变更准备              |
| E. Recordal / 注册与权利变更  | TM-PRO-REC-05 | 许可及其他登记准备                   |
| E. Recordal / 注册与权利变更  | TM-PRO-REC-06 | 恢复/复活申请准备                    |
| E. Recordal / 注册与权利变更  | TM-PRO-REC-07 | Madrid/IR 指定、登记路线与依赖审阅   |
| E. Recordal / 注册与权利变更  | TM-PRO-REC-08 | 权属链/登记证据核对                  |
| F. Maintenance / 维护和使用   | TM-PRO-MNT-01 | 续展资格/就绪审阅                    |
| F. Maintenance / 维护和使用   | TM-PRO-MNT-02 | 使用宣誓/维护申请准备                |
| F. Maintenance / 维护和使用   | TM-PRO-MNT-03 | 样本/使用证据收集和覆盖映射          |
| F. Maintenance / 维护和使用   | TM-PRO-MNT-04 | 维护期限临近提示与专业期限审阅       |
| F. Maintenance / 维护和使用   | TM-PRO-MNT-05 | 保留/删除商品服务审阅                |
| F. Maintenance / 维护和使用   | TM-PRO-MNT-06 | 续展维护包及报价准备                 |
| F. Maintenance / 维护和使用   | TM-PRO-MNT-07 | 维护交件及回执核对                   |
| F. Maintenance / 维护和使用   | TM-PRO-MNT-08 | 多国资产维护日历/就绪视图            |
| G. Watch / 监测和争议         | TM-PRO-MON-01 | 监测目标和服务意图设置               |
| G. Watch / 监测和争议         | TM-PRO-MON-02 | 来源状态/登记变更发现与解释          |
| G. Watch / 监测和争议         | TM-PRO-MON-03 | 日期临近关注提示                     |
| G. Watch / 监测和争议         | TM-PRO-MON-04 | 陈旧/冲突来源分流及核验请求          |
| G. Watch / 监测和争议         | TM-PRO-MON-05 | 第三方近似商标监测和证据             |
| G. Watch / 监测和争议         | TM-PRO-MON-06 | 异议、撤销、无效机会/威胁分流        |
| G. Watch / 监测和争议         | TM-PRO-MON-07 | 侵权/品牌风险证据综合                |
| G. Watch / 监测和争议         | TM-PRO-MON-08 | 争议升级和专业人员审查包             |
| H. Commerce / 商业化和交易    | TM-PRO-COM-01 | 出售意图及卖方关系声明               |
| H. Commerce / 商业化和交易    | TM-PRO-COM-02 | 要价、可议价性和地域上下文           |
| H. Commerce / 商业化和交易    | TM-PRO-COM-03 | 商业方向/展示包准备                  |
| H. Commerce / 商业化和交易    | TM-PRO-COM-04 | 买卖尽调清单和证据包                 |
| H. Commerce / 商业化和交易    | TM-PRO-COM-05 | 转让交易就绪及登记 handoff           |
| H. Commerce / 商业化和交易    | TM-PRO-COM-06 | 许可交易就绪及登记 handoff           |
| H. Commerce / 商业化和交易    | TM-PRO-COM-07 | 权属/代表权限核验请求与证据复核      |
| H. Commerce / 商业化和交易    | TM-PRO-COM-08 | 成交/转移证据核对                    |
| I. Content / 内容、品牌和发布 | TM-PRO-PUB-01 | 由有授权资产上下文准备内容候选       |
| I. Content / 内容、品牌和发布 | TM-PRO-PUB-02 | 品牌叙事和展示准备                   |
| I. Content / 内容、品牌和发布 | TM-PRO-PUB-03 | 内容包媒体/权利适用性复核            |
| I. Content / 内容、品牌和发布 | TM-PRO-PUB-04 | 精确 PublishPackage 和渠道目标       |
| I. Content / 内容、品牌和发布 | TM-PRO-PUB-05 | Social 分发意图和目标准备            |
| I. Content / 内容、品牌和发布 | TM-PRO-PUB-06 | 受保护发布与平台回执核对             |
| I. Content / 内容、品牌和发布 | TM-PRO-PUB-07 | 有时间窗的内容/社交表现观察          |
| I. Content / 内容、品牌和发布 | TM-PRO-PUB-08 | 评论/询问分流及回复草稿              |
| J. Service / 客户服务和交付   | TM-PRO-SER-01 | 来自已准入证据的服务建议/方案        |
| J. Service / 客户服务和交付   | TM-PRO-SER-02 | 用户选择/指令记录                    |
| J. Service / 客户服务和交付   | TM-PRO-SER-03 | 官费、服务费、垫费假设的非约束报价   |
| J. Service / 客户服务和交付   | TM-PRO-SER-04 | 客户补充信息请求草稿                 |
| J. Service / 客户服务和交付   | TM-PRO-SER-05 | Provider 询价/指令草稿               |
| J. Service / 客户服务和交付   | TM-PRO-SER-06 | 明确执行授权及约束                   |
| J. Service / 客户服务和交付   | TM-PRO-SER-07 | 受保护动作释放及 Owner handoff       |
| J. Service / 客户服务和交付   | TM-PRO-SER-08 | 执行证据、恢复、生命周期和客户报告   |

## 7. Foundation 六包和四种方法执行能力

### 7.1 六包是建设计划，不是六个专业结论

| 原计划                                         | 稳定目标/具体环节                                                                                | 研究到的状态与限制                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| MO-CAP-001 Runtime Execution & Admission Plane | Request、资格、绑定、调用、typed outcome、Return/Receipt、restart replay                         | 已有多个合并包；08-26 closeout 明确仅 SINGLE_CONSUMER_PROVEN。后来消费证据要另找，不用旧单消费者标签断言今天所有共享能力失败 |
| MO-CAP-002 Managed AI Execution                | Provider-neutral AI request、结构输出、预算/usage、原输出及失败语义；供 Knowledge/Brain/产品使用 | 定义已有 managed-ai-execution；从专用 endpoint 迁移到 V2 是独立任务。Provider SDK 和 AI Gateway 不另成新业务能力             |
| MO-CAP-003 Managed Communication               | account/channel、message/thread、participants、attachment、checkpoint、送达/未知/回信证据        | #272 先认为完成后因 inbound exact evidence 重开，再补验收。Gmail/Graph/IMAP/SMTP 是实现，不能各造一个 Capability             |
| MO-CAP-004 Governed Document Understanding     | 许可文件→typed extraction/understanding→字段来源/质量/审核                                       | Foundation roadmap 曾 HOLD；后来 OA/Knowledge 文书路径有局部实现，不等于全域共同 Capability 已完成复用准入                   |
| MO-CAP-005 Governed Retrieval                  | 权限下跨 DE/Knowledge/Core/方法的有来源检索                                                      | roadmap 曾 HOLD；各领域现成读合同仍应复用，不为“统一检索”重建真相/索引                                                       |
| MO-CAP-006 Conformance & Evaluation Harness    | 多消费者、替换 provider、隔离、延迟/成本/错误、重启/来源/回退                                    | 是测试/治理平台项，已有 conformance/reliability 基础；不能当一个新专业能力或另起测试平台                                     |

### 7.2 四类执行方式的已验收限定试点

| 类型                     | #307 链中的具体证明                                                                                                                                                               | 不能扩大成什么                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Resolver                 | #310 从受控 Official Fee Reference Store 读取精确接纳的 USPTO fee materialization；拒绝 stale/missing/conflicting/wrong scope；无 Knowledge research hot path                     | 全球官费、所有法规/期限都已可用；把 Core 现有 Reference Store 搬进第二套 Brain 真相库 |
| Analytical               | #309 执行明确激活的 CN duration analytical package，保留 dataset/method/package/eval 来源                                                                                         | 所有审查周期预测都已上线                                                              |
| Scoring / Interpretation | #311/#316 对已经发生的 CN 申请→初审公告 elapsed days 按历史 quartile 描述分段                                                                                                     | 当前案件未来时长、法律期限、SLA、概率、风险或专业建议                                 |
| Discovery                | #312 对 CN preliminary-publication fact 用 bounded application-number range、query/snapshot/cursor 提供瞬时流；V1 日期窗因实际存储扫描问题被 V2 替代；最终有真实 target-host 证据 | renewal/侵权/潜客/联系人等所有商机自动识别；Capability 内保存长期运营池               |

#312 的关键取舍是具体技术/成本行为：不放宽读上限，不以 CI 代替 target-host；更改范围选择和读取形状。其 20 条评论完整保留，不能只留最终“完成”。

## 8. 高频真实任务：以前已细谈的功能落点

| 具体任务（历史来源）                           | 能力/Skill 应输出什么                                         | 产品中的具体环节                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 国外代理催办/状态询问/证书索取/费用协商（C03） | 事实化问题、责任表达、当前状态/下一步/期限请求、可改邮件草稿  | Work 起草→Messages 审核发送→关联回复；不能把草稿生成算案件推进成功                      |
| POA 检查（C03/C07）                            | 按国家/服务路径的字段、签署/认证材料缺项及来源                | 材料检查与补件清单；法定要求/currentness 需来源支持                                     |
| 商品/服务选择及分类（C03/C31）                 | 原描述、候选分类/表达、适用条件、证据和待确认项               | Filing/商品编辑卡片；无资料不伪造使用事实                                               |
| OA 官方文件理解（C03/C31）                     | 原文定位、问题分类、缺证、建议研究/审核项、范围化草稿         | OA Workbench；总结、策略、期限确认和答复提交分别接纳                                    |
| 报价（C03/C31）                                | 当前官费/服务费/币种/假设及结构化候选                         | Quote Owner 接纳；private calculator 可是本地 Skill，不能让能力结果拥有价格真相         |
| 多国申请规划（C03/C08）                        | 业务目的、路线选项、依赖、成本来源和需当地人员确认事项        | 对话→条件卡→方案/服务包→专业审核                                                        |
| 期限和维护（C07；Tree F/G）                    | 来源日期、适用规则/窗口、缺失信息、人工复核                   | Today/Watch/Work 提醒与准备；日期近不等于已认证法律期限                                 |
| 机构定价/邮件风格/SOP（C31/C15）               | approved local policy/Skill 下的版本化结果                    | 同一能力根据 Workspace 批准实现/上下文定制                                              |
| 信息变更价值发现（C04/C09/C55）                | 对哪些客户/商标/工作相关、依据、缺口、建议下一步              | Today→相应 Work/Customer/商标 Owner；不把全部私人候选复制到 Brain                       |
| 商标交易内容和潜在买家（C05/C07/C43）          | 商标用途、品牌方向、客群候选、展示内容及询价准备              | Trading/Studio/Customer；用途吻合不等于真实购买意愿或权属验证                           |
| 图文/视频（C37/C46/C50/C51；Creator 汇编）     | 商标行业 brief、权利/来源、图样连续性、可审核视觉/旁白/交付包 | Creator Work；模型、渲染、TTS、平台 Adapter 是实现/供应，普通视频成功不等于有效商标打法 |
| 找合适专业协作者（C53/C31）                    | 范围/资质/证据/可用性/责任匹配候选                            | MGSN/Engagement 人工确定角色/合同/权限；匹配不等于任命                                  |
| 用户实践画像（C03；M6；#1487）                 | 具体工作证据、私有复盘候选、显式采纳/拒绝/延后、实践视图      | 已有 Reflection/产品工作中查看；接受候选不发认证/分数/权限                              |

上述是恢复和当前合同映射，不把每行临时中文名称当已发布 Capability ID。旧“国外代理邮件优先试点”、旧“Lite 内容+交易双核心”、近期 Brain“申请准备首试点”分别有来源/时期；下一轮须做取舍，不能删旧建议或说历史上只定过一个首场景。

## 9. ICP 与联系人 Provider：把用户指定的分工记录清楚

当前可见用户原文：

> 我个人对客户画像ICP变成一个capability，以及它从哪些渠道购买联系人邮箱，转为MO的provider。

这是明确方向。以下具体拆分来自本轮之前的 OpenOutreach 研究 Draft #1491，属于详细设计候选；其中供应接入、字段与新的准入不能仅凭“方向被支持”就宣称已完成。

| 功能                         | 稳定输出                                                                                   | 业务/技术落点                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| DEFINE_ICP（暂定名）         | 带版本、可审核的目标客群条件候选、包含/排除条件、岗位/地域/商标组合/业务事件、证据和未知项 | M17 保存确认的 ICPDefinition；M22 管稳定能力及实现        |
| SCORE_OPPORTUNITY 的 ICP-fit | FIT / NO_FIT / INSUFFICIENT_EVIDENCE；逐项证据、反证、缺口、主体解析、画像/实现版本        | M09 商机评估引用；M17 campaign/context；不是成交概率      |
| ENRICH_CONTACT               | 正确主体下的人员/工作邮箱候选、来源、时效、验证状态、供应任务状态和费用                    | M09 接纳 ContactEvidence；M23 Provider/账号/预算/供应回执 |
| PREPARE_EMAIL                | 基于已核查服务/业务事实的可审触达草稿                                                      | M15 草稿；外发依 M24 明确批准，采购批准不等于发送批准     |

原研究源码证据：上游实际邮箱 adapter 只有 BetterContact；Hunter/Dropcontact 是注释里的扩展示例。BetterContact 的 CONTACT_DISCOVERY、WORK_EMAIL_ENRICHMENT、ACCOUNT_BALANCE 是不同供应操作。供应链公开名录里的 Hunter、RocketReach、PeopleDataLabs、Snov 等不等于 MO 已集成 Provider。

OpenOutreach Hub 的 resolve/contribute/share_profiles 是另一种联系人交换，不是邮箱采购；此前评审明确不采用私有联系人外部共享路径。本 Workspace 的已有联系人可作为有授权的业务证据，不能借节费把其他 Workspace 的联系人合并进公共缓存。

具体环节保留：商标业务事件→企业/申请人候选→ICP 匹配及主体/岗位核对→已有合法用途联系方式/授权缓存→批准批次与预算→供应任务→费用/证据核对→草稿→独立发送批准→真实回复/有效需求复盘。

资料不足、未找到、失效、被抑制、供应 on_hold、POST 提交未知、费用待核对是不同状态。Provider 故障不影响画像编辑、商机列表或已有通信；未知是否扣费/提交时不能盲重试或切供应商再买一次。Provider verified、岗位已核对、营销用途允许是三个事实。

此处不更新供应商产品价格；既有报告中的价格/credit 说明是其检索日期快照，不能当新采购报价。第一供应商仍是候选，未在本轮启用或购买邮箱。

## 10. 成本、可替代实现、用户规模：旧方案的真实取舍

| 旧路线                                                     | 原本用于哪里                                     | 需要保留的约束/验证                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 确定性/local parser/rules                                  | 提取、格式、结构校验、稳定常量、低风险比较       | 能满足结果就直接用；不能为显得智能强制 Brain/LLM                                                   |
| 已编译 Method + 当前事实                                   | 分析、解释、参考解析、瞬时发现                   | 研究成本复用；普通调用不重读全语料；源变更/权限撤销需失效                                          |
| Controlled Reference / Aggregate materialization           | 稳定值与昂贵公共统计                             | source/method/query/version/time/expiry；业务候选池不放 Capability                                 |
| 基础/标准/高级模型路由                                     | 简单高频任务、复杂 OA/多国/长材料                | 比较质量、延迟、失败、人工修改和每次成本；低价不能越过数据/审核条件                                |
| 私有、本地 Skill                                           | 客户限制文件、内部价格、SOP/数据库               | 保留本地路线；元数据可注册，私有内部实现不默认上传                                                 |
| MO Managed / 账号 Connector / MarkReg credential / WS BYOK | 用户不配 key 的首发；MarkReg 试验；高阶指定 BYOK | M23 四类分开。普通 WS-1.0 可绑定允许的账号，不等于任意 API Key；WS BYOK 2.0 另有套餐/计费/责任审批 |
| External MCP/REST consumer                                 | 用户使用熟悉平台调用 MO 能力并回传 receipt       | 验证该入口能否完整返回所需合同、权限/费用/错误；不以外部订阅自动抵 API 成本                        |
| 风险分级人工审核/抽检                                      | 低风险格式与高风险专业处理分别安排               | C53 的 R0–R4、C07 A0–A4 是旧设计维度；不能相互当同一状态机；实际专业审核成本单列                   |
| 订阅/合理使用/队列/高成本确认                              | C54 提出的生图/视频/高价模型/企业批量问题        | 能力授权、Provider usage、人工服务、培训/认证是不同收费对象；尚未定价                              |
| Provider 可切换、可关闭、可降级                            | AI、文书、邮件、视频、联系人供应                 | 替代仍须符合用途/数据/审核；只暂停相关路径，不拖垮无关工作；异步任务继续绑定原供应与账号           |

本轮没有新运行成本基准，没有用户规模/商业效果实测。Brain/Creator 汇编里的假设计算用于后续敏感性分析；不能称真实报价、利润率或每成功任务成本。

## 11. 证据成熟度与审批：本次发现的状态差异

### 11.1 v0.4 的实际 Owner 勾选必须保留

| 来源中的位置                                                   | 实际内容                                                                                                  | 恢复后的状态解释                                                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| v0.4 M21 Owner Approval                                        | CHANGE REQUESTED；用户指出不应仅常量，还包括判断路径/其他输出                                             | Brain 新规格继续修改；不能复述为已全面批准                                                       |
| v0.4 M22 Owner Approval                                        | APPROVED                                                                                                  | 保留 Owner 对该节能力定义、需求驱动、复用/组合/版本/运行证据及产品入口原则的批准                 |
| v0.4 M23 Owner Approval                                        | APPROVED                                                                                                  | 保留 Owner 对 Provider 分层、可替换、账号/凭据/BYOK、metering/fallback 的批准                    |
| 同一 v0.4 页眉/章头                                            | 多处仍 IN_REVIEW，M01–M25 待审                                                                            | 这是未更新的文本标签；本次不让它抹掉实际勾选                                                     |
| Draft #1490 当前 head 92d50bba2c095594d50a87ce53f68398965138f1 | OWNER DIRECTIONS APPROVED / DETAILED MODULE SPECIFICATIONS IN REVIEW；M01–M25 详细规格仍 CHANGE_REQUESTED | 仓库索引与实际 v0.4 勾选尚未完全同步；需由原规格评审任务接纳审批范围，不能在本汇编悄悄改中央记录 |

恢复时应明确“哪份、哪节、哪条原则/设计已批准”，而不是一句全批准/全待审。已有批准持续有效；本次新增的 ICP 具体字段、Provider 选择和运行任务仍须各自落在相应业务/实现范围，不从模块批准推导无限功能授权。

### 11.2 技术证明分别说明什么

- Catalog/Binding integrity：结构映射正确；不证明方法准确、来源生产准入、商业适用或 Official Truth。
- V2/replay/restart/durable tests：特定实现的可恢复和幂等；不证明第三方送达或官方受理。
- Workspace-local two-profile proof：批准实现选择及隔离；不证明所有本地知识 CURRENT。
- WIF binding：存在绑定；freshness、revocation 和专业适用性仍独立。
- Source admission：限定来源/方法/用途可以生产消费；不把 provider/model 输出升级为事实。
- Reflection ACCEPTED：主体用户接受私人反思；不是能力认证、公开画像/评分或权限变化。
- Preview/Storybook/Playwright：界面行为与 fixture；不是实际付费用户的有效商机/案件成功。
- 真实 target-host/source/live reply receipt：只支持其确切受验路径与范围，不迁移成全域证明。

本轮只恢复和核对证据，未新执行生产 Provider、业务 dogfood、邮箱采购、专业提交或方法 release。

## 12. 下一轮头脑风暴必须带上的旧问题

这不是新批准的 backlog；它是从已恢复讨论中应逐项裁决的清单。

| 问题                                  | 已有原讨论                                                                 | 下一轮应产生的具体答案                                                         |
| ------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 从哪条真实旅程形成首批能力？          | C03 代理邮件；C54 交易/美国维护试点；Brain 汇编申请准备；最新 Creator 玩法 | 用户任务、输入/输出/Owner、baseline、真实验收；不能先造库存再找入口            |
| 人的能力成长做多深？                  | Ledger/Reflection/Twin、L1–L5、实训/影子/监督生产                          | 1.0 中私有实践反馈的边界；认证/专业等级是否另立后续项目，如何验证              |
| Master composition 要支持什么复杂度？ | C03/C08 动态经营方案；当前 composition 1+0–3+0–1                           | 哪些阶段分别调用、哪些需 durable Workflow；缺项怎样询问/停止/恢复              |
| 本地/私人 Skill 与公共方法怎样共存？  | C31、C15、Workspace-local proof、WIF                                       | 哪个 scope、版本、时效/撤销、成本/延迟、允许的数据路线；不默认共享私人资料     |
| ICP 的有效性怎么判断？                | 当前 Owner 方向；#1491 的规则/人工对照                                     | 真实匹配、主体/岗位错误、审核时间、有效需求、单位成本，而不是邮箱/模型置信数   |
| 现有基础还缺复用证明还是专业产物？    | Foundation 6 包、80 Wall、已验收 4 试点                                    | 明确 REUSE / PRODUCTIZE / REWIRE / BUILD / DEFER 的每项依据，避免 Runtime 再造 |
| 如何承受多用户成本？                  | C03 模型路由/Context；C54 合理使用；M23 metering；风险分级审核             | 每任务模型/供应/渲染/人工成本分开、预算/并发/重试、公共方法复用与私有隔离      |
| 旧能力培养/贡献商业模式何时验证？     | C07/C53/C54                                                                | 模拟是否预测真实能力、谁审核负责、任务供需、费用/权益/许可；不能仅因长期就取消 |

## 13. 本轮沟通记录

记录 ID：CAP-HISTORY-20261009。
用户本轮请求：“把之前capabilities的所有讨论也找出来”。
承接要求：沟通入库、具体功能映射、不泛谈；客户画像 ICP 为 Capability，联系人邮箱购买渠道为 Provider；旧方案不能一概否定或肯定。
实际完成：历史资料检索/取回、讨论全文与索引、关键定义/任务/成本/版本/审批还原、报告及资料包；仓库只新增此历史文档的 Draft。
检索缺口：两次跨会话原文搜索报错；未把该缺口写成“没有讨论过”。
审批变更：本文件不改任何中央评审状态；保留 M22/M23 实际 APPROVED 与 #1490 详细规格状态差异。
本轮无新增 Runtime、Canon、合同、迁移、secret、价格或外部业务动作。

后续 Brain、Capabilities、Creator 的开发规划应引用同一批已恢复来源，但分别注明方法研究、稳定结果能力、产品工作/效果的职责和成功条件。旧想法进入具体取舍记录后，才能判断保留、改造、延期或放弃。

## 附录 A. 57 份历史原文件索引

时间列为来源文件建立时间（UTC），不是推定的讨论时间。资料包 source-index.json 保存修改时间、可用来源身份、副本、文本 SHA-256 与完整性说明。

| 来源 | 原文件名                                                                        | 文件建立时间 UTC            |
| ---- | ------------------------------------------------------------------------------- | --------------------------- |
| C01  | Mo_Distillery（知识精馏工厂）构想总结.md                                        | 2026-07-13T02:38:09.582233Z |
| C02  | Round 2.2 Decision Record.pdf                                                   | 2026-07-13T06:25:54.029027Z |
| C03  | MarkOrbit_Capability_OS_Strategy_Summary.md                                     | 2026-07-23T13:55:46.879542Z |
| C04  | mo_lite_value_recommendation_summary(1).md                                      | 2026-07-13T01:22:18.463637Z |
| C05  | MarkOrbit_Lite_Trademark_to_Brand_Opportunity_Engine_PRD.md                     | 2026-07-20T12:14:37.926611Z |
| C06  | MO_Dual_Track_Capability_Distillation_Strategy.md                               | 2026-07-23T19:09:08.546992Z |
| C07  | 04_CAPABILITY_FRAMEWORK.md                                                      | 2026-07-21T13:43:49.935345Z |
| C08  | MO_Business_Capability_Map_v1.0.md                                              | 2026-07-23T14:23:51.328887Z |
| C09  | MO Lite 每日工作台产品规划书.md                                                 | 2026-08-17T22:02:53.607065Z |
| C10  | MarkOrbit_Global_Brand_IP_Radar_Planning_v1_2026-08-18.md                       | 2026-08-17T17:17:27.276634Z |
| C11  | MarkOrbit Radar Newsletter & Alert Onboarding — Codex 完整项目指令.md           | 2026-08-18T00:06:52.042353Z |
| C12  | MarkOrbit Canonical Context Map v0.1.pdf                                        | 2026-07-13T06:25:58.108332Z |
| C13  | 06_DATA_KNOWLEDGE_BRAIN_ARCHITECTURE.md                                         | 2026-07-21T13:43:51.691068Z |
| C14  | B04-CH-14_Knowledge_Consumption_and_the_Brain_Boundary.md                       | 2026-07-13T16:28:37.009425Z |
| C15  | B04-CH-10_Private_Knowledge_AI_Context_Preferences_and_Organizational_Memory.md | 2026-07-13T15:36:44.122005Z |
| C16  | MarkOrbit_Knowledge_PRD_v1.0_Draft.md                                           | 2026-07-15T15:05:32.766763Z |
| C17  | KNOWLEDGE_DOMAIN_ROADMAP.md                                                     | 2026-08-06T21:33:03.056852Z |
| C18  | MarkOrbit_Core_New_Chat_Handoff_FULL_2026-08-31_1128.md                         | 2026-08-31T04:02:44.350453Z |
| C19  | MarkOrbit_Core_Cognitive_Platform_New_Chat_Handoff_2026-09-01_1720.md           | 2026-09-01T09:24:26.113493Z |
| C20  | MarkOrbit_Core_Cognitive_Platform_New_Chat_Handoff_2026-09-01.md                | 2026-08-31T18:41:30.481180Z |
| C21  | 粘贴的 markdown (1)。md(4)                                                      | 2026-09-16T04:09:23.220909Z |
| C22  | Round 2.1 Decision Record.pdf                                                   | 2026-07-13T06:25:54.116981Z |
| C23  | Round 2.3 Decision Record.pdf                                                   | 2026-07-13T06:25:53.858400Z |
| C24  | Round 2.4 Decision Record.pdf                                                   | 2026-07-13T06:25:54.099353Z |
| C25  | Round 3 Decision Record.pdf                                                     | 2026-07-13T06:25:53.331197Z |
| C26  | Round 4 Decision Record.pdf                                                     | 2026-07-13T06:25:53.413704Z |
| C27  | Round 5 Decision Record.pdf                                                     | 2026-07-13T06:25:54.230385Z |
| C28  | Round 6 Final Decision Record.pdf                                               | 2026-07-13T06:25:55.556905Z |
| C29  | MO_Capability_Engine_Whitepaper.md                                              | 2026-07-23T19:09:04.784999Z |
| C30  | MO_Business_Capability_Map_v2.0.md                                              | 2026-07-23T19:09:07.675758Z |
| C31  | B04-CH-15_Capability_Discovery_and_Skill_Selection.md                           | 2026-07-13T16:33:37.838048Z |
| C32  | MarkOrbit_AI_Capability_Migration_Guide_2026-08-25.md                           | 2026-08-25T01:07:03.222239Z |
| C33  | MarkOrbit_MainRepo_Knowledge_Capability_Handoff_2026-08-25.md                   | 2026-08-25T01:07:02.564034Z |
| C34  | MO_Social_Runtime_Capability_Harvest_Plan_2026-09-03.md                         | 2026-09-03T07:06:46.878169Z |
| C35  | MarkOrbit_Foundation_TSDR_Capability_New_Chat_Handoff_2026-09-19_0740.md        | 2026-09-18T23:43:04.274870Z |
| C36  | MarkOrbit_Foundation_Activation_Handoff_2026-09-18_0804.md                      | 2026-09-18T00:08:19.281287Z |
| C37  | MarkOrbit Content Skill 母 Skill 改造参考与工程评估说明.md                      | 2026-08-25T03:16:41.641100Z |
| C38  | B04-CH-16_Assistant_Guide_and_AI_Agent_in_the_Workplace.md                      | 2026-07-13T17:21:58.807029Z |
| C39  | B04-CH-17_Value_Candidates_Recommendations_and_Next_Best_Action.md              | 2026-07-13T17:25:34.989568Z |
| C40  | B04-CH-18_From_Prepared_Action_to_Governed_Execution.md                         | 2026-07-13T17:30:33.965962Z |
| C41  | B04-CH-19_Human_Review_Approval_and_Owning_Service_Handoff.md                   | 2026-07-13T17:34:14.389219Z |
| C42  | 07_LITE_PRODUCT_STRATEGY.md                                                     | 2026-07-21T13:43:52.880606Z |
| C43  | MarkOrbit_Lite_产品定位与案例中心设计讨论_Draft.md                              | 2026-07-15T08:16:49.149774Z |
| C44  | 07_LITE_AGENT_DOGFOOD_CARD.md                                                   | 2026-09-16T05:17:24.568285Z |
| C45  | Thailand_Trademark_Skill_V1.0.md                                                | 2026-07-31T00:35:56.881358Z |
| C46  | MOKI_Skill_Completeness_Audit_2026-08-05.md                                     | 2026-08-05T08:25:43.208605Z |
| C47  | B04-CH-21_Product_Independence_and_Shared_Foundations.md                        | 2026-07-13T17:48:50.193226Z |
| C48  | B04-CH-23_Lite_as_a_Lightweight_Workplace.md                                    | 2026-07-13T17:56:32.493265Z |
| C49  | B03-CH-29_Agent-Assisted_Execution_Governance.md                                | 2026-07-12T00:00:51.471297Z |
| C50  | MOKI_Illustration_Skill_New_Chat_Handoff_2026-08-10.md                          | 2026-08-10T00:07:36.053672Z |
| C51  | MOKI_Illustration_Skill_New_Chat_Handoff_2026-08-09.md                          | 2026-08-09T14:19:46.283640Z |
| C52  | MO_Founder_OS.md                                                                | 2026-07-23T19:09:06.393065Z |
| C53  | 05_WORKPLACE_RESOURCE_COLLABORATION_MODEL.md                                    | 2026-07-21T13:43:50.778731Z |
| C54  | 08_DECISION_OPEN_QUESTIONS_RISKS.md                                             | 2026-07-21T13:43:53.786692Z |
| C55  | Mo_Value_Factory_白皮书_Draft.md                                                | 2026-07-10T13:16:51.355158Z |
| C56  | Mo_Crawl_白皮书_Draft.md                                                        | 2026-07-12T08:07:26.935798Z |
| C57  | MarkOrbit_New_Chat_Handoff_2026-08-10.md                                        | 2026-08-10T00:06:51.092947Z |

## 附录 B. 仓库原始设计和关键讨论

所有 main 文件链接均固定于 86715f76d4a5b33839f431e4996a8a00b21c7918；全文仍由仓库维护，资料包保存引用而不复制仓库代码/文档成第二套权威源。

| 文件                                                                               | 固定来源                                                                                                                                                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AGENTS.md                                                                          | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/AGENTS.md)                                                                          |
| docs/architecture/CAPABILITY-FOUNDATION-ARCHITECTURE.md                            | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/docs/architecture/CAPABILITY-FOUNDATION-ARCHITECTURE.md)                            |
| docs/architecture/CAPABILITY_RUNTIME_ARCHITECTURE.md                               | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/docs/architecture/CAPABILITY_RUNTIME_ARCHITECTURE.md)                               |
| docs/architecture/CAPABILITY-LEARNING-AUTHORITY-BOUNDARY.md                        | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/docs/architecture/CAPABILITY-LEARNING-AUTHORITY-BOUNDARY.md)                        |
| docs/planning/CAPABILITY-FOUNDATION-ROADMAP.md                                     | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/docs/planning/CAPABILITY-FOUNDATION-ROADMAP.md)                                     |
| docs/planning/TRADEMARK-CAPABILITY-TREE-V0.md                                      | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/docs/planning/TRADEMARK-CAPABILITY-TREE-V0.md)                                      |
| docs/planning/TRADEMARK-CAPABILITY-WALL-V0.md                                      | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/docs/planning/TRADEMARK-CAPABILITY-WALL-V0.md)                                      |
| docs/planning/TRADEMARK-CAPABILITY-WALL-SLOT-LEDGER-V0.md                          | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/docs/planning/TRADEMARK-CAPABILITY-WALL-SLOT-LEDGER-V0.md)                          |
| docs/ui/LITE-CAPABILITY-REFLECTION-PREVIEW.md                                      | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/docs/ui/LITE-CAPABILITY-REFLECTION-PREVIEW.md)                                      |
| docs/architecture/DOMAIN-PACK-STANDARD-V1.md                                       | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/docs/architecture/DOMAIN-PACK-STANDARD-V1.md)                                       |
| docs/architecture/EXTERNAL-CAPABILITY-EXPOSURE-POLICY-V1.md                        | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/docs/architecture/EXTERNAL-CAPABILITY-EXPOSURE-POLICY-V1.md)                        |
| docs/architecture/OPPORTUNITY-DISCOVERY-CAPABILITY-ALIGNMENT.md                    | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/docs/architecture/OPPORTUNITY-DISCOVERY-CAPABILITY-ALIGNMENT.md)                    |
| services/capability-engine/README.md                                               | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/services/capability-engine/README.md)                                               |
| services/capability-engine/CAPABILITY_PRODUCTION_MATURITY_CHECKPOINT_2026-09-01.md | [读取原文](https://github.com/yoomarks/markorbit/blob/86715f76d4a5b33839f431e4996a8a00b21c7918/services/capability-engine/CAPABILITY_PRODUCTION_MATURITY_CHECKPOINT_2026-09-01.md) |
| #1490 审阅索引（Draft）                                                            | [固定 head 原文](https://github.com/yoomarks/markorbit/blob/92d50bba2c095594d50a87ce53f68398965138f1/docs/product/MO-MASTER-PRODUCT-SPEC-REVIEW-INDEX.md)                          |

| 讨论                                                                                                                            | 具体用途                                                 |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [#276](https://github.com/yoomarks/markorbit/issues/276) / [PR #284](https://github.com/yoomarks/markorbit/pull/284)            | Brain/Knowledge/DE/Capability/产品的最终分工与历史再分类 |
| [PR #197](https://github.com/yoomarks/markorbit/pull/197) / [PR #245](https://github.com/yoomarks/markorbit/pull/245)           | Foundation 方向与 runtime 单消费者 closeout              |
| [#272](https://github.com/yoomarks/markorbit/issues/272)                                                                        | 邮件发送/回信 exact evidence 的重开和收口                |
| [#307](https://github.com/yoomarks/markorbit/issues/307) / [#312](https://github.com/yoomarks/markorbit/issues/312)             | 四类执行试点、Discovery V1→V2 取舍、真实 target-host     |
| [#392](https://github.com/yoomarks/markorbit/issues/392)                                                                        | 生产来源成熟度/消费者/时效/运行可达性                    |
| [#1074](https://github.com/yoomarks/markorbit/issues/1074) / [#1092](https://github.com/yoomarks/markorbit/issues/1092)         | Workspace-local implementation 和产品复用                |
| [#1075](https://github.com/yoomarks/markorbit/issues/1075) / [PR #1091](https://github.com/yoomarks/markorbit/pull/1091)        | 80 槽位、逐项 ledger、从 HOLD 到允许 planning            |
| [PR #1487](https://github.com/yoomarks/markorbit/pull/1487)                                                                     | 私有复盘 runnable preview                                |
| [Draft #1490](https://github.com/yoomarks/markorbit/pull/1490)                                                                  | 历史 Owner 方向/详细规格审批索引及其与 v0.4 的差异       |
| [Draft #1491](https://github.com/yoomarks/markorbit/pull/1491)                                                                  | ICP 与联系人供应具体设计                                 |
| [Draft #1494](https://github.com/yoomarks/markorbit/pull/1494) / [Draft #1495](https://github.com/yoomarks/markorbit/pull/1495) | Creator 与 Brain 规划恢复；仍须按具体批准/版本范围消费   |

完整讨论索引 discussion-index.json 对应 203 个线程与 558 条评论/审查记录。发现索引还保存所有 346 个 Issue / 343 个 PR 的标题、正文和时间；有评论线程的返回全文另存于 discussions/。这些是检索取回集合，不是规范注册表，也不是能力清单。

## 附录 C. 资料包读法与可复核性

先读本汇编的第 2、4、5、8、9、11 节；需要重新取舍时，通过 Cxx 找 sources/ 原文、通过 Issue/PR 号找 discussions/。
PDF/文档提取文本、重复副本和检索日期在 source-index.json 明确区分；归档文本的 SHA-256 可验证包内文本没有变化，不能据此声称等同初始原文件字节。
当前 spec、反馈、Brain/Creator/ICP 汇编在 current-feedback/；它们与历史原文分开。
仓库正文/代码留在固定 SHA 链接；GitHub 检索正文与讨论是当次快照，后续评论、改名、合并状态仍可能变化。
原聊天检索失败、未读的程序二进制包和未证明的运行/商业效果保持缺口，不填入推测内容。
