# Super Admin V2 runnable-design blueprint

- Task ID: `MO-SUPER-ADMIN-V2-RUNNABLE-DESIGN-001`
- Product owner: MarkOrbit platform operations
- User: authenticated internal Super Admin / platform operator
- Job to be done: inspect owner-reported platform state, find the object that needs attention, and enter an explicitly governed follow-up without confusing preview data with runtime truth
- Preview entry: `/super-admin-v2/overview/platform`
- Expected PR title: `feat(operations-console): add runnable Super Admin V2 preview`

## Product and authority boundary

This is an isolated product-review implementation inside `apps/operations-console`. It does not replace the current Control Center entry before product acceptance.

The preview has three explicit truth classes:

1. **Demo UI** — fixture-backed interaction and visual review. Every screen carries a persistent `演示数据` marker.
2. **Real UI** — only existing owner-produced projections may be rendered. Current routes remain owned by Core, Knowledge, Data Engine, Capability, Execution, MarkReg, MGSN and Payment through Gateway contracts.
3. **Protected action** — the preview may explain and stage an action, but must not claim a mutation. A real action requires the owner command, exact authority, expected version/currentness, audit and existing approval mechanism.

Unavailable owner truth is shown as unavailable, never as empty or healthy. Provider Return is not Official Truth; payment is not performance, authority, acceptance or completion. Knowledge remains evidence supply. Data Engine remains objective source-data operations. The UI does not read another service database or create a Super Admin database.

## Information architecture and screen map

The global navigation is the fixed first level. Each module owns a top secondary navigation. URLs use `/super-admin-v2/:module/:page`, so every page is directly addressable and refresh-safe.

| First level     | Route          | Secondary pages                                                                                               | Primary object / question                                                                 |
| --------------- | -------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 总览            | `overview`     | 平台总览、运行健康、实时告警、使用情况、待处理事项                                                            | What needs operator attention across connected owner projections?                         |
| Workspace 管理  | `workspaces`   | 全部 Workspace、订阅与套餐、成员概况、资源配额、产品启用、站点、审计                                          | Which organization is affected and what owner-reported state applies?                     |
| 用户与权限      | `users`        | 全部用户、角色与权限、组织关系、邀请、登录与安全、操作记录                                                    | Who has which relationship and authority, and is the account safe?                        |
| 产品管理        | `products`     | 产品总览、模块启停、套餐与权益、使用情况、功能配置、版本发布                                                  | Is a product globally available, entitled, enabled and healthy—four separate facts?       |
| Data Engine     | `data`         | 总览、数据覆盖、数据源、数据包、任务与调度、数据查询、存储、系统设置                                          | What geography/source/pipeline is current, delayed or blocked?                            |
| Knowledge       | `knowledge`    | 总览、来源管理、采集计划、执行任务、Workers、原始文件、转换处理、证据审核、知识检索、Ready Packages、供应健康 | Where is evidence in the Source → Review → Ready Package supply chain?                    |
| Brain           | `brain`        | 总览、模型管理、智能编排、路由策略、Prompt、执行记录、质量评估、成本分析、系统设置                            | Which model route ran, with what latency, quality, cost and owner status?                 |
| Capability      | `capabilities` | 总览、能力目录、Skills、Agents、工具集成、测试与评估、执行记录、版本管理、权限配置                            | Which stable outcome contract/version/profile is admitted and callable?                   |
| 外部 API 与集成 | `integrations` | 全部集成、API 开关、密钥与凭证、Workspace 授权、健康监测、调用统计、限流配置、失败记录                        | Which provider is affected, at what scope, with what degradation boundary?                |
| 运行与任务      | `operations`   | 任务总览、任务队列、执行记录、Workers、调度计划、失败与恢复、系统日志                                         | Which owner job/run failed, why, and what controlled recovery is allowed?                 |
| 商业与支付      | `billing`      | 收入总览、套餐管理、订单管理、支付记录、发票管理、使用统计、退款与争议                                        | What does the Payment/MarkReg/subscription owner report without creating a second ledger? |
| 安全与审计      | `governance`   | 安全总览、审计日志、权限策略、登录安全、系统配置、合规管理、风险操作                                          | Who did what, under which policy and approval, and what risk needs review?                |

## Interaction hierarchy

- Primary navigation: module switch.
- Secondary navigation: owner-specific page switch.
- Workbench: module-specific visualization/list.
- Inspector: opens from an object row/card and carries provenance, currentness, impact and next allowed action.
- Protected-action dialog: preview-only staging; it never reports owner mutation success.
- Global search and local filters: operate on explicit demo fixtures only.
- State reviewer: switches between success, loading, empty, partial, error and permission examples for visual acceptance.

