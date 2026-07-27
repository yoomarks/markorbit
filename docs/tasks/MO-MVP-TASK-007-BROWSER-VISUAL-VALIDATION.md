# MO-MVP-TASK-007 — Browser and Visual Validation

## Browser scope

This foundation validates MarkOrbit Lite, markreg.com, and Operations Console in Playwright Chromium only. It is an engineering evidence layer and does not change product workflows, contracts, formal state, or business semantics.

The acceptance paths cover Lite Today and its seven-item navigation; markreg consultation start, Applicant, Review, Recommendation Comparison, recoverable error, and blocking error; and the Operations Console internal-only overview, service health, failures, pending manual review, and event summary. Browser guards collect uncaught exceptions, `console.error` messages, and 404 responses. They also check horizontal overflow, semantic navigation, visible focus, step state, usable fields, long content, fixture warnings, and primary actions.

## Viewports and responsive behavior

- Desktop: **1440 × 900**.
- Mobile: **390 × 844**, with touch and mobile behavior enabled.

Both projects run against all three applications. Desktop confirms persistent comparison and workspace layouts. Mobile confirms reflow, untruncated actions, operable controls, scroll-safe progress/navigation, and no document-level horizontal overflow.

## Fixture strategy

The Vite development servers run locally and require no production API, secret, database, or external service. Lite and Operations Console already render fixture-backed content. markreg tests seed its existing session storage keys before application startup for Review and Recommendation states and intercept the existing intake request for recoverable and blocking failures. This uses browser-test code only: no production-only test route or product dependency injection is exposed.

Fixture Recommendation data remains explicitly `FIXTURE_ONLY`, displays A/B/C, and carries the non-legal-advice and non-official-result warnings. A Provider Return is not Official Truth, and a test outcome does not verify a Capability or mutate canon.

## Screenshot evidence strategy

This phase provides browser validation and CI screenshot evidence; it does not provide committed pixel-diff baselines. Stable, full-page runtime evidence names include product, page, and viewport:

- `lite-today-desktop` and `lite-today-mobile`;
- `markreg-consultation-desktop`;
- `markreg-recommendation-desktop` and `markreg-recommendation-mobile`;
- `operations-console-desktop`.

Focused visual evidence tests write review screenshots to `playwright-screenshots/`. GitHub Actions uploads that directory as the `playwright-screenshots` artifact, while failure-only screenshots, traces, and videos remain in `test-results`. All runtime evidence directories are ignored by Git and CI never commits their contents.

Committed pixel-diff visual regression baselines are deferred. They will be introduced later from an authenticated Git environment after the product UI becomes more stable, with an explicit review and update policy. Until then, `pnpm test:visual` regenerates review evidence without comparing it to committed images.

## CI artifacts

The read-only **Browser and Visual Validation** workflow builds the three products, installs only Chromium, and runs Playwright. With `if: always()`, it retains these artifacts for 14 days even when validation fails:

- `playwright-report` — navigable HTML report;
- `playwright-screenshots` — stable-named PR screenshot evidence generated at runtime;
- `test-results` — traces, image diffs, videos, and failure evidence.

Concurrency cancels superseded runs on the same ref. The job has a 30-minute timeout and no write permission.

## Known limitations

- Firefox, WebKit, real devices, dark mode, localization, zoom, and screen-reader manual validation are not included.
- Screenshots use Linux Chromium fonts and are review evidence rather than active pixel-diff regression comparisons.
- The apps are served in deterministic Vite fixture mode rather than through production infrastructure.
- Automated focus and semantic checks supplement rather than replace manual accessibility review.
- Operations Console currently presents its pending-review metric under the product label “Manual review” with “Awaiting reviewer”; tests preserve that existing product language.

## Non-goals

This task does not change contracts, Gateway behavior, services, Quote or Plan behavior, product business content, production data access, or formal state. It does not add browsers beyond Chromium, committed visual baselines, external visual SaaS, automatic screenshot commits, or automatic PR mutation.
