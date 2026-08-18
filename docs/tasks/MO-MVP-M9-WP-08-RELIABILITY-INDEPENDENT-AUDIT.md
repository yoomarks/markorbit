# MO MVP M9-WP-08 — Reliability and Independent Runtime Audit

- **Work package:** `M9-WP-08`
- **Milestone:** `M9 — MO Lite Daily Workspace & Content Production`
- **Audited candidate:** `d4d9595bcf8d1fe57ee0e4b4885b7c4c451274b1`
- **Candidate tree:** `cd2a7476250010d0380cf9c31e5f7bb86a5ff44f`
- **WP07 base:** `48d6c44aa55648b25222698cc07ba892735d145c` / PR `#123`
- **Real-source remediation PR:** `#126`
- **Status:** `INDEPENDENT_AUDIT_IMPLEMENTATION`

## Objective

Independently audit the exact remediated M9 candidate against the approved M9 Scope Lock and Delivery Plan. WP08 proves whether M9 is a real runtime path rather than a collection of screenshots, fixtures, locally seeded projections or green unit tests.

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

## Audit history and bounded remediation

The first hosted WP08 audit, run `32136662329`, successfully audited exact WP07 head `48d6c44aa55648b25222698cc07ba892735d145c` and returned `FIX` with exactly two blockers:

- `WP07_NOT_MERGED_TO_MAIN`;
- `REAL_KNOWLEDGE_DERIVED_SOURCE_NOT_PROVEN`.

That audit also verified exact provenance, Workspace isolation, stale-source rejection, replay safety, restart recovery, bounded concurrency, desktop/mobile browser behavior, no canonical route interception, no false publication/Capability claims, and the inherited M1-M8 regression evidence.

PR #126 is a bounded remediation stacked on the exact WP07 head. Its final candidate delta is restricted to `scripts/product-loop-today-real-runtime.ts`.

The canonical browser runtime now:

- constructs accepted ReadyPackage content in Core's existing Knowledge repositories;
- validates that ReadyPackage content against the existing Core intake/content integrity contract before acceptance;
- resolves the accepted source through the existing Core internal Daily source HTTP boundary using `HttpCoreDailyKnowledgeSourceAuthority`;
- imports the Daily Signal through `PostgresLiteDailySignalStore.importKnowledgeSource()`;
- derives the Recommendation source from the same Core Daily projection so exact-source matching remains intact;
- no longer directly inserts `lite_daily_signals` or uses the former synthetic in-process source resolver.

Clean remediation head `d4d9595bcf8d1fe57ee0e4b4885b7c4c451274b1` passed:

- `validation` run `32137824495`;
- `Product Loop Today Prepared Action` run `32137824537`, including real PostgreSQL, HTTP/Gateway/client/Storybook checks and the real desktop/mobile browser journey.

WP08 may inherit the original WP07 workflow evidence only because it independently proves the remediation candidate differs from that exact WP07 base by the single bounded canonical-runtime harness path above, and it independently performs a clean build plus full `pnpm check` on the remediated candidate.

## Mainline lock

The real-source evidence blocker is expected to clear on the remediated candidate. M9 must still remain `FIX` while that exact candidate has not been explicitly merged to `main` with matching tree identity.

The correct remaining blocker before Owner merge authorization is therefore `M9_CANDIDATE_NOT_MERGED_TO_MAIN`.

A green independent audit does not itself authorize a merge. A `GO` recommendation becomes possible only after the exact remediated candidate is explicitly merged to `main` and the merged tree identity is independently verified.

## Independence rule

WP08 changes only audit workflow/script/contract/task files. It does not silently repair the candidate, replace missing evidence, weaken M9 completion rules or convert a missing mainline identity into a pass.

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

WP08 is implementation-complete when its dedicated hosted workflow produces retained machine-readable audit evidence for exact candidate `d4d9595bcf8d1fe57ee0e4b4885b7c4c451274b1`.

M9 receives `GO` only when no blockers remain, including exact `main` tree identity for the explicitly merged remediated candidate. Until then the correct independent recommendation is `FIX`.