## Desktop and narrow behavior

- Desktop ≥ 1180 px: 248 px side rail, sticky 72 px top bar, horizontally stable secondary tabs, dense workbench and right-side inspector.
- Tablet: narrower rail, two-column metrics/content, horizontally scrollable secondary tabs.
- Narrow ≤ 760 px: top identity strip, horizontally scrollable first-level navigation, single-column content, tables become stacked records, inspector becomes a full-width bottom sheet, actions remain reachable without horizontal page overflow.

## Complete state matrix

| State            | Meaning                                                         | UI treatment                                             | Recovery                                       |
| ---------------- | --------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| Loading          | Owner projection requested, no result yet                       | labelled skeleton regions                                | wait or leave page                             |
| Empty            | Authoritative request succeeded with zero objects               | object-specific empty explanation                        | change filter / create only where owner allows |
| Error            | Request failed or response is malformed                         | red error panel, no inferred rows                        | retry request                                  |
| Permission       | authenticated principal lacks exact read/action capability      | locked panel with capability name, no data leakage       | request reviewed access                        |
| Partial          | at least one explicit dependency/source is unavailable or stale | amber provenance banner and per-object status            | inspect affected owner/source                  |
| Success          | projection returned and passed contract checks                  | normal workbench with source/currentness labels          | inspect or filter                              |
| Protected action | mutation requires owner authority and review                    | confirmation explains prerequisites; demo never executes | continue in governed runtime when connected    |

## Current / target / future

### CURRENT

- Existing Operations Console with truthful overview and owner-routed Workspace, Commercial, Cognitive, Knowledge and Data projections.
- Real Evidence Review and Lifecycle Provenance flows remain mounted at the existing root app.
- Bounded owner reads do not imply mutation authority.

### TARGET (this task)

- Independent, complete V2 preview shell.
- All 12 first-level modules and every secondary route accessible and refresh-safe.
- Module-specific demo workbenches, search/filter, inspectors and protected-action staging.
- Persistent fixture/truth labelling, state-matrix review, desktop/narrow visual evidence and Playwright path.

### FUTURE (not implemented)

- Connect a page only after its exact Gateway/owner projection and Internal Operator grant exist.
- Add one typed owner mutation at a time with version/currentness, idempotency, reason, impact preview and audit.
- Product review may later approve a production-shell migration; this preview does not perform that cutover.

## Existing contract / service mapping

| UI area                      | Durable owner(s)                               | Existing basis                                                                  | V2 preview status                                                         |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Workspace/user relationships | Core                                           | identity, Workplace membership and permission references                        | Demo visualization; existing Workspace read remains separate              |
| Knowledge                    | Knowledge via Core/Gateway authority           | source ingestion, provenance, freshness, Ready Package query and bounded health | Demo full IA; real bounded health only where current app already connects |
| Data Engine                  | Data Engine via Gateway authority              | bounded owner-local summary                                                     | Demo full IA; no storage/destructive control                              |
| Brain                        | Core                                           | bounded Brain/BrainGap owner reads                                              | Demo; no activation or free-form CRUD                                     |
| Capability                   | Capability Engine                              | registry/version/profile owner reads                                            | Demo; no automatic admission or verification                              |
| Operations                   | Execution plus exact domain owner              | plans, work packages, tasks, approvals, receipts                                | Demo; existing governed Evidence Review remains in current app            |
| Commercial/payment           | Core, MarkReg, Payment, MGSN                   | existing owner-routed Commercial Admin reads                                    | Demo; no second ledger                                                    |
| External integrations        | each consuming owner plus credential authority | no generic cross-service mutation contract                                      | Demo, secret values never rendered                                        |
| Security/audit               | Core and each mutation owner                   | principal/permission references and owner audit                                 | Demo presentation; no authority expansion                                 |

## Acceptance and validation

- All first/second-level links navigate and preserve route on refresh.
- Search/filter changes visible records; an object opens an inspector; every visible action responds.
- Loading, empty, error, permission, partial and success states can be reviewed.
- Demo and protected-action boundaries are always visible.
- Desktop and 390 px narrow screenshots have no clipped required controls.
- Focus order, landmarks, labels, table semantics and dialog names are present.
- Focused Vitest, lint, typecheck, build and Playwright acceptance pass.

## Non-goals

- No owner service, Gateway, shared contract, permission vocabulary, persistence or migration change.
- No iframe, cross-service database read, raw credential display or generic admin proxy.
- No production navigation replacement, production mutation, formal-state mutation, Capability verification, payment, provider contact, filing or Official Truth creation.
