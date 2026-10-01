# Workspace Console V2 — joint review and Decision Record

Status: `PROPOSED_FOR_INDEPENDENT_REVIEW`

Task ID: `MO-WORKSPACE-CONSOLE-V2-DR`

Audited base: `origin/main@e44470ea8bf08faf8a2be9ac8c7b513317a45ea9`

V1 Blueprint reference: PR #1442 at `bbe2df0ac310e2c2a431c3a6e357994f28774fbc`

Expected PR title: `feat(workspace): add Workspace Console V2 commercial review preview`

This record approves a reviewable product and interaction proposal. It does not add a production
route, persist a Workspace purchase, initiate payment, issue an invoice, hold funds, settle a
commission or grant production Site access.

## 1. Task frame

- Repository: `yoomarks/markorbit`.
- Allowed directories: this record, `docs/ui/workspace-console-v2`, and the isolated
  `apps/workspace-console-v2-preview`.
- User and job: an institution owner needs one place to buy and operate products, assign bounded
  access, and inspect institution money records without losing the identity or authority of the
  system that owns each fact.
- User-visible outcome: a Chinese-first, fully bilingual, desktop-first and 390 px review preview
  for institution overview, product comparison and activation, multi-Site management, team access,
  five financial lanes, transaction detail, collecting entities and guided operations.
- Canonical sources: repository `AGENTS.md`, Books 01–07 and current owner contracts, Workspace
  #1241, Agency Workspace #1093, Sites #1234, V1 Blueprint PR #1442 and their merged implementations.
- Contracts consumed: Core Identity/Auth and Workspace Commercial, Payment, Site, MarkReg
  Commercial/Order/Customer Context, Lite Workspace Directory/Trademark Asset/partner referral,
  Knowledge and current permissions. This review changes no contract.
- State transitions: preview-only state is local and resets on refresh. Production transitions are
  owner commands with current authority and idempotency.
- Events: none emitted or consumed by the preview.
- Acceptance: required happy path, five named negative paths, bilingual browser screenshots,
  390 px regression, keyboard/accessibility review and source-backed assertions.
- Non-goals: production funds integration, generic wallet, stored balance, cross-owner database,
  invoice issuance, commission settlement, cross-workspace employment, Cordis admin or merge.

## 2. Fresh-main audit and owner map

