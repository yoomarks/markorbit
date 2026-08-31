# Intake → Recommendation → Quote Production Truth V1

- Status: **Architecture / product-truth freeze for #377**
- Parent: #376
- Audited baseline: `03d6260fdb33fdf697462af34433a9bdfb9cfd8e`

## 1. Purpose

This document freezes the smallest truthful V1 boundary for moving MarkReg's early funnel toward production without converting planning artifacts into professional, commercial, filing, payment, or Official Truth by implication.

It is intentionally narrower than the Full-Lifecycle MarkReg Canon. It does not implement persistence, shared contracts, Gateway authentication, production pricing, Capability changes, or UI redesign.

Permanent authority locks remain:

- `Recommendation != authorization`
- `Recommendation != legal conclusion / Official Truth`
- `Customer selection != filing`
- `Quote != Order`
- `Quote != Payment / Invoice`
- `Confirmation != filing`
- `Order != paid`
- no AI or Capability output may independently approve, certify, submit, create Official Truth, mutate protected formal state, or execute payment

## 2. Current repository truth

### 2.1 Intake is currently process-local planning state

Current shared `IntakeCreateCommand` contains `channel`, `relationshipModel`, a small `customerIntent`, caller-supplied `actor`, idempotency and correlation IDs. `customerIntent` retains only `brandName`, `applicantCountry`, `targetJurisdictions`, and `goodsServicesDescription`.

MarkReg stores the resulting `Intake` in `InMemoryMarkRegRepository`. It is not owner-durable production truth and is lost on process restart.

MarkReg Web collects materially richer structured data:

- applicant type
- applicant name
- applicant country
- trademark type
- trademark text
- target countries
- goods/services summary
- business context
- filing goal

Today those fields live in browser `sessionStorage`; several are flattened into `goodsServicesDescription` before submission. Therefore the current backend Intake is not sufficient as a durable Business Context / Applicant / Trademark / Jurisdiction source object.

### 2.2 Early-funnel identity is not production-trusted

The authenticated MarkReg product shell has real Session / Workspace context, but the current early-funnel browser command generates `actorId` and `workplaceId` client-side. Gateway `/v1/markreg/intakes`, `/v1/markreg/quotes`, and `/v1/markreg/quotes/:quoteId/confirm` validate payload/idempotency and forward to MarkReg without resolving a Core Workspace Principal or applying the authenticated mutation/CSRF pattern used by mature MarkReg routes.

Therefore the early funnel MUST NOT be declared production-authenticated merely because the surrounding application has an authenticated account entry.

### 2.3 Recommendation is explicitly fixture-only

Current `RecommendationPackage.status` is hard-coded to `FIXTURE_ONLY`. Its three A/B/C options, rationale, assumptions, limitations, and recommendation body are deterministic fixture content. The current shared Capability request is also explicitly versioned as `0.1.0-fixture`.

The service records correlation, Capability request ID, Execution ID, and provenance references. Those are useful lineage patterns, but they do not upgrade the content itself into a production recommendation.

### 2.4 Quote is explicitly fixture-only and process-local

Current Quote:

- is derived from a deterministic fixture pricing rule
- has exact Intake and Recommendation IDs plus selected option
- carries `pricingRuleVersion`, line items, money totals, assumptions, limitations, and `validUntil`
- supports READY / CONFIRMED / EXPIRED / SUPERSEDED semantics and idempotent creation
- is hard-coded `fixtureOnly: true` in the shared contract
- is stored only in `InMemoryMarkRegRepository`

The existing stale, expiry, supersede, and idempotency behavior is valuable and should be retained in the production model, but the source and persistence are not production commercial truth.

### 2.5 Durable Customer Confirmation accepts the Quote shape, not a production-truth classification

`CustomerConfirmationService` loads the source Quote, verifies exact `pricingRuleVersion`, requires READY and unexpired status, and persists a bounded hash-protected immutable snapshot containing quote, plan, price, assumptions, and limitations.

