# M3-WP-02 — Durable Order Persistence

## Status

Implementation work package for the approved Milestone 3 Order direction, dependent on merged M3-WP-01 / PR #40.

## Objective

Add the MarkReg-owned durable persistence boundary for the governed trademark-service Order without introducing Order service lifecycle commands, Gateway routes, UI, Payment, Invoice, provider appointment or external Filing authority.

## Persistence ownership

MarkReg is the only runtime owner of the initial trademark-service Order tables. The implementation retains the repository database-per-owner rule and performs no cross-service SQL.

Migration `0026_markreg_orders.sql` is forward-only and adds:

- `orders` — immutable commercial source identity/snapshot plus current Order state and optional Matter reference;
- `order_commands` — Workspace-scoped idempotency evidence with exact durable result snapshots;
- `order_audit` — append-only successful mutation evidence using the existing MarkReg audit mutation guard.

## Repository contract

The in-memory and PostgreSQL repositories share one executable contract covering:

- Workspace-scoped create/read/list;
- exact commercial source snapshot and SHA-256 reload;
- identical idempotent create replay;
- conflicting idempotency-key rejection;
- exact-source single-use enforcement;
- optimistic expected-version update;
- immutable commercial source protection;
- exact historical command-result replay after later Order versions exist;
- concurrent writer serialization;
- append-only successful mutation audit evidence.

The PostgreSQL implementation uses `SERIALIZABLE` transactions so Order state, command evidence and audit evidence commit or roll back together.

## Migration compatibility

The migration suite proves both:

1. empty MarkReg owner-database bootstrap through migration `0026`; and
2. additive upgrade from the previously merged Milestone 2 MarkReg schema while retaining existing Customer Confirmation evidence unchanged.

No migration fabricates an Order for historical Matter or Customer Confirmation records.

## Authority boundary

Persistence can store explicit internal Order truth only. This work package does not make any of the following true:

- payment created or settled;
- invoice issued;
- professional/provider appointed externally;
- filing created or submitted;
- official application created or application number received;
- customer message sent;
- external document sent;
- trademark office contacted.

`Order != Matter != Payment != Invoice != Filing` remains enforced as the Milestone 3 semantic boundary.

## Deferred

The following remain later work packages:

- M3-WP-03 Order service lifecycle and authorization;
- M3-WP-04 governed atomic Order-to-Matter conversion;
- M3-WP-05 Gateway API / typed client;
- M3-WP-06 markreg.com Order journey;
- M3-WP-07 reliability matrix expansion;
- M3-WP-08 integration/authority audit.
