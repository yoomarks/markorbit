# MO Trademark Lifecycle LCR-A0 — Owner, Contract, Rule Pack and Handoff Scope Lock

- **Task ID:** LCR-A0
- **Status:** FROZEN
- **Product Owner approval:** 2026-10-10
- **Repository:** `yoomarks/markorbit`
- **Baseline:** `2d9c2d25008eb3edf790165377379561886382a6`
- **Primary product surface:** MO Lite Trademark Asset Workspace
- **Durable projection owner:** MarkReg
- **Approval authority:** Product Owner
- **Related product decisions:** D-025, D-029, D-032, D-039
- **Runtime consequence:** NOT_ADMITTED_BY_THIS_DOCUMENT
- **Expected PR title:** `docs(product): lock trademark lifecycle LCR-A0 contract boundary`

## 1. Objective and user-visible outcome

LCR-A0 converts the approved D-039 product direction into a detailed, reviewable contract boundary before runtime implementation.

The WS-1.0 user-visible outcome remains:

```text
open an admitted trademark asset
-> understand the current lifecycle stage
-> distinguish facts, reviewed timing, rule windows and predictions
-> see the next relevant item without treating registration as the endpoint
-> inspect exact source, currentness, conflict and limitation evidence
-> explicitly enter an eligible existing workbench when preparation is required
```

The same exact projection supplies the compact list cue and the two-layer asset-detail rail. The list must not calculate a second answer.

LCR-A0 is a product/contract audit only. It does not implement a Rule Pack, service, database table, API route, UI change, Capability, Method package or external action.

### 1.1 Repository task shape

- **Allowed paths for this task:** this scope lock plus the narrow Trademark Lifecycle wording corrections in `docs/product/MO-VERSION-ROADMAP.md` and `docs/product/MO-MVP-1.0-ACCEPTANCE.md`.
- **Contracts consumed:** existing Trademark Asset identity/source/composition/management, `DomainPackV1`, Brain Method, Capability runtime/exposure, Work/Matter and Execution contracts are audit evidence only.
- **Contracts changed:** none. `TrademarkLifecycleProjectionV1` is specified here for the next independently admitted contract task.
- **Events emitted or consumed:** none. A milestone in the projection is data, not an integration event.
- **State mutation:** none outside these documentation files.

## 2. Canonical sources and authority note

This scope lock is derived from the repository's current authoritative projections:

- `AGENTS.md` Capability and ownership locks;
- `docs/product/MO-PRODUCT-CONSTITUTION.md`;
- D-025 and D-039 in `docs/product/MO-PRODUCT-DECISION-LOG.md`;
- `docs/product/MO-VERSION-ROADMAP.md`;
- `docs/product/MO-MVP-1.0-ACCEPTANCE.md`;
- `docs/architecture/DOMAIN-PACK-STANDARD-V1.md`;
- existing shared contracts for Trademark Asset, asset composition, asset management, Domain Pack, Brain Method, Capability runtime and external Capability exposure;
- the current non-canonical high-fidelity Lifecycle Rail prototype as experience evidence only; D-039 approves the direction, not the fixture model as a production contract.

Books 01–07 and the accepted Capability Canon are referenced by repository policy but their exact source artifacts are not stored in this checkout. On 2026-10-10, the Product Owner explicitly froze this exact LCR-A0 scope and confirmed that the repository decisions listed above are the current controlling projection for this module. A later superseding exact source/version requires an explicit change decision; it cannot silently alter this boundary.

## 3. Three-director ruling

### 3.1 Product Director

- Trademark Lifecycle is a core, owner-backed, read-only asset-management projection, not a percentage progress bar.
- WS-1.0 includes a compact list cue and a two-layer per-asset rail.
- US, EUIPO, Singapore, the Philippines and China are five independent 1.0 targets, not five blanket runtime approvals.
- `PROJECT_TRADEMARK_LIFECYCLE` / `trademark.lifecycle.project` remains a Stable Outcome candidate until normal Capability Canon and runtime admission.
- Portfolio Timeline and 30/60/90-day aggregation remain MR-1.5 dogfood / WS-2.0 candidates; comparative Lifecycle Intelligence remains WS-3.0.

### 3.2 Experience Director

- The production contract must not copy the prototype's fixture view-model.
- Availability, coverage, currentness, conflict, process position, time assertion and action/access are independent dimensions.
- Unknown or conflicting position must not produce a false current milestone or `aria-current`.
- Desktop and mobile consume the same semantic projection; responsive layout changes presentation, not meaning.
- The projection and the current actor's interaction access are separate response layers.

### 3.3 Technical Director

