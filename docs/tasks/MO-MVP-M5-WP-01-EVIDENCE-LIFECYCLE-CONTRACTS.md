# M5-WP-01 — Evidence Review, Lifecycle and Recommended Action Contracts

## Objective

Freeze the canonical shared contract and authority surface for the approved Milestone 5 direction `DURABLE_EVIDENCE_REVIEW_AND_LIFECYCLE_PROJECTION`.

WP-01 is contract/architecture work only. It introduces no durable review truth, lifecycle state, recommendation runtime or external action.

## Approved basis

- TASK 030A approved by merge of PR #60;
- `docs/planning/MO-MVP-MILESTONE-005-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-005-DELIVERY-PLAN.md`;
- M4 Provider Return / evidence handoff contracts and durable `PENDING_REVIEW` receipt boundary;
- existing MarkReg Formal Matter contracts.

Vocabulary and owner/AI boundary evidence is recorded in `docs/architecture/EVIDENCE-REVIEW-LIFECYCLE-AUTHORITY-BOUNDARY.md`.

## Implemented contract surface

`packages/contracts/src/evidence-lifecycle.ts` defines:

- exact Evidence Receipt review-source identity;
- exact Provider Return / Evidence Handoff provenance;
- explicit Evidence Review Decision outcomes;
- exact Reviewed Source Admission envelope;
- lifecycle projection source lineage;
- Lifecycle Event Projection and Current Lifecycle View vocabulary;
- explainable Recommended Action vocabulary;
- exact-version/fingerprint command contracts;
- typed stale/authority/concurrency/dependency failures;
- stage-by-stage authority-consequence fixtures;
- explicit AI assistance/authority fixture.

The package is exported as `@markorbit/contracts/evidence-lifecycle`.

## Frozen semantic separations

1. Evidence Review Decision != Provider Return.
2. Evidence Review Decision != Official Truth.
3. `ADMITTED_FOR_INTERNAL_USE` != Filing Submission.
4. Reviewed Source Admission != trademark-office acceptance.
5. Lifecycle Projection != Official Status.
6. Recommended Action != authorization or execution.
7. Payment/Invoice does not follow from review/lifecycle/recommendation state.
8. Formal Matter does not complete automatically.
9. Reviewed evidence does not automatically verify user Capability.
10. AI assistance cannot create authoritative review, admission, execution or Official Truth.

## Exact source lineage

The canonical source chain is:

```text
MGSN Provider Return
-> Execution Evidence Handoff
-> exact Execution Evidence Receipt ID/version/fingerprint
-> Evidence Review Decision ID/version/fingerprint
-> Reviewed Source Admission ID/version/fingerprint
-> MarkReg Lifecycle Event / Current Lifecycle View
-> Recommended Action
```

Cross-service ownership remains API/contract based. No service may read another owner's database.

## Vocabulary decision

WP-01 freezes only vocabulary supported by the approved scope. It intentionally does not invent exhaustive taxonomies for every correction reason, lifecycle event code, Recommended Action code, deadline policy or external office status.

Those remain bounded strings or later governed policies until an approved source defines exact canon.

## Acceptance evidence

`packages/contracts/tests/evidence-lifecycle-contract.test.ts` verifies:

- review/lifecycle/action vocabularies contain no paid/filed/official/executed shortcut states;
- review receipt identity is distinct from Provider Return identity while preserving exact M4 provenance;
- reviewer identity is recorded on the decision but is not trusted from the review command payload;
- admitted review lineage is required before Matter lifecycle projection;
- internal lifecycle projections explicitly do not claim verified official status;
- Recommended Action is explicitly non-executing;
- typed failures cover stale lineage, authority, concurrency and dependency outages;
- every internal stage preserves false finance/legal/filing/Official-Truth/completion consequences;
- AI is assistance only.

## Non-goals

WP-01 does not create:

- Execution or MarkReg migrations;
- review-decision persistence;
- correction-request runtime state;
- lifecycle projection persistence;
- Recommended Action persistence;
- Execution-to-MarkReg runtime handoff;
- Gateway routes or browser surfaces;
- Payment/Invoice;
- legal/professional appointment;
- external filing;
- trademark-office Official Truth.

## Pull request

Implementation: PR #61 — `M5-WP-01 — Evidence review, lifecycle and recommendation contracts`.