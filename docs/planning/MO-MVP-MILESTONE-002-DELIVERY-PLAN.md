# MO MVP Milestone 2 Delivery Plan

**Status:** approved for implementation after TASK 016 merges. Each task is one bounded branch/PR. TASK 016 performs no implementation.

The approved numbering is retained because repository dependencies support foundation → identity → auth → domain → persistence → service → transport → UI → reliability → audit. Audit/idempotency semantics are designed in TASK 017 and integrated atomically in TASK 022; TASK 025 hardens publication, denial audit and operational evidence rather than adding them too late.

## Staged rollout

| Stage/task | Dependency      | Deliverable and acceptance                                                                                                                        | Rollback boundary                                                         | Durable / fixture records                                                                                                                     |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 / 017    | TASK 016 merged | approved PostgreSQL 16 SQL-first migrations, transaction/repository contracts, DB test harness; empty bootstrap and memory/Postgres contract pass | remove adapter/migrations before data; forward repair after shared schema | foundation only; all M1 fixture                                                                                                               |
| 2 / 018    | 017             | User/Workspace/Membership/role contracts and Core repository; workspace isolation tests                                                           | identity schema + additive contracts                                      | identity durable; workflow fixture                                                                                                            |
| 3 / 019    | 018             | approved PostgreSQL-backed opaque sessions, Principal, Gateway/service authorization, CSRF; login/logout/expiry/forgery tests                     | auth routes/store independently removable                                 | identity/session durable                                                                                                                      |
| 4 / 020    | 018             | approved Formal Matter/source snapshot/command/error/process-local event fixtures; authority tests                                                | additive shared contract rollback while unused                            | no new runtime records                                                                                                                        |
| 5 / 021    | 017,020         | MarkReg persistent repository, concurrency/idempotency/audit transaction                                                                          | adapter selectable; schema forward repair                                 | Formal Matter storage ready; upstream fixture                                                                                                 |
| 6 / 022    | 018–021         | authorized `CreateFormalMatter`; exact lineage admission; service contract tests                                                                  | route/operation feature flag, retained compatible rows                    | Matter + snapshot durable; Confirmation/Draft durability completed here or in a prerequisite split that preserves the approved classification |
| 7 / 023    | 019,022         | Gateway route and generated/imported typed client; real HTTP/DB tests                                                                             | remove route/client without schema rollback                               | unchanged                                                                                                                                     |
| 8 / 024    | 023             | authenticated MarkReg desktop journey, all UI/Storybook states and real-runtime browser path                                                      | UI route flag; API remains                                                | unchanged                                                                                                                                     |
| 9 / 025    | 022–024         | append-only success/denial audit queries and durable idempotency operations; explicitly no outbox or reliable event delivery                      | committed audit/idempotency retained                                      | audit/key durable                                                                                                                             |
| 10 / 026   | all above       | restart, migration, rollback, tenant, concurrency, DB outage matrix                                                                               | test/orchestration only; defects fixed forward                            | selected records verified durable; remaining M1 fixture                                                                                       |
| 11 / 027   | 026             | independent acceptance and authority audit, release recommendation                                                                                | documentation only                                                        | no changes                                                                                                                                    |

## Dependency-ordered task graph

### TASK 017 — Persistence foundation and repository contracts

- **Objective/owner:** Platform + service owners establish approved PostgreSQL access, forward migrations, transactions and reusable repository contract harness without domain migration.
- **Dependencies:** TASK 016 merged. **Allowed:** infrastructure, config, service-kit/test-kit, per-service migration roots, package manifests/lockfile, tests/docs. **Prohibited:** auth, Formal Matter behavior, wholesale repository conversion, ORM automatic schema synchronization.
- **Evidence:** empty bootstrap; failed migration prevents readiness; isolated CI PostgreSQL; identical sample repository suite; transaction rollback.
- **Rollback/size:** adapter/config can be removed before shared data; migration fixes forward thereafter. Medium (400–800 changed lines).

### TASK 018 — Identity, Workspace and Membership contracts

- **Objective/owner:** Core owns durable User, Workspace, Membership, bounded role/permission mapping under the approved tenant boundary.
- **Dependencies:** 017 and terminology approval. **Allowed:** contracts, Core, fixtures/tests/docs. **Prohibited:** enterprise IAM/SSO, product workflow or Matter persistence.
- **Evidence:** unique membership, inactive membership, two-Workspace isolation, memory/Postgres repository parity.
- **Rollback/size:** additive contracts/schema isolated to Core. Medium (400–800 lines).

### TASK 019 — Authentication runtime and Gateway principal

- **Objective/owner:** Core/Auth + Gateway establish approved server-generated opaque sessions persisted in PostgreSQL, HttpOnly cookies, CSRF and typed Principal/service context.
- **Dependencies:** 018. **Allowed:** Core, Gateway, contracts/config, auth UI entry only, tests/docs. **Prohibited:** public registration, broad IAM, enterprise SSO, JWT distributed auth, Formal Matter.
- **Evidence:** login/logout/expiry/rotation; secure cookie flags; CSRF; forged actor/Workspace rejection; fixture mode cannot enable production.
- **Rollback/size:** route/config feature boundary and auth tables. Medium-large (700–1,200 lines).