| Object / truth                                                       | Current owner                                                                         | Console use and boundary                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace, Membership, Principal, coarse permissions and currentness | Core Identity/Auth                                                                    | Establish acting Workspace and authorize every command. A plan or payment never creates Membership.                                                                                                                         |
| Workspace Profile, legal entity and agency-name binding              | Missing production owner on audited main; V1 decision proposes bounded Core extension | Preview only. Brand, agency name and legal entity remain distinct.                                                                                                                                                          |
| Published product offer and exact price version                      | Core Workspace Commercial                                                             | Read `CommercialOfferVersionV1`; no hard-coded production price. Subject scope distinguishes employee personal Lite from Workspace purchases.                                                                               |
| Commercial agreement                                                 | Core Workspace Commercial                                                             | `PENDING / ACTIVE / SUSPENDED / EXPIRED / CANCELLED`; not inferred from payment.                                                                                                                                            |
| Entitlement and assignable seat                                      | Core Workspace Commercial                                                             | Resolve current grants and assignments. Product access is not automatically granted to all members.                                                                                                                         |
| Product installation                                                 | Core Workspace Commercial                                                             | `ACTIVE / SUSPENDED / DECOMMISSIONED`; separate from agreement, grant and payment.                                                                                                                                          |
| Site instance/configuration/host/runtime                             | Site                                                                                  | Create/list exact Workspace-owned Sites, then deep-link to one Site Admin. Site config carries `merchantOwnerRef` but explicitly has `paymentAuthorized: false`.                                                            |
| MarkReg checkout/order                                               | MarkReg                                                                               | Current contracts sell exact MarkReg services. They are not a reusable Workspace subscription order without an approved extension.                                                                                          |
| Payment, attempts, refunds and provider reconciliation               | Payment                                                                               | Current payment statuses are `PENDING / REQUIRES_ACTION / PROCESSING / SUCCEEDED / FAILED / CANCELLED`; refund and reconciliation remain owner facts. Payment success has no order/agreement/install authority consequence. |
| Provider `requires_capture`                                          | Stripe adapter → Payment `PROCESSING`                                                 | Current contract has no distinct `PREAUTHORIZED` state and no capture/release command. The UI must not claim funds are frozen or preauthorized.                                                                             |
| Customer receivable and actual receipt                               | Relevant business owner                                                               | No general institution receivable owner was found. Render only owner-returned records; never manufacture a Workspace cashbook.                                                                                              |
| Provider/partner payable                                             | Relevant delivery/commercial owner                                                    | No general institution payable owner was found. Require exact order/business and payer/payee references.                                                                                                                    |
| Commission policy                                                    | Core rate policy                                                                      | Fee/commission calculation rule only, not settlement.                                                                                                                                                                       |
| Commission eligibility                                               | Lite partner referral                                                                 | Candidate only. Contract freezes `commissionAmountCalculated`, `paymentSuccessClaimed`, `settlementClaimed` and `payoutCompleted` to `false`.                                                                               |
| Settlement/payout                                                    | No general owner found                                                                | Not shown as completed or available balance. Requires a separately approved owner contract.                                                                                                                                 |
| Invoice                                                              | No general invoice owner found                                                        | The console may show an exact external/owner document reference; it must not issue or synthesize an invoice.                                                                                                                |
| Customer/asset/work/knowledge resources                              | Their existing MarkReg/Lite/Knowledge owners                                          | Directory and deep links only; no duplicate store.                                                                                                                                                                          |

### Open PR and file-lock audit

Bootstrap observed three open PRs: #1440 owns Site preview plus workspace topology/lockfile, #1441
owns Customer Portal preview, and #1442 owns Workspace V1 preview and V1 docs. V2 therefore uses
only new V2 paths, adds no dependency, and does not register a production app or modify shared
workspace files.

## 3. REUSE / EXTEND / NEW MINIMUM / DO NOT CREATE

| Decision      | Scope                                                                                                                                                 | Reason                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REUSE         | Core Workspace/Membership/Principal/current authority                                                                                                 | Existing institutional and coarse permission boundary.                                                                                                                                |
| REUSE         | Workspace Commercial offers, agreements, grants, assignable benefits, assignments, installations and rate policies                                    | Existing commercial separation is the canonical basis.                                                                                                                                |
| REUSE         | Payment attempts/refunds/reconciliation and provider evidence                                                                                         | Existing payment truth; never reinterpret provider return as wider authority.                                                                                                         |
| REUSE         | Site installation/configuration/runtime and Site Admin                                                                                                | Console manages inventory and handoff; Site Admin owns an instance.                                                                                                                   |
| REUSE         | Existing customer, directory, trademark, work, knowledge and partner-referral owners                                                                  | Finance/resource projections retain exact owner references.                                                                                                                           |
| EXTEND        | Bounded Workspace subscription checkout/order orchestration                                                                                           | MarkReg service checkout/order is not a Workspace subscription order. The extension must snapshot offer version, purchasing subject, payer, invoice preference and source references. |
| EXTEND        | Workspace Commercial member-facing command surface                                                                                                    | Existing Gateway surface reads installations/entitlements only. Approved commands need current authority, idempotency and payment/agreement/install separation.                       |
| EXTEND        | Owner-local list/read projections for financial lanes                                                                                                 | Compose owner APIs at the Gateway; no cross-service SQL and no Console financial database.                                                                                            |
| EXTEND        | Workspace Profile + Agency Identity Binding from V1 decision                                                                                          | Required for payer, collecting entity, contract and invoice identity.                                                                                                                 |
| NEW MINIMUM   | Collection Authority Reference: legal entity, payment-provider account reference, channels/currencies, verified status/evidence/effective window      | `merchantOwnerRef` is an exact Site reference, not a self-service merchant-account owner. Legal/compliance review is required before implementation.                                  |
| NEW MINIMUM   | Financial record projection schema: owner ref, order/business ref, payer/payee, exact money, channel, owner status, evidence source and observed time | A projection contract can unify display without becoming a ledger. Each source owner remains authoritative.                                                                           |
| NEW MINIMUM   | Settlement owner only if a real approved business flow requires it                                                                                    | Must define legal funds holder, provider, beneficiary, calculation snapshot, settlement lifecycle, reconciliation, permissions and compliance. Not part of this implementation.       |
| DO NOT CREATE | Generic MO wallet, top-up/transfer/withdraw, simulated frozen balance, shadow ledger                                                                  | No present owner, provider or legal/compliance basis.                                                                                                                                 |
| DO NOT CREATE | Second institution identity/IAM/customer/asset/product entitlement/payment/Site system                                                                | Existing owners already exist.                                                                                                                                                        |
| DO NOT CREATE | Automatic payment→agreement→installation→all-member access shortcut                                                                                   | These are different facts and authorities.                                                                                                                                            |
| DO NOT CREATE | Generic Cordis management console                                                                                                                     | Outside scope; guidance can appear contextually in pages and workflows.                                                                                                               |

