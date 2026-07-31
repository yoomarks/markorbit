# ADR-0002: PostgreSQL persistence foundation

## Status

Accepted for TASK 017.

## Decision

Use PostgreSQL 16 with `pg` (node-postgres) behind `@markorbit/persistence`. It provides explicit Pool construction, parameterized queries, checked-out transaction clients, timeouts and explicit `end()` without connecting at import time. Driver errors terminate at this typed infrastructure boundary.

Use the repository-local, SQL-first runner rather than an ORM or general migration framework. Ordered files are immutable by SHA-256 checksum; history records owner namespace, version, name, checksum, application time and duration. Each migration and its history insert share a transaction. A namespace-derived PostgreSQL advisory lock serializes runners. The runner performs no destructive repair and never derives schema from decorators.

Use a separate database per owning service in development and CI. TASK 017 provisions only an isolated persistence test database. This adds slightly more setup than schemas but best preserves independently resettable ownership, future least-privilege credentials, and the prohibition on cross-service SQL. Service-owned migrations remain beside their owning service when later tasks create them; the shared package owns only runner infrastructure.

Pools are runtime-owned values, not globals. Applications create, readiness-check and close them. Applications own process signal handling. Transactions acquire one client, begin, invoke one callback, commit or roll back, and release exactly once. They are not automatically retried.

Configuration comes from a typed environment boundary. Production fails when required explicit values are absent, SSL mode is explicit, and messages redact secrets. Web and Gateway receive no database dependency or credentials.

## Alternatives rejected

- ORM schema synchronization and decorator-generated schema: it obscures reviewed SQL, ownership, ordering and applied-file immutability.
- A large ORM used only for migrations: disproportionate surface and a parallel data-model style.
- External migration CLIs: available tools either add configuration/dependency surface or still require custom checksum/ownership policy; the tested local runner is smaller.
- Schema-per-service: workable for Milestone 2, but weaker operational separation and easier accidental cross-service reads.
- Global Pool and package-owned signal handlers: hidden lifecycle and test handles.
- Cross-service SQL: violates service ownership and bypasses contracts, authorization and admitted evidence boundaries.

## Consequences

Later services declare unique migration namespaces and run only their own migrations. Production credential provisioning and deployment remain future work. Non-transactional PostgreSQL operations require an explicit future runner extension and review.
