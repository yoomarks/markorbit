# TASK 023 — Mo Lite durable Matter workspace

## Outcome and boundaries

A provisioned Workspace member uses the existing Lite shell to list, search, filter, paginate, deep-link, refresh, and inspect MarkReg-owned durable Formal Matters. The user is a practitioner whose job is to recover the immutable creation identity and lineage without causing a status transition or protected action.

The production path is PostgreSQL → Core Session/Workspace Principal → MarkReg → Gateway → Lite Web. MarkReg remains the canonical owner; Lite stores no Matter copy. The existing `GET /api/markreg/formal-matters/:formalMatterId` route is reused and `GET /api/markreg/formal-matters` completes its route family with a bounded projection.

## UX and state model

The existing Today/Work information architecture gains one **Matters** destination. Desktop uses the established card list, filter row, and two-column detail; mobile stacks filters, rows, and detail cards without horizontal overflow. Search, status, type, page, Workspace, and selected Formal Matter live in the URL. Browser Back returns to the exact URL-backed list and restores row focus. Switching Workspace changes the request scope and aborts stale work.

Loading, empty, typed not-found, permission-denied, unavailable (503), success, and missing-Workspace states are explicit and announced by shared accessible primitives. Detail presents bounded identity, lineage, applicant/scope, readiness and snapshot integrity. The MarkReg receipt link is navigational only.

## Contracts, transitions and events

`FormalMatterListQuery`, `FormalMatterListItem`, and `FormalMatterListResponse` are shared contracts. Default ordering is `createdAt DESC, formalMatterId ASC`; page size is bounded to 100. Searches are PostgreSQL predicates over Formal Matter ID, source Draft ID, and the explicitly safe applicant/trademark snapshot fields. Detail reads the immutable TASK 022 snapshot. There are no formal-state transitions and no events or side effects.

Core supplies the existing permission matrix. Gateway resolves the opaque cookie and Workspace Principal, then sends only the trusted internal credential and Principal envelope to MarkReg. MarkReg enforces `matter:read` and Workspace scope; a cross-Workspace detail is 404 and a list returns only that Workspace.

## Acceptance and validation

Focused repository evidence covers bounded projection, deterministic pagination, search and Workspace isolation. The authenticated HTTP and PostgreSQL suites remain mandatory, followed by `pnpm check`. Playwright real-runtime acceptance must exercise list/detail, Back/refresh/deep link, desktop/mobile, restart recovery and confirm no `page.route`, `context.route`, or `route.fulfill` interception.

No migration is introduced because this is a read-only projection over the TASK 022 Formal Matter tables. Assignment, priority, notes, status transitions, Professional Review changes, documents, providers, orders, payment, filing, notification, outbox, RLS, JWT, registration and TASK 024 are non-goals.
