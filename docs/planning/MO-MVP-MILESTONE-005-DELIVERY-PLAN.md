# MO MVP Milestone 5 Delivery Plan

- **Milestone:** `MO-MVP-MILESTONE-005`
- **Planning task:** `MO-MVP-TASK-030A`
- **Status:** `APPROVED_FOR_IMPLEMENTATION`
- **Direction:** `DURABLE_EVIDENCE_REVIEW_AND_LIFECYCLE_PROJECTION`
- **Predecessor gate:** Milestone 4 final independent audit recommends `GO`

## Delivery objective

Close the next Beta gap after the Milestone 4 provider-execution loop by turning exact `PENDING_REVIEW` evidence receipts into explicit governed review decisions, exact reviewed-source handoff, durable customer lifecycle projection and explainable non-executing Recommended Actions.

The delivery sequence is intentionally dependency-ordered. Later work packages may consume only the durable and authority-bounded truths established by earlier packages.

## M5-WP-01 — Contracts and authority boundary

### Objective

Freeze canonical cross-service vocabulary and authority consequences for evidence review, reviewed-source admission, lifecycle projection and Recommended Actions.

### Required outputs

- canonical shared contracts for exact evidence review source/decision identity;
- canonical reviewed-source admission envelope;
- canonical lifecycle projection source/event/current-view vocabulary;
- canonical Recommended Action vocabulary;
- authority-consequence fixtures proving that internal review/lifecycle state does not imply external filing or Official Truth;
- architecture document defining owner and AI boundaries.

### Acceptance

- Evidence Review Decision is distinct from Provider Return and Official Truth;
- review admission is distinct from Filing Submission and office acceptance;
- Lifecycle Projection is distinct from Official Status;
- Recommended Action is distinct from authorization/execution;
- no Payment/Invoice/legal-appointment/automatic-completion consequence is introduced.

### Dependencies

- approved TASK 030A;
- M4 canonical Provider Return / evidence receipt contracts.

## M5-WP-02 — Durable Execution Evidence Review Decision

### Objective

Add Execution-owned durable review state for exact M4 evidence receipts.

### Required outputs

- owner-assigned Execution migration after `0032`;
- PostgreSQL repository and service for evidence review decisions;
- explicit `ADMITTED_FOR_INTERNAL_USE`, `CORRECTION_REQUIRED` and `REJECTED` decisions or an equivalent contract preserving the frozen semantics;
- exact receipt ID/version/fingerprint validation;
- authenticated reviewer Principal/permission checks;
- durable idempotency and optimistic concurrency;
- immutable decision/audit provenance;
- correction-request references without mutation of historical Provider Return evidence.

### Required negative evidence

- stale/superseded evidence fails closed;
- cross-Workspace review fails closed;
- body/header identity spoofing fails closed;
- concurrent conflicting decisions cannot both become current;
- AI output cannot become an authoritative decision without the explicit governed decision command.

### Dependencies

- M5-WP-01;
- M4 Execution evidence receipt persistence.

## M5-WP-03 — Durable MarkReg Lifecycle Projection

### Objective

Create MarkReg-owned durable lifecycle projection from exact admitted reviewed sources.

### Required outputs

- MarkReg-owned migration after the current MarkReg migration set;
- append-oriented lifecycle event persistence;
- deterministic current lifecycle view with explicit precedence/versioning;
- exact source admission identity including Execution review decision and reviewed-source fingerprint;
- durable idempotency and safe replay;
- customer-safe projection metadata and internal provenance;
- bounded read APIs for one Workspace/Matter.

### Required negative evidence

- raw/unreviewed Provider Return cannot create lifecycle state;
- a rejected or correction-required review cannot be admitted as positive downstream progress;
- duplicate handoff cannot duplicate lifecycle events;
- lifecycle state cannot silently create official application/application-number/office-acceptance truth;
- cross-Workspace reads/mutations fail closed.

### Dependencies

- M5-WP-01;
- M5-WP-02;
- existing MarkReg Formal Matter boundary.

## M5-WP-04 — Explainable Recommended Actions

### Objective

Create durable, explainable, non-executing Recommended Action candidates from governed lifecycle state.

### Required outputs

- deterministic policy/version contract;
- source lifecycle ID/version/fingerprint binding;
- reason/explanation and due/timing basis where applicable;
- states for open/acknowledged/dismissed/suppressed behavior;
- idempotent regeneration or replacement semantics when lifecycle state changes;
- Workspace/Matter isolation;
- customer-safe and operations-safe projections.

### Required negative evidence

- a recommendation does not submit, contact an office or mutate external state;
- a recommendation does not become Payment/Invoice truth;
- AI suggestion alone is not an authoritative protected action;
- stale recommendation source cannot execute or overwrite a newer lifecycle view.

### Dependencies

- M5-WP-03.

## M5-WP-05 — Reviewed-source handoff and correction/replay loop

### Objective

Wire the real durable Execution-to-MarkReg handoff and prove the correction loop across existing MGSN Provider Return semantics.

### Required outputs

- trusted internal Execution reviewed-source endpoint or equivalent bounded source;
- MarkReg admission client that consumes exact reviewed source through HTTP/service contract, never cross-service SQL;
- retry-safe handoff with response-loss recovery;
- replay/restart behavior;
- correction-required path that preserves review/evidence/Provider Return lineage and permits a later corrected Provider Return to re-enter M4 handoff and M5 review;
- append-only or equivalent audit evidence for successful/denied handoffs.

