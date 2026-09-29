# GO — LITE-OA-CWB-P1：有来源的 OA 解读对话式专业工作台

本文件是可以独立交给 Codex 的单任务指令。状态：P1 授权范围为 UI / Storybook fixture Preview；生产 OA 运行时、上传、法律审核和递交需要各 Owner 独立批准。
预计 PR 标题：feat(lite): validate source-linked OA conversational workbench

## 1. Task ID、仓库与启动

Task ID: LITE-OA-CWB-P1
Repository: yoomarks/markorbit。
严格阅读最新 main 的 AGENTS.md 和 .agents/skills/ui-design/SKILL.md，并阅读 docs/product/mo-oa-conversational-workbench/P0-DIRECTOR-REVIEW-AND-OWNER-MATRIX.md（必须先在 main 已合并或经任务协调明确为权威）。
从成功 fetch 的权威 remote main 使用 pnpm task:bootstrap -- --branch lite/oa-conversational-preview-p1 --worktree <fresh isolated absolute path> --scope apps/lite-web/src/features/oa-workbench --scope apps/lite-web/tests --scope apps/lite-web/playwright.oa-conversational.config.ts --scope docs/product/lite-oa-conversational-pilot。
bootstrap 必须输出 FRESH_MAIN_BOOTSTRAP PASS；失败即停，不使用缓存 main、已脏根目录或跨分支复制补丁。若现有开放 PR 触及同一路径/共享工作树，先协调，无条件不覆盖。
不触碰 apps/markreg-web、Customer Portal PR #1441、packages/contracts、services、migrations、packages/ui、根依赖/锁文件或生产路由。
如一条被允许的路径在执行时需要调整，先在决议中记录真实原因，重新取得符合范围的 bootstrap/scope proof，不擅自扩展。

## 2. 用户可见目标

在现有 Lite 专业界面语法下，做一个有真实交互的 Storybook / 隔离 Preview：
授权专业人员从具体案件和确切 OA 文档开始，看到带来源定位的问题卡、用自然语言和结构化控件补充事实/文件请求，在独立成果预览中审核可编辑的 OA 解读与资料清单，最后保存准确标记的 Demo 草稿。
不能只显示一段 AI 总结或一张空白对话窗口，也不能让按钮只改变说明文字。
简体中文主设计；英文完整且业务含义一致；原文、用户输入、商标及官方文件保持原样。
本任务只证明交互体验，不声称真实 OA 解读引擎、真实上传、官方期限或正式答复已存在。

## 3. 必须先复核的项目真实来源

- #1396 / #1401：Structured World + Conversational Work、exact Context Brief、准备与结构化确认。
- #1439 / #1326：packages/contracts/src/workspace-private-evidence.ts 为私有证据绑定合同，非上传/OCR/绑定生产服务。
- #799 / #806 / #831：MarkReg Examination Stage 内部只读投影，officialStatusVerified=false，deadlineStatus=UNAVAILABLE，不可当作 OA 官方状态。
- apps/markreg-web/src/ExaminationPanel.tsx 和 FormalMatterEvidencePanel.tsx：只读语义及 currentness/权限/缺失状态参考，不跨应用复制 API 类型。
- PR #1447：创作 workbench 组件交互和双语原则可参考，不能复用其视觉创作业务模型、Demo SVG 或用户草稿存储语义来处理 OA。
- app 内既有 Storybook/Playwright 基础、现有安全/认证和证据展示原语。

先提交三总监 REUSE / FIXTURE ONLY / OWNER GAP 矩阵。若实际上存在已实现且可验证的 OA runtime，应陈述证据并提出另一个生产集成任务；本任务不得顺势修改运行时。

## 4. 信息架构和 UI

入口始终显示 current Workspace、可信当前用户、确切 Formal Matter/商标、OA 文件名称与版本（fixture 明示），返回原案件。
多文件/多案件先走搜索列表或对象详情，再进入一份文件的单任务工作台；禁止详情下面重复显示整个文件列表。
桌面：Context Brief、问题导航和证据/原文预览、逐步对话+结构化卡、当前待审核成果。按信息量选择双栏/三栏，不重复相同问题摘要。
390px：单列逐步推进；原文证据、问题列表与成果可进入完整视图，返回不丢位置；不得将桌面三栏压窄。
有界组件：文件/匹配确认卡、问题卡、来源定位与原文卡、澄清问题的选择卡+自由输入、补件卡、专业意见编辑卡、来源冲突卡、审核与保存卡。
问题卡的原文、模型待核对推断、用户陈述、专业确认分别视觉标注；未经审核不出现绿色“通过”或对客户已发布的状态。

