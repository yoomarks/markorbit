# M5-WP-02 — Durable Execution Evidence Review Decision

## Objective

Add Execution-owned durable review state for exact Milestone 4 `PENDING_REVIEW` evidence receipts while preserving the Milestone 5 authority locks.

The review result is explicit internal review truth. It does not certify a Provider Return, submit a filing, create trademark-office acceptance or become Official Truth.

## Durable owner state

Migration `0033_execution_evidence_review.sql` is owned by `@markorbit/execution-service` and adds:

- stable exact Evidence Receipt review-source identity;
- immutable Evidence Review Decision records;
- durable command idempotency;
- correction-request records linked to the exact reviewed receipt and Provider Return version;
- append-only review/audit provenance.

The migration follows `0032_execution_provider_return_evidence` and does not modify historical M4 migrations.

## Governed review flow

```text
Execution PENDING_REVIEW evidence receipt
-> authenticated reviewer Principal
-> stable Evidence Receipt ID/version/fingerprint capture
-> exact source freshness check
-> explicit review command
-> ADMITTED_FOR_INTERNAL_USE | CORRECTION_REQUIRED | REJECTED
-> immutable review decision
-> optional durable correction request
```

The reviewer identity comes from the authenticated Principal supplied by the trusted boundary, never from request-body identity fields.

## Source exactness

Review is bound to:

- exact Evidence Receipt ID;
- exact Evidence Receipt version;
- exact Evidence Receipt SHA-256 fingerprint;
- exact Evidence Handoff ID;
- exact Provider Return ID/version/fingerprint;
- Workspace and correlation lineage.

If a newer evidence receipt exists for the same Provider Return lineage, the older receipt fails closed as stale/superseded.

## Concurrency and idempotency

- `(workspace_id, idempotency_key)` stores durable command replay evidence;
- the same idempotency key with a changed payload fails with `IDEMPOTENCY_CONFLICT`;
- one exact Evidence Receipt can have only one authoritative review decision;
- the source row is locked while the decision is written;
- concurrent conflicting decisions serialize so both cannot become authoritative;
- exact source version/fingerprint mismatches fail closed.

## Correction semantics

`CORRECTION_REQUIRED` creates a separate durable correction-request reference. It does not mutate the historical Provider Return or the M4 evidence receipt. A later corrected Provider Return remains an additive MGSN event and will re-enter the existing M4 evidence handoff as a newer receipt.

## Authenticated authority

Review reads require `review:read`; authoritative decisions require `review:perform`. Cross-Workspace commands and insufficient permissions fail closed. Extra/spoofed body identity cannot replace the authenticated Principal identity recorded on the decision.

## Authority consequences

Recording an Evidence Review Decision does not automatically create:

- Payment or Invoice;
- legal/professional appointment;
- external Filing Submission;
- official application or application-number truth;
- trademark-office acceptance/contact;
- Formal Matter completion;
- user Capability verification;
- AI-authored authoritative review truth.

`ADMITTED_FOR_INTERNAL_USE` only permits later bounded internal consumption through the separately governed reviewed-source admission path.

## Acceptance evidence

`services/execution/tests/evidence-review-postgres.test.ts` proves:

- migration ownership and verification;
- stable receipt identity capture;
- authenticated reviewer identity binding;
- exact version/fingerprint enforcement;
- durable idempotent replay;
- durable correction requests without historical evidence mutation;
- stale/superseded receipt rejection;
- cross-Workspace and permission spoof rejection;
- concurrent conflicting decision serialization;
- append-only audit behavior;
- preserved authority-consequence locks.

The validation workflow runs this suite against the Execution-owned PostgreSQL database as a permanent hosted gate.

## Non-goals

WP-02 does not add:

- MarkReg Lifecycle Projection;
- Reviewed Source handoff to MarkReg;
- Recommended Action generation;
- Gateway/browser review surfaces;
- provider mutation;
- Payment/Invoice behavior;
- external filing;
- Official Truth.

Those remain later Milestone 5 work packages.
