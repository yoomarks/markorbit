# PLC-WP-05 — Lite Today to Prepared Action Real-Runtime Journey

## 1. Task ID

`MO-MVP-PLC-WP-05`

## 2. Repository and allowed directories

Repository: `yoomarks/markorbit`.

Allowed implementation areas:

- `packages/contracts/**` only for the minimum already-proven Product-loop transport/auth integration correction;
- `services/lite/**`;
- `services/markreg/**` only for the already-approved Formal Opportunity HTTP/runtime composition boundary;
- `apps/gateway/**`;
- `apps/lite-web/**`;
- `infrastructure/persistence/migrations/**` and `migration-owners.json` for Lite-owned Prepared Action/confirmation/handoff-result state only;
- narrowly bounded real-runtime browser/integration/CI files required to prove this package;
- this task document.

## 3. Objective and user-visible outcome

Implement the canonical Lite mainline over real durable state already delivered by PLC-WP-02 through PLC-WP-04:

```text
Today
-> Recommendation detail / explanation
-> Prepared Action
-> explicit User Confirmation
-> owner handoff
-> result visible after reload
```

The user should be able to open Lite Today inside one authenticated Workspace, understand why a real recommendation exists, inspect exactly what has been prepared and what confirmation will do, explicitly confirm it, and see the resulting owner handoff without learning internal service architecture.

Content and Opportunity views remain supporting detail surfaces. Today remains the organizing Product surface.

## 4. Canonical sources

- Books 01–07 / Active Architecture Canon;
- `AGENTS.md`;
- `docs/planning/MO-MVP-PRODUCT-LOOP-CLOSURE-PLAN.md`;
- `docs/architecture/PRODUCT-LOOP-AUTHORITY-BOUNDARY.md`;
- `docs/tasks/MO-MVP-PLC-WP-01-PRODUCT-MAINLINE-CONTRACTS-OWNERSHIP.md`;
- merged PLC-WP-02, PLC-WP-03 and PLC-WP-04 runtime state;
- `packages/contracts/src/product-loop.ts`.

Controlling principles:

```text
Product Loop First
-> Shared Platform Extraction Second
```

```text
Observe
-> Explain
-> Recommend
-> Prepare
-> Confirm
-> Execute / Handoff
-> Learn
```

## 5. Verified integration findings

### Prepared Action runtime gap

PLC-WP-01 froze `PreparedAction` and `PreparedActionConfirmation` and assigned them to Lite. PLC-WP-02 through PLC-WP-04 intentionally did not persist or expose that state. Therefore WP-05 must add the smallest Lite-owned durable Prepared Action/confirmation/handoff-result boundary required for the real Today journey; a fixture-only or component-memory confirmation would not satisfy the approved Product loop.

### Core Principal identity integration

The Product-loop contracts currently type Human Review/Qualification/Prepared Action actor fields as generic `MarkOrbitId`, while the authoritative Core `WorkspacePrincipal.userId` is a UUID string. Real authenticated runtime must record the actual Core principal identifier rather than fabricate a second identity namespace. WP-05 may make the narrow type/validation correction required for these actor fields while leaving Customer and Product object identifiers unchanged.

### Existing owner runtime exposure

WP-04 created durable MarkReg Formal Opportunity and Intake-handoff owner state but explicitly deferred Gateway/browser routes. WP-05 may expose that already-approved owner behavior through internal HTTP and Gateway composition; it must not broaden the business consequences of WP-04.

## 6. Contracts consumed or changed

WP-05 consumes the frozen Product-loop contracts:

- `TodayRecommendation`;
- `PreparedAction`;
- `PreparedActionConfirmation`;
- `ContentOpportunity`;
- `OpportunityCandidate`;
- `OpportunityQualificationDecision`;
- `FormalTrademarkServiceOpportunity`;
- `MarkRegIntakeHandoff`.

A bounded Prepared Action journey/read model may be added only if the browser transport cannot be represented without copying API types into the consumer.

Actor references used for explicit human decisions/confirmations must preserve actual Core principal identity.

## 7. Required behavior

### 7.1 Lite Today

Today must use authenticated real Workspace state and must not show a fixture banner for the acceptance journey.

It must support:

- list of real current Today Recommendations;
- clear kind/status/title and explanation;
- exact source/provenance summary;
- deep-link/direct URL to a Recommendation;
- direct URL/reload preserving Workspace and selected Recommendation/Prepared Action;
- loading, empty, stale/partial, permission, dependency error and success states.

### 7.2 Prepared Action

A user may prepare a bounded action from one exact Recommendation ID/version/fingerprint.

The durable Prepared Action must state:

- what is prepared;
- which exact Recommendation/source version it comes from;
- why it is proposed;
- what confirmation will do;
- the target owning Product/Workflow;
- that confirmation is not protected-action authority.

Prepared Action is immutable Product intent. Confirmation and owner handoff evidence are separate durable records.

### 7.3 Explicit confirmation and retry-safe handoff

The user-facing mutation is consequence-aware confirmation followed by an immediate owner-handoff attempt.

Rules:

- confirmation records the authenticated Core principal identity, never a client-supplied actor ID;
- CSRF/trusted-origin and Workspace permission checks apply;
- exact Prepared Action version/fingerprint and acknowledgement must match;
- confirmation is idempotent and survives reload/restart;
- downstream handoff failure does not erase or duplicate the confirmation;
- retry after a dependency failure must reuse the same durable confirmation and perform at most one successful owner handoff;
- handoff result is reloadable Product/work evidence, not WP-06 outcome feedback and not Capability learning.

### 7.4 Owner targets

WP-05 supports the already-frozen targets without inventing new owner semantics:

1. `LITE_CONTENT_PREPARATION`
   - confirmation may create the existing `ContentOpportunity` preparation line through the WP-02 owner method;
   - it does not publish externally.

2. `MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY`
   - confirmation may invoke the WP-04 MarkReg owner mutation using an exact qualified Candidate + exact Qualification Decision;
   - Qualification remains a prerequisite and customer contact remains false.

3. `MARKREG_INTAKE`
   - confirmation may invoke the WP-04 explicit Intake-handoff preparation over an exact Formal Opportunity;
   - actual Intake remains uncreated.

No target in this package creates Order, Matter, Payment, provider appointment, Filing Submission or Official Truth.

## 8. State transitions

```text
Today Recommendation OPEN
-> Prepared Action immutable PREPARED intent
-> explicit PreparedActionConfirmation
-> HANDOFF_PENDING
-> HANDOFF_COMPLETED
```

Dependency failure may produce/reconstruct:

```text
confirmed action
-> HANDOFF_PENDING / dependency unavailable
-> retry same confirmation/idempotency
-> HANDOFF_COMPLETED
```

No confirmation rollback is fabricated after it has been durably recorded.

## 9. UI states and information architecture

Primary navigation remains Today-driven. Supporting domain views do not become equal primary workflow modules merely because durable state now exists.

Today UI must include:

- desktop layout;
- mobile layout;
- loading;
- empty;
- stale/partial data warning;
- permission denied;
- dependency/service unavailable;
- Recommendation detail;
- Prepared Action review;
- confirmation in progress;
- confirmed/handoff pending;
- handoff success;
- direct URL/reload.

Accessibility requirements:

- keyboard-accessible list/detail/confirmation controls;
- focus restoration or stable direct navigation after detail changes;
- semantic headings and status regions;
- disabled mutation controls while submitting;
- confirmation effect visible before the confirm button.

The repository requires the `ui-design` skill for UI work. The current agent runtime does not expose that skill; implementation therefore follows the explicit UI requirements frozen in `AGENTS.md`, existing `@markorbit/ui` primitives and existing Lite interaction patterns without inventing a parallel design system.

## 10. Events emitted and consumed

No new cross-service event bus is required.

WP-05 uses synchronous governed owner handoff plus durable command/result evidence. If later extraction requires events, that is not justified by this package alone.

## 11. Acceptance tests

The package is accepted when exact-head tests prove:

1. authenticated Workspace Today reads real Lite PostgreSQL state with no fixture interception;
2. another Workspace cannot read the Recommendation/Prepared Action journey;
3. direct URL and reload reproduce the same real Recommendation/Prepared Action state;
4. a Prepared Action is tied to exact Recommendation version/fingerprint and rejects stale source;
5. explicit confirmation records the authenticated Core principal identity;
6. idempotent confirmation replay survives process/store recreation;
7. dependency failure after confirmation leaves a retryable confirmed action and does not duplicate confirmation;
8. content handoff creates at most one WP-02 Content Opportunity and never publishes;
9. qualified-candidate handoff creates at most one WP-04 Formal Opportunity and never contacts the customer;
10. Intake handoff advances the WP-04 Formal Opportunity to `HANDED_OFF_TO_INTAKE` while `intakeCreated=false`;
11. stale version/fingerprint and permission denial fail closed;
12. desktop and mobile real-runtime browser paths execute without route interception/fixture fallback;
13. loading/empty/partial-or-stale/permission/error/success UI states have deterministic coverage;
14. M2–M5 and PLC-WP-02/03/04 regressions remain green.

## 12. Validation commands

Applicable repository gates:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Dedicated WP-05 PostgreSQL/HTTP/browser tests must run on hosted GitHub Actions. Existing M2–M5 and PLC regression workflows remain required exact-head gates.

If hosted CI fails, inspect the current failing log, repair only the first real root cause, and rerun on the new exact head.

## 13. Non-goals

WP-05 does not implement:

- WP-06 durable Product-loop use/outcome feedback;
- M6 Capability Ledger/Reflection/Profile/Twin runtime;
- automatic external publication;
- customer outreach;
- CRM replacement;
- universal Artifact/Opportunity/Workplace service;
- Brain/Value Factory/Intelligence subsystem;
- automatic qualification;
- automatic Formal Opportunity creation without explicit confirmation;
- actual MarkReg Intake creation from the `LITE_PROFESSIONAL` handoff;
- Quote acceptance;
- Order or Matter creation;
- Payment/Invoice;
- provider appointment;
- Filing Submission;
- Official Truth;
- Capability verification or Canon mutation;
- production GA claim;
- self-merge.

## 14. Expected PR title

`PLC-WP-05 — Lite Today to Prepared Action real-runtime journey`

## 15. Owner merge consequence

Merge accepts only the real authenticated Lite Today -> Recommendation -> Prepared Action -> explicit confirmation -> existing owner-handoff journey and its bounded durable Product evidence.

Merge does not authorize WP-06 feedback semantics, M6 runtime, automatic outreach/publication, Intake/Order/Matter creation, Payment, appointment, filing or Official Truth.

After merge, `PLC-WP-06 — Feedback and Product-loop observability` is the next planned package.

## 16. Hosted CI remediation log

The first Draft PR exact-head run passed workspace and persistence-boundary validation but exposed one mechanical integration omission from the Core Principal identity correction: the Content Review and Candidate Qualification command types had already been widened to the authoritative Core principal string, while two call sites still invoked the legacy `cleanMarkOrbitId` validator. Those exact call sites were changed to the existing `cleanPrincipalId` validator. No business authority, Product-loop transition or automatic consequence was broadened to make CI pass.
