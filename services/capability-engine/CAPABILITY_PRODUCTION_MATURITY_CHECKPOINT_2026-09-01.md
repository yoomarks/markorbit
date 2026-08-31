# Capability Production Maturity Checkpoint — 2026-09-01

Issue: #393

Parent: #392

First product consumer question: #388

Shared contract dependency: #385

Original audit base commit: `7fb6c2cf6967b2fc17aba2f47374c19e6e592e5d`

Closure revalidation main commit: `3318e7deffde6936ae60f986a90c10b6fd8ede36`

## 1. Executive freeze

Capability Engine already has a governed execution substrate. A successful governed invocation can prove the exact accepted Capability definition, an approved Implementation Profile, the request, invocation, outcome, return and session receipt, and method identity when the selected implementation is method-backed. Durable replay preserves those governed identities and does not execute a second time.

That is **not yet the same thing as a production-admissible product source**.

At this checkpoint there is no generic producer-side decision that answers, at the time a product wants to consume a previously issued Capability result, whether all required source bindings are still acceptable for new consumption. A historically valid runtime return does not itself prove that the Capability definition/version, Implementation Profile version, method/package/activation, reference or dataset remains the producer-approved source for the requested applicability at the later consumption time.

Therefore:

- no analytical Capability surface is upgraded to `PRODUCTION_ADMISSIBLE` merely because invocation succeeds;
- a producer-issued historical runtime return remains immutable historical execution evidence, but is not by itself a current source-admission decision;
- new product consumption fails closed if current-source admission cannot be established;
- product consumers do not inspect Capability internal catalog/profile state or reconstruct producer lifecycle/currentness rules;
- observation, reflection and learning artifacts remain private, non-authoritative learning material and never become product source truth by implication;
- successful runtime execution and product source admission remain separate producer decisions;
- runtime failure, Capability Gap, Coverage Gap and method/product correctness feedback remain distinct;
- raw runtime failures must not be transformed directly into Phase 7 Method Improvement triggers.

## 2. Authoritative maturity vocabulary

This checkpoint uses the #393 classifications exactly:

- `PRODUCTION_ADMISSIBLE` — producer can prove that one bounded source is admissible for the requested product consumption without consumer reinterpretation.
- `PRODUCTION_RUNTIME_BUT_NARROW` — production-grade governed runtime infrastructure exists, but it does not by itself prove source admission for arbitrary or historical results.
- `PILOT` — bounded accepted pilot surface whose code may run through governed runtime but remains pilot-scoped by implementation contract, policy or source assumptions.
- `FIXTURE/TEST` — fixture-only or test-only surface.
- `INTERNAL_ONLY` — internal governance, learning, audit, registry or operational surface not intended as product source material.
- `DEFERRED/UNSUPPORTED` — requested applicability or behavior with no truthful accepted producer implementation.

## 3. Registry truth that #397 must preserve

### 3.1 Runtime Capability definition registry

The current `RuntimeCapabilityDefinition` registry does **not** expose an independent `ACTIVE` / `RETIRED` lifecycle model.

Current code truth is:

- definitions are admitted only from accepted Capability Canon projection;
- a Capability identity owns an immutable version line;
- `findCurrent(capabilityId)` returns the latest accepted runtime definition by version;
- `findVersion(...)` preserves exact historical definition lookup;
- exact Canon/version and Capability/version conflicts fail closed.

Therefore #397 may ask whether the exact historical definition still matches the producer's current accepted projection for the requested consumption, but it must not invent an `ACTIVE`, `RETIRED`, `SUPERSEDED` or equivalent registry enum that does not exist.

### 3.2 Implementation Profile registry

The current Implementation Profile model is an immutable version line with an explicit status of:

```text
APPROVED
RETIRED
```

Current code truth is:

- `findCurrent(implementationProfileId)` means the latest registered version in that profile lineage;
- new versions must advance the immutable version line;
- lineage fields cannot silently change across versions;
- runtime selection requires the latest candidate profile to be `APPROVED` and to satisfy capability/version, implementation kind, caller, risk and schema constraints;
- the registry does not expose separate `CURRENT`, `SUPERSEDED` or `SUNSET` lifecycle states.

Therefore #397 should determine whether the exact historical profile is still the latest applicable `APPROVED` producer binding for new consumption. It must not fabricate `CURRENT`, `SUPERSEDED` or `SUNSET` enum semantics.

### 3.3 Method runtime distinction

Executable Method runtime does have explicit package activation semantics. Its immutable runtime source selects only accepted `ACTIVE` packages at execution time. That method/package activation model must remain separate from Runtime Capability definition and Implementation Profile registry semantics.

## 4. Current Capability/runtime maturity freeze

### `PRODUCTION_RUNTIME_BUT_NARROW`

The following are mature governed runtime substrate but are not, by themselves, generic production source admission:

- Runtime Capability registry/catalog;
- Implementation Profile registry and governed binding;
- governed Capability runtime;
- durable replay and idempotency;
- Executable Method runtime;
- request, invocation, outcome, return and session receipt lineage;
- Managed AI governed runtime.

### `INTERNAL_ONLY`

The following remain internal governance, audit or learning surfaces:

- Capability audit telemetry;
- Capability Observation source/ledger;
- private reflection;
- disposition/profile/twin surfaces;
- Capability Center learning/governance surfaces.

### `PILOT`

The following remain explicitly pilot-scoped:

- CN filing to preliminary-publication descriptive analytical pilot;
- CN completed-duration historical-band classification pilot;
- CN preliminary-publication objective fact discovery pilot;
- USPTO official base-application fee resolver pilot.

### `FIXTURE/TEST`

- milestone Capability request fixture.

### `DEFERRED/UNSUPPORTED`

- generic fallback or automatic provider/method authority;
- unsupported applicability without an accepted source/method.

No analytical Capability surface is classified `PRODUCTION_ADMISSIBLE` by this checkpoint.

## 5. Important evidence behind the maturity freeze

### Runtime Capability registry/catalog

The registry imports accepted Capability Canon projections into immutable versioned runtime definitions. Internal registry reachability and `findCurrent()` are producer-owned implementation details. A product must not query the registry to infer admission.

### Implementation Profile registry/binding

Invocation selects from producer-owned profile state and requires an `APPROVED` profile satisfying exact capability/version, implementation kind, caller, risk and schema constraints. Exact binding is strong execution provenance, but a historical profile identity is not proof that the same version remains the latest applicable approved binding for later product consumption.

### Governed Capability runtime

The runtime validates accepted Capability definition/version, caller/risk/schema constraints and exact implementation binding, then emits governed request, invocation, outcome, return and session receipt identities. Successful execution proves what ran at that time. It does not issue a separate product-source admission verdict for future consumption.

### Durable replay/idempotency

Replay returns the historical governed execution without a second implementation call. Exact request conflicts fail closed and stored identity/integrity is preserved.

```text
Replay != current source re-admission
```

A later denial for new consumption must never mutate the historical invocation, outcome, return or session receipt.

### Executable Method runtime

Method-backed execution selects only accepted `ACTIVE` packages from the immutable runtime source, and execution receipts preserve package/method identities. That is a strong execution-time gate, but an old execution receipt still requires a bounded producer currentness/admission check when reused later.

### Managed AI

Provider dispatch requires explicit runtime and provider-dispatch authorization plus provider credentials. Managed provider/model execution success remains governed execution evidence only.

```text
provider/model execution success != semantic production admission
```

### Observation/reflection

Capability Observation and reflection remain private, governed, append-only/no-authority learning or audit evidence. They never self-promote into Product Truth, Recommendation authority, Brain activation or Official Truth.

## 6. Consumer map

### MarkReg

