# TASK 016 — MO MVP Milestone 2 Scope and Architecture Lock

## Task contract

1. **Task ID:** `MO-MVP-TASK-016`.
2. **Repository / allowed directories:** `yoomarks/markorbit`; documentation under `docs/planning`, `docs/architecture`, `docs/tasks` and the planning index only.
3. **Objective / visible outcome:** owner-reviewable product, domain, architecture, delivery and acceptance boundary for Authenticated Durable Matter Operations; no runtime behavior changes.
4. **Canonical sources:** current Books/Capability Canon locks in `AGENTS.md`; MVP Product Lock; system/service/contract boundaries; Milestone 1 freeze audit/record; shared contracts and actual MarkReg/Execution repository implementations at frozen tag `v0.1.0-milestone.1`.
5. **Contracts consumed/changed:** contracts inspected only; none changed. Approved future `CreateFormalMatter`, `FormalMatter`, identity, audit and event contracts are recommendations.
6. **Required behavior:** inventory evidence, compare three directions, lock one bounded journey and non-goals, define authority/identity/persistence/audit/reliability/security/testing boundaries, classify durability, and order delivery tasks.
7. **State transitions:** approved documentation defines accepted Customer Confirmation + exact-version `READY` Matter Draft → `CreateFormalMatter` → Formal Matter `OPEN` v1 with application-generated UUIDv7; Professional Review is not mandatory. It does not implement or automatically mutate state.
8. **UI states:** future authenticated desktop journey must cover loading, empty, eligible, creating, success/reload, permission, partial lineage, stale/conflict and service error, with mobile usability, accessibility and Storybook evidence.
9. **Events:** current event package/in-memory publisher inspected; Milestone 2 makes no outbox or reliable delivery promise. Any domain event remains process-local, non-durable and not delivery-guaranteed.
10. **Acceptance tests:** documentation completeness, valid JSON, quality gates, changed-file boundary, clean Git diff/worktree after commit.
11. **Validation:** frozen install; workspace validation; format, lint, typecheck, test and check; JSON tool; diff check/status.
12. **Non-goals:** source/test/workflow/dependency/runtime changes; persistence/auth implementation; commerce; external filing; TASK 017; tag/history changes; merge.
13. **Expected PR title:** `MO MVP — Milestone 2 scope and architecture lock` (Draft).

## Baseline result

Synchronized main/head `c704f9378e999fdd3589e6f72e1d4925b36a5eb4`, tree `9090a7e0181a34bbdf8dc53109f89cb5cbd5232d`. The annotated tag resolves to the same commit, is an ancestor of `origin/main`, and has zero subsequent commits. Consequently there is no post-freeze drift affecting planning.

## Disposition

Option A, `DURABLE_AUTHENTICATED_MATTER_OPERATIONS`, is approved. PostgreSQL 16, Workspace terminology, PostgreSQL-backed opaque sessions, `CreateFormalMatter`, `OPEN` v1 with UUIDv7, no mandatory Professional Review, approved durability classifications, no outbox, deferred RLS and TASK 017–027 are locked but not implemented. Formal Matter creation is an explicit MarkReg-owned authority transition with immutable source evidence, durable audit, idempotency and optimistic concurrency. No source change is necessary for TASK 016.

## Remaining implementation selections

TASK 017 selects the thin SQL migration runner, PostgreSQL client/pool configuration and local/CI database isolation approach. Authentication work selects expiry, rotation and administrator-provisioning details within the approved opaque-session boundary. TASK 017 starts only after TASK 016 merges.
