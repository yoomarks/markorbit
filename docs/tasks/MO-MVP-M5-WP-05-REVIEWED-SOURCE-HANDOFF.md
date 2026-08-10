# M5-WP-05 — Retry-safe Reviewed Source Handoff

## Objective

Deliver the real Execution-to-MarkReg transport for one exact admitted Reviewed Source while preserving service ownership, retry safety and correction history.

Execution owns review/admission and sender handoff state. MarkReg owns lifecycle projection. The transport does not create a distributed transaction and neither side reads the other service database.

## Durable sender semantics

Migration `0036_execution_reviewed_source_handoff.sql` is Execution-owned and persists:

- immutable Reviewed Source Admissions bound to the exact Evidence Review Decision, Evidence Receipt, Provider Return and Formal Matter target;
- admission idempotency commands and exact request fingerprints;
- one durable handoff record per exact admission;
- a stable MarkReg idempotency key reused across retries;
- append-oriented handoff audit evidence;
- `PENDING` and `DELIVERED` delivery state plus the committed MarkReg response snapshot.

Execution records the handoff before the network call. Receiver unavailability therefore leaves retryable `PENDING` state rather than losing sender intent.

## Response-loss and restart replay

The sender always retries the same exact MarkReg idempotency key for one admission. If MarkReg commits and the response is lost, the next attempt replays the already-committed Lifecycle Event instead of creating a duplicate. Execution then records `DELIVERED` and stores the exact response. A later Execution restart replays that stored response without another remote mutation.

Changed payload under an already-bound delivery idempotency key fails closed. Cross-Workspace transport is rejected at the trusted internal HTTP boundary.

## Correction and freshness semantics

`CORRECTION_REQUIRED` remains non-admissible. A corrected newer Provider Return produces a new Evidence Receipt, a new explicit review decision and a new Reviewed Source Admission identity.

Historical admissions and lifecycle events remain immutable. Once a newer corrected admission becomes the Current Lifecycle View, replay of the older committed handoff is local/idempotent and cannot replace that newer current view.

## HTTP/service boundary

Execution exposes trusted internal admission read/admit and handoff delivery routes guarded by the internal service secret and Workspace scope. MarkReg reads the exact admission through Execution HTTP and projects through its existing `LifecycleProjectionService`; it does not query Execution tables.

The envelope retains exact decision, receipt, Provider Return, Formal Matter, correlation and fingerprint provenance. It is transport evidence only and never becomes filing truth, office acceptance, Payment/Invoice authority or Official Truth.

## Acceptance evidence

`scripts/milestone5-reviewed-source-handoff.integration.test.ts` uses isolated Execution and MarkReg PostgreSQL databases plus real HTTP service runtimes to prove:

- sender handoff survives receiver unavailability and retries from durable `PENDING` state;
- response loss after MarkReg commit replays exactly one Lifecycle Event across MarkReg restart;
- Execution restart replays the stored delivered response without remote duplication;
- changed retry payloads fail closed;
- cross-Workspace admission access and handoff attempts are denied;
- `CORRECTION_REQUIRED` cannot create an admission;
- corrected newer evidence is re-reviewed and receives a distinct admission identity;
- replay of an older committed handoff cannot replace a newer corrected Current Lifecycle View;
- all projections retain `officialStatusVerified: false`.

Hosted validation runs this dual-database integration after independent owner migrations and keeps Milestone 2/3/4 and Browser/Visual regression gates mandatory.

## Non-goals

WP-05 does not add:

- browser or customer lifecycle UI;
- authenticated Gateway user/operations policy;
- external filing/submission or trademark-office contact;
- Payment or Invoice truth;
- legal appointment;
- Official Status/application/application-number truth;
- automatic Matter completion or Recommended Action execution.

Those authenticated Gateway and lifecycle surfaces remain M5-WP-06.
