# Super Admin V2.2.3 — Information Hierarchy & Density Acceptance

## Scope and safety boundary

V2.2.3 changes only the information hierarchy and layout of the existing Super Admin V2. The 12 primary modules, 90 secondary routes, Demo/Real boundary, owner semantics and the existing `/` console are unchanged. No production API or write path was added.

## Implemented hierarchy

- Every route exposes one page-owned `h1`. The module name remains navigation context instead of competing with the page title.
- The shared `sa2-page-intro` block was removed. Specialized page renderers now own the title, one-sentence operational context and primary action.
- Section headings use `h2` and `h3` only for distinct work regions such as object lists, selected-object details, checkpoints and review decisions.
- Non-overview routes use a compact module context bar. Module overview routes retain the fuller module identity.
- Demo remains permanently marked in the global banner and sidebar. Fixture-state review controls are collapsed by default and explicitly state that they do not represent owner runtime state.
- Object list/detail workspaces now precede supporting visualization canvases. KPI strips remain only on Data and Knowledge overview, coverage, storage and supply-health pages where they support the page's decision task.

## Representative before/after measurements

The value is the viewport-relative top of the first actionable workspace in CSS pixels.

| Page                 | 1440×900 before | 1440×900 after | 390×844 before | 390×844 after |
| -------------------- | --------------: | -------------: | -------------: | ------------: |
| Overview / usage     |             858 |            461 |           1151 |           653 |
| Data Engine / jobs   |             633 |            350 |            628 |           437 |
| Knowledge / evidence |             633 |            350 |            564 |           373 |

At 1366×768 the corresponding workspace positions are 461, 350 and 350 pixels. The primary work object is therefore visible without scrolling on the tested desktop and laptop sizes, while the mobile page reaches it before repeated chrome consumes the first viewport.

## Visual evidence

### Overview / usage

- Before: `playwright-screenshots/super-admin-v223-before-overview-usage-desktop.png`
- After desktop: `playwright-screenshots/super-admin-v223-after-overview-usage-desktop.png`
- After laptop: `playwright-screenshots/super-admin-v223-after-overview-usage-laptop.png`
- Before mobile: `playwright-screenshots/super-admin-v223-before-overview-usage-mobile.png`
- After mobile: `playwright-screenshots/super-admin-v223-after-overview-usage-mobile.png`

### Data Engine / jobs

- Before: `playwright-screenshots/super-admin-v223-before-data-jobs-desktop.png`
- After desktop: `playwright-screenshots/super-admin-v223-after-data-jobs-desktop.png`
- After laptop: `playwright-screenshots/super-admin-v223-after-data-jobs-laptop.png`
- Before mobile: `playwright-screenshots/super-admin-v223-before-data-jobs-mobile.png`
- After mobile: `playwright-screenshots/super-admin-v223-after-data-jobs-mobile.png`

### Knowledge / evidence

- Before: `playwright-screenshots/super-admin-v223-before-knowledge-evidence-desktop.png`
- After desktop: `playwright-screenshots/super-admin-v223-after-knowledge-evidence-desktop.png`
- After laptop: `playwright-screenshots/super-admin-v223-after-knowledge-evidence-laptop.png`
- Before mobile: `playwright-screenshots/super-admin-v223-before-knowledge-evidence-mobile.png`
- After mobile: `playwright-screenshots/super-admin-v223-after-knowledge-evidence-mobile.png`

The existing route-matrix capture also regenerated every route screenshot as `playwright-screenshots/super-admin-v2-<module>-<page>-desktop.png`.

## Automated acceptance

- The 90-route matrix asserts exactly one visible `h1`, starts the content outline at level 1, prevents heading-level jumps and rejects adjacent identical headings.
- Representative Playwright tests assert workspace fold position at 1440×900, 1366×768 and 390×844, plus horizontal-overflow safety.
- Existing object selection, filtering, deep-link, protected-dialog, keyboard, 390px and 200% page-scale tests remain enabled.
- Fixture-backed Storybook entries cover Overview usage, Data jobs and Knowledge evidence under the V2.2.3 hierarchy.

Validation completed:

- Operations Console ESLint: pass
- Operations Console TypeScript: pass
- Operations Console unit tests: 22 files / 81 tests pass
- Operations Console production build: pass
- Operations Playwright: 73 pass / 5 intentional viewport skips

The Playwright web-server startup still emits pre-existing contract-resolution warnings from Lite and MarkReg development surfaces; the Operations Console suite completed without page, console or route failures.
