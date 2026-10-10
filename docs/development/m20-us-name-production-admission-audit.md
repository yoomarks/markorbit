# M20 US NAME 生产准入证据与入口审计

日期：2026-10-11（Asia/Shanghai）。任务：[M20-C8 / #1524][task]。

## 结论与审查边界

US NAME 消费准入继续保持 unavailable。M20-C1–C7 已提供消费端拒绝逻辑、
来源绑定空结果、Core SQL 与合成 HTTP 容量证据，以及正文超时错误映射。
这些交付没有批准来源许可、具体 Dataset/Key 映射、覆盖时点、生产 reader 或真实容量。
[Data Engine #883][gate] 仍为 OPEN / BLOCKED 的生产证据门槛。

本次交付是入口和证据清单，不新增准入合同、记录库、凭证、grant 或生产配置。
没有连接生产主机、数据库或秘密管理系统，没有调用真实 Provider；
下文的部署、网络、凭证持有人和实时覆盖状态均须由相应 Owner 提交证据。

| 可复核基线      | 精确范围                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| MarkOrbit       | `352155bc2fa713664aae0f0742c45ae72dd21ca5`；任务 bootstrap 的 authoritative main                     |
| Data Engine     | `e4a58d1df15a81f9f20b8de922d2e516446ed1bb`；只读代码与 #883 记录                                     |
| 产品/Owner 决议 | [DE-A2 审计][de-a2]；复用 Core entitlement，首片限 US + NAME、SEARCH × Portfolio；具体映射与许可另批 |
| 既有容量解释    | [Core entitlement scale evidence](m20-core-entitlement-scale.md)；只承认其声明的合成范围             |

## 实际入口与凭证边界

| 入口                                                                     | 代码已保证的行为                                                                                                                                                                                            | 生产验收尚需的证据                                                                                                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/data-engine/applicants/discover`                              | [Gateway applicantQuery][mo-product] 从当前认证 principal 建立 Workspace，上下文不能由 body 伪造；检查 Origin/CSRF 与 `workspace:read`，仅接受 US NAME；读 admission、解析当前 Core grant 后才请求 Provider | 部署确实走此入口；安装可信 reader；来源、当前授权和调用身份已获准                                                                                           |
| `POST /internal/workspaces/:workspaceId/commercial/entitlements/resolve` | [Gateway 当前解析][mo-commercial] 使用内部 service identity 和服务端评价时点；Core 当前 authority/entitlement 是既有 Owner 路径                                                                             | 实际 Core 部署版本、当前 Workspace/member/grant、内部身份使用范围与撤销证据；service secret 本身不是数据用途许可                                            |
| `GET /api/v1/us/applicants/by-name`                                      | [DE route][de-route] 校验 query，传入 Workspace/request context；router 使用服务级认证与限流依赖                                                                                                            | 所有可达 consumer 与凭证持有人、网络边界、实际认证/限流设置；此 route 没有调用 Core Workspace entitlement，`requester_workspace_id` 仅是查询/游标绑定上下文 |
| `createRuntime()` / 标准 Gateway 启动                                    | [main.ts][mo-main] 调用无参数 `createRuntime()`；[index.ts][mo-index] 只转发显式注入的 `usApplicantNameAdmission`，没有从环境安装 reader 的逻辑；[admission][mo-admission] 缺 options 即拒绝                | 受信 adapter 的批准来源与真实组合入口；设置 `DATA_ENGINE_URL`、`DATA_ENGINE_API_KEY`、`CORE_URL`、`MO_INTERNAL_SERVICE_SECRET` 不会安装 admission reader    |
| `POST /api/data-engine/applicants/portfolio`                             | [同一 Gateway 文件][mo-product] 的 `PORTFOLIO` 分支使用来源引用与既有认证，未调用 US NAME admission；Provider path 为 candidate 的 `/portfolio`                                                             | 属于独立消费用途/端点，必须单列 Owner 准入范围；不能宣称 C1 已保护全部申请人/资产查询。`SEARCH:PORTFOLIO` 许可值不自动授权这个 HTTP 端点                    |
| Lite Seed Review 的 `discoverApplicants`                                 | [现有前端 API][mo-seed] 提交 `jurisdiction: CN`，当前 Gateway discovery 明确只接受 US NAME，因而被拒绝                                                                                                      | 这是另一个集成范围；本审计没有证明一个已接通的 US NAME 用户旅程，也不修改 CN 路径                                                                           |
| DE 的 SQL adapter / 直接数据访问                                         | [accepted target reader][de-reader] 包装只读 SQL，US NAME Owner 通过该 adapter 查询；应用层包装没有实现 Workspace entitlement                                                                               | 实际数据库 role、读表范围、网络可达性与获准运维/批处理入口；包装限制不能替代数据库权限或证明所有直读路径受 M20 控制                                         |

在两仓库的 `apps`、`services`、`scripts` 与 DE `app` 中按 route、
`discoverApplicants`、`discover_applicants_by_name`、`usApplicantNameAdmission`、
`readAdmission` 检索，生产 reader 的赋值只发现测试 fixture。
这是这两个版本内的代码检索结果，不是对外部部署、反向代理、SDK 或脚本持有人的完整盘点。

### 配置声明与实际部署必须分开

[DE Settings][de-config] 的仓库默认值为 `integration_auth_mode=disabled`、
`integration_rate_limit_enabled=False`；这是代码默认值，不是本次实测生产设置。
[require_integration_auth][de-security] 在 disabled 模式直接返回；required 模式
校验已配置服务 bearer，支持多 key 轮换且要求每个 key 至少 32 字符。
该 shared service bearer 没有内建 Workspace/用途限制。

[IntegrationRateLimiter][de-rate] 启用后按一个进程所见的客户端 IP 计数；
默认参数为 120 次 / 60 秒。它不是跨实例全局 Workspace 配额。
真实代理/IP 解释、实例数量、限流开启状态、429/Retry-After 行为和 key 持有人须验收。
现有 [Agency dogfood runbook](../runbooks/LITE-AGENCY-PRODUCTION-DOGFOOD.md)
也要求 required 模式、匿名 contract 请求被拒绝；该要求不是已执行的证明。

生产入口清单须保留 consumer/实例标识、允许的 route/用途、网络边界、
非秘密凭证引用、保管/轮换责任、撤销或禁用证据与验收时点。
不记录 key/token、secret 值、数据库密码、真实姓名查询或完整响应正文。
同一 service key 可以直达 Provider 的事实必须在清单中处理；
由 Owner 选择受控网络/凭证隔离或独立合同任务，不能把 Gateway 检查当成全局 enforcement。

## 现有 admission 字段需要什么证据

以下字段来自现有 [USApplicantNameAdmission][mo-admission]，不是新 schema。
其字符串校验、时间校验和固定值检查必须保留；真实性由可信 reader 读取的 Owner 记录负责。

| 字段/绑定                               | 代码消费方式                                                                                 | 必须提供的 Owner 证据                                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `revision`                              | 非空；每次读获得一份克隆的决策输入                                                           | 获准记录的修订引用、适用范围、撤销/到期与版本获取规则；不能由环境随意拼接                                                                         |
| `entitlementKey`                        | 对齐 Core 返回 key，精确 Workspace subject、当前 `resolvedAt`、BOOLEAN true 与 grant lineage | 经批准的国家/数据集族/版本/Action/Purpose → 既有 key 映射；Core 商业授权 Owner 的真实生效记录与 subject 边界                                      |
| `datasetVersion`                        | 必须等于 `DATA_ENGINE_DISCOVERY_CONTRACT_V1`                                                 | 当前字段绑定的是 Discovery wire contract；它没有单独标识物理数据集。另需 Owner 批准的物理表、read-model/schema 与该合同的兼容映射，不扩大字段含义 |
| `sourceVersion`                         | 非空；返回页 `source_snapshot.source_version` 必须完全相等                                   | 当前接受的 `us-serving-epoch:<token>`、绑定 receipt 与获准兼容规则；不能从旧页或旧决策复用权限。当前实现是精确 epoch pin，不是通配兼容            |
| `licenceReference`                      | 非空引用                                                                                     | 可验证的获准来源使用记录、适用数据与版本、用途、条件、生效/失效、撤销及责任 Owner；有字符串不代表许可已获准                                       |
| `permittedUse`                          | 固定 `SEARCH:PORTFOLIO`；其他用途拒绝                                                        | Product/来源使用 Owner 对此用途的明确认可；不继承 Opportunity、Creator、营销、公开传播或相邻 Portfolio HTTP 路径许可                              |
| `readiness`                             | 固定 `ACCEPTED`                                                                              | DE 对同一 epoch 的 candidate/NAME 完整性、接受与有效性记录；不能仅用健康响应或单次查询成功替代                                                    |
| `coverageThrough`                       | 必须是有效日期、不晚于评价时点；在最大覆盖年龄内，返回前再检查                               | 真正的来源覆盖截至时点及获取/验证依据；独立于入库时间、`observed_at`、backfill `finished_at` 和请求时钟                                           |
| `maximumCoverageAgeMs`                  | 非负安全整数；用于消费 currentness                                                           | Product/DE Owner 批准的允许年龄和未知/滞后处置；本审计不选择天数，不设永久 fresh                                                                  |
| `validUntil`                            | 有效日期且严格晚于检查时点；返回前复检                                                       | 当前 admission 有效窗口与到期/撤销来源；不得超过其来源使用和覆盖决议允许的窗口                                                                    |
| `readAdmission(signal)` 与 Core options | 每次读；reader 默认预算 3s，故障/超时/缺记录拒绝；再进行当前 Core evaluation                 | 获准 reader 的 Owner 边界、来源记录定位/校验、更新和撤销规则、失败语义与实际 runtime 注入；不复制 grant truth，不缓存许可结论                     |

## 物理读模型、epoch 和时间依据

| 代码可确认对象                                                                 | 当前作用                                                                                                                                                    | 不可推导的结论                                                                                           |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `markorbit_facts.us_applicant_name_lookup_current`，`APPLICANT_NAME_LOOKUP_V1` | [NAME lookup][de-lookup] 按规范化名字找到 candidate keys                                                                                                    | 尚未获得本次用途的 Dataset Family/版本许可或部署位置验收                                                 |
| `markorbit_facts.us_applicant_candidate_current`，`US_OWNER_READ_V1`           | [candidate index][de-candidate] 承载来源化身份候选；NAME Owner 读取贡献行                                                                                   | 候选不是已核实法律主体，不自动建立客户关系                                                               |
| [accepted target adapter][de-reader] 与 [target constants][de-target]          | 目标 database 为 `markorbit_facts`，HTTP port 为 28123；容器与本机 host 选择不同                                                                            | 仓库常量不是现场磁盘、storage policy、网络和数据库权限的证明                                             |
| [USApplicantServingEpoch][de-control]                                          | durable accepted bulk run、plan hash、checkpoint sequence、final audit version 构成 token；Owner 前后校验相同 epoch                                         | epoch readiness 不提供覆盖截至日期、licence 或 Workspace 权限                                            |
| [零结果观察分支][de-owner]                                                     | 首个零结果须有最新 run SUCCESS、绑定 epoch 与完整性 receipt、带时区的实际 `finished_at`，才返回 `observed` + `results=[]`；否则保留无 snapshot 的 null 响应 | materialization observation 不是来源覆盖或 freshness；空 continuation 仍拒绝，不能宣称全世界不存在该主体 |
| [Data Trust][de-trust]                                                         | 分别判定 queryable、complete、fresh、accepted、trusted-for-silence                                                                                          | 不能从其中一个布尔值替代其他证据或 Core entitlement                                                      |

[US NAME Owner][de-owner] 的普通读 settings 为 1 thread、最多 1,000,000 rows、
overflow throw；贡献行上限 10,000。
[共享查询/游标][de-query] 约束名字长度最多 512、page size 1–100、
NAME 总结果最多 100、游标最多 100 pages，并绑定 query/Workspace/source。
backfill/reconciliation 的批量设置属于维护任务，不能用来放宽消费读预算。

## 逐项生产通过条件

责任列是需要提供证据的 Owner 角色，不是本次对人员的指派或替代批准。
已完成的代码交付和仍待批准的门槛必须分别记录。

| Gate                      | 需要的责任角色                                        | 可验收交付                                                                                                                    | 通过 / 停止条件                                                                                                  |
| ------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| G1 来源使用许可           | 来源使用/许可 Owner，Product 用途 Owner               | 精确资料范围、用途、条件与有效窗口的获准记录及可验证引用                                                                      | 覆盖 SEARCH × Portfolio 的本片；缺失、用途不符、失效或撤销则停止                                                 |
| G2 数据集与 key 映射      | DE 数据 Owner，Core 商业授权 Owner，Product Owner     | 物理 read model/schema、Discovery 合同、五维 scope、key、epoch 兼容/更新规则的获准修订                                        | 每个绑定可验证；wire contract 名字不能替代 Dataset 身份；尚未选定值则停止                                        |
| G3 覆盖/currentness       | DE 数据 Owner，Product 消费质量 Owner                 | 有依据的覆盖截至时点、完整性/接受 receipt、允许年龄、失效/未知规则                                                            | 来源证据支持所选时点且 current；只有 materialization/入库时间则停止                                              |
| G4 入口与凭证边界         | 部署/Security Owner，各 consumer Owner                | 实际 route、consumer、网络/DB role、非秘密凭证引用、required auth 与限流验证、直读处理结果                                    | 未登记的可达直读或无法证明的身份/边界必须处理；不以 Gateway 门禁证明所有调用者获准                               |
| G5 可信 reader 与当前授权 | 来源记录 Owner，Gateway/Core Owner                    | 在获准记录基础上的最小 reader、真实 runtime 注入、每页当前 Core evaluation、返回前来源复检与否定矩阵                          | 许可/currentness/authority 故障均无事实交付；record shape 或测试 fixture 不算真实安装。实现另开限定 scope 的任务 |
| G6 完整路径容量与预算     | Gateway/Core/DE runtime Owner，Product 服务目标 Owner | 经允许的代表性真实 Provider 只读负载、部署/数据形状、首请求/冷缓存定义、并发、p95/max、限流、取消与源变化证据，获准端到端预算 | 所有受保护阶段与部署约束能解释；合成 fixture 或多个独立 timeout 不能代替验收；无获准测试范围则不发生产流量       |

G1–G3 和 G4 的登记先使用已有记录与只读部署证据，避免为缺许可的数据跑大规模验证。
它们完成后才给 G5 选择真正的数据来源与最小 adapter。
G6 在 Owner 允许的范围内复用现有负向/规模矩阵，选择代表性样本并记录实际成本；
不重采全量、不反复重建历史、不扩大真实调用或另外构造权限缓存。
所有 Gate 通过后，生产 enablement 仍走既有部署与授权任务，本审计不会开启它。

### 已有验证如何计入 G6

| 证据                      | 已证明                                                                                                                          | 仍未证明                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| C3/C4 PostgreSQL resolver | 合成 1k/10k/100k grant-version shape；优化后 1 candidate / 418 logical JSON bytes；撤销、历史、subject/key 移动语义             | 真实生产 grant shape、USER assignment、同一 candidate 长历史、冷缓存和部署容量 |
| C5 protected HTTP         | 真实 Gateway/Core HTTP + PostgreSQL 身份/权限；Provider/admission 为本地合成 empty-page；串行、八并发、否定路径与默认 Core 超时 | 真实 DE/source 容量、部署 credential 清单、数据库取消或一个端到端预算          |
| C6/C7 TCP 回归            | Provider 5s budget 覆盖正文；Core 3s 认证正文故障映射为 unavailable；完整否定/冲突保留；认证失败无下游读取                      | 生产吞吐/SLO、来源许可、覆盖时点或原子撤销与事实读取                           |

目前独立默认预算包括认证 3s、admission reader 3s、Core entitlement 3s、Provider 5s，
以及 Core PostgreSQL 默认 statement/query 10s、pool maximum 10。
这些数值分别来自 [认证][mo-auth]、[admission][mo-admission]、[Core call][mo-commercial]、
[Provider client][mo-client] 与 [Persistence config][mo-db-config]/[database][mo-db]。
它们不是一项已经获准的总耗时或强一致性承诺；HTTP abort 也不自动证明数据库工作停止。

截至 C7 的合并提交 `09f4f913cdff32a8642aa0629131a5e610156743`，
17 个新认证正文 TCP 用例、4 个 SQL 与 5 个 protected HTTP 用例及全部 12 条主线工作流通过。
可复核 [完整回归][c7-regression]、[SQL/HTTP evidence][c7-scale] 和 [浏览器/runtime][c7-browser]。
这是该精确提交的 CI 证据，不是本次生产现场验收。

## 本次完成条件与下一步

本次完成：可追溯的入口、配置、物理读模型与 admission 字段清单；
六个 Owner gate 的证据与停止条件；文档和适用 CI 验证。
本次未观察到已获准的 G1–G6 生产证据集合，不能宣布生产就绪或关闭 #883。

下一步先由既有 Owner 记录确定 G1/G2/G3 的精确范围与来源，
并取得 G4 的实际部署入口清单；再据此为 G5 reader 建立独立实施边界。
若证据仍缺，保留 unavailable 和明确的缺口记录，不用当前 request clock、
fixture key、backfill 完成时间或官方来源名称拼出一条“获准”记录。

[task]: https://github.com/yoomarks/markorbit/issues/1524
[gate]: https://github.com/yoomarks/markorbit-data-engine/issues/883
[de-a2]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/docs/audits/DE-A2-M20-ADMISSION-2026-10-09.md
[mo-product]: https://github.com/yoomarks/markorbit/blob/352155bc2fa713664aae0f0742c45ae72dd21ca5/apps/gateway/src/product-loop-http.ts
[mo-commercial]: https://github.com/yoomarks/markorbit/blob/352155bc2fa713664aae0f0742c45ae72dd21ca5/apps/gateway/src/workspace-commercial-http.ts
[mo-main]: https://github.com/yoomarks/markorbit/blob/352155bc2fa713664aae0f0742c45ae72dd21ca5/apps/gateway/src/main.ts
[mo-index]: https://github.com/yoomarks/markorbit/blob/352155bc2fa713664aae0f0742c45ae72dd21ca5/apps/gateway/src/index.ts
[mo-admission]: https://github.com/yoomarks/markorbit/blob/352155bc2fa713664aae0f0742c45ae72dd21ca5/apps/gateway/src/data-engine-applicant-admission.ts
[mo-seed]: https://github.com/yoomarks/markorbit/blob/352155bc2fa713664aae0f0742c45ae72dd21ca5/apps/lite-web/src/api/seed-review.ts
[mo-auth]: https://github.com/yoomarks/markorbit/blob/352155bc2fa713664aae0f0742c45ae72dd21ca5/apps/gateway/src/auth.ts
[mo-client]: https://github.com/yoomarks/markorbit/blob/352155bc2fa713664aae0f0742c45ae72dd21ca5/apps/gateway/src/data-engine-http.ts
[mo-db-config]: https://github.com/yoomarks/markorbit/blob/352155bc2fa713664aae0f0742c45ae72dd21ca5/packages/persistence/src/config.ts
[mo-db]: https://github.com/yoomarks/markorbit/blob/352155bc2fa713664aae0f0742c45ae72dd21ca5/packages/persistence/src/database.ts
[de-route]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/integration_api.py
[de-config]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/config.py
[de-security]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/integration_security.py
[de-rate]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/integration_runtime.py
[de-reader]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/us/accepted_target_read.py
[de-target]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/us/target_canary.py
[de-lookup]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/applicant_name_lookup.py
[de-candidate]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/us/applicant_candidate_index.py
[de-control]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/us/applicant_candidate_backfill_control.py
[de-owner]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/us/applicant_owner_read.py
[de-query]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/applicant_owner_read.py
[de-trust]: https://github.com/yoomarks/markorbit-data-engine/blob/e4a58d1df15a81f9f20b8de922d2e516446ed1bb/app/data_trust.py
[c7-regression]: https://github.com/yoomarks/markorbit/actions/runs/38063118119/job/114245610121
[c7-scale]: https://github.com/yoomarks/markorbit/actions/runs/38063118136/job/114245237216
[c7-browser]: https://github.com/yoomarks/markorbit/actions/runs/38063118159
