# MO MVP M4-WP-08 — Reliability Matrix

## Objective

Turn the governed Provider Execution path delivered by M4-WP-01 through M4-WP-07 into one exact-head, executable reliability gate before independent integration and authority audit.

The matrix covers the path from exact governed Execution source through MGSN Provider Registry / Service Package / Eligibility / explicit Allocation / authenticated Provider Acceptance / versioned Provider Return / exact Execution evidence handoff, plus the authenticated Gateway and trusted MGSN HTTP boundaries.

## Reliability dimensions

The hosted gate must prove all of the following on the exact PR head:

- owner-scoped MGSN and Execution migrations remain verified;
- stale Execution source, stale Provider/Supply truth and stale Provider Return lineage fail closed;
- concurrent competing Allocation commands serialize to one active Allocation;
- durable idempotency replays Allocation, Provider Return and evidence handoff identically;
- Provider identity is derived from the authenticated Provider Workspace and spoofing is rejected;
- decline/reallocation and Provider Return correction preserve historical versions;
- exact Provider Return ID/version/fingerprint and exact Execution Release / Filing Execution Task Draft lineage are required for evidence handoff;
- evidence receipts remain `PENDING_REVIEW` and audit evidence is append-only;
- Workspace and Provider Workspace isolation remain non-enumerating;
- Gateway outage or missing trusted MGSN authorization fails closed with controlled, redacted 503 responses;
- critical durable suites pass a second cycle against the same owner databases;
- the canonical authority boundary remains unchanged.

## Authority boundary

The reliability work package validates existing governed behavior; it does not add new business authority. In particular:

- Eligibility is not Allocation.
- Allocation is not Provider Acceptance.
- Provider Acceptance is not legal or professional appointment.
- Provider Return is provider evidence, not Official Truth.
- Evidence handoff is not filing submission and does not complete a Formal Matter.
- No Payment or Invoice truth is created.
- No automatic provider selection is introduced.
- No external filing or trademark-office truth is created.
- No user Capability is verified automatically.

No cross-service SQL is introduced. MGSN and Execution continue to own their own databases and exchange exact governed snapshots through bounded service contracts.

## Executable evidence

The matrix contains 17 executable scenario records covering authority, migrations, stale-source handling, concurrency, idempotency, authenticated provider identity, historical version retention, Provider Return, evidence handoff, append-only audit, tenant/provider isolation, Gateway controls, outage handling and repeatability.

Static scenario inventory:

- `docs/validation/MO-MVP-MILESTONE-004-RELIABILITY-MATRIX.json`

Aggregate runner:

- `scripts/run-milestone4-reliability.mjs`

Inventory validator:

- `scripts/validate-milestone4-reliability-matrix.mjs`

Hosted exact-head gate:

- `.github/workflows/milestone-4-reliability.yml`

The hosted workflow uploads `.artifacts/milestone-4-reliability.log` and `.artifacts/milestone-4-reliability-evidence.json` for each run.

## Exit criteria

M4-WP-08 is complete only when the focused exact-head Milestone 4 reliability workflow and all existing hosted repository gates pass on the same PR head with no temporary helper workflow or debug artifact committed.

After that, M4-WP-09 performs the independent integration and authority audit against the complete Milestone 4 implementation.
