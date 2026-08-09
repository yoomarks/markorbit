# MO MVP TASK 030A — Milestone 5 scope and architecture lock

- **Task ID:** MO-MVP-TASK-030A
- **Baseline:** M4-WP-09 final GO content at `1dabf784509cbafba21aa9479c83f657bf8a4f39` / PR #59.
- **Task type:** planning / architecture decision only.
- **Status:** `PROPOSED_FOR_OWNER_APPROVAL`.
- **Objective:** select and bound the next MVP milestone after the Milestone 4 `GO` audit without starting implementation in this planning task.
- **Proposed direction:** `DURABLE_EVIDENCE_REVIEW_AND_LIFECYCLE_PROJECTION`.

## Numbering note

The original Task Index already reserves `MO-MVP-TASK-030` for Dual-channel Intake. This milestone planning task uses `TASK 030A` rather than rewriting or reusing that historical identifier.

## Canonical basis

TASK 030A is governed by:

- `AGENTS.md` repository locks;
- `docs/product/MVP-PRODUCT-LOCK.md`;
- `docs/planning/FOUR-WEEK-PLAN.md`;
- the Milestone 4 scope, implementation traceability, reliability and final GO audit;
- the durable M4 provider-execution path ending in an Execution-owned `PENDING_REVIEW` evidence receipt;
- existing MarkReg Formal Matter, document and customer-facing product boundaries.

The controlling semantic locks remain:

- Evidence Review Decision is internal review truth, not trademark-office acceptance or Official Truth;
- Provider Return remains evidence, not Official Truth;
- customer lifecycle status is a projection of governed internal truth, not a claim about an external office unless a separately governed official source exists;
- Recommended Action is advice, not authorization or execution;
- Confirmation is not Filing Submission;
- Matter is not Official Action;
- Payment is not performance, authority, acceptance or completion;
- protected external actions require explicit later authority.

## Repository gap after Milestone 4

Milestone 4 closes the durable governed provider loop through evidence handoff:

```text
current governed Execution source
-> durable MGSN Service Package
-> deterministic Eligibility
-> explicit Allocation
-> authenticated Provider Acceptance
-> durable Provider Return
-> exact Execution evidence handoff
-> PENDING_REVIEW evidence receipt
```

The Beta product still needs the next governed loop after `PENDING_REVIEW`:

```text
PENDING_REVIEW evidence
-> authorized Evidence Review Decision
-> correction or admitted internal result
-> durable MarkReg Lifecycle Projection
-> customer-safe timeline/status
-> explainable Recommended Action
```

Without that layer, the repository can durably receive provider evidence but cannot yet prove how reviewed evidence becomes a bounded customer-facing lifecycle view or a safe next-action recommendation.

## Proposed Milestone 5 outcome

An authenticated authorized reviewer can review an exact current Execution evidence receipt, record a durable decision, request correction when required, or admit the reviewed result for bounded downstream internal use. MarkReg can consume only the admitted exact reviewed source through a bounded dependency and maintain a durable customer-safe lifecycle projection and explainable Recommended Action candidates.

The outcome must preserve:

- Core identity / Workspace / Principal ownership;
- Execution evidence-review ownership;
- MarkReg Matter, lifecycle and customer-projection ownership;
- MGSN Provider Return ownership;
- database-per-owner isolation and no cross-service SQL;
- exact source IDs, versions and fingerprints;
- durable idempotency, replay and optimistic concurrency;
- correction/supersession lineage;
- customer-safe redaction and Workspace isolation;
- no automatic Payment, Invoice, legal appointment, external Filing Submission, Official Truth, Matter completion or Capability verification.

## Direction decision

TASK 030A proposes evidence review and lifecycle projection as the next milestone because:

1. M4 deliberately terminates at `PENDING_REVIEW`, so evidence review is the immediate missing governed state transition;
2. the product lock requires customer `Status/Evidence/Lifecycle` and the four-week plan calls for lifecycle reminders and recommended actions;
3. customer lifecycle projections should consume reviewed durable truth rather than raw provider assertions;
4. this closes a visible Beta loop without introducing trademark-office credentials, automatic filing or finance;
5. the capability-learning loop can consume reviewed outcomes later, after outcome provenance is durable and bounded.

## Proposed work packages

- `M5-WP-01` — Evidence review, lifecycle and recommendation contracts plus canonical authority boundary.
- `M5-WP-02` — Durable authenticated Execution Evidence Review Decision and correction-request state.
- `M5-WP-03` — Durable MarkReg Lifecycle Projection from exact admitted reviewed sources.
- `M5-WP-04` — Explainable Recommended Action candidates, due-state and suppression/acknowledgement semantics.
- `M5-WP-05` — Retry-safe Execution-to-MarkReg reviewed-evidence handoff and correction/replay loop.
- `M5-WP-06` — Authenticated Gateway, Operations review surface and markreg.com lifecycle/status journey.
- `M5-WP-07` — Migration, restart, replay, isolation, redaction, concurrency and browser reliability matrix.
- `M5-WP-08` — Independent Milestone 5 integration and authority audit.

## Explicit authority boundary

Milestone 5 may create internal governed truths only through explicit bounded commands:

- Evidence Review Decision;
- correction request / review note;
- reviewed-source admission for lifecycle projection;
- Lifecycle Event Projection and current Lifecycle View;
- Recommended Action candidate, acknowledgement, suppression or dismissal.

It must not infer or create:

- Payment, settlement or Invoice;
- legal/professional representative appointment;
- provider allocation or provider acceptance on behalf of a provider;
- external trademark-office submission;
- official application creation;
- official application/application-number truth;
- trademark-office acceptance/contact as verified truth;
- automatic Formal Matter completion;
- automatic user Capability verification or canon mutation.

An Evidence Review Decision may determine that provider evidence is sufficient for an internal workflow or customer-safe projection. It does not certify that an external office action occurred.

## Planning outputs

- `docs/planning/MO-MVP-MILESTONE-005-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-005-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-005-PLAN.json`;
- this task record;
- Task Index and README planning-status reconciliation;
- exact-head hosted validation evidence for the final planning tree before it is presented for approval.

## Allowed changes in TASK 030A

Planning, architecture, task-index and repository-status documentation only.

## Prohibited changes in TASK 030A

No product code, runtime contract implementation, database migration, review decision, lifecycle record, recommended action, Gateway route, UI behavior, Payment/Invoice integration, external filing, Git tag, release or deployment freeze is part of TASK 030A itself.

## Approval gate

Implementation must not start until the owner approves this scope by merging the planning PR. Merge of this planning task would authorize only the proposed Milestone 5 engineering direction and bounded work-package graph; it would not itself create product/runtime state or authorize any external action.
