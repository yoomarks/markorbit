# Reviewed Source Admission runnable preview

## Task shape

- **Task ID:** `EXECUTION-REVIEWED-SOURCE-ADMISSION-RUNNABLE-PREVIEW`
- **Repository / allowed directories:** `apps/operations-console`, `docs/ui`
- **Objective:** connect one admissible Evidence Review Decision to the existing Execution-owned Reviewed Source Admission command without triggering downstream work.
- **Expected PR title:** `feat(operations): add runnable Reviewed Source Admission preview`

## User and job to be done

The user is an authenticated Operations reviewer with `review:perform`. They need to verify one exact `ADMITTED_FOR_INTERNAL_USE` decision, choose one exact Formal Matter reference/version and explicitly select the evidence references retained in an immutable Reviewed Source Admission.

Execution owns the decision and admission. MarkReg owns the Formal Matter and later lifecycle projection. Gateway supplies the authenticated Workspace Principal and mutation protection.

## Canonical sources and contracts

- `packages/contracts/src/evidence-lifecycle.ts`
- `services/execution/src/reviewed-source-handoff.ts`
- `apps/gateway/src/lifecycle-http.ts`
- `apps/operations-console/src/lifecycle.ts`
- `docs/architecture/EVIDENCE-REVIEW-LIFECYCLE-AUTHORITY-BOUNDARY.md`
- `docs/tasks/MO-MVP-M5-WP-05-REVIEWED-SOURCE-HANDOFF.md`

No contract changes are made. Admission does not perform a MarkReg handoff, lifecycle projection, Filing Submission, office contact, Payment/Invoice, appointment, Matter completion or Official Truth.

## Information architecture

1. Operations identity, authority and preview boundary.
2. Exact immutable review decision and source lineage.
3. Exact Formal Matter target selection.
4. Explicit admitted-evidence reference selection.
5. Human confirmation and admission command.
6. Immutable admission receipt with downstream handoff explicitly not started.

Desktop uses a two-column source/command workbench. At 1080px the source precedes the command in one column. At 560px metadata lists collapse to a single column and long identifiers wrap.

## State matrix

Fixture-backed states cover loading, successful empty, permission/auth failure, owner unavailable, malformed/error, partial Formal Matter context, non-admissible decision, decision-version conflict, Formal Matter-version conflict and successful admission.

Unavailable truth is never rendered as empty or admitted. `CORRECTION_REQUIRED` and `REJECTED` never receive admission controls.

## Accessibility

- Semantic header, navigation, main, articles, headings, definitions, form and fieldsets.
- Explicit radio, checkbox and confirmation labels; visible focus and non-colour status copy.
- Result and errors use live status/alert semantics.
- Mobile acceptance verifies source-before-command order and horizontal overflow.
- Reduced-motion preference removes non-essential transitions.

## Events and state transitions

`ADMITTED_FOR_INTERNAL_USE` decision + exact Formal Matter version + selected references + authenticated human confirmation → `ReviewedSourceAdmissionResult`.

The preview client simulates the existing typed Gateway command only. No network command, actor spoofing, lifecycle delivery or external action is emitted.

## Acceptance and non-goals

- Storybook states: ready, partial, non-admissible, empty, permission required, unavailable and mobile.
- Playwright: exact admission success, non-admissible/passive states, permission/version conflicts and 390px order/overflow.
- Focused component tests, package lint/typecheck/test/build and hosted affected CI.
- Non-goals: MarkReg lifecycle handoff/projection, customer status, Recommended Action, external filing, payment, legal appointment, Matter completion and Official Truth.
