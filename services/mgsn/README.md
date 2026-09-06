# MGSN service

MGSN owns governed private provider-network operational truth: Provider Registry, Supply Capability, Service Package, Eligibility, Allocation, Provider Acceptance and Provider Return, together with the post-#358 governed network progression for Participation/Visibility, Provider Discovery, explicit Human Provider Selection, Controlled Privacy Handoff and governed Allocation admission.

## Current state

The principal current-state map is [Current State & Phase 2 Audit](docs/CURRENT-STATE-PHASE2.md). It distinguishes what is implemented, productized, internal-only, boundary-only and live-deferred on current `main`.

The original V1 design documents under [`docs/`](docs/) preserve the architecture/authority decisions made when each slice was introduced. Some of their opening status text is intentionally historical and may describe a feature as a future boundary even though the corresponding owner/runtime implementation has since landed. Use the current-state map first, then read the V1 documents for the frozen semantics and authority locks.

## Durable owner substrate

The MGSN durable runtime owns Provider Registry and versioned Supply Capability in the MGSN owner database. Provider identity references Core Workspace truth through bounded service dependencies; MGSN does not duplicate Core identity or read another service database.

Provider Supply Capability is private supply-side operating truth only. It is not user Capability evidence, professional qualification, legal appointment, Allocation, Filing, Official Truth, Payment or Invoice truth.

## Governed network progression

Post-#358 MGSN implements the non-live governed path:

`Participation + Visibility -> explainable Discovery -> explicit Human Selection -> Controlled Privacy Handoff -> governed Allocation -> Provider Work / Acceptance / Return`

Contextual Trust Evidence may support Discovery explanation, but it does not create a universal score, ranking, winner or protected-action authority. Candidate != Selection; Selection != Handoff; Selection != Allocation; Handoff != Allocation; Allocation != Acceptance; Acceptance != appointment; Provider Return != Official Truth.

Public/live Provider contact, Filing, Payment, appointment and Official Truth remain outside this service boundary unless a separately reviewed owner flow explicitly authorizes them.
