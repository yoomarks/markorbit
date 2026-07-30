# Persistence Foundation

## Boundary and topology

`@markorbit/persistence` contains infrastructure primitives only: typed configuration, a managed node-postgres Pool, transactions, normalized errors, and the SQL-first runner. Product repositories and migrations remain service-owned. Local and CI isolation is database-per-service; TASK 017's `markorbit_test` database is solely an infrastructure probe. Gateway and Web must not import this package or `pg`.

The test-only `persistence_test_probe` exists only in temporary test migration SQL. It is not shipped as a migration, public contract, Gateway route or product object. The committed production migration directory is intentionally empty because migration history is runner infrastructure and TASK 017 must add no business tables.

## Configuration

The parser accepts `DATABASE_URL`, or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. It also accepts `DB_POOL_MAX`, `DB_CONNECTION_TIMEOUT_MS`, `DB_IDLE_TIMEOUT_MS`, `DB_STATEMENT_TIMEOUT_MS`, `DB_APPLICATION_NAME`, `DB_SSL_MODE` (`disable` or `require`), `DB_MIGRATION_NAMESPACE`, and `DB_TEST_DATABASE`. Integration tests alone use `PERSISTENCE_TEST_DATABASE_URL`. Values in `.env.example` and Compose are conspicuously local/test-only; production secrets must be injected and production explicit-field configuration requires a password.

## Lifecycle, transactions and errors

Constructing `ManagedDatabase` does not connect. `start()` creates one Pool and verifies readiness with a bounded `SELECT 1`; failed readiness ends the partial Pool. `close()` is idempotent. Runtime applications, not the package, own shutdown signals.

`transact()` checks out one client, begins with optional isolation/read-only/deferrable clauses, commits success, rolls back failure, and releases exactly once. A successful rollback preserves the callback error. Begin, commit, or rollback failures use typed infrastructure errors. Transactions are never retried automatically.

The taxonomy distinguishes invalid configuration, unavailability, timeout, lock/checksum/migration failures, begin/commit/rollback failures, and constraint violations. Causes are retained; messages contain neither SQL parameter values nor credentials. Repository adapters may map only applicable constraint failures and must not invent business or authorization meaning.

## Migration behavior and commands

Files use `NNNN_name.sql`, sort lexically by version, and are SHA-256 checksummed. Duplicate versions or names fail before execution. History is keyed by namespace and records application time and duration. Identical applied migrations are skipped, changed/missing applied files fail verification, an advisory lock prevents concurrent application, and a migration plus its success record are atomic. Correction is always a new forward migration.

```bash
pnpm infra:up
docker compose -f infrastructure/docker-compose.yml --profile persistence-test up -d postgres-test
pnpm db:migrate
pnpm db:migrate:status
pnpm db:migrate:verify
pnpm db:test:bootstrap
PERSISTENCE_TEST_DATABASE_URL=postgresql://markorbit_test:markorbit-test-only@localhost:5433/markorbit_test pnpm test:persistence
pnpm infra:down
pnpm infra:reset # deliberate removal of local volumes
docker compose -f infrastructure/docker-compose.yml --profile persistence-test down
```

The bootstrap command refuses a database identifier without `test`; the isolated test container uses tmpfs and cannot destroy the normal local database.

## Tests and ownership guard

Unit tests cover configuration, redaction and migration discovery. Real PostgreSQL tests cover bootstrap/status/idempotence/checksum, rollback/no false history, advisory-lock concurrency, independent namespaces, transactions, reconnect durability, readiness failure and idempotent shutdown. One behavioral repository contract runs unchanged against memory and PostgreSQL probe adapters, including exact/scoped lookup, duplicates, optimistic versioning, rollback and no partial mutation.

`validate:persistence-boundaries` requires declared namespace owners, rejects database imports in Web/Gateway, and rejects foreign migration paths in services. The dedicated CI `persistence` job supplies PostgreSQL 16 and test-only credentials.

## Limits and removal

This foundation adds no User, Workspace, Membership, Session, Matter, confirmation, draft, audit, idempotency, outbox or provider persistence. It adds no production deployment. To roll it back, stop the test container, remove the package/scripts/job and owner registry, and deliberately drop `markorbit_persistence` only in the isolated test database. Never automatically remove a service database or rewrite applied history.
