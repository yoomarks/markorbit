# HIFI-002 — Trademark Asset Lifecycle Rail

## Task shape

- **Task ID:** `HIFI-002`
- **Repository:** `yoomarks/markorbit`
- **Allowed directories:**
  - `apps/lite-web/src/features/trademark-assets`
  - `docs/ui/MO-TRADEMARK-LIFECYCLE-RAIL-HIFI.md`
  - `tests/e2e/trademark-lifecycle-rail-storybook.spec.ts`
  - `playwright.trademark-lifecycle-rail-storybook.config.ts`
- **Expected PR title:** `feat(lite-web): add trademark lifecycle rail high-fidelity prototype`

## Objective and user-visible outcome

Create a fixture-backed high-fidelity Lite prototype that turns the Trademark Asset detail page
from a source-record inventory into a lifecycle workbench. A Workspace professional should answer,
above the fold:

1. where the trademark is now;
2. what may happen or require attention next;
3. what kind of date is being shown;
4. whether the date is source-recorded, rule-computed, or predicted, and whether its source is
   current; and
5. which governed work surface may safely be opened.

Exact source locators, versions, observed times, and limitations are available in milestone detail
rather than competing with the first-fold decision summary.

The prototype proves the interaction and information architecture only. It does not create a
production route or claim that jurisdiction Rule Packs are admitted for runtime use.

## Canonical sources

- the owner-approved Trademark Lifecycle Rail direction recorded in the 2026-10-09 product review;
- `AGENTS.md` and `.agents/skills/ui-design/SKILL.md`;
- `docs/ui/LITE-UI-BRIEF.md`;
- `docs/ui/UI-DESIGN-STANDARD.md`;
- `docs/ui/PAGE-STATE-MODEL.md`;
- `docs/architecture/EVIDENCE-REVIEW-LIFECYCLE-AUTHORITY-BOUNDARY.md`;
- `packages/contracts/src/evidence-lifecycle.ts`;
- `packages/contracts/src/trademark-asset-workspace.ts`;
- `packages/contracts/src/trademark-asset-composition.ts`;
- `packages/contracts/src/trademark-asset-management.ts`;
- the current `TrademarkAssetPortfolio`, `TrademarkAssetWorkspace`, and `LifecyclePanel` behavior.

## User, owner, and authority

- **Primary user:** a Lite Workspace professional managing a portfolio of customer or enterprise
  trademarks.
- **Product owner:** Lite Trademark Asset owns only the Workspace-private asset anchor,
  relationships, notes, tags, private management state, and presentation composition.
- **Source owners:** MarkReg retains Matter and lifecycle meaning; source systems retain observed
  facts; admitted Rule Packs must retain exact version/effective-window provenance; Work, Matter,
  Capability, and Execution retain their existing authority.
- **Permanent boundary:** a source snapshot is not automatically Official Truth; a computed window
  or prediction is not an official deadline; a Recommended Action is not execution authority.

## Contracts consumed or changed

No production contract is changed. Existing contracts are evidence for boundaries only.

The repository does not yet have an asset-level lifecycle-rail projection that can express stage
groups, jurisdiction milestones, date assertion classes, source currentness, and action eligibility
as separate dimensions. The prototype therefore uses a local `fixtureOnly: true` view model and is
exposed through Storybook only. It must not be imported into a production route.

Future runtime admission requires `LCR-A0` to settle the MarkReg-owned projection, Rule Pack
coverage, currentness, deadline authority, multi-record selection, and Capability handoff contract.

## Information architecture

```text
Trademarks
→ compact asset lifecycle cue
→ asset identity and freshness
→ current stage + next matter
→ macro lifecycle rail
→ current-stage jurisdiction milestones
→ selected milestone details and provenance
→ governed work handoff preview
→ facts, changes, conflicts, commerce, and Guide (outside this prototype's main fold)
```

The detail page prioritizes the lifecycle before generic asset facts. It does not display a health
score because no governed score contract exists.

## Required behavior

- Render the macro stages and jurisdiction milestones from fixture data rather than country-specific
  JSX branches.
- Keep process position, date assertion, source currentness, and action status as separate fields.
- Distinguish recorded date, reviewed timing, computed rule window, MO prediction, typical range,
  unknown time, and conflicting time through both text and visual treatment.
- Make every milestone a keyboard-operable selection control. Selecting a milestone opens its
  detail region and moves focus to the detail heading; closing returns focus to the exact
  milestone control.
- Show exact source locator/version/as-of and fixture Rule Pack or prediction method information.
- Keep current stage and Action Required independent; do not invent a today cursor when the
  fixture has no governed as-of comparison.
