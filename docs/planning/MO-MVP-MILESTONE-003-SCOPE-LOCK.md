# MO MVP Milestone 3 Scope Lock

**Status:** `PROPOSED_FOR_OWNER_APPROVAL`  
**Planning task:** TASK 028  
**Baseline:** merged `main` at `cc2a7afcb79056abcf92dbe2fa4467e0c2767f8d` after PR #38.  
**Predecessor result:** Milestone 2 integration audit `GO`. Milestone 2 is not represented here as tagged or frozen unless a separate owner action creates that release reference.

## 1. Decision

**Recommended direction:** `DURABLE_COMMERCIAL_ORDER_AND_MATTER_LINKAGE`.

Milestone 3 should close the commercial-request gap between the existing confirmed Quote / Customer Confirmation flow and durable professional Matter execution. It should introduce a governed durable **Order** and an explicit Order-to-Matter relationship without expanding into payment settlement, invoice lifecycle, provider appointment or external filing.

This recommendation is derived from three already-governing sources:

1. the repository product lock, where the direct-customer journey includes `Quote and Confirmation -> Documents and Customer Actions -> Order / Matter`;
2. the canonical publication Order specifications, where Order is the commercial service request, distinct from Matter, Payment and Invoice, and is a Phase 3 / Must Implement business-execution object;
3. the Milestone 2 scope lock, where the commercial transaction layer was intentionally deferred until durable identity, Workspace isolation and Matter operations existed.

The canonical publication explicitly defers payment processing, invoice lifecycle, refund handling and revenue recognition from Order Service MVP scope. Milestone 3 therefore should not jump directly from durable Matter operations into finance or external authority.

## 2. Why this is the next milestone

Milestone 2 proved durable authenticated Matter operations, but `orderCreated` intentionally remained false throughout that milestone. The repository can now persist governed case truth, recover it after restart and isolate it by Workspace, yet the direct-customer product still lacks a durable object that answers:

- what service the customer actually requested;
- which customer and relationship model the commercial request belongs to;
- what trademark / jurisdiction / class scope was commercially confirmed;
- which Quote / Customer Confirmation is the source of that commitment;
- whether the request is ready to become professional work;
- which Formal Matter executes the request.

Order is the missing commercial bridge. Adding Payment or external Filing first would create financial or legal authority before the commercial request itself has a durable governed identity.

## 3. Direction comparison

| Option | Outcome | Dependency fit | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| **A — Durable Order + Order↔Matter linkage** | durable commercial service request, confirmation, readiness and explicit Matter relationship | directly builds on M2 Auth / Workspace / Quote / Confirmation / Formal Matter | medium | **SELECT** |
| B — Payment / Invoice transaction layer | settlement, payment-provider and financial records | requires a stable Order and explicit contracting/payment-receiver model first | high | defer |
| C — External filing execution | provider/office credentials, transmission, official truth | requires A plus protected external-action and provider/office integration | very high | defer |

Milestone 3 chooses A only. Options B and C remain future milestones.

## 4. Primary product outcome

An authenticated authorized Workspace member can create and confirm a durable trademark-service Order from exact commercial source evidence, validate it as ready for Matter, and explicitly create or link the corresponding Formal Matter through a governed MarkReg operation.

The Order and its relationship to Matter must:

- survive process restart;
- remain Workspace-scoped and non-enumerable across Workspaces;
- preserve exact Quote / Customer Confirmation source identity and versions;
- preserve Channel and Relationship Model;
- preserve explicit commercial relationship references rather than inferring contracting, payment, delivery or communication ownership from the UI product;
- use optimistic concurrency and Workspace-scoped idempotency;
- produce durable audit evidence for successful and denied protected mutations;
- never imply payment, invoice issuance, professional appointment, external provider assignment, filing submission, official application creation or trademark-office contact.

## 5. Canonical Order meaning

For Milestone 3, **Order** means a governed commercial service request. It is not Matter, Task, Payment, Invoice, Quote, Filing or checkout UI state.

Order owns commercial request scope and its lifecycle. Formal Matter owns professional case truth. The two may reference one another, but neither silently mutates the other's semantics.

### Required Order fields

The initial durable contract must include at least:

- stable `orderId`;
- `workspaceId`;
- `orderType`;
- canonical `status`;
- customer reference;
- Channel;
- Relationship Model;
- trademark / mark reference;
- jurisdiction reference;
- class / goods-service scope reference or immutable snapshot;
- exact Quote ID/version;
- exact Customer Confirmation ID/version;
- source correlation / idempotency context;
- zero or one active Formal Matter relationship for the initial trademark-filing vertical slice;
- created/updated actor and timestamps;
- integer optimistic version.

Pricing calculation, invoice lifecycle and payment lifecycle are not owned by this object.

## 6. Canonical lifecycle

Milestone 3 consumes the publication-controlled Order status semantics. The bounded implementation path is:

```text
Draft
  -> PendingConfirmation
  -> Confirmed
  -> ReadyForMatter
  -> MatterCreated
  -> InProgress
```

Cancellation may occur from the allowed active states under permission/policy guards. Completion/archival may be represented only if the milestone implements the corresponding validated transition; they are not required to prove the primary acceptance path.

Semantic rules:

- `Confirmed` means the service request was confirmed by an authorized actor; it **does not mean paid**.
- `ReadyForMatter` means commercial/source validation passed; it **does not mean Matter already exists**.
- `MatterCreated` requires a valid Formal Matter reference.
- UI labels cannot invent or directly mutate Order states.
- AI may prepare or explain an Order but cannot confirm, cancel, complete or archive it autonomously.

## 7. Source admission and commercial snapshot

A new trademark-filing Order may only be created from a current, same-Workspace commercial source tuple:

```text
Quote + exact Quote version
Customer Confirmation + exact confirmation version
Customer / applicant reference
selected plan / commercial scope
Channel
Relationship Model
```

The Order must persist either immutable source fields or an immutable commercial snapshot with a schema version and checksum. Mutable upstream records must never be the only evidence of what the customer requested.

The direct-customer product and professional channel must not silently collapse their relationship model. The Order contract must keep explicit references for the concepts required by the product lock, including contracting party, payment receiver, delivery owner, communication owner, customer-facing brand and professional authority when those references are known. Milestone 3 may model them as bounded references; it does not have to implement every referenced party system.

## 8. Ownership and service boundaries

### Business / Order semantic authority

The publication Order Domain / Order Service semantics remain canonical for the Order object, status model and Order-to-Matter distinction.

### MarkReg runtime owner

For the initial trademark-service vertical slice in this repository, **MarkReg owns the durable Order implementation and Order-to-Matter orchestration**. This keeps trademark commercial scope beside the existing Quote, Customer Confirmation and Formal Matter source truth and avoids introducing a new finance or generic commerce service before the product needs one.

This is a bounded runtime decision, not a claim that every future MarkOrbit business domain must store its Orders in MarkReg.

### Core

Core continues to own User, Workspace, Membership, Session, Principal and canonical permission semantics. Core does not mutate Order state.

### Gateway

Gateway authenticates, resolves Principal / Workspace context and forwards typed requests. It owns no Order data.

### Web products

markreg.com and Lite consume Order APIs. They do not define Order state or commercial truth. Product-specific presentation must preserve Channel and relationship boundaries.

### MGSN / provider network

MGSN is not part of the Milestone 3 Order authority path. Provider registry, allocation, acceptance and return remain separate future scope.

## 9. Order-to-Matter compatibility strategy

Milestone 2 already allows durable Formal Matter creation without an Order. Milestone 3 must not invalidate or rewrite those existing records.

The forward path should be:

```text
confirmed commercial source
-> Order Confirmed
-> Order ReadyForMatter
-> governed CreateMatterFromOrder
-> Formal Matter + Order/Matter link
-> Order MatterCreated
```

For the first MarkReg implementation, `CreateMatterFromOrder` should reuse the existing Formal Matter validation rules and execute the Matter creation plus Order link/status mutation in one MarkReg-owned PostgreSQL transaction where possible. The command must be idempotent and exact-version guarded.

Existing pre-M3 Formal Matters may be linked to a newly created Order only through an explicit compatibility command that validates same Workspace and exact commercial lineage. No migration may fabricate customer confirmation or Order consent.

The existing `CreateFormalMatter` boundary remains compatible for already-supported internal paths until a later deprecation decision; Milestone 3 does not silently redefine historical M2 evidence.

## 10. Authorization

The initial permissions should be explicit and service-checked, for example:

- `order:create`;
- `order:read`;
- `order:update`;
- `order:confirm`;
- `order:matter:create`;
- `order:cancel`;
- `order:audit:read` or the existing bounded audit permission where reused.

The exact role-to-permission mapping is an implementation decision inside the scope lock, but protected status transitions must never rely on UI visibility alone. Workspace identity must come from the authenticated Principal, not a trusted request body.

## 11. Persistence and transaction rules

Milestone 3 retains the Milestone 2 PostgreSQL 16 / database-per-owner pattern.

MarkReg should add forward-only migrations for:

- Orders;
- immutable commercial source snapshot / checksum fields;
- Order↔Matter link evidence where not embedded in the Order row;
- Workspace-scoped idempotency commands;
- append-only Order success / denial audit evidence required by protected mutations.

Required constraints include Workspace ownership, source uniqueness where semantically single-use, stable idempotency replay and optimistic version checks.

No cross-service database reads are allowed. No automatic ORM schema synchronization is introduced.

## 12. Event boundary

Milestone 3 may publish process-local Order events such as `OrderCreated`, `OrderStatusChanged` and `OrderMatterLinked` after committed mutations.

