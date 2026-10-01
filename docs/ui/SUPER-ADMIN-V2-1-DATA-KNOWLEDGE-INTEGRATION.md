# Super Admin V2.1 — Data Engine and Knowledge page/integration inventory

- Task ID: `MO-SUPER-ADMIN-V2-1-PAGE-DEPTH-001`
- Scope: `apps/operations-console`, `docs/ui`, `tests/e2e`
- User: authenticated MarkOrbit Internal Operator / Super Admin
- Objective: make every Data Engine and Knowledge secondary route a distinct operator workbench while preserving owner authority and the existing V2 shell
- Expected PR title: `feat(operations-console): deepen Data and Knowledge admin workbenches`

## Review basis

This inventory was checked against:

- MarkOrbit `apps/gateway`, `apps/operations-console` and current contracts;
- local read-only `markorbit-data-engine` admin UI/API source;
- local read-only `markorbit-knowledge` `apps/admin` UI/API source;
- `SYSTEM-BOUNDARIES.md`, `SERVICE-OWNERSHIP.md`, the Control Plane current-state audit and Data Engine integration documents.

The external repositories were inspected only. Their local working trees were not modified.

## Integration labels

- **DIRECT OWNER REUSE** — an owner API and object model exist. V2 may reuse it only after the Gateway exposes a bounded projection with Internal Operator authority.
- **FRONTEND ADAPTATION** — the owner model exists, but the unified Super Admin needs a purpose-built projection/presentation rather than copying the specialist UI.
- **SAFE API MISSING** — no accepted MarkOrbit Gateway route and/or exact Internal Operator capability currently exposes the required operation.
- **CONNECTED READ** — an accepted Gateway read exists today.
- **DEMO ONLY** — implemented in the runnable preview with fixtures; it does not call the owner or claim runtime truth.

## Data Engine

Durable owner: Data Engine. Data Engine owns acquisition, source packages, normalized facts, coverage/freshness, provider-side pagination/cursors, tasks, checkpoints and factual change detection.

Current MarkOrbit connection:

- `/api/internal/control-plane/data/summary` — bounded owner summary; read-only and currently consumed by Operations Console.
- `/api/data-engine/contract`
- `/api/data-engine/cn/cases/:applicationNumber`
- `/api/data-engine/us/cases/:serialNumber`
- bounded US 360/history/assignments/TTAB reads.

These reads do not authorize Data Engine administration or mutation.

| V2 page    | Specialist admin basis                       | Existing owner API                                                                                                                                    | Integration result                                                                                 | V2.1 UI                                                                                 |
| ---------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 总览       | System/Domain overview                       | `GET /api/admin/overview`, `GET /api/admin/v2/system/operations`, `GET /api/admin/v2/system/domain-progress`                                          | FRONTEND ADAPTATION + SAFE API MISSING at Gateway                                                  | domain health, progress, attention queue and owner boundary                             |
| 数据覆盖   | Domain overview and country/source readiness | admin overview/domain progress plus owner-specific readiness                                                                                          | FRONTEND ADAPTATION; no accepted unified coverage projection                                       | jurisdiction matrix, freshness legend and selected-region detail                        |
| 数据源     | raw/source domain inventory                  | no single accepted admin source-registry projection                                                                                                   | SAFE API MISSING                                                                                   | connection cards, cadence, credential-presence only, source inspector                   |
| 数据包     | Source Packages                              | `GET /api/admin/v2/packages`, `GET /api/admin/packages/:packageId`                                                                                    | DIRECT OWNER REUSE; Gateway route/capability missing                                               | server-style filters, package inventory, quality/internal-file detail                   |
| 任务与调度 | Task Center                                  | `GET /api/admin/v2/jobs`, `GET /api/admin/v2/cn-recovery`, `GET /api/admin/v2/system/domain-progress`; controlled `POST /api/admin/v2/domain-tasks/*` | DIRECT OWNER REUSE for reads; SAFE API MISSING for governed commands                               | queue/runs, frozen-plan approval, STOP/RESUME staging, checkpoints, error log           |
| 数据查询   | read-only CN/US lookup                       | current Gateway CN/US case reads                                                                                                                      | CONNECTED READ for existing exact queries; V2 remains DEMO ONLY until explicit runtime-mode wiring | jurisdiction-aware query builder, result sections, provenance and no-result distinction |
| 存储       | Raw inventory and component health           | `GET /api/admin/v2/raw`, `GET /api/admin/v2/system/components`                                                                                        | DIRECT OWNER REUSE; Gateway projection missing                                                     | PG/CH/raw zones, capacity, raw file inventory; no reclaim/delete controls               |
| 系统设置   | System status/components                     | `GET /api/health`, `GET /api/admin/v2/system/components`                                                                                              | FRONTEND ADAPTATION; configuration mutation API intentionally absent                               | version/contract registry, read-only effective config, protected change request         |

### Data Engine command rules

Task commands must retain the owner model: frozen plan, exact `run_id`, `plan_sha256` where required, operator approval, safe stop, durable resume, preserved partial state and owner-produced result. V2 must never turn a button click into an inferred successful run. Storage deletion/reclaim, arbitrary SQL and raw credential access are out of scope.

