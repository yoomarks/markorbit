# MO MVP Milestone 5 Implementation Traceability

**Approved direction:** `DURABLE_EVIDENCE_REVIEW_AND_LIFECYCLE_PROJECTION`  
**Scope approval:** PR #60, merge `0de33333246b66d825b56137f87c32266fb5583c`  
**Current work package:** `M5-WP-03` — durable MarkReg Lifecycle Projection from exact admitted reviewed sources  
**Milestone status:** `IMPLEMENTATION_ACTIVE`

The Milestone 5 scope, delivery plan, machine-readable plan, TASK 030A record, Task Index and README were reconciled to the approved PR #60 state in WP-01.

## Work package status

- **M5-WP-01 — Evidence review, lifecycle and recommendation contracts plus canonical authority boundary:** `IMPLEMENTED_IN_PR_61`. Evidence: `packages/contracts/src/evidence-lifecycle.ts`, contract tests and authority boundary docs.
- **M5-WP-02 — Durable authenticated Execution Evidence Review Decision and correction-request state:** `IMPLEMENTED_IN_PR_62`. Evidence: migration `0033_execution_evidence_review`, Execution review service/repository and PostgreSQL acceptance tests.
- **M5-WP-03 — Durable MarkReg Lifecycle Projection from exact admitted reviewed sources:** `IMPLEMENTED_IN_PR_64`. Evidence: migration `0034_markreg_lifecycle_projection`, MarkReg lifecycle projection repository/service, PostgreSQL acceptance tests and WP-03 task record.
- **M5-WP-04 — Explainable Recommended Action candidates and acknowledgement/suppression semantics:** `NOT_STARTED`.
- **M5-WP-05 — Retry-safe Execution-to-MarkReg reviewed-evidence handoff and correction/replay loop:** `NOT_STARTED`.
- **M5-WP-06 — Authenticated Gateway, operations review surface and markreg.com lifecycle/status journey:** `NOT_STARTED`.
- **M5-WP-07 — Migration, restart, replay, isolation, redaction, concurrency and browser reliability matrix:** `NOT_STARTED`.
- **M5-WP-08 — Independent Milestone 5 integration and authority audit:** `NOT_STARTED`.

## WP-01 canonical contract lock

The shared M5 contract freezes the exact source chain:

```text
Provider Return
-> Evidence Handoff
-> exact Evidence Receipt ID/version/fingerprint
-> explicit Evidence Review Decision
-> exact Reviewed Source Admission
-> MarkReg Lifecycle Event / Current Lifecycle View
-> non-executing Recommended Action
```

The contract keeps these truths separate:

- Evidence Review Decision is not Provider Return or Official Truth;
- `ADMITTED_FOR_INTERNAL_USE` is not Filing Submission or office acceptance;
- Lifecycle Projection is not Official Status;
- Recommended Action is advice and does not authorize or execute the action;
- no Payment/Invoice/legal appointment/automatic Matter completion/user Capability verification follows from M5 internal state.

## WP-02 durable review boundary

Execution now owns durable review state over exact M4 evidence receipts:

```text
PENDING_REVIEW receipt
-> authenticated reviewer Principal
-> stable receipt ID/version/fingerprint capture
-> exact freshness check
-> explicit review command
-> ADMITTED_FOR_INTERNAL_USE | CORRECTION_REQUIRED | REJECTED
-> immutable decision + append-only audit
-> optional durable correction request
```

The reviewer identity is taken from the authenticated Principal rather than request-body identity. Review reads require `review:read`; authoritative review decisions require `review:perform`.

The source remains exact and fail-closed: receipt ID/version/fingerprint, Evidence Handoff, Provider Return ID/version/fingerprint, Workspace and correlation lineage are retained. A newer receipt for the same Provider Return lineage makes an older review source stale. Concurrent conflicting decisions cannot both become authoritative, and idempotent retries replay the previously committed result.

`CORRECTION_REQUIRED` creates a separate correction-request record; it does not mutate the historical Provider Return or M4 evidence receipt.

## WP-03 durable lifecycle projection boundary

MarkReg now owns durable lifecycle projection over one exact canonical `ReviewedSourceAdmissionEnvelope`:

```text
exact Reviewed Source Admission
-> validate Workspace / admission version / fingerprint / correlation lineage
-> validate exact local Formal Matter ID/version
-> append immutable Lifecycle Event Projection
-> deterministically select Current Lifecycle View
-> durable command replay / exact-admission deduplication
```

Every lifecycle event retains the exact Reviewed Source Admission, Evidence Review Decision, Evidence Receipt, Provider Return and Formal Matter references. MarkReg consumes that bounded envelope through a reader contract and does not read Execution persistence.

Lifecycle events are append-only. The current view is deterministic: later `occurredAt` wins; equal timestamps use explicit lifecycle-state precedence and then stable admission identity. Historical older events remain durable without silently replacing newer current state.

Exact command retries replay the committed event/view result. A second key for the same exact semantic admission reuses the existing event; conflicting semantics for an already-consumed admission fail closed. Cross-Workspace source/read access, admission version/fingerprint mismatch, Formal Matter version mismatch and correlation mismatch fail closed.

`officialStatusVerified` remains fixed to `false`. Lifecycle Projection does not create filing, official application/application-number, office acceptance or Official Truth.

The real retry-safe Execution-to-MarkReg transport and correction/replay loop remain M5-WP-05 rather than being hidden inside WP-03.

## Ownership boundary

- Core owns identity, Workspace, Session, Principal and permission truth.
- Execution owns evidence receipts, Evidence Review Decisions, correction provenance and Reviewed Source Admission.
- MGSN continues to own Provider Return.
- MarkReg owns Formal Matter, lifecycle projection and Recommended Action.
- Gateway/UI do not become semantic owners.
- no cross-service SQL is permitted.

## AI boundary

AI may summarize evidence, highlight inconsistencies, draft review notes, explain lifecycle state and suggest Recommended Action candidates. AI may not record authoritative review decisions, admit reviewed sources, execute Recommended Actions, submit filings or create Official Truth.

## Next implementation step

After M5-WP-03 merges with clean hosted gates, the next dependency-ordered implementation step is `M5-WP-04` — explainable, non-executing Recommended Action candidates and acknowledgement/suppression semantics. M5-WP-05 also becomes dependency-unblocked by WP-03, but remains a separate work package and must not be folded into WP-04.
