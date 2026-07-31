# MO MVP TASK 020 — Durable authenticated Customer Confirmation

Status: IMPLEMENTED

Baseline: `5d71e60b58f0e39b9de817ab9f6da0fe979756ee` (TASK 019 merge, tree `65b60390e69a375651a8f067bcf875a4e93a34a1`).

This task adds the MarkReg-owned migration, bounded snapshot contract, deterministic canonicalization and SHA-256 verification, Workspace-scoped in-memory and PostgreSQL repositories, optimistic withdrawal, typed errors, and focused validation. The PostgreSQL adapter uses an injected `@markorbit/persistence` query boundary and parameterized SQL. One shared seven-case repository contract runs unchanged against both adapters, alongside PostgreSQL duplicate-create and withdrawal-race cases and seventeen canonicalization/domain tests.

Canonical mapping: the Milestone 1 `CustomerConfirmation` vocabulary (`CONFIRMED`/`WITHDRAWN`), acknowledgement meaning, Quote snapshot semantics, and no-automatic-consequences response remain authoritative. The durable record adds Workspace scope, integer version, snapshot schema/hash, and withdrawal timestamp. The legacy `MatterFlowService` path is fixture-only when no durable repository is injected; production runtime composition always selects the PostgreSQL-backed service. The same three Gateway routes resolve Core Principal context and use authenticated internal HTTP to MarkReg.

Commands: `pnpm test:customer-confirmation`, `pnpm test:customer-confirmation:postgres`, `pnpm test:customer-confirmation:http`, and the standard workspace quality gate. `MARKREG_TEST_DATABASE_URL` selects isolated database `markorbit_markreg_test`; `MARKREG_POSTGRES_TEST_REQUIRED=1` makes missing database configuration a failure. CI creates and migrates that database under namespace `markreg`, executes the PostgreSQL suite twice, and runs real Core/Gateway/MarkReg listener tests.

Customer Confirmation is acceptance evidence only. Matter Draft remains non-durable; Formal Matter, Order, Payment, Invoice, filing, outbox, audit log, and TASK 021 are out of scope.
