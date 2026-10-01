# Customer Portal V2 — 三总监 Decision Record

## Task contract

- **Task ID:** MO-CUSTOMER-PORTAL-V2-CONVERSATIONAL-COMMERCE
- **Repository / allowed paths:** `apps/markreg-web/src/customer-portal-preview`, its Storybook/unit tests, `tests/e2e/customer-portal-v1-preview.spec.ts`, and this product documentation directory.
- **Objective:** extend the existing direct-customer Portal with a mature bilingual conversational application journey, governed quote/offer review and controlled Demo payment experience across Web, H5 and mini-program adapters.
- **Canonical sources:** existing Customer Portal V1.2 Blueprint; latest Workspace/Site isolation model; Gateway/Auth trusted subject; Workspace Customer Relationship and enterprise representation; MarkReg Quote/Order/Matter; Payment merchant/payment/receipt truth; Communication object linkage.
- **Contracts changed:** none. V2 adds fixture-backed UI states and acceptance evidence only.
- **Expected PR title:** `feat(site): add conversational customer application and payment preview`

PR #1441 remains open and owns the same preview files. Latest `main` is still its original base, so V2 is implemented as a continuous upgrade of that exact Portal branch rather than copying a second customer application. This is a repository-coordination decision, not a production architecture decision.

## Joint decision

The approved experience is **conversation plus structured workbench**, not chat-only application filing. Conversation explains, asks one bounded question at a time and helps prepare a draft. The adjacent summary, file preview, editable fields, country/classes, missing-information check, exact quote and controlled payment view remain structured and reviewable. No chat message can authenticate a person, grant company authority, accept a formal filing, charge money or mutate official truth.

```text
trusted Demo identity
  -> choose authorized service
  -> conversational clarification
  -> controlled document selection
  -> extracted-field review with source
  -> country / class selection
  -> missing-information check
  -> stable application draft
  -> exact Quote projection
  -> coupon-policy validation
  -> explicit quote confirmation
  -> authorized Payment method
  -> Demo failure or Demo receipt
  -> same Order / progress / message across channels
```

## Product Director review

### User and job

The user is an individual customer, company owner/brand/legal contact, or authorized company member—not an agency employee. Their job is to prepare a filing without learning internal object names, understand exactly what remains, verify price and parties, and safely continue in another authorized channel.

### Information architecture

The five mobile destinations remain `首页｜办业务｜进度｜消息｜我的`. The new application journey launches from `办业务`, home next-actions, messages and `订单与付款`; it is not a sixth permanent navigation item. Desktop uses the same business meaning in a wider guided-workbench layout.

The journey preserves eight visible stages: `需求｜资料｜核对｜范围｜检查｜草稿｜报价｜付款`. Customers may go back without searching chat history because every material field stays in the structured summary.

### Commercial truth

- Service catalogue copy describes a possible service, not a final executable quote.
- Quote `quote-us-nova-318` remains the quoted-price source for order `order-us-nova-042`.
- The service provider, merchant of record, currency, line items, offer and payable amount are separately visible.
- Quote confirmation is not payment. Payment failure remains unpaid. A receipt blocks duplicate payment.
- The Demo receipt is labelled as non-production and not evidence of real funds, authorization, settlement or performance.

## Design Director review

### Mature interaction pattern

The mobile journey uses a compact sticky stage rail, MO assistant bubble, large structured choice cards, file preview, source-labelled extraction fields, selection chips, review checklist, document-like draft, financial quote card and receipt. The desktop layout pairs the journey with a sticky application summary. Mobile moves that summary above the current step and keeps actions thumb-reachable.

Trust comes from source clarity, reversible edits, exact object IDs, accessible error recovery and explicit boundaries—not fictional reviews, member tiers, balances, advisor portraits or invented business volumes.

### Bilingual and original-value rules

Chinese is the default authored interface and English has equivalent navigation, instructions, errors, quote/payment details and receipts. `NOVA PRIME`, `诺瓦实验室（上海）有限公司`, IDs, filenames, currency and amounts stay unchanged. Draft fields are stored independently of locale, so closing, switching language and reopening does not rewrite the draft.

### UI states

