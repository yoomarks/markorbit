# M4-WP-04 — Service Package and Deterministic Eligibility

**Milestone:** MO-MVP-MILESTONE-004
**Direction:** `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`
**PR:** #52
**Status:** IMPLEMENTED_IN_PR_52

## Objective

Admit one exact governed Execution source into MGSN-owned Service Package truth and determine Provider eligibility deterministically without performing Allocation.

## Service Package ownership

Migration `0029_mgsn_service_package_eligibility` belongs only to `@markorbit/mgsn-service`. MGSN stores the Service Package, eligibility evaluations, idempotency result evidence and append-only audit in the MGSN owner database.

MGSN does not read Execution or MarkReg tables. The domain accepts an `ExecutionSourceAdmissionSource` bounded dependency that verifies the exact current Execution source and returns only current/stale/missing status plus the exact source fingerprint.

The admitted source preserves Workspace, Formal Matter reference/version where available, Preparation Lock, Filing Authorization, Execution Release, Filing Execution Task Draft, jurisdiction, service type/scope, immutable document/instruction references, requested execution window, Channel/Relationship Model context, correlation lineage, capture time and exact Execution source fingerprint.

The exact Execution source fingerprint is kept distinct from the deterministic MGSN Service Package fingerprint. A missing, stale or fingerprint-mismatched Execution source fails closed before Service Package truth is written.

## Deterministic Eligibility

Policy `mgsn-eligibility-v1` evaluates one exact current Provider Supply Capability against one exact current Service Package. The evaluation also uses the current Provider operational version so a later Provider suspension is not hidden by an older Supply Capability snapshot.

Blocking checks record explicit PASS/FAIL reasons for:

- exact Execution source currentness;
- Provider lineage match;
- Provider operational state;
- Supply Capability state;
- private MGSN supply-verification state;
- jurisdiction coverage;
- service-type coverage;
- effective-period coverage of the requested execution window;
- available capacity.

The deterministic fingerprint binds the exact Service Package version/fingerprint, Provider version/state, Provider Supply Capability version/fingerprint, policy version, outcome and checks. Identical idempotent replay returns the same stored evaluation even after later source change; a new evaluation attempt fails closed against stale source or stale Supply Capability lineage.

Candidate and evaluation lists are bounded private operating data. No rank, star score or public marketplace truth is introduced.

## Authority boundary

`ELIGIBLE` means only that the exact evaluated supply passed the MGSN eligibility policy for the exact Service Package input. It does not allocate or appoint the Provider.

WP-04 creates no:

- Allocation;
- Provider Acceptance;
- legal/professional appointment;
- Payment or Invoice;
- filing submission or trademark-office contact;
- official application/application-number truth;
- Formal Matter completion;
- user Capability verification;
- Official Truth.

AI may later explain or recommend eligible options, but it cannot create an Allocation command.

## Durability evidence

Real PostgreSQL coverage proves:

- MGSN migration ownership for 0028 and 0029;
- exact current Execution source admission;
- stale/missing/fingerprint-mismatch fail-closed behavior;
- durable/idempotent Service Package replay;
- deterministic ELIGIBLE checks;
- Provider suspension producing INELIGIBLE truth;
- stale Supply Capability version rejection;
- zero-availability INELIGIBLE truth;
- source recheck on fresh evaluation while exact replay remains stable;
- bounded private candidate/evaluation lists;
- append-only Service Package/Eligibility audit;
- no Allocation or external-authority consequence.

Permanent hosted coverage is wired into `.github/workflows/ci.yml` as `Run durable MGSN Service Package and Eligibility PostgreSQL suite`.

## Next dependency

After PR #52 merges with clean hosted gates, the next approved implementation step is `M4-WP-05 — Explicit Allocation and authenticated Provider Acceptance`.
