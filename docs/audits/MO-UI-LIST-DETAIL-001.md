# MO-UI-LIST-DETAIL-001 — 全产品列表与详情布局审计及设计决策

状态：已完成现状审计与第一批高保真实现；未改变业务 Owner、合同、事件或持久化。

预期 PR：`fix(ui): separate list and detail layouts across products`

## 1. 评审边界

- 用户与 JTBD：平台管理员需要高密度检索和检查全局对象；Workspace 操作者需要管理客户、资产、案件和 Site；Lite 专业用户需要从今日任务进入对象工作；直客需要在手机端理解自己的订单、案件和下一步。
- Product Owner：Core 拥有 Workspace 与成员真相；Commercial / Payment 分别拥有商业与资金真相；MarkReg 拥有 Order / Formal Matter；Site 拥有 Site 安装、配置与域名绑定；Lite 只消费其已接入的 Workspace 投影和自身工作记录。
- 本任务消费现有 Gateway / owner read model，不新增合同，不复制 API 类型，不改变正式状态，不生成配额或趋势真相。
- `QuotaLayoutReview` 仅为 Storybook fixture 评审证据。生产 Workspace Console 的 Quotas 入口继续禁用，直到存在被接受的 owner contract。
- 截图中的 3 项 Demo 配额只证明“小数量”状态，不能推断生产基数。

## 2. 逐页审计

“实际对象数量”分为当前 fixture / 当前响应数和生产上限。生产总量未知时明确写“未知”，不以 Demo 数量代替。