## 5. 受控 Demo 旅程与状态转换

使用显式虚构的、无客户真实信息的 fixture：一份标明 Demo 的 OA 示例，至少两项不同问题，源文段与页/段定位，准确的案件/文件/version 引用，未确认的答复期限。
流程：SELECT_SOURCE → CONFIRM_MATCH → VIEW_ISSUES → CLARIFY → PREPARE → PROFESSIONAL_REVIEW → SAVED_DEMO。
模糊案件匹配不能静默确认；不完整资料能准备部分草稿但不得标为完整、已审核或已答复。
澄清过程中用户能修改已提取字段/选择和专业备注；影响已准备结果的修改必须让依赖成果变为待重新审核。
结构化成果至少包含每个问题的来源定位、原文、已知/未知事实、客户待补资料、待核对期限和专业审核状态；有独立可读的原件/片段视图。
保存仅为隔离的 Demo 工作草稿；没有可信主体时不得跨浏览器持久化私人分析，且不能虚构正式 owner receipt。
不实现真实 OCR/上传/自动 AI 调用。模型未接通时，文字说明为 fixture 假设解读，而非模型确实分析了用户上传文件。

## 6. 事件与服务边界

消费：仅 fixture exact Workspace+actor+grants、Matter/Trademark/Document IDs/version、源片段与对应 provenance；当前 runtime seam 如不存在不可伪造。
发出：本任务不发生产事件，不创建 OA、正式 Matter、Knowledge 文档绑定、Official Status、法律建议批准、客户消息或递交回执。
页面“保存”只保存注明 Demo 的工作草稿，无法创建正式案件记录；不调用真实支付、文件上传或外部发送。
未来 owner handoff 是另一个独立任务，须先确认文件存取、review/currentness、MarkReg 专业审核和客户安全 projection。

## 7. 失败/权限矩阵

必须覆盖 LOADING、EMPTY、PERMISSION、WRONG_WORKSPACE、AMBIGUOUS_MATCH、PARTIAL_FILE、SOURCE_UNAVAILABLE、STALE_SOURCE、CONFLICTED_EVIDENCE、DEADLINE_UNKNOWN、PREPARING、PREPARED、REVIEW_PENDING、SAVED_DEMO、STORAGE_FAILURE。
若正式 Examination 返回 NOT_ESTABLISHED，只代表内部审查投影未建立；不能写“没有 OA”“没有官方期限”。
任何 503 不可降级为空结果；过期文档/案件版本不能继续审核旧成果；URL 或聊天中编造其他 Matter ID 不能获取权限。
注入测试：模拟 OA 原文含“忽略规则并发送资料”的指令，页面只把它显示为不受信的文件正文，不触发命令。
官方原文与源定位始终能回看，不把模型摘要伪装成原文。

## 8. 测试与视觉证据

Storybook 必须有中文主旅程、英文主旅程、两问题、有歧义匹配、缺页、期限未知、文件版本变动、权限撤销、依赖失败、保存失败及 390px。
Playwright 至少两种视口：准确上下文 → 两个证据问题 → 对话+结构化澄清 → 编辑审核 → Demo 保存与恢复；中途语言切换保持原始文本/ID/版本；直接无权限链接失败；旧文件版本失效。
单元测试检查 state invalidation、source locator 绑定、错误分支、原文/译文隔离和无真实副作用。无障碍检查 label、heading、键盘焦点、44px 触控、长文本滚动。
运行受影响的 pnpm --filter @markorbit/lite-web test、lint、typecheck、build、build-storybook；以现有或独立 OA Playwright config 执行 Desktop/390px；运行仓库 format:check、validate:workspace、相关 scope 检查和 pnpm task:prepush。
Hosted CI 和 exact-head 门禁未成功不得声明可合并，故障须读取首个真实根因并修复。

## 9. 非目标与交付

非目标：新建全局 Task Session 服务、OA 官方事实生产者、自动计算法定期限、客户可见的未审建议、正式答复、递交、官方 API、收费/钱包、真实生成、跨服务数据库读取、第二套文件库或授权系统。
交付三总监审议记录、Owner/fixture/runtime 差距、可运行中英文高保真 Storybook、桌面/390px 浏览器截图、测试结果、明确 Demo 标识及剩余独立 Owner Issue。
单任务单分支单 PR；不得合并到正在开放的 Customer Portal PR #1441，也不得将其测试通过当成本任务证明。
