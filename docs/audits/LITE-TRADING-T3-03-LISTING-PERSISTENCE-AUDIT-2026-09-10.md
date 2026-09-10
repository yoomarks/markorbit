# Lite Trading T3-03 Listing Persistence / Read Audit

Issue: #1115  
Task: `LT-T3-03-AUDIT`  
Audit baseline: `main@2d146cd8d6e8b7ac062866211c5317caae435db4`  
Status: `READY_FOR_T3_03_CODE`  
Execution prerequisite: explicit L0 migration lock / next available migration slot

## Objective

Freeze the durable owner and repository boundary for Lite Trading Listing persistence/read before any Publish runtime is introduced.

The current product chain is:

`Showcase -> private Listing Draft -> exact Listing Asset admission -> review/publish eligibility`

This audit intentionally changes no runtime, contract, schema, API, UI, workflow, root configuration, or shared hot file.

## Canonical truth already available

The existing contracts already carry the minimum semantics required for the first persistence/read implementation slice:

- `TradingListingDraftV1` is Workspace-bound and versioned, and carries exact upstream references.
- Listing review currentness already distinguishes `CURRENT`, `STALE`, and `CONFLICT` rather than treating latest state as reviewed truth.
- `TradingPublishedListingV1` already preserves `publishedDraftSnapshot`.
- T3-01/T3-02 already establish exact Showcase / Listing Asset lineage and preserve the rule that AI, QA, Showcase, and Listing Asset admission do not themselves grant publication authority.

Therefore T3-03 does not require a new shared contract primitive before owner-local persistence can begin.

## Owner matrix

| Object / reference | Durable truth owner | Frozen persistence/read rule |
| --- | --- | --- |
| `TradingListingDraftV1` | `@markorbit/lite-service` | Version-addressable Lite-owned record. Newer versions must never overwrite an earlier reviewed version. |
| Listing publish review | `@markorbit/lite-service` | Persist the exact Draft id/version and review currentness/result evidence. |
| `TradingPublishedListingV1` | `@markorbit/lite-service` | Persist/read the exact published object and its `publishedDraftSnapshot`; never rebuild it from latest Draft state. |
| Listing Asset reference | Existing Lite Trading owner, referenced only | Persist exact id/version/reference evidence only. No second Listing Asset truth owner. |
| Showcase reference | Existing Lite Trading owner, referenced only | Persist exact id/version/reference evidence only. Never silently resolve latest state. |
| Trademark Asset | Existing Trademark Asset owner, referenced only | Database existence is not Trademark Truth, ownership verification, market demand, or valuation. |

There is one Listing persistence owner: `@markorbit/lite-service`.

No new service, generic truth store, or direct cross-service SQL is justified.

## Durable record shape

Use the existing Lite append/version persistence convention rather than a mutable single-row Listing document.

### Draft versions

Persist append-only/version-addressable records keyed by at least:

`(workspace_id, listing_draft_id, version)`

The durable record should contain the validated `TradingListingDraftV1` document plus only bounded/indexable columns required for integrity and query operations.

### Review records

Persist the exact reviewed Draft id/version and its review/currentness evidence. Review reconstruction must never call a latest-Draft reader in place of the exact reviewed version.

A later Draft version may legitimately make a previously recorded review stale, but the historical review must still point to the exact object that was reviewed.

### Published Listing snapshots

Persist the exact validated `TradingPublishedListingV1`, including its `publishedDraftSnapshot`.

A read of published truth must return that recorded snapshot after validation. It must not re-resolve Draft, Showcase, Listing Asset, or Trademark Asset to a newer mutable/current version.

### Workspace scope and integrity

Workspace must participate in every durable key and query boundary.

Persisted JSON/document reads must be validated against the existing contract and fail closed if malformed or corrupt. Unknown, unavailable, not loaded, missing, and empty are not interchangeable states.

## Repository API boundary

Exact and latest reads must be separate operations. A single ambiguous `get()` surface is not sufficient for this domain.

Recommended owner-local API shape:

- `saveDraft({ draft, expectedVersion, idempotencyKey })`
- `getDraftVersion(workspaceId, draftId, version)`
- `getLatestDraft(workspaceId, draftId)`
- `saveReview({ review, expectedVersion, idempotencyKey })`
- `getReviewVersion(...)`
- `savePublishedListing({ listing, expectedVersion, idempotencyKey })`
- `getPublishedListingVersion(...)`

