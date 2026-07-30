# MO MVP Milestone 2 Scope Lock

**Status:** `PROPOSED`; owner decision gates remain open. **Predecessor:** `v0.1.0-milestone.1`.

## Baseline and evidence

TASK 016 synchronized `main` before branching. Main is `c704f9378e999fdd3589e6f72e1d4925b36a5eb4`, tree `9090a7e0181a34bbdf8dc53109f89cb5cbd5232d`; the annotated frozen tag resolves to the same commit and is an ancestor of `origin/main`. There are **zero** post-freeze commits and therefore no planning-affecting drift. The tag and Milestone 1 history remain untouched.

The recommendation follows the product lock, service ownership and implementation—not task summaries. The repository proves a fixture-only governed chain and explicitly reports persistence, authentication and formal Matter creation as residual gaps. PostgreSQL 16, Redis, NATS and MinIO exist only as Docker Compose resources. No application database driver, ORM, migration runner, authentication library, durable event publisher or durable repository exists. Core is a health-only skeleton; `ActorContext.workplaceId` is an asserted request field, not an authenticated principal.

## Decision and product boundary

**Recommended direction:** Option A, **Durable Authenticated Matter Operations**. No material repository objection was found. It closes the exact residual risk beneath every later commercial or external action while retaining MarkReg ownership and the Gateway boundary.

**Primary outcome:** an authenticated member of an authorized **Workplace** can explicitly create a Formal Matter from an eligible, exact-version governed Matter Draft; the Matter, immutable source snapshot, idempotency result and audit evidence survive restart; another Workplace cannot access it; and no Payment, Filing Submission or external-authority consequence occurs.

“Workplace” is recommended because existing contracts and canonical ownership use it. “Workspace” may describe the UI context, but it must not become a second tenant aggregate. Owner approval is required before implementation.

### Direction comparison

| Axis                   | A — durable authenticated operations                      | B — commercial transaction layer                      | C — external filing execution                                              |
| ---------------------- | --------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| Customer value         | Recoverable, accountable internal Matter operations       | Monetization and settlement visibility                | Filing delivery                                                            |
| Dependency             | Foundational identity, isolation, persistence             | Requires A plus commercial/financial authority design | Requires A plus provider/office, credentials and protected-action approval |
| Risk                   | Medium; bounded internal authority                        | High financial, tax, reconciliation and refund risk   | Very high legal, credential, transmission and Official Truth risk          |
| Complexity/testability | Medium-high; deterministic with real PostgreSQL           | High; provider sandboxes and financial ledgers        | Very high; external nondeterminism and jurisdiction variation              |
| Operational readiness  | Compose already names PostgreSQL, but adapters are absent | No billing dependency or owner boundary exists        | No provider/office integration exists                                      |
| Frozen-boundary fit    | Directly resolves fixture/auth/restart/formal-Matter gaps | Jumps over absent Formal Matter and durable identity  | Violates the deliberate non-submission boundary if rushed                  |
| Irreversible decisions | Tenant key, IDs, migrations, auth/session, audit/outbox   | Money ledger, contracting party, payment receiver     | Office/provider protocols and external authority semantics                 |
| Prerequisites          | Owner gates below                                         | A, Customer/Order/Invoice/Payment contracts           | A, provider appointment, protected-action review, office integration       |
| Stand-alone value      | Yes: durable case operations without commerce or filing   | Limited without operational Matter                    | Limited and unsafe without durable audit/authorization                     |

Options B and C remain alternatives, not combined scope.

## Current authoritative-record inventory

All implementations below use process-local `Map` repositories, random UUID-derived IDs, injected clocks in governed services, HTTP through Gateway/owning services, and no verified user or tenant isolation. Restart loses every record and idempotency key. “Events: none” means no domain event is emitted for that object; early intake/recommendation and legacy execution alone use the in-memory event publisher.