## Knowledge

Durable owner: Knowledge. Knowledge owns source ingestion references, immutable RawArtifact lineage, conversion, evidence, review, retrieval, Ready Packages, provenance and freshness. It does not own Capability verification, Recommendation, Matter state or Official Truth.

Current MarkOrbit connection:

- Gateway `/api/internal/control-plane/knowledge/evidence-supply-health`, backed by the Knowledge owner `/api/internal/control-plane/evidence-supply-health` route.
- `/api/internal/super-admin/knowledge` returns an owner result whose full portfolio availability is currently `NOT_YET_MODELED`.

The specialist admin contains many routes, but they are not automatically safe to forward to Super Admin. Its own Workspace/auth, CSRF, worker credentials and command rules remain authoritative.

| V2 page        | Specialist admin basis                     | Existing owner API                                                                             | Integration result                                                                   | V2.1 UI                                                                               |
| -------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 总览           | `/dashboard`, source-supply health         | `GET /api/source-supply-health`, control-plane evidence supply health                          | CONNECTED READ only for bounded health; portfolio requires adaptation                | supply funnel, attention queue, freshness and explicit evidence boundary              |
| 来源管理       | `/sources`, source detail/assessment/graph | `GET/POST /api/sources`, `GET/PATCH /api/sources/:id`, assessment/graph/recommendations routes | DIRECT OWNER REUSE; SAFE API MISSING at Gateway                                      | source registry, approval/currentness filters, source graph/detail                    |
| 采集计划       | Collection Plans                           | `GET/POST /api/plans`, plan detail/status/runs                                                 | DIRECT OWNER REUSE; governed write projection missing                                | schedule calendar, plan policy, cadence/output and protected edit flow                |
| 执行任务       | Execution Runs                             | plan runs and run/job APIs                                                                     | DIRECT OWNER REUSE; Gateway projection missing                                       | run timeline, job snapshot, lease/receipt and failure detail                          |
| Workers        | Worker registry/leases                     | worker list/detail and authenticated worker claim/heartbeat routes                             | FRONTEND ADAPTATION; operator read projection missing                                | fleet status, capabilities, concurrency, heartbeat and assignment drawer              |
| 原始文件       | Raw Artifacts                              | raw artifact list/detail, eligible-for-conversion, manual upload                               | DIRECT OWNER REUSE for reads; uploads/authorization remain protected                 | immutable file inventory, duplicate/version state, lineage and conversion eligibility |
| 转换处理       | Conversion Runs/Converters                 | conversion list/dispatch/detail, claim/input/output/cancel controls                            | DIRECT OWNER REUSE; operator Gateway contract missing                                | pipeline board, profile compatibility, dispatch staging and output receipt            |
| 证据审核       | Evidence Sets plus review queues           | `GET/POST /api/evidence-sets`, evidence set detail; source-intelligence review APIs            | FRONTEND ADAPTATION; exact cross-product review authority required                   | split-pane evidence review, exact locator/source, decision staging and history        |
| 知识检索       | `/knowledge/search`, retrieval/audit       | retrieval document/search/federated/compose and audit routes                                   | DIRECT OWNER REUSE for bounded read after Workspace authority; Gateway route missing | query workbench, facets, cited results, currentness and source preview                |
| Ready Packages | Packages and Core handoff                  | `GET /api/ready-packages`, detail, core-intake/content submit and delivery reliability         | DIRECT OWNER REUSE for reads; delivery commands require exact handoff authority      | package lifecycle, manifest, delivery target, receipt and reconciliation              |
| 供应健康       | Source coverage/health                     | `GET /api/source-supply-health`, source coverage board/detail, control-plane health            | CONNECTED READ for bounded health; deeper coverage needs projection                  | jurisdiction/source heatmap, SLA/currentness, failure isolation and owner drilldown   |

### Knowledge command rules

Discovery does not approve a source. A lease is not execution. A conversion output is not reviewed evidence. Reviewed evidence is not Official Truth. A Ready Package is not automatically admitted by Core or consumed by a Product. Every future command must preserve exact Workspace context, owner authorization, CSRF/trusted origin, immutable versions/digests, idempotency and audit.

## V2.1 state and interaction contract

Every page has its own primary object, filters and workbench. All remain fixture-backed in preview mode. The global review-state selector continues to prove loading, empty, error, permission, partial and success states. Page actions either:

- change only local Demo UI and explicitly say so; or
- open the protected-action dialog and explain the missing owner/Gateway requirements.

Direct URLs remain `/super-admin-v2/data/:page` and `/super-admin-v2/knowledge/:page`.

## Acceptance

- all 8 Data Engine pages and all 11 Knowledge pages render distinct page-specific workbenches;
- each page has a direct URL and a page-specific screenshot;
- Data jobs proves task filters, run inspection and a protected recovery/approval path;
- Knowledge evidence review proves exact source/locator context and a protected decision path;
- search/filter/detail or an equivalent page-specific interaction works on every page;
- desktop and narrow layouts do not horizontally overflow;
- no iframe, cross-service database read, new service contract, production write or implied success is introduced.
