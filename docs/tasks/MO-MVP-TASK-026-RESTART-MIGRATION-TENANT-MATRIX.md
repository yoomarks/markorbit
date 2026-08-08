# MO MVP TASK 026 — restart, migration and tenant-isolation matrix

- **Task ID:** MO-MVP-TASK-026
- **Repository / allowed areas:** MarkOrbit; test orchestration, PostgreSQL test infrastructure, CI and reliability evidence only.
- **Baseline:** `f93b8ec74fed67856f316162822be62860058783`, tree `86e93d3756e452db77aa0a238b358afcf8c77c6a` (merged TASK 025A).
- **Objective / visible outcome:** no new product UI; executable acceptance evidence for the already implemented Milestone 2 boundaries.
- **Canonical sources:** Books 01–07, Capability Canon, Milestone 2 scope lock, production migrations and owner repositories.
- **Contracts:** consumes existing Core Principal, MarkReg and Execution contracts; changes none.
- **State transitions / events:** exercises only existing transitions. No response, Provider Return, test completion or audit row mutates formal truth. No new event delivery contract is introduced.

## Required behavior and acceptance

The matrix uses a database per owner (Core, MarkReg and Execution), serializes destructive files sharing a database while preserving normal Vitest isolation, and composes the existing migration, PostgreSQL, HTTP, restart and browser suites. `scripts/milestone2-reliability-command.test.mjs` prevents a combined command from regressing to default file parallelism or a shared `DATABASE_URL`.

The durable inventory is machine-readable in the JSON validation companion and is derived from migrations `0018`–`0025` and the production PostgreSQL repositories. The dedicated CI workflow uses Node 22, pnpm 10.28.1 and PostgreSQL 16, creates three owner databases, runs scenario-level commands, executes existing independent browser projects, runs `pnpm check`, and uploads generated diagnostics only on failure.

Required commands:

```bash
pnpm test:milestone2:migrations
pnpm test:milestone2:restart
pnpm test:milestone2:outage
pnpm test:milestone2:concurrency
pnpm test:milestone2:tenant-isolation
pnpm test:milestone2:markreg-repeatability
pnpm test:milestone2:reliability
```

The aggregate uses `&&`, so the first causal failure stops execution and each named suite retains its own reporter output. Required database flags turn a missing database into a failure rather than a skipped suite.

## UI states and browser acceptance

TASK 026 adds no product UI. Existing dedicated Lite Matter, Professional Review, Document Package and milestone real-runtime projects remain independent. The suite-boundary and no-interception validators enforce explicit topology; browser flows remain responsible for desktop/mobile refresh, direct URL, Browser Back, Workspace-switch clearing and overflow evidence.

## Non-goals

No aggregate, lifecycle state, customer workflow, RLS, outbox, broker, queue, webhook, notification or external filing behavior is added. In particular, the matrix creates no Order, Payment, Preparation Lock, Filing Authorization, Execution Release, filing task, application number, provider appointment or reliable delivery claim.

Audit persistence does not imply durable event delivery. There remains no outbox, broker, queue or crash-recovery delivery guarantee.

## Delivery

Expected Draft PR title: **MO MVP — Milestone 2 restart, migration and tenant-isolation matrix**. Hosted run IDs, exact totals and exact-head conclusions must be written into the JSON companion after Actions executes; pending fields are deliberately not represented as passes.