| Object                      | Owner / implementation                                  | Identity, version and lifecycle                                                                                                                                                     | Lineage / idempotency / authority                                                                                                                                                |
| --------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consultation (Intake)       | MarkReg / `InMemoryIntakeRepository` in service runtime | `intake_*`; no aggregate version; `RECEIVED`, `RECOMMENDATION_READY`, `FAILED`                                                                                                      | Actor-supplied Workplace; key+payload replay/conflict and in-flight coalescing; emits intake/recommendation events; no formal authority                                          |
| Recommendation / Plan       | MarkReg fixture recommendation and plan/quote maps      | recommendation is `FIXTURE_ONLY`; Plan Selection has ID/timestamp, no version                                                                                                       | Intake/recommendation exact IDs; command keys protect creation; recommendation event only; preparatory                                                                           |
| Quote                       | MarkReg in-memory quote repository                      | `quote_*`; version is represented externally by timestamp/string; `DRAFT`, `READY`, `CONFIRMED`, `EXPIRED`, `SUPERSEDED`                                                            | Intake, recommendation and plan IDs; confirmation replay guarded; confirmation expressly creates no order/payment/filing                                                         |
| Customer Confirmation       | MarkReg / `InMemoryMatterFlowRepository`                | `confirmation_*`, schema v1, `updatedAt` used as version; `DRAFT`, `CONFIRMED`, `WITHDRAWN`                                                                                         | Immutable quote/plan snapshot; create is idempotent with conflict; no event; no order/payment/appointment/filing                                                                 |
| Matter Draft                | MarkReg / same repository                               | `matter-draft_*`, schema v1, `updatedAt` is source version; `DRAFT`, `NEEDS_INFORMATION`, `READY_FOR_PROFESSIONAL_REVIEW`, `WITHDRAWN`                                              | Confirmation/customer; updates validate readiness, but have no command idempotency or optimistic expected-version contract; no event; explicitly not Formal Matter               |
| Professional Review Case    | Execution / `InMemoryProfessionalReviewRepository`      | `professional-review_*`, schema v1, `updatedAt`/decision timestamp source version; `QUEUED`, `IN_REVIEW`, `NEEDS_INFORMATION`, `REVIEWED_READY_FOR_NEXT_STEP`, `STALE`, `WITHDRAWN` | Immutable Matter Draft snapshot; create key replay/conflict and active-source dedupe; later mutations are not keyed/version-conditional; no event; assignment is not appointment |
| Document Package            | MarkReg / `InMemoryPreparationRepository`               | `document-package_*`, integer version; `DRAFT`, `NEEDS_DOCUMENTS`, `READY_FOR_CUSTOMER_CONFIRMATION`, `LOCKED_FOR_PREPARATION`, `STALE`, `WITHDRAWN`                                | Review decision, Draft and Confirmation versions; create key plus active-source dedupe; mutations increment version; no event or external document send                          |
| Instruction Ledger          | MarkReg / same repository                               | `instruction-ledger_*`, integer version; `DRAFT`, `CONFIRMED`, `LOCKED_FOR_PREPARATION`, `STALE`, `WITHDRAWN`                                                                       | Package/Draft/review versions; mutation versions but no general command keys; no event; records instructions only                                                                |
| Preparation Lock            | MarkReg / same repository                               | `preparation-lock_*`, schema v1; immutable snapshot, no independent numeric version (consumers derive a string)                                                                     | Exact package and ledger versions; lock operation prevents partial semantic progression only in one process; no event; next action is authority review, not submission           |
| Filing Authorization        | Execution / `InMemoryFilingGovernanceRepository`        | `filing-authorization_*`, integer version; `DRAFT`, `PENDING_CONFIRMATION`, `AUTHORIZED`, `WITHDRAWN`, `STALE`, `EXPIRED`                                                           | Lock/review snapshots; create and confirm keys, source-active dedupe and stale checks; no event; all 13 authority consequences false                                             |
| Execution Release           | Execution / same repository                             | `execution-release_*`, integer version; `DRAFT`, `BLOCKED`, `READY_FOR_RELEASE`, `RELEASED_FOR_EXECUTION`, `STALE`, `WITHDRAWN`                                                     | Authorization/lock/review versions; create and release-decision keys; no expected-version write contract/event; internal release only                                            |
| Filing Execution Task Draft | Execution / same repository                             | `filing-task-draft_*`, no version; `PREPARED`, `CANCELLED`, `STALE`                                                                                                                 | Created once from released execution snapshot; release id supplies natural dedupe; no event; draft is not Filing or submission                                                   |

