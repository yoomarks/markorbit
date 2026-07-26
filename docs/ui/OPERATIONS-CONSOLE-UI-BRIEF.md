# Operations Console UI Brief

## User, job and boundary

Internal operations, data administrators, system administrators and compliance reviewers need to detect unhealthy systems, understand exceptions and route governed human intervention with auditability. It is explicitly internal, high-density and never shares Lite navigation or customer presentation. This task establishes a shell, not management capability.

## Page map

| Page                | Primary decision / content                    | Desktop and mobile                                         |
| ------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| System Overview     | Is intervention needed now?                   | Dense health/queue/event grid; stacked critical metrics    |
| Service Health      | Which service or dependency is degraded?      | Trend/health matrix; critical service cards                |
| Event Monitor       | Which event sequence is delayed or anomalous? | Filtered stream/correlation; compact stream                |
| Failed Operations   | What safely retries or escalates?             | Failure table with idempotency context; failure cards      |
| Manual Review Queue | Which review is next and who owns it?         | Assignment/evidence queue; priority stream                 |
| Data Source Status  | Is provenance/freshness sufficient?           | Source/freshness matrix; source cards                      |
| Audit Trail         | Who did what, when and under which authority? | Immutable chronological filter view; detail-first timeline |

Provider Return remains evidence input, not Official Truth. External protected actions require explicit review/approval. Manual intervention records actor, reason, before/after references and correlation; Operations does not bypass service ownership or read service databases directly.

## Core flows and states

Overview → investigate service/event/failure → inspect correlation and provenance → choose safe retry/escalation/manual-review route → confirm bounded action → observe new event/audit record. Future actions consume service contracts and emit governed commands/events; Task 003 emits/consumes none.

Every page applies `PAGE-STATE-MODEL.md`. Empty failure queues are positive but not “service healthy” by themselves. Partial names missing telemetry. Stale prominently displays last observation and blocks intervention. Offline and Blocking Error prevent mutations. Forbidden offers audited access request. Recoverable retry never changes an idempotency key invisibly. Dense views use landmarks, descriptive headings, text+icon status, keyboard-operable filters and an explicit focus path.

## Task 003 fixture and acceptance

The static shell renders service health, failed operations, manual review and event summaries, with internal and fixture labels. No backend is contacted. Storybook desktop/mobile stories are visual evidence. A later Playwright path loads Ready, traverses dedicated navigation by keyboard, opens a failed operation, verifies correlation/audit context, requires confirmation for intervention and validates stale/partial/forbidden states. Follow-up work should first define operational read contracts, permissions and audit commands before implementing pages.
