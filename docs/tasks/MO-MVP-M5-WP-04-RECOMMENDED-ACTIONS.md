# M5-WP-04 — Explainable Recommended Actions

## Objective

Create MarkReg-owned durable Recommended Action candidates from one exact governed Current Lifecycle View while preserving the Milestone 5 authority boundary.

A Recommended Action is advisory internal/customer workflow state. It is not authorization, filing, trademark-office contact, Payment/Invoice truth or Official Truth.

## Deterministic policy

WP-04 implements one fixed policy contract:

- `recommended-action-policy-v1`;
- `CUSTOMER_ACTION_NEEDED` -> `CUSTOMER_ACTION_REQUIRED`;
- `CORRECTION_OR_REVIEW_ISSUE` -> `REVIEW_CORRECTION_ISSUE`;
- `INTERNAL_PROCESSING`, `REVIEWED_PROVIDER_EVIDENCE` and `WAITING_NO_ACTION` -> no action candidate.

The policy consumes only the current customer-safe Lifecycle View. It does not invent a due date when the governed source has none; `timingBasis` explicitly records that no deadline was inferred.

AI output is not an input to authoritative recommendation persistence in WP-04.

## Durable owner state

Migration `0035_markreg_recommended_actions.sql` is owned by `@markorbit/markreg-service` and adds:

- one current Recommended Action slot per Workspace/Formal Matter;
- exact source Lifecycle View ID/version/fingerprint binding;
- durable idempotent command replay for regeneration and status transition;
- append-only Recommended Action audit evidence;
- database constraints keeping `execution_authorized = false`.

The current slot is versioned. Re-evaluation on a newer actionable Lifecycle View reuses the stable action identity, updates exact source provenance, increments the version and returns the action to `OPEN`. When the current deterministic policy has no candidate, an existing action becomes `SUPPRESSED` while audit evidence records the suppressing Lifecycle View.

## State semantics

Persisted states are:

- `OPEN` — current deterministic policy recommends customer/operations attention;
- `ACKNOWLEDGED` — the recommendation was explicitly acknowledged;
- `DISMISSED` — the recommendation was explicitly dismissed;
- `SUPPRESSED` — the recommendation is no longer presented under the current governed lifecycle/policy state.

Regeneration is the only path that reopens a suppressed/dismissed/acknowledged slot from a newer exact Lifecycle View. Status transitions never authorize execution.

## Exactness and stale-source rules

Recommendation generation requires the exact current Lifecycle View:

```text
Lifecycle View ID
+ version
+ SHA-256 fingerprint
+ Formal Matter / Workspace binding
+ deterministic policy version
```

Repository writes lock the current Lifecycle View before idempotency inspection and recommendation mutation. Concurrent identical first-use regeneration therefore converges on one action/audit/command result.

A changed lifecycle version/fingerprint, cross-Workspace access or transition against a recommendation whose source Lifecycle View is no longer current fails closed. A stale recommendation cannot execute anything because WP-04 exposes no execution path and `executionAuthorized` remains `false` in contract and database state.

## Projection boundary

Operations-safe reads retain the full Recommended Action record including exact Lifecycle View and policy provenance.

Customer-safe reads omit source fingerprint and policy provenance and hide `SUPPRESSED` actions. They expose only the stable action identity, Matter reference, explanation/timing, status, version and `executionAuthorized: false`.

## Acceptance evidence

`services/markreg/tests/recommended-action-postgres.test.ts` proves:

- owner migration `0035` application and verification;
- deterministic actionable policy output;
- no invented due date;
- exact Lifecycle View provenance;
- concurrent/idempotent regeneration without duplicate business state;
- acknowledge/dismiss semantics without execution authority;
- suppression and later regeneration on lifecycle change;
- stale version/fingerprint and stale transition failure;
- Workspace-bounded reads/mutations;
- no recommendation creation for governed no-action states.

Hosted CI runs this PostgreSQL suite with the existing MarkReg owner database and keeps Milestone 2/3/4 regressions mandatory.

## Non-goals

WP-04 does not add:

- Gateway or browser routes;
- authenticated user/operations permission policy;
- external action execution;
- trademark-office contact or Filing Submission;
- Payment or Invoice;
- Official Status/application/application-number truth;
- real Execution-to-MarkReg reviewed-source transport.

Authenticated customer/operations surfaces remain M5-WP-06. The real reviewed-source handoff remains M5-WP-05.
