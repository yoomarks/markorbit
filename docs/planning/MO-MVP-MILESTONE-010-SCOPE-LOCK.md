# MO MVP Milestone 10 — Trademark Asset Workspace & Contextual AI Guide Scope Lock

- **Milestone:** M10
- **Status:** APPROVED_FOR_IMPLEMENTATION_AFTER_SCOPE_MERGE
- **Baseline:** `b974a568ba2d78817a0f61612eb47fc740485a74`
- **Primary product:** MO Lite
- **Approved direction:** `DURABLE_TRADEMARK_ASSET_WORKSPACE_AND_CONTEXTUAL_AI_GUIDE`
- **Depends on:** completed M9 Daily Workspace, existing MarkReg Matter/Lifecycle projections, Core identity/Workspace authority, Knowledge provenance, Capability privacy locks and Data Engine read-only integration rules

## 1. Objective

M10 makes a professional user's trademark portfolio usable as a durable private working context instead of a loose collection of records.

The product loop is:

```text
owned / admitted trademark asset
-> normalized private Asset projection
-> portfolio / client / jurisdiction / status context
-> explainable attention signal
-> contextual AI Guide
-> suggested bounded next step
-> explicit user choice
-> existing owner workflow / Today / Content / Matter path
```

M10 does not create a second trademark registry, Matter system, filing engine, CRM or autonomous legal agent.

## 2. Existing implementation M10 must reuse

M10 must extend, not replace:

- Core-owned User, Workspace, Membership, Principal and permission truth;
- MarkReg-owned Matter, Document Package, Order and Lifecycle Projection truth;
- Execution-owned protected-action and review boundaries;
- M9 Daily Workspace, Daily Orbit and Prepared Action semantics;
- M9 Product preference evidence;
- Knowledge source/provenance contracts;
- Data Engine read-only integration contracts;
- existing Lite Matter / Opportunity / Capability / Content surfaces;
- existing Gateway authentication, CSRF, origin and Workspace composition patterns.

No cross-service SQL is allowed.

## 3. Product locks

### 3.1 Trademark Asset is a private Product projection

A Lite Trademark Asset may aggregate user-owned or explicitly admitted identifiers and owner projections for convenient work. It does not become an official registry record merely because it exists in Lite.

### 3.2 Official status remains source-bound

Registry status, filing status, registration status, deadlines and ownership assertions must retain their exact source and observation time. AI or Product logic cannot silently promote an inferred value into official truth.

### 3.3 Matter and Asset remain distinct

A trademark Asset may reference zero, one or more owner-domain work records, but it does not replace Order, Matter, Lifecycle Projection, Execution evidence or provider truth.

### 3.4 AI Guide is contextual assistance, not autonomous authority

The AI Guide may summarize, explain, compare, surface missing information, suggest questions and prepare bounded next actions. It may not:

- file or submit externally;
- accept legal terms or professional review decisions;
- change official status;
- create verified Capability;
- fabricate deadlines or certainty;
- contact customers/providers automatically;
- spend money or select a paid provider route without governed approval;
- convert a suggestion directly into protected execution.

### 3.5 Every consequential suggestion must be explainable

A suggested next step must identify the relevant source context, owner record or explicit user preference that caused it to appear. Missing or stale evidence must be visible.

### 3.6 Data Engine remains read-only to MarkOrbit

Bulk/public trademark data may enrich search, matching and context only through an explicit read contract. Lite must not reach into Data Engine storage directly or mutate its data.

### 3.7 Knowledge remains acquisition and provenance

Knowledge may supply rules, office notices and source material. It does not own user-specific portfolio judgment or decide what a particular user must do.

## 4. Canonical M10 product journey

M10 must prove at least one real authenticated Workspace journey:

```text
user-owned or admitted trademark identifier
-> exact normalized Asset identity
-> owner/source links
-> portfolio view
-> attention reason
-> AI Guide explanation grounded in current context
-> suggested bounded action
-> user opens / saves / dismisses / prepares
-> existing owner handoff where applicable
-> durable Product feedback
```

A separate exploration path may support:

```text
Asset
-> related Knowledge / rule / change
-> explain relevance
-> create Content Pick or Daily relevance signal
```

without turning Knowledge into user-specific decision authority.

## 5. Minimum M10 product objects

M10 may introduce or formalize only the smallest required vocabulary for:

- `TrademarkAsset`;
- `TrademarkAssetIdentity`;
- `TrademarkAssetSourceReference`;
- `TrademarkAssetAttentionSignal`;
- `TrademarkAssetRelation`;
- `AiGuideContext`;
- `AiGuideSuggestion`;
- `AiGuideEvidenceReference`;
- bounded Asset interaction/preference events.

