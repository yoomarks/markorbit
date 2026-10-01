# Super Admin V2 navigation and management-experience IA

- Task ID: `MO-SUPER-ADMIN-V2-NAV-001`
- Product owner: MarkOrbit Platform Operations
- Users: platform operations, customer support, product managers, data operations and technical administrators
- Job to be done: enter the correct governed workspace from a work task without first learning the complete MarkOrbit service topology
- Stable entry: `/super-admin-v2/:module/:page`
- Expected PR title: `feat(operations-console): simplify Super Admin V2 navigation`

## Authority and scope

This change reorganizes navigation and display names only. Every existing module, page route, owner boundary, permission check, Demo/Real boundary and protected-action rule remains intact. It does not merge owner truth, add production APIs, create write authority or replace the `/` console.

Brain and Capability are visually grouped under **AI 与能力 / AI & Capabilities**, but they remain separate modules. Brain owns model routing, orchestration and run evidence. Capability owns Stable Outcome Contracts, governed implementations, evidence and version lineage. A visual group is not a shared owner or permission boundary.

## Current navigation audit and decision

| Current module  | Problem observed                                              | New navigation label          | Group      | Decision and basis                                                             |
| --------------- | ------------------------------------------------------------- | ----------------------------- | ---------- | ------------------------------------------------------------------------------ |
| 总览            | Accurate but mixed with eleven equal-weight technical modules | 总览 / Overview               | 工作台     | Keep; first entry for cross-owner health and attention                         |
| Workspace 管理  | “管理” repeats the console context                            | 工作空间 / Workspaces         | 业务管理   | Rename; route and Core ownership unchanged                                     |
| 用户与权限      | Clear and safety-relevant                                     | 用户与权限 / Users & Access   | 业务管理   | Keep                                                                           |
| 产品管理        | “管理” repeats the console context                            | 产品 / Products               | 业务管理   | Rename; availability, entitlement, enablement and health remain separate facts |
| Data Engine     | Requires platform architecture knowledge                      | 数据 / Data                   | 数据与智能 | Short navigation label; Data Engine remains visible in technical context       |
| Knowledge       | Product name does not immediately express the operator task   | 知识 / Knowledge              | 数据与智能 | Localize navigation; evidence-supply meaning remains unchanged                 |
| Brain           | Too easily confused with Capability                           | AI 编排 / AI Orchestration    | AI 与能力  | Rename only; retains Brain route and owner meaning                             |
| Capability      | Too easily confused with Brain                                | 能力目录 / Capability Catalog | AI 与能力  | Rename only; retains Capability route and owner meaning                        |
| 外部 API 与集成 | Long at narrow widths                                         | 集成 / Integrations           | 平台运维   | Rename; credentials, grants and connection health remain distinct              |
| 运行与任务      | Redundant wording                                             | 运行 / Operations             | 平台运维   | Rename; Run, Job, Schedule and Recovery stay distinct in secondary pages       |
| 商业与支付      | Does not match the operator’s common “billing” task           | 账单 / Billing                | 业务管理   | Rename; no second financial ledger is created                                  |
| 安全与审计      | Clear risk boundary                                           | 安全与审计 / Security & Audit | 平台运维   | Keep                                                                           |

The previous flat sequence is replaced by five labelled groups. The group headings are orientation only and grant no permissions:

1. **工作台**: 总览
2. **业务管理**: 工作空间、用户与权限、产品、账单
3. **数据与智能**: 数据、知识
4. **AI 与能力**: AI 编排、能力目录
5. **平台运维**: 集成、运行、安全与审计

## Complete secondary-page IA

All paths are stable. “Keep” below means the label remains the clearest task description; “rename” changes display copy only.