## 4. Three-director review

### Product Director

Proposal: navigation becomes `首页 / 资源 / 产品 / 团队 / 财务 / 机构设置` and
`Overview / Resources / Products / Team / Finance / Organization`. “财务” is wider than V1
“费用” but its landing page is five explicitly separate lanes, not a wallet. Product management
starts with the purchasing subject: Workspace purchase and employee personal Lite purchase have
different payer, agreement subject, renewal owner and seat consequences.

Identified issues:

1. “已付款”和“已开通” collapse at least five states and will create support and authority errors.
2. A single balance would combine MO expense, customer receipt and partner liability into a false
   economic claim.
3. A Site allowance does not create a Site; an active Site does not grant every employee access.
4. Discounts need an eligibility result with reason and policy version, not a crossed-out price.
5. Renewal expiry needs a product-specific policy; it cannot silently delete Sites or resources.

### Design Director

Proposal: use a quiet operational system with evidence-forward labels. Product cards show the
commercial chain. Finance uses colored lanes and owner provenance, never a large “available
balance”. Dense desktop tables become labeled stacked rows at 390 px. All consequential dialogs
repeat acting legal entity, affected product/resource, amount/authority, and source.

Identified issues:

1. Price cards without purchaser identity obscure whether the institution or employee pays.
2. Green status alone cannot distinguish payment, agreement, entitlement, install and assignment.
3. Transaction detail must put payer/payee before decorative metadata.
4. “预授权” is dangerous when the provider adapter only exposes `PROCESSING`.
5. Chat text must not look like a successful payment, verification or authorization event.

### Technical Director

Proposal: production should add a read-only Workspace Console composition at the Gateway and send
each mutation to the exact owner. A Workspace purchase orchestration records an exact offer and
purchaser intent, invokes Payment through a trusted UI, then reacts to authoritative results; it
does not transact across service databases. Agreement activation, grant materialization,
installation, Site creation and member assignment remain separate idempotent steps with recovery.

Identified issues:

1. Current public Workspace Commercial routes are read-only; exposing internal record methods is
   not acceptable self-service design.
2. Current Payment Gateway permissions are `order:update`/`order:read`, aligned to current order
   flows rather than an approved Workspace subscription permission model.
3. Stripe `requires_capture` loses its distinct meaning when normalized to `PROCESSING`; capture,
   cancel and evidence contracts are required before any held-funds UI.
4. Site `merchantOwnerRef` must resolve to current verified collection authority; brand config has
   zero payment-authority consequences.
5. Aggregate partial/unavailable results must stay partial/unavailable, never become zero.

## 5. Cross-review decisions

