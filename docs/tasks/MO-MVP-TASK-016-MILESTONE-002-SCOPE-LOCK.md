# TASK 016 — MO MVP Milestone 2 Scope and Architecture Lock

## Task contract

1. **Task ID:** `MO-MVP-TASK-016`.
2. **Repository / allowed directories:** `yoomarks/markorbit`; documentation under `docs/planning`, `docs/architecture`, `docs/tasks` and the planning index only.
3. **Objective / visible outcome:** owner-reviewable product, domain, architecture, delivery and acceptance boundary for Authenticated Durable Matter Operations; no runtime behavior changes.
4. **Canonical sources:** current Books/Capability Canon locks in `AGENTS.md`; MVP Product Lock; system/service/contract boundaries; Milestone 1 freeze audit/record; shared contracts and actual MarkReg/Execution repository implementations at frozen tag `v0.1.0-milestone.1`.
5. **Contracts consumed/changed:** contracts inspected only; none changed. Proposed future `CreateFormalMatter`, `FormalMatter`, identity, audit and event contracts are recommendations.
6. **Required behavior:** inventory evidence, compare three directions, lock one bounded journey and non-goals, define authority/identity/persistence/audit/reliability/security/testing boundaries, classify durability, and order delivery tasks.
7. **State transitions:** documentation proposes `Matter Draft READY_FOR_PROFESSIONAL_REVIEW` → explicit command → Formal Matter `OPEN_FOR_INTERNAL_OPERATIONS` v1; it does not implement or automatically mutate state.
8. **UI states:** future authenticated desktop journey must cover loading, empty, eligible, creating, success/reload, permission, partial lineage, stale/conflict and service error, with mobile usability, accessibility and Storybook evidence.
9. **Events:** current event package/in-memory publisher inspected; proposed `markreg.formal-matter.created.v1` is gated on outbox approval and is neither emitted nor consumed here.
10. **Acceptance tests:** documentation completeness, valid JSON, quality gates, changed-file boundary, clean Git diff/worktree after commit.
11. **Validation:** frozen install; workspace validation; format, lint, typecheck, test and check; JSON tool; diff check/status.
12. **Non-goals:** source/test/workflow/dependency/runtime changes; persistence/auth implementation; commerce; external filing; TASK 017; tag/history changes; merge.
13. **Expected PR title:** `MO MVP — Milestone 2 scope and architecture lock` (Draft).

## Baseline result

Synchronized main/head `c704f9378e999fdd3589e6f72e1d4925b36a5eb4`, tree `9090a7e0181a34bbdf8dc53109f89cb5cbd5232d`. The annotated tag resolves to the same commit, is an ancestor of `origin/main`, and has zero subsequent commits. Consequently there is no post-freeze drift affecting planning.

## Disposition

Repository evidence supports Option A. PostgreSQL is recommended but gated; opaque same-origin sessions and Workplace tenancy are recommended but gated; Formal Matter creation is an explicit MarkReg-owned authority transition with an immutable source snapshot, durable audit, idempotency and optimistic concurrency. Eleven bounded implementation/audit tasks (017–027) are proposed. No source change is necessary for TASK 016.

## Owner approvals required

Direction; PostgreSQL/tooling; authentication mechanism; Workplace term; Formal Matter trigger/status/review prerequisite/ID; durable upstream records; outbox/no-publication; and task sequence.
