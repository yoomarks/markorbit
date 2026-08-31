# MarkOrbit Lite

Professional content, opportunity, asset, capability and work product.

## #353 navigation and product-truth brief

User / job: a Lite practitioner must navigate between product pillars and distinguish durable
Workspace data from demonstration data and unpromoted entry surfaces.

The accepted scope is Issue #353 and its Supervisor decision. Reuse the existing shell, typography,
responsive CSS and `@markorbit/ui` primitives; no visual redesign, backend work or shared changes.

- Information architecture: Today / Matters / Content / Opportunities / Trademarks / Work /
  Capability / Guide. Work opens Customers and retains Professional Review / Execution Release
  subnavigation. Hash changes and browser history select the same surface; query deep links remain intact.
- Data boundaries: Customers and Opportunities are fixtures regardless of the selected Workspace.
  Today, Matters, Trademarks, Capability and Professional Review use authenticated Workspace APIs.
  Execution Release uses its existing Execution API; the shell does not claim Workspace authentication
  for that client. Content and Guide are explicit unpromoted entries, not new backend capabilities.
- Desktop / mobile: keep the existing sidebar and responsive navigation at 1440px and 390px;
  Work controls stack on narrow screens. All primary destinations remain reachable without overflow.
- States: fixture loading / empty / error / stale / ready retain the fixture banner; existing live
  loading / empty / error / permission / partial-data / success handling remains with each surface.
  Missing Workspace retains the selection error and is labelled Workspace required. Content / Guide
  are static unavailable entries with an Open Today link, no artificial loading or success state,
  and no API requests or state mutations.
- Accessibility: labelled primary and Work navigation, one active primary item, `aria-current` on
  the active Work control, semantic entry headings, keyboard activation and visible focus using
  existing primitives. No new modal, focus trap or color-only state.
- Storybook: existing Customer / Opportunity fixture state stories plus ContentEntry, GuideEntry,
  WorkspaceRequired and ContentMobile390 / GuideMobile390 cover the changed shell states.
- Acceptance: App tests cover all primary clicks, hash / history navigation, Workspace context,
  deep-link query preservation and truthful badges. The local Playwright navigation suite checks
  desktop / mobile routing, back / forward / reload, keyboard focus and overflow, and writes screenshots.
  Browser API fixtures are test evidence only, not proof of a live backend or authorization.
- Contracts / events / state transitions: no contract or domain event changes. Only the selected
  client-side surface and URL hash change; existing API clients and protected-action boundaries remain.

Validation from the repository root:

```sh
pnpm --filter @markorbit/lite-web exec vitest run src/App.test.tsx src/routing/lite-route.test.ts
pnpm exec turbo run lint typecheck test build --filter=@markorbit/lite-web
pnpm exec playwright test --config apps/lite-web/playwright.navigation.config.ts
pnpm exec playwright test --config playwright.config.ts tests/e2e/lite.spec.ts
pnpm validate:workspace
pnpm validate:persistence-boundaries
node --test scripts/ci-detect-scope.test.mjs
pnpm format:check
git diff --check
```

The missing `ui-design` skill is a separate repository-governance follow-up, waived for #353 by the
Supervisor decision. This task does not change AGENTS.md or install a substitute skill.

Local evidence: the shell regression reproduced 11 failures before the fix; all 17 shell tests,
53 total Lite tests and 6 new plus 6 existing desktop/mobile Playwright cases passed after it.
The Storybook build and story matrix passed. Screenshots under `test-results/navigation/` cover Content, Guide, Customers
and Professional Review at both viewports; visual review found no clipping or page overflow.
With this Windows checkout's existing `core.autocrlf=true`, the canonical `pnpm format:check`
reports CRLF differences in untouched files; `pnpm exec prettier --check . --end-of-line auto`
passes. No shared files or Git settings were changed. Hosted affected CI remains required before merge.
