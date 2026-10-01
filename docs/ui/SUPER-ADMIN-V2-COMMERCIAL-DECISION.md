# Super Admin V2 commercial management decision record

- Task ID: `MO-SUPER-ADMIN-V2-COMMERCIAL-001`
- Repository and allowed directories: `apps/operations-console`, `tests/e2e`, `docs/ui`
- Users: authorized MO commercial administrators, finance-support operators, product managers and auditors
- Job to be done: define and inspect MO-owned offers, understand an exact historical price decision, and investigate owner payment truth without modifying customer-owned service prices
- Canonical sources: current contracts and owner services on `origin/main@e44470ea8`, issues `#1241`, `#1242`, `#1024`, `#968`, `#1003`, `#946`, and the Super Admin V2 Blueprint
- Contracts consumed: `commercial.ts`, `workspace-commercial.ts`, `payment.ts`, `order.ts`; no contract is changed
- Expected PR title: `feat(operations-console): productize Super Admin commercial management`

## Executive decision

Super Admin commercial management controls MO-owned product offers and explains owner financial records. It does not own a Workspace's professional-service prices, a Site merchant's final quote, MarkReg Order truth, Payment truth or accounting truth.

This task delivers a fixture-backed, bilingual product design and a truthful read-boundary map. It does not create Promotion or Coupon contracts, activate refund/payment commands, or infer a recurring subscription from historical orders.

The current **账单 / Billing** navigation is renamed **商业 / Commercial**. Existing routes stay valid. Additional secondary routes expose the missing commercial tasks without creating another top-level module:

1. 商业概览 `/billing/revenue`
2. 产品与 SKU `/billing/catalog`
3. 套餐与价格 `/billing/plans`
4. 营销活动 `/billing/promotions`
5. 优惠券 `/billing/coupons`
6. 套餐与权益 `/billing/agreements`
7. 订单 `/billing/orders`
8. 支付 `/billing/payments`
9. 发票 `/billing/invoices`
10. 用量 `/billing/usage`
11. 对账 `/billing/reconciliation`
12. 退款与争议 `/billing/disputes`
13. 商业审计 `/billing/audit`

## Three-director record

| Role               | Decision                                                                                                                                                                         | Rationale                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Product director   | Treat product/SKU, offer version, agreement/entitlement, order snapshot and payment lifecycle as separate objects.                                                               | A product configuration, a customer's commercial agreement and a financial event answer different questions. |
| Design director    | Use object list + detail, structured pricing forms, eligibility explainers, immutable price formula and audit timeline. No JSON editor, chat UI or decorative revenue dashboard. | Commercial operators need reproducible decisions and explicit risk, not generic KPIs.                        |
| Technical director | Reuse owner contracts and Gateway authority. Promotion/Coupon remain `DEPENDENCY_REQUIRED`; the preview is local Demo only.                                                      | No approved Promotion/Coupon owner, lifecycle, persistence, API or audit receipt currently exists.           |

## Current owner map

