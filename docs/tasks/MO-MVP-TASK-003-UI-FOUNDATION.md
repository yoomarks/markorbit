# MO-MVP-TASK-003 — UI Foundation and Product UI Briefs

## Outcome

Establish shared semantic design tokens, accessible backend-free primitives, fixture-backed Storybook evidence, differentiated static shells for Lite, markreg.com and Operations Console, and implementation-ready product briefs. Allowed work is `docs/ui/**`, this task/planning index, `packages/ui/**` and the three web-app workspaces. Task 002 contracts and runtime are unchanged; no contracts are consumed or changed and no events are emitted or consumed.

## Canonical sources

`AGENTS.md`, `README.md`, MVP Product Lock, UI Design Standard, System Boundaries, Service Ownership, Task 002 and the accepted Capability Canon locks. Runtime search result: **ui-design skill unavailable**. Figma: connected, Starter / View; no file editing attempted.

## Required behavior and transitions

Components are strict TypeScript, accessible, extensible, product-neutral and backend-free. Apps render fixture-only Ready-state demonstrations, while Storybook/state primitives cover non-ideal states. Page transitions remain design contracts only: Lite review work, markreg guided recommendation choice and Operations investigation/escalation never perform protected actions or formal-state mutation.

## Acceptance and validation

Unit tests cover disabled actions, labels/errors, fixture markers, semantic status, shell navigation and serious axe violations. Storybook covers component states and each shell at desktop/mobile widths. The Storybook acceptance path is keyboard traversal plus visible fixture marking; later runnable journeys require Playwright as specified in each brief.

Validation: Node 22.x, pnpm 10.28.1; frozen install, format, format check, lint, typecheck, test, build, check and UI Storybook build.

## Non-goals

Authentication/accounts, Task 002 API integration, database, payment implementation, upload, search, real AI, MGSN, fulfillment, complete responsiveness, dark mode, translations, logo redesign and Figma editing.

## Follow-up

Execute product tasks 050–056 and 070–077 from the accepted briefs; define Operations read/permission/audit contracts before its page implementation. Expected PR title: `MO MVP — UI foundation and product briefs`.
