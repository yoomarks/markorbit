# Milestone 2 Boundary Map

## Authority and data flow

```text
Browser ── secure session ──> Gateway ── verified Principal ──> MarkReg Service
                               │                                  │
                               │                                  ├─ Formal Matter repository
                               │                                  ├─ immutable source snapshot
                               │                                  ├─ idempotency result
                               │                                  ├─ append-only audit
                               │                                  └─ no outbox in Milestone 2
                               │
                               └─> Core Service ── User / Workspace / Membership

Execution Service ── API/event only ──> MarkReg (no shared database)
```

PostgreSQL 16 is approved, not implemented. Core and MarkReg must use separate owned schemas/databases and credentials. Web and Gateway have no database credentials. Cross-service joins happen through contracts/APIs or admitted immutable snapshots, never SQL.

## Ownership map

| Boundary    | Owns in Milestone 2                                                                                     | Must not own                                               |
| ----------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Web product | route/view state and explicit user action                                                               | authentication truth, permission truth, domain persistence |
| Gateway     | session validation, principal resolution, coarse route permission, aggregation and safe HTTP mapping    | Formal Matter, membership or audit data                    |
| Core        | User, Workspace, Membership, role references, sessions/service identities (final split gated)           | Matter workflow                                            |
| MarkReg     | Customer Confirmation, Matter Draft, Formal Matter, admitted lineage snapshot, Matter idempotency/audit | credentials, Payment, external provider/office state       |
| Execution   | existing review/authorization/release/task-draft boundaries                                             | Formal Matter and MarkReg database                         |

## Defense-in-depth request path

1. Web route requires a session but never treats hidden controls as authorization.
2. Gateway validates the opaque cookie, CSRF/origin for unsafe methods, active membership and route permission.
3. Gateway supplies tamper-resistant internal principal context; the public request body cannot override actor or Workspace.
4. MarkReg checks permission and source ownership on every command/query.
5. Repository APIs require `workspaceId`; queries include it.
6. Workspace-scoped composite keys/foreign keys enforce ownership. PostgreSQL RLS is deferred hardening, not a Milestone 2 guarantee.
7. Audit records the actor, Workspace, decision and correlation without secrets.

## Transaction and consistency boundary

`CreateFormalMatter` locks/validates the durable source version and atomically writes the `OPEN` version 1 Matter with its application-generated UUIDv7, complete immutable source snapshot, source hashes/versions, idempotency response and successful audit. Failure rolls back all writes. Professional Review is not required. Any domain event is process-local, non-durable and not delivery-guaranteed; there is no Milestone 2 outbox or reliable cross-service delivery promise.

An ephemeral upstream record is never referenced as the only evidence. Fixture admission must materialize a schema-versioned snapshot and checksum in the transaction. Formal Matter is not an alias for Matter Draft and does not mutate it.

## Contract boundary (approved)

- Command: `CreateFormalMatter { matterDraftId, matterDraftVersion, expectedSourceVersion, idempotencyKey, correlationId }`; principal is transport context, not caller-supplied payload.
- Result: `FormalMatter` status `OPEN`, version 1 and PostgreSQL `uuid` ID generated as UUIDv7, with Workspace ownership and immutable `FormalMatterSourceSnapshot`.
- Errors: `UNAUTHENTICATED`, `FORBIDDEN`, `SOURCE_NOT_FOUND`, `STALE_SOURCE`, `SOURCE_INELIGIBLE`, `IDEMPOTENCY_CONFLICT`, `VERSION_CONFLICT`, `PERSISTENCE_UNAVAILABLE`.
- Event: optional process-local notification only; it is non-durable and carries no delivery guarantee.
- No contract may imply Order, Invoice, Payment, appointment, Filing, Submission, application/number, provider assignment, message, external document or office contact.

## Deployment and test boundary

Local Compose already declares PostgreSQL 16, but runtime wiring, driver, migrations, health/readiness and CI database service are future tasks. Repository contract tests run against both adapters. Gateway acceptance uses real HTTP and PostgreSQL. Restart acceptance retains only the database, restarts runtime processes, and reloads the exact version. Browser acceptance uses a real session and no interception.

## Open architecture gates

PostgreSQL 16, Workspace, PostgreSQL-backed opaque sessions, the non-review-dependent trigger, UUIDv7, no outbox, deferred RLS and TASK 017–027 are approved but not implemented. TASK 017 selects a thin SQL migration runner and PostgreSQL client after bounded compatibility comparison. Database-versus-schema local isolation and session expiry/rotation/provisioning details remain implementation selections. TASK 017 starts only after TASK 016 merges.
