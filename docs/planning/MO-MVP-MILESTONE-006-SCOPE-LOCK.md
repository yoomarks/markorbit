# MO MVP Milestone 6 Scope and Architecture Lock

- **Milestone:** `MO-MVP-MILESTONE-006`
- **Planning task:** `MO-MVP-TASK-031A`
- **Status:** `PROPOSED_FOR_APPROVAL`
- **Predecessor:** Milestone 5 / M5-WP-08 final recommendation `GO`, merged in PR #70 as `242b34f806711df608a7178b238104289e65bb00`
- **Proposed direction:** `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`
- **Planning only:** yes
- **Approval evidence:** exact-head hosted validation is required before this planning proposal is presented as ready to merge.

## 1. Why this milestone exists

Milestone 5 completed the governed application/lifecycle loop through reviewed evidence, durable lifecycle projection and non-executing Recommended Actions. It also deliberately deferred Capability learning until reviewed outcomes existed.

That prerequisite now exists. The remaining MVP Product Lock includes a fifth Beta loop — the **Capability learning loop** — and the four-week Beta plan explicitly calls for Capability Profile, Twin projection, Ledger and private Reflection Candidate behavior.

The repository already contains a Capability Engine service, but its current request path is an in-memory fixture with a hard-coded capability/version. It does not yet provide durable Capability evidence, version lineage, Reflection Candidate state, private profile projection or controlled learning.

Milestone 6 proposes to close exactly that gap:

```text
accepted Capability Canon version
-> durable runtime Capability definition/version
-> exact governed work observation
-> durable private Capability Ledger entry
-> explainable private Reflection Candidate
-> explicit subject-user disposition
-> private Capability Profile / Twin projection
```

This milestone is a learning and reflection milestone. It is **not** an automatic qualification, certification, ranking, employment-performance or canon-mutation milestone.

## 2. Selected direction

### `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`

Build the smallest durable, authenticated and auditable path that lets a professional user accumulate exact evidence-backed Capability observations, receive private Reflection Candidates, explicitly accept/reject/defer those candidates, and view a private Capability Profile/Twin projection.

The system may observe governed evidence and propose reflection. It may not silently convert task completion into verified Capability truth.

## 3. Required outcome

At Milestone 6 completion, the repository should prove that:

- Capability Engine has a durable runtime registry/version record for accepted Capability Canon entries rather than relying only on the existing hard-coded fixture;
- runtime Capability definitions preserve Domain → Capability → Skill → Action / Invocation lineage where that lineage is present in the accepted Canon;
- an authenticated Workspace user can admit only an exact governed work observation whose subject identity and source provenance are derived from owner-controlled source data rather than request-body claims;
- raw Provider Return, Provider Supply Capability, Payment, Order state or unreviewed evidence cannot become user Capability evidence;
- Capability Engine persists append-oriented private Ledger entries with exact source identity/version/fingerprint or equivalent stable provenance;
- duplicate/replayed source admission is idempotent and conflicting source semantics fail closed;
- a private Reflection Candidate is explainable, source-linked and explicitly marked non-canonical/non-verified;
- AI may help draft a Reflection Candidate narrative, but AI output cannot accept the candidate, verify Capability or mutate the Capability Canon;
- only an explicit authenticated subject-user disposition may accept/reject/defer a Reflection Candidate;
- accepting a Reflection Candidate updates a **private profile projection**, not a verified qualification or canonical Capability definition;
- a private Capability Twin projection is deterministic from accepted private profile/ledger state and is not an autonomous identity, professional license or public score;
- Lite exposes the private Capability Center through authenticated, Workspace-isolated, direct-URL recoverable desktop/mobile surfaces;
- restart/replay/concurrency tests preserve lineage and do not duplicate Ledger, Candidate or Profile business state.

## 4. Canonical semantic definitions

### Capability Canon

The accepted canonical source that defines MarkOrbit Capability semantics and hierarchy. Runtime services may consume an exact accepted Canon version, but Milestone 6 does not permit runtime work outcomes, AI output or Reflection Candidates to mutate the Canon automatically.

### Runtime Capability Definition

Capability Engine-owned durable runtime record of one exact accepted Capability Canon identity/version and its bounded metadata needed by the product.

A runtime definition is a versioned operational projection of accepted Canon truth. It is not created from user performance evidence.

### Capability Observation

A private, exact, source-linked observation that governed work related to a Capability occurred.