- MarkReg owns the durable product projection and professional lifecycle semantics.
- Lite owns the Workspace asset anchor and presentation, not lifecycle truth.
- Existing M5 Formal Matter evidence lifecycle is an exact source pattern only; it must not be renamed or extended into the asset-level legal lifecycle.
- Existing `DomainPackV1`, Brain Method, Capability runtime, source-reference, asset-management and protected-execution contracts must be reused.
- A0 adds no migration, Registry or integration event. Later persistence must be a separately bootstrapped, migration-sensitive task.

## 4. Ownership and authority matrix

| Concern                                                         | Owner                                | Lifecycle use                                                                                                         | Forbidden consequence                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| User, Workspace, Membership, permission and Entitlement         | Core                                 | Supplies current actor and access context                                                                             | MarkReg or Lite cannot infer or persist membership authority                                                             |
| Workspace private Trademark Asset anchor                        | Lite                                 | Supplies the strongest exact asset reference its current contract supports and private notes/tags                     | Does not become official registry or lifecycle truth                                                                     |
| Professional lifecycle semantics and durable product projection | MarkReg                              | Selects the exact track, validates owner inputs and retains immutable projection versions                             | Does not create Official Truth, certify a legal deadline or authorize execution                                          |
| Official/public registry facts                                  | Data Engine or admitted source owner | Supplies source-recorded facts and complete-read state                                                                | Absence/unavailability cannot become a negative fact                                                                     |
| Documentary sources and provenance                              | Knowledge                            | Supplies exact documentary source material, version and provenance                                                    | Does not decide a case-specific lifecycle result or absorb evidence authority owned by Data Engine, MarkReg or Execution |
| Governed temporal method                                        | Brain, if admitted                   | Supplies an exact ACTIVE Method/package and applicability                                                             | Does not own case truth or formal Product state                                                                          |
| Deterministic computation                                       | Capability runtime, if admitted      | Executes the admitted contract and returns typed evidence-bound output                                                | Does not own Membership, projection persistence or protected action authority                                            |
| Work, Matter and professional review                            | Their existing owners                | Supplies exact references and receives explicit handoff                                                               | Rail selection cannot create or advance them automatically                                                               |
| External/protected action and receipt                           | Execution                            | Revalidates and authorizes any later protected action                                                                 | A projection or CTA cannot bypass authorization/release                                                                  |
| Authorized composition                                          | Gateway                              | Orchestrates Core and destination-owner decisions, then returns the read result plus actor-scoped interaction overlay | Cannot invent authorization policy or turn dependency failure into an empty lifecycle                                    |
| Rail/list presentation                                          | Lite UI                              | Renders, expands, selects, focuses and deep-links                                                                     | Cannot calculate milestones, dates, confidence, completion or CTA eligibility                                            |

No cross-service database read or foreign key is allowed. Every cross-owner dependency uses a versioned contract and exact reference.

## 5. REUSE / EXTEND / BUILD / HOLD

| Disposition               | Surface                                                                                  | LCR-A0 ruling                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| REUSE                     | `TrademarkAssetSourceReference` and owner-supported asset identity/version               | Use each owner's strongest exact reference; do not claim a fingerprint where its contract has none                           |
| REUSE                     | Trademark Asset composition conflict-preservation                                        | Keep competing owner facts visible; do not silently choose a winner                                                          |
| REUSE                     | Trademark Asset Management Signal / Recommendation / Handoff                             | Reference owner-backed attention and explicit handoff; do not create a third mutable action truth                            |
| REUSE                     | `DomainPackV1`                                                                           | Use only as the upper-level manifest of exact owner references; it is not executable or admission proof                      |
| REUSE                     | `MethodApplicabilityV1`, Capability request/outcome and external-exposure policy         | Use only after the candidate Capability/Method has been independently admitted                                               |
| REUSE                     | Existing workbench, Work, Matter, professional-review and Execution gates                | Preserve current owners and explicit review/authorization                                                                    |
| EXTEND                    | Shared contracts                                                                         | Add renderer-agnostic read-result/projection contracts only through an independently admitted A1 task after A0 approval      |
| EXTEND                    | Lite-internal source-read vocabulary                                                     | Promote its semantics and strict parser to a shared owner in A1, then make Lite import it; do not copy the enum into MarkReg |
| EXTEND                    | Gateway composition                                                                      | Return actor-scoped interaction access separately from the semantic projection                                               |
| EXTEND                    | MarkReg persistence and read model                                                       | Later task only; retain immutable versions and an exact current head                                                         |
| EXTEND                    | Management handoff / Work Package origin context                                         | Existing contracts do not yet carry lifecycle projection/milestone lineage; extend them before runtime handoff               |
| ADMISSION_REQUIRED / HOLD | Five jurisdiction/authority/procedure Rule Pack scopes                                   | An exact branch may move to BUILD only after its source, Method, reference, reviewer and degradation admission               |
| HOLD                      | Portfolio Timeline, upcoming-actions aggregation and comparative intelligence            | Keep on their approved later-version paths                                                                                   |
| HOLD                      | New event bus, global Rule Registry, lifecycle fact store or front-end country timelines | No verified need; explicitly prohibited in the first runtime slice                                                           |

