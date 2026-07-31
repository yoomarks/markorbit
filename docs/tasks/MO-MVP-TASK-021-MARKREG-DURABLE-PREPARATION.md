# TASK 021 — MarkReg durable preparation vertical slice

Status: implemented on `codex/mo-mvp-task-021-markreg-durable-preparation-slice`.

The bounded outcome is authenticated, Workspace-scoped Matter Draft creation, editing, reload and readiness evaluation through the existing routes and preparation workspace. Canonical sources are Books 01–07, Capability Canon, the Milestone 1 Matter Draft contract, and TASK 019–020 boundaries. Contracts consumed are Workspace Principal, Customer Confirmation repository and Matter Draft preparation/readiness; the Matter Draft repository contract is new. No formal-state event is emitted or consumed.

State remains `DRAFT | NEEDS_INFORMATION | READY_FOR_PROFESSIONAL_REVIEW | WITHDRAWN`; readiness evaluation is explicit and cannot create Formal Matter. Acceptance covers durable reload, optimistic conflict, Workspace isolation, permissions and withdrawn authority. Focused validation: `pnpm --filter @markorbit/markreg-service test`, `pnpm --filter @markorbit/gateway test`, and the final `pnpm check`.
