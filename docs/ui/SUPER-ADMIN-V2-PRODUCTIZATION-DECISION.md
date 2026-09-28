# Super Admin V2 productization decision record

- Task ID: `MO-SUPER-ADMIN-V2-PRODUCTIZATION-001`
- Repository surface: `apps/operations-console`, `tests/e2e`, `docs/ui`
- Users: authorized MO platform operations, support, product, data operations and technical administrators
- Job to be done: find the governed object that needs attention, understand its current evidence, and take only the action the owning service permits
- UI baseline: `d6a81b455`; authoritative code baseline: `origin/main@e44470ea8`
- Expected PR title: `feat(operations-console): productize Super Admin V2 workspace control`

## Decision

Super Admin is a distinct internal platform product. It is not Workspace Console, Lite, Site Admin or Customer Portal with a different sidebar. It may present bounded owner projections, but it does not acquire the customer's private product permissions or create a second business truth.

The current twelve route modules stay stable and are grouped by operator task. The visible IA, all ninety routes and the old-to-new label map remain canonical in [SUPER-ADMIN-V2-NAVIGATION-IA.md](./SUPER-ADMIN-V2-NAVIGATION-IA.md). This review does not force Brain and Capability, or Data and Knowledge, into one owner. Their visual grouping is orientation only.

Three truth classes are shown explicitly:

1. **Real owner truth**: returned by an existing Gateway route, authenticated with the existing HttpOnly operator session and exact capability.
2. **Contract only / not connected**: the domain may have a contract or intended composition, but this page has no approved projection. The UI says “暂未接入 / Not connected”.
3. **Demo fixture**: local review data and local-only interaction. It is always labelled Demo and never presented as an owner result.

## Four-role decision record

| Role               | Decision                                                                                                                                                        | Reason                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Product director   | Keep the task-grouped IA and stable ninety routes. Make “what needs attention” and the owning object the first content on operational pages.                    | Operators should not need to learn the service topology, but navigation simplification cannot erase owner boundaries. |
| Design director    | Preserve one H1, compact module context, object-first workspaces, mobile cards and explicit loading/empty/error/permission/partial states.                      | A platform console is judged by safe decisions and scan efficiency, not dashboard decoration.                         |
| Technical director | Reuse existing Gateway contracts and capabilities. Add Workspace Real read through Core; do not compose agency, product, commerce or Site truth in the browser. | Services own their data. A convenient client-side join would be an ungoverned second truth.                           |
| Chinese UX writer  | Use concise Chinese navigation and exact command language. Keep IDs, official records, logs and owner terminology verbatim.                                     | “重试 / 重放 / 恢复 / 回滚” and “停用 / 暂停 / 撤销授权 / 删除 / 归档” carry different risk and audit meaning.        |

## Owner and implementation audit

The audit used current Gateway routes, client parsers, owner projections and issues `#958`, `#960`, `#963`, `#967`, `#968`, `#973`, `#999`, `#1000`, `#1017`, `#1018`, `#1023`, `#1024`, `#1025`, `#1026` and `#1061`. An API or table is not treated as proof of complete administration.

| Area                            | Canonical owner / route reviewed                                          | Current Super Admin status                                                                 | Product rule                                                                         |
| ------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Workspace portfolio             | Core; `GET /api/internal/super-admin/workspaces`; `workspace-admin:read`  | Real read connected in V2 directory and platform overview                                  | Only identity, lifecycle, version and membership counts are shown as real.           |
| Workspace display name          | Core; protected `PATCH` with `workspace-admin:manage`                     | Existing V1 capability; deliberately not surfaced by this read-only productization         | No new production command in this round.                                             |
| Data summary                    | Data Engine; `/api/internal/control-plane/data/summary`                   | Real read already connected                                                                | Preserve owner, observation time, freshness and availability.                        |
| Knowledge supply                | Knowledge; `/api/internal/control-plane/knowledge/evidence-supply-health` | Real read already connected, Workspace scoped                                              | Source, Raw Artifact, Evidence and Ready Package remain different objects.           |
| Brain                           | Brain bounded administration projection                                   | Existing governed read boundary; V2 detailed pages remain Demo unless explicitly connected | Never infer Capability verification from a model run.                                |
| Capability                      | Capability bounded administration projection                              | Existing governed read boundary; V2 detailed pages remain Demo unless explicitly connected | Stable Outcome Contract, implementation, evidence and version lineage stay explicit. |
| MarkReg / Lite / Site           | Separate product owners                                                   | No customer-product screens embedded in Super Admin                                        | Platform access does not grant customer files, matters or private knowledge.         |
| Commercial / Payment            | Commercial and Payment owners                                             | No second ledger; V2 Demo pages remain visibly Demo unless an approved read is connected   | Payment is not performance, authority, acceptance or completion.                     |
| Execution / System / Governance | Owner-specific bounded projections; some portfolios are `NOT_YET_MODELED` | Unknown coverage stays unknown or not connected                                            | No synthetic green status and no zero substituted for failure.                       |

