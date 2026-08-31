# markreg

MarkReg is the MarkOrbit product service for the Full-Lifecycle International Trademark Product. Current repository maturity is uneven: the authenticated Confirmation / Order / Matter / preparation / lifecycle substrate is substantially durable, while the early Intake → Recommendation → Quote funnel is still fixture/planning truth and must not be represented as production truth.

The service is an independent deployable owner domain. It must not import another service's implementation or read another service's database. Workspace identity, Execution, Payment, MGSN, Knowledge, Capability and Official Truth remain owned by their respective domains and are consumed only through governed contracts.

Current early-funnel production boundary: [Intake → Recommendation → Quote Production Truth V1](docs/INTAKE-RECOMMENDATION-QUOTE-PRODUCTION-TRUTH-V1.md).