The final names may follow current Lite local style, but the exact-vs-latest semantic distinction is mandatory.

## Versioning and idempotency rules

Reuse the established Lite PostgreSQL convention visible in `PostgresTradingStudioRunStore`:

- Workspace-scoped transactional mutation;
- optimistic versioning;
- deterministic idempotency fingerprint;
- same idempotency key + same request fingerprint => replay-safe same result;
- same idempotency key + different request fingerprint => typed `IDEMPOTENCY_CONFLICT`;
- stale `expectedVersion` => typed `VERSION_CONFLICT`;
- missing exact requested version => typed `NOT_FOUND`, never fallback to latest;
- infrastructure/storage failure => explicit persistence-unavailable error, never empty success;
- stored document is contract-validated on read and fails closed on corruption.

For Listing, exact-version lookup is stricter than the existing Studio Run `getLatest()` example because review/published semantics depend on immutable historical identity.

## Migration ownership

Migration ownership remains Lite-owned under:

`infrastructure/persistence/migrations/<NEXT>_lite_trading_listings.sql`

Do not reserve a migration number in the audit. The next slot is allocated only after L0 grants the migration lock.

The implementation must remain within the existing migration owner model and must not create cross-service SQL ownership.

## Minimum implementation file map

Expected first code slice:

- `services/lite/src/trading-listing.ts`
  - PostgreSQL Listing repository/store
  - typed persistence/integrity errors
  - exact/latest read separation
- `services/lite/tests/trading-listing-postgres.test.ts`
  - PostgreSQL durability
  - restart proof
  - Workspace isolation
  - exact snapshot / stale-conflict negative paths
- `services/lite/src/index.ts`
  - only if the repository must be exported through the existing Lite root barrel
- `services/lite/package.json`
  - only if current build/export conventions actually require a new explicit entry
- `infrastructure/persistence/migrations/<NEXT>_lite_trading_listings.sql`
  - only while holding the migration lock

No `packages/contracts/**`, root package/lockfile, workflow, Gateway, Web, or other service file is required for the first implementation slice based on the current audit.

## Required test matrix

The implementation phase must prove at minimum:

1. Create Draft v1 and read exact v1.
2. Create Draft v2; `getLatestDraft` returns v2 while exact v1 remains available and unchanged.
3. Review Draft v1, then create Draft v2; the review still binds exact v1 and any `STALE` / `CONFLICT` state remains explicit rather than showing v2 as reviewed.
4. A Published Listing retains the exact stored `publishedDraftSnapshot` after newer Draft, Showcase, or Listing Asset versions exist.
5. Workspace A cannot read, update, or replay Workspace B Listing state even when local object ids collide.
6. Stale optimistic mutation fails with `VERSION_CONFLICT`.
7. Exact idempotent replay succeeds; conflicting idempotency reuse fails.
8. Repository/process restart preserves exact Draft/Review/Published reads.
9. Malformed persisted documents fail closed; they do not become empty state.
10. Persistence creates no publication, execution, marketplace, filing, payment, provider-contact, or Trademark-Truth authority.

## Permanent semantic locks

- Durable row != Published Listing.
- Persisted Draft != publication approval.
- Persisted review != protected-action authorization.
- Database existence != Trademark Truth.
- Database existence != ownership verification.
- Database existence != market demand.
- Database existence != valuation.
- Exact reviewed snapshot must not silently become latest mutable state.
- Workspace A state must never leak into Workspace B.
- Unknown / unavailable / not loaded != empty.
- No cross-service SQL.
- No second generic Listing truth store.
- No Publish runtime in T3-03 persistence/read.
- No review UI/API in the first persistence/read slice.

## Dependency verdict

**Shared Contracts Lock:** not required for the first T3-03 coding slice.

**Migration lock:** required before coding because the slice needs durable PostgreSQL tables and migration numbering is globally serialized.

## Final verdict

`READY_FOR_T3_03_CODE`

Execution remains intentionally blocked at the schema boundary until L0 explicitly grants the migration lock / next available migration slot.