## Workspace composition decision

The operator job is to understand one Workspace without silently inheriting its business permissions.

### Demo review dossier

The Demo directory presents a coherent fixture-backed dossier containing organization profile, agency identity relation, member summary, product installations, commercial entitlements and the Workspace's Site estate. Every selected Site exposes the exact `siteId`, type, status and domain. Selecting a Site does not claim Site administration authority.

### Real directory

The Real directory reads only the Core portfolio. It supports owner-side search and lifecycle filtering, object selection, valid empty state and distinct authentication, permission, timeout, unavailable and contract-failure states. The following cards intentionally remain unavailable until approved owner projections exist:

- agency identity binding;
- product installation composition;
- current commercial entitlement;
- Site list and exact `siteId`.

This is an accuracy feature, not an incomplete-data fallback. Order or payment history is not used to infer entitlement, and Core membership does not unlock customer-private data.

## Navigation and page de-duplication

The twelve current modules remain: Overview, Workspaces, Users & Access, Products, Data, Knowledge, Brain, Capability, Integrations, Operations, Billing and Governance. Their ninety secondary routes, previous labels, new labels, group and rationale are listed route by route in [SUPER-ADMIN-V2-NAVIGATION-IA.md](./SUPER-ADMIN-V2-NAVIGATION-IA.md).

De-duplication rules remain:

- sidebar = module context;
- secondary navigation = current task;
- page body = exactly one task-specific H1;
- H2/H3 = distinct work sections only;
- Demo review tools stay collapsed and outside the primary workflow;
- operational pages lead with objects and actions, not mandatory KPI cards.

## Permission and action boundary

- Hiding a control is never authorization. Gateway capability checks remain authoritative.
- Selecting a Workspace or Site is context, not elevation.
- Real reads use the existing operator identity and `credentials: include`; no downstream key reaches the browser.
- Unknown, stale, unavailable, partial, forbidden and empty are separate states.
- Protected commands must state target, impact, required permission, precondition, irreversible risk, reason and confirmation record.
- This change introduces no new command. Existing Demo actions remain local simulation, and Real pages do not show Demo review controls.

## Critical journeys

| Role                    | Journey                                                                                                                     | Evidence required                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Platform operations     | Overview → failing owner → exact task/evidence → recovery conditions                                                        | owner, observed time, dependency, checkpoint, permitted action |
| Support                 | Find Workspace → inspect Core identity/members → inspect Demo relationship/Site composition without gaining customer access | workspaceId, exact siteId, source boundary, privacy note       |
| Product manager         | Product → release / global availability / entitlement / Workspace enablement / runtime health                               | five states remain separate                                    |
| Data operations         | Data source → acquisition job → checkpoint / receipt → retry, replay or recovery                                            | source, Job/Run/Plan/Checkpoint/Receipt identity               |
| Technical administrator | Integration → service switch / credential / grant / health / degradation path                                               | exact scope, authority, health and blast radius                |
| Security administrator  | Audit event → actor / object / policy / evidence → protected confirmation                                                   | immutable evidence and permission basis                        |

## Responsive and accessibility behavior

- 1440 and 1366×768: persistent grouped navigation, two-column object/detail workspace where useful.
- 390 px: drawer navigation, stacked object/detail cards, 44 px targets and no tiny-text compression.
- Source, update time, permission and unavailable facts remain visible on narrow screens.
- List selection uses buttons; selected Site and Workspace remain explicit; language switching does not alter IDs or authority.

## Non-goals

- No production write, database migration, shared-contract expansion, generic Admin Proxy or cross-service database read.
- No replacement of `/` and no modification of Lite, Workspace Console, Site Admin or Customer Portal.
- No inferred entitlement, Site inventory, global health, Capability truth or commercial ledger.
- No automatic production switch after local or CI success.
