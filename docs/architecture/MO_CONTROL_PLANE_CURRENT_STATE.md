# MO Control Plane Current-State Audit & Product Boundary

Issue: #736  
Parent Epic: #735  
Baseline: `main@8440ebbd27c3718633d951d7231af0d9d7b910a9`

## Decision summary

MarkOrbit already has multiple real admin/operator products and mature owner-side governance primitives, but it does **not** yet have one coherent platform control plane.

The accepted direction is:

> **MO Control Center = one governed internal operator product, many owner truths.**

The Control Center may unify navigation, state explanation, bounded owner reads and approved owner commands. It must not create a super-admin database, cross-service SQL layer, generic catch-all proxy, browser-visible service credentials or arbitrary status/config editors.

The target interaction grammar is:

`Observe -> Understand -> Govern -> Act -> Audit`

not CRUD.

---

# 1. CURRENT ADMIN / OPERATIONS INVENTORY

| Surface / capability                    | Current classification                        | Current evidence                                                                                                                                                                                       | Control Center decision                                                                                                          |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/operations-console/**`            | `PRODUCTIZED_PARTIAL`                         | Real Evidence Review and Lifecycle Provenance flows are implemented. `main.tsx` mounts `OperationsApp`.                                                                                                | `REUSE_IN_SHELL`; becomes the primary Control Center product shell if first implementation slice validates the fit.              |
| Operations overview cards               | `STATIC_PLACEHOLDER`                          | `App.tsx` hard-codes Gateway/Execution badges and counts such as Retryable `3`, Blocking `1`, Awaiting reviewer `7`, Processed today `1,248`.                                                          | Must not be presented as production truth. Replace with explicit unavailable/unknown state or real owner-backed projections.     |
| `CommercialAdminWorkspace`              | `IMPLEMENTED_NOT_MOUNTED`                     | `apps/operations-console/src/commercial-admin.tsx` contains Internal Operator sign-in/session resolution and owner-routed inspection for Accounts, Catalogue, Orders, Payments, Matters and Providers. | First implementation candidate: mount into the Control Center shell without changing owner APIs.                                 |
| Global Admin browser identity           | `PRODUCTIZED_FOUNDATION`                      | #247 completed governed browser login/session, Workspace Principal and server-side authority boundary.                                                                                                 | Reuse. Do not create another Control Center identity model.                                                                      |
| Gateway commercial-admin reads          | `PRODUCTIZED_BACKEND`                         | Gateway has separate Core/MarkReg/Payment/MGSN commercial-admin route families using `INTERNAL_OPERATOR` and `commercial-admin:read`.                                                                  | Reuse. Existing permission remains commercial inspection authority, not universal Control Plane authority.                       |
| Lite Capability Center                  | `PRODUCTIZED_USER_SURFACE_NOT_CONTROL_CENTER` | `apps/lite-web/src/features/capability/CapabilityCenter.tsx` exposes one subject's private evidence/Profile/Twin/reflection state.                                                                     | Keep user-facing/private. Do not repurpose as platform-admin Capability inventory.                                               |
| Core Brain Asset Registry               | `INTERNAL_LIBRARY_ONLY`                       | Durable in-memory/PostgreSQL Brain Asset Registry exists. Core reachability audit classifies Brain Asset ACTIVE resolution as internal-only reachable.                                                 | Do not expose generic Brain HTTP. Add a bounded operator read contract only when an exact Control Center view is frozen.         |
| Core Brain Build                        | `INTERNAL_LIBRARY_ONLY`                       | Brain Build runtime exists but is not mounted in Core `main.ts`.                                                                                                                                       | Observe only through a future consumer-driven projection. Ordinary Capability runtime must not invoke Brain research/build.      |
| Core Brain Self Audit / BrainGap        | `INTERNAL_LIBRARY_ONLY`                       | Durable BrainGap registry and production-capable constructor exist; not a general route.                                                                                                               | Future Cognitive Platform read projection may surface exact gaps/blockers without creating mutation authority.                   |
| PERFORMANCE_GAP Method Improvement      | `PRODUCTIZED_BACKEND`                         | Core production reachability audit classifies existing Method Improvement admission route as production reachable.                                                                                     | Candidate for later governed status/read projection; do not infer approval from admission.                                       |
| COVERAGE_GAP Method Improvement         | `DURABILITY_GATED`                            | Existing audit identifies durability gating in the historical sequence.                                                                                                                                | Control Center must surface a blocker, never fabricate readiness or bypass the gate.                                             |
| Capability Engine governed runtime      | `PRODUCTIZED_BACKEND`                         | Runtime Capability Registry, Implementation Profiles, governed execution, observation and optional managed runtimes are production reachable where configured.                                         | High-value Cognitive Platform read source.                                                                                       |
| Runtime Capability internal routes      | `BACKEND_ONLY_OPERATOR_PRIMITIVE`             | Owner routes can import accepted Capability Canon and resolve current/exact versions.                                                                                                                  | Admission UI may come later. First build read inventory and readiness semantics.                                                 |
| Capability Implementation Profiles      | `BACKEND_ONLY_OPERATOR_PRIMITIVE`             | Registry models approved/retired profile versions, implementation key, caller products, risk ceiling, timeout, attempts and approval policy.                                                           | Strong candidate for read-only Control Center detail pages.                                                                      |
| Capability source/currentness/readiness | `MIXED_INTERNAL_ONLY_AND_NOT_BOOTSTRAPPED`    | Core reachability audit separates current runtime reachability from source-admission/currentness production proof.                                                                                     | Surface exact currentness/readiness state only; do not collapse runtime success into correctness.                                |
| Execution / evidence operations         | `PRODUCTIZED_PARTIAL`                         | Evidence Review and Lifecycle Provenance are already exposed in Operations Console through governed Gateway routes.                                                                                    | Keep under Operations. Add broader execution health only after authoritative read sources exist.                                 |
| MarkReg commercial admin                | `PRODUCTIZED_BACKEND`                         | Existing Gateway owner-routed read paths for catalogue/orders/matters.                                                                                                                                 | Reuse under Commercial.                                                                                                          |
| Payment commercial admin                | `PRODUCTIZED_BACKEND`                         | Existing Gateway owner-routed payment inspection.                                                                                                                                                      | Reuse under Commercial.                                                                                                          |
| MGSN commercial/provider admin          | `PRODUCTIZED_BACKEND`                         | Existing owner-routed provider registry inspection plus separate Provider Workspace product semantics.                                                                                                 | Commercial inspection may be reused; Provider Workspace is not Control Center.                                                   |
| `markorbit-knowledge/apps/admin`        | `SPECIALIST_ADMIN_EXTERNAL_REPO`              | Dedicated Next.js admin includes Dashboard, Knowledge, Jobs, Runs, Discovery, Connectors, Converters, Experts, Artifacts and related surfaces.                                                         | Keep specialist ownership. V1 Control Center should use bounded summary/deep-link federation, not duplicate the product.         |
| `markorbit-data-engine/web/admin-*`     | `SPECIALIST_ADMIN_EXTERNAL_REPO`              | Existing admin pages include System, Jobs, Domain, Packages, Raw, Search and Contacts.                                                                                                                 | Keep specialist ownership. V1 Control Center should project only the data/freshness facts required for cross-platform decisions. |
| #666 Cognitive Control Plane            | `HISTORICAL_NOT_PLANNED`                      | Closed `not_planned`; it was a narrower Core readiness projection.                                                                                                                                     | Do not reopen as-is. The new Control Plane is broader and must respect the gates that caused #666 to stop.                       |

## Key finding

The current gap is **not** absence of admin capability. It is absence of a coherent control-plane product layer that tells an operator what is true, why it is true, what is blocked, and what action is actually permitted.

---

# 2. OWNER / AUTHORITY MAP

| Area                                    | Canonical owner                | Browser/operator authority                                                                  | Current boundary                           | Mutation posture                                                       |
| --------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| User / Session / Workspace / Membership | Core                           | Core-authenticated session; `INTERNAL_OPERATOR` or Workspace Principal according to surface | #247 + Core auth/Gateway                   | Owner commands only                                                    |
| Commercial account inspection           | Core                           | `INTERNAL_OPERATOR` + `commercial-admin:read`                                               | Gateway -> Core owner route                | Read-only V1                                                           |
| Catalogue / Order / Matter inspection   | MarkReg                        | `INTERNAL_OPERATOR` + `commercial-admin:read`                                               | Gateway -> MarkReg owner route             | Read-only V1                                                           |
| Payment inspection                      | Payment                        | `INTERNAL_OPERATOR` + `commercial-admin:read`                                               | Gateway -> Payment owner route             | Read-only V1                                                           |
| Provider commercial inspection          | MGSN                           | `INTERNAL_OPERATOR` + `commercial-admin:read`                                               | Gateway -> MGSN owner route                | Read-only V1                                                           |
| Evidence Review / lifecycle provenance  | Execution/MarkReg bounded flow | Authenticated Workspace reviewer permissions in current Operations flow                     | Gateway -> owner routes                    | Existing governed mutations remain; do not broaden                     |
| Brain Asset / Build / BrainGap          | Core                           | No general Control Center permission exists yet                                             | Mostly owner library/internal construction | Read contract first; mutation deferred                                 |
| Method Improvement                      | Core                           | Exact existing internal owner authority                                                     | Core owner route/service                   | Existing command semantics only                                        |
| Runtime Capability                      | Capability Engine              | Trusted internal caller today; product invocation via authenticated Gateway                 | Capability Engine owner routes             | Read inventory first; future admission only from accepted Canon        |
| Implementation Profiles                 | Capability Engine              | Trusted internal caller today                                                               | Capability owner registry                  | Read first; later typed governed register/retire path only if required |
| Knowledge                               | Knowledge                      | Knowledge's existing admin authority model                                                  | Specialist Admin app                       | Federate summary/deep-link in V1                                       |
| Data Engine                             | Data Engine                    | Data Engine's existing admin authority model                                                | Specialist Admin web                       | Federate summary/deep-link in V1; no destructive controls              |

### Authority rule

`commercial-admin:read` is deliberately narrow. It must **not** silently become `brain:manage`, `capability:govern`, `knowledge:admin` or `data-engine:admin`.

Future Control Center permissions should be consumer-driven and action-specific, e.g. read-only cognitive inventory before any mutation vocabulary is introduced.

---

# 3. MO CONTROL CENTER V1 IA

V1 should be smaller than the final nine-section target. A truthful first product can ship with five primary sections and explicit future entries.

## V1 primary sections

### 1. Overview

Purpose: answer "what needs attention?" without fake metrics.

V1 contents:

- authenticated operator identity/status;
- known operational review queues that already have an owner-backed source;
- explicit service/data/cognitive availability states only where an authoritative source exists;
- `UNKNOWN` / `UNAVAILABLE` where no source exists.

Do **not** retain hard-coded counts or status badges.

### 2. Operations

Reuse:

- Evidence Review;
- Lifecycle Provenance;
- existing governed review actions.

### 3. Commercial

Reuse/mount:

- `CommercialAdminWorkspace`;
- Accounts/Workspaces;
- Catalogue;
- Orders;
- Payments;
- Matters;
- Providers.

No new owner API is required for the first mount slice.

### 4. Cognitive Platform

V1 begins as read-only inventory/readiness, not a CRUD editor.

Target objects:

- Brain Assets;
- BrainGap / Method Improvement blockers;
- Runtime Capabilities;
- Implementation Profiles;
- source/currentness/readiness state;
- execution/quality telemetry only when authoritative.

This section requires one or more bounded owner read contracts before production UI is added.

### 5. System & Governance

Initially:

- operator/session capabilities;
- source availability and explicit unavailable states;
- immutable provenance/audit links already available from owner payloads.

Do not invent a generic service-health authority merely for dashboard aesthetics.

## V1 federated links

### Knowledge

Use summary/deep link to Knowledge Admin until a concrete cross-platform decision requires local projection.

### Data

Use summary/deep link to Data Engine Admin until exact freshness/capacity evidence is needed in a Control Center decision.

### Network

Commercial Provider Registry inspection stays under Commercial in early V1. Broader network governance should be added only from accepted MGSN owner contracts.

---

# 4. READ-PLANE SOURCE MATRIX

| Proposed view                                                       | Current authoritative source                                                                                                               | V1 status                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Operator identity/capabilities                                      | Core session / Internal Operator resolution                                                                                                | `READY`                                |
| Evidence review queue                                               | Existing Operations lifecycle client/Gateway owner route                                                                                   | `READY`                                |
| Lifecycle provenance                                                | Existing Operations lifecycle client/Gateway owner route                                                                                   | `READY`                                |
| Commercial account/catalog/order/payment/matter/provider inspection | Existing commercial-admin Gateway routes                                                                                                   | `READY_NOT_MOUNTED`                    |
| Generic Gateway health                                              | No accepted Control Center owner health contract identified                                                                                | `EXPLICITLY_UNAVAILABLE`               |
| Generic Execution health                                            | No accepted Control Center owner health contract identified                                                                                | `EXPLICITLY_UNAVAILABLE`               |
| "Failed operations" aggregate                                       | Hard-coded UI today; no accepted aggregate source                                                                                          | `REMOVE_PLACEHOLDER`                   |
| "Processed today" aggregate                                         | Hard-coded UI today; no accepted aggregate source                                                                                          | `REMOVE_PLACEHOLDER`                   |
| Brain Asset inventory                                               | Core durable registry exists; no accepted Control Center list/read HTTP boundary                                                           | `NEW_BOUNDED_READ_CONTRACT_REQUIRED`   |
| Brain blockers/gaps                                                 | Core durable/internal primitives exist                                                                                                     | `NEW_BOUNDED_READ_PROJECTION_REQUIRED` |
| Runtime Capability current inventory                                | Capability owner registry exists; exact current route exists by capability id, but a Control Center list/read projection is not yet frozen | `NEW_BOUNDED_READ_CONTRACT_REQUIRED`   |
| Implementation Profile inventory                                    | Capability owner registry exposes `listCurrent` internally                                                                                 | `NEW_BOUNDED_READ_CONTRACT_REQUIRED`   |
| Capability execution quality                                        | Existing observation/telemetry primitives where configured                                                                                 | `DEFINE_EXACT_OPERATOR_PROJECTION`     |
| Knowledge jobs/runs/connectors                                      | Knowledge Admin                                                                                                                            | `FEDERATE_OR_DEEP_LINK`                |
| Data jobs/freshness/storage                                         | Data Engine Admin                                                                                                                          | `FEDERATE_OR_DEEP_LINK`                |

### Read-plane rule

Known absence and source unavailability are different states. The Control Center must never convert unavailable source data into a healthy/empty result.

---

# 5. COGNITIVE PLATFORM GOVERNANCE BOUNDARY

## Brain

Control Center should eventually show:

- asset identity and scope;
- version/status/effective period;
- currentness/readiness;
- build lineage;
- blockers/gaps;
- exact evidence/provenance references;
- allowed next action as calculated by owner governance.

It should **not** provide:

- free-form asset creation;
- direct status dropdowns;
- direct ACTIVE toggles;
- generic `POST /brain` CRUD;
- automatic build/admit/activate chains.

A future Brain read endpoint must be designed around an exact Control Center view. It should not expose arbitrary repository contents simply because the repository exists.

## Capability

Control Center should eventually show:

- Capability ID/version/title;
- accepted Canon lineage;
- current runtime definition;
- current Implementation Profiles;
- allowed caller products;
- risk ceiling;
- timeout/max attempts;
- approval policy version;
- source/currentness/readiness;
- usage/quality signals with exact authority labels.

The UI must preserve:

`Runtime reachable != source current != method correct != recommendation authority`.

### Capability admission

Future UI wording should use **Admit accepted Capability** rather than **Create Capability**.

Allowed flow:

`Accepted Capability Canon -> validate -> preview -> admit runtime definition -> bind approved Implementation Profile -> test/evidence -> production readiness`

No browser payload may choose hidden provider/model/credential implementation controls outside the accepted owner policy.

---

# 6. KNOWLEDGE / DATA FEDERATION DECISION

## Knowledge

Knowledge already has a substantial specialist Admin product. MO Control Center V1 should not rebuild its Dashboard/Jobs/Runs/Discovery/Connectors/Converters/Experts/Artifacts UI.

Control Center may later consume a small operator summary such as:

- overall source freshness state;
- blocked/failed jobs requiring platform attention;
- high-level security/governance alerts;
- link into exact Knowledge Admin detail.

Any such summary must be owned and produced by Knowledge.

## Data Engine

Data Engine already has System/Jobs/Domain/Packages/Raw/Search/Contacts admin surfaces.

Control Center V1 should show only cross-platform facts that influence MO decisions, such as exact freshness/availability/capacity evidence when a consumer requires it.

No destructive storage/migration/reclaim controls belong in early Control Center work.

---

# 7. CONFIGURATION / MUTATION TAXONOMY

## A. `OPERATIONAL_CONFIGURATION`

Examples: timeout, bounded batch size, retry/attempt ceiling where the owner explicitly models them as config.

Requirements:

- typed schema;
- bounds validation;
- version;
- effective time where relevant;
- actor/audit;
- rollback/replacement semantics.

## B. `GOVERNANCE_POLICY`

Examples: risk admission policy, source/currentness policy, implementation admission policy.

Requirements:

- immutable policy version;
- evidence/impact preview;
- explicit approval authority;
- effective time;
- currentness;
- audit lineage.

Not a generic Settings form.

## C. `DOMAIN_STATE_TRANSITION`

Examples: Brain Asset degrade/retire, governed promotion, Capability implementation retirement.

Requirements:

- owner-defined command;
- exact expected version/currentness/fingerprint;
- idempotency;
- reason/rationale when governance-sensitive;
- owner validation;
- append-only audit.

Never direct row/status editing.

## D. `SECRET_CREDENTIAL`

Browser may receive only:

- configured/not configured;
- reference identity if safe;
- last validation/rotation status where explicitly modeled.

Browser must not receive raw secrets/tokens/passwords.

## E. `FORBIDDEN_SUPER_ADMIN_ACTION`

- arbitrary SQL;
- cross-service row mutation;
- free-form domain JSON write;
- force ACTIVE/APPROVED/VERIFIED flags;
- bypass currentness/approval/version gates;
- direct production provider contact/filing/payment/Official Truth creation.

---

# 8. SECURITY / AUDIT REQUIREMENTS

1. Reuse #247 browser/admin identity; do not create a second admin login system.
2. Distinguish `INTERNAL_OPERATOR` from normal Workspace member/product-user principals.
3. Add new permissions only when an exact Control Center operation requires them.
4. Mutations require trusted origin + CSRF when browser-originated.
5. Governed mutations use exact expected version/currentness/fingerprint and Idempotency-Key as applicable.
6. Owner service remains final authorization authority.
7. Browser cannot submit trusted principal/actor/workspace fields as authority.
8. Raw service secrets never enter browser bundles or browser-readable responses.
9. Every governance-sensitive mutation records actor, owner object/version, reason, result and provenance.
10. Control Center must display `UNKNOWN`, `STALE`, `BLOCKED`, `DEGRADED` and `UNAVAILABLE` truthfully rather than defaulting to green.

---

# 9. PRODUCT / UX GAPS

## P0 gaps

### Static fake overview

The existing Overview visually implies operational truth with hard-coded statuses/counts. This is the highest-priority truth defect in the current Control Center candidate.

### Commercial surface is orphaned

A useful Commercial Admin UI already exists but is not mounted by `main.tsx` / current shell navigation.

### No coherent operator IA

Operations, commercial inspection and future cognitive governance do not share one navigable operator product.

### Cognitive backend maturity exceeds UI maturity

Brain/Capability governance objects exist but are not intelligible to operators without code/database/issue context.

## P1 gaps

- no unified blocker/readiness explanation pattern;
- no shared exact status semantics for unavailable/stale/unknown across owner sources;
- Knowledge/Data specialist admin federation not formalized;
- no Control Center-specific cognitive read permissions/contracts;
- no governed configuration/policy UI taxonomy implemented.

---

# 10. PROPOSED P0 / P1 BACKLOG

## P0-001 — Truthful Control Center shell + mount Commercial Admin

**Goal:** turn the current Operations Console shell into the first truthful MO Control Center slice without new owner APIs.

Scope:

- brand/navigation becomes `MO Control Center`;
- mount the existing `CommercialAdminWorkspace` as a real section;
- preserve Operations Evidence Review/Lifecycle flows;
- remove or replace static fake overview metrics with explicit `Not connected / Unavailable / No authoritative source` states;
- show current Internal Operator authority where the existing commercial surface resolves it;
- add focused UI/tests for navigation and truth states.

No Gateway/domain change unless a concrete missing existing route is proven.

## P0-002 — Cognitive Platform read contracts

Freeze and implement the smallest owner-produced read projections for:

- Brain Asset/readiness/blocker inventory from Core;
- Runtime Capability + Implementation Profile inventory from Capability Engine.

No mutation.
No generic Brain endpoint.
No cross-service aggregation database.

## P0-003 — Cognitive Platform Control Center UI

Consume P0-002 in read-only pages with explicit lineage/currentness/blockers and known absence vs unavailable states.

## P1-001 — Knowledge / Data federation summaries

Add owner-produced bounded summaries and deep links only where platform operator decisions need them.

## P1-002 — Governed configuration and action framework

Introduce typed action confirmation/impact/audit UX, then enable one low-risk owner action at a time.

## P1-003 — System / governance history

Unify operator-visible audit/provenance links and source availability without inventing a universal truth store.

---

# 11. FIRST IMPLEMENTATION TASK — EXACT OWNERSHIP / PATHS

The first implementation slice should be **P0-001: Truthful Control Center shell + mount Commercial Admin**.

## Primary owned paths

- `apps/operations-console/src/App.tsx`
- `apps/operations-console/src/main.tsx`
- `apps/operations-console/src/commercial-admin.tsx` only if small composition/adaptation is required
- `apps/operations-console/**` focused tests/stories/styles as needed
- `apps/operations-console/README.md`

## Read-only references

- existing Gateway commercial-admin route implementations;
- Core auth/Internal Operator contracts;
- `@markorbit/ui` components.

## Forbidden by default

- owner service changes;
- new database/migration;
- new shared permission vocabulary;
- cross-service SQL;
- generic service health endpoint;
- Brain/Capability mutations;
- root config/lockfile unless repository mechanics genuinely require it.

## Acceptance for first slice

1. product brand/navigation clearly identifies `MO Control Center` as internal-only;
2. Operations review/lifecycle functionality remains reachable;
3. Commercial Admin is reachable from the same shell and continues to use owner-routed authenticated reads;
4. hard-coded production-looking health/count values are removed;
5. unavailable/unknown operational state is explicit and not visually represented as healthy;
6. no new authority is created;
7. focused typecheck/lint/test/build and applicable exact-head CI are green.

---

## Final audit conclusion

MO should build a large internal Control Center, but it should **not** build a large centralized admin backend.

The safest and highest-value sequence is:

1. make the current Operations Console truthful;
2. mount the already-existing Commercial Admin surface;
3. add exact read-only cognitive owner projections;
4. federate specialist Knowledge/Data admin rather than duplicating it;
5. only then introduce one typed, auditable governed action at a time.

This keeps MarkOrbit's existing owner/authority architecture intact while turning the platform into something an operator can actually understand and run.
