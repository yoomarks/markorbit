# Workspace Console V1 — joint review and Decision Record

Status: `PROPOSED_FOR_INDEPENDENT_REVIEW`

Task ID: `MO-WORKSPACE-CONSOLE-V1-DR`

Audited base: `origin/main@e44470ea8bf08faf8a2be9ac8c7b513317a45ea9`

Expected PR title: `feat(workspace): add Workspace Console V1 review preview`

This record freezes a reviewable product and interaction proposal. It does not activate a
production route, mutate a database, create a paid agreement, prove payment, or change owner
contracts.

## 1. Task frame

- Repository: `yoomarks/markorbit`.
- Allowed directories: this record, `docs/ui/workspace-console-v1`, the isolated
  `apps/workspace-console-preview`, and its focused browser acceptance.
- User and job: an institution owner needs one place to understand the institution identity,
  products, people, resources and commercial configuration, then delegate bounded work without
  losing customer or legal-entity separation.
- User-visible outcome: a Chinese-first, fully bilingual, desktop-first and 390 px review preview
  for overview, resources, products, team, billing and institution settings.
- Canonical sources: repository `AGENTS.md`, Books 01–07 and Capability Canon terminology already
  reflected in current contracts, #1241, #1093, #1234 and merged owner implementations.
- Contracts consumed: Core Identity/Auth, Workspace Commercial, Customer Context, Workspace
  Directory, Trademark Asset, Site and current Knowledge delivery contracts. No contract changes
  are made by this review slice.
- Events: none emitted or consumed by the preview. Interaction feedback is local fixture state.
- State transitions: preview-only transitions are documented below; no owner state changes.
- Validation: static preview checks, bilingual browser acceptance, desktop and 390 px screenshots,
  accessibility checks and negative permission paths.
- Non-goals: production Workspace route, persistence, payment, provider integration, migration,
  generic IAM, duplicate resource stores, Cordis admin, cross-workspace employment or merge.

## 2. Fresh-main owner audit

### Current owner and projection map

| Object / truth                                   | Durable owner on audited main                                                    | Console treatment                                                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User, Workspace, Membership, role and permission | Core Identity (`identity.ts`, `auth.ts`)                                         | Read current principal and membership; never derive from plan.                                                                                                    |
| Current Workspace authority                      | Core `CurrentWorkspaceAuthorityService`                                          | Revalidate membership, status, version and required permission before consequential commands.                                                                     |
| Workspace display name / slug                    | Core Workspace                                                                   | Show as current identity header. Existing user-facing creation exists; current rename command is Super Admin-only and is not reused for institution self-service. |
| Workspace profile / entity kind / legal主体      | W0 design frozen in #1241, but no production `WorkspaceProfileV1` contract found | Proposed form is fixture-only. A bounded Core-owned profile contract is a prerequisite for production.                                                            |
| Agency names / verified agency identities        | No canonical binding owner found                                                 | Proposed aliases/verified references are fixture-only. They must remain distinct from brand and legal主体.                                                        |
| Product installation and entitlement             | Core Workspace Commercial                                                        | Read installation and resolved entitlement separately. Installation, entitlement and payment are never collapsed.                                                 |
| Site instance, brand/config, host and lifecycle  | Site service                                                                     | List all Sites and deep-link to the selected Site Admin. Console does not duplicate Site configuration.                                                           |
| Customer relationship                            | MarkReg Customer Context                                                         | Directory/reference projection only; no copied customer database.                                                                                                 |
| Workspace-private contacts and organizations     | Lite Workspace Directory                                                         | Reference existing customer/provider/applicant identities; never become KYC, consent or authority truth.                                                          |
| Trademark Asset / portfolio                      | Lite Trademark Asset                                                             | Directory/projection only with exact owner/source lineage.                                                                                                        |
| Opportunities and work                           | Lite                                                                             | Summary and deep-link only; do not create a parallel pipeline or work store.                                                                                      |
| Knowledge                                        | Knowledge/Core delivery and product-local consumption                            | Searchable reference surface only. No Workspace-owned duplicate knowledge base.                                                                                   |
| Payment / refund / provider reconciliation       | Payment                                                                          | Billing view may show owner-returned status. A CTA cannot imply payment success.                                                                                  |
| Protected external action                        | Execution + relevant domain owner                                                | Always requires exact current review/approval; role or entitlement is insufficient.                                                                               |
| Provider capability / participation              | MGSN                                                                             | Never inferred from an agency name or Workspace profile.                                                                                                          |
| Internal Super Admin                             | Core internal operator boundaries                                                | Explicitly outside the institution console.                                                                                                                       |

