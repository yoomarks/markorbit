# Provider Discovery & Explainability V1

## 1. Status and scope

**MGSN-P0-002 / #371, parent #358.**

This is an architecture, privacy, and contract-boundary freeze.

It was audited against `main` at `0fd701d9952445af591cbf86f20dd789f428ceb2` after #359 and PR #361 merged.

The V1 product path is:

```text
Need
→ requester/context/purpose
→ participation and visibility exposure gate
→ operational and supply suitability gate
→ candidate evidence
→ explanation
→ candidate set
→ human review
```

The V1 path is not:

```text
Need → winner → Allocation → Provider
```

This issue does not implement Provider Discovery runtime.

It does not implement Provider Selection, Allocation, Acceptance, appointment, external contact, filing, payment, or Official Truth.

## 2. Permanent locks

The permanent product principles remain unchanged.

```text
Private First
Trust Before Exposure
Evidence Before Ranking
Human Choice Before Routing Action
Relationship Ownership Remains with Organizations
Direct-to-Executor
No Rebrokering
```

The authority locks remain unchanged.

```text
Capability Need != Provider Appointment
Provider Candidate != Provider Selection
Provider Selection != Allocation
Eligibility != Allocation
Allocation != Provider Acceptance
Provider Acceptance != legal/professional appointment
Provider Return != Official Truth
Evidence Handoff != Filing Submission
Payment != Performance / Acceptance / Completion
```

AI may analyze, compare, recommend, and explain candidate evidence.

AI must not automatically select, allocate, appoint, accept, contact a Provider, file, pay, or create Official Truth.

A discovery result is advisory MGSN network evidence.

A discovery result is not a protected-action release.

## 3. Current implemented substrate

MGSN already owns the M4 provider-execution substrate.

```text
Provider Registry
→ Supply Capability
→ Service Package
→ Eligibility
→ Allocation
→ Provider Acceptance
→ Provider Return
→ Execution evidence handoff
```

Those objects remain unchanged.

Provider Registry and Supply Capability contain operational source material.

That source material includes Provider references, operational state, jurisdictions, service types, effective periods, capacity, availability, evidence references, supply verification state, source fingerprints, and exact versions.

Those records are operational truth.

They are not discovery consent.

Network Participation & Visibility V1 from #359 is a separate authority layer.

An operationally ACTIVE Provider may still be `NOT_PARTICIPATING`.

An ACTIVE participant may still be entirely PRIVATE.

Missing, stale, contradictory, or ambiguous visibility authority denies exposure.

Lite M12 is an implemented compatibility reference outside MGSN.

It preserves these consequences:

```text
providerEngagedByLite = false
providerSelectedByLite = false
servicePackageSelectedByLite = false
protectedActionAuthorized = false
```

MGSN Discovery V1 must preserve the same candidate-only meaning.

Execution M13 is also outside this boundary.

Its protected provider handoff remains a later, separately authorized action.

Discovery creates no M13 authority.

## 4. What Discovery V1 answers

Discovery V1 may answer whether a Provider is allowed to be considered for the current requester, context, and purpose.

It may answer whether current operational and supply facts satisfy the Need.

It may identify the evidence supporting inclusion or exclusion.

It may expose only fields authorized for the current requester, context, and purpose.

It may explain why a returned item is a candidate.

It may disclose freshness, limitations, and missing evidence that a human reviewer should understand.

Discovery V1 does not decide who should be appointed.

It does not decide who should be allocated.

It does not claim that a Provider has accepted work.

It does not create a universal best-provider or lowest-price winner.

It does not decide who may receive customer information.

It does not authorize filing, payment, or another professional action.

## 5. Discovery input boundary

A discovery request must be an immutable request snapshot assembled from owner sources.

The requester Workspace comes from Core identity and trusted session or Principal context.

The requester Workspace must never be inferred from Provider records.

The Need reference comes from the consumer-owned product or workflow.

MGSN does not create a second customer workflow or Capability Engine.

Jurisdiction comes from the reviewed Need.

Service type or capability need comes from the reviewed Need and canonical capability references where applicable.

Discovery purpose must be explicit.

A generic purpose such as `network use` is insufficient.

Audience and relationship context must be explicit where visibility policy depends on them.

Requested data classes must be explicit and minimal.