Names may change in WP01 if repository semantics require it, but the authority separations in this scope lock may not be weakened.

## 6. Minimum private Asset fields

The first implementation should support only fields that can be sourced explicitly or safely projected, including where available:

- mark text / image reference;
- jurisdiction;
- application / registration identifier;
- Nice classes;
- owner / client reference;
- application / registration / renewal dates;
- source-observed status;
- source observation timestamp;
- related Matter / Order / Lifecycle references;
- tags / notes owned by the Workspace;
- exact provenance and freshness state.

Unknown values remain unknown.

## 7. Initial attention dimensions

M10 begins with explainable Product-level attention dimensions such as:

- time sensitivity;
- source freshness;
- missing required context;
- relevant lifecycle recommendation already owned by MarkReg;
- recent external rule/change relevance when supported by Knowledge;
- user-saved priority.

These dimensions are not official legal conclusions.

## 8. AI Guide minimum behavior

The first AI Guide may support:

- explain this asset;
- what changed / why it matters;
- what information is missing;
- summarize current owner-domain work;
- show relevant rule/source material;
- compare selected assets;
- prepare a question/checklist;
- prepare a bounded Today/Content/owner-action candidate;
- explain why a suggestion is shown.

It must fail closed when required context is stale, inaccessible or contradictory.

## 9. Workspace and privacy requirements

- every private Asset is Workspace-scoped;
- private user notes/tags remain private Product state;
- cross-Workspace identifiers do not grant access to records;
- AI context compilation must enforce the same Principal and permission boundaries as the underlying records;
- private portfolio behavior does not become public rating, professional certification or provider supply evidence.

## 10. M10 work packages

### M10-WP-01 — Asset and AI Guide contracts / authority boundary

Freeze minimum shared vocabulary, lifecycle separation, source/freshness semantics, AI authority and no-cross-service-SQL rules.

### M10-WP-02 — Durable Workspace Trademark Asset projection

Implement durable private Asset identity, owner/source references, Workspace isolation, provenance and replay-safe admission/update semantics.

### M10-WP-03 — Owner and Data source composition

Compose existing MarkReg owner projections plus explicit read-only external/public data contracts without duplicating owner truth.

### M10-WP-04 — Explainable Asset attention model

Produce bounded attention signals from exact current evidence, freshness and user priorities with human-readable reasons.

### M10-WP-05 — Contextual AI Guide runtime

Compile permission-safe Asset context and generate grounded, non-executing suggestions with exact evidence references and fail-closed stale/conflict handling.

### M10-WP-06 — Trademark Asset Workspace UI

Deliver authenticated desktop/mobile portfolio, Asset detail, attention, provenance, related work and AI Guide surfaces.

### M10-WP-07 — Today / Content / Work integration and feedback

Allow explicit user choices to create bounded Product candidates or existing owner handoffs while recording Product feedback without fabricating execution or Capability evidence.

### M10-WP-08 — Reliability and independent audit

Prove Workspace isolation, provenance, source freshness, replay/idempotency, restart/concurrency, real browser desktop/mobile, no fixture-only canonical path, no cross-service SQL and no AI authority escalation.

## 11. Explicit non-goals

M10 does not implement:

- automatic trademark filing;
- automatic deadline certification;
- an official registry mirror presented as authoritative;
- unrestricted legal advice automation;
- automatic customer/provider outreach;
- a universal CRM;
- a replacement Matter/Order/Execution system;
- a universal data warehouse inside MarkOrbit;
- cross-service SQL;
- public professional rating or certification;
- automatic Capability verification;
- production deployment or GA by implication.

## 12. Completion gate

M10 may be recommended complete only when a real authenticated Workspace can prove that:

1. a private Trademark Asset is admitted with exact identity and provenance;
2. Workspace isolation survives direct identifier guessing and reload;
3. owner-domain truth is referenced rather than duplicated;
4. source freshness and unknown/conflicting values fail closed;
5. at least one explainable attention signal is generated from real evidence;
6. the AI Guide answers from permission-safe current context and cites exact evidence references;
7. AI suggestions remain non-executing until an explicit user/owner-domain transition;
8. desktop and mobile Asset Workspace journeys work without canonical route interception;
9. durable Product feedback remains separate from Capability verification and external truth;
10. existing M1-M9 authority locks remain intact.

## 13. Authorization consequence

The owner's current instruction authorizes continuous repository engineering and PR merge after bounded checks are green. This scope does not authorize production deployment, GA, external filing/publication/outreach, paid execution or weakening protected-action gates.
