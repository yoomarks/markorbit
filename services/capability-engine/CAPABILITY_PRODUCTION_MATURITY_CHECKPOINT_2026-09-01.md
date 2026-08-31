# Capability Production Maturity Checkpoint — 2026-09-01

Issue: #393

Parent: #392

First product consumer question: #388

Shared contract dependency: #385

Original audit base: `7fb6c2cf6967b2fc17aba2f47374c19e6e592e5d`

Closure revalidation main: `3318e7deffde6936ae60f986a90c10b6fd8ede36`

## 1. Executive freeze

Capability Engine already has a governed execution substrate.

A governed invocation can prove the exact accepted Capability definition and implementation.

It can also preserve request, invocation, outcome, return, receipt and method lineage.

Durable replay preserves those identities without executing the implementation a second time.

That is **not yet the same thing as a production-admissible product source**.

A historical runtime return proves what ran at that time.

It does not prove that the same source remains admissible for a later product consumption.

Therefore:

- execution success does not imply production source admission;
- historical runtime evidence remains immutable historical evidence;
- new product consumption needs a producer-owned current-source admission decision;
- products do not inspect Capability registries to recreate producer policy;
- Observation, reflection and telemetry remain non-authoritative;
- runtime failure, Coverage Gap and Method Performance Gap remain distinct;
- runtime failure does not create a Phase 7 Method Improvement trigger.

## 2. Maturity vocabulary

`PRODUCTION_ADMISSIBLE` means one bounded source is admitted for product consumption.

`PRODUCTION_RUNTIME_BUT_NARROW` means governed runtime exists without generic source admission.

`PILOT` means an accepted implementation remains bounded by explicit pilot policy.

`FIXTURE/TEST` means a surface is test-only or fixture-only.

`INTERNAL_ONLY` means a surface is for internal governance, learning, audit or operations.

`DEFERRED/UNSUPPORTED` means no truthful accepted implementation exists for the request.

## 3. Registry truth that #397 must preserve

### 3.1 Runtime Capability definitions

`RuntimeCapabilityDefinition` has no independent `ACTIVE` or `RETIRED` lifecycle.

Definitions are admitted from accepted Capability Canon projection.

A Capability identity owns an immutable version line.

`findCurrent(capabilityId)` returns the latest accepted runtime definition by version.

`findVersion(...)` preserves exact historical definition lookup.

Canon/version and Capability/version conflicts fail closed.

#397 must not invent `ACTIVE`, `RETIRED` or `SUPERSEDED` definition states.

### 3.2 Implementation Profiles

Implementation Profiles use an immutable version line.

The only current status values are `APPROVED` and `RETIRED`.

`findCurrent(implementationProfileId)` means the latest registered profile version.

A new profile version must preserve its governed lineage fields.

Runtime selection only admits an applicable latest profile with status `APPROVED`.

A latest `RETIRED` version does not fall back to an older `APPROVED` version.

The registry has no separate `CURRENT`, `SUPERSEDED` or `SUNSET` states.

#397 must evaluate current binding with these actual registry semantics.

### 3.3 Executable Method runtime

Executable Method runtime has separate package activation semantics.

Its immutable runtime source selects accepted `ACTIVE` packages for execution.

That `ACTIVE` state must not be projected onto the other registries.

## 4. Current maturity freeze

### `PRODUCTION_RUNTIME_BUT_NARROW`

- Runtime Capability registry and catalog;
- Implementation Profile registry and governed binding;
- governed Capability runtime;
- durable replay and idempotency;
- Executable Method runtime;
- request, invocation, outcome, return and receipt lineage;
- Managed AI governed runtime.

### `INTERNAL_ONLY`

- Capability audit telemetry;
- Capability Observation source and ledger;
- private reflection;
- disposition, profile and twin surfaces;
- Capability Center learning and governance surfaces.

### `PILOT`

- CN filing to preliminary-publication descriptive analytical pilot;
- CN completed-duration historical-band classification pilot;
- CN preliminary-publication objective fact discovery pilot;
- USPTO official base-application fee resolver pilot.

### `FIXTURE/TEST`

- milestone Capability request fixture.

### `DEFERRED/UNSUPPORTED`

- generic automatic fallback authority;
- unsupported applicability without an accepted source or method.

No current analytical Capability is classified `PRODUCTION_ADMISSIBLE` by this checkpoint.

## 5. Evidence behind the freeze

### Runtime Capability registry

The registry imports accepted Canon projections into immutable runtime definition versions.

Registry reachability and latest-version lookup are producer-owned implementation details.

A product must not query those details to infer source admission.

### Implementation Profile registry

Runtime selection requires an applicable `APPROVED` profile.

The profile must match Capability version, implementation kind, caller, risk and schemas.

Exact binding is strong execution provenance.

A historical profile is not proof that it remains the latest applicable approved binding.

### Governed Capability runtime

The runtime validates accepted definition, request envelope and exact implementation binding.

