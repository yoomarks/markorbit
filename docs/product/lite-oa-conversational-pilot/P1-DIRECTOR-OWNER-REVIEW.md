# LITE-OA-CWB-P1 三总监 Owner 复核

状态：P1 实施前门禁已复核；仅授权 Lite 的 fixture-only Storybook / 隔离 Preview。

基线：权威 `origin/main` `4e2b99d5300219408c6bce82a031b5efe87fd499`；Task ID `LITE-OA-CWB-P1`。

## 1. 复核结论

| 对象或语义                                                                   | 分类         | 复核证据                                                            | P1 决定                                                                                             |
| ---------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Lite 选择卡、结构化控件、双语与主体隔离的浏览器草稿                          | REUSE        | `apps/lite-web/src/features/trading-studio` 及 PR #1447 已合并实现  | 复用交互原则和现有 Lite 视觉语法，不复用创作业务模型、Demo SVG 或发布语义。                         |
| 私有文件与 Case / Trademark 的建议、接受、拒绝和来源定位语义                 | REUSE        | `packages/contracts/src/workspace-private-evidence.ts`              | 仅作为 Owner 边界和 fixture 字段设计依据；不复制合同类型，不宣称存在上传、OCR、读取或绑定生产服务。 |
| MarkReg Examination currentness、404/409/503 和期限不可用语义                | REUSE        | `apps/markreg-web/src/ExaminationPanel.tsx`                         | 复用 fail-closed 含义；不跨应用复制 API 类型，不把内部投影写成官方 OA 或期限。                      |
| Formal Matter Evidence 当前/历史版本和只读来源语义                           | REUSE        | `apps/markreg-web/src/FormalMatterEvidencePanel.tsx`                | 用于 fixture 的 exact matter/document version 与 stale invalidation 设计；不创建跨服务读取。        |
| Workspace、可信 actor、grants、Matter、Trademark、Document/version、原文片段 | FIXTURE ONLY | P0 决议与 P1 任务                                                   | 使用显式虚构且稳定的 exact IDs；不得进入生产 API 路径。                                             |
| 两项 OA 问题、说明性解读、资料清单、专业备注、期限待核对                     | FIXTURE ONLY | 当前仓库未发现已验证的 OA 解读 runtime seam                         | 全部标记为 Demo / 待核对；原文与说明分离，文档内指令仅显示为不受信正文。                            |
| 私有 OA 原件上传、读取、页段定位与 OCR 质量                                  | OWNER GAP    | Knowledge / 文件 Owner 尚未提供 P1 可消费的已验证运行时             | P1 不实现；另立 Owner 任务验证授权读取、currentness 和 OCR receipt。                                |
| 正式文件—案件关联持久化                                                      | OWNER GAP    | 私有证据绑定只有合同语义，未证明端到端 owner runtime                | P1 仅显示建议匹配与人工确认，不产生正式绑定回执。                                                   |
| 受治理 OA 方法、模型运行和方法版本                                           | OWNER GAP    | Brain / Capability OA runtime 未被当前证据建立                      | P1 使用固定 fixture 假设解读，不伪造模型调用。                                                      |
| 正式专业审核、客户安全投影、发送与递交                                       | OWNER GAP    | MarkReg / Review / Communication / Execution seam 仍需各 Owner 准入 | P1 只保存隔离 Demo 草稿，不发生产事件、客户消息或递交回执。                                         |
| 官方期限                                                                     | OWNER GAP    | 无经准入的精确文件或官方来源                                        | 始终显示“待核对”，不按法域常识或内部阶段推算。                                                      |

结论：没有证据表明生产 OA runtime 已经可验证存在。本 PR 保持 fixture-only，不顺势修改合同、服务、迁移、通用任务平台、文件库或 OA Owner。

## 2. 三总监门禁

### 产品总监

- 用户：具有 exact Workspace、Matter、Trademark 和 Document grant 的 Lite 专业人员。
- JTBD：从一份确切 OA 文件核对两个有来源的问题，补齐已知/未知事实与资料请求，形成可编辑、可审核、可恢复的 Demo 解读和答复准备草稿。
- 成功标准：每个问题保留来源定位、原文、待核对解读、用户陈述、资料缺口与专业审核状态；成功不以聊天条数或模型响应计量。
- 权限边界：不创建 OA 官方事实、法定期限、客户可见建议、正式答复、递交、支付或 owner receipt。