## 6. Stable vocabulary

LCR-A0 locks the following meanings:

- **Lifecycle Track:** one exact asset plus jurisdiction, authority/office, procedure and applicable basis. One asset may have multiple tracks.
- **Lifecycle Stage:** a stable, coarse user-facing grouping such as filing, examination, publication, registration or maintenance.
- **Milestone:** a Rule Pack-defined procedural point inside a track.
- **Today Cursor:** the independent position of the projection's `asOf` time; it is not the current procedural milestone.
- **Current Position:** the current stage/milestone only when supported without unresolved conflict.
- **Last Undisputed Position:** optional historical position shown separately when current position is unknown or conflicting.
- **Time Assertion:** one typed statement about an exact date, interval, rule window, prediction or typical range.
- **Attention / Recommendation:** owner-backed guidance that may be displayed by the rail; it is not formal state or execution authority.
- **Interaction Access:** current actor-scoped permission, Entitlement, currentness and dependency result for an inspection or handoff target.
- **Rule Pack:** the product term for one independently admitted lifecycle scope, expressed by an exact ACTIVE `TEMPORAL_RESOLUTION` executable Method package plus exact materialized reference/source dependencies. `DomainPackV1` may reference that scope as an upper-level manifest; it is not executable logic, an admission receipt, a Registry or a truth object.

The neutral phrase **next relevant item / 下一事项** is used unless the referenced object is an actual Formal Matter. `phase` is not used as a synonym for `Lifecycle Stage` in contracts.

## 7. Proposed production contract boundary

The renderer-agnostic durable product result is named:

```text
TrademarkLifecycleProjectionV1
```

The authorized query wrapper is named:

```text
TrademarkLifecycleReadResultV1
```

`TrademarkLifecycleRail` remains the UI component name. `TrademarkLifecycleRailProjectionV1` is not a second contract. The read result carries resource/selection/dependency/coverage state, candidate tracks and a nullable projection; authorized response composition attaches the separate actor-scoped interaction overlay. Only a successfully selected exact track can have a `TrademarkLifecycleProjectionV1`.

### 7.1 Projection envelope

The future strict contract must contain:

- projection ID, schema version, immutable projection version and fingerprint;
- exact Workspace and the strongest owner-supported Trademark Asset reference, normally ID/version and a fingerprint only where that owner contract supplies one;
- required fingerprint of the complete normalized computation input snapshot;
- generated-at and semantic `asOf` timestamps;
- exact selected Lifecycle Track identity;
- owner-selected `nextRelevantItem`, `primaryTimeAssertionRef` and recommendation-evaluation result so the list and detail UI do not recalculate them;
- ordered stages and milestones with stable codes and governed localization keys or complete Chinese/English user-visible semantics;
- exact source, Rule Pack, Method, Capability invocation/outcome and owner-object references when used;
- independent next-item, recommendation and primary-time evaluation results;
- coverage, source-read state, currentness, conflicts, missing inputs and limitations;
- fixed authority assertions showing that the projection does not create Official Truth, certify a legal deadline or authorize execution.

Every used value must be traceable at the strongest granularity supported by its owner contract: owner/type/ID/version are mandatory where available, while a source fingerprint is required only when that contract supplies it. MarkReg's normalized complete input snapshot and final projection each require their own fingerprint. A source, Rule Pack, Method, professional review or material input change produces a new projection version and explainable diff; history is not overwritten.

### 7.2 Track selection

One projection version binds one exact selected track. The read result, not the projection, carries selection state and candidates. A track separately identifies:

- jurisdiction;
- authority/office;
- object and procedure;
- application/registration basis where applicable;
- related owner records by exact reference.

The read result uses `SELECTED | MULTIPLE_CANDIDATES | MISSING_INPUT | UNSUPPORTED`. Only `SELECTED` may include a projection. Every other state carries reason codes and `projection: null`; multiple candidates are returned without silently selecting the first record, merging unrelated procedures or showing a fabricated single rail.

### 7.3 Ordered semantic structure

Each stage and milestone must carry:

- stable code and order;
- governed localization keys or complete Chinese and English semantics for the accessible name, current/next summary, time label, limitation/conflict explanation, recommendation explanation and access reason;
- process position from the common state axis;
- zero or more typed time assertions;
- exact source and Rule Pack references;
- applicable missing-input, conflict and limitation reason codes;
- optional owner-backed attention/recommendation reference;
- optional typed evidence-inspection or workbench destination descriptor.

Jurisdiction-specific milestone codes belong to admitted Rule/Method packages. A0 does not attempt to canonize every global legal event.

### 7.4 Actor-scoped interaction overlay

