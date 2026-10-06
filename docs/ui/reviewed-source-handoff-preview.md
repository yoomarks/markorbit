# Reviewed Source Handoff runnable preview

## Task shape

- **Task ID:** `EXECUTION-REVIEWED-SOURCE-HANDOFF-RUNNABLE-PREVIEW`
- **Repository / allowed directories:** `apps/operations-console`, `docs/ui`
- **Objective:** project one exact Execution-owned Reviewed Source Admission into MarkReg-owned internal lifecycle truth through the existing retry-safe delivery boundary.
- **Expected PR title:** `feat(operations): add runnable Reviewed Source Handoff preview`

## User and job to be done

The user is an authenticated Operations reviewer with `review:perform`. They need to verify one exact admission and Formal Matter version, choose one internal lifecycle state, write customer-safe copy and explicitly deliver a retry-safe handoff. Execution owns durable sender state; MarkReg owns append-only lifecycle events and the Current Lifecycle View.

## Canonical sources and contracts

- `packages/contracts/src/evidence-lifecycle.ts`
- `services/execution/src/reviewed-source-handoff.ts`
- `services/markreg/src/lifecycle-projection.ts`
- `apps/gateway/src/lifecycle-http.ts`
- `apps/operations-console/src/lifecycle.ts`
- `docs/tasks/MO-MVP-M5-WP-03-MARKREG-LIFECYCLE-PROJECTION.md`
- `docs/tasks/MO-MVP-M5-WP-05-REVIEWED-SOURCE-HANDOFF.md`

No contract changes are made. The lifecycle projection is internal governed truth, not Filing Submission, office acceptance/contact, Payment, completion, legal appointment, Capability verification or Official Truth. `officialStatusVerified` stays `false`.

## Information architecture and responsive behavior

The page presents the identity/authority boundary, four summary metrics, exact immutable admission/source lineage, a human projection command, durable sender status, and delivered event/current-view receipts. Desktop uses a source/command split. At 1080px the source precedes the command; at 560px identifiers and result panels stack without horizontal overflow.

## States and transitions

Fixture-backed states cover loading, empty, unauthorized, owner unavailable, malformed/error, partial provenance, permission denial, stale admission, idempotency conflict, dependency outage, pending retry and delivered success.

`NOT STARTED` → persisted sender `PENDING` before MarkReg contact → `DELIVERED` after MarkReg result. Dependency failure retains `PENDING`, attempt count, error code and stable MarkReg idempotency key. Retrying the same logical handoff converges to one event and one Current Lifecycle View. No event or view is shown while pending.

## Accessibility

Semantic landmarks, headings, definitions and form labels expose the workflow. Status is not colour-only. Pending and delivered outcomes use live regions; errors use alert semantics. Keyboard focus is visible, reduced motion is respected, and mobile acceptance verifies source-before-command order and overflow.

## Events and non-goals

The preview client deterministically simulates the existing typed Gateway delivery command; it performs no network mutation. It emits no Filing Submission, payment, office contact, customer mutation, Recommended Action, completion or authority change. AI may explain the context but cannot record the authoritative handoff.

## Acceptance

- Storybook: ready, pending retry, delivered after retry, partial, empty, permission required, owner unavailable and mobile.
- Playwright: ordinary delivery, dependency outage then stable-key retry, passive/partial states, authority/source/idempotency conflicts and 390px order/overflow.
- Focused component tests, package lint/typecheck/test/build and affected repository validation.
