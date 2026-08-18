# MO MVP M9-WP-08 — Independent Reliability Audit

- **Work package:** `M9-WP-08`
- **Milestone:** `M9 — MO Lite Daily Workspace & Content Production`
- **Baseline main:** `31ce27276dedaa3b95c2bc8029f22c5d24bedda9` / M9-WP-06 merge (#122)
- **Audited candidate:** `48d6c44aa55648b25222698cc07ba892735d145c`
- **Audited tree:** `1f5d3001972c9247b8653aa9afa1307cc9a0d373`
- **WP07 PR:** `#123`
- **Status:** `IN_IMPLEMENTATION`

## Objective

Independently audit the exact M9-WP-07 candidate against the approved M9 scope lock and delivery plan. The audit must prove that M9 is a real runtime and not a screenshot, fixture-only presentation or authority shortcut.

The required product path remains:

`governed Knowledge source -> Daily Signal -> Daily Orbit -> Content Pick -> Content Kit -> governed Visual preparation -> reviewed content path -> copy/export/manual use or user-reported outcome -> Product feedback -> later relevance`

The parallel MOVE path remains:

`Today Recommendation -> Prepared Action -> explicit confirmation -> owner handoff -> returned outcome/feedback`

## Required evidence

The dedicated audit gate must verify:

1. exact audited candidate SHA/tree identity;
2. all pinned candidate workflow runs complete successfully on that exact SHA;
3. a real Knowledge-derived source is on the canonical acceptance path rather than an inline fixture authority or direct Lite table seed;
4. exact source provenance is preserved end to end;
5. Workspace isolation and fail-closed foreign target behavior;
6. stale/mismatched source rejection;
7. idempotent/replay-safe mutations and restart-readable durable state;
8. bounded concurrency behavior is exercised or explicitly remains a blocker;
9. desktop and mobile real-browser acceptance has no request interception or fixture UI fallback;
10. Product preference evidence does not become Capability evidence or external publication truth;
11. existing Product Loop and M1-M8 authority regressions remain green;
12. WP07 is merged to `main` and its merged tree matches the exact audited candidate before a final `GO` recommendation.

## Independence rule

WP08 is audit-only. It starts from the current `main` baseline and audits the exact WP07 candidate independently. It does not silently modify or replace the candidate. Audit implementation changes are restricted to the WP08 workflow, verifier, audit contract/report and this task document.

A `FIX` audit result is a valid independent audit result. It means the candidate is not yet eligible for M9 completion consideration. It does not authorize the auditor to weaken evidence requirements.

## Known initial blockers

The initial audit is expected to remain fail-closed while either condition is true:

- `WP07_NOT_MERGED_TO_MAIN` — PR #123 has not yet been explicitly authorized and merged;
- `REAL_KNOWLEDGE_DERIVED_BROWSER_PATH_NOT_PROVEN` — the canonical browser runtime still defines an inline `ProductLoopSourceAuthority` and directly seeds `lite_daily_signals`, so the browser path does not yet prove a real Core/Knowledge source transport.

The second blocker is a runtime-evidence gap, not a naming issue: using the `CORE / KNOWLEDGE_READY_PACKAGE` object shape is not by itself proof that the canonical acceptance path consumed the real governed source boundary.

## Non-goals

WP08 does not:

- change Product runtime behavior to make the audit pass;
- merge WP07 automatically;
- create publication, outreach, payment, filing, Matter or Official Truth;
- convert Product preference evidence into Capability evidence;
- authorize provider/paid Visual execution;
- deploy production traffic or publish a release/tag;
- treat green CI as Owner merge/release authorization.

## Permanent authority locks

```text
Independent Audit GO != Owner Merge Authorization
Independent Audit GO != Owner Release Authorization
Green CI != M9 complete
Product preference evidence != Capability evidence
PublishPackage != Published
Visual request != provider/paid execution authorization
Prepared Action confirmation != external completion truth
```

## Exit gate

WP08 implementation is complete when the dedicated hosted independent-audit workflow produces retained machine-readable evidence for the exact candidate and all applicable audit-branch gates pass.

M9 receives a final `GO` recommendation only when the audit has zero blockers, including exact WP07 mainline tree identity and a canonical real Knowledge-derived acceptance path. No WP08 result auto-merges, releases or deploys anything.