An observation may describe exposure, participation or governed evidence. It does not by itself assert proficiency, qualification, certification or verified competence.

The initial admitted source family must come from owner-controlled governed MarkOrbit work outcomes, such as an exact Execution professional/review decision and/or a reviewed MarkReg lifecycle source. The implementation must preserve the source owner and may not infer user Capability from raw MGSN Provider Return or Provider Supply Capability.

### Capability Ledger Entry

Capability Engine-owned append-oriented private record of an admitted Capability Observation, bound to one Workspace, subject user, runtime Capability version and exact source provenance.

Ledger entries are evidence history, not canonical Capability truth.

### Reflection Candidate

Capability Engine-owned private, explainable candidate generated from one or more exact Ledger entries. It proposes a possible reflection/profile update and retains the evidence and policy/model provenance used to produce it.

A Reflection Candidate is **not canonical truth**, not verified Capability and not a public score.

### Reflection Disposition

Explicit authenticated subject-user decision over one exact current Reflection Candidate version. Minimum dispositions are:

- `ACCEPTED`
- `REJECTED`
- `DEFERRED`

A disposition is private user-governed state. `ACCEPTED` means the user accepts the reflection into their private profile projection; it does not mean MarkOrbit verified professional competence.

### Capability Profile Projection

Capability Engine-owned private current read model derived deterministically from exact accepted reflection dispositions and their Ledger provenance.

The projection may summarize evidence count, recency and accepted reflection text. It must not silently emit a verified qualification, license, ranking or proficiency score.

### Capability Twin Projection

A private Capability-focused projection derived from the current Capability Profile and Ledger. It exists to help the user understand their working Capability shape and gaps.

It is not a legal identity, autonomous agent, professional appointment, public reputation score or source of permission truth.

## 5. Ownership lock

- **Core** owns User, Workspace, Membership, Session, Principal and permission truth.
- **Capability Engine** owns runtime Capability registry/version lineage, Capability Observations after admission, Capability Ledger, Reflection Candidates, Reflection Dispositions, Capability Profile and Capability Twin projections.
- **Execution** owns professional/review decisions and work/evidence truth used as source observations.
- **MarkReg** owns Formal Matter and lifecycle projections used as source context where applicable.
- **MGSN** owns Provider Return and Provider Supply Capability; neither becomes user Capability truth.
- **Gateway** owns authenticated browser/API aggregation and transport policy enforcement.
- **Lite** is a private projection/action surface only and does not become the semantic owner.

No service may read another service's database. Cross-service dependencies use bounded authenticated APIs/contracts with exact source identity/version/fingerprint or equivalent stable provenance.

## 6. Capability Canon and runtime registry lock

Milestone 6 may persist the runtime form of an accepted Capability Canon version so that Ledger and Profile state can bind to an exact Capability identity/version.

Rules:

- accepted Canon identity/version is explicit;
- runtime records retain version lineage;
- runtime work evidence cannot create or rewrite a Canon definition;
- AI cannot publish a new Canon version;
- a user cannot promote a private reflection into Canon truth through the profile UI;
- the existing hard-coded `trademark-application-recommendation` fixture must not be treated as sufficient canonical version lineage for the completed M6 loop.

A broader Canon authoring/publishing workflow is outside this milestone.

## 7. Observation admission and Ledger lock

Capability Observation admission must be:

- Workspace-scoped and subject-user-scoped;
- authenticated through Core Session/Principal truth;
- tied to an exact runtime Capability definition/version;
- tied to one exact governed source identity/version/fingerprint or equivalent stable owner-produced provenance;
- idempotent and safe under replay;
- rejected when source lineage is stale, mismatched, cross-Workspace or not an allowed governed source type;
- free of cross-service SQL.

The subject user must come from trusted source/Principal relationships. Request-body `userId`, `reviewerId`, provider identity or similar fields must not be accepted as authority to attribute Capability evidence.

The following must fail closed as direct user Capability evidence:

- raw/unreviewed Provider Return;
- Provider Supply Capability;
- Payment/Invoice state;
- Order confirmation alone;
- task completion without governed evidence;
- AI-generated assertion without governed source provenance.

## 8. Reflection Candidate lock

Candidate generation must preserve:

- exact Ledger source IDs/versions/fingerprints;
- exact runtime Capability definition/version;
- deterministic policy/version when deterministic rules are used;
- model/prompt/version provenance when AI assists narrative drafting;
- explanation of why the candidate was proposed;
- private visibility;
- explicit `canonicalTruth = false` and `capabilityVerified = false` authority consequences.

