# M15 — Execution Sandbox & Release Readiness

## Scope lock

M15 takes the durable, authenticated M14 operational execution workbench and makes it safe to exercise end to end in non-production environments while producing auditable release-readiness evidence.

M15 does not authorize live filing, live payment, live provider contact, production credentials, production migration, deployment, or GA. Its purpose is to prove that the M12 -> M14 workflow can be rehearsed with explicit environment separation, non-production adapters, fail-closed egress controls, deterministic evidence, and operator-visible readiness gates before any later production-enablement decision.

The milestone loop is:

`M14 durable execution session -> environment policy -> sandbox action preparation -> non-production adapter -> simulated/provider-test response -> evidence classification -> operator review -> release-readiness evidence bundle`

## Work packages

### WP01 — Environment and execution-mode contracts

Freeze explicit execution environments and modes. Every protected action must carry an immutable environment classification and an execution mode that distinguishes simulation/test execution from any future production execution. Missing or ambiguous environment context fails closed.

### WP02 — Durable sandbox execution policy

Persist the environment/mode policy with the Execution-owned session. Prevent replay of a sandbox authorization or protected-action release into a different environment. Environment and mode become part of the durable idempotency fingerprint.

### WP03 — Non-production connector boundary

Introduce explicit connector interfaces for provider, authority/lifecycle and payment-adjacent execution paths, with sandbox/test implementations only. Connectors must never manufacture provider acceptance, official filing success, payment truth, or MarkReg lifecycle truth.

### WP04 — Egress and credential isolation

Add fail-closed configuration gates that reject protected execution when environment, endpoint allowlist, credential class, or connector mode does not match the sandbox/test policy. Production credentials and unrestricted external endpoints remain unauthorized.

### WP05 — Deterministic simulation and test fixtures

Provide deterministic simulated outcomes for success, rejection, timeout, ambiguous return, duplicate response, stale response and malformed response. Simulation evidence must remain distinguishable from provider claims and Official Truth.

### WP06 — Operator readiness bundle

Produce an operator-readable readiness bundle containing environment, authorization, plan, protected-action release, connector mode, endpoint class, evidence references, recovery state and unresolved human actions. Readiness is evidence for review, not deployment approval.

### WP07 — Observability and recovery drill

Exercise correlation IDs, audit continuity, bounded retry classification, dead-letter/replay rules, and recovery after process/database restart. External-consequence retries remain manual and fail closed.

### WP08 — Independent release-readiness audit

Run end-to-end sandbox drills covering workspace isolation, actor spoof rejection, stale version rejection, cross-environment replay rejection, idempotency conflict, credential/endpoint mismatch, connector failure, ambiguous response, evidence separation and recovery. Exact-head CI must be green before merge.

## Permanent authority locks

- Sandbox/test execution is not production execution.
- Simulation is not provider submission, authority filing, payment, publication, or external communication.
- A sandbox connector response is not Official Truth.
- Provider/test claims cannot directly mutate MarkReg Matter lifecycle truth.
- Payment truth remains owned by Payment; provider truth remains owned by MGSN; Matter lifecycle truth remains owned by MarkReg.
- Environment/mode cannot be inferred from a client-supplied URL, credential, or body field without trusted policy validation.
- Protected-action idempotency cannot cross environments or execution modes.
- No unrestricted egress.
- No production credentials.
- No live filing, payment, provider contact, publication, deployment, production migration, or GA.
- No cross-service SQL.
- Merge is not production enablement.

## Completion definition

M15 is complete when M14 execution can be exercised end to end through deterministic sandbox/test connectors with durable environment policy, cross-environment replay protection, fail-closed credential/egress controls, observable evidence/recovery behavior, operator readiness bundles and independent exact-head CI evidence.

Completion does not authorize production credentials, live external actions, deployment or GA.
