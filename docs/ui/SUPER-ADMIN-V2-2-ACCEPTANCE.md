# Super Admin V2.2 — page-depth acceptance and V2.3 integration order

- Task ID: `MO-SUPER-ADMIN-V2-2-PAGE-DEPTH-001`
- Repository: `markorbit`
- Allowed directories: `apps/operations-console`, `tests/e2e`, `docs/ui`
- User: authenticated MarkOrbit Internal Operator / Super Admin
- Objective: preserve the accepted V2 shell and make every secondary route a distinct, reviewable management workbench
- Canonical sources: MarkOrbit Books 01–07, accepted Capability Canon, `AGENTS.md`, `SUPER-ADMIN-V2-BLUEPRINT.md`, owner contracts and current Gateway routes
- Contracts changed: none
- Expected PR title: `feat(operations-console): complete Super Admin V2.2 page workbenches`

## Delivered boundary

V2.2 remains an isolated runnable design under `/super-admin-v2`. It does not replace the current `/` Operations Console, add a database, widen a shared contract, call a production command, use an iframe or read another service's database.

All visible records are labelled Demo fixtures. A Demo action either changes local presentation state or opens a protected-action review. It never claims an owner mutation succeeded. Loading, empty, error, permission, partial and success remain explicit review states in the dedicated Demo review tools region; future Real mode must derive runtime state from the owner and must not expose this state selector.

## Page-level acceptance matrix

The route-matrix browser test directly opened every page, checked the module heading, secondary navigation and page-specific test surface, then captured its desktop screenshot.

| Module      | Pages | Primary operator objects and page-specific workspaces                                                                                                            | Evidence             |
| ----------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 总览        |     5 | cross-owner service topology, health matrix, alerts, usage and attention cases; alert → dependency/task/action inspection                                        | 5 route screenshots  |
| Workspace   |     7 | Workspace directory, subscription, memberships, quotas, product enables, sites and owner audit                                                                   | 7 route screenshots  |
| 用户与权限  |     6 | identity directory, roles, cross-Workspace relationships, invitations, login security and activity                                                               | 6 route screenshots  |
| 产品管理    |     6 | product portfolio, global policy, plan entitlement, Workspace enablement, health, feature and release lineage                                                    | 6 route screenshots  |
| Data Engine |     8 | coverage, sources, packages, task/run/checkpoint recovery, query, storage and effective settings                                                                 | 8 route screenshots  |
| Knowledge   |    11 | sources, plans, runs, workers, immutable raw artifacts, conversion, evidence review, retrieval, Ready Packages and supply health                                 | 11 route screenshots |
| Brain       |     9 | model routes, orchestration chains, fallback policy, prompts, runs, quality, latency/cost and effective settings                                                 | 9 route screenshots  |
| Capability  |     9 | Domain → Capability → Skill → Action catalog, Agents, tools, outcome contracts, implementations, evaluation, execution evidence, version lineage and permissions | 9 route screenshots  |
| 外部 API    |     8 | service catalog, global policy, product entitlement, Workspace authorization, credential references, connection health, usage/limits and failures                | 8 route screenshots  |
| 运行与任务  |     7 | owner/type/state/time task views, queues, run chain, workers, schedules, checkpoints, recovery conditions and logs                                               | 7 route screenshots  |
| 商业与支付  |     7 | owner revenue projection, plan versions, orders, Payment owner records, invoices, billable usage and dispute/refund cases                                        | 7 route screenshots  |
| 安全与审计  |     7 | security posture, immutable audit timeline, policies, login investigation, governed configuration, control evidence and protected risk operations                | 7 route screenshots  |

Total: **12 first-level modules, 90 current secondary routes, 90 current desktop route screenshots**. The screenshot directory also contains one older pre-route-matrix Data baseline image; it is not counted as page evidence.

Representative direct review URLs:

