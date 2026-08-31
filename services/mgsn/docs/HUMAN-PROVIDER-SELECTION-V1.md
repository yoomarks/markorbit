# Explicit Human Provider Selection V1

## 1. Status and scope

**MGSN-P0-003 / #382, parent #358.**

Audited against fetched `origin/main` at `eae62894b74ed5bd50ae589b906d77eb46afa771` in the dedicated `mgsn-c` worktree. The existing #382 branch draft is retained and reconciled here; no other Lane is changed.

**Implemented** refers only to the existing M4/M12/M13 source references below. All Selection semantics in this document are a **V1 Boundary / Not Implemented**; shared contracts and durable enforcement are **Future / Shared Dependency**. Contracts changed: **NONE**. Events emitted or consumed by #382: **NONE**.

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

AI must not allocate, appoint, accept on behalf of a Provider, contact a Provider, file, pay, or create Official Truth. Provider Supply Capability remains private supply-side operating truth, not user Capability verification.

## 3. Existing boundaries that Selection consumes

Read-only evidence for this freeze:

| Source                                                                                                                                                                                        | Reused boundary / limitation                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [AGENTS.md](../../../AGENTS.md) and [Network Participation & Visibility V1](NETWORK-PARTICIPATION-VISIBILITY-V1.md)                                                                           | Core owns Workspace identity; no-row participation is NOT_PARTICIPATING/PRIVATE; historical authorization is not current exposure permission.                                                                                     |
| [Discovery boundary at PR #374 head](https://github.com/yoomarks/markorbit/blob/78e6f91a4fb5d85581245f31caa88e7b82d3d7b3/services/mgsn/docs/PROVIDER-DISCOVERY-EXPLAINABILITY-V1.md) for #371 | Reviewed from that exact PR context; not present on this base's main. Candidate-only authorized projections, separate exposure/suitability gates and exact source lineage. #382 does not merge or redefine that pending boundary. |
| [provider-registry.ts](../src/provider-registry.ts), [provider-registry-postgres.ts](../src/provider-registry-postgres.ts)                                                                    | Existing `providerId` / `providerWorkspaceId`, ACTIVE creation, exact versions and transactional audit/replay; no human Selection or final-executor proof.                                                                        |
| [service-package-eligibility.ts](../src/service-package-eligibility.ts)                                                                                                                       | Private candidate-supply listing and exact Service Package/Eligibility checks are not canonical Discovery candidates or human Selection.                                                                                          |
| [allocation-provider-acceptance.ts](../src/allocation-provider-acceptance.ts), [provider-execution.ts](../../../packages/contracts/src/provider-execution.ts)                                 | Allocation is an explicit operational decision; Provider Acceptance uses authenticated Provider Workspace identity and exact Allocation lineage. Neither supplies the missing Selection record.                                   |
| [http.ts](../src/http.ts), [http-boundary.test.ts](../tests/http-boundary.test.ts)                                                                                                            | Trusted internal Principal, permissions, Workspace isolation and idempotency patterns; existing `execution:manage` is not by itself a new Selection permission or evidence of human confirmation.                                 |
| [M12 matching](../../lite/src/trademark-service-candidate-matching.ts), [M13 execution](../../execution/src/trademark-service-execution.ts)                                                   | Candidate-only results and separately protected Provider handoff; no Selection runtime in either source.                                                                                                                          |

The inspected [Registry](../tests/provider-registry-postgres.test.ts), [Eligibility](../tests/service-package-eligibility-postgres.test.ts) and [Allocation/Acceptance](../tests/allocation-provider-acceptance-postgres.test.ts) tests cover Core-reference isolation, stale lineage, replay, concurrent Allocation and authenticated Provider responses. They are evidence for M4 behavior, not tests of Selection enforcement. #367, #381 and #375 remain separate shared dependencies; no corresponding Selection, Discovery or responsibility contract is implemented in the audited MGSN source.

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

A selection command must reference exactly one canonical Discovery candidate from #381, not a Provider ID alone, list index, display name or whole Provider record. Required inputs and retained references are:

| Input / lineage               | Required meaning                                                                                                                                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requester and selection scope | Trusted originating Core Workspace reference plus consumer owner, Need/work-package reference and exact source version. The scope is bounded to that Workspace and purpose; MGSN creates no second customer workflow.                                       |
| Discovery request and result  | Exact request reference and result version/fingerprint, requester, Need version, purpose, audience/context, generation time and evaluation policy version.                                                                                                  |
| Exact candidate               | Candidate identity and exact version/fingerprint within that result, preserving existing `providerId` and `providerWorkspaceId`. Provider Workspace is not the requester Workspace.                                                                         |
| Exposure lineage              | Participation authorization/reference/version, visibility policy version and authorized projection/purpose/context; current Trusted relationship authority reference/version when applicable.                                                               |
| Suitability lineage           | Exact Provider and relevant Supply IDs/versions/fingerprints, source authority, effective period and freshness bounds; relevant Capability/evidence versions; existing Eligibility/Service Package exact references only when that flow uses them.          |
| Responsibility lineage        | Canonical #375 disclosure reference/version, evidence/attestation source, effective period and current state where direct-executor proof is required. Missing proof never defaults to true.                                                                 |
| Human decision                | Affirmative confirmation bound to the reviewed candidate, scope and source versions; acknowledgement that Selection does not appoint, contact, allocate or bind the Provider. Optional bounded rationale/reason code cannot carry private customer content. |
| Trusted attribution           | Authenticated selecting user/Principal, current Workspace membership and Selection authority basis, and service-recorded `selectedAt`. A payload timestamp or actor label is not authority.                                                                 |
| Mutation control              | Mandatory idempotency key, correlation reference and expected current selection/scope version (or explicit absence for first creation). Replacement/revocation targets exact Selection ID/version.                                                          |

Selection retains bounded exact references, not copies of source objects, customer documents or raw evidence. Immutable canonical source references may resolve this lineage instead of duplicating it; unresolved or contradictory mandatory lineage denies Selection.

**Trusted actor rule:** authenticate and authorize before private candidate reads or replay. Resolve current user, Workspace and membership through the existing Core/Principal boundary. A payload actor reference describes a claim; only the trusted authenticated Principal can authorize Selection. Reject a mismatched/spoofed `selectedBy`, actor or Workspace claim even if the caller otherwise has permission. Do not act as the named user, silently accept the mismatch or infer consent from a service credential. Permission is necessary but not sufficient: the affirmative human action must also be established. The shared API must define the Selection permission mapping; this document grants no new role authority.

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

Highest score, first/only/cheapest candidate, previous success, previous Allocation, automatic workflow progression, Eligibility, Provider ACTIVE, network participation, payment and prior Provider Return are never affirmative human actions. A payload `humanConfirmed = true` alone cannot prove one; the authenticated action must be attributable to the human and bound to the exact reviewed candidate/scope. If refreshed evidence changes that candidate or its decision-relevant lineage, return it for new human review rather than silently moving the confirmation to a new version.

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

| From                  | Authorized action                                                                                   | Result                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| No Selection in scope | Human confirms exact candidate; current checks pass; expected absence matches                       | New CURRENT Selection. Absence creates no choice.                                                                                 |
| CURRENT               | Human confirms a replacement after review; expected current ID/version matches; current checks pass | Atomically append old SUPERSEDED transition and create a new CURRENT record. A second candidate never leaves two current choices. |
| CURRENT               | Authorized human explicitly revokes the exact current ID/version                                    | REVOKED; no replacement or downstream authority. Revocation does not require the candidate to remain eligible/visible.            |
| SUPERSEDED or REVOKED | Attempt to resume/reuse old record                                                                  | Deny. A new human choice creates a new record after full current validation.                                                      |
| Any                   | Exact committed action replay with current caller authorization                                     | Same historical action result; no new transition and no claim of present usability.                                               |

All unspecified lifecycle transitions are denied. The original decision, timestamps, acknowledgement and audit entries are immutable. Later status transitions append attributable history and update only the current-state projection; they do not overwrite the original choice. A failed replacement leaves the prior lifecycle state unchanged, without implying that it still passes current usability checks. A separate explicit reconfirmation of the same Provider is a new decision, not a replay; it must name current candidate lineage and may supersede the previous record.

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

Revalidation must verify the exact candidate/source tuple in section 4 against authoritative owner contracts, not merely accept cached `current`/`operational` flags. No-row participation, PRIVATE or insufficient field/purpose/audience grants, archived/missing Core Workspace, inactive membership, Provider SUSPENDED/INACTIVE, expired effective periods, mismatched versions/fingerprints and unavailable authority dependencies all deny creation of a current usable Selection.

The selection policy must name its version and source freshness bounds; unknown freshness is not unlimited validity. Required Supply/eligibility facts include jurisdiction, service type, applicable effective period and operational constraints. An M4 Eligibility record is required only where the flow actually consumes one: do not create a Service Package or Eligibility evaluation merely to make pre-Allocation Selection exist. Its absence is not a fabricated ELIGIBLE result. Mandatory unknowns fail closed; optional limitations remain explicit and cannot be promoted to positive evidence.

Recheck authoritative versions at the decision/commit boundary. If a concurrent pause, revoke, contraction or source revision invalidates the reviewed tuple, reject or require fresh review; do not commit a usable choice from a prior positive read. This is a later bounded owner-contract/persistence requirement, not permission for cross-service SQL.

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

Handoff-time validation must also verify the consuming actor's current authority for the originating Workspace, exact current Need/scope and applicable Supply/eligibility/effective-period facts. A successful validation is purpose-, requester- and version-bound evidence for that attempted review, not a reusable protected-action permit. A validation-to-use race must fail closed or be revalidated at consumption. Supersession/revocation affects future reliance; it does not cancel, rewrite or reverse any already separately authorized M4/M13 action.

## 11. Visibility withdrawal after selection

Selection does not freeze a Provider's visibility grant.

If the Provider pauses or revokes participation, a historical Selection remains in the audit trail.

It does not create new discovery or handoff exposure.

If the Provider contracts visibility so the relevant projection is no longer authorized, the old Selection must not be used as a new exposure permit.

A separately valid already-existing collaboration obligation may have its own authority basis.

That separate authority must be evaluated independently.

The withdrawn discovery grant cannot be reused as the authority for a new collaboration action.

#382 grants no existing-collaboration exception to Selection creation or consumption. If another action claims a separate existing-collaboration authority, its owner must establish it in a later scoped contract; neither this document nor a Selection record invents it. Historical Selection reads and audit/evidence dereferences remain permission-controlled and must not republish withdrawn Provider projections.

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
protectedActionReleased = false
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

```text
Human Selection != M13 release
M13 release != Provider Acceptance
```

Current M13 `createTrademarkServiceProviderHandoff` preserves `targetOwner = MGSN`, `providerEngagementCreatedByExecution = false` and `providerAcceptanceCreatedByExecution = false`. Selection changes none of these. M12 matching continues to return `providerEngagedByLite = false`, `providerSelectedByLite = false`, `servicePackageSelectedByLite = false` and `protectedActionAuthorized = false`; recording a separate MGSN Selection must not mutate the historical candidate's false consequences.

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

This includes client email, phone and CRM details. Rationale, acknowledgements, audit metadata and reference labels are subject to the same restrictions; free text is not a privacy bypass. Raw private evidence artifacts are excluded even when the actor can view them elsewhere.

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

```text
Allowed: Originating Workplace → MGSN → Final Execution Provider
Denied:  Originating Workplace → Broker → Sub-agent → Final Provider
```

The requirement for proof comes from the authoritative flow/policy, not an optional caller flag. Unknown, stale, suspended, revoked or prohibited/rebrokering disclosure cannot satisfy that requirement. #375 must establish final-executor status, direct responsibility, no-rebrokering state and any required distinct signer, with current source evidence; #382 must not infer these from existing Registry fields.

## 20. Idempotency and concurrency

All Selection mutations require idempotency and exact expected versions. Scope keys include the originating Workspace and consumer-owned selection scope; request fingerprints bind the action, exact candidate/source tuple, acknowledgement, actor and authority basis. The same authorized committed action replays once; a different candidate, scope, actor or payload under the same key is a conflict.

Authenticate and check current caller access before replay. Return the original historical action result without asserting current usability or restoring any prior status. No new decision, supersession, revocation or audit mutation is created by replay. An uncommitted recommendation is not replayable human authority.

At most one CURRENT Selection may exist for a V1 Workspace/scope. First creation asserts absence; replacement names the expected current Selection ID/version and scope version. Revoke names the exact current Selection. Commit the new record, prior SUPERSEDED transition, scope version, command result and privacy-safe audit atomically. Do not promote an old SUPERSEDED/REVOKED record back to CURRENT.

Concurrent replacement/revoke or competing choices must serialize or reject stale expected versions; they cannot lose a revocation or leave two current choices. Rejected revalidation/transaction failure creates no partial Selection authority and does not supersede the prior record. Its continuing usability still requires current checks. These are future persistence requirements, not a distributed transaction or Execution workflow designed in #382.

## 21. Audit and provenance

Every mutation must establish the originating Workspace, consumer-owned scope, trusted actor/authority basis, affirmative human action and acknowledgement, exact Discovery request/result/candidate, relevant source versions/fingerprints and validation policy/time, previous/new lifecycle state and versions, bounded reason, service-recorded occurrence/selection time, correlation, idempotency and supersession/revocation references.

Preserve the original human choice and append-only mutation evidence. Selected-at time belongs to the committed decision; later updates and replay do not rewrite it. Audit retention is private and permission-controlled, not a rediscovery channel or a permit to dereference private evidence. Do not store raw Provider/Supply records or customer content in audit, rationale or reference labels. Retention never reactivates authority.

## 22. Negative acceptance cases

These are required future contract/runtime acceptance cases, not tests of an implemented Selection service in #382.

| Case                                                                                                                                 | Required result                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| AI recommends Provider A; human has not confirmed                                                                                    | No Selection. AI cannot execute the decision.                                                                                        |
| Highest score, first/only/cheapest candidate, prior success, Allocation or Provider Return                                           | No Selection by inference; affirmative review/confirmation required.                                                                 |
| Eligibility, Provider ACTIVE, participation, payment or automatic workflow transition                                                | No Selection by inference.                                                                                                           |
| Candidate/result identity or source version/fingerprint is stale/mismatched                                                          | Do not create a current usable Selection; refresh and obtain human confirmation for changed decision-relevant lineage.               |
| Candidate belongs to another requester, Need or scope                                                                                | Reject; do not disclose private candidate state.                                                                                     |
| Participation NOT_PARTICIPATING/no-row, PAUSED or REVOKED                                                                            | Deny creation/use based on network authority, including cached positive candidates.                                                  |
| Visibility contracted/withdrawn or entirely PRIVATE for this requester/purpose                                                       | Historical candidate/Selection does not restore exposure or handoff authority.                                                       |
| Required TRUSTED relationship evidence missing/stale                                                                                 | Deny creation/use.                                                                                                                   |
| Wrong Workspace Principal, archived Workspace, expired session or inactive membership                                                | Reject before private state disclosure or mutation.                                                                                  |
| Payload spoofs another actor/selectedBy or Workspace, even for an otherwise privileged caller                                        | Reject the mismatch; do not ignore it and accept the action as authorized.                                                           |
| Service credential or payload human-confirmation flag without an attributable human action                                           | No Selection. Authentication/permissions alone are insufficient.                                                                     |
| Provider SUSPENDED/INACTIVE or relevant Supply/eligibility/effective-period facts fail                                               | Do not create/use a current usable Selection.                                                                                        |
| Direct-executor proof required but unknown/missing/stale/revoked; hidden broker chain                                                | Fail closed through #375 dependency; never default to proven.                                                                        |
| A distinct signer is legally required                                                                                                | Require current transparent disclosure; do not silently treat it as proof or as hidden rebrokering.                                  |
| Authority source unavailable or freshness bounds unknown                                                                             | Deny current usable Selection; no permissive cache fallback.                                                                         |
| Same exact committed human action replayed idempotently                                                                              | Same historical result, no duplicate conflicting authority record; revalidate before any future use.                                 |
| Same key reused with changed candidate, actor, scope or payload                                                                      | Conflict, no mutation.                                                                                                               |
| User affirmatively selects a second valid candidate for the same scope                                                               | Atomically supersede prior CURRENT Selection using exact expected versions; retain immutable choice history.                         |
| Concurrent choices, replacement/revoke, or source/visibility change between check and use                                            | At most one CURRENT record; reject stale mutations/revalidate consumption; no lost revocation or stale usable choice.                |
| Selection SUPERSEDED or REVOKED; an old create action is replayed                                                                    | Cannot be consumed as current authority; replay cannot restore it.                                                                   |
| CURRENT Selection whose current authority has since changed                                                                          | Preserve historical choice but deny downstream use; CURRENT alone is insufficient.                                                   |
| Valid Selection exists                                                                                                               | Allocation remains not created by Selection; existing M4 history is unchanged.                                                       |
| Valid Selection exists                                                                                                               | Provider Acceptance and engagement remain not created; appointment remains false.                                                    |
| Valid Selection exists                                                                                                               | External Provider contact and M13 protected-action release remain unauthorized by Selection.                                         |
| Valid Selection exists                                                                                                               | Filing authorization/submission, Payment authorization/creation and Official Truth remain false.                                     |
| Client email/phone/CRM, quote/margin/profit, unrelated data, Applicant/Owner details or raw evidence supplied in Selection/rationale | Reject prohibited content; no copying into decision/audit or generic Provider exposure.                                              |
| Human revokes after candidate visibility or suitability is lost                                                                      | Permit withdrawal with current actor/scope authority and exact Selection version; no positive candidate validation needed to revoke. |

## 23. Controlled Handoff boundary

A future Controlled Handoff consumes a currently valid Selection plus separate purpose, data-class, permission, expiry/revocation and privacy authorization. Selection cannot supply that envelope or authorize Provider instruction/contact. Handoff must independently respect current actor, Provider and direct-executor authority and preserve the M13 protected-action gate and M4 Allocation boundary.

No existing-collaboration exception or complete Handoff contract is created here. A later separately authorized action and any cancellation/obligation it creates remain owned by that later boundary.

## 24. Explicit non-goals

No Selection runtime/API/database/migration, Gateway endpoint, UI, Provider Discovery runtime, Controlled Handoff or Provider Workspace implementation. No shared contract, migration ownership, root CI/config or lockfile changes. No Core, Lite, Execution, Capability, Payment or MarkReg edits.

No change to M4 Provider Registry, Supply, Service Package, Eligibility, Allocation, Acceptance, Return or Evidence Handoff. No second identity/Provider/Capability/Execution system; no Provider engagement, live contact, production credentials/egress, ranking algorithm, universal score, marketplace or bidding. No filing, payment or Official Truth.

#382 stops at the MGSN-owned boundary PR, validation/review evidence and the dependency request below; it does not implement the dependencies.

## 25. Shared Dependency Request: Human Provider Selection V1

### Goal

Implement the minimum canonical Human Provider Selection contract and, in separately scoped Integration work, MGSN-owned persistence and authenticated management wiring. Preserve explicit human choice between Candidate and later Controlled Handoff/Allocation.

### Why

Current M4 contains operational Allocation and Provider Acceptance, not an independent Selection authority record. #382 freezes Selection semantics but cannot safely create cross-lane types, migrations/ownership registration or trusted Gateway wiring under MGSN-owned paths alone. Existing Discovery, participation and direct-executor dependencies must be consumed rather than duplicated.

### Producer

MGSN owns Selection decisions, lifecycle, validation and privacy-safe provenance. Core remains authoritative for authenticated user/Workspace membership; the originating consumer owns the Need/work-package scope. Reuse existing `providerId` / `providerWorkspaceId`, distinct from originating `workspaceId`; no second identity registry or cross-service SQL.

### Consumer

Future Controlled Handoff consumes currently valid Selection references with separate privacy/action authorization. A later MGSN adapter for human-choice Allocation flows may require a Selection without redefining M4. Execution M13 may validate matching Provider/Selection references through a separately authorized integration; it does not create Selection. Lite/Workplace surfaces may display authorized Selection state without owning it or changing M12 candidate consequences.

### Proposed Contract

Names below are proposals; reuse shared primitives and accepted dependency contracts rather than adding equivalent parallel types.

| Concept                                  | Minimum semantics                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProviderSelection` and identifier       | One exact human choice; originating Workspace, consumer-owned selection scope, chosen existing Provider, trusted actor/authority, service-recorded selectedAt, human acknowledgement, bounded rationale, source lineage, version and lifecycle. No whole-record snapshot. |
| `ProviderSelectionStatus`                | CURRENT / SUPERSEDED / REVOKED; original decision/audit immutable, latest projection distinct from current usability.                                                                                                                                                     |
| `ProviderSelectionSourceLineage`         | Section 4 exact Discovery request/result/candidate and relevant owner/source versions, fingerprints, freshness/effective periods, purpose/context and human-reviewed scope. Reuse #381 references; do not define a second Discovery candidate.                            |
| `ProviderSelectionAuthorityConsequences` | Only explicit human selection recorded; all section 12 downstream consequences false, including engagement, protected-action release and external contact. Do not rewrite historical candidate consequences.                                                              |
| Selection mutation command               | Create/replace/revoke semantics with trusted actor context, mandatory idempotency/correlation, exact expected current ID/version or absence and explicit acknowledgement. Replacement uses the creation path with expected prior reference, not a separate workflow.      |
| Selection validation result              | Lifecycle plus current usable/denied result, purpose/requester, exact versions, validation policy/time and privacy-safe reason. No reusable permit or extra persisted Execution lifecycle.                                                                                |

Consume [#367](https://github.com/yoomarks/markorbit/issues/367) for participation/visibility, [#381](https://github.com/yoomarks/markorbit/issues/381) for Discovery candidate lineage, and [#375](https://github.com/yoomarks/markorbit/issues/375) for direct-executor evidence. Missing required authority/proof denies runtime use; it does not block the #382 documentation freeze.

### Requested Paths

- `packages/contracts/**`: Selection vocabulary/exports and fixtures, composed with the canonical dependency references.
- `infrastructure/persistence/**`: separately authorized MGSN migration and ownership-map registration, owned by `@markorbit/mgsn-service`. Guarantee one current Selection per Workspace/scope, exact versions, idempotency conflicts/replay, atomic replacement/revoke/audit, restart durability and immutable history. No backfill from Allocations, recommendations, active Providers or prior work.
- `apps/gateway/**`: separately scoped authenticated read/create-or-replace/revoke management wiring and negative authorization tests. Resolve Core session/Workspace Principal, define explicit Selection permissions, reject spoofed actor/Workspace claims, require applicable CSRF/origin checks and idempotency, and forward trusted context to MGSN. Reuse existing Core contracts; any additional Core/consumer change requires its own scope authorization.

Later runtime/repository tests belong under `services/mgsn/**` after these contracts are accepted. No public Selection/Discovery endpoint, live Provider contact or consumer/UI implementation is requested as part of the shared contract change. No Shared Zone path is edited by #382.

### Compatibility

Preserve #359/#367 Private First participation and visibility, #371/#381 candidate-only authorized projections, and #375 independent responsibility evidence. Missing participation or unknown proof never establishes a positive decision. M4 Allocation and authenticated Provider Acceptance remain separate; an existing Allocation is not a historical human Selection. M13 release remains separately protected and does not imply Acceptance. M12 retains its four false candidate consequences. Selection never expands visibility, permits customer exposure or verifies user Capability.

### Acceptance

Contract fixtures must cover the exact lineage, status/usability distinction, human acknowledgement/trusted actor and all false consequences. Future MGSN unit/HTTP/PostgreSQL checks must cover section 22, especially payload spoofing despite privilege, wrong Workspace, stale/missing authority, visibility withdrawal, missing direct-executor proof, idempotent historical replay and concurrent replacement/revoke with one-current-per-scope enforcement.

Prove denied revalidation leaves no partial choice/supersession; revocation remains available when candidate exposure is withdrawn; cached validation cannot authorize stale downstream use; no private data leaks through errors, reasons or references. Migration/restart tests must prove existing M4 data remains intact, zero inferred/backfilled Selections and retained revocation/supersession history. Required affected-scope and exact-head hosted CI must pass.

### Risk

Primary risks are reinterpreting Allocation as Selection, trusting payload actor/confirmation as human authority, and treating historical CURRENT/replay as durable permission after privacy or source changes. Further risks are source-check/use races, lost revocation, two concurrent current choices, raw customer content in rationale/audit and assuming existing Providers are direct executors. Mitigate with bounded canonical references, trusted affirmative action, exact versions, atomic local writes, current owner revalidation and fail-closed unknowns; do not weaken permanent invariants or introduce cross-service SQL.

### Blocked MGSN work

This request blocks durable Selection runtime/API and cross-lane Selection consumption, not this boundary freeze. #367/#381/#375 and later authorized persistence/Gateway work must supply current authority and exact lineage before runtime can make a usable Selection. Controlled Handoff and M13/Allocation integration require their own protected-purpose contracts and authorization. No dependent implementation or next issue is started by #382.
