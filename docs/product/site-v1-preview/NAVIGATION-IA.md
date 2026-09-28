# Site V1 navigation and plain-language IA

This document defines the navigation language for Site Admin, Site Front, and the planned Customer
Portal. It changes labels and placement, not stable routes, owner contracts, permissions, source
lineage, or Workspace isolation. Chinese is the primary writing language; the English labels are
equivalent product language rather than literal internal terminology.

## 1. Site Admin — Workspace site managers

**User and job:** an institution administrator operates one Workspace Site: update the homepage,
publish articles, maintain service descriptions, read inquiries, and check whether the Site is
ready to publish.

**Entry and hierarchy:** `/admin/:workspace/sites` opens **我的 Site / My Sites**. Selecting one
instance opens `/admin/:siteId/overview` and its eight-item task navigation. The legacy
`/admin/:workspace/overview` route remains compatible and resolves the Workspace's default Web
Site. The
existing `client-service` and `seo` routes remain directly addressable, but appear as related pages
inside **咨询 / Inquiries** and **设置 / Settings** instead of adding two more primary choices.

| Old label                         | New zh-CN / en-US            | Role          | Page / stable route                                                               | Why                                                               |
| --------------------------------- | ---------------------------- | ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Overview / 站点总览               | 概况 / Overview              | Owner, Viewer | 发布准备、未发布更改、待处理咨询；`/overview`                                     | Answers “what needs attention?” without an internal Site noun.    |
| Pages & navigation / 页面与导航   | 页面 / Pages                 | Owner, Viewer | Page visibility, order and draft preview; `/pages`                                | Page and menu organization are one visitor-facing job.            |
| Visual editor / 可视化编辑        | 装修 / Design                | Owner, Viewer | Homepage blocks, mobile canvas, draft and version restore; `/editor`              | Matches the task “修改首页” and common website-builder language.  |
| Content / 内容管理                | 文章 / Articles              | Owner, Viewer | Article list, editing, review and publication; `/content`                         | Current V1 content objects are articles; avoids a broad CMS term. |
| Services & offers / 服务与展示    | 服务 / Services              | Owner, Viewer | Service display copy and visibility; `/services`                                  | Direct answer to “修改服务介绍”. No Quote or availability claim.  |
| Leads & inquiries / 咨询与线索    | 咨询 / Inquiries             | Owner, Viewer | Inquiry inbox and detail; `/leads`                                                | “咨询” is the object the institution actually receives.           |
| Client service / 客户服务         | 客户进度 / Customer progress | Owner, Viewer | Read-only customer projection; `/client-service`, linked from 咨询                | It is a secondary follow-up view, not another customer database.  |
| Analytics / 访问分析              | 数据 / Data                  | Owner, Viewer | Measured inquiry/source data and explicitly partial fixture metrics; `/analytics` | Familiar label; avoids implying advanced analytics.               |
| Domain & SEO/GEO / 域名与 SEO/GEO | 域名与搜索 / Domain & search | Owner, Viewer | Domain/search readiness; `/seo`, linked from 设置                                 | Uses the administrator’s task language; retains the stable route. |
| Settings / 站点设置               | 设置 / Settings              | Owner, Viewer | Modules, languages, permissions and reset; `/settings`                            | One predictable place for low-frequency configuration.            |

Primary actions remain precise: **保存草稿 / Save draft**, **预览草稿 / Preview draft**,
**检查并发布 / Review & publish**, and **恢复为草稿 / Restore to draft**. Confirmation copy must
say which language and snapshot will become customer-visible and that restoration creates a new
draft rather than rewriting history.

At 390px the navigation opens as a touch drawer with the same eight choices. The editor remains a
task stack: language and save/publish actions, page blocks, fit-to-width canvas, selected-block
fields, then version history. No desktop sidebar is mechanically squeezed into the viewport.

## 2. Site Front — visitors and prospective customers

**User and job:** understand what the institution does, find a relevant service or article, contact
the institution, and enter the Workspace customer-service surface when available.

Navigation is generated from the published Site snapshot. A hidden/unpublished page or disabled
module contributes neither a menu item nor a routable published page.

| Old label                  | New zh-CN / en-US             | Role                             | Page / condition                                        | Why                                                                                                       |
| -------------------------- | ----------------------------- | -------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Home                       | 首页 / Home                   | Visitor                          | `/`; logo is the desktop entry                          | Conventional starting point; shown explicitly in compact navigation when needed.                          |
| Services / 专业服务        | 服务 / Services               | Visitor                          | `/services`; published page                             | Short and unambiguous across both templates.                                                              |
| Insights / 专业洞察        | 文章 / Articles               | Visitor                          | `/insights`; published page + insights module           | Visitors look for articles, not the content team’s classification.                                        |
| Brand assets / 品牌资产    | 商标展示 / Trademark showcase | Visitor                          | `/assets`; Foundry only, published page + assets module | States that items are displays; never implies verified goods ready to buy.                                |
| Contact + Start an inquiry | 联系我们 / Contact us         | Visitor                          | `/contact`; one emphasized entry                        | Removes two competing links to the same form.                                                             |
| Client service / 客户服务  | 我的 / My account             | Verified or prospective customer | `/portal`; portal module                                | Familiar website/mini-program convention; opens a Workspace service entry, not a separate customer store. |