### TASK 020 — Formal Matter domain contract

- **Objective/owner:** MarkReg defines authority transition, aggregate, source snapshot, typed errors/event fixture and false consequences.
- **Dependencies:** approved TASK 016 decisions and 018 identity terms. **Allowed:** contracts, MarkReg domain tests/fixtures/docs. **Prohibited:** repository, Gateway/UI, Order/Payment/Filing or mandatory Professional Review.
- **Evidence:** contract fixtures for eligible/stale/duplicate/forbidden and 13 false consequences; compatibility tests.
- **Rollback/size:** unused additive contract removal. Small-medium (250–500 lines).

### TASK 021 — Formal Matter persistent repository

- **Objective/owner:** MarkReg implements memory/PostgreSQL repository adapters and native transaction primitives for UUIDv7 `OPEN` Matter, snapshot/hashes, audit and idempotency, without an outbox.
- **Dependencies:** 017,020. **Allowed:** MarkReg migrations/repositories/tests and required config. **Prohibited:** public route/UI or other services' databases.
- **Evidence:** shared repository contract; composite tenant/source uniqueness; expected-version race; audit failure rollback.
- **Rollback/size:** select memory adapter; retain/forward-fix schema. Medium (500–900 lines).

### TASK 022 — Explicit Matter creation Service boundary

- **Objective/owner:** MarkReg implements authorized, atomic, idempotent `CreateFormalMatter` and selected durable source admission.
- **Dependencies:** 018–021 and trigger/durability approval. **Allowed:** MarkReg/contracts/fixtures/tests/docs. **Prohibited:** Gateway/UI, commerce/external execution.
- **Evidence:** eligibility, exact version/checksum, cross-tenant denial, identical replay, conflicting key, stale source, rollback and false consequences.
- **Rollback/size:** disable operation; compatible committed Matters remain readable. Medium (500–900 lines).

### TASK 023 — Gateway API and typed client

- **Objective/owner:** Gateway + MarkReg expose principal-bound create/read endpoints and contract-derived client.
- **Dependencies:** 019,022. **Allowed:** Gateway, generated/imported client locations, contracts/tests/docs. **Prohibited:** database access or copied API types.
- **Evidence:** real HTTP + PostgreSQL 201/200/401/403/404/409/503 matrix; actor-body spoof ignored/rejected.
- **Rollback/size:** remove route/client, retain service/data. Small-medium (300–600 lines).

### TASK 024 — Authenticated MarkReg Web journey

- **Objective/owner:** MarkReg Web gives an operations user the explicit create/reload journey.
- **Dependencies:** 023. **Allowed:** MarkReg Web, shared primitives, Storybook/Playwright fixtures/tests/docs. **Prohibited:** Lite IA sharing, DB access, Filing/payment UI.
- **Evidence:** loading/empty/error/permission/partial/stale/conflict/success stories; accessible desktop/mobile behavior; real-runtime create/restart/reload path without interception; visual evidence.
- **Rollback/size:** feature-route flag. Medium-large (700–1,200 lines).

### TASK 025 — Durable audit, idempotency and event delivery hardening

- **Objective/owner:** MarkReg/Platform complete append-only audit access, denial records and durable idempotency-key retention.
- **Dependencies:** 022–024. **Allowed:** MarkReg, Gateway audit read boundary, events documentation, migrations/tests/docs. **Prohibited:** outbox, reliable cross-service delivery, generic enterprise event platform or console logs as audit.
- **Evidence:** immutable audit fields, key reuse, restart replay, atomic failure tests and explicit process-local event limitations.
- **Rollback/size:** never delete committed audit/key records. Medium (400–750 lines).

### TASK 026 — Restart, migration and tenant-isolation matrix

- **Objective/owner:** Quality/Platform exercise real processes and PostgreSQL across recovery/failure scenarios.
- **Dependencies:** 017–025. **Allowed:** integration/E2E orchestration, CI services, fixtures/docs and defect fixes in owned boundaries. **Prohibited:** new product scope.
- **Evidence:** create-stop-restart-get; empty/prior schema; DB outage; interrupted request; concurrency; cross-tenant; no generated artifacts.
- **Rollback/size:** test harness only; fixes separately attributable. Medium (400–800 lines).

### TASK 027 — Milestone 2 integration audit

- **Objective/owner:** independent Quality/Product audit exact main against scope lock and authority consequences.
- **Dependencies:** 026 and merged task chain. **Allowed:** audits/releases/planning docs only. **Prohibited:** implementation, freeze/tag/merge without owner action.
- **Evidence:** full gates, real runtime, migration/restart/isolation matrices, source inspection, drift and reproducibility record.
- **Rollback/size:** documentation commit. Small (200–400 lines).

## Acceptance exit

All repository gates plus real PostgreSQL HTTP, migration, restart, isolation and browser suites pass on the same commit. The exact Matter/lineage survives restart, denied users cannot enumerate it, duplicates are stable, concurrent stale updates lose safely, and all excluded authority consequences remain false. TASK 027 reports evidence; it does not silently freeze or merge.
