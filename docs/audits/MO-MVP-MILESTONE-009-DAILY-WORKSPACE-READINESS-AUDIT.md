# MO MVP Milestone 9 — Daily Workspace Readiness Audit

## Audit subject

- Milestone: M9 — MO Lite Daily Workspace & Content Production
- Work package: M9-WP-08 — Reliability / Independent Audit
- Audited WP07 candidate: `48d6c44aa55648b25222698cc07ba892735d145c`
- Candidate tree: `1f5d3001972c9247b8653aa9afa1307cc9a0d373`
- WP07 PR: #123

## Audit standard

The audit follows the approved M9 Delivery Plan. Green CI is necessary but is not sufficient. The final recommendation must separately verify:

- a real Knowledge-derived source through the governed Core -> Lite transport on the canonical acceptance path;
- exact provenance;
- Workspace isolation;
- stale/mismatched source rejection;
- replay/idempotency and restart recovery;
- bounded concurrency behavior;
- desktop/mobile real browser operation without canonical route interception or fixture UI fallback;
- no fabricated external publication, Capability evidence, Filing or Official Truth;
- existing Product Loop and M1-M8 authority regressions.

## Current expected recommendation

`FIX`

The current audit contract intentionally expects blockers rather than weakening the standard to produce an artificial `GO`.

### Expected blocker — WP07 mainline identity

PR #123 is not yet merged. M9 completion cannot be considered until the exact candidate is merged or the merged tree is proven identical to the audited candidate tree.

### Expected blocker — real Knowledge-derived source acceptance

The canonical Daily Workspace browser path uses real PostgreSQL and the correct `CORE / KNOWLEDGE_READY_PACKAGE` vocabulary, but its runtime seed still supplies a test-local source authority and writes DailySignal rows directly into Lite persistence.

That is valid evidence for the Lite Product runtime, but it is not evidence for the required real Knowledge -> Core accepted ReadyPackage -> Lite DailySignal transport path.

### Expected blocker — bounded concurrency evidence

The audited candidate has explicit sequential replay/idempotency and restart evidence. The current M9 acceptance tests do not yet provide an explicit concurrent-race acceptance for the relevant mutable Product paths. The audit therefore keeps concurrency evidence separate from replay evidence.

## Authority boundary

```text
Audit recommendation != deployment
Audit recommendation != external publication
Audit recommendation != provider execution
Audit recommendation != Capability verification
Audit recommendation != Official Truth
Green candidate CI != real Knowledge-source acceptance
Sequential replay safety != concurrent race safety
```

The hosted audit workflow emits a retained JSON artifact. A `FIX` result is a valid completed audit; the workflow should fail only when the audit machinery/evidence is inconsistent, not merely because blockers are honestly reported.