Omission of a field does not authorize the rest of a source object.

The request must carry a request time for effective-period and freshness checks.

The request should use existing correlation and idempotency conventions where a later shared contract supports them.

MGSN must not require raw end-client contacts, originating pricing or margin, unrelated trademark assets, or unrelated private matter content to perform discovery.

## 6. Exposure gate

Exposure authorization is independent from operational suitability.

A Provider may be exposed only when the current authority conditions pass.

```text
Participation = ACTIVE
AND current VisibilityPolicy exists
AND requested field/data class is allowed
AND requested purpose is allowed
AND audience/context is allowed
AND required TRUSTED relationship authority is current
AND current policy/version can be verified
```

If required authority is missing, stale, contradictory, paused, revoked, or unavailable, the result is:

```text
DENY EXPOSURE
```

Exposure policy answers what may be seen.

Exposure policy does not answer whether a Provider is operationally suitable.

Provider ACTIVE does not create exposure authority.

Supply ACTIVE does not create exposure authority.

Eligibility does not create exposure authority.

Prior success does not create exposure authority.

Payment does not create exposure authority.

Commercial-admin access does not create exposure authority.

## 7. Operational and supply suitability gate

Operational suitability is also independent from exposure authority.

A Provider can be suitable only when current M4-owned facts support the Need.

The Provider operational state must be compatible.

The relevant Supply Capability must be current and operationally usable.

Jurisdiction must match.

Service type must match.

The effective period must cover the request time.

Required operational constraints must pass.

Exact source versions and fingerprints must be current.

Suitability does not authorize exposure.

A returned discovery candidate requires both:

```text
EXPOSURE_ALLOWED
AND
SUITABILITY_ALLOWED
```

The exposure decision and suitability decision must remain separately attributable and explainable.

## 8. Candidate semantics

A V1 candidate is a deterministic, evidence-backed network suggestion.

It has no protected-action consequence.

A future canonical candidate should carry the existing Provider reference and Provider Workspace reference.

It should carry the matched Need reference.

It should carry exact source versions.

It should carry only an authorized Provider projection.

It should carry suitability evidence and visibility evidence separately.

It should carry a human-readable explanation, freshness information, limitations, and generation time.

Its authority consequences must remain false.

```text
providerSelected = false
providerAllocated = false
providerAccepted = false
providerEngaged = false
professionalAppointmentCreated = false
externalContactAuthorized = false
filingAuthorized = false
paymentAuthorized = false
officialTruthCreated = false
```

The exact type names may change in a shared contract.

The authority semantics may not change.

A deterministic historical candidate is not current exposure authority.

## 9. Authorized projection

Discovery output is not a serialized Provider Registry record.

Discovery output is not a serialized Supply Capability record.

Discovery output is an authorized projection.

A projection contains only fields permitted by the current visibility policy for the current requester, purpose, and context.

Potential future projection fields include an authorized Provider display identity or reference.

They may include selected service types and jurisdictions.

They may include selected capability or supply claims.

They may include a bounded availability signal after a separate contract exists.

They may include selected evidence or verification claims with provenance.

They may include selected direct-executor disclosures after the canonical responsibility contract exists.

They may later include selected outcome or trust evidence.

Raw `capacityUnits` remain private by default.

Raw `availabilityUnits` remain private by default.

Entire raw evidence lists remain private by default.

Private evidence artifacts remain private by default.

Private relationship graphs remain private by default.

Applicant or Trademark Owner official information is not discovery profile data.

End-client contact or customer-relationship information is not discovery profile data.

Originating Workplace pricing, quote, margin, or profit is not discovery data.

Unrelated communications, trademarks, matters, and assets are not discovery data.

A grant for one field never authorizes sibling fields from the same source record.

## 10. Availability boundary

Existing `capacityUnits` and `availabilityUnits` remain private operational truth.

Discovery may later expose a bounded derived availability signal.

That signal requires a separate contract and explicit visibility authority.

This document does not freeze the signal formula or shared type.

Until such a contract exists:

```text
raw capacity/availability = PRIVATE
no derived signal = deny availability exposure
```

## 11. Evidence model

Evidence must precede any later ranking or recommendation claim.

Discovery evidence must be attributable to an owner or source.

It must be versioned or freshness-bounded.

