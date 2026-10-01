# MarkOrbit Site V1.2 Customer Portal Blueprint

## Outcome and authority boundary

Site V1.2 adds a customer-facing projection, not a new owner. A verified platform login subject may select one authorized Workspace Customer Relationship and, when separately granted, one enterprise representation. Every read is evaluated against the full tuple:

```text
authenticated subject
  + exact Workspace
  + exact Customer Relationship
  + optional enterprise representation grant
  + business-object authorization
  -> bounded Customer Portal projection
```

URL IDs, brand, channel, matching names/phones, referral lineage, payment, or provider returns cannot replace any element of that tuple. Web, H5, and mini-program adapters render the same owner-backed IDs and state; channels do not own Customer, Quote, Order, Matter, Payment, file, message, or trademark truth.

This deliverable is a standalone fixture preview built on the Site V1 Blueprint in PR #1440. It intentionally does not import or modify PR #1440 code. The preview stores clearly labelled Demo state in browser `localStorage`. Sharing that state between its Web and mini-program-adapted routes proves interaction continuity only; it is not evidence of cross-device login, account federation, server persistence, native WeChat identity, or real mini-program acceptance.

## Users and jobs-to-be-done

| Actor                        | Job                                                               | Admission rule                                                                |
| ---------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Visitor                      | ask a first question and retain a reference                       | explicit consent creates a lead only; no Customer Relationship or case access |
| Platform login subject       | authenticate once and choose an authorized Workspace relationship | login verification is necessary but not sufficient for object access          |
| Individual customer          | continue their own authorized business on Web or mini view        | exact subject + Workspace + relationship + object grant                       |
| Enterprise member            | act for a company within granted scope                            | verified membership/representation plus per-object scope                      |
| Agency member                | operate through internal professional surfaces                    | not a Customer Portal identity by implication                                 |
| Workspace relationship owner | invite/verify a claimant and govern customer relationship         | Site brand or acquisition source cannot choose this owner                     |

## Object model

```text
PlatformAccount 1--* VerifiedLoginCredential
PlatformAccount *--* WorkspaceCustomerRelationship (through verified binding)
WorkspaceCustomerRelationship *--1 Workspace
WorkspaceCustomerRelationship 0..1--1 IndividualCustomer
WorkspaceCustomerRelationship 0..1--1 EnterpriseCustomer
EnterpriseCustomer 1--* EnterpriseMembership
EnterpriseMembership 1--* RepresentationGrant
WorkspaceCustomerRelationship 1--* ObjectGrant
ObjectGrant *--1 Quote | Order | Matter | TrademarkAsset | Document | MessageThread
SiteChannelProjection --renders--> the same authorized object IDs
VisitorInquiry --remains--> LeadOnly until the relationship owner verifies/promoates it
```

The platform account is reusable across Workspaces; the relationship and every object grant are Workspace-scoped. A natural person may have multiple unrelated relationships. An enterprise membership does not imply every enterprise object is visible.

## Owner and production dependency map

| Concern                            | Owner / required seam                                                                 | Preview treatment                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| login subject, credential, session | Core Auth / Gateway trusted principal                                                 | local verified Demo identity only                       |
| Workspace and member authority     | Core Workspace / Directory                                                            | exact fixture refs; no mutation                         |
| Customer Relationship              | MarkReg current relationship owner (future generic owner contract if product decides) | exact Workspace-scoped fixture; no second store claimed |
| Customer Context                   | Customer Context composition contract                                                 | bounded display projection                              |
| quote/order/matter                 | MarkReg owners                                                                        | immutable Demo refs and statuses                        |
| trademark assets / official facts  | owning registry/MarkReg projection                                                    | labelled projection; no Official Truth created          |
| files                              | document/package owner plus artifact authorization                                    | simulated upload completes one Demo task                |
| messages                           | Communication owner                                                                   | Demo notification projection only                       |
| Site/channel                       | Site runtime + renderer adapter                                                       | Web/mini presentation only                              |
| WeChat identity                    | future supported official credential adapter and verified account linking             | explicitly absent; “bound Demo identity” only           |

## Direct-customer information architecture

The portal vocabulary is customer-owned language. `Workspace`, `Customer Relationship`, `Matter`, `Intake`, lifecycle codes, and service projections remain implementation concepts and may appear only in bounded provenance/help details when necessary. The persistent header instead says which **service institution** and **customer/company identity** are active.