MarkReg #388 is the first concrete product need. Current pilot profiles may allow `MARKREG`, but allow-list membership only proves caller eligibility for that implementation policy. It does not prove that MarkReg has a production source-admission contract.

MarkReg must not inspect Capability internal registry/profile state or create a second source-admission algorithm.

### Lite, MGSN and other products

This audit creates no new generic production analytical source contract for other products. Any existing product-specific use remains bounded by its own accepted contract and cannot be upgraded from runtime reachability alone.

### Capability internal learning

Observation/reflection paths may consume reviewed governed work evidence while preserving explicit non-authority semantics.

## 7. Producer/source/admission truth

The producer-side decision is evaluated when new product consumption occurs, even if the underlying runtime execution completed earlier.

Admission must fail closed when any required condition cannot be established.

At minimum:

- non-producer-issued result or missing/inconsistent runtime identity/integrity -> deny;
- Capability identity/version missing or inconsistent with producer records -> deny;
- exact historical Capability definition no longer matches the producer's latest accepted projection required for the requested applicability -> deny for new consumption while preserving historical evidence;
- Implementation Profile identity missing -> deny;
- historical Implementation Profile version is no longer the latest applicable `APPROVED` binding, the latest version is `RETIRED`, or exact binding cannot be established -> deny for new consumption;
- method-backed result missing exact method/package/method-version/activation/evaluation identities -> deny;
- required method/package is not producer-admissible for the requested new consumption -> deny without mutating historical receipts;
- required dataset/query/reference/evidence identity missing or integrity cannot be proven -> deny;
- time-sensitive or replaceable source is outside its effective/current window or currentness cannot be established -> deny;
- applicability does not cover the request or required source data is unavailable -> Coverage Gap / deny, never fallback inference;
- runtime/dependency inability prevents admission from being established -> deny and classify separately from Capability/Method correctness;
- all exact identities, integrity, current binding, applicability, limitations and semantic-safety conditions pass -> producer may issue a `PRODUCTION_ADMISSIBLE` decision for that exact bounded source and consumption context.

The evaluator must distinguish historical execution validity from current admission. Historical evidence is immutable. A later denial only prevents new product consumption from treating the old result as currently admissible source material.

## 8. Minimum producer proof for product-admissible source material

Capability must be able to prove or reference, without making products inspect internal registries:

1. exact Capability ID/version and exact runtime definition identity/version;
2. exact implementation ID/version/key and Implementation Profile ID/version;
3. exact method ID, method-version ID, package ID/version and activation/evaluation identity when method-backed;
4. exact dataset/query/reference/evidence identities and integrity fingerprints where applicable;
5. exact request/input/output/evidence fingerprints;
6. exact invocation/outcome/return/session receipt identities;
7. explicit source class and admission class;
8. exact applicability and limitations;
9. effective/current/freshness evaluation and the producer authorities checked;
10. assumptions and unknowns;
11. explicit semantic-safety and no-authority consequences;
12. admission decision timestamp/version/fingerprint so a product can reference one immutable producer decision instead of reproducing producer logic.

Missing or ambiguous proof is a denial, never an implied production default.

## 9. What remains producer-internal

Products should reference, not serialize or independently interpret:

- full Runtime Capability catalog rows and version history;
- full Implementation Profile registry records and version-selection mechanics;
- executable package contents and internal package-selection machinery;
- raw Data Engine populations or research rows;
- full Knowledge source material when an immutable source/reference identity is sufficient;
- private Capability Observation, reflection and learning ledgers;
- provider secrets and internal Managed AI routing configuration;
- exact sensitive output payloads when a durable evidence ref/hash is sufficient;
- internal retry/fallback mechanics;
- raw audit telemetry not required to prove the bounded source decision.

## 10. Exact answer for MarkReg #388

### 10.1 What Capability can already provide

