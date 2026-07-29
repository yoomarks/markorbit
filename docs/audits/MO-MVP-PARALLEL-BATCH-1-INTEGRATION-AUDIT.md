# MO MVP Parallel Batch 1 Integration Audit

## 1. Audited main commit SHA

The audit basis is `261b4e62fb27584d3f339a179d3c431c21f44867`, the supplied checkout head containing the merged TASK 005, TASK 006, and TASK 007 work. The checkout had no configured Git remote and no local `main` reference, so `git fetch origin --prune`, `git checkout main`, and `git pull --ff-only origin main` could not independently verify GitHub's current remote head. No feature branch was merged into the audit branch.

## 2. TASK 005/006/007 implementation inventory

- **TASK 005:** shared Plan/Quote/Money contracts and invariant parsers in `packages/contracts`; fixture pricing, Plan Selection, Quote, and Quote Confirmation ownership in `services/markreg`; public proxy routes in `apps/gateway`; the MarkReg client, API seam, session-backed presentation, component tests, and dynamic-port integration tests in `apps/markreg-web` and `apps/gateway/tests`.
- **TASK 006:** Lite Today default surface, fixed seven-item primary navigation, Work / Customers and Opportunities list/detail flows, app-owned responsive CSS, async repository interfaces with fixture adapters, Storybook fixture states, unit tests, and browser acceptance in `apps/lite-web` and `tests/e2e/lite.spec.ts`.
- **TASK 007:** the root Playwright configuration, desktop/mobile Chromium projects, three local Vite servers, runtime evidence helpers, page health/overflow/focus assertions, and `.github/workflows/browser-visual-validation.yml`.

## 3. Validation environment

- Ubuntu container, 390 × 844 mobile Chromium project and 1440 × 900 desktop Chromium project.
- Node.js `v20.20.2`; the required Node 22.x runtime was not installed in the supplied environment. Every pnpm command therefore emitted the repository's engine warning.
- pnpm `10.28.1` (the locked package manager version).
- Playwright `1.54.2`, Chromium build `1181`. The primary CDN returned HTTP 403, but Playwright's Microsoft mirror supplied Chromium, headless shell, and FFmpeg successfully.
- No remote was configured, so remote-main freshness and GitHub Actions status could not be established locally.

## 4. Contract and boundary audit

**Observation.** Workspace validation passed without weakening a rule. Static inspection found no cross-service database reads, consumer-owned copies of Plan/Quote contracts, app-to-app runtime implementation imports, tracked generated browser/build artifacts, or obsolete feature-owned Playwright configuration. Services continue to own in-memory state and communicate through HTTP/contracts. Lite fixture data remains in repository modules that expose asynchronous `list`/`get` interfaces; no production API or `localStorage` use was introduced. MarkReg's session storage remains the documented draft/recommendation recovery mechanism.

**Minor — corrected.** Application package names, ports, and URLs were duplicated between `playwright.config.ts` and the browser helper. They are now declared once in `tests/e2e/applications.ts` and consumed by both server startup and browser navigation.

## 5. Plan/Quote findings

**Observation.** Plan Selection and Quote retain distinct identifiers. `Money.amountMinor` validation requires non-negative safe integers, currency is explicit and consistent across every aggregate and line, and fixture pricing uses integer addition/multiplication only. Contract invariants reconcile category aggregates, subtotal, taxes, and total. Quote identity includes intake, recommendation, option, and pricing-rule version, making fixture totals deterministic. Confirmation explicitly records `orderCreated: false`, `paymentMade: false`, and `filingStarted: false`; it does not create an Order, Filing, or professional appointment. The UI and documentation identify the quote as fixture-only/non-production and preserve safe unavailable/error states. Existing contract, service, Gateway, and client integration coverage passed; no Plan/Quote test change was necessary.

## 6. Lite findings

**Major — corrected.** Returning from Customer or Opportunity detail preserved filters but did not restore keyboard focus to the originating record action, despite the locked acceptance behavior. `apps/lite-web/src/App.tsx` now records the opened record identity and restores focus after the list remounts. `tests/e2e/lite.spec.ts` now proves focus restoration for both routes with ordinary pointer clicks.

**Observation.** The navigation remains exactly Today, Content, Opportunities, Trademarks, Work, Capability, Guide; Today is the default, Customers remains subordinate to Work, and Opportunities remains top-level. Customer/Opportunity qualification warnings and suggested-action non-execution text remain explicit. Ready, loading, empty, stale, and recoverable-error fixtures remain available. Filters survive detail navigation. No prohibited force click, mouse click, centered-pointer helper, timeout sleep, or `test.fixme` occurrence was found in `tests` or `apps`.

## 7. Browser/visual findings

**Observation.** One root Playwright configuration owns Chromium projects, local application startup, runtime output paths, retries, and reporters. Runtime screenshots are written only to ignored `playwright-screenshots/`; failures use ignored `test-results/` and reports use ignored `playwright-report/`. No PNG baseline or browser artifact is tracked. The complete 14-test browser run passed without a retry, so the configured CI retry allowance did not conceal a deterministic failure. The focused visual run passed all 8 project cases. Page health, overflow, and visible-focus assertions remain active.