It does **not** reject a Quote because it is fixture-only. Consequently a process-local fixture Quote can currently be snapshotted into durable Customer Confirmation when the route reaches the durable runtime.

This is a critical V1 gate: production Customer Confirmation MUST consume only an admitted production Quote version. A fixture/planning Quote must never cross the durable commercial boundary merely because it satisfies READY/version checks.

### 2.6 Mature downstream objects should be reused

Customer Confirmation, Order, Matter Draft, Formal Matter, Documents / Instructions, preparation, and later governed surfaces already preserve explicit versions and non-authority consequences. V1 should adapt the early source boundary to those mature objects rather than replace them.

## 3. V1 owner and truth matrix

The matrix uses the required columns in this order:

`OBJECT | OWNER | CURRENT_STATE | TARGET_V1_STATE | AUTHORITY_CONSEQUENCE | VERSION/FRESHNESS | PERSISTENCE_NEED | SHARED_DEPENDENCY`

```text
Workspace identity / membership / actor
| Core
| real outside early funnel; caller-supplied inside early commands
| trusted Workspace Principal only
| identity only; no professional authority
| session + membership current at command time
| Core-owned
| Gateway/Core contract wiring

Business context
| MarkReg
| browser session state; flattened into description
| structured Intake field
| customer-supplied context, not verified fact
| Intake version
| durable
| MarkReg migration + shared contract

Applicant name / type
| MarkReg case input; Core remains user/workspace identity owner
| browser session state; largely flattened/lost
| structured customer-supplied Intake fields
| not verified legal identity
| Intake version; edits create a new version
| durable
| MarkReg migration + shared contract

Applicant country
| MarkReg case input
| browser + customerIntent.applicantCountry
| structured Intake field
| input, not official domicile truth
| Intake version
| durable
| MarkReg migration + shared contract

Trademark type / representation text
| MarkReg case input
| browser; text partly retained as brandName, type flattened
| structured Intake fields
| input, not registered-mark truth
| Intake version
| durable
| MarkReg migration + shared contract

Target jurisdiction(s)
| MarkReg case input
| customerIntent.targetJurisdictions
| structured exact requested jurisdictions
| request scope, not filing
| Intake version
| durable
| MarkReg migration + shared contract

Goods / services
| MarkReg case input
| string input
| structured source text with later review lineage
| customer description, not approved classification
| Intake version
| durable
| MarkReg migration + shared contract

Filing goal
| MarkReg
| browser; flattened into description
| structured Intake field
| stated goal only
| Intake version
| durable
| MarkReg migration + shared contract

Intake submit
| MarkReg
| idempotent but process-local; untrusted caller actor
| authenticated Workspace-scoped command
| creates Intake only
| exact request fingerprint + Intake version
| durable
| Gateway auth/CSRF + contract + migration

Recommendation inputs
| MarkReg composition over Intake + referenced capability/method evidence
| Intake ref + fixture Capability/Execution refs
| exact Intake version + bounded source refs
| analysis input only
| all source versions pinned
| durable reference set
| Capability/shared contract

Recommendation output
| MarkReg product artifact
| FIXTURE_ONLY, deterministic fixture A/B/C
| immutable/versioned advisory artifact with explicit production source class
| no authorization, legal conclusion, filing instruction, or Official Truth
| generatedAt + source versions + freshness policy
| durable
| shared contract + migration + Capability

Recommendation explanation
| MarkReg
| fixture rationale/assumptions/limitations
| bounded explanation + assumptions + limitations + provenance
| explanation is not certification
| same Recommendation version
| durable with artifact
| shared contract + migration

Recommendation provenance
| source owners own source truth; MarkReg owns exact references used by its artifact
| Capability request / Execution IDs
| exact capability/method/evidence IDs + versions/fingerprint
| provenance does not confer truth
| immutable per Recommendation version
| durable references
| Capability/shared contract

Recommendation freshness
| MarkReg policy over source versions
| generated timestamp only
| explicit current/stale/superseded status derived from source/version policy
| stale artifact cannot be selected for a new Quote
| deterministic freshness check
| durable status/event or deterministic projection
| may require Capability version read

User decision / plan selection
| MarkReg
| process-local PlanSelection inside Quote response
| explicit durable selection referencing exact Recommendation version
| selection != authorization / filing
| exact Recommendation version; newer selection supersedes prior active selection
| durable
| shared contract + migration

Product / price catalog
| commercial/shared owner, not Quote
| fixture pricing rule embedded in MarkReg
| exact referenced commercial/pricing source
| catalog data != accepted quote
| source version pinned
| owner-defined
| Payment/commercial/shared contract if used

Quote
| MarkReg commercial proposal
| fixture-only, process-local
| immutable/versioned durable commercial proposal tied to exact Intake, Recommendation, and selection
| Quote != Order/Payment/Invoice
| explicit quoteVersion, createdAt, validUntil, status
| durable
| shared contract + migration; pricing source contract

Quote line items
| MarkReg snapshot of admitted pricing sources
| deterministic fixture amounts
| bounded exact money snapshot with category/source lineage
| estimate/proposal only
| same Quote version
| durable with Quote
| pricing/shared contract as needed

Quote expiry
| MarkReg
| 14-day fixture validity
| explicit validity policy; expired quote cannot confirm
| no downstream consequence beyond blocking new confirmation
| evaluated against validUntil
| durable status or deterministic evaluation
| none if local policy

Quote supersede
| MarkReg
| present for process-local quotes
| exact prior-current relationship; only current READY quote confirmable
| no automatic Order cancellation
| explicit version/status transition
| durable
| migration

Customer Confirmation snapshot
| MarkReg
| durable and hash-protected
| reuse existing durable snapshot mechanics, but admit production Quote only
| Confirmation != filing / payment
| exact quote + plan + terms versions
| already durable
| source-admission guard may require contract change

Customer Confirmation creation
| MarkReg
| authenticated mature route; source validation omits fixture classification
| reject non-production Quote source before persistence
| records customer intent only
| exact Quote version
| already durable
| contract/source classification if shared

Order handoff
| MarkReg
| durable exact Quote + Confirmation references
| reuse unchanged where source Quote is admitted production truth
| Order != Payment/Invoice/Filing
| exact Quote + Confirmation versions
| already durable
| none unless contract shape changes
```

