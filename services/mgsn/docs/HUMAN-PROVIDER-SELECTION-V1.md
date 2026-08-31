# Explicit Human Provider Selection V1

## 1. Status and scope

**MGSN-P0-003 / #382, parent #358.**

This document freezes the MGSN-owned boundary between a Provider Discovery candidate and any later routing, Allocation, or Controlled Handoff action.

The V1 path is:

```text
Provider Discovery candidate
→ human review
→ explicit human selection
→ current-selection validation
→ later Controlled Handoff review
```

The V1 path is not:

```text
Provider Discovery candidate → automatic winner → Allocation
```

Human Provider Selection is a separate authority record.

It is not M4 Allocation.

It is not Provider Acceptance.

It is not professional appointment.

It is not Provider engagement or external contact.

It is not an Execution M13 protected-action release.

It does not authorize filing, payment, or Official Truth.

This issue is documentation-only.

It does not implement a selection service, database, API, Gateway route, UI, or cross-lane contract.

## 2. Permanent authority locks

The permanent MGSN authority model remains unchanged.

```text
Provider Candidate != Provider Selection
Provider Selection != Allocation
Eligibility != Allocation
Allocation != Provider Acceptance
Provider Acceptance != legal/professional appointment
Provider Return != Official Truth
Evidence Handoff != Filing Submission
Payment != Performance / Acceptance / Completion
```

The permanent network principles remain unchanged.

```text
Private First
Trust Before Exposure
Evidence Before Ranking
Human Choice Before Routing Action
Relationship Ownership Remains with Organizations
Direct-to-Executor
No Rebrokering
```

AI may summarize evidence, compare candidates, explain tradeoffs, and recommend candidates.

AI must not create the selection action.

Only an explicitly authorized human action may create a Provider Selection.

## 3. Existing boundaries that Selection consumes

Provider Selection consumes a Provider Discovery candidate.

It does not recreate Provider Discovery.

The candidate must preserve the #371 semantics of evidence-backed explanation and consequence-negative authority.

Selection also consumes the #359 Network Participation and Visibility model as a current-authority gate.

Provider ACTIVE is not participation.

Participation ACTIVE is not visibility.

Visibility is not Selection.

Selection also consumes current Provider operational and Supply evidence from the existing M4 substrate.

It does not change Provider Registry, Supply Capability, Service Package, Eligibility, Allocation, Acceptance, Return, or Evidence Handoff semantics.

Where the product flow requires proof of direct execution, Selection also depends on the future canonical responsibility state tracked by #375.

Missing direct-executor proof must fail closed where that proof is required.

## 4. Selection input boundary

A selection command must reference one exact discovery candidate.

The candidate reference must include or resolve to an exact discovery result version or fingerprint.

The selection must identify the originating requester Workspace through trusted Principal or session context.

The selecting actor identity must come from trusted authentication context.

The service must not trust a request-body `selectedBy` value as authority.

The selection scope must reference the consumer-owned Need or work-package scope.

MGSN must not create a second customer workflow object merely to store Selection.

The command must identify the chosen Provider through the candidate lineage.

The command must include an explicit human confirmation.

The command must include an acknowledgement that Selection does not appoint, contact, allocate, or bind the Provider.

The command may include a bounded human rationale or reason code.

The command must include an idempotency key and correlation reference when the canonical shared contract supports them.

The command must not contain raw end-client contact, originating margin, unrelated customer data, or copied evidence artifacts.

## 5. Explicit human action

A Provider Selection exists only after an affirmative human action.

Viewing a candidate does not select it.

Opening a comparison does not select it.

AI ranking or recommendation does not select it.

A default radio button does not select it unless the human explicitly confirms the action.

A timeout does not select a candidate.

A previous selection for another Need does not select a candidate for the current Need.

A system retry may replay an already committed selection idempotently.

A system retry may not create a new selection from an uncommitted recommendation.

## 6. One current selection per V1 scope

V1 assumes one current Provider Selection for one explicit selection scope.

