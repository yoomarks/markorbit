# MO-MVP-M8-WP-04 — Payment Foundation

## 1. Task ID

`MO-MVP-M8-WP-04`

## 2. Repository and allowed scope

Repository: `yoomarks/markorbit`

Allowed implementation scope:

- `packages/contracts`
- `services/payment`
- `apps/gateway`
- `infrastructure/persistence`
- `scripts` and focused tests required to govern the new Payment boundary
- `docs/tasks`
- minimal workspace/build configuration required to register the Payment service

MarkReg may expose a bounded read-only Checkout handoff endpoint if the Payment service cannot consume the canonical Checkout snapshot through an existing internal contract. WP04 must not move Checkout ownership out of MarkReg.

## 3. Objective

Create Payment as a durable, auditable domain distinct from Order and Checkout. A customer may start provider payment only from a valid governed Checkout; provider callbacks are cryptographically verified before they can change Payment truth; refunds and reconciliation are explicit records rather than inferred flags.

## 4. Canonical sequence

`Order -> Checkout -> Payment -> Matter`

The following authority locks remain absolute:

- `Order != Payment`;
- `Payment succeeded != Filing submitted`;
- `Payment succeeded != Matter completed`;
- browser input never authors authoritative amount, currency, Payment status, refund status or reconciliation status.

WP03 remains the authority for Product, Price and Checkout snapshots. WP04 consumes those facts and cannot retroactively rewrite them.

## 5. Ownership

Payment becomes its own business domain/service boundary. It consumes bounded Checkout truth and does not own Product, Price, Quote, Order, Matter, Provider allocation, Professional appointment, Filing or Official Truth.

Core remains identity/workspace authority. Gateway remains the browser authentication, Workspace Principal, CSRF and trusted-Origin boundary. MarkReg remains Product/Price/Checkout/Order authority.

## 6. Shared contracts

WP04 introduces versioned shared contracts for:

- `Payment`;
- `PaymentAttempt` / provider reference;
- verified provider event receipt;
- `PaymentRefund`;
- reconciliation observation/disposition;
- provider adapter commands/results;
- authority consequences.

All money uses integral minor units and an uppercase three-letter currency code.

Provider-specific SDK types must not leak into shared business contracts.

## 7. Payment lifecycle

Canonical Payment states:

- `PENDING` — durable Payment exists but provider confirmation is incomplete;
- `REQUIRES_ACTION` — provider requires customer action;
- `PROCESSING` — provider has accepted work but final outcome is not authoritative yet;
- `SUCCEEDED` — verified provider truth confirms the full governed amount succeeded;
- `FAILED` — verified provider truth confirms failure;
- `CANCELLED` — payment attempt was cancelled before success.

Refund is modeled separately from Payment success:

- `PENDING`;
- `SUCCEEDED`;
- `FAILED`.

A successful refund does not rewrite historical Payment success. Payment projections may expose `refundedMinor`, but immutable payment evidence remains preserved.

## 8. Checkout handoff

Payment initiation requires:

- authenticated Workspace Principal;
- Checkout in the same Workspace;
- Checkout status `INITIATED`;
- Checkout not expired;
- amount/currency derived exclusively from the durable Checkout snapshot;
- Product/Price identity copied from the Checkout snapshot;
- no existing non-terminal Payment for the same Checkout unless the operation is an idempotent replay.

Payment creation snapshots Checkout ID, Order ID, Product/Price versions, amount and currency. Later Product/Price changes cannot alter this Payment snapshot.

## 9. Provider boundary

The service defines a provider-neutral adapter interface. A production provider adapter must:

- create the provider-side payment object with server-derived amount/currency;
- attach MarkOrbit Payment/Checkout correlation metadata;
- use deterministic idempotency;
- return only bounded provider identifiers/client-action material;
- verify webhook signatures from the exact raw request body;
- normalize provider events into canonical internal event types;
- support refunds;
- support provider-side retrieval for reconciliation.

The first production provider is selected only after its current official API and webhook requirements have been reviewed. A deterministic fake/test adapter is allowed for unit and hosted CI but does not satisfy the real-provider acceptance gate by itself.

## 10. Webhook authority

A provider event may mutate Payment truth only after signature verification succeeds.

Requirements:

- raw request bytes are preserved for verification;
- verified provider event ID is unique and idempotent;
- duplicate delivery replays safely;
- unverified events produce no Payment mutation;
- event ordering is not trusted blindly; stale/regressive events cannot overwrite newer terminal truth;
- provider amount/currency/reference must match the durable Payment snapshot before `SUCCEEDED` is accepted;
- webhook receipts remain durable and auditable.

## 11. Refunds

Refund commands require an authenticated authorized internal/admin boundary; ordinary customer checkout routes cannot author refunds.

Refund rules:

- source Payment must be `SUCCEEDED`;
- refund amount is positive integral minor units;
- cumulative successful + pending refund amount may not exceed successful Payment amount;
- refund idempotency is durable;
- provider refund ID and webhook/result evidence are retained;
- failed refund does not erase prior successful Payment truth.

## 12. Reconciliation

A reconciliation pass compares durable MarkOrbit Payment/refund truth with provider retrieval truth.

Each observation records:

- Payment ID and provider reference;
- observed provider state;
- observed amount/currency;
- local state;
- match/mismatch classification;
- observed timestamp;
- disposition status and optional operator note.

Reconciliation detects divergence; it does not silently rewrite governed truth. Any corrective mutation must use an explicit governed command/event path.

## 13. Security

- Browser payment initiation uses the canonical HttpOnly Session through Gateway.
- Workspace membership and permissions are resolved server-side.
- CSRF + trusted Origin protect browser mutations.
- actor-spoof and monetary-spoof fields are rejected.
- internal service calls use the existing internal-service authorization boundary.
- webhook endpoint is not Session-authenticated; provider signature verification is its authority boundary.
- webhook secret and provider secret keys are environment secrets and never persisted in business tables or returned to browsers.
- logs and audit snapshots must not contain provider secrets or raw payment credentials.

## 14. Persistence

Payment-owned migrations create durable tables for:

- payments;
- payment commands/idempotency;
- payment provider attempts/references;
- verified provider event receipts;
- refunds and refund commands;
- reconciliation observations/dispositions.

Migrations are restart-safe and registered to `@markorbit/payment-service`.

## 15. Required HTTP surface

The bounded WP04 customer surface is expected to include:

- `POST /api/payments` — initiate Payment from an eligible Checkout;
- `GET /api/payments/:paymentId` — read Workspace-scoped Payment projection.

Internal/provider surfaces are expected to include:

- provider webhook ingestion with raw-body signature verification;
- explicit refund command;
- explicit reconciliation observation command/read path.

Exact internal paths may follow repository conventions, but ownership and authority consequences above are fixed.

## 16. Required tests

- amount/currency are derived from Checkout, never browser input;
- expired/cancelled Checkout cannot start Payment;
- same idempotency key + same command replays exactly;
- changed semantic input conflicts;
- cross-Workspace access is rejected;
- provider creation failure does not fabricate success;
- invalid webhook signature produces zero mutation;
- duplicate verified webhook delivery is idempotent;
- mismatched provider amount/currency cannot mark Payment succeeded;
- stale/regressive provider event cannot overwrite terminal truth;
- successful verified provider event can mark Payment `SUCCEEDED` but creates no Matter/Filing authority;
- refund limits and idempotency hold;
- reconciliation records mismatch without silently rewriting truth;
- Payment/refund/webhook evidence survives PostgreSQL reconnect/restart;
- Gateway payment initiation enforces Session, Workspace, Origin, CSRF, idempotency and permission boundaries;
- `pnpm check` and all hosted gates pass.

A real provider sandbox/test-mode end-to-end path must pass before WP04 can be declared complete. If provider credentials are not available in hosted CI, the code may land with the provider-neutral boundary and deterministic adapter, but the task remains explicitly incomplete until that sandbox evidence exists.

## 17. Non-goals

- Product/Price administration;
- Order mutation beyond explicit downstream projection/notification contracts;
- Matter creation policy;
- Provider network allocation;
- Professional appointment;
- Filing submission;
- Official trademark-office truth;
- accounting ledger / tax engine / invoicing beyond payment evidence required by M8;
- multi-provider routing optimization;
- payment links.

## 18. Expected PR title

`M8 WP04: add payment provider webhook refund and reconciliation foundation`
