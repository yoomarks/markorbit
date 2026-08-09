# M4-WP-02 — Durable Authenticated Execution Filing Governance

**Milestone:** MO-MVP-MILESTONE-004  
**Direction:** `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`  
**PR:** #50  
**Status:** IMPLEMENTED_IN_PR_50

## Objective

Make the existing Filing Authorization, Execution Release and Filing Execution Task Draft lifecycle durable and authenticated inside the Execution owning service before any MGSN Service Package may rely on it as source evidence.

This work package closes the process-local persistence gap. It does not create provider-network runtime behavior or external filing authority.

## Runtime ownership

- **Execution** owns Filing Authorization, Execution Release, Filing Execution Task Draft, command/idempotency evidence and filing-governance audit evidence.
- **MarkReg** remains owner of Preparation Lock source truth and is consumed through its service boundary, never by cross-service SQL.
- **Core** remains owner of User / Workspace / Membership / Principal truth.
- **Gateway** product integration remains deferred to M4-WP-07.
- **MGSN** receives no tables or write authority in this work package.

## Persistence

Migration `0027_execution_filing_governance.sql` is owned by `@markorbit/execution-service` and adds only Execution-owned data:

- `filing_authorizations`;
- `execution_releases`;
- `filing_execution_task_drafts`;
- `filing_governance_commands`;
- append-only `filing_governance_audit`.

All durable records are Workspace-scoped. Same-Workspace foreign keys and active-source uniqueness prevent cross-tenant relationship fabrication. Command fingerprints use SHA-256 and the audit table rejects update/delete mutation.

The authoritative Filing Authorization payload is stored in `authorization_record`; the name deliberately avoids PostgreSQL reserved-keyword ambiguity.

## Authentication and authorization

When the durable repository factory is enabled, Execution requires a trusted internal caller plus encoded Workspace Principal. The service derives Workspace and actor identity from that Principal rather than trusting request-body values.

Permissions are explicit:

- `execution:read` for reads;
- `execution:manage` for protected mutations.

Workspace declarations in trusted transport headers and request bodies are validated independently. A mismatch is rejected non-enumerating and recorded as bounded denial audit evidence.

Confirmation acknowledgement actor and release decision actor are server-controlled from Principal truth; spoofed body actor values cannot replace them.

## Durability and concurrency

The implementation provides:

- exact Preparation Lock ID/version/snapshot lineage;
- durable create/confirm/release idempotency across service recreation;
- deterministic idempotency conflict rejection;
- version increments on mutable Filing Authorization / Execution Release transitions;
- explicit `expectedVersion` optimistic concurrency for Execution Release assignment;
- exact-source invalidation to durable `STALE` state;
- release-decision and Filing Execution Task Draft recovery after repository/runtime recreation;
- persistence outage mapping to `PERSISTENCE_UNAVAILABLE` / HTTP 503 semantics;
- append-only success and denial audit evidence.

A released internal decision may repair a missing task draft on identical replay, but it cannot manufacture any external filing or Official Truth consequence.

## Authority boundary

`RELEASED_FOR_EXECUTION` means only that the governed internal Execution checks and explicit release decision have completed.

It does **not** mean:

- a filing was submitted;
- a trademark office was contacted;
- an official application exists;
- an official application number was received;
- a provider was externally assigned;
- a legal/professional representative was appointed;
- Payment or Invoice truth exists;
- Provider Return exists;
- Official Truth exists.

All existing false authority consequences remain false.

## Evidence

Focused implementation evidence passed before final PR-head validation:

- authenticated Execution boundary: 4/4 tests;
- real PostgreSQL filing-governance suite: 9/9 tests.

The PostgreSQL suite proves:

1. Execution-owned migration load/verification;
2. exact-source durable authorization reload;
3. confirmation idempotency across service recreation;
4. optimistic concurrency conflict;
5. released decision and task-draft restart recovery;
6. durable stale invalidation;
7. cross-Workspace non-enumerating reads and denial audit;
8. append-only audit enforcement;
9. database outage semantics.

Permanent CI commands:

```bash
pnpm test:filing-governance:auth
pnpm test:filing-governance:postgres
```

Final acceptance is the clean PR #50 head passing repository-required CI. Temporary helper workflows used during implementation are not part of the PR tree.

## Non-goals preserved

- MGSN Provider Registry / Supply Capability;
- MGSN Service Package / Eligibility;
- Allocation or Provider Acceptance;
- Provider Return or Evidence Handoff;
- Gateway/customer/provider product journey;
- Payment / Invoice;
- external document dispatch;
- trademark-office integration or filing submission;
- Official Truth creation;
- milestone tag, release or deployment freeze.

## Next dependency

After PR #50 is merged with clean hosted gates, the next approved work package is **M4-WP-03 — Durable MGSN Provider Registry and Supply Capability**.