It must be authorized for the current requester and purpose.

A private underlying artifact requires a separate retrieval authorization.

Provider claims must remain distinguishable from MGSN operational truth.

MGSN operational truth must remain distinguishable from external or owner-verified truth.

Provider Registry and Supply Capability may provide MGSN operational evidence.

Provider-supplied references remain Provider claims unless a canonical owner verifies them.

Capability-owner evidence remains owned by Capability Engine or the relevant canonical owner.

Relationship and trust evidence requires later bounded ownership and visibility semantics.

Outcome evidence requires later evidence-backed productization.

Provider Return alone is not Official Truth.

`VERIFIED_FOR_SUPPLY` does not publish evidence.

Successful history does not publish evidence.

The existence of an evidence reference does not publish evidence.

Visibility authority is always separate.

## 12. Explanation model

Every returned candidate must be explainable without exposing forbidden private data.

An inclusion explanation must identify which Need, jurisdiction, and service constraints matched.

It must identify the exact Provider and Supply versions evaluated.

It must identify the operational checks that passed.

It must identify the participation and visibility versions that authorized the returned projection.

It must identify evidence references that may lawfully support the explanation.

It must disclose freshness and effective-period information.

It must disclose material limitations or deferred verification.

Internal evaluation may record bounded exclusion reasons.

```text
NOT_PARTICIPATING
PARTICIPATION_PAUSED
PARTICIPATION_REVOKED
VISIBILITY_PRIVATE
VISIBILITY_PURPOSE_DENIED
VISIBILITY_AUDIENCE_DENIED
TRUST_AUTHORITY_MISSING
PROVIDER_INACTIVE
SUPPLY_INACTIVE
JURISDICTION_MISMATCH
SERVICE_TYPE_MISMATCH
OUTSIDE_EFFECTIVE_PERIOD
INSUFFICIENT_CURRENT_EVIDENCE
STALE_SOURCE
DIRECT_EXECUTOR_NOT_ESTABLISHED
```

Requester-visible exclusion output must not reveal a hidden Provider's existence or private state.

Internal audit reasons may therefore be more specific than external responses.

## 13. Direct-to-Executor and No Rebrokering

The correct path remains:

```text
Originating Workplace → MGSN → Final Execution Provider
```

A hidden chain is not acceptable.

```text
Originating Workplace → Broker/Middle Agent → Sub-agent → Final Provider
```

Discovery must not present a Provider as a compliant direct-execution candidate when required responsibility evidence is missing.

The future canonical responsibility profile must support final-executor status.

It must support direct-responsibility status.

It must support no-rebrokering commitment and violation state.

It must support transparent disclosure when law or procedure requires another signing or filing entity.

A transparently disclosed legally required signer is not automatically prohibited rebrokering.

The current Provider Registry does not own these fields.

#371 does not add them to Provider Registry.

Shared/Integration issue #375 owns that dependency.

Until #375 is productized, any discovery flow that requires proof of direct execution must fail closed when proof is unavailable.

## 14. Relationship ownership and customer privacy

The Originating Workplace retains its customer relationship.

End-client Relationship Information is:

```text
PRIVATE BY DEFAULT
NOT DISCOVERY DATA
NOT EXPLANATION DATA
NOT PROVIDER SELECTION DATA
```

Discovery must not require or expose client email, phone, or contact details.

It must not expose the Originating Workplace to client relationship beyond separate official necessity.

It must not expose the originating quote, margin, or profit.

It must not expose unrelated internal messages.

It must not expose unrelated marks, matters, or assets.

It must not expose private CRM or customer-segmentation context.

Applicant and Trademark Owner official information is a separate data class.

It may later be transmitted only through a specific and separately authorized professional or official handoff.

It is not discovery profile data.

## 15. Determinism and current authority

Discovery should be deterministic for an exact immutable request and source snapshot.

A future deterministic fingerprint should include the requester Workspace reference.

It should include the Need reference and version.

It should include purpose, audience, context, and requested data classes.

It should include participation and visibility policy versions.

It should include Provider and Supply versions and fingerprints.

It should include relevant capability and evidence versions.

It should include the discovery evaluation policy version.

Historical determinism is not current authority.

```text
historical deterministic result != current exposure permit
```

