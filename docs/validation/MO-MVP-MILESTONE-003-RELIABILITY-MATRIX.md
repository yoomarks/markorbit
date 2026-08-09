# MO MVP Milestone 3 Reliability Matrix

**Work package:** `M3-WP-07`  
**Direction:** `DURABLE_COMMERCIAL_ORDER_AND_MATTER_LINKAGE`

## Purpose

This matrix proves that the Milestone 3 commercial boundary behaves as durable governed system truth rather than a customer-interface feature. It adds no Payment, Invoice, provider appointment, external filing or official-authority capability.

The governing semantic boundary remains:

`Order != Matter != Payment != Invoice != Filing`

`Confirmed` does not mean paid. `MatterCreated` does not mean filed.

## Exact-head execution

Hosted evidence is produced by `.github/workflows/milestone-3-reliability.yml`. Pull requests are checked out at `github.event.pull_request.head.sha`, not at the synthetic PR merge commit. `scripts/run-milestone3-reliability.mjs` independently compares the checked-out Git SHA with `M3_EXPECTED_HEAD_SHA` before executing the matrix.

The runner is fail-fast and records `.artifacts/milestone-3-reliability-evidence.json` after every scenario group so a failing hosted run preserves the exact head and completed group results.

## Ordered scenario groups

1. **Preflight** — build the real Core + Gateway + MarkReg + markreg.com Order runtime dependencies.
2. **Topology** — validate exact-head checkout, serialized destructive tests, required modes and owner database topology.
3. **Migration** — prove empty/current migration and upgrade from the complete Milestone 2 MarkReg schema.
4. **Restart** — prove exact Order lifecycle and Order-to-Matter replay through fresh database pools.
5. **Outage** — prove MarkReg startup outage/restoration plus Order repository/conversion runtime outage mapping.
6. **Concurrency** — prove deterministic replay, idempotency conflict, optimistic version conflict, duplicate-source protection, concurrent conversion and atomic failure rollback.
7. **Tenant isolation** — prove authenticated Workspace/actor truth and non-enumerating cross-Workspace Matter-link denial.
8. **Repeatability** — execute Order repository, lifecycle, conversion and authenticated HTTP groups twice and reject skipped tests or total drift.
9. **Browser** — execute the existing no-interception desktop and 390px real-runtime Order journey.
10. **Evidence** — validate the source-controlled scenario inventory in `MO-MVP-MILESTONE-003-RELIABILITY-MATRIX.json`.

## Database topology

The hosted workflow retains database-per-owner isolation. Core identity/authentication uses the Core database, MarkReg owns Order and Formal Matter truth in the MarkReg database, and Execution retains its own database. A separate empty PostgreSQL database is reserved for startup restoration evidence. No generic shared `DATABASE_URL` is introduced.

## Atomicity and failure evidence

The matrix includes existing executable tests proving that a Formal Matter insert failure leaves the Order unchanged and an Order-link audit failure leaves no orphan newly created Matter or conversion command. These are reliability assertions over the already-implemented M3-WP-04 transaction boundary; WP-07 does not modify that production boundary.

## Browser evidence

The browser group reuses the M3-WP-06 real-runtime journey and its no-interception validator. It covers desktop and mobile 390px behavior through the real Core + Gateway + MarkReg + PostgreSQL path, including refresh, exact Order URL, exact Formal Matter URL, Browser Back and Workspace stale-state clearing.

Generated reports, traces, screenshots and logs remain CI artifacts and are not tracked source.

## Exit condition

M3-WP-07 is complete only when the exact PR head passes the full ordered matrix and the normal workspace quality gate. The next package, `M3-WP-08`, is an independent integration/authority audit and must not add new product behavior while auditing this evidence.
