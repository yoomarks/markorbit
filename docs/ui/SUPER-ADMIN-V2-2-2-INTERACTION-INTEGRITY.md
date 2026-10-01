# Super Admin V2.2.2 — Interaction Integrity acceptance

- Task ID: `MO-SUPER-ADMIN-V2-2-2-INTERACTION-INTEGRITY-001`
- Repository scope: `apps/operations-console`, `tests/e2e`, `docs/ui`
- User and job: an internal operator must select an exact fixture object, inspect matching owner evidence, and stage a clearly labelled Demo-only action without cross-object state leakage
- Product owner: platform operations; each durable domain owner remains authoritative for runtime and formal state
- Contracts and events: no shared contract, Gateway route or domain event changed; interactions remain deterministic local fixtures
- Non-goals: production writes, V2.3 API connection, owner reassignment, `/` replacement, Admin Proxy, iframe or cross-service database reads
- Expected PR title: `fix(operations-console): complete V2.2.2 interaction integrity`

## Preserved information architecture and states

The existing Shell, 12 first-level modules and 90 secondary routes remain. The hierarchy is module → page → visible object → matching detail → explicit local Demo or protected staging flow. Loading, empty, error, permission, partial and success states retain their existing truthful boundary. Unknown routes now use a separate not-found state instead of silently rendering a valid business page.

## Independent-audit finding → repair → proof

| Finding                                               | Root cause                                                                 | Repair                                                                                                                                                  | Browser proof                                                                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Evidence draft leaked across objects                  | uncontrolled review controls survived evidence selection                   | review drafts are keyed by immutable evidence ID/version; confirmation shows target ID, version, locator, digest, accuracy/currentness and current note | edit `EVD-11842`, switch to `EVD-11841`, verify independent defaults, save a second draft, switch back, verify the first draft |
| Protected dialog keyboard loop skipped the reason     | focus trap treated Cancel as the first control instead of using DOM order  | initial focus is the reason textarea; DOM-order trap traverses textarea → Cancel → Confirm and wraps both directions                                    | keyboard fill, Tab, Tab, Tab wrap, Shift+Tab wrap, Escape and trigger-focus restoration                                        |
| Inspector claimed modal behavior without enforcing it | `role=dialog` and `aria-modal=true` contradicted an interactive background | inspector is an explicitly non-modal complementary region; close control receives focus, Escape closes, trigger focus returns                           | role/attribute assertion, initial focus, Escape and return-focus test                                                          |
| Data Package metadata buttons did nothing             | rendered buttons had no handler                                            | selected package and selected file produce a local metadata detail with package ID, filename and size                                                   | select `PKG-US-2409`, open `applications.parquet`, assert exact detail                                                         |
| Raw Files and Transforms were static                  | source/object/card controls were not bound to detail state                 | source facet selects its fixture inventory; RawArtifact and all ten conversion cards bind ID, input, profile, Worker and receipt to one selection       | select CNIPA `RAW-99214`; select `CONV-9813`; assert every matching field                                                      |
| Knowledge version filters were contradictory          | two uncontrolled checkboxes did not participate in retrieval               | mutually exclusive current/all radio scope filters a deterministic historical fixture                                                                   | current returns 3; all returns 4 and exposes the named 2025 archive                                                            |
| Alert deep-link lost exact object and refresh context | only in-memory module path was stored                                      | URL carries safe owner object ID, alert ID and return path; target auto-selects and refresh reconstructs context                                        | `ALT-7718` → `CONV-9813`, refresh, exact target and alert context remain                                                       |
| Unknown URL displayed Platform Overview               | route resolver always substituted its fallback                             | resolver reports validity; invalid URL renders explicit 404 with a deliberate return link                                                               | invalid URL remains unchanged and no Platform Overview content is rendered                                                     |
| Extremely small operational text                      | many fixed 8–11 px declarations survived the prior patch                   | fixed declarations below 12 px removed; primary work text is 13 px and metadata baseline is 12 px                                                       | computed Knowledge review-history text is at least 13 px                                                                       |
| Mobile review work started below decoration           | review tools and KPI strip always consumed vertical space                  | Demo review tools default collapsed on narrow screens; work pages suppress redundant KPI strips; queue → source → decision order remains                | 390 px queue enters the first 720 CSS pixels, no horizontal overflow, tools can be expanded explicitly                         |

## Visible-control audit

The TSX renderers for all 90 registered pages were statically traversed after the fix. Native buttons and visible select/input filters were checked for explicit handlers. Result: `UNBOUND_INTERACTIVE_CONTROLS=0`.

The repair includes controlled filters or selection for Data sources, coverage export, package file metadata, Data settings groups, Knowledge sources, plans, runs, RawArtifact facets, conversion cards, currentness scope and supply-health alerts. Controls that remain buttons perform their named local Demo interaction; static content uses non-button elements.

This audit does not claim that a local fixture action is a real owner operation. Protected and local effects remain explicitly labelled, and the error-state recovery action is named “模拟恢复页面状态”.

## Responsive and accessibility acceptance

- Desktop and 390 px paths cover exact-object selection, negative filters, keyboard confirmation and details.
- Protected dialogs isolate Shell and an open inspector; their complete form path is keyboard reachable.
- The non-modal inspector exposes honest semantics and a deterministic close/focus path.
- 390 px evidence review keeps 44 px critical targets and no page-level horizontal overflow.
- Existing Chromium 200% page-scale and 720 CSS-pixel reflow coverage remains passing.
- Storybook fixtures include RawArtifact selection, an addressable conversion context and unknown-route state.

Visual evidence:

- `playwright-screenshots/super-admin-v222-evidence-confirm-desktop.png`
- `playwright-screenshots/super-admin-v222-evidence-confirm-mobile.png`
- `playwright-screenshots/super-admin-v222-evidence-workspace-desktop.png`
- `playwright-screenshots/super-admin-v222-evidence-workspace-mobile.png`

## Validation

Executed on 2026-09-24:

- focused fail-first P0 run — 3 expected failures before implementation
- focused P1 reverse test run — 5 expected failures before implementation
- V2.2.2 desktop/mobile interaction matrix — 18 PASS
- complete Operations Playwright matrix — 70 PASS / 2 intentional viewport skips; 90-route desktop matrix PASS
- `pnpm --filter @markorbit/operations-console test` — 22 files / 81 tests PASS
- lint, TypeScript, build, workspace validation, formatting, CI scope-detector and pre-push freshness — see final task output

The Playwright configuration also starts Lite and MarkReg development servers. Their previously documented missing prebuilt-contract pre-transform warnings remain unrelated to the Operations Console tests; the Operations server and selected journeys pass.

## Gate decision

V2.2.2 removes the audited object-integrity and false-control defects without adding production authority. V2.3 real read-only API work remains a separate change and must continue to use the owner/Gateway authority matrix. This result does not authorize a production write integration or replacement of `/`.
