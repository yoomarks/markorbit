# MO MVP M5-WP-07 — Reliability Matrix

## Objective

Turn the M5-WP-01 through M5-WP-06 evidence-review and lifecycle path into one exact-head executable reliability gate before the independent M5-WP-08 integration and authority audit.

This work package adds reliability orchestration and evidence only. It does not expand product behavior or business authority.

## Reliability dimensions

The hosted gate must prove all of the following on the exact pull-request head:

- Execution migration `0033`, MarkReg migrations `0034` and `0035`, and Execution sender migration `0036` remain owner-scoped and executable;
- review and lifecycle repositories survive reconstruction/restart without losing durable truth;
- reviewed-source delivery converges after receiver unavailability, response loss, sender restart and receiver restart;
- exact replay is idempotent and changed retry payloads fail closed;
- concurrent review decisions and concurrent recommendation generation serialize without duplicate authoritative state;
- Workspace isolation remains enforced at Execution, MarkReg, Gateway and handoff boundaries;
- stale ID/version/fingerprint/action inputs fail closed;
- customer lifecycle presentation remains redacted while operations provenance requires the stronger review permission;
- Origin/CSRF and expired-session checks reject mutation before business state changes;
- real HTTP/runtime browser coverage remains green at desktop `1440x900` and mobile `390x844` without request interception;
- critical durable Execution and MarkReg suites pass a second cycle against the same owner databases;
- the M5 authority locks remain unchanged.

## Authority boundary

M5-WP-07 validates existing behavior and may not create stronger truth:

- Evidence Review Decision is not Official Truth.
- Review Admission is not Filing Submission.
- Lifecycle Projection is not trademark-office or other Official Status.
- Recommended Action is advice and does not authorize execution.
- No Payment or Invoice truth is created.
- No legal or professional appointment is created.
- No Formal Matter is automatically completed.
- No user Capability is automatically verified.
- No cross-service SQL is introduced.
- AI may not record authoritative review decisions, execute Recommended Actions or create Official Truth.

## Executable evidence

Machine-readable scenario inventory:

- `docs/validation/MO-MVP-MILESTONE-005-RELIABILITY-MATRIX.json`

Aggregate exact-head runner:

- `scripts/run-milestone5-reliability.mjs`

Inventory validator:

- `scripts/validate-milestone5-reliability-matrix.mjs`

Hosted exact-head gate:

- `.github/workflows/milestone-5-reliability.yml`

The workflow provisions separate Execution and MarkReg PostgreSQL databases, installs Chromium for the existing real-runtime browser suite, runs all matrix groups, performs the final workspace check, and uploads `.artifacts/milestone-5-reliability.log` plus `.artifacts/milestone-5-reliability-evidence.json`.

## Exit criteria

M5-WP-07 is complete only when:

1. the Milestone 5 exact-head reliability workflow passes on the final PR head;
2. the repository's existing hosted validation/reliability/browser gates also pass on that same head;
3. no temporary helper workflow, debug bypass or product-scope expansion remains;
4. implementation traceability and the task index reflect WP-06 and WP-07 accurately.

Only after WP-07 is merged may M5-WP-08 begin the independent integration and authority audit.