- `/super-admin-v2/data/jobs`
- `/super-admin-v2/knowledge/evidence`
- `/super-admin-v2/operations/recovery`
- `/super-admin-v2/integrations/switches`
- `/super-admin-v2/workspaces/directory`
- `/super-admin-v2/users/relationships`
- `/super-admin-v2/products/entitlements`
- `/super-admin-v2/brain/runs`
- `/super-admin-v2/capabilities/catalog`
- `/super-admin-v2/billing/payments`
- `/super-admin-v2/governance/risk`

## Required behaviors and state transitions

- Search and page-local filters narrow explicit fixture objects without changing owner truth.
- Object selection changes the page inspector and preserves source, status, impact and permission context.
- Normal Demo action: idle → local Demo feedback → dismiss; no owner request is sent.
- Protected Demo action: idle → review dialog → cancel or confirm Demo path → local feedback; no production success state exists.
- Review state: success/loading/empty/partial/error/permission is selectable only inside the Demo review tool; Real mode will consume owner results only.
- Direct URL, refresh and secondary navigation resolve to the same page-specific workbench.
- 390 px behavior uses a single-column reading order, reachable actions and document-flow feedback without fixed navigation or toast obstruction.

The runnable design emits no domain event. UI events are local navigation, filtering, selection, review-state fixture switching and protected-flow staging. Future runtime events remain owned by the corresponding service.

## UI state coverage

Every page is exercised through the shared state boundary for loading, empty, error, permission, partial-data and success. Page definitions additionally expose object-specific status, provenance/currentness, impact and the permitted next step. Dangerous actions use the danger treatment and protected confirmation with exact permission and effect text. No unavailable source is rendered as healthy or zero.

Accessibility acceptance includes named navigation landmarks, labelled search/filter controls, keyboard-visible focus, named dialogs, status regions, non-color status text and no page-level horizontal overflow at 390 px.

## Management capability connection checklist

Labels retain the V2.1 meanings: **CONNECTED READ**, **DIRECT OWNER REUSE**, **FRONTEND ADAPTATION**, and **SAFE API MISSING**.

| Area                  | Current safe basis                                                                                            | V2.3 disposition                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Data Engine           | bounded Gateway summary and exact read queries; specialist owner admin reads documented in the V2.1 inventory | CONNECTED READ for current routes; DIRECT OWNER REUSE + Gateway authority needed for remaining reads; command APIs missing                |
| Knowledge             | bounded Gateway evidence-supply health; specialist owner routes documented in the V2.1 inventory              | CONNECTED READ for current health; DIRECT OWNER REUSE/FRONTEND ADAPTATION for deeper reads; protected command authority missing           |
| Overview / Operations | existing owner-specific projections and Execution/domain-owner receipts, without one generic command owner    | FRONTEND ADAPTATION; add correlation projection, not a second truth store; recovery commands require exact owner APIs                     |
| External API          | consuming owners and credential authority retain policy, entitlement, authorization, secret and health truth  | FRONTEND ADAPTATION; safe aggregate reads missing; never expose secret values or collapse four layers into one toggle                     |
| Workspace / Identity  | Core owns identity, Workspace, membership, Principal and permissions                                          | DIRECT OWNER REUSE through bounded Gateway projections; several portfolio/admin projections and protected commands remain missing         |
| Product               | product owner plus plan/entitlement and Workspace configuration owners                                        | FRONTEND ADAPTATION; safe joined read model missing; do not copy entitlement truth                                                        |
| Brain                 | current bounded Brain/BrainGap owner reads                                                                    | FRONTEND ADAPTATION; run/model route, provider receipt, quality and cost projections need explicit safe APIs                              |
| Capability            | Capability Engine registry/version/profile basis                                                              | DIRECT OWNER REUSE for catalog/version reads after authority; execution/evaluation linkage needs adaptation; no automatic verification    |
| Commercial / Payment  | current owner-routed Commercial Admin basis; Payment/MarkReg/subscription owners retain records               | FRONTEND ADAPTATION; owner read projections first; refunds/disputes require protected owner commands; no second ledger                    |
| Security / Audit      | Core Principal/permission basis plus mutation-owner audit evidence                                            | FRONTEND ADAPTATION; cross-owner investigation projection and authenticated audit reads are incomplete; risky commands remain fail-closed |

