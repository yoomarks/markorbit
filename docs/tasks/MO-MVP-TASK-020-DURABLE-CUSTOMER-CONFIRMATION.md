# MO MVP TASK 020 — Durable authenticated Customer Confirmation

Status: IMPLEMENTED

Baseline: `5d71e60b58f0e39b9de817ab9f6da0fe979756ee` (TASK 019 merge, tree `65b60390e69a375651a8f067bcf875a4e93a34a1`).

This task adds the MarkReg-owned migration, bounded snapshot contract, deterministic canonicalization and SHA-256 verification, Workspace-scoped in-memory and PostgreSQL repositories, optimistic withdrawal, typed errors, and focused validation. The PostgreSQL adapter uses an injected `@markorbit/persistence` query boundary and parameterized SQL.

Commands: `pnpm test:customer-confirmation`, `pnpm test:customer-confirmation:postgres`, and the standard workspace quality gate. `MARKREG_TEST_DATABASE_URL` selects the isolated MarkReg test database; `MARKREG_POSTGRES_TEST_REQUIRED=1` makes missing database configuration a failure.

Customer Confirmation is acceptance evidence only. Matter Draft remains non-durable; Formal Matter, Order, Payment, Invoice, filing, outbox, audit log, and TASK 021 are out of scope.
