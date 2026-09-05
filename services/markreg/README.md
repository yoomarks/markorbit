# markreg

MarkReg is the MarkOrbit product service for the Full-Lifecycle International Trademark Product. Current repository maturity is uneven: durable Production Intake, authenticated Customer Confirmation, Order, Formal Matter, Document Package, Preparation Lock and lifecycle substrates exist, while production Recommendation / Quote remain explicitly gated and must not be substituted with legacy fixture or synthetic intelligence truth.

The Documents → Preparation boundary is now durable in production. `READY_FOR_PREPARATION_LOCK` Document Packages can create/read/validate PostgreSQL-backed Preparation Locks through the dedicated durable owner service. The historical process-local Preparation / Instruction Ledger / nested Preparation Lock model remains fixture-only and must not be treated as production compatibility truth. Durable Preparation Lock still creates no Filing Authorization, Execution Release, filing, Payment, provider contact or Official Truth by consequence.

The service is an independent deployable owner domain. It must not import another service's implementation or read another service's database. Workspace identity, Execution, Payment, MGSN, Knowledge, Capability and Official Truth remain owned by their respective domains and are consumed only through governed contracts.

Current early-funnel production boundary: [Intake → Recommendation → Quote Production Truth V1](docs/INTAKE-RECOMMENDATION-QUOTE-PRODUCTION-TRUTH-V1.md).

Current first post-Matter boundary: [Examination Stage V1 — governed product truth boundary](docs/EXAMINATION-STAGE-V1.md). Examination workflow projection is internal MarkReg product truth and is never trademark-office Official Status.
