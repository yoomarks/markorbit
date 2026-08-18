# MO MVP Milestone 10 — Delivery Plan

- **Milestone:** M10 — Professional Trademark Asset Portfolio
- **Status:** APPROVED_FOR_IMPLEMENTATION_BY_OWNER_CONTINUATION
- **Baseline:** `b974a568ba2d78817a0f61612eb47fc740485a74`
- **Primary outcome:** a real Workspace-private trademark portfolio that preserves source provenance and owner boundaries

## 1. Delivery sequence

```text
WP01 contracts / ownership
-> WP02 durable asset registry
-> WP03 governed import
-> WP04 MarkReg linking
-> WP05 portfolio read/search/watch
-> WP06 product UI + Daily integration
-> WP07 reliability / independent audit
```

One bounded branch/PR per work package remains preferred. Each package starts from current `main` after the previous bounded merge.

## 2. M10-WP-01 — Contracts, ownership and authority boundary

### Goal

Freeze the smallest shared vocabulary needed for private trademark assets without creating a second Matter lifecycle or official-register truth model.

### Deliverables

- Trademark Asset source classes;
- asset identity and version vocabulary;
- source/provenance reference contract;
- collection/tag/watch vocabulary;
- owner-link contract for MarkReg references;
- import dry-run/commit/result vocabulary;
- bounded public-reference lookup vocabulary;
- explicit authority flags and tests.

### Acceptance

- `TrademarkAsset != Matter != Official Register Record` is test-locked;
- source classes are explicit;
- no cross-service SQL contract exists;
- no import row can silently claim official verification;
- existing Core/MarkReg/Data Engine/Knowledge boundaries remain intact.

## 3. M10-WP-02 — Durable private Trademark Asset registry

### Goal

Make asset state durable and Workspace-isolated under Lite ownership.

### Scope

- Lite-owned PostgreSQL migration;
- asset create/read/update/archive semantics;
- exact source references;
- private notes;
- tags and collections;
- watch state;
- optimistic concurrency;
- command idempotency;
- authenticated service/Gateway boundaries.

### Acceptance

- restart durability;
- cross-Workspace isolation;
- stale-version update rejection;
- replay-safe create/update;
- source/provenance preserved across updates;
- archive does not delete owner-source evidence.

## 4. M10-WP-03 — Governed import and duplicate assistance

### Goal

Allow professionals to bring an existing portfolio into Lite without destructive or ambiguous merging.

### Scope

- normalized CSV import contract;
- dry-run validation;
- bounded field mapping;
- row-level validation/evidence;
- committed import batch;
- deterministic batch replay;
- duplicate candidate detection;
- explicit user decision for ambiguous duplicates.

### Acceptance

- malformed rows fail independently;
- dry-run causes no durable asset mutation;
- committed replay does not duplicate assets;
- ambiguous duplicate candidates never auto-merge;
- import source is recorded as `IMPORTED_FILE`;
- Workspace isolation is tested with real PostgreSQL.

## 5. M10-WP-04 — MarkReg Matter/Lifecycle linking projection

### Goal

Connect private trademark assets to existing professional work without copying owner truth into Lite.

### Scope

- authenticated MarkReg lookup/link authority;
- stable link references;
- bounded Matter/Lifecycle projection;
- exact owner/source fingerprint/version where available;
- stale/unavailable owner state handling;
- unlink without deleting MarkReg owner state.

### Acceptance

- Lite cannot mutate MarkReg through asset linking;
- cross-Workspace links fail closed;
- stale owner evidence is visible rather than silently promoted;
- linked lifecycle projection remains distinct from asset-private fields;
- no second lifecycle table/state machine is introduced in Lite.

## 6. M10-WP-05 — Portfolio read, search and watch projection

### Goal

Make the asset registry useful at professional portfolio scale.

### Scope

- All Assets;
- jurisdiction/client/class filters;
- watched assets;
- linked/unlinked Matter state;
- recently updated;
- missing-information projection;
- text/number search;
- exact source inspection;
- advisory watch signals;
- saved views if they reuse existing preference patterns cleanly.

### Acceptance

- deterministic query behavior;
- no cross-Workspace leakage;
- watch signal explanation is human-readable;
- watch signal does not claim an official/legal deadline;
- source visibility remains available from list/detail projections.

## 7. M10-WP-06 — Product UI and Daily integration

### Goal

Ship a real professional trademark portfolio experience and make bounded asset context available to the Daily Workspace.

### Product surface

```text
TRADEMARK ASSETS
PORTFOLIO VIEWS
IMPORT
ASSET DETAIL
SOURCE / PROVENANCE
LINKED WORK
WATCH
```

### Daily integration

Asset context may influence relevance only through a bounded Lite-owned projection. The Daily Workspace must explain why an item relates to a portfolio asset or portfolio dimension.

### Required states

- desktop/mobile;
- loading;
- empty portfolio;
- import dry-run errors;
- partial import success;
- permission denied;
- stale/unavailable owner link;
- success;
- direct URL/reload;
- network failure consistent with existing UI patterns.

### Acceptance

- real browser path uses authenticated APIs and real PostgreSQL;
- no business-route interception or fixture-only canonical acceptance;
- asset context changes relevance only where explicit matching evidence exists;
- no protected action executes from viewing/importing/watching an asset.

## 8. M10-WP-07 — Reliability and independent audit

### Goal

Prove M10 as a real durable professional workspace rather than a UI-only portfolio mock.

### Required evidence

- real PostgreSQL restart/replay;
- Workspace isolation;
- optimistic concurrency;
- import dry-run/commit/replay;
- duplicate-assistance non-destructive behavior;
- exact source/provenance retention;
- governed MarkReg linking and stale-link handling;
- desktop/mobile real browser acceptance;
- no route interception/fixture fallback for canonical acceptance;
- no cross-service SQL;
- no official/legal truth fabrication;
- no automatic protected external action;
- M1-M9 authority regression coverage where affected.

## 9. Deferred integrations

Public trademark data through Data Engine is useful but not required to make the private portfolio functional. If the read-only consumer endpoint is not yet stable, M10 must keep that path explicitly deferred/fail-closed while private/user/MarkReg-linked assets remain usable.

## 10. Merge policy

For each work package:

1. inspect existing compatible contracts/runtime first;
2. implement on a bounded branch;
3. add tests before relying on new state transitions;
4. run affected hosted validation;
5. fix regressions before merge;
6. merge when bounded checks are green under current owner authorization;
7. start the next work package from current main;
8. do not treat merge as production deployment, GA or protected external-action authorization.
