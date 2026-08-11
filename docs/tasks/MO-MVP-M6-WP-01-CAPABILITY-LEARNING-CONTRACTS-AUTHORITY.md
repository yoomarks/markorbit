# M6-WP-01 — Capability learning contracts and canonical authority boundary

- **Milestone:** `MO-MVP-MILESTONE-006`
- **Direction:** `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`
- **Base:** `3f2d184b85e1dbb837b5360b083b181db25b43e1` (PLC-WP-08 merged GO)
- **Status:** `COMPLETE_FOR_OWNER_REVIEW`
- **Scope:** contracts, authority fixtures and architecture boundary only
- **Verified implementation head:** `ff4a3262020779f5752fd3f7e595d6ed42117359`

## Objective

Freeze the smallest canonical contract set required by the approved M6 Capability learning loop without adding persistence or runtime behavior.

## Required outputs

1. `@markorbit/contracts/capability-learning` subpath with contracts for:
   - Runtime Capability Definition/version lineage;
   - Capability Observation source/reference;
   - private Capability Ledger Entry;
   - private Reflection Candidate;
   - explicit Reflection Disposition;
   - private Capability Profile projection;
   - private Capability Twin projection.
2. explicit shared authority consequences showing observed evidence, Reflection Candidate and accepted private reflection are neither canonical truth nor verified Capability;
3. source-family contract excludes raw Provider Return and Provider Supply Capability as direct user Capability evidence;
4. architecture document freezing Core / Capability Engine / Execution / MarkReg / MGSN / Gateway / Lite / AI boundaries;
5. contract tests covering the permanent negative consequences;
6. no runtime/database migration in this work package.

## Acceptance locks

```text
Reflection Candidate != canonical truth
accepted private reflection != verified professional Capability
Provider Supply Capability != user Capability evidence
raw Provider Return != user Capability evidence
task completion != automatic Capability verification
AI output != accepted reflection
AI output != Capability Canon mutation
Capability Profile/Twin != public score/ranking
Capability Twin != autonomous identity or execution authority
Capability evidence != permission/role escalation
no cross-service SQL
```

No contract in M6-WP-01 may imply Payment/Invoice, legal appointment, provider appointment, Filing Submission, Official Truth or protected external action.

## Contract decisions

### Runtime definition

Runtime Capability Definitions are projections from explicit accepted Canon references. The contract freezes `createdFromWorkEvidence: false` and `createdFromAiOutput: false`.

### Observation source

The shared M6-WP-01 source vocabulary admits only reviewed Execution/MarkReg source families. M6-WP-03 may choose the smallest subset for the first runtime adapter, but it may not widen the semantic authority without a separately reviewed contract change.

### Subject attribution

The subject must be attributable through owner source truth or trusted Core Principal relationships. Request-body identity is not evidence authority.

### Reflection

AI may assist narrative drafting and explanation, but Candidate remains private, pending and non-verified. Normal disposition authority belongs to the authenticated subject user.

### Profile/Twin

Profile and Twin are deterministic private projections. The contract has no verified badge, numeric professional score, public profile publication or autonomous execution authority.

## Exact-head verification

Head `ff4a3262020779f5752fd3f7e595d6ed42117359` passed the complete hosted regression set triggered by PR #84:

- validation `31527867836`: PASS;
- Browser and Visual Validation `31527867819`: PASS;
- Milestone 2 reliability `31527867880`: PASS;
- Milestone 3 reliability `31527867827`: PASS;
- Milestone 4 integration `31527867883`: PASS;
- Milestone 4 reliability `31527867792`: PASS;
- Milestone 5 integration `31527867837`: PASS;
- Milestone 5 reliability `31527867887`: PASS.

This status update contains no runtime change. The final PR head must remain green before merge.

## Non-goals

- M6-WP-02 persistence;
- Capability Engine database schema;
- Observation source HTTP adapters;
- Reflection generation service;
- Gateway/Lite Capability Center;
- public Capability profile/ranking;
- Capability verification/certification;
- Capability Canon publishing;
- permission mutation;
- external action.

## Next

After Owner merge only:

`M6-WP-02 — Durable runtime Capability Registry and version lineage`.
