# MO MVP Milestone 10 — Professional Trademark Asset Portfolio Scope Lock

- **Milestone:** M10
- **Status:** APPROVED_FOR_IMPLEMENTATION_BY_OWNER_CONTINUATION
- **Baseline:** `b974a568ba2d78817a0f61612eb47fc740485a74`
- **Primary product:** MarkOrbit Lite
- **Original MVP task aligned:** `MO-MVP-TASK-053 — Trademark Assets`
- **Depends on:** M9 Daily Workspace engineering GO, existing Core identity/Workspace boundaries, MarkReg Matter/Lifecycle truth, Product Loop authority locks

## 1. Objective

M10 makes trademark assets a first-class private professional workspace in Lite.

The milestone gives a professional user one governed place to organize, inspect and reuse trademark portfolio context without turning Lite into an official register, a second Matter system or a public-data owner.

The product path is:

```text
Workspace-owned trademark asset
-> exact source/provenance
-> portfolio organization and retrieval
-> linked client / Matter / lifecycle context where available
-> explainable watch/relevance signals
-> Daily Workspace reuse
-> governed professional action handoff when needed
```

## 2. Existing implementation that M10 must reuse

M10 must preserve and extend, not replace:

- Core-owned User, Workspace, Membership, Principal and permissions;
- Lite-owned customer and professional workspace surfaces;
- MarkReg-owned Matter, Document Package, Lifecycle Projection and Recommended Action truth;
- M9 Daily Signal, Daily Orbit, Content and Product preference boundaries;
- Product Loop Prepared Action and explicit confirmation semantics;
- Data Engine as an independent ingestion/normalization system consumed only through explicit read-only contracts;
- existing Gateway authentication, CSRF, Workspace isolation and owner-routing patterns.

No second Matter lifecycle, official-status database, identity system, universal CRM or cross-repository SQL access may be introduced.

## 3. Product locks

### 3.1 Trademark Asset is a private professional work object

A `TrademarkAsset` is a Workspace-scoped professional record used to organize portfolio context.

It may contain or reference bounded facts such as:

- mark text / display label;
- mark type;
- jurisdiction;
- application or registration number when known;
- applicant / owner label;
- Nice classes;
- goods/services summary;
- client/customer reference;
- linked MarkReg Matter or lifecycle projection;
- user tags / folders / watch state;
- source/provenance references;
- bounded notes.

It is not automatically official truth merely because it stores an application number, registration number or status label.

### 3.2 Source type must be explicit

Every material external or owner-derived fact must retain a source class and provenance. Initial source classes are bounded to:

```text
USER_ENTERED
MARKREG_LINKED
DATA_ENGINE_PUBLIC_REFERENCE
KNOWLEDGE_REFERENCE
IMPORTED_FILE
```

The UI and contracts must be able to distinguish user-entered/private working facts from owner-service and public-reference facts.

### 3.3 MarkReg remains the owner of Matter and lifecycle truth

Linking an asset to a MarkReg Matter does not copy Matter authority into Lite.

Lite may project bounded Matter/Lifecycle information through owner contracts, but it may not mutate MarkReg owner state directly or create a competing lifecycle state machine.

### 3.4 Data Engine remains read-only from MarkOrbit

M10 may define a bounded Data Engine consumer contract for public trademark lookup/reference data.

It must not:

- read Data Engine databases directly;
- write to Data Engine;
- promote public-data normalization into official/legal verification;
- make public lookup availability a hard dependency for private asset use.

### 3.5 Portfolio organization is Lite-owned

The following are Lite Product state unless a later owner boundary explicitly changes them:

- folders / collections;
- tags;
- watch / follow state;
- saved filters;
- private notes;
- portfolio display preferences;
- links from a private asset to existing owner objects.

### 3.6 Watch signals are advisory

M10 may compute or surface watch signals such as changed source reference, approaching user-configured date, missing portfolio field or linked lifecycle change.

A watch signal is not:

- an official deadline determination;
- a legal opinion;
- automatic filing authority;
- automatic customer outreach;
- automatic protected-action execution.

### 3.7 No automatic portfolio inference from unrelated data

M10 must not silently create trademark assets from email, browser history, provider returns, public datasets or Knowledge items merely because a name/number resembles a trademark.

Asset creation requires an explicit user/import action or an explicit governed owner-handoff contract.

## 4. Minimum M10 product model

M10 must formalize the smallest useful vocabulary for:

- `TrademarkAsset`;
- `TrademarkAssetSourceReference`;
- `TrademarkAssetLink`;
- `TrademarkAssetCollection`;
- `TrademarkAssetTag`;
- `TrademarkAssetWatchState`;
- `TrademarkAssetImportBatch` and row result vocabulary;
- bounded public-reference lookup result;
- asset-to-Daily relevance projection.

Names may change in WP01 if existing repository semantics require it, but the ownership and authority separations in this scope lock may not be weakened.

## 5. Minimum asset fields

The first implementation should support bounded optional fields rather than pretending every jurisdiction shares one schema:

```text
asset id
workspace id
display name / mark text
mark type
jurisdiction
application number
registration number
owner/applicant display name
Nice classes
goods/services summary
client/customer reference
linked Matter reference
source references
tags / collection
watch state
private notes
created/updated audit metadata
```

Jurisdiction-specific official status semantics remain outside the private asset record unless projected through an owner/source contract with exact provenance.

## 6. Import minimum scope

M10 may support user-controlled CSV/XLSX-style tabular import through a normalized server-side import contract.

The canonical engineering implementation must support at least CSV without requiring spreadsheet software or a third-party SaaS.

Import must provide:

- dry-run / validation before commit;
- row-level errors;
- deterministic idempotency for an accepted batch;
- Workspace isolation;
- explicit source classification as `IMPORTED_FILE`;
- no silent overwriting of an existing asset on ambiguous identity;
- bounded duplicate detection suggestions rather than automatic destructive merging.

## 7. Portfolio read model

The first portfolio surface should support:

- All Assets;
- by jurisdiction;
- by client/customer;
- by Nice class;
- watched assets;
- linked / unlinked Matter state;
- recently updated;
- missing-information view;
- text/number search;
- exact provenance inspection.

Saved views are allowed when they remain Lite-owned preferences.

## 8. Daily Workspace integration

M10 may feed bounded private asset context into M9 relevance only through an explicit Lite-owned projection.

Examples:

- a watched asset with a linked lifecycle update may become more relevant;
- an asset explicitly associated with a preferred jurisdiction may affect Daily Orbit relevance;
- a source-derived Knowledge item may explain that it is relevant to assets in a matching jurisdiction/class.

M10 asset context must not fabricate legal certainty or silently create a protected action.

## 9. Cross-module ownership matrix

- **Core:** User / Workspace / Membership / Principal / permissions.
- **Lite:** private Trademark Asset, portfolio organization, import state, watch state, private notes and asset relevance projection.
- **MarkReg:** Matter, Document Package, lifecycle and Recommended Action owner truth.
- **Data Engine:** public/bulk trademark data ingestion and normalization behind a read-only consumer contract.
- **Knowledge:** source acquisition/provenance for knowledge material; not portfolio ownership.
- **Execution:** protected-action governance where a later explicit action handoff applies.
- **Gateway:** authenticated composition and owner routing.

## 10. Work packages

### M10-WP-01 — Contracts, ownership and authority boundary

Freeze the minimum Trademark Asset vocabulary, source classes, owner links, import contract and authority rules.

### M10-WP-02 — Durable private Trademark Asset registry

Add Lite-owned durable asset, source-reference, tags/collections, watch state and audit persistence with Workspace isolation, idempotency and optimistic concurrency.

### M10-WP-03 — Governed import and duplicate-assistance path

Add dry-run plus commit import, row-level evidence, deterministic batch replay and non-destructive duplicate suggestions.

### M10-WP-04 — MarkReg Matter/Lifecycle linking projection

Link private assets to existing MarkReg owner objects through authenticated owner contracts without copying or mutating owner truth.

### M10-WP-05 — Portfolio read/search/watch projection

Build explainable portfolio views, filters, search, missing-information and advisory watch projections with exact source visibility.

### M10-WP-06 — Lite Trademark Assets product UI and Daily integration

Add the authenticated desktop/mobile Asset portfolio and detail journey, import flow and bounded Daily relevance integration.

### M10-WP-07 — Reliability and independent authority audit

Prove persistence/restart/replay/import isolation, direct URL/mobile behavior, exact provenance, no cross-service SQL, no official-truth fabrication and no automatic protected action.

## 11. Explicit non-goals

M10 does not implement:

- automatic official-register filing or status verification;
- automatic legal deadline calculation for all jurisdictions;
- a universal docketing engine;
- a universal CRM;
- bulk scraping inside MarkOrbit;
- direct Data Engine database access;
- automatic customer outreach;
- automatic assignment/renewal/filing execution;
- Payment/Invoice changes;
- public portfolio sharing;
- professional Capability verification;
- external publication;
- production GA by implication.

## 12. Completion gate

M10 may receive an engineering GO recommendation only when a real authenticated Workspace can prove:

1. durable private asset creation/update/read with Workspace isolation;
2. explicit source classification and exact provenance;
3. dry-run and committed import with replay-safe row evidence;
4. non-destructive duplicate handling;
5. governed MarkReg linking without owner-state duplication;
6. usable search/filter/watch portfolio read models;
7. desktop/mobile asset list/detail/import journeys;
8. bounded asset context can influence Daily relevance without creating legal/official truth;
9. restart/replay/concurrency and stale-link behavior are tested;
10. no cross-service SQL or automatic protected external action exists;
11. deferred public-data integrations remain accurately labelled if unavailable.

## 13. Authorization consequence

The owner's current instruction authorizes continuous engineering and PR merge after bounded validation is green.

This does not authorize production deployment, external filing, customer outreach, paid provider action, official-status claims or other protected external actions by implication.
