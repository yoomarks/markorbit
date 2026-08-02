# Milestone 2 reliability matrix

## Baseline and topology

TASK 026 starts at merged main `f93b8ec74fed67856f316162822be62860058783` (tree `86e93d3756e452db77aa0a238b358afcf8c77c6a`). Migration `0025_markreg_audit_hardening` is present exactly once in `migration-owners.json` and owned by `@markorbit/markreg-service`. It completes the TASK 025A denial audit, append-only triggers, `audit:read` mapping, authenticated audit route and serialized combined commands.

CI provisions PostgreSQL 16 databases `markorbit_core_test`, `markorbit_markreg_test`, and `markorbit_execution_test`. Core authentication and identity share the Core owner database; they do not share MarkReg or Execution storage. Every multi-file destructive Vitest invocation uses `--no-file-parallelism`; module isolation remains enabled.

## Evidence model

The JSON companion is the authoritative machine-readable inventory. Each durable object records its owner, migration, physical relation, production repository/operation, route where applicable, Workspace key, identity/version, restart/idempotency/audit expectation and explicitly absent consequences.

| Matrix           | Command                                      | Evidence source                                                                          |
| ---------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| migration        | `pnpm test:milestone2:migrations`            | persistence transaction/checksum tests plus each owner PostgreSQL suite                  |
| restart          | `pnpm test:milestone2:restart`               | Core Session and real MarkReg/Execution HTTP listener lifecycle suites                   |
| outage           | `pnpm test:milestone2:outage`                | typed unavailable startup plus owner HTTP/database failure paths                         |
| concurrency      | `pnpm test:milestone2:concurrency`           | existing optimistic-version, command replay/conflict and audit tests                     |
| tenant isolation | `pnpm test:milestone2:tenant-isolation`      | authenticated Core → Gateway → owner HTTP suites                                         |
| repeatability    | `pnpm test:milestone2:markreg-repeatability` | same MarkReg database, PostgreSQL/HTTP groups in contamination-sensitive order, repeated |
| aggregate        | `pnpm test:milestone2:reliability`           | named fail-fast composition                                                              |

## Browser and authority boundaries

TASK 026 reuses, rather than copies, dedicated browser suites. `pnpm test:milestone2:topology` checks suite separation and no-interception validators; CI then runs Lite Matter, Professional Review, Document Package and milestone real-runtime projects. Browser artifacts are untracked and uploaded only after failure.

All scenarios preserve false downstream consequences: no Order, Payment, Preparation Lock, Filing Authorization, Execution Release, filing task, external filing, application number, external provider appointment or reliable cross-service event delivery is created.

Audit persistence does not imply durable event delivery. There remains no outbox, broker, queue or crash-recovery delivery guarantee.

## Execution status

Local structural validation is recorded by the commands in the delivery report. PostgreSQL/browser scenario totals and hosted Actions IDs remain pending until the Draft PR's exact head runs. The JSON uses `executed: false` and zero totals rather than inventing evidence or treating an unexecuted suite as skipped/pass.