Capability can already provide provenance-rich governed runtime execution and immutable replay for exact accepted definitions and approved implementations. Method-backed execution can additionally prove the exact `ACTIVE` package/method selected at execution time.

It cannot yet provide the complete current producer-side source-admission verdict required by #388. Therefore no existing pilot should be consumed by MarkReg as production-admissible analytical source merely by parsing a runtime return.

### 10.2 Why current `0.1.0-fixture` behavior remains fixture

There are two independent reasons:

- **MarkReg/shared-contract limitation:** current early-funnel shared shapes explicitly encode fixture semantics and cannot be silently reinterpreted as production. #385 owns the additive/versioned shared vocabulary.
- **Capability producer limitation:** current Capability pilots lack the generic current source-admission decision described here. Runtime success and exact provenance are necessary but not sufficient.

Removing only one limitation would still leave #388 untruthful.

### 10.3 Owner-local Capability changes required before #388

P0 owner-local work is #397:

- implement a read-only producer-side current-source admission evaluator under `services/capability-engine/**`;
- accept one exact producer-issued governed runtime result;
- validate immutable runtime identity/integrity;
- re-check the exact Runtime Capability definition against producer-owned current accepted projection semantics;
- re-check the exact Implementation Profile against the latest applicable immutable version line and `APPROVED` / `RETIRED` truth;
- plug bounded optional method currentness authority for method/package/method-version/activation/evaluation identities;
- plug bounded optional reference/dataset/evidence currentness authority;
- distinguish invalid evidence, non-current binding, source/reference currentness failure, unsupported applicability/Coverage Gap and dependency/runtime inability;
- preserve historical receipt immutability;
- keep the evaluator transport-neutral until Integration provides the shared contract;
- emit no Product business state, Official Truth or automatic Method Improvement trigger.

No new analytical Capability is required for this task.

### 10.4 Shared fields requested from Integration under #385

Integration should expose additive/versioned transport vocabulary capable of carrying a producer-issued admission reference/decision with at least:

- producer identity;
- admission decision identity/version/fingerprint/timestamp;
- Capability ID/version;
- runtime definition identity/version when needed for exact lineage;
- implementation ID/version/key and Implementation Profile ID/version;
- optional method/package/method-version/activation/evaluation identities;
- optional dataset/query/reference/evidence identities and integrity fingerprints;
- runtime request/invocation/outcome/return/session receipt references and relevant fingerprints;
- explicit source class and admission class with no production default by omission;
- applicability, limitations, assumptions and unknowns;
- freshness/effective/current-source result and bounded denial reason vocabulary;
- semantic-safety and no-authority consequences;
- enough immutable lineage for MarkReg Recommendation to reference the producer decision without serializing Capability internals.

Exact shared type names and enums remain Integration-owned. Capability must not create a parallel cross-service wire contract.

## 11. Runtime quality and observability audit

### Latency and cost

Managed AI audit telemetry can record latency, token/unit and cost fields when supplied. Generic governed Capability runtime does not yet provide one normalized product-independent runtime-quality record for every implementation.

P1 candidate: normalized non-authoritative runtime quality observation.

### Deterministic replay

Governed runtime replay is strong: the same immutable request replays stored evidence, request conflicts fail closed and no second implementation execution occurs.

Preserve that historical semantic. Do not reinterpret replay as current re-admission.

### Dependency failure classification

Governed failure outcomes exist, but there is no single producer admission/coverage taxonomy across all Capability kinds.

#397 should introduce only the bounded admission denial distinctions needed for owner-local evaluation. Broader observability taxonomy remains a later evidence-driven task.

### Implementation fallback

No generic automatic fallback authority exists. Managed AI telemetry can record fallback counts, but provider/model dispatch remains separately governed.

Preserve fail-closed behavior. Any fallback authority must be explicit policy, never inferred.

### Stale/non-current binding detection

Invocation resolves producer-owned current definitions/profiles for execution, but a historical replay/return is not independently re-evaluated for later product consumption.

