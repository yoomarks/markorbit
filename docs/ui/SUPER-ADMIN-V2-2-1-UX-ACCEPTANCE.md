# Super Admin V2.2.1 — independent UX acceptance

- Task ID: `MO-SUPER-ADMIN-V2-2-1-UX-ACCEPTANCE-001`
- Repository and scope: `apps/operations-console`, `tests/e2e`, `docs/ui`
- User: authenticated MarkOrbit Internal Operator reviewing fixture-backed management workflows
- Job to be done: select the exact operator object, inspect matching evidence/state, and stage only an explicitly labelled local Demo action without losing context
- Product owner: MarkOrbit platform operations; domain state remains with each named durable owner
- Canonical sources: MarkOrbit Books 01–07, accepted Capability Canon, `AGENTS.md`, `SUPER-ADMIN-V2-BLUEPRINT.md`, V2.1 integration inventory and V2.2 acceptance report
- Contracts consumed or changed: no shared contract or Gateway route changed; all added result models are deterministic local Demo fixtures
- Expected PR title: `fix(operations-console): resolve V2.2.1 UX acceptance defects`

## Preserved boundary

The existing Super Admin shell, 12 first-level modules, 90 secondary routes, Demo/Real separation and current `/` console remain unchanged. This task adds no product module, owner, database, migration, generic Admin Proxy, cross-service query or production write. Demo query, retrieval, refresh, approval and recovery actions remain local presentation behavior or protected-flow staging.

## Information architecture and state contract

The accepted hierarchy remains module → secondary page → object list/workbench → selected-object detail → permitted Demo/protected action. V2.2.1 makes the selected object the single source for detail copy, source preview, target ID and action label.

- A visible object can become selected through its list, card or workbench representation.
- Search or filter changes recompute the visible set. If the prior selection is hidden, selection moves to the first visible object; if no object remains, detail and object-scoped actions are removed.
- Deterministic Demo query/retrieval returns a count and list from the submitted inputs and active filters. Zero matches render an explicit no-result state and never fall back to a canned record.
- Protected dialog state is closed → open with isolated background → cancel/Escape or Demo confirmation → invoking-control focus restored.
- Alert context is source alert → related in-console page → Browser Back or visible return action → source alert selected again.

Loading, empty, error, permission, partial and success continue to use the existing review-state boundary. No failure becomes an empty or healthy state.

## Defect → fix → browser proof