## 4. Canonical V1 transition semantics

The early funnel is a sequence of related owner objects, not one state machine:

```text
Authenticated Workspace Principal
  -> Intake vN
  -> Recommendation vN over exact Intake/source versions
  -> User Selection vN over exact Recommendation version
  -> Quote vN over exact selection + pricing sources
  -> Customer Confirmation vN over exact current production Quote
  -> Order
```

Rules:

1. Creating Intake creates no Recommendation, Quote, Order, professional appointment, payment, or filing authority by consequence.
2. Recommendation generation must pin the exact Intake version and exact analytical/capability source versions. A new Intake version cannot silently mutate an existing Recommendation.
3. A user selection records choice among the offered options only. It is not professional approval or filing instruction.
4. Quote creation must pin exact Intake, Recommendation, selection, and pricing-source versions. It must fail closed when any required source is stale, withdrawn, superseded, incompatible, or non-production.
5. A newer active Quote for the same commercial scope supersedes the prior READY Quote; the superseded Quote remains immutable evidence.
6. Customer Confirmation must revalidate exact Quote identity, version, currentness, and production admission immediately before persisting its snapshot.
7. Customer Confirmation remains the durable decision/acceptance evidence for this V1. Do not create a duplicate generic `Decision` domain merely to satisfy Canon naming.
8. Order consumes exact durable Confirmation / Quote lineage. It does not infer Payment, Invoice, or Filing.

## 5. Production-admission gates

The UI may stop describing Recommendation / Quote as fixture or planning truth only when all applicable gates are satisfied.

### Intake gate

