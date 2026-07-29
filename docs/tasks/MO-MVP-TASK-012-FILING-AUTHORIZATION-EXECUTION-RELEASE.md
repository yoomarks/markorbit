# MO-MVP-TASK-012 — Filing Authorization and Execution Release

## Objective and ownership

This milestone governs the transition from MarkReg's immutable `LOCKED_FOR_PREPARATION` Preparation Lock to customer Filing Authorization, Execution-owned internal release review, and one internal Filing Execution Task Draft. MarkReg continues to own the customer relationship, Confirmation, Matter Draft, Document Package, Customer Instruction Ledger, Preparation Lock, and authorization collection experience. Execution owns authorization records, evidence-based release checks, internal assignment and decision evidence, and the task draft. Execution consumes the lock only through its typed public source boundary; it never reads MarkReg persistence.

## Canonical distinctions and non-goals

**Authorization ≠ Submission. Release ≠ Execution. Execution Task Draft ≠ Filed Application.** Customer Instruction ≠ Filing Authorization; authorization ≠ professional appointment; internal assignment ≠ external appointment; release ≠ office acceptance; and payment (which is not created here) ≠ performance. This milestone has no trademark-office integration, external automation or API/email submission, dispatch, official number, payment, invoice, Order, formal Matter, appointment, MGSN routing, customer messaging, database migration, object storage, or authentication redesign.

## Versioned contracts and source lineage

The shared v1 contracts brand Filing Authorization, Execution Release, and Filing Execution Task Draft identifiers. An authorization embeds the exact immutable Preparation Snapshot and records Preparation Lock, Document Package, Instruction Ledger, Professional Review, customer, and commercial-scope lineage. Its server-derived scope fixes jurisdiction, applicant/owner, mark, classes, goods/services, basis, priority claim, locked-document use, representative use, channel, and execution window. No unspecified later change is authorized.

## State transitions

- Filing Authorization: `PENDING_CONFIRMATION → AUTHORIZED`; terminal governance outcomes are `WITHDRAWN`, `STALE`, and `EXPIRED`. All nine versioned acknowledgements are active, initially unchecked, and required. An authorized version is immutable.
- Execution Release: `DRAFT → BLOCKED | READY_FOR_RELEASE → RELEASED_FOR_EXECUTION`; governed terminal outcomes are `STALE` and `WITHDRAWN`. Blocking `FAIL` and `UNKNOWN` never permit release.
- Filing Execution Task Draft: `PREPARED → STALE | CANCELLED`. There are deliberately no submitted, filed, office-accepted, or registration states.

Creation and release decisions are idempotent; a conflicting payload produces `IDEMPOTENCY_CONFLICT`. Only one active authorization exists per exact lock version, one active release per authorization version, and one task draft per released execution. Completed decisions and execution snapshots are immutable. Later source changes make related authority, release, and draft stale.

## Release checks and evidence

Execution derives current-lock, locked-package, locked-ledger, current-review and current-authorization lineage; authorized party and capacity; exact scope; jurisdiction, applicant, mark, classes, goods/services, basis and priority; representative requirement; execution channel/window; unchanged commercial scope; and authority-boundary acknowledgements. Each check records PASS, FAIL, UNKNOWN, or NOT_APPLICABLE, its blocking nature, explanation, source, timestamp and evidence reference. Release requires every blocking check to PASS, an internal executor, and an explicit decision rationale.

## Gateway routes

The Gateway transparently forwards, but never decides, these public routes:

- `POST|GET /api/execution/filing-authorizations`; `GET /api/execution/filing-authorizations/:id`; `POST .../:id/confirm`; `POST .../:id/withdraw`.
- `POST|GET /api/execution/execution-releases`; `GET .../:id`; `POST .../:id/evaluate`; `PATCH .../:id/assignment`; `POST .../:id/release`; `POST .../:id/withdraw`.
- `GET /api/execution/filing-task-drafts/:id`; `GET /api/execution/execution-releases/:id/filing-task-draft`.