Candidate generation may be deterministic, AI-assisted or a bounded combination, but the resulting record remains a candidate until explicit disposition.

No candidate may automatically:

- verify Capability;
- publish to Capability Canon;
- alter permissions or role membership;
- appoint a professional;
- rank the user publicly;
- trigger external action.

## 9. Reflection disposition, Profile and Twin lock

Only the authenticated subject user may perform the normal private reflection disposition in the Beta path. Any future delegated/team review path requires a separately approved authority model.

Rules:

- exact candidate version is required;
- stale candidate disposition fails closed;
- conflicting concurrent dispositions serialize or fail with controlled optimistic concurrency;
- exact retries replay the committed result;
- rejection/defer preserves immutable candidate and Ledger history;
- acceptance updates the private Profile/Twin projection deterministically;
- accepted reflection remains non-verified and non-canonical;
- profile/twin rebuild from durable history must be deterministic after restart.

Milestone 6 does not introduce a numeric professional score or star rating.

## 10. Privacy and Lite projection lock

Capability learning state is private by default.

Lite Capability Center must:

- show only the authenticated user's permitted Workspace/subject view;
- distinguish `Observed evidence`, `Reflection Candidate`, `Accepted private reflection` and `Verified/Canonical` concepts visually and textually;
- never display an accepted reflection as verified qualification;
- retain internal provenance while redacting secrets, unrelated tenant data and provider-private supply data;
- support loading, empty, partial, stale, permission, recoverable-error and success states;
- recover from direct URL/reload/restart;
- include desktop and mobile 390 acceptance for new actionable surfaces;
- use the existing shared UI primitives without moving Capability workflow semantics into the shared UI package.

## 11. AI authority lock

AI may:

- summarize admitted Capability Ledger evidence;
- identify possible patterns or gaps;
- draft Reflection Candidate text;
- explain why a candidate was proposed;
- suggest learning next steps that do not execute protected actions.

AI may not:

- choose or spoof the subject user identity;
- admit raw/unreviewed evidence as Capability evidence;
- accept/reject/defer a Reflection Candidate on behalf of the user;
- verify professional competence or qualification;
- assign a public score/rank;
- mutate Capability Canon;
- mutate Core permissions, Workspace roles or legal authority;
- submit a filing, contact a trademark office or execute a Recommended Action.

## 12. Explicit non-goals

Milestone 6 does not implement:

- automatic Capability verification or certification;
- automatic Capability Canon mutation;
- public Capability profile, marketplace, star rating or reputation score;
- HR/performance-management scoring;
- legal/professional qualification or representative appointment;
- automatic permission/role escalation based on Capability evidence;
- Provider Supply Capability → user Capability conversion;
- raw Provider Return → user Capability conversion;
- payment processing, Invoice issuance, settlement, escrow or revenue recognition;
- trademark-office credentials, external Filing Submission or Official Truth ingestion;
- broad autonomous-agent/twin execution authority;
- broad Content Studio or Opportunity Center implementation;
- production GA claim.

## 13. Deferred alternatives

### Payment and Invoice transaction layer

Still deferred. Finance remains semantically separate from Capability evidence, performance, authority and completion.

### External filing and Official Truth ingestion

Still deferred. Protected external actions require their own credential, authority and official-source architecture.

### Public professional reputation / marketplace

Deferred. Private Capability reflection must prove its semantics and privacy before any public reputation product is considered.

### Autonomous Twin / delegated action execution

Deferred. The M6 Twin is a private Capability read model only; it receives no independent action authority.

### Broad content/opportunity analytics

Deferred. M6 may later provide bounded Capability inputs to those loops, but it does not expand their product scope.

## 14. Milestone completion gate

Milestone 6 may be recommended `GO` only after the exact implementation proves:

- durable runtime Capability version lineage;
- exact governed Observation admission;
- private append-oriented Ledger provenance;
- explainable private Reflection Candidates;
- explicit subject-user disposition;
- deterministic private Profile/Twin projection;
- Workspace/subject isolation and privacy redaction;
- replay/restart/idempotency/concurrency safety;
- authenticated Lite Capability Center desktop/mobile path;
- zero-interception real-runtime integration;
- Milestone 2–5 regression gates;
- independent authority audit;
- no automatic verification, Canon mutation, public ranking, permission escalation, Payment/Invoice, external filing or Official Truth consequence.
