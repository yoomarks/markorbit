# Durable Customer Confirmation

MarkReg exclusively owns Customer Confirmation behavior, storage, repository contracts, and transitions. Core owns identity and Principal construction; Gateway owns browser authentication and Workspace context. Neither service reads another service's tables.

## Record and snapshot

Migration `0020_markreg_customer_confirmations.sql` stores the confirmation identity, Workspace, exact Quote identity/version, `CONFIRMED | WITHDRAWN` status, optimistic version, snapshot schema version, bounded JSON snapshot and SHA-256 hash, acceptance/update timestamps, and optional withdrawal timestamp. There is deliberately no foreign key to the migration-deferred Quote or Core Workspace.

Snapshot schema 1 contains only Quote/plan identity and versions, currency, total, bounded line-item commercial evidence, terms version, and acknowledgement codes. Recursive key sorting, explicit rejection of `undefined` and unsupported/non-finite values, semantic array order, UTF-8 encoding, and SHA-256 provide deterministic independently verifiable bytes. Callers cannot supply the stored hash.

Canonicalization rejects non-plain objects (including `Date`), functions, symbols, bigint, non-finite numbers, prototype-related property names, depth above 12, and canonical UTF-8 output above 64 KiB. MarkReg constructs the snapshot from its current in-memory Quote boundary; callers provide only the exact Quote version and confirmation selections. Snapshot validation and hash verification run on repository write and PostgreSQL reload.

Uniqueness is `(workspace_id, source_quote_id, source_quote_version)`, including withdrawn records: a historical acceptance is never replaced. Creation yields `CONFIRMED`, version 1. Withdrawal atomically yields `WITHDRAWN`, increments the version, retains `accepted_at` and the snapshot, and cannot be restored or deleted.

## Authority and isolation

All repository operations require `workspaceId`. Application authorization requires an exact Workspace Principal: `matter:create` and `matter:manage` permit creation/withdrawal (Workspace Admin and Matter Manager); `matter:read` permits all four current roles to read. Cross-Workspace reads fail as not found.

The three existing Gateway routes are the production API. Gateway resolves the browser Session and Workspace Principal through Core, then sends a schema-versioned, validated Principal envelope with an internal service credential and correlation ID. MarkReg authenticates that credential and independently enforces the Core-derived permissions. Raw Session tokens are never forwarded. The old `MatterFlowService` confirmation behavior is retained only for explicit Milestone fixture runtimes when no durable repository is injected; the production `main.ts` requires PostgreSQL and always injects the durable repository.

MarkReg owns a managed database lifecycle: readiness precedes listener startup, startup failures close the pool, and shutdown stops the listener and pool. Tests use `markorbit_markreg_test`, migration namespace `markreg`, `MARKREG_TEST_DATABASE_URL`, and required mode `MARKREG_POSTGRES_TEST_REQUIRED=1` in CI.

Customer Confirmation remains evidence of customer acceptance only. It creates no Order, Payment, Invoice, Formal Matter, Matter Draft, filing, appointment, or external effect. TASK 021 is not started.