### Open PR and lock audit

At bootstrap, open PR #1440 owned `pnpm-lock.yaml` and workspace topology; #1441 owned the
Customer Portal preview surfaces. This slice therefore uses no new dependency, does not register a
production app, and does not touch either PR's files. The isolated preview runs on the Node standard
library.

### REUSE / EXTEND / NEW MINIMUM / DO NOT CREATE

| Decision      | Objects / behavior                                                                                                                                     | Reason                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REUSE         | Core Workspace, Membership, Principal/currentness, role-permission matrix                                                                              | Existing tenant and coarse permission authority.                                                                                                                                                  |
| REUSE         | Core Product Installation, Agreement, Entitlement, assignable benefit and rate policy                                                                  | Existing commercial separation; the console is a consumer, not a billing owner.                                                                                                                   |
| REUSE         | MarkReg Customer Context, Lite Workspace Directory, Trademark Asset, Lite work/opportunity, Knowledge and Site                                         | Resource directory projects exact owner references without copying data.                                                                                                                          |
| REUSE         | Site installation/config/host lifecycle and existing Site Admin                                                                                        | One Workspace can already own multiple Sites; Console lists and routes, Site Admin configures.                                                                                                    |
| EXTEND        | Core with a bounded Workspace Profile and institution self-service command/read surface                                                                | Current Workspace only has name/slug; #1241 froze the missing semantic layer.                                                                                                                     |
| EXTEND        | Membership onboarding with invitation lifecycle and currentness                                                                                        | Reuse Membership as the final membership owner; invitation is not an active Membership.                                                                                                           |
| EXTEND        | Owner-local list/read APIs needed for aggregate cards                                                                                                  | Aggregate in a Gateway composition/read model; do not use cross-service SQL.                                                                                                                      |
| NEW MINIMUM   | Resource Access Grant: subject, exact resource refs, action set, validity window, lifecycle, grantor evidence and revocation currentness               | No current generic resource-scoped grant was found, yet employee and external-collaborator journeys require fail-closed per-resource access. Product/architecture review is required before code. |
| NEW MINIMUM   | Agency Identity Binding: Workspace, displayed agency name, optional verified external identity ref, effective window and status                        | Needed to bind two agency names without treating brand, agency name and legal主体 as the same thing. Verification remains with the verifying owner.                                               |
| DO NOT CREATE | Second Workspace/Principal/IAM, customer CRM, trademark store, opportunity store, knowledge base, commercial/entitlement engine, Payment or Site owner | These owners already exist.                                                                                                                                                                       |
| DO NOT CREATE | Generic Cordis management backend, cross-workspace employee graph, auto-merged legal entities, role explosion                                          | Outside V1 and conflicts with canonical scope.                                                                                                                                                    |

## 3. Four-role review

### Product Director proposal

The home page answers four owner questions in order: “which institution am I acting for?”, “what
needs my decision?”, “which products can my team use?”, and “who can see which resources?”. It is
not a second Lite inbox. Navigation is `首页 / 资源 / 产品 / 团队 / 费用 / 机构设置` and in English
`Overview / Resources / Products / Team / Billing / Organization`.

The primary business object on the console is the Workspace, not a plan. Resources stay grouped by
owner domain. Product cards show installation, entitlement and service status as separate lines.
Team access is expressed as resource scope + allowed actions + expiry, not a friendly role label
alone. A solo practitioner selects “个人执业” and never has to invent a company name.

Product risks identified:

1. “机构” is too broad unless legal主体, brand and agency identity are visibly separate.
2. “开通” can be mistaken for paid activation. Review preview uses an explicit confirmation and a
   fixture-only receipt; production must wait for commercial owner commands and Payment evidence.
3. A global “employee can see all customers” default would defeat the requested journey.
4. External collaborator must be a bounded access subject, not silently converted into a normal
   employee Membership.
5. Agency #1093 remains gated on the real operator environment; the console must not claim that its
   nine-step production dogfood is complete.

### Design Director proposal

Use a quiet operational visual language: high-contrast ink, warm paper background, one cobalt
accent, compact status chips and evidence-oriented metadata. Maturity comes from hierarchy,
states and recovery—not fictional revenue, transaction volume or “system health” counters.

Desktop uses a 248 px rail and a readable 1200 px content canvas. At 390 px, navigation becomes a
bottom bar, top actions collapse into a menu, cards become a single column, dense tables become
labeled resource rows, and consequential actions remain in a sticky confirmation footer. Chinese
labels are short and colloquial; internal terms such as Principal, Installation and Entitlement are
translated into user questions and explained only in detail panels.