| 产品              | 页面 / 入口                                                                                     | 类型                          | 当前实际数量与规模合同                                                            | 主要任务                               | 修改前布局与重复                                                                            | 决策                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Super Admin       | Overview                                                                                        | 汇总概况                      | 14 个顶层领域入口；聚合业务数量不可用                                             | 判断哪些 owner read 已接入并进入领域   | 一个超长页面依次渲染全部领域、Workspace、证据、认知、知识、数据和商业区；导航与页面内容重复 | Overview 只保留连接性、异常和边界摘要；hash 导航一次只显示一个领域                                         |
| Super Admin       | Core / Brain / Capability / MarkReg / Lite / MGSN / Knowledge / Execution / System / Governance | 领域概况或数据密集列表        | 10 个 owner 领域；各 owner 返回数量不一或明确不可用                               | 检索 owner 投影、查看异常和证据        | 10 个完整领域同时出现在 Overview 下方                                                       | 每个领域独立入口；不可用保持不可用，不以空列表代替                                                         |
| Super Admin       | Commercial / Payment                                                                            | 大量对象列表与数值比较        | Accounts、Workspaces、Catalogue、Orders、Payments、Matters、Providers；生产量未知 | 按 owner 检索商业与资金记录            | 多个集合在一页连续卡片展示                                                                  | 保留 owner 分区；后续 owner 分页合同就绪后拆独立列表/详情；不在本次改语义                                  |
| Workspace Console | Workspace overview                                                                              | 汇总概况                      | Core summary 总数与状态计数；生产量未知                                           | 识别总量与生命周期异常                 | 摘要、完整列表和选中详情同时存在                                                            | 列表与详情互斥；详情不再在列表底部重复出现                                                                 |
| Workspace Console | All Workspaces                                                                                  | 大量对象检索管理              | owner-side 分页，25 / 50 / 100 每页                                               | 搜索、状态筛选、排序、进入 Workspace   | 桌面表格；手机依赖横向滚动；选中后列表仍完整保留                                            | 桌面数据表，390px 转信息卡；详情使用 `adminWorkspaceId` 历史状态，返回保留查询、分页与滚动上下文           |
| Workspace Console | Workspace detail                                                                                | 单对象详情                    | 1 个准确 `workspaceId` 与 version                                                 | 查看生命周期、成员摘要、执行低风险改名 | 出现在完整 Workspace 列表下方                                                               | 独立详情状态，仅展示对象信息、关系、限制与操作                                                             |
| Workspace Console | Plans / Membership / Quotas / Invitations / Audit                                               | 设置、数值比较或运行记录      | owner contract 未接入；截图 fixture 为 3 项配额                                   | 查看配置、分配、使用、来源和调整记录   | 入口禁用；截图方案底部重复 3 条进度                                                         | 生产继续禁用；评审 fixture：3 项用 Master–Detail 且无底部重复，大量配额用搜索/筛选/排序/分页列表与独立详情 |
| Lite              | Today                                                                                           | 个人任务工作列表              | owner snapshot 动态数量                                                           | 先处理需关注和可继续任务               | 任务卡适合当前 JTBD                                                                         | 保持任务卡，不改成后台表格                                                                                 |
| Lite              | Matters                                                                                         | 大量对象检索管理 + 单对象详情 | owner 分页 20 条；生产总量未知                                                    | 搜索案件、进入准确 Formal Matter       | 已有 URL `formalMatterId` 独立列表/详情                                                     | 保持；桌面卡片列表，手机单列；返回保留 query                                                               |
| Lite              | Customers                                                                                       | 大量对象检索管理 + 单对象详情 | 当前 3 条 fixture；生产总量未知且当前不是 live truth                              | 搜索客户、进入关系与活动               | 三张大卡；详情虽互斥但只存在本地状态，无浏览器返回；无显示偏好                              | 默认紧凑横行，可切卡片并记住个人偏好；query 保存搜索、筛选、对象 ID；返回恢复焦点与滚动                    |
| Lite              | Trademarks                                                                                      | 大量资产管理 + 视觉预览       | owner list `limit=100`，生产总量未知                                              | 检索资产、查看准确详情、进入 Studio    | 列表和详情已有路由语义                                                                      | 保持独立列表/详情；视觉资产可用卡片，事实比较不用装饰卡片重复                                              |
| Lite              | Content Studio                                                                                  | 内容/资产列表 + 详情          | 分页 `limit=20` + cursor                                                          | 按阶段处理内容机会并看版本谱系         | 已有列表/详情与完整状态故事                                                                 | 保持；不在详情底部复制整份列表                                                                             |
| Lite              | Opportunities / Professional Review / Execution Release                                         | 个人工作队列 + 详情/工作台    | cursor 或 owner queue；生产量未知                                                 | 审查候选、评审证据、释放执行           | 队列与详情多数已互斥                                                                        | 保持任务导向，不强制统一成表格                                                                             |
| Lite / Site Admin | My Sites                                                                                        | 少量或大量 Site 列表          | 当前 Ready fixture 1 个；新增评审 fixture 2 个；生产量未知                        | 选择 Site 后进入专门设置               | 多 Site 通过详情页中下拉切换，先加载首个 Site 详情                                          | 多于 1 个时先显示独立 Site 横行列表；进入专用设置工作台；单 Site 直达详情                                  |
| Site Admin        | Site settings                                                                                   | 少量固定设置 + 专用工作台     | 单 Site、单当前 configuration、0..n host bindings / services / content slots      | 配品牌、市场、服务、域名、生命周期     | 详情页包含切换器，容易把列表选择和编辑混在一起                                              | 保留专用工作台；移除详情内 Site 下拉；通过“返回 Sites”回列表；不在编辑器下重复全部 Site                    |
| Customer Portal   | Action Center                                                                                   | 个人任务卡列表                | needs attention / waiting / recent，最多 owner read limit                         | 理解下一步并进入业务详情               | 已为业务卡片，适合移动端                                                                    | 保持，不搬 Super Admin 表格                                                                                |
| Customer Portal   | Service Orders                                                                                  | 大量对象列表                  | owner 分页 10；生产总量未知                                                       | 看订单状态并进入详情                   | 每条卡片把 ID、状态、版本、更新时间、Matter 全量 KeyValue 重排                              | 改成业务摘要卡：状态、更新时间、关联 Matter；完整事实只在详情出现                                          |
| Customer Portal   | Formal Matters                                                                                  | 大量对象列表                  | owner 分页 10；搜索、状态、类型、日期过滤                                         | 看商标/申请人/司法辖区并进入详情       | 每条卡片输出 10 个 KeyValue，近似详情重复                                                   | 摘要卡仅保留决策字段；source/version 收入可展开来源；准确 ID 与 version 继续构造详情路由                   |
| Customer Portal   | Order / Matter / Documents / Authorization                                                      | 单对象详情或专门工作台        | 1 个准确 ID + expected version                                                    | 完成当前业务步骤                       | 已有独立 governed route                                                                     | 保持独立详情；不增加无价值视图切换                                                                         |

## 3. 布局决策矩阵

| 对象特征                                    | 默认布局                       | 可切换                                     | 详情策略                                                       | 手机策略                            |
| ------------------------------------------- | ------------------------------ | ------------------------------------------ | -------------------------------------------------------------- | ----------------------------------- |
| 少量固定设置、低频配置                      | Master–Detail 或专用设置工作台 | 仅在快速对照确有价值时                     | 右侧/专用工作台，不重复全集                                    | 单列：先选择，再进入设置            |
| 大量客户、Workspace、Site、订单、案件、资产 | 独立列表                       | 横行/表格/卡片两者都有效时提供并持久化偏好 | 独立 route / history state，使用同一对象 ID、权限和 owner read | 表格转换为语义卡，不缩小字体硬塞列  |
| 个人任务队列                                | 任务卡                         | 否                                         | 上下文详情或工作台                                             | 单列，主操作至少 44px               |
| 视觉内容/资产                               | 预览卡或缩略图网格             | 密度差异真实存在时                         | 独立详情保留预览与谱系                                         | 单列或双列缩略图，不隐藏 provenance |
| 配额、费用、订单、运行记录                  | 可比较表格/紧凑横行            | 卡片仅在面向直客或视觉预览有价值时         | 详情展示来源、历史与操作；无历史不画图                         | 记录卡 + 清晰数值标签               |
| 汇总概况                                    | 指标、异常、趋势               | 否                                         | 链接到真实列表                                                 | 只保留决策摘要，不复制列表          |