Current participation and visibility authority must be revalidated before serving or dereferencing a candidate.

A positive cache must not survive pause, revoke, or policy contraction as exposure authority.

If current authority cannot be verified:

```text
DENY EXPOSURE
```

## 16. Ordering and ranking

V1 does not define a universal Provider score.

V1 does not define a winner.

A runtime may require stable ordering for deterministic APIs and tests.

Such ordering must be administratively neutral and must not be presented as quality ranking.

Any later ranking requires evidence semantics, visibility, trust/outcome evidence, explainability, and human choice.

Any later ranking still creates no Selection or Allocation authority by itself.

## 17. Negative cases

Provider ACTIVE with no participation row must not be returned.

ACTIVE participation with entirely PRIVATE visibility must not be returned to network discovery.

PAUSED participation must not be returned even when an old cache was positive.

REVOKED participation must not be returned, and old replay cannot restore exposure.

TRUSTED visibility with missing or stale relationship authority must not be returned.

An ACTIVE Supply with a suspended or inactive Provider must not be returned.

A jurisdiction mismatch must not be returned.

A service-type mismatch must not be returned.

Supply outside its effective period must not be returned.

Raw availability without a bounded signal contract and grant must not be exposed.

`VERIFIED_FOR_SUPPLY` must not expose all evidence or verify user Capability.

An evidence reference denied by current visibility must not be exposed or dereferenced.

AI identifying a strongest candidate must not select, allocate, or appoint it.

Previous successful collaboration must not create TRUSTED visibility or a universal trust score.

Client contact or margin in source context must be excluded from evidence and explanation.

Applicant legal name must be excluded from discovery and reserved for a separate official-purpose handoff.

A hidden intermediary or sub-agent chain must not be represented as compliant direct execution.

Unavailable current participation policy must fail closed.

Stale source version or fingerprint must be re-evaluated or denied.

A candidate returned to Lite M12 remains candidate-only.

A candidate later entering an M13 flow still requires separate human and protected-action authorization.

## 18. M12 compatibility

Future MGSN discovery output consumed by Lite must preserve:

```text
providerEngagedByLite = false
providerSelectedByLite = false
servicePackageSelectedByLite = false
protectedActionAuthorized = false
```

MGSN may add authorized evidence, explanation, and projections.

MGSN must not force Lite to treat the candidate as selected or engaged.

A future Integration contract may map MGSN discovery candidates into Lite consumer snapshots.

MGSN remains the source authority for its provider-network discovery evidence.

## 19. M4 compatibility

Discovery must not redefine Service Package.

It must not redefine Eligibility.

It must not redefine Allocation.

It must not redefine Provider Acceptance.

It must not redefine Provider Return.

It must not redefine Evidence Handoff.

M4 Eligibility remains operational suitability truth inside its governed execution substrate.

An `ELIGIBLE` M4 result is not visibility authority.

An `ELIGIBLE` M4 result is not Provider Selection.

If future pre-Service-Package discovery needs a broader suitability concept, that concept must be separately named and must not silently mutate M4 Eligibility semantics.

## 20. Runtime security and privacy gates

Future runtime must prove authenticated requester Workspace isolation.

It must require explicit purpose, audience or context, and requested data classes.

It must verify current participation and visibility authority.

It must avoid cross-Workspace leakage through candidate count and exclusion reasons.

It must validate exact source versions and fingerprints.

It must produce privacy-safe explanations.

Evidence dereference authorization must remain separate from evidence-reference visibility.

Pause, revoke, and policy contraction must invalidate positive exposure.

Direct-executor evidence must be current when a product flow requires it.

Deterministic or idempotent replay must never bypass current authorization.

This boundary authorizes no production or live Provider contact.

## 21. Shared Dependency Request: Provider Discovery Candidate V1

### Goal

Create the minimum shared candidate, evidence, and explanation contract for cross-lane consumption.

### Why

MGSN owns provider-network discovery evidence.

Lite and future Workplace products may consume authorized candidate projections.

A shared contract prevents consumer-specific reinterpretation of candidate authority.

### Producer

MGSN.

### Consumers

Lite M12 and future Workplace discovery UI are future consumers.

The later Human Selection boundary is also a future consumer.

Authorized audit and observability surfaces may consume bounded references.

### Contract