The selection scope is derived from the consumer-owned Need or work-package reference.

If the product later requires multiple Providers for one business objective, each independently governed selection must use an explicit separate selection scope or a later versioned extension.

V1 does not silently create a multi-winner selection model.

Creating a new valid selection for the same scope supersedes the previous current selection.

The previous selection remains available as historical audit evidence.

Supersession does not delete the previous record.

Supersession does not create Allocation or engagement for the new Provider.

## 7. Selection record lifecycle

The durable selection record has three V1 lifecycle states.

```text
CURRENT
SUPERSEDED
REVOKED
```

`CURRENT` means the record is the latest explicit human choice for its selection scope.

`CURRENT` does not mean the choice is currently usable for handoff.

Current usability must be evaluated separately against live authority and source state.

`SUPERSEDED` means another explicit human selection replaced this record for the same scope.

A superseded selection remains historical evidence and cannot authorize a new handoff.

`REVOKED` means an authorized human explicitly withdrew the selection before a later action may rely on it.

A revoked selection remains historical evidence and cannot authorize a new handoff.

A revoked selection cannot be resumed by changing Provider operational state, participation state, or visibility policy.

A new choice after revocation creates a new Selection authority record.

## 8. Record state is separate from current usability

Selection lifecycle state and current usability are separate concepts.

A `CURRENT` selection may become unusable without rewriting history.

Examples include a stale candidate, withdrawn visibility, paused participation, suspended Provider, stale Supply, or missing direct-executor proof.

A future selection-validation result may distinguish conditions equivalent to:

```text
VALID_FOR_HANDOFF_REVIEW
STALE_CANDIDATE
PARTICIPATION_NOT_ACTIVE
VISIBILITY_NO_LONGER_AUTHORIZED
PROVIDER_NOT_OPERATIONAL
SUPPLY_NOT_CURRENT
DIRECT_EXECUTOR_NOT_ESTABLISHED
SOURCE_VERSION_MISMATCH
SELECTION_SUPERSEDED
SELECTION_REVOKED
AUTHORITY_UNAVAILABLE
```

These are validation outcomes, not necessarily new persisted Selection lifecycle states.

This separation prevents operational changes from rewriting the historical fact that a human made a choice.

## 9. Selection-time revalidation

A candidate must be revalidated before a new Selection may be created.

The requester Workspace must still be authorized.

The selecting actor must have current authority for the requester Workspace and selection action.

The referenced discovery candidate must be exact and current enough for the selection policy.

The Provider reference must match the candidate lineage.

The relevant Provider operational state must still be compatible.

The relevant Supply source must still be current enough for the Need.

Network Participation must still be ACTIVE.

The visibility policy must still authorize the Provider projection needed to make the selection.

TRUSTED relationship authority must still be current when the candidate depended on TRUSTED visibility.

Direct-executor evidence must be current when the product flow requires it.

If any mandatory current authority cannot be verified, the selection must fail closed.

A stale positive discovery cache is not sufficient selection authority.

## 10. Handoff-time revalidation

A `CURRENT` selection is not a durable permit to hand off data forever.

Before a later Controlled Handoff may consume the Selection, current authority must be evaluated again.

The Selection must still be `CURRENT`.

The Selection must not be revoked or superseded.

The chosen Provider must still match the exact selection lineage.

The Provider must still satisfy the relevant operational gate.

The required participation, visibility, and direct-executor state must still be valid for the handoff purpose.

A separately authorized privacy envelope must define what data may be handed off.

The later protected-action path must independently authorize external contact or provider instruction where required.

Historical Selection alone cannot bypass those controls.

## 11. Visibility withdrawal after selection

Selection does not freeze a Provider's visibility grant.

If the Provider pauses or revokes participation, a historical Selection remains in the audit trail.

It does not create new discovery or handoff exposure.

If the Provider contracts visibility so the relevant projection is no longer authorized, the old Selection must not be used as a new exposure permit.

