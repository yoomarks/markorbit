# MO-MVP-TASK-011 — Document Package and Customer Instruction Ledger

## Objective and ownership

MarkReg owns the governed preparation stage after an Execution-owned Professional Review Case reaches `REVIEWED_READY_FOR_NEXT_STEP`. It owns Document Packages, server-derived requirements, metadata references and lineage, Customer Instruction Ledgers, confirmations, and Preparation Locks. Execution remains the owner of review cases, decisions, checklists, and reviewer evidence. MarkReg consumes that source through the typed public HTTP boundary; it never reads Execution storage.

The customer job is to understand what evidence is required, record document metadata, preserve explicit instruction history, actively acknowledge the exact preparation scope, and obtain a durable preparation receipt without accidentally filing, paying, appointing, or sending anything.

## Versioned contracts and statuses

The shared v1 contracts define branded package, document item, ledger, instruction entry, and lock identifiers; exact source versions; document references without binary content; validation evidence; structured instruction values; acknowledgements; immutable snapshots; and explicit authority consequences.

Package statuses are `DRAFT`, `NEEDS_DOCUMENTS`, `READY_FOR_CUSTOMER_CONFIRMATION`, `LOCKED_FOR_PREPARATION`, `STALE`, and `WITHDRAWN`. Document item statuses distinguish `REQUIRED_MISSING`, `PROVIDED`, `REVIEW_NEEDED`, `ACCEPTED_FOR_PREPARATION`, `REJECTED`, `SUPERSEDED`, and `NOT_APPLICABLE`. Ledger statuses are `DRAFT`, `CONFIRMED`, `LOCKED_FOR_PREPARATION`, `STALE`, and `WITHDRAWN`; instruction entries are `PROPOSED`, `CONFIRMED`, `SUPERSEDED`, or `WITHDRAWN`.

`ACCEPTED_FOR_PREPARATION` does not prove authenticity, notarization, legalization, signature validity, legal validity, or filing authority. Document metadata is not a stored legal original. Fixture requirements are non-production, illustrative, not authoritative legal advice, and require jurisdiction-specific verification.

## Lineage and append-only history

A package binds one exact review case and decision version, Matter Draft and version, Customer Confirmation, customer, jurisdiction, and trademark reference. Requirements are derived by MarkReg. A supplied item cannot be silently replaced: supersession creates a new item version and retains the old item as `SUPERSEDED`.

A ledger binds one package lineage and exact source versions. Entries contain a controlled instruction type, structured value, optional note, and evidence. Confirmed values are never edited. A changed value is appended and explicitly names the superseded entry, retaining the complete customer history.

## Validation and preparation lock

Validation records `PASS`, `FAIL`, `UNKNOWN`, or `NOT_APPLICABLE`, whether the check blocks, its explanation, evidence reference, timestamp, and source. Missing requirements and any blocking `FAIL` or `UNKNOWN` prevent readiness. Source review, Matter Draft, document presence/version/type/metadata/checksum/language/translation/signature/notarization/legalization, customer use authorization, and commercial scope are modeled as controlled checks.

Confirmation requires active acknowledgements; none is preselected. A lock requires a current ready package, a confirmed ledger, passing or non-applicable blocking checks, and unchanged commercial scope. It atomically records locked package and ledger versions and an immutable snapshot. Post-lock changes require invalidation or withdrawal and new package/instruction confirmation lineage.

**Preparation Lock ≠ Filing Submission.** Locking creates no Order, payment, formal Matter, professional appointment, filing, submission, customer message, external document send, or trademark-office contact. The next permitted action is a separately governed filing-authority review.

## Gateway routes

- `POST|GET /api/markreg/document-packages`
- `GET /api/markreg/document-packages/:documentPackageId`
- `POST /api/markreg/document-packages/:documentPackageId/documents`
- `POST /api/markreg/document-packages/:documentPackageId/documents/:documentItemId/supersede`
- `PATCH /api/markreg/document-packages/:documentPackageId/documents/:documentItemId`
- `POST /api/markreg/document-packages/:documentPackageId/evaluate`
- `POST /api/markreg/document-packages/:documentPackageId/withdraw`
- `POST /api/markreg/instruction-ledgers`
- `GET /api/markreg/instruction-ledgers/:instructionLedgerId`
- `POST /api/markreg/instruction-ledgers/:instructionLedgerId/entries`
- `POST /api/markreg/instruction-ledgers/:instructionLedgerId/entries/:instructionEntryId/confirm|supersede`
- `POST /api/markreg/instruction-ledgers/:instructionLedgerId/confirm|withdraw`
- `POST /api/markreg/preparation-locks`
- `GET /api/markreg/preparation-locks/:preparationLockId`

## Experience and states

Information architecture progresses from source provenance, to requirements and document lineage, to validation, instruction history, active acknowledgements, and the lock receipt. Desktop uses readable grouped regions; at 390px every region becomes a single wrapping column with actions in document order. Semantic headings, named regions, labelled controls, keyboard actions, visible focus, text status, and safe wrapping are required.

Governed view states are `SOURCE_LOADING`, `SOURCE_ERROR`, `DOCUMENT_PACKAGE_LOADING`, `NEEDS_DOCUMENTS`, `DOCUMENT_REVIEW_NEEDED`, `DOCUMENTS_READY`, `INSTRUCTIONS_INCOMPLETE`, `INSTRUCTIONS_CONFIRMING`, `READY_TO_LOCK`, `LOCKING`, `LOCKED_FOR_PREPARATION`, `STALE`, `WITHDRAWN`, and `RECOVERABLE_ERROR`. These cover loading, empty, error, partial-data, success, and unavailable/permission-equivalent source states.

The deterministic acceptance path opens Documents and Instructions from a completed review, observes missing requirements, records fixture metadata, resolves a blocking unknown, evaluates readiness, reviews append-only instructions, verifies unchecked acknowledgements, confirms, locks, and verifies the immutable “Locked for preparation — not submitted” receipt and every false authority consequence on desktop and mobile Chromium.

## Non-goals and future handoff

This task adds no object storage, antivirus, OCR, authenticity check, electronic signature, notarization, legalization, messaging, email, appointment, provider routing, payment, invoice, Order, official Matter, office submission, filing number, persistence migration, or authentication redesign. A future bounded task may consume the immutable snapshot in a separate explicit filing-authorization review; the snapshot itself grants no authority.
