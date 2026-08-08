# MO MVP Milestone 3 Delivery Plan

**Status:** proposal accompanying TASK 028. No implementation starts until the scope lock is approved.  
**Direction:** `DURABLE_COMMERCIAL_ORDER_AND_MATTER_LINKAGE`.  
**Baseline:** `cc2a7afcb79056abcf92dbe2fa4467e0c2767f8d`.

## Delivery principles

Milestone 3 is deliberately narrower than a generic commerce platform. It introduces a durable governed Order and its explicit relationship to Formal Matter. It does not implement Payment, Invoice, Provider appointment or external Filing.

The implementation sequence must preserve:

- semantic separation: `Order != Matter != Payment != Invoice != Filing`;
- one runtime owner for trademark Order truth: MarkReg;
- Core ownership of identity / Workspace / Principal semantics;
- Gateway as transport/policy boundary, not data owner;
- database-per-owner isolation;
- exact-source lineage, Workspace-scoped idempotency and optimistic concurrency;
- real-runtime browser evidence without request interception;
- explicit false financial/provider/external-authority consequences.

Milestone-local work-package IDs are used so planning cannot collide with the existing global task-number inventory. Global task IDs are assigned only after TASK 028 approval.

## Staged rollout

| Stage | Work package | Deliverable                                                                   | Acceptance                                                                                            | Rollback boundary                               |
| ----: | ------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
|     1 | `M3-WP-01`   | Order contracts, status semantics, commercial snapshot and authority fixtures | compile-time contract tests; canonical transitions; source/version and false-consequence fixtures     | additive contracts can be removed while unused  |
|     2 | `M3-WP-02`   | MarkReg Order persistence                                                     | PostgreSQL migration, memory/Postgres parity, idempotency, version conflict, append-only audit        | forward repair after schema is shared           |
|     3 | `M3-WP-03`   | Order service lifecycle                                                       | create/read/list/confirm/readiness/cancel with Principal reauthorization and server-owned transitions | service operation flags; retain compatible rows |
|     4 | `M3-WP-04`   | Order-to-Matter conversion/link                                               | exact-version atomic Matter create/link, replay/conflict, compatibility link for pre-M3 Matter        | retain Order/Matter data; disable orchestration |
|     5 | `M3-WP-05`   | Gateway API + typed client                                                    | authenticated HTTP matrix, non-enumerating tenant isolation, actor/workspace spoof rejection          | remove route/client only                        |
|     6 | `M3-WP-06`   | markreg.com Order journey                                                     | desktop/mobile explicit create-confirm-ready-createMatter path, direct URL and refresh recovery       | UI route/feature boundary                       |
|     7 | `M3-WP-07`   | reliability matrix                                                            | migration/restart/outage/concurrency/tenant/repeatability/browser exact-head evidence                 | test/orchestration only; defects fixed forward  |
|     8 | `M3-WP-08`   | independent integration audit                                                 | scope, ownership, authority and reproducibility audit with release recommendation                     | documentation only                              |

## M3-WP-01 — Order contract and canonical state boundary

### Objective

Introduce the minimum shared contract necessary for the trademark-service Order vertical slice.

### Required contract surface

- `OrderId` and immutable identity;
- `OrderType`, initially including trademark filing;
- canonical Order statuses consumed from the publication state model;
- `CommercialSourceSnapshot` with exact Quote / Customer Confirmation references and checksum/version metadata;
- Channel and Relationship Model;
- bounded commercial relationship references required by the product lock;
- Order-to-Matter reference semantics;
- commands for create, confirm, readiness and Matter conversion/link;
- typed errors for stale source, invalid transition, permission, policy, idempotency conflict, version conflict, duplicate source and unavailable persistence;
- authority consequence fixtures where Order creation is explicit but Payment/Invoice/Filing remain false.

### Prohibited

- payment/provider SDK;
- invoice/tax model;
- external filing contract;
- UI implementation;
- database migration.

### Evidence

- canonical transition matrix tests;
- invalid transition tests;
- exact-source snapshot fixtures;
- semantic tests proving `Confirmed != paid` and `MatterCreated != filed`;
- compatibility tests with existing Quote, Customer Confirmation and Formal Matter contracts.

## M3-WP-02 — Durable Order repository

### Objective

Create MarkReg-owned PostgreSQL persistence with the same owner-database discipline proven in Milestone 2.

### Required data

- Orders;
- exact commercial source snapshot / checksum;
- current Formal Matter reference/link state;
- command/idempotency evidence;
- protected-mutation success and denial audit evidence.

### Required repository behavior

- Workspace-scoped create/read/list;
- deterministic identical replay;
- conflicting key rejection;
- optimistic expected-version update;
- source uniqueness where the commercial source is single-use;
- append-only audit;
- transaction rollback on audit/idempotency failure;
- migration from empty and prior Milestone 2 MarkReg schema.

### Prohibited

- cross-service SQL;
- shared Core/Execution database;
- hidden payment/invoice columns that imply ownership;
- automatic schema synchronization.

## M3-WP-03 — Order service lifecycle

### Objective

Implement explicit protected Order commands under authenticated Principal context.

### Minimum operations

- create Order from exact commercial source;
- get/list Order;
- move `Draft -> PendingConfirmation` where the UI flow uses a prepared draft;
- explicitly confirm `PendingConfirmation -> Confirmed`;
- evaluate readiness `Confirmed -> ReadyForMatter`;
- cancel from allowed active states;
- expose safe bounded projections.

