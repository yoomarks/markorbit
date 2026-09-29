# LITE-TRADING-CWB-P1 — 三总监交叉审议与 Owner 复用矩阵

状态：Preview 实施基线，2026-09-29。适用范围仅为 Lite Trading Studio 的隔离视觉创作试点。

## 1. 用户、任务与权威边界

- 用户：对当前 Workspace 内具体 Trademark Asset 拥有读取与 Trading Studio 选择权限的 Lite 个人用户。
- Job-to-be-done：从当前 Studio Run 的三个商业方向中理解并选择一个方向，查看真实可辨识的 Demo 视觉成果，调整、比较、恢复并保存一个可重开的浏览器本地 Demo 草稿。
- 产品 Owner：Trading Studio 继续拥有 Studio Run、BrandDNA、Direction Set 与 Selection；本任务不建立新的 Visual Asset Owner、Capability Runtime、Payment Owner 或发布 Owner。
- 权威边界：原商标、Workspace、Studio Run、Direction Set 和 Selection 来自现有 owner state。视觉图像、参数、版本与“保存”只属于明确标记的 Preview fixture / 浏览器本地 Demo 草稿；它们不是 `TradingStudioVisualAsset`、`VisualOutputReference`、Brand Bible、Showcase、付款回执、Listing 或正式商标记录。

## 2. 实现前可复现不足与根因

`TradingSellerValidationFlow.tsx` 的 Deep Build 只有七个空槽。Regenerate、Adjust 和 Compare 只改变一句本地提示；Pin/Remove 只改变组件内集合。方向卡没有主视觉或资产拼图。因此用户无法查看、选择或比较可用的视觉成果。

根因不是合同缺失，而是当前 Seller Validation Preview 没有把获准的 Demo 视觉素材和版本状态绑定到准确的 Trademark Asset、Direction 与版本。严格合同的存在不能证明对应生产运行时已存在。

## 3. REUSE / PREVIEW ONLY / OWNER GAP

| 旅程或事实                                                         | 分类                | 当前证据与本任务处理                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace、Studio Run、Trademark Asset exact reference             | REUSE               | `TradingStudioState.run` 由现有 Trading Studio Gateway 读取；Preview 原样展示 ID/版本，不复制或修改。                                                             |
| BrandDNA                                                           | REUSE               | 当前 owner state 可读时展示 exact version；缺失时准确阻塞，不伪造。                                                                                               |
| Direction Set 三方向及 Selection                                   | REUSE               | 复用现有三角色合同、选择命令、幂等键、刷新后 owner 确认与 currentness guard。                                                                                     |
| 三方向主视觉、资产拼图                                             | PREVIEW ONLY        | 使用仓库内、来源明确的原创 SVG Demo 素材；每张图绑定 source asset、direction ID/version，始终标注 AI 概念 / Demo。                                                |
| 调整、固定、移除、版本比较                                         | PREVIEW ONLY        | 浏览器内对 Demo 素材进行确定性的参数/版本切换，产生真实可见变化；不调用模型，不产生 provider receipt。                                                            |
| 保存与重开                                                         | PREVIEW ONLY        | 仅在当前浏览器 localStorage 保存以 Workspace + asset exact version + Studio Run + direction exact version 隔离的 Demo 草稿；恢复前重新校验当前 source/direction。 |
| Content Studio VisualBrief / VisualOutputReference                 | REUSE（模式参考）   | 已有 exact brief/output lineage、状态、QC 与禁用 paid/provider execution 字段；本任务不把 Trading Preview 写入 Content Studio，也不声称共享 owner。               |
| TradingStudioVisualAsset / Visual QA / Brand Bible / Showcase 合同 | REUSE（合同语义）   | 合同规定 exact lineage、质量审核、私有 AI Concept、human selection 与 publication-ineligible；本任务仅遵守展示语义，不实例化生产对象。                            |
| Trading Deep Build 生成/调整执行 API                               | OWNER GAP           | 主分支未发现 Seller Deep Build 的受治理 invocation、费用确认、结果查询与幂等恢复 route。应由 Trading/Visual Execution owner 独立立项。                            |
| Trading 视觉成果持久化与跨设备版本读取                             | OWNER GAP           | 未发现可写/可读的 durable Deep Build artifact owner。当前合同不能替代运行时证明。                                                                                 |
| 付费生成、使用量审批与回执                                         | OWNER GAP（本旅程） | 仓库有其他受治理调用与用量模式，但未证明适用于 Trading Deep Build；Preview 必须显示能力不可用且费用为“未调用/未收费”。                                            |
| 正式 Listing、外部发布、正式商标资产修改                           | OWNER GAP / 非目标  | 本任务没有权限或 owner seam，全部保持禁用，不提供虚假成功。                                                                                                       |

