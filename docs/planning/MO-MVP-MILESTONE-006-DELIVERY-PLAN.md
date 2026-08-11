# MO MVP Milestone 6 Delivery Plan

- **Milestone:** `MO-MVP-MILESTONE-006`
- **Planning task:** `MO-MVP-TASK-031A`
- **Status:** `PROPOSED_FOR_APPROVAL`
- **Direction:** `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`
- **Predecessor gate:** Milestone 5 independent audit recommends `GO` and PR #70 is merged as `242b34f806711df608a7178b238104289e65bb00`

## Delivery objective

Close the MVP Capability learning loop using reviewed, governed work outcomes rather than raw task completion, Provider Supply Capability or Provider Return assertions.

The approved implementation sequence should create durable runtime Capability version lineage, private Capability Ledger evidence, explainable Reflection Candidates, explicit subject-user disposition and deterministic private Capability Profile/Twin projection.

The delivery sequence is dependency-ordered. Later work packages may consume only the durable and authority-bounded truths established by earlier packages.

## M6-WP-01 — Capability learning contracts and authority boundary

### Objective

Freeze canonical cross-service vocabulary and authority consequences for runtime Capability definitions, governed observations, private Ledger entries, Reflection Candidates, Reflection Dispositions, Capability Profile and Capability Twin projections.

### Required outputs

- canonical shared contracts for runtime Capability identity/version lineage;
- canonical Capability Observation source/envelope contract;
- canonical Capability Ledger entry contract;
- canonical private Reflection Candidate and disposition contract;
- canonical Capability Profile/Twin projection contract;
- explicit authority fixtures proving that observed/accepted reflection is not verified Capability or Canon truth;
- architecture document defining Capability Engine, Core, Execution, MarkReg, Gateway, Lite and AI boundaries.

### Acceptance

- Reflection Candidate is distinct from canonical Capability truth;
- accepted private reflection is distinct from verified qualification;
- Provider Supply Capability is distinct from user Capability evidence;
- raw Provider Return is not admitted as user Capability evidence;
- task completion alone does not verify Capability;
- AI cannot accept reflection or mutate Canon;
- no Payment/Invoice/legal-appointment/permission-escalation/external-action consequence is introduced.

### Dependencies

- approved TASK 031A;
- M5 reviewed evidence/lifecycle authority boundary;
- repository Capability Canon and AGENTS.md semantic locks.

## M6-WP-02 — Durable runtime Capability Registry and version lineage

### Objective

Replace the learning loop's dependence on the current hard-coded in-memory Capability fixture with a minimal durable Capability Engine-owned runtime registry bound to exact accepted Capability Canon versions.

### Required outputs

- Capability Engine owner migration using the next available migration number;
- PostgreSQL repository/service for runtime Capability definitions and versions;
- stable Capability identity/version lineage;
- bounded Domain → Capability → Skill → Action/Invocation metadata where available in accepted Canon input;
- exact source/canon version reference;
- idempotent import/admission of accepted runtime definitions;
- no runtime path that mutates the external accepted Capability Canon.

### Required negative evidence

- duplicate same-version import replays safely;
- conflicting payload for the same Canon identity/version fails closed;
- AI/user work evidence cannot create a new canonical Capability version;
- cross-Workspace data cannot alter global accepted runtime definition truth;
- the existing `0.1.0-fixture` record is not treated as completed version lineage.

### Dependencies

- M6-WP-01.

## M6-WP-03 — Durable Capability Observation Ledger and governed source admission

### Objective

Create Capability Engine-owned private Ledger evidence from exact governed work outcomes.

### Required outputs

- Capability Engine-owned persistence for Observation admission and append-oriented Ledger entries;
- trusted bounded source adapter(s) for the initial governed work-outcome source family;
- exact source owner, ID, version and fingerprint or equivalent stable owner-produced provenance;
- Workspace and subject-user attribution derived from trusted source/Principal relationships, not caller-supplied identity;
- exact runtime Capability definition/version binding;
- durable idempotency, replay and concurrency safety;
- source admission audit/denial evidence.

### Initial allowed source family

The implementation should choose the smallest owner-controlled source set that proves the loop. It may use an exact Execution professional/review decision and associated governed Formal Matter/lifecycle provenance when needed.