The projection itself does not answer whether a particular viewer may click **开始准备 / Start preparation**. Gateway orchestrates Core authentication/permission/Entitlement truth with the destination owner's operation eligibility/currentness result and returns a separate, non-persisted `interactionAccess` overlay for the current request context. Gateway does not own either policy.

For each available interaction it must include:

- exact projection and track references plus milestone, recommendation or other owner-object references required by that intended operation;
- typed destination and intended operation;
- `ALLOWED`, `DENIED`, `REAUTH_REQUIRED`, `REFRESH_REQUIRED` or `DEPENDENCY_UNAVAILABLE`;
- machine-readable reason codes;
- evaluated-at and applicable permission/Entitlement policy version;
- `executionAuthorized: false`.

`ALLOWED` means only that the actor may perform the named bounded navigation, evidence-inspection or preparation-entry operation. It is not protected-action authorization. The destination revalidates actor, permission, Entitlement, exact references, currentness, destination eligibility and idempotency at submission time. A stale overlay never grants access.

### 7.5 Computation input/output versus durable projection

If the candidate Capability path is admitted, A1/A2 must separately define strict transient `TrademarkLifecycleComputationInputV1` and `TrademarkLifecycleComputationOutputV1` contracts.

- The input contains the normalized exact asset/source snapshot and required input fingerprint.
- The output contains typed stages, milestones, time assertions, reason codes, exact Method/materialized-reference dependencies and required output fingerprint.
- Neither transient contract has a Product projection ID/version/head or retention authority.
- Capability cannot persist or select the current Product projection.
- MarkReg creates `TrademarkLifecycleProjectionV1` only after revalidating lineage, currentness, admission and the unchanged input snapshot.

## 8. Independent state axes

The future strict parser must reject impossible or overloaded combinations. At minimum, the following axes remain separate.

### 8.1 Query, identity, resource and dependency state

The client query state is `LOADING | SUCCESS | RETRYABLE_ERROR | OFFLINE`. The global Shell may render unauthenticated, expired-session and offline experiences, but those states remain required acceptance fixtures for this journey. Loading is never represented by an empty domain projection.

The external read response is a strict discriminated union, not freely combinable authentication, authorization and resource fields:

- `UNAUTHENTICATED`, `SESSION_EXPIRED`, `FORBIDDEN`, `NOT_FOUND` and transport-error branches carry no resource-existence flag, track candidate, coverage, projection or interaction overlay;
- only `AUTHORIZED_FOUND` may carry lifecycle read data, with an independent dependency state of `AVAILABLE | DEGRADED | UNAVAILABLE`;
- the external transport may fold forbidden/not-found responses according to the existing anti-enumeration policy.

A1's strict parser and tests must enumerate legal branches. A client must never receive a combination such as forbidden plus found that reveals a protected asset's existence.

### 8.2 Projection availability

```text
AVAILABLE | NO_PROJECTION
```

An admitted asset with no current projection returns an authorized read result with `projection: null`, explicit selection/dependency reason and an independent coverage state. It does not mean lifecycle complete or no action required. A last-known projection may remain `AVAILABLE` while its independent dependency/currentness state is degraded or stale.

### 8.3 Coverage

```text
FULL | PARTIAL | LIMITED_MANUAL | NOT_COVERED
```

Coverage describes the exact selected or candidate scope, never the readiness of an action. `FULL` is legal only for the exact admitted jurisdiction + authority + procedure + basis branch and its declared source/read scope.

### 8.4 Source currentness

```text
CURRENT | STALE | UNKNOWN
```

A last-known projection may remain visible during stale, partial or dependency-unavailable conditions with its `asOf` and warning, while affected interactions are suppressed.

### 8.5 Conflict state

```text
NONE | RESOLVED | UNRESOLVED
```

Conflict is not freshness. Each conflict retains the competing exact references, affected field/milestone, resolution owner and any resolution receipt. An unresolved conflict blocks only the dependent current position, assertion or interaction; it must not be hidden by a newer timestamp.

### 8.6 Current position support state

```text
SUPPORTED | UNKNOWN | CONFLICTING
```

`SUPPORTED` requires exactly one current stage and a `currentGranularity` of `STAGE_ONLY | MILESTONE`. `STAGE_ONLY` requires a null current milestone and zero `CURRENT` milestones. `MILESTONE` requires exactly one current milestone inside the current stage. `UNKNOWN` or `CONFLICTING` requires both references to be null and zero `CURRENT` stages/milestones, and cannot emit `aria-current`. `lastUndisputedPosition` is separate and cannot be styled as current.

### 8.7 Stage and milestone process state

```text
OCCURRED | CURRENT | UPCOMING | FUTURE | UNKNOWN | NOT_APPLICABLE
```