Atlas uses **服务、文章、联系我们、我的**. Foundry additionally uses **商标展示**. A future
transaction-led Workspace may instead promote **办业务 / Start a service** and **进度 / Progress**,
but only when the owning product exposes those capabilities. Visual order may differ by template;
the same route and owner-backed task keeps the same meaning.

Visitor language stays in the stable URL. Admin interface language, Site default language, and the
visitor’s selected language remain independent.

## 3. Planned Customer Portal — direct customers

**User and job:** a verified direct customer starts an available service, follows authorized
business progress, responds to requests, uploads material to the owning workflow, and manages
their identity and Workspace customer relationship.

The Portal is a renderer of the same Workspace-owned customer relationship used by web, H5, and
the mini-program. It must not create a second Customer, Order, Matter, payment, or official-status
truth. The Site V1 Preview shows only a labelled read projection; the following IA is TARGET design.

| Previous/planning term        | New zh-CN / en-US       | Role                | Page and contents                                                                        | Why                                                                                 |
| ----------------------------- | ----------------------- | ------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Customer Portal home          | 首页 / Home             | Verified customer   | Next task, active business, unread message, recent progress                              | Gives high-frequency work priority instead of a product dashboard.                  |
| Products / service catalogue  | 办业务 / Start          | Verified customer   | Available Workspace services and governed intake entry                                   | Task language; does not claim an Order exists before owner confirmation.            |
| Orders / Matters / Cases      | 进度 / Progress         | Authorized customer | Unified authorized list with type-specific owner reference and status provenance         | Customers want “where is it now?”; underlying objects stay distinct.                |
| Communications                | 消息 / Messages         | Authorized customer | Workspace conversations, information requests and notices                                | Familiar label; no internal communication-system terminology.                       |
| Account / customer management | 我的 / My account       | Verified customer   | Profile, account & security, business identity, my services, my documents                | Familiar home for low-frequency personal and identity settings.                     |
| Document management           | 我的资料 / My documents | Authorized customer | Upload request, file provenance, review state; reachable from the relevant task and 我的 | Uploads stay attached to the owning request/matter, not a detached Site file store. |

Mini-program primary navigation is **首页、办业务、进度、消息、我的** with touch targets of at
least 44px. Active orders/matters and required actions appear on 首页 and 进度; they are not buried
under 我的. Desktop/H5 may use a wider layout but preserves the same five task concepts.

## State and accessibility matrix

| State      | Admin                                                  | Front                                                                           | Planned Portal                                                             |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Loading    | Name the page or operation being loaded.               | Preserve header and identify content loading.                                   | Keep the active tab and name the owner data being loaded.                  |
| Empty      | Explain what to create or where inquiries will appear. | Omit disabled modules; show a truthful no-content page when directly previewed. | Distinguish no business, no messages, and no requested files.              |
| Error      | Retain drafts and offer retry.                         | Do not replace publication errors with a generic 404.                           | Preserve owner reference and provide retry/support path.                   |
| Permission | Viewer controls disabled with an explanation.          | Hidden/unpublished routes remain unavailable.                                   | Show only Workspace-authorized customer data; never treat denial as empty. |
| Partial    | Name missing metric or unavailable owner evidence.     | Mark unverified asset and service facts.                                        | Show source and last-known time; never infer official status.              |
| Success    | Confirm exact draft/version/language or inquiry ID.    | Confirm inquiry reference without implying order or engagement.                 | Confirm owner-accepted action, not merely UI submission.                   |

All navigation is semantic, keyboard reachable, visibly focused, and labelled for screen readers.
Mobile drawers close after navigation and retain the current page, locale, and Workspace context.

## Task-based usability acceptance

Give participants only the starting surface and task; do not explain the navigation.

1. **装修首页:** from Admin 概况, change the homepage headline, preview the draft, and stop before publication.
2. **发布文章:** find an article, identify its language/review state, and publish the reviewed snapshot.
3. **查看咨询:** open the newest visitor inquiry and identify its source without using 数据.
4. **办理商标申请 (planned Portal):** from customer 首页, find 办业务 and reach the trademark-application intake; no order is implied before governed confirmation.
5. **查询申请进度 (planned Portal):** find the relevant business under 进度 and identify status source and last update.
6. **上传资料 (planned Portal):** enter from a requested action or business detail, upload to that owner context, and see review state.
7. **小程序进入我的 (planned Portal):** use the bottom navigation to reach profile, account/security, business identity, my services, and my documents.

Acceptance requires the first correct destination without documentation, route guessing, or using
browser search. Verify zh-CN and en-US at desktop and 390px. For planned Portal tasks, validate a
touch prototype before implementation; do not claim production identity or workflow integration.