- Show a compact portfolio cue using the same fixture projection, including textual current/next
  context.
- Change the desktop horizontal rail into a semantic vertical ordered list at 390px. Do not require
  horizontal page scrolling.
- `查看要求` may open milestone details. `开始准备` may open a fixture handoff preview only.
- Acknowledging a fixture recommendation changes only browser-local advisory state.
- Stale, conflicting, limited-coverage, unavailable, and permission states suppress unsafe CTAs.

## State transitions

Fixture-only interaction states:

```text
Overview → Milestone selected → Detail inspected
Overview → Macro stage selected → Stage milestones inspected
Open recommendation → Acknowledged or dismissed (browser only)
Eligible action → Handoff preview → Returned to asset
```

No transition changes an official status, lifecycle event, Matter, Work item, Order, Payment,
Capability record, or Filing state.

## UI state matrix

The Storybook matrix must include:

- ready/current US maintenance action;
- EU application with recorded and predicted dates;
- Philippines limited/manual coverage;
- ready/no action;
- partial projection;
- stale source;
- conflicting current stage;
- dependency unavailable while preserving last-known data;
- imported unsupported jurisdiction;
- no projection;
- loading;
- forbidden;
- not found;
- recoverable error;
- overdue action;
- mobile 390px;
- compact mixed-state portfolio list.

Loading, empty, unavailable, and forbidden remain distinct. Partial data is not rendered as zero,
no opposition, or no action.

## Events emitted and consumed

No runtime domain events are emitted or consumed. Tests may observe fixture UI intents only:

- `lifecycle.stage_selected`;
- `lifecycle.milestone_opened`;
- `lifecycle.source_opened`;
- `lifecycle.handoff_previewed`;
- `lifecycle.recommendation_acknowledged`;
- `lifecycle.recommendation_dismissed`.

These names are testing vocabulary, not contracts.

## Accessibility

- Use an ordered list for lifecycle order.
- Use `aria-current="step"` for the current stage and include text status; never rely on color.
- Use `<time dateTime>` for exact dates and human text for month-level predictions/ranges.
- Give milestone buttons an accessible name containing position, stage, process state, date type,
  and date where known.
- Keep nodes at least 44px on touch layouts.
- Keep focus visible and logical at 200%/400% zoom.
- Use `aria-pressed` for the selected stage and milestone, and `aria-current="step"` only for the
  actual current process position.
- Use `role="status"` only for concise advisory-state feedback and reserve `role="alert"` for
  overdue/blocking states.
- Respect reduced motion.

## Acceptance tests

- The first fold communicates current stage, next matter, timing class, and source currentness;
  milestone detail exposes exact provenance.
- Recorded facts, computed windows, predictions, and typical ranges remain distinguishable without
  color.
- Macro and detailed rails share one projection; the compact list does not recompute lifecycle.
- A milestone can be opened by keyboard and its details retain exact fixture provenance.
- A fixture handoff preview explicitly creates no work, filing, payment, message, or official truth.
- Stale/conflicting/limited/unavailable states do not expose an enabled action handoff.
- EU partial opposition data never renders `0 oppositions`.
- Philippines limited coverage does not invent future nodes or a deadline.
- Default and adverse states pass `jest-axe`.
- Playwright proves the desktop and 390px journeys, visible focus, and no horizontal overflow.

## Validation commands

```powershell
pnpm.cmd --filter @markorbit/lite-web test
pnpm.cmd --filter @markorbit/lite-web lint
pnpm.cmd --filter @markorbit/lite-web typecheck
pnpm.cmd --filter @markorbit/lite-web build
pnpm.cmd --filter @markorbit/contracts build
pnpm.cmd --filter @markorbit/ui build
pnpm.cmd --filter @markorbit/lite-web exec storybook build -c ../../packages/ui/.storybook -o ../../.artifacts/storybook/lifecycle-rail
pnpm.cmd exec playwright test --config playwright.trademark-lifecycle-rail-storybook.config.ts
pnpm.cmd validate:workspace
node --test scripts/ci-detect-scope.test.mjs
pnpm.cmd test:story-matrix
pnpm.cmd task:prepush
```

## Non-goals

- no production route or API client;
- no `packages/contracts` or `packages/ui` changes;
- no front-end jurisdiction rules;
- no live LLM generation of milestones, dates, confidence, or CTAs;
- no official-status or certified-deadline claim;
- no health/readiness percentage;
- no automatic conflict resolution;
- no automatic Matter, Work, Order, Message, Payment, provider, filing, or external action;
- no five-jurisdiction runtime-completeness claim.
