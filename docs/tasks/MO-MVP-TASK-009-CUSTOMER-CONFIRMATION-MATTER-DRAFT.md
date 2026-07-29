# MO-MVP-TASK-009 — Customer Confirmation and Matter Draft

## Business objective and lifecycle

This vertical slice separates acceptance of a commercial Quote from preparatory professional work:

`Quote → Customer Confirmation → Matter Draft → Ready for Professional Review`

The customer confirms one exact, current Quote snapshot and can then prepare structured instructions. “Ready” means only that explicit blocking evidence checks passed; it is neither professional approval nor execution.

## Contracts and ownership

`@markorbit/contracts` owns version 1 `CustomerConfirmation`, `QuoteSnapshotReference`, acknowledgement, Matter Draft, readiness and branded identifier contracts. Monetary snapshot values remain integer minor units. MarkReg owns Customer Confirmation and Matter Draft state through the asynchronous `MatterFlowRepository`; its fixture implementation clones values on every repository boundary so confirmed commercial values cannot be silently mutated.

## API routes

The Gateway exposes:

- `POST /api/markreg/customer-confirmations`
- `GET /api/markreg/customer-confirmations/:confirmationId`
- `POST /api/markreg/customer-confirmations/:confirmationId/withdraw`
- `POST /api/markreg/matter-drafts`
- `GET /api/markreg/matter-drafts/:matterDraftId`
- `PATCH /api/markreg/matter-drafts/:matterDraftId`
- `POST /api/markreg/matter-drafts/:matterDraftId/evaluate-readiness`

Confirmation requires the exact Quote and plan identities and versions, terms version, all four active acknowledgements, actor/customer identity and an idempotency key. The server loads the owned Quote; a client total is neither requested nor trusted. Every mutation response includes its next permitted action and typed false authority consequences.

## State transitions and invariants

- Only a non-expired `READY` Quote with the exact pricing/version line can become `CONFIRMED`.
- Reuse of an idempotency key and identical payload returns the original immutable confirmation; a different payload is `IDEMPOTENCY_CONFLICT`.
- Confirmed values are a copied Quote line-item and total snapshot. Later pricing is never reapplied.
- Confirmation is `CONFIRMED → WITHDRAWN`; withdrawal is idempotent and prevents new Matter Draft preparation.
- Matter Draft is `NEEDS_INFORMATION → READY_FOR_PROFESSIONAL_REVIEW`. Ready or withdrawn drafts cannot be silently edited.
- A blocking `FAIL` or `UNKNOWN` prevents readiness. Readiness is always derived from the evidence checks.

Typed errors include `QUOTE_NOT_FOUND`, `QUOTE_VERSION_MISMATCH`, `QUOTE_NOT_CONFIRMABLE`, `QUOTE_EXPIRED`, `ACKNOWLEDGEMENTS_REQUIRED`, `IDEMPOTENCY_CONFLICT`, `CONFIRMATION_NOT_FOUND`, `CONFIRMATION_WITHDRAWN`, `MATTER_DRAFT_NOT_FOUND`, and `MATTER_DRAFT_IMMUTABLE`.

## Readiness checks

The evidence model evaluates confirmation validity, applicant identity/address, mark representation, jurisdiction, class selection, goods/services, filing basis, representative requirement, documents and unchanged commercial scope. Each check records code, `PASS | FAIL | UNKNOWN | NOT_APPLICABLE`, explanation, optional evidence reference, and blocking classification. All blocking checks must be `PASS` or `NOT_APPLICABLE`.

## Customer experience and states

The intended MarkReg information architecture is Quote review, unselected acknowledgements, immutable receipt, structured Matter Draft sections, missing-information summary and readiness evidence. Desktop uses a review/workspace layout; mobile collapses it into one reading and keyboard order without horizontal overflow. Loading, empty, incomplete, stale, recoverable-error, withdrawn and ready-for-review states retain the same authority notice. Focus remains visible, field errors are associated with controls, and the strongest label is **Prepare for professional review**—never “Submit filing”. Fixture-backed Storybook and desktop/mobile Playwright coverage are the acceptance surfaces for the product workflow.

## Authority restrictions

The returned boundary is always `orderCreated: false`, `paymentCreated: false`, `professionalAppointed: false`, and `filingCreated: false`. These routes do not charge, communicate, appoint a provider, open a formal Matter, create an Order, contact an office, submit a filing or mutate an official trademark record. Customer Confirmation is not an Order or payment; Matter Draft is not a formal Matter or filing instruction; readiness is not approval.

## Acceptance path

Review the fixture Quote, actively complete acknowledgements, confirm and verify its receipt; prepare a Matter Draft, observe blocking evidence, complete required fixture data, evaluate it to `READY_FOR_PROFESSIONAL_REVIEW`, and verify all four automatic-consequence flags remain false.

## Non-goals and future handoff

Payment, settlement, Order creation, formal Matter opening, professional approval, provider discovery/appointment, signing, power of attorney, filing, office integration, communications, authentication redesign and production persistence are excluded. A future professional-review slice may consume the ready draft through a contract-controlled handoff; it must not reinterpret readiness as approval or infer filing authority.
