# M4-WP-03 — Durable MGSN Provider Registry and Supply Capability

**Milestone:** MO-MVP-MILESTONE-004
**Direction:** `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`
**PR:** #51
**Status:** IMPLEMENTED_IN_PR_51

## Objective

Make MGSN the durable owner of private provider-network supply truth before Service Package admission and deterministic Eligibility.

## Ownership and identity

Core remains owner of Workspace identity. MGSN stores only a bounded `providerWorkspaceId` reference, never reads Core tables and does not duplicate Core identity. Provider creation requires an active Core Workspace reference; reactivation rechecks that source. A unique database constraint prevents duplicate Provider binding to one Core Workspace.

MGSN owns Provider records, versioned Provider Supply Capability, durable idempotency response evidence and append-only registry audit evidence in its own database.

## Provider Registry and Supply Capability

Provider records use server-generated IDs, `ACTIVE` / `SUSPENDED` / `INACTIVE` state, optimistic versions, actor lineage and timestamps. `INACTIVE` is terminal in this M4 boundary.

Supply Capability revisions create immutable historical versions and one current version. Each version carries an exact Provider reference snapshot, normalized jurisdictions/service types, effective period, capacity/availability, evidence references, supply verification state and SHA-256 fingerprint.

`VERIFIED_FOR_SUPPLY` is private MGSN operating verification only. It is not user Capability evidence and is not automatic professional qualification.

## Reliability and authority boundary

Migration `0028_mgsn_provider_registry` belongs only to `@markorbit/mgsn-service`. The durable repository enforces optimistic concurrency, exact idempotency replay/conflict detection, history reads, provider identity uniqueness, append-only audit and 503-class persistence outage semantics.

Suspended/inactive Provider state or suspended/retired supply cannot be treated as operationally eligible input. Full deterministic Eligibility remains M4-WP-04.

WP-03 does not create Allocation, Provider Acceptance, legal/professional appointment, Payment, Invoice, Filing submission, official application truth, user Capability verification or Official Truth.

## Contract correction

WP-01 typed `providerWorkspaceId` as `MarkOrbitId`, while Core Workspace IDs are UUID/string identities. WP-03 corrects the shared provider-execution contract to Core's actual `string` identity type and consumes it through the published `@markorbit/contracts/provider-execution` subpath.

## Evidence

`pnpm test:mgsn-provider-registry:postgres` proves migration ownership, Core identity validation, duplicate prevention, durable replay/conflict behavior, suspension/reactivation, optimistic versioning, immutable Supply Capability history, bounded supply inputs, operational ineligibility, append-only audit and outage mapping.

Final acceptance is the clean PR #51 head passing repository-required CI with no temporary helper workflow retained.

## Next dependency

After PR #51 merges with green hosted gates, continue with **M4-WP-04 — Service Package and deterministic Eligibility**.
