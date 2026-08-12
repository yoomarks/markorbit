# M7-WP-06 — Exact-head Beta RC reliability, responsive and known-limits matrix

- **Work package:** `M7-WP-06`
- **Baseline:** M7-WP-05 merge `7b5fe161237eca65c7bd657dbf070825a726db2e` / PR #99.
- **Status:** `IN_PROGRESS`.
- **Candidate class:** `BETA_RELEASE_CANDIDATE`.
- **Environment class:** `NON_PRODUCTION_REHEARSAL`.

## Objective

Qualify one exact repository head as an engineering Beta release candidate for the independent M7-WP-07 audit. The qualification composes existing milestone and Product Loop gates instead of creating a replacement test platform.

A passing WP-06 matrix means only:

```text
exact head
+ required regression gates
+ M7 predecessor gates
+ desktop/mobile critical-path evidence
+ restart/replay/isolation/idempotency evidence
+ stable candidate/config fingerprint
+ explicit machine-readable known limits
= engineering candidate eligible for independent audit
```

It does not release Beta, deploy production traffic or create business authority.

## Candidate manifest

`infrastructure/rehearsal/m7-wp-06-beta-rc.json` freezes the candidate contract. It requires:

- exact-head qualification;
- M2 through M6 reliability/integration coverage;
- Product Loop Closure regression coverage;
- M7-WP-02 bounded analytics;
- M7-WP-03 deterministic reset/reseed replay;
- M7-WP-04 three-loop real-runtime desktop and 390px mobile acceptance;
- M7-WP-05 migration/startup/restart/snapshot-recovery rehearsal;
- generic workspace validation and browser/visual evidence;
- a deterministic SHA-256 candidate/config fingerprint;
- machine-readable known limits;
- `releaseAuthorized: false` and `productionTrafficAllowed: false`.

The dedicated hosted gate checks out the exact PR head and runs the full workspace regression before emitting `.artifacts/m7-wp-06-beta-rc-matrix.json`.

## Stable candidate fingerprint

`scripts/m7-wp-06-beta-rc-matrix.mjs` hashes the candidate-defining inputs rather than relying on a mutable environment label. Inputs include the lockfile, migration-owner topology, WP-05 candidate topology, WP-06 manifest and known limits, required regression workflow definitions, M7 predecessor workflows and the three critical responsive Playwright configurations.

The evidence records both every input SHA-256 and one aggregate `candidateConfigFingerprint`. The fingerprint is evidence for the exact candidate configuration only; it is not a release tag and does not authorize deployment.

## Known limits

`infrastructure/rehearsal/m7-wp-06-known-limits.json` is mandatory machine-readable RC evidence. At minimum it keeps visible:

1. **Lite local workspace scope anchor** — the existing immutable Lite `0039_lite_content_preparation.sql` migration requires an empty owner-local `workspaces` structural anchor on a clean Lite database. No Core identity rows or business records are copied.
2. **Forward-only migration model** — there are no down migrations; recovery uses per-owner logical pre-forward snapshot restore followed by exact forward reapply.
3. **Non-production rehearsal only** — deployment evidence does not prove or perform production traffic cutover.
4. **External protected actions are not executed** — internal acceptance does not equal publication, provider appointment, Filing Submission or Official Truth.
5. **User-reported external use remains unverified** — conversion analytics are observational and non-authoritative.
6. **Explicit Owner release action remains required** — green CI and a passing matrix do not release Beta.

Known limits are not suppressed by a PASS result. They travel with the exact candidate into M7-WP-07.

## Gate composition

WP-06 reuses established owner gates. It does not copy their business test logic into a new universal runner. The RC manifest points to the canonical workflow definition for each required gate, and the WP-06 change surface is added to M7-WP-02 through M7-WP-05 path filters so those predecessor gates rerun on the exact candidate head.

The existing repository reliability and browser workflows remain authoritative for their own domains. The dedicated WP-06 job adds the cross-cutting exact-head/fingerprint/known-limits assertion and full workspace `pnpm check`.

## Authority locks

The following remain permanent:

```text
Product metric != business authority
Seeded demo record != customer/provider/official truth
Deployment Rehearsal != Production Deployment
Beta Release Candidate != Released Beta
Green CI != Owner Release Authorization
Recommendation != authorization
Prepared Action != executed action
PublishPackage != Published
Candidate != Formal Opportunity
Formal Opportunity != Intake
Intake != Order != Matter != Filing
Evidence Review Decision != Official Truth
Lifecycle Projection != Official Status
Provider Return != Official Truth
Reflection Candidate != canonical truth
accepted private reflection != verified Capability
```

WP-06 may not publish a release or tag, cut production traffic, create Payment/Invoice, appoint a professional, submit a filing, create Official Truth, verify Capability automatically, mutate Capability Canon automatically, create public Capability ranking/certification or grant autonomous Twin protected-action authority.

## Exit gate

WP-06 is complete only when the final exact PR head passes the dedicated `M7 WP-06 Beta RC Matrix` workflow and all required predecessor/regression checks triggered for that head, with the known-limits artifact preserved.

A passing result makes the exact head eligible for **M7-WP-07 independent Beta readiness and authority audit**. It does not itself authorize a Beta release.
