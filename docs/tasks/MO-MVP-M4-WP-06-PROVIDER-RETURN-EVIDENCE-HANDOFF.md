# M4-WP-06 — Provider Return and exact Execution evidence handoff

## Objective

Capture a durable, provider-authenticated work return in MGSN and hand the exact current Provider Return version/fingerprint to Execution as reviewable evidence without manufacturing Official Truth.

## Ownership

- MGSN owns Provider Return, correction lineage, provider provenance, idempotency and audit.
- Execution owns the durable evidence receipt/review candidate and handoff idempotency.
- MarkReg remains owner of Formal Matter truth.
- Core remains owner of Workspace/Principal identity.
- No service reads another owner's database.

## Required behavior

1. Provider Return requires the exact current ACTIVE Allocation and exact authenticated ACCEPTED Provider Acceptance.
2. Provider identity comes from authenticated Provider Workspace Principal context, never a caller-supplied provider ID. A mismatched authenticated Provider Workspace fails explicitly with `PROVIDER_IDENTITY_MISMATCH`; it is not collapsed into allocation staleness.
3. A return contains a work-status claim plus at least one artifact or structured assertion.
4. Corrections are additive versions linked through `supersedes`; historical versions are retained.
5. Evidence handoff accepts only the exact current Provider Return ID/version/fingerprint and exact admitted Execution Release / Filing Execution Task Draft lineage.
6. Execution persists one retry-safe evidence receipt with provider provenance and `PENDING_REVIEW` status.
7. Response loss is safe: retrying the same handoff idempotency key returns the same durable receipt.
8. Stale/superseded return versions and changed fingerprints fail closed.

## Authority boundary

Provider Return and evidence handoff remain internal evidence truth. They do not automatically create Payment, Invoice, legal/professional appointment, external filing, official application/application-number truth, trademark-office acceptance, Formal Matter completion or user Capability verification.

## Persistence

- `0031_mgsn_provider_return.sql` — MGSN-owned versioned Provider Return, command evidence and append-only audit.
- `0032_execution_provider_return_evidence.sql` — Execution-owned evidence receipt, retry-safe command evidence and append-only audit.
- Historical MGSN and Milestone 2 suites explicitly clean later owned WP06 relations before replaying owner migrations, so test namespaces remain isolated without weakening production migration semantics.
- The Professional Review real-runtime bootstrap also removes the later Execution-owned WP06 evidence relations/functions before replaying the complete Execution migration set, preserving repeatable browser/runtime validation.
- The dedicated Execution evidence suite resets the complete pre-existing Professional Review relation set, including command evidence, before replaying all Execution-owned migrations; this prevents namespace leakage while retaining strict create-once migration semantics.

## Acceptance evidence

Hosted PostgreSQL suites must prove versioning/correction, authenticated provider lineage, idempotent return replay, stale return rejection, exact Execution source validation, response-loss-safe handoff replay, persistence reload and closed authority consequences. The WP06 MGSN and Execution PostgreSQL suites are permanent gates in the repository validation workflow.