- authenticated Core Workspace Principal is resolved by Gateway
- mutation origin/CSRF policy is applied consistently with mature MarkReg mutations
- client-supplied actor/workplace IDs are removed from authority decisions
- structured material intake fields are preserved without lossy concatenation
- Intake is durable, Workspace-scoped, versioned, and replay-safe
- cross-Workspace reads/writes fail closed

### Recommendation gate

- shared contract is no longer hard-coded to `FIXTURE_ONLY` / fixture Capability version
- source class is explicitly production-admissible
- exact Intake version and analytical provenance are retained
- assumptions, limitations, and provenance are bounded
- freshness/staleness can be evaluated deterministically
- Recommendation cannot directly create Confirmation, Order, Matter, or protected actions

### Quote gate

- shared Quote contract can represent production truth without weakening fixture identification
- Quote is durable and Workspace-scoped
- exact Recommendation, selection, and pricing versions are pinned
- all money is integral minor units and source/version lineage is retained
- expiry, supersede, idempotency, and conflict semantics survive restart
- Customer Confirmation rejects fixture/non-production Quote sources
- `Quote != Checkout != Payment != Invoice != Order` remains explicit

## 6. Replay, stale, conflict, and version rules

- Every mutating command requires an idempotency key. Same key + same canonical payload returns the original result; same key + different material payload fails with conflict.
- Durable IDs and timestamps are server-created. Browser-generated actor/workplace IDs are never authority inputs.
- Every mutable source object uses optimistic expected-version semantics or an immutable new-version model.
- Recommendation becomes stale when an exact required Intake/source version is no longer current under its declared policy. Stale does not mean legally wrong; it means not eligible to drive a new Quote.
- Quote rejects stale, superseded, expired, or non-production source lineage. Existing Quote evidence remains readable after expiry/supersede.
- Customer Confirmation rejects stale, expired, superseded, or non-production Quote versions and never silently rebinds to a newer Quote.
- Failure after one object commits must not fabricate downstream success. Retry resumes from durable source truth.

## 7. Existing downstream contracts to reuse

The following concepts are already sufficiently strong and should not be reopened merely to productionize the early funnel:

- bounded immutable Customer Confirmation source snapshot + hash
- exact Quote version validation pattern
- acknowledgement semantics that Confirmation creates no filing/professional appointment
- Matter Draft exact Confirmation version
- Formal Matter exact Confirmation / Quote / Matter Draft lineage
- durable Order exact Quote + Customer Confirmation lineage and existing authority separation

Implementation may need adapters or source-admission guards, but not a parallel Confirmation/Order/Matter model.

## 8. Required follow-up work

### MarkReg-owned work

**Early-funnel production runtime after shared foundations land**

- introduce Workspace-scoped durable Intake, Recommendation, Selection, and Quote repositories/services
- preserve idempotency, version, expiry, and supersede behavior
- add production-source admission before Customer Confirmation
- keep implementation under `services/markreg/**` apart from approved migration/shared dependencies

**MarkReg Web truthful early-funnel transition**

- replace client-generated authority identity with authenticated context
- keep fixture banners until production gates are actually satisfied
- expose stale/conflict/replay/expiry states truthfully
- preserve structured Intake fields end-to-end
- keep implementation under `apps/markreg-web/**` after runtime/shared dependencies are ready

### Shared dependency A — early-funnel contracts

- Goal: define production-capable versioned Intake / Recommendation / Selection / Quote contracts while retaining explicit fixture classification compatibility
- Producer: Shared Contracts / Integration
- Consumer: MarkReg service and MarkReg Web
- Required contract: Workspace-scoped source/version fields, production/fixture source classification, exact provenance/freshness, durable Quote version, and selected-plan identity; existing mature Confirmation/Order consumers remain compatible or receive an additive adapter
- Requested paths: `packages/contracts/**` only as required
- Compatibility: additive/versioned; do not reinterpret existing `FIXTURE_ONLY` artifacts as production
- Acceptance: old fixture tests remain truthful; production parser rejects missing source/version/authority fields
- Risk: medium cross-service compatibility and truth-classification risk
- Blocked MarkReg work: production Recommendation/Quote runtime

