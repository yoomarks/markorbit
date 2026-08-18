# MO MVP M9-WP-08 — Reliability and Independent Runtime Audit

- **Work package:** `M9-WP-08`
- **Milestone:** `M9 — MO Lite Daily Workspace & Content Production`
- **Audited candidate:** `48d6c44aa55648b25222698cc07ba892735d145c`
- **Candidate tree:** `1f5d3001972c9247b8653aa9afa1307cc9a0d373`
- **WP07 PR:** `#123`
- **Status:** `INDEPENDENT_AUDIT_IMPLEMENTATION`

## Objective

Independently audit the exact M9-WP-07 candidate against the approved M9 Scope Lock and Delivery Plan. WP08 proves whether M9 is a real runtime path rather than a collection of screenshots, fixtures, locally seeded projections or green unit tests.

The required M9 path remains:

`governed Knowledge source -> Daily Signal -> Daily Orbit -> Content Pick -> existing Content lifecycle -> Content Kit / Visual preparation -> reviewed PublishPackage -> Product feedback -> later relevance`

The parallel MOVE path remains:

`Today Recommendation -> Prepared Action -> explicit confirmation -> owner handoff -> outcome / feedback`

## Required evidence

The independent audit must verify all requirements frozen in the M9 Delivery Plan:

1. a real Knowledge-derived source is on the canonical acceptance path;
2. exact provenance is preserved;
3. Workspace isolation is preserved;
4. stale source evidence is rejected;
5. mutations are idempotent / replay safe;
6. restart recovery is exercised;
7. bounded concurrency behavior is exercised;
8. canonical desktop and mobile browser journeys use real runtime state;
9. canonical acceptance does not intercept routes or fall back to fixture UI;
10. Product feedback does not fabricate publication, external outcome or Capability verification;
11. Product Loop and M1-M8 authority regressions remain green.

## Current independent finding

The exact WP07 candidate has strong real-runtime evidence for PostgreSQL persistence, Workspace isolation, preference replay safety, browser desktop/mobile behavior, canonical target derivation, exact Visual Output resolution and M1-M8 regressions.

However, the canonical browser runtime currently constructs an in-process `ProductLoopSourceAuthority` and directly seeds `lite_daily_signals` inside `scripts/product-loop-today-real-runtime.ts`. That proves the Lite runtime over realistic governed source-shaped data, but it does **not** prove that a real Core/Knowledge-derived source traverses the canonical acceptance path.

Therefore WP08 must keep the blocker `REAL_KNOWLEDGE_DERIVED_SOURCE_NOT_PROVEN` until the canonical acceptance path consumes the governed Core/Knowledge source boundary instead of synthesizing the source authority and Daily Signal inside the browser harness.

WP07 is also still Draft and unmerged. The audit must keep `WP07_NOT_MERGED_TO_MAIN` until PR #123 is explicitly merged and the merged tree is proven identical to the audited candidate tree.

## Independence rule

WP08 is audit/workflow/documentation scope only. It does not silently repair the candidate, replace the exact audited candidate, weaken M9 completion rules or convert missing evidence into a pass.

A `FIX` recommendation is a valid completed audit result. It means the audit ran successfully and found real blockers. It is not a CI failure and must not be hidden by fixture evidence.

## Permanent authority locks

```text
Independent Audit GO != Owner merge authorization
Independent Audit GO != Release / Deployment authorization
Green CI != M9 complete
Product feedback != Capability verification
PublishPackage != Published
Visual request != Provider execution
Daily Orbit != Legal / Official Truth
Prepared Action != External execution
```

WP08 must never publish externally, authorize provider/payment execution, create Filing/Matter/Official Truth, or deploy production traffic.

## Exit gate

WP08 is implementation-complete when its dedicated hosted workflow produces retained machine-readable audit evidence for the exact WP07 candidate.

M9 receives `GO` only when no blockers remain, including exact mainline tree identity for the explicitly merged WP07 candidate and a canonical real Knowledge-derived source path. Until then the correct independent recommendation is `FIX`.