A separately valid already-existing collaboration obligation may have its own authority basis.

That separate authority must be evaluated independently.

The withdrawn discovery grant cannot be reused as the authority for a new collaboration action.

## 12. Selection authority consequences

Creating a Provider Selection may establish only these facts:

```text
an authorized human chose one candidate
for one bounded selection scope
at one point in time
with exact candidate lineage
```

It must explicitly not create the following consequences:

```text
providerAllocated = false
providerAccepted = false
providerEngaged = false
professionalAppointmentCreated = false
externalContactAuthorized = false
servicePackageCreated = false
filingAuthorized = false
filingSubmitted = false
paymentAuthorized = false
paymentCreated = false
officialTruthCreated = false
matterCompleted = false
```

Selection may become a prerequisite reference for later governed actions.

A prerequisite reference is not the later action itself.

## 13. Selection and M4 Allocation

M4 Allocation remains an existing independent MGSN execution-state decision.

Selection must not rename, wrap, or mutate M4 Allocation.

An existing Allocation record is not retroactively a Human Provider Selection.

A Human Provider Selection is not automatically converted into Allocation.

A future productized routing path may require a current Selection reference before creating a new Allocation for a human-choice flow.

That future integration must be explicit and must preserve M4's existing exact Service Package and Eligibility lineage.

This boundary does not change the existing `AllocateProviderCommand` or Allocation state machine.

Historical M4 workflows remain valid under their original authority model.

## 14. Selection and Provider Acceptance

Selection is an action by the originating/requesting Workspace.

Provider Acceptance is a later Provider-side response to an Allocation in the existing M4 substrate.

The two actions have different actors and different authority.

A selected Provider has not accepted work.

A selected Provider must not be shown as accepted.

A Provider Acceptance cannot be inferred from profile status, availability, trust, prior history, or Selection.

## 15. Selection and professional appointment

Selection is a product routing choice.

It is not a legal or professional appointment.

It does not create an attorney-client relationship or equivalent professional relationship.

It does not create agency authority.

It does not authorize signing or filing.

It does not authorize use of Applicant or Trademark Owner data.

Any legally operative appointment or authorization must remain in the proper owner/professional process.

## 16. Selection and M13

Execution M13 remains a later protected-action boundary.

Human Provider Selection does not release an M13 action.

M13 does not create Human Provider Selection on behalf of the user.

A future integration may require an M13 provider reference to match the current Selection reference.

That validation must not allow M13 to create or rewrite Selection.

The protected-action release still needs its own user authority and evidence.

## 17. Privacy model

Selection stores bounded references and audit evidence.

It must not become a copy of the customer file.

A Selection may retain the Provider reference.

It may retain the discovery candidate reference and exact fingerprint or version.

It may retain the Need or selection-scope reference.

It may retain the authorized actor reference and authority basis.

It may retain selection time, reason code, bounded rationale, correlation, and idempotency metadata.

It may retain current and historical lifecycle versions.

It must not retain end-client contacts merely because they existed in the consumer workflow.

It must not retain the Originating Workplace's quote, margin, or profit.

It must not copy unrelated communications.

It must not copy unrelated trademark assets or matter documents.

It must not copy raw Provider evidence where a reference is sufficient.

Relationship ownership remains with the organizations.

## 18. Applicant and Trademark Owner data

Applicant and Trademark Owner official information is not Selection data.

Selection does not authorize transmission of Applicant or Owner official information.

A later Controlled Handoff may transmit the minimum official data necessary for an authorized professional purpose.

That later handoff requires its own purpose, scope, data-class authorization, expiry, and audit.

Selection does not substitute for that privacy authorization.

## 19. Direct-to-Executor validation

Selection must preserve Direct-to-Executor and No Rebrokering.

Where the product flow requires a direct execution Provider, the Selection must not be treated as usable unless the canonical responsibility profile establishes the required state.

The responsibility profile is tracked by #375.

A missing profile is not proof of direct execution.