| State                                               | Presentation                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| registration guidance                               | conversation explains requirements, then structured Demo verification     |
| file absent / ready                                 | disabled next action / named preview with Demo boundary                   |
| extraction unconfirmed                              | editable sourced fields; cannot continue until explicit confirmation      |
| missing information                                 | exact missing item; no false completeness                                 |
| draft                                               | stable draft ID, editable summary, no official filing claim               |
| offer valid                                         | exact reduction and unchanged quote currency                              |
| offer expired / used / inapplicable / non-stackable | plain-language reason; quote cannot continue with unresolved entered code |
| quote expired                                       | confirmation and payment entry disabled                                   |
| payment pending                                     | merchant and authorized method shown; no paid claim                       |
| payment failed                                      | no funds received; retry/help recovery                                    |
| Demo receipt                                        | exact payment/order/source references; duplicate action disabled          |
| loading / empty / error / permission / partial      | retained from V1.2 Storybook state matrix                                 |

## Technical Director review

### Owner boundaries

| Concern                                   | Authoritative production owner                  | Preview behavior                                                           |
| ----------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| login, OTP, credential binding            | Gateway/Auth                                    | structured Demo verification only; no SMS/password/WeChat binding          |
| customer relationship / company authority | Workspace relationship and representation owner | existing exact bindings and fail-closed grants                             |
| uploaded files                            | document/package owner                          | local named Demo preview; no real upload                                   |
| extracted data                            | source document + reviewed draft owner          | editable derived fields with source label; not official truth              |
| application draft / formal filing         | MarkReg intake/matter owner                     | Demo draft only; no protected filing action                                |
| quote and order                           | MarkReg Quote/Order owners                      | exact immutable fixture references                                         |
| coupon applicability                      | promotion/rule owner associated with quote      | deterministic Demo validation; no platform price mutation                  |
| merchant, payment, receipt/refund         | Payment owner                                   | authorized Demo merchant/method and local non-financial receipt            |
| messages                                  | Communication owner                             | object-linked local Demo projection                                        |
| Site provenance                           | Site channel projection                         | stable `siteId` and channel retained; Site owns no customer/order database |

### Security and negative rules

Every object read still requires the trusted subject, exact Workspace relationship, optional active representation and object grant. An URL business ID, chat claim, phone/name match, Site source or payment callback cannot grant access. Another Workspace/customer and revoked company membership remain denied. The Payment method cannot accept an arbitrary merchant identifier.

Production must treat provider callbacks as evidence to the Payment owner; a browser success page never marks an Order paid. Refund, partial/staged payment and preauthorization require owner states not present in this Preview.

## Acceptance record

The browser journey proves:

1. guided registration explains requirements before structured Demo verification;
2. service selection opens the same guided application on Web/H5/mini;
3. files, extracted fields, country/classes, completeness and draft are reviewable and reversible;
4. `EXPIRED`, `USED`, `CNONLY` and non-stackable/invalid codes return distinct reasons; `SAVE600` changes CNY 12,800 to CNY 12,200 without locale conversion;
5. an expired quote cannot enter payment;
6. a simulated payment failure stays unpaid, while a Demo receipt carries exact payment/order/source references and blocks duplicate payment;
7. progress and messages reflect the same Order, and a bound second channel reads the same browser-local Demo state;
8. language switching preserves original draft text, CNY amount, IDs and payment status;
9. existing other-Workspace, other-customer, revoked-member, direct-ID and logout tests remain passing.

### Runnable preview routes

- Web Chinese: `/customer-portal-preview.html?channel=web&journey=open&journeyStep=0`
- Web English: `/customer-portal-preview.html?channel=web&locale=en-US&journey=open&journeyStep=0`
- H5 Chinese: `/customer-portal-preview.html?channel=h5&journey=open&journeyStep=0`
- H5 English: `/customer-portal-preview.html?channel=h5&locale=en-US&journey=open&journeyStep=0`
- Mini Program Chinese: `/customer-portal-preview.html?channel=mini&journey=open&journeyStep=0`
- Mini Program English: `/customer-portal-preview.html?channel=mini&locale=en-US&journey=open&journeyStep=0`
- Expired quote: `/customer-portal-preview.html?fixture=quote-expired&journey=open&journeyStep=6`

### Visual evidence

- `evidence/v2-web-desktop-quote-workbench.png`
- `evidence/v2-mini-390-quote-start.png`
- `evidence/v2-mini-390-quote-offer.png`
- `evidence/v2-mini-390-payment-receipt.png`

## Production dependencies and non-goals

Production integration requires supported Auth/OTP and channel credential linking, audited document upload, reviewed extraction, MarkReg application-draft and professional-review contracts, Quote/Order read models, promotion-policy validation, Payment merchant eligibility and callback verification, receipt/refund projection, and Communication delivery.

This deliverable does not send OTP, upload a real file, submit a filing, provide legal advice, create a production quote/order, charge or hold funds, issue a financial receipt, process a refund, send a customer message or claim native WeChat cross-device login. Browser `localStorage` remains an explicitly labelled continuity fixture.