| Route module   | Current secondary pages                                                                                       | New secondary pages                                                                                   | Basis                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `overview`     | 平台总览、运行健康、实时告警、使用情况、待处理事项                                                            | 运营总览、系统状态、告警、平台用量、待办                                                              | Use operator questions rather than telemetry vocabulary                              |
| `workspaces`   | 全部 Workspace、订阅与套餐、成员概况、资源配额、产品启用、站点、审计                                          | 工作空间、订阅、成员、配额、产品启用、站点、变更记录                                                  | Remove repeated scope words; audit remains Workspace-scoped                          |
| `users`        | 全部用户、角色与权限、组织关系、邀请、登录与安全、操作记录                                                    | 用户、角色与权限、工作空间关系、邀请、登录安全、用户操作                                              | Make relationship and audit scope explicit                                           |
| `products`     | 产品总览、模块启停、套餐与权益、使用情况、功能配置、版本发布                                                  | 产品、全局可用性、套餐权益、产品用量、功能配置、版本发布                                              | Keep global availability separate from entitlement and Workspace enablement          |
| `data`         | 总览、数据覆盖、数据源、数据包、任务与调度、数据查询、存储、系统设置                                          | 数据概览、数据覆盖、数据源、数据包、采集任务、数据查询、存储管理、数据设置                            | Surface source and acquisition work while retaining Data Engine semantics in details |
| `knowledge`    | 总览、来源管理、采集计划、执行任务、Workers、原始文件、转换处理、证据审核、知识检索、Ready Packages、供应健康 | 知识概览、来源、采集计划、采集运行、Workers、原始产物、转换、证据审核、检索、Ready Packages、供应状态 | Preserve Source → Raw Artifact → Evidence → Ready Package distinctions               |
| `brain`        | 总览、模型管理、智能编排、路由策略、Prompt、执行记录、质量评估、成本分析、系统设置                            | AI 概览、模型、编排、模型路由、Prompt、执行记录、质量、成本、AI 设置                                  | Describe model-orchestration tasks without implying Capability ownership             |
| `capabilities` | 总览、能力目录、Skills、Agents、工具集成、测试与评估、执行记录、版本管理、权限配置                            | 能力概览、能力目录、Skills、Agents、工具、测试与评估、调用记录、版本、调用权限                        | Emphasize governed invocation, versions and evidence                                 |
| `integrations` | 全部集成、API 开关、密钥与凭证、Workspace 授权、健康监测、调用统计、限流配置、失败记录                        | 集成目录、服务开关、凭证、Workspace 授权、运行状态、调用量、限流、失败记录                            | Separate global service control, grants and actual connection health                 |
| `operations`   | 任务总览、任务队列、执行记录、Workers、调度计划、失败与恢复、系统日志                                         | 运行概览、任务队列、执行记录、Workers、调度、失败与恢复、日志                                         | Keep Job, Run, Schedule, Recovery and Log meanings distinct                          |
| `billing`      | 收入总览、套餐管理、订单管理、支付记录、发票管理、使用统计、退款与争议                                        | 收入总览、套餐、订单、支付、发票、用量、退款与争议                                                    | Shorten nouns without changing Payment/MarkReg owner truth                           |
| `governance`   | 安全总览、审计日志、权限策略、登录安全、系统配置、合规管理、风险操作                                          | 安全概览、审计日志、权限策略、登录安全、安全配置、合规、风险操作                                      | Make the configuration scope explicit and retain risk language                       |

## Task-first entry points

The navigation adds a compact **常用任务 / Common tasks** disclosure with direct links. It is an accelerator, never a permission substitute.

| Role/job                                       | Direct route                           | User question                                           |
| ---------------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| Platform operations: check system health       | `/super-admin-v2/overview/health`      | Which owner or dependency is degraded or unavailable?   |
| Customer support: find Workspace               | `/super-admin-v2/workspaces/directory` | Which organization, subscription and site are affected? |
| Customer support/security: inspect user access | `/super-admin-v2/users/roles`          | Which role and Workspace grant explains access?         |
| Operations: handle failed task                 | `/super-admin-v2/operations/recovery`  | Which recovery, retry or replay is actually allowed?    |
| Data operations: inspect source                | `/super-admin-v2/data/sources`         | Is the source connected, current and authorized?        |
| Product management: manage product             | `/super-admin-v2/products/portfolio`   | What is released, available, entitled and enabled?      |
| Technical administration: inspect API status   | `/super-admin-v2/integrations/health`  | Is the service enabled, granted and actually healthy?   |
| Security: query audit record                   | `/super-admin-v2/governance/audit`     | Who did what, to which object and under which policy?   |

## Page and language rules

- The sidebar expresses module ownership; the secondary navigation expresses the current task; the page body keeps one task-specific H1.
- Module context on non-overview pages remains compact and does not repeat a large introduction.
- Chinese and English use identical URLs, owner objects and permissions. Translation changes presentation only.
- Enable, Disable, Suspend, Revoke, Retry, Replay, Recover, Rollback, Delete and Archive remain distinct commands.
- Raw logs, official records, object IDs, source IDs, SHA values and audit evidence remain verbatim.
- “我的” is reserved for personal account, language and preference surfaces.

## Desktop, narrow and accessibility behavior

- Desktop and 1366×768: labelled groups remain visible; the sidebar scrolls independently if height is constrained.
- 390 px: the same hierarchy appears in the existing navigation drawer; links retain 44 px touch targets and group labels are not compressed into small text.
- Common tasks uses native disclosure semantics, works by keyboard and does not trap focus.
- Active module and active secondary page remain exposed through `aria-current`; group labels are not interactive.
- Loading, empty, error, permission, partial and success states remain owned by each existing page and are unaffected by navigation grouping.

## Acceptance

1. All twelve modules and all ninety registered routes remain directly addressable and refresh-safe.
2. Each old route resolves to the same module/page implementation after label and grouping changes.
3. Common-task links land on the exact intended page and preserve Demo/Real mode.
4. Chinese and English grouping, navigation, page titles and task links switch without losing current object, filter, draft or protected confirmation.
5. Desktop, 1366×768, 390 px and 200% zoom have no hidden active route or clipped required action.
6. Existing object-integrity, safety, Demo/Real and real-read-only tests continue to pass.

## Non-goals

- No owner, service, Gateway, shared contract, permission, database or production entry change.
- No merged Brain/Capability truth, generic Admin Proxy, iframe or cross-service database read.
- No production mutation, formal-state mutation, Capability verification or payment execution.