| Challenge                                                  | Decision                                                                                                                                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Should “费用” remain the navigation label?                 | No. Use `财务 / Finance` because the surface includes expense, receivable, payable, commission and evidence; preserve the five lanes inside it.                                                                         |
| Is there a wallet?                                         | No in V2. There is no generic top-up, transfer, withdrawal or available balance.                                                                                                                                        |
| Can `SUCCEEDED` payment activate everything?               | No. Show and recover payment, agreement, entitlement, installation, Site instance and member assignment independently.                                                                                                  |
| Can a published offer price be cached in UI?               | Only as an exact versioned response for confirmation. Revalidate immediately before payment; the preview price is explicitly a fixture.                                                                                 |
| Who pays for Lite?                                         | Workspace team Lite has a Workspace subject/payer and assignable seats. Personal Lite has a USER subject and employee payer; it never consumes an institution seat unless explicitly converted by the commercial owner. |
| Can one Workspace bind multiple collection entities?       | It can reference them, but each legal entity has independent verification, merchant reference, contract, invoice and funds ownership.                                                                                   |
| Can changing a Site brand switch its collection authority? | No. `brand` and `merchantOwnerRef` are distinct, and Site config grants no payment authority.                                                                                                                           |
| Can chat execute payment or authorization?                 | No. Page supplies context; chat gathers bounded information; a structured confirmation card is generated; a trusted owner control executes; the owner result is rendered.                                               |
| What happens on expired renewal?                           | Agreement/entitlement/install owner states are displayed exactly. Access fails closed according to the approved product policy; data is not silently deleted.                                                           |
| What does a commission candidate mean?                     | Eligible for human/owner review only; no amount, payable, settlement or payout is claimed.                                                                                                                              |

## 6. Information architecture

```text
Workspace Console
├── 首页 / Overview
│   ├── acting Workspace + legal entity
│   ├── owner decisions
│   ├── product availability chain
│   └── five financial lanes (no combined balance)
├── 资源 / Resources
│   └── customer · trademark · opportunity/work · knowledge owner directories
├── 产品 / Products
│   ├── plans and exact price/offer version
│   ├── purchase subject and payer
│   ├── agreement · entitlement · install · seat/usage · renewal
│   ├── 我的 Site / My Sites
│   └── Site Admin handoff
├── 团队 / Team
│   ├── Membership
│   ├── product seats
│   ├── Site administration permission
│   └── resource scope · actions · expiry
├── 财务 / Finance
│   ├── MO 订阅 / MO subscriptions
│   ├── 业务收款 / Client receipts
│   ├── 合作方付款 / Partner payments
│   ├── 佣金结算 / Commission & settlement
│   ├── 对账与票据 / Reconciliation & documents
│   └── 收款配置 / Collection configuration
└── 机构设置 / Organization
    ├── Workspace profile
    ├── brand
    ├── agency identity bindings
    ├── legal entities
    └── guided setup
```

## 7. Permissions and financial authority

| Action                                                      | Required authority                                       | Additional current proof                                                    | Failure behavior                                            |
| ----------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| View product status                                         | active Membership + `workspace:read`                     | current owner reads                                                         | Show source partial/unavailable, not false “not purchased”. |
| Purchase Workspace product                                  | Owner + approved commercial purchase permission          | exact published offer, purchaser/payer legal entity, trusted Payment action | No agreement/install claim on payment failure.              |
| Assign product seat                                         | Owner/team manager with commercial assignment permission | active assignable grant, capacity, active target Membership                 | Deny on expired/revoked grant or inactive member.           |
| Create Site                                                 | Owner or delegated Site creator                          | active SITE install + current quantity entitlement                          | No Site if entitlement absent or exhausted.                 |
| Assign Site manager                                         | Owner/team manager                                       | active Membership + bounded Site scope + action set + validity              | Deny other Sites and old links after revocation.            |
| View MO subscription bill                                   | Owner/finance permission                                 | exact Workspace-scoped Payment/commercial refs                              | Employee personal purchase is not institution bill.         |
| View business receipt/payable                               | owner-specific finance permission                        | exact business/order relationship and entity scope                          | Never grant access because user can view MO bills.          |
| Change collection configuration                             | Owner + collection authority permission                  | verified legal entity and merchant reference currentness                    | Block entity mismatch; brand cannot override.               |
| Refund                                                      | owner-specific refund permission                         | successful payment, remaining refundable amount, provider evidence          | Preserve pending/failed refund states.                      |
| Execute protected payment/verification/member authorization | corresponding owner permission                           | current structured control, challenge/review evidence                       | Chat message alone has no effect.                           |