### 设计总监

- 入口与层级：exact Workspace / actor / Matter / Trademark / Document context → 匹配确认 → 问题工作台 → 独立成果审核 → Demo 保存 → 返回原案件。
- 桌面：紧凑三域布局，左侧 Context Brief 与问题导航，中间原文证据和逐步澄清，右侧当前待审核成果；同一问题摘要不重复。
- 390px：单列按当前任务推进；问题、原文和成果以完整视图切换，返回保留选择和编辑值，不压缩桌面三栏。
- 可编辑区：用户事实、选项、客户待补资料和专业备注。只读区：exact IDs/version、官方原文、来源定位和 Demo 假设解读基线。
- 语言：简体中文默认、英文业务含义完整；文件名、商标、ID、原文、用户输入在切换时不改写。
- 无障碍：语义 heading/landmark、fieldset/label、状态文字、键盘顺序、可见焦点、最小 44px 触控目标和长原文滚动。

### 技术总监

- 生产消费/发出：无。Preview 只消费模块内 fixture，不调用真实上传、OCR、AI、支付、外发或 owner API，不发生产事件。
- 草稿恢复键：可信 principal + Workspace + Matter version + Document version；缺少可信主体时仅当前页面内存，不跨刷新持久化。
- currentness：Document 或 Matter version 变化后，依赖成果 fail-closed 为待重新核对，旧成果不能继续审核或保存。
- 授权：URL、文件名、申请号或聊天文本不能授予访问；WRONG_WORKSPACE / PERMISSION 分支不得渲染私有原文。
- 注入：原文中的命令式文字是未受信文件内容，只能原样显示，不能改变 UI 规则或触发动作。

## 3. 状态与转换矩阵

主流程：`SELECT_SOURCE → CONFIRM_MATCH → VIEW_ISSUES → CLARIFY → PREPARE → PROFESSIONAL_REVIEW → SAVED_DEMO`。

| 状态                         | 用户可见行为                    | 恢复 / 禁止                  |
| ---------------------------- | ------------------------------- | ---------------------------- |
| LOADING                      | 显示正在核对授权来源            | 不伪装为空                   |
| EMPTY                        | 明示当前 fixture 没有可进入文件 | 不写“没有 OA”                |
| PERMISSION / WRONG_WORKSPACE | 隐藏私有正文并说明授权失败      | 不允许通过 URL 更换 ID       |
| AMBIGUOUS_MATCH              | 展示候选和人工确认控件          | 未确认不得进入问题审核       |
| PARTIAL_FILE                 | 标出缺页，允许部分准备          | 不得标记完整、已审核或已答复 |
| SOURCE_UNAVAILABLE           | 显示来源依赖失败和重试          | 503 不降级为空               |
| STALE_SOURCE                 | 显示版本变化与失效原因          | 禁止审核旧成果               |
| CONFLICTED_EVIDENCE          | 并列来源冲突和专业处置备注      | 不静默选定事实               |
| DEADLINE_UNKNOWN             | 显示期限待核对及所需来源        | 不推算日期                   |
| PREPARING / PREPARED         | 显示准备中或可编辑成果          | 不暗示真实模型已运行         |
| REVIEW_PENDING               | 专业人员可编辑并逐项确认        | 修改依赖事实后重新待审       |
| SAVED_DEMO                   | 显示主体绑定的 Demo 草稿标识    | 不生成正式回执               |
| STORAGE_FAILURE              | 保留当前页编辑并说明未持久化    | 不假装保存成功               |

## 4. 验收与独立 Owner 后续

P1 使用 fixture-backed Storybook、Vitest 与 desktop/390px Playwright 证明主旅程、双语、恢复、版本失效、权限、依赖、缺页、歧义、冲突、未知期限、保存失败和注入边界，并留存两端截图。

生产化必须拆为独立 Owner Issue：

1. Knowledge / 文件 Owner：受权原件读取、页段定位、OCR 质量和版本回执。
2. Workspace / Lite / MarkReg Owner：正式文件—Matter/Trademark 关联、currentness 和 grant seam。
3. Brain / Capability Owner：受治理 OA 方法、模型/方法版本和逐项来源证据。
4. Review / Communication / Execution Owner：专业审核、客户安全投影、外发及正式递交回执。

这些缺口不属于本 PR，且不能由 fixture 或浏览器 localStorage 代替。