It emits governed request, invocation, outcome, return and session receipt identities.

That proves what executed then.

It does not issue a later product-source admission verdict.

### Durable replay

Replay returns the historical governed execution without a second implementation call.

Request conflicts fail closed and stored identities remain immutable.

`Replay != current source re-admission`.

### Executable Method runtime

Method-backed execution records the selected package and method identities.

The selected package must be `ACTIVE` at execution time.

A historical method receipt still needs producer currentness evaluation when reused later.

### Managed AI

Provider dispatch requires explicit runtime and provider-dispatch authorization.

Provider execution success remains governed execution evidence only.

`Provider success != semantic production admission`.

### Observation and reflection

Observation and reflection remain private, governed and non-authoritative.

They do not self-promote into Product Truth, Brain activation or Official Truth.

## 6. Consumer map

### MarkReg

MarkReg #388 is the first concrete product consumer need.

A profile allowing `MARKREG` proves caller eligibility only.

It does not prove that MarkReg has a production source-admission contract.

MarkReg must not inspect Capability internal registry state.

MarkReg must not create a second source-admission algorithm.

### Lite, MGSN and other products

This audit creates no new generic production analytical source contract.

Existing product uses remain bounded by their own accepted contracts.

### Capability internal learning

Internal learning may consume reviewed governed evidence.

Its contracts must preserve explicit non-authority semantics.

## 7. Producer source-admission truth

Admission is evaluated when new product consumption occurs.

This remains true even when the underlying execution completed earlier.

Admission fails closed when required evidence cannot be established.

Minimum denial conditions include:

- result is not producer-issued or runtime identity is inconsistent;
- Capability identity or version cannot be proven;
- historical definition no longer matches the required latest accepted projection;
- Implementation Profile identity cannot be proven;
- historical profile is not the latest applicable `APPROVED` binding;
- latest profile version is `RETIRED`;
- method-backed source lacks exact governed method and package lineage;
- required method or package is not admissible for the new consumption;
- required dataset, query, reference or evidence identity is missing;
- source integrity cannot be proven;
- a time-sensitive source is outside its effective window;
- source currentness cannot be proven;
- applicability does not cover the requested use;
- required source data is unavailable;
- runtime or dependency inability prevents a truthful admission decision.

Unsupported applicability or missing required data is a Coverage Gap.

It is not permission to fabricate a fallback result.

When all required checks pass, Capability may issue one bounded admission decision.

That decision may classify the exact source as `PRODUCTION_ADMISSIBLE`.

Historical evidence remains immutable even if a later admission is denied.

## 8. Minimum producer proof

A product-admissible source needs enough producer proof to reference:

1. exact Capability identity and version;
2. exact runtime definition identity and version;
3. exact implementation identity, version, key and Implementation Profile version;
4. exact method and package lineage when method-backed;
5. exact dataset, query, reference or evidence identities when applicable;
6. exact integrity fingerprints where applicable;
7. exact request, invocation, outcome, return and receipt identities;
8. explicit source class and admission class;
9. exact applicability and limitations;
10. effective, freshness and currentness evaluation;
11. assumptions and unknowns;
12. explicit semantic-safety and no-authority consequences;
13. immutable admission decision identity, version, timestamp and fingerprint.

Missing or ambiguous proof is a denial.

Missing proof never defaults to production admission.

## 9. Producer-internal state

Products should reference, not independently interpret:

- full Runtime Capability catalog rows and version history;
- full Implementation Profile registry records;
- profile version-selection mechanics;
- executable package contents and package-selection machinery;
- raw Data Engine populations or research rows;
- full Knowledge source material when a durable source reference is sufficient;
- private Observation, reflection and learning ledgers;
- provider secrets and internal Managed AI routing configuration;
- sensitive payloads when a durable evidence reference or hash is sufficient;
- retry and fallback implementation mechanics;
- raw audit telemetry not required for the bounded admission decision.

## 10. Exact answer for MarkReg #388

### 10.1 What Capability already provides

Capability provides provenance-rich governed execution and immutable replay.

Method-backed execution also proves the exact package and method selected at execution time.

Capability does not yet provide the complete current-source admission verdict required by #388.

Therefore MarkReg cannot promote an existing pilot by parsing a runtime return.

### 10.2 Why `0.1.0-fixture` remains fixture

The current early-funnel shared contract explicitly encodes fixture semantics.

#385 owns additive and versioned production-capable shared vocabulary.

Capability also lacks the generic current-source admission decision described here.

Removing only one of those limitations would still leave #388 incomplete.

### 10.3 Owner-local work before #388

P0 owner-local work is #397.

#397 must:

- implement a read-only producer-side current-source admission evaluator;
- stay under `services/capability-engine/**`;
- accept one exact producer-issued governed runtime result;
- validate immutable runtime identity and integrity;
- re-check the Runtime Capability definition with actual registry semantics;
- re-check the Implementation Profile with actual version and status semantics;
- support a bounded optional method currentness authority;
- support a bounded optional source currentness authority;
- distinguish invalid evidence from non-current binding;
- distinguish source currentness failure from Coverage Gap;
- distinguish dependency inability from Capability or Method correctness;
- preserve historical runtime evidence without mutation;
- remain transport-neutral until Integration supplies the shared vocabulary;
- emit no Product business state or Official Truth;
- emit no automatic Method Improvement trigger.

No new analytical Capability is required for #397.

### 10.4 Shared dependency #385

Integration owns the additive and versioned cross-service vocabulary.

Capability requests enough vocabulary to reference:

- producer identity;
- admission decision identity, version, fingerprint and timestamp;
- exact Capability identity and version;
- exact implementation and Implementation Profile identity;
- optional method, package, activation and evaluation lineage;
- optional dataset, query, reference and evidence lineage;
- integrity fingerprints where applicable;
- runtime request, invocation, outcome, return and receipt references;
- explicit source class and admission class;
- applicability and limitations;
- assumptions and unknowns;
- freshness, effective-state and current-source result;
- bounded denial or currentness reason;
- semantic-safety and no-authority consequences.

Exact shared type names and enums remain Integration-owned.

Capability must not create a competing cross-service wire contract.

## 11. Runtime quality and observability

Managed AI telemetry can record supplied latency, token, unit and cost fields.

There is no normalized quality record for every Capability implementation today.

That is a P1 candidate after #397 and only if operational evidence justifies it.

Deterministic replay is already strong and must keep historical semantics.

There is no generic automatic fallback authority.

Any fallback authority must be explicit policy and fail closed otherwise.

Historical results are not re-evaluated for new product consumption today.

That stale or non-current binding gap is the primary P0 addressed by #397.

A cross-service Coverage Gap vocabulary is not owned by #397.

#397 may use bounded owner-local denial semantics only.

## 12. Owner-local backlog

### P0 — #397 Current Capability Source Admission Evaluator

Allowed scope:

- `services/capability-engine/src/**`;
- `services/capability-engine/tests/**`.

Required properties:

- transport-neutral;
- read-only;
- exact producer-issued runtime evidence input;
- immutable historical evidence verification;
- actual Capability definition currentness semantics;
- actual Implementation Profile currentness semantics;
- bounded optional method and source currentness authorities;
- deterministic fail-closed denial classes;
- no cross-service database reads;
- no Product state;
- no Official Truth;
- no automatic fallback;
- no Method Improvement trigger emission.

### P1 — Runtime quality observation

Possible later work must be driven by real operational evidence.

It may normalize latency, retry class, dependency class and execution cost metadata.

It must remain non-authoritative and avoid sensitive raw payload retention.

### P1 — Coverage Gap normalization

Possible later work may normalize unsupported applicability and unavailable data.

It must not fabricate fallback output.

It must not equate Coverage Gap with Method Performance Gap.

Shared cross-service vocabulary remains Integration-owned.

## 13. Brain Research and Phase 7

A requested analytical Capability without accepted evidence remains unsupported or a Coverage Gap.

Generic AI output or historical fixture data must not fabricate the missing method.

Phase 7 #347 remains the governed Method Improvement path for the CN duration work.

#384 has code-path readiness but still lacks real new accepted Data Engine research evidence.

A real candidate must materially differ from the frozen predecessor evidence.

The predecessor remains immutable until explicit `BRAIN_GOVERNANCE` changes active method state.

The source-admission evaluator may read bounded method currentness authority.

It must never create, validate, activate, retire or degrade a method.

## 14. Frozen invariants

1. `Capability execution success != production source admission`.
2. `Historical receipt validity != current source admissibility`.
3. Runtime Capability definitions do not have an invented active lifecycle.
4. Implementation Profiles use `APPROVED` and `RETIRED` only.
5. An approved implementation at invocation is not perpetual source admission.
6. An active method package at invocation is not perpetual current source proof.
7. `Observation/reflection/telemetry != authority`.
8. `Coverage Gap != runtime failure != Method Performance Gap`.
9. `Recommendation != authorization`.
10. Product consumers do not inspect Capability internal registry state.
11. Missing provenance or currentness fails closed.
12. Integration owns shared transport vocabulary.
13. Capability owns producer admission decision semantics.
14. No cross-service database ownership is introduced.
15. No Product business-state mutation is introduced.
16. No Official Truth claim is created by this checkpoint.

## 15. #393 acceptance result

This audit freezes current Capability maturity and source-admission boundaries.

It answers the Capability side of MarkReg #388 without consumer reinterpretation.

It records #385 as the Integration-owned shared dependency.

It derives #397 as the highest-value unblocked owner-local P0.

It also corrects two registry facts required by #397.

Runtime Capability definitions use accepted Canon projection and latest-version lookup.

Implementation Profiles use immutable version lines with `APPROVED` and `RETIRED` status.

No current analytical pilot is promoted to production-admissible source material.
