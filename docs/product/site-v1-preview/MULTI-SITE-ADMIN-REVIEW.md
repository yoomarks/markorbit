# Site Admin multi-Site product and design review

Status: **approved for the fixture-only Site V1 Preview**  
Review roles: Product Director, Design Director, Technical Director, UI Designer  
Scope: PR #1440 only; no production contract, API, database, payment, WeChat identity, or real publication change.

## 1. Product model decision

A Workspace is the relationship and entitlement container. A **Site** is one independently managed
external channel instance created under that Workspace. The Preview models the following hierarchy:

```text
Workspace
`- My Sites
   |- Site instance: Official website
   |  |- stable siteId
   |  |- terminal = WEB
   |  |- independent draft, published snapshot, versions, permissions and inquiries
   |  `- optional authorized references to Workspace brand/content/service sources
   `- Site instance: WeChat mini-program
      |- different stable siteId
      |- terminal = WECHAT_MINIPROGRAM
      |- independent draft, published snapshot, versions, permissions and inquiries
      `- terminal-specific configuration and preview
```

Selecting a Site enters that Site's Admin. Every mutation is addressed to its `siteId`; neither a
Workspace selection nor a shared source reference authorizes a mutation to another Site. An inquiry
keeps its source `siteId`, terminal and entry route. It remains a lead until an owning customer
workflow explicitly associates it with a Workspace customer relationship.

The Admin interface language, Site default display language, visitor language and each locale's
publication state remain separate. Switching the Admin interface language changes chrome only.

## 2. Existing contract audit and compatibility decision

### Production truth already present

- `SiteInstallationV1` owns stable `siteId`, `workspaceId`, lifecycle, current configuration
  version and exact Core installation reference.
- `SiteConfigurationVersionV1` is site-scoped and carries brand, localization, role references,
  services, content slots and source lineage.
- `SiteRequestContextV1` binds a public request to exact Site, Workspace, configuration and host
  binding versions.
- Service availability already carries a channel, but that does not make a service record a Site.
- The inbound attribution contracts retain `siteId`; this is the correct basis for channel-specific
  inquiry provenance.

### Gap: current mini-program renderer

`WechatMiniProgramSiteProjectionV1` intentionally renders one existing `ResolvedPublicSiteV1` and
owns no Site, Customer, Quote, Order, Matter, Payment, content or configuration truth. Its Gateway
adapter resolves an already active Site hostname. Therefore today's production mini-program is a
renderer of one Site installation, not proof that a website and mini-program are already separate
Site instances.

### Approved compatibility path

PR #1440 introduces **no production contract change**. The Preview gains multiple isolated Site
fixtures under one Workspace and labels the mini-program instance as a target operating model. The
existing Web and WeChat renderers continue unchanged.

Before production migration, the owning Site contract must decide whether terminal type belongs to
the installation, an exact configuration profile, or a new channel binding. That decision must also
define entitlement counts, host/AppID bindings, public resolution, migration of current hostname-
bound mini-program deployments, analytics attribution and rollback. Existing installations must not
be split or reassigned automatically. Shared brand/content/service sources require explicit source
references and grants; publishing always produces a version for exactly one `siteId`.

## 3. Four-role review

### Product Director — approved scope

- Add **My Sites / 我的 Site** as the Workspace-level chooser.
- Make current Site name, terminal, status and `siteId` visible throughout Site Admin.
- Keep Site Admin bounded to current-Site operation: overview, pages, design, content, services,
  inquiries, data and settings.
- Return Workspace membership, billing, complete customer resources and all-Site governance to the
  Workspace surface; do not duplicate them here.
- Keep inquiries as leads. Never merge by phone, email or display name, and never infer merchant,
  fulfillment or professional authority from Workspace ownership.

### Design Director — approved IA

Entry is `/admin/:workspace/sites`. Selecting a card opens the canonical Site-scoped route
`/admin/:siteId/overview`. Existing `/admin/:workspace/:section` links remain compatible
and resolve the Workspace's default Web Site.

The eight current-Site tasks remain: **概况、页面、装修、内容、服务、咨询、数据、设置**. The
shell provides **返回我的 Site**, a permission-filtered Site switcher and an explicit terminal badge.
Website and mini-program editors share task meaning but not canvas behavior: Web supports responsive
desktop/390px preview; mini-program uses a touch-device canvas and bottom-navigation structure.

### Technical Director — approved boundaries

- Preview persistence is keyed per `siteId`; resetting, editing, restoring or publishing one Site
  cannot write another Site's snapshot.
- Role checks remain centralized on every mutation and apply to direct routes.
- Published public routes read only the selected Site's immutable published snapshot.
- Fixture source sharing is descriptive and non-authoritative. No production Owner or contract is
  moved into the Preview.
- Legacy fixture storage is migrated conservatively to the default Web Site; the mini-program starts
  from its own seed and version history.

### UI Designer — approved experience

- Desktop shell uses a persistent current-Site rail plus a compact top-bar selector.
- At 390px the rail becomes a touch drawer; Site identity and terminal remain visible before page
  actions. The switcher does not clear selection, locale or draft state.
- Overview prioritizes readiness, unpublished changes, open inquiries and common actions for the
  current Site, with truthful browser-local provenance.
- Lists use complete filter/status/action patterns. The existing editor retains block selection,
  content fields, draft/published comparison, responsive preview and explicit publication feedback.
- Permission, empty, error, partial, success and stale states remain distinguishable in text, not
  color alone.

## 4. Screen and state acceptance

| Surface             | Desktop                                                                | 390px                                  | Required evidence                                               |
| ------------------- | ---------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| My Sites            | Two or more Site cards with terminal, status, version and pending work | Stacked touch cards                    | Opening each card retains its stable `siteId`                   |
| Site shell          | Current Site identity, return link, Site switcher and eight tasks      | Drawer with identity and 44px targets  | Switching Site preserves Admin locale and isolates state        |
| Overview            | Readiness, unpublished work, inquiries, common actions                 | Priority cards before secondary detail | Metrics refer only to current Site                              |
| Web design          | Page tree, desktop/390px canvas, properties, draft/publish feedback    | Fit-to-width task stack                | Draft and published snapshots differ until explicit publish     |
| Mini-program design | Page/navigation structure and phone canvas                             | Native-width touch canvas              | No mechanically compressed desktop Web canvas                   |
| Content/services    | Search/filter, locale/status, edit, preview and publish state          | Cards/stacked fields                   | Locale status is explicit; missing publication is not disguised |
| Inquiries           | Site/channel provenance and lead status                                | Readable detail stack                  | No automatic Customer merge                                     |
| Settings            | Site identity, terminal config, languages and Site permission demo     | Ordered sections                       | Workspace billing/team/customer library stays out of scope      |

Automated acceptance must prove: Web draft changes do not change mini-program draft; Web publication
does not publish mini-program; leads preserve different Site/channel origins; VIEWER direct routes
cannot mutate; Admin locale switching does not change Site configuration or publication versions;
legacy links still reach the default Web Site.

## 5. Explicit non-goals

No production Auth, real WeChat login/AppID deployment, payment, Quote, Order, Matter, Customer merge,
file upload owner, real DNS/search submission, production publication, database migration or Site
Runtime contract expansion is included. The Preview remains browser-local fixtures.