### Shared dependency B — authenticated Gateway early-funnel boundary

- Goal: apply trusted Workspace Principal, permission, trusted-origin, and CSRF semantics to early MarkReg mutations
- Producer: Gateway/Core Integration
- Consumer: MarkReg early funnel
- Required contract: Gateway derives actor/workspace from current Core session/membership and forwards internal Principal; early service routes reject untrusted/spoofed authority identity
- Requested paths: `apps/gateway/**` and only necessary Core/shared auth wiring
- Compatibility: fixture/test runtime remains explicitly isolated; production does not gain unauthenticated fallback
- Acceptance: missing/foreign Workspace, spoofed actor, and bad origin/CSRF fail closed; normal authenticated same-Workspace flow passes
- Risk: high enough for Integration review because it changes security trust boundaries, but it does not change authority invariants
- Blocked MarkReg work: declaring Intake/Recommendation/Quote production-authenticated

### Shared dependency C — MarkReg owner persistence migration

- Goal: add the minimum MarkReg-owned durable schema for versioned Intake / Recommendation / Selection / Quote and command replay/audit needed by V1
- Producer: Integration with MarkReg schema design
- Consumer: MarkReg service
- Required contract: Workspace isolation, append-only or version-safe source lineage, deterministic idempotency conflict detection, Quote current/expiry/supersede indexes, and no cross-owner tables
- Requested paths: approved migration files + migration ownership map only
- Compatibility: no destructive rewrite of Customer Confirmation / Order / Matter tables
- Acceptance: empty bootstrap, repeated migration exact no-op, restart replay, cross-Workspace isolation, and stale-version behavior pass PostgreSQL acceptance
- Risk: medium schema/migration governance; destructive migration forbidden
- Blocked MarkReg work: durable early-funnel runtime

### Shared dependency D — production Recommendation source / Capability boundary

- Goal: replace fixture-only Capability semantics with a bounded production-admissible analytical source contract suitable for MarkReg Recommendation, without transferring recommendation or legal authority to Capability/AI
- Producer: Capability / Shared Integration
- Consumer: MarkReg Recommendation composition
- Required contract: exact capability/method/version/provenance identity, bounded output class, freshness/version semantics, and explicit non-authority consequence
- Requested paths: Capability/shared-contract paths only after producer audit
- Compatibility: existing fixture capability remains fixture; no silent upgrade
- Acceptance: MarkReg distinguishes production-admissible from fixture/untrusted output and fails closed on unsupported source class/version
- Risk: medium-high AI/capability truth and authority boundary
- Blocked MarkReg work: production Recommendation generation

## 9. Priority decision after this freeze

Do **not** productionize Recommendation first in isolation. It is blocked by trusted early-funnel identity, durable source truth, shared production-capable contracts, and a production-admissible Capability source.

The correct dependency order is:

```text
trusted early-funnel Workspace boundary
+ production-capable shared contracts
+ MarkReg durable early-funnel schema
  -> durable Intake
  -> production-admissible Recommendation
  -> durable Selection / Quote
  -> production-source admission into existing Customer Confirmation
  -> MarkReg Web removes fixture semantics only after runtime proof
```

While those Shared dependencies are being resolved, the MarkReg Lane should continue unblocked productization work on already-durable Order / Matter / Documents / Lifecycle / Intelligence surfaces rather than stop.

## 10. Frozen conclusion

V1 production truth is not achieved by changing labels or swapping a fixture generator for an AI/model call. It requires a trusted Workspace source, durable versioned customer inputs, explicit analytical provenance/freshness, a durable commercial Quote, and an admission gate before durable Customer Confirmation.

The mature downstream Confirmation / Order / Matter chain is reusable. The early funnel must be brought up to that trust level without broadening any authority boundary.
