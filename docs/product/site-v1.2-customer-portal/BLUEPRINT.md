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

## Information architecture

1. **Authentication and relationship gate:** sign in/register, trusted invitation or relationship claim, select Workspace relationship, optionally select enterprise representation.
2. **Overview and tasks:** answers “what needs my attention?” with exact object IDs and owner-labelled status.
3. **My business:** list/detail projection of authorized matters with stage, next step, jurisdiction, and responsible service team.
4. **Trademark assets:** portfolio projection with official-source freshness warnings.
5. **Quotes and orders:** commercial object lineage; payment state is separate from performance/completion.
6. **Documents and files:** requested items, provenance and controlled submission.
7. **Messages:** object-linked notifications without treating delivery as acceptance.
8. **Account and company members:** login subject, relationship bindings, enterprise members, grants, language, security, and logout.

Desktop uses a persistent side rail, compact top context bar, two-column task/dashboard composition, and detailed data tables. At phone/mini widths, relationship context stays in the header, primary destinations move to a bottom tab bar, secondary sections use a More sheet, tables become labelled cards, and the primary task action remains thumb-reachable.

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
