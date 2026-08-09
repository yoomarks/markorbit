# M4-WP-05 — Explicit Allocation and Authenticated Provider Acceptance

**Milestone:** MO-MVP-MILESTONE-004  
**Direction:** `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`  
**Status:** implementation in progress

## Objective

Create one explicit governed MGSN Allocation from exact current Service Package and ELIGIBLE truth, then record the allocated Provider's own authenticated ACCEPTED or DECLINED response without creating legal appointment, payment, filing or Official Truth.

## Allocation authority

Allocation is an explicit internal MGSN command. The service requires the exact current Service Package version/fingerprint, exact ELIGIBLE evaluation version/fingerprint, current Provider record and current Provider Supply Capability version/fingerprint.

The implementation fails closed when:

- the Service Package is stale, changed or belongs to another Workspace;
- the Eligibility Evaluation is not `ELIGIBLE` or does not match the exact package/provider/supply lineage;
- Provider state changed after evaluation or is no longer active;
- Supply Capability is no longer the exact current active/verified/available version;
- another active Allocation already exists for the Service Package;
- an idempotency key is reused with a different request.

PostgreSQL locks the Service Package row before checking/inserting the active Allocation and also enforces a unique partial index for one current active Allocation per Service Package.

## Authenticated Provider response

The Provider response command never accepts a caller-supplied Provider ID. Runtime identity is supplied separately as an authenticated Provider principal containing the Core Provider Workspace reference and server-owned actor ID. MGSN resolves that Workspace through its private Provider Registry and rejects mismatches.

An ACCEPTED response keeps the exact Allocation active for the later Provider Return path. A DECLINED response atomically:

1. records the exact Provider Acceptance/Decline against the Allocation version the Provider saw;
2. preserves that Allocation version as historical truth;
3. writes a new current `SUPERSEDED` version for the same Allocation ID;
4. releases the Service Package for a later explicit reallocation command.

The decline path does not silently select or allocate another Provider.

## Durability and evidence

Migration `0030_mgsn_allocation_provider_acceptance` belongs only to `@markorbit/mgsn-service` and adds:

- versioned `mgsn_allocations`;
- `mgsn_provider_acceptances`;
- durable command/idempotency evidence;
- append-only Allocation/Acceptance audit.

Real PostgreSQL coverage exercises migration ownership, exact eligible allocation, idempotent replay, current Provider/Supply fail-closed behavior, competing concurrent allocations, authenticated Provider identity mismatch, durable acceptance, decline/supersession/reallocation, repository recreation and append-only audit.

## Authority boundary

WP-05 creates internal provider-network operational truth only.

It does **not** create:

- legal or professional appointment;
- Payment or Invoice;
- filing submission or trademark-office contact;
- official application/application-number truth;
- Provider Return or Execution evidence handoff;
- automatic Formal Matter completion;
- user Capability verification;
- Official Truth.

`Allocation != Provider Acceptance != legal/professional appointment != Filing != Official Truth` remains governing truth.