The chosen source must be reviewed/governed evidence. It must not be raw Provider Return, Provider Supply Capability, Payment/Invoice state or unreviewed task-completion evidence.

### Required negative evidence

- body user/reviewer/provider spoofing fails closed;
- raw Provider Return admission fails closed;
- Provider Supply Capability admission fails closed;
- stale/mismatched source version/fingerprint fails closed;
- cross-Workspace/subject admission fails closed;
- duplicate source replay cannot create duplicate Ledger business state;
- no cross-service SQL is used.

### Dependencies

- M6-WP-01;
- M6-WP-02;
- existing Core identity/Workspace truth;
- governed source owner APIs from Execution/MarkReg as selected.

## M6-WP-04 — Private Reflection Candidate generation

### Objective

Generate explainable private Reflection Candidates from exact Capability Ledger evidence without converting the candidate into verified or canonical Capability truth.

### Required outputs

- deterministic policy/version and/or bounded AI-drafting provenance;
- exact Ledger entry references;
- exact runtime Capability version;
- candidate explanation and suggested private reflection text;
- durable candidate versioning and regeneration semantics;
- private visibility and source provenance;
- explicit authority flags preserving `canonicalTruth = false` and `capabilityVerified = false` semantics.

### AI-assisted path

If AI is used, the persisted candidate must retain the model/prompt/version provenance required by the repository AI boundary. AI may draft the narrative, but deterministic validation must reject unsupported identity/authority claims.

### Required negative evidence

- candidate generation cannot verify Capability;
- candidate generation cannot mutate Canon;
- candidate generation cannot change Core roles/permissions;
- AI response alone cannot become accepted reflection;
- stale Ledger/source lineage cannot silently overwrite a newer candidate.

### Dependencies

- M6-WP-02;
- M6-WP-03.

## M6-WP-05 — Explicit Reflection Disposition and private Profile/Twin projection

### Objective

Allow the authenticated subject user to accept, reject or defer one exact private Reflection Candidate and deterministically rebuild the private Capability Profile/Twin projection.

### Required outputs

- explicit `ACCEPTED`, `REJECTED`, `DEFERRED` disposition semantics or an equivalent contract preserving those consequences;
- exact candidate version/fingerprint checks;
- subject-user authority derived from Core Principal truth;
- durable idempotency and optimistic concurrency;
- immutable candidate/Ledger history;
- deterministic current Capability Profile projection;
- deterministic private Capability Twin projection;
- rebuild/restart behavior from owner persistence.

### Profile/Twin minimum content

The Beta projection may show:

- Capability identity/version;
- evidence count and source recency;
- accepted private reflection text;
- latest accepted reflection time;
- outstanding private Reflection Candidate state;
- provenance links appropriate for the subject user.

It must not introduce a numeric professional score, public rating, verified badge or certification.

### Required negative evidence

- non-subject user cannot disposition the normal Beta candidate path;
- stale candidate disposition fails closed;
- conflicting concurrent dispositions cannot both become authoritative;
- accepted reflection remains `capabilityVerified = false`;
- rejection/defer does not erase history;
- profile/twin state cannot mutate Capability Canon or Core permissions.

### Dependencies

- M6-WP-04;
- Core authenticated Principal.

## M6-WP-06 — Authenticated Gateway and Lite Capability Center

### Objective

Expose the durable private Capability learning loop through controlled browser/API surfaces without moving semantic ownership into Gateway or Lite.

### Lite path

Authenticated subject users can:

- open Capability Center by direct URL;
- view private runtime Capability Profile/Twin projection;
- inspect evidence-backed Ledger summaries;
- inspect source/provenance details appropriate to the user;
- see pending private Reflection Candidates;
- accept, reject or defer one exact candidate;
- reload/recover the durable state after browser refresh and service restart.

### Required controls

- Core Session/Workspace Principal truth;
- subject-user privacy boundary;
- read versus mutation permissions;
- trusted Origin/CSRF for browser mutations;
- exact candidate version checks;
- rejection of request-body identity spoofing;
- Workspace isolation and private-state redaction;
- mobile 390 acceptance for candidate actioning;
- loading, empty, partial, stale, permission, recoverable error and ready UI states;
- fixture-backed Storybook states and visual review evidence;
- no `Verified`, certification, score/ranking or public-profile presentation.