This is the primary P0 gap addressed by #397.

### Coverage and unsupported applicability

Individual pilots validate exact bounded applicability and fail outside it. A unified cross-service product-facing Coverage Gap vocabulary is not owned by this issue.

#397 may use bounded owner-local denial semantics. Shared exposure remains Integration-owned.

## 12. Owner-local backlog

### P0 — #397 Current Capability Source Admission Evaluator

This is the highest-value unblocked next task.

Allowed scope:

```text
services/capability-engine/src/**
services/capability-engine/tests/**
```

Required properties:

- transport-neutral;
- read-only;
- exact producer-issued runtime identity input;
- immutable historical evidence verification;
- producer-owned Capability definition and Implementation Profile currentness checks based on actual registry semantics;
- bounded optional method/reference authorities;
- deterministic fail-closed denial classes;
- no cross-service DB reads;
- no product state;
- no Official Truth;
- no automatic fallback;
- no Method Improvement trigger emission.

### P1 — Generic Capability runtime quality observation

Consider only after #397 and only if operational evidence supports it:

- normalized latency;
- retry/dependency failure class;
- execution cost/unit metadata;
- source-admission denial telemetry;
- no sensitive raw payload retention;
- no authority semantics.

### P1 — Coverage Gap normalization

Consider only from real product/runtime evidence:

- distinguish unsupported applicability/data from execution/dependency failure;
- support producer admission and roadmap analysis;
- do not fabricate fallback outputs;
- do not equate Coverage Gap with Method Performance Gap;
- shared cross-service vocabulary remains Integration-owned.

## 13. Brain Research / Phase 7 dependency

A requested analytical Capability with no accepted method/evidence remains `DEFERRED/UNSUPPORTED` or a Coverage Gap. It must not be fabricated from generic AI output or historical fixture data.

For CN completed-duration historical-band work, Phase 7 #347 remains the governed Method Improvement path. #384 has code-path readiness, but a real candidate still requires new accepted reproducible Data Engine research evidence that materially differs from the predecessor evidence and passes the existing research gate.

The current predecessor remains immutable until explicit `BRAIN_GOVERNANCE` changes the active method.

The source-admission evaluator may consume bounded method governance/currentness authority. It must never create, validate, activate, retire or degrade a method itself.

## 14. Frozen invariants

1. `Capability execution success != production source admission`.
2. `Historical receipt validity != current source admissibility`.
3. `latest accepted RuntimeCapabilityDefinition != an invented ACTIVE/RETIRED lifecycle`.
4. `latest Implementation Profile version + APPROVED/RETIRED != invented CURRENT/SUPERSEDED/SUNSET states`.
5. `APPROVED implementation at invocation != perpetual product-source admissibility`.
6. `ACTIVE method package at invocation != perpetual current method source`.
7. `Observation/reflection/telemetry != authority`.
8. `Coverage Gap != runtime failure != Method Performance Gap`.
9. `Recommendation != authorization`.
10. Product consumers do not inspect Capability internal DB/catalog state.
11. Missing provenance/currentness/source classification fails closed.
12. Shared transport vocabulary is Integration-owned; Capability owns producer decision semantics and evaluation.
13. No cross-service database ownership and no Product business-state mutation.
14. No Official Truth claim is created by this checkpoint.

## 15. #393 acceptance result

This audit establishes the current-code maturity freeze, producer/source/admission truth, exact #388 producer-side gap, #385 shared dependency and the next owner-local P0.

The closure revalidation also corrects two important registry facts:

- Runtime Capability definitions use accepted Canon projection plus latest-version lookup, not an `ACTIVE` / `RETIRED` lifecycle;
- Implementation Profiles use immutable version lines plus `APPROVED` / `RETIRED`, not `CURRENT` / `SUPERSEDED` / `SUNSET` states.

No existing analytical pilot is promoted to production-admissible source material by this checkpoint. The next implementation step is #397.