### Infrastructure inventory

- Six service processes (Core, Knowledge, Capability Engine, Execution, MarkReg, MGSN), Gateway, and separate MarkReg/Lite Web apps are declared; the Milestone runtime starts Gateway, MarkReg, Execution and two Web apps plus Lite-facing flow dependencies.
- Gateway authenticates **in the intended architecture only**; its 57-route inventory currently marks milestone routes fixture-only unauthenticated. It aggregates HTTP and owns no domain state.
- `packages/contracts` carries shared transport types and the v1 event envelope. Consumers import those types rather than copying them.
- `packages/events` is only `EventPublisher` plus `InMemoryEventPublisher`; no broker adapter, consumer or outbox.
- `packages/config` only defines the workspace name and runtime-environment union. `service-kit` is a minimal Node HTTP/health/error runtime. `test-kit` is a package-name scaffold, not a database harness.
- All governed repositories are in-memory adapters. The environment guard `MO_MILESTONE_TEST_RUNTIME=1` protects snapshot evidence routes; CORS uses `WEB_ORIGINS`.
- Compose supplies PostgreSQL 16, Redis 7, NATS 2.10 JetStream and MinIO. There is no database dependency, migration tooling or authentication tooling in manifests/lockfile source usage.
- CI validates Node/pnpm and browser suites but declares no database service/container. Persistent integration tests and migration/restart orchestration do not exist.

## Primary acceptance journey

1. A user authenticates and selects a Workplace through a server-established principal.
2. MarkReg loads an eligible governed Matter Draft by `(workplaceId, matterDraftId, sourceVersion)` and verifies its Confirmation and immutable lineage.
3. A `Workspace Admin` or `Matter Manager` submits `CreateFormalMatter` with the source tuple, expected source version, correlation ID and idempotency key.
4. In one MarkReg-owned database transaction, the service creates Matter version 1 and its immutable source snapshot, records the idempotency result and append-only audit entry, and (subject to the outbox gate) records an event.
5. Duplicate identical input returns the same Matter; reuse with different input conflicts. A stale source fails without writes.
6. Runtimes stop and restart. The authenticated member reloads the exact Matter through Gateway; its ID, version and snapshot are identical.
7. a member of another Workplace receives a non-enumerating denial and cannot read or mutate it.
8. Evidence proves all prohibited consequences remain false.

**Desktop evidence:** an authenticated MarkReg operations route shows loading, eligible, creating, success/reload, stale, conflict, permission, partial-lineage, empty and service-error states; keyboard focus moves to the result/error summary. Desktop is the acceptance surface; mobile must remain usable but a new product IA is not designed in TASK 016. **API evidence:** real Gateway HTTP with secure authentication, typed client, status/error mapping, no interception and real PostgreSQL. **Service evidence:** repository/service tests show the transaction, snapshot, audit, key replay, version conflict and tenant scope. **Restart evidence:** create → stop MarkReg/Gateway → restart → exact GET. Storybook fixtures and Playwright implementation belong to TASK 024, not this documentation task.

## Formal Matter authority transition