Typed downstream errors and idempotency headers cross the same boundary.

## Product experiences

MarkReg presents locked source lineage and scope, real unchecked form controls, all active acknowledgements, authority warnings, disabled confirmation until completion, and an authorization receipt headed **Authorized for internal execution review — not submitted**. It exposes no submission action.

Lite keeps Execution Release beneath **Work**, alongside Customers and Professional Review. The queue supports status, jurisdiction, channel, assignment, and stale/current filters. Detail presents immutable source lineage, acknowledgements, checks/evidence, assignment and rationale. Allowed actions are evaluate, assign, release, and withdraw. The receipt says **Released for execution — no external filing performed** and shows the internal task draft.

Both products define governed loading, empty/detail, blocked/ready, mutating, success, stale, withdrawn, and recoverable-error states rather than scattered flags. Semantic regions and headings, labels, keyboard-native controls, visible textual statuses, wrapping long content, and a 390px layout are required. Fixture-backed stories inventory every governed state.

## Acceptance path and future handoff

The deterministic acceptance path begins at the Preparation Lock receipt, reviews exact scope, proves acknowledgements begin unchecked and confirmation disabled, actively acknowledges and authorizes, verifies not submitted, then opens Lite Work / Execution Release, observes a blocking UNKNOWN, reevaluates authoritative fixture evidence, assigns and releases, verifies the one task draft and every false external consequence, and returns to the filtered queue with focus restored. Desktop and mobile Chromium use ordinary locators only.

A later separately governed milestone may consume the immutable task draft for external filing. It must introduce explicit protected-action approval, office/channel integration, execution evidence and an official response boundary; Provider Return must not become Official Truth automatically.

## Implemented vertical-slice evidence

The audited TASK 011 base is `b7563c98502afa65df01f1724fe2ccb6dd65157f`. It contains the final Document Package, Customer Instruction Ledger, Preparation Lock, Gateway integration suite, MarkReg application entry, and desktop/mobile preparation-lock acceptance journey inherited by this branch.

The customer application uses `apps/markreg-web/src/api/markreg.ts` for Preparation Lock retrieval and Filing Authorization create/get/confirm/withdraw calls through Gateway. `FilingAuthorizationView` receives those authoritative responses; confirmation is never held only in component state. Lite uses `apps/lite-web/src/api/execution.ts` for Execution Release create/list/get/evaluate/assignment/release/withdraw and task-draft retrieval. Neither Web application imports Execution service implementation code.

`apps/gateway/tests/filing-authorization-execution-release.test.ts` adds 15 real HTTP runtime tests using both the Gateway and Execution runtimes. It covers exact lock lineage and invalid state/version, replay/conflict/duplicate behavior, acknowledgements, confirmation immutability, withdrawal, stale/expiry refresh, release queue/detail/checks/assignment/decision behavior, a single immutable task draft, both retrieval routes, and stale propagation. The Gateway suite contains 53 tests. The MarkReg Web suite contains 23 tests and the Lite Web suite contains 9 tests.

`tests/e2e/filing-authorization-release.spec.ts` adds the deterministic cross-application acceptance path. It enters MarkReg from the exact Preparation Lock, actively confirms all nine initially unchecked acknowledgements, verifies the AUTHORIZED non-submission receipt, moves to Lite Work / Execution Release, retains a blocked filter, evaluates UNKNOWN evidence, assigns an internal executor, records explicit rationale, releases exactly one internal task draft, verifies all 13 false consequences, and restores focus on return. It runs in desktop Chromium and the 390px mobile Chromium project. The complete E2E inventory is 22 project tests; the `@visual` inventory is 16 project tests. Runtime captures cover MarkReg authorization acknowledgements and receipt plus Lite blocked and released states in both desktop and 390px mobile runs. Captures and browser artifacts are intentionally untracked.
