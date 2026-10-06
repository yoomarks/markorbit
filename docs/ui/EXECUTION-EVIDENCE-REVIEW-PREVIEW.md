# Execution Evidence Review runnable preview

## Task shape

- **Task ID:** `EXECUTION-EVIDENCE-REVIEW-RUNNABLE-PREVIEW`
- **Repository / allowed directories:** `apps/operations-console`, `docs/ui`
- **Objective:** connect the Execution-owned evidence review lifecycle to the new Operations UI and make one exact human review path runnable.
- **Expected PR title:** `feat(operations): add runnable Evidence Review preview`

## User and job to be done

The user is an authenticated Operations reviewer. They need to inspect one exact `PENDING_REVIEW` Execution Evidence Receipt, capture its stable source identity, and record exactly one immutable decision: `ADMITTED_FOR_INTERNAL_USE`, `CORRECTION_REQUIRED`, or `REJECTED`.

Execution owns the receipt, captured source, review decision and correction request. Gateway and Core establish the current Workspace Principal and `review:read` / `review:perform` authority.

## Contracts and authority boundary

- `packages/contracts/src/evidence-lifecycle.ts`
- `services/execution/src/provider-return-evidence.ts`
- `services/execution/src/evidence-review.ts`
- `apps/operations-console/src/lifecycle.ts`
- `docs/tasks/MO-MVP-M5-WP-02-EXECUTION-EVIDENCE-REVIEW.md`
- `docs/tasks/MO-MVP-M5-WP-06-AUTHENTICATED-LIFECYCLE-SURFACES.md`

No contract changes are made. A review decision does not certify the Provider Return, admit a Reviewed Source to a Formal Matter, project lifecycle state, submit a filing, contact an office, create payment, complete a Matter or create Official Truth.

## Information architecture

1. Operations identity, current authority and internal-truth boundary.
2. Queue summary and exact Execution-owned review queue.
3. Selected receipt, claim boundary and review material references.
4. Exact source capture.
5. Human outcome and rationale.
6. Immutable decision receipt or separate correction-request reference.
7. Collapsible exact provenance.

Desktop uses a persistent navigation rail and queue/detail workbench. At 820px navigation becomes horizontal and queue/detail stack; at 560px metrics, provenance and decision controls become single-column.

## State matrix

Fixture-backed states cover loading, successful empty, unauthenticated/permission failure, owner unavailable, malformed/error, partial evidence projection, exact-source conflict, admitted success and correction-request success. Unavailable owner truth is never shown as an empty queue or undecided outcome.

## Accessibility

- Semantic header, navigation, main, queue list, sections, headings, form, fieldset and details.
- Explicit radio labels, textarea labels, selected queue `aria-pressed`, live result status and visible focus.
- Status text accompanies every colour treatment.
- Mobile acceptance verifies reading order and horizontal overflow.
- Reduced-motion preference prevents animation-dependent behavior.

## Events

The production contract uses the existing source-capture and decision Gateway routes. The deterministic preview simulates only their typed owner results and emits no network command. `CORRECTION_REQUIRED` creates a separate correction-request reference; it never mutates historical Provider Return or Evidence Receipt truth.

## Acceptance and validation

- Storybook: pending queue, partial evidence, successful empty, permission required, owner unavailable and mobile.
- Playwright: exact capture → admitted decision, correction request, passive/partial states, permission/conflict and 390px order/overflow.
- Focused component tests, package lint/typecheck/build and hosted affected CI.

## Non-goals

- Reviewed Source admission to a Formal Matter.
- MarkReg lifecycle projection or Recommended Action generation.
- Provider Return mutation.
- External filing, trademark-office contact, payment, appointment, Matter completion or Official Truth.