| Field                 | Proposed lock                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Command               | `CreateFormalMatter` (owner must approve trigger semantics)                                                                                                                                                        |
| Actor / role          | Authenticated active Workplace member; `WORKSPACE_ADMIN` or `MATTER_MANAGER`; service identities cannot impersonate users                                                                                          |
| Source                | exact `matterDraftId`, `matterDraftVersion`, Confirmation ID/version and lineage checksum/snapshot                                                                                                                 |
| Required state        | Draft `READY_FOR_PROFESSIONAL_REVIEW`; Confirmation `CONFIRMED`; same Workplace; current, complete lineage. Whether completed professional review is additionally required is **open**                             |
| Blocks                | missing/mismatched/stale/withdrawn source; incomplete readiness; inactive membership; missing permission/key; duplicate active Matter for source; changed commercial scope; unavailable database/audit transaction |
| Result                | MarkReg-owned `FormalMatter { schemaVersion, matterId, workplaceId, customerId, sourceSnapshot, status, version, createdBy, createdAt, updatedAt }`                                                                |
| ID/version            | application-generated UUIDv7/ULID-style opaque `matter_*` recommended, database unique; initial `version: 1`; exact algorithm open pending driver/tool choice                                                      |
| Initial status        | `OPEN_FOR_INTERNAL_OPERATIONS` recommended; owner approval required                                                                                                                                                |
| Audit                 | actor/principal/role, action, aggregate, before/after version, source tuple, time, correlation, key, outcome/failure                                                                                               |
| Isolation             | Workplace is part of every repository key/query and composite database constraints                                                                                                                                 |
| Idempotency           | unique `(workplace_id, command_name, idempotency_key)` stores request hash and stable result; same hash replays, different hash `IDEMPOTENCY_CONFLICT`                                                             |
| Staleness/concurrency | source version mismatch `STALE_SOURCE`; unique source tuple prevents duplicate; later writes use `WHERE version = expectedVersion`, otherwise `VERSION_CONFLICT`                                                   |
| Event                 | proposed `markreg.formal-matter.created.v1`; publication/outbox is gated, never a substitute for the committed aggregate/audit                                                                                     |

Creation does **not** create Order, Invoice, Payment, professional appointment, Filing, Filing Submission, official application/number, external provider assignment, customer message, external document transmission or trademark-office contact.

## Identity and authorization recommendation

- **User:** human identity and credential subject. **Workplace:** tenant/customer-relationship boundary. **Membership:** active User↔Workplace relation with one bounded role. **Role:** `WORKSPACE_ADMIN`, `MATTER_MANAGER`, `REVIEWER`, `READ_ONLY`. **Permission:** stable service-checked capabilities derived from role, initially `matter:create/read/update`, `review:read/act`, `membership:manage`, `audit:read`.
- **Session/Principal:** server-verified user, session ID, active Workplace, membership/role, authentication time and correlation context. Never accept actor/Workplace identity solely from request JSON.
- **Service identity:** separately authenticated machine subject with explicitly granted service-to-service audience; it does not gain a human role or cross-tenant wildcard by default.
- **Mechanism recommendation:** same-origin, opaque server-side session in `HttpOnly`, `Secure`, `SameSite=Lax` cookie; password hashes use a modern memory-hard algorithm. CSRF token/origin validation protects unsafe cookie-authenticated methods. Bearer tokens are reserved for service identities. Exact library/session store is open.
- **Enforcement:** Web route hides/guards UX; Gateway authenticates, resolves active membership and forwards signed/internal principal context; MarkReg reauthorizes every command/query; repository methods require Workplace and apply scoped predicates; database composite keys/foreign keys/RLS evaluation protect ownership; audit records both allowed and denied attempts without secrets. UI-only authorization is forbidden.
- Isolation is defense in depth: typed repository key + mandatory query scope + composite constraints/foreign keys + service/application checks. PostgreSQL RLS is an explicit open decision, not claimed as implemented.

## Persistence architecture recommendation

PostgreSQL 16 is the evidence-supported candidate because it is already in Compose and provides transactions, unique/composite constraints and row-version compare/update. Approval remains a gate because no driver or migration tool exists. Select a thin PostgreSQL driver and forward migration runner in TASK 017 after a short ADR; do not introduce an ORM by default.

