# MO MVP Milestone 5 Scope and Architecture Lock

- **Milestone:** `MO-MVP-MILESTONE-005`
- **Planning task:** `MO-MVP-TASK-030A`
- **Status:** `APPROVED_FOR_IMPLEMENTATION`
- **Predecessor:** Milestone 4 / M4-WP-09 final recommendation `GO`
- **Proposed direction:** `DURABLE_EVIDENCE_REVIEW_AND_LIFECYCLE_PROJECTION`
- **Planning only:** yes
- **Approval evidence:** exact-head hosted validation is required before this planning proposal is presented as ready to merge.

## 1. Why this milestone exists

Milestone 4 established a durable governed provider-execution path and deliberately stops at an Execution-owned evidence receipt in `PENDING_REVIEW`.

That is the correct authority boundary, but it leaves the next Beta loop incomplete. Raw Provider Return evidence must not flow directly into customer-facing status or be promoted to Official Truth. The repository therefore needs a durable review layer and a bounded lifecycle projection layer.

Milestone 5 proposes to close exactly that gap:

```text
PENDING_REVIEW Execution evidence receipt
-> authorized Evidence Review Decision
-> correction required OR admitted reviewed result
-> exact retry-safe handoff to MarkReg
-> durable Lifecycle Projection
-> customer-safe Status / Timeline / Evidence view
-> explainable Recommended Action candidate
```

## 2. Selected direction

### `DURABLE_EVIDENCE_REVIEW_AND_LIFECYCLE_PROJECTION`

Build the smallest durable, authenticated and auditable path that converts exact provider-return evidence receipts into explicit internal review decisions and then into customer-safe lifecycle projections and recommendations.

The milestone is not an external filing milestone and not an Official Truth ingestion milestone.

## 3. Required outcome

At Milestone 5 completion, the repository should prove that:

- an authorized Workspace actor can load the exact current `PENDING_REVIEW` Execution evidence receipt;
- an authorized reviewer can record one explicit durable review decision against that exact evidence version/fingerprint;
- the decision can be `ADMITTED_FOR_INTERNAL_USE`, `CORRECTION_REQUIRED` or `REJECTED` without changing the underlying Provider Return history;
- a correction request can point back to the exact evidence/Provider Return lineage and a later corrected Provider Return can enter the existing M4 handoff path;
- only an admitted exact reviewed source may be handed to MarkReg for lifecycle projection;
- MarkReg persists lifecycle events/current view from exact admitted sources without reading the Execution or MGSN databases;
- the customer-facing projection is explicitly described as internal lifecycle/status evidence, not trademark-office Official Truth;
- Recommended Action candidates are explainable, source-linked and non-executing;
- customer and operations surfaces are authenticated, Workspace-isolated, redacted and recoverable by direct URL where applicable;
- restart/replay/concurrency tests preserve exact lineage and avoid duplicate downstream state.

## 4. Canonical semantic definitions

### Evidence Receipt

Execution-owned durable receipt created by the M4 evidence handoff. Its `PENDING_REVIEW` state means evidence has been durably received for review. It does not mean the provider assertion is correct or that an external filing occurred.

### Evidence Review Decision

Execution-owned immutable or versioned review truth tied to one exact evidence receipt ID/version/fingerprint.

A review decision may authorize bounded internal downstream use of the reviewed evidence. It does not certify a trademark-office event and does not become Official Truth.

### Correction Request

Execution-owned review outcome identifying deficiencies against exact evidence lineage. It may cause an authorized provider/operator to submit a corrected Provider Return through the existing M4 correction/supersession mechanism. It does not mutate historical returns.

### Reviewed Source Admission

A bounded exact-version/fingerprint source emitted or served by Execution only when the Evidence Review Decision permits internal downstream use.

Admission is not Filing Submission, office acceptance, Matter completion or legal appointment.

### Lifecycle Event Projection

MarkReg-owned durable projection that describes customer-relevant progress derived from governed internal sources. It must retain provenance to the exact source and must never silently reinterpret an internal provider assertion as an official trademark-office event.

### Current Lifecycle View

MarkReg-owned current projection calculated from durable lifecycle events according to deterministic precedence rules. It is a product/read-model state, not a second source of Official Truth.

### Recommended Action

MarkReg-owned explainable advisory candidate derived from current governed lifecycle state and deterministic policy. A Recommended Action may be acknowledged, dismissed or suppressed, but it does not execute the action and does not grant authority to AI or a user.

## 5. Ownership lock

- **Core** owns User, Workspace, Membership, Session, Principal and permission truth.
- **Execution** owns evidence receipts, Evidence Review Decisions, review/correction provenance and reviewed-source admission.
- **MGSN** continues to own Provider Return and provider-network truth from M4.
- **MarkReg** owns Formal Matter, customer lifecycle projection, lifecycle timeline/read models and Recommended Action records.
- **Gateway** owns authenticated browser/API aggregation and transport policy enforcement.
- **Operations Console / markreg.com UI** are projection/action surfaces only; they do not become semantic owners.

No service may read another service's database. Cross-service dependencies use bounded exact-version/fingerprint contracts with retry-safe replay.

## 6. State and transition lock

### Execution review states

Proposed minimum review outcomes:

- `PENDING_REVIEW`
- `ADMITTED_FOR_INTERNAL_USE`
- `CORRECTION_REQUIRED`
- `REJECTED`

A future revision may separate receipt status from decision type, but it must preserve the same authority consequences and immutable provenance.