`OCCURRED` means reconciled as having happened for this exact track. `CURRENT` means the one supported procedural position and is unrelated to date proximity. `UPCOMING` means the owner-selected next procedural candidate, not the milestone nearest the Today Cursor. `FUTURE` means a later admitted topology node after that next candidate. `UNKNOWN` means evidence is insufficient. `NOT_APPLICABLE` is excluded by the exact track and does not participate in current/next selection, action or default rendering.

For a supported `MILESTONE` track version, `currentStageCode`, `currentMilestoneCode`, the sole current stage and the sole `CURRENT` milestone must cross-reference one another. Multiple current milestones are invalid unless a later contract models parallel tracks as separate projections.

### 8.8 Time assertion class

```text
SOURCE_RECORDED
REVIEWED_TIMING
RULE_WINDOW
PREDICTION
TYPICAL_RANGE
```

Time assertion value state is separately `AVAILABLE | UNKNOWN | CONFLICTING`. Each available assertion defines its semantic role, ISO value or interval, precision, jurisdiction time zone, inclusive/exclusive endpoints, `asOf`, exact authority/source and currentness. Month-level or range predictions cannot be converted into a fabricated exact day. `REVIEWED_TIMING` remains non-certified and keeps `legalDeadlineCertified: false`.

Only `PREDICTION` may carry calibrated probability/confidence. A numeric value is forbidden unless its calibration method/version and evaluation state have been admitted. Confidence never upgrades a prediction into official fact or deadline.

The current repository has no owner contract that can produce a certified legal-deadline receipt. A future `PROFESSIONALLY_REVIEWED_DEADLINE` assertion class is blocked until a separately admitted owner contract, professional responsibility, review receipt and revocation/currentness path exist. A1's production parser must reject that class.

### 8.9 Shared source-read state for negative facts

```text
OBSERVED | EMPTY | NOT_OBSERVED | NOT_COVERED | UNAVAILABLE
```

The current semantics exist only inside Lite observation admission and are not yet a shared contract. A1 must promote this vocabulary and strict parser to the appropriate shared contract owner, then change Lite to import it; MarkReg must not depend on Lite service source code or copy a same-named enum. Every projection also retains each source owner's original read state and exact reference.

Zero or “none received” is legal only for exact-scope `EMPTY` with acceptable currentness plus complete source and `asOf` evidence. `OBSERVED` carries actual returned facts. Every other state renders uncertainty or limitation, never zero. Aggregate partiality belongs to the independent coverage axis.

### 8.10 Next-item, recommendation and primary-time evaluation

```text
PRESENT | COMPLETE_NONE | PARTIAL | UNAVAILABLE
```

The common result vocabulary is used on three separate fields:

- `nextItemEvaluation`: `PRESENT` requires an owner-selected exact `nextRelevantItem` target reference;
- `recommendationEvaluation`: `PRESENT` requires an owner-backed recommendation reference, while a procedural next item may legitimately have `COMPLETE_NONE` here;
- `primaryTimeEvaluation`: `PRESENT` requires one exact `primaryTimeAssertionRef`, while a known next item may legitimately have `COMPLETE_NONE` when no primary time applies.

`COMPLETE_NONE` is allowed only when that exact admitted evaluation completed for the declared scope. `PARTIAL` and `UNAVAILABLE` never render as “no action”, “no date” or “all clear”. The UI consumes these independent results; it does not choose the next milestone, recommendation or primary date itself.

### 8.11 Attention, disposition, timing and access

These are separate:

- attention/urgency from the owner-backed recommendation;
- temporal relation derived from an exact typed time assertion and projection `asOf`;
- user disposition such as open, acknowledged, dismissed or suppressed, owned by the existing recommendation system;
- current actor interaction access from Gateway composition.

`OVERDUE` is not a page state and is not proof of a legal conclusion. It may be displayed only as a derived temporal condition whose underlying time assertion and authority are visible. Missing recommendation does not mean “no action required.”

## 9. Time, deadline and prediction rules

1. A source-recorded date is shown as recorded by its owner and is not silently interpreted as a deadline.
2. The first runtime may not label a value as a certified legal deadline because no admitted owner contract currently produces that receipt. If one is separately admitted later, the Lifecycle projection may reference its exact field/receipt but still cannot certify it itself.
3. A Rule Pack window states what the admitted rule calculates, including inputs, effective window and limitations; it does not claim that all case facts are known.
4. A prediction is optional. The page and list cue must remain useful when predictions are omitted.
5. A typical range is general evidence, not a case promise.
6. Conflicting assertions remain visible and block a false current position or unsafe handoff.
7. Jurisdiction time zone, business-day/holiday assumptions and interval endpoint semantics are mandatory wherever they affect a window or deadline.

The existing M5 `CurrentLifecycleView` may be referenced as an owner record when relevant, but it is not the asset-level rail and does not gain official-status or deadline authority through composition.

## 10. Rule Pack admission

The five targets share one contract and admission procedure. They do not share a blanket approval.