### Navigation freeze

| Surface                             | Primary navigation                       | Why                                                                                                                                      |
| ----------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop Web                         | 首页 · 我的业务 · 我的商标 · 消息 · 我的 | Five familiar destinations; quotes, orders, progress, files, and invoices are grouped by the customer task instead of owner object type. |
| Mobile Web / H5                     | 首页 · 办业务 · 进度 · 消息 · 我的       | Thumb-reachable and task-led; mirrors the mini-program mental model while retaining Web session truth.                                   |
| WeChat mini-program-adapted preview | 首页 · 办业务 · 进度 · 消息 · 我的       | Short labels and 44px touch targets. This is a renderer arrangement, not a mini-program business store.                                  |

### Old-to-new vocabulary

| Previous preview label      | Final customer label   | Placement / rule                                                                        |
| --------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| 总览与待办                  | 首页                   | The page itself does not repeat “客户中心”.                                             |
| 我的业务                    | 我的业务 / 进度        | Desktop / mobile label; groups in progress, awaiting me, and completed.                 |
| 商标资产                    | 我的商标               | Uses “商标档案” and official-source freshness in detail.                                |
| 报价与订单                  | No primary destination | Quote confirmation is a Home task; history sits under 我的业务 or 我的.                 |
| 资料与文件                  | No primary destination | Required upload is a Home/message action; all files sit under 我的.                     |
| 消息通知                    | 消息                   | Object-linked notices and confirmations.                                                |
| 账号与企业成员              | 我的                   | Personal details, security, companies, members, files, invoices, preferences, and help. |
| Customer Relationship       | 服务机构与办理身份     | The internal relationship ID stays in a technical detail only.                          |
| Action Required             | 待我处理               | Always says what action is required and for which business.                             |
| Matter / Application Status | 业务 / 办理进度        | Formal legal procedure name remains in the detail explanation.                          |

### Page hierarchy

1. **Authentication and identity gate:** register/sign in, trusted invitation or existing-customer claim, choose a service institution and customer/company identity. The UI never asks a customer to choose a Workspace or Customer Relationship.
2. **首页:** answers only “我正在办理什么、现在需要我做什么、哪里看进度/联系服务人员?” The first block is `待我处理`; then `正在办理`; then common actions and service contact. It has no traffic, decorative KPI, or raw status-code dashboard.
3. **办业务 (mobile/H5):** customer-readable service catalogue plus “继续办理” entries. Catalogue visibility is not a quote or provider-availability guarantee.
4. **我的业务 / 进度:** `待我处理 / 办理中 / 已完成` list and object detail. Quote, order, matter, official procedure, documents, and messages are related sections of one customer business, not separate top-level products.
5. **我的商标 (desktop):** authorized portfolio with plain-language status and owner-source timestamp. Mobile reaches it from Home and 我的.
6. **消息:** material requirements, quote notices, business updates, and confirmation requests. Each actionable message deep-links to the exact same object and action used by Home.
7. **我的:** profile/security, active institution and company identity, other authorized identities, company members, preferences, files, invoices, and help. It is grouped, not a miscellaneous feature dump.

Desktop uses a persistent five-item side rail, compact institution/identity context bar, and high-density business detail. Mobile Web and mini-program use the same five-item task model with a bottom bar, labelled cards instead of tables, and thumb-reachable actions. They share IDs and authorization but need not share pixel-identical layouts.

## Home task model

Home prioritizes exact actionable records, in this order:

1. requested document with due date/source and `提交资料`;
2. pending quote with fee breakdown/service scope and `确认报价` / `有疑问`;
3. payment task only when Payment owner truth exists (fixture not active in this preview);
4. important official deadline with source/currentness;
5. in-progress business summaries and service-team contact.

An empty task state says `目前没有需要你处理的事项`, then offers `查看办理进度` and `发起新申请`. A formal stage is paired with a plain-language phrase—for example `收到审查意见，等待处理`, with `正式程序：Office Action / 审查意见通知书` and the exact official deadline in detail. Estimated service time is labelled as an estimate and never presented as an official deadline.

## End-to-end journeys

### First consultation

`VISITOR -> consented inquiry -> LEAD_ONLY`. Confirmation states plainly that no customer relationship, order, matter, or portal access exists. Name/phone equality never triggers a merge.

### Registration, login, and relationship selection