It does **not** promise durable event delivery, an outbox, broker replay or cross-service exactly-once semantics. If a later milestone requires reliable payment/provider/filling integration, that milestone must make an explicit event-delivery decision instead of inheriting one by accident.

## 13. Authority consequences

Milestone 3 intentionally changes only one prior false boundary: an explicit governed Order command may now make `orderCreated = true`.

An explicit governed Order-to-Matter command may create/link a Formal Matter. That is internal professional case truth, not external authority.

The following consequences must remain false throughout the Milestone 3 primary journey:

- `paymentCreated` / payment settled;
- `invoiceCreated` / invoice issued;
- `professionalAppointed`;
- `providerAssignedExternally`;
- `filingCreated` as an external filing object;
- `filingSubmitted`;
- `officialApplicationCreated`;
- `officialApplicationNumberReceived`;
- `customerMessageSent` automatically as a consequence of Order mutation;
- `externalDocumentSent`;
- `trademarkOfficeContacted`.

`Confirmed` must never be interpreted as paid. `MatterCreated` must never be interpreted as filed.

## 14. Browser acceptance

markreg.com is the primary acceptance surface for Milestone 3. The real-runtime browser path should prove:

1. authenticated Workspace context;
2. current confirmed Quote / Customer Confirmation source;
3. Order draft creation;
4. explicit confirmation;
5. readiness evaluation;
6. explicit Matter creation/link;
7. refresh and direct-URL recovery of the same Order and Matter IDs/versions;
8. Browser Back without duplicate commands;
9. Workspace switch clears stale Order/Matter state;
10. desktop and 390px mobile usability.

A bounded Lite read/reference surface may be added only if required by the professional workflow; it is not necessary to prove the direct-customer Order vertical slice.

No Playwright route interception may substitute for the real Gateway / MarkReg / Core / PostgreSQL path.

## 15. Reliability acceptance

The milestone must add executable evidence for:

- migration from empty and prior MarkReg schema;
- create / confirm / readiness / Matter conversion replay after process restart;
- database outage with fail-closed recovery;
- concurrent identical create converging on one Order;
- conflicting idempotency reuse rejected;
- stale expected version rejected;
- duplicate source use governed deterministically;
- cross-Workspace read and mutation non-enumeration;
- atomic Order-to-Matter conversion without partial state;
- audit evidence preserved after restart;
- browser direct URL / refresh / Workspace switch.

## 16. Explicit non-goals

Milestone 3 does **not** include:

- payment processing or settlement;
- payment custody or escrow;
- invoice issuance or tax accounting;
- refunds, chargebacks or revenue recognition;
- discounts / coupon engine;
- external provider appointment;
- MGSN public marketplace;
- trademark-office integration;
- external filing submission;
- official application / number creation;
- automatic customer communications;
- reliable cross-service event delivery;
- generic multi-domain commerce platform;
- public registration / enterprise IAM expansion.

## 17. Implementation work-package graph

To prevent a repeat of the Milestone 2 task-number drift, this scope lock uses milestone-local work-package IDs. Global task numbers should be assigned only after TASK 028 is approved.

| Work package | Objective | Depends on |
| --- | --- | --- |
| `M3-WP-01` | Order contract, canonical states, commercial snapshot and authority tests | TASK 028 approved |
| `M3-WP-02` | MarkReg PostgreSQL Order repository, migrations, idempotency and audit | WP-01 |
| `M3-WP-03` | Order service commands, transition guards and Workspace authorization | WP-01–02 |
| `M3-WP-04` | atomic governed Order-to-Matter conversion/link compatibility | WP-02–03 + existing Formal Matter |
| `M3-WP-05` | authenticated Gateway Order API and typed client | WP-03–04 |
| `M3-WP-06` | markreg.com Order journey, states and direct-route recovery | WP-05 |
| `M3-WP-07` | restart/concurrency/tenant/browser reliability matrix | WP-01–06 |
| `M3-WP-08` | independent Milestone 3 integration/authority audit | WP-07 |

Each work package should remain one bounded branch/PR unless a dependency split is explicitly recorded before implementation.

## 18. Exit criteria

Milestone 3 is releasable for its approved scope only when:

- a real authenticated user creates one durable Order from exact commercial source evidence;
- confirmation and readiness use canonical server-owned transition rules;
- the Order survives restart with the same ID, version and source snapshot;
- a governed exact-version command creates/links one Formal Matter atomically;
- another Workspace cannot enumerate or mutate either record;
- duplicate and concurrent commands are deterministic;
- real desktop/mobile browser acceptance passes with no interception;
- the repository retains the separation `Order != Matter != Payment != Invoice != Filing`;
- all prohibited financial, provider and external-authority consequences remain false.

TASK 028 performs planning only. It does not implement Order, mutate production schemas, freeze/tag Milestone 2 or merge itself.