### 10.1 Required evidence for every admitted branch

Each exact jurisdiction + authority + procedure + basis branch must prove:

1. **Applicability:** jurisdiction, authority, object, operation, procedure, basis, relevant stages, effective window and required inputs.
2. **Executable method:** one exact ACTIVE `TEMPORAL_RESOLUTION` executable Method package with supported runner, strict schema and unambiguous applicability. `METHOD_NOT_APPLICABLE`, `METHOD_SELECTION_AMBIGUOUS`, schema mismatch or unsupported runner cannot create a projection or advance the current head.
3. **Legal/source provenance:** exact Knowledge/source reference, version, effective dates and invalidation trigger. Statutory periods, grace periods and operation windows use exact materialized Capability Reference Store dependencies by default. Live Knowledge retrieval on the hot path requires separate approval, a reproducible snapshot and measured latency/cost evidence.
4. **Fact path:** exact source owner and the ability to distinguish observed empty from not observed, not covered and unavailable.
5. **Deterministic contract:** strict inputs/outputs, stable reason codes, coverage, limitations, fallback and lineage.
6. **Professional responsibility:** named review role, review receipt and the boundary for any reviewed timing. Certified deadline language remains blocked until its separate owner contract exists.
7. **Fixtures:** positive, historical-rule-version, basis-difference, boundary-day, grace-period, missing, stale, conflict, unavailable and negative-fact cases.
8. **Current production admission:** Method/package/reference/source-use admission and currentness are valid at selection, computation, persistence, read and handoff time.
9. **Degradation:** unsupported branches return partial, limited/manual, not covered or unavailable without a plausible-looking invented timeline.
10. **Cost evidence:** observed latency and full usable-output cost fit the approved release envelope.

Only the exact branch satisfying all gates may become active. Thresholds and reviewer responsibility are approved through that branch's professional and operational admission; A0 does not invent them globally or ask the Product Owner to select individual reviewers.

### 10.2 Initial five-target disposition

| Target label  | Contract identity                                       | Current A0 disposition                                                                                                   |
| ------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| United States | jurisdiction + USPTO authority + exact procedure/basis  | TARGET_LOCKED / NOT_ADMITTED_BY_A0; current Data Engine case-fact access is not lifecycle-history admission              |
| China         | jurisdiction + CNIPA authority + exact procedure/basis  | TARGET_LOCKED / NOT_ADMITTED_BY_A0; current Data Engine case-fact access is not lifecycle-history admission              |
| EUIPO         | EU trademark authority + exact procedure/basis          | TARGET_LOCKED / NOT_ADMITTED_BY_A0; reviewed-source/manual or `NOT_COVERED` until an admitted current source path exists |
| Singapore     | jurisdiction + IPOS authority + exact procedure/basis   | TARGET_LOCKED / NOT_ADMITTED_BY_A0; reviewed-source/manual or `NOT_COVERED` until admitted                               |
| Philippines   | jurisdiction + IPOPHL authority + exact procedure/basis | TARGET_LOCKED / NOT_ADMITTED_BY_A0; remains outside the D-029 Data-linked set and must not imply Data Engine currentness |

User labels may say EUIPO, but the contract must not collapse jurisdiction, authority/office and procedure into one field.

## 11. Capability and workbench handoff

### 11.1 Capability status

The stable-outcome name `PROJECT_TRADEMARK_LIFECYCLE` is a planning candidate. A0 does not create a Capability ID, version, Definition, Profile, admission or Canon entry.

If admitted later, the Capability path must:

```text
exact asset/source snapshot
-> exact ACTIVE temporal Method package and current materialized/source references
-> governed Capability request and deterministic typed output
-> MarkReg exact-lineage/currentness validation
-> immutable MarkReg product projection
-> authorized Gateway composition
-> Lite rendering
```

Capability execution has no Membership, Official Truth, projection-retention or protected-action authority. A different non-Method runtime path requires a separate architecture decision and admission; A0 does not imply one.

### 11.2 Selection and handoff

Selecting a milestone may only:

- inspect its details and evidence;
- open an existing authorized workbench with exact context; or
- begin an explicit, reviewable handoff flow when its owner contract supports one.

It must not automatically:

- create or mutate Work or Matter;
- send a message or question;
- select a legal basis, classification or professional answer;
- authorize, purchase, file, publish or execute;
- mark a milestone complete;
- convert a Provider Return into Official Truth.

Existing management handoff and service Work Package contracts do not yet carry exact lifecycle projection/milestone origin. A later contract task must extend that origin context or first create an owner-backed management signal/recommendation with equivalent lineage. Until then, lifecycle handoff is not runtime-admitted.

Any later durable handoff receipt remains owned by the destination/existing handoff system, uses an idempotency key and exact projection/milestone/recommendation references, and is confirmed through owner readback. Selection alone creates no receipt.

