# Durable Customer Confirmation

MarkReg exclusively owns Customer Confirmation behavior, storage, repository contracts, and transitions. Core owns identity and Principal construction; Gateway owns browser authentication and Workspace context. Neither service reads another service's tables.

## Record and snapshot

Migration `0020_markreg_customer_confirmations.sql` stores the confirmation identity, Workspace, exact Quote identity/version, `CONFIRMED | WITHDRAWN` status, optimistic version, snapshot schema version, bounded JSON snapshot and SHA-256 hash, acceptance/update timestamps, and optional withdrawal timestamp. There is deliberately no foreign key to the migration-deferred Quote or Core Workspace.

Snapshot schema 1 contains only Quote/plan identity and versions, currency, total, bounded line-item commercial evidence, terms version, and acknowledgement codes. Recursive key sorting, explicit rejection of `undefined` and unsupported/non-finite values, semantic array order, UTF-8 encoding, and SHA-256 provide deterministic independently verifiable bytes. Callers cannot supply the stored hash.

Uniqueness is `(workspace_id, source_quote_id, source_quote_version)`, including withdrawn records: a historical acceptance is never replaced. Creation yields `CONFIRMED`, version 1. Withdrawal atomically yields `WITHDRAWN`, increments the version, retains `accepted_at` and the snapshot, and cannot be restored or deleted.

## Authority and isolation

All repository operations require `workspaceId`. Application authorization requires an exact Workspace Principal: `matter:create` and `matter:manage` permit creation/withdrawal (Workspace Admin and Matter Manager); `matter:read` permits all four current roles to read. Cross-Workspace reads fail as not found.

Customer Confirmation remains evidence of customer acceptance only. It creates no Order, Payment, Invoice, Formal Matter, Matter Draft, filing, appointment, or external effect. TASK 021 is not started.
