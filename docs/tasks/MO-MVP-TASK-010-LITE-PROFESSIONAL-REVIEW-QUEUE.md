# MO-MVP-TASK-010 — Lite Professional Review Queue

## Ownership and user outcome

Execution owns the Professional Review Case, queue, assignment, checklist, evidence, decision, and internal Information Request Draft. MarkReg continues to own Customer Confirmation, Matter Draft, readiness, and preparation data. Execution consumes a typed boundary and retains an immutable `MatterDraftReviewSnapshot`; it never reads MarkReg persistence.

The user is an internal trademark professional whose job is to assess a ready Matter Draft against evidence, without implying appointment or executing a protected external action. Under **Work**, the secondary **Customers / Professional Review** workspace provides a filterable queue and review detail. Desktop uses a multi-column information layout; at 390px filters, checklist controls, and actions stack without horizontal overflow.

## Lifecycle and state transitions

`READY_FOR_PROFESSIONAL_REVIEW → QUEUED → IN_REVIEW → NEEDS_INFORMATION | REVIEWED_READY_FOR_NEXT_STEP`.

Source-version change produces `STALE`; an operator may produce `WITHDRAWN`. A queued case may be claimed once. Claiming is not appointment. Only its claimant can update or complete it. A stale or withdrawn case cannot be reviewed. A completed decision is immutable; re-review requires a new case tied to a new Matter Draft version.

Creation is idempotent and permits only one active case per Matter Draft version. Server-side source retrieval verifies status and exact version; client-supplied readiness is ignored.

## Versioned contracts and checklist

The shared v1 boundary defines `ProfessionalReviewCaseId`, case/status/assignment, evidence, checklist item, decision, `InformationRequestDraft`, `MatterDraftReviewSnapshot`, and `ReviewAuthorityConsequences`. Assignment explicitly carries `professionalAppointed: false`.

The blocking checklist covers source currency, confirmation validity, applicant information, mark representation, jurisdiction, class selection, goods/services, filing basis, representative requirement, document readiness, commercial scope, and authority boundaries. Results are `PASS`, `FAIL`, `UNKNOWN`, or `NOT_APPLICABLE`; `UNKNOWN` never passes. Ready-for-next-step requires every blocking result to be `PASS` or `NOT_APPLICABLE`.

## Gateway and Lite routes

Gateway exposes:

- `POST/GET /api/lite/professional-review-cases`
- `GET /api/lite/professional-review-cases/:reviewCaseId`
- `POST .../:reviewCaseId/claim`
- `PATCH .../:reviewCaseId/checklist`
- `POST .../:reviewCaseId/request-information`
- `POST .../:reviewCaseId/complete`
- `POST .../:reviewCaseId/withdraw`

The Lite location is `#work-professional-review`; it is a secondary Work workspace, not an eighth top-level destination.

## UI states, accessibility, and acceptance

Fixture-backed stories cover loading, empty, assigned/unassigned, stale, detail, blocking failure/unknown, information request, ready, withdrawn, error, long text, and 390px. The queue uses labelled controls, semantic headings and named regions; status is written in text. Back navigation retains component filters and restores keyboard focus to the originating case.

Acceptance: Work → Professional Review → filter QUEUED → open exact snapshot → claim → observe blocking UNKNOWN → update checklist → prepare information request and verify `customerMessageSent: false` → pass blocking items → mark ready → verify every authority consequence is false → return and verify filters/focus.

## Information-request and authority boundaries

`REQUEST_INFORMATION` creates an internal draft with requested fields, reason, reviewer note, timestamp, and `sent: false`. It sends no customer message. Every mutation reports `orderCreated`, `paymentCreated`, `formalMatterCreated`, `providerAppointed`, `filingCreated`, and `customerMessageSent` as false.

Matter Draft readiness is not professional approval. Review assignment is not professional appointment. Review started is not instruction accepted. Needs Information is not message sent. Review completion is not filing approval. Reviewed Ready for Next Step is not executed action.

## Non-goals and future handoff

There is no customer messaging, email, provider discovery/appointment, MGSN routing, payment, invoice, Order, formal Matter, filing execution, office submission, signature, auth redesign, or production database connector. A future separately governed Order/formal-Matter handoff may consume a ready decision, but this workflow neither defines nor executes it.
