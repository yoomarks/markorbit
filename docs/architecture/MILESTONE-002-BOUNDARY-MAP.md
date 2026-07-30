# Milestone 2 Boundary Map

## Authority and data flow

```text
Browser ── secure session ──> Gateway ── verified Principal ──> MarkReg Service
                               │                                  │
                               │                                  ├─ Formal Matter repository
                               │                                  ├─ immutable source snapshot
                               │                                  ├─ idempotency result
                               │                                  ├─ append-only audit
                               │                                  └─ optional transactional outbox
                               │
                               └─> Core Service ── User / Workplace / Membership

Execution Service ── API/event only ──> MarkReg (no shared database)
```

PostgreSQL is a recommended technology, not an implemented component. Core and MarkReg must use separate owned schemas/databases and credentials. Web and Gateway have no database credentials. Cross-service joins happen through contracts/APIs or admitted immutable snapshots, never SQL.

## Ownership map

| Boundary    | Owns in Milestone 2                                                                                            | Must not own                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Web product | route/view state and explicit user action                                                                      | authentication truth, permission truth, domain persistence |
| Gateway     | session validation, principal resolution, coarse route permission, aggregation and safe HTTP mapping           | Formal Matter, membership or audit data                    |
| Core        | User, Workplace, Membership, role references, sessions/service identities (final split gated)                  | Matter workflow                                            |
| MarkReg     | Customer Confirmation, Matter Draft, Formal Matter, admitted lineage snapshot, Matter idempotency/audit/outbox | credentials, Payment, external provider/office state       |
| Execution   | existing review/authorization/release/task-draft boundaries                                                    | Formal Matter and MarkReg database                         |

## Defense-in-depth request path

1. Web route requires a session but never treats hidden controls as authorization.
2. Gateway validates the opaque cookie, CSRF/origin for unsafe methods, active membership and route permission.
3. Gateway supplies tamper-resistant internal principal context; the public request body cannot override actor or Workplace.
4. MarkReg checks permission and source ownership on every command/query.
5. Repository APIs require `workplaceId`; queries include it.
6. Composite database keys/foreign keys enforce ownership. PostgreSQL RLS remains an owner decision.
7. Audit records the actor, Workplace, decision and correlation without secrets.

## Transaction and consistency boundary

`CreateFormalMatter` locks/validates the durable source version and atomically writes the Matter, complete immutable source snapshot, idempotency response, successful audit, and an outbox row only if event publication is approved. Failure rolls back all five. Publication after commit is asynchronous and at-least-once; consumers dedupe event ID. If outbox is deferred, no creation event is promised.

An ephemeral upstream record is never referenced as the only evidence. Fixture admission must materialize a schema-versioned snapshot and checksum in the transaction. Formal Matter is not an alias for Matter Draft and does not mutate it.

## Contract boundary (proposed)

- Command: `CreateFormalMatter { matterDraftId, matterDraftVersion, expectedSourceVersion, idempotencyKey, correlationId }`; principal is transport context, not caller-supplied payload.
- Result: `FormalMatter` version 1 with Workplace ownership and immutable `FormalMatterSourceSnapshot`.
- Errors: `UNAUTHENTICATED`, `FORBIDDEN`, `SOURCE_NOT_FOUND`, `STALE_SOURCE`, `SOURCE_INELIGIBLE`, `IDEMPOTENCY_CONFLICT`, `VERSION_CONFLICT`, `PERSISTENCE_UNAVAILABLE`.
- Event, if approved: `markreg.formal-matter.created.v1` in the shared envelope.
- No contract may imply Order, Invoice, Payment, appointment, Filing, Submission, application/number, provider assignment, message, external document or office contact.

## Deployment and test boundary

Local Compose already declares PostgreSQL 16, but runtime wiring, driver, migrations, health/readiness and CI database service are future tasks. Repository contract tests run against both adapters. Gateway acceptance uses real HTTP and PostgreSQL. Restart acceptance retains only the database, restarts runtime processes, and reloads the exact version. Browser acceptance uses a real session and no interception.

## Open architecture gates

PostgreSQL approval; driver/migration runner; Core-versus-dedicated session ownership; opaque session store; Workplace terminology; professional-review prerequisite; UUIDv7 versus ULID; database-per-service versus schema-per-service locally; RLS; and outbox/no-publication. These are deliberately not ADRs until owners approve enough evidence.
