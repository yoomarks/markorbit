# PLC-WP-02 — Durable Product-owned Content Preparation State

## 1. Task ID

`MO-MVP-PLC-WP-02`

## 2. Repository and allowed directories

Repository: `yoomarks/markorbit`.

Allowed implementation areas:

- `services/lite/**`;
- `packages/contracts/src/product-loop.ts` only if an already-frozen contract proves insufficient;
- `infrastructure/persistence/migrations/**` and `migration-owners.json`;
- bounded validation/CI files required to prove this work package;
- this task document and sequencing documentation.

## 3. Objective and user-visible outcome

Persist the smallest Lite-owned state needed to take an exact, traceable Today Recommendation into bounded Content preparation, preserve draft history, require Human Review, and prepare a PublishPackage without claiming publication.

No UI is added in WP-02. The later Lite Today runtime can consume this durable state rather than fixtures or request-local objects.

## 4. Canonical sources

- merged PLC-WP-01 / PR #75;
- `docs/planning/MO-MVP-PRODUCT-LOOP-CLOSURE-PLAN.md`;
- `docs/architecture/PRODUCT-LOOP-AUTHORITY-BOUNDARY.md`;
- `packages/contracts/src/product-loop.ts`;
- merged Core ReadyPackage content boundary from PR #72 / #74;
- `AGENTS.md`.

## 5. Contracts consumed or changed

Consume the frozen `@markorbit/contracts/product-loop` contracts:

- `ProductLoopSourceReference`;
- `TodayRecommendation`;
- `ContentOpportunity`;
- `ContentDraft`;
- `ContentReviewDecision`;
- `PublishPackage`.

WP-02 does not add a parallel Knowledge contract or a universal Artifact contract.

## 6. Required behavior

- Lite owns the durable Product state.
- A new Recommendation receives only source locators from the Product command; an injected upstream source-authority boundary resolves exact owner/version/fingerprint provenance before persistence.
- Workspace is always a Core Workspace UUID and every query/write is Workspace-scoped.
- One accepted Content Opportunity may start one bounded draft version line.
- Draft revisions are immutable versions; at most 25 versions are permitted per draft line.
- Exact expected version + fingerprint is required before a revision or review transition.
- Human Review is an immutable decision over one exact review-ready draft version.
- A PublishPackage requires `APPROVED_FOR_PUBLISH_PACKAGE` over that exact draft fingerprint.
- PublishPackage creation keeps `externalPublishExecuted=false`.
- Exact idempotency replay returns the persisted result; reuse of a key with a changed request fails.
- Resource advisory locks make competing expected-version writes deterministic.
- State survives process/repository recreation because PostgreSQL is the source of truth.

## 7. State transitions

```text
TodayRecommendation OPEN
-> ContentOpportunity ACCEPTED_FOR_PREPARATION
-> ContentDraft v1 DRAFT
-> ContentDraft vN DRAFT (bounded revision)
-> ContentDraft vN+1 READY_FOR_HUMAN_REVIEW
-> ContentReviewDecision
   -> APPROVED_FOR_PUBLISH_PACKAGE -> PublishPackage PREPARED
   -> CHANGES_REQUIRED -> no PublishPackage
   -> REJECTED -> no PublishPackage
```

A review decision does not publish externally. A PublishPackage is not Published.

## 8. UI states

None in WP-02. UI/runtime journey is reserved for PLC-WP-05.

## 9. Events emitted and consumed

No new event bus contract in WP-02. The verified problem requires durable Product state, not cross-service event extraction.

The source-authority interface is synchronous request/response at the service boundary and prevents request-body provenance from becoming authority.

## 10. Acceptance tests

PostgreSQL coverage must prove:

- exact Knowledge ReadyPackage provenance is persisted through Recommendation -> Content preparation;
- draft version history remains queryable and immutable;
- approved Human Review is required to prepare a PublishPackage;
- no external publication flag becomes true;
- exact commands replay across store/process recreation;
- same idempotency key with changed payload conflicts;
- two concurrent mutations from one expected draft version yield one winner and one controlled version conflict;
- another Workspace cannot read the records;
- migration ownership is `@markorbit/lite-service`.

## 11. Validation commands

```bash
pnpm install --frozen-lockfile
pnpm validate:workspace
pnpm validate:persistence-boundaries
pnpm --filter @markorbit/lite-service lint
pnpm --filter @markorbit/lite-service typecheck
pnpm --filter @markorbit/lite-service test
pnpm --filter @markorbit/lite-service build
LITE_CONTENT_POSTGRES_TEST_REQUIRED=1 pnpm --filter @markorbit/lite-service exec vitest run tests/content-preparation-postgres.test.ts
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 12. Non-goals

WP-02 does not add:

- Lite UI/Today runtime;
- automatic publication or social-network integration;
- customer outreach;
- Opportunity Candidate or qualification persistence (WP-03);
- Formal Opportunity/MarkReg handoff (WP-04);
- generic Artifact, Workplace, Brain, Value Factory, CRM or Opportunity service;
- AI authority to review, confirm, qualify or execute;
- Payment/Invoice, provider appointment, Filing Submission or Official Truth;
- M6 Capability Learning runtime.

## 13. Expected PR title

`PLC-WP-02 — Durable Product-owned Content preparation state`

## Next approved step after merge

`PLC-WP-03 — Durable candidate and qualification path` remains next only after WP-02 is merged and verified.