| ID              | Reproduced defect                                                                               | Implemented fix                                                                                                                              | Browser acceptance                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DATA-SEL-01`   | Selecting WIPO/USPTO tasks left the CN run detail and CN actions visible                        | Data jobs now owns `selectedId`, derives detail/checkpoint/log/action from the visible selected run, and removes incompatible actions        | switches WIPO/USPTO, asserts run/checkpoint; status filter moves selection; 0-result clears detail      |
| `KN-EVD-01`     | Evidence queue selection did not change original text, locator or approval target               | Versioned local evidence fixtures bind queue, exact locator, original excerpt, digest and protected decision ID                              | selects `EVD-11841`, checks CNIPA locator/source and dialog target                                      |
| `KN-PKG-01`     | Ready Package cards did not update the fixed `RPK-4164` detail                                  | Package cards now bind manifest evidence count, target and receipt detail to the selected package                                            | selects `RPK-4207`, verifies ID and 18 evidence items                                                   |
| `DATA-QRY-01`   | Data query input did not affect the fixed one-record result                                     | Submitted jurisdiction/field/value drives a deterministic two-record local fixture model                                                     | known application returns one exact result; unknown value returns count 0 and no-result state           |
| `KN-RET-01`     | Knowledge query and source facets did not affect the fixed 90-result copy                       | Submitted term plus controlled source facets drive deterministic cited hits                                                                  | CNIPA returns one cited hit; unknown term returns count 0 and no-result state                           |
| `SEL-ALL-01`    | Hidden selections remained in details after list filtering                                      | Control, Organization, Intelligence and Trust renderers now derive selection only from the visible set; Data packages/jobs use the same rule | filter-invalidation test covers every renderer family and Data package quality filter                   |
| `FILTER-01`     | Owner/status/quality selects were visual-only                                                   | Batch A owner, B/C/D status and Data package quality selects are controlled and use actual object values                                     | filter result and selected detail remain aligned; empty states remove actions                           |
| `DIALOG-01`     | Protected dialog lacked initial focus, Escape, focus trap, restoration and background isolation | dialog focuses Cancel, traps Tab, handles Escape, applies `inert`/`aria-hidden` to Shell and inspector, then restores the invoking control   | opens from a detail inspector, checks isolation, Shift+Tab wrap, Escape and restored focus              |
| `ALERT-LINK-01` | Overview alert stopped at a generic chain with no actionable in-console route                   | WIPO alert links to Knowledge conversion while retaining alert ID/source path context                                                        | deep-links to `/knowledge/transforms`; Browser Back restores `ALT-7718` and its context banner          |
| `COPY-01`       | “复制 ID” produced only generic Demo feedback                                                   | button is named “复制对象 ID（本地）”, writes the selected fixture ID to the local clipboard and reports that exact effect                   | clipboard contains `DATA-CNIPA`; feedback names the copied ID and local-only effect                     |
| `TYPE-01`       | key provenance/status text used extremely small scales                                          | key workbench labels, metadata, object IDs and helper text now have readable minimum scales while retaining page hierarchy                   | desktop/mobile screenshots reviewed; detail identifiers and warnings remain legible                     |
| `MOBILE-01`     | evidence review controls and dense metadata were fragile on narrow/zoomed layouts               | mobile evidence order remains queue → source → decision, important controls use 44 px targets, feedback stays in flow                        | 390 px selection screenshots plus real Chromium 200% page-scale keyboard interaction and overflow check |

The first focused browser run was intentionally executed before implementation. It failed on the missing Data detail, Knowledge detail, package binding, dialog focus, deep-link and clipboard expectations. The same named tests pass after the fixes.

## Twelve module task tests

Each first-level module has a separately named task test that selects a non-default business object and proves its exact ID in the corresponding detail before checking an available object action:

| Module      | Task object                       |
| ----------- | --------------------------------- |
| 总览        | incident `INC-2051`               |
| Workspace   | Workspace `WSP-SUNRISE`           |
| 用户与权限  | relationship `REL-1008-LABS`      |
| 产品管理    | entitlement `ENT-PRO-SITE`        |
| Data Engine | run `RUN-US-9914`                 |
| Knowledge   | evidence `EVD-11841`              |
| Brain       | run `BRUN-8814`                   |
| Capability  | capability `CAP-EVIDENCE-SUMMARY` |
| 外部 API    | availability policy `AVL-STRIPE`  |
| 运行与任务  | recovery candidate `RCV-9813`     |
| 商业与支付  | Payment record `PAY-4518`         |
| 安全与审计  | risk operation `RSK-1108`         |

These are task interactions, not route/title/Test ID smoke checks.

## Accessibility and responsive evidence

- Protected modal is named, modal, keyboard-contained and dismissible with Escape.
- Shell and an open detail inspector become inert while the protected modal is active.
- Focus returns to the exact invoking control after cancellation.
- Search, query, facet and status controls have accessible labels and controlled values.
- Evidence queue and package cards expose at least 44 px mobile targets where actions are critical.
- At 390 px, the evidence journey is a single-column queue → source → decision flow.
- Chromium page scale is set to 200%; the second evidence item is focused and activated by keyboard, the corresponding detail/action remains available, and page-level horizontal overflow stays absent.

Visual evidence:

- `playwright-screenshots/super-admin-v221-data-selection-desktop.png`
- `playwright-screenshots/super-admin-v221-data-selection-mobile.png`
- `playwright-screenshots/super-admin-v221-knowledge-selection-desktop.png`
- `playwright-screenshots/super-admin-v221-knowledge-selection-mobile.png`

## Events and authority

This Demo implementation emits no domain event. Local React events cover search, filter, selection, deterministic fixture query, clipboard write, navigation context and protected-dialog staging. No event claims owner acceptance, successful approval, task recovery, Ready Package delivery, financial mutation, Capability verification or Official Truth.

## Validation result

Executed on 2026-09-24:

- `pnpm format:check` — PASS
- `pnpm validate:workspace` — PASS
- `pnpm --filter @markorbit/operations-console lint` — PASS
- `pnpm --filter @markorbit/operations-console typecheck` — PASS
- `pnpm --filter @markorbit/operations-console test` — 22 files / 81 tests PASS
- `pnpm --filter @markorbit/operations-console build` — PASS
- `node --test scripts/ci-detect-scope.test.mjs` — 29 tests PASS
- `pnpm exec playwright test --config playwright.config.ts tests/e2e/operations.spec.ts` — 52 PASS / 2 intentional viewport skips
- 90-route desktop matrix — PASS and screenshots regenerated
- 390 px and 200% page-scale acceptance — PASS

The Playwright configuration also starts Lite and MarkReg development servers; they logged unrelated missing prebuilt-contract pre-transform warnings. The Operations Console server and every selected Operations test completed successfully.

## Non-goals

- No V2.3 owner/Gateway read integration in this change.
- No production write, production data mutation, owner reassignment or permission expansion.
- No replacement of `/`, no automatic production cutover and no claim that CI green authorizes one.
- No iframe, generic Admin Proxy, cross-service database read, secret display or second financial ledger.