## 8. Purchase-to-Site state model

```text
select published offer
  → validate discount and purchasing subject
  → structured confirmation of payer, exact price and renewal
  → Payment PENDING / REQUIRES_ACTION / PROCESSING / SUCCEEDED / FAILED / CANCELLED
  → Commercial Agreement PENDING / ACTIVE / ...
  → Entitlement Grant PENDING / ACTIVE / ...
  → Product Installation ACTIVE / SUSPENDED / DECOMMISSIONED
  → create Site 1 + Site 2 under current capacity
  → assign manager to exact Site scope
  → inspect owner-backed bill/evidence
  → authorized handoff to selected Site Admin
```

Every arrow is resumable and independently visible. Compensation never rewrites owner history.

## 9. Conversational operation contract

1. A structured page supplies task, Workspace, legal entity and object context.
2. Conversation asks only for missing, non-secret information.
3. The assistant generates a structured confirmation card with exact effects and owner sources.
4. Owner uses trusted controls for OTP, identity verification, payment confirmation and access grant.
5. The UI renders the authoritative owner result, including pending/failure and recovery.

Conversation may prepare a command; it does not itself become identity, payment or authorization
evidence. No chat transcript is treated as consent to a protected action.

## 10. Required UI states and negative acceptance

Every major surface covers loading, empty, source error, permission denial, partial data and
success. Consequential flows add validation, confirmation, retryable/non-retryable error,
idempotent replay and persistent result feedback.

| Case                                | Expected result                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Discount not applicable             | Keep exact base offer price and show owner reason/policy; purchase can continue without fake discount.              |
| Payment failed                      | Payment `FAILED`; agreement/entitlement/install remain unclaimed; retry uses a fresh approved attempt.              |
| Renewal expired                     | Show agreement/grant expiry separately; fail closed for new use; retain history and follow product recovery policy. |
| Collecting entity mismatch          | Block save/payment; identify Site merchant ref and legal entity mismatch; changing brand does not bypass.           |
| Member lacks permission             | 403-style denial with requested Workspace/Site/resource scope; do not reveal other customer data.                   |
| Provider preauthorization requested | Until a reviewed contract exists, show `PROCESSING` and provider reference only; never “funds held”.                |

## 11. Wallet / internal ledger verdict

`DO NOT IMPLEMENT` in this review.

A future proposal is admissible only when a real flow needs stored or controlled funds and names:

- legal funds holder and customer-money treatment;
- regulated payment/escrow provider and supported markets;
- authorization, capture, release, refund, chargeback and settlement responsibility;
- double-entry or provider-led ledger owner and reconciliation source;
- payer/payee/beneficiary identity, currency and segregation rules;
- access, maker-checker approval, audit retention and incident obligations;
- tax, invoice, AML/KYC, safeguarding and jurisdictional compliance dependencies.

It must be an independent Decision Record and cannot be smuggled in as a “balance” card.

## 12. Decision

The three directors approve this proposal for independent design review and fixture-based browser
validation only. Production implementation remains blocked on explicit product/architecture
approval of Workspace Profile/Agency Identity Binding (from V1), Workspace subscription purchase
orchestration, Collection Authority Reference, resource-scoped access, and any missing business
finance/settlement owner contracts.

The UI Designer is authorized to deliver the independent bilingual preview and evidence under the
V2-only paths. No production database, real payment provider, formal product entry or shared file is
changed. Merge requires an independent reviewer after the evidence is complete.