## 12. Required state transitions

LCR-A0 authorizes no runtime transition. A later implementation may support only transitions that preserve these semantics:

```text
source / rule / method / review change
-> compute candidate from exact snapshot
-> reject not-applicable / ambiguous / schema-mismatch / unsupported-runner outcomes
-> re-read and validate the unchanged input snapshot, source versions, Method/reference admission, currentness and authority
-> append immutable projection version
-> compare-and-set current head against the prior head version
-> expose explainable diff
```

The same idempotency key plus the same request fingerprint replays the prior result. The same key plus a different fingerprint is a conflict. A candidate that loses the compute-to-persist race remains audit evidence at most and cannot become the current head.

and:

```text
user selects eligible next item
-> Gateway composes current Core and destination-owner decisions
-> destination revalidates exact context
-> user explicitly confirms destination-owned preparation
-> destination persists its own receipt/state
-> owner readback confirms success
```

At read and handoff time, expired, revoked or degraded Method/reference/source-use admission causes the read result to classify the referenced current head as last-known/degraded and suppress affected interaction access; the read path does not mutate the head. Only a separate idempotent MarkReg command protected by validation and compare-and-set may advance or replace the current head. History remains inspectable. The projection never transitions official status, Matter, Work, professional review, Capability verification or Execution authorization.

## 13. UI and accessibility states

The D-039-approved interaction direction remains valid. The current high-fidelity prototype is non-canonical experience evidence and remains subject to the production contract above.

Required fixture-backed states are:

- ready/current;
- loading;
- retryable/recoverable error and offline;
- unauthenticated and expired session, whether rendered locally or by the global Shell;
- authorized asset with no projection;
- partial coverage;
- limited/manual coverage;
- stale last-known projection;
- conflicting sources;
- unknown current position;
- dependency unavailable;
- not covered;
- forbidden/not found without identity leakage;
- action available, denied, reauthentication required and refresh required;
- complete evaluation with confirmed no current next item;
- handoff stale/conflict failure, destination failure and owner-readback success;
- exact-scope `EMPTY` zero negative fact versus every other source-read state;
- prediction omitted;
- long Chinese and English content.

Required behavior:

- desktop uses the concise two-layer rail;
- 390px and Mini Program use a semantically equivalent vertical/collapsible presentation;
- the rail uses ordered-list semantics matching the projection order;
- stage and milestone selection works by pointer and real Tab + Enter/Space keyboard paths;
- `aria-pressed` expresses only the selected detail control, while `aria-current` appears only on the supported current process node;
- focus returns predictably after closing details;
- controls have at least 44px mobile targets;
- status never depends on color alone;
- no false `aria-current` is emitted for unknown/conflicting position;
- source class, prediction, warning, limitation and CTA names are announced meaningfully;
- success and error feedback is announced without stealing focus, and reduced-motion preference removes non-essential motion;
- 200% and 400% zoom, long bilingual text and all adverse states remain usable.

## 14. Persistence, transport and events

### 14.1 A0 boundary

- no database migration;
- no shared-contract TypeScript implementation;
- no new HTTP route;
- no outbox or integration event;
- no front-end fixture promoted to canonical runtime data.

### 14.2 Later runtime constraints

MarkReg needs an asset-level immutable projection history, exact current pointer and idempotent command boundary. Existing Formal Matter lifecycle tables must not be reused because their owner key, state and evidence semantics are different. The later persistence task must use authoritative-main bootstrap with `--migration-sensitive`, avoid cross-service foreign keys and first validate the smallest schema against real read/query needs.

A milestone inside a projection is not an integration event. An event/outbox contract is added only when a verified asynchronous consumer such as notifications or Portfolio Timeline requires one.

## 15. Audit and metrics

Every produced projection must support audit of:

- normalized input snapshot fingerprint plus the strongest exact source, Rule Pack, Method and Capability references their owner contracts support;
- input and output fingerprints;
- `asOf`, generated-at and currentness;
- track selection and reason codes;
- missing inputs, conflicts, limitations and degradation;
- professional-review reference where a future independently admitted deadline label is used;
- actor-independent semantic result;
- actor-scoped interaction evaluation and destination revalidation;
- supersession and diff from the previous version.

Metrics must distinguish:

- usable current projection rate by exact admitted branch;
- partial/not-covered/unavailable/conflict rate;
- stale-source and false-zero prevention rate;
- prediction omission and calibrated-error measures where predictions are admitted;
- handoff offered, denied, stale-rejected, explicitly confirmed and owner-readback success;
- full latency and usable-output cost.

Rendering volume, clicks or generated milestone count are not proof of legal quality or Capability success.

## 16. Acceptance tests for the next admitted slices

### 16.1 Contract tests