Design risks identified:

1. A dashboard made only of six equal metric cards would look generic and hide responsibility.
2. Product status needs two axes (usable state and commercial basis), not one green badge.
3. Permission tables must remain understandable on mobile without horizontal scrolling.
4. “已撤销” must be visually and semantically final, with an old-link denial surface.
5. Verification and payment provenance need plain-language notices close to the action.

### Technical Director proposal

Ship the reviewed IA as a fixture-only isolated preview. For production, introduce one Gateway
Workspace Console composition read that calls owner APIs; do not create a console database. Each
mutation routes to its owner and revalidates current Workspace authority. Resource Access Grant and
Agency Identity Binding require separate bounded architecture decisions because neither exists on
audited main.

Technical risks identified:

1. Core roles are coarse bundles. They cannot express “only customer A + trademark B”.
2. Suspending Membership and revoking a resource grant are different operations; both need exact
   currentness and session/link invalidation behavior.
3. Current product installation endpoints are read-oriented for members; self-service commercial
   activation must not bypass offer/agreement/entitlement and Payment owners.
4. Site supports real Workspace-scoped multi-instance state, but a WeChat mini-program projection
   must show its channel/runtime readiness honestly rather than infer it from Site creation.
5. Aggregate availability must preserve `SOURCE_UNAVAILABLE`, `PARTIAL` and stale states instead
   of converting them to zero.

### UI Designer proposal

The preview includes: responsibility queue, resource directory, product list with separate status
lines, team access matrix, billing provenance, profile editor, agency identity binding, invitation,
resource sharing, revoke confirmation, Site creation, role-based view switching, bilingual content,
and a state laboratory for loading/empty/error/permission/partial/success.

Interaction risks identified:

1. “保存” without a clear scope can imply changes across legal主体; forms repeat the current
   Workspace and affected identity.
2. Checkboxes alone are insufficient for access; every grant summary restates resources, actions
   and expiry before confirmation.
3. Toast-only success is inaccessible and ephemeral; success persists in the dialog/result panel
   and uses `aria-live`.
4. Owner and employee views need different primary exits: Owner returns to Console; employee goes
   to Lite with only authorized work.

### Cross-review resolutions

| Challenge                                                                     | Decision                                                                                                                                                                               |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Should “Customers / Trademarks / Opportunities / Knowledge” be top-level nav? | No. They are resource tabs under one `资源` entry, because the Console is an owner directory, not four copied products. Deep links go to owners.                                       |
| Should roles drive access?                                                    | Roles provide coarse defaults only. Effective access is active Membership + current resource grants + owner permission checks + protected-action approval where applicable.            |
| Can an external collaborator be a Membership?                                 | Not by default. V1 proposal uses a bounded external access subject and explicit expiry. If implementation later maps it to Membership, it must remain distinguishable and fail closed. |
| Can multiple legal主体 live in one Workspace?                                 | They may be referenced, but no qualification, contract, customer or action authority crosses automatically. The UI keeps the acting legal主体 visible on consequential workflows.      |
| Where does Site configuration live?                                           | In Site Admin. Console shows all instances and status, creates an authorized handoff, and does not reimplement the builder.                                                            |
| How does Cordis appear?                                                       | Through future contextual assistance and workflow defaults. No separate complex console in this V1.                                                                                    |

## 4. Object and owner map

```text
Core Workspace
├── Membership ──> Workspace Principal ──> coarse Permission bundle
├── proposed Workspace Profile
│   ├── entity kind: individual | organization
│   ├── legal主体 references (never merged by containment)
│   └── proposed Agency Identity Bindings
├── Product Installations ──> resolved Entitlements
│   ├── Lite
│   └── Site ──> Site owner: Site instances/config/hosts
└── Console composition (read only; no database)
    ├── MarkReg Customer Relationships
    ├── Lite Workspace Directory
    ├── Lite Trademark Assets / Opportunities / Work
    ├── Knowledge owner references
    └── proposed Resource Access Grants
```

## 5. Permission and expiry matrix

`Current Membership` is necessary for employees. `Current Grant` is necessary whenever a resource
scope is narrower than the Workspace. Entitlement never grants data access.

