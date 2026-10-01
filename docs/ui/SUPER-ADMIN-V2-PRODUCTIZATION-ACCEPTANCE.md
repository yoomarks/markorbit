# Super Admin V2 productization acceptance

- Task ID: `MO-SUPER-ADMIN-V2-PRODUCTIZATION-001`
- Preview: `http://127.0.0.1:4175/super-admin-v2/overview/platform`
- Workspace Demo: `http://127.0.0.1:4175/super-admin-v2/workspaces/directory`
- Workspace Real: `http://127.0.0.1:4175/super-admin-v2/workspaces/directory?mode=real`

## Delivered slice

This acceptance is for the bounded productization change, not a claim that every owner now has a complete production management API.

- The task-grouped, bilingual twelve-module / ninety-route IA remains intact.
- Platform Real overview now reads three independent samples: Core Workspace, Data Engine and Knowledge.
- Workspace Demo provides a high-fidelity organization, agency, entitlement, installation and Site dossier with exact `siteId`.
- Workspace Real uses the existing Core Gateway read and labels the four unconnected facts instead of backfilling Demo or inferring them.
- Core read failures keep authentication, permission, timeout, upstream and contract meanings distinct from a valid empty result.
- No production command was added and Real mode has no Demo review controls.

## State matrix

| State                | Expected UI                                                                             |
| -------------------- | --------------------------------------------------------------------------------------- |
| Loading              | Owner-specific loading state; no zero-value substitution                                |
| Success              | Owner, authority and `observedAt` plus canonical Workspace fields                       |
| Empty                | “No matching Workspaces”; explicitly described as successful zero result                |
| Authentication       | “需要登录 / Sign-in required”                                                           |
| Permission           | “无读取权限 / Read permission denied”                                                   |
| Timeout              | “读取超时 / Read timed out”                                                             |
| Upstream unavailable | Owner unavailable; sibling owners remain usable                                         |
| Contract mismatch    | Untrusted payload rejected; no partial rendering                                        |
| Not connected        | Agency, products, commercial entitlement and Site list shown as unavailable, never Demo |

## Browser evidence

| View                     | Screenshot                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Demo Workspace, 1440×900 | `playwright-screenshots/super-admin-productized-workspace-desktop.png`                   |
| Demo Workspace, 390 px   | `playwright-screenshots/super-admin-productized-workspace-mobile.png`                    |
| Real Workspace, 1440×900 | `playwright-screenshots/super-admin-real-workspace-desktop.png`                          |
| Real Workspace, 390 px   | `playwright-screenshots/super-admin-real-workspace-mobile.png`                           |
| Real platform overview   | `playwright-screenshots/super-admin-v23-real-platform-desktop.png` and mobile equivalent |

The screenshots are captured after selecting a different Workspace/Site or applying a real owner-side search, so they prove object interaction rather than route availability alone.

## Automated acceptance paths

- Demo Workspace A/B selection updates the organization dossier and exact Site context.
- Mobile Workspace selection and Site detail have no page-level horizontal overflow.
- Real directory sends the search to the Core read, selects only a returned object and shows unavailable integrations.
- A 403 is not rendered as an empty directory; a successful zero result is not rendered as owner failure.
- Platform overview renders Core Workspace, Data and Knowledge independently with no Demo fixture leakage.
- English has no untranslated visible UI across all ninety routes.
- Existing task, evidence, deep-link, protected-dialog and Demo/Real integrity tests remain regression gates.

## Validation result

| Gate                                 | Result                                                            |
| ------------------------------------ | ----------------------------------------------------------------- |
| Operations Console unit suite        | 23 files, 91 tests passed                                         |
| Operations browser suite             | 100 passed, 8 intentionally viewport-skipped                      |
| Workspace, Site and Real-owner paths | desktop and 390 px passed; 1366×768 bilingual screenshot reviewed |
| Ninety-route English audit           | passed with zero missing visible translations                     |
| Lint / TypeScript / production build | passed                                                            |
| Repository workspace validation      | passed                                                            |
| CI scope-detector tests              | 29 passed                                                         |

The browser suite briefly exposed an obsolete generic-action assertion on the newly specialized Workspace dossier. The acceptance was corrected to exercise the actual Site selector and the full suite was rerun to green; no product behavior was weakened to satisfy the test.

## Merge and production boundary

Passing these checks authorizes review of this design branch only. It does not replace `/`, grant customer-product access, activate a write command or prove an unconnected owner portfolio. External CI and merge status must be reported separately.