### Required negative evidence

- stale review source fails closed;
- source fingerprint mismatch fails closed;
- cross-Workspace handoff fails closed;
- network failure does not invent success;
- no distributed exactly-once claim is made without evidence.

### Dependencies

- M5-WP-02;
- M5-WP-03;
- M4 durable MGSN/Execution runtime composition.

## M5-WP-06 — Authenticated operations and customer lifecycle journey

### Objective

Expose the durable review/lifecycle capabilities through controlled browser/API surfaces without moving semantic ownership into the UI or Gateway.

### Operations path

Authorized internal actors can:

- list/load reviewable evidence within their Workspace scope;
- inspect evidence provenance and bounded Provider Return context;
- record explicit review decisions;
- record a correction request/reason;
- inspect resulting reviewed-source/lifecycle handoff state.

### Customer path

Authorized markreg.com users can:

- load Matter lifecycle/status/timeline;
- view customer-safe evidence/status summaries;
- see whether action is required, pending or not currently needed;
- inspect Recommended Action explanation/timing;
- acknowledge/dismiss actions when that behavior is explicitly allowed;
- recover the durable view after refresh/direct URL/restart.

### Required controls

- Core Session/Principal truth;
- read versus mutation permissions;
- trusted Origin/CSRF for browser mutations;
- Workspace/Matter isolation;
- internal provider/supply/reviewer notes redaction;
- mobile 390 acceptance for new customer actioning surfaces;
- no request body identity treated as authority.

### Dependencies

- M5-WP-02;
- M5-WP-03;
- M5-WP-04;
- M5-WP-05.

## M5-WP-07 — Reliability and migration matrix

### Objective

Prove the exact Milestone 5 implementation tree under durability, replay, isolation and browser/runtime stress before audit.

### Minimum executable evidence

- owner migration verification;
- exact evidence-review source lineage;
- stale/superseded evidence rejection;
- conflicting review-decision concurrency;
- durable command idempotency;
- correction/re-review history;
- reviewed-source handoff response-loss replay;
- lifecycle event deduplication and current-view determinism;
- Recommended Action regeneration/suppression behavior;
- Workspace/Matter isolation and redaction;
- dependent-service outage fail-closed behavior;
- restart recovery against the same owner databases;
- browser direct-URL/mobile acceptance for new durable views;
- Milestone 2, 3 and 4 regression gates.

### Hosted evidence

A source-controlled machine-readable reliability inventory and a hosted exact-head workflow must run the critical durable suites against owner-specific PostgreSQL databases.

### Dependencies

- M5-WP-01 through M5-WP-06.

## M5-WP-08 — Independent integration and authority audit

### Objective

Audit the exact merged Milestone 5 implementation rather than extending it.

### Audit dimensions

- semantic fidelity to the approved scope;
- evidence-review authority and provenance;
- Execution/MarkReg/MGSN/Core ownership boundaries;
- no cross-service SQL;
- customer projection truthfulness/redaction;
- Recommended Action non-execution boundary;
- idempotency, replay, concurrency and isolation;
- exact-tree hosted evidence;
- complete real-runtime path;
- no Payment/Invoice/legal appointment/Filing Submission/Official Truth/automatic completion/Capability escalation.

### Decision

The audit may recommend:

- `GO` — approved M5 engineering scope is complete enough to close;
- `FIX` — bounded remediation is required;
- `HOLD` — a deeper authority/data-integrity issue prevents continuation.

The audit itself does not tag, release, deploy, pay, appoint, file or contact an office.

### Dependencies

- M5-WP-07.

## Dependency graph

```text
TASK 030A approval
  -> M5-WP-01 contracts / authority
      -> M5-WP-02 Execution Evidence Review
          -> M5-WP-03 MarkReg Lifecycle Projection
              -> M5-WP-04 Recommended Actions
          -> M5-WP-05 reviewed-source handoff / correction loop
              -> M5-WP-06 operations + customer journey
                  -> M5-WP-07 reliability matrix
                      -> M5-WP-08 independent audit
```

M5-WP-04 and portions of M5-WP-05 may proceed in parallel once their explicit dependencies are met, but no work package may bypass its owner/authority prerequisites.

## Primary real-runtime acceptance journey

One permanent zero-interception acceptance path should prove:

```text
Core authenticated reviewer/customer identities
-> Gateway
-> existing durable M4 Provider Return / Execution evidence receipt
-> Execution Evidence Review Decision
-> exact admitted reviewed-source handoff
-> MarkReg Lifecycle Event + Current Lifecycle View
-> Recommended Action candidate
-> customer-safe markreg.com status/timeline/action view
-> restart/reload/replay
```

The test must also prove that the journey does not automatically create:

- Payment or Invoice;
- legal/professional appointment;
- external Filing Submission;
- official application/application-number truth;
- trademark-office acceptance/contact;
- automatic Formal Matter completion;
- automatic user Capability verification.

## Definition of done

Milestone 5 implementation is not complete merely because individual repositories/services pass unit tests. Completion requires:

- all M5 work-package outputs merged in dependency order;
- one exact implementation tree with required hosted gates green;
- durable multi-service real-runtime evidence;
- customer and operations acceptance where UI scope is introduced;
- exact source and authority consequences captured in machine-readable evidence;
- independent M5-WP-08 audit recommendation `GO`.

Tagging, releasing, deployment freezing and any external action remain separate owner decisions.
