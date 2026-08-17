# MO-MVP-M8-WP-05 — Commercial Admin and Operator Control

## 1. Task ID

`MO-MVP-M8-WP-05`

## 2. Repository and dependency

Repository: `yoomarks/markorbit`

WP05 implements the Milestone 8 scope lock after WP01–WP04:

`Register -> Login -> Account classification -> Workspace/Role -> Product/Price -> Quote -> Order -> Checkout -> Payment -> Matter -> Admin operations -> Customer status`

WP05 is not a Product/Price-only work package. The required internal administration surface covers:

- users and account classifications;
- Workspaces and memberships/roles;
- customers and professionals;
- providers as a distinct governed party/domain concept;
- Products/Prices and their future commercial availability;
- Orders;
- Payments, including governed refund/reconciliation operations already owned by Payment;
- Matters and customer-safe lifecycle visibility.

Final persistence numbering and integration must be based on the post-WP04 `main` branch. No migration number is reserved by this document.

## 3. Allowed implementation scope

Implementation may touch the smallest required set of:

- `packages/contracts`
- `services/core`
- `services/markreg`
- `services/payment`
- `services/mgsn`
- existing Matter/lifecycle owning service code where repository evidence requires it
- `apps/gateway`
- `apps/operations-console`
- `infrastructure/persistence`
- focused scripts/tests and route inventories
- `docs/tasks`

No cross-service SQL is allowed. A unified admin UI must not become a new source of truth: reads and commands are routed to the owning domain through explicit contracts.

## 4. Objective

Create a real authenticated internal operator experience for the commercial records produced by the M8 customer journey. An authorized operator must be able to find a real user/Workspace and follow the resulting commercial chain through Order, Payment and Matter without fixture data, direct database edits or engineer-issued identities.

WP05 must provide both:

1. a governed Gateway/internal API boundary; and
2. an Operations Console experience consuming that boundary.

The console is a client, not authority.

## 5. Authority locks

The following invariants are absolute:

- `Account Type != Workspace Role`.
- `Customer/Professional != Provider`.
- `Provider != Professional appointment`.
- `Order != Payment`.
- `Payment succeeded != Matter completed`.
- `Payment succeeded != Filing submitted`.
- `Matter lifecycle projection != Official Truth`.
- `Professional Review != Official Truth`.
- Product/Price/Checkout truth remains owned by its existing MarkReg/commercial boundary.
- Payment truth remains owned by Payment.
- Matter/lifecycle truth remains owned by its existing governed domain.
- Provider registry/allocation truth remains owned by its existing provider/MGSN boundary.
- browser/operator input never authors server timestamps, actor identity, monetary truth, provider return truth, filing truth or official status.
- historical Order/Checkout/Payment/Matter facts are not rewritten because future catalogue or administrative state changes.
- no public self-registration for `PROVIDER` or `INTERNAL`.
- no direct database mutation from Operations Console or Gateway handlers.

## 6. Internal operator authorization

Commercial admin is an internal capability, not ordinary customer Workspace authority.

Every browser admin route must enforce the repository’s canonical internal authentication boundary and, for mutations:

- authenticated Session;
- authoritative user/Workspace or internal operator principal resolved server-side;
- trusted Origin;
- CSRF protection;
- explicit admin permission/capability;
- idempotency where the command can be retried;
- actor/workspace/target spoof rejection;
- audit correlation.

Do not silently overload `order:update` or another customer permission as global admin authority. Introduce the smallest explicit commercial-admin permission/capability if the current model lacks one.

## 7. User, account and Workspace administration

The operator surface must allow bounded inspection of real account onboarding facts needed to support customers:

- user ID and safe profile fields;
- Account Type;
- Workspace membership and role;
- Workspace identity/status;
- creation/update timestamps and audit identifiers that are safe for internal display.

Mutations, if required for MVP operations, must call the owning Core/account command boundary. WP05 does not introduce password reset, MFA, invitation flows or arbitrary identity impersonation.