## 4. 信息架构与响应式行为

入口保持为 Trademark Asset → 当前 Studio Run，而不是空白聊天首页。

桌面：顶部固定当前 Workspace / 原商标 / Studio Run / Direction / Demo version 上下文；方向比较为三张带 Hero 与资产拼图的卡；进入深度工作台后采用“对话与结构化输入 + 当前成果与操作”双栏；版本比较使用同一成果的并列画面。

390px：按“上下文 → 当前步骤 → 对话/控件 → 单张成果”顺序单列；方向和版本比较横向不压缩，改为完整卡片；完整预览通过工作台内独立 Preview 模式查看。主要操作保持可触达且不依赖悬停。

列表/详情：三方向是有限集合比较；进入一个方向后只显示该方向成果。版本历史用独立版本条，不在详情底部重复全部方向。

## 5. 状态矩阵

| 状态           | Preview 行为                                                                       |
| -------------- | ---------------------------------------------------------------------------------- |
| 初始无素材     | 说明需要参考素材，可继续查看内置、明确标记的 Demo 基线，不冒充上传成功。           |
| 有素材未选方向 | 三方向各显示 Hero 与资产拼图；精确选择仍由现有 Selection owner 完成。              |
| 已选方向       | 展示当前方向、source/version 与进入工作台操作。                                    |
| 部分成果完成   | 已完成图像可查看；缺失项独立标记，不把部分数据当成功。                             |
| 正在执行       | 仅作为 Preview 状态故事；不伪造模型运行或收费。                                    |
| 生成能力不可用 | 禁止“生成”；允许确定性 Demo 版本切换，并说明未调用、未收费。                       |
| QA 未通过      | 版本保留用于比较但不可标为当前确认版本。                                           |
| 来源版本变化   | 草稿失效，禁止继续保存为当前；保留只读比较说明。                                   |
| 权限撤销       | 不读取或恢复 localStorage 草稿，显示权限边界。                                     |
| 保存失败       | 保留当前内存状态并提供重试，不提示已保存。                                         |
| 已保存 Demo    | 明确显示“此浏览器 Demo 草稿”，不显示 owner receipt。                               |
| 重开恢复       | 仅同 Workspace、同 source exact version、同 run、同 direction exact version 恢复。 |

修改品牌目标、方向或 source exact version 会使依赖的 Demo 当前确认失效；原商标文件永不被覆盖。

## 6. 可访问性、验收与非目标

- 语义化 heading、fieldset/label、button、status/alert；状态不只靠颜色；所有操作可键盘完成。
- 中文默认，英文完整；locale 只改变 UI copy，不改名称、文件名、用户原文、方向 ID 或成果版本。
- Storybook 覆盖已选、无素材、能力不可用、来源过期、权限撤销、QA 未通过、已保存和 390px。
- Playwright 覆盖准确上下文、三方向图像、进入工作台、可见调整/比较、保存恢复、locale 数据不变及负向边界。
- 非目标：真实图片生成、上传、收费、跨设备存储、Brand Bible/Showcase 生产写入、Listing、发布、正式商标资产修改。

建议 PR 标题：`feat(lite): validate conversational trademark creative workbench`