| Object / question                                             | Owner and current truth                                           | Availability to Super Admin                                                                               | Decision                                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| MO service Product/Price for the accepted MarkReg direct flow | MarkReg `CommercialProduct` + `CommercialPrice`                   | `commercial-admin:read` catalog read, active channel/relationship query                                   | Reuse as a bounded MarkReg catalog, not as the universal MO SKU registry.                                        |
| Workspace/User offer version                                  | Core `CommercialOfferVersionV1`                                   | Durable model and exact `commercial-admin:operate` record route; no approved global admin list projection | UI models versions truthfully in Demo; Real list remains not connected.                                          |
| Commercial Agreement                                          | Core `CommercialAgreementV1`                                      | Durable owner model; no global Super Admin read portfolio                                                 | Do not derive it from orders or payments.                                                                        |
| Product installation                                          | Core `WorkspaceProductInstallationV1`                             | Workspace-scoped read with `workspace:read`                                                               | Platform selection does not grant customer Workspace authority.                                                  |
| Entitlement                                                   | Core grant/resolve model                                          | Workspace/User-scoped resolution; no global grant portfolio                                               | Entitlement != permission and grant != protected-action authority.                                               |
| Rate Policy                                                   | Core `RatePolicyVersionV1`                                        | Exact operate route and bounded resolution for supported policy kinds                                     | Service/commission economics stay independent from product prices and discounts.                                 |
| Checkout, Order, Matter                                       | MarkReg                                                           | Workspace-scoped `commercial-admin:read` inspection                                                       | Order != Payment != Matter. No global client-side fan-out.                                                       |
| Payment lifecycle                                             | Payment                                                           | Exact Workspace + Payment ID inspection via `commercial-admin:read`                                       | Includes attempts, provider receipts, refunds and reconciliation observations. No list portfolio and no command. |
| Invoice / tax/accounting                                      | Not modeled as a canonical owner in the audited surface           | Not connected                                                                                             | Do not claim invoice issuance, tax calculation or ledger truth.                                                  |
| Promotion                                                     | No canonical contract/owner                                       | Not developed                                                                                             | Product and technical decision dependency required.                                                              |
| Coupon / redemption                                           | No canonical contract/owner                                       | Not developed                                                                                             | Product and technical decision dependency required.                                                              |
| Workspace current paid plan                                   | Not available as a bounded portfolio projection                   | Explicit `NOT_YET_MODELED` conclusion in `#968`                                                           | Never infer “paid” from prior order/payment.                                                                     |
| Institution service price sold through Site                   | Workspace/Site/MarkReg business flow, not MO offer administration | Outside this surface                                                                                      | MO offer changes never overwrite institution-owned service pricing or final Quote.                               |

## Commercial object relationship

```text
MO Product
  └─ SKU / Commercial Offer
       └─ immutable Offer Version
            ├─ currency + billing interval + market scope
            ├─ entitlement bundle refs
            └─ effective window

Proposed Promotion Version ─┐
Proposed Coupon Version ────┼─ eligibility decision + price calculation receipt
Tax / other fee owner ──────┘

Standard price
  → applicable promotion
  → coupon
  → tax and other owner fees
  → final confirmed price snapshot
       └─ exact product / offer / promotion / coupon versions retained by Order

Order snapshot ── references ── Checkout
Payment owner ─── references ── Checkout + Order, but does not prove performance
Agreement / Entitlement ─────── created or changed only by its owning workflow
```

Historical Order price snapshots are immutable. A later offer, promotion or coupon version cannot rewrite a confirmed order.

## Promotion and coupon dependency decision

Verdict: `DEPENDENCY_REQUIRED` before production implementation.

The repository supports `EntitlementGrant.sourceType = PROMOTION | TRIAL | MANUAL`, but that is not a Promotion campaign owner and does not define price discounts, coupon codes, redemption limits or refunds.

A future Product/Technical task must approve at least:

- `PromotionVersion`: ID/version, lifecycle, eligible products and offer versions, market/currency, time window, customer scope, discount calculation, stacking policy, cancellation/refund rule and audit lineage.
- `CouponVersion`: stable coupon identity plus code-secret handling, issue channel, eligible offer/promotion, subject limits, total capacity, redemption window, stacking and refund/reinstatement policy.
- `CouponRedemption`: exact coupon version, subject, order/checkout, idempotency, outcome/reason, amount snapshot, redeemed/reversed times and audit receipt.
- deterministic price-calculation receipt with ordered components and exact versions.

Recommended minimal lifecycle for review, not yet canonical:

`DRAFT → IN_REVIEW → APPROVED → SCHEDULED/PUBLISHED → PAUSED → EXPIRED/RETIRED`

- A creator may save a draft but cannot self-approve or directly publish.
- Publishing must recheck current offer versions, currency, market, time window, overlap/stacking rules, permissions and approval receipt.
- Pause stops future eligibility only; it does not rewrite historical redemptions.
- Expiry is time-derived and cannot be toggled back to published without a new version.

## Price calculation rule

The preview presents the order explicitly:

1. Standard price from one exact offer version.
2. At most one applicable campaign result unless an approved stacking rule says otherwise.
3. Coupon result evaluated against the post-campaign amount.
4. Tax and other fees supplied by their owners; unknown is not zero.
5. Final confirmed amount and every component version captured in an immutable snapshot.

