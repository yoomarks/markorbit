# M5-WP-03 — Durable MarkReg Lifecycle Projection

## Objective

Create MarkReg-owned durable lifecycle projection from one exact Execution-owned Reviewed Source Admission while preserving the Milestone 5 authority locks.

The projection is governed internal lifecycle truth. It is not trademark-office Official Status, a Filing Submission, office acceptance or proof that an application/application number exists.

## Durable owner state

Migration `0034_markreg_lifecycle_projection.sql` is owned by `@markorbit/markreg-service` and adds:

- append-only lifecycle event records;
- one deterministic current lifecycle view per Workspace/Formal Matter;
- durable command idempotency and exact replay snapshots;
- exact Reviewed Source Admission provenance including review decision, Evidence Receipt, Provider Return and Formal Matter references;
- database constraints that keep `official_status_verified = false` for this internal projection.

The migration follows the current repository migration sequence without changing historical MarkReg migrations.

## Source boundary

WP-03 consumes the canonical `ReviewedSourceAdmissionEnvelope` through a bounded reader port. It does not read the Execution database and does not construct admission truth from a raw Provider Return.

The exact source chain retained in every event is:

```text
Reviewed Source Admission ID/version/fingerprint
-> Evidence Review Decision ID/version
-> Evidence Receipt ID/version
-> Provider Return ID/version
-> exact Formal Matter ID/version
```

The service additionally verifies Workspace and correlation lineage before persistence.

A missing admission, cross-Workspace admission, changed admission version/fingerprint, changed Formal Matter version or mismatched correlation lineage fails closed.

## Lifecycle event and current-view semantics

Every accepted unique admission creates one append-only `LifecycleEventProjection` with:

- explicit lifecycle state and event code;
- customer-safe label and summary;
- source `occurredAt` and projection `projectedAt` timestamps;
- immutable exact-source provenance;
- SHA-256 event fingerprint;
- `officialStatusVerified: false`.

The `CurrentLifecycleView` is a deterministic MarkReg read model. Current-event selection uses:

1. later `occurredAt`;
2. explicit lifecycle-state precedence when timestamps tie;
3. stable Reviewed Source Admission identity as the final tie breaker.

The view has its own monotonically increasing projection version and fingerprint. Adding an older event therefore preserves history without silently replacing newer current state.

## Idempotency, replay and duplicate admission

- `(workspace_id, idempotency_key)` stores durable command replay evidence;
- exact idempotent retries return the committed event/view snapshot;
- changed payload under the same idempotency key fails with `IDEMPOTENCY_CONFLICT`;
- the same exact Reviewed Source Admission cannot create duplicate lifecycle events;
- a second key for the same exact semantic projection reuses the existing event;
- a conflicting semantic projection for an already-consumed exact admission fails with `VERSION_CONFLICT`.

Formal Matter locking serializes per-Matter event version allocation and protects deterministic concurrent writes.

## Read boundary

MarkReg exposes repository/service reads only by exact Workspace and Formal Matter:

- current lifecycle view;
- append-oriented lifecycle event timeline.

Cross-Workspace reads return no lifecycle state. No cross-service SQL is introduced.

## Authority consequences

Creating or reading a Lifecycle Projection does not automatically create:

- Payment or Invoice;
- legal/professional appointment;
- external Filing Submission;
- official application or application-number truth;
- trademark-office acceptance/contact;
- Formal Matter completion;
- user Capability verification;
- Recommended Action execution.

`officialStatusVerified` remains fixed to `false`; a future official-source subsystem must establish separate governed truth rather than reinterpret this projection.

## Acceptance evidence

`services/markreg/tests/lifecycle-projection-postgres.test.ts` proves:

- MarkReg ownership and verification of migration `0034`;
- exact admitted-source provenance retention;
- durable restart/reload of lifecycle event and current view;
- idempotent command replay and exact-admission deduplication;
- conflicting idempotency/admission rejection;
- missing, stale-exactness and cross-Workspace source failure;
- Workspace-bounded reads;
- deterministic current-view precedence;
- append-only lifecycle-event persistence;
- absence of official application/application-number projection truth.

Existing MarkReg migration verification remains strict and is extended to include `0034` rather than weakened.

## Non-goals

WP-03 does not add:

- Execution Reviewed Source Admission creation or the real Execution-to-MarkReg HTTP handoff;
- correction/replay transport across services;
- Recommended Action generation or acknowledgement;
- Gateway/browser lifecycle routes or customer UI;
- Payment/Invoice behavior;
- external filing;
- trademark-office Official Truth.

The real retry-safe cross-service handoff remains M5-WP-05; Recommended Actions remain M5-WP-04; browser/API journeys remain M5-WP-06.