An ACTIVE Provider is not proof of direct execution.

Historical successful work is not proof of current direct execution.

A legally required distinct signer or filing entity must be transparently disclosed.

Transparent legal necessity is not the same as hidden rebrokering.

## 20. Idempotency and concurrency

Selection creation must be idempotent.

The same idempotency key with the same exact request may replay the same Selection result.

The same idempotency key with a different candidate, scope, actor authority, or payload must fail with conflict.

Two concurrent attempts to create different current Selections for the same V1 scope must not leave two current winners.

The persistence contract must enforce one current Selection per V1 selection scope.

A valid supersession must atomically create or promote the new current Selection and retire the previous current Selection as historical `SUPERSEDED`.

A concurrent revoke must not be lost behind a stale supersession request.

Exact expected versions or equivalent optimistic concurrency semantics are required.

Historical idempotent replay cannot undo revocation or supersession.

## 21. Audit and provenance

Every Selection mutation must be attributable.

A future durable record must establish the requester Workspace.

It must establish the trusted selecting actor and authority basis.

It must establish the selection scope.

It must establish the exact discovery result and candidate lineage.

It must establish relevant source versions or fingerprints.

It must establish previous and new Selection state.

It must establish reason or bounded rationale.

It must establish authorization or acknowledgement references where required.

It must establish correlation, idempotency, and mutation time.

It must preserve supersession and revocation lineage.

The audit record must remain privacy-safe.

Historical audit must never reactivate a Selection.

## 22. Negative acceptance cases

AI recommends a Provider but no human confirms.

Required result: no Selection.

The UI displays one candidate first.

Required result: display order does not create Selection.

The user previously selected the Provider for another Need.

Required result: no Selection for the current scope.

The candidate is stale.

Required result: reject or require current reevaluation before Selection.

Participation is PAUSED.

Required result: deny a new Selection based on network exposure.

Participation is REVOKED.

Required result: deny a new Selection based on the revoked network authority.

Visibility has been contracted since candidate generation.

Required result: stale candidate exposure cannot create a new Selection.

TRUSTED authority is no longer current.

Required result: deny the Selection where the candidate depended on that authority.

Provider operational state is incompatible.

Required result: deny the Selection as currently usable.

Required Supply source is stale or incompatible.

Required result: deny current Selection creation until reevaluated.

Direct-executor proof is required but missing.

Required result: fail closed.

The request body supplies another user's `selectedBy` identity.

Required result: ignore payload identity and deny unless trusted Principal authority independently permits the action.

A user without authority for the requester Workspace submits a Selection.

Required result: deny without disclosing private candidate state.

The same idempotency key is replayed with the same payload.

Required result: return the same committed Selection result.

The same idempotency key is replayed with a different Provider.

Required result: conflict.

Two users concurrently select different Providers for the same V1 scope.

Required result: exact concurrency rules leave at most one `CURRENT` Selection.

A Selection is `SUPERSEDED`.

Required result: it cannot authorize a new handoff.

A Selection is `REVOKED`.

Required result: it cannot authorize a new handoff.

A `CURRENT` Selection references a Provider whose current authority has changed.

Required result: preserve historical Selection but fail current handoff validation.

A current Selection exists.

Required result: no automatic Allocation, Acceptance, appointment, external contact, filing, payment, or Official Truth.

## 23. Shared Dependency Request: Human Provider Selection V1 contract

### Goal

Create a canonical cross-lane Human Provider Selection contract that preserves explicit human authority and separates Selection from Candidate, Allocation, Acceptance, appointment, and protected action.

### Why

MGSN owns the Provider Selection truth, but Discovery candidates and later Controlled Handoff or Execution references cross product boundaries.

A shared contract is required so consumers cannot infer stronger authority from the Selection record.

### Producer

MGSN.

### Consumers

Future Controlled Handoff is a consumer.

A future MGSN Allocation adapter for human-choice flows may consume the Selection reference without changing M4 Allocation semantics.