- MarkReg owns Formal Matter, immutable source snapshot, idempotency and audit tables/schema. Core owns identity/Workplace/Membership persistence. No cross-service database reads; Gateway/Web never query PostgreSQL.
- Keep repository ports and run identical contract suites against memory and PostgreSQL adapters. A MarkReg application transaction covers Matter, snapshot, successful audit, idempotency result and outbox row if selected.
- Use integer aggregate version, `UPDATE ... WHERE workplace_id=? AND matter_id=? AND version=?`, affected-row check, and unique `(workplace_id,matter_id)`, `(workplace_id,source_draft_id,source_version)` and idempotency constraints.
- Normalize identity, ownership, lifecycle, versions, timestamps and indexed lineage keys. Store the complete immutable governed source snapshot in `jsonb` with schema version and checksum; never use mutable JSON as the only tenant/version key.
- Store UTC instants from an injected application clock, with database defaults only as a safety net. Tests fix the clock.
- Audit is append-only. A domain event communicates a committed business fact; audit is durable accountability evidence; application logs diagnose runtime behavior; traces correlate distributed work. Console output is not audit.
- Local development extends existing Compose. CI starts isolated PostgreSQL, applies migrations from empty, and allocates database/schema per worker. Tests roll back transactions or drop isolated schemas; restart tests use a retained database volume.
- Migrations are ordered, checksum-verified and forward-only in shared environments. A failed migration prevents startup. Rollback normally means application rollback/forward repair; destructive changes require expand/migrate/contract and backups. Seeds are separate and never run as migrations.
- Outbox recommendation: include a transactional outbox foundation only if Milestone 2 publishes Matter events. Direct publish after commit cannot guarantee delivery. Owner may defer publication entirely; it must not permit dual-write.

## Durability classification

| Record                                   | Classification           | Reason / consistency rule                                                                                    |
| ---------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Consultation, Recommendation/Plan, Quote | `MIGRATION_DEFERRED`     | Not needed to operate the new aggregate once the immutable admitted source snapshot is stored                |
| Customer Confirmation                    | `DURABLE_IN_MILESTONE_2` | Authority input must survive and be tenant-scoped, or be fully embedded; persistence is recommended          |
| Matter Draft                             | `DURABLE_IN_MILESTONE_2` | Explicit command source and eligibility/version check must survive restart                                   |
| Professional Review Case                 | `MIGRATION_DEFERRED`     | Formal Matter trigger dependency is open; if owner requires review, it becomes durable before creation ships |
| Document Package                         | `READ_THROUGH_FIXTURE`   | May remain demonstration data; never a live dependency of Formal Matter without snapshot admission           |
| Instruction Ledger                       | `READ_THROUGH_FIXTURE`   | Same snapshot rule                                                                                           |
| Preparation Lock                         | `MIGRATION_DEFERRED`     | Later filing-governance prerequisite, not required for internal Formal Matter creation                       |
| Filing Authorization                     | `REMAINS_TEST_ONLY`      | Milestone 1 authority demonstration only in M2 acceptance                                                    |
| Execution Release                        | `REMAINS_TEST_ONLY`      | External execution remains out of scope                                                                      |
| Filing Execution Task Draft              | `REMAINS_TEST_ONLY`      | No filing execution in M2                                                                                    |
| Formal Matter                            | `DURABLE_IN_MILESTONE_2` | New authoritative aggregate; it does not supersede or mutate Matter Draft                                    |

No durable record may point only to an ephemeral object. At admission the transaction stores the complete immutable source payload, IDs, versions, schema versions and checksum. A fixture may be read only to create that snapshot under an explicit fixture-conversion policy; afterward the durable Matter resolves from its snapshot, not from process memory. `SUPERSEDED_BY_FORMAL_RECORD` is intentionally unused: Matter Draft and Formal Matter have distinct authority.

## Audit, errors and reliability acceptance

`AuditRecord` is append-only and includes event ID, Workplace ID, actor ID/role, action, aggregate type/ID, previous/result version, source identity/version, UTC timestamp, correlation ID, idempotency key, outcome and structured failure code. Sensitive credentials and document content are excluded. Successful mutation and audit are atomic; audit-write failure rolls back the Matter. Denied attempts are recorded in a separate safe audit transaction where feasible without exposing resource existence.

