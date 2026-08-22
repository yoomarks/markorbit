# M14 — Implementation Traceability

## Milestone

**M14 — Operational Trademark Execution Workbench**

Implementation status: **COMPLETE ON `main`** at baseline `a5996106e4a7e2204daf6b6cddf11a4ba304cfc9`.

This status means the M13 controlled-execution semantics are durable, authenticated and available through Execution-owned runtime boundaries. It does not authorize production credentials, live filing, live payment, provider contact, production migration, deployment or GA.

## Implemented loop

`M12 Work Package -> M12 Execution Readiness -> explicit authorization -> durable Execution session -> protected-action release -> owner-domain handoff -> evidence / receipt -> recovery / next human action`

## Work-package traceability

- **WP01 Durable execution session:** migration `0061_execution_trademark_service_sessions.sql` persists the Execution-owned session and audit lineage.
- **WP02 Authenticated authorization API:** actor identity is derived from the trusted Workspace Principal; request-body spoofing is rejected.
- **WP03 Durable protected-action gate:** exact version, Workspace, expiry, evidence and semantic idempotency are checked fail-closed.
- **WP04 Owner-domain handoffs:** MGSN/provider and MarkReg lifecycle requests remain requests and do not manufacture owner truth.
- **WP05 Evidence and receipt ledger:** attempt evidence, provider claims and owner-verified evidence remain distinct.
- **WP06 Recovery and manual review:** ambiguous or failed external-consequence states require bounded manual handling and are never silently promoted.
- **WP07 Professional workbench runtime:** existing professional review and document-package runtime paths expose the governed state.
- **WP08 Authority and reliability audit:** authentication, workspace isolation, replay, evidence separation and recovery were exercised on exact-head CI.

Primary implementation PR: **#164 — M14: operational trademark execution workbench**.

## Implementation surfaces

- `docs/planning/MO-MVP-MILESTONE-014-SCOPE-LOCK.md`
- `infrastructure/persistence/migrations/0061_execution_trademark_service_sessions.sql`
- `services/execution/src/trademark-service-execution-postgres.ts`
- `services/execution/src/trademark-service-execution-http.ts`
- `services/execution/src/main.ts`
- `services/execution/tests/trademark-service-execution-postgres.test.ts`
- real-runtime professional-review and document-package integration paths

## Exact-head CI evidence

PR #164 exact head: `29a31e36af7095270b01f73ba38a09e58793bcef`.

Successful workflows:

- validation `32506307134`;
- Product Loop Content Preparation `32506307086`;
- M6 WP-03 Capability Observation Ledger `32506307119`;
- M6 WP-06 Authenticated Capability Center `32506307159`;
- M8 WP-06 Commercial Runtime Reliability `32506307097`.

## Permanent authority locks

- readiness is not execution authorization;
- authorization and release are not external success;
- handoff is not provider acceptance or official lifecycle truth;
- provider return is not Official Truth;
- Payment, MGSN and MarkReg retain their owner-domain truth;
- ambiguous external consequences do not receive automatic retry;
- Lite does not own protected-action persistence;
- no cross-service SQL;
- merge is not production deployment or GA.

## Closeout decision

M14 is complete as an operational engineering milestone. M15 subsequently exercised this durable runtime through non-production connector, isolation, evidence and recovery boundaries. Production enablement remains a separate future decision.