Execution M13 may later validate a matching Provider reference through a separate integration boundary.

Lite or another Workplace UI may consume Selection state for display without becoming the owner of Selection truth.

### Contract

Minimum proposed concepts are:

```text
ProviderSelectionId
ProviderSelectionState
ProviderSelectionScopeReference
ProviderDiscoveryCandidateReference
ProviderSelectionSourceSnapshot
ProviderSelection
ProviderSelectionValidationResult
CreateProviderSelectionCommand
SupersedeProviderSelectionCommand
RevokeProviderSelectionCommand
ProviderSelectionAuthorityConsequences
```

`ProviderSelectionState` must preserve semantics equivalent to:

```text
CURRENT
SUPERSEDED
REVOKED
```

The contract must keep current usability separate from lifecycle history.

The contract must reference exact discovery candidate and source lineage.

The actor must come from trusted Principal context at runtime rather than an untrusted payload field.

The contract must support exact versions, idempotency, correlation, and bounded human rationale.

The authority consequences must explicitly remain false for Allocation, Acceptance, appointment, external contact, filing, payment, and Official Truth.

### Requested paths

The shared contract belongs under:

```text
packages/contracts/**
```

Durable Selection persistence and migration ownership will require a separate Integration issue under:

```text
infrastructure/persistence/**
```

Authenticated Gateway or consumer wiring must remain separately scoped.

### Compatibility

The contract must preserve #371 Candidate semantics.

It must preserve #359 participation and visibility semantics.

It must preserve #375 direct-executor responsibility as a separate source of evidence.

It must not change M4 Allocation, Acceptance, or Return contracts.

It must not create a second Provider Registry, Workspace identity, Capability Engine, or Execution workflow.

It must preserve M13 as a separate protected-action boundary.

### Acceptance

Shared fixtures must prove Candidate is not Selection.

Shared fixtures must prove Selection is not Allocation.

Shared fixtures must prove Selection is not Acceptance or appointment.

The contract must represent exact candidate lineage and current-validation requirements.

The contract must represent supersession and revocation without destructive history mutation.

The contract must support one current Selection per V1 selection scope.

The consequence fixture must create no protected external action.

Exact-head CI must be green.

### Risk

The primary risk is using the existing M4 Allocation object as a shortcut for Human Selection.

That would erase the permanent Candidate-to-Selection-to-Allocation authority separation.

Another risk is treating a historical Selection as durable permission after participation, visibility, Provider, or direct-executor authority changes.

## 24. Future persistence dependency

Selection requires durable MGSN-owned state after the shared contract is accepted.

The persistence owner should remain `@markorbit/mgsn-service`.

No migration is implemented in #382.

A later migration must not derive or backfill Selections from existing Allocations.

Existing M4 Allocations must not become historical Human Selections by migration.

The migration must preserve one-current-selection-per-scope semantics, exact versions, idempotency replay, supersession, revocation, and privacy-safe audit.

## 25. Controlled Handoff boundary

Controlled Handoff is the next separate authority boundary after Selection.

It must consume a currently valid Selection.

It must separately define purpose, scope, data classes, permissions, expiry, revocation, and audit.

It must enforce data minimization and customer-relationship protection.

It must revalidate direct-executor and current Provider authority where required.

It must remain separate from M13 protected external action and from M4 Allocation.

This document does not freeze the complete Handoff contract.

## 26. Explicit non-goals

No Selection runtime is implemented here.

No Selection HTTP API is implemented here.

No Selection database or migration is implemented here.

No Gateway route is implemented here.

No shared contract is edited here.

No Core, Lite, Execution, Capability, Payment, or MarkReg code is edited here.

No Allocation, Acceptance, or Return behavior is changed here.

No Controlled Handoff runtime is implemented here.

No Provider engagement or live contact is authorized here.

No ranking score, marketplace, or bidding system is created here.

No filing, payment, or Official Truth is created here.

#382 stops at an accepted MGSN-owned Selection boundary and a precise Shared Dependency Request.
