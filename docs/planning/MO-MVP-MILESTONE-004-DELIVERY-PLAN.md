# MO MVP Milestone 4 Delivery Plan

**Status:** proposal accompanying TASK 029. No Milestone 4 implementation starts until the scope lock is approved.  
**Direction:** `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`.  
**Baseline:** `505962ff146980a64b9cf6e08259068146612d05`.

## Delivery principles

Milestone 4 closes the governed provider-delivery loop without claiming financial or official filing authority.

The implementation sequence must preserve:

- Provider Return is not Official Truth;
- Provider Supply Capability is not user Capability evidence;
- Payment is not performance, authority, acceptance or completion;
- legal/professional appointment is distinct from internal MGSN Allocation;
- MarkReg owns Matter truth;
- Execution owns filing-governance preparation and evidence review;
- MGSN owns provider-network operational truth;
- Core owns identity, Workspace, Membership and Principal truth;
- Gateway is transport/policy, never domain owner;
- database-per-owner isolation;
- exact source/version lineage and deterministic replay;
- protected state changes require explicit authenticated commands;
- AI may recommend/compare but cannot allocate, accept, certify or create Official Truth.

Milestone-local work-package IDs avoid collision with the historical global task inventory.

## Staged rollout

| Stage | Work package | Deliverable | Acceptance | Rollback boundary |
| ---: | --- | --- | --- | --- |
| 1 | `M4-WP-01` | provider-execution contracts and authority fixtures | publication/canon vocabulary audit, source/version contracts, false Official Truth fixtures | additive contracts removable while unused |
| 2 | `M4-WP-02` | durable authenticated Execution filing-governance source | PostgreSQL persistence for Filing Authorization / Execution Release / Task Draft, auth, audit, restart | forward repair after shared migration |
| 3 | `M4-WP-03` | durable MGSN Provider Registry + Supply Capability | owner DB, Core identity reference, version/effective period, suspension, audit | disable MGSN writes; retain rows |
| 4 | `M4-WP-04` | Service Package + Eligibility | exact Execution source admission, deterministic eligibility, explainable non-mutating evaluation | disable package admission/evaluation |
| 5 | `M4-WP-05` | Allocation + Provider Acceptance | explicit authorized allocation, provider-authenticated accept/decline, reallocation policy | disable allocation commands |
| 6 | `M4-WP-06` | Provider Return + Execution evidence handoff | exact accepted allocation lineage, return versioning/correction, idempotent evidence handoff | stop handoff; retain source return |
| 7 | `M4-WP-07` | authenticated Gateway + controlled operations/provider journey | tenant/provider isolation, typed client, minimal real-runtime workflow, no public marketplace | remove routes/UI only |
| 8 | `M4-WP-08` | reliability matrix | migration/restart/outage/concurrency/isolation/handoff/repeatability/browser exact-head evidence | test/orchestration only |
| 9 | `M4-WP-09` | independent integration/authority audit | ownership, semantics, evidence, no finance/no Official Truth leakage, GO/FIX/HOLD | documentation only |

## M4-WP-01 — Provider execution contract and authority boundary

### Objective

Freeze the minimum shared contract surface for one trademark-service provider execution loop without inventing a second identity model or official filing truth.

### Required work

- audit accepted publication vocabulary before freezing exact enums;
- add or extend shared contracts for:
  - Provider reference/profile identity;
  - Provider Supply Capability;
  - Service Package;
  - Eligibility Evaluation;
  - Allocation;
  - Provider Acceptance / decline;
  - Provider Return;
  - exact Evidence Handoff reference;
- preserve exact source IDs, versions, fingerprints and correlation context;
- define typed command/error vocabulary;
- define authority-consequence fixtures proving:
  - eligibility does not allocate;
  - allocation does not equal acceptance;
  - acceptance does not equal legal/professional appointment;
  - Provider Return does not equal Official Truth;
  - evidence handoff does not equal filing submission or Matter completion.

### Compatibility

Reuse existing `ExecutionRelease`, `FilingAuthorization`, `FilingExecutionTaskDraft`, `FormalMatter`, evidence and Principal contracts where they already own meaning. Do not create duplicate API types.

## M4-WP-02 — Durable authenticated Execution filing-governance source

### Objective

Replace the current in-memory-only Filing Authorization / Execution Release / Filing Execution Task Draft persistence boundary with durable Execution-owned truth suitable for MGSN source admission.

### Required persistence

