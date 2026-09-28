# Super Admin V2 navigation acceptance

- Task: `MO-SUPER-ADMIN-V2-NAV-001`
- Baseline: `a96f1ed25`
- Scope: navigation grouping, bilingual display names, task shortcuts and responsive navigation only
- Preview: `http://127.0.0.1:4175/super-admin-v2/overview/platform`

## Delivered behavior

- The twelve owner modules remain twelve independent modules and retain all ninety stable routes.
- The former flat module list is presented in five task-oriented groups: Workspace, Business Management, Data & Intelligence, AI & Capabilities and Platform Operations.
- Brain and Capability share a visual group only. Their routes, owner semantics, permissions and workspaces remain separate.
- Eight common-task links provide direct entry to system health, Workspace lookup, access inspection, failed-task recovery, data sources, products, API status and audit logs.
- Demo/Real mode is preserved by task links. No production write, permission expansion, owner merge or `/` console change is included.
- Chinese and English use the same route and permission model. Locale changes only presentation.

The complete old/new module and secondary-page mapping is recorded in
`docs/ui/SUPER-ADMIN-V2-NAVIGATION-IA.md`.

## Role task acceptance

| Role                        | Accepted path                       | Evidence                                                                         |
| --------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| Platform operations         | Common tasks → System Status        | Exact `/overview/health` link and existing cross-owner health workspace          |
| Customer support            | Common tasks → Find Workspace       | Exact `/workspaces/directory` link and existing Workspace selection/detail flow  |
| Customer support / security | Common tasks → Inspect User Access  | Exact `/users/roles` link and existing identity/relationship flow                |
| Operations                  | Common tasks → Handle Failed Tasks  | Exact `/operations/recovery` navigation and visible recovery workspace           |
| Data operations             | Common tasks → Inspect Data Sources | Exact `/data/sources` link; `?mode=real` is preserved                            |
| Product management          | Common tasks → Manage Products      | Exact `/products/portfolio` link and existing product/entitlement distinctions   |
| Technical administration    | Common tasks → Inspect API Status   | Exact `/integrations/health` link and existing service/grant/health distinctions |
| Security                    | Common tasks → Query Audit Log      | Exact `/governance/audit` link and existing audit-object workflow                |

## Responsive and accessibility acceptance

- Desktop and 1366×768 retain the grouped hierarchy in the independently scrollable sidebar.
- At 390 px the hierarchy uses the existing drawer and 44 px navigation targets.
- With Common tasks expanded, the mobile navigation can still scroll to and expose Security & Audit; the operator block does not make the lower modules unreachable.
- The native disclosure remains keyboard-operable. Active pages retain `aria-current`; navigation regions have localized accessible names.
- Existing 200% zoom, protected-dialog, object-selection and focus-return checks remain green.

## Visual evidence

- `playwright-screenshots/super-admin-v2-simplified-navigation-zh-desktop.png`
- `playwright-screenshots/super-admin-v2-simplified-navigation-zh-mobile.png`
- `playwright-screenshots/super-admin-v2-common-tasks-zh-desktop.png`
- `playwright-screenshots/super-admin-v2-common-tasks-zh-mobile.png`
- `playwright-screenshots/super-admin-v2-simplified-navigation-en-desktop.png`
- `playwright-screenshots/super-admin-v2-simplified-navigation-en-mobile.png`

## Verification

- Operations Console lint: passed.
- Operations Console TypeScript: passed.
- Operations Console unit tests: 23 files, 88 tests passed.
- Operations Console production build: passed.
- Full Super Admin browser suite: 94 passed, 8 intentionally viewport-specific tests skipped.
- Browser suite includes all 90 direct routes, bilingual visible-copy audit, desktop, 390 px, 200% zoom, Demo/Real separation and owner-object interaction regression.

## Explicit non-goals

No production API, write command, permission, service contract, database, owner truth or real-console entry was changed.