## 4. 完整状态与交互矩阵

| 状态       | 必须行为                                                                     |
| ---------- | ---------------------------------------------------------------------------- |
| Loading    | 显示正在读取哪个 owner；不闪现空态或 0                                       |
| Empty      | 仅在 owner 成功返回空集合时显示；区分“全局为空”和“筛选无匹配”                |
| Error      | 401、403、404、409、422、503 保持原语义；可重试时保留查询和草稿              |
| Permission | 明确当前权限不足；不显示“没有数据”                                           |
| Partial    | 明确缺失哪一 owner 投影；其余成功数据继续可见                                |
| Success    | 列表、详情和操作回执共享准确 ID、version、权限与来源                         |
| Mutation   | busy、成功、失败、冲突分别反馈；批量操作必须报告逐项结果，当前未新增批量命令 |
| Return     | 保留 search、filters、sort、view、page、适用滚动和触发元素焦点               |

## 5. 桌面 / 390px 与无障碍决策

- 1440px：Super Admin 与 Workspace Console 使用高密度表格或横行；详情占据独立内容区。Lite 和 Customer Portal 保留各自视觉语言。
- 390px：Workspace 和配额表格转语义卡；Site 列表和 Customer Portal 摘要卡单列；不通过小字号容纳桌面列。
- 表格保持 `thead` 给读屏器；移动卡使用 `data-label` 补列名。导航使用 `aria-current`，视图切换使用 `aria-pressed`，详情返回恢复焦点和滚动。
- 高风险 Site 操作仍需既有确认；配额 fixture 的“调整配额”禁用，不能暗示存在 owner command。

## 6. 语言评审

- 配额专项高保真故事默认简体中文，提供完整 English 切换。
- 现有五套产品运行界面仍以英文 canonical copy 为主；本任务没有引入半成品全局翻译框架或复制业务文案真相。全产品 `zh-CN` 默认与完整 `en` 需要 Product 确认统一 locale contract、术语表和持久化位置后另立跨产品本地化任务。
- ID、状态码、Capability / Workspace / Formal Matter 等 canonical 名称不应被任意翻译成新的业务概念。

## 7. 重复内容清理清单

- [x] Super Admin Overview 不再连续渲染 10 个领域工作区。
- [x] Workspace 详情打开后不再在上方保留完整 Workspace 概况和列表。
- [x] 390px Workspace 表格转为可读记录卡。
- [x] 配额 3 项 Master–Detail 删除底部重复进度列表；无历史时不生成图表。
- [x] 大量配额评审状态具备搜索、状态筛选、排序、分页文案与独立详情入口。
- [x] Lite Customers 的列表视图偏好、查询、详情 ID、焦点和滚动可恢复。
- [x] 多 Site 先进入 My Sites 列表，详情设置页不再重复 Site 下拉列表。
- [x] Customer Portal 的 Order / Formal Matter 卡片不再逐条复刻完整 KeyValue 详情。
- [ ] Commercial / Payment 与其他 Super Admin owner 集合仍需各自 owner 分页合同后再拆详情，不能由 UI 自行发明。
- [ ] 全产品运行态中文默认 / 完整英文仍待统一 locale contract；本次只有配额评审故事完成双语。

## 8. 验收路径

1. Super Admin：Overview → Workspace → 打开 Workspace → 浏览器返回；确认列表不与详情同屏，query 与分页仍在。
2. Quotas fixture：3 项模式切换选中配额；确认仅一份详情；切大量模式验证搜索/状态/排序和移动卡；切换中英文。
3. Lite Customers：设置搜索/筛选/卡片偏好 → 打开客户 → 返回；确认 query、偏好、焦点与滚动恢复。
4. Site Admin：2 Site fixture → 打开一项设置 → 返回 Sites；确认未在编辑器下重复 Site 列表。
5. Customer Portal：Order / Matter 摘要 → 进入准确 ID + version 详情；390px 无横向溢出。

修改前后桌面与 390px 截图保存在 `docs/reviews/mo-ui-list-detail-001/{before,after}`。截图为 Storybook fixture / UI 证据，不代表 live owner 数据或授权成功。
