# MO-MVP-TASK-005 — Plan and Quote Vertical Slice

## Outcome and contract

The direct customer can select exactly one recommendation option A/B/C, inspect a plan summary, request a deterministic fixture quote, review it, and record quote-confirmation intent. Shared contracts define `Money`, quote lines and assumptions, plan selection, quote creation, quote lifecycle, confirmation, and `PlanQuoteResponse`. `Money.amountMinor` is a safe integer and `currency` is a three-letter ISO 4217 code; decimal JavaScript numbers never represent money.

## Ownership and endpoints

MarkReg owns Plan Selection, Quote, and Quote Confirmation in its in-memory repository. Gateway validates public input, supplies correlation and idempotency headers, proxies contracts, and returns governed `SafeError` shapes. It neither reads MarkReg state nor imports MarkReg implementation.

- Gateway: `POST /v1/markreg/quotes`; `POST /v1/markreg/quotes/:quoteId/confirm`.
- MarkReg: `POST /v1/quotes`; `POST /v1/quotes/:quoteId/confirm`.

## Lifecycle and idempotency

Allowed transitions are `DRAFT → READY → CONFIRMED`, `DRAFT|READY → SUPERSEDED`, and `READY → EXPIRED`; only `READY` can be confirmed. It deliberately has no paid, performing, or filed state. The same key and semantic payload reuses a result; a different payload produces 409. Failed transport attempts can safely retry. The web client retains the key for the same selection and creates a new key when A/B/C changes; in-flight actions are coalesced.

## Fixture rules and safety locks

Pricing rule `fixture-usd-v1` is part of Quote identity together with `intakeId`, `recommendationId`, and `selectedOptionCode`. A/B/C apply fixed integer multipliers to estimated official fees, service fees, disbursements, and taxes. Identical quote inputs yield the same identifier and amounts. Every result is `fixtureOnly: true`; it uses no production fee source, tax engine, or currency conversion. Recommendation is not appointment; confirmation is not Order; Quote is not Payment; Payment is not performance; fixture fees are not Official Fees; confirmation is not professional acceptance. External protected actions still require explicit review and approval.

## UI design and states

**User/job:** a direct customer needs a cautious, understandable estimate before deciding whether to proceed to professional review. **IA:** Recommendation → Plan selection/summary → Quote loading → Quote review → Confirmation. Desktop retains equal A/B/C comparison cards and a readable fee card; mobile follows the existing stacked responsive primitives. Loading, recoverable error (selection retained), blocking error, offline mapping, expired response, ready, and confirmed states do not expose internal trace or service names. Native buttons, headings, live loading/error semantics, keyboard selection, visible focus, fixture warnings, and semantic fee labels support WCAG 2.2 AA. Session recovery uses `sessionStorage` only.

## Tests and acceptance

Contract tests cover integer money and A/B/C validation. Service and real dynamic-port HTTP tests cover deterministic calculations, headers, conflicts, expiry, confirmation and duplicate confirmation. UI/API tests cover request shape, safe errors, retries, duplicate action protection, session recovery, fixture warnings, keyboard behavior and axe. All runtimes are stopped during teardown.

## Limitations, non-goals, next recommendation

There is no database persistence, production pricing/tax engine, official fee source, conversion, Payment, Order, Matter, document upload, professional assignment, MGSN allocation, Filing, Invoice, Refund, or fulfillment. Confirmation records customer intent only. Next, add the separately governed professional review boundary before any Order/Matter proposal; do not infer acceptance from confirmation.

## Shared-boundary audit

`service-kit` contains only generic exact-route and decoded path-parameter dispatch; it contains no Quote, idempotency, storage, or lifecycle behavior. Exact routes remain compatible. TASK 002/004 idempotency remains service-owned and its regression suite continues to cover same-payload reuse, changed-payload conflict, in-flight coalescing, and retry after failure. Quote creation applies those same locks in MarkReg without expanding the shared runtime API beyond generic route parameters.

Money validation accepts only non-negative safe-integer minor units and USD for the current fixture. Every line must match the Quote currency, category totals reconcile to their named aggregates, subtotal is official plus service plus disbursements, and total is subtotal plus taxes. No conversion is performed.