### Dependencies

- M6-WP-03;
- M6-WP-04;
- M6-WP-05.

## M6-WP-07 — Reliability, privacy and replay matrix

### Objective

Prove the exact Milestone 6 implementation tree under durability, replay, privacy, subject isolation and browser/runtime stress before audit.

### Minimum executable evidence

- owner migration verification;
- Capability definition/version idempotency and conflict rejection;
- governed Observation exact provenance;
- raw Provider Return / Provider Supply Capability rejection;
- subject identity anti-spoofing;
- Ledger idempotency/replay;
- Reflection Candidate regeneration/version semantics;
- stale candidate rejection;
- disposition concurrency/idempotency;
- deterministic Profile/Twin rebuild after restart;
- Workspace/subject isolation and private-state redaction;
- dependent-service outage fail-closed behavior;
- direct-URL/mobile Capability Center acceptance;
- zero-interception real-runtime path;
- Milestone 2, 3, 4 and 5 regression gates.

### Hosted evidence

A source-controlled machine-readable reliability inventory and hosted exact-head workflow must run the critical durable suites against owner-specific PostgreSQL databases.

### Dependencies

- M6-WP-01 through M6-WP-06.

## M6-WP-08 — Independent integration and authority audit

### Objective

Audit the exact merged Milestone 6 implementation rather than extending it.

### Audit dimensions

- semantic fidelity to the approved scope;
- Capability Canon/runtime-version lineage boundary;
- Observation and Ledger provenance;
- subject attribution and privacy;
- Reflection Candidate non-canonical/non-verified semantics;
- explicit subject-user disposition authority;
- Capability Profile/Twin determinism and non-execution;
- Core/Capability Engine/Execution/MarkReg ownership boundaries;
- no cross-service SQL;
- idempotency, replay, concurrency and isolation;
- exact-tree hosted evidence;
- complete real-runtime path;
- no automatic verification, Canon mutation, public ranking, permission escalation, Payment/Invoice, legal appointment, Filing Submission or Official Truth.

### Decision

The audit may recommend:

- `GO` — approved M6 engineering scope is complete enough to close;
- `FIX` — bounded remediation is required;
- `HOLD` — a deeper authority/privacy/data-integrity issue prevents continuation.

The audit itself does not verify Capability, publish Canon, alter permission, tag, release, deploy, pay, appoint, file or contact an office.

### Dependencies

- M6-WP-07.

## Dependency graph

```text
TASK 031A approval
  -> M6-WP-01 contracts / authority
      -> M6-WP-02 runtime Capability Registry/version lineage
          -> M6-WP-03 governed Observation + private Ledger
              -> M6-WP-04 private Reflection Candidate
                  -> M6-WP-05 explicit disposition + Profile/Twin
                      -> M6-WP-06 authenticated Lite Capability Center
                          -> M6-WP-07 reliability/privacy/replay matrix
                              -> M6-WP-08 independent audit
```

No work package may bypass the source-owner, subject-identity or Canon authority prerequisites.

## Primary real-runtime acceptance journey

One permanent zero-interception acceptance path should prove:

```text
Core authenticated Lite subject user
-> governed Execution/MarkReg reviewed work source
-> exact Capability Observation admission
-> durable Capability Ledger entry
-> private Reflection Candidate
-> explicit subject-user ACCEPTED disposition
-> deterministic private Capability Profile/Twin projection
-> Gateway
-> Lite Capability Center
-> restart / direct-URL reload / exact replay
```

The test must also prove that the journey does **not** automatically create:

```text
Verified Capability
Capability Canon mutation
public rating/ranking
Core role or permission escalation
Provider Supply Capability conversion
Payment / Invoice
legal appointment
Filing Submission
Official Truth
external action
```

A second negative path must prove that raw Provider Return or Provider Supply Capability cannot be admitted directly as user Capability evidence.

## Completion sequence

Milestone 6 implementation may begin only after TASK 031A is approved by merge of its planning PR. M6-WP-08 may recommend closure only after the exact M6 implementation and hosted regression evidence are complete.

No planning or implementation merge creates a Git tag, release, deployment freeze, public Capability score, professional certification, external filing or Official Truth by itself.