The admin UI must never accept a browser-supplied user ID/Workspace ID as proof of operator authority.

## 8. Customer, Professional and Provider administration

WP05 must make commercial party classification inspectable without collapsing distinct concepts:

- CUSTOMER and PROFESSIONAL are account classifications established by the account/commercial model;
- PROVIDER is not self-service and remains governed by the provider-domain boundary;
- a Professional account is not automatically a Provider;
- viewing a Provider must not create an allocation or professional appointment.

Where existing provider lifecycle commands already exist, the admin surface may expose the minimum governed operator actions required by the MVP. It must not invent provider acceptance, allocation or filing authority in the browser.

## 9. Product and Price administration

Product/Price operator controls remain part of the commercial admin experience but do not replace the broader WP05 scope.

Required bounded capabilities:

- inspect Products and current/future availability;
- inspect immutable Price history and validity windows;
- create/lifecycle-manage a Product through the owning commercial command boundary where supported;
- publish a new Price version instead of mutating a published amount/currency in place;
- schedule/retire future Price eligibility without erasing historical facts.

Rules:

- server allocates Price versions atomically;
- amount uses integral minor units and uppercase ISO currency;
- invalid overlapping eligibility windows are rejected unless an explicit pricing rule permits them;
- customer catalogue reads expose only currently eligible prices;
- historical Checkout/Order/Payment snapshots continue to point to their exact original commercial facts.

## 10. Order administration

An operator must be able to locate and inspect real Orders produced by M8 customer flows, including their authoritative identifiers, Workspace/customer context, commercial snapshot references and current governed state.

Any operator mutation must use the owning Order command boundary with optimistic concurrency/idempotency as appropriate. The admin surface cannot manufacture Payment success, Matter creation, Filing or provider acceptance by editing Order state.

## 11. Payment administration

Payment is a separate domain introduced by WP04 and remains Payment authority. WP05 adds administration of that domain; it does not move Payment ownership into Operations Console.

Required capabilities, subject to WP04’s final provider boundary:

- find/list/read Payment records by safe operator filters;
- inspect provider attempt/reference metadata that is safe for internal use;
- inspect verified event receipts and reconciliation observations;
- inspect refund history;
- invoke the existing governed refund/reconciliation commands when authorized;
- surface idempotency/conflict/provider errors without allowing direct status edits.

Forbidden:

- editing `SUCCEEDED`/`FAILED`/refund state directly;
- browser-authored provider references or provider event truth;
- treating a reconciliation observation as silent Payment mutation;
- treating Payment success as Filing or Official Truth.

## 12. Matter and customer-status administration

An operator must be able to find the Matter/lifecycle record associated with a real commercial journey and inspect customer-safe status plus internal provenance already allowed by the existing governed lifecycle model.

WP05 may expose only existing governed Matter/lifecycle commands required for operations. It must not convert evidence, provider return, review decisions or lifecycle projections into Official Truth.

The operator must be able to trace, where data exists:

`User/Workspace -> Order -> Checkout -> Payment -> Matter`

without client-side joins that bypass service boundaries.

## 13. Gateway admin boundary

Add an explicit internal/commercial-admin HTTP surface following repository conventions. Exact paths should be chosen after inventorying current routes, but the boundary must support the required read models and governed commands for the domains above.

Requirements:

- no browser-to-service bypass;
- no cross-service SQL aggregation;
- server-side fan-out/composition may combine read-only projections while preserving source/domain identity;
- mutations are delegated to exactly one owning domain command at a time;
- failure of one domain must not be converted into fabricated data from another;
- route inventory and negative-path coverage are updated.

## 14. Operations Console

Extend the current Operations Console from evidence/lifecycle-only operations into a real commercial admin workspace.

At minimum provide navigable, non-fixture surfaces for:

- Users / Workspaces;
- Parties (Customer / Professional / Provider);
- Catalogue (Product / Price);
- Orders;
- Payments / Refunds / Reconciliation;
- Matters / customer status;
- existing Evidence Review / Lifecycle Review surfaces.

The console must:

- load real Gateway data;
- clearly distinguish read-only facts from commands;
- display source/domain identity and correlation/audit identifiers where useful;
- show loading/empty/error/forbidden/stale/conflict states;
- avoid hard-coded operational counters being presented as live authoritative values;
- never expose direct SQL/database controls.

## 15. Audit and attribution

Every governed admin mutation must be explainable. Successful and denied mutations should retain or emit, according to existing repository conventions:

- authenticated operator identity;
- Workspace/internal scope;
- command type;
- target domain and entity identity;
- expected/prior version where relevant;
- resulting version/state where relevant;
- idempotency fingerprint/key hash where applicable;
- correlation ID;
- server timestamp;
- denial/conflict classification when safely recordable.

Secrets, raw session cookies, credentials and unnecessary personal data must not enter audit snapshots.

## 16. Persistence

After WP04 is merged, verify the live migration set before allocating any WP05 migration.

Persistence changes are allowed only when a domain lacks a durable admin-safe read/audit/idempotency capability required by this work package.

Rules:

- preserve existing migration ownership;
- no cross-service tables masquerading as a new admin source of truth;
- forward-only migrations;
- historical commercial facts remain immutable where already locked;
- admin read models must be rebuildable/traceable to authoritative domain data.

## 17. Required tests

At minimum:

### Authorization and isolation

- anonymous/customer/non-admin principals cannot access internal admin routes;
- cross-Workspace/target spoof attempts are rejected;
- Origin/CSRF are required for browser mutations;
- actor/server timestamp/money/provider-status spoof fields are rejected;
- explicit admin permission/capability is enforced server-side.

### Read integrity

- a real account/Workspace can be found after restart;
- Order, Payment and Matter records can be traced without fixture IDs;
- source/domain identity is preserved in composed admin reads;
- missing downstream records are shown as absent/pending rather than fabricated;
- fixture/hard-coded overview counters are not used as live admin truth.

### Command integrity

- idempotent commands replay exactly;
- changed semantic command under the same idempotency key conflicts;
- stale expected versions conflict;
- Product/Price changes affect future eligibility only;
- published Price money is not edited in place;
- Payment status cannot be directly edited;
- refund/reconciliation commands use Payment authority;
- Matter/lifecycle commands do not create Official Truth;
- Provider administration does not create allocation/appointment implicitly.

### Durability and product acceptance

- relevant admin facts survive PostgreSQL reconnect/restart;
- Gateway route inventory is governed;
- Operations Console has browser/component coverage for success, empty, forbidden, conflict and failure states;
- `pnpm check` passes;
- hosted persistence/browser gates pass.

## 18. Non-goals

- password reset/change, MFA or social login;
- invitation/team email flows unless separately scoped;
- direct database repair UI;
- accounting/tax/invoice/general-ledger system;
- promotion/coupon engine;
- arbitrary Provider allocation;
- professional appointment creation unless an existing governed command is explicitly required by the MVP admin journey;
- Filing execution or official-office actions;
- converting Payment, Provider return, Evidence Review or lifecycle projection into Official Truth;
- production release authorization.

## 19. Completion gate

WP05 is not complete because a catalogue editor exists.

WP05 is complete only when an authorized internal user can use Operations Console and governed Gateway APIs to locate a real M8 user/Workspace and inspect/operate the required commercial chain across parties, catalogue, Order, Payment and Matter without:

- fixture identities/data;
- direct database edits;
- engineer-issued sessions;
- cross-service SQL;
- client-authored authority facts.

This gate remains subordinate to the Milestone 8 completion gate and does not itself declare MVP Beta Ready.

## 20. Expected PR title

`M8 WP05: add governed commercial admin and operator controls`
