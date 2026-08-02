# TASK 025A audit and idempotency matrix

**Baseline audited:** `baebb68867c036d357e187b904b9ba7c26886109` / tree `20a42b66bff37c2f65da458f6d66aa8a626c47b3` (supplied synchronized local baseline; not asserted to be authoritative remote main).

**Outcome:** `TASK_025_APPROVED_SCOPE_BLOCKED`.

The JSON companion is executable inventory: every requirement and durable boundary names production files, tables, exact tests/commands, observed result, and gap. Runtime-required requirements are never satisfied by documentation alone.

## Requirement summary

| ID  | Approved requirement                     | Result    | Decisive finding                                                                                                              |
| --- | ---------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| R01 | Append-only success audit                | PARTIAL   | Three command families insert success rows; other durable boundaries do not, and database-level rewrite prevention is absent. |
| R02 | Append-only denial audit                 | GAP       | No denial table or write path exists.                                                                                         |
| R03 | Durable idempotency retention            | PARTIAL   | Formal Matter, Professional Review and Document Package retain command rows indefinitely.                                     |
| R04 | Replay after process restart             | GAP       | Tests replace objects, not actual stopped/restarted owner listeners.                                                          |
| R05 | Conflicting reuse rejection              | PARTIAL   | Typed conflict exists for three families; denial evidence does not.                                                           |
| R06 | Atomic aggregate + command + audit       | PARTIAL   | Present for three families, not across all durable boundaries.                                                                |
| R07 | Rollback without partial evidence        | PARTIAL   | Forced-failure tests exist for the three families only.                                                                       |
| R08 | Workspace-scoped audit access            | GAP       | No audit query API.                                                                                                           |
| R09 | Authenticated audit read boundary        | GAP       | No owner/Gateway audit route.                                                                                                 |
| R10 | Immutable actor/command/source/time      | PARTIAL   | Fields are incomplete and direct database rewrites are not prevented.                                                         |
| R11 | Process-local delivery limitation        | SATISFIED | In-memory/fixture event behavior has no durable recovery guarantee.                                                           |
| R12 | No outbox                                | SATISFIED | Migrations through 0024 have no outbox.                                                                                       |
| R13 | No reliable cross-service delivery claim | SATISFIED | No reliable bus/delivery behavior is implemented or claimed.                                                                  |
| R14 | Logs are not authoritative audit         | SATISFIED | Console output is diagnostic validation output, not owner audit evidence.                                                     |

## Denial semantics finding

The approved security/governance boundary requires durable denial design for authenticated unauthorized mutations, safely attributable forged-context attempts, safely resolved cross-Workspace mutations, conflicting key reuse, governed stale-version rejection, and terminal-state mutation. The baseline returns typed HTTP/service errors but persists none of these decisions. Ordinary malformed input should remain unaudited. Concealed cross-Workspace HTTP responses must remain canonical 404 and an eventual record must use only safely resolved bounded identifiers; this requires an owner-approved reason-code/record contract before implementation.

## Immutability, replay, and retention finding

Production repositories expose inserts but no audit update/delete methods. That proves API shape, not database immutability: migrations contain no trigger or privilege guard against direct update/delete. Command/audit tables have no expiry or cleanup job, so current retention is indefinite. Identical replay avoids duplicate success rows in tested repository/service paths, and forced audit failures roll back selected aggregate/command/audit writes. Actual listener replacement and deterministic chronological Workspace pagination remain unproved because audit reads do not exist.

## Event boundary

Current behavior is **process-local or transaction/test-fixture-local only, non-durable, with no reliable delivery guarantee**. No outbox, queue, broker, webhook retry, or crash recovery was added. In-memory events must not be interpreted as recoverable delivery evidence.

## Execution status

The matrix initially records zero locally executed selected PostgreSQL/HTTP tests; validation updates it only with commands actually run. Hosted CI is unavailable because the environment has no Git remote. A real remote Draft PR and exact-head CI remain mandatory for merge readiness.

## Authorized remediation evidence

The earlier baseline matrix is retained above. The owner decision narrowed the approved TASK 025 remediation to MarkReg/Platform Formal Matter and Document Package commands. `TASK_025_APPROVED_SCOPE_REMEDIATION_AUTHORIZED` is now closed as `TASK_025_APPROVED_SCOPE_CLOSED_BY_REMEDIATION`.

- Migration 0025 adds bounded `markreg_denial_audit`, deterministic Workspace indexes, and database triggers that reject UPDATE/DELETE on Formal Matter success audit, Document Package success audit, and denial audit.
- The normalized projection unions—not duplicates—the two authoritative success sources with bounded denial evidence and orders by `occurredAt DESC, auditId DESC` with a maximum page size of 100.
- `audit:read` is granted only to WORKSPACE_ADMIN and MATTER_MANAGER. Gateway `GET /api/markreg/audit-records` derives Workspace and permission from Core; REVIEWER and READ_ONLY receive 403.
- PostgreSQL required mode ran twice with identical totals: 3 files, 27 passed, 0 failed, 0 skipped per run.
- Authenticated HTTP required mode covers 3 files and 21 tests; the focused audit boundary contributes 8 passed cases. Listener replacement is exercised in the existing Formal Matter and Document Package HTTP suites.
- Core-wide/Session audit, Execution denial audit, Customer Confirmation command audit, and Matter Draft command audit were not added. Events remain process-local/fixture-local and non-durable.