- Execution DB migrations only;
- Filing Authorization records and exact preparation source snapshot/version;
- Execution Release, checks, assignment and explicit release decision;
- Filing Execution Task Draft;
- Workspace-scoped idempotency/result evidence;
- protected mutation success/denial audit.

### Required behavior

- authenticated Workspace Principal on protected reads/mutations;
- actor/workspace spoof rejection;
- optimistic concurrency;
- exact-source staleness checks;
- idempotent replay and conflicting-key rejection;
- restart/reconnect recovery;
- current source invalidation makes dependent mutable records stale under existing semantics;
- `RELEASED_FOR_EXECUTION` remains internal authority to prepare/perform work, not proof of external submission.

### Prohibited

- Execution reading MarkReg tables directly;
- MGSN tables in Execution DB;
- external office credentials/transmission;
- hidden payment or invoice lifecycle.

## M4-WP-03 — Durable MGSN Provider Registry and Supply Capability

### Objective

Turn MGSN from a service skeleton into the durable owner of private provider-network supply truth.

### Required provider data

- provider ID;
- referenced Core Workspace/organization identity;
- active/suspended state;
- jurisdictions and service types;
- versioned Supply Capability;
- effective period;
- bounded capacity/availability inputs needed by eligibility;
- evidence references / verification state appropriate to supply operations;
- created/updated actor/timestamps;
- audit and idempotency evidence.

### Required protections

- same provider identity cannot be silently duplicated;
- suspended/inactive supply is ineligible;
- Supply Capability cannot be projected as user Capability evidence;
- no public ranking or star score;
- no automatic professional qualification.

## M4-WP-04 — Service Package and deterministic Eligibility

### Objective

Admit one exact governed Execution source into MGSN and determine provider eligibility without performing allocation.

### Service Package source

The package must preserve exact current source lineage such as:

- Workspace;
- Formal Matter reference/version where available;
- Preparation Lock reference/version where required;
- Filing Authorization reference/version;
- Execution Release / Filing Execution Task Draft reference/version;
- jurisdiction and service scope;
- immutable document/instruction references or bounded snapshot;
- requested execution window;
- Channel / Relationship Model lineage where applicable;
- source fingerprint.

MGSN receives this through a bounded API/contract; it never reads MarkReg or Execution databases.

### Eligibility

Eligibility must:

- use exact Provider Supply Capability version/effective period;
- record deterministic checks/reasons;
- fail closed on missing/stale source;
- remain non-mutating with respect to Allocation;
- produce a bounded list/result safe for authorized operator review;
- support identical replay.

AI may rank or explain eligible options only as a recommendation layer. It cannot create the Allocation command.

## M4-WP-05 — Allocation and Provider Acceptance

### Objective

Create one explicit governed internal provider assignment and record the provider's own acceptance/decline.

### Allocation rules

- allocation is an explicit authenticated command;
- selected provider must have a current eligible result for the exact Service Package version;
- expected versions are required;
- one active allocation per bounded initial service-package path unless a governed reallocation policy closes the previous one;
- allocation includes decision actor, rationale and exact source evidence;
- conflicting concurrent allocations resolve deterministically;
- allocation is internal MGSN operational truth, not legal/professional appointment.

### Acceptance rules

Provider acceptance/decline must:

- bind authenticated provider identity to the allocated provider record;
- reject caller-supplied identity spoofing;
- preserve exact allocation/package version;
- be idempotent;
- record acknowledgement/evidence/time;
- expose decline/reallocation as explicit governed paths.

Acceptance does not imply payment, work completion, office filing or office acceptance.

## M4-WP-06 — Provider Return and evidence handoff

### Objective

Capture a durable provider work return and hand its evidence to Execution for human/professional review without manufacturing Official Truth.

### Provider Return

Required fields/evidence include:

- Provider Return ID/version;
- exact Service Package / Allocation / Acceptance lineage;
- provider identity;
- work-status claim;
- returned artifacts/evidence references;
- structured provider assertions;
- timestamps and checksum/fingerprint;
- correction/supersession link rather than destructive edit;
- command/audit evidence.

A return may contain a claim that a filing or external action occurred, but that claim remains provider evidence. MGSN cannot set official filing/application-number truth.

### Execution evidence handoff

Execution consumes an exact Provider Return ID/version/fingerprint and creates a reviewable evidence receipt/candidate using existing evidence ownership where possible.

The handoff must:

- be idempotent;
- tolerate response loss and retry;
- reject stale/superseded return versions;
- preserve provider provenance;
- require explicit review before any downstream protected consequence;
- never automatically complete Formal Matter or set official filing truth.

No cross-service SQL or distributed transaction is claimed.

## M4-WP-07 — Authenticated Gateway and controlled journey

### Objective

Expose the new provider loop through product-safe authenticated boundaries without creating a public marketplace.

### Required API families

Exact route namespaces follow repository Gateway policy. Required capabilities include:

- provider/supply registry read/write for authorized operators;
- Service Package create/read;
- eligibility evaluate/read;
- allocation create/read/cancel/reallocate where implemented;
- provider acceptance/decline;
- Provider Return create/read/correct/supersede where implemented;
- evidence handoff status/read.

Gateway resolves Core Principal truth and forwards only bounded internal identity/context.

### UI / real-runtime target

The first M4 user journey may use controlled operations surfaces plus authenticated provider actions. It must not introduce a public provider marketplace.

Any new UI must cover loading, empty, permission, stale source, version conflict, provider unavailable, service outage, success and mobile 390px states where applicable.

A real-runtime acceptance path must use real Core + Gateway + Execution + MGSN + owner PostgreSQL databases with zero request interception.

## M4-WP-08 — Reliability and migration matrix

### Objective

Prove the provider loop is durable governed system truth rather than a fixture or UI-only workflow.

### Required scenario groups

- Execution governance migration from current schema;
- MGSN migration from empty/current schema;
- provider registry restart;
- Service Package / eligibility restart;
- allocation/acceptance restart;
- Provider Return / evidence handoff restart;
- startup and runtime owner-database outages;
- exact-source staleness;
- concurrent duplicate provider/package/allocation commands;
- idempotency conflict;
- optimistic version conflict;
- provider/Workspace isolation and non-enumeration;
- lost-response/retry around cross-service evidence handoff;
- Provider Return correction/supersession;
- repeated deterministic execution;
- real-runtime browser/API path as applicable;
- exact-head evidence.

The aggregate is fail-fast and database-per-owner.

## M4-WP-09 — Independent integration and authority audit

### Objective

Audit the exact merged M4 implementation against scope, canonical semantics, owner boundaries and authority consequences.

### Required dimensions

- Provider / Supply Capability semantic fidelity;
- Service Package source lineage;
- deterministic eligibility;
- allocation vs acceptance separation;
- provider identity and Workspace isolation;
- Execution/MGSN ownership;
- Provider Return provenance and correction semantics;
- evidence handoff replay/recovery;
- no user Capability contamination;
- no Payment/Invoice leakage;
- no legal/professional appointment inference;
- no Official Truth / filing submission inference;
- browser/API recovery evidence;
- exact-head CI and reproducibility;
- documentation drift.

The audit may recommend `GO`, `FIX` or `HOLD`. It cannot tag, release, appoint a provider legally, transmit a filing or create financial truth.

## Cross-cutting acceptance rules

### Authority

An eligibility result is advisory system truth about eligibility only. An explicit Allocation command creates internal provider allocation truth. An authenticated Provider Acceptance creates provider acceptance truth. A Provider Return creates provider evidence truth only.

### Official truth

Provider Return is never sufficient to set:

- filing submitted;
- official application created;
- application number received;
- office acceptance;
- trademark-office contact as verified system truth.

Those require a later separately scoped official-truth ingestion/external-action boundary.

### Finance

No M4 state is equivalent to paid, invoiced, settled or compensated. Provider compensation is outside scope.

### Legal appointment

MGSN Allocation/Acceptance is not by itself a power of attorney, local representative appointment or legal engagement with a trademark office.

### Events

Process-local events are allowed after successful commit. Cross-service handoffs must be re-drivable and idempotent. No global exactly-once delivery claim is introduced.

### Security

Every durable protected query/mutation is owner-scoped, authenticated and authorized. Request bodies cannot override authenticated actor, Workspace or provider identity.

### Generated artifacts

Browser reports, screenshots, traces and logs remain CI artifacts, not tracked source.

## Exit

Milestone 4 exits only after one exact implementation tree proves:

```text
current governed Execution source
-> durable MGSN Service Package
-> deterministic Eligibility
-> explicit Allocation
-> authenticated Provider Acceptance
-> durable Provider Return
-> exact Execution evidence handoff
-> restart/recovery
```

while `Provider Return != Official Truth`, `Payment != performance/authority/completion`, user Capability truth remains untouched, and no external filing or legal-representation consequence occurs automatically.