No negative total is allowed. Currency conversion is not implicit. A coupon in another currency or market is ineligible, not converted by the UI.

## Permission matrix

The following is a UI/approval design proposal. It does not add capabilities to the repository.

| Task                                       | Current authority                                                                                | Proposed production split                                               | UI behavior now                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Read MarkReg catalog/order/payment detail  | `commercial-admin:read`                                                                          | Keep                                                                    | Real owner read where an exact route exists; otherwise not connected. |
| Record Core Offer/Rate Policy              | exact `commercial-admin:operate` internal route                                                  | Split future draft/review/publish capabilities before broad UI mutation | No command; local Demo draft only.                                    |
| Create promotion/coupon draft              | none                                                                                             | `commercial-promotion:draft` / `commercial-coupon:draft`                | Demo only, labelled proposed model.                                   |
| Approve/publish price, promotion or coupon | none                                                                                             | independent reviewer + publish authority, version/currentness checks    | Protected Demo confirmation only.                                     |
| Inspect Payment                            | `commercial-admin:read`                                                                          | Keep                                                                    | Read-only exact Payment aggregate.                                    |
| Refund/reconcile                           | domain commands exist below Payment in some flows, but no approved Super Admin mutation boundary | separate exact Payment authorities, idempotency and durable receipt     | No real action; investigation and simulated outcome only.             |
| Change customer service price/final Quote  | Product/Workspace-specific authority                                                             | Never granted by MO catalog administration                              | Explicitly out of scope.                                              |

Interface hiding is not authorization. Every future command must be enforced by Gateway and owner services.

## Complete UI state matrix

| State                    | Required representation                                                               |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Loading                  | skeleton tied to the requested owner/object; no zero totals                           |
| Empty                    | valid, successful zero result with active filters shown                               |
| Authentication           | sign-in required; no fixture fallback in Real mode                                    |
| Permission               | exact required capability and selected scope; no disabled-looking fake success        |
| Partial                  | available owner sections render; unavailable owner sections name the gap              |
| Error / timeout          | owner-specific retry and correlation context                                          |
| Stale version            | block publish/redeem; show expected/current versions                                  |
| Ineligible Workspace     | reason codes such as market, offer version or subject mismatch                        |
| Expired promotion/coupon | no discount; exact expiry shown                                                       |
| Duplicate redemption     | reject replay except the exact idempotent replay                                      |
| Capacity exhausted       | reject without decrementing below zero                                                |
| Payment failed           | retain order and price snapshot; do not infer entitlement                             |
| Refund                   | show Payment-owned refund status and original snapshot; do not rewrite Order price    |
| Success                  | Demo receipt clearly says no production mutation; Real success requires owner receipt |

## Desktop and mobile IA

- Desktop: filters and object list at left; selected commercial object, price formula, version lineage and risk at right.
- 1366×768: primary object and price formula stay above the fold; supporting audit collapses below.
- 390 px: filter controls stack, tables become labelled cards, selected object follows the list, sticky actions do not cover content.
- All touch targets are at least 44 px. IDs, currencies, amounts and lifecycle are never communicated by color alone.

## Acceptance journeys

1. Create a local Lite/Site offer-version draft with structured currency, cycle, market, window and entitlement inputs.
2. Configure a proposed limited-time promotion and coupon, then request protected review; no production API is called.
3. Evaluate an eligible and ineligible Workspace with explicit reasons.
4. Simulate checkout and inspect the immutable standard-price → campaign → coupon → tax/fees → final-price snapshot.
5. Demonstrate expired, duplicate, capacity-exhausted, failed-payment, refund and permission-denied outcomes without claiming a production mutation.
6. Switch Chinese/English during form/detail/confirmation without losing the selected object or draft.

## Non-goals

- No contract, database, migration, Payment/Refund/Transfer command or production API connection.
- No generic billing platform, accounting ledger, tax engine, arbitrary JSON rule editor or promotion expression language.
- No modification of Workspace/Site professional-service prices or MarkReg final Quotes.
- No replacement of `/` or customer product consoles.
