# MarkOrbit Site V1 Preview Blueprint

## Product topology and truth boundary

```text
Core Workspace / membership / entitlement
                 |
                 v
Site owner: installation + versioned configuration + host projection
        |                         |
        |                         +--> Site Front renderers (Web now; mini-program later)
        v
Owner references only
  |- Lite Content Studio: reviewed content package
  |- MarkReg: product, price, intake, quote, order, matter
  |- Customer owner: relationship and customer truth
  |- Payment: merchant, checkout and reconciliation
  `- MGSN / Execution: governed provider routing and protected actions
```

This preview does not become an owner. It uses explicit demo fixtures and per-Workspace browser storage to demonstrate the target experience. A Site brand, visible price explanation, demo submission, demo publication, or provider label is never presented as verified professional identity, a final Quote, Payment, Order, provider appointment, filing, or Official Truth.

## CURRENT / TARGET / FUTURE

| Horizon             | Truthful scope                                                                                                                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CURRENT             | Production main has Site installation/configuration/host resolution, public-safe projection, MarkReg reference plus white-label rendering, Lite Site Manager, content review packages, and a bounded WeChat projection. Current Site Manager is owner-backed configuration, not a full builder/CMS.  |
| TARGET in this task | A standalone, fixture-only Site V1 Preview: richer Site Admin IA, block editor, two front templates, draft/published snapshots, content and inquiry golden paths, analytics linkage, state coverage, and responsive browser acceptance.                                                              |
| FUTURE              | Owner-backed page/content schemas, durable preview/version workflows, real permissions, approved publication execution, domain verification, governed analytics, customer portal, orders, payment, SEO submission, and additional renderers. These require owner contracts and are not claimed here. |

## Users and jobs-to-be-done

- **Workspace Owner / Site Manager:** shape the external business projection, prepare reviewed content and services, inspect readiness, publish a demo snapshot, and trace demand back to its source without changing downstream owner truth.
- **Content editor/reviewer:** prepare a versioned article, connect it to an owner-backed service reference, preview it, and explicitly publish a demo version.
- **Anonymous visitor / prospect:** understand the organization and service scope, browse useful content, submit a clear inquiry, and receive a demo reference without being silently turned into a Customer, Order, or Matter.
- **Customer:** see a safe demonstration of a request/status entry without implying live customer-service data.
- **Super Admin:** outside this preview. Platform-level Site governance remains a separate surface.

## Site Admin information architecture

The plain-language navigation, Site Front module rules, and planned Customer Portal IA are defined
in [`NAVIGATION-IA.md`](./NAVIGATION-IA.md). Stable routes and owner boundaries below remain valid;
the customer-facing labels are intentionally simpler than these architectural area names.

| Area             | Primary question                              | Primary action                          | Owner boundary                        |
| ---------------- | --------------------------------------------- | --------------------------------------- | ------------------------------------- |
| 概况 / Overview  | Is my Site ready and what needs attention?    | Continue setup / inspect inquiry        | Aggregates demo state only            |
| 页面 / Pages     | What can visitors reach?                      | Order, hide or preview page             | Site projection                       |
| 装修 / Design    | What will this page look like?                | Edit/reorder/hide blocks and save draft | Draft is not published                |
| 文章 / Articles  | What reviewed knowledge is ready to project?  | Edit, preview and demo publish          | Mirrors Lite package boundary         |
| 服务 / Services  | Which owner-backed services are visible?      | Toggle visibility / edit display copy   | No Quote or availability guarantee    |
| 咨询 / Inquiries | What did a visitor submit and from where?     | Assign demo follow-up status            | Inquiry is not Customer/Order         |
| 数据 / Data      | Which pages/articles led to inquiries?        | Follow attribution to an inquiry        | Demo metrics labelled                 |
| 设置 / Settings  | Which modules, locale and member roles apply? | Configure Site and related pages        | Workspace billing/team remain outside |

`/client-service` is the related **客户进度 / Customer progress** page under 咨询;
`/seo` is the related **域名与搜索 / Domain & search** page under 设置. Both stable routes remain.

Desktop uses a Workspace shell and dense workbench. At 390px the primary navigation becomes a horizontal scroll strip; editor tree, canvas and properties stack in task order; sticky actions remain reachable without hiding content.

## Site Front screen map

```text
Home
|- Services
|  `- Service detail -> Inquiry
|- Insights / Content
|  `- Article detail -> related service -> Inquiry
|- Trademark assets (optional module)
|- Contact / quote wizard -> Review -> Demo reference
|- Client service entry
|- Privacy / Terms
`- Not found
```

