# M3-WP-01 — Order Contract and Canonical State Boundary

## Status

Implementation work package for the Milestone 3 direction approved by merging TASK 028 / PR #39.

## Objective

Introduce the minimum shared contract surface required for the trademark-service Order vertical slice without adding persistence, runtime mutation, Gateway routes, UI, finance, provider assignment or external filing authority.

## Canonical sources

- `docs/planning/MO-MVP-MILESTONE-003-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-003-DELIVERY-PLAN.md`;
- publication Order object vocabulary (`B02-OBJ-ORDER`);
- publication canonical Order status specification (`B02-CSV-ORDER-STATUS`).

The repository consumes the publication-controlled status values and transition matrix exactly. The narrower Milestone 3 acceptance path is represented separately and does not redefine canonical state truth.

## Contract surface

`@markorbit/contracts/order` defines:

- stable `OrderId` and initial `TrademarkFiling` Order type;
- exact canonical Order status values and transition matrix;
- the bounded M3 primary path `Draft -> PendingConfirmation -> Confirmed -> ReadyForMatter -> MatterCreated -> InProgress`;
- immutable commercial source evidence with exact Quote and Customer Confirmation versions;
- Channel and Relationship Model preservation;
- bounded contracting party, payment receiver, delivery owner, communication owner, customer-facing brand and professional-authority references;
- Order-to-Formal-Matter link semantics;
- exact-version/idempotent command inputs for create, confirmation, readiness, Matter create/link and cancellation;
- typed stale/transition/permission/policy/idempotency/version/duplicate/persistence errors;
- authority fixtures where explicit Order creation is allowed while Payment, Invoice, provider and external filing consequences remain false.

## Authority boundary

`Confirmed` is commercial confirmation, not payment.

`MatterCreated` requires a valid Formal Matter reference and remains internal case truth, not a Filing, Filing Submission, official application, official application number or trademark-office contact.

Order does not own Payment or Invoice lifecycle. A payment-receiver reference is a bounded relationship reference only.

## Acceptance evidence

The contract suite must prove:

1. exact publication status values;
2. exact canonical transition matrix;
3. invalid/unlisted transition rejection;
4. exact Quote / Customer Confirmation source identity and versions;
5. compatibility with existing `Quote`, `CustomerConfirmation` and `FormalMatter` contracts;
6. command expected-version and idempotency fields;
7. required typed error vocabulary;
8. `Confirmed != paid` and `MatterCreated != filed` authority semantics;
9. package build and type declarations expose the Order contract through `@markorbit/contracts/order`.

## Prohibited in this work package

- PostgreSQL migration or Order repository;
- MarkReg Order runtime/service implementation;
- Gateway route or typed HTTP client;
- markreg.com or Lite UI;
- Payment provider, settlement or escrow;
- Invoice, tax, refund, chargeback or revenue model;
- MGSN/provider appointment;
- external Filing contract or trademark-office integration;
- reliable event delivery/outbox.

Those remain later Milestone 3 work packages.
