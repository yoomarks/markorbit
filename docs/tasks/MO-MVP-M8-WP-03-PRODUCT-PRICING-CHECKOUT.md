# MO-MVP-M8-WP-03 — Product, Pricing and Checkout Foundation

## 1. Task ID

`MO-MVP-M8-WP-03`

## 2. Repository and allowed directories

Repository: `yoomarks/markorbit`

Allowed scope:

- `packages/contracts`
- `services/markreg`
- `apps/gateway`
- `apps/markreg-web`
- `infrastructure/persistence`
- `tests`
- `docs/tasks`

## 3. Objective and user-visible outcome

A real authenticated MarkReg customer in a real Workspace can read a server-governed commercial catalog, select an active price, preserve that exact price identity through the commercial path, and initiate checkout for an eligible Order. Checkout initiation creates durable internal commercial intent only; it does not create or imply Payment success.

This work package replaces fixture-only price authority for the new commercial path with versioned, durable Product and Price truth while retaining existing fixture paths for regression coverage until they are deliberately retired.

## 4. Canonical sources

- `AGENTS.md`
- `docs/tasks/MO-MVP-TASK-033A-MILESTONE-008-SCOPE-LOCK.md`
- `docs/product/MVP-PRODUCT-LOCK.md`
- `docs/architecture/SERVICE-OWNERSHIP.md`
- `docs/tasks/MO-MVP-M3-WP-01-ORDER-CONTRACT.md`
- existing `Money`, Quote, Customer Confirmation and Order contracts
- existing Workspace Principal, RBAC, internal-service authentication, CSRF and trusted-Origin boundaries

## 5. Ownership and contracts

MarkReg owns Product, Price and Checkout lifecycle because MarkReg owns trademark quote/order/matter commercial domain. Core remains identity/workspace authority and does not acquire product-workflow ownership.

New shared contracts define:

- `CommercialProduct` and versioned status;
- `CommercialPrice` with integral minor-unit money, currency, channel and relationship scope;
- `CheckoutSession` as a durable checkout-initiation record;
- exact command and projection types;
- checkout authority consequences that keep Payment, Matter and Filing consequences false.

## 6. Required behavior

- Products and prices are server-governed records; browser input cannot author authoritative amount, currency, Product status or Price status.
- Money remains integral minor units. JavaScript decimal amounts are prohibited.
- A Price references exactly one Product and one immutable Price version.
- Only ACTIVE Product + ACTIVE Price combinations are selectable.
- Price applicability is constrained by Channel and Relationship Model.
- Checkout initiation requires a Workspace Principal and an Order in the same Workspace.
- Checkout snapshots the exact Product, Price, currency and amount used for initiation.
- Checkout initiation is idempotent. Same key + same semantic input replays the same result; changed input conflicts.
- An Order may not acquire a second active checkout for a different governed price without an explicit later supersession flow.
- Checkout state in WP03 is limited to `INITIATED`, `EXPIRED` and `CANCELLED`.
- `INITIATED` means only that MarkOrbit is ready to hand the bounded amount/reference to the future Payment boundary.
- No WP03 operation may mark an Order paid, create a Payment, create a Matter, appoint a Professional/Provider, submit a Filing or create Official Truth.

## 7. Commercial sequence

The bounded WP03 path is:

`Workspace -> Product/Price -> Quote/Confirmation -> Order -> Checkout INITIATED`

WP04 will continue from the checkout reference into a distinct Payment domain.

The existing canonical M8 sequence remains:

`Register -> Login -> Account classification -> Workspace/Role -> Product/Price -> Quote -> Order -> Checkout -> Payment -> Matter -> Admin operations -> Customer status`

## 8. HTTP and security boundary

MarkReg exposes internal service routes for catalog reads and checkout initiation. Gateway exposes the customer-facing `/api` surface and derives the Workspace Principal from the canonical HttpOnly Session.

- browser never supplies authoritative User identity;
- Workspace context is checked against Session membership;
- checkout mutation requires the canonical CSRF token and trusted Origin at Gateway;
- Gateway forwards an encoded Workspace Principal through the existing internal-service authorization boundary;
- actor-spoof fields are rejected;
- catalog reads are scoped to the authenticated Workspace/Channel relationship used by the product surface.

## 9. Persistence

A MarkReg-owned migration creates durable tables for:

- products;
- versioned prices;
- checkout sessions;
- checkout idempotency commands.

The migration must be restart-safe and registered in `migration-owners.json` under `@markorbit/markreg-service`.

## 10. Acceptance tests

- Product/Price contracts reject invalid minor-unit money and invalid currency.
- inactive Product or Price is not selectable.
- Channel/Relationship mismatch is rejected.
- catalog reads return only eligible active prices.
- checkout derives amount/currency from persisted Price, never request input.
- checkout requires an eligible same-Workspace Order.
- same idempotency key + same semantic command replays exactly.
- same idempotency key + changed semantic input conflicts.
- cross-Workspace Order/checkout access is rejected.
- checkout survives PostgreSQL reconnect/restart.
- checkout creation produces no Payment, Matter, Provider, Filing or Official Truth consequence.
- Gateway requires authenticated Session, active Workspace membership, trusted Origin and CSRF for checkout mutation.

## 11. Validation commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:auth:postgres
```

Hosted Browser and Visual Validation plus existing M2–M7 reliability gates must remain green.

## 12. Non-goals

- payment-provider SDK integration;
- Payment lifecycle or persistence;
- webhook verification;
- payment success/failure/refund/chargeback/reconciliation;
- invoice or tax-accounting lifecycle;
- currency conversion;
- commercial admin UI;
- Provider assignment or Professional appointment;
- Matter creation caused by checkout;
- Filing submission or trademark-office integration.

Those remain WP04+ or existing separately governed domains.

## 13. Expected PR title

`M8 WP03: add governed product pricing and checkout foundation`