## 8. Cross-app CSS and UI findings

**Observation.** Shared UI selectors provide primitives while Lite's workflow styling remains app-owned. Lite grid/flex descendants apply `min-width: 0`, long fixture text wraps, and the 760 px/640 px rules collapse content to natural single-column flow. Browser checks passed at desktop and 390 px mobile without overlap, horizontal overflow, hidden actions, force clicks, or pointer workarounds. MarkReg and Operations Console browser paths also passed in both viewports. No CSS correction or visual redesign was required.

## 9. Documentation findings

**Observation.** TASK 005 accurately documents Plan/Quote identity, integer minor-unit money, production-disabled pricing, confirmation boundaries, and non-goals. TASK 006 accurately documents the Today default route, navigation ownership, repository/API seam, fixture states, safety boundaries, and acceptance path. TASK 007 accurately documents runtime-only screenshots, ignored reports/traces/video, local ports, browser health assertions, and the absence of committed baselines. No stale statement requiring correction was found.

## 10. Defects found

| Severity    | Count | Finding                                                                                                                                             |
| ----------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blocker     |     0 | None.                                                                                                                                               |
| Major       |     1 | Lite did not restore focus to the originating Customer/Opportunity action after detail navigation.                                                  |
| Minor       |     1 | Browser application URLs, ports, and package names were duplicated.                                                                                 |
| Observation |     6 | Contract boundaries; Plan/Quote invariants; Lite semantics/states; browser artifact policy; cross-app responsive behavior; documentation alignment. |

Environment limitations (unconfigured remote and Node 20 rather than Node 22) are recorded as remaining risks rather than product defects.

## 11. Corrections applied

- `apps/lite-web/src/App.tsx`: restore focus to the record action that opened Customer or Opportunity detail.
- `tests/e2e/lite.spec.ts`: assert both focus-return paths in the existing acceptance journey.
- `tests/e2e/applications.ts`: provide the single browser application package/port/URL registry.
- `playwright.config.ts`: derive Vite startup commands and health URLs from that registry.
- `tests/e2e/helpers/page.ts`: derive navigation URLs from that registry.
- `docs/audits/MO-MVP-PARALLEL-BATCH-1-INTEGRATION-AUDIT.md`: retain the audit method, findings, corrections, risks, and evidence.

No other file was intentionally changed.

## 12. Tests added or changed

The existing Lite browser acceptance test gained two focus assertions. No product feature, contract, fixture, visual baseline, global timeout, or retry behavior changed. The unit run executed 73 Vitest assertions across 17 test-owning workspace packages (21 successful Turbo tasks including dependencies). Browser validation executed 14 Playwright cases; the focused visual command executed 8 cases; and the mobile acceptance was repeated 3 times with one worker and zero retries.

## 13. Remaining risks

- **Environment:** validation ran on Node `v20.20.2`, not the repository-required Node 22.x. GitHub's workflow requests Node 22, but its result is unknown.
- **Repository provenance:** the container has no `origin` remote or `main` ref, so the audited SHA can only be identified as the supplied integrated checkout head, not independently proven as the latest GitHub main.
- **CI:** no remote checks can be queried or claimed green from this checkout.
- **Fixture seam:** Lite's repository interfaces are asynchronous and tested, while the current fixture-only render path reads exported fixture arrays from those repository modules. A future generated client should replace that adapter without moving service contracts into Lite.
- **Visual evidence:** screenshots are runtime review evidence, not pixel-diff baselines; regressions still require assertion/review discipline.

## 14. Explicit non-goals

No product feature, navigation destination, production database/API, payment execution, Order, Filing, professional appointment, MGSN implementation, authentication change, framework/dependency upgrade, unrelated refactor, committed screenshot baseline, or canon mutation was added. Quote confirmation remains an intent record only. This audit did not merge or modify GitHub remote branches.

## 15. Final acceptance evidence

- `pnpm install --frozen-lockfile`: passed with the Node engine warning and ignored optional dependency build-script notice.
- `pnpm validate:workspace`: passed.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`: passed in final validation; 73 unit assertions passed.
- `CI=1 pnpm test:e2e`: 14 passed, no observed retries.
- `CI=1 pnpm test:visual`: 8 passed.
- Mobile Lite acceptance, `--workers=1 --retries=0 --repeat-each=3`: 3 passed.
- `pnpm --filter @markorbit/ui build-storybook`: passed; Storybook emitted only upstream eval/chunk-size advisories.
- `pnpm --filter @markorbit/lite-web build`: passed.
- The prohibited-workaround search returned no matches.
- `git ls-files` found no tracked PNG, trace, video, Playwright report, screenshot, or test-result artifacts.
- `git diff --check`: passed before commit.