Template **Atlas IP Counsel** is editorial, calm, and advisory. Template **Foundry Exchange** is high-contrast, catalogue-led, and focused on brand assets and transactions. They differ in typography, density, composition, navigation, cards, and hero treatment—not only color and logo.

## V1.1 locale and publication model

- Site Admin UI locale is an operator preference. It defaults to `zh-CN`, supports `en-US`, and never changes Site configuration or visitor language.
- `defaultLocale`, `enabledLocales`, and each locale's publication state belong to the Workspace Site draft and immutable published snapshot.
- Visitor locale is restored from stable `/site/:workspace/zh-CN/...` and `/site/:workspace/en-US/...` URLs. Legacy `/site/:workspace/...` links resolve through the Site's published default locale.
- Page, block, service, article, SEO, legal copy, author identity, review status, and version metadata are locale-scoped fixtures. IDs, `productRef`, `packageRef`, original visitor messages, and attribution lineage are never translated.
- Draft preview uses `/site/:workspace/preview/draft/:locale/...`; it cannot leak into the published route.
- A locale in `DRAFT` or disabled state is not publicly routable. There is no silent fallback that makes an unreviewed translation appear published.

## Persistence truth

Site V1 Preview persists only browser-local fixtures in `localStorage`. Repository PostgreSQL suites validate other owners and shared boundaries; they are **not evidence that Site V1 Preview has server-side persistence**. This preview adds no production API, database, migration, Site Runtime, Workspace, Lite, or Super Admin change.

## Core demo objects and relationships

```text
DemoWorkspace 1--1 DemoSite
DemoSite 1--1 DraftConfiguration
DemoSite 1--1 PublishedSnapshot
DemoSite 1--* PublishedVersion
DemoSite 1--* Page 1--* Block
DemoSite 1--* ServiceDisplay --ref--> MarkReg product/version fixture
DemoSite 1--* ContentItem --ref--> reviewed PublishPackage fixture
ContentItem 0..1 --> ServiceDisplay
Inquiry --source page/content/service--> DemoLead --workspace/site--> DemoWorkspace
```

Every stored key includes the Workspace ID. Submitted inquiries receive one stable `DEMO-LEAD-*` ID that is shown on the confirmation screen and in the matching Admin lead detail.

## State matrix

| State                | Presentation and recovery                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Loading              | Skeleton with named operation; fixture boot is intentionally short but testable.                        |
| Empty                | No pages/content/leads state includes a bounded creation action.                                        |
| Error / save failure | In-context error with retained draft and retry; never rendered as empty or success.                     |
| Permission           | Read-only Admin explanation; preview remains available; mutation controls are disabled.                 |
| Partial              | Analytics/domain or owner projection shows which evidence is unavailable; no inferred values.           |
| Success              | Saved draft, demo-published snapshot, submitted inquiry and lead status expose exact demo IDs/versions. |
| Stale/unpublished    | Persistent banner compares draft and published version; Site Front reads published only.                |
| Conflict             | Restore or publish creates a new draft/version; it never rewrites historical snapshots.                 |

## Golden paths

1. **Create and publish:** open Atlas Workspace -> choose template -> edit hero -> configure service/contact -> switch desktop/mobile -> review checklist -> demo publish -> open Site Front and observe the published snapshot.
2. **Visitor to lead:** open a service -> choose market/service -> complete inquiry -> review -> demo submit -> retain the exact demo lead ID -> open Atlas Admin Leads and inspect identical source and needs.
3. **Content to opportunity:** edit the filing-strategy article -> associate the US filing service -> demo publish -> open the article on Site Front -> follow related service -> inquire -> inspect content and lead attribution in Admin analytics.

## Accessibility and visual acceptance

- One `h1` per route, semantic landmarks, real buttons/links, labelled inputs, associated validation errors, live status regions, visible focus, keyboard-reachable editor controls, non-color status labels, reduced-motion support, and no horizontal page overflow at 390px.
- Fixture stories cover overview success/partial, editor unpublished draft, no-leads empty state, permission denial, both Site templates, and inquiry validation.
- Browser acceptance captures desktop and mobile evidence and verifies direct navigation, refresh, forward/back, draft isolation, published snapshot isolation, form validation, restore, and cross-Workspace isolation.
