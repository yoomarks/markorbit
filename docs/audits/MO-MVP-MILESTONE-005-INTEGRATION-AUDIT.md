# MO MVP Milestone 5 — Integration and Authority Audit

**Approved direction:** `DURABLE_EVIDENCE_REVIEW_AND_LIFECYCLE_PROJECTION`  
**Work package:** `M5-WP-08`  
**Audit PR:** #70  
**Audited code head:** `f79002d81329de2ae80c777e391f1b025f014e79`  
**Initial recommendation:** `FIX`  
**Re-audit recommendation:** **GO**

## Audit objective

Independently verify that Milestone 5 closes the approved governed loop as a real authenticated runtime path rather than a collection of isolated service tests:

```text
PENDING_REVIEW provider evidence
-> exact review source capture
-> explicit authenticated Evidence Review Decision
-> optional durable correction request OR exact Reviewed Source Admission
-> retry-safe Execution -> MarkReg handoff
-> durable Lifecycle Projection
-> customer-safe lifecycle/status projection
-> deterministic non-executing Recommended Action
-> acknowledgement/dismissal only
```

The audit also verifies that the M5 loop does not acquire filing, payment, legal, official-status, automatic-completion or user-Capability authority.

## Initial audit result — FIX

The first independent pass found two bounded integration gaps against the approved M5 delivery plan.

### Finding M5-AUD-FIX-01 — Operations review workflow was not externally operable

The durable Execution review service existed, and Operations could inspect lifecycle provenance, but the governed browser/API boundary did not expose the approved human review workflow for:

- listing Workspace-scoped `PENDING_REVIEW` evidence;
- explicitly capturing the exact review source;
- recording `ADMITTED_FOR_INTERNAL_USE`, `CORRECTION_REQUIRED` or `REJECTED` decisions;
- recording durable correction reasons;
- explicitly admitting an approved reviewed source and initiating the bounded lifecycle handoff.

This was a real integration gap rather than a missing semantic model.

### Finding M5-AUD-FIX-02 — Recommended Action regeneration was not composed into the real lifecycle handoff

`RecommendedActionService` and its deterministic policy were already implemented and tested, but the real MarkReg lifecycle handoff runtime did not invoke regeneration after a newly projected event became the current Lifecycle View. A real runtime lifecycle projection therefore did not necessarily produce the already-approved advisory action projection.

### Non-finding corrected during audit

A preliminary inspection briefly suspected that M5 Gateway lifecycle routes were not mounted by the production Gateway runtime. Deeper inspection confirmed that `createGatewayOrderRoutes()` already composes `createGatewayLifecycleRoutes()`, and production `createRuntime()` mounts that route set. This was not retained as an audit finding and no remediation was made for it.

## Bounded remediation

PR #70 closes only the two approved-scope integration gaps.

### Operations review boundary

Execution now exposes trusted internal review routes backed by the existing durable review services and owner database:

- `GET /internal/evidence-review/queue`
- `POST /internal/evidence-review/sources/capture`
- `POST /internal/evidence-review/decisions`

Gateway exposes the corresponding authenticated Operations path plus explicit admission and handoff commands:

- `GET /api/operations/evidence-review/queue`
- `POST /api/operations/evidence-review/sources/capture`
- `POST /api/operations/evidence-review/decisions`
- `POST /api/operations/reviewed-source-admissions`
- `POST /api/operations/reviewed-source-handoffs/deliver`

The route inventory remains canonical and now contains 86 runtime routes / 80 non-runtime product routes. Reviewer identity comes from the Core-resolved Workspace Principal; request-body actor spoofing is rejected. Mutation boundaries retain Origin/CSRF, Workspace permission, exact-version/fingerprint, idempotency and correlation-lineage controls.

The Operations Console now presents the same explicit sequence: queue -> exact capture -> human decision/correction -> explicit admission -> explicit lifecycle projection. Selecting a queue item does not silently treat the queue snapshot as a captured authoritative review source; the user must perform the exact source-capture step.