## V2.3 real API implementation order

1. **Freeze the read inventory and authority matrix.** For each page, name the owner, exact object/version/currentness, Gateway route, Internal Operator permission, negative states and redacted fields. Reuse `packages/contracts`; do not copy API types.
2. **Connect already accepted bounded reads.** Wire Data summary/query and Knowledge supply health into explicit Real mode with contract parsing, source/currentness labels and fixture/real separation.
3. **Add Data Engine and Knowledge read adapters.** Expose only the specialist owner reads accepted in the V2.1 inventory through Gateway with owner-enforced authority. Packages, jobs, sources, evidence, retrieval and Ready Packages precede all commands.
4. **Add the cross-owner operations correlation projection.** Join only references and receipts for alert → dependency → task/run → checkpoint/recovery inspection. Persist no copied owner truth.
5. **Add Core/owner administrative read projections.** Deliver Workspace, identity relationship and product availability/entitlement/configuration/health as separate facts.
6. **Add Brain and Capability linked reads.** A Brain run may reference an exact Capability/version/implementation and provider receipt; Capability views may reference admitted evaluation and invocation evidence. Neither side infers canon changes.
7. **Add Commercial, Payment and Governance reads.** Return owner records, reconciliation status and immutable audit evidence with redaction and exact permissions. Payment remains distinct from performance, authority, acceptance and completion.
8. **Introduce protected commands one owner at a time.** A command is eligible only after exact permission, current object version, impact preview, reason, required approval, idempotency, audit and owner-produced result are available. Start with low-risk reversible commands; keep credential export, destructive storage, ledger mutation and high-risk privilege operations unavailable until their owners provide safe contracts.
9. **Promote pages individually.** Each Real page needs fixture-backed contract tests, owner/Gateway integration tests, permission and dependency failures, browser refresh/direct URL coverage, audit evidence and product/security review. A green aggregate CI run alone does not authorize production navigation replacement.

## Acceptance tests and validation commands

- Unit coverage asserts a dedicated page definition for all 90 secondary routes.
- Storybook contains representative normal, partial, permission, Data/Knowledge, A/B/C/D and 390 px states.
- Playwright validates search, filters, details, protected actions, authority copy, direct URLs, refresh-safe navigation and 390 px overflow.
- Route-matrix capture writes `playwright-screenshots/super-admin-v2-<module>-<page>-desktop.png` for each page.

Required validation:

```text
pnpm format:check
pnpm validate:workspace
pnpm --filter @markorbit/operations-console lint
pnpm --filter @markorbit/operations-console typecheck
pnpm --filter @markorbit/operations-console test
pnpm --filter @markorbit/operations-console build
node --test scripts/ci-detect-scope.test.mjs
pnpm exec playwright test --config playwright.config.ts tests/e2e/operations.spec.ts
pnpm task:prepush
```

Final local evidence on 2026-09-24:

- workspace structure/service ownership validation: PASS;
- formatting, Operations Console lint and TypeScript: PASS;
- Operations Console unit tests: 22 files, 81 tests PASS;
- Operations Console production build: PASS;
- CI scope-detector tests: 29 PASS;
- Operations Console Playwright: 15 PASS, one expected mobile skip for the viewport-independent 90-route matrix;
- desktop route matrix: 90 current page screenshots captured;
- focused 390 px Data jobs, Knowledge evidence and A/B/C/D interaction/overflow paths: PASS;
- local preview `http://127.0.0.1:4175/super-admin-v2/overview/platform`: HTTP 200.

## Non-goals

- No replacement of the current `/` console and no automatic production cutover.
- No database migration, shared contract expansion, new ledger, owner reassignment or cross-service SQL.
- No iframe, generic admin proxy, raw secret display or direct specialist-admin authentication reuse.
- No production write, provider contact, payment/refund, account/permission change, destructive storage action, Capability verification, formal-state mutation or Official Truth creation.
