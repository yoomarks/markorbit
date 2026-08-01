# TASK 025 PostgreSQL scenario map

All rows execute in required mode in `services/markreg/tests/document-package-postgres.test.ts`.

| Required behavior                                                                                   | Executable test                                                                                 |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1. MarkReg owns migration 0024                                                                      | `loads migration 0024 under MarkReg ownership with zero foreign owner tables`                   |
| 2–3. Exact lineage reload; concurrent create/resume produces one Package                            | `preserves exact Formal Matter and completed Review lineage after reload and concurrent resume` |
| 4–5. Original replay; conflicting canonical key                                                     | `creates/replays one exact Package and rejects conflicting key evidence`                        |
| 6–9. Evidence reload, version increment, one concurrent winner, typed stale conflict                | `persists bounded evidence, exact versions, and permits one concurrent writer`                  |
| 10–11. Monotonic append-only sequence and non-destructive supersession                              | `appends monotonic history and supersedes without updating the old entry`                       |
| 12. Concurrent append has no duplicate sequence                                                     | `serializes concurrent instruction appends without duplicate sequence values`                   |
| 13–14. Incomplete Review and document/instruction readiness blockers                                | `blocks incomplete sources, missing readiness evidence, and cross-Workspace discovery`          |
| 15–18. Ready replay/conflict stability, ready mutation rejection, Workspace read/mutation isolation | readiness and blocker tests                                                                     |
| 19. Forced failure has no version, instruction, command, or audit residue                           | `rolls back Package version, instruction, command, and audit when the audit write fails`        |
| 20. Fresh service/repository reload retains ready Package and full Ledger                           | `marks ready idempotently, freezes evidence, and survives a fresh repository object`            |
| 21. PostgreSQL unavailable maps to 503                                                              | `maps database unavailability to canonical 503`                                                 |
| 22. No Preparation Lock or later object                                                             | readiness test asserts `to_regclass('preparation_locks')` is null                               |