- strict parser accepts only versioned, fully referenced projections;
- rejects duplicate supported current milestones, broken references and invalid state combinations;
- rejects `SUPPORTED` position without exactly one current stage and enforces `STAGE_ONLY` versus `MILESTONE` invariants;
- keeps next-item, recommendation and primary-time evaluation independent and rejects missing references only for the corresponding `PRESENT` field;
- rejects any certified-deadline assertion until its separate owner contract is admitted, and rejects source dates presented as deadlines;
- rejects numeric prediction confidence without admitted calibration reference;
- preserves month/range precision without fabricating a day;
- permits predictions to be absent;
- produces deterministic fingerprints for the same exact input;
- same idempotency key plus same fingerprint replays, while the same key plus a different fingerprint conflicts;
- compute-to-persist source/admission change or current-head CAS loss cannot advance the head.

### 16.2 Rule Pack tests

- each active branch passes its own golden, boundary, historical-version and degradation fixtures;
- missing, stale, conflicting and unsupported inputs fail closed;
- unadmitted branch never produces a complete-looking rail;
- only exact-scope current `EMPTY` reads may become zero/no-event; unavailable, not observed, not covered or aggregate partial reads never do;
- effective window, time zone and reviewer responsibility are asserted.

### 16.3 Owner and security tests

- Workspace isolation and direct-ID guessing are rejected;
- unauthenticated, expired-session, forbidden, not-found and transport-error branches expose no asset existence, candidates, coverage, projection or interaction data;
- only the authorized-found branch can carry lifecycle read data;
- projection is actor-independent while interaction overlay reflects current permission and Entitlement;
- access is revalidated at destination submission;
- revoked/expired/degraded Method, reference or source-use admission suppresses affected interaction on read and handoff;
- stale exact references return conflict/refresh semantics and do not repeat a POST;
- successful handoff is confirmed by durable owner readback;
- no route creates Official Truth, legal deadline certification, Matter/Work state or Execution authorization from rail selection.

### 16.4 Experience tests

- list cue and detail rail cite the same projection ID/version;
- unknown/conflicting current position has no false visual or accessibility current marker;
- actual keyboard navigation, focus return, screen-reader naming and non-color cues pass;
- 390px, Mini Program, 200%/400% zoom and long bilingual content pass without horizontal loss;
- local dependency failure does not erase the rest of the asset page;
- all adverse states have Storybook fixtures and Playwright coverage.

## 17. Validation commands for this A0 documentation task

Run from the dedicated task worktree:

```bash
pnpm format:check
pnpm task:prepush
```

The runtime task must additionally run affected contract, MarkReg, Lite, Capability, PostgreSQL/HTTP and UI checks selected by repository scope detection.

## 18. Explicit non-goals

LCR-A0 does not:

- approve runtime implementation or any jurisdiction branch;
- promise blanket five-country coverage;
- add or rename an accepted Capability;
- create a second Rule Registry, fact store, event system or legal taxonomy;
- turn M5 Formal Matter evidence lifecycle into the asset rail;
- create a universal deadline engine;
- permit live-LLM page generation or browser-side legal calculation;
- introduce percentage progress, health score or uncalibrated confidence;
- implement Portfolio Timeline, 30/60/90-day aggregation or comparative intelligence;
- change the current non-canonical high-fidelity prototype in this documentation task;
- deploy, publish, contact a customer, spend money or perform any external action.

## 19. Admission consequence and next tasks

The Product Owner explicitly marked this document's exact scope `FROZEN` on 2026-10-10 and attested the source authority described in section 2. This admits only the detailed contract boundary, not A1 implementation, runtime or a Rule Pack.

Following this approval, work proceeds as separately bootstrapped tasks:

1. **LCR-A1 — Shared semantic contracts and negative fixtures:** implement `TrademarkLifecycleProjectionV1`, `TrademarkLifecycleReadResultV1`, the privacy-safe response union, legal state combinations and the promoted shared source-read vocabulary/parser without persistence or UI rewiring.
2. **LCR-A2 — First exact Rule Pack/source admission and computation contracts:** define `TrademarkLifecycleComputationInputV1` / `TrademarkLifecycleComputationOutputV1`, then select one exact jurisdiction + authority + procedure + basis slice based on available evidence and admit its source/Rule/Method path and professional responsibility.
3. **LCR-A3 — MarkReg projection retention and authorized read:** add the smallest migration-sensitive immutable projection/current-head/idempotency path.
4. **LCR-A4 — Gateway interaction overlay and HIFI integration:** replace fixtures for the admitted slice, retain adverse states and prove Storybook/Playwright acceptance.

Every later target/branch repeats Rule Pack admission. No further Product Owner product-direction choice is required for A1 contract work, but A1 still requires its own fresh task bootstrap and implementation admission. Selecting and admitting the first legal Rule Pack slice requires its evidence/reviewer record and three-director professional/operational admission but does not reopen the five-target roadmap.