The owning service validates every transition. AI and UI cannot directly mutate state.

### Authorization

Role/permission mapping must be explicit and tested. Request-body actor/workspace values cannot override authenticated Principal context.

### Evidence

- memory/Postgres service parity where practical;
- exact version, stale source and transition tests;
- Workspace isolation;
- protected mutation audit;
- restart reload of exact ID/version/source snapshot.

## M3-WP-04 — Atomic governed Order-to-Matter conversion

### Objective

Make the forward direct-customer path Order-first without rewriting historical Milestone 2 Matters.

### Forward command

```text
Order ReadyForMatter + exact expected Order version
+ exact confirmed commercial source lineage
-> create Formal Matter using existing MarkReg authority validation
-> link Matter to Order
-> Order MatterCreated
```

For the initial MarkReg implementation, the Matter create, Order link, Order status change, command result and audit evidence should commit atomically in one MarkReg-owned PostgreSQL transaction where possible.

### Compatibility command

A pre-M3 Formal Matter may be linked to an Order only through an explicit same-Workspace lineage validation. No migration fabricates an Order or customer consent.

### Evidence

- identical replay returns the same Order/Matter result;
- different payload under the same key conflicts;
- stale Order/source version fails without writes;
- Matter create failure leaves Order unchanged;
- Order link/audit failure leaves no orphan newly created Matter;
- cross-Workspace Matter link is non-enumerating denial;
- restart returns exact Order/Matter relationship.

## M3-WP-05 — Gateway Order API and typed client

### Objective

Expose authenticated product-safe Order operations without moving ownership into Gateway or Web.

### Minimum route family

The exact namespace should follow the repository Gateway policy and existing MarkReg API conventions. Required behavior includes:

- create Order;
- read/list Order;
- confirm Order;
- evaluate readiness;
- create/link Matter;
- cancel where implemented.

### HTTP acceptance

Real Gateway + Core auth + MarkReg + PostgreSQL must cover success and typed `400/401/403/404/409/503` semantics where applicable.

Workspace and actor spoofing are rejected/ignored in favor of Principal truth. Cross-Workspace reads do not reveal existence.

## M3-WP-06 — markreg.com Order journey

### Objective

Add the first customer-visible durable Order journey while preserving the existing product IA.

### Required states

- loading;
- no eligible commercial source;
- draft / pending confirmation;
- confirmation required;
- confirmed;
- ready for Matter;
- Matter created/linked;
- stale source;
- version conflict;
- permission denied;
- service unavailable;
- cancelled where implemented.

### Real-runtime Golden Path

```text
confirmed Quote / Customer Confirmation
-> create Order
-> confirm Order
-> validate ReadyForMatter
-> create/link Formal Matter
-> refresh
-> direct Order URL
-> direct Matter URL
-> Browser Back
-> Workspace switch clears stale state
```

Desktop and mobile 390px must pass with zero route interception.

## M3-WP-07 — Reliability and migration matrix

### Objective

Prove the new commercial boundary behaves like a durable governed system rather than a UI feature.

### Required scenario groups

- migration from empty and prior schema;
- create/confirm/readiness restart;
- Order-to-Matter restart;
- startup and runtime database outage;
- concurrent identical create;
- idempotency conflict;
- stale optimistic update;
- duplicate source race;
- atomic conversion failure injection;
- cross-Workspace read/mutation/link denial;
- repeated deterministic MarkReg execution;
- desktop/mobile real-runtime acceptance.

The aggregate remains fail-fast and records exact-head hosted evidence.

## M3-WP-08 — Integration and authority audit

### Objective

Independently audit exact merged implementation against the approved scope lock.

### Required audit dimensions

- Order semantic fidelity to publication canon;
- Channel / Relationship Model preservation;
- runtime ownership boundaries;
- source lineage and restart durability;
- Workspace isolation;
- idempotency/concurrency;
- atomic Order-to-Matter conversion;
- browser recovery and responsive behavior;
- no payment/invoice/provider/external-filing authority leakage;
- exact-head hosted CI evidence;
- reproducibility and documentation drift.

The audit may recommend GO/FIX/HOLD. It cannot silently tag, freeze or release.

## Cross-cutting acceptance rules

### Authority

An explicit Order creation can make `orderCreated = true`. No other commercial or external consequence follows automatically.

An explicit `CreateMatterFromOrder` can create internal Formal Matter truth. It does not create a filing or contact an office.

### Finance boundary

No Milestone 3 status is equivalent to paid. Payment and Invoice references, if present at all, are nullable external references with no lifecycle ownership in this milestone.

### Event boundary

Order events may be process-local after successful commit. No outbox/reliable-delivery claim is introduced.

### Security

Every durable Order query/mutation is Workspace-scoped. Principal context is authenticated. UI-only permission is insufficient.

### Generated artifacts

Browser reports, screenshots, traces, logs and Storybook output remain CI artifacts and must not become tracked source files.

## Exit

Milestone 3 exits only after the full path is proven on one exact implementation tree:

```text
Authenticated Workspace
-> exact commercial source
-> durable Order
-> explicit confirmation
-> ReadyForMatter
-> atomic Formal Matter create/link
-> restart/reload
```

with deterministic duplicate behavior, cross-Workspace denial and all Payment/Invoice/Provider/Filing/Official-Truth consequences still false.
