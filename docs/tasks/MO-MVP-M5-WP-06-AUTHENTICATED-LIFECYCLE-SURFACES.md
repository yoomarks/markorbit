# M5-WP-06 — Authenticated Lifecycle Surfaces

## Objective

Expose the governed Milestone 5 lifecycle to authenticated customers and Operations without moving semantic ownership into Gateway or UI.

Customer surfaces consume MarkReg-owned Current Lifecycle View and Recommended Action projections. Operations can additionally inspect the exact Execution-owned review/admission/correction/handoff provenance that produced those projections.

## Customer boundary

The authenticated customer route is Workspace-scoped and requires `matter:read`. It returns only:

- current customer-safe lifecycle label and summary;
- a bounded timeline of customer-safe lifecycle events;
- the current customer projection of a Recommended Action when present;
- an explicit no-action state when no current recommendation exists.

Customer output omits reviewed-source admission fingerprints, Evidence Review Decision rationale, Provider Return provenance, correlation lineage, retry/idempotency metadata and correction-request detail.

The markreg.com Formal Matter view renders this bounded lifecycle surface and states explicitly that the projection is internal governed status, not trademark-office status or proof of filing.

## Recommended Action mutations

Customers with `matter:manage` may acknowledge or dismiss an existing Recommended Action. Gateway requires:

- a valid opaque Session resolved by Core;
- the requested Workspace to match the authenticated Principal;
- trusted Origin;
- valid CSRF token;
- stable Idempotency-Key;
- exact expected Recommended Action version.

Only `ACKNOWLEDGED` and `DISMISSED` are customer mutations. `SUPPRESSED` remains policy-owned. A stale version fails closed. Acknowledgement or dismissal changes advisory state only and never executes, files, pays for, appoints, submits or otherwise performs the recommended action.

## Operations provenance boundary

Operations provenance is a distinct route and permission boundary. It requires `review:perform`; `matter:read` or `review:read` alone is insufficient.

The Gateway combines two governed service reads without cross-service SQL:

1. MarkReg returns the full lifecycle projection and operations Recommended Action provenance for the Formal Matter.
2. For each Reviewed Source Admission referenced by those lifecycle events, Execution returns the exact admission, Evidence Review Decision, correction request and durable handoff/retry metadata.

The Operations Console exposes evidence references, review outcome/rationale, correction history and retry/idempotency state for triage. These remain internal provenance and do not become Official Truth.

## Workspace and authentication failure semantics

The surface fails closed for:

- customer attempts to access Operations provenance;
- Operations Principal lacking `review:perform`;
- expired or invalid Session;
- Principal/transport Workspace mismatch;
- cross-Workspace Formal Matter lookup;
- stale Recommended Action version;
- downstream MarkReg or Execution provenance outage.

No fallback selects another Workspace, another Matter, a latest action, or a different reviewed source.

## Acceptance evidence

Focused tests cover:

- `services/markreg/tests/lifecycle-surface-http.test.ts` — customer redaction, no-action state, Operations permission, cross-Workspace lookup and stale action mutation;
- `services/execution/tests/evidence-provenance-http.test.ts` — `review:perform` enforcement and exact review/correction/handoff provenance;
- `apps/gateway/tests/lifecycle-http.test.ts` — Session, Workspace, Operations permission, Origin/CSRF and stale-version behavior through the Gateway boundary;
- `apps/markreg-web/tests/LifecyclePanel.test.tsx` — customer lifecycle/timeline/no-action rendering and non-executing acknowledgement controls;
- source-derived Gateway route inventory includes all four new authenticated lifecycle routes.

WP-07 remains responsible for the exhaustive migration/restart/replay/isolation/redaction/concurrency/browser reliability matrix.

## Non-goals

WP-06 does not create:

- Official Status or Official Truth;
- Filing Submission or trademark-office contact;
- Payment or Invoice truth;
- legal appointment;
- automatic Formal Matter completion;
- Recommended Action execution;
- cross-service database reads;
- a new semantic owner in Gateway or either UI.
