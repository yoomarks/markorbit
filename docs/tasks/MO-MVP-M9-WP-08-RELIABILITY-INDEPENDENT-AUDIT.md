# MO MVP M9-WP-08 — Reliability and Independent Audit

- **Work package:** `M9-WP-08`
- **Milestone:** `M9 — MO Lite Daily Workspace & Content Production`
- **Audit branch baseline:** `31ce27276dedaa3b95c2bc8029f22c5d24bedda9` (`main` after M9-WP-06)
- **Audited WP07 candidate:** `48d6c44aa55648b25222698cc07ba892735d145c`
- **Audited candidate tree:** `1f5d3001972c9247b8653aa9afa1307cc9a0d373`
- **WP07 PR:** `#123`
- **Status:** `AUDIT_IMPLEMENTATION_IN_PROGRESS_EXPECTED_FIX`

## Objective

Independently audit the exact M9-WP-07 candidate against the approved M9 Scope Lock and Delivery Plan. The audit must prove that M9 is a real governed runtime rather than a collection of fixture screenshots or green unit tests.

The required M9 path remains:

`governed source -> Daily Signal -> Daily Orbit -> Content Pick -> existing content lifecycle -> Content Kit -> Visual -> reviewed PublishPackage -> user copy/export/manual use or reported publication -> Product feedback -> later relevance`

The parallel MOVE path remains:

`Today Recommendation -> Prepared Action -> explicit confirmation -> owner handoff -> outcome / feedback`

## Independent-audit rule

WP08 does not silently create a replacement M9 candidate and does not modify M9 Product runtime. It audits the exact WP07 candidate and its hosted workflow evidence, then independently re-checks repository authority boundaries from the audit-only branch.

The audit is fail-closed. A green candidate workflow is evidence for the behavior it actually exercised; it does not prove requirements that the path did not contain.

## Required evidence

The dedicated audit must verify:

1. exact WP07 candidate SHA/tree identity;
2. all required candidate workflow runs completed successfully on that exact SHA;
3. exact provenance is preserved through Daily Signal / Orbit / Content preparation;
4. Workspace isolation remains enforced;
5. stale or mismatched source evidence is rejected;
6. Product mutations are idempotent/replay-safe within their documented contract;
7. restart recovery is covered by real PostgreSQL evidence;
8. bounded concurrency behavior is explicit and no unsupported exactly-once claim is made;
9. desktop and mobile canonical browser journeys execute without request interception or fixture UI fallback;
10. Product preference evidence cannot become Capability evidence or external-publication truth;
11. existing Product Loop and M1-M8 authority boundaries remain green;
12. the canonical acceptance path uses a **real Knowledge-derived source through the governed Core -> Lite boundary**, not an in-test source resolver or direct Lite DailySignal database insertion.

## Known expected blockers before final GO

### `WP07_NOT_MERGED_TO_MAIN`

PR #123 remains unmerged. Until the exact candidate (or a merge with identical tree) is on `main`, M9 cannot receive final completion consideration.

### `REAL_KNOWLEDGE_SOURCE_ACCEPTANCE_MISSING`

The current Daily Workspace browser runtime uses the correct `CORE / KNOWLEDGE_READY_PACKAGE` vocabulary and real PostgreSQL, but its acceptance seed still provides a test-local `ProductLoopSourceAuthority` resolver and inserts `lite_daily_signals` directly. That proves the Lite Product runtime, but it does **not** prove the required real Knowledge -> Core accepted source -> Lite DailySignal acceptance path.

WP08 must keep this blocker until a canonical acceptance run consumes an actual Core accepted ReadyPackage source through the real Core/Lite transport boundary.

## Non-goals

WP08 does not:

- add a new Product feature, service, database model or permission system;
- weaken source/provenance or Workspace isolation to make the audit pass;
- treat deterministic fixtures as real Knowledge-source acceptance;
- authorize external publication, outreach, provider execution, paid execution, filing or Official Truth;
- upgrade Product preference/usage events into Capability evidence;
- deploy production traffic or publish a release merely because CI is green.

## Permanent authority locks

```text
Independent Audit GO != Production Deployment
Independent Audit GO != External Publication Authorization
Green CI != Real Knowledge-source acceptance
Correct source vocabulary != Real source transport
Product preference != Capability evidence
PublishPackage != Published
Prepared Action != Owner execution
Merge != GA / release / deployment
```

## Exit gate

WP08 implementation is complete when its hosted workflow emits a retained machine-readable audit artifact for the exact WP07 candidate. A `FIX` recommendation is a valid audit result while blockers remain.

M9 receives `GO` only after the audit has no blockers, including real Knowledge-derived source acceptance and exact candidate/mainline identity. No audit result itself deploys or performs an external action.