| Case                         | Required result and error layer                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Identical duplicate          | Same result/ID, no second Matter/event; application replay, HTTP 200                              |
| Key with different input     | typed application `IDEMPOTENCY_CONFLICT`, HTTP 409                                                |
| Expected-version race        | one commit; loser typed domain `VERSION_CONFLICT`, HTTP 409                                       |
| Stale source                 | typed domain `STALE_SOURCE`, HTTP 409; zero writes                                                |
| Unauthorized/cross-Workplace | application `FORBIDDEN`/non-enumerating `NOT_FOUND`, HTTP 403/404 policy gate; zero domain writes |
| Database unavailable         | infrastructure failure mapped to retryable safe HTTP 503; no false success                        |
| Transaction/audit failure    | rollback aggregate, key and outbox; application `TRANSACTION_FAILED`, safe HTTP 503/500           |
| Restart during request       | retry with key returns committed result or executes once; never partial state                     |
| Failed migration             | infrastructure startup failure; service not ready and no later migration runs                     |
| Repeated event publication   | consumer dedupes `eventId`; outbox marks delivery without duplicating domain effect               |

## Test and security boundary

The pyramid is: pure contract/domain tests; one repository contract suite against memory and PostgreSQL; service tests for principal/permission, tenant scope, lineage, expected versions, idempotency, transaction/audit and all false consequences; real-HTTP Gateway tests with real PostgreSQL; migration tests from empty and every retained prior M2 schema; process restart tests; tenant-isolation/adversarial tests; and one real-runtime Playwright desktop path through authenticated UI without HTTP interception. Browser fixtures/Storybook cover all listed UI states, but they supplement—not replace—the real path.

Production and fixture auth are separate modes with a fail-closed production guard. Secrets come from environment/secret management, never repository values. Cookies follow the policy above; credential/session rotation, expiration, logout, brute-force throttling and test-user isolation are acceptance items. Logs/audits redact credentials, cookies, tokens and sensitive payloads. This milestone makes no security certification, SSO or production-DR claim.

## Migration and compatibility lock

Each owning service owns its schema history. Clean bootstrap applies all migrations then no production fixtures. Upgrade tests cover empty and each previous M2 schema. Fixture conversion is an explicit, idempotent command/tool that validates schema and captures a snapshot; test seeds remain separate. Milestone 1 in-memory adapters and tests remain compatible and the frozen tag stays reproducible. No frozen fixtures or tag/history are rewritten.

## Non-goals and later dependencies

| Non-goal                                                | Required later dependency                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Payment processing / invoice settlement / billing plans | Commercial ledger, payment provider, reconciliation/refund and financial authority contracts    |
| Automated Order creation                                | Approved Customer/Order boundary and contracting-party semantics                                |
| External office filing / application-number ingestion   | Protected-action approval, office adapter, receipt validation and Official Truth reconciliation |
| External attorney/provider appointment                  | MGSN eligibility/allocation plus appointment authority and conflict checks                      |
| Production document object storage                      | Retention, encryption, malware scan, access and deletion policy                                 |
| Email/SMS                                               | Consent, templates, delivery provider and communication-owner audit                             |
| AI Capability Engine                                    | Separate canon/evidence/version-lineage milestone; never automatic formal mutation              |
| Enterprise SSO                                          | Bounded IAM first, then OIDC/SAML/domain governance                                             |
| Multi-region / production DR                            | Deployment topology, RPO/RTO, backup/restore rehearsal                                          |
| Marketplace                                             | Provider/commercial governance and billing plans                                                |

## Owner decision gates

Before TASK 017: approve direction, PostgreSQL, Workplace terminology, task sequence and migration ownership. Before auth work: approve session mechanism/library and credential policy. Before Formal Matter contract: approve authority trigger, initial status, required professional-review state, ID algorithm and durable upstream set. Before event work: approve transactional outbox versus no publication. Recommendations are not implementation and every unresolved item remains open in the machine-readable plan.