`credential verification -> platform subject -> authorized bindings list -> relationship selection`. Different domains/channels may run distinct session exchanges; browser cookies are not assumed portable. Mini-program Demo login is a pre-bound fixture, not WeChat login.

### Claim an existing relationship

`verified login -> claim code/institution invitation -> relationship-owner verification -> binding`. A wrong code or mismatched scope is rejected without revealing whether a sensitive object exists. Phone/name similarity is only review evidence.

### Represent an enterprise

`platform subject -> verified enterprise membership -> active representation grant -> permitted objects`. Expired/revoked membership and objects outside the grant fail closed.

### Cross-channel continuation

`Web exact object -> submit Demo document -> mini view reads same object ID/state -> mini completes remaining task -> Web reads same state`. Production requires a server session/owner API; this preview shares browser-local Demo state only.

### Quote review

`quote notice/home task -> exact Quote fixture -> fee lines + currency + service scope + exclusions -> CONFIRM_DEMO | QUESTION_SENT_DEMO`. Confirmation updates the same quote object and related business activity. Asking a question creates a local Demo communication state, not acceptance. A displayed price is not a final governed Quote unless it is the exact Quote owner projection.

### Logout

`active session -> logout -> sensitive projection unavailable`. Back/direct navigation returns to the authentication gate; local Demo business fixtures remain but cannot render without an authorized session.

## Permission matrix

| Subject/context   |         Own individual objects | Other customer, same Workspace |   Same person, other Workspace | Enterprise granted objects | Enterprise ungranted objects |        Lead-only inquiry |
| ----------------- | -----------------------------: | -----------------------------: | -----------------------------: | -------------------------: | ---------------------------: | -----------------------: |
| visitor           |                           deny |                           deny |                           deny |                       deny |                         deny | create/read receipt only |
| bound individual  |                          allow |                           deny | deny until relationship switch |                       deny |                         deny |         own receipt only |
| enterprise member | deny unless separately granted |                           deny |                           deny |                      allow |                         deny |         own receipt only |
| agency member     | no Portal access by role alone |                           deny |                           deny |                       deny |                         deny |                      n/a |

Server enforcement must derive the platform subject from the trusted session and independently load the Workspace relationship and object grant. Client-supplied `workspaceId`, `customerId`, `orderId`, matter number, or representation ID is never authority.

## State matrix

| State                   | Truthful presentation and recovery                                           |
| ----------------------- | ---------------------------------------------------------------------------- |
| loading                 | named skeleton while session and grants are checked                          |
| empty                   | no authorized object, with explanation; not a hidden permission error        |
| error                   | owner unavailable with retry; never converted to empty/success               |
| authentication required | no sensitive shell/content; login action                                     |
| permission denied       | generic denial without existence disclosure; relationship switch/back action |
| partial data            | visible source/currentness warning and unavailable fields                    |
| success                 | exact Workspace, relationship, representation and object refs                |
| rejected claim          | no relationship/object disclosure; invitation/support recovery               |
| expired representation  | enterprise context removed and protected objects hidden                      |

## Localization and accessibility

Simplified Chinese is default; English covers every preview route and state. Locale changes only interface labels and authored localized display content. User-entered names/messages, official files, amounts, IDs, object status, provenance, and business transitions are unchanged. The UI uses landmarks, one `h1`, labelled inputs, real buttons, keyboard-visible focus, status text beyond color, live announcements, responsive text growth, and a 44px minimum touch target in the mini view.

## Golden Path acceptance

1. Sign in on Web as the bound Demo subject and open exact Atlas relationship objects.
2. Switch to the mini-program-adapted view using the same bound Demo identity; observe the same Workspace, relationship, matter/order/task IDs.
3. Submit the requested document and complete a task in mini view; return to Web and see the same object updated.
4. Prove fail-closed boundaries for the same person in another Workspace, another customer in Atlas, and an enterprise member without a grant.
5. Prove lead-only consultation, rejected relationship claim, logout protection, and locale-neutral state/IDs.

## Production integration dependencies

- trusted Core Auth session exchange for every domain/channel;
- explicit verified credential-linking and future official WeChat adapter (no openid/unionid inference);
- Customer Relationship binding/invitation/claim contract owned by the relationship owner;
- object-grant projection covering MarkReg Quote/Order/Matter, documents, assets, and messages;
- enterprise membership and representation-grant owner with revocation/currentness;
- server-side read models scoped by subject + Workspace + relationship + object grant;
- audited file upload and Communication owner seams;
- owner-backed locale projections that preserve original facts.