Rules:

- no decision without exact receipt ID/version/fingerprint;
- a stale or superseded evidence receipt fails closed;
- decision idempotency is Workspace-scoped and command-scoped;
- correction never deletes or rewrites Provider Return history;
- conflicting concurrent decisions serialize or fail with controlled optimistic-concurrency semantics;
- `ADMITTED_FOR_INTERNAL_USE` does not mean `OFFICIAL`, `FILED`, `ACCEPTED_BY_OFFICE` or `COMPLETED`.

### MarkReg lifecycle projection

Lifecycle events are append-oriented and provenance-linked. Current lifecycle state is derived deterministically from admitted event history.

The projection must distinguish at least:

- internal processing state;
- reviewed provider evidence state;
- customer action needed;
- waiting/no-action state;
- correction/review issue state.

The projection must not invent an official application, application number, office acceptance, refusal, registration or other office status from provider assertions alone.

## 7. Recommended Action lock

Recommended Actions may include bounded advisory states such as:

- customer information/document requested;
- reviewer/provider correction pending;
- no action currently required;
- internal follow-up recommended;
- lifecycle deadline/reminder candidate when the source and policy are governed.

Every recommendation must retain:

- source lifecycle version/fingerprint;
- deterministic policy/version;
- reason/explanation;
- relevant due date or timing basis when present;
- status such as `OPEN`, `ACKNOWLEDGED`, `DISMISSED` or `SUPPRESSED`.

Recommendation creation or display does not send a filing, contact an office, create Payment, appoint a representative or complete a Matter.

## 8. Cross-service handoff lock

The Execution-to-MarkReg reviewed-source handoff must be:

- exact source ID/version/fingerprint based;
- Workspace-scoped;
- authenticated as a trusted internal service call;
- retry-safe and idempotent;
- recoverable after response loss;
- redrivable after restart;
- rejected when the review decision/source is stale, mismatched or no longer admissible;
- free of cross-service SQL and distributed-transaction claims.

A durable outbox is not automatically required by this scope lock; if implementation evidence shows it is necessary for correctness, it must be introduced within the owning service without weakening ownership boundaries.

## 9. Customer-safe projection lock

Customer-facing lifecycle/status views must:

- show only Workspace-authorized Matters;
- use bounded customer-safe labels rather than internal implementation jargon where appropriate;
- preserve evidence provenance internally even when the customer sees a simplified presentation;
- distinguish reviewed internal evidence from verified external official status;
- redact provider-private supply data, internal notes, secrets and unrelated tenant data;
- recover from direct URL after restart;
- support the mobile actioning requirement for new user-facing surfaces.

## 10. AI authority lock

AI may:

- summarize evidence for a reviewer;
- highlight inconsistencies;
- draft review notes;
- explain lifecycle state;
- suggest Recommended Action candidates for deterministic/human-governed admission where allowed;
- summarize customer-safe status.

AI may not:

- approve or reject evidence as the authoritative reviewer;
- certify a Provider Return;
- promote evidence to Official Truth;
- submit a trademark filing;
- contact a trademark office;
- allocate or accept for a Provider;
- create Payment/Invoice truth;
- automatically complete a Formal Matter;
- automatically verify user Capability.

## 11. Explicit non-goals

Milestone 5 does not implement:

- Payment processing, settlement, custody, escrow or reconciliation;
- Invoice issuance, tax, refund, chargeback or revenue recognition;
- automatic provider selection/allocation;
- legal/professional representative appointment;
- trademark-office credentials;
- external Filing Submission;
- automatic filing or office contact;
- official application creation;
- official application/application-number truth;
- office acceptance/refusal/registration truth ingestion as a general system;
- automatic Formal Matter completion;
- automatic Capability verification/canon mutation from reviewed provider performance;
- broad messaging/CRM automation;
- public provider marketplace/ranking;
- GA/production-complete claim.

## 12. Deferred alternatives

### Capability learning / Reflection Candidate

Deferred to a later milestone. Reviewed lifecycle outcomes are a stronger source for capability learning than raw Provider Return evidence, so evidence review should precede automatic or semi-automatic learning workflows.

### Payment and Invoice transaction layer

Deferred. Finance is not required to close the reviewed-evidence/customer-lifecycle loop and must remain semantically separate from performance and completion.

### External filing / Official Truth ingestion

Deferred. This remains higher-risk protected external-action scope and requires its own source-of-truth, credential, authorization and office-evidence architecture.

### Broad communications automation

Deferred. Messaging/reminder delivery should consume durable lifecycle/recommendation state rather than become the owner of that state.

## 13. Milestone completion gate

Milestone 5 may receive a `GO` recommendation only when one exact implementation tree proves:

1. durable Execution evidence review with exact lineage and explicit reviewer authority;
2. correction/rejection/admission semantics with immutable provenance;
3. retry-safe reviewed-source handoff to MarkReg with no cross-service SQL;
4. durable MarkReg lifecycle event/current-view projection;
5. explainable non-executing Recommended Action semantics;
6. authenticated customer and operations paths with Workspace isolation and redaction;
7. restart/replay/idempotency/concurrency behavior;
8. real-runtime acceptance through `PENDING_REVIEW -> review decision -> lifecycle projection -> customer-safe view`;
9. regressions for Milestones 2, 3 and 4 remain green;
10. an independent integration and authority audit recommends `GO`.

No Git tag, release publication, deployment freeze or external action is implied by a Milestone 5 `GO` recommendation.
