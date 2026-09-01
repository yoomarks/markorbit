# markreg

MarkReg is the MarkOrbit product service for the Full-Lifecycle International Trademark Product. Current repository maturity is uneven: authenticated Customer Confirmation, Order, Formal Matter, durable Document Package and lifecycle substrates exist, while the early Intake → Recommendation → Quote funnel is still fixture/planning truth and must not be represented as production truth.

The Documents → Preparation boundary is intentionally fail closed in the durable runtime. Document Packages are PostgreSQL-backed through `READY_FOR_PREPARATION_LOCK`, but durable Preparation Lock persistence is not yet admitted. The historical process-local Preparation / Instruction Ledger / Preparation Lock implementation remains fixture-only and must not be treated as production truth. Shared dependency #457 tracks the durable Preparation Lock persistence and contract foundation.

The service is an independent deployable owner domain. It must not import another service's implementation or read another service's database. Workspace identity, Execution, Payment, MGSN, Knowledge, Capability and Official Truth remain owned by their respective domains and are consumed only through governed contracts.

Current early-funnel production boundary: [Intake → Recommendation → Quote Production Truth V1](docs/INTAKE-RECOMMENDATION-QUOTE-PRODUCTION-TRUTH-V1.md).
