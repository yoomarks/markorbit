# Milestone 2 reliability matrix

## Baseline and topology

TASK 026 starts at merged main `f93b8ec74fed67856f316162822be62860058783` (tree `86e93d3756e452db77aa0a238b358afcf8c77c6a`). Migration `0025_markreg_audit_hardening` is uniquely owned by `@markorbit/markreg-service` in `migration-owners.json`.

PostgreSQL 16 CI provisions `markorbit_core_test`, `markorbit_markreg_test`, and `markorbit_execution_test`. Core identity and Session share only the Core database. Professional Review HTTP and browser runtimes now use a MarkReg database for Formal Matter sources and a different Execution database for Review evidence. Every combined destructive Vitest invocation uses `--no-file-parallelism`; normal module isolation remains enabled.

## Status vocabulary

- `IMPLEMENTED_NOT_EXECUTED`: an exact executable test exists but required-mode PostgreSQL/browser evidence has not run at this head.
- `PASSED_LOCAL`: the exact test passed locally at this head.
- `PASSED_HOSTED_EXACT_HEAD`: the exact test passed in the recorded Actions run for this head.
- `FAILED`: the exact test ran and failed.
- `BLOCKED_ENVIRONMENT`: execution, not implementation, is prevented by a recorded environment limitation.

Authored scripts, workflow steps, and documentation never count as a pass. The JSON companion contains exact test file/name, command, owner database, required flag, expected evidence, coverage classification, implementation need, and zeroed totals for every unexecuted scenario.

## Scenario-to-test coverage map

| Requirements     | Exact executable evidence                                 | Coverage                                                                                          |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| MIG-001–006      | `scripts/milestone2-migrations.integration.test.ts`       | executable for all three owners; required PostgreSQL execution pending                            |
| RST-001          | `scripts/milestone2-core-restart.integration.test.ts`     | actual Core listener/pool replacement, exact Principal/Session evidence                           |
| RST-002          | Formal Matter and Document Package HTTP suites            | actual MarkReg listener replacement and command replay                                            |
| RST-003          | Professional Review HTTP suite                            | actual Execution listener replacement and immutable completion reload                             |
| OUT-001–003      | `scripts/milestone2-startup-outage.integration.test.ts`   | causal startup failure followed by migrated actual owner listener restoration and reusable ports  |
| OUT-004/007      | Core restart suite                                        | actual Core pool outage through Gateway and recovered listener                                    |
| OUT-005/008      | Formal Matter HTTP suite                                  | actual MarkReg pool outage through Gateway and durable recovery                                   |
| OUT-006/009      | Professional Review HTTP suite                            | actual Execution pool outage through Gateway and durable recovery                                 |
| CON-CORE-001–002 | Core identity/Session PostgreSQL suites                   | durable unique Membership and revoke/use races                                                    |
| CON-MR-001–009   | current MarkReg PostgreSQL/HTTP suites                    | durable optimistic, replay/conflict, sequencing and pagination evidence                           |
| CON-EX-001–004   | Professional Review PostgreSQL suite                      | durable version/completion/terminal evidence                                                      |
| TEN-001–007      | `scripts/milestone2-tenant-isolation.integration.test.ts` | three owner databases, durable Core Sessions/Memberships and real owner listeners through Gateway |
| TEN-008          | dedicated Lite/Review/Package browsers                    | executable Workspace-switch clearing and recovery evidence                                        |

The JSON companion is authoritative for exact test names. All previously partial startup-restoration and TEN-001–007 records now point to focused required-mode executable evidence; execution remains pending PostgreSQL 16.

## Command audit

| Command                                 | Exact files / behavior                                                                               | Owner and required mode                            | Serialization                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `test:milestone2:migrations`            | dedicated MIG-001–006 integration file                                                               | all owner URLs; `MILESTONE2_MIGRATIONS_REQUIRED=1` | one file; no file parallelism                     |
| `test:milestone2:restart`               | Core restart plus Formal Matter, Package and Review listener suites                                  | Core/MarkReg/Execution required flags              | combined files serialized                         |
| `test:milestone2:outage`                | startup outage, Core/MarkReg/Execution actual pool-outage paths                                      | all owners required                                | combined files serialized                         |
| `test:milestone2:concurrency`           | exact owner PostgreSQL race suites                                                                   | all PostgreSQL required flags                      | combined files serialized                         |
| `test:milestone2:tenant-isolation`      | focused durable Core → Gateway → MarkReg/Execution suite                                             | three owner URLs; `MILESTONE2_TENANT_REQUIRED=1`   | one destructive file                              |
| `test:milestone2:markreg-repeatability` | five named groups, two cycles, parsed zero-skip/equal-total guard                                    | one MarkReg database; all MarkReg required flags   | child processes strictly sequential               |
| `test:milestone2:topology`              | command, database, Playwright inventory/no-interception guards                                       | static                                             | Node test runner                                  |
| `test:milestone2:browser`               | eight separately invoked desktop/mobile projects                                                     | owner databases supplied by CI                     | one worker, zero retries, one project per process |
| `test:milestone2:reliability`           | topology → migrations → restart → outage → concurrency → tenant → repeatability → browser → evidence | all                                                | `&&` propagates first child failure               |

## Browser and authority boundaries

TASK 026 adds no product journey. Dedicated Lite Matter, Professional Review, Document Package and milestone real-runtime configurations have exact `testMatch`, one worker, zero retries and no request interception. Desktop and mobile projects execute in separate child processes, so no reset can overlap another browser listener.

All scenarios preserve false downstream consequences: no Order, Payment, Preparation Lock, Filing Authorization, Execution Release, filing task, external filing, application number, external provider appointment or reliable cross-service event delivery is created.

Audit persistence does not imply durable event delivery. There remains no outbox, broker, queue or crash-recovery delivery guarantee.

## Execution status

Static topology/evidence validators may be marked `PASSED_LOCAL` after execution. PostgreSQL and browser scenario records remain `IMPLEMENTED_NOT_EXECUTED` until their exact commands run. Hosted run IDs/URLs remain empty until exact-head Actions completes; no unexecuted scenario is represented as passed or skipped.