| Human label                        | Membership / subject                                                | Resource visibility                               | Allowed Console operations                               | Protected external action                  | End condition                                                      |
| ---------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| 负责人 / Owner                     | Active `WORKSPACE_ADMIN` Membership                                 | Workspace resources allowed by owner contracts    | Manage profile, team, grants; request product operations | Separate review/approval still required    | Membership suspended, Workspace archived or authority stale        |
| 管理员 / Admin                     | Active Membership with current `workspace:manage`                   | Explicit grant or authorized Workspace-wide scope | Team/resource administration within granted scope        | Separate approval                          | Membership/grant revoked or expired                                |
| 专业人员 / Professional            | Active `MATTER_MANAGER`-like bundle                                 | Assigned customers, assets and work               | Read and perform owner-allowed work                      | Exact workflow permission + review         | Membership/grant revoked or expired                                |
| 复核人员 / Reviewer                | Active `REVIEWER` bundle                                            | Review targets referenced by current grants       | Review/prepare within owner workflow                     | Cannot infer filing/send/payment authority | Membership/grant revoked or expired                                |
| 只读成员 / Viewer                  | Active `READ_ONLY` bundle                                           | Explicit current resources                        | Read only                                                | Never                                      | Membership/grant revoked or expired                                |
| 外部协作者 / External collaborator | Proposed bounded external subject; not ordinary employee by default | Exact project plus explicit nested refs only      | Read/comment/upload only if granted                      | Never by role                              | `expiresAt`, explicit revoke, project close or currentness failure |

Effective access formula:

```text
authenticated subject
AND current Workspace / Membership or external subject
AND current resource grant matching exact owner refs
AND action included by the grant
AND owner-domain permission/currentness
AND (for protected action) explicit workflow approval
```

Revocation is fail-closed. Old links re-resolve the grant and return a permission denial; possession
of the URL is never authority.

## 6. Complete information architecture

### Overview

- Identity context: acting Workspace, entity kind, acting legal主体/agency identity and profile
  completeness.
- Owner decisions: incomplete profile, pending invite, expiring collaborator, Site verification.
- Product state: Lite and Sites with installation, commercial basis and runtime status separated.
- Collaboration: recent access changes and bounded handoffs.
- Resource summary: owner-backed counts with observed time; no revenue or fabricated health metric.

### Resources

- Tabs: Customers, Trademark Assets, Opportunities, Knowledge.
- Search/filter/list + owner/provenance details.
- Share opens a bounded grant form; “open in owner product” is the primary deep action.
- Empty, partial and unavailable sources are distinct.

### Products

- Product catalog and current instances.
- Lite: personal entitlement and Workspace installation are shown separately.
- Site: one installation may lead to multiple Workspace Site instances; “我的 Site” lists each Site
  and opens its Site Admin.
- Activation confirmation states that the preview does not execute payment or persist Core state.

### Team

- People, pending invitations and external access tabs.
- Access summary always answers `who / resources / actions / expiry`.
- Invite and revoke require review. Suspended Membership is distinct from revoked resource grant.

### Billing

- Current commercial agreement/entitlement provenance and invoices returned by owner systems.
- No local payment state, totals, projected revenue or transaction metric.

### Organization

- Basic Workspace profile.
- Brands, agency names and legal主体 are separate sections.
- Security/current sessions link; no internal Super Admin functions.

## 7. State matrix

| State           | Required treatment                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Loading         | Skeleton structure keeps page hierarchy; controls are disabled and announced.                        |
| Empty           | Explain what is absent, which owner would create it and the permitted next action.                   |
| Error           | Preserve entered form values, show owner/retry context and a retry action.                           |
| Permission      | Name the unavailable action without leaking hidden resource names; offer a safe route back.          |
| Partial         | Render available owners, name unavailable source groups and observed times; never replace with zero. |
| Success         | Persistent result with exact affected scope and truthful “preview only” provenance.                  |
| Stale/conflict  | Block mutation, reload owner state and require reconfirmation.                                       |
| Expired/revoked | Deny old links and explain when/why access ended without exposing other Workspace resources.         |

## 8. Decision

`APPROVE_PREVIEW_FOR_INDEPENDENT_REVIEW`.

Do not approve production implementation as one broad PR. After independent review, split it into:

1. Core Workspace Profile + Agency Identity Binding architecture/owner slice.
2. Invitation/current Membership self-service slice.
3. Resource Access Grant architecture slice with owner-specific enforcement and negative tests.
4. Workspace Console composition read and navigation shell.
5. Product activation handoff over Workspace Commercial/Payment owners.
6. Site list/create handoff consuming the existing Site owner.

Every slice must be bootstrapped from fresh main, declare exact scopes, keep shared locks, and add
owner-level persistence/currentness tests before any production UI claims success.