No production Auth refactor, new Customer owner, real payment, unreviewed WeChat binding, or protected action is part of V1.2 preview.

## Preview and responsive acceptance record

The runnable entry is `apps/markreg-web/customer-portal-preview.html`:

| Surface                      | Simplified Chinese                           | English                                                   |
| ---------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Desktop Web                  | `/customer-portal-preview.html`              | `/customer-portal-preview.html?locale=en-US`              |
| Mobile Web / H5 / 390px      | `/customer-portal-preview.html?channel=h5`   | `/customer-portal-preview.html?channel=h5&locale=en-US`   |
| Mini-program adapted / 390px | `/customer-portal-preview.html?channel=mini` | `/customer-portal-preview.html?channel=mini&locale=en-US` |

The preview was visually reviewed in the standalone browser at desktop width and in the constrained H5 and mini-program shells. The Playwright matrix runs every Golden Path at desktop and 390 × 844, checks exact quote/matter IDs, verifies document and quote state across Web → mini → Web, and asserts no horizontal overflow. All six URLs are presentation adapters over the same browser-local Demo fixture; they are not evidence of server persistence, native WeChat sign-in, or cross-device session exchange. H5 uses the mobile information architecture with MO account login truth; the mini-program adapter uses a separately labelled pre-bound Demo identity and does not claim native WeChat login.

## Mini-program product-level redesign

The mobile experience uses the established five-destination IA but no longer renders a compressed desktop portal. Its job is service continuity for an occasional, non-specialist customer: show what needs attention, make professional help feel available, and explain progress without weakening legal accuracy.

### Five complete destinations

| Destination | Product-level composition                                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 首页        | Branded welcome hero, active service-firm/identity control, one dominant next-action card, five quick services, active-business cards, dedicated-advisor card, service guides and MO assistant entry. |
| 办业务      | Search affordance, customer-language service categories, scenario-led service cards, advisor recommendation banner and exact existing-business continuation.                                          |
| 进度        | Active / awaiting me / completed summary and filters, branded business cards, plain-language status, Demo update time, next action, progress track and source-of-truth caveat.                        |
| 消息        | All / business progress / documents / advisor categories, Today / Earlier grouping, unread signals, advisor and system messages, and object-linked actions for the exact matter or quote.             |
| 我的        | Branded identity card, current service institution and acting identity, dedicated-advisor contact, business/files/trademarks/invoices/company group, account/support group and explicit sign-out.     |

### Mature patterns adopted

- A strong, useful first screen combines brand, identity context and the next required action instead of decorating a dashboard with KPIs.
- A stable service-entry grid makes frequent tasks recognizable by position, icon family and short customer-language labels.
- Operational content is bounded: service guides, FAQ links and an advisor banner create a maintained-service feeling without inventing offers, live availability or owner facts.
- Cards use a consistent anatomy—category, customer-facing title, fact line, source-safe status, next action and detail affordance—rather than unrelated white rectangles.
- The account area has the layered structure customers expect from a long-lived mini program: identity, provider, human support, owned records and security/help.
- The fixed bottom bar uses five touch targets, active icon containers and an active indicator; it behaves like a primary mobile product control rather than a demo switcher.

### Maturity delta from the previous preview

The previous mini view proved authorization and cross-channel continuity but visually resembled a narrow back-office page. The redesign adds a branded service shell, human/AI assistance, content and FAQ surfaces, service discovery, progressive status explanations, time-grouped messages, and a durable account hub. Density is higher but remains scannable through section rhythm, restrained color roles, a shared icon/tile system, consistent 44px-or-larger actions and a single dominant action per card.

These changes are presentation and fixture behavior only. “Advisor,” update times, guide content and assistant entry are labelled or bounded as Demo UI; they do not assert real staffing, SLA, official status, AI authority, native WeChat authentication or production persistence.

## V2 conversational application and payment extension

V2 keeps the five-destination customer IA and adds one resumable application workbench. Conversation is a guided clarification surface around structured fields, source-labelled file extraction, country/class selection, completeness checks, draft review, exact Quote review and controlled Payment handoff. It is never the authority for identity, company representation, professional approval, filing, merchant selection or funds.

The exact V2 decision, Owner matrix, coupon/payment state model, negative rules and production dependencies are recorded in `V2-DECISION-RECORD.md`.