### Lifecycle-to-action composition

When a newly projected lifecycle event becomes the current Lifecycle View, MarkReg now invokes the existing deterministic Recommended Action policy using the exact Lifecycle View ID/version/fingerprint and the same correlation lineage. Replaying an older non-current lifecycle event does not regenerate over the newer current view.

Recommended Action remains advisory and retains `executionAuthorized = false`.

## Permanent zero-interception integration evidence

PR #70 adds `.github/workflows/milestone-5-integration.yml` and `scripts/m5-evidence-lifecycle-runtime.integration.test.ts` as a permanent gate.

The gate uses three physically separate PostgreSQL databases for Core, Execution and MarkReg and starts real service runtimes plus Gateway. It uses a real Core Session / Workspace Principal and real HTTP transport between the services. No service mocks or cross-service SQL are used for the M5 business path.

The test proves, end to end:

- Workspace-scoped review queue loading;
- exact source capture with audit actor derived from authenticated Core identity;
- reviewer spoof rejection;
- explicit admitted review decision;
- explicit Reviewed Source Admission;
- Execution-to-MarkReg lifecycle handoff;
- `CUSTOMER_ACTION_NEEDED` current lifecycle projection with `officialStatusVerified = false`;
- deterministic OPEN Recommended Action with `executionAuthorized = false`;
- customer projection redaction of internal fingerprint provenance;
- Operations provenance over the exact admission/review/handoff chain;
- cross-Workspace denial;
- acknowledgement changing advisory status only;
- `CORRECTION_REQUIRED` creating a durable correction request and remaining inadmissible.

## Exact-head hosted evidence

The audited code head `f79002d81329de2ae80c777e391f1b025f014e79` passed all required hosted gates on the same tree:

- Milestone 5 integration — **PASS** — run `31447652716`
- Milestone 5 reliability — **PASS** — run `31447652734`
- validation — **PASS** — run `31447652680`
- Browser and Visual Validation — **PASS** — run `31447652689`
- Milestone 4 integration — **PASS** — run `31447652685`
- Milestone 4 reliability — **PASS** — run `31447652678`
- Milestone 3 reliability — **PASS** — run `31447652687`
- Milestone 2 reliability — **PASS** — run `31447652705`

## Authority audit

The final implementation preserves all approved authority locks:

- Evidence Review Decision is internal governed review truth, not Official Truth.
- `ADMITTED_FOR_INTERNAL_USE` is not Filing Submission, trademark-office acceptance or an official status.
- Lifecycle Projection is internal governed projection; `officialStatusVerified` remains false.
- Recommended Action is advice and status management only; it does not authorize or execute an external action.
- Provider Return remains provider evidence rather than Official Truth.
- no Payment or Invoice truth is created or implied;
- no legal or professional appointment is created or implied;
- no Formal Matter is automatically completed;
- no user Capability is automatically verified or escalated;
- no external filing or trademark-office action is performed;
- no cross-service SQL is introduced;
- AI is not permitted to record authoritative review decisions, admit reviewed sources, execute Recommended Actions or create Official Truth.

## Ownership audit

Ownership remains separated:

- Core owns User / Workspace / Membership / Session / Principal / permission truth.
- Execution owns evidence receipts, Evidence Review Decisions, correction requests, Reviewed Source Admissions and sender handoff state.
- MGSN continues to own Provider Return.
- MarkReg owns Formal Matter, lifecycle projection and Recommended Action.
- Gateway and UI remain transport/presentation boundaries and do not become semantic owners.

## Final recommendation

**GO** for the approved Milestone 5 engineering scope represented by audited code head `f79002d81329de2ae80c777e391f1b025f014e79`.

This recommendation does not create a Git tag, release, deployment freeze, Payment/Invoice, legal appointment, Filing Submission, external trademark-office action or Official Truth. Merge of PR #70 remains an explicit owner action.

The documentation head created after this audit must independently pass the same hosted gates before PR #70 is considered ready for review.