Minimum proposed concepts are:

```text
ProviderDiscoveryRequestReference
ProviderDiscoveryCandidate
AuthorizedProviderProjection
DiscoveryEvidenceReference
DiscoveryExplanation
DiscoveryLimitation
DiscoverySourceVersion
ProviderDiscoveryResult
ProviderDiscoveryAuthorityConsequences
```

The candidate consequences must remain false.

```text
selected
allocated
accepted
engaged
appointed
externalContactAuthorized
filingAuthorized
paymentAuthorized
officialTruthCreated
```

The contract must separate exposure authorization evidence from operational suitability evidence.

It must identify source authority and provenance.

It must identify source versions and freshness.

It must carry privacy-safe explanation and limitations.

It must represent direct-executor disclosure state without assuming proof.

### Requested paths

```text
packages/contracts/**
```

Later Lite or Gateway wiring requires separately scoped Integration work.

### Compatibility

The contract must preserve #359 participation and visibility semantics.

It must preserve M12 candidate-only semantics.

It must preserve all M4 state machines.

It must not create a second Provider Registry, Capability Engine, or Workspace identity.

It must not encode a universal ranking or winner in V1.

It must not create protected-action authority.

### Acceptance

Shared fixtures must prove candidate is not Selection, Allocation, or appointment.

The projection must not serialize private source records wholesale.

Source versions, authority, and freshness must be explicit.

The consequence fixture must contain no external-action or Official Truth authority.

A fail-closed empty result must not leak hidden Providers.

Exact-head CI must be green.

### Risk

The primary risk is making a rich candidate type implicitly equivalent to a selected Provider.

Another major risk is leaking private Provider or evidence fields through a convenient shared snapshot.

The shared contract must remain projection-based and consequence-negative.

### Blocked MGSN work

This dependency blocks cross-lane Provider Discovery implementation and consumption.

It does not block this MGSN-owned boundary freeze.

## 22. Shared Dependency Request: Provider Execution Responsibility Profile V1

This dependency is tracked by Integration issue #375.

### Goal

Create canonical Direct-to-Executor and No-Rebrokering responsibility disclosure.

### Producer

MGSN owns provider-network responsibility and disclosure truth.

Its source must be authorized organization or Provider attestations plus later evidence where applicable.

### Consumers

MGSN Discovery and Explainability is a consumer.

Later Human Selection is a consumer.

Later Controlled Handoff and M13 compatibility are consumers.

A future Provider Workspace may maintain the disclosure.

### Required semantics

The contract must reuse the existing Provider and Provider Workspace references.

It must represent final-executor state.

It must represent direct-responsibility state.

It must represent no-rebrokering commitment and violation state.

It must represent a distinct legally required signing or filing entity when applicable.

It must carry evidence or attestation references and source authority.

It must carry version, freshness, and effective-period information.

It must create no Allocation, Acceptance, appointment, filing, or Official Truth authority.

### Requested paths

Likely Shared Zone paths are:

```text
packages/contracts/**
infrastructure/persistence/**
```

No current Provider may be backfilled as a proven direct executor merely because it is ACTIVE or has historical work.

### Compatibility

The contract must reuse `providerId` and `providerWorkspaceId`.

It must not create a second Provider Registry.

Responsibility state remains independent from operational state.

It remains independent from Network Participation state.

It remains independent from Visibility Policy.

Visibility still controls which disclosure fields may be exposed.

A transparent legally required signer is not hidden rebrokering.

Missing proof fails closed when direct execution is required.

### Risk

The critical risk is defaulting current Providers to direct executor without evidence.

The secondary risk is confusing a legally required disclosed signing entity with a prohibited hidden intermediary.

## 23. Explicit non-goals

No runtime Discovery service is implemented here.

No Discovery HTTP endpoint is implemented here.

No migration is implemented here.

No Gateway route is implemented here.

No shared contract is edited here.

No Lite, Core, Execution, Capability, Payment, or MarkReg code is edited here.

No Provider Selection runtime is implemented here.

No Allocation behavior is changed here.

No ranking score, marketplace, bidding system, or public Provider directory is created here.

No live Provider contact is authorized here.

No payment, filing, or Official Truth is created here.

#371 stops at an accepted MGSN-owned boundary document and precise Shared Dependency Requests.
