# MO MVP TASK 025A — Plan reconciliation and audit/idempotency gap closure

## Task shape

- **Task ID:** MO-MVP-TASK-025A
- **Repository / allowed directories:** `yoomarks/markorbit`; planning, validation, task-index and narrowly required audit/idempotency implementation only.
- **Objective / user-visible outcome:** preserve the approved plan and actual implementation history, inspect runtime behavior, and select one resolution outcome. No customer-facing workflow changes.
- **Canonical sources:** Milestone 2 delivery plan, machine plan, scope lock, TASK 017–025 architecture/task evidence, migration ownership registry, migrations `0018`–`0024`, and production repositories/tests at baseline `baebb68867c036d357e187b904b9ba7c26886109` (tree `20a42b66bff37c2f65da458f6d66aa8a626c47b3`). This supplied synchronized baseline is not claimed to be authoritative remote main.
- **Contracts consumed or changed:** no runtime contract changed.
- **Required behavior:** evidence-based traceability and executable gap matrix; no compliance inferred from table names.
- **State transitions:** none.
- **UI states:** not applicable.
- **Events:** none emitted or consumed by this task; existing events remain process-local/non-durable with no delivery guarantee.
- **Acceptance tests:** document/JSON consistency and repository quality gates; mapped runtime tests are listed in the matrix.
- **Validation commands:** the commands in the matrix plus repository `pnpm check` and `git diff --check`.
- **Non-goals:** TASK 026, TASK 027, outbox, broker, reliable delivery, new aggregate/lifecycle/workflow, release/tag/merge.
- **Expected Draft PR title:** `MO MVP — Milestone 2 plan reconciliation and audit/idempotency closure`.

## Decision

**Prior baseline-audit status: `TASK_025_APPROVED_SCOPE_BLOCKED`.**

The baseline contains valuable distributed success-audit and idempotency work for Formal Matter, Professional Review, and Document Package command families. It does not contain append-only denial audit anywhere; Core identity/session boundaries have no audit tables; no authenticated Workspace-scoped audit query exists; Customer Confirmation and Matter Draft have neither command nor audit tables; and existing restart tests reconstruct repository/service objects rather than stopping and replacing the actual owner listener. These are runtime gaps, so documentation cannot mark the approved objective satisfied.

Closing them is not a bounded 400–750-line corrective change: it requires owner-scoped forward migrations and behavior across Core, MarkReg, Execution, Gateway contracts/routes, PostgreSQL tests, and real listener orchestration. Implementing only one owner would leave the user-required all-boundary acceptance false.

## Prior owner decisions requested

1. Approve a shared **shape contract only** (not shared storage) for bounded success/denial audit records and reason codes, including which Core identity/session commands and stale/terminal rejections are governance denials.
2. Assign authenticated audit-query ownership per service and approve Gateway composition or separate owner routes, with Workspace scoping and concealed-resource behavior.
3. Approve splitting remediation into owner-bounded PRs (Core, MarkReg, Execution/Gateway) followed by a TASK 025A acceptance PR, or explicitly enlarge this corrective PR beyond the approved TASK 025 size bound.

No migration or product behavior was added in this blocked audit.

## Branch metadata reconciliation

The local repository has no remote and contains no mutable hosted PR records to close. The names `codex/mo-mvp-task-026-durable-filing-governance` and `codex/mo-mvp-task-026-reliability-matrix` are recorded as abandoned inputs only; they were not merged, checked out, or used. Final readiness requires a real remote Draft PR and exact-head hosted CI.

## Authorized remediation disposition

The owner decision is resolved: the approved TASK 025 owner is **MarkReg/Platform**, and the status moved through `TASK_025_APPROVED_SCOPE_REMEDIATION_AUTHORIZED` to `TASK_025_APPROVED_SCOPE_CLOSED_BY_REMEDIATION` after executable evidence passed. The earlier baseline audit finding above is retained as implementation history; it is not rewritten.

The bounded remediation adds MarkReg governance-denial evidence and Workspace-scoped audit access only. Core-wide identity/Session audit and Execution-wide denial audit remain outside scope. Customer Confirmation and Matter Draft do not claim the durable idempotent command contract hardened here. Formal Matter and Document Package retain their original success-audit tables as authoritative success evidence; `markreg_denial_audit` stores bounded denials only.

Migration `0025_markreg_audit_hardening`, owned by `@markorbit/markreg-service`, adds the denial table, chronological/reason indexes, and explicit UPDATE/DELETE rejection triggers for all three MarkReg audit tables. No event-delivery infrastructure was added: events remain process-local or fixture-local and non-durable.

Final commands are `pnpm test:audit-idempotency:postgres` (twice), `pnpm test:audit-idempotency:http`, and `pnpm test:audit-idempotency:restart`.
