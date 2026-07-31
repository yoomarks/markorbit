# MO MVP TASK 017 — Persistence Foundation and Repository Contracts

## Status and baseline

Completed on existing PR branch `4rd7lx-codex/postgresql`. Baseline commit `6db87c7831aaf631add1bcdfadc892cba08da9ab`, tree `1f55b0dadb66b8aa3ea67dbdac95439b03304270`, contains PR #24 and the `APPROVED_FOR_IMPLEMENTATION` Milestone 2 plan. The supplied checkout had no configured remote, so synchronization provenance is the local merge commit.

## Bounded outcome

The task establishes PostgreSQL 16 development/CI infrastructure, `@markorbit/persistence`, typed configuration, Pool lifecycle/readiness/shutdown, transaction execution, a checksum-verifying SQL runner, ownership validation, and a dual-adapter test-only repository contract. ADR-0002 records the bounded comparison and selections: node-postgres, the small local runner, and database-per-service isolation.

No product contract, event, state transition or user journey changes. The only state transitions are infrastructure lifecycle (`unstarted → ready → closed`), transactions (`begun → committed | rolled back`), and migrations (`pending → applied`). No business events are emitted or consumed.

## Acceptance and validation

The real PostgreSQL suite uses only `PERSISTENCE_TEST_DATABASE_URL`, creates its probe through temporary SQL, proves restart durability, and cleans deterministically. CI starts a clean PostgreSQL 16 service, runs bootstrap/status/verify, then the persistence suite. The workspace quality gate remains required: format, lint, typecheck, test and build plus boundary and artifact audits.

## Non-goals

Authentication, identity objects, sessions, product persistence, formal-state behavior, audit, idempotency, outbox, external providers, object storage and production deployment are excluded. TASK 018 has not started.

## TASK 017-R1 verification

The R1 audit makes required database-test mode fail closed, keeps migration bootstrap/history reads and execution on the advisory-lock-owning PoolClient, proves a concurrent migration body executes once, and expands lifecycle, exact-byte checksum, shared repository-contract, and negative boundary tests. Local PostgreSQL 16.14 executed all 7 PostgreSQL integration cases with zero skips; the complete focused suite executed 22/22 tests. CI uses Node 22, pnpm 10.28.1, PostgreSQL 16, and `PERSISTENCE_TEST_REQUIRED=1`. PR-head Actions evidence remains authoritative and must be recorded in the existing PR; local verification does not substitute for it.
